import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { Icon } from "./icons";
import { formatDuration, percent, statusLabel, timelinePercent } from "./utils";
import { filterRectificationEvents, rectificationCsv } from "./rectification";
import { StoreOverviewPage, WorkOrderPage } from "./OverviewWorkorders";

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
          {route.page === "stores" && <StoreOverviewPage bootstrap={bootstrap} navigate={route.navigate} />}
          {route.page === "upload" && <UploadPage bootstrap={bootstrap} navigate={route.navigate} />}
          {route.page === "runs" && <RunsPage navigate={route.navigate} />}
          {route.page === "event" && <EventDetail id={route.id} navigate={route.navigate} />}
          {route.page === "cameras" && <CamerasPage bootstrap={bootstrap} />}
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
    stores: ["门店视觉巡检 · 门店总览", "查看已接入门店的巡检结果"],
    upload: ["视频上传分析", "上传门店视频并运行真实 AI 巡检"],
    runs: ["分析任务", "查看抽帧、视觉分析与事件聚合进度"],
    event: ["事件详情", "查看异常证据、状态与整改记录"],
    cameras: ["摄像头管理", "管理门店视频来源与监控区域"],
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
        <div className="ai-status"><span /> AI 上传分析就绪</div>
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
  const [profiles, setProfiles] = useState([]);
  const [analysisMode, setAnalysisMode] = useState("two_stage");
  const selectedArea = bootstrap?.cameras?.find((camera) => camera.id === cameraId)?.area_type;
  const automaticRule = { storage: "E1 冰箱门持续开启", front_counter: "A1 口罩/手套合规（实验）" }[selectedArea];
  const experimentalRule = selectedArea === "front_counter";

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
    setBusy(true); setError(""); setUploadProgress(0);
    try {
      const video = await api.uploadVideo({ file, cameraId, onProgress: setUploadProgress });
      const created = await api.createRun(video.id, notifications && !experimentalRule, analysisMode);
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
        {(bootstrap?.cameras || []).map((camera) => <button className={cameraId === camera.id ? "selected" : ""} onClick={() => setCameraId(camera.id)} key={camera.id}><Icon name="camera" /><div><strong>{camera.name}</strong><span>{camera.area_type}</span></div><i /></button>)}
      </div></div>
      <div className="automatic-rule-note" role="status"><strong>自动检测范围</strong><span>{automaticRule ? `已按摄像头区域匹配：${automaticRule}。无需手动选择规则。` : "该区域暂无已实现的检测规则；B1/G1 等能力仍在开发，暂不能发起分析。"}</span></div>
      <div className="form-block"><label>本次分析模式</label><div className="mode-options">
        {profiles.map((profile) => <button type="button" className={analysisMode === profile.id ? "selected" : ""} onClick={() => setAnalysisMode(profile.id)} key={profile.id}><div><strong>{profile.name}</strong><span>{profile.id === "frame_baseline" ? "全量 1 fps · 高消耗准确性基线" : "低帧率粗筛 · 关键点复核 · 回退前需确认"}</span></div><i /></button>)}
      </div></div>
      <label className={`switch-row ${experimentalRule ? "disabled" : ""}`}><div><strong>分析完成后发送飞书告警</strong><span>{experimentalRule ? "实验规则只进入 Dashboard，不发送真实告警" : "演示视频默认关闭，避免循环告警"}</span></div><input type="checkbox" disabled={experimentalRule} checked={notifications && !experimentalRule} onChange={(e) => setNotifications(e.target.checked)} /><i /></label>
      {error && <div className="inline-error"><Icon name="alert" />{error}</div>}
      {!run && <button className="button primary large" disabled={busy || !file || !automaticRule} onClick={start}>{busy ? `正在上传 ${Math.round(uploadProgress * 100)}%` : <><Icon name="play" />开始 AI 分析</>}</button>}
    </section>
    <aside className="surface analysis-card">
      <div className="page-section-title"><div><h2>分析进度</h2><p>{run ? `${run.id} · ${run.rule_code || "E1"} · ${run.analysis_mode === "two_stage" ? "双层判定" : "逐帧基线"}` : "提交后显示真实任务状态"}</p></div>{run && <StatusBadge value={run.status} />}</div>
      <div className="analysis-progress"><div className="progress-ring" style={{ "--progress": `${Math.round((run?.progress || 0) * 360)}deg` }}><strong>{Math.round((run?.progress || 0) * 100)}%</strong></div><div><strong>{run ? statusLabel(run.status) : "等待任务"}</strong><span>{run?.error_message || "上传视频后，Worker 将开始处理"}</span></div></div>
      <div className="steps">
        {stepLabels.map((label, index) => <div className={index < currentIndex ? "done" : index === currentIndex ? "active" : ""} key={label}><i>{index < currentIndex ? <Icon name="check" size={13} /> : index + 1}</i><span>{label}</span></div>)}
      </div>
      {run?.status === "awaiting_approval" && <div className="fallback-approval"><strong>逐帧回退已暂停</strong><p>{run.fallback_reason || run.error_message}</p><span>预计继续消耗约 {(run.estimated_fallback_tokens || 0).toLocaleString()} Token</span><button className="button secondary" disabled={busy} onClick={approveFallback}>{busy ? "正在提交…" : "确认改用逐帧分析"}</button></div>}
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
    <div className="table-head run-grid"><span>任务 / 视频</span><span>规则 / 模式</span><span>处理进度</span><span>调用/Token</span><span>状态</span><span>创建时间</span></div>
    {runs.length === 0 ? <div className="table-empty">暂无分析任务</div> : runs.map((run) => <div className="table-row run-grid" key={run.id}><div><strong>{run.id}</strong><span>{run.original_name}</span></div><span>{run.rule_code || "E1"} · {run.analysis_mode === "two_stage" ? "双层判定" : "逐帧基线"}</span><div className="mini-progress"><i style={{ width: `${run.progress * 100}%` }} /><span>{Math.round(run.progress * 100)}%</span></div><span>{run.request_count || 0} 次 / {((run.prompt_tokens || 0) + (run.completion_tokens || 0)).toLocaleString()}</span><StatusBadge value={run.status} /><time>{new Date(run.created_at).toLocaleString("zh-CN", { hour12: false })}</time></div>)}
  </section>;
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
    <button className="back-button" onClick={() => navigate("dashboard")}><Icon name="arrow" />返回监控大盘</button>
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
      <aside className="surface event-summary"><div className="section-header"><h2>AI 研判结果</h2><Confidence value={event.max_confidence} /></div><dl><div><dt>规则编码</dt><dd>{event.rule_code} {event.title}</dd></div><div><dt>分析模式</dt><dd>{event.analysis_mode === "two_stage" ? "双层判定" : "逐帧基线"}</dd></div><div><dt>首次发现</dt><dd>{formatDuration(event.first_seen_offset)}</dd></div><div><dt>确认异常</dt><dd>{formatDuration(event.confirmed_offset)}</dd></div><div><dt>已观察持续</dt><dd>{formatDuration(event.last_seen_offset - event.first_seen_offset)}</dd></div><div><dt>模型消耗</dt><dd>{event.request_count || 0} 次 / {((event.prompt_tokens || 0) + (event.completion_tokens || 0)).toLocaleString()} Token</dd></div><div><dt>恢复时间</dt><dd>{event.recovered_offset == null ? "尚未观察到恢复" : formatDuration(event.recovered_offset)}</dd></div></dl><div className="rule-note"><strong>判定策略</strong><p>{event.rule_code === "A1" ? "仅在操作区人员脸部或双手清晰可见时判断，最近5个有效观察中至少3次违规才确认；该规则为实验规则，默认不发送飞书告警。" : "冷藏设备门连续处于开启状态达到30秒，由后端时序规则确认；严重度与SLA不由模型自由生成。"}</p></div></aside>
    </div>
    <section className="surface rectification-summary"><div><h2>整改处理</h2><p>负责人与处理说明会写入事件时间线；AI 恢复状态不等于人工验收。</p></div><dl><div><dt>当前负责人</dt><dd>{event.assignee_name || "尚未指派"}</dd></div><div><dt>处理状态</dt><dd>{statusLabel(event.status)}</dd></div><div><dt>SLA 截止</dt><dd>{event.due_at ? new Date(event.due_at).toLocaleString("zh-CN", { hour12: false }) : "未设置"}</dd></div></dl></section>
    <section className="surface timeline-card"><div className="section-header"><h2>事件时间线</h2><span>{event.timeline.length} 条记录</span></div><div className="timeline">{event.timeline.map((item) => <div key={item.id}><i /><time>{new Date(item.created_at).toLocaleString("zh-CN", { hour12: false })}</time><div><strong>{item.note}</strong><span>{item.from_status ? `${statusLabel(item.from_status)} → ${statusLabel(item.to_status)}` : "系统记录"}</span></div></div>)}</div></section>
    {modal && <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setModal(null); }}><div className="action-dialog" role="dialog" aria-modal="true" aria-labelledby="action-dialog-title"><div className="dialog-title"><h2 id="action-dialog-title">{modal === "assign" ? "指派整改" : modal === "resolve" ? "提交整改结果" : "标记误报"}</h2><button type="button" aria-label="关闭弹窗" onClick={() => setModal(null)} disabled={saving}>×</button></div><div className="dialog-body">{modal === "assign" && <label>指派给<select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}><option value="">请选择负责人</option>{assignees.map((user) => <option key={user.id} value={user.id}>{user.display_name} · {user.role}</option>)}</select>{assignees.length === 1 && <small>当前仅有一个已初始化账号；门店负责人账号需在组织初始化中补齐。</small>}</label>}{modal === "resolve" && event.recovered_offset == null && <p className="dialog-warning">视频尚未观察到恢复，请在整改说明中写明人工复核依据；提交后仍保留原始 AI 证据。</p>}<label>{modal === "assign" ? "整改要求 / 备注" : modal === "resolve" ? "整改结果与复核依据" : "误报原因"}<textarea value={actionNote} onChange={(e) => setActionNote(e.target.value)} placeholder={modal === "assign" ? "请输入整改要求或备注说明…" : "请填写具体说明…"} rows={4} /></label>{actionError && <p className="dialog-error" role="alert">{actionError}</p>}</div><div className="dialog-footer"><button className="button secondary" type="button" onClick={() => setModal(null)} disabled={saving}>取消</button><button className="button primary" type="button" disabled={saving || !actionNote.trim() || (modal === "assign" && !assigneeId)} onClick={() => act(modal === "false_positive" ? "mark_false_positive" : modal, actionNote.trim(), modal === "assign" ? assigneeId : undefined)}>{saving ? "提交中…" : modal === "assign" ? "确认指派" : modal === "resolve" ? "确认已解决" : "确认标记"}</button></div></div></div>}
  </div>;
}

function CamerasPage({ bootstrap }) {
  return <section className="surface list-page"><div className="page-section-title"><div><h2>摄像头与视频源</h2><p>第一阶段为虚拟视频源，RTSP 接入将在后续阶段开放</p></div><span className="prototype-chip">{bootstrap?.cameras?.length || 0} 个来源</span></div><div className="camera-management-grid">{(bootstrap?.cameras || []).map((camera) => <article key={camera.id}><div className="camera-card-preview"><Icon name="camera" size={36} /><span>虚拟视频源</span></div><div><div><i /><StatusBadge value="completed" /></div><h3>{camera.name}</h3><p>{camera.code} · {camera.area_type}</p><span>{camera.source_type === "virtual" ? "上传/预置视频" : camera.source_type}</span></div></article>)}</div></section>;
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
  ["A2", "未戴工作帽/发网", "ROI + 多帧", "最近5帧命中3帧", "P1", "planned"],
  ["C1", "未穿围裙/工服", "ROI + 多帧", "最近5帧命中3帧", "P1", "planned"],
  ["A3", "操作台明显脏乱", "环境 + 多帧", "持续60秒", "P1", "planned"],
  ["A4", "地面积水/明显垃圾", "环境 + 多帧", "最近5帧命中3帧", "P1/P2", "planned"],
  ["B1", "明显烟雾/异常明火", "高危快速检测", "首帧预警、后续确认", "P0", "planned"],
  ["G1", "餐桌残留未清理", "逐桌 ROI + 时序", "清理时限待确认", "P2", "research"],
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
  return <div className="rules-layout"><section className="surface mode-config"><div className="page-section-title"><div><h2>分析模式</h2><p>逐帧基线与双层判定均可用于当前已实现规则，上传时可单独覆盖</p></div><span className="prototype-chip">默认：{config.default_analysis_mode === "two_stage" ? "双层判定" : "逐帧基线"}</span></div><div className="mode-profile-grid">{config.profiles.map((profile) => <button disabled={saving} className={config.default_analysis_mode === profile.id ? "selected" : ""} onClick={() => selectMode(profile.id)} key={profile.id}><div className="mode-profile-head"><strong>{profile.name}</strong><span>{config.default_analysis_mode === profile.id ? "当前默认" : "设为默认"}</span></div><p>{profile.description}</p><dl>{Object.entries(profile.config).map(([key,value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl></button>)}</div>{message && <div className="config-message">{message}</div>}</section><section className="surface list-page"><div className="page-section-title"><div><h2>规则能力</h2><p>已实现、待开发与实验候选分开展示；候选规则不会参与上传分析</p></div><span className="prototype-chip">1 条正式可运行 · 1 条实验可运行 · {rules.length - 2} 条候选</span></div><div className="table-head rule-grid"><span>规则</span><span>能力类型</span><span>确认策略</span><span>严重度</span><span>实现状态</span></div>{rules.map(([code,name,type,strategy,severity,status]) => <div className="table-row rule-grid" key={code}><div><strong>{code} · {name}</strong><span>{status === "ready" ? "正式可运行" : status === "experimental" ? "实验可运行 · 默认不通知" : status === "research" ? "实验候选 · 待验证" : "正式规划 · 尚未实现"}</span></div><span>{type}</span><span>{strategy}</span><SeverityBadge value={severity.split("/")[0]} /><span className={status === "ready" ? "ready" : status === "experimental" ? "experimental" : status === "research" ? "research" : "planned"}>{status === "ready" ? "已实现" : status === "experimental" ? "实验可用" : status === "research" ? "待验证" : "后续实现"}</span></div>)}</section></div>;
}

export default App;
