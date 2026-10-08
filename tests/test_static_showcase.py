import json
import unittest

from scripts.export_static_showcase import event_detail, run_row
from unittest.mock import patch


class StaticShowcaseSanitizationTests(unittest.TestCase):
    def test_run_projection_excludes_model_payloads_paths_and_internal_errors(self):
        projected = run_row({
            "id": "RUN-1", "status": "failed", "storage_path": "secret.mp4",
            "raw_response_json": '{"credential":"secret"}',
            "error_message": "internal credential detail",
            "screening_result_json": json.dumps({
                "segments": [{"image_path": "private.jpg", "model_note": "private"}],
            }),
        })
        encoded = json.dumps(projected)
        self.assertNotIn("secret.mp4", encoded)
        self.assertNotIn("credential", encoded)
        self.assertNotIn("private.jpg", encoded)
        self.assertNotIn("internal credential detail", encoded)
        self.assertEqual(len(json.loads(projected["screening_result_json"])["segments"]), 1)

    def test_event_projection_excludes_notification_delivery_and_image_paths(self):
        projected = event_detail({
            "id": "EVT-1", "camera_id":"CAM-STORAGE-01", "image_path": "private.jpg",
            "notifications": [{"webhook_url": "secret"}],
            "evidence": [{"id": "EVID-1", "image_path": "private.jpg"}],
            "timeline": [{"id": "TIME-1", "note": "historical action"}],
        })
        self.assertEqual(projected["notifications"], [])
        self.assertEqual(projected["evidence"], [{"id": "EVID-1"}])
        self.assertNotIn("secret", json.dumps(projected))
        self.assertNotIn("private.jpg", json.dumps(projected))

    def test_real_records_keep_results_without_publishing_images(self):
        detail=event_detail({'id':'E','camera_id':'CAM-MOMOYO-REAL-TABLE','evidence':[{'id':'PRIVATE'}],'thumbnail_evidence_id':'PRIVATE'})
        self.assertEqual(detail['evidence'],[])
        self.assertIsNone(detail['thumbnail_evidence_id'])
        record=run_row({'id':'R','report':{'explanation':'result','frames':[{'image_url':'private.jpg'}],'observed_frame_count':4,'costs':{'video_task_count':2}}})
        self.assertEqual(record['report']['frames'],[])
        self.assertTrue(record['report']['images_withheld'])

    def test_explicit_picture_export_uses_public_urls_without_local_paths(self):
        with patch('scripts.export_static_showcase.PUBLISH_MONITORING_IMAGES',True):
            record=run_row({'report':{'explanation':'fact','observed_frame_count':1,'costs':{},'frames':[{'id':'F','captured_offset':0,'image_path':'private/path','image_url':'/api/media/findings/F'}]}})
        self.assertEqual(record['report']['frames'][0]['image_url'],'/showcase/findings/F.jpg')
        self.assertNotIn('private/path',json.dumps(record))


    def test_cleaning_verdict_and_all_frames_survive_public_projection(self):
        source={'cleaning_check':{'verdict':'observed_mopping','explanation':'观察到拖地','private_path':'secret','evidence_json':json.dumps([{'finding_id':'F','offset':79,'state':'mopping','image_path':'secret'}])}}
        with patch('scripts.export_static_showcase.PUBLISH_MONITORING_IMAGES',True):
            projected=run_row(source)
        self.assertEqual(projected['cleaning_check']['verdict'],'observed_mopping')
        self.assertEqual(json.loads(projected['cleaning_check']['evidence_json'])[0]['image_url'],'/showcase/findings/F.jpg')
        self.assertNotIn('secret',json.dumps(projected))
        self.assertEqual(json.loads(run_row(source)['cleaning_check']['evidence_json']),[])


if __name__ == "__main__":
    unittest.main()
