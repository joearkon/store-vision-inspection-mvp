// Keep production deploys same-origin, but make the local development site
// independent from how Vite was launched.  Starting Vite from the repository
// root can otherwise skip apps/web/vite.config.js and return index.html for
// /api/*, leaving the UI in a permanent loading state.
const API_BASE = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? "http://127.0.0.1:8797" : "");

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(`接口返回格式异常（${response.status}），请检查前后端连接`);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.detail || `请求失败（${response.status}）`);
  }
  return body;
}

export const apiUrl = (path) => `${API_BASE}${path}`;

export const api = {
  bootstrap: () => request("/api/bootstrap"),
  dashboard: () => request("/api/dashboard"),
  events: () => request("/api/events"),
  event: (id) => request(`/api/events/${id}`),
  eventAssignees: (id) => request(`/api/events/${id}/assignees`),
  evidenceUrl: (id) => apiUrl(`/api/media/evidence/${id}`),
  eventVideoUrl: (id) => apiUrl(`/api/media/events/${id}/video`),
  runs: () => request("/api/analysis-runs"),
  run: (id) => request(`/api/analysis-runs/${id}`),
  approveFallback: (id) => request(`/api/analysis-runs/${id}/approve-fallback`, {
    method: "POST"
  }),
  rulesConfig: () => request("/api/rules/config"),
  updateRulesConfig: (defaultAnalysisMode) => request("/api/rules/config", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ default_analysis_mode: defaultAnalysisMode })
  }),
  createRun: (videoId, notificationsEnabled, analysisMode) =>
    request("/api/analysis-runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        video_id: videoId,
        notifications_enabled: notificationsEnabled,
        analysis_mode: analysisMode
      })
    }),
  eventAction: (id, action, note, assigneeId) =>
    request(`/api/events/${id}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, note, assignee_id: assigneeId })
    }),
  uploadVideo: ({ file, cameraId, onProgress }) =>
    new Promise((resolve, reject) => {
      const query = new URLSearchParams({
        filename: file.name,
        camera_id: cameraId,
        store_id: "STORE-JTU",
        source_kind: "upload"
      });
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/api/videos?${query}`);
      xhr.setRequestHeader("content-type", "video/mp4");
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(event.loaded / event.total);
      };
      xhr.onload = () => {
        const body = JSON.parse(xhr.responseText || "null");
        if (xhr.status >= 200 && xhr.status < 300) resolve(body);
        else reject(new Error(body?.detail || `上传失败（${xhr.status}）`));
      };
      xhr.onerror = () => reject(new Error("上传网络中断"));
      xhr.send(file);
    })
};
