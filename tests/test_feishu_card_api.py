from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from apps.api.app.config import Settings
from apps.api.app.db import utc_now
from apps.api.app.main import create_app


class FeishuCardApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.app = create_app(Settings(
            project_root=root, data_dir=root / "data", database_path=root / "data" / "test.sqlite3",
            feishu_webhook_url="https://example.invalid/test-hook", public_base_url="http://127.0.0.1:5173",
        ))
        self.context = TestClient(self.app, client=("127.0.0.1", 50000))
        self.client = self.context.__enter__()
        db = self.app.state.database
        now = utc_now()
        db.execute(
            """INSERT INTO video_assets
               (id, store_id, camera_id, source_kind, original_name, storage_path,
                size_bytes, sha256, created_at)
               VALUES ('VID-TEST', 'STORE-JTU', 'CAM-STORAGE-01', 'upload', 'test.mp4',
                       'test.mp4', 1, 'test', ?)""", (now,),
        )
        db.execute(
            """INSERT INTO analysis_runs
               (id, video_id, status, progress, stage, created_at)
               VALUES ('RUN-TEST', 'VID-TEST', 'completed', 1, 'completed', ?)""", (now,),
        )
        db.execute(
            """INSERT INTO inspection_events
               (id, run_id, store_id, camera_id, rule_code, title, severity, status,
                first_seen_offset, confirmed_offset, last_seen_offset, max_confidence,
                created_at, updated_at)
               VALUES ('EVT-TEST', 'RUN-TEST', 'STORE-JTU', 'CAM-STORAGE-01',
                       'E1', '冰箱门持续开启', 'P1', 'pending_confirmation',
                       0, 30, 30, .9, ?, ?)""", (now, now),
        )

    def test_new_runs_default_notify_and_explicit_opt_out(self):
        on = self.client.post('/api/analysis-runs',json={'video_id':'VID-TEST','rule_code':'E1'})
        self.assertEqual(on.status_code,201)
        self.assertEqual(on.json()['notifications_enabled'],1)
        off = self.client.post('/api/analysis-runs',json={'video_id':'VID-TEST','rule_code':'E1','notifications_enabled':False})
        self.assertEqual(off.json()['notifications_enabled'],0)

    def tearDown(self):
        self.context.__exit__(None, None, None)
        self.temp.cleanup()

    def test_preview_is_actual_e1_event_and_no_delivery(self):
        response = self.client.get("/api/feishu/test-preview/EVT-TEST")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["event"]["rule_code"], "E1")
        self.assertEqual(data["transport"], "group_webhook")
        self.assertIn("EVT-TEST", data["card"]["elements"][0]["content"])
        self.assertIsNone(data["delivery"])

    def test_new_e1_p0_preview_uses_p0_card(self):
        self.app.state.database.execute(
            "UPDATE inspection_events SET severity='P0' WHERE id='EVT-TEST'"
        )
        response = self.client.get("/api/feishu/test-preview/EVT-TEST")
        self.assertEqual(response.status_code, 200)
        self.assertIn("P0", response.json()["card"]["header"]["title"]["content"])

    def test_b1_p0_can_preview_and_send_manual_test_only(self):
        db = self.app.state.database
        now = utc_now()
        db.execute(
            """INSERT INTO inspection_events
               (id, run_id, store_id, camera_id, rule_code, title, severity, status,
                first_seen_offset, confirmed_offset, last_seen_offset, max_confidence,
                created_at, updated_at)
               VALUES ('EVT-B1-P0', 'RUN-TEST', 'STORE-JTU', 'CAM-STORAGE-01',
                       'B1', '疑似烟雾/异常明火', 'P0', 'pending_confirmation',
                       0, 2, 3, .9, ?, ?)""", (now, now),
        )
        preview = self.client.get("/api/feishu/test-preview/EVT-B1-P0")
        self.assertEqual(preview.status_code, 200)
        self.assertIn("B1", preview.json()["card"]["elements"][0]["content"])
        self.assertIn("需人工复核", preview.json()["card"]["elements"][0]["content"])
        with patch("apps.api.app.notifier.httpx.post") as post:
            post.return_value.status_code = 200
            post.return_value.json.return_value = {"code": 0}
            sent = self.client.post("/api/feishu/test-send", json={
                "event_id": "EVT-B1-P0", "confirm": True,
            })
        self.assertEqual(sent.status_code, 200)
        self.assertEqual(sent.json()["delivery"]["status"], "sent")
        self.assertIn("测试通知", post.call_args.kwargs["json"]["card"]["header"]["title"]["content"])

    def test_historical_b1_p2_cannot_be_mislabeled_p0(self):
        self.app.state.database.execute(
            "UPDATE inspection_events SET rule_code='B1', severity='P2' WHERE id='EVT-TEST'"
        )
        self.assertEqual(self.client.get("/api/feishu/test-preview/EVT-TEST").status_code, 422)
        self.assertEqual(self.client.post("/api/feishu/test-send", json={
            "event_id": "EVT-TEST", "confirm": True,
        }).status_code, 422)

    def test_send_is_explicit_and_idempotent(self):
        with patch("apps.api.app.notifier.httpx.post") as post:
            post.return_value.status_code = 200
            post.return_value.json.return_value = {"code": 0}
            first = self.client.post("/api/feishu/test-send", json={
                "event_id": "EVT-TEST", "confirm": True,
            })
            second = self.client.post("/api/feishu/test-send", json={
                "event_id": "EVT-TEST", "confirm": True,
            })
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()["delivery"]["status"], "sent")
        self.assertFalse(first.json()["duplicate"])
        self.assertTrue(second.json()["duplicate"])
        post.assert_called_once()

    def test_g2_uses_selected_two_stage_and_enables_notifications(self):
        db=self.app.state.database
        db.execute("UPDATE video_assets SET camera_id='CAM-DINING-01' WHERE id='VID-TEST'")
        db.execute("UPDATE camera_sources SET roi_json=? WHERE id='CAM-DINING-01'", (db.json({'id':'table','bbox':[0,0,.2,.5]}),))
        result=self.client.post('/api/analysis-runs',json={'video_id':'VID-TEST','rule_code':'G2','analysis_mode':'two_stage','notifications_enabled':True})
        self.assertEqual(result.status_code,201)
        self.assertEqual(result.json()['analysis_mode'],'two_stage')
        self.assertEqual(result.json()['notifications_enabled'],1)
        db.execute("UPDATE camera_sources SET roi_json=NULL WHERE id='CAM-DINING-01'")
        self.assertEqual(self.client.post('/api/analysis-runs',json={'video_id':'VID-TEST','rule_code':'G2'}).status_code,400)

    def test_table_image_requires_configured_camera_and_fixed_asset(self):
        db=self.app.state.database
        self.assertEqual(self.client.get('/api/cameras/CAM-STORAGE-01/table-layout/image').status_code,404)
        db.execute("UPDATE camera_sources SET roi_json=? WHERE id='CAM-STORAGE-01'",(db.json({'table_layout':{'tables':[]}}),))
        folder=self.app.state.settings.data_dir/'table-calibration'
        folder.mkdir(parents=True,exist_ok=True)
        (folder/'table-layout-review.png').write_bytes(b'test-image')
        self.assertEqual(self.client.get('/api/cameras/CAM-STORAGE-01/table-layout/image').content,b'test-image')
        self.assertEqual(self.client.get('/api/cameras/CAM-STORAGE-01/table-layout/image?view=../../secret').status_code,422)

    def test_auto_scene_upload_and_rule_guards(self):
        asset=self.client.post('/api/videos?filename=table.mp4&detect_scene=true',content=b'video').json()
        db=self.app.state.database
        camera=db.fetch_one('SELECT area_type FROM camera_sources WHERE id=?',(asset['camera_id'],))
        self.assertEqual(camera['area_type'],'unknown')
        self.assertEqual(self.client.get(f"/api/videos/{asset['id']}/scene").json()['status'],'queued')
        self.assertEqual(self.client.post('/api/analysis-runs',json={'video_id':asset['id'],'rule_code':'E1'}).status_code,409)
        from apps.api.app.scene import match_scene
        result=match_scene({'image_quality':'usable','video_start_clock':None,'regions':[{'kind':'table','name':'餐桌','bbox':[.1,.2,.4,.5],'confidence':.95,'evidence':'可见'}]},{'G2'})
        db.execute("UPDATE scene_jobs SET status='completed',result_json=? WHERE video_id=?",(db.json(result),asset['id']))
        self.assertEqual(self.client.post('/api/analysis-runs',json={'video_id':asset['id'],'rule_code':'E1'}).status_code,400)
        body={'video_id':asset['id'],'rule_code':'G2','scene_request':True}
        first=self.client.post('/api/analysis-runs',json=body)
        self.assertEqual(first.status_code,201)
        second=self.client.post('/api/analysis-runs',json=body)
        self.assertEqual(first.json()['id'],second.json()['id'])
        self.assertEqual(db.fetch_one('SELECT roi_snapshot_json FROM analysis_runs WHERE id=?',(first.json()['id'],))['roi_snapshot_json'],db.json(result['roi']))

    def test_scene_confirmation_keeps_model_confidence_and_allows_ignoring_partial(self):
        db=self.app.state.database
        asset=self.client.post('/api/videos?filename=scene.mp4&detect_scene=true',content=b'video').json()
        from apps.api.app.scene import match_scene
        raw={'image_quality':'usable','video_start_clock':'15:25','regions':[
            {'kind':'table','name':'桌面','bbox':[.1,.2,.4,.5],'confidence':.6,'evidence':'模糊'},
            {'kind':'table','name':'边缘','bbox':[0,.9,.1,1],'confidence':.5,'evidence':'不完整'}]}
        value=match_scene(raw,{'G2'})
        value.update(preview_url='/api/videos/'+asset['id']+'/scene/image',usage={})
        db.execute("UPDATE scene_jobs SET status='completed',result_json=? WHERE video_id=?",(db.json(value),asset['id']))
        response=self.client.post('/api/videos/'+asset['id']+'/scene/confirm',json={'region_kinds':['table','ignore']})
        self.assertEqual(response.status_code,200)
        result=response.json()['result']
        self.assertFalse(result['needs_confirmation'])
        self.assertEqual(result['regions'][0]['confidence'],.6)
        self.assertEqual(len(result['regions']),1)
        self.assertEqual(len(result['original_regions']),2)
        self.assertEqual(result['rules'],['G2'])

    def test_operations_configuration_preserves_store_camera_membership(self):
        result=self.client.get('/api/operations/config')
        self.assertEqual(result.status_code,200)
        payload=result.json()
        stores={store['id'] for store in payload['stores']}
        self.assertIn('STORE-JTU',stores)
        for camera in payload['cameras']:
            self.assertIn(camera['store_id'],stores)
            self.assertEqual(set(camera),{'id','name','store_id','area_type','roi_json'})
        self.assertNotIn('feishu',str(payload).lower())

    def test_manual_p2_clues_preview_and_send(self):
        for code in ('A1', 'G2'):
            self.app.state.database.execute("UPDATE inspection_events SET rule_code=?, severity='P2' WHERE id='EVT-TEST'", (code,))
            preview=self.client.get('/api/feishu/test-preview/EVT-TEST')
            self.assertEqual(preview.status_code,200)
            self.assertIn(code,preview.json()['card']['elements'][0]['content'])
        with patch('apps.api.app.notifier.httpx.post') as post:
            post.return_value.status_code=200
            post.return_value.json.return_value={'code':0}
            self.assertEqual(self.client.post('/api/feishu/test-send',json={'event_id':'EVT-TEST','confirm':True}).json()['delivery']['status'],'sent')

    def test_rejects_unconfirmed_or_remote_send(self):
        self.assertEqual(self.client.post("/api/feishu/test-send", json={
            "event_id": "EVT-TEST", "confirm": False,
        }).status_code, 422)
        with TestClient(self.app, client=("192.0.2.2", 50000)) as remote:
            self.assertEqual(remote.post("/api/feishu/test-send", json={
                "event_id": "EVT-TEST", "confirm": True,
            }).status_code, 403)
        self.assertEqual(self.client.post("/api/feishu/test-send", json={
            "event_id": "EVT-TEST", "confirm": True,
        }, headers={"origin": "https://attacker.invalid"}).status_code, 403)


if __name__ == "__main__":
    unittest.main()
