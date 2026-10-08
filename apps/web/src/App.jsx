import {configCall} from './RuleSamples';
import {mergeAnalysisTasks,taskOutcome,analysisRuleOptions,analysisTypeCounts} from './imageTaskRun';
import {ImageUploadPage, ImageTaskList, ImageTaskDetail} from './ImageUploadPage';
import AgentPage from "./AgentPage";
import PrototypeRules from './PrototypeRules';
import {RunActions} from "./RunActions";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, apiUrl } from "./api";
import { Icon } from "./icons";
import { formatDuration, percent, statusLabel, timelinePercent } from "./utils";
import { filterRectificationEvents, rectificationCsv } from "./rectification";
import { StoreOverviewPage, WorkOrderPage } from "./OverviewWorkorders";
import { cameraAreaNames, dashboardCameraIds, dashboardCameraSummary, demoCameraImages } from "./cameraMedia";
import { cameraPageState } from "./cameraPageState";
import { analysisModeLabel, analysisElapsedSeconds, runOutcome, screeningCandidateCount } from "./runResult";
import { filterAnalysisRuns } from "./runList";
import { runCostText } from "./runCost";
import { RunReport, reportMoney } from "./RunReport";
import { FeishuCardsPage } from "./FeishuCardsPage";
import { AutoUploadPage } from "./AutoUploadPage";
import { OperationsConfigPage } from "./OperationsConfigPage";
import { ruleCatalog, ruleValidationLabel, ruleFilterLabel } from "./ruleCatalog";
import { getDemoActorId, isShowcaseMode, setDemoActorId } from "./showcaseApi";
import { demoEntryState, demoReturnRoute } from "./demoEntry";

import {SopWorkspace} from "./SopWorkspace";

const navItems = [
  ["sop", "SOP 巡检", "sop"],
  ["sopTemplates", "SOP 模板配置", "sop"],
  ["stores", "门店总览", "home"],
  ["dashboard", "监控大盘", "dashboard"],
  ["upload", "素材上传", "upload"],
  ["runs", "分析任务", "video"],
  ["cameras", "摄像头管理", "camera"],
  ["rectification", "整改跟踪", "rectification"],
  ["workorder", "整改工单", "document"],
  ["cards", "飞书卡片", "card"],
  ["operations", "运营配置", "settings"],
  ["rules", "规则配置", "settings"],
  ["agent", "智能助手", "agent"],
  ["accounts", "账号权限", "store"]
];
const navGroups = [
  ["总览", ["stores", "dashboard"]],
  ["工具", ["upload", "runs", "cameras"]],
  ["运营", ["rectification", "workorder", "cards", "rules", "accounts"]],
  ["巡检", ["sop", "sopTemplates"]],
  ["助手", ["agent"]]
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
  const demoUser = isShowcaseMode ? bootstrap?.current_user : null;
  const canEdit = !isShowcaseMode || ["admin", "operator"].includes(demoUser?.role);
  const canAdmin = !isShowcaseMode || demoUser?.role === "admin";
  const switchDemoUser = (id) => {
    setDemoActorId(id);
    refreshBootstrap().catch(() => {});
    const target = demoReturnRoute(sessionStorage.getItem("store-vision-demo-next"));
    sessionStorage.removeItem("store-vision-demo-next");
    if (route.page === "login" || !route.page) window.location.hash = target;
  };
  const entryState = demoEntryState({ showcase: isShowcaseMode, actorId: isShowcaseMode ? getDemoActorId() : null, currentUser: demoUser, routePage: route.page, loading: !bootstrap && !bootstrapError });
  useEffect(() => {
    if (!isShowcaseMode || getDemoActorId() || route.page === "login") return;
    if (window.location.hash && window.location.hash !== "#/login") sessionStorage.setItem("store-vision-demo-next", window.location.hash);
    route.navigate("login");
  }, [route.page]);

  if (entryState === "login") return <DemoLogin onSelect={switchDemoUser} />;
  if (entryState === "loading") return <div className="demo-login-screen"><div className="demo-login-loading"><span className="spinner" />正在读取演示账号…</div></div>;

  return (
    <div className={`app-shell ${["sop","sopTask","sopTemplates"].includes(route.page)?"sop-shell":""}`}>
      <Sidebar route={route} store={bootstrap?.store} demoUser={demoUser} />
      <div className="main-shell">
        <TopHeader route={route} store={bootstrap?.store} serviceError={bootstrapError} demoUser={demoUser} />
        {isShowcaseMode && <div className="showcase-banner" role="status"><Icon name="alert" size={15} /><span>分析记录快照 · 普通操作保存到云端；视频上传、AI 解析和飞书发送暂未开放。账号免密码切换，仅用于产品体验，不是真实身份认证。</span></div>}
        <main className="page-shell" key={`${route.page}-${route.id || ""}`}>
          {["sop","sopTemplates","sopTask"].includes(route.page) && <SopWorkspace page={route.page} id={route.id} navigate={route.navigate} />}
          {route.page === "dashboard" && <Dashboard navigate={route.navigate} />}
          {route.page === "cameraDetail" && <CameraDetail id={route.id} navigate={route.navigate} />}
          {route.page === "stores" && <StoreOverviewPage bootstrap={bootstrap} navigate={route.navigate} />}
          {["upload","imageUpload"].includes(route.page) && <MaterialUploadPage bootstrap={bootstrap} navigate={route.navigate} initialCameraId={route.id} initialType={route.page==="imageUpload"?"image":"video"}/>}
          {route.page === "imageTask" && <ImageTaskDetail id={route.id} navigate={route.navigate} disabled={isShowcaseMode} />}
          {route.page === "runs" && <RunsPage navigate={route.navigate} />}
          {route.page === "run" && <RunDetail id={route.id} navigate={route.navigate} />}
          {route.page === "event" && <EventDetail id={route.id} navigate={route.navigate} canEdit={canEdit} />}
          {route.page === "cameras" && <CamerasPage bootstrap={bootstrap} loadError={bootstrapError} refresh={refreshBootstrap} canEdit={canEdit} canAdmin={canAdmin} />}
          {route.page === "rectification" && <RectificationPage navigate={route.navigate} />}
          {route.page === "workorder" && <WorkOrderPage navigate={route.navigate} readOnly={!canEdit} />}
          {route.page === "cards" && <FeishuCardsPage navigate={route.navigate} initialEventId={route.id} />}
          {route.page === "operations" && (isShowcaseMode ? <ShowcaseUnavailable title="门店运营配置" /> : <OperationsConfigPage initialCameraId={route.id} />)}
          {route.page === "rules" && <PrototypeRules canAdmin={canAdmin} disabled={isShowcaseMode} onNavigate={route.navigate} />}
          {route.page === "agent" && <AgentPage onNavigate={route.navigate} disabled={isShowcaseMode} />}
          {route.page === "accounts" && (isShowcaseMode ? <DemoAccounts currentUser={demoUser} onSelect={switchDemoUser} /> : <ShowcaseUnavailable title="账号权限" />)}
        </main>
      </div>
    </div>
  );
}

export function Sidebar({ route, store, demoUser }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">AI</div>
        <div><strong>视觉巡检系统</strong><span>Store Visual Inspection</span></div>
      </div>
      <button className="store-switch" onClick={() => route.navigate("stores")}><i /> <span>{route.page === "stores" ? "全部门店" : store?.name || "MOMOYO JTU"}</span><Icon name="arrow" size={14} /></button>
      <nav>{navGroups.map(([group, keys]) => <div className="sidebar-nav-group" key={group}>
        <span className="sidebar-nav-label">{group}</span>
        {keys.filter((key) => key !== "accounts" || isShowcaseMode).map((key) => {
          const [, label, icon] = navItems.find((item) => item[0] === key);
          return <button key={key} className={route.page === key || (route.page === "imageUpload" && key === "upload") || (route.page === "sopTask" && key === "sop") || (route.page === "cameraDetail" && key === "dashboard") || (route.page === "event" && key === "rectification") || (["run","imageTask"].includes(route.page) && key === "runs") ? "active" : ""} onClick={() => route.navigate(key)}><Icon name={icon} /><span>{label}</span></button>;
        })}
      </div>)}</nav>
      <div className="sidebar-user">
        <div className="avatar">巡</div>
        <div><strong>{isShowcaseMode ? demoUser?.display_name || "选择演示账号" : "总部巡检管理员"}</strong><span>{isShowcaseMode ? (demoUser?.role === "admin" ? "管理员" : demoUser?.role === "operator" ? "巡检员" : demoUser?.role === "viewer" ? "查看者" : "免密码切换") : "系统管理员"}</span></div>
        {isShowcaseMode && <button type="button" className="sidebar-switch-account" onClick={() => route.navigate("login")}>切换</button>}
      </div>
    </aside>
  );
}

function TopHeader({ route, store, serviceError, demoUser }) {
  const titles = {
    sop: ["SOP 巡检", "主动巡检模板与任务管理"],
    sopTemplates: ["SOP 模板配置", "配置检查项与 AI 核验规则"],
    sopTask: ["巡检任务详情", "SOP 检查项逐项核验结果"],
    operations: ["门店运营配置", "按门店和机位查看餐桌布局与标定截图"],
    dashboard: ["门店视觉巡检 · 监控大盘", "查看演示视频源与实际分析事件"],
    cameraDetail: ["MOMOYO JTU · 摄像头详情", "演示静帧与该来源的真实分析记录"],
    stores: ["门店视觉巡检 · 门店总览", "查看已接入门店的巡检结果"],
    upload: ["素材上传", "上传视频或图片，进行 AI 巡检核验"],
    imageUpload: ["素材上传", "上传视频或图片，进行 AI 巡检核验"],
    imageTask: ["图片识别详情", "查看逐项核验结果与图片证据"],
    runs: ["分析任务", "查看视频分析与图片识别任务"],
    run: ["分析结果", "查看任务结论、耗时和模型消耗"],
    event: ["事件详情", "查看异常证据、状态与整改记录"],
    cameras: ["MOMOYO JTU · 摄像头管理", "管理门店所有监控摄像头"],
    rectification: ["整改跟踪", "统一跟踪待确认与整改事件"],
    workorder: ["整改工单", "人工指派、处理与留痕"],
    cards: ["MOMOYO JTU · 飞书卡片预览", isShowcaseMode ? "仅预览卡片模板 · 不连接飞书" : "告警卡片预览与测试群调试"],
    rules: ["规则配置", "查看上传视频结果、事件等级和实时接入状态"],
    accounts: ["账号与权限", "免密码演示账号与角色权限"]
  };
  const title = titles[route.page] || titles.dashboard;
  return (
    <header className="top-header">
      <div><h1>{title[0]}</h1><p>{title[1]}</p></div>
      <div className="header-actions">
        <button className="icon-button"><Icon name="bell" /><span className="notice-dot" /></button>
        <div className={`ai-status ${serviceError ? "disconnected" : ""}`}><span /> {serviceError ? "演示数据加载异常" : isShowcaseMode ? `${demoUser?.display_name || "未选择账号"} · 非实时` : "AI 上传分析就绪"}</div>
        <button className="current-store"><i />{store?.name || "MOMOYO JTU"}<Icon name="arrow" size={13} /></button>
      </div>
    </header>
  );
}

const demoRoleNames = { admin: "管理员", operator: "巡检员", viewer: "查看者" };
const demoRoleScope = { admin: "事件处理、摄像头配置、规则设置、账号管理", operator: "事件处理、视频源启停", viewer: "查看数据与证据" };

function DemoLogin({ onSelect }) {
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState("");
  const [showOthers, setShowOthers] = useState(false);
  useEffect(() => { api.demoState().then((state) => setAccounts(state.accounts.filter((account) => account.active))).catch((err) => setError(err.message)); }, []);
  const admin = accounts?.find((account) => account.role === "admin");
  const others = accounts?.filter((account) => account.id !== admin?.id) || [];
  const accountButton = (account) => <button type="button" className="demo-login-person" key={account.id} onClick={() => onSelect(account.id)}><span className="demo-login-avatar">{account.display_name.slice(0, 1)}</span><span className="demo-login-person-copy"><strong>{account.display_name}</strong><small>{demoRoleNames[account.role]} · {demoRoleScope[account.role]}</small></span><b>进入 →</b></button>;
  return <div className="demo-login-screen"><div className="demo-login-panel"><section className="demo-login-brand"><div className="demo-login-brandmark"><span>AI</span><strong>门店视觉巡检</strong></div><div className="demo-login-brand-content"><h1>门店视觉巡检<br />控制台</h1><p>统一查看合成样本的分析结果、异常事件与整改进度，体验总部巡检的管理流程。</p><div className="demo-login-brand-lines"><span>监控大盘 → 事件证据与规则</span><span>整改跟踪 → 人工确认与留痕</span><span>账号权限 → 演示角色切换</span></div></div></section><section className="demo-login-chooser"><h2>选择人物进入</h2><p>这是演示环境，点击下方账号即可进入巡店后台。</p>{error && <div className="dialog-error" role="alert">{error}<button type="button" onClick={() => window.location.reload()}>重试</button></div>}{!accounts && !error && <div className="demo-login-fetching"><span className="spinner" />正在读取演示账号…</div>}{admin && accountButton(admin)}{others.length > 0 && <><button type="button" className="demo-login-other-toggle" onClick={() => setShowOthers(!showOthers)} aria-expanded={showOthers}>{showOthers ? "收起其他演示角色" : "巡检员 / 查看者登录"}</button>{showOthers && <div className="demo-login-other-list">{others.map(accountButton)}</div>}</>}<div className="demo-login-disclaimer">此入口仅展示角色权限。免密码选择不是真实身份认证，公开访客均可进入演示账号。</div></section></div></div>;
}

function DemoAccounts({ currentUser, onSelect }) {
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState({ username: "", display_name: "", role: "viewer" });
  const reload = () => api.demoState().then((state) => setAccounts(state.accounts)).catch((err) => setError(err.message));
  useEffect(() => { reload(); }, []);
  const change = async (id, update) => { setError(""); setMessage(""); try { await api.updateDemoAccount(id, update); await reload(); setMessage("账号设置已保存"); } catch (err) { setError(err.message); } };
  const create = async (event) => { event.preventDefault(); setError(""); setMessage(""); try { await api.createDemoAccount(draft); setDraft({ username: "", display_name: "", role: "viewer" }); await reload(); setMessage("演示账号已添加"); } catch (err) { setError(err.message); } };
  return <div className="demo-accounts-page"><section className="surface demo-account-intro"><h2>账号与权限</h2><p>选择账号即可切换身份，无需密码。管理员可管理账号和规则；巡检员可处理事件与启停演示视频源；查看者只能浏览。所有修改保存到同一个云端演示数据集。</p><p className="dialog-warning">公开链接的任何访客都可以选择管理员，因此这只是产品演示，不适合真实门店数据或正式授权。</p></section><section className="surface demo-account-table"><div className="section-header"><h2>演示账号</h2><span>{accounts.length} 个</span></div>{accounts.map((account) => <div className="demo-account-row" key={account.id}><div><strong>{account.display_name}</strong><small>{account.username} · {account.active ? "已启用" : "已停用"}</small></div><select aria-label={`${account.display_name}角色`} value={account.role} disabled={currentUser?.role !== "admin"} onChange={(event) => change(account.id, { role: event.target.value })}>{Object.entries(demoRoleNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="button secondary" disabled={currentUser?.role !== "admin" || account.id === currentUser?.id} onClick={() => change(account.id, { active: !account.active })}>{account.active ? "停用" : "启用"}</button><button className="button primary" disabled={!account.active} onClick={() => onSelect(account.id)}>{account.id === currentUser?.id ? "当前账号" : "切换登录"}</button></div>)}{error && <p className="dialog-error" role="alert">{error}</p>}{message && <p className="config-message" role="status">{message}</p>}</section>{currentUser?.role === "admin" && <form className="surface demo-add-account" onSubmit={create}><h2>添加演示账号</h2><div><label>账号名<input required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_-]+" value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} placeholder="例如 manager02" /></label><label>显示名称<input required maxLength={30} value={draft.display_name} onChange={(event) => setDraft({ ...draft, display_name: event.target.value })} placeholder="例如 门店经理" /></label><label>角色<select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })}>{Object.entries(demoRoleNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="button primary" type="submit">添加账号</button></div></form>}</div>;
}

function LoadingCard({ text = "正在加载数据…" }) {
  return <div className="surface centered-state"><span className="spinner" />{text}</div>;
}

function ErrorCard({ message, retry }) {
  return <div className="surface centered-state error-state"><Icon name="alert" /><strong>暂时无法加载</strong><span>{message}</span>{retry && <button className="button secondary" onClick={retry}>重新加载</button>}</div>;
}

function ShowcaseUnavailable({ title }) {
  return <section className="surface centered-state showcase-unavailable"><Icon name="video" size={30} /><h2>{title}暂未在云端演示版开放</h2><p>历史合成样本可浏览，普通管理操作可保存；真实视频解析请在本地巡店系统完成。</p></section>;
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
  const { visible: shownCameras, enabled: shownEnabled, total: shownTotal } = dashboardCameraSummary(data.camera_sources);
  return (
    <div className="dashboard-grid">
      <section className="metrics-grid full-span">
        <Metric label={isShowcaseMode ? "快照当日异常" : "今日异常总数"} value={metrics.today_events} suffix="条" tone="danger" icon="alert" detail={isShowcaseMode ? "以快照日期为准，非实时统计" : "今日生成且未判误报"} />
        <Metric label="待处理事件" value={metrics.pending_events} suffix="件" tone="blue" icon="clock" detail="等待确认或整改" />
        <Metric label="大屏已启用视频源" value={`${shownEnabled}/${shownTotal}`} tone="green" icon="camera" detail="仅统计下方四路演示画面" />
        <Metric label="已完成分析" value={metrics.completed_runs} suffix="次" tone="purple" icon="check" detail="可追溯任务" />
      </section>
      <section className="surface monitor-section">
        <div className="section-header"><div><h2>监控大屏</h2><span className="small-tag">演示静帧 · {shownEnabled}/{shownTotal} 路已启用</span></div><div><button className="button secondary" disabled={isShowcaseMode} title={isShowcaseMode ? "静态展示版不支持上传" : ""} onClick={() => navigate("upload")}><Icon name="upload" />上传视频</button><button className="button secondary" onClick={() => navigate("cameras")}><Icon name="camera" />摄像头管理</button></div></div>
        <div className="camera-grid">
          {shownCameras.map((camera) => <CameraTile key={camera.id} camera={camera} onClick={() => navigate("cameraDetail", camera.id)} />)}
        </div>
        <p className="demo-media-note">画面为已上传视频的静态截图或演示封面，不代表实时监控。</p>
      </section>
      <section className="surface event-panel">
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
    <img src={camera.preview_image_url || demoCameraImages[camera.area_type]} alt={`${camera.name}的静态画面`} />
    <div className="camera-overlay"><div><i className={available ? "online" : "offline-dot"} /><strong>{camera.name}</strong><span>· {cameraAreaNames[camera.area_type] || camera.area_type}</span></div><b className="demo-tag">DEMO</b></div>
    {!available && <div className="camera-offline-label"><Icon name="camera" size={28} /><strong>视频源已停用</strong></div>}
    <span className="camera-frame-note">视频静帧 · 非直播</span>
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
        <div className={`camera-detail-image ${camera.status !== "online" ? "offline" : ""}`}><img src={camera.preview_image_url || demoCameraImages[camera.area_type]} alt={`${camera.name}的静态画面`} /><span className="camera-detail-location">{area}</span><span className="camera-detail-image-note">合成演示静帧 · 未接入实时视频流</span></div>
      </section>
      <aside className="camera-detail-side">
        <section className="surface camera-detail-info"><h3>设备信息</h3><dl><div><dt>视频源编号</dt><dd>{camera.id}</dd></div><div><dt>视频源名称</dt><dd>{camera.name}</dd></div><div><dt>关联位置</dt><dd>{area}</dd></div><div><dt>来源类型</dt><dd>{camera.source_type === "virtual" ? "虚拟视频源" : camera.source_type}</dd></div><div><dt>设备型号 / IP</dt><dd>未接入</dd></div><div><dt>分辨率 / 心跳</dt><dd>未接入</dd></div></dl></section>
        <section className="surface camera-detail-stats"><h3>{period}异常统计</h3><div><span><strong>{counts.total}</strong>总数</span><span><strong>{counts.p0}</strong>P0</span><span><strong>{counts.p1}</strong>P1</span></div><p>P2 {counts.p2} 条 · 误报及忽略不计入统计</p></section>
      </aside>
    </div>
    {!isShowcaseMode && <section className="surface camera-detail-info"><div className="camera-detail-card-head"><div><h2>门店运营配置</h2><p>餐桌布局按门店和机位维护。</p></div><button className="button secondary" onClick={() => navigate("operations",camera.id)}>查看餐桌配置</button></div></section>}
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

function StatusBadge({ value }) { return <span className={`status-badge status-${value}`}>{statusLabel(value)}</span>; }

export function MaterialUploadPage({bootstrap,navigate,initialCameraId,initialType="video"}) {
 const [type,setType]=useState(initialType);
 return <><div className="analysis-type-tabs" role="group" aria-label="上传类型">{[["video","视频上传","video"],["image","图片上传","image"]].map(([value,label,icon])=><button type="button" className={`button ${type===value?"primary":"secondary"}`} key={value} aria-pressed={type===value} onClick={()=>setType(value)}><Icon name={icon}/>{label}</button>)}</div>{type==="image"?<ImageUploadPage bootstrap={bootstrap} navigate={navigate} disabled={isShowcaseMode}/>:isShowcaseMode?<ShowcaseUnavailable title="视频上传与分析"/>:<AutoUploadPage bootstrap={bootstrap} navigate={navigate} initialCameraId={initialCameraId}/>}</>;
}
function RunsPage({navigate}) { return <VideoRunsPage navigate={navigate}/>; }
function VideoRunsPage({ navigate }) {
  const [type,setType]=useState("all");
  const [runs, setRuns] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("all");
  const [rule, setRule] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [period, setPeriod] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const load = () => Promise.all([api.runs(),configCall('/tasks'),configCall('/configs')]).then(([videos,images,configs]) => { setRuns(mergeAnalysisTasks(videos,images,configs)); setError(""); }).catch((err) => setError(err.message));
  useEffect(() => { load(); if (isShowcaseMode) return undefined; const timer = setInterval(load, 3000); return () => clearInterval(timer); }, []);
  const filtered = useMemo(() => filterAnalysisRuns((runs||[]).filter(t=>type==='all'||t.media_type===type), { status, rule, outcome, period, query }), [runs, type, status, rule, outcome, period, query]);
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const change = (setter, value) => { setter(value); setPage(1); };
  if (error) return <ErrorCard message={error} retry={load} />;
  if (!runs) return <LoadingCard />;
  const scopedRuns=runs.filter(t=>type==='all'||t.media_type===type);
  const tabs = [
    ["all", "全部", scopedRuns.length],
    ["completed", "已完成", scopedRuns.filter((run) => run.status === "completed").length],
    ["active", "进行中", scopedRuns.filter((run) => ["queued", "running"].includes(run.status)).length],
    ["awaiting_approval", "待确认回退", scopedRuns.filter((run) => run.status === "awaiting_approval").length],
    ["failed", "分析失败", scopedRuns.filter((run) => run.status === "failed").length],
  ];
  const ruleOptions=analysisRuleOptions(runs);
  const typeCounts=analysisTypeCounts(runs);
  return <section className="list-page runs-page prototype-analysis-page">
    <div className="page-section-title"><div><h2>分析任务</h2><p>点击任务查看结论、证据、耗时与模型消耗；无事件任务也保留分析结果</p></div><button className="button primary" disabled={isShowcaseMode} title={isShowcaseMode ? "静态展示版不支持上传" : ""} onClick={() => navigate(type==='image'?"imageUpload":"upload")}><Icon name="upload" />上传素材</button></div>
    <div className="analysis-type-tabs" role="tablist" aria-label="分析类型">{[["all","全部任务"],["video","视频任务"],["image","图片任务"]].map(([value,label])=><button type="button" role="tab" aria-selected={type===value} key={value} className={type===value?"active":""} onClick={()=>{setType(value);setPage(1);}}>{value!=="all"&&<Icon name={value} size={14}/>} {label}<b>{typeCounts[value]}</b></button>)}</div>
    <div className="filter-tabs" role="tablist" aria-label="任务状态">{tabs.map(([value, label, count]) => <button type="button" role="tab" aria-selected={status === value} className={status === value ? "active" : ""} key={value} onClick={() => change(setStatus, value)}>{label} <b>{count}</b></button>)}</div>
    <div className="rectification-filters runs-filters">
      <div className="runs-rule-filter" role="group" aria-label="检测规则"><span>检测规则</span>{ruleOptions.map((value) => <button type="button" aria-pressed={rule === value} className={rule === value ? "active" : ""} key={value} onClick={() => change(setRule, value)}>{ruleFilterLabel(value)}</button>)}</div>
      <div><span>分析结论：</span>{[["all", "全部"], ["event", "有事件"], ["zero", "零事件"], ["pass", "通过"], ["fail", "不通过"], ["review", "人工核查"], ["need_photo", "待补拍"]].map(([value, label]) => <button type="button" aria-pressed={outcome === value} className={outcome === value ? "active" : ""} key={value} onClick={() => change(setOutcome, value)}>{label}</button>)}</div>
      <div><span>时间范围：</span>{[["today", "今天"], ["week", "近 7 天"], ["month", "近 30 天"], ["all", "全部"]].map(([value, label]) => <button type="button" aria-pressed={period === value} className={period === value ? "active" : ""} key={value} onClick={() => change(setPeriod, value)}>{label}</button>)}</div>
      <label className="runs-search"><span>搜索：</span><input value={query} onChange={(event) => change(setQuery, event.target.value)} placeholder="任务 ID / 素材名称 / 门店…" aria-label="搜索分析任务" /></label>
    </div>
    <div className="runs-table"><div className="table-head run-grid"><span>任务 / 素材 / 模型成本估算</span><span>规则 / 类型</span><span>处理进度</span><span>分析结论 / 状态</span><span>数量 / 调用 / 时间</span></div>
      {visible.length ? visible.map((run) => <button type="button" className="table-row run-grid run-row" key={run.id} onClick={() => navigate(run.media_type==='image'?"imageTask":"run", run.id)} aria-label={`查看任务 ${run.id} 的分析结果`}><div><strong><i className={`task-media-label ${run.media_type}`}>{run.media_type==='image'?'图片':'视频'}</i>{run.id}</strong><span title={run.original_name}>{run.original_name}</span>{run.media_type==='image'?<small className="run-cost">门店：{run.store}</small>:<small className="run-cost">模型成本：{runCostText(run)}</small>}</div><div className="task-rule-cell"><span>{ruleFilterLabel(run.rule_code||"E1")}</span><small>{run.media_type==='image'?'图片核验':analysisModeLabel(run)}</small></div><div className="run-progress"><div className="run-progress-track"><i style={{ width: `${Math.max(0, Math.min(100, Math.round((run.progress || 0) * 100)))}%` }} /></div><span>{Math.round((run.progress || 0) * 100)}%</span></div><div className="run-outcome-cell"><span className={`run-outcome ${taskOutcome(run).tone}`}>{taskOutcome(run).label}</span><StatusBadge value={run.status} /></div><div className="run-usage"><span>{run.media_type==='image'?`${new Set(Object.values(run.photos||{})).size} 张图片`:analysisElapsedSeconds(run)==null?"耗时未记录":formatDuration(analysisElapsedSeconds(run))}</span><small>{run.fallback_approved && run.active_seconds == null ? "含历史排队/等待 · " : ""}{run.request_count || 0} 次 / {((run.prompt_tokens || 0) + (run.completion_tokens || 0)).toLocaleString()} Token</small><time title={run.media_type==='image'&&!run.original_created_at?'创建时间未记录，显示分析完成时间':'创建时间'}>{run.created_at?new Date(run.created_at).toLocaleString("zh-CN", { hour12: false }):"时间未记录"}</time></div></button>) : <div className="table-empty">{runs.length ? "当前条件下没有分析任务，请调整筛选条件。" : "暂无分析任务。上传视频后，可在此查看包括零事件在内的分析结论。"}</div>}
    </div>
    <div className="rectification-pager runs-pager"><span>共 {filtered.length} 条记录 · 第 {currentPage}/{pageCount} 页{runs.length === 100 ? " · 当前仅加载最近 100 条任务" : ""}</span><div><button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>上一页</button>{Array.from({ length: pageCount }, (_, index) => <button type="button" className={currentPage === index + 1 ? "active" : ""} key={index} onClick={() => setPage(index + 1)}>{index + 1}</button>)}<button type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>下一页</button></div></div>
  </section>;
}

function RunDetail({ id, navigate }) {
  const [run, setRun] = useState(null);
  const [error, setError] = useState("");
  const load = () => api.run(id).then(setRun).catch((err) => setError(err.message));
  useEffect(() => { load(); }, [id]);
  useEffect(()=>{if(!run || ["completed","failed","awaiting_approval","cancelled"].includes(run.status))return;const timer=setInterval(load,2500);return ()=>clearInterval(timer);},[id,run?.status]);
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
      <RunActions run={run} onUpdate={setRun}/>
      {run.status === "completed" && <p className="run-result-explain">{run.rule_code === "B1" && Number(run.event_count || 0) === 0 ? "B1 仅判断烟雾或异常明火。此次没有形成 B1 事件；不能据此证明视频中不存在其他类型风险。" : "事件数来自后端规则聚合，不是模型单次文字描述。"}</p>}
      {run.status === "failed" && <p className="run-result-explain">失败任务没有形成有效的最终判定，请查看错误原因并重新分析。</p>}
    </section>
    {run.cleaning_check && <section className="surface run-facts-card"><div className="section-header"><h2>拖地检查</h2></div><p style={{padding:"0 20px"}}><strong>{ {observed_mopping:"通过：已观察到拖地",not_observed_review:"待核查：未观察到拖地",insufficient_evidence:"证据不足"}[run.cleaning_check.verdict]}</strong></p><p style={{padding:"0 20px"}}>{run.cleaning_check.explanation}</p><div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12,padding:20}}>{JSON.parse(run.cleaning_check.evidence_json || "[]").map(e=><div key={e.finding_id}><a href={apiUrl(e.image_url || `/api/media/findings/${e.finding_id}`)} target="_blank" rel="noreferrer"><img style={{width:"100%"}} src={apiUrl(e.image_url || `/api/media/findings/${e.finding_id}`)} alt={`拖地观察 ${e.offset} 秒`} /></a><p>{e.offset} 秒 · {e.state === "mopping" ? "观察到拖地" : "待核查"}</p></div>)}</div></section>}
    <RunReport run={run} />
    <section className="surface run-facts-card"><div className="section-header"><h2>分析记录</h2></div><dl className="run-facts-grid">
      <div><dt>规则与模式</dt><dd>{run.rule_code} · {analysisModeLabel(run)}</dd></div>
      <div><dt>原视频时长</dt><dd>{formatDuration(run.duration_seconds)}</dd></div>
      <div><dt>粗筛候选片段</dt><dd>{run.analysis_mode !== "two_stage" ? "不适用" : candidateCount == null ? "未记录" : `${candidateCount} 段`}</dd></div>
      <div><dt>确认事件</dt><dd>{run.status === "completed" ? `${run.event_count || 0} 条` : "尚未完成"}</dd></div>
      <div><dt>{isShowcaseMode ? "历史飞书告警设置" : "本次飞书告警"}</dt><dd>{run.notifications_enabled ? "已启用（仅符合通知规则时发送）" : "关闭"}</dd></div>
      <div><dt>开始分析</dt><dd>{stamp(run.started_at)}</dd></div>
      <div><dt>分析完成</dt><dd>{stamp(run.completed_at)}</dd></div>
      <div><dt>实际分析耗时</dt><dd>{elapsed == null ? "—" : formatDuration(elapsed)}{run.fallback_approved && run.active_seconds == null ? "（历史总历时，含排队及确认等待）" : ""}</dd></div>
      <div><dt>上传至完成</dt><dd>{run.completed_at ? formatDuration((Date.parse(run.completed_at) - Date.parse(run.created_at)) / 1000) : "—"}</dd></div>
      <div><dt>模型请求 / Token</dt><dd>{run.request_count || 0} 次 / {((run.prompt_tokens || 0) + (run.completion_tokens || 0)).toLocaleString()}</dd></div>
      <div><dt>本条规则分析费用</dt><dd>{runCostText(run)}</dd></div>
      {run.report && <><div><dt>本条规则 + 区域识别</dt><dd>{reportMoney(run.report.costs.rule_with_scene_yuan)}</dd></div><div><dt>该视频全部 {run.report.costs.video_task_count} 条任务合计</dt><dd>{reportMoney(run.report.costs.video_total_yuan)}{!run.report.costs.video_complete && '（仍在分析）'}</dd><small>区域识别只计一次；含回退调用</small></div></>}
      <div><dt>阶段消耗</dt><dd>{run.usage_phases?.length ? run.usage_phases.map((phase,i) => <p key={i}>{({screening:"视频粗筛",refining:"关键帧复核",analyzing:"逐帧分析",fallback:"逐帧回退"})[phase.phase] || phase.phase}：{phase.request_count} 次 / {(phase.prompt_tokens+phase.completion_tokens).toLocaleString()} Token / {runCostText(phase)}</p>) : "历史阶段记录未保存；总费用包含已记录的全部调用"}</dd></div>
      {run.scene_detection_usage && <div><dt>前置区域识别（本视频共享）</dt><dd>{((run.scene_detection_usage.prompt_tokens || 0)+(run.scene_detection_usage.completion_tokens || 0)).toLocaleString()} Token / {runCostText(run.scene_detection_usage)}</dd></div>}
      <div><dt>计价模型</dt><dd>{run.cost_model_id || "历史任务未留档"}</dd></div>
    </dl><p className="run-cost-disclaimer">按<a href="https://docs.volcengine.com/docs/ark/model-pricing?lang=zh" target="_blank" rel="noreferrer">火山方舟常规在线推理公开价</a>和本次记录的输入/输出 Token 估算；模型未留档时显示 Lite–Pro 价格区间。未扣除缓存、免费额度或折扣，不含视频生成、存储和人工费用；实际账单以服务商为准。</p></section>
    {run.events?.length > 0 && <section className="surface run-events-card"><div className="section-header"><h2>产生的事件</h2><span>{run.events.length} 条</span></div><div>{run.events.map((event) => <button type="button" className="run-event-link" key={event.id} onClick={() => navigate("event", event.id)}><SeverityBadge value={event.severity} /><strong>{event.title}</strong><span>{event.id}</span><StatusBadge value={event.status} /><Icon name="arrow" size={14} /></button>)}</div></section>}
  </div>;
}

export function EventDetail({ id, navigate, canEdit }) {
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
  const evidenceLabels = {before:"离席前在座", start:event.rule_code === "G2" ? "初始观察" : "首次发现", confirmed:["A1", "G2", "M1"].includes(event.rule_code) ? "待核查线索" : "确认异常", peak:"最高置信度", recovered:"恢复正常", followup_1:"离席后复核 1", followup_2:"离席后复核 2", followup_3:"离席后复核 3", video_end:"视频后段复核"};
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
    <section className="surface detail-header"><div><div className="badge-line"><SeverityBadge value={event.severity} /><StatusBadge value={event.status} /></div><h2>{event.title}</h2><p>{event.store_name} · {event.camera_name} · {event.id}</p></div><div className="detail-actions">{!isShowcaseMode && ["A1", "G2", "M1"].includes(event.rule_code) && <button className="button secondary" onClick={() => navigate("cards", event.id)}>飞书测试提醒</button>}{!canEdit ? <span className="small-tag">查看者权限 · 不可更改状态</span> : <>{event.status === "pending_confirmation" && <><button className="button secondary" disabled={saving} onClick={() => openModal("false_positive")}>标记误报</button><button className="button secondary" disabled={saving} onClick={() => openModal("assign")}>指派整改</button><button className="button primary" disabled={saving} onClick={() => act("acknowledge")}><Icon name="check" />确认事件</button></>}{event.status === "acknowledged" && <><button className="button secondary" disabled={saving} onClick={() => openModal("assign")}>{event.assignee_id ? "更换负责人" : "指派整改"}</button><button className="button primary" disabled={saving || !event.assignee_id} title={!event.assignee_id ? "请先指派负责人" : ""} onClick={() => act("start_rectification")}>开始整改</button></>}{event.status === "rectifying" && <><button className="button secondary" disabled={saving} onClick={() => openModal("assign")}>更换负责人</button><button className="button primary" disabled={saving} onClick={() => openModal("resolve")}>提交整改结果</button></>}</>}</div></section>
    {actionError && <div className="detail-action-error" role="alert">{actionError}</div>}
    <div className="detail-columns">
      <section className="surface evidence-card">
        <div className="section-header"><div><h2>事件证据</h2><p className="section-subtitle">{isShowcaseMode ? "公开快照仅提供既有证据帧，不包含原始视频" : "点击证据或时间轴标记，跳转到原视频对应时刻"}</p></div><span>{`当前 ${formatDuration(videoTime)}`}</span></div>
        {selected ? <>
          <div className="evidence-video">
            {isShowcaseMode || videoFailed ? <img src={api.evidenceUrl(selected.id)} alt="事件证据帧" /> : <video ref={videoRef} src={api.eventVideoUrl(event.id)} poster={api.evidenceUrl(selected.id)} controls preload="metadata" onLoadedMetadata={(media) => setVideoDuration(media.currentTarget.duration)} onTimeUpdate={(media) => setVideoTime(media.currentTarget.currentTime)} onError={() => setVideoFailed(true)} />}
            <div className="video-evidence-caption"><span>{isShowcaseMode ? "视频证据静帧 · 原视频未公开" : videoFailed ? "原视频暂不可播放 · 当前显示证据帧" : event.video_original_name}</span><time>{formatDuration(videoTime)}</time></div>
          </div>
          <div className="incident-scrubber" aria-label="原视频异常时间轴">
            <div className="scrubber-summary"><strong>异常关注区间</strong><span>{formatDuration(event.first_seen_offset)} – {formatDuration(anomalyEnd)}{event.rule_code === "G2" && event.evidence.some(item => item.evidence_type.startsWith("followup_") || item.evidence_type === "video_end") ? ` · 后续复核至 ${formatDuration(Math.max(...event.evidence.map(item => item.captured_offset)))}` : ""}</span></div>
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
      <aside className="surface event-summary"><div className="section-header"><h2>AI 研判结果</h2><Confidence value={event.max_confidence} /></div><dl><div><dt>规则编码</dt><dd>{event.rule_code} {event.title}</dd></div><div><dt>分析模式</dt><dd>{analysisModeLabel(event)}</dd></div><div><dt>首次发现</dt><dd>{formatDuration(event.first_seen_offset)}</dd></div><div><dt>{["A1", "G2", "M1"].includes(event.rule_code) ? "形成待核查线索" : "确认异常"}</dt><dd>{formatDuration(event.confirmed_offset)}</dd></div><div><dt>已观察持续</dt><dd>{formatDuration(event.last_seen_offset - event.first_seen_offset)}</dd></div><div><dt>模型消耗</dt><dd>{event.request_count || 0} 次 / {((event.prompt_tokens || 0) + (event.completion_tokens || 0)).toLocaleString()} Token</dd></div><div><dt>恢复时间</dt><dd>{event.recovered_offset == null ? "尚未观察到恢复" : formatDuration(event.recovered_offset)}</dd></div></dl><div className="rule-note"><strong>判定策略</strong><p>{{ A1: "仅在操作区人员脸部或双手清晰可见时判断，最近5个有效观察中至少3次命中形成待核查线索；可在飞书卡片页手动发送测试提醒，不自动告警。", A2: "操作区员工头部可见时判断，最近5个有效帧至少3次缺少工作帽/发网；试运行，不发送告警。", C1: "操作区员工躯干可见时判断，最近5个有效帧至少3次缺少围裙/工服；试运行，不发送告警。", A3: "操作台明显脏乱连续可见至少60秒；正常制作摆放不计。试运行，不发送告警。", A4: "地面明确积水或垃圾最近5个有效帧至少3次命中；反光和清洁中不计。试运行，不发送告警。", B1: "视频粗筛疑似烟雾/明火后复核关键帧；至少持续2秒才形成实验观察，正常蒸汽不触发。仅供人工复核，不发送P0告警。", M1: "09:10–09:30观察到拖地可记录通过；完整已结束窗口未见动作时才形成待核查提醒。短片未见动作不告警。", G2: "先观察同桌有人在座，再连续3帧看到离席后疑似遗留物品；仅为待核查线索，不认定垃圾或清洁超时。可在飞书卡片页手动发送测试提醒。", G1: "单桌 ROI 内先确认顾客离席及桌面残留，再由后端按视频时间戳累计至少120秒；50秒样本不得触发。实验规则，不发送飞书告警。", E1: "冷藏设备门连续处于开启状态达到30秒，由后端时序规则确认；严重度与SLA不由模型自由生成。" }[event.rule_code]}</p></div></aside>
    </div>
    <section className="surface rectification-summary"><div><h2>整改处理</h2><p>负责人与处理说明会写入事件时间线；AI 恢复状态不等于人工验收。</p></div><dl><div><dt>当前负责人</dt><dd>{event.assignee_name || "尚未指派"}</dd></div><div><dt>处理状态</dt><dd>{statusLabel(event.status)}</dd></div><div><dt>SLA 截止</dt><dd>{event.due_at ? new Date(event.due_at).toLocaleString("zh-CN", { hour12: false }) : "未设置"}</dd></div></dl></section>
    <section className="surface timeline-card"><div className="section-header"><h2>事件时间线</h2><span>{event.timeline.length} 条记录</span></div><div className="timeline">{event.timeline.map((item) => <div key={item.id}><i /><time>{new Date(item.created_at).toLocaleString("zh-CN", { hour12: false })}</time><div><strong>{item.note}</strong><span>{item.from_status ? `${statusLabel(item.from_status)} → ${statusLabel(item.to_status)}` : "系统记录"}</span></div></div>)}</div></section>
    {modal && <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setModal(null); }}><div className="action-dialog" role="dialog" aria-modal="true" aria-labelledby="action-dialog-title"><div className="dialog-title"><h2 id="action-dialog-title">{modal === "assign" ? "指派整改" : modal === "resolve" ? "提交整改结果" : "标记误报"}</h2><button type="button" aria-label="关闭弹窗" onClick={() => setModal(null)} disabled={saving}>×</button></div><div className="dialog-body">{modal === "assign" && <label>指派给<select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}><option value="">请选择负责人</option>{assignees.map((user) => <option key={user.id} value={user.id}>{user.display_name} · {user.role}</option>)}</select>{assignees.length === 1 && <small>当前仅有一个已初始化账号；门店负责人账号需在组织初始化中补齐。</small>}</label>}{modal === "resolve" && event.recovered_offset == null && <p className="dialog-warning">视频尚未观察到恢复，请在整改说明中写明人工复核依据；提交后仍保留原始 AI 证据。</p>}<label>{modal === "assign" ? "整改要求 / 备注" : modal === "resolve" ? "整改结果与复核依据" : "误报原因"}<textarea value={actionNote} onChange={(e) => setActionNote(e.target.value)} placeholder={modal === "assign" ? "请输入整改要求或备注说明…" : "请填写具体说明…"} rows={4} /></label>{actionError && <p className="dialog-error" role="alert">{actionError}</p>}</div><div className="dialog-footer"><button className="button secondary" type="button" onClick={() => setModal(null)} disabled={saving}>取消</button><button className="button primary" type="button" disabled={saving || !actionNote.trim() || (modal === "assign" && !assigneeId)} onClick={() => act(modal === "false_positive" ? "mark_false_positive" : modal, actionNote.trim(), modal === "assign" ? assigneeId : undefined)}>{saving ? "提交中…" : modal === "assign" ? "确认指派" : modal === "resolve" ? "确认已解决" : "确认标记"}</button></div></div></div>}
  </div>;
}

function CamerasPage({ bootstrap, loadError, refresh, canEdit, canAdmin }) {
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
    <div className="camera-source-name"><img src={camera.preview_image_url || demoCameraImages[camera.area_type]} alt={`${camera.name}演示封面`} /><div><strong>{camera.name}</strong><small>{camera.code} · 虚拟视频源</small></div></div>
    <span>{cameraAreaNames[camera.area_type] || camera.area_type}</span>
    <span className={`source-status ${camera.status === "online" ? "available" : "unavailable"}`}><i />{camera.status === "online" ? "已启用" : "已停用"}</span>
    <span className="camera-unavailable">未接入</span><span className="camera-unavailable">未接入</span>
    <button type="button" className="camera-toggle" role="switch" aria-label={`${camera.name}演示视频源`} aria-checked={camera.status === "online"} title={!canEdit ? "当前账号没有修改权限" : "仅切换演示视频源配置，不控制物理摄像头"} disabled={!canEdit || busyId === camera.id} onClick={() => toggle(camera)}><i /></button>
  </div>;
  return <div className="camera-management-page">
    <div className="camera-management-heading"><div><h2>摄像头管理</h2><p>共 {cameras.length} 台摄像头，已启用 {cameras.filter((camera) => camera.status === "online").length} 台，已停用 {cameras.filter((camera) => camera.status !== "online").length} 台 <span>· 演示配置，非真实在线状态</span></p></div><button className="button primary camera-add-button" type="button" disabled={!canAdmin} title={!canAdmin ? "仅管理员可添加" : ""} onClick={() => { setError(""); setShowAdd(true); }}><Icon name="plus" size={16} />添加摄像头</button></div>
    <div className="camera-source-metrics">
      <div className="camera-kpi"><i className="green"><Icon name="camera" size={16} /></i><div><span>已启用视频源</span><strong>{available}/{primary.length}</strong></div></div>
      <div className="camera-kpi"><i className="blue"><Icon name="pulse" size={16} /></i><div><span>{isShowcaseMode ? "快照当日上传量" : "今日上传视频量"}</span><strong>{uploadAmount}</strong></div></div>
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
    {showAdd && <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowAdd(false); }}><form className="action-dialog camera-add-dialog" role="dialog" aria-modal="true" aria-labelledby="camera-add-title" onSubmit={add}><div className="dialog-title"><h2 id="camera-add-title">添加演示视频源</h2><button type="button" aria-label="关闭弹窗" onClick={() => setShowAdd(false)} disabled={saving}>×</button></div><div className="dialog-body"><p>此处仅添加虚拟视频源供界面演示，不接入真实摄像头或视频分析。</p><label>名称<input required maxLength={60} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="例如：仓储-02" /></label><label>编号<input required maxLength={32} pattern="[A-Za-z0-9-]{2,32}" value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} placeholder="例如：STORAGE-02" /></label><label>位置<select value={draft.area_type} onChange={(event) => setDraft({ ...draft, area_type: event.target.value })}>{Object.entries(cameraAreaNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{error && <p className="dialog-error" role="alert">{error}</p>}</div><div className="dialog-footer"><button className="button secondary" type="button" onClick={() => setShowAdd(false)} disabled={saving}>取消</button><button className="button primary" type="submit" disabled={saving}>{saving ? "添加中…" : "确认添加"}</button></div></form></div>}
  </div>;
}

function RectificationPage({ navigate }) {
  const [events, setEvents] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [status, setStatus] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [rule, setRule] = useState("all");
  const [period, setPeriod] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const load = () => api.events().then(setEvents).catch((err) => setLoadError(err.message));
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => filterRectificationEvents(events || [], { status, severity, rule, period, query }), [events, status, severity, rule, period, query]);
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
    <div className="rectification-filters runs-filters"><div className="runs-rule-filter" role="group" aria-label="检测规则"><span>检测规则</span>{["all", ...new Set(events.map(item => item.rule_code).filter(Boolean))].map(value => <button type="button" key={value} aria-pressed={rule === value} className={rule === value ? "active" : ""} onClick={() => change(setRule, value)}>{ruleFilterLabel(value)}</button>)}</div><div><span>严重度：</span>{[["all","全部"],["P0","P0 严重"],["P1","P1 一般"],["P2","P2 提示"]].map(([value,label]) => <button type="button" className={severity === value ? "active" : ""} key={value} onClick={() => change(setSeverity,value)}>{label}</button>)}</div><div><span>时间范围：</span>{[["today","今天"],["week","近 7 天"],["month","近 30 天"],["all","全部"]].map(([value,label]) => <button type="button" className={period === value ? "active" : ""} key={value} onClick={() => change(setPeriod,value)}>{label}</button>)}</div><div className="rectification-search"><input value={query} onChange={(e) => change(setQuery,e.target.value)} placeholder="搜索事件 ID / 类型 / 摄像头…" aria-label="搜索整改事件" /><button type="button" onClick={exportRows} disabled={!filtered.length}>导出</button></div></div>
    <div className="rectification-table"><div className="rectification-head"><span>事件 ID</span><span>异常类型 / 负责人</span><span>严重度</span><span>摄像头</span><span>检测时间</span><span>状态</span><span>SLA</span><span>操作</span></div>{visible.length ? visible.map((event) => <div className="rectification-row" key={event.id}><strong>{event.id}</strong><div><b>{event.rule_code} · {event.title}</b><small>{event.assignee_name ? `负责人：${event.assignee_name}` : "尚未指派负责人"}</small></div><SeverityBadge value={event.severity} /><span>{event.camera_name}</span><time>{new Date(event.created_at).toLocaleString("zh-CN", { hour12: false })}</time><StatusBadge value={event.status} /><span className={event.overdue ? "overdue-text" : ""}>{event.status === "resolved" ? "已完成" : event.overdue ? "已超时" : event.due_at ? new Date(event.due_at).toLocaleString("zh-CN", { hour12: false }) : "—"}</span><button type="button" className="link-button" onClick={() => navigate("event", event.id)}>查看 →</button></div>) : <div className="table-empty">当前条件下没有整改事件</div>}</div>
    <div className="rectification-pager"><span>共 {filtered.length} 条记录 · 第 {page}/{pageCount} 页</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>{Array.from({length:pageCount}, (_,index) => <button type="button" className={page === index + 1 ? "active" : ""} key={index} onClick={() => setPage(index + 1)}>{index + 1}</button>)}<button type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>下一页</button></div></div>
  </section>;
}

function RulesPage({ canAdmin }) {
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
  return <div className="rules-layout">
    <section className="surface mode-config">
      <div className="page-section-title"><div><h2>上传视频分析模式</h2><p>仅用于已上传的 MP4；当前未接入萤石实时流</p></div><span className="prototype-chip">默认：{config.default_analysis_mode === "two_stage" ? "双层判定" : "逐帧基线"}</span></div>
      <div className="mode-profile-grid">{config.profiles.map((profile) => <button disabled={saving || !canAdmin} className={config.default_analysis_mode === profile.id ? "selected" : ""} onClick={() => selectMode(profile.id)} key={profile.id}><div className="mode-profile-head"><strong>{profile.name}</strong><span>{config.default_analysis_mode === profile.id ? "当前默认" : !canAdmin ? "仅管理员可改" : "设为默认"}</span></div><p>{profile.description}</p><dl>{Object.entries(profile.config).map(([key,value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl></button>)}</div>
      {message && <div className="config-message">{message}</div>}
    </section>
    <section className="surface list-page">
      <div className="page-section-title"><div><h2>规则能力</h2><p>P0/P1/P2 是事件严重等级；下方另列上传视频进度与实时接入状态</p></div><span className="prototype-chip">截至 2026-09-29：E1 3 条 · A1 2 条 · B1 3 条</span></div>
      <p className="rule-capability-note">E1、A1、B1 都只完成了限定合成视频的上传分析与事件回归，正样本事件均走过人工关闭；这不等于真实门店验收。E1 另验证了关门恢复与可选测试群通知；B1 首轮漏检仍须回归。所有规则的萤石实时取流、抓拍与持续监测均未接入。E1/B1 的 P0 已确认；其他规则显示当前代码等级，业务分级待确认。旧 E1/P1、B1/P2 事件保留历史等级。</p>
      <div className="table-head rule-grid"><span>规则 / 已有视频</span><span>能力类型</span><span>确认策略</span><span>事件严重等级</span><span>验证状态 / 接入范围</span></div>
      {ruleCatalog.map((rule) => <div className="table-row rule-grid" key={rule.code}><div><strong>{rule.code} · {rule.name}</strong><span>{rule.evidence} · {rule.notification}</span></div><span>{rule.type}</span><span>{rule.strategy}</span><div className="rule-severity">{rule.severity ? <><SeverityBadge value={rule.severity} />{!rule.gradeConfirmed && <small>现有代码值 · 业务待定</small>}</> : "等级待定"}</div><div className="rule-runtime-status"><strong>{ruleValidationLabel(rule)}</strong><span>实时摄像头未接入</span></div></div>)}
    </section>
  </div>;
}

export default App;
