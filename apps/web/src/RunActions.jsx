import React, {useState} from "react";
import {api} from "./api";
import {isShowcaseMode} from "./showcaseApi";
export function RunActions({run,onUpdate}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const act=async(method)=>{setBusy(true);setError("");try{onUpdate(await api[method](run.id));}catch(e){setError(e.message);}finally{setBusy(false);}};
 if(isShowcaseMode || ["completed","failed","cancelled"].includes(run.status))return null;
 return <div className="run-action-block"><div className="scene-footer-actions">{run.status==="awaiting_approval" && <button className="button primary" disabled={busy} onClick={()=>act("approveFallback")}>继续逐帧复核</button>}<button className="button secondary" disabled={busy} onClick={()=>act("cancelRun")}>{busy?"正在处理…":"取消分析"}</button></div>{run.status==="awaiting_approval" && <p>继续复核会增加模型消耗；取消后保留已有记录。</p>}{error && <p className="inline-error" role="alert">{error}</p>}</div>;
}
