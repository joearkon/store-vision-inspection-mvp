import unittest,tempfile
from pathlib import Path
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from apps.api.app.agent import router
from apps.api.app.config import Settings
class DB:
 def fetch_all(self,sql,args=()):return [{'id':'STORE-JTU','name':'MOMOYO JTU','timezone':'Asia/Shanghai'}]
 def fetch_one(self,sql,args=()):return {'id':'STORE-JTU'}
class AgentTest(unittest.TestCase):
 def test_real_tool_loop_and_persisted_history(self):
  with tempfile.TemporaryDirectory() as d:
   app=FastAPI();app.include_router(router(Settings(data_dir=Path(d),vision_api_key='test'),DB()));client=TestClient(app)
   first={'choices':[{'message':{'role':'assistant','content':None,'tool_calls':[{'id':'tool1','type':'function','function':{'name':'list_stores','arguments':'{}'}}]}}],'usage':{'total_tokens':10}}
   second={'choices':[{'message':{'role':'assistant','content':'已接入 MOMOYO JTU 门店。'}}],'usage':{'total_tokens':12}}
   with patch('apps.api.app.agent.DoubaoVisionProvider._post',side_effect=[first,second]) as model:
    result=client.post('/api/agent/chat',json={'text':'有哪些门店'}).json()
    self.assertEqual(result['status'],'ready');self.assertEqual(model.call_count,2);self.assertEqual(result['messages'][-1]['tool_trace'][0]['tool'],'list_stores')
    self.assertIn('MOMOYO JTU',model.call_args.args[0]['messages'][-1]['content'])
   self.assertEqual(client.get('/api/agent/conversations').json()[0]['id'],result['id'])
   self.assertEqual(client.post('/api/agent/chat',json={'text':''}).status_code,422)
 def test_failure_is_not_a_fake_answer(self):
  with tempfile.TemporaryDirectory() as d:
   app=FastAPI();app.include_router(router(Settings(data_dir=Path(d)),DB()));client=TestClient(app)
   with patch('apps.api.app.agent.DoubaoVisionProvider._post',side_effect=RuntimeError('failure')):
    self.assertEqual(client.post('/api/agent/chat',json={'text':'查进度'}).status_code,502)
   row=client.get('/api/agent/conversations').json()[0]
   self.assertEqual(row['status'],'failed');self.assertEqual(len(row['messages']),1)
