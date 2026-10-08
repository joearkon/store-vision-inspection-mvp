import React, { useEffect, useState } from "react";
import { api } from "./api";
import { Icon } from "./icons";
import { eligibleFeishuEvents } from "./feishuCardEligibility";
import { isShowcaseMode } from "./showcaseApi";

const tabs = [
  { id: "p0", name: "P0 严重告警", filename: "card_p0_severe.json", summary: "E1/B1 严重事件", state: "真实 P0 事件可手动发送测试卡片；B1 不自动告警" },
  { id: "p1", name: "P1 历史卡片", filename: "card_p1_standard.json", summary: "既有 E1/P1 事件", state: "仅用于既有 E1/P1 事件测试" },
  { id: "p2", name: "P2 疑似线索", filename: "card_p2_clue.json", summary: "口罩与离席后物品", state: "A1/G2/M1 疑似线索；仅手动测试，不自动告警" },
  { id: "sla", name: "SLA 升级提醒", filename: "card_sla_escalation.json", summary: "告警逾期升级", state: "原型示意 · 尚未接入发送" },
];

const illustrativeCards = {
  p2: { preview_only: true, note: "先上传视频形成 A1/G2/M1 待核查线索，再发送测试卡片。" },
  p0: {
    preview_only: true,
    note: "尚无可选 P0 事件时只展示结构；示意卡不可发送。",
    rule_binding: "B1",
    card: {
      schema: "2.0", config: { update_multi: true },
      header: { template: "red", title: { tag: "plain_text", content: "门店视觉巡检告警 · P0" } },
      body: { direction: "vertical", elements: [
        { tag: "markdown", content: "**B1 · 疑似烟雾/异常明火**\n安全事件等级 P0；本卡仅为结构示意，不代表真实告警。" },
        { tag: "markdown", content: "**能力状态**\n视觉规则实验运行、需人工复核；自动通知和 SLA 升级尚未启用。" },
        { tag: "button", text: { tag: "plain_text", content: "查看详情" }, disabled_in_preview: true },
      ] },
    },
  },
  p1: {
    preview_only: true,
    note: "选择历史 E1/P1 事件后显示真实卡片；示意卡不可发送。",
    card: { schema: "2.0", header: { template: "orange", title: { tag: "plain_text", content: "门店视觉巡检告警 · P1" } } },
  },
  sla: {
    preview_only: true,
    note: "仅展示原型结构。自动升级与卡片状态操作尚未实现。",
    card: {
      schema: "2.0", config: { update_multi: true },
      header: { template: "red", title: { tag: "plain_text", content: "SLA 升级提醒" } },
      body: { direction: "vertical", elements: [
        { tag: "markdown", content: "**告警逾期未处理**\n仅为设计示意，没有实际逾期事件。" },
        { tag: "markdown", content: "**管理员介入**\n升级阈值、接收人及去重策略待配置。" },
        { tag: "button", text: { tag: "plain_text", content: "查看原事件" }, disabled_in_preview: true },
      ] },
    },
  },
};

const eventStatus = {
  pending_confirmation: "待人工确认", acknowledged: "已确认", rectifying: "整改中",
  resolved: "已解决", false_positive: "误报", ignored: "已忽略",
};

export function FeishuCardsPage({ navigate, initialEventId }) {
  const [tab, setTab] = useState(initialEventId ? "p2" : "p0");
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState(initialEventId || "");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isShowcaseMode) { setLoading(false); return; }
    api.events().then((rows) => {
      setEvents(rows);
    }).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  const eligibleEvents = eligibleFeishuEvents(events, tab);
  const selectedEventId = eligibleEvents.some((item) => item.id === eventId)
    ? eventId : eligibleEvents[0]?.id || "";

  useEffect(() => {
    if (isShowcaseMode || !selectedEventId || tab === "sla") { setPreview(null); return; }
    setPreview(null);
    setError("");
    api.feishuTestPreview(selectedEventId).then(setPreview).catch((err) => setError(err.message));
  }, [selectedEventId, tab]);

  const send = async () => {
    if (!checked || !selectedEventId || busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const result = await api.feishuTestSend(selectedEventId);
      const refreshed = await api.feishuTestPreview(selectedEventId);
      setPreview(refreshed);
      const status = result.delivery.status;
      setMessage(status === "sent"
        ? result.duplicate ? "此前已投递，未重复发送。" : "飞书接口已接收测试卡片，请在测试群核对显示。"
        : status === "failed" ? `发送失败：${result.delivery.error_message || "请检查机器人配置"}`
        : `发送结果：${status}`);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(tab !== "sla" && currentPreview ? currentPreview.card : illustrativeCards[tab], null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { setError("复制失败，请检查浏览器剪贴板权限。"); }
  };

  const selected = tabs.find((item) => item.id === tab);
  const currentPreview = preview?.event?.id === selectedEventId && tab !== "sla" ? preview : null;
  const event = currentPreview?.event;
  const delivery = currentPreview?.delivery;
  const transport = currentPreview?.transport === "group_webhook" ? "群自定义机器人" :
    currentPreview?.transport === "application_bot" ? "应用机器人" :
    currentPreview?.transport === "unconfigured" ? "未配置" : "待事件生成后确认";
  const canSend = tab !== "sla" && !!currentPreview && checked && !busy && currentPreview.transport !== "unconfigured";

  return <div className="feishu-page">
    <header className="feishu-heading"><h1>飞书卡片预览</h1><p>飞书告警卡片 JSON 模板，用于事件告警和后续 SLA 升级通知</p></header>
    <div className="feishu-tabs" role="tablist" aria-label="卡片类型">
      {tabs.map((item) => <button type="button" role="tab" aria-selected={tab === item.id} className={`${item.id} ${tab === item.id ? "active" : ""}`} key={item.id} onClick={() => { setTab(item.id); setEventId(""); setChecked(false); setMessage(""); setError(""); }}><i />{item.name}</button>)}
    </div>
    <div className="feishu-preview-grid">
      <section className="feishu-preview-well" aria-label="卡片效果预览">
        <span className="feishu-caption">卡片效果预览</span>
        <div className={`feishu-card-mock ${tab}`}>
          <h2>{tab === "sla" ? "SLA 升级提醒" : "门店视觉巡检提醒"}<em>{tab === "p1" ? "P1-一般" : tab === "p0" ? "P0-严重" : tab === "p2" ? "P2-待核查" : "待接入"}</em></h2>
          <p>{event ? `${event.store_name} 店 · ${event.camera_name} · ${event.id}` : "MOMOYO JTU 店 · 原型示意"}</p>
          <div className="feishu-card-highlight"><strong>{event ? `${event.rule_code} · ${event.title}` : tab === "p0" ? "B1 · 疑似烟雾/异常明火" : tab === "p1" ? "E1 · 冰箱门持续开启" : tab === "p2" ? "疑似线索 · 先选择真实分析记录" : "告警逾期未处理"}</strong><span>{event ? `${event.rule_code === "E1" ? "连续开启" : "视频观察"} ${Math.round(event.confirmed_offset - event.first_seen_offset)} 秒后形成记录 · 当前状态：${eventStatus[event.status] || event.status}` : tab === "p0" ? "事件等级 P0 · 尚无真实 P0 事件 · 示意卡不可发送" : "仅供预览，未产生真实告警"}</span></div>
          <div className="feishu-card-note"><strong>{event ? "处置建议" : "能力状态"}</strong><span>{event ? event.rule_code === "E1" ? "关闭冷藏柜门，并检查内部原料温度。" : ["A1", "G2", "M1"].includes(event.rule_code) ? "疑似线索需人工核查；不认定垃圾、清洁超时或员工责任。" : "请人工核查现场及设备；视频实验判断不代替现场安全确认。" : isShowcaseMode ? "静态版仅展示卡片结构，不发送真实告警。" : selected.state}</span></div>
          <div className="feishu-card-actions"><button type="button" disabled={!event} onClick={() => navigate("event", event.id)}>查看详情</button><button type="button" disabled title="群自定义机器人不支持回调操作">标记已处理</button></div>
          <footer>来自：门店视觉巡检系统 · 视觉 AI 分析{event ? " · 测试预览" : " · 原型示意"}</footer>
        </div>
        {isShowcaseMode && <p className="feishu-preview-note">云端演示版仅预览卡片结构，飞书发送与调试需在本地系统进行。</p>}
        {!isShowcaseMode && tab !== "sla" && <div className="feishu-debug-panel">
          <label htmlFor="feishu-event">{tab === "p0" ? "选择真实 E1/P0 或 B1/P0 事件" : tab === "p2" ? "选择 A1/G2/M1 疑似线索" : "选择历史 E1/P1 巡检事件"}</label>
          <select id="feishu-event" value={selectedEventId} onChange={(e) => { setEventId(e.target.value); setChecked(false); setMessage(""); }} disabled={loading || eligibleEvents.length === 0}>{eligibleEvents.length === 0 && <option value="">暂无可用事件</option>}{eligibleEvents.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.rule_code} · {item.title}</option>)}</select>
          <p>{eligibleEvents.length ? "发送到已配置的测试群，不创建工单；同一事件的测试卡片只投递一次。" : "暂无真实可发送事件；需先由视频分析产生对应等级的事件，示意卡不能发送。"}当前通道：{transport}。{tab === "p0" ? "B1 仅允许手动测试，不启用自动告警。" : ""}</p>
          {currentPreview?.local_detail_link && <p className="feishu-warning">详情链接为本机地址，群成员在其他设备上无法打开。</p>}
          {delivery && <p>最近测试：{delivery.status === "sent" ? "已发送" : delivery.status === "failed" ? "失败" : delivery.status} · 尝试 {delivery.attempts} 次</p>}
          <label className="feishu-confirm"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />我确认向测试群发送标注“测试”的卡片</label>
          <button className="button primary feishu-send" type="button" disabled={!canSend} onClick={send}>{busy ? "发送中…" : "发送测试卡片"}</button>
          {message && <p className="feishu-feedback" role="status">{message}</p>}
          {error && <p className="feishu-error" role="alert">{error}</p>}
        </div>}
        {tab === "sla" && <p className="feishu-preview-note">{selected.state}。没有真实事件和可用发送按钮。</p>}
      </section>
      <section className="feishu-code-panel" aria-label="卡片 JSON">
        <div className="feishu-code-toolbar"><div><span className="window-dots"><i /><i /><i /></span><span>{selected.filename}{currentPreview ? " · 当前事件" : " · 示意"}</span></div><button type="button" onClick={copy}><Icon name="copy" size={13} />{copied ? "已复制" : "复制代码"}</button></div>
        <pre><code>{JSON.stringify(currentPreview?.card || illustrativeCards[tab], null, 2)}</code></pre>
      </section>
    </div>
    <div className="feishu-info-grid">{tabs.map((item) => <button type="button" key={item.id} className={`${item.id} ${tab === item.id ? "active" : ""}`} onClick={() => { setTab(item.id); setEventId(""); setChecked(false); setMessage(""); setError(""); }}><i /><strong>{item.name}</strong><span>{isShowcaseMode ? "仅展示模板 · 不连接飞书" : item.state}</span></button>)}</div>
  </div>;
}
