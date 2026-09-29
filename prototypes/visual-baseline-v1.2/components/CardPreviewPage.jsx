// Card Preview Page - Feishu Interactive Card JSON examples

function CardPreviewPage() {
  const [activeTab, setActiveTab] = React.useState("p0");

  const cards = [
    {
      key: "p0",
      label: "P0 严重告警",
      severity: "P0",
      themeColor: "#DC2626",
      description: "食品安全、人身安全类严重异常，5 分钟内须响应",
      fileName: "card_p0_severe.json"
    },
    {
      key: "p1",
      label: "P1 标准告警",
      severity: "P1",
      themeColor: "#EA580C",
      description: "操作规范、合规着装类一般异常，30 分钟内须响应",
      fileName: "card_p1_standard.json"
    },
    {
      key: "sla",
      label: "SLA 升级提醒",
      severity: "P0",
      themeColor: "#991B1B",
      description: "P0 告警超时未处理，升级通知管理员介入",
      fileName: "card_sla_escalation.json"
    }
  ];

  // Load card JSON content from the reference files
  const cardContents = {
    p0: `{\n  "schema": "2.0",\n  "config": {\n    "update_multi": true,\n    "style": {\n      "color": {\n        "bottom_bg": {\n          "light_mode": "rgba(246, 248, 255, 1)",\n          "dark_mode": "rgba(10, 17, 41, 1)"\n        }\n      }\n    },\n    "summary": {\n      "content": "P0严重告警：前台员工未佩戴手套，置信度92%"\n    }\n  },\n  "body": {\n    "direction": "vertical",\n    "elements": [\n      {\n        "tag": "markdown",\n        "content": "**<font color='red'>门店视觉巡检告警</font>**<text_tag color='red'>P0-严重</text_tag>",\n        "text_size": "heading",\n        "margin": "12px 20px 0px 20px"\n      },\n      {\n        "tag": "markdown",\n        "content": "<font color='grey'>MOMOYO JTU 店 · 前台-01 · 2026-09-27 09:23</font>",\n        "margin": "4px 20px 0px 20px"\n      },\n      {\n        "tag": "interactive_container",\n        "background_style": "orange-50",\n        "padding": "14px 16px",\n        "margin": "12px 20px 0px 20px",\n        "elements": [\n          {\n            "tag": "markdown",\n            "content": "**<font color='red'>A1 未佩戴手套</font>**  置信度 **92%**"\n          },\n          {\n            "tag": "markdown",\n            "content": "<font color='grey'>员工在制作黑糖珍珠奶茶时，左手直接接触珍珠容器内壁，未佩戴一次性手套。</font>",\n            "text_size": "notation"\n          }\n        ]\n      },\n      {\n        "tag": "interactive_container",\n        "background_style": "grey-50",\n        "padding": "14px 16px",\n        "margin": "8px 20px 0px 20px",\n        "elements": [\n          {\n            "tag": "markdown",\n            "content": "**判定依据**\\n<font color='grey'>《食品操作规范》第 3.2 条：接触即食食品须佩戴一次性手套</font>"\n          }\n        ]\n      },\n      {\n        "tag": "column_set",\n        "columns": [\n          {\n            "tag": "column",\n            "width": "weighted",\n            "weight": 1,\n            "elements": [\n              {\n                "tag": "button",\n                "text": { "tag": "plain_text", "content": "查看详情" },\n                "type": "primary_filled",\n                "width": "fill"\n              }\n            ]\n          },\n          {\n            "tag": "column",\n            "width": "weighted",\n            "weight": 1,\n            "elements": [\n              {\n                "tag": "button",\n                "text": { "tag": "plain_text", "content": "标记已处理" },\n                "type": "default",\n                "width": "fill"\n              }\n            ]\n          }\n        ],\n        "margin": "12px 20px 0px 20px"\n      },\n      {\n        "tag": "interactive_container",\n        "background_style": "bottom_bg",\n        "padding": "12px 4px",\n        "margin": "12px 0px 0px 0px",\n        "elements": [\n          {\n            "tag": "markdown",\n            "content": "<font color='footer_text'>来自：门店视觉巡检系统 · AI 自动检测 · EVT-0927-001</font>",\n            "text_size": "small"\n          }\n        ]\n      }\n    ]\n  }\n}`,
    p1: `{\n  "schema": "2.0",\n  "config": {\n    "update_multi": true,\n    "style": {\n      "color": {\n        "bottom_bg": {\n          "light_mode": "rgba(246, 248, 255, 1)",\n          "dark_mode": "rgba(10, 17, 41, 1)"\n        }\n      }\n    },\n    "summary": {\n      "content": "P1一般告警：冷藏柜门未关闭，置信度87%"\n    }\n  },\n  "body": {\n    "direction": "vertical",\n    "elements": [\n      {\n        "tag": "markdown",\n        "content": "**<font color='indigo'>门店视觉巡检告警</font>**<text_tag color='orange'>P1-一般</text_tag>",\n        "text_size": "heading",\n        "margin": "12px 20px 0px 20px"\n      },\n      {\n        "tag": "markdown",\n        "content": "<font color='grey'>MOMOYO JTU 店 · 仓储区-01 · 2026-09-27 08:45</font>",\n        "margin": "4px 20px 0px 20px"\n      },\n      {\n        "tag": "interactive_container",\n        "background_style": "blue-50",\n        "padding": "14px 16px",\n        "margin": "12px 20px 0px 20px",\n        "elements": [\n          {\n            "tag": "markdown",\n            "content": "**<font color='orange'>E1 冰箱门未关</font>**  置信度 **87%**"\n          },\n          {\n            "tag": "markdown",\n            "content": "<font color='grey'>仓储区冷藏柜门敞开超过 30 秒，内部牛奶及水果原料暴露于室温环境。</font>",\n            "text_size": "notation"\n          }\n        ]\n      },\n      {\n        "tag": "interactive_container",\n        "background_style": "grey-50",\n        "padding": "14px 16px",\n        "margin": "8px 20px 0px 20px",\n        "elements": [\n          {\n            "tag": "markdown",\n            "content": "**整改建议**\\n<font color='grey'>立即关闭冷藏柜门，检查内部原料温度是否异常。如温度超标，按报损流程处理。</font>"\n          }\n        ]\n      },\n      {\n        "tag": "column_set",\n        "columns": [\n          {\n            "tag": "column",\n            "elements": [\n              {\n                "tag": "button",\n                "text": { "tag": "plain_text", "content": "查看详情" },\n                "type": "primary_filled",\n                "width": "fill"\n              }\n            ]\n          },\n          {\n            "tag": "column",\n            "elements": [\n              {\n                "tag": "button",\n                "text": { "tag": "plain_text", "content": "标记已处理" },\n                "type": "default",\n                "width": "fill"\n              }\n            ]\n          }\n        ],\n        "margin": "12px 20px 0px 20px"\n      }\n    ]\n  }\n}`,
    sla: `{\n  "schema": "2.0",\n  "config": {\n    "update_multi": true,\n    "style": {\n      "color": {\n        "bottom_bg": {\n          "light_mode": "rgba(246, 248, 255, 1)",\n          "dark_mode": "rgba(10, 17, 41, 1)"\n        }\n      }\n    },\n    "summary": {\n      "content": "SLA升级：P0告警超时未处理，需管理员介入"\n    }\n  },\n  "body": {\n    "direction": "vertical",\n    "elements": [\n      {\n        "tag": "markdown",\n        "content": "**<font color='red'>SLA 升级提醒</font>**<text_tag color='red'>超时未处理</text_tag>",\n        "text_size": "heading",\n        "margin": "12px 20px 0px 20px"\n      },\n      {\n        "tag": "markdown",\n        "content": "<font color='grey'>MOMOYO JTU 店 · 2026-09-27 09:28 · 已超时 5 分钟</font>",\n        "margin": "4px 20px 0px 20px"\n      },\n      {\n        "tag": "interactive_container",\n        "background_style": "grey-900",\n        "padding": "14px 16px",\n        "margin": "12px 20px 0px 20px",\n        "elements": [\n          {\n            "tag": "markdown",\n            "content": "<font color='white'>**P0 告警已超时未确认**</font>"\n          },\n          {\n            "tag": "markdown",\n            "content": "<font color='white'>原事件：前台员工未佩戴手套（A1）· 置信度 92%\\n触发时间：09:23 · 当前状态：未确认</font>",\n            "text_size": "notation"\n          }\n        ]\n      },\n      {\n        "tag": "interactive_container",\n        "background_style": "orange-50",\n        "padding": "12px 8px",\n        "margin": "12px 20px 0px 20px",\n        "elements": [\n          {\n            "tag": "markdown",\n            "content": "<font color='orange'>**管理员介入**</font>：该 P0 事件已超过 5 分钟未处理，建议立即联系门店店长确认并整改。"\n          }\n        ]\n      },\n      {\n        "tag": "column_set",\n        "columns": [\n          {\n            "tag": "column",\n            "elements": [\n              {\n                "tag": "button",\n                "text": { "tag": "plain_text", "content": "查看原事件" },\n                "type": "primary_filled",\n                "width": "fill"\n              }\n            ]\n          },\n          {\n            "tag": "column",\n            "elements": [\n              {\n                "tag": "button",\n                "text": { "tag": "plain_text", "content": "强制关闭" },\n                "type": "default",\n                "width": "fill"\n              }\n            ]\n          }\n        ],\n        "margin": "12px 20px 0px 20px"\n      }\n    ]\n  }\n}`
  };

  return React.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "20px" } },
      // Header
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
        }, "飞书卡片预览"),
        React.createElement("p", {
          style: { fontSize: "13px", color: "#64748B", margin: 0, lineHeight: 1.5 }
        }, "飞书 Interactive Card JSON 模板，用于告警推送和 SLA 升级通知")
      ),

      // Tabs
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            gap: "0",
            borderBottom: "1px solid #E2E8F0"
          }
        },
        cards.map(card => React.createElement(
          "button",
          {
            key: card.key,
            onClick: () => setActiveTab(card.key),
            style: {
              padding: "12px 20px",
              fontSize: "13px",
              fontWeight: activeTab === card.key ? 600 : 500,
              color: activeTab === card.key ? card.themeColor : "#64748B",
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${activeTab === card.key ? card.themeColor : "transparent"}`,
              cursor: "pointer",
              fontFamily: "inherit",
              marginBottom: "-1px",
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }
          },
          React.createElement("span", {
            style: {
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: card.themeColor
            }
          }),
          card.label
        ))
      ),

      // Card preview + code
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
        // Card mock display
        React.createElement(
          "div",
          {
            style: {
              background: "#F1F5F9",
              borderRadius: "12px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px"
            }
          },
          React.createElement(
            "span",
            {
              style: {
                fontSize: "11px",
                color: "#94A3B8",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.08em"
              }
            },
            "卡片效果预览"
          ),
          React.createElement(FeishuCardMock, { type: activeTab })
        ),

        // Code block
        React.createElement(
          "div",
          {
            style: {
              background: "#0F172A",
              borderRadius: "8px",
              overflow: "hidden"
            }
          },
          React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 16px",
                background: "#1E293B",
                borderBottom: "1px solid #334155"
              }
            },
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "10px" } },
              React.createElement("div", { style: { display: "flex", gap: "6px" } },
                React.createElement("span", { style: { width: "10px", height: "10px", borderRadius: "50%", background: "#EF4444" } }),
                React.createElement("span", { style: { width: "10px", height: "10px", borderRadius: "50%", background: "#F59E0B" } }),
                React.createElement("span", { style: { width: "10px", height: "10px", borderRadius: "50%", background: "#10B981" } })
              ),
              React.createElement("span", {
                style: {
                  fontSize: "11px",
                  color: "#94A3B8",
                  fontFamily: "'SF Mono', monospace"
                }
              }, cards.find(c => c.key === activeTab)?.fileName)
            ),
            React.createElement(CopyButton, { text: cardContents[activeTab] })
          ),
          React.createElement(
            "pre",
            {
              style: {
                margin: 0,
                padding: "16px 20px",
                fontSize: "12px",
                lineHeight: 1.6,
                color: "#E2E8F0",
                fontFamily: "'SF Mono', 'Fira Code', Consolas, monospace",
                overflowX: "auto",
                maxHeight: "600px",
                overflowY: "auto"
              }
            },
            React.createElement("code", {}, cardContents[activeTab])
          )
        )
      ),

      // Description cards
      React.createElement(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "16px"
          }
        },
        cards.map(card => React.createElement(
          "div",
          {
            key: card.key,
            onClick: () => setActiveTab(card.key),
            style: {
              padding: "16px 18px",
              borderRadius: "8px",
              border: `1px solid ${activeTab === card.key ? card.themeColor : "#E2E8F0"}`,
              background: activeTab === card.key ? `${card.themeColor}08` : "#FFFFFF",
              cursor: "pointer",
              transition: "all 0.15s"
            }
          },
          React.createElement(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" } },
            React.createElement("span", {
              style: {
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: card.themeColor
              }
            }),
            React.createElement("h4", {
              style: { fontSize: "14px", fontWeight: 600, color: "#0F172A", margin: 0 }
            }, card.label)
          ),
          React.createElement("p", {
            style: { fontSize: "12px", color: "#64748B", margin: 0, lineHeight: 1.5 }
          }, card.description)
        ))
      )
    );
}

function CopyButton({ text }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return React.createElement(
    "button",
    {
      onClick: handleCopy,
      style: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "5px 12px",
        fontSize: "11px",
        fontWeight: 500,
        color: copied ? "#10B981" : "#94A3B8",
        background: "rgba(148, 163, 184, 0.1)",
        border: "1px solid rgba(148, 163, 184, 0.2)",
        borderRadius: "5px",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.15s"
      }
    },
    React.createElement("svg", {
      width: "13", height: "13", viewBox: "0 0 24 24",
      fill: "none", stroke: "currentColor", strokeWidth: "2",
      strokeLinecap: "round", strokeLinejoin: "round"
    },
      copied ? (
        React.createElement("polyline", { points: "20 6 9 17 4 12" })
      ) : (
        React.createElement(
          "g",
          {},
          React.createElement("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2", ry: "2" }),
          React.createElement("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })
        )
      )
    ),
    copied ? "已复制" : "复制代码"
  );
}

// Mock Feishu card visual
function FeishuCardMock({ type }) {
  const configs = {
    p0: {
      title: "门店视觉巡检告警",
      titleColor: "#DC2626",
      badge: "P0-严重",
      badgeColor: "#DC2626",
      subtitle: "MOMOYO JTU 店 · 前台-01 · 09:23",
      anomalyCode: "A1",
      anomalyName: "未佩戴手套",
      anomalyColor: "#DC2626",
      confidence: "92%",
      description: "员工在制作黑糖珍珠奶茶时，左手直接接触珍珠容器内壁，未佩戴一次性手套。",
      containerBg: "#FEF2F2",
      ruleText: "《食品操作规范》第 3.2 条：接触即食食品须佩戴一次性手套",
      suggestionText: "立即佩戴一次性手套，已制作饮品建议废弃处理。5 分钟内未确认将自动升级。",
      footer: "来自：门店视觉巡检系统 · AI 自动检测"
    },
    p1: {
      title: "门店视觉巡检告警",
      titleColor: "#4F46E5",
      badge: "P1-一般",
      badgeColor: "#EA580C",
      subtitle: "MOMOYO JTU 店 · 仓储区-01 · 08:45",
      anomalyCode: "E1",
      anomalyName: "冰箱门未关",
      anomalyColor: "#EA580C",
      confidence: "87%",
      description: "仓储区冷藏柜门敞开超过 30 秒，内部牛奶及水果原料暴露于室温环境。",
      containerBg: "#EFF6FF",
      ruleText: null,
      suggestionText: "立即关闭冷藏柜门，检查内部原料温度是否异常。如温度超标，按报损流程处理。",
      footer: "来自：门店视觉巡检系统 · AI 自动检测"
    },
    sla: {
      title: "SLA 升级提醒",
      titleColor: "#DC2626",
      badge: "超时未处理",
      badgeColor: "#DC2626",
      subtitle: "MOMOYO JTU 店 · 09:28 · 已超时 5 分钟",
      anomalyCode: null,
      anomalyName: null,
      anomalyColor: "#DC2626",
      confidence: null,
      description: null,
      containerBg: "#1F2937",
      darkContainer: true,
      ruleText: "P0 告警已超时未确认\n原事件：前台员工未佩戴手套（A1）· 置信度 92%\n触发时间：09:23 · 当前状态：未确认",
      escalation: "管理员介入：该 P0 事件已超过 5 分钟未处理，建议立即联系门店店长确认并整改。",
      suggestionText: null,
      primaryBtn: "查看原事件",
      secondaryBtn: "强制关闭",
      footer: "来自：门店视觉巡检系统 · AI 自动检测"
    }
  };

  const c = configs[type];

  return React.createElement(
    "div",
    {
      style: {
        width: "320px",
        background: "#FFFFFF",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        overflow: "hidden",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif",
        fontSize: "14px"
      }
    },
    // Title
    React.createElement(
      "div",
      { style: { padding: "12px 20px 4px" } },
      React.createElement(
        "span",
        { style: { fontWeight: 700, color: c.titleColor, fontSize: "18px" } },
        c.title
      ),
      React.createElement(
        "span",
        {
          style: {
            display: "inline-block",
            marginLeft: "6px",
            padding: "2px 8px",
            borderRadius: "4px",
            background: `${c.badgeColor}15`,
            color: c.badgeColor,
            fontSize: "12px",
            fontWeight: 600
          }
        },
        c.badge
      )
    ),
    // Subtitle
    React.createElement(
      "div",
      {
        style: {
          padding: "4px 20px 12px",
          fontSize: "13px",
          color: "#8C8C8C"
        }
      },
      c.subtitle
    ),

    // Anomaly container (or dark SLA container)
    c.darkContainer ? (
      React.createElement(
        "div",
        {
          style: {
            margin: "8px 20px",
            padding: "14px 16px",
            background: c.containerBg,
            borderRadius: "8px",
            color: "#FFFFFF"
          }
        },
        React.createElement("div", {
          style: { fontWeight: 700, marginBottom: "6px" }
        }, "P0 告警已超时未确认"),
        React.createElement("div", {
          style: { fontSize: "12px", color: "rgba(255,255,255,0.7)", lineHeight: 1.6, whiteSpace: "pre-line" }
        }, c.ruleText)
      )
    ) : (
      React.createElement(
        "div",
        {
          style: {
            margin: "8px 20px",
            padding: "14px 16px",
            background: c.containerBg,
            borderRadius: "8px"
          }
        },
        React.createElement(
          "div",
          { style: { marginBottom: "6px" } },
          React.createElement("span", {
            style: { fontWeight: 700, color: c.anomalyColor }
          }, `${c.anomalyCode} ${c.anomalyName}`),
          React.createElement("span", {
            style: { marginLeft: "8px", fontWeight: 600, color: "#1F2937" }
          }, `置信度 ${c.confidence}`)
        ),
        React.createElement("div", {
          style: { fontSize: "12px", color: "#8C8C8C", lineHeight: 1.5 }
        }, c.description)
      )
    ),

    // Escalation banner (SLA only)
    c.escalation && React.createElement(
      "div",
      {
        style: {
          margin: "8px 20px",
          padding: "10px 12px",
          background: "#FFF7ED",
          borderRadius: "8px",
          fontSize: "12px",
          color: "#C2410C",
          lineHeight: 1.5
        }
      },
      React.createElement("span", { style: { fontWeight: 700 } }, "管理员介入"),
      "：该 P0 事件已超过 5 分钟未处理，建议立即联系门店店长确认并整改。"
    ),

    // Rule reference
    c.ruleText && !c.darkContainer && React.createElement(
      InfoSection,
      { title: "判定依据", text: c.ruleText }
    ),

    // Suggestion
    c.suggestionText && React.createElement(
      InfoSection,
      { title: "整改建议", text: c.suggestionText }
    ),

    // Buttons
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          gap: "8px",
          margin: "12px 20px 16px"
        }
      },
      React.createElement(
        "button",
        {
          style: {
            flex: 1,
            padding: "8px 16px",
            background: c.titleColor,
            color: "#FFFFFF",
            border: "none",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit"
          }
        },
        c.primaryBtn || "查看详情"
      ),
      React.createElement(
        "button",
        {
          style: {
            flex: 1,
            padding: "8px 16px",
            background: "#FFFFFF",
            color: "#333333",
            border: "1px solid #D9D9D9",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit"
          }
        },
        c.secondaryBtn || "标记已处理"
      )
    ),

    // Footer
    React.createElement(
      "div",
      {
        style: {
          padding: "10px 20px",
          background: "#F6F8FF",
          fontSize: "11px",
          color: "#A1AAE0"
        }
      },
      c.footer
    )
  );
}

function InfoSection({ title, text }) {
  return React.createElement(
    "div",
    {
      style: {
        margin: "8px 20px",
        padding: "12px 16px",
        background: "#F7F7F5",
        borderRadius: "8px"
      }
    },
    React.createElement("div", {
      style: { fontWeight: 600, color: "#1F2937", marginBottom: "4px", fontSize: "13px" }
    }, title),
    React.createElement("div", {
      style: { fontSize: "12px", color: "#8C8C8C", lineHeight: 1.5 }
    }, text)
  );
}

Object.assign(window, { CardPreviewPage });
