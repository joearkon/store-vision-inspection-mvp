import React from "react";
import {Icon} from "./icons";
import {isShowcaseMode} from "./showcaseApi";
import {useSop, Card, Button} from "./SopContext";
// SOP 模板配置页
// 功能：模板列表、新建/编辑模板、配置检查项与 AI 核验规则

export function SOPTemplatePage({ onNavigate, templateId }) {
 const {data,saveTemplate: persistTemplate,removeTemplate,refresh} = useSop();
  const [templates, setTemplates] = React.useState([...data.templates]);
  const [editingTemplate, setEditingTemplate] = React.useState(null);
  const [showDrawer, setShowDrawer] = React.useState(false);
  const [drawerMode, setDrawerMode] = React.useState("view"); // view | edit | create

  const openTemplate = (tpl, mode = "view") => {
    if(isShowcaseMode) mode="view";
    setEditingTemplate(JSON.parse(JSON.stringify(tpl)));
    setDrawerMode(mode);
    setShowDrawer(true);
  };

  const createTemplate = () => {
    setEditingTemplate({
      id: `SOP-NEW-${Date.now()}`,
      name: "新建 SOP 模板",
      type: "custom",
      typeName: "自定义 SOP",
      icon: "clipboard",
      description: "",
      duration: "10 分钟",
      totalItems: 0,
      frequency: "每日一次",
      scheduledTime: "09:10",
      responsibleRole: "店长",
      color: "#4F46E5",
      items: []
    });
    setDrawerMode("create");
    setShowDrawer(true);
  };

  const saveTemplate = async () => {
    try {await persistTemplate(editingTemplate); setTemplates((await refresh()).templates);setShowDrawer(false);setEditingTemplate(null);} catch(e){alert(e.message);}
  };
  const deleteTemplate = async (id) => {
    if (!confirm("停用此模板？历史任务和证据保留。")) return;
    try {await removeTemplate(id);setTemplates((await refresh()).templates);}catch(e){alert(e.message);}
  };
  const typeMap = {
    morning: { label: "开店 SOP", color: "#F59E0B", bg: "#FFFBEB" },
    closing: { label: "闭店 SOP", color: "#6366F1", bg: "#EEF2FF" },
    hourly: { label: "时段 SOP", color: "#10B981", bg: "#ECFDF5" },
    weekly: { label: "周度 SOP", color: "#8B5CF6", bg: "#F5F3FF" },
    custom: { label: "自定义", color: "#64748B", bg: "#F1F5F9" }
  };

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
        { onClick: () => onNavigate("sop"), style: { cursor: "pointer", color: "#4F46E5", fontWeight: 500 } },
        "SOP 巡检"
      ),
      React.createElement("span", { style: { color: "#CBD5E1" } }, "/"),
      React.createElement("span", { style: { color: "#334155" } }, "模板配置")
    ),

    // Header
    React.createElement(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } },
      React.createElement(
        "div",
        {},
        React.createElement("h1", {
          style: { fontSize: "22px", fontWeight: 700, color: "#0F172A", margin: "0 0 6px 0" }
        }, "SOP 模板配置"),
        React.createElement("p", {
          style: { fontSize: "13px", color: "#64748B", margin: 0, lineHeight: 1.5 }
        }, "配置门店不同时段的巡检模板、检查项与 AI 核验规则，自动生成巡检任务")
      ),
      React.createElement(
        "div",
        { style: { display: "flex", gap: "8px" } },
        React.createElement(Button, { variant: "secondary", onClick: () => onNavigate("sop") }, "返回任务列表"),
        React.createElement(Button, { variant: "primary", onClick: createTemplate, disabled:isShowcaseMode }, "+ 新建模板")
      )
    ),

    // Stats
    React.createElement(
      "div",
      { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" } },
      React.createElement(StatCard, { label: "模板总数", value: templates.length, accent: "#4F46E5", icon: React.createElement(Icon,{name:"rules",size:20}) }),
      React.createElement(StatCard, { label: "开店类", value: templates.filter(t => t.type === "morning").length, accent: "#F59E0B", icon: React.createElement(Icon,{name:"rules",size:20}) }),
      React.createElement(StatCard, { label: "闭店类", value: templates.filter(t => t.type === "closing").length, accent: "#6366F1", icon: React.createElement(Icon,{name:"rules",size:20}) }),
      React.createElement(StatCard, { label: "AI 可核验项", value: templates.reduce((sum, t) => sum + t.items.filter(i => i.aiVerifiable).length, 0), accent: "#10B981", icon: React.createElement(Icon,{name:"rules",size:20}) })
    ),

    // Template list
    React.createElement(
      Card,
      { padding: "0" },
      // Table header
      React.createElement(
        "div",
        {
          style: {
            padding: "14px 20px",
            borderBottom: "1px solid #E2E8F0",
            display: "grid",
            gridTemplateColumns: "3fr 1fr 1fr 1fr 1fr 120px",
            gap: "16px",
            fontSize: "12px",
            fontWeight: 600,
            color: "#64748B",
            background: "#F8FAFC"
          }
        },
        React.createElement("div", {}, "模板名称"),
        React.createElement("div", {}, "类型"),
        React.createElement("div", {}, "检查项"),
        React.createElement("div", {}, "执行频次"),
        React.createElement("div", {}, "负责人"),
        React.createElement("div", { style: { textAlign: "right" } }, "操作")
      ),
      // Template rows
      templates.map((tpl, idx) => {
        const typeInfo = typeMap[tpl.type] || typeMap.custom;
        const aiCount = tpl.items.filter(i => i.aiVerifiable).length;
        return React.createElement(
          "div",
          {
            key: tpl.id,
            style: {
              padding: "16px 20px",
              borderBottom: idx === templates.length - 1 ? "none" : "1px solid #F1F5F9",
              display: "grid",
              gridTemplateColumns: "3fr 1fr 1fr 1fr 1fr 120px",
              gap: "16px",
              alignItems: "center",
              cursor: "pointer",
              transition: "background 0.15s"
            },
            onClick: () => openTemplate(tpl, "view"),
            onMouseEnter: e => e.currentTarget.style.background = "#F8FAFC",
            onMouseLeave: e => e.currentTarget.style.background = "transparent"
          },
          // Name + desc
          React.createElement(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "12px", minWidth: 0 } },
            React.createElement(
              "div",
              {
                style: {
                  width: "40px",
                  height: "40px",
                  borderRadius: "8px",
                  background: `${tpl.color}15`,
                  color: tpl.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: "18px"
                }
              },
              React.createElement(Icon,{name:"rules",size:22})
            ),
            React.createElement(
              "div",
              { style: { minWidth: 0 } },
              React.createElement("div", {
                style: { fontSize: "14px", fontWeight: 600, color: "#0F172A", marginBottom: "3px" }
              }, tpl.name),
              React.createElement("div", {
                style: { fontSize: "12px", color: "#94A3B8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }
              }, `${tpl.id} · ${tpl.description || "—"}`)
            )
          ),
          // Type
          React.createElement(
            "span",
            {
              style: {
                display: "inline-flex",
                alignItems: "center",
                padding: "3px 10px",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: 500,
                color: typeInfo.color,
                background: typeInfo.bg,
                width: "fit-content"
              }
            },
            typeInfo.label
          ),
          // Items
          React.createElement(
            "div",
            { style: { fontSize: "13px", color: "#0F172A", fontWeight: 500 } },
            `${tpl.items.length} 项`,
            aiCount > 0 && React.createElement(
              "span",
              { style: { fontSize: "11px", color: "#10B981", marginLeft: "6px", fontWeight: 500 } },
              `· ${aiCount} AI`
            )
          ),
          // Frequency
          React.createElement(
            "div",
            { style: { fontSize: "13px", color: "#475569" } },
            tpl.frequency
          ),
          // Responsible
          React.createElement(
            "div",
            { style: { fontSize: "13px", color: "#475569" } },
            tpl.responsibleRole
          ),
          // Actions
          React.createElement(
            "div",
            {
              style: { display: "flex", gap: "6px", justifyContent: "flex-end" },
              onClick: e => e.stopPropagation()
            },
            React.createElement(Button, {
              variant: "ghost",
              size: "sm",
              onClick: () => openTemplate(tpl, "edit")
            }, "编辑"),
            React.createElement(Button, {
              variant: "ghost",
              size: "sm",
              onClick: () => deleteTemplate(tpl.id),
              danger: true
            }, "删除")
          )
        );
      })
    ),

    // Drawer
    showDrawer && editingTemplate && React.createElement(
      TemplateDrawer,
      {
        template: editingTemplate,
        setTemplate: setEditingTemplate,
        mode: drawerMode,
        onClose: () => { setShowDrawer(false); setEditingTemplate(null); },
        onSave: saveTemplate,
        onEdit: () => setDrawerMode("edit"),
        typeMap
      }
    )
  );
}

function StatCard({ label, value, accent, icon }) {
  return React.createElement(
    Card,
    { padding: "16px" },
    React.createElement(
      "div",
      { style: { display: "flex", alignItems: "center", gap: "12px" } },
      React.createElement(
        "div",
        {
          style: {
            width: "40px",
            height: "40px",
            borderRadius: "8px",
            background: `${accent}15`,
            color: accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px"
          }
        },
        icon
      ),
      React.createElement(
        "div",
        {},
        React.createElement("div", {
          style: { fontSize: "20px", fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }
        }, value),
        React.createElement("div", {
          style: { fontSize: "12px", color: "#94A3B8", marginTop: "4px" }
        }, label)
      )
    )
  );
}

function TemplateDrawer({ template, setTemplate, mode, onClose, onSave, onEdit, typeMap }) {
  const [activeTab, setActiveTab] = React.useState("basic"); // basic | items | ai
  const isReadonly = mode === "view" || isShowcaseMode;

  const updateField = (key, value) => {
    setTemplate(previous=>({...previous,[key]:value}));
  };

  const addItem = () => {
    const newItem = {
      id: Date.now(),
      category: "未分类",
      text: "新检查项",
      required: true,
      aiVerifiable: false
    };
    setTemplate({ ...template, items: [...template.items, newItem] });
  };

  const updateItem = (itemId, key, value) => {
    setTemplate(previous => ({...previous,items:previous.items.map(item=>item.id===itemId?{...item,[key]:value}:item)}));
  };

  const deleteItem = (itemId) => {
    const updated = template.items.filter(item => item.id !== itemId);
    setTemplate({ ...template, items: updated });
  };

  const moveItem = (itemId, direction) => {
    const idx = template.items.findIndex(i => i.id === itemId);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= template.items.length) return;
    const items = [...template.items];
    [items[idx], items[newIdx]] = [items[newIdx], items[idx]];
    setTemplate({ ...template, items });
  };

  // Group items by category for display
  const categories = {};
  template.items.forEach(item => {
    if (!categories[item.category]) categories[item.category] = [];
    categories[item.category].push(item);
  });

  const aiItems = template.items.filter(i => i.aiVerifiable);

  const tabs = [
    { key: "basic", label: "基本信息" },
    { key: "items", label: `检查项 (${template.items.length})` },
    { key: "ai", label: `AI 核验 (${aiItems.length})` }
  ];

  return React.createElement(
    "div",
    {
      style: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        display: "flex"
      }
    },
    // Backdrop
    React.createElement("div", {
      style: {
        position: "absolute",
        inset: 0,
        background: "rgba(15, 23, 42, 0.4)",
        backdropFilter: "blur(2px)"
      },
      onClick: onClose
    }),
    // Drawer panel
    React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: "720px",
          maxWidth: "90vw",
          background: "#FFFFFF",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.08)",
          display: "flex",
          flexDirection: "column",
          animation: "slideInRight 0.25s ease-out"
        }
      },
      // Drawer header
      React.createElement(
        "div",
        {
          style: {
            padding: "20px 24px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "16px",
            flexShrink: 0
          }
        },
        React.createElement(
          "div",
          { style: { display: "flex", gap: "14px", alignItems: "center" } },
          React.createElement(
            "div",
            {
              style: {
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: `${template.color}15`,
                color: template.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px"
              }
            },
            React.createElement(Icon,{name:"rules",size:22})
          ),
          React.createElement(
            "div",
            {},
            React.createElement("div", { style: { fontSize: "16px", fontWeight: 700, color: "#0F172A", marginBottom: "4px" } },
              isReadonly ? "模板详情" : mode === "create" ? "新建模板" : "编辑模板"
            ),
            React.createElement("div", { style: { fontSize: "12px", color: "#94A3B8" } }, template.id)
          )
        ),
        React.createElement(
          "button",
          {
            onClick: onClose,
            style: {
              width: "32px",
              height: "32px",
              borderRadius: "6px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#64748B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px"
            }
          },
          "✕"
        )
      ),

      // Tabs
      React.createElement(
        "div",
        {
          style: {
            padding: "0 24px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            gap: "24px",
            flexShrink: 0
          }
        },
        tabs.map(tab =>
          React.createElement(
            "button",
            {
              key: tab.key,
              onClick: () => setActiveTab(tab.key),
              style: {
                padding: "14px 0",
                fontSize: "13px",
                fontWeight: activeTab === tab.key ? 600 : 500,
                color: activeTab === tab.key ? "#4F46E5" : "#64748B",
                border: "none",
                background: "none",
                cursor: "pointer",
                borderBottom: activeTab === tab.key ? "2px solid #4F46E5" : "2px solid transparent",
                marginBottom: "-1px"
              }
            },
            tab.label
          )
        )
      ),

      // Content
      React.createElement(
        "div",
        {
          style: {
            flex: 1,
            overflowY: "auto",
            padding: "24px"
          }
        },
        activeTab === "basic" && React.createElement(
          BasicInfoPanel,
          { template, updateField, readonly: isReadonly, typeMap }
        ),
        activeTab === "items" && React.createElement(
          CheckItemsPanel,
          { template, categories, updateItem, addItem, deleteItem, moveItem, readonly: isReadonly }
        ),
        activeTab === "ai" && React.createElement(
          AIVerificationPanel,
          { template, aiItems, updateItem, readonly: isReadonly }
        )
      ),

      // Footer
      React.createElement(
        "div",
        {
          style: {
            padding: "16px 24px",
            borderTop: "1px solid #E2E8F0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
            background: "#F8FAFC"
          }
        },
        React.createElement(
          "div",
          { style: { fontSize: "12px", color: "#94A3B8" } },
          `${template.items.length} 项检查 · ${aiItems.length} 项 AI 核验`
        ),
          React.createElement(
            "div",
            { style: { display: "flex", gap: "10px" } },
            React.createElement(Button, { variant: "secondary", size: "lg", onClick: onClose, style: { minWidth: "96px" } }, "关闭"),
            isReadonly
              ? React.createElement(Button, { variant: "primary", size: "lg", onClick: onEdit, style: { minWidth: "96px" } }, "编辑")
              : React.createElement(Button, { variant: "primary", size: "lg", onClick: onSave, style: { minWidth: "96px" } }, "保存模板")
          )
      )
    )
  );
}

function BasicInfoPanel({ template, updateField, readonly, typeMap }) {
  const typeOptions = [
    { value: "morning", label: "开店 SOP", color: "#F59E0B" },
    { value: "closing", label: "闭店 SOP", color: "#6366F1" },
    { value: "hourly", label: "时段 SOP", color: "#10B981" },
    { value: "weekly", label: "周度 SOP", color: "#8B5CF6" },
    { value: "custom", label: "自定义", color: "#64748B" }
  ];

  const freqOptions = [
    "每日一次", "每日两次", "每小时一次", "每周一次", "每班一次", "自定义"
  ];

  const colorOptions = ["#4F46E5", "#F59E0B", "#10B981", "#8B5CF6", "#EF4444", "#06B6D4", "#EC4899"];

  return React.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "20px" } },

    // Section: Basic
    formSection("基础信息", [
      formField("模板名称",
        readonly
          ? React.createElement("div", { style: fieldValueStyle }, template.name)
          : React.createElement("input", {
              value: template.name,
              onChange: e => updateField("name", e.target.value),
              style: inputStyle
            })
      ),
      formField("模板描述",
        readonly
          ? React.createElement("div", { style: fieldValueStyle }, template.description || "—")
          : React.createElement("textarea", {
              value: template.description,
              onChange: e => updateField("description", e.target.value),
              style: { ...inputStyle, minHeight: "72px", resize: "vertical", fontFamily: "inherit" }
            })
      )
    ]),

    // Section: Type & schedule
    formSection("类型与执行计划", [
      formField("模板类型",
        readonly
          ? React.createElement("span", {
              style: {
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: 500,
                color: typeMap[template.type]?.color || "#64748B",
                background: typeMap[template.type]?.bg || "#F1F5F9"
              }
            }, typeMap[template.type]?.label || "自定义")
          : React.createElement(
              "div",
              { style: { display: "flex", flexWrap: "wrap", gap: "8px" } },
              typeOptions.map(opt =>
                React.createElement(
                  "button",
                  {
                    key: opt.value,
                    onClick: () => {
                      updateField("type", opt.value);
                      updateField("typeName", opt.label);
                    },
                    style: {
                      padding: "6px 14px",
                      borderRadius: "6px",
                      border: template.type === opt.value ? `1.5px solid ${opt.color}` : "1px solid #E2E8F0",
                      background: template.type === opt.value ? `${opt.color}10` : "#FFFFFF",
                      color: template.type === opt.value ? opt.color : "#475569",
                      fontSize: "13px",
                      fontWeight: template.type === opt.value ? 600 : 500,
                      cursor: "pointer"
                    }
                  },
                  opt.label
                )
              )
            )
      ),
      formField("执行频次",
        readonly
          ? React.createElement("div", { style: fieldValueStyle }, template.frequency)
          : React.createElement("select", {
              value: template.frequency,
              onChange: e => updateField("frequency", e.target.value),
              style: inputStyle
            }, freqOptions.map(f =>
              React.createElement("option", { key: f, value: f }, f)
            ))
      ),
      formField("计划时间",
        readonly
          ? React.createElement("div", { style: { ...fieldValueStyle, fontFamily: "'JetBrains Mono', monospace" } }, template.scheduledTime)
          : React.createElement("input", {
              value: template.scheduledTime,
              onChange: e => updateField("scheduledTime", e.target.value),
              placeholder: "如 09:00 或 09:00-09:30",
              style: inputStyle
            })
      ),
      formField("预计耗时",
        readonly
          ? React.createElement("div", { style: fieldValueStyle }, template.duration)
          : React.createElement("input", {
              value: template.duration,
              onChange: e => updateField("duration", e.target.value),
              placeholder: "如 10 分钟",
              style: inputStyle
            })
      ),
      formField("负责人角色",
        readonly
          ? React.createElement("div", { style: fieldValueStyle }, template.responsibleRole)
          : React.createElement("input", {
              value: template.responsibleRole,
              onChange: e => updateField("responsibleRole", e.target.value),
              placeholder: "如 店长 / 当班主管",
              style: inputStyle
            })
      )
    ]),

    // Section: Appearance
    formSection("外观标识", [
      formField("主题色",
        React.createElement(
          "div",
          { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
          colorOptions.map(c =>
            React.createElement(
              "button",
              {
                key: c,
                onClick: () => !readonly && updateField("color", c),
                disabled: readonly,
                style: {
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  background: c,
                  border: template.color === c ? "2.5px solid #0F172A" : "2px solid transparent",
                  cursor: readonly ? "default" : "pointer",
                  padding: 0,
                  transition: "transform 0.1s"
                }
              }
            )
          )
        )
      )
    ])
  );
}

function CheckItemsPanel({ template, categories, updateItem, addItem, deleteItem, moveItem, readonly }) {
  return React.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "20px" } },
    Object.entries(categories).map(([cat, items]) =>
      React.createElement(
        "div",
        { key: cat },
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "12px"
            }
          },
          React.createElement("div", {
            style: {
              width: "3px",
              height: "14px",
              borderRadius: "2px",
              background: "#4F46E5"
            }
          }),
          React.createElement("span", {
            style: { fontSize: "13px", fontWeight: 600, color: "#0F172A" }
          }, cat),
          React.createElement("span", {
            style: { fontSize: "12px", color: "#94A3B8" }
          }, `${items.length} 项`)
        ),
        React.createElement(
          "div",
          {
            style: {
              border: "1px solid #E2E8F0",
              borderRadius: "8px",
              overflow: "hidden",
              background: "#FFFFFF"
            }
          },
          items.map((item, idx) =>
            React.createElement(CheckItemRow, {
              key: item.id,
              item,
              isLast: idx === items.length - 1,
              updateItem,
              deleteItem,
              moveItem,
              readonly,
              isFirst: idx === 0
            })
          )
        )
      )
    ),

    !readonly && React.createElement(
      "button",
      {
        onClick: addItem,
        style: {
          padding: "12px",
          border: "1.5px dashed #CBD5E1",
          borderRadius: "8px",
          background: "#F8FAFC",
          color: "#4F46E5",
          fontSize: "13px",
          fontWeight: 500,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          transition: "all 0.15s"
        }
      },
      "+ 添加检查项"
    )
  );
}

function CheckItemRow({ item, isLast, updateItem, deleteItem, moveItem, readonly, isFirst }) {
  const [editing, setEditing] = React.useState(!readonly && item.text === "新检查项");
  const [draftText, setDraftText] = React.useState(item.text);
  const [draftCat, setDraftCat] = React.useState(item.category);

  const saveEdit = () => {
    updateItem(item.id, "text", draftText);
    updateItem(item.id, "category", draftCat);
    setEditing(false);
  };

  if (editing) {
    return React.createElement(
      "div",
      {
        style: {
          padding: "14px 16px",
          borderBottom: isLast ? "none" : "1px solid #F1F5F9",
          background: "#F8FAFC",
          display: "flex",
          flexDirection: "column",
          gap: "10px"
        }
      },
      React.createElement(
        "div",
        { style: { display: "flex", gap: "10px" } },
        React.createElement("input", {
          value: draftText,
          onChange: e => setDraftText(e.target.value),
          placeholder: "检查项内容",
          style: { ...inputStyle, flex: 1 }
        }),
        React.createElement("input", {
          value: draftCat,
          onChange: e => setDraftCat(e.target.value),
          placeholder: "分类",
          style: { ...inputStyle, width: "120px" }
        })
      ),
      React.createElement(
        "div",
        { style: { display: "flex", gap: "8px", justifyContent: "flex-end" } },
        React.createElement(Button, { variant: "ghost", size: "sm", onClick: () => setEditing(false) }, "取消"),
        React.createElement(Button, { variant: "primary", size: "sm", onClick: saveEdit }, "保存")
      )
    );
  }

  return React.createElement(
    "div",
    {
      style: {
        padding: "14px 16px",
        borderBottom: isLast ? "none" : "1px solid #F1F5F9",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        transition: "background 0.15s"
      },
      onMouseEnter: e => e.currentTarget.style.background = "#F8FAFC",
      onMouseLeave: e => e.currentTarget.style.background = "transparent"
    },
    // Drag handle / index
    React.createElement(
      "div",
      {
        style: {
          width: "24px",
          fontSize: "12px",
          color: "#CBD5E1",
          fontWeight: 500,
          textAlign: "center",
          flexShrink: 0,
          fontFamily: "'JetBrains Mono', monospace"
        }
      },
      item.id
    ),
    // Item text
    React.createElement(
      "div",
      { style: { flex: 1, minWidth: 0 } },
      React.createElement("div", {
        style: { fontSize: "13px", fontWeight: 500, color: "#0F172A", marginBottom: "4px", display: "flex", alignItems: "center", gap: "8px" }
      },
        item.required && React.createElement(
          "span", { style: { color: "#EF4444", fontSize: "12px" } }, "*"
        ),
        item.text
      ),
      React.createElement(
        "div",
        { style: { display: "flex", gap: "8px", alignItems: "center" } },
        item.aiVerifiable && React.createElement(
          "span",
          {
            style: {
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "4px",
              background: "#ECFDF5",
              color: "#059669",
              fontWeight: 500
            }
          },
          "AI 可核验"
        ),
        item.required && React.createElement(
          "span",
          {
            style: {
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "4px",
              background: "#FEF2F2",
              color: "#DC2626",
              fontWeight: 500
            }
          },
          "必填"
        )
      )
    ),
    // Actions
    !readonly && React.createElement(
      "div",
      { style: { display: "flex", gap: "4px", opacity: 0.8 } },
      React.createElement("button", {
        onClick: () => moveItem(item.id, "up"),
        disabled: isFirst,
        style: {
          width: "28px", height: "28px", borderRadius: "6px",
          border: "1px solid #E2E8F0", background: "#FFFFFF",
          cursor: isFirst ? "not-allowed" : "pointer",
          color: isFirst ? "#CBD5E1" : "#64748B",
          fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center"
        }
      }, "↑"),
      React.createElement("button", {
        onClick: () => moveItem(item.id, "down"),
        disabled: isLast,
        style: {
          width: "28px", height: "28px", borderRadius: "6px",
          border: "1px solid #E2E8F0", background: "#FFFFFF",
          cursor: isLast ? "not-allowed" : "pointer",
          color: isLast ? "#CBD5E1" : "#64748B",
          fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center"
        }
      }, "↓"),
      React.createElement(Button, {
        variant: "ghost", size: "sm",
        onClick: () => setEditing(true)
      }, "编辑"),
      React.createElement(Button, {
        variant: "ghost", size: "sm", danger: true,
        onClick: () => deleteItem(item.id)
      }, "删除")
    )
  );
}

function AIVerificationPanel({ template, aiItems, updateItem, readonly }) {
  const aiTypes = [
    { value: "mask_detection", label: "口罩佩戴检测", desc: "识别员工是否规范佩戴口罩" },
    { value: "floor_mopping", label: "拖地清洁检测", desc: "识别时段内是否有拖地作业行为" },
    { value: "uniform_check", label: "工服着装检查", desc: "核验可见工服或围裙；工牌需人工确认" },
    { value: "counter_clean", label: "台面清洁检测", desc: "尚未接入 SOP 自动核验，需人工复核" },
    { value: "fire_exit", label: "消防通道检测", desc: "需人工复核" },
    { value: "queue_order", label: "排队秩序检测", desc: "需人工复核" }
  ];

  const setAIType = (itemId, aiType, checked) => {
    updateItem(itemId, "aiVerifiable", checked);
    if (checked) {
      updateItem(itemId, "aiType", aiType);
    } else {
      updateItem(itemId, "aiType", undefined);
    }
  };

  return React.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "20px" } },
    // Summary
    React.createElement(
      "div",
      {
        style: {
          padding: "16px",
          border: "1px solid #E0E7FF",
          borderRadius: "8px",
          background: "#EEF2FF"
        }
      },
      React.createElement("div", { style: { fontSize: "13px", fontWeight: 600, color: "#3730A3", marginBottom: "6px" } }, "AI 核验覆盖"),
      React.createElement("div", { style: { fontSize: "12px", color: "#6366F1" } },
        `当前模板共 ${template.items.length} 项检查，其中 ${aiItems.length} 项支持 AI 自动核验，AI 覆盖率 ${template.items.length > 0 ? Math.round((aiItems.length / template.items.length) * 100) : 0}%`
      )
    ),

    // AI type options - mapping to items
    React.createElement(
      "div",
      {},
      React.createElement("div", { style: { fontSize: "13px", fontWeight: 600, color: "#0F172A", marginBottom: "12px" } }, "AI 检测能力配置"),
      React.createElement(
        "div",
        { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" } },
        aiTypes.map(type => {
          const boundItem = aiItems.find(i => i.aiType === type.value);
          const isActive = !!boundItem;
          return React.createElement(
            "div",
            {
              key: type.value,
              style: {
                padding: "14px",
                border: isActive ? "1.5px solid #4F46E5" : "1px solid #E2E8F0",
                borderRadius: "8px",
                background: isActive ? "#EEF2FF" : "#FFFFFF",
                transition: "all 0.15s",
                cursor: readonly ? "default" : "pointer"
              },
              onClick: () => {
                if (readonly || !["mask_detection","floor_mopping","uniform_check"].includes(type.value)) return;
                if (isActive) {
                  setAIType(boundItem.id, type.value, false);
                } else {
                  const nonAiItem = template.items.find(i => !i.aiVerifiable);
                  if (nonAiItem) {
                    setAIType(nonAiItem.id, type.value, true);
                  } else {
                    alert("请先在检查项中添加一项，再绑定 AI 检测类型");
                  }
                }
              }
            },
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" } },
                React.createElement("div", {
                  style: {
                    width: "8px", height: "8px", borderRadius: "50%",
                    background: isActive ? "#4F46E5" : "#CBD5E1"
                  }
                }),
                React.createElement("span", {
                  style: { fontSize: "13px", fontWeight: 600, color: isActive ? "#3730A3" : "#0F172A" }
                }, type.label)
              ),
              React.createElement("div", {
                style: { fontSize: "12px", color: "#64748B", lineHeight: 1.5, marginLeft: "16px" }
              }, type.desc),
              boundItem && React.createElement(
                "div",
                {
                  style: {
                    marginTop: "10px",
                    paddingTop: "10px",
                    borderTop: "1px solid #C7D2FE",
                    fontSize: "12px",
                    color: "#4F46E5",
                    fontWeight: 500,
                    marginLeft: "16px"
                  }
                },
                "绑定检查项：" + boundItem.text
              )
            );
          })
        )
      )
  );
}

// Shared styles & helpers
const inputStyle = {
  padding: "8px 12px",
  border: "1px solid #E2E8F0",
  borderRadius: "6px",
  fontSize: "13px",
  color: "#0F172A",
  background: "#FFFFFF",
  outline: "none",
  width: "100%",
  transition: "border-color 0.15s"
};

const fieldValueStyle = {
  fontSize: "13px",
  color: "#0F172A",
  fontWeight: 500,
  lineHeight: 1.6
};

function formSection(title, fields) {
  return React.createElement(
    "div",
    {},
    React.createElement(
      "div",
      {
        style: {
          fontSize: "12px",
          fontWeight: 600,
          color: "#64748B",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          marginBottom: "12px",
          paddingBottom: "8px",
          borderBottom: "1px solid #F1F5F9"
        }
      },
      title
    ),
    React.createElement(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "16px" } },
      fields
    )
  );
}

function formField(label, control) {
  return React.createElement(
    "div",
    { style: { display: "grid", gridTemplateColumns: "120px 1fr", gap: "16px", alignItems: "flex-start" } },
    React.createElement(
      "label",
      { style: { fontSize: "13px", color: "#64748B", fontWeight: 500, paddingTop: "8px" } },
      label
    ),
    React.createElement("div", { style: { minWidth: 0 } }, control)
  );
}

