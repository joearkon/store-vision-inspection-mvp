import unittest, tempfile, json
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi.testclient import TestClient
from apps.api.app.config import Settings
from apps.api.app.main import create_app
from apps.api.app import sop

class SopTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();p=Path(self.tmp.name)
  self.ctx=TestClient(create_app(Settings(project_root=p,data_dir=p/'data',database_path=p/'data/test.sqlite3')))
  self.client=self.ctx.__enter__();self.db=self.client.app.state.database
 def tearDown(self):
  self.ctx.__exit__(None,None,None);self.tmp.cleanup()
 def state(self):return self.client.get('/api/sop').json()
 def test_real_empty_tasks_are_idempotent(self):
  first=self.state();second=self.state()
  self.assertEqual([t['id'] for t in first['tasks']],[t['id'] for t in second['tasks']])
  self.assertEqual(len(first['templates']),4);self.assertTrue(all(t['status']=='pending' for t in first['tasks']))
  self.assertEqual(first['stats']['passRate'],0)
 def test_template_changes_preserve_generated_snapshot(self):
  initial=self.state();task=next(t for t in initial['tasks'] if t['templateId']=='SOP-001');tpl=initial['templates'][0]
  tpl['name']='新开店检查';self.assertEqual(self.client.put('/api/sop/templates/SOP-001',json=tpl).status_code,200)
  self.assertEqual(next(t for t in self.state()['tasks'] if t['id']==task['id'])['name'],task['name'])
 def test_unsupported_ai_is_manual_and_bad_schedule_rejected(self):
  tpl=self.state()['templates'][0];tpl['items'][0]['aiType']='fire_exit'
  self.assertFalse(self.client.put('/api/sop/templates/SOP-001',json=tpl).json()['items'][0]['aiVerifiable'])
  tpl['scheduledTime']='99:99';self.assertEqual(self.client.put('/api/sop/templates/SOP-001',json=tpl).status_code,422)
 def test_manual_review_has_no_automatic_pass_and_audits(self):
  task=next(t for t in self.state()['tasks'] if t['templateId']=='SOP-001');url=f"/api/sop/tasks/{task['id']}/records/1"
  self.assertEqual(self.client.post(url,json={'result':'pass'}).status_code,422)
  self.assertEqual(self.client.post(url,json={'result':'review','note':'画面不足，待核查'}).status_code,200)
  self.assertEqual(next(t for t in self.state()['tasks'] if t['id']==task['id'])['status'],'in_progress')
  self.assertEqual(len(self.db.fetch_all('SELECT * FROM sop_audit')),1)
 def test_store_scoped_and_disabled_keeps_history(self):
  before=self.state();self.client.delete('/api/sop/templates/SOP-001')
  after=self.state();self.assertEqual(len(before['tasks']),len(after['tasks']))
  self.assertFalse(next(t for t in after['templates'] if t['id']=='SOP-001')['enabled'])
  self.assertEqual(self.client.get('/api/sop?store_id=OTHER').status_code,422)
 def test_weekly_only_monday_and_daily_dedupe(self):
  sop.generate(self.db,datetime(2026,10,12,12,tzinfo=ZoneInfo('Asia/Shanghai')))
  self.assertEqual(len(self.db.fetch_all("SELECT * FROM sop_tasks WHERE template_id='SOP-004' AND substr(scheduled_at,1,10)='2026-10-12'")),1)
  sop.generate(self.db,datetime(2026,10,13,12,tzinfo=ZoneInfo('Asia/Shanghai')))
  self.assertEqual(len(self.db.fetch_all("SELECT * FROM sop_tasks WHERE template_id='SOP-004' AND substr(scheduled_at,1,10)='2026-10-13'")),0)
 def test_launch_rejects_no_video_and_outside_capture(self):
  task=next(t for t in self.state()['tasks'] if t['templateId']=='SOP-001')
  self.assertEqual(self.client.post(f"/api/sop/tasks/{task['id']}/analyze/1",json={'video_id':'NONE','captured_at':task['scheduledAt']}).status_code,422)
  self.assertEqual(self.client.post(f"/api/sop/tasks/{task['id']}/records/1",json={'run_id':'NONE','captured_at':task['scheduledAt']}).status_code,422)
 def add_run(self,rule='M1',verdict='observed_mopping'):
  self.db.execute("INSERT INTO video_assets (id,store_id,camera_id,original_name,storage_path,source_kind,size_bytes,sha256,duration_seconds,created_at) VALUES ('VID-SOP','STORE-JTU','CAM-FRONT-01','test.mp4','test.mp4','upload',1,'hash',23,'2026-10-06')")
  self.db.execute("INSERT INTO analysis_runs (id,video_id,status,rule_code,created_at,rule_config_snapshot_json) VALUES ('RUN-SOP','VID-SOP','completed',?,'2026-10-06',?)",(rule,json.dumps({'cleaning_video_start':'09:10'})))
  if rule=='M1': self.db.execute("INSERT INTO cleaning_checks VALUES ('RUN-SOP',?,'真实观察说明','[]','2026-10-06')",(verdict,))
 def test_mopping_positive_is_pass_but_negative_remains_review(self):
  self.add_run();task=next(t for t in self.state()['tasks'] if t['templateId']=='SOP-001');url=f"/api/sop/tasks/{task['id']}/records/2"
  payload={'run_id':'RUN-SOP','captured_at':task['scheduledAt']}
  self.assertEqual(self.client.post(url,json=payload).json()['result'],'pass')
  self.db.execute("UPDATE cleaning_checks SET verdict='not_observed_review' WHERE run_id='RUN-SOP'")
  self.assertEqual(self.client.post(url,json=payload).json()['result'],'review')
 def test_ppe_short_video_does_not_prove_whole_window(self):
  self.add_run('A1');task=next(t for t in self.state()['tasks'] if t['templateId']=='SOP-001')
  self.assertEqual(self.client.post(f"/api/sop/tasks/{task['id']}/records/1",json={'run_id':'RUN-SOP','captured_at':task['scheduledAt']}).json()['result'],'review')
 def test_launch_is_idempotent_and_persistent_queue(self):
  self.add_run('A1');task=next(t for t in self.state()['tasks'] if t['templateId']=='SOP-001')
  url=f"/api/sop/tasks/{task['id']}/analyze/1";payload={'video_id':'VID-SOP','captured_at':task['scheduledAt']}
  a=self.client.post(url,json=payload);b=self.client.post(url,json=payload)
  self.assertEqual(a.status_code,200);self.assertEqual(a.json()['id'],b.json()['id']);self.assertEqual(a.json()['status'],'queued')
  self.assertEqual(a.json()['notifications_enabled'],1)
  self.assertEqual(len(self.db.fetch_all('SELECT * FROM sop_run_links')),1)
 def test_daily_sampling_two_slots_and_operating_hours(self):
  current=self.state();self.assertEqual(current['operating']['operating_hours'],14)
  sampled=[t for t in current['tasks'] if t['templateId']=='SOP-003']
  self.assertEqual([t['scheduledTime'] for t in sampled],['11:00','16:00'])
  self.assertIn('上午',sampled[0]['name']);self.assertIn('下午',sampled[1]['name'])
  tpl=next(t for t in current['templates'] if t['id']=='SOP-003')
  self.assertEqual(tpl['frequency'],'每日两次');self.assertEqual(tpl['name'],'每日正常巡检')
