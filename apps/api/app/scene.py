from __future__ import annotations
import json,subprocess,re
from pathlib import Path
from .db import utc_now
from .costs import estimate_analysis_cost
from .media import probe_duration

REGION_RULES={'fridge':['E1'],'counter':['A1'],'operation':['A1','A2','C1','A3','B1'],'floor':['A4','M1'],'table':['G2']}
def validate_scene(result):
 if result.get('image_quality') not in ('usable','insufficient'): raise ValueError('场景质量结果无效')
 if not isinstance(result.get('regions'),list) or len(result['regions'])>20: raise ValueError('区域列表无效')
 for r in result['regions']:
  b=r.get('bbox',[])
  if r.get('kind') not in REGION_RULES or len(b)!=4 or any(not isinstance(v,(int,float)) or not 0<=v<=1 for v in b) or b[0]>=b[2] or b[1]>=b[3]: raise ValueError(f'区域坐标无效：{r.get("kind")} {b}')
  if not isinstance(r.get('confidence'),(int,float)) or not 0<=r['confidence']<=1: raise ValueError('区域置信度无效')

def match_scene(result, enabled, known_roi=None):
 validate_scene(result)
 confident=[r for r in result['regions'] if r['confidence']>=.85 or r.get('confirmed')] if result['image_quality']=='usable' else []
 rules=sorted({code for r in confident for code in REGION_RULES[r['kind']] if code in enabled})
 clock=result.get('video_start_clock')
 deferred=[]
 if 'M1' in rules and (not isinstance(clock,str) or not re.fullmatch(r'(?:[01][0-9]|2[0-3]):[0-5][0-9]',clock)):
  rules.remove('M1');deferred.append({'rule':'M1','reason':'画面起始时钟不可读，开店拖地时段无法自动核对'})
 if 'M1' in rules and not '09:10'<=clock<='09:30':
  rules.remove('M1');deferred.append({'rule':'M1','reason':'画面起始时钟不在09:10–09:30开店检查时段，本次不启动开店规则'})
 tables=sorted([r for r in confident if r['kind']=='table'],key=lambda r:(r['bbox'][0],r['bbox'][1]))
 roi=None
 if tables:
  def overlap(a,b):
   area=max(0,min(a[2],b[2])-max(a[0],b[0]))*max(0,min(a[3],b[3])-max(a[1],b[1]))
   return area/max(.00001,(a[2]-a[0])*(a[3]-a[1]))
  known_tables=(known_roi or {}).get('table_layout',{}).get('tables',[])
  matching=any(overlap(t.get('table_bbox',known_roi.get('bbox',[0,0,0,0])),r['bbox'])>=.6 for t in known_tables if t['id']==known_roi.get('id') for r in tables)
  if matching:
   roi=known_roi
  else:
   t=tables[0];b=t['bbox'];roi={'id':'T01','name':t['name'],'bbox':b,
    'table_layout':{'active_table_id':'T01','method':'model_scene_candidates','tables':[{'id':f'T{i+1:02d}','name':t['name'],'table_bbox':t['bbox'],'table_polygon':[[t['bbox'][0],t['bbox'][1]],[t['bbox'][2],t['bbox'][1]],[t['bbox'][2],t['bbox'][3]],[t['bbox'][0],t['bbox'][3]]],'seat_bbox':None,'review_status':'model_candidate'} for i,t in enumerate(tables)]}}
 return {'regions':result['regions'],'image_quality':result['image_quality'],'rules':rules,'roi':roi,
         'known_layout_used':bool(roi is known_roi and roi),
         'needs_confirmation':not confident or result['image_quality']!='usable' or any(r['confidence']<.85 and not r.get('confirmed') for r in result['regions']),
         'video_start_clock':clock,'deferred_rules':deferred}

def run_scene(settings,db,video_id,provider):
 try:
  video=db.fetch_one('SELECT v.*,c.roi_json FROM video_assets v JOIN camera_sources c ON c.id=v.camera_id WHERE v.id=?',(video_id,))
  duration=probe_duration(Path(video['storage_path']))
  folder=settings.data_dir/'scenes'/video_id;folder.mkdir(parents=True,exist_ok=True)
  images=[]
  for i,t in enumerate([0,min(duration/2,10),max(0,min(duration-.1,20))]):
   path=folder/f'{i}.jpg'
   subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(t),'-i',video['storage_path'],'-frames:v','1','-vf','scale=1280:-2',str(path)],check=True,capture_output=True)
   images.append(path)
  response=provider.inspect_scene(images)
  enabled={r['rule_code'] for r in db.fetch_all('SELECT rule_code FROM store_rule_settings WHERE store_id=? AND enabled=1',(video['store_id'],))}
  (folder/'model-response.json').write_text(json.dumps(response,ensure_ascii=False),encoding='utf-8')
  result=match_scene(response['result'],enabled,json.loads(video['roi_json'] or '{}'))
  usage=response['raw'].get('usage',{})
  result['usage']={'model_id':response['raw'].get('model'),'request_count':1,'prompt_tokens':usage.get('prompt_tokens',0),'completion_tokens':usage.get('completion_tokens',0)}
  result['usage'].update(estimate_analysis_cost(result['usage']))
  result['preview_url']=f'/api/videos/{video_id}/scene/image'
  result['origin']='doubao_scene';result['confirmed']=False
  db.execute("UPDATE scene_jobs SET status='completed',result_json=?,completed_at=?,error_message=NULL WHERE video_id=?",(db.json(result),utc_now(),video_id))
 except Exception as exc:
  db.execute("UPDATE scene_jobs SET status='failed',error_message=?,completed_at=? WHERE video_id=?",(str(exc)[:600],utc_now(),video_id))
  raise
