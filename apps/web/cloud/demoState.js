export const initialAccounts = [
  { id: "USER-ADMIN", username: "admin", display_name: "总部管理员", role: "admin", active: true },
  { id: "USER-OPERATOR", username: "operator", display_name: "巡检员", role: "operator", active: true },
  { id: "USER-VIEWER", username: "viewer", display_name: "查看者", role: "viewer", active: true },
];

export const initialState = () => ({ events: {}, cameras: {}, newCameras: [], defaultAnalysisMode: null, accounts: initialAccounts });

export function actorFor(state, id) {
  return (state.accounts || initialAccounts).find((account) => account.id === id && account.active);
}

export function requireRole(state, id, allowed) {
  const actor = actorFor(state, id);
  if (!actor || !allowed.includes(actor.role)) throw new Error("当前演示账号没有此操作权限。请切换到相应角色。");
  return actor;
}

export function applyEventAction(state, snapshot, id, payload, actorId, now = new Date().toISOString()) {
  const actor = requireRole(state, actorId, ["admin", "operator"]);
  const baseline = snapshot.event_details[id];
  if (!baseline) throw new Error("事件不存在。");
  const previous = state.events[id] || {};
  const status = previous.status || baseline.status;
  const transitions = {
    pending_confirmation: { acknowledge: "acknowledged", assign: "acknowledged", mark_false_positive: "false_positive", ignore: "ignored" },
    acknowledged: { assign: "acknowledged", start_rectification: "rectifying", mark_false_positive: "false_positive", ignore: "ignored" },
    rectifying: { assign: "rectifying", resolve: "resolved" },
  };
  const action = String(payload.action || "");
  const next = transitions[status]?.[action];
  if (!next) throw new Error("此事件当前状态不允许该操作。");
  const note = String(payload.note || "").trim();
  if (note.length > 500) throw new Error("处理说明不能超过 500 字。");
  if (["assign", "resolve", "mark_false_positive"].includes(action) && !note) throw new Error("请填写处理说明。");
  let assigneeId = previous.assignee_id === undefined ? baseline.assignee_id : previous.assignee_id;
  let assigneeName = previous.assignee_name === undefined ? baseline.assignee_name : previous.assignee_name;
  if (action === "assign") {
    const assignee = actorFor(state, payload.assignee_id);
    if (!assignee || !["admin", "operator"].includes(assignee.role)) throw new Error("请选择有效的整改负责人。");
    assigneeId = assignee.id;
    assigneeName = assignee.display_name;
  }
  if (action === "start_rectification" && !assigneeId) throw new Error("请先指派整改负责人。");
  const labels = { acknowledge: "确认事件", assign: "指派整改", start_rectification: "开始整改", resolve: "整改完成", mark_false_positive: "标记误报", ignore: "忽略事件" };
  const timeline = [...(previous.timeline || []), {
    id: `DEMO-${crypto.randomUUID()}`, created_at: now, from_status: status, to_status: next,
    note: `${actor.display_name} · ${labels[action]}${note ? `：${note}` : ""}`,
  }];
  if (timeline.length > 100) throw new Error("该演示事件处理记录已达上限，请联系管理员重置演示环境。");
  state.events[id] = { status: next, assignee_id: assigneeId || null, assignee_name: assigneeName || null, timeline, updated_at: now,
    overdue: ["resolved", "false_positive", "ignored"].includes(next) ? false : baseline.overdue,
    acknowledged_at: ["acknowledged", "rectifying", "resolved"].includes(next) ? previous.acknowledged_at || baseline.acknowledged_at || now : baseline.acknowledged_at,
    resolved_at: next === "resolved" ? now : baseline.resolved_at };
  return state;
}

export function applyCameraChange(state, snapshot, payload, actorId, cameraId) {
  requireRole(state, actorId, cameraId ? ["admin", "operator"] : ["admin"]);
  const cameras = [...snapshot.bootstrap.cameras, ...state.newCameras];
  if (cameraId) {
    if (!cameras.some((camera) => camera.id === cameraId)) throw new Error("演示视频源不存在。");
    if (!["online", "offline"].includes(payload.status)) throw new Error("视频源状态无效。");
    state.cameras[cameraId] = payload.status;
  } else {
    const name = String(payload.name || "").trim();
    const code = String(payload.code || "").trim();
    const area = String(payload.area_type || "");
    if (!name || name.length > 60 || !/^[A-Za-z0-9-]{2,32}$/.test(code)) throw new Error("请填写有效的视频源名称和编号。");
    if (!["front_counter", "back_kitchen", "dining_area", "pickup_area", "storage"].includes(area)) throw new Error("视频源位置无效。");
    if (cameras.some((camera) => camera.code.toLowerCase() === code.toLowerCase())) throw new Error("视频源编号已存在。");
    state.newCameras.push({ id: `CAM-DEMO-${crypto.randomUUID().slice(0, 8)}`, name, code, area_type: area, status: "offline", store_id: snapshot.bootstrap.store.id });
  }
  return state;
}

export function applyRuleChange(state, snapshot, mode, actorId) {
  requireRole(state, actorId, ["admin"]);
  if (!snapshot.rules_config.profiles.some((profile) => profile.id === mode)) throw new Error("分析模式不存在。");
  state.defaultAnalysisMode = mode;
  return state;
}

export function applyAccountChange(state, payload, actorId, id) {
  requireRole(state, actorId, ["admin"]);
  const accounts = state.accounts || initialAccounts;
  if (id) {
    const target = accounts.find((account) => account.id === id);
    if (!target) throw new Error("账号不存在。");
    const role = payload.role === undefined ? target.role : payload.role;
    const active = payload.active === undefined ? target.active : payload.active;
    if (!["admin", "operator", "viewer"].includes(role) || typeof active !== "boolean") throw new Error("账号设置无效。");
    if (id === actorId && (!active || role !== "admin")) throw new Error("不能停用当前管理员账号或移除自身管理员权限。");
    if (target.role === "admin" && (role !== "admin" || !active) && accounts.filter((account) => account.role === "admin" && account.active).length <= 1) throw new Error("至少保留一位启用的管理员。");
    Object.assign(target, { role, active });
  } else {
    const username = String(payload.username || "").trim().toLowerCase();
    const displayName = String(payload.display_name || "").trim();
    if (!/^[a-z0-9_-]{3,24}$/.test(username) || !displayName || displayName.length > 30) throw new Error("请填写有效的账号名和显示名称。");
    if (accounts.some((account) => account.username === username)) throw new Error("账号名已存在。");
    if (accounts.length >= 30) throw new Error("演示账号最多 30 个。");
    if (!["admin", "operator", "viewer"].includes(payload.role)) throw new Error("请选择有效角色。");
    accounts.push({ id: `USER-DEMO-${crypto.randomUUID().slice(0, 8)}`, username, display_name: displayName, role: payload.role, active: true });
  }
  state.accounts = accounts;
  return state;
}
