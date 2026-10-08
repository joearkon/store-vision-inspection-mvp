import unittest
from apps.api.app.run_report import build_run_report

class ReportTests(unittest.TestCase):
    def test_states_and_last_frame_retained_and_scene_counted_once(self):
        class DB:
            def fetch_all(self, sql, args):
                if 'frame_findings' in sql:
                    return [dict(id=str(i),captured_offset=i,visual_state=s,confidence=.9,evidence='fact',image_quality='usable') for i,s in enumerate(['departed_residual','departed_residual','occupied','clean','clean'])]
                return [dict(status='completed',model_id='doubao-seed-2-1-pro-260915',request_count=1,prompt_tokens=100,completion_tokens=0),dict(status='completed',model_id='doubao-seed-2-1-pro-260915',request_count=1,prompt_tokens=100,completion_tokens=0)]
        run=dict(id='R',video_id='V',status='completed',rule_code='G2',event_count=0,estimated_cost_yuan=.0006,scene_detection_usage={'estimated_cost_yuan':.01})
        report=build_run_report(DB(),run)
        self.assertEqual([r['captured_offset'] for r in report['frames']],[0,2,3,4])
        self.assertAlmostEqual(report['costs']['video_total_yuan'],.0112)
        self.assertAlmostEqual(report['costs']['rule_with_scene_yuan'],.0106)
        self.assertIn('后段',report['explanation'])
        self.assertIn('/api/media/findings/',report['frames'][0]['image_url'])
