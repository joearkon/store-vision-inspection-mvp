import React from "react";
import {api,apiUrl} from "./api";
import {ruleCatalog} from "./ruleCatalog";
import {Icon} from "./icons";
import {RuleSamples,PhotoStandards,configCall} from "./RuleSamples";
const Button=({children,variant="primary",size="md",onClick,style,className="",...props})=><button {...props} type="button" className={`prototype-rule-button prototype-rule-button--${variant} prototype-rule-button--${size} ${className}`} style={style} onClick={onClick}>{children}</button>;
const Card=({children,padding="20px",style})=><section className="prototype-rule-card" style={{padding,...style}}>{children}</section>;
const initialRules=ruleCatalog.map(r=>({id:r.code,name:r.name,type:r.code==="E1"?"duration":r.code==="G2"?"eventFlow":"image",typeLabel:r.type,severity:r.severity||r.plannedSeverity||"P2",severityLabel:{P0:"严重",P1:"重要",P2:"一般"}[r.severity||"P2"],status:"codeOnly",statusLabel:"待业务确认",category:"门店运营",version:"当前配置",updatedAt:"—",description:r.evidence,params:{inputType:"video",checkItems:[r.name],confirmStrategy:r.strategy},applicableStores:[],applicableTime:"营业时段",notifications:[],observationSteps:[],samples:[],sampleStats:{total:0,positive:0,negative:0,accuracy:0}}));
// AI 视觉巡检规则配置页
// 功能：视频分析模式切换、规则列表、规则详情抽屉（配置 + AI 观察步骤 + 样本测试 + 版本历史）

export default function AIRulesPage({ onNavigate,canAdmin=true,disabled=false }) {
  const [rules, setRules] = React.useState(initialRules);
  const [modes, setModes] = React.useState({});
  const [activeMode, setActiveMode] = React.useState("dualLayer");
  const [selectedRule, setSelectedRule] = React.useState(null);
  const [showDrawer, setShowDrawer] = React.useState(false);
  const [drawerTab, setDrawerTab] = React.useState("config"); // config | observe | test | version
  const [filterType, setFilterType] = React.useState("all");
  const [filterStatus, setFilterStatus] = React.useState("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  const openRule = (rule) => {
    setSelectedRule(JSON.parse(JSON.stringify(rule)));
    setDrawerTab("config");
    setShowDrawer(true);
  };

  const createRule = () => {
    setSelectedRule({
      id: "NEW",
      name: "新规则",
      type: "image",
      typeLabel: "状态检查",
      severity: "P2",
      severityLabel: "一般",
      status: "draft",
      statusLabel: "草稿",
      category: "未分类",
      version: "v0.1",
      updatedAt: "刚刚创建",
      description: "",
      params: {
        roi: "",
        checkItems: "",
        confirmStrategy: "连续 1 帧检测到即触发"
      },
      applicableStores: [],
      applicableTime: "营业时段",
      notifications: [],
      observationSteps: [],
      sampleStats: { total: 0, positive: 0, negative: 0, accuracy: 0 },
      samples: [],
      versions: []
    });
    setDrawerTab("config");
    setShowDrawer(true);
  };

  const closeDrawer = () => {
    setShowDrawer(false);
    setSelectedRule(null);
  };

  const updateRule = (updates) => {
    setSelectedRule(prev => ({ ...prev, ...(typeof updates === "function"?updates(prev):updates) }));
  };

  const updateRuleParams = (paramUpdates) => {
    setSelectedRule(prev => ({
      ...prev,
      params: { ...prev.params, ...paramUpdates }
    }));
  };

  const typeLabelMap = { image: "状态检查", duration: "持续时间", eventFlow: "多事件关联" };
  const severityLabelMap = { P0: "严重", P1: "重要", P2: "一般" };
  const statusLabelMap = { draft: "草稿", testing: "测试中", verified: "已验证", production: "正式运行", codeOnly: "待业务确认" };

  const changeRuleType = (newType) => {
    const baseParams = {
      image: { roi: "", checkItems: "", confirmStrategy: "连续 1 帧检测到即触发" },
      duration: { target: "", triggerState: "", duration: 30, durationUnit: "秒", exceptions: [] },
      eventFlow: { triggerEvent: "", eventSource: "摄像头", dataSource: "POS", matchWindow: 30, matchWindowUnit: "秒", exceptionActions: [] }
    };
    setSelectedRule(prev => ({
      ...prev,
      type: newType,
      typeLabel: typeLabelMap[newType],
      params: baseParams[newType]
    }));
  };

  const [message,setMessage]=React.useState("");
  const [saving,setSaving]=React.useState(false);
  const saveLock=React.useRef(false);
  React.useEffect(()=>{configCall('/configs').then(saved=>setRules([...saved,...initialRules.filter(r=>!saved.some(x=>x.id===r.id))])).catch(e=>setMessage(e.message));api.rulesConfig().then(c=>{setActiveMode(c.default_analysis_mode);setModes(Object.fromEntries(c.profiles.map(p=>[p.id,{...p,params:Object.fromEntries(Object.entries(p.config).map(([k,v])=>[k,{label:k,value:v}]))}])));}).catch(e=>setMessage(e.message));},[]);
  const persist=async(test=false)=>{if(saveLock.current)return;if(!canAdmin||disabled){setMessage("当前账号或展示版本不能修改规则");return;}saveLock.current=true;setSaving(true);try{const saved=await configCall('/configs','POST',{...selectedRule,status:test?'testing':'draft',statusLabel:test?'测试中':'草稿'});setSelectedRule(saved);setRules(old=>[saved,...old.filter(r=>r.id!==saved.id)]);setMessage('已保存');if(test)setDrawerTab('test');}catch(e){setMessage(e.message);}finally{saveLock.current=false;setSaving(false);}};
  const saveDraft=()=>persist(false);
  const submitTest=()=>persist(true);
  const typeFilters = [
    { key: "all", label: "全部类型" },
    { key: "image", label: "状态检查" },
    { key: "duration", label: "持续时间" },
    { key: "eventFlow", label: "多事件关联" }
  ];

  const statusFilters = [
    { key: "all", label: "全部状态" },
    { key: "production", label: "正式运行" },
    { key: "verified", label: "已验证" },
    { key: "testing", label: "测试中" },
    { key: "codeOnly", label: "待业务确认" }
  ];

  const filteredRules = rules.filter(r => {
    if (filterType !== "all" && r.type !== filterType) return false;
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (searchQuery && !(r.name.includes(searchQuery) || (r.code || r.id).includes(searchQuery))) return false;
    return true;
  });

  const stats = {
    total: rules.length,
    p0: rules.filter(r => r.severity === "P0").length,
    production: rules.filter(r => r.status === "production").length,
    testing: rules.filter(r => r.status === "testing" || r.status === "verified").length
  };

  const getSeverityStyle = (severity) => {
    switch (severity) {
      case "P0": return { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" };
      case "P1": return { color: "#EA580C", bg: "#FFF7ED", border: "#FED7AA" };
      case "P2": return { color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" };
      default: return { color: "#64748B", bg: "#F1F5F9", border: "#E2E8F0" };
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case "production": return { color: "#059669", bg: "#ECFDF5" };
      case "verified": return { color: "#0891B2", bg: "#ECFEFF" };
      case "testing": return { color: "#D97706", bg: "#FFFBEB" };
      case "codeOnly": return { color: "#64748B", bg: "#F1F5F9" };
      case "draft": return { color: "#6366F1", bg: "#EEF2FF" };
      default: return { color: "#64748B", bg: "#F1F5F9" };
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case "image": return "#10B981";
      case "duration": return "#F59E0B";
      case "eventFlow": return "#8B5CF6";
      default: return "#64748B";
    }
  };

  return React.createElement(
    "div",
    { className:"prototype-rules-page", style: { display: "flex", flexDirection: "column", gap: "20px" } },

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
        "巡检"
      ),
      React.createElement("span", { style: { color: "#CBD5E1" } }, "/"),
      React.createElement("span", { style: { color: "#334155" } }, "规则配置")
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
        }, "AI 视觉巡检规则配置"),
        React.createElement("p", {
          style: { fontSize: "13px", color: "#64748B", margin: 0, lineHeight: 1.5 }
        }, "配置视频分析模式、巡检规则与通知策略，所有规则变更需经样本测试与审批后发布")
      ),
      React.createElement(
        "div",
        { style: { display: "flex", gap: "8px" } },
        React.createElement("label", {className:"prototype-rule-button prototype-rule-button--secondary prototype-rule-button--md"}, "导入规则", React.createElement("input", {type:"file",accept:"application/json",style:{display:"none"},disabled:!canAdmin||disabled,onChange:async e=>{try{const r=await configCall('/configs/validate','POST',JSON.parse(await e.target.files[0].text()));if(!r.name||!["image","duration","eventFlow"].includes(r.type)||!r.params||Array.isArray(r.params)||typeof r.params!=="object"||["exceptions","exceptionActions"].some(k=>r.params[k]!==undefined&&!Array.isArray(r.params[k]))||["versions","photoItems","notifications","observationSteps"].some(k=>r[k]!==undefined&&!Array.isArray(r[k])))throw Error();setSelectedRule({...r,notifications:Array.isArray(r.notifications)?r.notifications:[],observationSteps:Array.isArray(r.observationSteps)?r.observationSteps:[],id:"NEW",status:"draft",statusLabel:"草稿"});setDrawerTab("config");setShowDrawer(true);}catch{setMessage("请输入有效的规则JSON文件");}}})),
        React.createElement(Button, { variant: "primary", disabled: !canAdmin || disabled, onClick: createRule }, "+ 新建规则")
      )
    ),

    message && React.createElement("p", {role:"status",style:{color:"#4F46E5"}},message),
    // Analytics banner
    disabled && React.createElement(
      "div",
      {
        style: {
          padding: "10px 16px",
          background: "#EEF2FF",
          border: "1px solid #C7D2FE",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "12px",
          color: "#4338CA"
        }
      },
      React.createElement("span", { style: { fontSize: "14px" } }, React.createElement(Icon,{name:"bolt",size:16})),
      React.createElement("span", {}, "分析记录快照：普通操作保存到云端；视频上传、AI 解析和飞书发送暂未开放。账号免密码切换，仅用于产品体验，不是真实身份认证。")
    ),

    // Stats
    React.createElement(
      "div",
      { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" } },
      React.createElement(StatCard, { label: "规则总数", value: stats.total, accent: "#4F46E5", icon: React.createElement(Icon,{name:"settings",size:16}), sub: "E·A·B·C·M·G 六类" }),
      React.createElement(StatCard, { label: "P0 严重规则", value: stats.p0, accent: "#DC2626", icon: React.createElement(Icon,{name:"warning",size:16}), sub: "安全类核心规则" }),
      React.createElement(StatCard, { label: "正式运行", value: stats.production, accent: "#059669", icon: React.createElement(Icon,{name:"checkCircle",size:16}), sub: "真实样本已验证" }),
      React.createElement(StatCard, { label: "测试/验证中", value: stats.testing, accent: "#F59E0B", icon: React.createElement(Icon,{name:"flask",size:16}), sub: "合成或小范围验证" })
    ),

    // Video Analysis Modes
    React.createElement(
      "div",
      { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" } },
      Object.values(modes).map(mode => {
        const isActive = activeMode === mode.id;
        return React.createElement(
          "div",
          {
            key: mode.id,
            style: {
              padding: "20px",
              background: "#FFFFFF",
              border: `1px solid ${isActive ? "#6366F1" : "#E2E8F0"}`,
              borderRadius: "10px",
              boxShadow: isActive ? "0 0 0 3px rgba(99, 102, 241, 0.1)" : "none",
              position: "relative",
              cursor: "pointer",
              transition: "all 0.15s"
            },
            onClick: async () => {if(!canAdmin||disabled)return;try{await api.updateRulesConfig(mode.id);setActiveMode(mode.id);}catch(e){setMessage(e.message);}}
          },
          React.createElement(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" } },
            React.createElement("div", {
              style: { fontSize: "15px", fontWeight: 600, color: "#0F172A" }
            }, mode.name),
            React.createElement(
              "span",
              {
                style: {
                  padding: "3px 10px",
                  borderRadius: "20px",
                  fontSize: "11px",
                  fontWeight: 500,
                  background: isActive ? "#EEF2FF" : "#F1F5F9",
                  color: isActive ? "#4F46E5" : "#64748B"
                }
              },
              isActive ? "当前默认" : "设为默认"
            )
          ),
          React.createElement("div", {
            style: { fontSize: "12px", color: "#64748B", lineHeight: 1.6, marginBottom: "14px" }
          }, mode.description),
          React.createElement(
            "div",
            { style: { borderTop: "1px solid #F1F5F9", paddingTop: "12px" } },
            Object.entries(mode.params).map(([key, param]) => (
              React.createElement(
                "div",
                { key: key, style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" } },
                React.createElement(
                  "div",
                  {},
                  React.createElement("span", { style: { fontFamily: "monospace", fontSize: "11px", color: "#64748B" } }, param.label)
                ),
                React.createElement(
                  "span",
                  {
                    style: {
                      fontSize: "12px",
                      fontWeight: 500,
                      color: typeof param.value === "boolean"
                        ? (param.value ? "#059669" : "#DC2626")
                        : "#0F172A"
                    }
                  },
                  typeof param.value === "boolean"
                    ? (param.value ? "true 确实如此" : "false 错误")
                    : param.value
                )
              )
            ))
          )
        );
      })
    ),

    // Rule List Section
    React.createElement(
      Card,
      { padding: "0" },
      // Section header
      React.createElement(
        "div",
        {
          style: {
            padding: "16px 20px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }
        },
        React.createElement(
          "div",
          {},
          React.createElement("div", {
            style: { fontSize: "15px", fontWeight: 600, color: "#0F172A", marginBottom: "4px" }
          }, "规则能力"),
          React.createElement("div", {
            style: { fontSize: "12px", color: "#64748B" }
          }, "P0/P1/P2 是事件严重等级；下方另列上传视频进度与实时接入状态")
        ),
        React.createElement(
          "span",
          {
            style: {
              padding: "3px 10px",
              borderRadius: "20px",
              fontSize: "11px",
              fontWeight: 500,
              background: "#EEF2FF",
              color: "#4F46E5"
            }
          },
          `截至 2026-09-29：E 类 ${rules.filter(r => r.id.startsWith("E")).length} 条 · A 类 ${rules.filter(r => r.id.startsWith("A")).length} 条 · B 类 ${rules.filter(r => r.id.startsWith("B")).length} 条`
        )
      ),

      // Note
      React.createElement(
        "div",
        {
          style: {
            padding: "12px 20px",
            background: "#F8FAFC",
            borderBottom: "1px solid #E2E8F0",
            fontSize: "12px",
            color: "#64748B",
            lineHeight: 1.7
          }
        },
        "E1、A1、B1 都只完成了限定合成视频的上传分析与事件回团，正样本事件均走过人工关闭；这不等于真实门店验收。E1 月验证了关门恢复与可选测试群通知；B1 首轮漏检仍须回团。所有规则的萤石实时取流、抓拍与持续监测均未接入。E1/B1 的 PO 已确认；其他规则显示当前代码等级，业务分级待确认。旧 E1/P1、B1/P2 事件保留历史等级。"
      ),

      // Filters
      React.createElement(
        "div",
        {
          style: {
            padding: "12px 20px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            gap: "12px",
            alignItems: "center",
            flexWrap: "wrap"
          }
        },
        React.createElement(
          "input",
          {
            type: "text",
            placeholder: "搜索规则名称或编号...",
            value: searchQuery,
            onChange: e => setSearchQuery(e.target.value),
            style: {
              padding: "7px 12px",
              fontSize: "12px",
              border: "1px solid #E2E8F0",
              borderRadius: "6px",
              width: "200px",
              fontFamily: "inherit"
            }
          }
        ),
        React.createElement(
          "div",
          { style: { display: "flex", gap: "4px" } },
          typeFilters.map(f => (
            React.createElement(
              "span",
              {
                key: f.key,
                onClick: () => setFilterType(f.key),
                style: {
                  padding: "5px 12px",
                  fontSize: "12px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 500,
                  background: filterType === f.key ? "#4F46E5" : "transparent",
                  color: filterType === f.key ? "#FFFFFF" : "#64748B",
                  transition: "all 0.15s"
                }
              },
              f.label
            )
          ))
        ),
        React.createElement(
          "div",
          { style: { display: "flex", gap: "4px", marginLeft: "auto" } },
          statusFilters.map(f => (
            React.createElement(
              "span",
              {
                key: f.key,
                onClick: () => setFilterStatus(f.key),
                style: {
                  padding: "5px 12px",
                  fontSize: "12px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 500,
                  background: filterStatus === f.key ? "#E0E7FF" : "transparent",
                  color: filterStatus === f.key ? "#4338CA" : "#64748B",
                  transition: "all 0.15s"
                }
              },
              f.label
            )
          ))
        )
      ),

      // Table header
      React.createElement(
        "div",
        {
          style: {
            padding: "10px 20px",
            display: "grid",
            gridTemplateColumns: "2.5fr 1fr 1.2fr 0.8fr 1.2fr",
            gap: "16px",
            fontSize: "12px",
            fontWeight: 600,
            color: "#94A3B8",
            background: "#F8FAFC"
          }
        },
        React.createElement("div", {}, "规则 / 已有视频"),
        React.createElement("div", {}, "能力类型"),
        React.createElement("div", {}, "确认策略"),
        React.createElement("div", {}, "事件严重等级"),
        React.createElement("div", {}, "验证状态 / 接入范围")
      ),

      // Rule rows
      filteredRules.map((rule, idx) => {
        const sevStyle = getSeverityStyle(rule.severity);
        const statusStyle = getStatusStyle(rule.status);
        return React.createElement(
          "div",
          {
            key: rule.id,
            style: {
              padding: "14px 20px",
              borderBottom: idx === filteredRules.length - 1 ? "none" : "1px solid #F1F5F9",
              display: "grid",
              gridTemplateColumns: "2.5fr 1fr 1.2fr 0.8fr 1.2fr",
              gap: "16px",
              alignItems: "center",
              cursor: "pointer",
              transition: "background 0.15s"
            },
            onClick: () => openRule(rule),
            onMouseEnter: e => e.currentTarget.style.background = "#F8FAFC",
            onMouseLeave: e => e.currentTarget.style.background = "transparent"
          },
          // Rule name
          React.createElement(
            "div",
            { style: { minWidth: 0 } },
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" } },
              React.createElement(
                "span",
                {
                  style: {
                    width: "22px",
                    height: "22px",
                    borderRadius: "4px",
                    background: `${getTypeColor(rule.type)}15`,
                    color: getTypeColor(rule.type),
                    fontSize: "11px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0
                  }
                },
                rule.code || rule.id
              ),
              React.createElement("span", {
                style: { fontSize: "13px", fontWeight: 600, color: "#0F172A" }
              }, rule.name),
              React.createElement(
                "span",
                {
                  style: {
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    fontWeight: 500,
                    background: statusStyle.bg,
                    color: statusStyle.color
                  }
                },
                rule.statusLabel
              )
            ),
            React.createElement("div", {
              style: { fontSize: "11px", color: "#94A3B8", paddingLeft: "30px" }
            }, rule.description.length > 50 ? rule.description.slice(0, 50) + "..." : rule.description)
          ),
          // Capability
          React.createElement(
            "div",
            { style: { fontSize: "12px", color: "#475569" } },
            rule.capability
          ),
          // Confirm strategy
          React.createElement(
            "div",
            { style: { fontSize: "12px", color: "#475569", lineHeight: 1.5 } },
            rule.params.confirmStrategy ||
            (rule.params.duration ? `持续 ${rule.params.duration} ${rule.params.durationUnit}` :
            rule.params.matchWindow ? `${rule.params.matchWindow}${rule.params.matchWindowUnit} 时间窗口` : "—")
          ),
          // Severity
          React.createElement(
            "span",
            {
              style: {
                display: "inline-flex",
                alignItems: "center",
                padding: "3px 10px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: 600,
                color: sevStyle.color,
                background: sevStyle.bg,
                border: `1px solid ${sevStyle.border}`,
                width: "fit-content"
              }
            },
            `${rule.severity} · ${rule.severityLabel}`
          ),
          // Verification status
          React.createElement(
            "div",
            {},
            React.createElement("div", {
              style: { fontSize: "12px", color: "#0F172A", fontWeight: 500, marginBottom: "3px" }
            }, rule.statusLabel),
            React.createElement("div", {
              style: { fontSize: "11px", color: "#94A3B8" }
            }, rule.hasLiveCamera ? "实时摄像头已接入" : "实时摄像头未接入")
          )
        );
      })
    ),

    // Drawer
    showDrawer && selectedRule && React.createElement(
      RuleDetailDrawer,
      {
        rule: selectedRule,
        activeTab: drawerTab,
        onTabChange: setDrawerTab,
        onClose: closeDrawer,
        severityStyle: getSeverityStyle(selectedRule.severity),
        statusStyle: getStatusStyle(selectedRule.status),
        typeColor: getTypeColor(selectedRule.type),
        onRuleChange: updateRule,
        onRuleParamsChange: updateRuleParams,
        onChangeType: changeRuleType,
        onSaveDraft: saveDraft,
        onSubmitTest: submitTest, canAdmin, disabled:disabled||saving, message
      }
    )
  );
}

// Stat card component
function StatCard({ label, value, accent, icon, sub }) {
  return React.createElement(
    "div",
    {
      style: {
        padding: "16px 18px",
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "10px",
        display: "flex",
        flexDirection: "column",
        gap: "6px"
      }
    },
    React.createElement(
      "div",
      { style: { display: "flex", alignItems: "center", gap: "8px" } },
      React.createElement(
        "span",
        {
          style: {
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            background: `${accent}15`,
            color: accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "16px"
          }
        },
        icon
      ),
      React.createElement("span", {
        style: { fontSize: "12px", color: "#64748B", fontWeight: 500 }
      }, label)
    ),
    React.createElement(
      "div",
      { style: { paddingLeft: "40px" } },
      React.createElement("div", {
        style: { fontSize: "24px", fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }
      }, value),
      sub && React.createElement("div", {
        style: { fontSize: "11px", color: "#94A3B8", marginTop: "2px" }
      }, sub)
    )
  );
}

// Rule Detail Drawer
export function RuleDetailDrawer({ rule, activeTab, onTabChange, onClose, severityStyle, statusStyle, typeColor, onRuleChange, onRuleParamsChange, onChangeType, onSaveDraft, onSubmitTest,canAdmin,disabled,message }) {
  const drawerRef = React.useRef(null);

  React.useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const tabs = [
    { key: "config", label: "规则配置" },
    { key: "observe", label: "AI 观察步骤" },
    { key: "test", label: "样本测试" },
    { key: "version", label: "版本历史" }
  ];

  return React.createElement(
    "div",
    {
      className:"prototype-rule-dialog",
      role:"dialog",
      "aria-modal":true,
      "aria-label":"规则配置",
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
    // Overlay
    React.createElement("div", {
      onClick: onClose,
      style: {
        position: "absolute",
        inset: 0,
        background: "rgba(15, 23, 42, 0.4)",
        backdropFilter: "blur(2px)"
      }
    }),
    // Drawer panel
    React.createElement(
      "div",
      {
        ref: drawerRef,
        style: {
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "680px",
          maxWidth: "90vw",
          background: "#FFFFFF",
          boxShadow: "-8px 0 24px rgba(0,0,0,0.08)",
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
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px"
          }
        },
        React.createElement(
          "div",
          { style: { minWidth: 0 } },
          React.createElement(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" } },
            React.createElement(
              "span",
              {
                style: {
                  padding: "3px 10px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  background: `${typeColor}15`,
                  color: typeColor
                }
              },
              `${rule.code || rule.id} · ${rule.typeLabel}`
            ),
            React.createElement(
              "span",
              {
                style: {
                  padding: "3px 10px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: severityStyle.color,
                  background: severityStyle.bg,
                  border: `1px solid ${severityStyle.border}`
                }
              },
              `${rule.severity} · ${rule.severityLabel}`
            ),
            React.createElement(
              "span",
              {
                style: {
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  fontWeight: 500,
                  background: statusStyle.bg,
                  color: statusStyle.color
                }
              },
              rule.statusLabel
            )
          ),
          React.createElement("h2", {
            style: { fontSize: "18px", fontWeight: 700, color: "#0F172A", margin: 0 }
          }, rule.name)
        ),
        React.createElement(
          "button",
          {
            onClick: onClose,
            style: {
              width: "32px",
              height: "32px",
              border: "none",
              background: "transparent",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              color: "#94A3B8",
              flexShrink: 0
            },
            onMouseEnter: e => { e.currentTarget.style.background = "#F1F5F9"; e.currentTarget.style.color = "#475569"; },
            onMouseLeave: e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94A3B8"; }
          },
          React.createElement(Icon,{name:"close",size:18})
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
            gap: "0"
          }
        },
        tabs.map(tab => (
          React.createElement(
            "div",
            {
              key: tab.key,
              onClick: () => onTabChange(tab.key),
              style: {
                padding: "12px 0",
                marginRight: "24px",
                fontSize: "13px",
                fontWeight: activeTab === tab.key ? 600 : 500,
                color: activeTab === tab.key ? "#4F46E5" : "#64748B",
                cursor: "pointer",
                borderBottom: `2px solid ${activeTab === tab.key ? "#4F46E5" : "transparent"}`,
                marginBottom: "-1px",
                transition: "all 0.15s"
              }
            },
            tab.label
          )
        ))
      ),

      // Drawer content
      React.createElement(
        "div",
        {
          style: {
            flex: 1,
            overflowY: "auto",
            padding: "20px 24px"
          }
        },
        message && React.createElement("p",{role:"status",style:{color:"#4F46E5"}},message),
        React.createElement("p",{style:{fontSize:"12px",color:"#64748B",marginTop:0}},"草稿与测试配置尚未发布，不影响门店当前执行规则。"),
        activeTab === "config" && React.createElement("fieldset",{disabled:!canAdmin||disabled,style:{border:0,padding:0,margin:0,minWidth:0}},React.createElement(ConfigTab, { rule: rule, onRuleChange, onRuleParamsChange, onChangeType })),
        activeTab === "observe" && React.createElement(ObserveTab, { rule: rule }),
        activeTab === "test" && React.createElement(RuleSamples, { rule,disabled,readOnly:!canAdmin }),
        activeTab === "version" && React.createElement(VersionTab, { rule: rule })
      ),

      // Drawer footer
      React.createElement(
        "div",
        {
          style: {
            padding: "14px 24px",
            borderTop: "1px solid #E2E8F0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#F8FAFC"
          }
        },
        React.createElement(
          "div",
          { style: { fontSize: "12px", color: "#64748B" } },
          React.createElement("span", { style: { fontWeight: 500, color: "#475569" } }, rule.version),
          " · 最后更新 ",
          rule.updatedAt
        ),
        React.createElement(
          "div",
          { style: { display: "flex", gap: "8px" } },
          React.createElement(Button, { variant: "secondary", size: "sm", disabled:!canAdmin||disabled,onClick: onSaveDraft }, "保存草稿"),
          React.createElement(Button, { variant: "primary", size: "sm", disabled:!canAdmin||disabled,onClick: onSubmitTest }, "提交样本测试")
        )
      )
    )
  );
}

// Config Tab
function ConfigTab({ rule, onRuleChange, onRuleParamsChange, onChangeType }) {
  const categoryOptions = [
    { value: "未分类", label: "未分类" },
    { value: "食品安全", label: "食品安全" },
    { value: "门店运营", label: "门店运营" },
    { value: "安全合规", label: "安全合规" },
    { value: "顾客体验", label: "顾客体验" }
  ];
  const severityOptions = [
    { value: "P0", label: "P0 · 严重" },
    { value: "P1", label: "P1 · 重要" },
    { value: "P2", label: "P2 · 一般" }
  ];

  const handleSeverityChange = (val) => {
    const labelMap = { P0: "严重", P1: "重要", P2: "一般" };
    onRuleChange({ severity: val, severityLabel: labelMap[val] });
  };

  const storesDisplay = Array.isArray(rule.applicableStores)
    ? (rule.applicableStores.length === 0 ? "" : rule.applicableStores.join("、"))
    : rule.applicableStores || "";

  const handleStoresChange = (val) => {
    const arr = val ? val.split(/[、,，\s]+/).filter(Boolean) : [];
    onRuleChange({ applicableStores: arr });
  };

  const handleAddNotification = () => {
    const newList = [...(rule.notifications || []), { channel: "飞书群", target: "", role: "门店店长" }];
    onRuleChange({ notifications: newList });
  };

  const handleNotificationChange = (idx, field, val) => {
    const newList = [...(rule.notifications || [])];
    newList[idx] = { ...newList[idx], [field]: val };
    onRuleChange({ notifications: newList });
  };

  const handleRemoveNotification = (idx) => {
    const newList = (rule.notifications || []).filter((_, i) => i !== idx);
    onRuleChange({ notifications: newList });
  };

  // Duration type: exceptions as text
  const exceptionsText = (rule.params.exceptions || []).join("、");
  const handleExceptionsChange = (val) => {
    const arr = val ? val.split(/[、,，\s]+/).filter(Boolean) : [];
    onRuleParamsChange({ exceptions: arr });
  };

  // eventFlow type: exceptionActions as text
  const exceptionActionsText = (rule.params.exceptionActions || []).join("、");
  const handleExceptionActionsChange = (val) => {
    const arr = val ? val.split(/[、,，\s]+/).filter(Boolean) : [];
    onRuleParamsChange({ exceptionActions: arr });
  };

  return React.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "20px" } },

    // Template picker
    React.createElement(ConfigSection, { title: "选择规则模板" },
      React.createElement(TypeTemplatePicker, { value: rule.type, onChange: onChangeType })
    ),

    // Basic Info
    React.createElement(ConfigSection, { title: "基本信息" },
      React.createElement(EditField, {
        label: "规则名称",
        value: rule.name,
        onChange: v => onRuleChange({ name: v }),
        placeholder: "请输入规则名称"
      }),
      React.createElement(ConfigField, { label: "规则编号", value: rule.id === "NEW" ? "保存后自动生成" : (rule.code || rule.id) }),
      React.createElement(EditSelect, {
        label: "规则分类",
        value: rule.category,
        options: categoryOptions,
        onChange: v => onRuleChange({ category: v })
      }),
      React.createElement(EditSelect, {
        label: "严重程度",
        value: rule.severity,
        options: severityOptions,
        onChange: handleSeverityChange
      })
    ),

    // Threshold & Conditions - by type
    rule.type === "image" && React.createElement(
      ConfigSection, { title: "检测参数 · 状态检查" },
      React.createElement(EditSelect, {
        label: "输入类型",
        value: rule.params.inputType || "image",
        options: [
          { value: "image", label: "图片识别" },
          { value: "video", label: "视频帧" },
          { value: "business", label: "业务数据" }
        ],
        onChange: v => onRuleParamsChange({ inputType: v })
      }),
      React.createElement(EditTextarea, {
        label: "检测区域 (ROI)",
        value: rule.params.roi || "",
        onChange: v => onRuleParamsChange({ roi: v }),
        placeholder: "描述检测区域范围，例如：收银台右侧区域、货架A层",
        rows: 2
      }),
      (rule.params.inputType || "image") === "image" ? React.createElement(PhotoStandards,{rule,onChange:onRuleChange}) : React.createElement(EditTextarea, {
        label: "检查项",
        value: Array.isArray(rule.params.checkItems) ? rule.params.checkItems.join("、") : (rule.params.checkItems || ""),
        onChange: v => onRuleParamsChange({ checkItems: v ? v.split(/[、,，\s]+/).filter(Boolean) : [] }),
        placeholder: "多个检查项用顿号或逗号分隔，例如：佩戴口罩、穿戴工服、帽子规范",
        rows: 2
      }),
      React.createElement(EditSelect, {
        label: "确认策略",
        value: rule.params.confirmStrategy || "",
        options: [
          { value: "连续 1 帧检测到即触发", label: "连续 1 帧检测到即触发" },
          { value: "连续 3 帧检测到才触发", label: "连续 3 帧检测到才触发" },
          { value: "连续 5 帧检测到才触发", label: "连续 5 帧检测到才触发" },
          { value: "10 秒内出现 2 次即触发", label: "10 秒内出现 2 次即触发" }
        ],
         onChange: v => onRuleParamsChange({ confirmStrategy: v })
       })
       ),

     rule.type === "duration" && React.createElement(
      ConfigSection, { title: "检测参数 · 持续时间" },
      React.createElement(EditSelect, {
        label: "输入类型",
        value: rule.params.inputType || "video",
        options: [
          { value: "image", label: "图片识别" },
          { value: "video", label: "视频帧" },
          { value: "business", label: "业务数据" }
        ],
        onChange: v => onRuleParamsChange({ inputType: v })
      }),
      React.createElement(EditField, {
        label: "观察对象",
        value: rule.params.target || "",
        onChange: v => onRuleParamsChange({ target: v }),
        placeholder: "例如：冷库门、冷藏柜、员工离岗状态"
      }),
      React.createElement(EditField, {
        label: "触发状态",
        value: rule.params.triggerState || "",
        onChange: v => onRuleParamsChange({ triggerState: v }),
        placeholder: "例如：门打开、人不在岗"
      }),
      React.createElement(EditField, {
        label: "持续时长阈值",
        value: rule.params.duration || 0,
        type: "number",
        onChange: v => onRuleParamsChange({ duration: Number(v) || 0 })
      }),
      React.createElement(EditSelect, {
        label: "时长单位",
        value: rule.params.durationUnit || "秒",
        options: [
          { value: "秒", label: "秒" },
          { value: "分钟", label: "分钟" },
          { value: "小时", label: "小时" }
        ],
        onChange: v => onRuleParamsChange({ durationUnit: v })
      }),
      React.createElement(EditTextarea, {
        label: "例外条件",
        value: exceptionsText,
        onChange: handleExceptionsChange,
        placeholder: "多个例外用顿号分隔，例如：补货时段、清洁作业",
        rows: 2
      })
    ),

    rule.type === "eventFlow" && React.createElement(
      React.Fragment,
      null,
      React.createElement(ConfigSection, { title: "检测参数 · 多事件关联" },
        React.createElement(EditSelect, {
          label: "输入类型",
          value: rule.params.inputType || "video",
          options: [
            { value: "image", label: "图片识别" },
            { value: "video", label: "视频帧" },
            { value: "business", label: "业务数据" }
          ],
          onChange: v => onRuleParamsChange({ inputType: v })
        }),
        React.createElement(EditField, {
          label: "触发事件",
          value: rule.params.triggerEvent || "",
          onChange: v => onRuleParamsChange({ triggerEvent: v }),
          placeholder: "例如：钱箱打开、员工离岗"
        }),
        React.createElement(EditSelect, {
          label: "事件来源",
          value: rule.params.eventSource || "摄像头",
          options: [
            { value: "摄像头", label: "摄像头视觉识别" },
            { value: "设备传感器", label: "设备传感器" },
            { value: "POS 系统", label: "POS 系统" },
            { value: "业务系统", label: "业务系统" }
          ],
          onChange: v => onRuleParamsChange({ eventSource: v })
        }),
        React.createElement(EditSelect, {
          label: "关联数据源",
          value: rule.params.dataSource || "POS",
          options: [
            { value: "POS", label: "POS 交易数据" },
            { value: "ERP", label: "ERP 库存数据" },
            { value: "考勤", label: "考勤系统" },
            { value: "另一个摄像头", label: "另一个摄像头" }
          ],
          onChange: v => onRuleParamsChange({ dataSource: v })
        }),
        React.createElement(EditField, {
          label: "匹配时间窗口",
          value: rule.params.matchWindow || 0,
          type: "number",
          onChange: v => onRuleParamsChange({ matchWindow: Number(v) || 0 })
        }),
        React.createElement(EditSelect, {
          label: "窗口单位",
          value: rule.params.matchWindowUnit || "秒",
          options: [
            { value: "秒", label: "秒" },
            { value: "分钟", label: "分钟" }
          ],
          onChange: v => onRuleParamsChange({ matchWindowUnit: v })
        }),
        React.createElement(EditTextarea, {
          label: "例外操作",
          value: exceptionActionsText,
          onChange: handleExceptionActionsChange,
          placeholder: "多个例外操作用顿号分隔",
          rows: 2
        })
      ),
       // Flow preview
       React.createElement(
         "div",
         {
           style: {
             padding: "16px",
             background: "#FFFFFF",
             border: "1px solid #E2E8F0",
             borderRadius: "8px"
           }
         },
         React.createElement("div", { style: { fontSize: "12px", fontWeight: 600, color: "#0F172A", marginBottom: "10px" } }, "规则流程预览"),
         React.createElement(
           "div",
           {
             style: {
               padding: "16px",
               background: "#F8FAFC",
               borderRadius: "8px",
               display: "flex",
               alignItems: "center",
               gap: "8px",
               overflowX: "auto"
             }
           },
          ...(rule.params.triggerEvent ? [
            React.createElement("div", { key: 1, style: { padding: "8px 14px", background: "#DBEAFE", color: "#1D4ED8", borderRadius: "6px", fontSize: "11px", fontWeight: 500, whiteSpace: "nowrap" } }, rule.params.triggerEvent),
            React.createElement("span", { key: 2, style: { color: "#94A3B8", fontSize: "14px" } }, "→"),
            React.createElement("div", { key: 3, style: { padding: "8px 14px", background: "#E0E7FF", color: "#4338CA", borderRadius: "6px", fontSize: "11px", fontWeight: 500, whiteSpace: "nowrap" } }, `查 ${rule.params.dataSource || "POS"} (±${rule.params.matchWindow || 30}${rule.params.matchWindowUnit || "秒"})`),
            React.createElement("span", { key: 4, style: { color: "#94A3B8", fontSize: "14px" } }, "→"),
            React.createElement("div", { key: 5, style: { padding: "8px 14px", background: "#FEF3C7", color: "#92400E", borderRadius: "6px", fontSize: "11px", fontWeight: 500, whiteSpace: "nowrap" } }, "有匹配？"),
            React.createElement("span", { key: 6, style: { color: "#94A3B8", fontSize: "14px" } }, "→"),
            React.createElement("div", { key: 7, style: { padding: "8px 14px", background: "#FEE2E2", color: "#B91C1C", borderRadius: "6px", fontSize: "11px", fontWeight: 500, whiteSpace: "nowrap" } }, "否 → 异常")
          ] : [
            React.createElement("div", { key: 0, style: { fontSize: "12px", color: "#94A3B8" } }, "填写触发事件后，这里将展示规则流程图")
          ])
        )
      )
    ),

    // Scope
    React.createElement(ConfigSection, { title: "生效范围" },
      React.createElement(EditTextarea, {
        label: "适用门店",
        value: storesDisplay,
        onChange: handleStoresChange,
        placeholder: "多个门店用顿号或逗号分隔，留空表示全部门店",
        rows: 2
      }),
      React.createElement(EditSelect, {
        label: "生效时段",
        value: rule.applicableTime || "全天",
        options: [
          { value: "全天", label: "全天 24 小时" },
          { value: "营业时段", label: "仅营业时段" },
          { value: "早班", label: "早班 (06:00-14:00)" },
          { value: "晚班", label: "晚班 (14:00-22:00)" },
          { value: "自定义", label: "自定义时段" }
        ],
        onChange: v => onRuleChange({ applicableTime: v })
      })
    ),

    // Notifications
    React.createElement(ConfigSection, { title: "通知配置" },
      React.createElement(
        "div",
        {
          style: {
            gridColumn: "1 / -1",
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          }
        },
        (rule.notifications && rule.notifications.length > 0) && rule.notifications.map((n, i) => (
          React.createElement(
            "div",
            {
              key: i,
              style: {
                padding: "10px 12px",
                background: "#F8FAFC",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px"
              }
            },
            React.createElement(
              "select",
              {
                value: n.channel,
                onChange: e => handleNotificationChange(i, "channel", e.target.value),
                style: {
                  padding: "5px 8px",
                  border: "1px solid #CBD5E1",
                  borderRadius: "4px",
                  fontSize: "11px",
                  background: "#FFFFFF",
                  fontWeight: 600,
                  color: "#4F46E5",
                  outline: "none"
                }
              },
              ["飞书群", "飞书机器人", "短信", "邮件"].map(c =>
                React.createElement("option", { key: c, value: c }, c)
              )
            ),
            React.createElement("input", {
              value: n.target,
              onChange: e => handleNotificationChange(i, "target", e.target.value),
              placeholder: "通知对象 / 群组名称",
              style: {
                flex: 1,
                padding: "5px 8px",
                border: "1px solid #CBD5E1",
                borderRadius: "4px",
                fontSize: "12px",
                outline: "none"
              }
            }),
            React.createElement("span", { style: { color: "#94A3B8" } }, "→"),
            React.createElement("input", {
              value: n.role,
              onChange: e => handleNotificationChange(i, "role", e.target.value),
              placeholder: "接收角色",
              style: {
                width: "90px",
                padding: "5px 8px",
                border: "1px solid #CBD5E1",
                borderRadius: "4px",
                fontSize: "12px",
                outline: "none"
              }
            }),
            React.createElement(
              "button",
              {
                onClick: () => handleRemoveNotification(i),
                style: {
                  width: "24px",
                  height: "24px",
                  border: "none",
                  background: "transparent",
                  color: "#94A3B8",
                  cursor: "pointer",
                  fontSize: "14px",
                  borderRadius: "4px"
                }
              },
              React.createElement(Icon,{name:"close",size:18})
            )
          )
        )),
        React.createElement(
          "button",
          {
            onClick: handleAddNotification,
            style: {
              padding: "8px 12px",
              border: "1px dashed #CBD5E1",
              background: "#FFFFFF",
              borderRadius: "6px",
              fontSize: "12px",
              color: "#64748B",
              cursor: "pointer",
              textAlign: "left"
            }
          },
          "+ 添加通知渠道"
        )
      )
    ),

    // Description
    React.createElement(ConfigSection, { title: "规则说明" },
      React.createElement(EditTextarea, {
        label: "规则描述",
        value: rule.description || "",
        onChange: v => onRuleChange({ description: v }),
        placeholder: "描述这条规则的用途、适用场景、注意事项等",
        rows: 4
      })
    )
  );
}

function buildFlowNodes(rule) {
  if (rule.id === "C2") {
    const nodes = [
      { label: "检测钱箱打开", type: "event" },
      { label: "→", type: "arrow" },
      { label: "查 POS 交易\n(±30s)", type: "data" },
      { label: "→", type: "arrow" },
      { label: "有匹配交易？", type: "decision" },
      { label: "是 → 正常记录", type: "result", ok: true },
      { label: "否 → 疑似异常", type: "result", ok: false }
    ];
    return nodes.map((n, i) => {
      if (n.type === "arrow") {
        return React.createElement("span", { key: i, style: { color: "#94A3B8", fontSize: "14px" } }, "→");
      }
      const bg = n.type === "event" ? "#DBEAFE" :
                 n.type === "data" ? "#E0E7FF" :
                 n.type === "decision" ? "#FEF3C7" :
                 n.ok ? "#D1FAE5" : "#FEE2E2";
      const color = n.type === "event" ? "#1D4ED8" :
                    n.type === "data" ? "#4338CA" :
                    n.type === "decision" ? "#92400E" :
                    n.ok ? "#047857" : "#B91C1C";
      return React.createElement(
        "div",
        {
          key: i,
          style: {
            padding: "8px 14px",
            background: bg,
            color: color,
            borderRadius: "6px",
            fontSize: "11px",
            fontWeight: 500,
            whiteSpace: "pre-line",
            textAlign: "center",
            lineHeight: 1.4,
            flexShrink: 0
          }
        },
        n.label
      );
    });
  }
  return [];
}

function ConfigSection({ title, children }) {
  return React.createElement(
    "div",
    {
      style: {
        padding: "16px",
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "8px"
      }
    },
    React.createElement("div", {
      style: { fontSize: "13px", fontWeight: 600, color: "#0F172A", marginBottom: "12px" }
    }, title),
    React.createElement(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px 20px"
        }
      },
      children
    )
  );
}

function ConfigField({ label, value }) {
  return React.createElement(
    "div",
    {},
    React.createElement("div", {
      style: { fontSize: "11px", color: "#94A3B8", marginBottom: "4px" }
    }, label),
    React.createElement("div", {
      style: { fontSize: "13px", color: "#334155", fontWeight: 500 }
    }, value)
  );
}

function EditField({ label, value, onChange, placeholder, type }) {
  const inputType = type || "text";
  return React.createElement(
    "div",
    {},
    React.createElement("div", {
      style: { fontSize: "11px", color: "#94A3B8", marginBottom: "6px" }
    }, label),
    React.createElement("input", {
      type: inputType,
      value: value == null ? "" : value,
      placeholder: placeholder || "请输入",
      onChange: e => onChange && onChange(e.target.value),
      style: {
        width: "100%",
        padding: "7px 10px",
        border: "1px solid #CBD5E1",
        borderRadius: "6px",
        fontSize: "13px",
        color: "#0F172A",
        background: "#FFFFFF",
        fontFamily: "inherit",
        outline: "none"
      }
    })
  );
}

function EditSelect({ label, value, options, onChange }) {
  return React.createElement(
    "div",
    {},
    React.createElement("div", {
      style: { fontSize: "11px", color: "#94A3B8", marginBottom: "6px" }
    }, label),
    React.createElement("select", {
      value: value == null ? "" : value,
      onChange: e => onChange && onChange(e.target.value),
      style: {
        width: "100%",
        padding: "7px 10px",
        border: "1px solid #CBD5E1",
        borderRadius: "6px",
        fontSize: "13px",
        color: "#0F172A",
        background: "#FFFFFF",
        fontFamily: "inherit",
        outline: "none",
        cursor: "pointer"
      }
    },
      options.map(opt => React.createElement(
        "option",
        { key: opt.value, value: opt.value },
        opt.label
      ))
    )
  );
}

function EditTextarea({ label, value, onChange, placeholder, rows }) {
  return React.createElement(
    "div",
    { style: { gridColumn: "1 / -1" } },
    React.createElement("div", {
      style: { fontSize: "11px", color: "#94A3B8", marginBottom: "6px" }
    }, label),
    React.createElement("textarea", {
      value: value == null ? "" : value,
      placeholder: placeholder || "请输入",
      rows: rows || 3,
      onChange: e => onChange && onChange(e.target.value),
      style: {
        width: "100%",
        padding: "8px 10px",
        border: "1px solid #CBD5E1",
        borderRadius: "6px",
        fontSize: "13px",
        color: "#0F172A",
        background: "#FFFFFF",
        fontFamily: "inherit",
        outline: "none",
        resize: "vertical",
        lineHeight: 1.5
      }
    })
  );
}

function TypeTemplatePicker({ value, onChange }) {
  const templates = [
    { key: "image", label: "状态检查", desc: "图片/视频识别物体、状态、动作", icon: React.createElement(Icon,{name:"image",size:18}) },
    { key: "duration", label: "持续时间", desc: "某状态持续超过阈值触发", icon: React.createElement(Icon,{name:"clock",size:18}) },
    { key: "eventFlow", label: "多事件关联", desc: "跨摄像头/POS/业务数据关联", icon: React.createElement(Icon,{name:"link",size:18}) }
  ];
  return React.createElement(
    "div",
    { style: { gridColumn: "1 / -1" } },
    React.createElement("div", {
      style: { fontSize: "11px", color: "#94A3B8", marginBottom: "8px" }
    }, "规则模板类型"),
    React.createElement(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "10px"
        }
      },
      templates.map(t => {
        const active = value === t.key;
        return React.createElement(
          "div",
          {
            key: t.key,
            onClick: () => onChange && onChange(t.key),
            style: {
              padding: "12px",
              border: `1px solid ${active ? "#4F46E5" : "#E2E8F0"}`,
              borderRadius: "8px",
              background: active ? "#EEF2FF" : "#FFFFFF",
              cursor: "pointer",
              transition: "all 0.15s"
            }
          },
          React.createElement("div", { style: { fontSize: "18px", marginBottom: "6px" } }, t.icon),
          React.createElement("div", {
            style: { fontSize: "12px", fontWeight: 600, color: active ? "#3730A3" : "#0F172A", marginBottom: "2px" }
          }, t.label),
          React.createElement("div", {
            style: { fontSize: "11px", color: "#64748B", lineHeight: 1.4 }
          }, t.desc)
        );
      })
    )
  );
}

// Observe Tab - AI observation steps
function ObserveTab({ rule }) {
  rule={...rule,observationSteps:rule.photoItems?.length?rule.photoItems.map((i,n)=>({step:n+1,action:i.name,detail:i.standard})):rule.observationSteps||[]};
  return React.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "16px" } },

    // Intro card
    React.createElement(
      "div",
      {
        style: {
          padding: "14px 16px",
          background: "#EEF2FF",
          borderRadius: "8px",
          border: "1px solid #C7D2FE"
        }
      },
      React.createElement(
        "div",
        { style: { display: "flex", alignItems: "flex-start", gap: "10px" } },
        React.createElement("span", { style: { fontSize: "18px" } }, React.createElement(Icon,{name:"lightbulb",size:18})),
        React.createElement(
          "div",
          {},
          React.createElement("div", {
            style: { fontSize: "13px", fontWeight: 600, color: "#3730A3", marginBottom: "4px" }
          }, "AI 如何执行这条规则"),
          React.createElement("div", {
            style: { fontSize: "12px", color: "#4F46E5", lineHeight: 1.6 }
          }, "系统将业务规则拆解为分步观察指令，视觉模型逐项识别后，由规则引擎汇总判断结果。模型负责「看到什么」，系统负责「判断是否合规」。")
        )
      )
    ),

    // Steps timeline
    React.createElement(
      "div",
      { style: { position: "relative", paddingLeft: "32px" } },
      // Vertical line
      React.createElement("div", {
        style: {
          position: "absolute",
          left: "11px",
          top: "8px",
          bottom: "8px",
          width: "2px",
          background: "#E2E8F0"
        }
      }),
      rule.observationSteps.map((step, idx) => (
        React.createElement(
          "div",
          {
            key: step.step,
            style: {
              position: "relative",
              marginBottom: idx === rule.observationSteps.length - 1 ? 0 : "16px"
            }
          },
          // Step dot
          React.createElement(
            "div",
            {
              style: {
                position: "absolute",
                left: "-32px",
                top: "2px",
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                background: "#4F46E5",
                color: "#FFFFFF",
                fontSize: "12px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1
              }
            },
            step.step
          ),
          // Step card
          React.createElement(
            "div",
            {
              style: {
                padding: "12px 14px",
                background: "#F8FAFC",
                borderRadius: "8px",
                border: "1px solid #E2E8F0"
              }
            },
            React.createElement("div", {
              style: { fontSize: "13px", fontWeight: 600, color: "#0F172A", marginBottom: "4px" }
            }, step.action),
            React.createElement("div", {
              style: { fontSize: "12px", color: "#64748B", lineHeight: 1.5 }
            }, step.detail)
          )
        )
      ))
    ),

    // Output summary
    React.createElement(
      "div",
      {
        style: {
          padding: "14px 16px",
          background: "#F0FDF4",
          borderRadius: "8px",
          border: "1px solid #BBF7D0"
        }
      },
      React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" } },
        React.createElement("span", { style: { fontSize: "16px" } }, "📊"),
        React.createElement("span", {
          style: { fontSize: "13px", fontWeight: 600, color: "#047857" }
        }, "系统判定输出")
      ),
      React.createElement(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "10px",
            fontSize: "12px"
          }
        },
        React.createElement(ResultBox, { label: "通过", color: "#059669", desc: "全部检查项符合" }),
        React.createElement(ResultBox, { label: "不通过", color: "#DC2626", desc: "触发异常事件" }),
        React.createElement(ResultBox, { label: "人工核查", color: "#F59E0B", desc: "置信度不足时" })
      )
    )
  );
}

function ResultBox({ label, color, desc }) {
  return React.createElement(
    "div",
    {
      style: {
        padding: "10px",
        background: "#FFFFFF",
        borderRadius: "6px",
        border: `1px solid ${color}30`,
        textAlign: "center"
      }
    },
    React.createElement("div", {
      style: { fontSize: "13px", fontWeight: 600, color, marginBottom: "2px" }
    }, label),
    React.createElement("div", { style: { fontSize: "11px", color: "#64748B" } }, desc)
  );
}

// Test Tab - Sample testing
function VersionTab({ rule }) {
  const isDraft = rule.status === "draft" || rule.id === "NEW";
  const isTesting = rule.status === "testing";
  const versions = rule.versions || (
    isDraft
      ? [{ version: "草稿", date: rule.updatedAt, author: "—", changes: ["新建规则，尚未保存"], status: "草稿" }]
      : isTesting
      ? [{ version: rule.version, date: rule.updatedAt, author: "提交者本人", changes: ["提交样本测试", "等待样本标注与准确率验证"], status: "测试中" }]
      : [{ version: rule.version, date: rule.updatedAt, author: "总部运营", changes: ["当前版本"], status: rule.statusLabel||"待业务确认" }]
  );

  return React.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "16px" } },

    // Note
    React.createElement(
      "div",
      {
        style: {
          padding: "12px 14px",
          background: "#FFF7ED",
          borderRadius: "8px",
          border: "1px solid #FED7AA",
          fontSize: "12px",
          color: "#9A3412",
          lineHeight: 1.6
        }
      },
      "规则变更需经过：",
      React.createElement("span", { style: { fontWeight: 600 } }, "编辑草稿 → 样本测试 → 查看判定与预计消耗 → 总部审批 → 小范围启用 → 正式发布"),
      "。历史任务关联其执行时使用的规则版本，不因规则更新而改变。"
    ),

    // Version timeline
    React.createElement(
      "div",
      {
        style: {
          padding: "16px",
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "8px"
        }
      },
      React.createElement("div", {
        style: { fontSize: "13px", fontWeight: 600, color: "#0F172A", marginBottom: "14px" }
      }, "版本记录"),
      React.createElement(
        "div",
        { style: { position: "relative", paddingLeft: "28px" } },
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
        versions.map((v, idx) => (
          React.createElement(
            "div",
            {
              key: v.version,
              style: {
                position: "relative",
                marginBottom: idx === versions.length - 1 ? 0 : "16px"
              }
            },
            React.createElement(
              "div",
              {
                style: {
                  position: "absolute",
                  left: "-28px",
                  top: "3px",
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  background: idx === 0 ? "#4F46E5" : "#CBD5E1",
                  border: "3px solid #FFFFFF",
                  boxShadow: idx === 0 ? "0 0 0 2px #C7D2FE" : "none",
                  zIndex: 1
                }
              }
            ),
            React.createElement(
              "div",
              {
                style: {
                  padding: "10px 14px",
                  background: idx === 0 ? "#EEF2FF" : "#F8FAFC",
                  borderRadius: "6px",
                  border: idx === 0 ? "1px solid #C7D2FE" : "1px solid #E2E8F0"
                }
              },
              React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "6px"
                  }
                },
                React.createElement(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "8px" } },
                  React.createElement("span", {
                    style: { fontSize: "13px", fontWeight: 600, color: idx === 0 ? "#3730A3" : "#0F172A" }
                  }, v.version),
                  React.createElement("span", {
                    style: {
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontWeight: 500,
                      background: idx === 0 ? "#4F46E5" : "#E2E8F0",
                      color: idx === 0 ? "#FFFFFF" : "#64748B"
                    }
                  }, v.status)
                ),
                React.createElement("span", { style: { fontSize: "11px", color: "#94A3B8" } }, v.date)
              ),
              React.createElement("div", {
                style: { fontSize: "11px", color: "#64748B", marginBottom: "6px" }
              }, v.author),
              React.createElement(
                "ul",
                {
                  style: {
                    margin: 0,
                    paddingLeft: "16px",
                    fontSize: "12px",
                    color: "#475569",
                    lineHeight: 1.7
                  }
                },
                v.changes.map((c, i) => (
                  React.createElement("li", { key: i }, c)
                ))
              )
            )
          )
        ))
      )
    ),

    // Permissions
    React.createElement(
      "div",
      {
        style: {
          padding: "16px",
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "8px"
        }
      },
      React.createElement("div", {
        style: { fontSize: "13px", fontWeight: 600, color: "#0F172A", marginBottom: "12px" }
      }, "权限说明"),
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "10px" } },
        React.createElement(PermissionRow, { role: "总部运营", action: "创建、编辑、发布规则", allowed: true }),
        React.createElement(PermissionRow, { role: "区域负责人", action: "调整授权范围内的参数（阈值、时段、通知对象）", allowed: true }),
        React.createElement(PermissionRow, { role: "店长", action: "查看规则、执行反馈、提出修改建议", allowed: true })
      )
    )
  );
}

function PermissionRow({ role, action, allowed }) {
  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 12px",
        background: "#F8FAFC",
        borderRadius: "6px",
        fontSize: "12px"
      }
    },
    React.createElement(
      "span",
      {
        style: {
          padding: "3px 10px",
          borderRadius: "4px",
          fontSize: "11px",
          fontWeight: 500,
          background: "#EEF2FF",
          color: "#4F46E5",
          width: "72px",
          textAlign: "center"
        }
      },
      role
    ),
    React.createElement("span", { style: { color: "#475569", flex: 1 } }, action),
    React.createElement(
      "span",
      {
        style: {
          fontSize: "11px",
          color: allowed ? "#059669" : "#DC2626",
          fontWeight: 500
        }
      },
      allowed ? "✓ 允许" : "✗ 不允许"
    )
  );
}

