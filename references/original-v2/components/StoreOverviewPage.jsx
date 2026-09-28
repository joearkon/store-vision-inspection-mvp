// Store Overview Page - Multi-store portfolio dashboard

function StoreOverviewPage({ onNavigate }) {
  const stats = window.PORTFOLIO_STATS;
  const stores = window.STORES;
  const events = window.PORTFOLIO_EVENTS;
  const categoryStats = window.PORTFOLIO_CATEGORY_STATS;
  const cameraImages = window.CAMERA_IMAGES;

  // Sort stores: critical first, then warning, then good, then excellent
  const healthOrder = { critical: 0, warning: 1, good: 2, excellent: 3 };
  const sortedStores = [...stores].sort((a, b) => healthOrder[a.healthLevel] - healthOrder[b.healthLevel]);

  const healthLabelMap = {
    excellent: { text: "优秀", color: "#059669", bg: "rgba(5, 150, 105, 0.1)", border: "rgba(5, 150, 105, 0.25)" },
    good: { text: "良好", color: "#2563EB", bg: "rgba(37, 99, 235, 0.1)", border: "rgba(37, 99, 235, 0.25)" },
    warning: { text: "告警", color: "#D97706", bg: "rgba(217, 119, 6, 0.1)", border: "rgba(217, 119, 6, 0.25)" },
    critical: { text: "严重", color: "#DC2626", bg: "rgba(220, 38, 38, 0.1)", border: "rgba(220, 38, 38, 0.25)" }
  };

  const statusStyleMap = {
    online: { text: "营业中", color: "#059669", dot: "#10B981" },
    maintenance: { text: "维护中", color: "#DC2626", dot: "#DC2626" },
    offline: { text: "离线", color: "#64748B", dot: "#94A3B8" }
  };

  return React.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "20px" } },

    // Top stats row
    React.createElement(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "16px"
        }
      },
      React.createElement(StatsCard, {
        label: "门店总数",
        value: stats.totalStores,
        sub: `${stats.onlineStores} 营业中 · ${stats.maintenanceStores} 维护中`,
        accent: "#4F46E5",
        icon: window.ICONS.store
      }),
      React.createElement(StatsCard, {
        label: "今日异常总数",
        value: stats.todayTotalEvents,
        sub: `P0 ${stats.p0Total} · P1 ${stats.p1Total} · P2 ${stats.p2Total}`,
        accent: "#DC2626",
        icon: window.ICONS.event
      }),
      React.createElement(StatsCard, {
        label: "待处理事件",
        value: stats.pendingTotal,
        sub: `${stats.overdueTotal} 个已超时`,
        accent: "#2563EB",
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
      }),
      React.createElement(StatsCard, {
        label: "在线摄像头",
        value: `${stats.onlineCameras}/${stats.totalCameras}`,
        sub: `覆盖率 ${((stats.onlineCameras / stats.totalCameras) * 100).toFixed(1)}%`,
        accent: "#059669",
        icon: window.ICONS.camera
      }),
      React.createElement(StatsCard, {
        label: "SLA 达标率",
        value: `${stats.avgSlaCompliance}%`,
        sub: `门店均分 ${stats.avgHealthScore}`,
        accent: "#7C3AED",
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
      })
    ),

    // Main content grid
    React.createElement(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          gap: "20px"
        }
      },

      // Left: Store list
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "20px" } },

        // Store health cards
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
              }, "门店健康度"),
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
                `共 ${stores.length} 家`
              )
            ),
            React.createElement(
              "div",
              { style: { display: "flex", gap: "6px", alignItems: "center", fontSize: "11px", color: "#64748B" } },
              React.createElement("span", { style: { display: "flex", alignItems: "center", gap: "4px" } },
                React.createElement("span", { style: { width: "8px", height: "8px", borderRadius: "50%", background: "#DC2626" } }), "严重"
              ),
              React.createElement("span", { style: { display: "flex", alignItems: "center", gap: "4px" } },
                React.createElement("span", { style: { width: "8px", height: "8px", borderRadius: "50%", background: "#D97706" } }), "告警"
              ),
              React.createElement("span", { style: { display: "flex", alignItems: "center", gap: "4px" } },
                React.createElement("span", { style: { width: "8px", height: "8px", borderRadius: "50%", background: "#2563EB" } }), "良好"
              ),
              React.createElement("span", { style: { display: "flex", alignItems: "center", gap: "4px" } },
                React.createElement("span", { style: { width: "8px", height: "8px", borderRadius: "50%", background: "#059669" } }), "优秀"
              )
            )
          ),
          React.createElement(
            "div",
            { style: { padding: "16px 20px 20px" } },
            React.createElement(
              "div",
              {
                style: {
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "12px"
                }
              },
              sortedStores.map(store => React.createElement(StoreCard, {
                key: store.id,
                store,
                healthStyle: healthLabelMap[store.healthLevel],
                statusStyle: statusStyleMap[store.status],
                imageUrl: cameraImages[store.imageKey],
                onClick: () => onNavigate("dashboard", { storeId: store.id })
              }))
            )
          )
        ),

        // Event category distribution
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
            }, "全门店异常类型分布"),
            React.createElement(
              "span",
              { style: { fontSize: "12px", color: "#64748B" } },
              `今日共 ${stats.todayTotalEvents} 起`
            )
          ),
          React.createElement(
            "div",
            { style: { padding: "20px" } },
            React.createElement(CategoryBarChart, { data: categoryStats, total: stats.todayTotalEvents })
          )
        )
      ),

      // Right: Recent events across all stores
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
          }, "全门店最新告警"),
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
          { style: { maxHeight: "560px", overflowY: "auto" } },
          events.map(ev => React.createElement(PortfolioEventRow, {
            key: ev.id,
            event: ev,
            onClick: () => onNavigate("event", { eventId: ev.id, storeId: ev.storeId })
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

function StoreCard({ store, healthStyle, statusStyle, imageUrl, onClick }) {
  return React.createElement(
    "div",
    {
      onClick,
      style: {
        background: "#FFFFFF",
        border: `1px solid ${healthStyle.border}`,
        borderRadius: "8px",
        overflow: "hidden",
        cursor: "pointer",
        transition: "all 0.2s ease",
        display: "flex",
        flexDirection: "column"
      },
      onMouseEnter: e => {
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(15, 23, 42, 0.08)";
        e.currentTarget.style.transform = "translateY(-1px)";
      },
      onMouseLeave: e => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "translateY(0)";
      }
    },
    // Thumbnail
    React.createElement(
      "div",
      {
        style: {
          position: "relative",
          aspectRatio: "16/9",
          background: "#1E293B",
          overflow: "hidden"
        }
      },
      React.createElement("img", {
        src: imageUrl,
        alt: store.name,
        style: {
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: store.status === "maintenance" ? "grayscale(0.8) brightness(0.5)" : "brightness(0.85)",
          opacity: store.status === "maintenance" ? 0.6 : 1
        }
      }),
      // Health badge
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
            padding: "4px 10px",
            background: healthStyle.bg,
            backdropFilter: "blur(8px)",
            border: `1px solid ${healthStyle.border}`,
            borderRadius: "4px",
            fontSize: "11px",
            fontWeight: 600,
            color: healthStyle.color
          }
        },
        React.createElement("span", {
          style: { width: "6px", height: "6px", borderRadius: "50%", background: healthStyle.color }
        }),
        `健康度 ${store.healthScore}`
      ),
      // Status badge
      React.createElement(
        "div",
        {
          style: {
            position: "absolute",
            top: "10px",
            right: "10px",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            padding: "4px 10px",
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(8px)",
            borderRadius: "4px",
            fontSize: "11px",
            fontWeight: 500,
            color: "#FFFFFF"
          }
        },
        React.createElement("span", {
          style: { width: "6px", height: "6px", borderRadius: "50%", background: statusStyle.dot, animation: "pulse 2s infinite" }
        }),
        statusStyle.text
      ),
      // Store name overlay bottom
      React.createElement(
        "div",
        {
          style: {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "12px 12px 10px",
            background: "linear-gradient(to top, rgba(15, 23, 42, 0.85), transparent)"
          }
        },
        React.createElement(
          "div",
          { style: { fontSize: "13px", fontWeight: 600, color: "#F8FAFC" } },
          store.name
        ),
        React.createElement(
          "div",
          { style: { fontSize: "11px", color: "#CBD5E1", marginTop: "2px" } },
          `${store.city} · ${store.manager}`
        )
      )
    ),
    // Metrics
    React.createElement(
      "div",
      {
        style: {
          padding: "12px 14px",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "8px",
          borderTop: `1px solid ${healthStyle.border}`
        }
      },
      React.createElement(
        "div",
        { style: { textAlign: "center" } },
        React.createElement("div", {
          style: { fontSize: "16px", fontWeight: 700, color: "#0F172A", fontVariantNumeric: "tabular-nums" }
        }, store.todayEvents),
        React.createElement("div", { style: { fontSize: "10px", color: "#64748B", marginTop: "2px" } }, "今日异常")
      ),
      React.createElement(
        "div",
        { style: { textAlign: "center" } },
        React.createElement("div", {
          style: { fontSize: "16px", fontWeight: 700, color: store.p0Count > 0 ? "#DC2626" : "#0F172A", fontVariantNumeric: "tabular-nums" }
        }, store.p0Count),
        React.createElement("div", { style: { fontSize: "10px", color: "#64748B", marginTop: "2px" } }, "P0 严重")
      ),
      React.createElement(
        "div",
        { style: { textAlign: "center" } },
        React.createElement("div", {
          style: { fontSize: "16px", fontWeight: 700, color: store.overdueEvents > 0 ? "#DC2626" : "#059669", fontVariantNumeric: "tabular-nums" }
        }, `${store.slaCompliance}%`),
        React.createElement("div", { style: { fontSize: "10px", color: "#64748B", marginTop: "2px" } }, "SLA 达标")
      )
    )
  );
}

function CategoryBarChart({ data, total }) {
  const maxCount = Math.max(...data.map(d => d.count));
  return React.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "14px" } },
    data.map(item => {
      const pct = (item.count / maxCount) * 100;
      const share = ((item.count / total) * 100).toFixed(1);
      return React.createElement(
        "div",
        { key: item.key, style: { display: "flex", flexDirection: "column", gap: "6px" } },
        React.createElement(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
          React.createElement(
            "span",
            { style: { fontSize: "12px", fontWeight: 500, color: "#334155" } },
            item.name
          ),
          React.createElement(
            "span",
            { style: { fontSize: "12px", color: "#64748B", fontVariantNumeric: "tabular-nums" } },
            `${item.count} 起 · ${share}%`
          )
        ),
        React.createElement(
          "div",
          {
            style: {
              height: "8px",
              background: "#F1F5F9",
              borderRadius: "4px",
              overflow: "hidden"
            }
          },
          React.createElement("div", {
            style: {
              height: "100%",
              width: `${pct}%`,
              background: item.color,
              borderRadius: "4px",
              transition: "width 0.6s ease"
            }
          })
        )
      );
    })
  );
}

function PortfolioEventRow({ event, onClick }) {
  const sevStyle = window.SEVERITY_STYLES[event.severity];
  const stStyle = window.STATUS_STYLES[event.status];

  return React.createElement(
    "div",
    {
      onClick,
      style: {
        display: "flex",
        gap: "12px",
        padding: "12px 16px",
        borderBottom: "1px solid #F1F5F9",
        cursor: "pointer",
        transition: "background 0.15s"
      },
      onMouseEnter: e => { e.currentTarget.style.background = "#F8FAFC"; },
      onMouseLeave: e => { e.currentTarget.style.background = "transparent"; }
    },
    // Severity bar
    React.createElement("div", {
      style: {
        width: "3px",
        borderRadius: "2px",
        background: sevStyle.text,
        flexShrink: 0
      }
    }),
    // Content
    React.createElement(
      "div",
      { style: { flex: 1, minWidth: 0 } },
      React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" } },
        React.createElement(
          "span",
          {
            style: {
              fontSize: "12px",
              fontWeight: 600,
              color: sevStyle.text,
              padding: "1px 6px",
              borderRadius: "3px",
              background: sevStyle.bg,
              border: `1px solid ${sevStyle.border}`
            }
          },
          event.severity
        ),
        React.createElement(
          "span",
          {
            style: {
              fontSize: "13px",
              fontWeight: 600,
              color: "#0F172A",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }
          },
          event.typeName
        )
      ),
      React.createElement(
        "div",
        { style: { fontSize: "11px", color: "#64748B", lineHeight: 1.4 } },
        React.createElement("span", { style: { color: "#4F46E5", fontWeight: 500 } }, event.storeName),
        ` · ${event.locationZh}`,
        React.createElement("span", { style: { margin: "0 4px", color: "#CBD5E1" } }, "·"),
        event.timeAgo
      ),
      React.createElement(
        "div",
        { style: { marginTop: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" } },
        React.createElement(
          "span",
          {
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "11px",
              color: stStyle.text
            }
          },
          React.createElement("span", {
            style: { width: "5px", height: "5px", borderRadius: "50%", background: stStyle.dot }
          }),
          stStyle.label
        ),
        React.createElement(
          "span",
          { style: { fontSize: "11px", color: "#94A3B8", fontFamily: "'SF Mono', monospace" } },
          `${event.confidence}%`
        )
      )
    )
  );
}

Object.assign(window, {
  StoreOverviewPage
});
