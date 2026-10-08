import unittest,tempfile,io
from pathlib import Path
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image
from apps.api.app.config import Settings
from apps.api.app.image_checks import router,conclusion
class ImageChecksTest(unittest.TestCase):
 def test_workflow_and_retry(self):
  with tempfile.TemporaryDirectory() as d:
   app=FastAPI();app.include_router(router(Settings(data_dir=Path(d),vision_api_key='test')));c=TestClient(app)
   rule=c.post('/api/image-checks/rules',json={'name':'菜单核验','items':[{'id':'a','name':'价格','standard':'价格为10元'},{'id':'b','name':'海报','standard':'有海报'}]}).json()
   image=io.BytesIO();Image.new('RGB',(80,80),'white').save(image,format='PNG')
   photo=c.post('/api/image-checks/photos',content=image.getvalue()).json()
   task=c.post('/api/image-checks/tasks',json={'rule_id':rule['id'],'store':'试点店'}).json()
   c.put('/api/image-checks/tasks/'+task['id']+'/photos',json={'a':photo['id']})
   response={'choices':[{'message':{'content':'{"status":"pass","reason":"价格清晰为10元"}'}}],'usage':{'total_tokens':5}}
   with patch('apps.api.app.image_checks.DoubaoVisionProvider._post',return_value=response) as model:
    result=c.post('/api/image-checks/tasks/'+task['id']+'/analyze').json()
    self.assertEqual(result['conclusion'],'need_photo');self.assertEqual(result['results']['a']['photo_id'],photo['id'])
    c.post('/api/image-checks/tasks/'+task['id']+'/analyze');self.assertEqual(model.call_count,1)
   self.assertEqual(c.post('/api/image-checks/photos',content=b'bad').status_code,422)
   self.assertEqual(c.put('/api/image-checks/tasks/'+task['id']+'/photos',json={}).status_code,409)
 def test_fail_precedes_missing(self):
  self.assertEqual(conclusion({'a':{'status':'fail'},'b':{'status':'need_photo'}},[{'id':'a','required':True},{'id':'b','required':True}]),'fail')
 def test_configuration_versions_and_validation(self):
  with tempfile.TemporaryDirectory() as d:
   app=FastAPI();app.include_router(router(Settings(data_dir=Path(d))));c=TestClient(app)
   config={'id':'NEW','name':'新品菜单','type':'image','severity':'P2','status':'draft','statusLabel':'草稿','params':{'inputType':'image'},'notifications':[]}
   saved=c.post('/api/image-checks/configs',json=config).json()
   self.assertTrue(saved['id'].startswith('RULE-'));self.assertEqual(saved['version'],'v1')
   invalid={**saved,'status':'testing'}
   self.assertEqual(c.post('/api/image-checks/configs',json=invalid).status_code,422)
   valid={**invalid,'statusLabel':'测试中','photoItems':[{'id':'a','name':'菜单价格','standard':'草莓18元'}]}
   second=c.post('/api/image-checks/configs',json=valid).json()
   self.assertEqual(second['version'],'v2');self.assertEqual(len(second['versions']),2)
   self.assertEqual(c.get('/api/image-checks/configs').json()[0]['id'],saved['id'])
   r=c.post('/api/image-checks/rules',json={'name':'样本','items':valid['photoItems'],'source_config_id':saved['id']}).json()
   self.assertEqual(r['source_config_id'],saved['id'])
 def test_malformed_configuration_cannot_break_page(self):
  with tempfile.TemporaryDirectory() as d:
   app=FastAPI();app.include_router(router(Settings(data_dir=Path(d))));c=TestClient(app)
   config={'name':'检查','type':'image','severity':'P2','status':'draft','params':{}}
   for invalid in [{'params':[]},{'photoItems':['bad']},{'notifications':'bad'},{'params':{'exceptions':'bad'}}]:
    self.assertEqual(c.post('/api/image-checks/configs',json={**config,**invalid}).status_code,422)
   saved=c.post('/api/image-checks/configs',json=config).json()
   self.assertEqual(saved['statusLabel'],'草稿')
 def test_sample_label_persists_without_model_result(self):
  with tempfile.TemporaryDirectory() as d:
   app=FastAPI();app.include_router(router(Settings(data_dir=Path(d))));c=TestClient(app)
   r=c.post('/api/image-checks/rules',json={'name':'菜单','items':[{'id':'a','name':'价格','standard':'18元'}],'source_config_version':'v2'}).json()
   t=c.post('/api/image-checks/tasks',json={'rule_id':r['id'],'store':'样本','sample_name':'正常.png'}).json()
   path='/api/image-checks/tasks/'+t['id']+'/label'
   self.assertEqual(c.put(path,json={'ground_truth':'other'}).status_code,422)
   labeled=c.put(path,json={'ground_truth':'pass'}).json()
   self.assertEqual(labeled['ground_truth'],'pass');self.assertEqual(labeled['results'],{})
   result=c.post('/api/image-checks/tasks/'+t['id']+'/analyze').json()
   self.assertEqual(result['ground_truth'],'pass');self.assertEqual(result['conclusion'],'need_photo')
   self.assertEqual(result['sample_name'],'正常.png');self.assertEqual(result['rule']['source_config_version'],'v2')
 def test_short_code_stays_stable_and_unique(self):
  with tempfile.TemporaryDirectory() as d:
   app=FastAPI();app.include_router(router(Settings(data_dir=Path(d))));c=TestClient(app)
   payload={'name':'检查','type':'image','severity':'P2','status':'draft','params':{}}
   first=c.post('/api/image-checks/configs',json=payload).json();second=c.post('/api/image-checks/configs',json=payload).json()
   self.assertEqual(first['code'],'R1');self.assertEqual(second['code'],'R2')
   saved=c.post('/api/image-checks/configs',json={**first,'code':'FAKE'}).json()
   self.assertEqual(saved['code'],'R1');self.assertEqual(saved['id'],first['id'])
