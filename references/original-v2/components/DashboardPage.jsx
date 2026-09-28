// Dashboard Page - Camera grid + stats + recent events

function DashboardPage({ onNavigate, storeId }) {
  const stats = window.STATS;
  const cameras = window.CAMERAS;
  const events = window.EVENTS;
  const cameraImages = window.CAMERA_IMAGES;
  const stores = window.STORES;
  const currentStore = storeId ? stores.find(s => s.id === storeId) : null;

  return React.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "20px" } },
      // Stats row
      React.createElement(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "16px"
          }
        },
        React.createElement(StatsCard, {
          label: "今日异常总数",
          value: stats.todayTotal,
          sub: `P0 ${stats.p0Count} · P1 ${stats.p1Count} · P2 ${stats.p2Count}`,
          accent: "#DC2626",
          icon: window.ICONS.event
        }),
        React.createElement(StatsCard, {
          label: "待处理事件",
          value: stats.pendingCount + stats.inProgressCount,
          sub: `${stats.pendingCount} 待处理 · ${stats.inProgressCount} 整改中`,
          accent: "#2563EB",
          icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
        }),
        React.createElement(StatsCard, {
          label: "在线摄像头",
          value: `${stats.cameraOnline}/${stats.cameraTotal}`,
          sub: "1 台离线（取餐区）",
          accent: "#059669",
          icon: window.ICONS.camera
        }),
        React.createElement(StatsCard, {
          label: "AI 识别准确率",
          value: `${stats.aiAccuracy}%`,
          sub: "近 7 日平均",
          accent: "#7C3AED",
          icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'
        })
      ),

      // Camera grid + recent events
      React.createElement(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "1fr 380px",
            gap: "20px"
          }
        },
        // Camera grid
        React.createElement(
          window.Card,
          { padding: "0px" },
          React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #E2E8F0"
              }
            },
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "10px" } },
              React.createElement("h3", {
                style: { fontSize: "15px", fontWeight: 600, color: "#0F172A", margin: 0 }
              }, "监控大屏"),
              React.createElement(
                "span",
                {
                  style: {
                    fontSize: "11px",
                    color: "#64748B",
                    background: "#F1F5F9",
                    padding: "2px 8px",
                    borderRadius: "4px"
                  }
                },
                "实时"
              )
            ),
            React.createElement(
              "div",
              { style: { display: "flex", gap: "8px" } },
              React.createElement(
                window.Button,
                {
                  variant: "secondary",
                  size: "sm",
                  onClick: () => onNavigate("upload"),
                  icon: window.ICONS.upload
                },
                "上传视频"
              ),
              React.createElement(
                window.Button,
                {
                  variant: "secondary",
                  size: "sm",
                  onClick: () => onNavigate("cameras"),
                  icon: window.ICONS.camera
                },
                "摄像头管理"
              )
            )
          ),
          React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "1px",
                background: "#0F172A",
                padding: "1px",
                borderRadius: "0 0 8px 8px"
              }
            },
            cameras.map(cam => React.createElement(CameraFeedTile, {
              key: cam.id,
              camera: cam,
              imageUrl: cameraImages[cam.imageKey],
              onClick: () => onNavigate("event", { eventId: "EVT-0927-001" })
            }))
          )
        ),

        // Recent events
        React.createElement(
          window.Card,
          { padding: "0px" },
          React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #E2E8F0"
              }
            },
            React.createElement("h3", {
              style: { fontSize: "15px", fontWeight: 600, color: "#0F172A", margin: 0 }
            }, "最近事件"),
            React.createElement(
              "a",
              {
                onClick: () => onNavigate("rectification"),
                style: {
                  fontSize: "12px",
                  color: "#4F46E5",
                  cursor: "pointer",
                  fontWeight: 500
                }
              },
              "查看全部 →"
            )
          ),
          React.createElement(
            "div",
            { style: { maxHeight: "420px", overflowY: "auto" } },
            events.slice(0, 6).map(ev => React.createElement(EventRow, {
              key: ev.id,
              event: ev,
              onClick: () => onNavigate("event", { eventId: ev.id })
            }))
          )
        )
      )
    );
}

function StatsCard({ label, value, sub, accent, icon }) {
  return React.createElement(
    "div",
    {
      style: {
        background: "#FFFFFF",
        borderRadius: "8px",
        border: "1px solid #E2E8F0",
        padding: "18px 20px",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)"
      }
    },
    React.createElement(
      "div",
      { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between" } },
      React.createElement(
        "span",
        {
          style: {
            fontSize: "12px",
            color: "#64748B",
            fontWeight: 500,
            letterSpacing: "0.02em"
          }
        },
        label
      ),
      React.createElement(
        "span",
        {
          style: {
            width: "32px",
            height: "32px",
            borderRadius: "6px",
            background: `${accent}15`,
            color: accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: "-4px"
          },
          dangerouslySetInnerHTML: { __html: icon }
        }
      )
    ),
    React.createElement(
      "div",
      {
        style: {
          fontSize: "28px",
          fontWeight: 700,
          color: "#0F172A",
          marginTop: "10px",
          lineHeight: 1.2,
          fontVariantNumeric: "tabular-nums"
        }
      },
      value
    ),
    React.createElement(
      "div",
      {
        style: {
          fontSize: "12px",
          color: "#94A3B8",
          marginTop: "6px",
          lineHeight: 1.4
        }
      },
      sub
    )
  );
}

function CameraFeedTile({ camera, imageUrl, onClick }) {
  const isOnline = camera.status === "online";

  return React.createElement(
    "div",
    {
      onClick,
      style: {
        position: "relative",
        aspectRatio: "16/9",
        background: "#1E293B",
        overflow: "hidden",
        cursor: "pointer",
        minHeight: 0
      }
    },
    React.createElement("img", {
      src: imageUrl,
      alt: camera.name,
      style: {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        filter: isOnline ? "none" : "grayscale(1) brightness(0.4)",
        opacity: isOnline ? 1 : 0.5
      }
    }),
    // Camera label overlay
    React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          top: "10px",
          left: "10px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "rgba(15, 23, 42, 0.75)",
          padding: "4px 8px",
          borderRadius: "4px",
          fontSize: "11px",
          color: "#FFFFFF",
          fontWeight: 500,
          backdropFilter: "blur(4px)"
        }
      },
      React.createElement("span", {
        style: {
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: isOnline ? "#10B981" : "#EF4444",
          boxShadow: isOnline ? "0 0 0 2px rgba(16, 185, 129, 0.3)" : "none",
          animation: isOnline ? "pulse 2s infinite" : "none"
        }
      }),
      camera.name,
      React.createElement(
        "span",
        { style: { color: "#94A3B8", fontWeight: 400, marginLeft: "2px" } },
        `· ${camera.locationZh}`
      )
    ),
    // REC indicator
    isOnline && React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          top: "10px",
          right: "10px",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          background: "rgba(220, 38, 38, 0.9)",
          padding: "3px 7px",
          borderRadius: "3px",
          fontSize: "10px",
          color: "#FFFFFF",
          fontWeight: 600,
          letterSpacing: "0.05em"
        }
      },
      React.createElement("span", {
        style: {
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: "#FFFFFF",
          animation: "pulse 1.5s infinite"
        }
      }),
      "REC"
    ),
    // Timestamp
    isOnline && React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "10px",
          right: "10px",
          fontSize: "10px",
          color: "#FFFFFF",
          fontFamily: "'SF Mono', monospace",
          textShadow: "0 1px 2px rgba(0,0,0,0.8)",
          opacity: 0.8
        }
      },
      "2026-09-27 09:28:15"
    ),
    // Offline overlay
    !isOnline && React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          color: "#94A3B8",
          fontSize: "13px"
        }
      },
      React.createElement("svg", {
        width: "32", height: "32", viewBox: "0 0 24 24",
        fill: "none", stroke: "currentColor", strokeWidth: "1.5",
        strokeLinecap: "round", strokeLinejoin: "round"
      },
        React.createElement("path", { d: "M1 1l22 22" }),
        React.createElement("path", { d: "M16.16 11.6A3.99 3.99 0 0 0 13 9.5V6a3 3 0 0 0-5.74-1.24" }),
        React.createElement("path", { d: "M22 17.35V9.5l-5 3.5V10c0-.9-.22-1.75-.6-2.5" }),
        React.createElement("path", { d: "M6.61 6.61A3 3 0 0 0 5 9v4.5L0 10v7.5h16.5" })
      ),
      "摄像头离线",
      React.createElement(
        "span",
        { style: { fontSize: "11px", color: "#64748B" } },
        `最后心跳 ${camera.lastHeartbeat.split(" ")[1]}`
      )
    ),
    // Hover overlay
    React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          inset: 0,
          background: "rgba(15, 23, 42, 0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0,
          transition: "opacity 0.2s",
          color: "#FFFFFF",
          fontSize: "13px",
          fontWeight: 500
        },
        onMouseEnter: e => e.currentTarget.style.opacity = "1",
        onMouseLeave: e => e.currentTarget.style.opacity = "0"
      },
      "点击查看详情 →"
    )
  );
}

function EventRow({ event, onClick }) {
  const sevStyle = window.SEVERITY_STYLES[event.severity];
  return React.createElement(
    "div",
    {
      onClick,
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        padding: "14px 20px",
        borderBottom: "1px solid #F1F5F9",
        cursor: "pointer",
        transition: "background 0.15s",
        position: "relative"
      },
      onMouseEnter: e => e.currentTarget.style.background = "#F8FAFC",
      onMouseLeave: e => e.currentTarget.style.background = "transparent"
    },
    // Severity indicator bar
    React.createElement("div", {
      style: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: "3px",
        background: sevStyle.text
      }
    }),
    // Event thumbnail
    React.createElement(
      "div",
      {
        style: {
          width: "64px",
          height: "48px",
          borderRadius: "4px",
          overflow: "hidden",
          flexShrink: 0,
          marginLeft: "10px"
        }
      },
      React.createElement("img", {
        src: window.CAMERA_IMAGES[event.imageKey],
        alt: event.typeName,
        style: { width: "100%", height: "100%", objectFit: "cover" }
      })
    ),
    // Event info
    React.createElement(
      "div",
      { style: { flex: 1, minWidth: 0 } },
      React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" } },
        React.createElement(window.SeverityBadge, { severity: event.severity }),
        React.createElement(
          "span",
          { style: { fontSize: "12px", fontWeight: 600, color: "#0F172A" } },
          event.typeName
        )
      ),
      React.createElement(
        "p",
        {
          style: {
            fontSize: "12px",
            color: "#475569",
            margin: 0,
            lineHeight: 1.4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden"
          }
        },
        event.description
      ),
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginTop: "6px",
            fontSize: "11px",
            color: "#94A3B8"
          }
        },
        React.createElement("span", {}, event.id),
        React.createElement("span", { style: { color: "#CBD5E1" } }, "·"),
        React.createElement("span", {}, event.cameraName),
        React.createElement("span", { style: { color: "#CBD5E1" } }, "·"),
        React.createElement("span", {}, event.timeAgo)
      )
    ),
    // Confidence
    React.createElement(window.ConfidenceChip, { confidence: event.confidence })
  );
}

Object.assign(window, { DashboardPage });
