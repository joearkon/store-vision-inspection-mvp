// Synthetic snapshot plus a D1-backed overlay for ordinary demo UI actions.
export const isShowcaseMode = import.meta.env.MODE === "showcase";

const base = import.meta.env.BASE_URL || "/";
let snapshotPromise;
const actorKey = "store-vision-demo-actor-v2";
export const getDemoActorId = () => typeof localStorage === "undefined" ? null : localStorage.getItem(actorKey);
export const setDemoActorId = (id) => { if (id) localStorage.setItem(actorKey, id); else localStorage.removeItem(actorKey); window.dispatchEvent(new Event("demo-actor-changed")); };

function loadSnapshot() {
  if (!snapshotPromise) {
    snapshotPromise = fetch(`${base}showcase/snapshot.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`静态数据加载失败（${response.status}）`);
        return response.json();
      })
      .catch((error) => { snapshotPromise = null; throw error; });
  }
  return snapshotPromise;
}

async function requestDemo(path, method, body) {
  const response = await fetch(`${base}api/demo/${path}`, { method, headers: { "content-type": "application/json", "x-demo-actor": getDemoActorId() || "" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.detail || `演示数据保存失败（${response.status}）`);
  return result;
}
async function loadState() {
  const response = await fetch(`${base}api/demo/state`, { cache: "no-store" });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.detail || `演示数据加载失败（${response.status}）`);
  return result;
}
const disabled = () => Promise.reject(new Error("线上演示暂未开放视频解析或外部通知。"));
const missing = (label) => { throw new Error(`演示数据中没有${label}记录。`); };
const eventOverlay = (event, overlay) => overlay ? { ...event, ...overlay, timeline: [...(event.timeline || []), ...(overlay.timeline || [])] } : event;
const cameraOverlay = (camera, state) => ({ ...camera, status: state.cameras?.[camera.id] || camera.status });

export function createShowcaseApi(read = loadSnapshot, readState = loadState, write = requestDemo) {
  const both = async () => Promise.all([read(), readState()]);
  const event = async (id) => { const [snapshot, state] = await both(); return snapshot.event_details[id] ? eventOverlay(snapshot.event_details[id], state.events?.[id]) : missing("事件"); };
  return {
    operationsConfig: async () => { const [snapshot,state] = await both(); return {stores:[snapshot.bootstrap.store],cameras:[...snapshot.bootstrap.cameras,...(state.newCameras || [])].map(camera=>cameraOverlay(camera,state)),scene_candidates:[],rule_settings:[]}; },
    scene: disabled,
    confirmScene: disabled,
    retryScene: disabled,
    demoState: readState,
    bootstrap: async () => {
      const [snapshot, state] = await both();
      const cameras = [...snapshot.bootstrap.cameras, ...(state.newCameras || [])].map((camera) => cameraOverlay(camera, state));
      return { ...snapshot.bootstrap, cameras, current_user: state.accounts?.find((account) => account.id === getDemoActorId() && account.active) || null, snapshot_meta: snapshot.meta };
    },
    dashboard: async () => { const [snapshot, state] = await both(); return { ...snapshot.dashboard, camera_sources: snapshot.dashboard.camera_sources.map((camera) => cameraOverlay(camera, state)), recent_events: snapshot.dashboard.recent_events.map((item) => eventOverlay(item, state.events?.[item.id])), metrics: { ...snapshot.dashboard.metrics, pending_events: snapshot.events.filter((item) => ["pending_confirmation", "acknowledged", "rectifying"].includes(state.events?.[item.id]?.status || item.status)).length } }; },
    cameraDetail: async (id, days = 1) => {
      const [snapshot, state] = await both();
      const result = snapshot.camera_details[id]?.[String(days)];
      if (result) return { ...result, camera: cameraOverlay(result.camera, state), events: result.events.map((item) => eventOverlay(item, state.events?.[item.id])) };
      const camera = state.newCameras?.find((item) => item.id === id);
      return camera ? { camera: cameraOverlay(camera, state), days, counts: { total: 0, p0: 0, p1: 0, p2: 0 }, events: [] } : missing("视频源");
    },
    events: async () => { const [snapshot, state] = await both(); return snapshot.events.map((item) => eventOverlay(item, state.events?.[item.id])); },
    event,
    runs: async () => (await read()).runs,
    run: async (id) => (await read()).run_details[id] || missing("任务"),
    rulesConfig: async () => { const [snapshot, state] = await both(); return { ...snapshot.rules_config, default_analysis_mode: state.defaultAnalysisMode || snapshot.rules_config.default_analysis_mode }; },
    evidenceUrl: (id) => `${base}showcase/evidence/${encodeURIComponent(id)}.jpg`,
    eventVideoUrl: () => "",
    createCamera: async (camera) => { const result = await write("cameras", "POST", camera); return result.state.newCameras.at(-1); },
    setCameraStatus: async (id, status) => { await write(`cameras/${encodeURIComponent(id)}`, "PATCH", { status }); return { id, status }; },
    feishuTestPreview: disabled,
    feishuTestSend: disabled,
    eventAssignees: async () => (await readState()).accounts.filter((account) => account.active && ["admin", "operator"].includes(account.role)),
    approveFallback: disabled,
    cancelRun: disabled,
    updateRulesConfig: async (defaultAnalysisMode) => { await write("rules", "PUT", { default_analysis_mode: defaultAnalysisMode }); return { ...(await read()).rules_config, default_analysis_mode: defaultAnalysisMode }; },
    createDemoAccount: async (account) => { await write("accounts", "POST", account); return readState(); },
    updateDemoAccount: async (id, account) => { await write(`accounts/${encodeURIComponent(id)}`, "PATCH", account); return readState(); },
    sop: async () => (await read()).sop || {stores:[],templates:[],tasks:[],records:[],stats:{}},
    saveSop: disabled,
    disableSop: disabled,
    sopRecord: disabled,
    analyzeSop: disabled,
    createRun: disabled,
    eventAction: async (id, action, note, assigneeId) => { await write(`events/${encodeURIComponent(id)}/actions`, "POST", { action, note, assignee_id: assigneeId }); return event(id); },
    uploadVideo: disabled,
  };
}

export const showcaseApi = createShowcaseApi();
