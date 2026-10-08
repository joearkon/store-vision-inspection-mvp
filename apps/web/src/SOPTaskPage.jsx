import React from "react";
import {apiUrl} from "./api";
import {useSop, Card, Button} from "./SopContext";
// SOP Task Detail Page - Checklist execution details with AI verification

export function SOPTaskPage({ taskId, onNavigate }) {
 const {data,saveTemplate: persistTemplate,removeTemplate,refresh} = useSop();
  const task = data.tasks.find(t => t.id === taskId) ;
  if (!task) return React.createElement(Card,{},"任务不存在或不属于该门店");
  const template = data.templates.find(t => t.id === task.templateId);
  const records = data.records.filter(r => r.taskId === task.id);
  const cameraImages = data.cameraImages;

  const color = template?.color || "#4F46E5";

  // Group records by category
  const categories = {};
  records.forEach(r => {
    if (!categories[r.category]) categories[r.category] = [];
    categories[r.category].push(r);
  });

  const passCount = records.filter(r => r.result === "pass").length;
  const failCount = records.filter(r => r.result === "fail").length;
  const aiVerifiedCount = records.filter(r => r.aiVerified).length;
  const passRate = records.length > 0 ? Math.round((passCount / records.length) * 100) : 0;

  const statusMap = {
    pending: { text: "待开始", color: "#64748B", bg: "rgba(100, 116, 139, 0.1)" },
    in_progress: { text: "进行中", color: "#2563EB", bg: "rgba(37, 99, 235, 0.1)" },
    completed: { text: "已完成", color: "#059669", bg: "rgba(5, 150, 105, 0.1)" }
  };
  const s = statusMap[task.status] || statusMap.completed;

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
          onClick: () => onNavigate("sop"),
          style: { cursor: "pointer", color: "#4F46E5", fontWeight: 500 }
        },
        "SOP 巡检"
      ),
      React.createElement("span", { style: { color: "#CBD5E1" } }, "/"),
      React.createElement("span", { style: { color: "#334155" } }, task.name)
    ),

    // Header card
    React.createElement(
      Card,
      { padding: "0px" },
      React.createElement(
        "div",
        {
          style: {
            padding: "24px",
            background: `linear-gradient(135deg, ${color}08 0%, #FFFFFF 100%)`,
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "20px"
          }
        },
        // Left
        React.createElement(
          "div",
          { style: { display: "flex", gap: "16px", alignItems: "flex-start" } },
          React.createElement(
            "div",
            {
              style: {
                width: "56px",
                height: "56px",
                borderRadius: "12px",
                background: `${color}18`,
                color: color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }
            },
            React.createElement("span", {
              dangerouslySetInnerHTML: {
                __html: template?.icon === "sunrise"
                  ? '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h20"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 6 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/></svg>'
                  : template?.icon === "moon"
                  ? '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
                  : '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
              }
            })
          ),
          React.createElement(
            "div",
            {},
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" } },
              React.createElement("h1", {
                style: { fontSize: "20px", fontWeight: 700, color: "#0F172A", margin: 0, lineHeight: 1.3 }
              }, task.name),
              React.createElement(
                "span",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    background: s.bg,
                    color: s.color,
                    fontSize: "12px",
                    fontWeight: 600
                  }
                },
                task.status === "in_progress" && React.createElement("span", {
                  style: { width: "6px", height: "6px", borderRadius: "50%", background: s.color, animation: "pulse 1s infinite" }
                }),
                s.text
              )
            ),
            React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  fontSize: "12px",
                  color: "#64748B"
                }
              },
              React.createElement("span", {
                style: { fontFamily: "'SF Mono', monospace", color: "#94A3B8" }
              }, task.id),
              React.createElement("span", { style: { color: "#CBD5E1" } }, "·"),
              React.createElement("span", {}, `${template?.typeName} · ${template?.frequency}`),
              React.createElement("span", { style: { color: "#CBD5E1" } }, "·"),
              React.createElement("span", {}, task.date)
            )
          )
        ),
        // Right stats
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              gap: "24px"
            }
          },
          React.createElement(SummaryStat2, { label: "检查项", value: `${task.completedItems}/${task.totalItems}`, accent: "#0F172A" }),
          React.createElement(SummaryStat2, { label: "通过率", value: `${passRate}%`, accent: passRate >= 80 ? "#10B981" : passRate >= 50 ? "#F59E0B" : "#DC2626" }),
          React.createElement(SummaryStat2, { label: "AI 核验", value: `${aiVerifiedCount} 项`, accent: "#7C3AED" })
        )
      ),

      // Execution info
      React.createElement(
        "div",
        {
          style: {
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            gap: "32px",
            borderBottom: "1px solid #E2E8F0",
            background: "#F8FAFC",
            flexWrap: "wrap"
          }
        },
        React.createElement(InfoItem3, { label: "计划时间", value: task.scheduledTime, mono: true }),
        React.createElement("div", { style: { width: "1px", height: "28px", background: "#E2E8F0" } }),
        React.createElement(InfoItem3, { label: "核验开始", value: task.startTime || "尚无核验记录", mono: true }),
        React.createElement("div", { style: { width: "1px", height: "28px", background: "#E2E8F0" } }),
        React.createElement(InfoItem3, { label: "完成时间", value: task.completedTime || "—", mono: true }),
        React.createElement("div", { style: { width: "1px", height: "28px", background: "#E2E8F0" } }),
        React.createElement(InfoItem3, { label: "执行人员", value: task.assignee || "待领取" }),
        task.duration && React.createElement(
          React.Fragment,
          null,
          React.createElement("div", { style: { width: "1px", height: "28px", background: "#E2E8F0" } }),
          React.createElement(InfoItem3, { label: "耗时", value: task.duration, mono: true })
        )
      )
    ),

    // Main: Checklist (left) + Summary (right)
    React.createElement(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: "20px",
          alignItems: "start"
        }
      },
      // Checklist - grouped by category
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "16px" } },
        Object.keys(categories).map(cat => {
          const items = categories[cat];
          const catPass = items.filter(i => i.result === "pass").length;
          const catFail = items.filter(i => i.result === "fail").length;
          return React.createElement(
            Card,
            { key: cat, padding: "0px" },
            React.createElement(
              "div",
              {
                style: {
                  padding: "14px 20px",
                  borderBottom: "1px solid #E2E8F0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#F8FAFC"
                }
              },
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "8px" } },
                React.createElement("div", {
                  style: { width: "3px", height: "14px", borderRadius: "2px", background: color }
                }),
                React.createElement("h3", {
                  style: { fontSize: "14px", fontWeight: 600, color: "#0F172A", margin: 0 }
                }, cat)
              ),
              React.createElement(
                "div",
                { style: { display: "flex", gap: "10px", alignItems: "center", fontSize: "11px", color: "#64748B" } },
                `${items.length} 项`,
                catFail > 0 ? (
                  React.createElement(
                    "span",
                    { style: { color: "#DC2626", fontWeight: 600 } },
                    `${catFail} 项未通过`
                  )
                ) : (
                  React.createElement(
                    "span",
                    { style: { color: catPass===items.length ? "#10B981":"#64748B", fontWeight: 600 } },
                    catPass===items.length ? "全部通过" : `已通过 ${catPass}/${items.length} 项`
                  )
                )
              )
            ),
            React.createElement(
              "div",
              {},
              items.map((item, idx) => React.createElement(ChecklistItemRow, {
                key: item.id,
                item,
                cameraImages,
                isLast: idx === items.length - 1,
                onViewIssue: item.eventId
                  ? () => onNavigate("event", { eventId: item.eventId })
                  : null
              }))
            )
          );
        })
      ),

      // Right sidebar
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "16px" } },
        // AI contribution card
        React.createElement(
          Card,
          { padding: "0px" },
          React.createElement(
            "div",
            {
              style: {
                padding: "14px 20px",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }
            },
            React.createElement("span", {
              style: {
                width: "18px",
                height: "18px",
                color: "#7C3AED",
                display: "flex"
              },
              dangerouslySetInnerHTML: {
                __html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h.01M15 9h.01M9 15c.83.83 2.17.83 3 0s2.17-.83 3 0"/></svg>'
              }
            }),
            React.createElement("h4", {
              style: { fontSize: "14px", fontWeight: 600, color: "#0F172A", margin: 0 }
            }, "AI 视觉核验")
          ),
          React.createElement(
            "div",
            { style: { padding: "16px 20px" } },
            // Donut-like progress
            React.createElement(
              "div",
              {
                style: {
                  position: "relative",
                  width: "120px",
                  height: "120px",
                  margin: "0 auto 16px"
                }
              },
              React.createElement("svg", {
                width: "120", height: "120", viewBox: "0 0 120 120"
              },
                React.createElement("circle", {
                  cx: "60", cy: "60", r: "48",
                  fill: "none",
                  stroke: "#E2E8F0",
                  strokeWidth: "10"
                }),
                React.createElement("circle", {
                  cx: "60", cy: "60", r: "48",
                  fill: "none",
                  stroke: "#7C3AED",
                  strokeWidth: "10",
                  strokeLinecap: "round",
                  strokeDasharray: `${aiVerifiedCount / records.length * 301.6} 301.6`,
                  transform: "rotate(-90 60 60)"
                })
              ),
              React.createElement(
                "div",
                {
                  style: {
                    position: "absolute",
                    top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)",
                    textAlign: "center"
                  }
                },
                React.createElement("div", {
                  style: { fontSize: "24px", fontWeight: 700, color: "#7C3AED" }
                }, `${Math.round(aiVerifiedCount / records.length * 100)}%`),
                React.createElement("div", {
                  style: { fontSize: "10px", color: "#94A3B8", marginTop: "2px" }
                }, "自动核验率")
              )
            ),
            // Stats
            React.createElement(
              "div",
              {
                style: {display: "flex",justifyContent: "space-around",padding: "12px 0",borderTop: "1px solid #F1F5F9",textAlign: "center"}
              },
              React.createElement("div", {},
                React.createElement("div", { style: { fontSize: "16px", fontWeight: 700, color: "#0F172A" } }, aiVerifiedCount),
                React.createElement("div", { style: { fontSize: "11px", color: "#94A3B8", marginTop: "2px" } }, "AI 核验")
              ),
              React.createElement("div", {},
                React.createElement("div", { style: { fontSize: "16px", fontWeight: 700, color: "#0F172A" } }, records.filter(r=>r.checkedAt && !r.aiVerified).length),
                React.createElement("div", { style: { fontSize: "11px", color: "#94A3B8", marginTop: "2px" } }, "人工核验")
              ),
              React.createElement("div", {},
                React.createElement("div", { style: { fontSize: "16px", fontWeight: 700, color: "#0F172A" } }, records.length),
                React.createElement("div", { style: { fontSize: "11px", color: "#94A3B8", marginTop: "2px" } }, "总项数")
              )
            )
          )
        ),

        // Issues found card
        failCount > 0 && React.createElement(
          Card,
          { padding: "0px" },
          React.createElement(
            "div",
            {
              style: {
                padding: "14px 20px",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(220, 38, 38, 0.02)"
              }
            },
            React.createElement("span", {
              style: { width: "18px", height: "18px", color: "#DC2626", display: "flex" },
              dangerouslySetInnerHTML: {
                __html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
              }
            }),
            React.createElement("h4", {
              style: { fontSize: "14px", fontWeight: 600, color: "#0F172A", margin: 0 }
            }, `发现 ${failCount} 个问题`)
          ),
          React.createElement(
            "div",
            { style: { padding: "12px 20px" } },
            records.filter(r => r.result === "fail").map(r => React.createElement(
              "div",
              {
                key: r.itemId,
                style: {
                  padding: "10px 0",
                  borderBottom: "1px solid #F1F5F9"
                }
              },
              React.createElement(
                "div",
                {
                  style: {
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#DC2626",
                    marginBottom: "4px",
                    lineHeight: 1.4
                  }
                },
                r.text
              ),
              React.createElement(
                "div",
                {
                  style: {
                    fontSize: "11px",
                    color: "#64748B",
                    lineHeight: 1.5
                  }
                },
                r.issueNote
              ),
              r.checkedAt && React.createElement(
                "div",
                {
                  style: {
                    marginTop: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }
                },
                React.createElement(
                  "span",
                  {
                    fontSize: "11px",
                    color: "#94A3B8",
                    fontFamily: "'SF Mono', monospace"
                  },
                  r.checkedAt
                ),
                React.createElement(
                  "button",
                  {
                    onClick: () => onNavigate("event", { eventId: r.eventId }),
                    style: {
                      fontSize: "11px",
                      color: "#DC2626",
                      fontWeight: 500,
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      fontFamily: "inherit"
                    }
                  },
                  "查看异常事件 →"
                )
              )
            ))
          )
        ),

        null
      )
    )
  );
}

function SummaryStat2({ label, value, accent }) {
  return React.createElement(
    "div",
    { style: { textAlign: "center" } },
    React.createElement("div", {
      style: { fontSize: "24px", fontWeight: 700, color: accent, lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }
    }, value),
    React.createElement("div", { style: { fontSize: "11px", color: "#64748B", marginTop: "6px" } }, label)
  );
}

function InfoItem3({ label, value, mono }) {
  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "10px"
      }
    },
    React.createElement("div", {
      style: { fontSize: "12px", color: "#94A3B8", fontWeight: 500, whiteSpace: "nowrap" }
    }, label),
    React.createElement("div", {
      style: {
        fontSize: "13px",
        fontWeight: 600,
        color: "#0F172A",
        fontFamily: mono ? "'SF Mono', monospace" : "inherit"
      }
    }, value)
  );
}

function ChecklistItemRow({ item, cameraImages, isLast, onViewIssue }) {
  const isFail = item.result === "fail";
  const isPass = item.result === "pass";

  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: "14px",
        padding: "14px 20px",
        borderBottom: isLast ? "none" : "1px solid #F1F5F9",
        background: isFail ? "rgba(220, 38, 38, 0.02)" : "transparent"
      }
    },
    // Status icon
    React.createElement(
      "div",
      {
        style: {
          width: "22px",
          height: "22px",
          borderRadius: "50%",
          flexShrink: 0,
          marginTop: "1px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: isPass ? "rgba(16, 185, 129, 0.1)" : isFail ? "rgba(220, 38, 38, 0.1)" : "transparent",
          border: isPass || isFail ? "none" : "2px solid #CBD5E1",
          color: isPass ? "#10B981" : isFail ? "#DC2626" : "transparent"
        }
      },
      isPass && React.createElement("svg", {
        width: "12", height: "12", viewBox: "0 0 24 24",
        fill: "none", stroke: "currentColor", strokeWidth: "3",
        strokeLinecap: "round", strokeLinejoin: "round"
      },
        React.createElement("polyline", { points: "20 6 9 17 4 12" })
      ),
      isFail && React.createElement("svg", {
        width: "12", height: "12", viewBox: "0 0 24 24",
        fill: "none", stroke: "currentColor", strokeWidth: "3",
        strokeLinecap: "round", strokeLinejoin: "round"
      },
        React.createElement("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
        React.createElement("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
      )
    ),

    // Main content
    React.createElement(
      "div",
      { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "6px" } },
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
            fontSize: "13px",
            fontWeight: 500,
            color: isFail ? "#DC2626" : "#0F172A",
            lineHeight: 1.4
          }
        }, item.text),
        item.required && React.createElement(
          "span",
          {
            style: {
              fontSize: "10px",
              padding: "1px 6px",
              borderRadius: "3px",
              background: "rgba(220, 38, 38, 0.1)",
              color: "#DC2626",
              fontWeight: 600
            }
          },
          "必检"
        )
      ),
      item.issueNote && React.createElement(
        "p",
        {
          style: {
            fontSize: "12px",
            color: isPass ? "#059669" : isFail ? "#B91C1C" : "#EA580C",
            margin: 0,
            lineHeight: 1.5,
            background: isPass ? "rgba(5,150,105,0.06)" : "rgba(220, 38, 38, 0.04)",
            padding: "8px 10px",
            borderRadius: "6px"
          }
        },
        item.issueNote
      ),
      // Meta row
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "11px",
            color: "#94A3B8",
            flexWrap: "wrap"
          }
        },
        React.createElement("span", {}, item.checkedBy),
        item.checkedAt && React.createElement(
          React.Fragment, null,
          React.createElement("span", { style: { color: "#CBD5E1" } }, "·"),
          React.createElement("span", { style: { fontFamily: "'SF Mono', monospace" } }, item.checkedAt)
        ),
        item.aiVerified && item.aiConfidence && React.createElement(
          React.Fragment, null,
          React.createElement("span", { style: { color: "#CBD5E1" } }, "·"),
          React.createElement(
            "span",
            {
              style: {
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "1px 6px",
                borderRadius: "4px",
                background: "rgba(124, 58, 237, 0.08)",
                color: "#7C3AED",
                fontWeight: 500
              }
            },
            React.createElement("span", {
              dangerouslySetInnerHTML: {
                __html: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h.01M15 9h.01"/></svg>'
              }
            }),
            `置信度 ${item.aiConfidence}%`
          )
        ),
        onViewIssue && React.createElement(
          "button",
          {
            onClick: onViewIssue,
            style: {
              fontSize: "11px",
              color: "#4F46E5",
              fontWeight: 500,
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontFamily: "inherit"
            }
          },
          "查看异常事件 →"
        )
      )
    ),

    // Evidence thumbnail if available
    item.evidenceImage && React.createElement(
      "div",
      {
        style: {
          width: "72px",
          height: "40px",
          borderRadius: "4px",
          overflow: "hidden",
          flexShrink: 0,
          background: "#1E293B",
          cursor: "pointer",
          border: isFail ? "1.5px solid #DC2626" : "1px solid #E2E8F0"
        }
      },
      React.createElement("img", {
        src: apiUrl(cameraImages[item.evidenceImage]),
        alt: "evidence",
        style: { width: "100%", height: "100%", objectFit: "cover" }
      })
    )
  );
}

