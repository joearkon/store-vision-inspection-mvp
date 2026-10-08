"""Store-scoped schedules and immutable daily checklists; absence of data is unknown."""
import json
import re
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

CAPABILITIES = {'mask_detection': 'A1', 'uniform_check': 'C1', 'floor_mopping': 'M1'}
SCHEMA = '''
CREATE TABLE IF NOT EXISTS sop_store_settings(store_id TEXT PRIMARY KEY REFERENCES stores(id),opening_time TEXT NOT NULL,operating_hours INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sop_templates(store_id TEXT NOT NULL REFERENCES stores(id), id TEXT NOT NULL, config_json TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(store_id,id));
CREATE TABLE IF NOT EXISTS sop_tasks(id TEXT PRIMARY KEY, store_id TEXT NOT NULL REFERENCES stores(id), template_id TEXT NOT NULL, scheduled_at TEXT NOT NULL, due_at TEXT NOT NULL, snapshot_json TEXT NOT NULL, cancelled INTEGER NOT NULL DEFAULT 0, UNIQUE(store_id,template_id,scheduled_at));
CREATE TABLE IF NOT EXISTS sop_run_links(task_id TEXT NOT NULL REFERENCES sop_tasks(id),item_id TEXT NOT NULL,run_id TEXT NOT NULL REFERENCES analysis_runs(id),captured_at TEXT NOT NULL,processed INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(task_id,item_id,run_id));
CREATE TABLE IF NOT EXISTS sop_audit(id TEXT PRIMARY KEY,task_id TEXT,note TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sop_records(task_id TEXT NOT NULL REFERENCES sop_tasks(id), item_id TEXT NOT NULL, result TEXT NOT NULL, note TEXT NOT NULL, run_id TEXT REFERENCES analysis_runs(id), event_id TEXT, verified_at TEXT NOT NULL, PRIMARY KEY(task_id,item_id));
'''

def initialize(db):
    with db.connect() as c:
        c.executescript(SCHEMA)
        columns={r['name'] for r in c.execute('PRAGMA table_info(sop_tasks)')}
        if 'cancelled' not in columns: c.execute('ALTER TABLE sop_tasks ADD COLUMN cancelled INTEGER NOT NULL DEFAULT 0')
        defaults = json.loads(Path(__file__).with_name('sop_defaults.json').read_text(encoding='utf8'))
        for store in c.execute('SELECT id FROM stores').fetchall():
            c.execute('INSERT OR IGNORE INTO sop_store_settings VALUES (?,\'09:00\',14)',(store['id'],))
            c.execute("UPDATE sop_store_settings SET opening_time='09:00',operating_hours=14 WHERE store_id=? AND opening_time='09:10' AND operating_hours=16",(store['id'],))
            for tpl in defaults:
                c.execute('INSERT OR IGNORE INTO sop_templates VALUES (?,?,?,1)', (store['id'],tpl['id'],json.dumps(tpl,ensure_ascii=False)))
                prior=c.execute('SELECT config_json FROM sop_templates WHERE store_id=? AND id=?',(store['id'],tpl['id'])).fetchone()
                old=json.loads(prior['config_json'])
                rename_from={'SOP-001':['开店前检查'],'SOP-002':['闭店后检查'],'SOP-003':['卫生抽检','每小时卫生巡检']}.get(tpl['id'],[])
                if old.get('name') in rename_from:
                    c.execute('UPDATE sop_templates SET config_json=? WHERE store_id=? AND id=?',(json.dumps(tpl,ensure_ascii=False),store['id'],tpl['id']))
                    c.execute("UPDATE sop_tasks SET snapshot_json=json_set(snapshot_json,'$.name',?) WHERE store_id=? AND template_id=?",(tpl['name'],store['id'],tpl['id']))
                if tpl['id']=='SOP-003':
                    prior=c.execute('SELECT config_json FROM sop_templates WHERE store_id=? AND id=?',(store['id'],tpl['id'])).fetchone()
                    old=json.loads(prior['config_json'])
                    if old.get('name')=='每小时卫生巡检' and old.get('frequency')=='每小时一次': c.execute('UPDATE sop_templates SET config_json=? WHERE store_id=? AND id=?',(json.dumps(tpl,ensure_ascii=False),store['id'],tpl['id']))

def validate_template(tpl):
    tpl = dict(tpl)
    if not str(tpl.get('name','')).strip() or len(tpl.get('items',[])) > 100: raise ValueError('模板名称必填，检查项最多100项')
    if tpl.get('type') not in {'morning','closing','hourly','weekly','custom'}: raise ValueError('不支持的模板类型')
    schedule = str(tpl.get('scheduledTime',''))
    if tpl['type'] != 'hourly' and not re.search(r'\b(?:[01]\d|2[0-3]):[0-5]\d\b',schedule): raise ValueError('计划时间需包含 HH:MM')
    if len({str(i.get('id')) for i in tpl.get('items',[])}) != len(tpl.get('items',[])): raise ValueError('检查项编号不能重复')
    if tpl.get('frequency') in {'每班一次','自定义'}: raise ValueError('尚无排班配置，请选每日、每小时或每周频次')
    if tpl.get('frequency')=='每日两次' and len(re.findall(r'\b(?:[01]\d|2[0-3]):[0-5]\d\b',schedule))!=2: raise ValueError('每日两次需填写两个 HH:MM 时间')
    for item in tpl.get('items',[]):
        if not str(item.get('text','')).strip(): raise ValueError('检查项内容不能为空')
        item['aiVerifiable'] = bool(item.get('aiVerifiable') and item.get('aiType') in CAPABILITIES)
    tpl['totalItems']=len(tpl.get('items',[]))
    return tpl

def generate(db, now=None):
    for store in db.fetch_all('SELECT * FROM stores'):
        local = (now or datetime.now(ZoneInfo(store['timezone']))).astimezone(ZoneInfo(store['timezone']))
        for row in db.fetch_all('SELECT * FROM sop_templates WHERE store_id=? AND enabled=1',(store['id'],)):
            tpl=json.loads(row['config_json'])
            if tpl.get('frequency','').startswith('每周') and local.weekday()!=0: continue
            clocks=re.findall(r'\b(?:[01]\d|2[0-3]):[0-5]\d\b',tpl.get('scheduledTime',''))
            starts=hourly_clocks(db,store['id'],tpl) if tpl.get('frequency')=='每小时一次' else clocks if tpl.get('frequency')=='每日两次' else clocks[:1]
            db.execute("UPDATE sop_tasks SET cancelled=1 WHERE store_id=? AND template_id=? AND substr(scheduled_at,1,10)=? AND substr(scheduled_at,12,5) NOT IN ("+','.join('?' for _ in starts)+") AND NOT EXISTS (SELECT 1 FROM sop_records WHERE task_id=sop_tasks.id)",(store['id'],tpl['id'],local.date().isoformat(),*starts))
            for clock in starts:
                h,m=map(int,clock.split(':')); start=local.replace(hour=h,minute=m,second=0,microsecond=0)
                minutes=re.search(r'\d+',str(tpl.get('duration','10')))
                due=start+timedelta(minutes=int(minutes[0]) if minutes else 10)
                if len(clocks)>1 and tpl['type']!='hourly' and tpl.get('frequency')!='每日两次':
                    h,m=map(int,clocks[1].split(':'));due=start.replace(hour=h,minute=m)
                    if due<=start: due+=timedelta(days=1)
                with db.connect() as c:
                    c.execute('INSERT OR IGNORE INTO sop_tasks (id,store_id,template_id,scheduled_at,due_at,snapshot_json) VALUES (?,?,?,?,?,?)',('SOP-TASK-'+uuid.uuid4().hex[:12].upper(),store['id'],tpl['id'],start.isoformat(),due.isoformat(),json.dumps(tpl,ensure_ascii=False)))
                    existing=c.execute('SELECT id,snapshot_json FROM sop_tasks WHERE store_id=? AND template_id=? AND scheduled_at=?',(store['id'],tpl['id'],start.isoformat())).fetchone()
                    if existing and json.loads(existing['snapshot_json']).get('frequency')!=tpl.get('frequency') and not c.execute('SELECT 1 FROM sop_records WHERE task_id=?',(existing['id'],)).fetchone():
                        c.execute('UPDATE sop_tasks SET snapshot_json=?,due_at=?,cancelled=0 WHERE id=?',(json.dumps(tpl,ensure_ascii=False),due.isoformat(),existing['id']))

def state(db,store_id,date=None):
    generate(db)
    sync_runs(db)
    store=db.fetch_one('SELECT * FROM stores WHERE id=?',(store_id,))
    if not store: raise ValueError('门店不存在')
    today=date or datetime.now(ZoneInfo(store['timezone'])).date().isoformat()
    templates=[dict(json.loads(r['config_json']),enabled=bool(r['enabled'])) for r in db.fetch_all('SELECT * FROM sop_templates WHERE store_id=? ORDER BY id',(store_id,))]
    tasks=[];records=[];images={}
    for row in db.fetch_all('SELECT * FROM sop_tasks WHERE store_id=? AND cancelled=0 AND substr(scheduled_at,1,10)=? ORDER BY scheduled_at',(store_id,today)):
        tpl=json.loads(row['snapshot_json']);saved={r['item_id']:r for r in db.fetch_all('SELECT * FROM sop_records WHERE task_id=?',(row['id'],))}
        if tpl.get('frequency')=='每小时一次' and row['scheduled_at'][11:16] not in hourly_clocks(db,store_id,tpl) and not saved: continue
        count=0;fail=0;ai=0
        for item in tpl['items']:
            r=saved.get(str(item['id'])); terminal=r and r['result'] in {'pass','fail'}
            count+=bool(terminal);fail+=bool(r and r['result']=='fail');ai+=bool(r and r['run_id'])
            frames=db.fetch_all('SELECT id,captured_offset FROM frame_findings WHERE run_id=? ORDER BY captured_offset LIMIT 3',(r['run_id'],)) if r and r['run_id'] else []
            for f in frames: images[f['id']]=f"/api/media/findings/{f['id']}"
            records.append(dict(item,evidenceFrames=frames,evidenceImage=frames[0]['id'] if frames else None,taskId=row['id'],result=r['result'] if r else 'pending',checkedBy='AI 视频核验' if r and r['run_id'] else '人工核查' if r else '等待证据',checkedAt=datetime.fromisoformat(r['verified_at']).astimezone(ZoneInfo(store['timezone'])).strftime('%H:%M') if r else None,aiVerified=bool(r and r['run_id']),issueNote=('拖地检查通过' if r['result']=='pass' and item.get('aiType')=='floor_mopping' else '检查通过' if r['result']=='pass' else '不通过' if r['result']=='fail' else '需人工二次核验') if r and r['run_id'] else r['note'] if r else '',runId=r['run_id'] if r else None,eventId=r['event_id'] if r else None))
        status='completed' if count==len(tpl['items']) and count else 'in_progress' if saved else 'pending'
        tasks.append(dict(id=row['id'],storeId=store_id,name=tpl['name']+(' · 上午' if row['scheduled_at'][11:16]<'12:00' else ' · 下午') if tpl.get('frequency')=='每日两次' else tpl['name'],issuesFound=fail,templateId=tpl['id'],scheduledTime=row['scheduled_at'][11:16],scheduledAt=row['scheduled_at'],dueAt=row['due_at'],overdue=datetime.now(ZoneInfo(store['timezone'])).isoformat()>row['due_at'] and status!='completed',status=status,startTime=datetime.fromisoformat(min(r['verified_at'] for r in saved.values())).astimezone(ZoneInfo(store['timezone'])).strftime('%H:%M') if saved else None,completedTime=datetime.fromisoformat(max(r['verified_at'] for r in saved.values())).astimezone(ZoneInfo(store['timezone'])).strftime('%H:%M') if status=='completed' else None,completedItems=count,totalItems=len(tpl['items']),aiChecked=ai,result='issue' if fail else 'pass' if status=='completed' else None,assignee=tpl.get('responsibleRole'),snapshot=tpl))
    completed=[t for t in tasks if t['status']=='completed'];checked=[r for r in records if r['result'] in {'pass','fail'}]
    return dict(operating=db.fetch_one("SELECT * FROM sop_store_settings WHERE store_id=?",(store_id,)),stores=db.fetch_all('SELECT id,name FROM stores'),store=store,templates=templates,tasks=tasks,records=records,cameraImages=images,videos=db.fetch_all("SELECT id,original_name FROM video_assets WHERE store_id=? ORDER BY created_at DESC",(store_id,)),capabilities=CAPABILITIES,stats=dict(todayTotal=len(tasks),completed=len(completed),inProgress=sum(t['status']=='in_progress' for t in tasks),pending=sum(t['status']=='pending' for t in tasks),issuesFound=sum(r['result']=='fail' for r in records),passRate=round(100*sum(t['result']=='pass' for t in completed)/len(completed)) if completed else 0,aiAutomation=round(100*sum(bool(r.get('runId')) for r in checked)/len(checked)) if checked else 0,avgCompletionTime='尚无统计'))

def verify_record(db,task_id,item_id,payload):
    task=db.fetch_one('SELECT * FROM sop_tasks WHERE id=?',(task_id,))
    if not task: raise ValueError('任务不存在')
    item=next((i for i in json.loads(task['snapshot_json'])['items'] if str(i['id'])==str(item_id)),None)
    if not item: raise ValueError('检查项不存在')
    run_id=payload.get('run_id');event_id=None;result=payload.get('result');note=str(payload.get('note','')).strip()
    if run_id:
        rule=CAPABILITIES.get(item.get('aiType')) if item.get('aiVerifiable') else None
        run=db.fetch_one('SELECT r.*,v.store_id FROM analysis_runs r JOIN video_assets v ON v.id=r.video_id WHERE r.id=?',(run_id,))
        if not run or run['store_id']!=task['store_id'] or run['rule_code']!=rule or run['status']!='completed': raise ValueError('需关联同门店、同规则且已完成的真实分析任务')
        captured=datetime.fromisoformat(payload.get('captured_at',''))
        if captured.tzinfo is None: raise ValueError('视频拍摄时间必须包含时区')
        if not datetime.fromisoformat(task['scheduled_at'])<=captured<=datetime.fromisoformat(task['due_at']): raise ValueError('视频拍摄时间不在任务时段内')
        ev=db.fetch_one('SELECT id FROM inspection_events WHERE run_id=? AND status NOT IN (\'false_positive\',\'ignored\') LIMIT 1',(run_id,))
        if rule=='M1':
            snapshot=json.loads(run.get('rule_config_snapshot_json') or '{}')
            if captured.astimezone(ZoneInfo(db.fetch_one('SELECT timezone FROM stores WHERE id=?',(task['store_id'],))['timezone'])).strftime('%H:%M')!=snapshot.get('cleaning_video_start') or task['scheduled_at'][11:16]!='09:10': raise ValueError('拖地结果拍摄时间与分析时段不一致')
            check=db.fetch_one('SELECT * FROM cleaning_checks WHERE run_id=?',(run_id,))
            result='pass' if check and check['verdict']=='observed_mopping' else 'review'
            note=check['explanation'] if check else '缺少清洁核验结果'
        else:
            result='review';note='该视频仅覆盖部分时段，不能证明全程合规；请人工核查'
        if ev: result='review';event_id=ev['id'];note='发现疑似不合规线索，保留人工复核；不直接认定违规'
    elif result not in {'pass','fail','review'} or len(note)<3: raise ValueError('人工核查需明确结果和至少3字说明')
    with db.connect() as c:
        c.execute('INSERT INTO sop_audit VALUES (?,?,?,?)',(uuid.uuid4().hex,task_id,json.dumps(dict(item_id=str(item_id),result=result,note=note,run_id=run_id),ensure_ascii=False),datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()))
        c.execute('INSERT INTO sop_records VALUES (?,?,?,?,?,?,?) ON CONFLICT(task_id,item_id) DO UPDATE SET result=excluded.result,note=excluded.note,run_id=excluded.run_id,event_id=excluded.event_id,verified_at=excluded.verified_at',(task_id,str(item_id),result,note,run_id,event_id,datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()))
    return {'result':result,'note':note,'event_id':event_id}


def sync_runs(db):
    for link in db.fetch_all("SELECT l.* FROM sop_run_links l JOIN analysis_runs r ON r.id=l.run_id WHERE l.processed=0 AND r.status='completed'"):
        try:
            verify_record(db,link['task_id'],link['item_id'],dict(run_id=link['run_id'],captured_at=link['captured_at']))
            db.execute('UPDATE sop_run_links SET processed=1 WHERE task_id=? AND item_id=? AND run_id=?',(link['task_id'],link['item_id'],link['run_id']))
        except ValueError:
            pass


def hourly_clocks(db,store_id,tpl):
    configured=re.findall(r'\b(?:[01]\d|2[0-3]):[0-5]\d\b',tpl.get('scheduledTime',''))
    if len(configured)<2:
        configs=[json.loads(r['config_json']) for r in db.fetch_all('SELECT config_json FROM sop_templates WHERE store_id=? AND enabled=1',(store_id,))]
        opened=next((re.findall(r'\b(?:[01]\d|2[0-3]):[0-5]\d\b',t['scheduledTime'])[0] for t in configs if t['type']=='morning'),'09:10')
        closed=next((re.findall(r'\b(?:[01]\d|2[0-3]):[0-5]\d\b',t['scheduledTime'])[0] for t in configs if t['type']=='closing'),'22:30')
        configured=[opened,closed]
    lower=int(configured[0][:2])+(int(configured[0][3:])>0);upper=int(configured[1][:2])
    return [f'{h:02d}:00' for h in range(lower,upper+1)]
