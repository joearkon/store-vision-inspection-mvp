import unittest
from apps.api.app.analyzer import cleaning_verdict,parse_cleaning_clock,cleaning_window_covered
from apps.api.app.rules import E1Observation
class CleaningRuleTests(unittest.TestCase):
 def test_two_distinct_frames_prove_action(self):
  frames=[E1Observation(i,'mopping',.9,str(i),'x') for i in [60,70]]
  self.assertEqual(cleaning_verdict(frames,'usable'),'observed_mopping')
  self.assertEqual(cleaning_verdict(frames[:1],'usable'),'insufficient_evidence')
 def test_absence_needs_both_full_window_and_finished(self):
  for complete,closed in [(False,False),(False,True),(True,False)]:
   self.assertEqual(cleaning_verdict([],'usable',complete,closed),'insufficient_evidence')
  self.assertEqual(cleaning_verdict([],'usable',True,True),'not_observed_review')
  self.assertEqual(cleaning_verdict([],'insufficient',True,True),'insufficient_evidence')
 def test_uncertain_observations_do_not_become_missed_cleaning(self):
  self.assertEqual(cleaning_verdict([E1Observation(0,'unknown',.8,'a','x')],'usable',True,True),'insufficient_evidence')
 def test_invalid_clock_is_not_opening_time(self):
  self.assertIsNone(parse_cleaning_clock(None))
  self.assertIsNone(parse_cleaning_clock('25:10'))
  self.assertEqual(parse_cleaning_clock('09:10'),550)

 def test_short_clip_cannot_claim_full_twenty_minute_window(self):
  self.assertFalse(cleaning_window_covered(550,103))
  self.assertFalse(cleaning_window_covered(551,1200))
  self.assertFalse(cleaning_window_covered(None,1200))
  self.assertTrue(cleaning_window_covered(550,1200))

 def test_missing_cleaning_can_notify_but_positive_is_not_an_event(self):
  from unittest.mock import patch
  from tests.test_notifier import MemoryDatabase,Response,EVENT
  from apps.api.app.notifier import FeishuNotifier,build_event_card
  from apps.api.app.config import Settings
  event=EVENT | dict(rule_code='M1',severity='P2',title='未观察到拖地（待核查）')
  db=MemoryDatabase()
  with patch('apps.api.app.notifier.httpx.post',return_value=Response({'code':0})) as post:
   notifier=FeishuNotifier(Settings(feishu_webhook_url='https://example.invalid'),db)
   notifier.notify_event(event)
   notifier.notify_event(event)
   post.assert_called_once()
  self.assertIn('09:10–09:30',build_event_card(event,'http://127.0.0.1:5173')['elements'][1]['content'])
