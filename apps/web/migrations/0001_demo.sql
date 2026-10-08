CREATE TABLE IF NOT EXISTS demo_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  state_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO demo_state (id, state_json, version, updated_at) VALUES
(1, '{"events":{},"cameras":{},"newCameras":[],"defaultAnalysisMode":null,"accounts":[{"id":"USER-ADMIN","username":"admin","display_name":"总部管理员","role":"admin","active":true},{"id":"USER-OPERATOR","username":"operator","display_name":"巡检员","role":"operator","active":true},{"id":"USER-VIEWER","username":"viewer","display_name":"查看者","role":"viewer","active":true}]}', 0, '2026-10-04T00:00:00.000Z');
