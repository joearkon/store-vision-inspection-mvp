import { initialState, applyEventAction, applyCameraChange, applyRuleChange, applyAccountChange } from "../../../cloud/demoState.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

async function snapshotFor(context) {
  const url = new URL("/showcase/snapshot.json", context.request.url);
  const response = await context.env.ASSETS.fetch(url);
  if (!response.ok) throw new Error("演示快照不可用。");
  return response.json();
}

async function mutate(db, operation) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await db.prepare("SELECT state_json, version FROM demo_state WHERE id = 1").first();
    if (!row) throw new Error("演示数据库尚未初始化。");
    const state = JSON.parse(row.state_json);
    const next = await operation(state);
    const result = await db.prepare("UPDATE demo_state SET state_json = ?, version = version + 1, updated_at = ? WHERE id = 1 AND version = ?")
      .bind(JSON.stringify(next), new Date().toISOString(), row.version).run();
    if (result.meta.changes === 1) return next;
  }
  throw new Error("数据正被其他人修改，请重试。");
}

export async function onRequest(context) {
  try {
    const { request, env } = context;
    if (!env.DEMO_DB) return json({ detail: "演示数据库未绑定。" }, 503);
    const path = new URL(request.url).pathname.replace(/^\/api\/demo\/?/, "").split("/").filter(Boolean);
    if (request.method === "GET" && path.join("/") === "state") {
      const row = await env.DEMO_DB.prepare("SELECT state_json, version FROM demo_state WHERE id = 1").first();
      if (!row) return json({ detail: "演示数据库尚未初始化。" }, 503);
      return json({ ...JSON.parse(row.state_json), version: row.version });
    }
    if (!["POST", "PATCH", "PUT"].includes(request.method)) return json({ detail: "接口不存在。" }, 404);
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return json({ detail: "跨站写入已拒绝。" }, 403);
    if (!(request.headers.get("content-type") || "").includes("application/json")) return json({ detail: "请求格式必须为 JSON。" }, 415);
    if (Number(request.headers.get("content-length") || 0) > 8192) return json({ detail: "请求内容过大。" }, 413);
    const payload = await request.json();
    const actorId = request.headers.get("x-demo-actor");
    const snapshot = await snapshotFor(context);
    let operation;
    if (request.method === "POST" && path[0] === "events" && path[2] === "actions" && path.length === 3) operation = (state) => applyEventAction(state, snapshot, path[1], payload, actorId);
    else if (request.method === "POST" && path.join("/") === "cameras") operation = (state) => applyCameraChange(state, snapshot, payload, actorId);
    else if (request.method === "PATCH" && path[0] === "cameras" && path.length === 2) operation = (state) => applyCameraChange(state, snapshot, payload, actorId, path[1]);
    else if (request.method === "PUT" && path.join("/") === "rules") operation = (state) => applyRuleChange(state, snapshot, payload.default_analysis_mode, actorId);
    else if (request.method === "POST" && path.join("/") === "accounts") operation = (state) => applyAccountChange(state, payload, actorId);
    else if (request.method === "PATCH" && path[0] === "accounts" && path.length === 2) operation = (state) => applyAccountChange(state, payload, actorId, path[1]);
    else return json({ detail: "接口不存在。" }, 404);
    const state = await mutate(env.DEMO_DB, operation);
    return json({ ok: true, state });
  } catch (error) {
    return json({ detail: error.message || "演示数据保存失败。" }, 400);
  }
}
