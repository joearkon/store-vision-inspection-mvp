// Mock data for Store Visual Inspection prototype
// All data is realistic for MOMOYO bubble tea shop in Indonesia

const CAMERA_IMAGES = {
  front_counter: "/spark/app/app_17ey14hs6nv/runtime/api/v1/storage/object/bucket_aadkxdlvj3kpw_static/static%2Faadkxc6aocmci_ve_miaoda",
  back_kitchen: "/spark/app/app_17ey14hs6nv/runtime/api/v1/storage/object/bucket_aadkxdlvj3kpw_static/static%2Faadkxctsizwbi_ve_miaoda",
  storage: "/spark/app/app_17ey14hs6nv/runtime/api/v1/storage/object/bucket_aadkxdlvj3kpw_static/static%2Faadkxc6ivdoig_ve_miaoda",
  pickup_area: "/spark/app/app_17ey14hs6nv/runtime/api/v1/storage/object/bucket_aadkxdlvj3kpw_static/static%2Faadkxcxtntehq_ve_miaoda"
};

const CAMERAS = [
  {
    id: "CAM-001",
    name: "前台-01",
    location: "Front Counter",
    locationZh: "前台操作区",
    status: "online",
    lastHeartbeat: "2026-09-27 09:28:15",
    resolution: "1920x1080",
    ip: "192.168.1.101",
    model: "EZVIZ C6W",
    imageKey: "front_counter"
  },
  {
    id: "CAM-002",
    name: "后厨-01",
    location: "Back Kitchen",
    locationZh: "后厨操作区",
    status: "online",
    lastHeartbeat: "2026-09-27 09:28:12",
    resolution: "1920x1080",
    ip: "192.168.1.102",
    model: "Hikvision DS-2CD",
    imageKey: "back_kitchen"
  },
  {
    id: "CAM-003",
    name: "仓储-01",
    location: "Storage Area",
    locationZh: "仓储区",
    status: "online",
    lastHeartbeat: "2026-09-27 09:28:10",
    resolution: "1280x720",
    ip: "192.168.1.103",
    model: "Dahua IPC-HDW",
    imageKey: "storage"
  },
  {
    id: "CAM-004",
    name: "取餐-01",
    location: "Pickup Area",
    locationZh: "取餐区",
    status: "offline",
    lastHeartbeat: "2026-09-27 08:45:33",
    resolution: "1920x1080",
    ip: "192.168.1.104",
    model: "EZVIZ C6W",
    imageKey: "pickup_area"
  }
];

const EVENTS = [
  {
    id: "EVT-0927-001",
    type: "A1",
    typeName: "未佩戴手套",
    category: "hygiene",
    categoryZh: "卫生规范",
    severity: "P0",
    confidence: 92,
    description: "员工在制作黑糖珍珠奶茶时未佩戴一次性手套",
    evidence: "左手直接接触珍珠容器内壁，手部无手套覆盖",
    ruleReference: "《食品操作规范》第 3.2 条：接触即食食品须佩戴一次性手套",
    suggestion: "立即佩戴一次性手套，已制作饮品建议废弃处理",
    cameraId: "CAM-001",
    cameraName: "前台-01",
    locationZh: "前台操作区",
    imageKey: "front_counter",
    timestamp: "2026-09-27 09:23:07",
    timeAgo: "5 分钟前",
    status: "pending",
    statusZh: "待处理",
    assignee: null,
    slaMinutes: 5,
    slaRemaining: "02:15"
  },
  {
    id: "EVT-0927-002",
    type: "E1",
    typeName: "冰箱门未关",
    category: "equipment",
    categoryZh: "设备状态",
    severity: "P1",
    confidence: 87,
    description: "仓储区冷藏柜门敞开超过 30 秒，内部原料暴露",
    evidence: "冷藏柜门完全打开，角度约 90 度，持续 42 秒",
    ruleReference: "《设备操作规范》第 2.1 条：冷藏设备门应保持关闭，防止温度波动",
    suggestion: "立即关闭冷藏柜门，检查内部原料温度是否异常",
    cameraId: "CAM-003",
    cameraName: "仓储-01",
    locationZh: "仓储区",
    imageKey: "storage",
    timestamp: "2026-09-27 08:45:22",
    timeAgo: "43 分钟前",
    status: "in_progress",
    statusZh: "整改中",
    assignee: "李明（店长）",
    slaMinutes: 30,
    slaRemaining: "12:30"
  },
  {
    id: "EVT-0927-003",
    type: "C1",
    typeName: "未穿工服",
    category: "compliance",
    categoryZh: "合规着装",
    severity: "P1",
    confidence: 89,
    description: "后厨操作人员穿着便服，未穿着统一工作服/围裙",
    evidence: "操作人员上身着灰色 T 恤，无围裙，无工牌",
    ruleReference: "《门店着装规范》第 1.1 条：所有在岗员工须穿着统一工作服并佩戴工牌",
    suggestion: "立即更换工作服并佩戴工牌，填写着装违规记录",
    cameraId: "CAM-002",
    cameraName: "后厨-01",
    locationZh: "后厨操作区",
    imageKey: "back_kitchen",
    timestamp: "2026-09-27 08:12:45",
    timeAgo: "1 小时前",
    status: "resolved",
    statusZh: "已解决",
    assignee: "王芳（后厨主管）",
    slaMinutes: 30,
    slaRemaining: "已完成"
  },
  {
    id: "EVT-0927-004",
    type: "F1",
    typeName: "取餐区混乱",
    category: "customer",
    categoryZh: "顾客体验",
    severity: "P2",
    confidence: 78,
    description: "取餐台饮品杂乱摆放，无取餐号牌，顾客难以识别",
    evidence: "取餐台上约 8 杯饮品无序摆放，未见取餐号牌或标签",
    ruleReference: "《顾客服务规范》第 4.3 条：出品须按序摆放并附带取餐号牌",
    suggestion: "整理取餐台，按单号顺序摆放并放置取餐号牌",
    cameraId: "CAM-004",
    cameraName: "取餐-01",
    locationZh: "取餐区",
    imageKey: "pickup_area",
    timestamp: "2026-09-27 07:58:10",
    timeAgo: "1.5 小时前",
    status: "resolved",
    statusZh: "已解决",
    assignee: "张伟（前台主管）",
    slaMinutes: 120,
    slaRemaining: "已完成"
  },
  {
    id: "EVT-0927-005",
    type: "A3",
    typeName: "操作台脏乱",
    category: "hygiene",
    categoryZh: "卫生规范",
    severity: "P1",
    confidence: 85,
    description: "前台操作台面积水、污渍、原料残渣未及时清理",
    evidence: "操作台面右侧可见咖啡色液体污渍，散落珍珠约 5 颗",
    ruleReference: "《食品操作规范》第 4.1 条：操作台应随时保持清洁，每 30 分钟擦拭一次",
    suggestion: "立即清理操作台，执行消毒流程，并登记清洁记录",
    cameraId: "CAM-001",
    cameraName: "前台-01",
    locationZh: "前台操作区",
    imageKey: "front_counter",
    timestamp: "2026-09-27 07:30:55",
    timeAgo: "2 小时前",
    status: "overdue",
    statusZh: "已超时",
    assignee: null,
    slaMinutes: 30,
    slaRemaining: "超时 1h28m"
  },
  {
    id: "EVT-0927-006",
    type: "B1",
    typeName: "明火/燃气异常",
    category: "safety",
    categoryZh: "安全隐患",
    severity: "P0",
    confidence: 95,
    description: "后厨加热区明火燃烧，周围无操作人员看管",
    evidence: "电磁炉区域可见明火，持续 2 分 15 秒内无人员出现",
    ruleReference: "《消防安全规范》第 2.3 条：明火操作必须有专人看管，离岗须关闭火源",
    suggestion: "立即关闭火源，检查现场安全状况，对责任人进行安全培训",
    cameraId: "CAM-002",
    cameraName: "后厨-01",
    locationZh: "后厨操作区",
    imageKey: "back_kitchen",
    timestamp: "2026-09-26 22:15:30",
    timeAgo: "11 小时前",
    status: "resolved",
    statusZh: "已解决",
    assignee: "王芳（后厨主管）",
    slaMinutes: 5,
    slaRemaining: "已完成"
  }
];

const STATS = {
  todayTotal: 6,
  p0Count: 2,
  p1Count: 3,
  p2Count: 1,
  pendingCount: 1,
  resolvedCount: 3,
  inProgressCount: 1,
  overdueCount: 1,
  cameraOnline: 3,
  cameraTotal: 4,
  aiAccuracy: 91.2
};

const ANOMALY_CATEGORIES = [
  { key: "hygiene", name: "卫生规范", icon: "🧼", color: "#DC2626" },
  { key: "safety", name: "安全隐患", icon: "⚠️", color: "#B91C1C" },
  { key: "compliance", name: "合规着装", icon: "👔", color: "#2563EB" },
  { key: "operation", name: "操作规范", icon: "📋", color: "#7C3AED" },
  { key: "equipment", name: "设备状态", icon: "⚙️", color: "#EA580C" },
  { key: "customer", name: "顾客体验", icon: "😊", color: "#0891B2" }
];

const ANALYSIS_STEPS = [
  { id: "upload", label: "视频上传", duration: 2000 },
  { id: "frames", label: "抽帧处理", duration: 3000 },
  { id: "ai", label: "AI 分析", duration: 4000 }
];

Object.assign(window, {
  CAMERA_IMAGES,
  CAMERAS,
  EVENTS,
  STATS,
  ANOMALY_CATEGORIES,
  ANALYSIS_STEPS
});
