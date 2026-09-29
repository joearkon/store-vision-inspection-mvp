import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { Icon } from "./icons";
import { formatDuration, percent, statusLabel, timelinePercent } from "./utils";
import { filterRectificationEvents, rectificationCsv } from "./rectification";
import { StoreOverviewPage, WorkOrderPage } from "./OverviewWorkorders";
import { cameraAreaNames, dashboardCameraIds, demoCameraImages } from "./cameraMedia";
import { cameraPageState } from "./cameraPageState";
import { analysisElapsedSeconds, runOutcome, screeningCandidateCount } from "./runResult";

const navItems = [
  ["stores", "门店总览", "store"],
  ["dashboard", "监控大盘", "dashboard"],
  ["upload", "视频上传", "upload"],
  ["runs", "分析任务", "video"],
  ["cameras", "摄像头管理", "camera"],
  ["rectification", "整改跟踪", "rectification"],
  ["workorder", "整改工单", "rectification"],
  ["rules", "规则配置", "rules"]
];
const navGroups = [
  ["总览", ["stores", "dashboard"]],
  ["工具", ["upload", "runs", "cameras"]],
  ["运营", ["rectification", "workorder", "rules"]]
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
  const [bootstrapError, setBootstrapError] = useState("");
  const refreshBootstrap = () => {
    setBootstrapError("");
    return api.bootstrap().then(setBootstrap).catch((error) => {
      setBootstrapError(error.message === "Failed to fetch" ? "无法连接本地巡店服务，请确认 API 已启动。" : error.message);
      throw error;
    });
  };
  useEffect(() => {
    refreshBootstrap().catch(() => {});
  }, []);

  return (
    <div className="app-shell">
      <Sidebar route={route} store={bootstrap?.store} />
      <div className="main-shell">
        <TopHeader route={route} store={bootstrap?.store} serviceError={bootstrapError} />
        <main className="page-shell" key={`${route.page}-${route.id || ""}`}>
          {route.page === "dashboard" && <Dashboard navigate={route.navigate} />}
          {route.page === "cameraDetail" && <CameraDetail id={route.id} navigate={route.navigate} />}
          {route.page === "stores" && <StoreOverviewPage bootstrap={bootstrap} navigate={route.navigate} />}
          {route.page === "upload" && <UploadPage bootstrap={bootstrap} navigate={route.navigate} initialCameraId={route.id} />}
          {route.page === "runs" && <RunsPage navigate={route.navigate} />}
          {route.page === "run" && <RunDetail id={route.id} navigate={route.navigate} />}
          {route.page === "event" && <EventDetail id={route.id} navigate={route.navigate} />}
          {route.page === "cameras" && <CamerasPage bootstrap={bootstrap} loadError={bootstrapError} refresh={refreshBootstrap} />}
          {route.page === "rectification" && <RectificationPage navigate={route.navigate} />}
          {route.page === "workorder" && <WorkOrderPage navigate={route.navigate} />}
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
      <button className="store-switch" onClick={() => route.navigate("stores")}><i /> <span>{route.page === "stores" ? "全部门店" : store?.name || "MOMOYO JTU"}</span><Icon name="arrow" size={14} /></button>
      <nav>{navGroups.map(([group, keys]) => <div className="sidebar-nav-group" key={group}>
        <span className="sidebar-nav-label">{group}</span>
        {keys.map((key) => {
          const [, label, icon] = navItems.find((item) => item[0] === key);
          return <button key={key} className={route.page === key || (route.page === "cameraDetail" && key === "dashboard") || (route.page === "event" && key === "rectification") || (route.page === "run" && key === "runs") ? "active" : ""} onClick={() => route.navigate(key)}><Icon name={icon} /><span>{label}</span></button>;
        })}
      </div>)}</nav>
      <div className="sidebar-user">
        <div className="avatar">巡</div>
        <div><strong>总部巡检管理员</strong><span>系统管理员</span></div>
      </div>
    </aside>
  );
}

function TopHeader({ route, store, serviceError }) {
  const titles = {
    dashboard: ["门店视觉巡检 · 监控大盘", "查看演示视频源与实际分析事件"],
    cameraDetail: ["MOMOYO JTU · 摄像头详情", "演示静帧与该来源的真实分析记录"],
    stores: ["门店视觉巡检 · 门店总览", "查看已接入门店的巡检结果"],
    upload: ["视频上传分析", "上传门店视频并运行真实 AI 巡检"],
    runs: ["分析任务", "查看抽帧、视觉分析与事件聚合进度"],
    run: ["分析结果", "查看任务结论、耗时和模型消耗"],
    event: ["事件详情", "查看异常证据、状态与整改记录"],
    cameras: ["MOMOYO JTU · 摄像头管理", "管理门店所有监控摄像头"],
    rectification: ["整改跟踪", "统一跟踪待确认与整改事件"],
    workorder: ["整改工单", "人工指派、处理与留痕"],
    rules: ["规则配置", "查看首期正式规则与确认策略"]
  };
  const title = titles[route.page] || titles.dashboard;
  return (
    <header className="top-header">
      <div><h1>{title[0]}</h1><p>{title[1]}</p></div>
      <div className="header-actions">
        <button className="icon-button"><Icon name="bell" /><span className="notice-dot" /></button>
        <div className={`ai-status ${serviceError ? "disconnected" : ""}`}><span /> {serviceError ? "本地服务连接异常" : "AI 上传分析就绪"}</div>
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
  useEffect(() => { load(); }, []);
  if (error) return <ErrorCard message={error} retry={load} />;
  if (!data) return <LoadingCard text="正在读取监控大盘…" />;
  const { metrics, recent_events: events } = data;
  const cameraById = new Map((data.camera_sources || []).map((camera) => [camera.id, camera]));
  const shownCameras = dashboardCameraIds.map((id) => cameraById.get(id)).filter(Boolean);
  return (
    <div className="dashboard-grid">
      <section className="metrics-grid full-span">
        <Metric label="今日异常总数" value={metrics.today_events} suffix="条" tone="danger" icon="alert" detail="今日生成且未判误报" />
        <Metric label="待处理事件" value={metrics.pending_events} suffix="件" tone="blue" icon="clock" detail="等待确认或整改" />
        <Metric label="可用视频源" value={`${metrics.online_cameras}/${metrics.total_cameras}`} tone="green" icon="camera" detail="虚拟来源，非实时连接" />
        <Metric label="已完成分析" value={metrics.completed_runs} suffix="次" tone="purple" icon="check" detail="可追溯任务" />
      </section>
      <section className="surface monitor-section full-span">
        <div className="section-header"><div><h2>监控大屏</h2><span className="small-tag">演示静帧 · {shownCameras.filter((camera) => camera.status === "online").length}/{shownCameras.length} 路已启用</span></div><div><button className="button secondary" onClick={() => navigate("upload")}><Icon name="upload" />上传视频</button><button className="button secondary" onClick={() => navigate("cameras")}><Icon name="camera" />摄像头管理</button></div></div>
        <div className="camera-grid">
          {shownCameras.map((camera) => <CameraTile key={camera.id} camera={camera} onClick={() => navigate("cameraDetail", camera.id)} />)}
        </div>
        <p className="demo-media-note">画面为合成样本静态封面，不代表实时监控；仓储-01 已配置，可在摄像头管理中查看。</p>
      </section>
      <section className="surface event-panel full-span">
        <div className="section-header"><div><h2>异常事件流</h2><span className="small-tag">最近 {events.length} 条</span></div><button className="link-button" onClick={() => navigate("rectification")}>查看全部 →</button></div>
        <div className="event-list">
          {events.length === 0 ? <EmptyEvents navigate={navigate} /> : events.map((event) => <EventStreamCard event={event} key={event.id} onClick={() => navigate("event", event.id)} />)}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, suffix, tone, icon, detail }) {
  return <div className={`metric-card ${tone}`}><div><span>{label}</span><strong>{value}<small>{suffix}</small></strong><p>{detail}</p></div><div className="metric-icon"><Icon name={icon} /></div></div>;
}

function CameraTile({ camera, onClick }) {
  const available = camera.status === "online";
  return <button type="button" className={`camera-tile ${available ? "" : "offline"}`} onClick={onClick} aria-label={`查看${camera.name}详情`}>
    <img src={demoCameraImages[camera.area_type]} alt={`${camera.name}的合成演示静帧`} />
    <div className="camera-overlay"><div><i className={available ? "online" : "offline-dot"} /><strong>{camera.name}</strong><span>· {cameraAreaNames[camera.area_type] || camera.area_type}</span></div><b className="demo-tag">DEMO</b></div>
    {!available && <div className="camera-offline-label"><Icon name="camera" size={28} /><strong>视频源已停用</strong></div>}
    <span className="camera-frame-note">合成演示静帧 · 非直播</span>
    <span className="camera-tile-hover">点击查看详情 →</span>
  </button>;
}

function EventStreamCard({ event, onClick }) {
  return <button type="button" className="event-stream-card" onClick={onClick} aria-label={`查看事件${event.id}`}>
    <div className="event-stream-cover">{event.thumbnail_evidence_id ? <img src={api.evidenceUrl(event.thumbnail_evidence_id)} alt="事件证据帧" /> : <Icon name="video" size={32} />}<SeverityBadge value={event.severity} /><StatusBadge value={event.status} /></div>
    <div className="event-stream-info"><strong>{event.title}</strong><span><Icon name="camera" size={13} />{event.camera_name}</span><div><time>{new Date(event.created_at).toLocaleString("zh-CN", { hour12: false })}</time><Confidence value={event.max_confidence} /></div></div>
  </button>;
}

function CameraDetail({ id, navigate }) {
  const [days, setDays] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = () => {
    setError("");
    if (!id) { setError("缺少视频源编号"); return; }
    api.cameraDetail(id, days).then(setData).catch((err) => setError(err.message));
  };
  useEffect(() => { setData(null); load(); }, [id, days]);
  if (error) return <ErrorCard message={error} retry={load} />;
  if (!data) return <LoadingCard text="正在读取视频源记录…" />;
  const { camera, counts, events } = data;
  const area = cameraAreaNames[camera.area_type] || camera.area_type;
  const period = days === 1 ? "今日" : `近 ${days} 日`;
  return <div className="camera-detail-page">
    <div className="camera-detail-breadcrumb"><button type="button" onClick={() => navigate("dashboard")}>监控大盘</button><span>/</span><strong>{camera.name} · {area}</strong></div>
    <div className="camera-detail-top">
      <section className="surface camera-detail-viewer">
        <div className="camera-detail-card-head"><h2>{camera.name}</h2><span className={`source-status ${camera.status === "online" ? "available" : "unavailable"}`}><i />{camera.status === "online" ? "已启用" : "已停用"}</span><span className="camera-detail-demo-badge">演示视频源 · 非直播</span></div>
        <div className={`camera-detail-image ${camera.status !== "online" ? "offline" : ""}`}><img src={demoCameraImages[camera.area_type]} alt={`${camera.name}的合成演示静帧`} /><span className="camera-detail-location">{area}</span><span className="camera-detail-image-note">合成演示静帧 · 未接入实时视频流</span></div>
      </section>
      <aside className="camera-detail-side">
        <section className="surface camera-detail-info"><h3>设备信息</h3><dl><div><dt>视频源编号</dt><dd>{camera.id}</dd></div><div><dt>视频源名称</dt><dd>{camera.name}</dd></div><div><dt>关联位置</dt><dd>{area}</dd></div><div><dt>来源类型</dt><dd>{camera.source_type === "virtual" ? "虚拟视频源" : camera.source_type}</dd></div><div><dt>设备型号 / IP</dt><dd>未接入</dd></div><div><dt>分辨率 / 心跳</dt><dd>未接入</dd></div></dl></section>
        <section className="surface camera-detail-stats"><h3>{period}异常统计</h3><div><span><strong>{counts.total}</strong>总数</span><span><strong>{counts.p0}</strong>P0</span><span><strong>{counts.p1}</strong>P1</span></div><p>P2 {counts.p2} 条 · 误报及忽略不计入统计</p></section>
      </aside>
    </div>
    <section className="surface camera-detail-history"><div className="camera-detail-card-head"><div><h2>异常检测记录</h2><span className="small-tag">{period} {events.length} 条{events.length === 200 ? " · 仅显示最近 200 条" : ""}</span></div><select value={days} onChange={(event) => setDays(Number(event.target.value))} aria-label="记录时间范围"><option value={1}>今日</option><option value={7}>近 7 日</option><option value={30}>近 30 日</option></select></div>
      {events.length === 0 ? <div className="camera-detail-empty">该视频源{period}无异常检测记录</div> : <div className="camera-detail-records">{events.map((event) => <button type="button" key={event.id} onClick={() => navigate("event", event.id)}><div className="camera-detail-record-cover">{event.thumbnail_evidence_id ? <img src={api.evidenceUrl(event.thumbnail_evidence_id)} alt="事件证据帧" /> : <Icon name="video" />}</div><div><div className="camera-detail-record-title"><SeverityBadge value={event.severity} /><strong>{event.rule_code} · {event.title}</strong></div><p>{event.id} · {new Date(event.created_at).toLocaleString("zh-CN", { hour12: false })}</p><div className="camera-detail-record-meta"><Confidence value={event.max_confidence} /><StatusBadge value={event.status} /></div></div><Icon name="arrow" size={15} /></button>)}</div>}
    </section>
  </div>;
}

function EmptyEvents({ navigate }) {
  return <div className="empty-events"><div className="empty-icon"><Icon name="check" /></div><strong>暂无异常事件</strong><span>上传测试视频后，聚合事件会显示在这里</span><button className="button primary" onClick={() => navigate("upload")}>开始视频分析</button></div>;
}

function EventRow({ event, onClick }) {
  return <button className={`event-row severity-${event.severity.toLowerCase()}`} onClick={onClick}>
    <div className="event-thumb">{event.thumbnail_evidence_id ? <img src={api.evidenceUrl(event.thumbnail_evidence_id)} alt="事件实际证据帧" /> : <Icon name="video" />}</div>
    <div className="event-main"><div><SeverityBadge value={event.severity} /><strong>{event.title}</strong></div><p>{event.camera_name} · 已观察 {formatDuration(event.last_seen_offset - event.first_seen_offset)}</p><span>{event.id}</span></div>
    <div className="event-meta"><Confidence value={event.max_confidence} /><span>{statusLabel(event.status)}</span></div>
  </button>;
}

function SeverityBadge({ value }) { return <span className={`severity-badge ${value.toLowerCase()}`}>{value} · {value === "P0" ? "严重" : value === "P1" ? "一般" : "提示"}</span>; }
function Confidence({ value }) { return <span className="confidence"><Icon name="alert" size={13} />{percent(value)} 置信度</span>; }

function UploadPage({ bootstrap, navigate, initialCameraId }) {
  const [file, setFile] = useState(null);
  const [cameraId, setCameraId] = useState(initialCameraId || "CAM-STORAGE-01");
  const [notifications, setNotifications] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [run, setRun] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [analysisMode, setAnalysisMode] = useState("two_stage");
  const [preferredRule, setPreferredRule] = useState(null);
  const selectedCamera = bootstrap?.cameras?.find((camera) => camera.id === cameraId);
  const selectedArea = selectedCamera?.area_type;
  const availableRules = {
    storage: [["E1", "冰箱门持续开启"]],
    front_counter: [["A1", "口罩/手套合规"], ["A2", "未戴工作帽/发网"], ["C1", "未穿围裙/工服"], ["A3", "操作台明显脏乱"], ["A4", "地面积水/明显垃圾"]],
    back_kitchen: [["B1", "烟雾/明火观察"], ["A2", "未戴工作帽/发网"], ["C1", "未穿围裙/工服"], ["A3", "操作台明显脏乱"], ["A4", "地面积水/明显垃圾"]],
  }[selectedArea] || [];
  const ruleCode = availableRules.some(([code]) => code === preferredRule) ? preferredRule : availableRules[0]?.[0];
  const automaticRule = availableRules.find(([code]) => code === ruleCode)?.join(" · ");
  const experimentalRule = ruleCode !== "E1";

  useEffect(() => {
    api.rulesConfig().then((config) => {
      setProfiles(config.profiles);
      setAnalysisMode(config.default_analysis_mode);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!run || ["completed", "failed", "awaiting_approval"].includes(run.status)) return;
    const timer = setInterval(() => api.run(run.id).then(setRun).catch(() => {}), 1500);
    return () => clearInterval(timer);
  }, [run?.id, run?.status]);

  const start = async () => {
    if (!file) return setError("请先选择 MP4 视频");
    if (selectedCamera?.status !== "online") return setError("该演示视频源已停用，请先在摄像头管理中启用");
    setBusy(true); setError(""); setUploadProgress(0);
    try {
      const video = await api.uploadVideo({ file, cameraId, onProgress: setUploadProgress });
      const created = await api.createRun(video.id, notifications && !experimentalRule, analysisMode, ruleCode);
      setRun(created);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const approveFallback = async () => {
    if (!run) return;
    setBusy(true); setError("");
    try { setRun(await api.approveFallback(run.id)); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const stages = run?.analysis_mode === "two_stage"
    ? ["queued", "probing", "extracting", "screening", "refining", "aggregating", "completed"]
    : ["queued", "probing", "extracting", "analyzing", "aggregating", "completed"];
  const stepLabels = run?.analysis_mode === "two_stage"
    ? ["任务排队", "读取视频", "FFmpeg 抽帧", "视频低帧率粗筛", "关键时间点复核", "后端规则聚合", "分析完成"]
    : ["任务排队", "读取视频", "FFmpeg 抽帧", "豆包逐帧分析", "多帧事件聚合", "分析完成"];
  const currentIndex = run?.stage === "fallback_paused"
    ? 3
    : run ? stages.indexOf(run.stage) : -1;
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
        {(bootstrap?.cameras || []).map((camera) => <button className={cameraId === camera.id ? "selected" : ""} onClick={() => setCameraId(camera.id)} key={camera.id} disabled={camera.status !== "online"}><Icon name="camera" /><div><strong>{camera.name}</strong><span>{camera.status === "online" ? (cameraAreaNames[camera.area_type] || camera.area_type) : "已停用 · 请先启用"}</span></div><i /></button>)}
      </div></div>
      <div className="automatic-rule-note" role="status"><strong>自动检测范围</strong><span>{automaticRule ? `本次选择：${automaticRule}。未手动选择时按摄像头区域自动匹配；非 E1 规则需人工复核。` : "该区域暂无已实现的检测规则，暂不能发起分析。"}</span></div>
      {availableRules.length > 1 && <div className="form-block"><label htmlFor="upload-rule-code">本次规则（可选；默认自动匹配）</label><select id="upload-rule-code" value={ruleCode} onChange={(event) => setPreferredRule(event.target.value)}>{availableRules.map(([code, name]) => <option key={code} value={code}>{code} · {name}（试运行）</option>)}</select></div>}
      <div className="form-block"><label>本次分析模式</label><div className="mode-options">
        {profiles.map((profile) => <button type="button" className={analysisMode === profile.id ? "selected" : ""} onClick={() => setAnalysisMode(profile.id)} key={profile.id}><div><strong>{profile.name}</strong><span>{profile.id === "frame_baseline" ? "全量 1 fps · 高消耗准确性基线" : "低帧率粗筛 · 关键点复核 · 回退前需确认"}</span></div><i /></button>)}
      </div></div>
      <label className={`switch-row ${experimentalRule ? "disabled" : ""}`}><div><strong>分析完成后发送飞书告警</strong><span>{experimentalRule ? "实验规则只进入 Dashboard 待人工复核，不发送真实告警" : "演示视频默认关闭，避免循环告警"}</span></div><input type="checkbox" disabled={experimentalRule} checked={notifications && !experimentalRule} onChange={(e) => setNotifications(e.target.checked)} /><i /></label>
      {error && <div className="inline-error"><Icon name="alert" />{error}</div>}
      {!run && <button className="button primary large" disabled={busy || !file || !automaticRule || selectedCamera?.status !== "online"} onClick={start}>{busy ? `正在上传 ${Math.round(uploadProgress * 100)}%` : <><Icon name="play" />开始 AI 分析</>}</button>}
    </section>
    <aside className="surface analysis-card">
      <div className="page-section-title"><div><h2>分析进度</h2><p>{run ? `${run.id} · ${run.rule_code || "E1"} · ${run.analysis_mode === "two_stage" ? "双层判定" : "逐帧基线"}` : "提交后显示真实任务状态"}</p></div>{run && <StatusBadge value={run.status} />}</div>
      <div className="analysis-progress"><div className="progress-ring" style={{ "--progress": `${Math.round((run?.progress || 0) * 360)}deg` }}><strong>{Math.round((run?.progress || 0) * 100)}%</strong></div><div><strong>{run ? statusLabel(run.status) : "等待任务"}</strong><span>{run?.error_message || "上传视频后，Worker 将开始处理"}</span></div></div>
      <div className="steps">
        {stepLabels.map((label, index) => <div className={index < currentIndex ? "done" : index === currentIndex ? "active" : ""} key={label}><i>{index < currentIndex ? <Icon name="check" size={13} /> : index + 1}</i><span>{label}</span></div>)}
      </div>
      {run?.status === "awaiting_approval" && <div className="fallback-approval"><strong>逐帧回退已暂停</strong><p>{run.fallback_reason || run.error_message}</p><span>预计继续消耗约 {(run.estimated_fallback_tokens || 0).toLocaleString()} Token</span><button className="button secondary" disabled={busy} onClick={approveFallback}>{busy ? "正在提交…" : "确认改用逐帧分析"}</button></div>}
      {run?.status === "completed" && ["B1", "G1", "A2", "C1", "A3", "A4"].includes(run.rule_code) && <div className="automatic-rule-note" role="status"><strong>实验观察结果</strong><span>{run.analysis_mode === "two_stage" ? `视频粗筛候选 ${(() => { try { return JSON.parse(run.screening_result_json || "{}").segments?.length || 0; } catch { return 0; } })()} 段；` : "逐帧观察已完成；"}后端确认事件 {run.event_count ?? 0} 条。{run.rule_code === "G1" && (run.duration_seconds || 0) < 120 ? "短视频未达到 120 秒实验阈值，不会生成超时事件。" : "请人工复核证据；实验结果不发送飞书告警。"}</span></div>}
      {run?.status === "completed" && <button className="button primary" onClick={() => navigate("run", run.id)}>查看分析结果</button>}
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
  return <section className="surface list-page"><div className="page-section-title"><div><h2>视频分析任务</h2><p>点击任务查看结论、证据、耗时与模型消耗；无事件任务也保留分析结果</p></div><button className="button primary" onClick={() => navigate("upload")}><Icon name="upload" />上传视频</button></div>
    <div className="table-head run-grid"><span>任务 / 视频</span><span>规则 / 模式</span><span>处理进度</span><span>分析结论</span><span>分析耗时</span><span>调用/Token</span><span>状态</span><span>创建时间</span></div>
    {runs.length === 0 ? <div className="table-empty">暂无分析任务。上传视频后，可在此查看包括零事件在内的分析结论。</div> : runs.map((run) => <button type="button" className="table-row run-grid run-row" key={run.id} onClick={() => navigate("run", run.id)} aria-label={`查看任务 ${run.id} 的分析结果`}><div><strong>{run.id}</strong><span>{run.original_name}</span></div><span>{run.rule_code || "E1"} · {run.analysis_mode === "two_stage" ? "双层判定" : "逐帧基线"}</span><div className="mini-progress"><i style={{ width: `${run.progress * 100}%` }} /><span>{Math.round(run.progress * 100)}%</span></div><span className={`run-outcome ${runOutcome(run).tone}`}>{runOutcome(run).label}</span><span>{analysisElapsedSeconds(run) == null ? "—" : formatDuration(analysisElapsedSeconds(run))}</span><span>{run.request_count || 0} 次 / {((run.prompt_tokens || 0) + (run.completion_tokens || 0)).toLocaleString()}</span><StatusBadge value={run.status} /><time>{new Date(run.created_at).toLocaleString("zh-CN", { hour12: false })}</time></button>)}
  </section>;
}

function RunDetail({ id, navigate }) {
  const [run, setRun] = useState(null);
  const [error, setError] = useState("");
  const load = () => api.run(id).then(setRun).catch((err) => setError(err.message));
  useEffect(() => { load(); }, [id]);
  if (error) return <ErrorCard message={error} retry={load} />;
  if (!run) return <LoadingCard text="正在读取任务结果…" />;
  const outcome = runOutcome(run);
  const elapsed = analysisElapsedSeconds(run);
  const candidateCount = screeningCandidateCount(run);
  const stamp = (value) => value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—";
  return <div className="run-detail-page">
    <button className="back-button" onClick={() => navigate("runs")}><Icon name="arrow" />返回分析任务</button>
    <section className="surface run-result-card">
      <div className="section-header"><div><h2>本次分析结论</h2><p className="section-subtitle">{run.id} · {run.original_name}</p></div><StatusBadge value={run.status} /></div>
      <div className={`run-result-banner ${outcome.tone}`} role="status"><Icon name={outcome.tone === "alert" || outcome.tone === "failed" ? "alert" : "check"} /><div><strong>{outcome.label}</strong><p>{outcome.detail}</p></div></div>
      {run.status === "completed" && <p className="run-result-explain">{run.rule_code === "B1" && Number(run.event_count || 0) === 0 ? "B1 仅判断烟雾或异常明火。此次没有形成 B1 事件；不能据此证明视频中不存在其他类型风险。" : "事件数来自后端规则聚合，不是模型单次文字描述。"}</p>}
      {run.status === "failed" && <p className="run-result-explain">失败任务没有形成有效的最终判定，请查看错误原因并重新分析。</p>}
    </section>
    <section className="surface run-facts-card"><div className="section-header"><h2>分析记录</h2></div><dl className="run-facts-grid">
      <div><dt>规则与模式</dt><dd>{run.rule_code} · {run.analysis_mode === "two_stage" ? "双层判定" : "逐帧基线"}</dd></div>
      <div><dt>原视频时长</dt><dd>{formatDuration(run.duration_seconds)}</dd></div>
      <div><dt>粗筛候选片段</dt><dd>{run.analysis_mode !== "two_stage" ? "不适用" : candidateCount == null ? "未记录" : `${candidateCount} 段`}</dd></div>
      <div><dt>确认事件</dt><dd>{run.status === "completed" ? `${run.event_count || 0} 条` : "尚未完成"}</dd></div>
      <div><dt>本次飞书告警</dt><dd>{run.notifications_enabled ? "已启用（仅符合通知规则时发送）" : "关闭"}</dd></div>
      <div><dt>开始分析</dt><dd>{stamp(run.started_at)}</dd></div>
      <div><dt>分析完成</dt><dd>{stamp(run.completed_at)}</dd></div>
      <div><dt>实际分析耗时</dt><dd>{elapsed == null ? "—" : formatDuration(elapsed)}</dd></div>
      <div><dt>上传至完成</dt><dd>{run.completed_at ? formatDuration((Date.parse(run.completed_at) - Date.parse(run.created_at)) / 1000) : "—"}</dd></div>
      <div><dt>模型请求 / Token</dt><dd>{run.request_count || 0} 次 / {((run.prompt_tokens || 0) + (run.completion_tokens || 0)).toLocaleString()}</dd></div>
    </dl></section>
    {run.events?.length > 0 && <section className="surface run-events-card"><div className="section-header"><h2>产生的事件</h2><span>{run.events.length} 条</span></div><div>{run.events.map((event) => <button type="button" className="run-event-link" key={event.id} onClick={() => navigate("event", event.id)}><SeverityBadge value={event.severity} /><strong>{event.title}</strong><span>{event.id}</span><StatusBadge value={event.status} /><Icon name="arrow" size={14} /></button>)}</div></section>}
  </div>;
}

function EventDetail({ id, navigate }) {
  const [event, setEvent] = useState(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null);
  const [assignees, setAssignees] = useState([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [actionNote, setActionNote] = useState("");
  const [selectedEvidenceId, setSelectedEvidenceId] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoTime, setVideoTime] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef(null);
  const load = () => api.event(id).then(setEvent).catch((err) => setError(err.message));
  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    if (!event?.evidence?.length) return;
    const confirmed = event.evidence.find((item) => item.evidence_type === "confirmed");
    setSelectedEvidenceId((current) => current || confirmed?.id || event.evidence[0].id);
  }, [event]);
  if (error) return <ErrorCard message={error} retry={load} />;
  if (!event) return <LoadingCard text="正在加载事件证据…" />;
  const act = async (action, note, selectedAssignee) => {
    setSaving(true); setActionError("");
    try {
      setEvent(await api.eventAction(id, action, note, selectedAssignee));
      setModal(null); setActionNote("");
    } catch (err) { setActionError(err.message); }
    finally { setSaving(false); }
  };
  const openModal = async (kind) => {
    setActionError(""); setActionNote(""); setAssigneeId(event.assignee_id || ""); setModal(kind);
    if (kind === "assign") {
      try { setAssignees(await api.eventAssignees(id)); }
      catch (err) { setActionError(err.message); }
    }
  };
  const evidenceByType = Object.fromEntries(event.evidence.map((item) => [item.evidence_type, item]));
  const selected = event.evidence.find((item) => item.id === selectedEvidenceId) || evidenceByType.confirmed || event.evidence[0];
  const effectiveDuration = videoDuration || event.video_duration_seconds || Math.max(event.last_seen_offset + 1, 1);
  const anomalyEnd = event.recovered_offset ?? event.last_seen_offset;
  const evidenceLabels = {start:"首次发现", confirmed:"确认异常", peak:"最高置信度", recovered:"恢复正常"};
  const seekToEvidence = (item) => {
    setSelectedEvidenceId(item.id);
    setVideoTime(item.captured_offset);
    if (videoRef.current && !videoFailed) {
      videoRef.current.currentTime = item.captured_offset;
      videoRef.current.pause();
    }
  };
  return <div className="detail-page">
    <div className="event-breadcrumb"><button type="button" onClick={() => navigate("dashboard")}>监控大盘</button><span>/</span><button type="button" onClick={() => navigate("cameraDetail", event.camera_id)}>{event.camera_name}</button><span>/</span><strong>{event.id}</strong></div>
    <section className="surface detail-header"><div><div className="badge-line"><SeverityBadge value={event.severity} /><StatusBadge value={event.status} /></div><h2>{event.title}</h2><p>{event.store_name} · {event.camera_name} · {event.id}</p></div><div className="detail-actions">{event.status === "pending_confirmation" && <><button className="button secondary" disabled={saving} onClick={() => openModal("false_positive")}>标记误报</button><button className="button secondary" disabled={saving} onClick={() => openModal("assign")}>指派整改</button><button className="button primary" disabled={saving} onClick={() => act("acknowledge")}><Icon name="check" />确认事件</button></>}{event.status === "acknowledged" && <><button className="button secondary" disabled={saving} onClick={() => openModal("assign")}>{event.assignee_id ? "更换负责人" : "指派整改"}</button><button className="button primary" disabled={saving || !event.assignee_id} title={!event.assignee_id ? "请先指派负责人" : ""} onClick={() => act("start_rectification")}>开始整改</button></>}{event.status === "rectifying" && <><button className="button secondary" disabled={saving} onClick={() => openModal("assign")}>更换负责人</button><button className="button primary" disabled={saving} onClick={() => openModal("resolve")}>提交整改结果</button></>}</div></section>
    {actionError && <div className="detail-action-error" role="alert">{actionError}</div>}
    <div className="detail-columns">
      <section className="surface evidence-card">
        <div className="section-header"><div><h2>事件证据</h2><p className="section-subtitle">点击证据或时间轴标记，跳转到原视频对应时刻</p></div><span>{`当前 ${formatDuration(videoTime)}`}</span></div>
        {selected ? <>
          <div className="evidence-video">
            {!videoFailed ? <video ref={videoRef} src={api.eventVideoUrl(event.id)} poster={api.evidenceUrl(selected.id)} controls preload="metadata" onLoadedMetadata={(media) => setVideoDuration(media.currentTarget.duration)} onTimeUpdate={(media) => setVideoTime(media.currentTarget.currentTime)} onError={() => setVideoFailed(true)} /> : <img src={api.evidenceUrl(selected.id)} alt="事件证据帧" />}
            <div className="video-evidence-caption"><span>{videoFailed ? "原视频暂不可播放 · 当前显示证据帧" : event.video_original_name}</span><time>{formatDuration(videoTime)}</time></div>
          </div>
          <div className="incident-scrubber" aria-label="原视频异常时间轴">
            <div className="scrubber-summary"><strong>异常关注区间</strong><span>{formatDuration(event.first_seen_offset)} – {formatDuration(anomalyEnd)}</span></div>
            <div className="scrubber-track">
              <i className="scrubber-danger" style={{left:`${timelinePercent(event.first_seen_offset, effectiveDuration)}%`, width:`${Math.max(1, timelinePercent(anomalyEnd, effectiveDuration) - timelinePercent(event.first_seen_offset, effectiveDuration))}%`}} />
              <i className="scrubber-playhead" style={{left:`${timelinePercent(videoTime, effectiveDuration)}%`}} />
              {event.evidence.map((item) => <button key={item.id} className={`scrubber-marker marker-${item.evidence_type}`} style={{left:`${timelinePercent(item.captured_offset, effectiveDuration)}%`}} title={`${evidenceLabels[item.evidence_type] || item.evidence_type} · ${formatDuration(item.captured_offset)}`} aria-label={`跳转到${evidenceLabels[item.evidence_type] || item.evidence_type} ${formatDuration(item.captured_offset)}`} onClick={() => seekToEvidence(item)} />)}
            </div>
            <div className="scrubber-scale"><span>0 秒</span><span>{formatDuration(effectiveDuration)}</span></div>
          </div>
        </> : <div className="table-empty">暂无证据图</div>}
        <div className="evidence-strip">{event.evidence.map((item) => <button type="button" className={selected?.id === item.id ? "active" : ""} key={item.id} onClick={() => seekToEvidence(item)}><img src={api.evidenceUrl(item.id)} alt={item.evidence_type} /><span><strong>{evidenceLabels[item.evidence_type] || item.evidence_type}</strong><time>{formatDuration(item.captured_offset)}</time></span></button>)}</div>
      </section>
      <aside className="surface event-summary"><div className="section-header"><h2>AI 研判结果</h2><Confidence value={event.max_confidence} /></div><dl><div><dt>规则编码</dt><dd>{event.rule_code} {event.title}</dd></div><div><dt>分析模式</dt><dd>{event.analysis_mode === "two_stage" ? "双层判定" : "逐帧基线"}</dd></div><div><dt>首次发现</dt><dd>{formatDuration(event.first_seen_offset)}</dd></div><div><dt>确认异常</dt><dd>{formatDuration(event.confirmed_offset)}</dd></div><div><dt>已观察持续</dt><dd>{formatDuration(event.last_seen_offset - event.first_seen_offset)}</dd></div><div><dt>模型消耗</dt><dd>{event.request_count || 0} 次 / {((event.prompt_tokens || 0) + (event.completion_tokens || 0)).toLocaleString()} Token</dd></div><div><dt>恢复时间</dt><dd>{event.recovered_offset == null ? "尚未观察到恢复" : formatDuration(event.recovered_offset)}</dd></div></dl><div className="rule-note"><strong>判定策略</strong><p>{{ A1: "仅在操作区人员脸部或双手清晰可见时判断，最近5个有效观察中至少3次违规才确认；实验规则，不发送飞书告警。", A2: "操作区员工头部可见时判断，最近5个有效帧至少3次缺少工作帽/发网；试运行，不发送告警。", C1: "操作区员工躯干可见时判断，最近5个有效帧至少3次缺少围裙/工服；试运行，不发送告警。", A3: "操作台明显脏乱连续可见至少60秒；正常制作摆放不计。试运行，不发送告警。", A4: "地面明确积水或垃圾最近5个有效帧至少3次命中；反光和清洁中不计。试运行，不发送告警。", B1: "视频粗筛疑似烟雾/明火后复核关键帧；至少持续2秒才形成实验观察，正常蒸汽不触发。仅供人工复核，不发送P0告警。", G1: "单桌 ROI 内先确认顾客离席及桌面残留，再由后端按视频时间戳累计至少120秒；50秒样本不得触发。实验规则，不发送飞书告警。", E1: "冷藏设备门连续处于开启状态达到30秒，由后端时序规则确认；严重度与SLA不由模型自由生成。" }[event.rule_code]}</p></div></aside>
    </div>
    <section className="surface rectification-summary"><div><h2>整改处理</h2><p>负责人与处理说明会写入事件时间线；AI 恢复状态不等于人工验收。</p></div><dl><div><dt>当前负责人</dt><dd>{event.assignee_name || "尚未指派"}</dd></div><div><dt>处理状态</dt><dd>{statusLabel(event.status)}</dd></div><div><dt>SLA 截止</dt><dd>{event.due_at ? new Date(event.due_at).toLocaleString("zh-CN", { hour12: false }) : "未设置"}</dd></div></dl></section>
    <section className="surface timeline-card"><div className="section-header"><h2>事件时间线</h2><span>{event.timeline.length} 条记录</span></div><div className="timeline">{event.timeline.map((item) => <div key={item.id}><i /><time>{new Date(item.created_at).toLocaleString("zh-CN", { hour12: false })}</time><div><strong>{item.note}</strong><span>{item.from_status ? `${statusLabel(item.from_status)} → ${statusLabel(item.to_status)}` : "系统记录"}</span></div></div>)}</div></section>
    {modal && <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setModal(null); }}><div className="action-dialog" role="dialog" aria-modal="true" aria-labelledby="action-dialog-title"><div className="dialog-title"><h2 id="action-dialog-title">{modal === "assign" ? "指派整改" : modal === "resolve" ? "提交整改结果" : "标记误报"}</h2><button type="button" aria-label="关闭弹窗" onClick={() => setModal(null)} disabled={saving}>×</button></div><div className="dialog-body">{modal === "assign" && <label>指派给<select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}><option value="">请选择负责人</option>{assignees.map((user) => <option key={user.id} value={user.id}>{user.display_name} · {user.role}</option>)}</select>{assignees.length === 1 && <small>当前仅有一个已初始化账号；门店负责人账号需在组织初始化中补齐。</small>}</label>}{modal === "resolve" && event.recovered_offset == null && <p className="dialog-warning">视频尚未观察到恢复，请在整改说明中写明人工复核依据；提交后仍保留原始 AI 证据。</p>}<label>{modal === "assign" ? "整改要求 / 备注" : modal === "resolve" ? "整改结果与复核依据" : "误报原因"}<textarea value={actionNote} onChange={(e) => setActionNote(e.target.value)} placeholder={modal === "assign" ? "请输入整改要求或备注说明…" : "请填写具体说明…"} rows={4} /></label>{actionError && <p className="dialog-error" role="alert">{actionError}</p>}</div><div className="dialog-footer"><button className="button secondary" type="button" onClick={() => setModal(null)} disabled={saving}>取消</button><button className="button primary" type="button" disabled={saving || !actionNote.trim() || (modal === "assign" && !assigneeId)} onClick={() => act(modal === "false_positive" ? "mark_false_positive" : modal, actionNote.trim(), modal === "assign" ? assigneeId : undefined)}>{saving ? "提交中…" : modal === "assign" ? "确认指派" : modal === "resolve" ? "确认已解决" : "确认标记"}</button></div></div></div>}
  </div>;
}

function CamerasPage({ bootstrap, loadError, refresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ name: "", code: "", area_type: "front_counter" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  if (cameraPageState(bootstrap, loadError) !== "ready") return loadError
    ? <ErrorCard message={loadError} retry={() => refresh().catch(() => {})} />
    : <LoadingCard text="正在读取视频源…" />;
  const cameras = bootstrap.cameras || [];
  const primary = dashboardCameraIds.map((id) => cameras.find((camera) => camera.id === id)).filter(Boolean);
  const extra = cameras.filter((camera) => !dashboardCameraIds.includes(camera.id));
  const available = primary.filter((camera) => camera.status === "online").length;
  const uploadBytes = bootstrap.today_upload_bytes || 0;
  const uploadAmount = uploadBytes >= 1_000_000_000
    ? `${(uploadBytes / 1_000_000_000).toFixed(2)} GB`
    : `${(uploadBytes / 1_000_000).toFixed(1)} MB`;
  const toggle = async (camera) => {
    setBusyId(camera.id); setError("");
    try { await api.setCameraStatus(camera.id, camera.status === "online" ? "offline" : "online"); await refresh(); }
    catch (err) { setError(err.message); }
    finally { setBusyId(""); }
  };
  const add = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    try { await api.createCamera(draft); await refresh(); setShowAdd(false); setDraft({ name: "", code: "", area_type: "front_counter" }); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };
  const row = (camera) => <div className="camera-source-row" key={camera.id}>
    <div className="camera-source-name"><img src={demoCameraImages[camera.area_type]} alt={`${camera.name}演示封面`} /><div><strong>{camera.name}</strong><small>{camera.code} · 虚拟视频源</small></div></div>
    <span>{cameraAreaNames[camera.area_type] || camera.area_type}</span>
    <span className={`source-status ${camera.status === "online" ? "available" : "unavailable"}`}><i />{camera.status === "online" ? "已启用" : "已停用"}</span>
    <span className="camera-unavailable">未接入</span><span className="camera-unavailable">未接入</span>
    <button type="button" className="camera-toggle" role="switch" aria-label={`${camera.name}演示视频源`} aria-checked={camera.status === "online"} title="仅切换演示视频源配置，不控制物理摄像头" disabled={busyId === camera.id} onClick={() => toggle(camera)}><i /></button>
  </div>;
  return <div className="camera-management-page">
    <div className="camera-management-heading"><div><h2>摄像头管理</h2><p>共 {primary.length} 台摄像头，已启用 {available} 台，已停用 {primary.length - available} 台 <span>· 演示配置，非真实在线状态</span></p></div><button className="button primary camera-add-button" type="button" onClick={() => { setError(""); setShowAdd(true); }}><Icon name="plus" size={16} />添加摄像头</button></div>
    <div className="camera-source-metrics">
      <div className="camera-kpi"><i className="green"><Icon name="camera" size={16} /></i><div><span>已启用视频源</span><strong>{available}/{primary.length}</strong></div></div>
      <div className="camera-kpi"><i className="blue"><Icon name="pulse" size={16} /></i><div><span>今日上传视频量</span><strong>{uploadAmount}</strong></div></div>
      <div className="camera-kpi"><i className="purple"><Icon name="clock" size={16} /></i><div><span>平均在线时长</span><strong>—</strong></div></div>
    </div>
    <section className="surface camera-source-table">
      <div className="camera-source-row camera-source-head"><span>摄像头信息</span><span>位置</span><span>状态</span><span>最后心跳</span><span>分辨率</span><span>操作</span></div>
      {primary.map(row)}
      {cameras.length === 0 && <div className="camera-empty">尚未配置演示视频源，可点击右上角添加摄像头。</div>}
    </section>
    {extra.length > 0 && <details className="camera-extra"><summary>其他演示视频源（{extra.length}）</summary><section className="surface camera-source-table">{extra.map(row)}</section></details>}
    <p className="camera-source-disclaimer">封面为合成演示素材；“已启用”仅表示允许选择该视频源，不表示物理摄像头在线。今日上传量来自实际上传文件；实时流量、心跳、分辨率及在线时长尚未接入。</p>
    {error && !showAdd && <p className="dialog-error" role="alert">{error}</p>}
    {showAdd && <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowAdd(false); }}><form className="action-dialog camera-add-dialog" role="dialog" aria-modal="true" aria-labelledby="camera-add-title" onSubmit={add}><div className="dialog-title"><h2 id="camera-add-title">添加演示视频源</h2><button type="button" aria-label="关闭弹窗" onClick={() => setShowAdd(false)} disabled={saving}>×</button></div><div className="dialog-body"><p>当前仅添加用于上传分析的虚拟视频源，不连接真实摄像头。</p><label>名称<input required maxLength={60} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="例如：仓储-02" /></label><label>编号<input required maxLength={32} pattern="[A-Za-z0-9-]{2,32}" value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} placeholder="例如：STORAGE-02" /></label><label>位置<select value={draft.area_type} onChange={(event) => setDraft({ ...draft, area_type: event.target.value })}>{Object.entries(cameraAreaNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{error && <p className="dialog-error" role="alert">{error}</p>}</div><div className="dialog-footer"><button className="button secondary" type="button" onClick={() => setShowAdd(false)} disabled={saving}>取消</button><button className="button primary" type="submit" disabled={saving}>{saving ? "添加中…" : "确认添加"}</button></div></form></div>}
  </div>;
}

function RectificationPage({ navigate }) {
  const [events, setEvents] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [status, setStatus] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [period, setPeriod] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const load = () => api.events().then(setEvents).catch((err) => setLoadError(err.message));
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => filterRectificationEvents(events || [], { status, severity, period, query }), [events, status, severity, period, query]);
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const change = (setter, value) => { setter(value); setPage(1); };
  const exportRows = () => {
    const csv = rectificationCsv(filtered);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "巡店整改事件.csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (loadError) return <ErrorCard message={loadError} retry={() => { setLoadError(""); load(); }} />;
  if (!events) return <LoadingCard />;
  const tabs = [
    ["all", "全部", events.length],
    ["pending", "待处理", events.filter((e) => ["pending_confirmation", "acknowledged"].includes(e.status)).length],
    ["rectifying", "整改中", events.filter((e) => e.status === "rectifying").length],
    ["resolved", "已解决", events.filter((e) => e.status === "resolved").length],
    ["overdue", "已超时", events.filter((e) => e.overdue).length],
  ];
  return <section className="surface list-page rectification-page">
    <div className="page-section-title"><div><h2>整改跟踪</h2><p>管理所有巡检事件的整改进度，追踪 SLA 响应时效</p></div><button className="button secondary" onClick={load}>刷新列表</button></div>
    <div className="filter-tabs" role="tablist" aria-label="事件状态">{tabs.map(([value, label, count]) => <button type="button" role="tab" aria-selected={status === value} className={status === value ? "active" : ""} key={value} onClick={() => change(setStatus, value)}>{label} <b>{count}</b></button>)}</div>
    <div className="rectification-filters"><div><span>严重度：</span>{[["all","全部"],["P0","P0 严重"],["P1","P1 一般"],["P2","P2 提示"]].map(([value,label]) => <button type="button" className={severity === value ? "active" : ""} key={value} onClick={() => change(setSeverity,value)}>{label}</button>)}</div><div><span>时间范围：</span>{[["today","今天"],["week","近 7 天"],["month","近 30 天"],["all","全部"]].map(([value,label]) => <button type="button" className={period === value ? "active" : ""} key={value} onClick={() => change(setPeriod,value)}>{label}</button>)}</div><div className="rectification-search"><input value={query} onChange={(e) => change(setQuery,e.target.value)} placeholder="搜索事件 ID / 类型 / 摄像头…" aria-label="搜索整改事件" /><button type="button" onClick={exportRows} disabled={!filtered.length}>导出</button></div></div>
    <div className="rectification-table"><div className="rectification-head"><span>事件 ID</span><span>异常类型 / 负责人</span><span>严重度</span><span>摄像头</span><span>检测时间</span><span>状态</span><span>SLA</span><span>操作</span></div>{visible.length ? visible.map((event) => <div className="rectification-row" key={event.id}><strong>{event.id}</strong><div><b>{event.rule_code} · {event.title}</b><small>{event.assignee_name ? `负责人：${event.assignee_name}` : "尚未指派负责人"}</small></div><SeverityBadge value={event.severity} /><span>{event.camera_name}</span><time>{new Date(event.created_at).toLocaleString("zh-CN", { hour12: false })}</time><StatusBadge value={event.status} /><span className={event.overdue ? "overdue-text" : ""}>{event.status === "resolved" ? "已完成" : event.overdue ? "已超时" : event.due_at ? new Date(event.due_at).toLocaleString("zh-CN", { hour12: false }) : "—"}</span><button type="button" className="link-button" onClick={() => navigate("event", event.id)}>查看 →</button></div>) : <div className="table-empty">当前条件下没有整改事件</div>}</div>
    <div className="rectification-pager"><span>共 {filtered.length} 条记录 · 第 {page}/{pageCount} 页</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>{Array.from({length:pageCount}, (_,index) => <button type="button" className={page === index + 1 ? "active" : ""} key={index} onClick={() => setPage(index + 1)}>{index + 1}</button>)}<button type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>下一页</button></div></div>
  </section>;
}

const rules = [
  ["E1", "冰箱门持续开启", "多帧时序", "持续30秒", "P1", "ready"],
  ["A1", "未佩戴口罩或一次性手套", "ROI + 多帧", "最近5个有效帧命中3帧", "P2", "experimental"],
  ["A2", "未戴工作帽/发网", "操作区 + 多帧", "最近5个有效帧命中3帧", "P1", "experimental"],
  ["C1", "未穿围裙/工服", "操作区 + 多帧", "最近5个有效帧命中3帧", "P1", "experimental"],
  ["A3", "操作台明显脏乱", "环境 + 时序", "持续60秒", "P1", "experimental"],
  ["A4", "地面积水/明显垃圾", "环境 + 多帧", "最近5个有效帧命中3帧", "P1", "experimental"],
  ["B1", "疑似烟雾/异常明火", "视频粗筛 + 关键帧", "持续2秒，人工复核", "P2", "experimental"],
  ["G1", "单桌离席后残留", "逐桌 ROI + 时序", "时限待业务确认", "P2", "research"],
  ["F1", "取餐区堆积混乱", "区域 + 多帧", "阈值待确认", "P2", "research"],
  ["F2", "顾客排队拥挤", "人数 + 区域", "阈值待确认", "P2", "research"],
  ["A6", "通道堵塞", "通道 ROI + 时序", "阈值待确认", "P2", "research"],
  ["F3", "生熟混放", "物品关系 + 复核", "条件待确认", "P2", "research"],
  ["F4", "异物混入", "小目标 + 复核", "条件待确认", "P2", "research"]
];

function RulesPage() {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { api.rulesConfig().then(setConfig); }, []);
  const selectMode = async (mode) => {
    setSaving(true); setMessage("");
    try { setConfig(await api.updateRulesConfig(mode)); setMessage("默认分析模式已保存，新任务将使用该模式"); }
    catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  };
  if (!config) return <LoadingCard text="正在读取规则配置…" />;
  return <div className="rules-layout"><section className="surface mode-config"><div className="page-section-title"><div><h2>分析模式</h2><p>逐帧基线与双层判定均可用于当前已实现规则，上传时可单独覆盖</p></div><span className="prototype-chip">默认：{config.default_analysis_mode === "two_stage" ? "双层判定" : "逐帧基线"}</span></div><div className="mode-profile-grid">{config.profiles.map((profile) => <button disabled={saving} className={config.default_analysis_mode === profile.id ? "selected" : ""} onClick={() => selectMode(profile.id)} key={profile.id}><div className="mode-profile-head"><strong>{profile.name}</strong><span>{config.default_analysis_mode === profile.id ? "当前默认" : "设为默认"}</span></div><p>{profile.description}</p><dl>{Object.entries(profile.config).map(([key,value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl></button>)}</div>{message && <div className="config-message">{message}</div>}</section><section className="surface list-page"><div className="page-section-title"><div><h2>规则能力</h2><p>已实现、待开发与实验候选分开展示；候选规则不会参与上传分析</p></div><span className="prototype-chip">{rules.filter((rule) => rule[5] === "ready").length} 条正式可运行 · {rules.filter((rule) => rule[5] === "experimental").length} 条实验可运行 · {rules.filter((rule) => !["ready", "experimental"].includes(rule[5])).length} 条候选</span></div><div className="table-head rule-grid"><span>规则</span><span>能力类型</span><span>确认策略</span><span>严重度</span><span>实现状态</span></div>{rules.map(([code,name,type,strategy,severity,status]) => <div className="table-row rule-grid" key={code}><div><strong>{code} · {name}</strong><span>{status === "ready" ? "正式可运行" : status === "experimental" ? "实验可运行 · 默认不通知" : status === "research" ? "实验候选 · 待验证" : "正式规划 · 尚未实现"}</span></div><span>{type}</span><span>{strategy}</span><SeverityBadge value={severity.split("/")[0]} /><span className={status === "ready" ? "ready" : status === "experimental" ? "experimental" : status === "research" ? "research" : "planned"}>{status === "ready" ? "已实现" : status === "experimental" ? "实验可用" : status === "research" ? "待验证" : "后续实现"}</span></div>)}</section></div>;
}

export default App;
