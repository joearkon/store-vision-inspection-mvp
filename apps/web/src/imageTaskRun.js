import {runOutcome} from './runResult';
export function imageTaskRun(t,configs=[]){const usage=t.usage||[];return {...t,media_type:'image',original_created_at:t.created_at,created_at:t.created_at||t.completed_at||t.started_at,original_name:t.sample_name||'门店图片',rule_code:configs.find(c=>c.id===t.rule.source_config_id)?.code||'图片规则',status:t.status==='analyzing'?'running':t.status==='pending'?'queued':t.status,progress:t.status==='completed'?1:Object.keys(t.results||{}).length/Math.max(1,t.rule.items.length),request_count:usage.length,prompt_tokens:usage.reduce((sum,u)=>sum+(u.prompt_tokens||0),0),completion_tokens:usage.reduce((sum,u)=>sum+(u.completion_tokens||0),0)};}
export function taskOutcome(t){if(t.media_type!=='image')return runOutcome(t);const labels={pass:'通过',fail:'不通过',review:'人工核查',need_photo:'待补充照片'};return {label:labels[t.conclusion]||'等待核验',tone:t.conclusion==='fail'?'orange':t.conclusion==='pass'?'green':'muted'};}

export function mergeAnalysisTasks(videos,images,configs=[],type="all"){return [...videos.map(v=>({...v,media_type:"video"})),...images.map(t=>imageTaskRun(t,configs))].filter(t=>type==="all"||t.media_type===type).sort((a,b)=>(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0));}

export function analysisRuleOptions(runs){return ["all",...new Set(["M1","G2","C1","B1","A4","A3","A2","A1","E1",...runs.map(r=>r.rule_code).filter(Boolean)])];}
export function analysisTypeCounts(runs){return {all:runs.length,video:runs.filter(r=>r.media_type==="video").length,image:runs.filter(r=>r.media_type==="image").length};}
