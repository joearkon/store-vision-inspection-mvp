import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { Icon } from "./icons";
import { statusLabel } from "./utils";
import { filterWorkorders, openStatuses, storeHealth, workorderCounts } from "./workorder";

function Section({ title, aside, children, className = "" }) {
  return <section className={`surface portfolio-section ${className}`}><div className="section-header"><h2>{title}</h2>{aside}</div>{children}</section>;
}

function CountCard({ label, value, sub, tone = "blue", icon = "dashboard" }) {
  return <div className={`portfolio-count ${tone}`}><div><span>{label}</span><strong>{value}</strong><small>{sub}</small></div><span className="portfolio-count-icon"><Icon name={icon} size={20} /></span></div>;
}

function usePortfolioData(bootstrap) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const reload = async () => {
    try {
      setError("");
      const [overview, events] = await Promise.all([api.dashboard(), api.events()]);
      setData({ overview, events });
    } catch (failure) { setError(failure.message); }
  };
  useEffect(() => { reload(); }, []);
  return { data, error, reload, bootstrap };
}

export function StoreOverviewPage({ bootstrap, navigate }) {
  const { data, error, reload } = usePortfolioData(bootstrap);
  if (error) return <div className="surface portfolio-empty" role="alert">门店数据读取失败：{error}<button className="button secondary" onClick={reload}>重试</button></div>;
  if (!data || !bootstrap) return <div className="surface portfolio-empty">正在读取门店总览…</div>;
  const { events, overview } = data;
  const { metrics } = overview;
  const store = bootstrap.store;
  const cameras = bootstrap.cameras || [];
  const categoryCounts = Object.entries(events.reduce((acc, event) => {
    acc[event.rule_code] = (acc[event.rule_code] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);
  const pending = events.filter((event) => openStatuses.has(event.status));
  const overdue = pending.filter((event) => event.overdue).length;
  const health = storeHealth(events);
  return <div className="portfolio-page">
    <div className="portfolio-intro"><div><h2>门店总览</h2><p>当前仅初始化 {store?.name || "1 家门店"}；事件来自分析任务，视频源为演示配置。</p></div><button className="button secondary" onClick={reload}>刷新数据</button></div>
    <div className="portfolio-stats">
      <CountCard label="门店总数" value="1" sub="已初始化门店" icon="store" />
      <CountCard label="今日异常总数" value={metrics.today_events} sub="今日生成且未判误报" tone="danger" icon="alert" />
      <CountCard label="待处理事件" value={metrics.pending_events} sub={`${overdue} 个已超时`} icon="clock" />
      <CountCard label="可用视频源" value={`${metrics.online_cameras}/${metrics.total_cameras}`} sub="虚拟来源，非实时连接" tone="green" icon="camera" />
      <CountCard label="SLA 达标率" value="—" sub="口径未定，暂不计算" tone="purple" icon="check" />
    </div>
    <div className="portfolio-columns"><div className="portfolio-left">
      <Section title="门店健康度" aside={<span className="small-tag">共 1 家</span>}>
        <button className="store-health-card" onClick={() => navigate("dashboard")}><div className="store-health-icon"><Icon name="store" size={28} /></div><div><strong>{store?.name || "当前门店"}</strong><small>{cameras.length} 个视频源 · {pending.length} 条待处理事件</small><span className={health === "严重" ? "health-critical" : health === "告警" ? "health-warning" : "health-good"}>{health}</span></div><Icon name="arrow" size={16} /></button>
        <p className="portfolio-disclaimer">健康状态仅按未处理/超时事件提示，不是正式评分；多门店与健康分算法尚未接入。</p>
      </Section>
      <Section title="异常类型分布" aside={<span className="small-tag">最近 {events.length} 条</span>}>
        <div className="category-bars">{categoryCounts.length ? categoryCounts.map(([code, count]) => <div key={code}><div><strong>{code}</strong><span>{count} 条</span></div><i><b style={{ width: `${Math.round(count / events.length * 100)}%` }} /></i></div>) : <div className="portfolio-no-records">暂无真实分析事件</div>}</div>
      </Section>
    </div><Section title="最新告警" aside={<button className="link-button" onClick={() => navigate("rectification")}>查看全部 →</button>} className="portfolio-alerts">
      {events.length ? events.slice(0, 8).map((event) => <button key={event.id} className="portfolio-alert-row" onClick={() => navigate("event", event.id)}><b className={`portfolio-severity ${event.severity?.toLowerCase()}`}>{event.severity}</b><span><strong>{event.rule_code} · {event.title}</strong><small>{event.camera_name} · {statusLabel(event.status)}</small></span><time>{new Date(event.created_at).toLocaleString("zh-CN", { hour12: false })}</time></button>) : <div className="portfolio-no-records">暂无告警</div>}
    </Section></div>
  </div>;
}

export function WorkOrderPage({ navigate, readOnly = false }) {
  const [events, setEvents] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [assignees, setAssignees] = useState([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const reload = async () => {
    try {
      setError("");
      const rows = await api.events();
      setEvents(rows);
      setSelectedId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id || null);
    } catch (failure) { setError(failure.message); }
  };
  useEffect(() => { reload(); }, []);
  useEffect(() => { if (selectedId) api.event(selectedId).then(setDetail).catch((failure) => setError(failure.message)); else setDetail(null); }, [selectedId]);
  const rows = events || [];
  const counts = workorderCounts(rows);
  const visible = useMemo(() => filterWorkorders(rows, filter), [rows, filter]);
  useEffect(() => { if (!visible.some((row) => row.id === selectedId)) setSelectedId(visible[0]?.id || null); }, [visible, selectedId]);
  const selected = visible.find((row) => row.id === selectedId) || visible[0];
  const detailForSelected = detail?.id === selected?.id ? detail : null;
  const openAssign = async () => {
    if (!selected) return;
    setError(""); setNote(""); setAssigneeId(selected.assignee_id || ""); setModal(true);
    try { setAssignees(await api.eventAssignees(selected.id)); }
    catch (failure) { setError(failure.message); }
  };
  const apply = async (action) => {
    if (!selected) return;
    setBusy(true); setError("");
    try {
      const updated = await api.eventAction(selected.id, action, action === "assign" ? note.trim() : "", action === "assign" ? assigneeId : undefined);
      setDetail(updated); setModal(false);
      await reload();
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  if (error && !events) return <div className="surface portfolio-empty" role="alert">工单数据读取失败：{error}<button className="button secondary" onClick={reload}>重试</button></div>;
  if (!events) return <div className="surface portfolio-empty">正在读取整改工单…</div>;
  return <div className="workorder-page">
    <div className="portfolio-intro"><div><h2>整改工单</h2><p>事件关联工单 · 人工指派 · 处理轨迹可追溯</p></div><button className="button secondary" onClick={reload}>刷新台账</button></div>
    <div className="workorder-stats"><CountCard label="待处理工单" value={counts.pending} sub="待确认 / 已确认" tone="danger" icon="clock" /><CountCard label="处理中" value={counts.in_progress} sub="已开始整改" icon="rectification" /><CountCard label="已超时" value={counts.overdue} sub="未完成且超出 SLA" tone="danger" icon="alert" /><CountCard label="已完成" value={counts.resolved} sub="人工提交处理结果" tone="green" icon="check" /></div>
    <div className="workorder-tabs">{[["all","全部工单"],["pending","待处理"],["in_progress","处理中"],["overdue","已超时"],["resolved","已完成"]].map(([key, label]) => <button type="button" className={filter === key ? "active" : ""} key={key} onClick={() => setFilter(key)}>{label} <b>{counts[key]}</b></button>)}</div>
    {error && <div className="detail-action-error" role="alert">{error}</div>}
    <div className="workorder-columns"><section className="workorder-list">{visible.length ? visible.map((event) => <button key={event.id} className={`workorder-item ${selected?.id === event.id ? "active" : ""}`} onClick={() => setSelectedId(event.id)}><div><strong>{event.id}</strong><b className={`portfolio-severity ${event.severity?.toLowerCase()}`}>{event.severity}</b></div><h3>{event.rule_code} · {event.title}</h3><p>{event.camera_name} · {new Date(event.created_at).toLocaleString("zh-CN", { hour12: false })}</p><div><span>{event.assignee_name || "尚未指派"}</span><span className={event.overdue ? "overdue-text" : ""}>{event.overdue ? "已超时" : statusLabel(event.status)}</span></div></button>) : <div className="surface portfolio-no-records">当前筛选下没有工单</div>}</section>
      <section className="surface workorder-detail">{selected ? <><div className="workorder-detail-head"><div><h2>{selected.rule_code} {selected.title} <b className={`portfolio-severity ${selected.severity?.toLowerCase()}`}>{selected.severity}</b></h2><small>{selected.id} · {selected.camera_name}</small></div><span className="small-tag">{selected.overdue ? "已超时" : statusLabel(selected.status)}</span></div><div className="workorder-description">{detailForSelected?.description || `${selected.title}；点击查看事件证据与分析依据。`}</div><dl className="workorder-fields"><div><dt>负责人</dt><dd>{selected.assignee_name || "尚未指派"}</dd></div><div><dt>指派方式</dt><dd>{selected.assignee_id ? "人工指派" : "待人工指派"}</dd></div><div><dt>关联事件</dt><dd><button className="link-button" onClick={() => navigate("event", selected.id)}>{selected.id} →</button></dd></div><div><dt>创建时间</dt><dd>{new Date(selected.created_at).toLocaleString("zh-CN", { hour12: false })}</dd></div><div><dt>SLA 截止</dt><dd>{selected.due_at ? new Date(selected.due_at).toLocaleString("zh-CN", { hour12: false }) : "未设置"}</dd></div></dl><div className="workorder-activity"><h3>工单动态 <small>{detailForSelected?.timeline?.length || 0} 条记录</small></h3>{detailForSelected?.timeline?.map((entry) => <div key={entry.id}><time>{new Date(entry.created_at).toLocaleString("zh-CN", { hour12: false })}</time><span>{entry.note}</span></div>) || <p>正在读取处理记录…</p>}</div><div className="workorder-actions">{!readOnly && openStatuses.has(selected.status) && <button className="button secondary" onClick={openAssign}>{selected.assignee_id ? "更换负责人" : "指派整改"}</button>}{!readOnly && selected.status === "acknowledged" && <button className="button primary" disabled={busy || !selected.assignee_id} onClick={() => apply("start_rectification")}>开始整改</button>}<button className="button secondary" onClick={() => navigate("event", selected.id)}>查看证据与处理 →</button></div></> : <div className="portfolio-no-records">请选择一条工单</div>}</section></div>
    <div className="workorder-policy-note">自动派单与 SLA 逐级升级仍处于设计阶段，本页只展示真实事件和人工操作，不执行自动升级或电话通知。</div>
    {!readOnly && modal && <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setModal(false); }}><div className="action-dialog" role="dialog" aria-modal="true" aria-labelledby="workorder-dialog-title"><div className="dialog-title"><h2 id="workorder-dialog-title">指派整改</h2><button type="button" onClick={() => setModal(false)} aria-label="关闭弹窗">×</button></div><div className="dialog-body"><label>指派给<select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">请选择负责人</option>{assignees.map((user) => <option value={user.id} key={user.id}>{user.display_name} · {user.role}</option>)}</select></label><label>整改要求 / 备注<textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="填写整改要求和处理说明" /></label></div><div className="dialog-footer"><button className="button secondary" onClick={() => setModal(false)} disabled={busy}>取消</button><button className="button primary" onClick={() => apply("assign")} disabled={busy || !assigneeId || !note.trim()}>确认指派</button></div></div></div>}
  </div>;
}
