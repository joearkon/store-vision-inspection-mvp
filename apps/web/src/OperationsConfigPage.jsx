import React, { useEffect, useState } from "react";
import { api } from "./api";
import { ScenePreview } from "./AutoUploadPage";
import { TableLayoutPanel, readTableLayout } from "./TableLayoutPanel";

export function camerasForStore(cameras, storeId) {
  return (cameras || []).filter(c=>c.store_id===storeId);
}
export function OperationsConfigPage({ initialCameraId }) {
  const [data,setData]=useState(null), [error,setError]=useState("");
  const [storeId,setStoreId]=useState(""), [cameraId,setCameraId]=useState("");
  const load=()=>{setError("");api.operationsConfig().then(value=>{
    setData(value);
    const initial=value.cameras.find(c=>c.id===initialCameraId);
    const store=initial?.store_id || value.stores[0]?.id || "";
    const choices=camerasForStore(value.cameras,store);
    setStoreId(store);setCameraId(initial?.id || choices.find(readTableLayout)?.id || choices[0]?.id || "");
  }).catch(e=>setError(e.message));};
  useEffect(()=>{load();},[initialCameraId]);
  if(error) return <section className="surface operations-page-state" role="alert"><h2>运营配置加载失败</h2><p>{error}</p><button className="button secondary" onClick={load}>重试</button></section>;
  if(!data) return <section className="surface operations-page-state" role="status">正在加载门店运营配置…</section>;
  const cameras=camerasForStore(data.cameras,storeId);
  const camera=cameras.find(c=>c.id===cameraId);
  const candidates=(data.scene_candidates || []).filter(c=>c.store_id===storeId && c.camera_id===cameraId).map(c=>({...c,result:JSON.parse(c.result_json)}));
  return <div className="operations-page">
    <section className="surface operations-scope-card">
      <div className="camera-detail-card-head"><div><h2>门店运营配置</h2><p>每家门店保留自己的餐桌布局，桌位编号属于选定门店和机位。</p></div><span className="small-tag">只读 · 已有配置</span></div>
      <div className="operations-scope-body"><div className="operations-selectors">
        <label>门店<select aria-label="配置门店" value={storeId} onChange={e=>{const id=e.target.value;setStoreId(id);const cs=camerasForStore(data.cameras,id);setCameraId(cs.find(readTableLayout)?.id || cs[0]?.id || "");}}>{data.stores.map(s=><option key={s.id} value={s.id}>{s.name} · {s.id}</option>)}</select></label>
        <label>机位<select aria-label="配置机位" value={cameraId} onChange={e=>setCameraId(e.target.value)}>{cameras.map(c=><option key={c.id} value={c.id}>{c.name}{readTableLayout(c)?" · 已配置":" · 未配置"}</option>)}</select></label>
      </div>
      <p>门店已启用规则：{(data.rule_settings || []).filter(r=>r.store_id===storeId && r.enabled).map(r=>r.rule_code).join("、") || "暂无"}</p>
      <p>当前门店 {storeId || "未选择"} · 机位 {cameraId || "暂无机位"}。配置来自已保存记录。</p></div>
    </section>
    {camera && readTableLayout(camera) ? <TableLayoutPanel key={camera.id} camera={camera} /> : <section className="surface empty-state"><h2>暂无餐桌位置配置</h2><p>{camera ? "该机位尚未标定桌位。" : "该门店暂无机位。"}后续需基于本门店画面单独标定。</p></section>}
    {candidates.map(c=><details className="surface scene-candidate-card" key={c.video_id}><summary><strong>视频识别候选 · {c.original_name}</strong><span className="small-tag">{c.result.confirmed ? "区域类型已确认" : "模型候选"} · 点击查看</span></summary><div className="scene-result"><ScenePreview result={c.result}/><p>区域与坐标已保存到本次视频记录，尚未替换门店固定机位标定。</p><p>{c.result.regions.map((r,i)=>`${i+1} · ${r.name}`).join("；")}</p>{c.result.roi?.table_layout?.method==="model_scene_candidates" && <p>餐桌候选编号：{c.result.roi.table_layout.tables.map(t=>t.id+" "+t.name).join("；")}。当前规则分析仅使用首张候选桌位。</p>}</div></details>)}
  </div>;
}
