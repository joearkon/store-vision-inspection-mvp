import React, {useEffect,useState} from 'react';
import {api} from './api';
import {isShowcaseMode} from './showcaseApi';
import {SopContext} from './SopContext';
import {SOPPage} from './SOPPage';
import {SOPTemplatePage} from './SOPTemplatePage';
import {SOPTaskPage} from './SOPTaskPage';

export function SopWorkspace({page,id,navigate}) {
 const [manualRequest,setManualRequest]=useState(0);
 const [storeId,setStoreId]=useState('STORE-JTU'),[data,setData]=useState(null),[error,setError]=useState('');
 const refresh=async()=>{const value=await api.sop(storeId);setData(value);return value;};
 useEffect(()=>{setData(null);setError('');refresh().catch(e=>setError(e.message));},[storeId]);
 if(error) return <section className="surface empty-state" role="alert">{error}<button className="button secondary" onClick={()=>refresh().then(()=>setError('')).catch(e=>setError(e.message))}>重试</button></section>;
 if(!data) return <section className="surface empty-state">正在读取 SOP 配置与任务…</section>;
 const onNavigate=(key,params={})=>navigate(key,params.taskId||params.templateId||params.eventId);
 const selectedTask=data.tasks.find(t=>t.id===id);
 // Historical tasks retain their own configuration even after the template changes.
 const taskData=selectedTask ? {...data,templates:data.templates.filter(t=>t.id!==selectedTask.templateId).concat(selectedTask.snapshot)} : data;
 return <SopContext.Provider value={{data:taskData,requestManual:()=>setManualRequest(n=>n+1),refresh,saveTemplate:tpl=>api.saveSop(storeId,tpl.id,tpl),removeTemplate:tplId=>api.disableSop(storeId,tplId)}}>
  <div className="sop-store-selector"><label>门店 <select value={storeId} onChange={e=>setStoreId(e.target.value)}>{data.stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><span>{data.operating&&`营业时间 ${data.operating.opening_time}–${String((Number(data.operating.opening_time.slice(0,2))+data.operating.operating_hours)%24).padStart(2,"0")}:${data.operating.opening_time.slice(3)} · ${data.operating.operating_hours} 小时`}</span><button className="button secondary" onClick={()=>refresh().catch(e=>setError(e.message))}>刷新任务</button></div>
  {page==='sop'&&<SOPPage onNavigate={onNavigate} storeId={storeId}/>}
  {page==='sopTemplates'&&(isShowcaseMode?<div className="sop-readonly"><SOPTemplatePage onNavigate={onNavigate} templateId={id}/></div>:<SOPTemplatePage onNavigate={onNavigate} templateId={id}/>)}
  {page==='sopTask'&&<><SOPTaskPage taskId={id} onNavigate={onNavigate}/>{selectedTask&&!isShowcaseMode&&<RecordForm task={selectedTask} manualRequest={manualRequest} videos={data.videos||[]} records={data.records.filter(r=>r.taskId===id)} refresh={refresh}/>}</>}
 </SopContext.Provider>;
}
function RecordForm({task,records,refresh,videos,manualRequest}) {
 const [itemId,setItemId]=useState(String(records[0]?.id||'')),[mode,setMode]=useState('video'),[runId,setRunId]=useState(''),[videoId,setVideoId]=useState(videos[0]?.id||''),[captured,setCaptured]=useState(''),[note,setNote]=useState(''),[result,setResult]=useState('review'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(manualRequest)setMode("manual");},[manualRequest]);
 const save=async e=>{e.preventDefault();setBusy(true);setMessage('');try{if(mode==='analyze'){const run=await api.analyzeSop(task.id,itemId,{video_id:videoId,captured_at:captured?`${captured}:00${task.scheduledAt.slice(-6)}`:''});setMessage(`已创建真实分析任务 ${run.id}；完成后刷新本页查看核验结果`);await refresh();return;}await api.sopRecord(task.id,itemId,mode==='video'?{run_id:runId,captured_at:captured?`${captured}:00${task.scheduledAt.slice(-6)}`:''}:{result,note});await refresh();setMessage('核查记录已保存');}catch(err){setMessage(err.message);}finally{setBusy(false);}};
 return <section className="surface sop-record-form"><div className="section-header"><h2>提交核查证据</h2></div><form onSubmit={save}><label>检查项<select value={itemId} onChange={e=>setItemId(e.target.value)}>{records.map(r=><option value={r.id} key={r.id}>{r.text}</option>)}</select></label><label>核查方式<select value={mode} onChange={e=>setMode(e.target.value)}><option value="analyze">按 SOP 创建视频分析任务</option><option value="video">关联真实分析任务</option><option value="manual">人工核查</option></select></label>{['video','analyze'].includes(mode)?<><label>{mode==='analyze'?'选择已上传视频':'分析任务 ID'}{mode==='analyze'?<select value={videoId} onChange={e=>setVideoId(e.target.value)}>{videos.map(v=><option value={v.id} key={v.id}>{v.original_name}</option>)}</select>:<input required value={runId} onChange={e=>setRunId(e.target.value)} placeholder="RUN-…"/>}</label><label>视频拍摄时间（门店当地时间）<input required type="datetime-local" value={captured} onChange={e=>setCaptured(e.target.value)}/></label></>:<><label>结果<select value={result} onChange={e=>setResult(e.target.value)}><option value="review">待复核</option><option value="pass">通过</option><option value="fail">未通过</option></select></label><label>核查说明<textarea required minLength={3} value={note} onChange={e=>setNote(e.target.value)}/></label></>}<button className="button primary" disabled={busy}>保存核查记录</button>{message&&<p role="status">{message}</p>}</form></section>;
}
