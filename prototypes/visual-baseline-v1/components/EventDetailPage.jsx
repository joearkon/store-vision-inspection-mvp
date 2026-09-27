// Event Detail Page - Video player + AI analysis + actions

function EventDetailPage({ eventId, onNavigate }) {
  const event = window.EVENTS.find(e => e.id === eventId) || window.EVENTS[0];
  const cameraImages = window.CAMERA_IMAGES;
  const [resolved, setResolved] = React.useState(false);
  const [showAssignModal, setShowAssignModal] = React.useState(false);

  const sevStyle = window.SEVERITY_STYLES[event.severity];

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
          "仪表盘"
        ),
        React.createElement("span", { style: { color: "#CBD5E1" } }, "/"),
        React.createElement(
          "a",
          {
            onClick: () => onNavigate("rectification"),
            style: { cursor: "pointer", color: "#4F46E5", fontWeight: 500 }
          },
          "事件列表"
        ),
        React.createElement("span", { style: { color: "#CBD5E1" } }, "/"),
        React.createElement("span", { style: { color: "#334155" } }, event.id)
      ),

      // Header
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "20px"
          }
        },
        React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "10px" } },
          React.createElement(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "12px" } },
            React.createElement(window.SeverityBadge, { severity: event.severity, size: "lg" }),
            React.createElement("h1", {
              style: {
                fontSize: "20px",
                fontWeight: 700,
                color: "#0F172A",
                margin: 0,
                lineHeight: 1.3
              }
            }, event.typeName),
            React.createElement(window.StatusBadge, { status: resolved ? "resolved" : event.status, size: "lg" })
          ),
          React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "16px",
                fontSize: "12px",
                color: "#64748B"
              }
            },
            React.createElement("span", { style: { display: "flex", alignItems: "center", gap: "5px" } },
              React.createElement("span", { dangerouslySetInnerHTML: { __html: window.ICONS.event } }),
              event.id
            ),
            React.createElement("span", { style: { color: "#CBD5E1" } }, "·"),
            React.createElement("span", { style: { display: "flex", alignItems: "center", gap: "5px" } },
              React.createElement("span", { dangerouslySetInnerHTML: { __html: window.ICONS.camera } }),
              `${event.cameraName} · ${event.locationZh}`
            ),
            React.createElement("span", { style: { color: "#CBD5E1" } }, "·"),
            React.createElement("span", { style: { display: "flex", alignItems: "center", gap: "5px" } },
              React.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                React.createElement("circle", { cx: "12", cy: "12", r: "10" }),
                React.createElement("polyline", { points: "12 6 12 12 16 14" })
              ),
              event.timestamp
            )
          )
        ),
        React.createElement(
          "div",
          { style: { display: "flex", gap: "10px" } },
          React.createElement(
            window.Button,
            {
              variant: resolved ? "secondary" : "primary",
              onClick: () => setResolved(!resolved)
            },
            resolved ? "撤销已解决" : "标记已解决"
          ),
          React.createElement(
            window.Button,
            { variant: "secondary", onClick: () => setShowAssignModal(true) },
            "指派整改"
          )
        )
      ),

      // Main content: Video + Analysis panel
      React.createElement(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "1fr 420px",
            gap: "20px"
          }
        },
        // Video player area
        React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "16px" } },
          // Video frame
          React.createElement(
            "div",
            {
              style: {
                background: "#000000",
                borderRadius: "8px",
                overflow: "hidden",
                position: "relative",
                aspectRatio: "16/9"
              }
            },
            React.createElement("img", {
              src: cameraImages[event.imageKey],
              alt: "video frame",
              style: { width: "100%", height: "100%", objectFit: "cover" }
            }),
            // Anomaly bounding box overlay
            React.createElement(
              "div",
              {
                style: {
                  position: "absolute",
                  left: "35%",
                  top: "40%",
                  width: "20%",
                  height: "35%",
                  border: `2px solid ${sevStyle.text}`,
                  borderRadius: "2px",
                  boxShadow: `0 0 0 2px rgba(0,0,0,0.3), inset 0 0 20px ${sevStyle.text}30`
                }
              },
              React.createElement(
                "div",
                {
                  style: {
                    position: "absolute",
                    top: "-28px",
                    left: "-2px",
                    background: sevStyle.text,
                    color: "#FFFFFF",
                    padding: "3px 8px",
                    fontSize: "11px",
                    fontWeight: 600,
                    borderRadius: "2px 2px 0 0",
                    whiteSpace: "nowrap"
                  }
                },
                `${event.type} ${event.typeName} · ${event.confidence}%`
              )
            ),
            // Video controls bar
            React.createElement(
              "div",
              {
                style: {
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)",
                  padding: "30px 16px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }
              },
              // Timeline
              React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    position: "relative"
                  }
                },
                React.createElement("span", {
                  style: { color: "#94A3B8", fontSize: "11px", fontFamily: "'SF Mono', monospace", width: "36px" }
                }, "00:00"),
                React.createElement(
                  "div",
                  {
                    style: {
                      flex: 1,
                      height: "4px",
                      background: "rgba(255,255,255,0.2)",
                      borderRadius: "2px",
                      position: "relative"
                    }
                  },
                  // Anomaly markers
                  React.createElement("div", {
                    style: {
                      position: "absolute",
                      left: "32%",
                      top: "-3px",
                      width: "12%",
                      height: "10px",
                      background: sevStyle.text,
                      borderRadius: "2px",
                      opacity: 0.8
                    },
                    title: `异常时段 · ${event.typeName}`
                  }),
                  // Playhead
                  React.createElement("div", {
                    style: {
                      position: "absolute",
                      left: "38%",
                      top: "-4px",
                      width: "12px",
                      height: "12px",
                      background: "#FFFFFF",
                      borderRadius: "50%",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
                      transform: "translateX(-50%)"
                    }
                  })
                ),
                React.createElement("span", {
                  style: { color: "#94A3B8", fontSize: "11px", fontFamily: "'SF Mono', monospace", width: "36px", textAlign: "right" }
                }, "00:15")
              ),
              // Controls
              React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    color: "#FFFFFF",
                    fontSize: "12px"
                  }
                },
                React.createElement(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "16px" } },
                  React.createElement("button", {
                    style: {
                      background: "transparent",
                      border: "none",
                      color: "#FFFFFF",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      alignItems: "center"
                    },
                    dangerouslySetInnerHTML: {
                      __html: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
                    }
                  }),
                  React.createElement("span", { style: { fontFamily: "'SF Mono', monospace" } }, "00:05 / 00:15"),
                  React.createElement("span", { style: { color: "#94A3B8" } }, "1x")
                ),
                React.createElement(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "12px" } },
                  React.createElement("button", {
                    style: {
                      background: "transparent",
                      border: "none",
                      color: "#94A3B8",
                      cursor: "pointer",
                      padding: 0
                    },
                    dangerouslySetInnerHTML: {
                      __html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>'
                    }
                  }),
                  React.createElement("button", {
                    style: {
                      background: "transparent",
                      border: "none",
                      color: "#94A3B8",
                      cursor: "pointer",
                      padding: 0
                    },
                    dangerouslySetInnerHTML: {
                      __html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>'
                    }
                  }),
                  React.createElement("button", {
                    style: {
                      background: "transparent",
                      border: "none",
                      color: "#94A3B8",
                      cursor: "pointer",
                      padding: 0
                    },
                    dangerouslySetInnerHTML: {
                      __html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>'
                    }
                  })
                )
              )
            )
          ),

          // Timeline details
          React.createElement(
            window.Card,
            { padding: "16px 20px" },
            React.createElement("h4", {
              style: {
                fontSize: "13px",
                fontWeight: 600,
                color: "#0F172A",
                margin: "0 0 14px 0"
              }
            }, "时间线 · 异常检测过程"),
            React.createElement(
              "div",
              { style: { position: "relative", paddingLeft: "20px" } },
              React.createElement("div", {
                style: {
                  position: "absolute",
                  left: "5px",
                  top: "4px",
                  bottom: "4px",
                  width: "2px",
                  background: "#E2E8F0"
                }
              }),
              [
                { time: "09:23:02", text: "AI 开始第 47 帧分析", type: "info" },
                { time: "09:23:05", text: "检测到疑似异常（置信度 78%）", type: "warn" },
                { time: "09:23:07", text: `确认异常：${event.typeName}（置信度 ${event.confidence}%）`, type: "danger" },
                { time: "09:23:08", text: "P0 告警已生成，推送至飞书 IM", type: "info" },
                { time: "09:25:33", text: "店长李明已查看告警", type: "success" },
                resolved ? { time: "09:28:42", text: "事件已标记为已解决", type: "success" } : null
              ].filter(Boolean).map((item, i) => React.createElement(TimelineItem, { key: i, ...item }))
            )
          )
        ),

        // AI Analysis panel
        React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "16px" } },
          // AI Analysis header
          React.createElement(
            "div",
            {
              style: {
                background: `linear-gradient(135deg, ${sevStyle.text}10 0%, #4F46E508 100%)`,
                borderRadius: "8px",
                border: `1px solid ${sevStyle.border}`,
                padding: "18px 20px"
              }
            },
            React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "10px"
                }
              },
              React.createElement(
                "span",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#7C3AED",
                    background: "rgba(124, 58, 237, 0.1)",
                    padding: "3px 8px",
                    borderRadius: "4px"
                  }
                },
                React.createElement("svg", {
                  width: "12", height: "12", viewBox: "0 0 24 24",
                  fill: "none", stroke: "currentColor", strokeWidth: "2.5",
                  strokeLinecap: "round", strokeLinejoin: "round"
                },
                  React.createElement("path", { d: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" })
                ),
                "AI 视觉分析"
              ),
              React.createElement(window.ConfidenceChip, { confidence: event.confidence, size: "sm" })
            ),
            React.createElement("h3", {
              style: {
                fontSize: "16px",
                fontWeight: 700,
                color: "#0F172A",
                margin: "0 0 8px 0",
                lineHeight: 1.4
              }
            }, event.description),
            React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap"
                }
              },
              React.createElement("span", {
                style: {
                  fontSize: "11px",
                  color: "#64748B",
                  background: "rgba(100, 116, 139, 0.1)",
                  padding: "3px 8px",
                  borderRadius: "4px"
                }
              }, event.categoryZh),
              React.createElement("span", {
                style: {
                  fontSize: "11px",
                  color: "#64748B",
                  background: "rgba(100, 116, 139, 0.1)",
                  padding: "3px 8px",
                  borderRadius: "4px"
                }
              }, `编码：${event.type}`),
              React.createElement("span", {
                style: {
                  fontSize: "11px",
                  color: "#64748B",
                  background: "rgba(100, 116, 139, 0.1)",
                  padding: "3px 8px",
                  borderRadius: "4px"
                }
              }, "豆包 Doubao-vision")
            )
          ),

          // Evidence
          React.createElement(
            window.Card,
            { padding: "16px 20px" },
            React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "10px"
                }
              },
              React.createElement("svg", {
                width: "16", height: "16", viewBox: "0 0 24 24",
                fill: "none", stroke: "#DC2626", strokeWidth: "2",
                strokeLinecap: "round", strokeLinejoin: "round"
              },
                React.createElement("path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" }),
                React.createElement("circle", { cx: "12", cy: "12", r: "3" })
              ),
              React.createElement("h4", {
                style: { fontSize: "13px", fontWeight: 600, color: "#0F172A", margin: 0 }
              }, "视觉证据")
            ),
            React.createElement("p", {
              style: {
                fontSize: "13px",
                color: "#334155",
                margin: 0,
                lineHeight: 1.6,
                padding: "10px 12px",
                background: "#F8FAFC",
                borderRadius: "6px",
                border: "1px solid #E2E8F0",
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                fontSize: "12px"
              }
            }, event.evidence)
          ),

          // Rule Reference
          React.createElement(
            window.Card,
            { padding: "16px 20px" },
            React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "10px"
                }
              },
              React.createElement("svg", {
                width: "16", height: "16", viewBox: "0 0 24 24",
                fill: "none", stroke: "#2563EB", strokeWidth: "2",
                strokeLinecap: "round", strokeLinejoin: "round"
              },
                React.createElement("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }),
                React.createElement("polyline", { points: "14 2 14 8 20 8" }),
                React.createElement("line", { x1: "16", y1: "13", x2: "8", y2: "13" }),
                React.createElement("line", { x1: "16", y1: "17", x2: "8", y2: "17" })
              ),
              React.createElement("h4", {
                style: { fontSize: "13px", fontWeight: 600, color: "#0F172A", margin: 0 }
              }, "规则依据")
            ),
             React.createElement("p", {
               style: {
                 fontSize: "12px",
                 color: "#1E40AF",
                 margin: 0,
                 lineHeight: 1.6,
                 fontWeight: 500,
                 padding: "10px 12px",
                 background: "rgba(37, 99, 235, 0.05)",
                 border: "1px solid rgba(37, 99, 235, 0.15)",
                 borderRadius: "6px",
                 borderLeft: "3px solid #2563EB"
               }
             }, event.ruleReference)
          ),

          // Suggestion
          React.createElement(
            window.Card,
            { padding: "16px 20px" },
            React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "10px"
                }
              },
              React.createElement("svg", {
                width: "16", height: "16", viewBox: "0 0 24 24",
                fill: "none", stroke: "#059669", strokeWidth: "2",
                strokeLinecap: "round", strokeLinejoin: "round"
              },
                React.createElement("path", { d: "M9 11l3 3L22 4" }),
                React.createElement("path", { d: "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" })
              ),
              React.createElement("h4", {
                style: { fontSize: "13px", fontWeight: 600, color: "#0F172A", margin: 0 }
              }, "整改建议")
            ),
            React.createElement("p", {
              style: {
                fontSize: "13px",
                color: "#334155",
                margin: 0,
                lineHeight: 1.6
              }
            }, event.suggestion)
          ),

          // SLA info
          React.createElement(
            "div",
            {
              style: {
                padding: "14px 16px",
                borderRadius: "8px",
                background: event.status === "overdue"
                  ? "rgba(127, 29, 29, 0.08)"
                  : "rgba(245, 158, 11, 0.08)",
                border: `1px solid ${event.status === "overdue" ? "rgba(127, 29, 29, 0.2)" : "rgba(245, 158, 11, 0.2)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }
            },
            React.createElement(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "2px" } },
              React.createElement("span", {
                style: { fontSize: "11px", color: "#64748B", fontWeight: 500 }
              }, "SLA 响应时效"),
              React.createElement("span", {
                style: {
                  fontSize: "14px",
                  fontWeight: 700,
                  color: event.status === "overdue" ? "#991B1B" : "#B45309"
                }
              }, `${event.slaMinutes} 分钟内处理`)
            ),
            React.createElement(
              "div",
              { style: { textAlign: "right" } },
              React.createElement("span", {
                style: {
                  fontSize: "20px",
                  fontWeight: 700,
                  fontFamily: "'SF Mono', monospace",
                  color: event.status === "overdue" ? "#991B1B" : "#B45309"
                }
              }, event.slaRemaining),
              React.createElement("div", {
                style: { fontSize: "10px", color: "#92400E", marginTop: "2px" }
              }, event.status === "overdue" ? "已超时" : "剩余时间")
            )
          )
        )
      ),

      // Assign modal
      showAssignModal && React.createElement(AssignModal, {
        onClose: () => setShowAssignModal(false),
        eventId: event.id
      })
    );
}

function TimelineItem({ time, text, type }) {
  const colors = {
    info: { dot: "#2563EB", bg: "rgba(37, 99, 235, 0.15)" },
    warn: { dot: "#D97706", bg: "rgba(217, 119, 6, 0.15)" },
    danger: { dot: "#DC2626", bg: "rgba(220, 38, 38, 0.15)" },
    success: { dot: "#059669", bg: "rgba(5, 150, 105, 0.15)" }
  };
  const c = colors[type] || colors.info;

  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        padding: "8px 0",
        position: "relative"
      }
    },
    React.createElement("div", {
      style: {
        position: "absolute",
        left: "-17px",
        top: "11px",
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        background: c.dot,
        border: "2px solid #FFFFFF",
        boxShadow: `0 0 0 2px ${c.bg}`
      }
    }),
    React.createElement(
      "span",
      {
        style: {
          fontSize: "11px",
          color: "#94A3B8",
          fontFamily: "'SF Mono', monospace",
          width: "60px",
          flexShrink: 0,
          paddingTop: "1px"
        }
      },
      time
    ),
    React.createElement(
      "span",
      {
        style: {
          fontSize: "12px",
          color: "#334155",
          lineHeight: 1.5
        }
      },
      text
    )
  );
}

function AssignModal({ onClose, eventId }) {
  const [assignee, setAssignee] = React.useState("");
  const [note, setNote] = React.useState("");

  return React.createElement(
    "div",
    {
      style: {
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(4px)"
      },
      onClick: onClose
    },
    React.createElement(
      "div",
      {
        onClick: e => e.stopPropagation(),
        style: {
          background: "#FFFFFF",
          borderRadius: "10px",
          width: "480px",
          boxShadow: "0 20px 40px rgba(15, 23, 42, 0.2)",
          overflow: "hidden"
        }
      },
      React.createElement(
        "div",
        {
          style: {
            padding: "18px 20px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }
        },
        React.createElement("h3", {
          style: { fontSize: "15px", fontWeight: 600, color: "#0F172A", margin: 0 }
        }, "指派整改"),
        React.createElement(
          "button",
          {
            onClick: onClose,
            style: {
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#94A3B8",
              fontSize: "20px",
              padding: "4px"
            }
          },
          "×"
        )
      ),
      React.createElement(
        "div",
        { style: { padding: "20px", display: "flex", flexDirection: "column", gap: "16px" } },
        React.createElement(
          "div",
          {},
          React.createElement("label", {
            style: {
              display: "block",
              fontSize: "12px",
              fontWeight: 500,
              color: "#334155",
              marginBottom: "6px"
            }
          }, "指派给"),
          React.createElement(
            "select",
            {
              value: assignee,
              onChange: e => setAssignee(e.target.value),
              style: {
                width: "100%",
                padding: "8px 12px",
                fontSize: "13px",
                border: "1px solid #CBD5E1",
                borderRadius: "6px",
                background: "#FFFFFF",
                color: "#0F172A",
                fontFamily: "inherit"
              }
            },
            React.createElement("option", { value: "" }, "请选择负责人"),
            React.createElement("option", { value: "李明（店长）" }, "李明（店长）"),
            React.createElement("option", { value: "王芳（后厨主管）" }, "王芳（后厨主管）"),
            React.createElement("option", { value: "张伟（前台主管）" }, "张伟（前台主管）"),
            React.createElement("option", { value: "赵丽（运营督导）" }, "赵丽（运营督导）")
          )
        ),
        React.createElement(
          "div",
          {},
          React.createElement("label", {
            style: {
              display: "block",
              fontSize: "12px",
              fontWeight: 500,
              color: "#334155",
              marginBottom: "6px"
            }
          }, "备注说明"),
          React.createElement(
            "textarea",
            {
              value: note,
              onChange: e => setNote(e.target.value),
              placeholder: "请输入整改要求或备注说明…",
              rows: 3,
              style: {
                width: "100%",
                padding: "8px 12px",
                fontSize: "13px",
                border: "1px solid #CBD5E1",
                borderRadius: "6px",
                background: "#FFFFFF",
                color: "#0F172A",
                fontFamily: "inherit",
                resize: "vertical",
                boxSizing: "border-box"
              }
            }
          )
        )
      ),
      React.createElement(
        "div",
        {
          style: {
            padding: "14px 20px",
            borderTop: "1px solid #E2E8F0",
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            background: "#F8FAFC"
          }
        },
        React.createElement(window.Button, { variant: "secondary", onClick: onClose }, "取消"),
        React.createElement(
          window.Button,
          {
            variant: "primary",
            onClick: () => {
              // Mock assign
              onClose();
            }
          },
          "确认指派"
        )
      )
    )
  );
}

Object.assign(window, { EventDetailPage });
