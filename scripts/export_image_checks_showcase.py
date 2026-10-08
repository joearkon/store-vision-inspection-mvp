"""Export only explicitly synthetic image-check rule assets to Pages."""
import json,sqlite3,re,shutil
from pathlib import Path
from apps.api.app.config import Settings

def export():
 folder=Settings.from_env().data_dir/'image-checks';target=Path('apps/web/dist/showcase');images=target/'image-checks/photos';images.mkdir(parents=True,exist_ok=True)
 with sqlite3.connect(folder/'records.sqlite3') as c:records=[(kind,json.loads(body)) for kind,body in c.execute('SELECT kind,body FROM records')]
 configs=[body for kind,body in records if kind=='config' and body.get('name')=='新品菜单核验（合成测试）']
 ids={c['id'] for c in configs};tasks=[body for kind,body in records if kind=='task' and body['rule'].get('source_config_id') in ids]
 photo_ids=set()
 for cfg in configs:
  cfg.pop('versions',None);cfg['versions']=[]
  for it in cfg.get('photoItems',[]):
   if it.get('reference_id'):photo_ids.add(it['reference_id'])
 safe=[]
 for t in tasks:
  row={k:t[k] for k in ['id','store','rule','photos','status','results','conclusion','ground_truth','sample_name','usage','created_at','started_at','completed_at','active_seconds'] if k in t};safe.append(row)
  photo_ids.update(t['photos'].values())
  for it in t['rule']['items']:
   if it.get('reference_id'):photo_ids.add(it['reference_id'])
 for pid in photo_ids:
  if not re.fullmatch(r'PHOTO-[0-9a-f]{32}',pid):raise ValueError('Invalid photo id')
  shutil.copyfile(folder/(pid+'.jpg'),images/(pid+'.jpg'))
 (target/'image-checks.json').write_text(json.dumps({'configs':configs,'tasks':safe},ensure_ascii=False),encoding='utf-8')
 return {'configs':len(configs),'tasks':len(safe),'photos':len(photo_ids)}
if __name__=='__main__':print(export())
