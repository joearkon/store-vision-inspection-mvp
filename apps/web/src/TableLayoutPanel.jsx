import React, { useState } from "react";
import { apiUrl } from "./api";

export function readTableLayout(camera) {
  try { return JSON.parse(camera?.roi_json || "{}").table_layout || null; }
  catch { return null; }
}

export function TableLayoutPanel({ camera }) {
  const layout = readTableLayout(camera);
  const [imageFailed, setImageFailed] = useState(false);
  if (!layout) return null;
  const image = apiUrl(`/api/cameras/${encodeURIComponent(camera.id)}/table-layout/image`);
  return <section className="surface table-layout-panel">
    <div className="camera-detail-card-head"><div><h2>餐桌位置配置</h2><span className="small-tag">{layout.tables?.length || 0} 张已标定 · 当前分析 {layout.active_table_id}</span></div><span className="small-tag">已保存 · 人工视觉标定</span></div>
    <div className="table-layout-content"><div>{imageFailed ? <div className="camera-detail-empty" role="status">标定截图暂不可用，桌位配置仍已保存。</div> : <a href={image} target="_blank" rel="noreferrer" aria-label="放大餐桌标定截图"><img src={image} alt={`${camera.name}餐桌标定截图：${(layout.tables || []).map(t=>t.id).join("、")}`} onError={() => setImageFailed(true)} /></a>}<p>点击截图可放大。机位或桌椅布局变化后需要重新标定。</p></div>
    <div><div className="table-layout-head"><span>桌位</span><span>位置 / 配置范围</span><span>分析状态</span></div>{(layout.tables || []).map(table=><div className="table-layout-row" key={table.id}><strong>{table.id}</strong><div><b>{table.name}</b><small>已保存桌面四边形和初步座位范围</small></div><span className="small-tag">{table.id === layout.active_table_id ? "当前使用" : "已配置 · 未启用"}</span></div>)}<p>左边缘局部桌面待确认，未计入已标定桌位。当前仅 {layout.active_table_id} 用于离席分析，其他已配置桌位尚未接入逐桌轮巡。</p><p>座位范围仍需现场复核；桌面物品性质与是否需要清理交由人工核查。</p><details><summary>查看已保存位置参数</summary><pre>{JSON.stringify(layout.tables?.map(t=>({id:t.id,table_polygon:t.table_polygon,seat_bbox:t.seat_bbox})),null,2)}</pre></details></div></div>
  </section>;
}
