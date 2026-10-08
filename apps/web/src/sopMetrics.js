export function sopMetrics(tasks, records = []) {
 const ids=new Set(tasks.map(t=>t.id));
 const scoped=records.filter(r=>ids.has(r.taskId));
 const checked=scoped.filter(r=>["pass","fail"].includes(r.result));
 const completed=tasks.filter(t=>t.status==="completed").length;
 const totalItems=tasks.reduce((sum,t)=>sum+(t.totalItems || 0),0);
 const ai=checked.filter(r=>r.aiVerified || r.runId).length;
 return {completed,totalItems,checked:checked.length,unverified:Math.max(0,totalItems-checked.length),review:scoped.filter(r=>r.result==="review").length,issues:checked.filter(r=>r.result==="fail").length,completionRate:tasks.length?Math.round(100*completed/tasks.length):null,aiShare:checked.length?Math.round(100*ai/checked.length):null,ai};
}
