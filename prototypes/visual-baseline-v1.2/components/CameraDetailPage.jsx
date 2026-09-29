// Camera Detail Page - Large live feed + camera-specific anomaly history

function CameraDetailPage({ cameraId, onNavigate }) {
  const camera = window.CAMERAS.find(c => c.id === cameraId) || window.CAMERAS[0];
  const cameraImages = window.CAMERA_IMAGES;
  const events = window.EVENTS.filter(e => e.cameraId === camera.id);
  const isOnline = camera.status === "online";

  // Build timeline stats for this camera
  const todayCount = events.length;
  const p0Count = events.filter(e => e.severity === "P0").length;
  const p1Count = events.filter(e => e.severity === "P1").length;
  const p2Count = events.filter(e => e.severity === "P2").length;

  return React.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "20px" } },

    // Breadcrumb
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "13px",
          color: "#64748B"
        }
      },
      React.createElement(
        "a",
        {
          onClick: () => onNavigate("dashboard"),
          style: { cursor: "pointer", color: "#4F46E5", fontWeight: 500 }
        },
        "监控大盘"
      ),
      React.createElement("span", { style: { color: "#CBD5E1" } }, "/"),
      React.createElement("span", { style: { color: "#334155", fontWeight: 500 } }, `${camera.name} · ${camera.locationZh}`)
    ),

    // Top: Large video player + info sidebar
    React.createElement(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: "20px",
          alignItems: "start"
        }
      },

      // Large live feed
      React.createElement(
        window.Card,
        { padding: "0px" },
        // Card header
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 20px",
              borderBottom: "1px solid #E2E8F0"
            }
          },
          React.createElement(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "10px" } },
            React.createElement("h3", {
              style: { fontSize: "15px", fontWeight: 600, color: "#0F172A", margin: 0 }
            }, `${camera.name}`),
            React.createElement(
              "span",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  background: isOnline ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                  color: isOnline ? "#059669" : "#DC2626",
                  fontSize: "11px",
                  fontWeight: 600
                }
              },
              React.createElement("span", {
                style: {
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: isOnline ? "#10B981" : "#EF4444",
                  animation: isOnline ? "pulse 2s infinite" : "none"
                }
              }),
              isOnline ? "在线" : "离线"
            )
          ),
          React.createElement(
            "div",
            { style: { display: "flex", gap: "6px", alignItems: "center" } },
            React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "3px 8px",
                  background: "rgba(220, 38, 38, 0.1)",
                  borderRadius: "4px",
                  fontSize: "11px",
                  color: "#DC2626",
                  fontWeight: 600,
                  letterSpacing: "0.05em"
                }
              },
              React.createElement("span", {
                style: {
                  width: "5px", height: "5px",
                  borderRadius: "50%",
                  background: "#DC2626",
                  animation: "pulse 1.5s infinite"
                }
              }),
              "REC"
            ),
            React.createElement(
              "span",
              {
                style: {
                  fontSize: "11px",
                  color: "#64748B",
                  fontFamily: "'SF Mono', monospace",
                  marginLeft: "4px"
                }
              },
              "09:28:15"
            )
          )
        ),
        // Video area
        React.createElement(
          "div",
          {
            style: {
              position: "relative",
              aspectRatio: "16/9",
              background: "#0F172A",
              overflow: "hidden"
            }
          },
          React.createElement("img", {
            src: cameraImages[camera.imageKey],
            alt: camera.name,
            style: {
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: isOnline ? "none" : "grayscale(1) brightness(0.4)"
            }
          }),
          // Location label
          React.createElement(
            "div",
            {
              style: {
                position: "absolute",
                top: "16px",
                left: "16px",
                padding: "6px 12px",
                background: "rgba(15, 23, 42, 0.8)",
                borderRadius: "4px",
                fontSize: "13px",
                color: "#FFFFFF",
                fontWeight: 500,
                backdropFilter: "blur(6px)"
              }
            },
            camera.locationZh
          ),
          // Bottom control bar
          React.createElement(
            "div",
            {
              style: {
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                padding: "14px 20px",
                background: "linear-gradient(to top, rgba(15, 23, 42, 0.85), transparent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }
            },
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "16px", color: "#FFFFFF" } },
              // Play/Pause
              React.createElement(
                "button",
                {
                  style: {
                    width: "36px", height: "36px",
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.15)",
                    border: "none",
                    color: "#FFFFFF",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }
                },
                React.createElement("span", {
                  dangerouslySetInnerHTML: {
                    __html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
                  }
                })
              ),
              // Timestamp
              React.createElement(
                "span",
                {
                  style: {
                    fontSize: "12px",
                    fontFamily: "'SF Mono', monospace",
                    opacity: 0.9
                  }
                },
                "LIVE · 09:28:15"
              )
            ),
            // Right controls
            React.createElement(
              "div",
              { style: { display: "flex", gap: "12px", color: "#FFFFFF" } },
              React.createElement(
                "button",
                {
                  style: {
                    background: "transparent",
                    border: "none",
                    color: "#FFFFFF",
                    cursor: "pointer",
                    opacity: 0.8,
                    padding: 0,
                    display: "flex"
                  }
                },
                React.createElement("span", {
                  dangerouslySetInnerHTML: {
                    __html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>'
                  }
                })
              ),
              React.createElement(
                "button",
                {
                  style: {
                    background: "transparent",
                    border: "none",
                    color: "#FFFFFF",
                    cursor: "pointer",
                    opacity: 0.8,
                    padding: 0,
                    display: "flex"
                  }
                },
                React.createElement("span", {
                  dangerouslySetInnerHTML: {
                    __html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>'
                  }
                })
              ),
              React.createElement(
                "button",
                {
                  style: {
                    background: "transparent",
                    border: "none",
                    color: "#FFFFFF",
                    cursor: "pointer",
                    opacity: 0.8,
                    padding: 0,
                    display: "flex"
                  }
                },
                React.createElement("span", {
                  dangerouslySetInnerHTML: {
                    __html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>'
                  }
                })
              )
            )
          )
        )
      ),

      // Right side: Camera info
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "16px" } },
        // Device info card
        React.createElement(
          window.Card,
          { padding: "0px" },
          React.createElement(
            "div",
            {
              style: {
                padding: "14px 20px",
                borderBottom: "1px solid #E2E8F0"
              }
            },
            React.createElement("h4", {
              style: { fontSize: "14px", fontWeight: 600, color: "#0F172A", margin: 0 }
            }, "设备信息")
          ),
          React.createElement(
            "div",
            { style: { padding: "16px 20px", display: "flex", flexDirection: "column", gap: "14px" } },
            React.createElement(InfoRow, { label: "设备编号", value: camera.id, mono: true }),
            React.createElement(InfoRow, { label: "设备名称", value: camera.name }),
            React.createElement(InfoRow, { label: "安装位置", value: camera.locationZh }),
            React.createElement(InfoRow, { label: "设备型号", value: camera.model }),
            React.createElement(InfoRow, { label: "IP 地址", value: camera.ip, mono: true }),
            React.createElement(InfoRow, { label: "分辨率", value: camera.resolution, mono: true }),
            React.createElement(InfoRow, { label: "最后心跳", value: camera.lastHeartbeat.split(" ")[1], mono: true })
          )
        ),

        // Today's stats
        React.createElement(
          window.Card,
          { padding: "0px" },
          React.createElement(
            "div",
            {
              style: {
                padding: "14px 20px",
                borderBottom: "1px solid #E2E8F0"
              }
            },
            React.createElement("h4", {
              style: { fontSize: "14px", fontWeight: 600, color: "#0F172A", margin: 0 }
            }, "今日异常统计")
          ),
          React.createElement(
            "div",
            {
              style: {
                padding: "16px 20px",
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "12px",
                textAlign: "center"
              }
            },
            React.createElement(MiniStat, { label: "总数", value: todayCount, color: "#475569" }),
            React.createElement(MiniStat, { label: "P0", value: p0Count, color: "#DC2626" }),
            React.createElement(MiniStat, { label: "P1", value: p1Count, color: "#EA580C" })
          )
        )
      )
    ),

    // Bottom: Anomaly history for this camera
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
            padding: "14px 20px",
            borderBottom: "1px solid #E2E8F0"
          }
        },
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "10px" } },
          React.createElement("h3", {
            style: { fontSize: "15px", fontWeight: 600, color: "#0F172A", margin: 0 }
          }, "异常检测记录"),
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
            `今日 ${events.length} 条`
          )
        ),
        React.createElement(
          "div",
          { style: { display: "flex", gap: "8px" } },
          React.createElement(
            "select",
            {
              style: {
                padding: "5px 10px",
                fontSize: "12px",
                border: "1px solid #CBD5E1",
                borderRadius: "6px",
                background: "#FFFFFF",
                color: "#334155",
                fontFamily: "inherit"
              }
            },
            React.createElement("option", {}, "今日"),
            React.createElement("option", {}, "近 7 日"),
            React.createElement("option", {}, "近 30 日")
          )
        )
      ),

      // Event list
      events.length === 0 ? (
        React.createElement(
          "div",
          {
            style: {
              padding: "40px 20px",
              textAlign: "center",
              color: "#94A3B8",
              fontSize: "13px"
            }
          },
          "该摄像头今日无异常检测记录"
        )
      ) : (
        React.createElement(
          "div",
          { style: { maxHeight: "480px", overflowY: "auto" } },
          events.map(ev => React.createElement(CameraEventRow, {
            key: ev.id,
            event: ev,
            onClick: () => onNavigate("event", { eventId: ev.id })
          }))
        )
      )
    )
  );
}

function InfoRow({ label, value, mono }) {
  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px"
      }
    },
    React.createElement("span", {
      style: { fontSize: "12px", color: "#64748B" }
    }, label),
    React.createElement("span", {
      style: {
        fontSize: "12px",
        color: "#0F172A",
        fontWeight: 500,
        fontFamily: mono ? "'SF Mono', monospace" : "inherit",
        textAlign: "right",
        lineHeight: 1.4
      }
    }, value)
  );
}

function MiniStat({ label, value, color }) {
  return React.createElement(
    "div",
    {},
    React.createElement("div", {
      style: {
        fontSize: "22px",
        fontWeight: 700,
        color,
        lineHeight: 1.2,
        fontVariantNumeric: "tabular-nums"
      }
    }, value),
    React.createElement("div", {
      style: { fontSize: "11px", color: "#64748B", marginTop: "4px" }
    }, label)
  );
}

function CameraEventRow({ event, onClick }) {
  const sevStyle = window.SEVERITY_STYLES[event.severity];
  const statStyle = window.STATUS_STYLES[event.status];
  const cameraImages = window.CAMERA_IMAGES;

  return React.createElement(
    "div",
    {
      onClick,
      style: {
        display: "flex",
        gap: "16px",
        padding: "14px 20px",
        borderBottom: "1px solid #F1F5F9",
        cursor: "pointer",
        transition: "background 0.15s",
        alignItems: "center"
      },
      onMouseEnter: e => { e.currentTarget.style.background = "#F8FAFC"; },
      onMouseLeave: e => { e.currentTarget.style.background = "transparent"; }
    },
    // Thumbnail
    React.createElement(
      "div",
      {
        style: {
          width: "96px",
          height: "54px",
          borderRadius: "6px",
          overflow: "hidden",
          flexShrink: 0,
          background: "#1E293B",
          position: "relative"
        }
      },
      React.createElement("img", {
        src: cameraImages[event.imageKey] || cameraImages.front_counter,
        alt: event.typeName,
        style: { width: "100%", height: "100%", objectFit: "cover" }
      })
    ),

    // Main info
    React.createElement(
      "div",
      { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "6px" } },
      React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "10px" } },
        React.createElement(window.SeverityBadge, { severity: event.severity }),
        React.createElement(
          "span",
          {
            style: {
              fontSize: "14px",
              fontWeight: 600,
              color: "#0F172A",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }
          },
          `${event.type} · ${event.typeName}`
        )
      ),
      React.createElement(
        "div",
        { style: { fontSize: "12px", color: "#64748B", lineHeight: 1.4 } },
        event.description
      ),
      React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "12px", fontSize: "11px", color: "#94A3B8" } },
        React.createElement("span", {}, event.timeAgo),
        React.createElement("span", { style: { color: "#CBD5E1" } }, "·"),
        React.createElement(window.ConfidenceChip, { confidence: event.confidence }),
        React.createElement("span", { style: { color: "#CBD5E1" } }, "·"),
        React.createElement(window.StatusBadge, { status: event.status })
      )
    ),

    // Arrow
    React.createElement(
      "span",
      { style: { color: "#CBD5E1", flexShrink: 0 } },
      "→"
    )
  );
}

Object.assign(window, { CameraDetailPage });
