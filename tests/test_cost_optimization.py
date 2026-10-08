import tempfile
import unittest
from pathlib import Path
import tests.test_analysis_pipeline as pipeline
from apps.api.app.analyzer import table_refinement_indices
from apps.api.app.vision import VideoOpenSegment, VideoScreening, VisionObservation

class TableProvider:
 def __init__(self, quality="usable", segments=True): self.quality=quality; self.segments=segments; self.calls=0
 def inspect_rule_segments(self, rule, path, camera, fps, roi):
  assert fps==.2
  return VideoScreening(self.quality,[VideoOpenSegment(8,25,.9,"离席")] if self.segments else [],{"model":"doubao-seed-2-1-pro-260915","usage":{"prompt_tokens":100,"completion_tokens":10}})
 def inspect_rule_frame(self, rule, path, camera, roi):
  self.calls+=1
  i=int(path.stem.split("_")[-1])-1
  return VisionObservation("usable","occupied" if i<8 else "departed_residual",.9,"真实夹具",None,{"model":"doubao-seed-2-1-pro-260915","usage":{"prompt_tokens":20,"completion_tokens":2}})

class CostOptimizationTests(unittest.TestCase):
 def test_table_preserves_occupancy_and_adjacent_confirmation_with_fewer_calls(self):
  with tempfile.TemporaryDirectory() as temp:
   provider=TableProvider()
   db=pipeline.AnalysisPipelineTests()._run_video(Path(temp),"G2","CAM-DINING-01",32,provider)
   self.assertEqual(len(db.fetch_all("SELECT * FROM inspection_events")),1)
   self.assertLess(provider.calls,20)
   phases=db.fetch_all("SELECT phase,SUM(prompt_tokens) tokens FROM analysis_usage GROUP BY phase")
   self.assertEqual({p["phase"] for p in phases},{"screening","refining"})
   run=db.fetch_one("SELECT * FROM analysis_runs")
   self.assertGreater(run["active_seconds"],0)
   self.assertEqual(sum(p["tokens"] for p in phases),run["prompt_tokens"])
 def test_no_candidate_does_not_spend_frame_calls(self):
  with tempfile.TemporaryDirectory() as temp:
   provider=TableProvider(segments=False)
   db=pipeline.AnalysisPipelineTests()._run_video(Path(temp),"G2","CAM-DINING-01",5,provider)
   self.assertEqual(provider.calls,0)
   self.assertEqual(db.fetch_one("SELECT status FROM analysis_runs")["status"],"completed")
 def test_unusable_screen_pauses_instead_of_spending_baseline(self):
  with tempfile.TemporaryDirectory() as temp:
   provider=TableProvider(quality="insufficient")
   db=pipeline.AnalysisPipelineTests()._run_video(Path(temp),"G2","CAM-DINING-01",5,provider)
   self.assertEqual(provider.calls,0)
   self.assertEqual(db.fetch_one("SELECT status FROM analysis_runs")["status"],"awaiting_approval")
 def test_targets_bounded_and_safe(self):
  targets=table_refinement_indices([VideoOpenSegment(8,25,.9,"x")]*20,32,1)
  self.assertIn(0,targets)
  self.assertTrue({8,9,10}.issubset(targets))
  self.assertLess(len(targets),20)

class MoppingProvider(TableProvider):
 def inspect_rule_segments(self,rule,path,camera,fps,roi):
  assert fps==.2
  return VideoScreening("usable",[VideoOpenSegment(1,9,.9,"拖地")],{"usage":{"prompt_tokens":100}})
 def inspect_rule_frame(self,rule,path,camera,roi):
  self.calls+=1
  i=int(path.stem.split("_")[-1])-1
  return VisionObservation("usable","mopping" if i in [5,7] else "not_mopping",.9,"夹具",None,{"usage":{"prompt_tokens":20}})

class MoppingOptimizationTests(unittest.TestCase):
 def test_interior_refinement_recovers_positive_without_dense_screen(self):
  with tempfile.TemporaryDirectory() as temp:
   provider=MoppingProvider()
   db=pipeline.AnalysisPipelineTests()._run_video(Path(temp),"M1","CAM-FRONT-01",10,provider,{"cleaning_video_start":"09:10"})
   self.assertEqual(db.fetch_one("SELECT verdict FROM cleaning_checks")["verdict"],"observed_mopping")
   self.assertEqual(provider.calls,5)
   self.assertEqual(db.fetch_all("SELECT * FROM inspection_events"),[])

 def test_missing_clock_still_checks_action_without_claiming_missed_window(self):
  with tempfile.TemporaryDirectory() as temp:
   provider=MoppingProvider()
   db=pipeline.AnalysisPipelineTests()._run_video(Path(temp),"M1","CAM-FRONT-01",10,provider,{"cleaning_video_start":None})
   self.assertEqual(db.fetch_one("SELECT verdict FROM cleaning_checks")["verdict"],"observed_mopping")
   self.assertGreater(provider.calls,0)
   self.assertEqual(db.fetch_all("SELECT * FROM inspection_events"),[])
 def test_known_outside_window_is_not_opening_cleaning(self):
  with tempfile.TemporaryDirectory() as temp:
   provider=MoppingProvider()
   db=pipeline.AnalysisPipelineTests()._run_video(Path(temp),"M1","CAM-FRONT-01",10,provider,{"cleaning_video_start":"16:00"})
   self.assertEqual(provider.calls,0)
   self.assertEqual(db.fetch_one("SELECT verdict FROM cleaning_checks")["verdict"],"insufficient_evidence")
