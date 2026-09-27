// Rectification Tracking Page - Event list with filters

function RectificationPage({ onNavigate }) {
  const [severityFilter, setSeverityFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [dateRange, setDateRange] = React.useState("today");
  const [events, setEvents] = React.useState(window.EVENTS);

  const filteredEvents = events.filter(e => {
    if (severityFilter !== "all" && e.severity !== severityFilter) return false;
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    return true;
  });

  const counts = {
    pending: events.filter(e => e.status === "pending").length,
    in_progress: events.filter(e => e.status === "in_progress").length,
    resolved: events.filter(e => e.status === "resolved").length,
    overdue: events.filter(e => e.status === "overdue").length
  };

  return React.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "20px" } },
      // Header
      React.createElement(
        "div",
        {
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between"
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
          }, "整改跟踪"),
          React.createElement("p", {
            style: { fontSize: "13px", color: "#64748B", margin: 0, lineHeight: 1.5 }
          }, "管理所有巡检事件的整改进度，追踪 SLA 响应时效")
        )
      ),

      // Status overview tabs
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
          { key: "all", label: "全部", count: events.length, color: "#475569" },
          { key: "pending", label: "待处理", count: counts.pending, color: "#DC2626" },
          { key: "in_progress", label: "整改中", count: counts.in_progress, color: "#2563EB" },
          { key: "resolved", label: "已解决", count: counts.resolved, color: "#059669" },
          { key: "overdue", label: "已超时", count: counts.overdue, color: "#991B1B" }
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

      // Filters bar
      React.createElement(
        window.Card,
        { padding: "14px 20px" },
         React.createElement(
           "div",
           {
             style: {
               display: "flex",
               alignItems: "center",
               gap: "16px",
               flexWrap: "wrap"
             }
           },
          // Severity filter
          React.createElement(FilterGroup, {
            label: "严重度",
            value: severityFilter,
            onChange: setSeverityFilter,
            options: [
              { key: "all", label: "全部" },
              { key: "P0", label: "P0 严重" },
              { key: "P1", label: "P1 一般" },
              { key: "P2", label: "P2 提示" }
            ]
          }),
          // Date range
          React.createElement(FilterGroup, {
            label: "时间范围",
            value: dateRange,
            onChange: setDateRange,
            options: [
              { key: "today", label: "今日" },
              { key: "week", label: "近 7 天" },
              { key: "month", label: "近 30 天" },
              { key: "all", label: "全部" }
            ]
          }),
          // Search
          React.createElement(
            "div",
            { style: { marginLeft: "auto", display: "flex", gap: "8px" } },
            React.createElement(
              "div",
              {
                style: {
                  position: "relative",
                  display: "flex",
                  alignItems: "center"
                }
              },
              React.createElement("svg", {
                width: "14", height: "14",
                viewBox: "0 0 24 24", fill: "none",
                stroke: "#94A3B8", strokeWidth: "2",
                strokeLinecap: "round", strokeLinejoin: "round",
                style: { position: "absolute", left: "10px" }
              },
                React.createElement("circle", { cx: "11", cy: "11", r: "8" }),
                React.createElement("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })
              ),
              React.createElement("input", {
                type: "text",
                placeholder: "搜索事件 ID / 类型…",
                style: {
                  padding: "7px 12px 7px 32px",
                  fontSize: "12px",
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  width: "200px",
                  fontFamily: "inherit"
                }
              })
            ),
            React.createElement(window.Button, { variant: "secondary", size: "sm" }, "导出")
          )
        )
      ),

      // Events table
      React.createElement(
        window.Card,
        { padding: "0px" },
        // Table header
        React.createElement(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "120px 1.2fr 80px 110px 150px 110px 110px 80px",
              padding: "14px 20px",
              borderBottom: "1px solid #E2E8F0",
              fontSize: "12px",
              fontWeight: 600,
              color: "#64748B",
              letterSpacing: "0.02em"
            }
          },
          React.createElement("span", {}, "事件 ID"),
          React.createElement("span", {}, "异常类型"),
          React.createElement("span", {}, "严重度"),
          React.createElement("span", {}, "摄像头"),
          React.createElement("span", {}, "检测时间"),
          React.createElement("span", {}, "状态"),
          React.createElement("span", {}, "SLA 倒计时"),
          React.createElement("span", { style: { textAlign: "right" } }, "操作")
        ),
        // Table rows
        filteredEvents.length === 0 ? React.createElement(
            "div",
            {
              padding: "60px 20px",
              textAlign: "center",
              color: "#94A3B8",
              fontSize: "13px"
            },
            "暂无符合条件的事件"
          ) : filteredEvents.map(ev => React.createElement(EventTableRow, {
            key: ev.id,
            event: ev,
            onViewDetail: () => onNavigate("event", { eventId: ev.id })
          }))
      ),

      // Pagination
      React.createElement(
        "div",
        {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "12px",
          color: "#64748B"
        },
        React.createElement("span", {}, `共 ${filteredEvents.length} 条记录`),
        React.createElement(
          "div",
          { style: { display: "flex", gap: "4px" } },
          ["<", "1", "2", "3", ">"].map((p, i) => React.createElement(
            "button",
            {
              key: i,
              style: {
                width: "30px",
                height: "30px",
                borderRadius: "5px",
                border: p === "1" ? "1px solid #4F46E5" : "1px solid #E2E8F0",
                background: p === "1" ? "#4F46E5" : "#FFFFFF",
                color: p === "1" ? "#FFFFFF" : "#475569",
                fontSize: "12px",
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: p === "1" ? 600 : 500
              }
            },
            p
          ))
        )
      )
    );
}

function FilterGroup({ label, value, onChange, options }) {
  return React.createElement(
    "div",
    { style: { display: "flex", alignItems: "center", gap: "8px" } },
    React.createElement("span", {
      style: { fontSize: "12px", color: "#64748B", fontWeight: 500, whiteSpace: "nowrap" }
    }, `${label}：`),
    React.createElement(
      "div",
      { style: { display: "flex", gap: "4px" } },
      options.map(opt => React.createElement(
        "button",
        {
          key: opt.key,
          onClick: () => onChange(opt.key),
          style: {
            padding: "5px 12px",
            fontSize: "12px",
            borderRadius: "5px",
            border: value === opt.key ? "1px solid #4F46E5" : "1px solid #E2E8F0",
            background: value === opt.key ? "rgba(79, 70, 229, 0.06)" : "#FFFFFF",
            color: value === opt.key ? "#4F46E5" : "#475569",
            cursor: "pointer",
            fontWeight: value === opt.key ? 600 : 400,
            fontFamily: "inherit",
            transition: "all 0.15s"
          }
        },
        opt.label
      ))
    )
  );
}

function EventTableRow({ event, onViewDetail }) {
  const sevStyle = window.SEVERITY_STYLES[event.severity];
  const statStyle = window.STATUS_STYLES[event.status];

  const rowBg = event.status === "overdue"
    ? "rgba(127, 29, 29, 0.03)"
    : event.status === "pending" && event.severity === "P0"
    ? "rgba(220, 38, 38, 0.02)"
    : "transparent";

  return React.createElement(
    "div",
    {
      style: {
        display: "grid",
        gridTemplateColumns: "120px 1.2fr 80px 110px 150px 110px 110px 80px",
        padding: "14px 20px",
        borderBottom: "1px solid #F1F5F9",
        alignItems: "center",
        fontSize: "13px",
        background: rowBg,
        transition: "background 0.15s",
        cursor: "pointer",
        position: "relative"
      },
      onMouseEnter: e => e.currentTarget.style.background = event.status === "overdue" ? "rgba(127, 29, 29, 0.05)" : "#F8FAFC",
      onMouseLeave: e => e.currentTarget.style.background = rowBg,
      onClick: onViewDetail
    },
      // Left severity bar
      React.createElement("div", {
        style: {
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "3px",
          background: sevStyle.text,
          opacity: event.status === "resolved" ? 0.4 : 1
        }
      }),
      // Event ID
      React.createElement(
        "span",
        {
          style: {
            fontFamily: "'SF Mono', monospace",
            fontSize: "12px",
            color: "#475569",
            fontWeight: 500,
            marginLeft: "10px"
          }
        },
        event.id
      ),
      // Type
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "3px" } },
        React.createElement("span", {
          style: { fontWeight: 500, color: "#0F172A" }
        }, `${event.type} · ${event.typeName}`),
        React.createElement("span", {
          style: {
            fontSize: "11px",
            color: "#94A3B8",
            display: "-webkit-box",
            WebkitLineClamp: 1,
            WebkitBoxOrient: "vertical",
            overflow: "hidden"
          }
        }, event.description)
      ),
      // Severity
      React.createElement(window.SeverityBadge, { severity: event.severity }),
      // Camera
      React.createElement(
        "span",
        { style: { color: "#475569", fontSize: "12px" } },
        event.cameraName
      ),
      // Time
      React.createElement(
        "span",
        {
          style: {
            color: "#64748B",
            fontSize: "12px",
            fontFamily: "'SF Mono', monospace"
          }
        },
        event.timestamp
      ),
      // Status
      React.createElement(window.StatusBadge, { status: event.status }),
      // SLA
      React.createElement(
        "span",
        {
          style: {
            fontFamily: "'SF Mono', monospace",
            fontSize: "12px",
            fontWeight: 600,
            color: event.status === "overdue"
              ? "#991B1B"
              : event.status === "resolved"
              ? "#059669"
              : event.severity === "P0"
              ? "#DC2626"
              : "#475569"
          }
        },
        event.slaRemaining
      ),
      // Action
      React.createElement(
        "div",
        { style: { textAlign: "right" } },
        React.createElement(
          "button",
          {
            onClick: e => { e.stopPropagation(); onViewDetail(); },
            style: {
              background: "transparent",
              border: "none",
              color: "#4F46E5",
              fontSize: "12px",
              cursor: "pointer",
              fontWeight: 500,
              padding: "4px 8px",
              borderRadius: "4px",
              fontFamily: "inherit"
            }
          },
          "查看 →"
        )
      )
    );
}

Object.assign(window, { RectificationPage });
