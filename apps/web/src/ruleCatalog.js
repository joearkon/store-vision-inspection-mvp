// UI catalog of current runtime capability. Server-side event severity and
// notification policy remain authoritative; keep this display in sync with them.
const catalog = [
  { code: "E1", name: "冰箱门持续开启", type: "多帧时序", strategy: "持续 30 秒", severity: "P0", gradeConfirmed: true, stage: "sample_tested", evidence: "3 条合成视频；正负样本及关门恢复已验证；事件已人工关闭", notification: "可选测试群通知" },
  { code: "A1", name: "未佩戴口罩或一次性手套", type: "ROI + 多帧", strategy: "最近 5 个有效帧命中 3 帧", severity: "P2", stage: "sample_tested", validationLabel: "真实视频样本已验证", evidence: "2 条合成视频已验证；真实门店口罩线索已复核，手套仍不确定", notification: "不自动通知；手动飞书测试已验证" },
  { code: "A2", name: "未戴工作帽/发网", type: "操作区 + 多帧", strategy: "最近 5 个有效帧命中 3 帧", severity: "P1", stage: "experimental", evidence: "尚无上传视频模型分析记录", notification: "不自动通知" },
  { code: "C1", name: "未穿围裙/工服", type: "操作区 + 多帧", strategy: "最近 5 个有效帧命中 3 帧", severity: "P1", stage: "experimental", evidence: "尚无上传视频模型分析记录", notification: "不自动通知" },
  { code: "A3", name: "操作台明显脏乱", type: "环境 + 时序", strategy: "持续 60 秒", severity: "P1", stage: "experimental", evidence: "尚无上传视频模型分析记录", notification: "不自动通知" },
  { code: "A4", name: "地面积水/明显垃圾", type: "环境 + 多帧", strategy: "最近 5 个有效帧命中 3 帧", severity: "P1", stage: "experimental", evidence: "尚无上传视频模型分析记录", notification: "不自动通知" },
  { code: "B1", name: "疑似烟雾/异常明火", type: "视频粗筛 + 关键帧", strategy: "持续 2 秒，人工复核", severity: "P0", gradeConfirmed: true, stage: "sample_tested", evidence: "3 条合成视频；烟雾与蒸汽已验证；首轮漏检保留记录；事件已人工关闭", notification: "不自动通知" },
  { code: "M1", name: "开店拖地检查", type: "动作识别 + 检查时段", strategy: "两张有效帧确认拖地；未见动作需完整已结束时段", severity: "P2", stage: "experimental", validationLabel: "真实视频正样本已验证", evidence: "真实拖地视频及低密度回归通过；完整窗口漏做告警尚待实测", notification: "未观察到拖地仅形成待核查提醒" },
  { code: "G2", name: "离席后疑似遗留物品", type: "逐桌 ROI + 前后对比", strategy: "先在座，再连续3帧疑似物品；非清洁超时", severity: "P2", stage: "experimental", validationLabel: "真实视频样本已验证", evidence: "T01 离席残留线索及双层回归已验证；其他桌位尚未启用", notification: "仅手动测试通知" },
  { code: "G1", name: "单桌离席后残留", type: "逐桌 ROI + 时序", strategy: "候选 120 秒，待业务确认", plannedSeverity: "P2", stage: "research", evidence: "仅模拟观察；无上传视频模型分析记录", notification: "不自动通知" },
  { code: "F1", name: "取餐区堆积混乱", type: "区域 + 多帧", strategy: "阈值待确认", plannedSeverity: "P2", stage: "research", evidence: "未实现", notification: "不自动通知" },
  { code: "F2", name: "顾客排队拥挤", type: "人数 + 区域", strategy: "阈值待确认", plannedSeverity: "P2", stage: "research", evidence: "未实现", notification: "不自动通知" },
  { code: "A6", name: "通道堵塞", type: "通道 ROI + 时序", strategy: "阈值待确认", plannedSeverity: "P2", stage: "research", evidence: "未实现", notification: "不自动通知" },
  { code: "F3", name: "生熟混放", type: "物品关系 + 复核", strategy: "条件待确认", plannedSeverity: "P2", stage: "research", evidence: "未实现", notification: "不自动通知" },
  { code: "F4", name: "异物混入", type: "小目标 + 复核", strategy: "条件待确认", plannedSeverity: "P2", stage: "research", evidence: "未实现", notification: "不自动通知" },
];

const notifyingCodes = new Set(["E1","A1","A2","A3","A4","B1","C1","G1","G2","M1"]);
export const ruleCatalog = catalog.map(rule => notifyingCodes.has(rule.code) ? {...rule,notification:"默认发送事件通知；疑似线索待核查"} : rule);
export const p0Rules = ruleCatalog.filter((rule) => rule.severity === "P0");

export function ruleValidationLabel(rule) {
  return rule.validationLabel || (rule.stage === "sample_tested" ? "合成样本级验证" : rule.stage === "experimental" ? "上传可选，尚无视频实测" : "尚未开放上传");
}

export function ruleFilterLabel(code) {
  if (code === "all") return "全部规则";
  const rule = ruleCatalog.find(item => item.code === code);
  return rule ? `${code} · ${rule.name}` : code;
}
