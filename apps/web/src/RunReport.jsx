import React from 'react';
import {apiUrl} from './api';
export const reportMoney=value=>Number.isFinite(value)?`约 ¥${value.toFixed(4)}`:'用量尚未完整记录';
const states={occupied:'有人在座 / 桌旁',departed_residual:'疑似遗留物品',clean:'桌面为空',cleaning:'正在清理',unknown:'无法确定',violation:'疑似不符合规范',compliant:'观察符合规范',mopping:'观察到拖地',not_mopping:'未观察到拖地',messy:'疑似脏乱',in_use:'正常使用中',smoke:'疑似烟雾',flame:'疑似明火',steam:'水蒸汽',normal:'未观察到异常'};
export function RunReport({run}) {
 const report=run.report;if(!report)return null;
 return <section className="surface run-observation-card"><div className="section-header"><h2>分析证据与说明</h2><span>{report.observed_frame_count} 帧观察</span></div><p className="run-report-explanation">{report.explanation}</p>
 {report.frames.length ? <div className="run-evidence-grid">{report.frames.map(frame=><a href={apiUrl(frame.image_url)} target="_blank" rel="noreferrer" key={frame.id} className="run-evidence-frame"><img src={apiUrl(frame.image_url)} alt={`${frame.captured_offset} 秒 · ${states[frame.visual_state] || frame.visual_state}`} /><div><strong>{frame.captured_offset} 秒 · {states[frame.visual_state] || frame.visual_state}</strong><span>模型观察 · {Math.round(frame.confidence*100)}%</span><p>{frame.evidence}</p></div></a>)}</div> : <div className="run-report-empty">{report.images_withheld ? '监控截图未在公开站点发布。' : '尚无逐帧观察截图。'}{!report.images_withheld && run.scene_detection_usage ? '以下仅为前置区域识别参考画面，不作为该规则的复核证据。' : (report.images_withheld ? '请在本地查看原始证据。' : '任务尚未产生可展示的画面证据。')}{!report.images_withheld && run.scene_detection_usage && <a href={apiUrl(run.scene_preview_url || `/api/videos/${run.video_id}/scene/image`)} target="_blank" rel="noreferrer"><img src={apiUrl(run.scene_preview_url || `/api/videos/${run.video_id}/scene/image`)} alt="区域识别参考画面" /></a>}</div>}</section>;
}
