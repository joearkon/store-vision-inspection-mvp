import unittest
from apps.api.app.scene import match_scene,validate_scene

def region(kind,confidence=.95,bbox=None):
 return dict(kind=kind,confidence=confidence,bbox=bbox or [.1,.2,.4,.5],name=kind,evidence="画面可见")
def scene(regions,quality="usable",clock=None):
 return dict(regions=regions,image_quality=quality,video_start_clock=clock)

class SceneDetectionTests(unittest.TestCase):
 def test_table_video_cannot_become_fridge_due_to_camera_default(self):
  r=match_scene(scene([region('table')]),{'E1','G2'})
  self.assertEqual(r['rules'],['G2']);self.assertEqual(r['roi']['id'],'T01')
  self.assertFalse(r['needs_confirmation'])
 def test_rules_require_enabled_store_and_actual_visible_region(self):
  r=match_scene(scene([region('fridge'),region('floor')],clock='09:10'),{'M1'})
  self.assertEqual(r['rules'],['M1'])
 def test_low_confidence_and_bad_quality_never_dispatch(self):
  for value in [scene([region('table',.6)]),scene([region('fridge')],'insufficient')]:
   r=match_scene(value,{'G2','E1'})
   self.assertTrue(r['needs_confirmation']);self.assertEqual(r['rules'],[])
 def test_missing_clock_withholds_opening_rule(self):
  r=match_scene(scene([region('floor')]),{'M1','A4'})
  self.assertEqual(r['rules'],['A4']);self.assertEqual(r['deferred_rules'][0]['rule'],'M1')
 def test_known_layout_requires_geometry_overlap(self):
  known={'id':'T01','bbox':[.1,.2,.4,.5],'table_layout':{'tables':[{'id':'T01','table_bbox':[.1,.2,.4,.5]}]}}
  r=match_scene(scene([region('table')]),{'G2'},known)
  self.assertTrue(r['known_layout_used'])
  r=match_scene(scene([region('table',bbox=[.6,.6,.9,.9])]),{'G2'},known)
  self.assertFalse(r['known_layout_used'])
 def test_afternoon_does_not_start_opening_cleaning(self):
  r=match_scene(scene([region('floor')],clock='15:25'),{'M1','A4'})
  self.assertEqual(r['rules'],['A4'])
  self.assertEqual(r['deferred_rules'][0]['rule'],'M1')
 def test_invalid_coordinates_rejected(self):
  for bbox in [[.4,.2,.1,.5],[0,0,2,1],[0,0,1]]:
   with self.assertRaises(ValueError):validate_scene(scene([region('table',bbox=bbox)]))

class SceneProviderTests(unittest.TestCase):
 def test_real_provider_uses_images_and_structured_scene_schema(self):
  import tempfile,json
  from pathlib import Path
  from unittest.mock import patch
  from apps.api.app.config import Settings
  from apps.api.app.vision import DoubaoVisionProvider
  with tempfile.TemporaryDirectory() as folder:
   path=Path(folder)/'0.jpg';path.write_bytes(b'fixture')
   provider=DoubaoVisionProvider(Settings(vision_api_key='test'))
   output=scene([region('table',bbox=[100,200,400,500])]);output['coordinate_system']='normalized_1000'
   with patch.object(provider,'_post',return_value={'choices':[{'message':{'content':json.dumps(output)}}],'usage':{'prompt_tokens':10}}) as post:
    result=provider.inspect_scene([path])
   self.assertEqual(result['result']['regions'][0]['bbox'],[.1,.2,.4,.5])
   payload=post.call_args.args[0]
   self.assertEqual(payload['response_format']['json_schema']['name'],'store_scene')
   self.assertEqual(payload['messages'][0]['content'][1]['type'],'image_url')
