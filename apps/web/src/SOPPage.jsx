import {sopMetrics} from "./sopMetrics";
import React from "react";
import {useSop, Card, Button} from "./SopContext";
// SOP Inspection Page - Active SOP checklists management

export function SOPPage({ onNavigate, storeId }) {
 const {data,saveTemplate: persistTemplate,removeTemplate,refresh} = useSop();
  const [filterStatus, setFilterStatus] = React.useState("all");

  const templates = data.templates;
  const allTasks = data.tasks;
  const stores = data.stores || [];

  // Filter by store
  const storeTasks = storeId ? allTasks.filter(t => t.storeId === storeId) : allTasks;
  const currentStore = storeId ? stores.find(s => s.id === storeId) : null;

  // Compute store-level stats
  const todayTotal = storeTasks.length;
  const completed = storeTasks.filter(t => t.status === "completed").length;
  const inProgress = storeTasks.filter(t => t.status === "in_progress").length;
  const pending = storeTasks.filter(t => t.status === "pending").length;
  const metrics = sopMetrics(storeTasks, data.records || []);

  const filteredTasks = filterStatus === "all"
    ? storeTasks
    : storeTasks.filter(t => t.status === filterStatus);

  return React.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "20px" } },

    // Header
    React.createElement(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-end" } },
      React.createElement(
        "div",
        {},
        React.createElement("h1", {
          style: { fontSize: "22px", fontWeight: 700, color: "#0F172A", margin: "0 0 6px 0" }
        }, "主动巡检 · SOP 管理"),
        React.createElement("p", {
          style: { fontSize: "13px", color: "#64748B", margin: 0, lineHeight: 1.5 }
        }, "门店日常 SOP 巡检模板配置、任务执行与结果核查，AI 视觉辅助自动核验")
      ),
      React.createElement(
        "div",
        { style: { display: "flex", gap: "8px" } },
        React.createElement(Button, { variant: "secondary", onClick: () => onNavigate("sopTemplates") }, "模板配置"),
        React.createElement(Button, { variant: "primary", onClick: () => onNavigate("sopTemplates") }, "+ 新建 SOP 模板")
      )
    ),

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
      React.createElement(StatCard, {
        label: "今日巡检任务",
        value: todayTotal,
        sub: `已完成 ${completed} · 进行中 ${inProgress} · 待开始 ${pending}`,
        accent: "#4F46E5",
        iconType: "tasks"
      }),
      React.createElement(StatCard, {
        label: "任务完成率",
        value: metrics.completionRate == null ? "—" : `${metrics.completionRate}%`,
        sub: `${completed}/${todayTotal} 个任务完成 · 已核验 ${metrics.checked}/${metrics.totalItems} 项`,
        accent: "#10B981",
        iconType: "check"
      }),
      React.createElement(StatCard, {
        label: "已确认问题",
        value: metrics.issues,
        sub: `待二次核验 ${metrics.review} 项 · 未完成核验 ${metrics.unverified} 项`,
        accent: "#DC2626",
        iconType: "alert"
      }),
      React.createElement(StatCard, {
        label: "AI 核验占比",
        value: metrics.aiShare == null ? "—" : `${metrics.aiShare}%`,
        sub: metrics.checked ? `已核验 ${metrics.checked} 项中 AI 核验 ${metrics.ai} 项` : "暂无已核验检查项",
        accent: "#7C3AED",
        iconType: "robot"
      })
    ),

    // Toolbar: store selector + template link
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px"
        }
      },
      // Store selector (shown when navigating from portfolio view)
      !storeId && React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "10px" } },
        React.createElement("span", { style: { fontSize: "13px", color: "#64748B" } }, "选择门店："),
        React.createElement(
          "select",
          {
            defaultValue: "",
            onChange: e => e.target.value && onNavigate("sop", { storeId: e.target.value }),
            style: {
              padding: "7px 12px",
              border: "1px solid #E2E8F0",
              borderRadius: "6px",
              fontSize: "13px",
              background: "#FFFFFF",
              color: "#0F172A",
              outline: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              minWidth: "180px"
            }
          },
          React.createElement("option", { value: "", disabled: true }, "请选择门店"),
          stores.map(s =>
            React.createElement("option", { key: s.id, value: s.id }, `${s.nameZh || s.name} · ${s.city}`)
          )
        )
      ),
      storeId && currentStore && React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px" } },
        React.createElement("span", {
          style: {
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "5px 12px",
            background: "#EEF2FF",
            color: "#4F46E5",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 500
          }
        },
          React.createElement("span", { style: { width: "6px", height: "6px", borderRadius: "50%", background: currentStore.status === "online" ? "#10B981" : "#94A3B8" } }),
          `${currentStore.nameZh || currentStore.name}`
        ),
        React.createElement(
          "button",
          {
            onClick: () => document.querySelector(".sop-store-selector select")?.focus(),
            style: {
              fontSize: "12px",
              color: "#94A3B8",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px"
            }
          },
          "切换门店"
        )
      ),
      React.createElement(
        "div",
        { style: { display: "flex", gap: "8px" } },
        React.createElement(Button, { variant: "secondary", onClick: () => onNavigate("sopTemplates") }, "模板配置")
      )
    ),

    // Task list content
    React.createElement(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "16px" } },
      // Filter bar
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }
        },
        React.createElement(
          "div",
          { style: { display: "flex", gap: "6px" } },
          [
            { key: "all", label: "全部" },
            { key: "in_progress", label: "进行中" },
            { key: "completed", label: "已完成" },
            { key: "pending", label: "待开始" }
          ].map(f => React.createElement(
            "button",
            {
              key: f.key,
              onClick: () => setFilterStatus(f.key),
              style: {
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: 500,
                border: `1px solid ${filterStatus === f.key ? "#4F46E5" : "#E2E8F0"}`,
                borderRadius: "6px",
                background: filterStatus === f.key ? "rgba(79, 70, 229, 0.06)" : "#FFFFFF",
                color: filterStatus === f.key ? "#4F46E5" : "#64748B",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.15s"
              }
            },
            f.label
          ))
        ),
        React.createElement(
          "div",
          { style: { display: "flex", gap: "8px" } },
          React.createElement(
            "select",
            {
              style: {
                padding: "6px 10px",
                fontSize: "12px",
                border: "1px solid #E2E8F0",
                borderRadius: "6px",
                background: "#FFFFFF",
                color: "#334155",
                fontFamily: "inherit"
              }
            },
            React.createElement("option", {}, "今天"),
            
            
          )
        )
      ),

      // Tasks list
      React.createElement(
        Card,
        { padding: "0px" },
        !storeId ? (
          React.createElement(
            "div",
            {
              style: {
                padding: "64px 24px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px"
              }
            },
            React.createElement("div", {
              style: {
                width: "48px", height: "48px",
                borderRadius: "50%",
                background: "#F1F5F9",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#94A3B8"
              }
            },
              React.createElement("svg", {
                width: "24", height: "24", viewBox: "0 0 24 24",
                fill: "none", stroke: "currentColor", strokeWidth: "2",
                strokeLinecap: "round", strokeLinejoin: "round"
              },
                React.createElement("path", { d: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" }),
                React.createElement("circle", { cx: "12", cy: "10", r: "3" })
              )
            ),
            React.createElement("div", {
              style: { fontSize: "14px", color: "#334155", fontWeight: 500 }
            }, "请先选择门店"),
            React.createElement("div", {
              style: { fontSize: "12px", color: "#94A3B8", lineHeight: 1.5, maxWidth: "360px" }
            }, "选择门店后，将展示该门店今日的 SOP 巡检任务与执行进度")
          )
        ) : filteredTasks.length === 0 ? (
          React.createElement(
            "div",
            { style: { padding: "48px 24px", textAlign: "center", color: "#94A3B8", fontSize: "13px" } },
            "暂无符合条件的巡检任务"
          )
        ) : (
          React.createElement(
            "div",
            {},
            filteredTasks.map((task, i) => React.createElement(SOPTaskRow, {
              key: task.id,
              task,
              template: templates.find(t => t.id === task.templateId),
              onClick: () => onNavigate("sopTask", { taskId: task.id })
            }))
          )
        )
      )
    )
  );
}

function StatCard({ label, value, sub, accent, iconType }) {
  const Icon = {
    tasks: (
      React.createElement("svg", {
        width: "20", height: "20", viewBox: "0 0 24 24",
        fill: "none", stroke: "currentColor", strokeWidth: "2",
        strokeLinecap: "round", strokeLinejoin: "round"
      },
        React.createElement("path", { d: "M9 11l3 3L22 4" }),
        React.createElement("path", { d: "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" })
      )
    ),
    check: (
      React.createElement("svg", {
        width: "20", height: "20", viewBox: "0 0 24 24",
        fill: "none", stroke: "currentColor", strokeWidth: "2",
        strokeLinecap: "round", strokeLinejoin: "round"
      },
        React.createElement("path", { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14" }),
        React.createElement("polyline", { points: "22 4 12 14.01 9 11.01" })
      )
    ),
    alert: (
      React.createElement("svg", {
        width: "20", height: "20", viewBox: "0 0 24 24",
        fill: "none", stroke: "currentColor", strokeWidth: "2",
        strokeLinecap: "round", strokeLinejoin: "round"
      },
        React.createElement("path", { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }),
        React.createElement("line", { x1: "12", y1: "9", x2: "12", y2: "13" }),
        React.createElement("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })
      )
    ),
    robot: (
      React.createElement("svg", {
        width: "20", height: "20", viewBox: "0 0 24 24",
        fill: "none", stroke: "currentColor", strokeWidth: "2",
        strokeLinecap: "round", strokeLinejoin: "round"
      },
        React.createElement("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }),
        React.createElement("path", { d: "M9 9h.01M15 9h.01M9 15c.83.83 2.17.83 3 0s2.17-.83 3 0" })
      )
    )
  };
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
      React.createElement("span", {
        style: { fontSize: "12px", color: "#64748B", fontWeight: 500, letterSpacing: "0.02em" }
      }, label),
      React.createElement(
        "span",
        {
          style: {
            width: "32px", height: "32px", borderRadius: "6px",
            background: `${accent}15`, color: accent,
            display: "flex", alignItems: "center", justifyContent: "center",
            marginTop: "-4px"
          }
        },
        Icon[iconType] || Icon.tasks
      )
    ),
    React.createElement("div", {
      style: { fontSize: "28px", fontWeight: 700, color: "#0F172A", marginTop: "10px", lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }
    }, value),
    React.createElement("div", {
      style: { fontSize: "12px", color: "#94A3B8", marginTop: "6px", lineHeight: 1.4 }
    }, sub)
  );
}

function SOPTaskRow({ task, template, onClick }) {
  const color = template?.color || "#4F46E5";
  const isLast = false;

  const statusMap = {
    pending: { text: "待开始", color: "#64748B", bg: "rgba(100, 116, 139, 0.1)" },
    in_progress: { text: "进行中", color: "#2563EB", bg: "rgba(37, 99, 235, 0.1)" },
    completed: { text: "已完成", color: "#059669", bg: "rgba(5, 150, 105, 0.1)" }
  };
  const s = statusMap[task.status] || statusMap.pending;

  const resultMap = {
    pass: { text: "全部通过", color: "#10B981" },
    issue: { text: "发现问题", color: "#DC2626" },
    fail: { text: "未通过", color: "#DC2626" }
  };
  const r = task.result ? resultMap[task.result] : null;
  const progress = task.totalItems > 0 ? Math.round((task.completedItems / task.totalItems) * 100) : 0;

  return React.createElement(
    "div",
    {
      onClick,
      style: {
        display: "flex",
        alignItems: "center",
        gap: "20px",
        padding: "18px 24px",
        borderBottom: "1px solid #F1F5F9",
        cursor: "pointer",
        transition: "background 0.15s",
        position: "relative"
      },
      onMouseEnter: e => { e.currentTarget.style.background = "#F8FAFC"; },
      onMouseLeave: e => { e.currentTarget.style.background = "transparent"; }
    },
    // Left color bar
    React.createElement("div", {
      style: {
        position: "absolute",
        left: 0, top: 0, bottom: 0,
        width: "4px",
        background: color
      }
    }),

    // Type icon
    React.createElement(
      "div",
      {
        style: {
          width: "44px",
          height: "44px",
          borderRadius: "8px",
          background: `${color}12`,
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
            ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h20"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 6 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/></svg>'
            : template?.icon === "moon"
            ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
            : template?.icon === "clock"
            ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
            : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
        }
      })
    ),

    // Main info
    React.createElement(
      "div",
      { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "8px" } },
      React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "10px" } },
        React.createElement("span", {
          style: { fontSize: "15px", fontWeight: 600, color: "#0F172A" }
        }, task.name),
        task.overdue && React.createElement("span",{style:{color:"#DC2626",fontSize:"11px"}},"待补核查"),
        React.createElement(
          "span",
          {
            style: {
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "4px",
              background: s.bg,
              color: s.color,
              fontWeight: 600
            }
          },
          s.text
        ),
        r && React.createElement(
          "span",
          {
            style: {
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "4px",
              background: `${r.color}15`,
              color: r.color,
              fontWeight: 600
            }
          },
          r.text
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
        React.createElement("span", {}, `计划 ${task.scheduledTime}`),
        task.startTime && React.createElement(
          React.Fragment,
          null,
          React.createElement("span", { style: { color: "#CBD5E1" } }, "·"),
          React.createElement("span", {}, `开始 ${task.startTime}`)
        ),
        task.completedTime && React.createElement(
          React.Fragment,
          null,
          React.createElement("span", { style: { color: "#CBD5E1" } }, "·"),
          React.createElement("span", {}, `完成 ${task.completedTime}`)
        ),
        React.createElement("span", { style: { color: "#CBD5E1" } }, "·"),
        React.createElement("span", {}, task.assignee || "待领取")
      ),
      // Progress bar (if not completed or in progress)
      task.status !== "completed" && React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "10px" } },
        React.createElement("div", {
          style: {
            flex: 1,
            height: "4px",
            background: "#E2E8F0",
            borderRadius: "2px",
            overflow: "hidden",
            maxWidth: "300px"
          }
        },
          React.createElement("div", {
            style: {
              height: "100%",
              width: `${progress}%`,
              background: color,
              borderRadius: "2px",
              transition: "width 0.3s"
            }
          })
        ),
        React.createElement(
          "span",
          { style: { fontSize: "11px", color: "#94A3B8", fontVariantNumeric: "tabular-nums" } },
          `${task.completedItems}/${task.totalItems} 项`
        )
      )
    ),

    // Right meta
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "6px",
          flexShrink: 0
        }
      },
      React.createElement(
        "span",
        { style: { fontSize: "11px", color: "#94A3B8" } },
        template?.typeName
      ),
      task.aiChecked > 0 && React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "11px",
            color: "#7C3AED",
            background: "rgba(124, 58, 237, 0.08)",
            padding: "2px 8px",
            borderRadius: "4px",
            fontWeight: 500
          }
        },
        React.createElement("span", {
          dangerouslySetInnerHTML: {
            __html: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h.01M15 9h.01M9 15c.83.83 2.17.83 3 0s2.17-.83 3 0"/></svg>'
          }
        }),
        `AI 核验 ${task.aiChecked} 项`
      ),
      task.issuesFound > 0 && React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "11px",
            color: "#DC2626",
            background: "rgba(220, 38, 38, 0.08)",
            padding: "2px 8px",
            borderRadius: "4px",
            fontWeight: 600
          }
        },
        `${task.issuesFound} 个问题`
      )
    ),

    // Arrow
    React.createElement(
      "span",
      { style: { color: "#CBD5E1", flexShrink: 0, fontSize: "14px" } },
      "→"
    )
  );
}

function SOPTemplateCard({ template, onClick }) {
  const color = template.color;

  return React.createElement(
    "div",
    {
      onClick,
      style: {
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "10px",
        padding: "20px",
        cursor: "pointer",
        transition: "all 0.2s",
        position: "relative",
        overflow: "hidden"
      },
      onMouseEnter: e => {
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(15, 23, 42, 0.08)";
        e.currentTarget.style.transform = "translateY(-2px)";
      },
      onMouseLeave: e => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "translateY(0)";
      }
    },
    // Top accent
    React.createElement("div", {
      style: {
        position: "absolute",
        top: 0, left: 0, right: 0,
        height: "3px",
        background: color
      }
    }),

    React.createElement(
      "div",
      { style: { display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "16px" } },
      React.createElement(
        "div",
        {
          style: {
            width: "48px",
            height: "48px",
            borderRadius: "10px",
            background: `${color}12`,
            color: color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }
        },
        React.createElement("span", {
          dangerouslySetInnerHTML: {
            __html: template.icon === "sunrise"
              ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h20"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 6 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/></svg>'
              : template.icon === "moon"
              ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
              : template.icon === "clock"
              ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
              : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
          }
        })
      ),
      React.createElement("div", { style: { flex: 1 } },
        React.createElement("h3", {
          style: { fontSize: "16px", fontWeight: 600, color: "#0F172A", margin: "0 0 4px 0" }
        }, template.name),
        React.createElement("p", {
          style: { fontSize: "12px", color: "#64748B", margin: 0, lineHeight: 1.5 }
        }, template.description)
      )
    ),

    // Stats row
    React.createElement(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "10px",
          padding: "14px 0",
          borderTop: "1px solid #F1F5F9",
          marginBottom: "14px"
        }
      },
      React.createElement(MiniStat, { label: "检查项", value: template.totalItems }),
      React.createElement(MiniStat, { label: "预计时长", value: template.duration, isText: true }),
      React.createElement(MiniStat, { label: "频率", value: template.frequency.split(" ")[0], isText: true })
    ),

    // Categories preview
    React.createElement(
      "div",
      { style: { display: "flex", flexWrap: "wrap", gap: "6px" } },
      [...new Set(template.items.map(i => i.category))].slice(0, 5).map(cat => React.createElement(
        "span",
        {
          key: cat,
          style: {
            fontSize: "11px",
            padding: "3px 8px",
            borderRadius: "4px",
            background: `${color}10`,
            color: color,
            fontWeight: 500
          }
        },
        cat
      ))
    ),

    // Bottom action hint
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "16px",
          paddingTop: "14px",
          borderTop: "1px solid #F1F5F9"
        }
      },
      React.createElement(
        "span",
        { style: { fontSize: "11px", color: "#94A3B8" } },
        `责任人：${template.responsibleRole}`
      ),
      React.createElement(
        "span",
        { style: { fontSize: "12px", color: color, fontWeight: 500 } },
        "查看详情 →"
      )
    )
  );
}

function MiniStat({ label, value, isText }) {
  return React.createElement(
    "div",
    { style: { textAlign: "center" } },
    React.createElement("div", {
      style: {
        fontSize: isText ? "13px" : "18px",
        fontWeight: 700,
        color: "#0F172A",
        lineHeight: 1.2,
        fontVariantNumeric: isText ? "normal" : "tabular-nums"
      }
    }, value),
    React.createElement("div", {
      style: { fontSize: "11px", color: "#94A3B8", marginTop: "4px" }
    }, label)
  );
}

