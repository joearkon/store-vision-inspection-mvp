// Rectification Work Order Page - Full work order management with auto-assignment

const WORK_ORDERS = [
  {
    id: "WO-20260927-001",
    eventId: "EVT-0927-001",
    type: "A1",
    typeName: "未佩戴手套",
    severity: "P0",
    priority: "紧急",
    cameraName: "前台-01",
    locationZh: "前台操作区",
    imageKey: "front_counter",
    description: "员工在制作黑糖珍珠奶茶时未佩戴一次性手套",
    assignee: "李明（店长）",
    assigneeAvatar: "李",
    reporter: "AI 视觉巡检系统",
    createdAt: "2026-09-27 09:23:10",
    dueTime: "2026-09-27 09:28:10",
    status: "pending",
    statusZh: "待处理",
    slaRemaining: "02:15",
    autoAssigned: true,
    escalationLevel: 0,
    activities: [
      { time: "09:23:07", type: "detect", text: "AI 检测到异常：A1 未佩戴手套（置信度 92%）" },
      { time: "09:23:08", type: "system", text: "自动生成工单 WO-20260927-001" },
      { time: "09:23:09", type: "assign", text: "系统自动指派给 李明（店长），依据：P0 告警 → 门店负责人首责制" },
      { time: "09:23:10", type: "notify", text: "飞书 IM 推送 P0 严重告警卡片 + 短信提醒" }
    ]
  },
  {
    id: "WO-20260927-002",
    eventId: "EVT-0927-002",
    type: "E1",
    typeName: "冰箱门未关",
    severity: "P1",
    priority: "一般",
    cameraName: "仓储-01",
    locationZh: "仓储区",
    imageKey: "storage",
    description: "仓储区冷藏柜门敞开超过 30 秒，内部原料暴露",
    assignee: "王芳（后厨主管）",
    assigneeAvatar: "王",
    reporter: "AI 视觉巡检系统",
    createdAt: "2026-09-27 08:45:25",
    dueTime: "2026-09-27 09:15:25",
    status: "in_progress",
    statusZh: "处理中",
    slaRemaining: "12:30",
    autoAssigned: true,
    escalationLevel: 0,
    activities: [
      { time: "08:45:22", type: "detect", text: "AI 检测到异常：E1 冰箱门未关（置信度 87%）" },
      { time: "08:45:23", type: "system", text: "自动生成工单 WO-20260927-002" },
      { time: "08:45:24", type: "assign", text: "系统自动指派给 王芳（后厨主管），依据：仓储区域 → 后厨主管负责" },
      { time: "08:50:12", type: "accept", text: "王芳 已接收工单" },
      { time: "08:52:05", type: "update", text: "已关闭冷藏柜门，正在核查内部温度" }
    ]
  },
  {
    id: "WO-20260927-003",
    eventId: "EVT-0927-005",
    type: "A3",
    typeName: "操作台脏乱",
    severity: "P1",
    priority: "一般",
    cameraName: "前台-01",
    locationZh: "前台操作区",
    imageKey: "front_counter",
    description: "前台操作台面积水、污渍、原料残渣未及时清理",
    assignee: "张伟（前台主管）",
    assigneeAvatar: "张",
    reporter: "AI 视觉巡检系统",
    createdAt: "2026-09-27 07:31:00",
    dueTime: "2026-09-27 08:01:00",
    status: "overdue",
    statusZh: "已超时",
    slaRemaining: "超时 1h28m",
    autoAssigned: true,
    escalationLevel: 2,
    activities: [
      { time: "07:30:55", type: "detect", text: "AI 检测到异常：A3 操作台脏乱（置信度 85%）" },
      { time: "07:30:56", type: "system", text: "自动生成工单 WO-20260927-003" },
      { time: "07:30:57", type: "assign", text: "系统自动指派给 张伟（前台主管）" },
      { time: "08:01:00", type: "escalate", text: "⚠️ SLA 首次升级：30 分钟未处理，升级至 店长 李明" },
      { time: "08:31:00", type: "escalate", text: "🚨 SLA 二次升级：60 分钟未处理，升级至 区域运营督导" }
    ]
  },
  {
    id: "WO-20260927-004",
    eventId: "EVT-0927-003",
    type: "C1",
    typeName: "未穿工服",
    severity: "P1",
    priority: "一般",
    cameraName: "后厨-01",
    locationZh: "后厨操作区",
    imageKey: "back_kitchen",
    description: "后厨操作人员穿着便服，未穿着统一工作服/围裙",
    assignee: "王芳（后厨主管）",
    assigneeAvatar: "王",
    reporter: "AI 视觉巡检系统",
    createdAt: "2026-09-27 08:12:48",
    dueTime: "2026-09-27 08:42:48",
    status: "resolved",
    statusZh: "已完成",
    slaRemaining: "已完成",
    autoAssigned: true,
    escalationLevel: 0,
    resolvedAt: "2026-09-27 08:25:30",
    resolvedBy: "王芳（后厨主管）",
    resolution: "已要求员工更换工作服并佩戴工牌，对当值员工进行着装规范重申。",
    activities: [
      { time: "08:12:45", type: "detect", text: "AI 检测到异常：C1 未穿工服（置信度 89%）" },
      { time: "08:12:46", type: "system", text: "自动生成工单 WO-20260927-004" },
      { time: "08:12:47", type: "assign", text: "系统自动指派给 王芳（后厨主管）" },
      { time: "08:15:20", type: "accept", text: "王芳 已接收工单" },
      { time: "08:25:30", type: "resolve", text: "王芳 提交整改完成，附现场整改后照片" }
    ]
  },
  {
    id: "WO-20260926-008",
    eventId: "EVT-0926-006",
    type: "B1",
    typeName: "明火/燃气异常",
    severity: "P0",
    priority: "紧急",
    cameraName: "后厨-01",
    locationZh: "后厨操作区",
    imageKey: "back_kitchen",
    description: "后厨加热区明火燃烧，周围无操作人员看管",
    assignee: "李明（店长）",
    assigneeAvatar: "李",
    reporter: "AI 视觉巡检系统",
    createdAt: "2026-09-26 22:15:32",
    dueTime: "2026-09-26 22:20:32",
    status: "resolved",
    statusZh: "已完成",
    slaRemaining: "已完成",
    autoAssigned: true,
    escalationLevel: 1,
    resolvedAt: "2026-09-26 22:18:45",
    resolvedBy: "李明（店长）",
    resolution: "已关闭火源并确认安全。责任人：后厨晚班员工陈某，已进行安全培训并记录。",
    activities: [
      { time: "22:15:30", type: "detect", text: "AI 检测到异常：B1 明火无人看管（置信度 95%）" },
      { time: "22:15:31", type: "system", text: "自动生成工单 WO-20260926-008" },
      { time: "22:15:32", type: "assign", text: "系统自动指派给 李明（店长），P0 安全类 → 店长首责" },
      { time: "22:15:33", type: "notify", text: "飞书 P0 卡片推送 + 电话告警 + 短信" },
      { time: "22:17:05", type: "escalate", text: "⚠️ 2 分钟未响应，自动升级至 区域督导 赵丽" },
      { time: "22:18:20", type: "accept", text: "李明 已接收工单" },
      { time: "22:18:45", type: "resolve", text: "李明 提交整改完成，确认火源已关闭" }
    ]
  }
];

const AUTO_ASSIGN_RULES = [
  { level: "P0", target: "门店店长", reason: "P0 严重异常 → 门店负责人首责制", sla: "5 分钟" },
  { level: "P1", target: "对应区域主管", reason: "P1 一般异常 → 区域主管负责制", sla: "30 分钟" },
  { level: "P2", target: "对应区域值班员工", reason: "P2 提示异常 → 当班人员处理", sla: "2 小时" }
];

const ESCALATION_RULES = [
  { level: "T0", trigger: "首次检测到异常", action: "自动生成工单 + 指派责任人 + 飞书推送" },
  { level: "T+5min (P0)", trigger: "P0 5 分钟未响应", action: "升级至店长 + 电话告警" },
  { level: "T+15min (P0)", trigger: "P0 15 分钟未响应", action: "升级至区域督导 + SLA 升级卡片" },
  { level: "T+30min (P1)", trigger: "P1 30 分钟未响应", action: "升级至店长 + 飞书提醒" },
  { level: "T+2h (P2)", trigger: "P2 2 小时未响应", action: "升级至区域主管" }
];

function WorkOrderPage({ onNavigate }) {
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [selectedOrder, setSelectedOrder] = React.useState(WORK_ORDERS[0]);

  const filteredOrders = WORK_ORDERS.filter(o => {
    if (statusFilter === "all") return true;
    return o.status === statusFilter;
  });

  const counts = {
    all: WORK_ORDERS.length,
    pending: WORK_ORDERS.filter(o => o.status === "pending").length,
    in_progress: WORK_ORDERS.filter(o => o.status === "in_progress").length,
    overdue: WORK_ORDERS.filter(o => o.status === "overdue").length,
    resolved: WORK_ORDERS.filter(o => o.status === "resolved").length
  };

  return React.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "20px" } },
      // Header
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between"
          }
        },
        React.createElement(
          "div",
          {},
          React.createElement("h1", {
            style: {
              fontSize: "22px",
              fontWeight: 700,
              color: "#0F172A",
              margin: "0 0 6px 0"
            }
          }, "整改工单"),
          React.createElement("p", {
            style: { fontSize: "13px", color: "#64748B", margin: 0, lineHeight: 1.5 }
          }, "AI 自动派单 · SLA 逐级升级 · 全流程可追溯")
        ),
        React.createElement(
          "div",
          { style: { display: "flex", gap: "10px" } },
          React.createElement(
            window.Button,
            { variant: "secondary" },
            "导出台账"
          )
        )
      ),

      // Stats
      React.createElement(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "16px"
          }
        },
         [
           { label: "待处理工单", value: counts.pending, color: "#DC2626", icon: "pending" },
           { label: "处理中", value: counts.in_progress, color: "#2563EB", icon: "inprogress" },
           { label: "已超时", value: counts.overdue, color: "#991B1B", icon: "warning" },
           { label: "今日已完成", value: counts.resolved, color: "#059669", icon: "check" }
         ].map((s, i) => React.createElement(
           "div",
           {
             key: i,
             style: {
               background: "#FFFFFF",
               borderRadius: "8px",
               border: "1px solid #E2E8F0",
               padding: "18px 20px",
               display: "flex",
               alignItems: "center",
               gap: "14px"
             }
           },
           React.createElement(
             "div",
             {
               style: {
                 width: "44px",
                 height: "44px",
                 borderRadius: "8px",
                 background: `${s.color}12`,
                 display: "flex",
                 alignItems: "center",
                 justifyContent: "center",
                 flexShrink: 0
               }
             },
             React.createElement("span", {
               style: { color: s.color, display: "flex" },
               dangerouslySetInnerHTML: { __html: window.WO_ICONS[s.icon] }
             })
           ),
          React.createElement(
            "div",
            {},
            React.createElement("div", {
              style: { fontSize: "11px", color: "#64748B", fontWeight: 500, marginBottom: "4px" }
            }, s.label),
            React.createElement("div", {
              style: { fontSize: "22px", fontWeight: 700, color: "#0F172A" }
            }, s.value)
          )
        ))
      ),

      // Status tabs
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            gap: "4px",
            background: "#F1F5F9",
            padding: "4px",
            borderRadius: "8px",
            width: "fit-content"
          }
        },
        [
          { key: "all", label: "全部工单", count: counts.all, color: "#475569" },
          { key: "pending", label: "待处理", count: counts.pending, color: "#DC2626" },
          { key: "in_progress", label: "处理中", count: counts.in_progress, color: "#2563EB" },
          { key: "overdue", label: "已超时", count: counts.overdue, color: "#991B1B" },
          { key: "resolved", label: "已完成", count: counts.resolved, color: "#059669" }
        ].map(tab => React.createElement(
          "button",
          {
            key: tab.key,
            onClick: () => setStatusFilter(tab.key),
            style: {
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: statusFilter === tab.key ? 600 : 500,
              color: statusFilter === tab.key ? tab.color : "#64748B",
              background: statusFilter === tab.key ? "#FFFFFF" : "transparent",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: statusFilter === tab.key ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
              transition: "all 0.15s",
              fontFamily: "inherit"
            }
          },
          tab.label,
          React.createElement("span", {
            style: {
              fontSize: "11px",
              padding: "1px 6px",
              borderRadius: "999px",
              background: statusFilter === tab.key ? `${tab.color}15` : "rgba(100, 116, 139, 0.15)",
              color: statusFilter === tab.key ? tab.color : "#64748B",
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums"
            }
          }, tab.count)
        ))
      ),

      // Main: work order list + detail
      React.createElement(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "380px 1fr",
            gap: "20px",
            alignItems: "start"
          }
        },
        // Work order list
        React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "10px" } },
          filteredOrders.map(order => React.createElement(WorkOrderCard, {
            key: order.id,
            order: order,
            selected: selectedOrder?.id === order.id,
            onClick: () => setSelectedOrder(order)
          }))
        ),
        // Work order detail
        selectedOrder && React.createElement(WorkOrderDetail, {
          order: selectedOrder,
          onNavigate: onNavigate
        })
      ),

      // Auto-assignment rules section
      React.createElement(
        window.Card,
        { padding: "20px" },
        React.createElement("h3", {
          style: { fontSize: "15px", fontWeight: 600, color: "#0F172A", margin: "0 0 4px 0" }
        }, "自动派单与升级规则"),
        React.createElement("p", {
          style: { fontSize: "12px", color: "#64748B", margin: "0 0 16px 0" }
        }, "AI 检测异常后，系统根据严重度自动派单至对应责任人，并按 SLA 逐级升级"),
        React.createElement(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "1fr 1.2fr",
              gap: "24px"
            }
          },
          // Auto-assign rules
          React.createElement(
            "div",
            {},
             React.createElement("h4", {
               style: {
                 fontSize: "13px",
                 fontWeight: 600,
                 color: "#0F172A",
                 margin: "0 0 12px 0",
                 display: "flex",
                 alignItems: "center",
                 gap: "6px"
               }
             },
             React.createElement("span", { style: { display: "flex", color: "#4F46E5" }, dangerouslySetInnerHTML: { __html: window.WO_ICONS.clipboard } }),
             "自动派单规则"),
            React.createElement(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "10px" } },
              AUTO_ASSIGN_RULES.map((rule, i) => React.createElement(
                "div",
                {
                  key: i,
                  style: {
                    padding: "12px 14px",
                    borderRadius: "6px",
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderLeft: `3px solid ${rule.level === "P0" ? "#DC2626" : rule.level === "P1" ? "#EA580C" : "#D97706"}`
                  }
                },
                React.createElement(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" } },
                  React.createElement(window.SeverityBadge, { severity: rule.level }),
                  React.createElement("span", {
                    style: { fontSize: "13px", fontWeight: 600, color: "#0F172A" }
                  }, `→ ${rule.target}`),
                  React.createElement("span", {
                    style: {
                      marginLeft: "auto",
                      fontSize: "11px",
                      color: "#64748B",
                      fontFamily: "'SF Mono', monospace"
                    }
                  }, `SLA ${rule.sla}`)
                ),
                React.createElement("div", {
                  style: { fontSize: "12px", color: "#64748B" }
                }, rule.reason)
              ))
            )
          ),
          // Escalation rules
          React.createElement(
            "div",
            {},
             React.createElement("h4", {
               style: {
                 fontSize: "13px",
                 fontWeight: 600,
                 color: "#0F172A",
                 margin: "0 0 12px 0",
                 display: "flex",
                 alignItems: "center",
                 gap: "6px"
               }
             },
             React.createElement("span", { style: { display: "flex", color: "#EA580C" }, dangerouslySetInnerHTML: { __html: window.WO_ICONS.bell } }),
             "SLA 升级机制"),
            React.createElement(
              "div",
              {
                style: {
                  position: "relative",
                  paddingLeft: "20px"
                }
              },
              React.createElement("div", {
                style: {
                  position: "absolute",
                  left: "6px",
                  top: "4px",
                  bottom: "4px",
                  width: "2px",
                  background: "#E2E8F0"
                }
              }),
              ESCALATION_RULES.map((rule, i) => React.createElement(
                "div",
                {
                  key: i,
                  style: {
                    position: "relative",
                    padding: "8px 0 12px 16px"
                  }
                },
                React.createElement("div", {
                  style: {
                    position: "absolute",
                    left: "-17px",
                    top: "10px",
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: i === 0 ? "#10B981" : i <= 2 ? "#DC2626" : "#EA580C",
                    border: "2px solid #FFFFFF",
                    boxShadow: `0 0 0 2px ${i === 0 ? "rgba(16,185,129,0.3)" : "rgba(220,38,38,0.2)"}`
                  }
                }),
                React.createElement(
                  "div",
                  {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "3px"
                    }
                  },
                  React.createElement("span", {
                    style: {
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#0F172A",
                      fontFamily: "'SF Mono', monospace"
                    }
                  }, rule.level),
                  React.createElement("span", {
                    style: { fontSize: "11px", color: "#94A3B8" }
                  }, rule.trigger)
                ),
                React.createElement("div", {
                  style: { fontSize: "12px", color: "#475569" }
                }, rule.action)
              ))
            )
          )
        )
      )
    );
}

function WorkOrderCard({ order, selected, onClick }) {
  const sevStyle = window.SEVERITY_STYLES[order.severity];
  const statStyle = window.STATUS_STYLES[order.status];

  return React.createElement(
    "div",
    {
      onClick,
      style: {
        background: "#FFFFFF",
        borderRadius: "8px",
        border: `1.5px solid ${selected ? "#4F46E5" : "#E2E8F0"}`,
        padding: "14px 16px",
        cursor: "pointer",
        transition: "all 0.15s",
        boxShadow: selected ? "0 4px 12px rgba(79, 70, 229, 0.1)" : "none",
        position: "relative",
        overflow: "hidden"
      }
    },
    // Left severity bar
    React.createElement("div", {
      style: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: "4px",
        background: sevStyle.text
      }
    }),
    // Header
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "8px",
          marginLeft: "8px"
        }
      },
      React.createElement(
        "span",
        {
          style: {
            fontSize: "12px",
            fontWeight: 600,
            color: "#475569",
            fontFamily: "'SF Mono', monospace"
          }
        },
        order.id
      ),
      order.autoAssigned && React.createElement(
        "span",
        {
          style: {
            fontSize: "10px",
            padding: "2px 6px",
            borderRadius: "4px",
            background: "rgba(124, 58, 237, 0.1)",
            color: "#7C3AED",
            fontWeight: 600
          }
        },
        "AI 自动派单"
      )
    ),
    // Title
    React.createElement(
      "div",
      {
        style: {
          fontSize: "13px",
          fontWeight: 600,
          color: "#0F172A",
          marginBottom: "6px",
          marginLeft: "8px",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }
      },
      `${order.type} ${order.typeName}`,
      React.createElement(window.SeverityBadge, { severity: order.severity })
    ),
    // Meta
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginLeft: "8px",
          fontSize: "11px",
          color: "#94A3B8",
          marginBottom: "10px"
        }
      },
      React.createElement("span", {}, order.cameraName),
      React.createElement("span", { style: { color: "#CBD5E1" } }, "·"),
      React.createElement("span", {}, order.createdAt.split(" ")[1].slice(0, 5))
    ),
    // Footer: assignee + status
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "10px",
          borderTop: "1px solid #F1F5F9",
          marginLeft: "8px"
        }
      },
      React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "6px" } },
        React.createElement(
          "div",
          {
            style: {
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              background: "#E0E7FF",
              color: "#4F46E5",
              fontSize: "10px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }
          },
          order.assigneeAvatar
        ),
        React.createElement("span", {
          style: { fontSize: "11px", color: "#475569", fontWeight: 500 }
        }, order.assignee.split("（")[0])
      ),
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" } },
        React.createElement(window.StatusBadge, { status: order.status }),
        React.createElement("span", {
          style: {
            fontSize: "10px",
            fontFamily: "'SF Mono', monospace",
            color: order.status === "overdue" ? "#991B1B" : order.status === "pending" ? "#DC2626" : "#94A3B8",
            fontWeight: 600
          }
        }, order.slaRemaining)
      )
    )
  );
}

function WorkOrderDetail({ order, onNavigate }) {
  const sevStyle = window.SEVERITY_STYLES[order.severity];
  const [newNote, setNewNote] = React.useState("");
  const [activities, setActivities] = React.useState(order.activities);

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setActivities([...activities, { time, type: "update", text: newNote, user: "李明（店长）" }]);
    setNewNote("");
  };

  return React.createElement(
    window.Card,
    { padding: "0px" },
    // Header
    React.createElement(
      "div",
      {
        style: {
          padding: "18px 24px",
          borderBottom: "1px solid #E2E8F0",
          background: order.status === "overdue"
            ? "linear-gradient(135deg, rgba(127,29,29,0.05) 0%, transparent 100%)"
            : order.status === "resolved"
            ? "linear-gradient(135deg, rgba(5,150,105,0.04) 0%, transparent 100%)"
            : "linear-gradient(135deg, rgba(79,70,229,0.04) 0%, transparent 100%)"
        }
      },
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "12px"
          }
        },
        React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "8px" } },
          React.createElement(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "10px" } },
            React.createElement("h2", {
              style: {
                fontSize: "17px",
                fontWeight: 700,
                color: "#0F172A",
                margin: 0
              }
            }, `${order.type} ${order.typeName}`),
            React.createElement(window.SeverityBadge, { severity: order.severity, size: "lg" })
          ),
          React.createElement(
            "span",
            {
              style: {
                fontSize: "12px",
                color: "#64748B",
                fontFamily: "'SF Mono', monospace"
              }
            },
            order.id
          )
        ),
        React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" } },
          React.createElement(window.StatusBadge, { status: order.status, size: "lg" }),
          React.createElement(
            "span",
            {
              style: {
                fontSize: "11px",
                color: order.status === "overdue" ? "#991B1B" : "#94A3B8",
                fontWeight: 600,
                fontFamily: "'SF Mono', monospace"
              }
            },
            `SLA：${order.slaRemaining}`
          )
        )
      ),
      // Description
      React.createElement("p", {
        style: {
          fontSize: "13px",
          color: "#334155",
          margin: 0,
          lineHeight: 1.6,
          padding: "10px 14px",
          background: "#F8FAFC",
          borderRadius: "6px",
          border: "1px solid #E2E8F0"
        }
      }, order.description)
    ),

    // Info grid
    React.createElement(
      "div",
      {
        style: {
          padding: "20px 24px",
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "18px",
          borderBottom: "1px solid #E2E8F0"
        }
      },
       [
         { label: "负责人", value: order.assignee, icon: "user" },
         { label: "派发方式", value: order.autoAssigned ? "AI 自动派单" : "手动指派", icon: "robot" },
         { label: "摄像头", value: `${order.cameraName} · ${order.locationZh}`, icon: "camera2" },
         { label: "关联事件", value: order.eventId, icon: "event2", link: true },
         { label: "创建时间", value: order.createdAt, icon: "clock" },
         { label: "截止时间", value: order.dueTime, icon: "alarm" }
       ].map((item, i) => React.createElement(
         "div",
         { key: i, style: { display: "flex", flexDirection: "column", gap: "6px" } },
         React.createElement("div", {
           style: { display: "flex", alignItems: "center", gap: "6px" }
         },
           React.createElement("span", {
             style: { color: "#94A3B8", display: "flex" },
             dangerouslySetInnerHTML: { __html: window.WO_ICONS[item.icon] }
           }),
           React.createElement("span", {
             style: { fontSize: "11px", color: "#94A3B8", fontWeight: 500 }
           }, item.label)
         ),
        item.link ? (
          React.createElement(
            "span",
            {
              style: {
                fontSize: "13px",
                color: "#4F46E5",
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "'SF Mono', monospace"
              },
              onClick: () => onNavigate("event", { eventId: order.eventId })
            },
            `${item.value} →`
          )
        ) : (
         React.createElement("span", {
           style: { fontSize: "13px", color: "#0F172A", fontWeight: 500, lineHeight: 1.4 }
         }, item.value)
        )
      ))
    ),

    // Resolution (if resolved)
    order.status === "resolved" && React.createElement(
      "div",
      {
        style: {
          padding: "16px 24px",
          borderBottom: "1px solid #E2E8F0",
          background: "rgba(16, 185, 129, 0.04)"
        }
      },
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "8px"
          }
        },
         React.createElement("span", { style: { fontSize: "18px", display: "flex", color: "#059669" }, dangerouslySetInnerHTML: { __html: window.WO_ICONS.checkCircle } }),
         React.createElement("span", {
          style: { fontSize: "13px", fontWeight: 600, color: "#065F46" }
        }, "整改完成"),
        React.createElement("span", {
          style: { fontSize: "11px", color: "#059669", marginLeft: "auto" }
        }, order.resolvedAt)
      ),
      React.createElement("div", {
        style: { fontSize: "12px", color: "#065F46", lineHeight: 1.6 }
      }, `处理人：${order.resolvedBy}`),
      React.createElement("div", {
        style: {
          marginTop: "8px",
          padding: "10px 12px",
          background: "#FFFFFF",
          borderRadius: "6px",
          border: "1px solid #A7F3D0",
          fontSize: "12px",
          color: "#065F46",
          lineHeight: 1.6
        }
      }, order.resolution)
    ),

    // Activity timeline
    React.createElement(
      "div",
      { style: { padding: "20px 24px" } },
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px"
          }
        },
        React.createElement("h4", {
          style: { fontSize: "14px", fontWeight: 600, color: "#0F172A", margin: 0 }
        }, "工单动态"),
        React.createElement("span", {
          style: {
            fontSize: "11px",
            color: "#94A3B8",
            padding: "2px 8px",
            background: "#F1F5F9",
            borderRadius: "4px"
          }
        }, `${activities.length} 条记录`)
      ),
      // Timeline
      React.createElement(
        "div",
        { style: { position: "relative", paddingLeft: "24px" } },
        React.createElement("div", {
          style: {
            position: "absolute",
            left: "7px",
            top: "6px",
            bottom: "6px",
            width: "2px",
            background: "#E2E8F0"
          }
        }),
        activities.map((act, i) => {
           const actStyles = {
             detect: { color: "#7C3AED", icon: "scan", bg: "rgba(124, 58, 237, 0.12)" },
             system: { color: "#2563EB", icon: "cog", bg: "rgba(37, 99, 235, 0.12)" },
             assign: { color: "#0891B2", icon: "userPlus", bg: "rgba(8, 145, 178, 0.12)" },
             notify: { color: "#7C3AED", icon: "bell2", bg: "rgba(124, 58, 237, 0.12)" },
             accept: { color: "#2563EB", icon: "checkSmall", bg: "rgba(37, 99, 235, 0.12)" },
             update: { color: "#64748B", icon: "edit", bg: "rgba(100, 116, 139, 0.12)" },
             escalate: { color: "#DC2626", icon: "alertTriangle", bg: "rgba(220, 38, 38, 0.12)" },
             resolve: { color: "#059669", icon: "checkCircle2", bg: "rgba(5, 150, 105, 0.12)" }
           };
          const s = actStyles[act.type] || actStyles.update;

          return React.createElement(
            "div",
            {
              key: i,
              style: {
                position: "relative",
                padding: "8px 0 12px 0"
              }
            },
             React.createElement("div", {
               style: {
                 position: "absolute",
                 left: "-22px",
                 top: "8px",
                 width: "18px",
                 height: "18px",
                 borderRadius: "50%",
                 background: "#FFFFFF",
                 border: `2px solid ${s.color}`,
                 display: "flex",
                 alignItems: "center",
                 justifyContent: "center",
                 color: s.color
               }
             }, React.createElement("span", { style: { display: "flex" }, dangerouslySetInnerHTML: { __html: window.WO_ICONS[s.icon] } })),
            React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "3px"
                }
              },
              React.createElement("span", {
                style: {
                  fontSize: "11px",
                  fontWeight: 600,
                  color: s.color,
                  fontFamily: "'SF Mono', monospace",
                  background: s.bg,
                  padding: "2px 6px",
                  borderRadius: "4px"
                }
              }, act.time),
              act.user && React.createElement("span", {
                style: { fontSize: "11px", color: "#64748B", fontWeight: 500 }
              }, act.user)
            ),
            React.createElement("div", {
              style: { fontSize: "12px", color: "#334155", lineHeight: 1.5 }
            }, act.text)
          );
        })
      ),

      // Add note input
      order.status !== "resolved" && React.createElement(
        "div",
        {
          style: {
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "1px solid #F1F5F9",
            display: "flex",
            gap: "10px"
          }
        },
        React.createElement(
          "div",
          {
            style: {
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "#E0E7FF",
              color: "#4F46E5",
              fontSize: "12px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }
          },
          "李"
        ),
        React.createElement(
          "div",
          { style: { flex: 1, display: "flex", flexDirection: "column", gap: "8px" } },
          React.createElement("textarea", {
            value: newNote,
            onChange: e => setNewNote(e.target.value),
            placeholder: "添加备注或进展更新…",
            rows: 2,
            style: {
              width: "100%",
              padding: "8px 12px",
              fontSize: "12px",
              border: "1px solid #CBD5E1",
              borderRadius: "6px",
              background: "#FFFFFF",
              color: "#0F172A",
              fontFamily: "inherit",
              resize: "none",
              boxSizing: "border-box",
              lineHeight: 1.5
            }
          }),
          React.createElement(
            "div",
            { style: { display: "flex", justifyContent: "flex-end", gap: "8px" } },
            order.status === "pending" && React.createElement(
              window.Button,
              {
                variant: "primary",
                size: "sm",
                onClick: () => {
                  const now = new Date();
                  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
                  setActivities([...activities, { time, type: "accept", text: "李明 已接收工单，正在处理中", user: "李明（店长）" }]);
                }
              },
              "接收工单"
            ),
            order.status !== "pending" && React.createElement(
              window.Button,
              { variant: "danger", size: "sm" },
              "标记完成"
            ),
            React.createElement(
              window.Button,
              { variant: "secondary", size: "sm", onClick: handleAddNote },
              "发送备注"
            )
          )
        )
      )
    )
  );
}

Object.assign(window, { WorkOrderPage, WORK_ORDERS });

// Work order specific SVG icons
const WO_ICONS = {
  pending: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  inprogress: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  clipboard: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
  bell: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  user: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  robot: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  camera2: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  event2: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  clock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  alarm: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/><path d="M6.38 18.7 4 21"/><path d="M17.64 18.67 20 21"/></svg>',
  checkCircle: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  checkCircle2: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  scan: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>',
  cog: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  userPlus: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>',
  bell2: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  checkSmall: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  edit: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
  alertTriangle: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
};

Object.assign(window, { WO_ICONS });
