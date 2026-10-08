import unittest
from unittest.mock import patch
from apps.api.app.analyzer import aggregate_table_clues
from apps.api.app.rules import E1Observation
from apps.api.app.notifier import FeishuNotifier, build_event_card
from apps.api.app.config import Settings
from tests.test_notifier import MemoryDatabase, Response, EVENT

def obs(t, state, confidence=.9):
    return E1Observation(t,state,confidence,str(t),'frame.jpg')

class RealStoreDemoTests(unittest.TestCase):
    def test_departure_requires_prior_occupancy_and_three_frames(self):
        residual=[obs(t,'departed_residual') for t in range(1,5)]
        self.assertEqual(aggregate_table_clues(residual), [])
        self.assertEqual(aggregate_table_clues([obs(0,'occupied')]+residual[:2]), [])
        events=aggregate_table_clues([obs(0,'occupied')]+residual)
        self.assertEqual(len(events),1)
        self.assertEqual(events[0].first.state,'occupied')
        self.assertEqual(events[0].confirmed.offset_seconds,3)
    def test_uncertainty_and_gap_break_consecutive_hits(self):
        self.assertEqual(aggregate_table_clues([obs(0,'occupied'),obs(1,'departed_residual'),obs(2,'unknown'),obs(3,'departed_residual'),obs(4,'departed_residual')]), [])
        self.assertEqual(aggregate_table_clues([obs(0,'occupied'),obs(1,'departed_residual'),obs(10,'departed_residual'),obs(11,'departed_residual')]), [])
    def test_p2_automatic_labeled_and_idempotent(self):
        for code in ('A1','G2'):
            event=EVENT | dict(rule_code=code,severity='P2',title='疑似线索')
            db=MemoryDatabase(); notifier=FeishuNotifier(Settings(feishu_webhook_url='https://example.invalid'),db)
            with patch('apps.api.app.notifier.httpx.post',return_value=Response({'code':0})) as post:
                notifier.notify_event(event)
                notifier.notify_event(event)
                post.assert_called_once()
            card=build_event_card(event,'http://127.0.0.1:5173',test=True)
            self.assertIn('疑似线索',card['elements'][0]['content'])
            self.assertIn('非现场告警',card['header']['title']['content'])
            if code=='G2': self.assertIn('未判定清洁超时',card['elements'][1]['content'])
