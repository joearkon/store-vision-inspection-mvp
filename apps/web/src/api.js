const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.detail || `请求失败（${response.status}）`);
  }
  return body;
}

export const api = {
  bootstrap: () => request("/api/bootstrap"),
  dashboard: () => request("/api/dashboard"),
  events: () => request("/api/events"),
  event: (id) => request(`/api/events/${id}`),
  runs: () => request("/api/analysis-runs"),
  run: (id) => request(`/api/analysis-runs/${id}`),
  createRun: (videoId, notificationsEnabled) =>
    request("/api/analysis-runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        video_id: videoId,
        notifications_enabled: notificationsEnabled
      })
    }),
  eventAction: (id, action, note) =>
    request(`/api/events/${id}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, note })
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
