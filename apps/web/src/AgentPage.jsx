import React from 'react';
import {apiUrl} from './api';
async function agentCall(path,body){const r=await fetch(apiUrl('/api/agent'+path),{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw Error(data.detail||'请求失败');return data;}
export default function AgentPage({onNavigate,disabled=false}){
 const [messages,setMessages]=React.useState([{id:'welcome',role:'assistant',type:'welcome'}]),[input,setInput]=React.useState(''),[isTyping,setIsTyping]=React.useState(false),[conversationId,setConversationId]=React.useState('new'),[conversations,setConversations]=React.useState([]),[sidebarCollapsed,setSidebarCollapsed]=React.useState(false);
 const messagesEndRef=React.useRef(null),inputRef=React.useRef(null),sendLock=React.useRef(false);
 const welcomeMsg={id:'welcome',role:'assistant',type:'welcome',text:'你好，我是巡检助手小巡。可以查询已接入门店的 SOP、异常事件和分析任务，并根据实际记录回答问题。',suggestions:[{icon:'chart',text:'今天 JTU 店的巡检情况怎么样？',hint:'单店巡检概况'},{icon:'store',text:'哪些门店今天还没完成开店检查？',hint:'巡检待办'},{icon:'alert',text:'最近有哪些异常事件？',hint:'事件分析'},{icon:'check',text:'帮我看看最近的视频分析任务',hint:'分析记录'}]};
 const refresh=()=>agentCall('/conversations').then(setConversations);
 React.useEffect(()=>{setMessages([welcomeMsg]);if(!disabled)refresh().catch(e=>setMessages([welcomeMsg,{id:'error',role:'assistant',type:'text',text:e.message}]));},[]);
 React.useEffect(()=>{if(messagesEndRef.current)messagesEndRef.current.scrollTop=messagesEndRef.current.scrollHeight;},[messages,isTyping]);
 const selectConversation=id=>{if(isTyping)return;const found=conversations.find(c=>c.id===id);setConversationId(id);setMessages(found?.messages||[welcomeMsg]);};
 const handleSendWithText=async text=>{if(disabled||sendLock.current||!text.trim())return;sendLock.current=true;setIsTyping(true);setInput('');setMessages(old=>[...old.filter(m=>m.id!=='welcome'),{id:'u-'+Date.now(),role:'user',type:'text',text}]);try{const result=await agentCall('/chat',{conversation_id:conversationId==='new'?null:conversationId,text});setConversationId(result.id);setMessages(result.messages);await refresh();}catch(e){setMessages(old=>[...old,{id:'err-'+Date.now(),role:'assistant',type:'text',text:e.message}]);await refresh().catch(()=>{});}finally{sendLock.current=false;setIsTyping(false);}};
 const handleSend=()=>handleSendWithText(input.trim());
 const handleSuggestion=text=>handleSendWithText(text);
 const handleNewChat=()=>{if(isTyping)return;setConversationId('new');setMessages([welcomeMsg]);setInput('');};
 const handleAction=msg=>{if(msg.actionPage)onNavigate(msg.actionPage);};
 const handleConfirm=()=>{};
  // === Rendering ===
  const renderMessage = (msg) => {
    const isUser = msg.role === "user";

    return React.createElement(
      "div",
      {
        key: msg.id,
        style: {
          display: "flex",
          gap: "14px",
          width: "100%",
          maxWidth: "820px",
          margin: "0 auto",
          padding: "20px 0"
        }
      },
      // Avatar
      React.createElement(
        "div",
        {
          style: {
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "13px",
            fontWeight: 700,
            color: "#fff",
            background: isUser
              ? "linear-gradient(135deg, #64748B, #475569)"
              : "linear-gradient(135deg, #7C3AED, #4F46E5)"
          }
        },
        isUser ? "李" : "巡"
      ),
      // Content
      React.createElement(
        "div",
        {
          style: {
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }
        },
        // Name
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "8px" } },
          React.createElement("span", {
            style: { fontSize: "13px", fontWeight: 600, color: "#0F172A" }
          }, isUser ? "你" : "小巡"),
          !isUser && React.createElement(
            "span",
            {
              style: {
                fontSize: "10px",
                padding: "1px 6px",
                borderRadius: "4px",
                background: "rgba(124, 58, 237, 0.1)",
                color: "#7C3AED",
                fontWeight: 500
              }
            },
            "AI 巡检助理"
          )
        ),
        // Text
        React.createElement(
          "div",
          {
            style: {
              fontSize: "14px",
              lineHeight: 1.7,
              color: "#0F172A",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word"
            }
          },
          msg.text?.split("**").map((part, i) =>
            i % 2 === 1
              ? React.createElement("strong", { key: i, style: { fontWeight: 700 } }, part)
              : part
          )
        ),
        msg.tool_trace?.length > 0 && React.createElement("div",{style:{fontSize:"11px",color:"#64748B"}},"已查询：",msg.tool_trace.map(t=>({list_stores:"接入门店",sop_status:"SOP进度",recent_events:"异常事件",recent_analysis:"分析任务"}[t.tool]||t.tool)).join("、")),
        // Rich content
        msg.type === "store_status" && renderStoreStatusCard(msg),
        msg.type === "incomplete_stores" && renderIncompleteStoresCard(msg),
        msg.type === "ranking" && renderRankingCard(msg),
        msg.type === "portfolio" && renderPortfolioCard(msg),
        msg.type === "events_summary" && renderEventsSummaryCard(msg),
        msg.type === "dispatch_confirm" && renderDispatchCard(msg),
        msg.type === "peak_anomaly" && renderPeakAnomalyCard(msg),
        msg.type === "dispatch_done" && renderDispatchDoneCard(msg),
        // Suggestions
        msg.suggestions && msg.suggestions.length > 0 && React.createElement(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "8px",
              marginTop: "4px"
            }
          },
          msg.suggestions.map((s, i) => {
            const suggestionText = typeof s === "string" ? s : s.text;
            const hint = typeof s === "string" ? "" : s.hint;
            return React.createElement(
              "button",
              {
                key: i,
                onClick: () => handleSuggestion(suggestionText),
                style: {
                  padding: "12px 14px",
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "8px",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px"
                },
                onMouseEnter: e => {
                  e.currentTarget.style.background = "#EEF2FF";
                  e.currentTarget.style.borderColor = "#C7D2FE";
                },
                onMouseLeave: e => {
                  e.currentTarget.style.background = "#F8FAFC";
                  e.currentTarget.style.borderColor = "#E2E8F0";
                }
              },
              React.createElement(
                "span",
                { style: { fontSize: "13px", color: "#0F172A", fontWeight: 500, lineHeight: 1.4 } },
                suggestionText
              ),
              hint && React.createElement(
                "span",
                { style: { fontSize: "11px", color: "#94A3B8" } },
                hint
              )
            );
          })
        ),
        // Action button
        msg.actionText && !msg.confirmText && React.createElement(
          "button",
          {
            onClick: () => handleAction(msg),
            style: {
              alignSelf: "flex-start",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              background: "#FFFFFF",
              color: "#4F46E5",
              border: "1px solid #C7D2FE",
              borderRadius: "6px",
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "4px"
            }
          },
          msg.actionText,
          React.createElement(
            "svg",
            { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
            React.createElement("polyline", { points: "9 18 15 12 9 6" })
          )
        )
      )
    );
  };

  const renderStoreStatusCard = (msg) => {
    const { store, stats, statusLabel, statusColor, tasks } = msg;
    const templateOf = (t) => templates.find(tp => tp.id === t.templateId);

    return React.createElement(
      "div",
      {
        style: {
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "10px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "14px"
        }
      },
      // Store header
      React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "10px" } },
          React.createElement("div", {
            style: {
              width: "8px", height: "8px", borderRadius: "50%",
              background: statusColor,
              boxShadow: `0 0 0 3px ${statusColor}15`
            }
          }),
          React.createElement("span", { style: { fontSize: "15px", fontWeight: 700, color: "#0F172A" } }, store.nameZh),
          React.createElement("span", {
            style: {
              fontSize: "11px", color: statusColor,
              background: `${statusColor}12`,
              padding: "3px 8px", borderRadius: "4px", fontWeight: 500
            }
          }, statusLabel)
        ),
        React.createElement("span", { style: { fontSize: "12px", color: "#94A3B8" } }, store.city)
      ),
      // Stats grid
      React.createElement(
        "div",
        { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", background: "#E2E8F0", borderRadius: "8px", overflow: "hidden" } },
        [
          { label: "已完成", value: stats.done, sub: `共 ${stats.total} 项`, color: "#10B981" },
          { label: "进行中", value: stats.inProgress, sub: `${stats.pending} 项待开始`, color: "#2563EB" },
          { label: "通过率", value: `${stats.passRate}%`, sub: `发现 ${stats.issues} 个问题`, color: stats.passRate >= 80 ? "#10B981" : stats.passRate >= 60 ? "#F59E0B" : "#DC2626" }
        ].map(s => React.createElement(
          "div",
          { key: s.label, style: { padding: "12px 14px", background: "#F8FAFC" } },
          React.createElement("div", { style: { fontSize: "20px", fontWeight: 700, color: s.color, lineHeight: 1.2 } }, s.value),
          React.createElement("div", { style: { fontSize: "11px", color: "#94A3B8", marginTop: "4px" } }, `${s.label} · ${s.sub}`)
        ))
      ),
      // Task list
      tasks.length > 0 && React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "2px" } },
        React.createElement("div", { style: { fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" } }, "任务明细"),
        tasks.map(t => {
          const tp = templateOf(t);
          const sc = t.status === "completed"
            ? (t.result === "pass" ? "#10B981" : "#DC2626")
            : t.status === "in_progress" ? "#2563EB" : "#94A3B8";
          const sl = t.status === "completed"
            ? (t.result === "pass" ? "通过" : "有问题")
            : t.status === "in_progress" ? "进行中" : "待开始";
          return React.createElement(
            "div",
            {
              key: t.id,
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "7px 10px",
                borderRadius: "6px"
              }
            },
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              React.createElement("div", {
                style: { width: "3px", height: "3px", borderRadius: "50%", background: tp?.color || "#94A3B8" }
              }),
              React.createElement("span", { style: { fontSize: "13px", color: "#334155" } }, t.name),
              t.scheduledTime && React.createElement(
                "span", { style: { fontSize: "11px", color: "#94A3B8" } }, t.scheduledTime
              )
            ),
            React.createElement(
              "span",
              { style: { fontSize: "11px", color: sc, background: `${sc}15`, padding: "2px 8px", borderRadius: "4px", fontWeight: 500 } },
              sl
            )
          );
        })
      )
    );
  };

  const renderIncompleteStoresCard = (msg) => {
    return React.createElement(
      "div",
      {
        style: {
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "10px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "10px"
        }
      },
      React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" } },
        React.createElement(
          "span",
          {
            style: {
              fontSize: "12px", color: "#DC2626",
              background: "rgba(220,38,38,0.1)",
              padding: "3px 10px", borderRadius: "4px", fontWeight: 600
            }
          },
          `未完成 ${msg.incompleteStores.length} 家`
        ),
        React.createElement("span", { style: { fontSize: "12px", color: "#94A3B8" } }, msg.templateName)
      ),
      ...msg.incompleteStores.map(item => React.createElement(
        "div",
        {
          key: item.store.id,
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 12px",
            background: "#F8FAFC",
            borderRadius: "6px"
          }
        },
        React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "3px" } },
          React.createElement("span", { style: { fontSize: "13px", fontWeight: 600, color: "#0F172A" } }, item.store.nameZh),
          React.createElement("span", { style: { fontSize: "11px", color: "#94A3B8" } }, `店长：${item.store.manager} · ${item.store.city}`)
        ),
        React.createElement(
          "span",
          {
            style: {
              fontSize: "11px", color: "#F59E0B",
              background: "rgba(245,158,11,0.1)",
              padding: "3px 10px", borderRadius: "4px", fontWeight: 500
            }
          },
          "待执行"
        )
      ))
    );
  };

  const renderRankingCard = (msg) => {
    return React.createElement(
      "div",
      {
        style: {
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "10px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }
      },
      // Summary strip
      React.createElement(
        "div",
        { style: { display: "flex", gap: "12px", paddingBottom: "12px", borderBottom: "1px solid #F1F5F9" } },
        React.createElement("div", { style: { flex: 1, textAlign: "center" } },
          React.createElement("div", { style: { fontSize: "18px", fontWeight: 700, color: "#10B981" } }, `${msg.avgRate}%`),
          React.createElement("div", { style: { fontSize: "11px", color: "#94A3B8" } }, "平均通过率")
        ),
        React.createElement("div", { style: { flex: 1, textAlign: "center" } },
          React.createElement("div", { style: { fontSize: "18px", fontWeight: 700, color: "#10B981" } }, msg.bestStore.store.nameZh),
          React.createElement("div", { style: { fontSize: "11px", color: "#94A3B8" } }, `最佳 ${msg.bestStore.passRate}%`)
        ),
        React.createElement("div", { style: { flex: 1, textAlign: "center" } },
          React.createElement("div", { style: { fontSize: "18px", fontWeight: 700, color: "#DC2626" } }, msg.worstStore.store.nameZh),
          React.createElement("div", { style: { fontSize: "11px", color: "#94A3B8" } }, `最低 ${msg.worstStore.passRate}%`)
        )
      ),
      // Ranking list
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "6px" } },
        msg.ranking.map((item, idx) => {
          const color = item.passRate >= 80 ? "#10B981" : item.passRate >= 60 ? "#F59E0B" : "#DC2626";
          const rankColors = ["#DC2626", "#EA580C", "#F59E0B", "#94A3B8", "#94A3B8"];
          return React.createElement(
            "div",
            {
              key: item.store.id,
              style: {
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "8px 10px",
                borderRadius: "6px"
              }
            },
            React.createElement(
              "span",
              {
                style: {
                  width: "22px", height: "22px", borderRadius: idx < 3 ? "50%" : "4px",
                  background: idx < 3 ? `${rankColors[idx]}15` : "#F1F5F9",
                  color: idx < 3 ? rankColors[idx] : "#94A3B8",
                  fontSize: "11px", fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0
                }
              },
              idx + 1
            ),
            React.createElement(
              "span",
              { style: { fontSize: "13px", color: "#0F172A", flex: 1, fontWeight: 500 } },
              item.store.nameZh
            ),
            React.createElement(
              "span",
              { style: { fontSize: "11px", color: "#94A3B8", marginRight: "6px" } },
              `${item.issues} 个问题`
            ),
            React.createElement(
              "div",
              { style: { width: "100px", height: "6px", background: "#E2E8F0", borderRadius: "3px", overflow: "hidden" } },
              React.createElement("div", { style: { width: `${item.passRate}%`, height: "100%", background: color, borderRadius: "3px" } })
            ),
            React.createElement(
              "span",
              { style: { fontSize: "13px", fontWeight: 700, color: color, minWidth: "40px", textAlign: "right" } },
              `${item.passRate}%`
            )
          );
        })
      )
    );
  };

  const renderPortfolioCard = (msg) => {
    return React.createElement(
      "div",
      {
        style: {
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "10px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "14px"
        }
      },
      // Top stats
      React.createElement(
        "div",
        { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1px", background: "#E2E8F0", borderRadius: "8px", overflow: "hidden" } },
        [
          { label: "门店数", value: msg.totalStores, sub: `${msg.onlineStores} 在线`, color: "#4F46E5" },
          { label: "已完成", value: msg.doneTasks, sub: `进行中 ${msg.inProgressTasks}`, color: "#10B981" },
          { label: "待开始", value: msg.pendingTasks, sub: "待巡检", color: "#64748B" },
          { label: "问题数", value: msg.totalIssues, sub: "待跟进", color: "#DC2626" }
        ].map(s => React.createElement(
          "div",
          { key: s.label, style: { padding: "12px 10px", background: "#F8FAFC", textAlign: "center" } },
          React.createElement("div", { style: { fontSize: "20px", fontWeight: 700, color: s.color, lineHeight: 1.2 } }, s.value),
          React.createElement("div", { style: { fontSize: "10px", color: "#94A3B8", marginTop: "4px" } }, `${s.label} · ${s.sub}`)
        ))
      ),
      // Per-store health
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "6px" } },
        React.createElement("div", { style: { fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "2px" } }, "门店健康度"),
        msg.perStore.map(item => {
          const hc = item.healthScore >= 90 ? "#10B981"
            : item.healthScore >= 80 ? "#2563EB"
            : item.healthScore >= 70 ? "#F59E0B" : "#DC2626";
          return React.createElement(
            "div",
            {
              key: item.store.id,
              style: {
                display: "flex", alignItems: "center", gap: "10px",
                padding: "6px 8px", borderRadius: "6px"
              }
            },
            React.createElement("span", {
              style: { fontSize: "12px", color: "#0F172A", width: "60px", fontWeight: 500, flexShrink: 0 }
            }, item.store.nameZh),
            React.createElement(
              "div",
              { style: { flex: 1, height: "6px", background: "#E2E8F0", borderRadius: "3px", overflow: "hidden" } },
              React.createElement("div", {
                style: { width: `${item.healthScore}%`, height: "100%", background: hc, borderRadius: "3px" }
              })
            ),
            React.createElement(
              "span",
              { style: { fontSize: "12px", fontWeight: 600, color: hc, minWidth: "32px", textAlign: "right" } },
              item.healthScore
            ),
            item.issues > 0 && React.createElement(
              "span",
              {
                style: {
                  fontSize: "10px", color: "#DC2626",
                  background: "rgba(220,38,38,0.1)",
                  padding: "1px 6px", borderRadius: "3px", fontWeight: 500
                }
              },
              `${item.issues} 问题`
            )
          );
        })
      )
    );
  };

  const renderEventsSummaryCard = (msg) => {
    const { counts, events: evtList } = msg;
    return React.createElement(
      "div",
      {
        style: {
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "10px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }
      },
      // Severity breakdown
      React.createElement(
        "div",
        { style: { display: "flex", gap: "10px" } },
        [
          { label: "P0", value: counts.p0, color: "#DC2626" },
          { label: "P1", value: counts.p1, color: "#EA580C" },
          { label: "P2", value: counts.p2, color: "#2563EB" },
          { label: "待处理", value: counts.pending, color: "#64748B" }
        ].map(s => React.createElement(
          "div",
          {
            key: s.label,
            style: {
              flex: 1,
              padding: "10px 8px",
              background: `${s.color}08`,
              borderRadius: "6px",
              textAlign: "center"
            }
          },
          React.createElement("div", { style: { fontSize: "18px", fontWeight: 700, color: s.color } }, s.value),
          React.createElement("div", { style: { fontSize: "10px", color: "#64748B", marginTop: "2px" } }, s.label)
        ))
      ),
      // Top events
      evtList && evtList.length > 0 && React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "4px" } },
        React.createElement("div", { style: { fontSize: "12px", fontWeight: 600, color: "#334155" } }, "最近事件"),
        evtList.map(e => {
          const sc = e.severity === "P0" ? "#DC2626" : e.severity === "P1" ? "#EA580C" : "#2563EB";
          return React.createElement(
            "div",
            {
              key: e.id,
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "7px 10px",
                borderRadius: "6px"
              }
            },
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              React.createElement("span", {
                style: {
                  fontSize: "10px", color: "#fff",
                  background: sc,
                  padding: "1px 5px", borderRadius: "3px", fontWeight: 700
                }
              }, e.severity),
              React.createElement("span", { style: { fontSize: "12px", color: "#0F172A" } }, e.title)
            ),
            React.createElement("span", { style: { fontSize: "11px", color: "#94A3B8" } }, e.time)
          );
        })
      )
    );
  };

  const renderDispatchCard = (msg) => {
    const { store, template, items } = msg;
    return React.createElement(
      "div",
      {
        style: {
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "10px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }
      },
      React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "10px" } },
        React.createElement("div", {
          style: {
            width: "36px", height: "36px", borderRadius: "8px",
            background: `${template?.color || "#4F46E5"}15`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: template?.color || "#4F46E5",
            fontSize: "16px"
          }
        },
          React.createElement(
            "svg",
            { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
            React.createElement("path", { d: "M9 11l3 3L22 4" }),
            React.createElement("path", { d: "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" })
          )
        ),
        React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "2px" } },
          React.createElement("span", { style: { fontSize: "14px", fontWeight: 600, color: "#0F172A" } }, template?.name),
          React.createElement(
            "span",
            { style: { fontSize: "12px", color: "#64748B" } },
            "下发至 ",
            React.createElement("span", { style: { color: "#4F46E5", fontWeight: 500 } }, store.nameZh)
          )
        )
      ),
      // Items
      React.createElement(
        "div",
        {
          style: {
            display: "flex", flexDirection: "column", gap: "2px",
            padding: "10px 12px",
            background: "#F8FAFC",
            borderRadius: "8px"
          }
        },
        items.map(item => React.createElement(
          "div",
          {
            key: item.id,
            style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "5px 0"
            }
          },
          React.createElement(
            "svg",
            { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "#10B981", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
            React.createElement("polyline", { points: "20 6 9 17 4 12" })
          ),
          item.aiVerifiable && React.createElement(
            "span",
            {
              style: {
                fontSize: "10px", color: "#7C3AED",
                background: "rgba(124,58,237,0.1)",
                padding: "1px 5px", borderRadius: "3px", fontWeight: 600, flexShrink: 0
              }
            },
            "AI"
          ),
          React.createElement("span", { style: { fontSize: "13px", color: "#334155" } }, item.text)
        ))
      ),
      // Confirm buttons
      React.createElement(
        "div",
        { style: { display: "flex", gap: "8px" } },
        React.createElement(
          "button",
          {
            onClick: () => handleConfirm(msg),
            style: {
              flex: 1,
              padding: "10px 16px",
              fontSize: "13px",
              fontWeight: 600,
              background: "#4F46E5",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontFamily: "inherit"
            }
          },
          msg.confirmText
        ),
        React.createElement(
          "button",
          {
            onClick: () => {
              const cancelReply = {
                id: `a-${Date.now()}-cancel`,
                role: "assistant",
                type: "text",
                text: "好的，已取消。需要时随时叫我。"
              };
              setMessages(prev => [...prev, cancelReply]);
            },
            style: {
              flex: 1,
              padding: "10px 16px",
              fontSize: "13px",
              fontWeight: 500,
              background: "#FFFFFF",
              color: "#64748B",
              border: "1px solid #E2E8F0",
              borderRadius: "6px",
              cursor: "pointer",
              fontFamily: "inherit"
            }
          },
          msg.cancelText
        )
      )
    );
  };

  const renderPeakAnomalyCard = (msg) => {
    const sevColor = { high: "#DC2626", medium: "#F59E0B", low: "#10B981" };
    const sevLabel = { high: "严重", medium: "中等", low: "轻微" };
    return React.createElement(
      "div",
      {
        style: {
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "10px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }
      },
      React.createElement(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-end" } },
        React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "4px" } },
          React.createElement("span", { style: { fontSize: "14px", fontWeight: 600, color: "#0F172A" } }, `${msg.store.nameZh} · 高峰时段分析`),
          React.createElement("span", { style: { fontSize: "12px", color: "#94A3B8" } }, msg.period)
        ),
        React.createElement(
          "div",
          { style: { textAlign: "right" } },
          React.createElement("span", { style: { fontSize: "22px", fontWeight: 700, color: "#DC2626" } }, msg.totalAnomalies),
          React.createElement("span", { style: { fontSize: "12px", color: "#94A3B8", marginLeft: "4px" } }, "起异常")
        )
      ),
      // Anomaly list
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "6px" } },
        msg.anomalies.map((a, i) => React.createElement(
          "div",
          {
            key: i,
            style: {
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 12px",
              background: "#F8FAFC",
              borderRadius: "6px"
            }
          },
          React.createElement(
            "span",
            {
              style: {
                fontSize: "12px", color: "#334155",
                fontWeight: 600, minWidth: "48px",
                fontFamily: "var(--font-mono, monospace)"
              }
            },
            a.time
          ),
          React.createElement(
            "span",
            { style: { fontSize: "11px", color: "#64748B", width: "60px", flexShrink: 0 } },
            a.location
          ),
          React.createElement(
            "span",
            { style: { fontSize: "12px", color: "#0F172A", flex: 1 } },
            a.description
          ),
          React.createElement(
            "span",
            {
              style: {
                fontSize: "10px", color: sevColor[a.severity],
                background: `${sevColor[a.severity]}15`,
                padding: "2px 6px", borderRadius: "3px", fontWeight: 500
              }
            },
            sevLabel[a.severity]
          )
        ))
      ),
      React.createElement(
        "div",
        { style: { fontSize: "11px", color: "#94A3B8", textAlign: "right" } },
        `平均恢复时间 ${msg.avgRecovery}`
      )
    );
  };

  const renderDispatchDoneCard = (msg) => {
    return React.createElement(
      "div",
      {
        style: {
          background: "linear-gradient(135deg, #ECFDF5, #F0FDF4)",
          border: "1px solid #BBF7D0",
          borderRadius: "10px",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: "12px"
        }
      },
      React.createElement(
        "div",
        {
          style: {
            width: "32px", height: "32px", borderRadius: "50%",
            background: "#10B981",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", flexShrink: 0
          }
        },
        React.createElement(
          "svg",
          { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
          React.createElement("polyline", { points: "20 6 9 17 4 12" })
        )
      ),
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "2px" } },
        React.createElement("span", { style: { fontSize: "13px", fontWeight: 600, color: "#065F46" } }, "任务已下发成功"),
        React.createElement("span", { style: { fontSize: "12px", color: "#047857" } }, `${msg.store.nameZh} · ${msg.template.name}`)
      )
    );
  };

  // === Sidebar content ===
  const renderSidebar = () => {
    if (sidebarCollapsed) {
      return React.createElement(
        "div",
        {
          style: {
            width: "56px",
            background: "#FFFFFF",
            borderRight: "1px solid #E2E8F0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "16px 0",
            gap: "12px",
            flexShrink: 0
          }
        },
        React.createElement(
          "button",
          {
            onClick: () => setSidebarCollapsed(false),
            style: {
              width: "36px", height: "36px", borderRadius: "8px",
              background: "#F1F5F9", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#64748B"
            }
          },
          React.createElement(
            "svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
            React.createElement("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }),
            React.createElement("line", { x1: "9", y1: "3", x2: "9", y2: "21" })
          )
        ),
        React.createElement(
          "button",
          {
            onClick: handleNewChat,
            style: {
              width: "36px", height: "36px", borderRadius: "8px",
              background: "#4F46E5", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff"
            }
          },
          React.createElement(
            "svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
            React.createElement("line", { x1: "12", y1: "5", x2: "12", y2: "19" }),
            React.createElement("line", { x1: "5", y1: "12", x2: "19", y2: "12" })
          )
        )
      );
    }

    return React.createElement(
      "div",
      {
        style: {
          width: "260px",
          background: "#FFFFFF",
          borderRight: "1px solid #E2E8F0",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0
        }
      },
      // Top: new chat + collapse
      React.createElement(
        "div",
        {
          style: {
            padding: "14px 12px",
            borderBottom: "1px solid #F1F5F9",
            display: "flex",
            gap: "8px"
          }
        },
        React.createElement(
          "button",
          {
            onClick: handleNewChat,
            style: {
              flex: 1,
              padding: "10px 14px",
              background: "#4F46E5",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px"
            }
          },
          React.createElement(
            "svg",
            { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
            React.createElement("path", { d: "M12 20h9" }),
            React.createElement("path", { d: "M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" })
          ),
          "新建对话"
        ),
        React.createElement(
          "button",
          {
            onClick: () => setSidebarCollapsed(true),
            style: {
              width: "38px", height: "38px", borderRadius: "8px",
              background: "#F8FAFC", border: "1px solid #E2E8F0",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#64748B", flexShrink: 0
            }
          },
          React.createElement(
            "svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
            React.createElement("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }),
            React.createElement("line", { x1: "9", y1: "3", x2: "9", y2: "21" })
          )
        )
      ),
      // Conversation list
      React.createElement(
        "div",
        { style: { flex: 1, overflowY: "auto", padding: "8px" } },
        React.createElement(
          "div",
          {
            style: {
              fontSize: "10px",
              fontWeight: 600,
              color: "#94A3B8",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              padding: "8px 8px 6px"
            }
          },
          "对话记录"
        ),
        conversations.map(conv => {
          const isActive = conversationId === conv.id;
          const isNew = conv.id === "new";
          return React.createElement(
            "button",
            {
              key: conv.id,
              onClick: () => {
                if (isNew) {
                  handleNewChat();
                } else {
                  selectConversation(conv.id);
                }
              },
              style: {
                width: "100%",
                padding: "9px 10px",
                borderRadius: "6px",
                border: "none",
                background: isActive ? "#EEF2FF" : "transparent",
                color: isActive ? "#4F46E5" : "#334155",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
                display: "flex",
                flexDirection: "column",
                gap: "3px",
                marginBottom: "2px",
                transition: "all 0.1s"
              },
              onMouseEnter: e => {
                if (!isActive) e.currentTarget.style.background = "#F8FAFC";
              },
              onMouseLeave: e => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }
            },
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "6px" } },
              React.createElement(
                "svg",
                {
                  width: "14", height: "14",
                  fill: "none", stroke: "currentColor",
                  strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round"
                },
                isNew
                  ? React.createElement(
                    "g", {},
                    React.createElement("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }),
                    React.createElement("line", { x1: "12", y1: "8", x2: "12", y2: "14" }),
                    React.createElement("line", { x1: "9", y1: "11", x2: "15", y2: "11" })
                  )
                  : React.createElement(
                    "g", {},
                    React.createElement("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" })
                  )
              ),
              React.createElement(
                "span",
                {
                  style: {
                    fontSize: "13px",
                    fontWeight: isActive ? 600 : 500,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    flex: 1
                  }
                },
                conv.title
              )
            ),
            !isNew && React.createElement(
              "span",
              { style: { fontSize: "11px", color: "#94A3B8", paddingLeft: "20px" } },
              conv.preview
            )
          );
        })
      ),
      // Bottom: model / account info
      React.createElement(
        "div",
        {
          style: {
            padding: "12px",
            borderTop: "1px solid #F1F5F9",
            display: "flex",
            alignItems: "center",
            gap: "10px"
          }
        },
        React.createElement(
          "div",
          {
            style: {
              width: "32px", height: "32px", borderRadius: "50%",
              background: "linear-gradient(135deg, #7C3AED, #4F46E5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: "12px", fontWeight: 700,
              flexShrink: 0
            }
          },
          "巡"
        ),
        React.createElement(
          "div",
          { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px" } },
          React.createElement("span", { style: { fontSize: "12px", fontWeight: 600, color: "#0F172A" } }, "小巡 Pro"),
          React.createElement("span", { style: { fontSize: "11px", color: "#94A3B8" } }, "按提问查询门店数据")
        ),
        React.createElement(
          "span",
          {
            style: {
              width: "8px", height: "8px", borderRadius: "50%",
              background: "#10B981",
              boxShadow: "0 0 0 3px rgba(16, 185, 129, 0.2)"
            }
          }
        )
      )
    );
  };

  // === Main render ===
  const isWelcome = messages.length <= 1 && messages[0]?.type === "welcome";

  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        height: "100%",
        background: "#FFFFFF",
        margin: "-24px -28px",
        overflow: "hidden"
      }
    },
    // Left sidebar
    renderSidebar(),

    // Main chat area
    React.createElement(
      "div",
      {
        style: {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          background: "#FFFFFF"
        }
      },
      // Chat header
      React.createElement(
        "div",
        {
          style: {
            padding: "14px 24px",
            borderBottom: "1px solid #F1F5F9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0
          }
        },
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "10px" } },
          React.createElement(
            "div",
            {
              style: {
                width: "32px", height: "32px", borderRadius: "50%",
                background: "linear-gradient(135deg, #7C3AED, #4F46E5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: "13px", fontWeight: 700
              }
            },
            "巡"
          ),
          React.createElement(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "1px" } },
            React.createElement("span", { style: { fontSize: "14px", fontWeight: 600, color: "#0F172A" } }, "小巡"),
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "6px" } },
              React.createElement("span", { style: { width: "6px", height: "6px", borderRadius: "50%", background: "#10B981" } }),
              React.createElement("span", { style: { fontSize: "11px", color: "#94A3B8" } }, disabled?"AI 巡检助理 · 展示版本":"AI 巡检助理 · 实际数据查询")
            )
          )
        ),
        React.createElement(
          "div",
          { style: { display: "flex", gap: "6px" } },
          React.createElement(
            "button",
            {
              onClick: handleNewChat,
              style: {
                padding: "7px 14px",
                fontSize: "12px",
                background: "#F8FAFC",
                color: "#334155",
                border: "1px solid #E2E8F0",
                borderRadius: "6px",
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }
            },
            React.createElement(
              "svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
              React.createElement("path", { d: "M12 20h9" }),
              React.createElement("path", { d: "M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" })
            ),
            "新对话"
          )
        )
      ),

      // Messages area
      React.createElement(
        "div",
        {
          ref: messagesEndRef,
          style: {
            flex: 1,
            overflowY: "auto",
            padding: isWelcome ? "0" : "0 24px",
            background: "#FFFFFF"
          }
        },
        isWelcome ? (
          // Welcome hero
          React.createElement(
            "div",
            {
              style: {
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "40px 24px",
                gap: "32px"
              }
            },
            // Logo + greeting
            React.createElement(
              "div",
              {
                style: {
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "12px"
                }
              },
              React.createElement(
                "div",
                {
                  style: {
                    width: "56px", height: "56px", borderRadius: "16px",
                    background: "linear-gradient(135deg, #7C3AED, #4F46E5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: "22px", fontWeight: 700,
                    boxShadow: "0 8px 24px rgba(79, 70, 229, 0.25)"
                  }
                },
                "巡"
              ),
              React.createElement(
                "h2",
                {
                  style: {
                    fontSize: "24px",
                    fontWeight: 700,
                    color: "#0F172A",
                    margin: 0
                  }
                },
                "你好，我是小巡"
              ),
              React.createElement(
                "p",
                {
                  style: {
                    fontSize: "14px",
                    color: "#64748B",
                    margin: 0,
                    maxWidth: "480px",
                    lineHeight: 1.6
                  }
                },
                "我可以查询已接入门店的 SOP、异常事件和分析记录，并根据真实数据提供巡检建议。"
              )
            ),
            // Quick start suggestions
            React.createElement(
              "div",
              {
                style: {
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "12px",
                  maxWidth: "640px",
                  width: "100%"
                }
              },
              [
                { icon: "chart", title: "查询巡检数据", desc: "门店进度、通过率、异常汇总", sample: "今天 JTU 店的巡检情况怎么样？" },
                { icon: "store", title: "跨门店汇总", desc: "多店对比、未完成、整体概况", sample: "哪些门店还没完成开店检查？" },
                { icon: "check", title: "巡检行动建议", desc: "核验步骤、复核与整改建议", sample: "发现桌面遗留物品后应该如何复核？" },
                { icon: "alert", title: "分析异常问题", desc: "高峰时段、趋势对比、根因分析", sample: "本周通过率最低的门店是哪家？" }
              ].map((s, i) => React.createElement(
                "button",
                {
                  key: i,
                  onClick: () => handleSuggestion(s.sample),
                  style: {
                    padding: "16px 18px",
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: "10px",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    transition: "all 0.15s"
                  },
                  onMouseEnter: e => {
                    e.currentTarget.style.background = "#EEF2FF";
                    e.currentTarget.style.borderColor = "#C7D2FE";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  },
                  onMouseLeave: e => {
                    e.currentTarget.style.background = "#F8FAFC";
                    e.currentTarget.style.borderColor = "#E2E8F0";
                    e.currentTarget.style.transform = "translateY(0)";
                  }
                },
                React.createElement(
                  "div",
                  {
                    style: {
                      width: "32px", height: "32px", borderRadius: "6px",
                      background: "#FFFFFF",
                      border: "1px solid #E2E8F0",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#4F46E5",
                      marginBottom: "4px"
                    }
                  },
                  s.icon === "chart" && React.createElement(
                    "svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                    React.createElement("line", { x1: "18", y1: "20", x2: "18", y2: "10" }),
                    React.createElement("line", { x1: "12", y1: "20", x2: "12", y2: "4" }),
                    React.createElement("line", { x1: "6", y1: "20", x2: "6", y2: "14" })
                  ),
                  s.icon === "store" && React.createElement(
                    "svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                    React.createElement("path", { d: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" }),
                    React.createElement("polyline", { points: "9 22 9 12 15 12 15 22" })
                  ),
                  s.icon === "check" && React.createElement(
                    "svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                    React.createElement("path", { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14" }),
                    React.createElement("polyline", { points: "22 4 12 14.01 9 11.01" })
                  ),
                  s.icon === "alert" && React.createElement(
                    "svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                    React.createElement("path", { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }),
                    React.createElement("line", { x1: "12", y1: "9", x2: "12", y2: "13" }),
                    React.createElement("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })
                  )
                ),
                React.createElement(
                  "span",
                  { style: { fontSize: "14px", fontWeight: 600, color: "#0F172A" } },
                  s.title
                ),
                React.createElement(
                  "span",
                  { style: { fontSize: "12px", color: "#94A3B8", lineHeight: 1.4 } },
                  s.desc
                ),
                React.createElement(
                  "span",
                  {
                    style: {
                      fontSize: "12px", color: "#4F46E5",
                      marginTop: "4px", fontWeight: 500
                    }
                  },
                  `→ ${s.sample}`
                )
              ))
            )
          )
        ) : (
          // Regular message list
          React.createElement(
            "div",
            { style: { display: "flex", flexDirection: "column" } },
            messages.map(m => renderMessage(m)),
            isTyping && React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  gap: "14px",
                  width: "100%",
                  maxWidth: "820px",
                  margin: "0 auto",
                  padding: "20px 0"
                }
              },
              React.createElement(
                "div",
                {
                  style: {
                    width: "36px", height: "36px", borderRadius: "50%",
                    background: "linear-gradient(135deg, #7C3AED, #4F46E5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: "13px", fontWeight: 700,
                    flexShrink: 0
                  }
                },
                "巡"
              ),
              React.createElement(
                "div",
                {
                  style: {
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px"
                  }
                },
                React.createElement("span", { style: { fontSize: "13px", fontWeight: 600, color: "#0F172A" } }, "小巡"),
                React.createElement(
                  "div",
                  { style: { display: "flex", gap: "5px", padding: "14px 0" } },
                  [0, 1, 2].map(i => React.createElement(
                    "span",
                    {
                      key: i,
                      style: {
                        width: "8px", height: "8px",
                        borderRadius: "50%",
                        background: "#CBD5E1",
                        animation: `agentBounce 1.2s infinite ease-in-out`,
                        animationDelay: `${i * 0.15}s`
                      }
                    }
                  ))
                )
              )
            )
          )
        )
      ),

      // Input area
      React.createElement(
        "div",
        {
          style: {
            padding: "16px 24px 20px",
            borderTop: "1px solid #F1F5F9",
            background: "#FFFFFF",
            flexShrink: 0
          }
        },
        React.createElement(
          "div",
          {
            style: {
              maxWidth: "820px",
              margin: "0 auto",
              position: "relative"
            }
          },
          React.createElement(
            "div",
            {
              style: {
                border: "1px solid #CBD5E1",
                borderRadius: "12px",
                background: "#FFFFFF",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                transition: "all 0.15s",
                overflow: "hidden"
              }
            },
            React.createElement(
              "textarea",
              {
                disabled:disabled||isTyping,
                ref: inputRef,
                value: input,
                onChange: e => setInput(e.target.value),
                onKeyDown: e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                },
                placeholder: "问我任何巡检相关的问题，或下达指令… (Enter 发送，Shift+Enter 换行)",
                rows: 1,
                style: {
                  width: "100%",
                  resize: "none",
                  border: "none",
                  padding: "14px 56px 14px 16px",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  lineHeight: 1.5,
                  outline: "none",
                  maxHeight: "160px",
                  color: "#0F172A",
                  boxSizing: "border-box"
                }
              }
            ),
            React.createElement(
              "button",
              {
                onClick: handleSend,
                disabled: disabled||isTyping||!input.trim(),
                style: {
                  position: "absolute",
                  right: "10px",
                  bottom: "10px",
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  background: input.trim() ? "#4F46E5" : "#CBD5E1",
                  color: "#fff",
                  border: "none",
                  cursor: input.trim() ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }
              },
              React.createElement(
                "svg",
                { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                React.createElement("line", { x1: "22", y1: "2", x2: "11", y2: "13" }),
                React.createElement("polygon", { points: "22 2 15 22 11 13 2 9 22 2" })
              )
            )
          ),
          React.createElement(
            "div",
            {
              style: {
                textAlign: "center",
                marginTop: "10px",
                fontSize: "11px",
                color: "#94A3B8"
              }
            },
            "小巡会基于门店真实数据回答问题 · AI 生成内容，请以实际数据为准"
          )
        )
      )
    ),
    // CSS for typing animation
    React.createElement("style", {}, `
      @keyframes agentBounce {
        0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
        40% { transform: translateY(-4px); opacity: 1; }
      }
    `)
  );
}

