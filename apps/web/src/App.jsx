import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { Icon } from "./icons";
import { formatDuration, percent, statusLabel } from "./utils";

const navItems = [
  ["dashboard", "监控大盘", "dashboard"],
  ["upload", "视频上传", "upload"],
  ["runs", "分析任务", "video"],
  ["cameras", "摄像头管理", "camera"],
  ["rectification", "整改跟踪", "rectification"],
  ["rules", "规则配置", "rules"]
];

function useRoute() {
  const parse = () => {
    const hash = window.location.hash.replace(/^#\/?/, "");
    const [rawPage, id] = hash.split("/");
    return { page: rawPage || "dashboard", id };
  };
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const update = () => setRoute(parse());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const navigate = (page, id) => {
    window.location.hash = id ? `#/${page}/${id}` : `#/${page}`;
  };
  return { ...route, navigate };
}

function App() {
  const route = useRoute();
  const [bootstrap, setBootstrap] = useState(null);
  useEffect(() => {
    api.bootstrap().then(setBootstrap).catch(() => null);
  }, []);

  return (
    <div className="app-shell">
      <Sidebar route={route} store={bootstrap?.store} />
      <div className="main-shell">
        <TopHeader route={route} store={bootstrap?.store} />
        <main className="page-shell" key={`${route.page}-${route.id || ""}`}>
          {route.page === "dashboard" && <Dashboard navigate={route.navigate} />}
          {route.page === "upload" && <UploadPage bootstrap={bootstrap} navigate={route.navigate} />}
          {route.page === "runs" && <RunsPage navigate={route.navigate} />}
          {route.page === "event" && <EventDetail id={route.id} navigate={route.navigate} />}
          {route.page === "cameras" && <CamerasPage bootstrap={bootstrap} />}
          {route.page === "rectification" && <RectificationPage navigate={route.navigate} />}
          {route.page === "rules" && <RulesPage />}
        </main>
      </div>
    </div>
  );
}

function Sidebar({ route, store }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">AI</div>
        <div><strong>视觉巡检系统</strong><span>Store Visual Inspection</span></div>
      </div>
      <button className="store-switch"><i /> <span>{store?.name || "MOMOYO JTU"}</span><Icon name="arrow" size={14} /></button>
      <nav>
        {navItems.map(([key, label, icon]) => (
          <button
            key={key}
            className={route.page === key || (route.page === "event" && key === "rectification") ? "active" : ""}
            onClick={() => route.navigate(key)}
          >
            <Icon name={icon} /><span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-user">
        <div className="avatar">巡</div>
        <div><strong>总部巡检管理员</strong><span>系统管理员</span></div>
      </div>
    </aside>
  );
}

function TopHeader({ route, store }) {
  const titles = {
    dashboard: ["门店视觉巡检 · 监控大盘", "实时查看门店监控画面与异常告警"],
    upload: ["视频上传分析", "上传门店视频并运行真实 AI 巡检"],
    runs: ["分析任务", "查看抽帧、视觉分析与事件聚合进度"],
    event: ["事件详情", "查看异常证据、状态与整改记录"],
    cameras: ["摄像头管理", "管理门店视频来源与监控区域"],
    rectification: ["整改跟踪", "统一跟踪待确认与整改事件"],
    rules: ["规则配置", "查看首期正式规则与确认策略"]
  };
  const title = titles[route.page] || titles.dashboard;
  return (
    <header className="top-header">
      <div><h1>{title[0]}</h1><p>{title[1]}</p></div>
      <div className="header-actions">
        <button className="icon-button"><Icon name="bell" /><span className="notice-dot" /></button>
        <div className="ai-status"><span /> AI 实时检测中</div>
        <button className="current-store"><i />{store?.name || "MOMOYO JTU"}<Icon name="arrow" size={13} /></button>
      </div>
    </header>
  );
}

function LoadingCard({ text = "正在加载数据…" }) {
  return <div className="surface centered-state"><span className="spinner" />{text}</div>;
}

function ErrorCard({ message, retry }) {
  return <div className="surface centered-state error-state"><Icon name="alert" /><strong>暂时无法加载</strong><span>{message}</span>{retry && <button className="button secondary" onClick={retry}>重新加载</button>}</div>;
}

function Dashboard({ navigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = () => {
    setError("");
    api.dashboard().then(setData).catch((err) => setError(err.message));
  };
  useEffect(load, []);
  if (error) return <ErrorCard message={error} retry={load} />;
  if (!data) return <LoadingCard text="正在读取监控大盘…" />;
  const { metrics, recent_events: events } = data;
  return (
    <div className="dashboard-grid">
      <section className="metrics-grid full-span">
        <Metric label="今日异常总数" value={metrics.today_events} suffix="条" tone="danger" icon="alert" detail="真实分析任务聚合" />
        <Metric label="待处理事件" value={metrics.pending_events} suffix="件" tone="blue" icon="clock" detail="等待确认或整改" />
        <Metric label="在线摄像头" value={`${metrics.online_cameras}/${metrics.total_cameras}`} tone="green" icon="camera" detail="1 台演示视频源" />
        <Metric label="已完成分析" value={metrics.completed_runs} suffix="次" tone="purple" icon="check" detail="可追溯任务" />
      </section>
      <section className="surface monitor-section">
        <div className="section-header"><div><h2>监控大屏</h2><span className="small-tag">演示模式</span></div><div><button className="button secondary" onClick={() => navigate("upload")}><Icon name="upload" />上传视频</button><button className="button secondary" onClick={() => navigate("cameras")}><Icon name="camera" />摄像头管理</button></div></div>
        <div className="camera-grid">
          {[
            ["前台-01", "前台操作区", true], ["后厨-01", "后厨操作区", true],
            ["仓储-01", "仓储区", true], ["取餐-01", "取餐区", false]
          ].map(([name, area, online], index) => <CameraTile key={name} name={name} area={area} online={online} index={index} />)}
        </div>
      </section>
      <section className="surface event-panel">
        <div className="section-header"><h2>最近事件</h2><button className="link-button" onClick={() => navigate("rectification")}>查看全部 →</button></div>
        <div className="event-list">
          {events.length === 0 ? <EmptyEvents navigate={navigate} /> : events.map((event) => <EventRow event={event} key={event.id} onClick={() => navigate("event", event.id)} />)}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, suffix, tone, icon, detail }) {
  return <div className={`metric-card ${tone}`}><div><span>{label}</span><strong>{value}<small>{suffix}</small></strong><p>{detail}</p></div><div className="metric-icon"><Icon name={icon} /></div></div>;
}

function CameraTile({ name, area, online, index }) {
  return <div className={`camera-tile camera-${index} ${online ? "" : "offline"}`}>
    <div className="camera-overlay"><div><i className={online ? "online" : "offline-dot"} /><strong>{name}</strong><span>· {area}</span></div>{online && <b>REC</b>}</div>
    <div className="camera-visual"><Icon name={online ? "store" : "camera"} size={46} /><span>{online ? "等待接入视频画面" : "摄像头离线"}</span></div>
    <time>{new Date().toLocaleString("zh-CN", { hour12: false })}</time>
  </div>;
}

function EmptyEvents({ navigate }) {
  return <div className="empty-events"><div className="empty-icon"><Icon name="check" /></div><strong>暂无异常事件</strong><span>上传测试视频后，聚合事件会显示在这里</span><button className="button primary" onClick={() => navigate("upload")}>开始视频分析</button></div>;
}

function EventRow({ event, onClick }) {
  return <button className={`event-row severity-${event.severity.toLowerCase()}`} onClick={onClick}>
    <div className="event-thumb"><Icon name="video" /></div>
    <div className="event-main"><div><SeverityBadge value={event.severity} /><strong>{event.title}</strong></div><p>{event.camera_name} · 持续 {formatDuration(event.confirmed_offset - event.first_seen_offset)}</p><span>{event.id}</span></div>
    <div className="event-meta"><Confidence value={event.max_confidence} /><span>{statusLabel(event.status)}</span></div>
  </button>;
}

function SeverityBadge({ value }) { return <span className={`severity-badge ${value.toLowerCase()}`}>{value} · {value === "P0" ? "严重" : value === "P1" ? "一般" : "提示"}</span>; }
function Confidence({ value }) { return <span className="confidence"><Icon name="alert" size={13} />{percent(value)} 置信度</span>; }

function UploadPage({ bootstrap, navigate }) {
  const [file, setFile] = useState(null);
  const [cameraId, setCameraId] = useState("CAM-STORAGE-01");
  const [notifications, setNotifications] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [run, setRun] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!run || ["completed", "failed"].includes(run.status)) return;
    const timer = setInterval(() => api.run(run.id).then(setRun).catch(() => {}), 1500);
    return () => clearInterval(timer);
  }, [run?.id, run?.status]);

  const start = async () => {
    if (!file) return setError("请先选择 MP4 视频");
    setBusy(true); setError(""); setUploadProgress(0);
    try {
      const video = await api.uploadVideo({ file, cameraId, onProgress: setUploadProgress });
      const created = await api.createRun(video.id, notifications);
      setRun(created);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const stages = ["queued", "probing", "extracting", "analyzing", "aggregating", "completed"];
  const currentIndex = run ? stages.indexOf(run.stage) : -1;
  return <div className="upload-layout">
    <section className="surface upload-card">
      <div className="page-section-title"><div><h2>上传巡检视频</h2><p>视频会通过 FFmpeg 抽帧，并由豆包 Vision 进行真实分析</p></div><span className="prototype-chip">真实管线</span></div>
      <label className={`drop-zone ${file ? "has-file" : ""}`}>
        <input type="file" accept="video/mp4,.mp4" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        <div className="drop-icon"><Icon name={file ? "check" : "upload"} size={28} /></div>
        <strong>{file ? file.name : "点击选择或拖入 MP4 视频"}</strong>
        <span>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "第一阶段支持 MP4，最大 500 MB"}</span>
      </label>
      <div className="form-block"><label>关联视频区域</label><div className="camera-options">
        {(bootstrap?.cameras || []).map((camera) => <button className={cameraId === camera.id ? "selected" : ""} onClick={() => setCameraId(camera.id)} key={camera.id}><Icon name="camera" /><div><strong>{camera.name}</strong><span>{camera.area_type}</span></div><i /></button>)}
      </div></div>
      <label className="switch-row"><div><strong>分析完成后发送飞书告警</strong><span>演示视频默认关闭，避免循环告警</span></div><input type="checkbox" checked={notifications} onChange={(e) => setNotifications(e.target.checked)} /><i /></label>
      {error && <div className="inline-error"><Icon name="alert" />{error}</div>}
      {!run && <button className="button primary large" disabled={busy || !file} onClick={start}>{busy ? `正在上传 ${Math.round(uploadProgress * 100)}%` : <><Icon name="play" />开始 AI 分析</>}</button>}
    </section>
    <aside className="surface analysis-card">
      <div className="page-section-title"><div><h2>分析进度</h2><p>{run ? run.id : "提交后显示真实任务状态"}</p></div>{run && <StatusBadge value={run.status} />}</div>
      <div className="analysis-progress"><div className="progress-ring" style={{ "--progress": `${Math.round((run?.progress || 0) * 360)}deg` }}><strong>{Math.round((run?.progress || 0) * 100)}%</strong></div><div><strong>{run ? statusLabel(run.status) : "等待任务"}</strong><span>{run?.error_message || "上传视频后，Worker 将开始处理"}</span></div></div>
      <div className="steps">
        {["任务排队", "读取视频", "FFmpeg 抽帧", "豆包视觉分析", "多帧事件聚合", "分析完成"].map((label, index) => <div className={index < currentIndex ? "done" : index === currentIndex ? "active" : ""} key={label}><i>{index < currentIndex ? <Icon name="check" size={13} /> : index + 1}</i><span>{label}</span></div>)}
      </div>
      {run?.status === "completed" && <button className="button primary" onClick={() => navigate("dashboard")}>查看分析结果</button>}
      {run?.status === "failed" && <button className="button secondary" onClick={() => setRun(null)}>重新提交</button>}
    </aside>
  </div>;
}

function StatusBadge({ value }) { return <span className={`status-badge status-${value}`}>{statusLabel(value)}</span>; }

function RunsPage({ navigate }) {
  const [runs, setRuns] = useState(null);
  const [error, setError] = useState("");
  const load = () => api.runs().then(setRuns).catch((err) => setError(err.message));
  useEffect(() => { load(); const timer = setInterval(load, 3000); return () => clearInterval(timer); }, []);
  if (error) return <ErrorCard message={error} retry={load} />;
  if (!runs) return <LoadingCard />;
  return <section className="surface list-page"><div className="page-section-title"><div><h2>视频分析任务</h2><p>任务状态持久化，服务重启后可继续追踪</p></div><button className="button primary" onClick={() => navigate("upload")}><Icon name="upload" />上传视频</button></div>
    <div className="table-head run-grid"><span>任务 / 视频</span><span>关联摄像头</span><span>处理进度</span><span>状态</span><span>创建时间</span></div>
    {runs.length === 0 ? <div className="table-empty">暂无分析任务</div> : runs.map((run) => <div className="table-row run-grid" key={run.id}><div><strong>{run.id}</strong><span>{run.original_name}</span></div><span>{run.camera_id}</span><div className="mini-progress"><i style={{ width: `${run.progress * 100}%` }} /><span>{Math.round(run.progress * 100)}%</span></div><StatusBadge value={run.status} /><time>{new Date(run.created_at).toLocaleString("zh-CN", { hour12: false })}</time></div>)}
  </section>;
}

function EventDetail({ id, navigate }) {
  const [event, setEvent] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const load = () => api.event(id).then(setEvent).catch((err) => setError(err.message));
  useEffect(load, [id]);
  if (error) return <ErrorCard message={error} retry={load} />;
  if (!event) return <LoadingCard text="正在加载事件证据…" />;
  const act = async (action) => { setSaving(true); try { setEvent(await api.eventAction(id, action)); } catch (err) { setError(err.message); } finally { setSaving(false); } };
  const evidenceByType = Object.fromEntries(event.evidence.map((item) => [item.evidence_type, item]));
  const selected = evidenceByType.confirmed || event.evidence[0];
  return <div className="detail-page">
    <button className="back-button" onClick={() => navigate("dashboard")}><Icon name="arrow" />返回监控大盘</button>
    <section className="surface detail-header"><div><div className="badge-line"><SeverityBadge value={event.severity} /><StatusBadge value={event.status} /></div><h2>{event.title}</h2><p>{event.store_name} · {event.camera_name} · {event.id}</p></div><div className="detail-actions">{event.status === "pending_confirmation" && <><button className="button secondary" disabled={saving} onClick={() => act("mark_false_positive")}>标记误报</button><button className="button primary" disabled={saving} onClick={() => act("acknowledge")}><Icon name="check" />确认事件</button></>}{event.status === "acknowledged" && <button className="button primary" onClick={() => act("start_rectification")}>开始整改</button>}{event.status === "rectifying" && <button className="button primary" onClick={() => act("resolve")}>确认已解决</button>}</div></section>
    <div className="detail-columns">
      <section className="surface evidence-card"><div className="section-header"><h2>事件证据</h2><span>{selected ? `视频第 ${formatDuration(selected.captured_offset)}` : "暂无证据"}</span></div>{selected ? <div className="evidence-image"><img src={`/api/media/evidence/${selected.id}`} alt="事件确认帧" /><div><span>AI 确认帧</span><time>{formatDuration(selected.captured_offset)}</time></div></div> : <div className="table-empty">暂无证据图</div>}<div className="evidence-strip">{event.evidence.map((item) => <div key={item.id}><img src={`/api/media/evidence/${item.id}`} alt={item.evidence_type} /><span>{({start:"首次发现",confirmed:"确认异常",peak:"最高置信度",recovered:"恢复正常"})[item.evidence_type] || item.evidence_type}</span></div>)}</div></section>
      <aside className="surface event-summary"><div className="section-header"><h2>AI 研判结果</h2><Confidence value={event.max_confidence} /></div><dl><div><dt>规则编码</dt><dd>E1 冰箱门持续开启</dd></div><div><dt>首次发现</dt><dd>{formatDuration(event.first_seen_offset)}</dd></div><div><dt>确认异常</dt><dd>{formatDuration(event.confirmed_offset)}</dd></div><div><dt>持续时间</dt><dd>{formatDuration(event.confirmed_offset - event.first_seen_offset)}</dd></div><div><dt>恢复时间</dt><dd>{event.recovered_offset == null ? "尚未观察到恢复" : formatDuration(event.recovered_offset)}</dd></div></dl><div className="rule-note"><strong>判定策略</strong><p>冷藏设备门连续处于开启状态达到30秒，由后端时序规则确认；严重度与SLA不由模型自由生成。</p></div></aside>
    </div>
    <section className="surface timeline-card"><div className="section-header"><h2>事件时间线</h2><span>{event.timeline.length} 条记录</span></div><div className="timeline">{event.timeline.map((item) => <div key={item.id}><i /><time>{new Date(item.created_at).toLocaleString("zh-CN", { hour12: false })}</time><div><strong>{item.note}</strong><span>{item.from_status ? `${statusLabel(item.from_status)} → ${statusLabel(item.to_status)}` : "系统记录"}</span></div></div>)}</div></section>
  </div>;
}

function CamerasPage({ bootstrap }) {
  return <section className="surface list-page"><div className="page-section-title"><div><h2>摄像头与视频源</h2><p>第一阶段为虚拟视频源，RTSP 接入将在后续阶段开放</p></div><span className="prototype-chip">{bootstrap?.cameras?.length || 0} 个来源</span></div><div className="camera-management-grid">{(bootstrap?.cameras || []).map((camera) => <article key={camera.id}><div className="camera-card-preview"><Icon name="camera" size={36} /><span>虚拟视频源</span></div><div><div><i /><StatusBadge value="completed" /></div><h3>{camera.name}</h3><p>{camera.code} · {camera.area_type}</p><span>{camera.source_type === "virtual" ? "上传/预置视频" : camera.source_type}</span></div></article>)}</div></section>;
}

function RectificationPage({ navigate }) {
  const [events, setEvents] = useState(null);
  useEffect(() => { api.events().then(setEvents).catch(() => setEvents([])); }, []);
  if (!events) return <LoadingCard />;
  return <section className="surface list-page"><div className="page-section-title"><div><h2>整改事件</h2><p>待确认、整改中和已解决使用同一事件状态机</p></div></div><div className="filter-tabs"><button className="active">全部 <b>{events.length}</b></button><button>待确认 <b>{events.filter((e) => e.status === "pending_confirmation").length}</b></button><button>整改中 <b>{events.filter((e) => e.status === "rectifying").length}</b></button><button>已解决 <b>{events.filter((e) => e.status === "resolved").length}</b></button></div>{events.length === 0 ? <div className="table-empty">暂无整改事件</div> : <div className="rectification-list">{events.map((event) => <EventRow key={event.id} event={event} onClick={() => navigate("event", event.id)} />)}</div>}</section>;
}

const rules = [
  ["E1", "冰箱门持续开启", "多帧时序", "持续30秒", "P1", true],
  ["A2", "未戴工作帽/发网", "ROI + 多帧", "最近5帧命中3帧", "P1", false],
  ["C1", "未穿围裙/工服", "ROI + 多帧", "最近5帧命中3帧", "P1", false],
  ["A3", "操作台明显脏乱", "环境 + 多帧", "持续60秒", "P1", false],
  ["A4", "地面积水/明显垃圾", "环境 + 多帧", "最近5帧命中3帧", "P1/P2", false],
  ["B1", "明显烟雾/异常明火", "高危快速检测", "首帧预警、后续确认", "P0", false]
];

function RulesPage() {
  return <section className="surface list-page"><div className="page-section-title"><div><h2>首期正式规则</h2><p>规则严重度、确认策略和通知方式由后端配置，不由模型自由生成</p></div><span className="prototype-chip">6 条正式规则</span></div><div className="table-head rule-grid"><span>规则</span><span>能力类型</span><span>确认策略</span><span>严重度</span><span>实现状态</span></div>{rules.map(([code,name,type,strategy,severity,ready]) => <div className="table-row rule-grid" key={code}><div><strong>{code} · {name}</strong><span>正式验收规则</span></div><span>{type}</span><span>{strategy}</span><SeverityBadge value={severity.split("/")[0]} /><span className={ready ? "ready" : "planned"}>{ready ? "第一阶段" : "后续实现"}</span></div>)}</section>;
}

export default App;
