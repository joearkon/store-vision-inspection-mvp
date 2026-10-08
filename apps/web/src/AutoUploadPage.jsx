import React, {useEffect,useRef,useState} from "react";
import {api,apiUrl} from "./api";
import {Icon} from "./icons";
import {ruleCatalog} from "./ruleCatalog";
import {RunActions} from "./RunActions";
import {runOutcome} from "./runResult";
import {runCostText} from "./runCost";
export function uploadRuleScope(codes, severity, selected = []) {
 codes = selected.length ? selected : codes;
 return severity === "all" ? codes : codes.filter(code => ruleCatalog.find(rule => rule.code === code)?.severity === severity);
}
const labels={table:"餐桌",counter:"前台",operation:"制作操作区",floor:"地面",fridge:"冷藏柜"};
function ScenePicture({result}) {
 return <div className="scene-preview"><img src={apiUrl(result.preview_url)} alt="视频首帧及自动识别关键区域"/><svg viewBox="0 0 1000 562.5" preserveAspectRatio="none" aria-label="自动识别区域框">{result.regions.map((r,i)=><g key={i}><rect x={r.bbox[0]*1000} y={r.bbox[1]*562.5} width={(r.bbox[2]-r.bbox[0])*1000} height={(r.bbox[3]-r.bbox[1])*562.5} fill="none" stroke={r.confidence>=.85?"#4f46e5":"#ea580c"} strokeWidth="3"/><text x={r.bbox[0]*1000+4} y={r.bbox[1]*562.5+18} fill="white" stroke="#0f172a" paintOrder="stroke" strokeWidth="3" fontSize="16">{i+1} · {labels[r.kind]}</text></g>)}</svg></div>;
}
export function ScenePreview({result}) {
 const [expanded,setExpanded]=useState(false);
 return <><div className="scene-preview-wrap"><ScenePicture result={result}/><button type="button" className="scene-preview-expand" onClick={()=>setExpanded(true)}>查看大图</button></div>{expanded && <div className="scene-preview-backdrop" role="dialog" aria-modal="true" aria-label="关键区域大图" onClick={()=>setExpanded(false)}><div className="scene-preview-dialog" onClick={e=>e.stopPropagation()}><div><strong>关键区域识别截图</strong><button className="button secondary" onClick={()=>setExpanded(false)}>关闭</button></div><ScenePicture result={result}/></div></div>}</>;
}
export function AutoUploadPage({bootstrap,navigate,initialCameraId}) {
 const [file,setFile]=useState(null),[cameraId,setCameraId]=useState(initialCameraId || "");
 const [video,setVideo]=useState(null),[scene,setScene]=useState(null),[runs,setRuns]=useState([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[progress,setProgress]=useState(0),[kinds,setKinds]=useState([]);
 const [analysisMode,setAnalysisMode]=useState("two_stage"),[notifications,setNotifications]=useState(true);
 const [profiles,setProfiles]=useState([]);
 const [severityScope,setSeverityScope]=useState("all");
 const [selectedRules,setSelectedRules]=useState([]);
 useEffect(()=>{api.rulesConfig().then(c=>{setProfiles(c.profiles);setAnalysisMode(c.default_analysis_mode);}).catch(()=>{});},[]);
 const dispatched=useRef(false);
 const restored=useRef(false);
 const cacheKey=`scene-upload:${bootstrap?.store?.id || "STORE-JTU"}`;
 useEffect(()=>{
  if(!bootstrap || restored.current)return;
  restored.current=true;
  try{
   const cached=JSON.parse(sessionStorage.getItem(cacheKey) || "null");
   if(cached?.id){
    setSeverityScope(cached.severityScope || "all");setSelectedRules(cached.selectedRules || []);
    Promise.all([cached.direct?Promise.resolve({status:"completed",direct:true}):api.scene(cached.id),api.runs()]).then(([job,allRuns])=>{
     const existing=allRuns.filter(r=>r.video_id===cached.id);
     dispatched.current=existing.length>0;
     setRuns(existing);setVideo(cached);setScene(job);
     if(job.result)setKinds(job.result.regions.map(r=>r.kind));
    }).catch(e=>setError(`恢复分析记录失败：${e.message}`));
   }
  }catch{sessionStorage.removeItem(cacheKey);}
 },[bootstrap]);
 const submitRuns=async(result,id)=>{
  dispatched.current=true;setBusy(true);setError("");
  try {
   const next=[];
   const scopedRules = uploadRuleScope(result.rules, severityScope, selectedRules);
   if (!scopedRules.length) { setError("识别到的区域未匹配所选等级规则，可上传另一段视频或调整检查范围。"); return; }
   for(const code of scopedRules){
    const run=await api.createRun(id,notifications,code==="M1"?"two_stage":analysisMode,code,{scene_request:true,explicit_rule:selectedRules.length>0,...(code==="M1"?{cleaning_video_start:result.video_start_clock || null,cleaning_window_complete:false,cleaning_window_closed:false}:{})});
    next.push(run);setRuns([...next]);
   }
  } catch(e){setError(e.message);} finally{setBusy(false);}
 };
 useEffect(()=>{
  if(!video || !scene || ["completed","failed"].includes(scene.status))return;
  let active=true;
  const timer=setInterval(()=>api.scene(video.id).then(job=>{if(active){setScene(job);if(job.result)setKinds(job.result.regions.map(r=>r.kind));}}).catch(e=>{if(active)setError(e.message);}),1500);
  return ()=>{active=false;clearInterval(timer);};
 },[video?.id,scene?.status]);
 useEffect(()=>{
  if(scene?.status==="completed" && scene.result && !scene.result.needs_confirmation && scene.result.rules.length && !dispatched.current)submitRuns(scene.result,video.id);
 },[scene]);
 useEffect(()=>{
  if(!runs.length || runs.every(r=>["completed","failed","awaiting_approval","cancelled"].includes(r.status)))return;
  let active=true;const timer=setInterval(()=>Promise.all(runs.map(r=>api.run(r.id))).then(next=>{if(active)setRuns(next);}).catch(e=>{if(active)setError(`任务状态更新失败：${e.message}`);}),2500);
  return ()=>{active=false;clearInterval(timer);};
 },[runs.map(r=>r.id+":"+r.status).join(",")]);
 const upload=async()=>{
  if(!file)return;
  setBusy(true);setError("");dispatched.current=false;setRuns([]);setScene(null);
  try{const direct=selectedRules.length>0 && !selectedRules.some(code=>["G1","G2"].includes(code));
   const asset=await api.uploadVideo({file,cameraId,storeId:bootstrap.store.id,detectScene:!direct,explicitRules:selectedRules.length>0,onProgress:setProgress});setVideo(asset);sessionStorage.setItem(cacheKey,JSON.stringify({id:asset.id,original_name:asset.original_name,severityScope,selectedRules,direct}));
   if(direct){setScene({status:"completed",direct:true});await submitRuns({rules:selectedRules},asset.id);}else setScene({status:"queued"});}
  catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const confirm=async()=>{
  setBusy(true);setError("");
  try{setScene(await api.confirmScene(video.id,kinds));}catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const reset=()=>{sessionStorage.removeItem(cacheKey);setFile(null);setVideo(null);setScene(null);setRuns([]);setError("");dispatched.current=false;};
 return <div className="auto-upload-grid">
  <section className="surface upload-card">
   <div className="page-section-title"><div><h2>上传巡检视频</h2><p>自动识别关键区域 → 匹配门店规则 → 分析问题</p></div><span className="small-tag">AI 识别</span></div>
   <label className={`drop-zone ${file?"has-file":""}`}><input type="file" accept="video/mp4,.mp4" disabled={!!video || busy} onChange={e=>setFile(e.target.files?.[0] || null)}/><div className="drop-icon"><Icon name={file || video?"check":"upload"} size={28}/></div><strong>{file?.name || video?.original_name || "点击选择或拖入 MP4 视频"}</strong><span>先识别少量关键帧，区域不确定时再确认；最大500 MB。</span></label>
   <div className="automatic-rule-note"><strong>门店：{bootstrap?.store?.name || "正在读取"}</strong><span>关键区域从视频画面识别，无需先选前台、餐区或仓储，也无需填写坐标。</span></div>
   <details className="form-block upload-options"><summary>摄像头位置（可选）<span>{cameraId ? bootstrap?.cameras?.find(c=>c.id===cameraId)?.name : "自动识别"}</span></summary><p>仅关联视频实际来源，用于读取门店已有桌位配置；画面关键区域仍由 AI 识别。</p><div className="upload-camera-grid" role="group" aria-label="来源机位"><button type="button" className={`upload-camera-option ${!cameraId?"selected":""}`} aria-pressed={!cameraId} disabled={!!video || busy} onClick={()=>setCameraId("")}><span className="upload-camera-thumb"><Icon name="camera"/></span><span><strong>未知 / 新机位</strong><small>从视频画面自动识别</small></span></button>{(bootstrap?.cameras || []).filter(c=>c.area_type!=="unknown").map(c=><button type="button" key={c.id} className={`upload-camera-option ${cameraId===c.id?"selected":""}`} aria-pressed={cameraId===c.id} disabled={!!video || busy || c.status!=="online"} onClick={()=>setCameraId(c.id)}><span className="upload-camera-thumb">{c.preview_image_url?<img src={apiUrl(c.preview_image_url)} alt=""/>:<Icon name="camera"/>}</span><span><strong>{c.name}</strong><small>{{front_counter:"前台操作区",back_kitchen:"后厨操作区",dining_area:"客人用餐区",pickup_area:"取餐区",storage:"仓储区"}[c.area_type] || "已关联机位"}</small></span><i className={c.status==="online"?"online":"offline"} aria-label={c.status==="online"?"可用":"已停用"}/></button>)}</div></details>
   <details className="form-block upload-options"><summary>严重程度（可选）<span>{severityScope==="all"?"全部等级":severityScope}</span></summary><p>等级由门店规则定义。选择范围只限制本次分析，不改变事件等级。</p><div className="upload-severity-options" role="group" aria-label="检查等级">{[["all","全部等级"],["P0","P0 · 严重"],["P1","P1 · 一般"],["P2","P2 · 提示"]].map(([value,label])=><button type="button" key={value} aria-pressed={severityScope===value} className={severityScope===value?"selected":""} disabled={!!video || busy} onClick={()=>{setSeverityScope(value);setSelectedRules(rows=>uploadRuleScope(rows,value));}}>{label}</button>)}</div></details>
   <details className="form-block upload-options"><summary>检测规则（可选）<span>{selectedRules.length?`已选 ${selectedRules.length} 项`:"自动匹配"}</span></summary><p>已知问题可直接选择规则，仅分析选中的项目；未选择时按画面自动匹配。</p><div className="upload-severity-options upload-rule-options" role="group" aria-label="检测规则"><button type="button" disabled={!!video || busy} className={!selectedRules.length?"selected":""} onClick={()=>setSelectedRules([])}>自动匹配</button>{ruleCatalog.filter(r=>r.stage!=="research" && (severityScope==="all" || r.severity===severityScope)).map(r=><button type="button" key={r.code} disabled={!!video || busy} aria-pressed={selectedRules.includes(r.code)} className={selectedRules.includes(r.code)?"selected":""} onClick={()=>setSelectedRules(rows=>rows.includes(r.code)?rows.filter(c=>c!==r.code):[...rows,r.code])}><span className="upload-rule-code">{r.code}</span><span>{r.name}</span></button>)}</div></details>
   <div className="form-block"><label>本次分析模式</label><div className="mode-options">{profiles.map(profile=><button type="button" key={profile.id} disabled={!!video || busy} className={analysisMode===profile.id?"selected":""} onClick={()=>setAnalysisMode(profile.id)}><div><strong>{profile.name}</strong><span>{profile.id==="two_stage"?"低帧率粗筛 · 关键帧复核":"全量1 fps · 高消耗基线"}</span></div><i/></button>)}</div></div>
   <label className="switch-row"><div><strong>分析完成后发送飞书告警</strong><span>所有规则产生的事件均发送，疑似线索在消息中标明待核查。</span></div><input type="checkbox" disabled={!!video || busy} checked={notifications} onChange={e=>setNotifications(e.target.checked)}/><i/></label>
   <p className="demo-media-note">由 AI 分析视频关键帧；分析规则来自门店启用配置。飞书通知默认开启，按规则通知策略发送，可手动关闭。</p>
   {error && <div className="inline-error" role="alert">{error}</div>}
   {!video && <button className="button primary large" disabled={!file || busy || !bootstrap} onClick={upload}>{busy?`正在上传 ${Math.round(progress*100)}%`:"上传并自动分析"}</button>}
   {scene && !["completed","failed"].includes(scene.status) && <p role="status">{scene.status==="queued"?"识别任务排队中":"正在识别画面中的关键区域…"}</p>}
   {scene?.status==="failed" && <div className="scene-failure" role="alert"><p>区域识别失败：{scene.error_message}</p><button className="button secondary" onClick={async()=>{try{setScene(await api.retryScene(video.id));setError("");}catch(e){setError(e.message);}}}>重试识别</button></div>}
   {video && <div className="scene-footer-actions"><button className="button secondary" disabled={busy} onClick={reset}>上传另一段视频</button></div>}
  </section>
  <section className="surface upload-card">
   <div className="page-section-title"><div><h2>分析进度</h2><p>区域识别与规则分析记录</p></div><span className="small-tag">{scene?.status==="completed"?"识别完成":"等待识别"}</span></div>
   {!scene?.result && !scene?.direct && <><div className="analysis-progress"><div className="progress-ring"><strong><Icon name="video" size={24}/></strong></div><div><strong>{scene?.status==="running"?"正在识别区域":scene?.status==="queued"?"任务排队中":scene?.status==="failed"?"识别失败":"等待上传"}</strong><span>识别画面中的关键区域，自动匹配本门店规则。</span></div></div><div className="steps">{["上传视频","读取视频与关键帧","识别关键区域","匹配门店规则","粗筛与关键帧复核","生成分析结果"].map((label,i)=><div key={label} className={video && i===0?"done":video && scene?.status!=="failed" && i===2?"active":""}><i>{video && i===0?<Icon name="check" size={13}/>:i+1}</i><span>{label}</span></div>)}</div><div className="scene-empty-note"><Icon name="camera" size={16}/><span>识别完成后展示区域框、置信度及匹配规则。</span></div></>}
   {scene?.result && <div className="scene-result-title"><Icon name="camera" size={16}/><strong>关键区域识别结果</strong></div>}
   {scene?.result && <div className="scene-result"><ScenePreview result={scene.result}/>
    <p>{scene.result.known_layout_used?"画面区域与已知机位布局匹配，已读取门店桌位配置。":"区域和餐桌候选来自本次画面识别，未套用其他机位配置。"}</p>
    {scene.result.regions.map((r,i)=><div className="scene-region-row" key={i}><strong>{i+1} · {r.name}</strong><span>{Math.round(r.confidence*100)}%</span>{scene.result.needs_confirmation && r.confidence<.85 && scene.result.image_quality==="usable"?<select aria-label={`确认区域${i+1}`} value={kinds[i] || r.kind} onChange={e=>setKinds(kinds.map((k,j)=>j===i?e.target.value:k))}><option value="ignore">忽略此候选</option>{Object.entries(labels).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select>:<span>{labels[r.kind]}</span>}<p>{r.evidence}</p></div>)}
    {scene.result.roi && <p>本次餐桌分析范围：{scene.result.roi.id} · {scene.result.roi.name}。其他桌位候选已保存，尚未接入逐桌轮巡。</p>}
    <p><strong>本次匹配规则：</strong>{uploadRuleScope(scene.result.rules,severityScope,selectedRules).map(c=>`${c} · ${ruleCatalog.find(r=>r.code===c)?.name || c}`).join("；") || "该门店未启用与已识别区域匹配的规则"}</p>
    {(scene.result.deferred_rules || []).map(r=><p key={r.rule}>{r.rule}：{r.reason}</p>)}
    <p>区域识别消耗：{((scene.result.usage?.prompt_tokens || 0)+(scene.result.usage?.completion_tokens || 0)).toLocaleString()} Token / {runCostText(scene.result.usage || {})}，实际以火山账单为准。</p>
    {scene.result.needs_confirmation && <div className="automatic-rule-note"><strong>需要确认</strong><span>{scene.result.image_quality!=="usable"?"画面证据不足，请上传清晰且机位稳定的视频。":"请核对框选区域类型。坐标由识别生成，确认后按门店启用规则分析。"}</span>{scene.result.image_quality==="usable" && scene.result.regions.length>0 && <button className="button primary" disabled={busy} onClick={confirm}>确认区域并分析</button>}</div>}

    {error && scene.result && !scene.result.needs_confirmation && <button className="button secondary" disabled={busy} onClick={()=>submitRuns(scene.result,video.id)}>重试启动分析</button>}
   </div>}
   {scene?.direct && <div className="automatic-rule-note"><strong>按指定规则分析</strong><span>已跳过场景规则匹配，仅分析所选规则。</span></div>}
    {runs.length>0 && <div className="upload-run-results"><h3>规则分析结果</h3>{runs.map(r=><div className="upload-run-result" key={r.id}><div className="upload-run-heading"><strong>{r.rule_code} · {ruleCatalog.find(rule=>rule.code===r.rule_code)?.name || "规则分析"}</strong><span className={`run-outcome ${runOutcome(r).tone}`}>{runOutcome(r).label}</span></div><p>{runOutcome(r).detail}</p>{!["completed","failed","awaiting_approval","cancelled"].includes(r.status) && <small>分析进度 {Math.round((r.progress || 0)*100)}%</small>}<RunActions run={r} onUpdate={next=>setRuns(rows=>rows.map(row=>row.id===next.id?next:row))}/><button className="button secondary" onClick={()=>navigate("run",r.id)}>查看任务与证据</button></div>)}</div>}
  </section>
 </div>;
}
