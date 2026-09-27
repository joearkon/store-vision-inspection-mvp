# 门店视觉巡检 Demo — 设计文档

> **版本**: v1.0 MVP  
> **日期**: 2026-09-27  
> **场景**: MOMOYO 印尼门店前台/后厨视频监控巡检  
> **定位**: 独立 Demo 项目，不与"加盟商运营诊断"合并

---

## 一、项目定位与 AI 价值主张

### 1.1 为什么用大模型视觉？

传统视频监控系统依赖**固定规则引擎**（如 motion detection、区域入侵检测），存在三大瓶颈：

| 传统方案 | 大模型视觉方案 |
|---------|--------------|
| 需预设 ROI 区域和阈值，每类异常要单独建模 | **自然语言描述异常**，同一模型覆盖多类问题 |
| 只能检测"有没有物体/人"，无法理解语义 | **语义级理解**："员工没戴手套"vs"手套在桌上但人没戴" |
| 告警只有"触发/未触发"，无法给出依据 | **合规依据输出**：引用具体规章条款，支持整改闭环 |

### 1.2 AI 三大差异化

1. **自然语言 + 规则融合**：用 Prompt 同时注入"行业规范"和"门店 SOP"，AI 输出既有语义判断又有规则匹配度评分
2. **语义级告警**：不只是"检测到人体"，而是"检测到员工在制作饮品时未佩戴一次性手套，置信度 92%"
3. **合规依据可追溯**：每条告警附带判定依据（如"违反《食品操作规范》第 3.2 条：接触即食食品须佩戴手套"）

### 1.3 MVP 边界

- **固定规则先行**：MVP 阶段异常类型和判定规则人工预设，不开放用户自定义规则
- **单门店 Demo**：基于 MOMOYO JTU - WOLTER MONGINSIDI 门店素材
- **双入口**：方式 A（用户上传本地 mp4）+ 方式 B（预置 AI 视频自动循环）
- **双渠道告警**：SaaS Dashboard 为主（工作台），飞书 IM 为辅（感知 + 跳转，不派单）

---

## 二、系统架构

### 2.1 总体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户交互层                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ SaaS Dashboard│  │  视频上传页   │  │ 摄像头管理   │  │ 整改跟踪页       │ │
│  │  (主工作台)   │  │  (方式A入口)  │  │  (方式B入口) │  │  (闭环管理)      │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘ │
└─────────┼─────────────────┼─────────────────┼───────────────────┼───────────┘
          │                 │                 │                   │
          └─────────────────┴─────────────────┴───────────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │         抽帧服务               │
                    │    ffmpeg 1fps/5fps 抽帧       │
                    └───────────────┬───────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │      AI 视觉分析引擎           │
                    │   豆包 Doubao-seed-1-6-vision  │
                    │   (火山引擎 API)               │
                    └───────────────┬───────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
┌─────────▼─────────┐    ┌──────────▼──────────┐   ┌─────────▼─────────┐
│   事件存储         │    │    告警引擎          │   │   飞书机器人       │
│  (内存/本地 JSON)  │    │  严重度分级 + SLA    │   │  Interactive Card │
└───────────────────┘    │  去重 + 升级策略     │   │  推送 + 已读回调   │
                         └─────────────────────┘   └───────────────────┘
```

### 2.2 核心模块说明

| 模块 | 技术选型 | 说明 |
|-----|---------|------|
| 前端 | SaaS HTML (app_builder 部署) | 5-6 个核心页面，Mock 数据驱动 |
| 抽帧 | ffmpeg CLI | `ffmpeg -i input.mp4 -vf fps=1 -q:v 2 output_%04d.jpg` |
| AI 模型 | 豆包 Doubao-seed-1-6-vision | 火山引擎 API，支持图文理解 |
| 飞书推送 | lark-cli webhook | 机器人发送 Interactive Card |
| 数据存储 | 本地 JSON (MVP) | 事件记录、摄像头配置、整改状态 |

---

## 三、异常规则体系

### 3.1 六类异常定义

基于 MOMOYO 印尼门店前台/后厨场景，定义以下 6 大异常类型：

#### Type-A: 卫生规范 (Hygiene)

| 子项 | 判定标准 | 严重度 |
|-----|---------|--------|
| A1 未佩戴手套 | 员工手部直接接触食品/原料，未佩戴一次性手套 | **P0-严重** |
| A2 未佩戴发网/帽子 | 员工头发裸露，未佩戴工作帽或发网 | P1-一般 |
| A3 操作台脏乱 | 操作台面积水、污渍、原料残渣未清理 | P1-一般 |
| A4 地面不洁 | 地面有明显垃圾、液体泼洒 | P2-提示 |

#### Type-B: 安全隐患 (Safety)

| 子项 | 判定标准 | 严重度 |
|-----|---------|--------|
| B1 明火/燃气异常 | 后厨明火无人看管、燃气阀门异常 | **P0-严重** |
| B2 电器线路暴露 | 电线裸露、插座过载、电器进水 | **P0-严重** |
| B3 消防通道堵塞 | 通道被货物/设备堵塞，宽度 < 1.2m | P1-一般 |

#### Type-C: 合规着装 (Compliance)

| 子项 | 判定标准 | 严重度 |
|-----|---------|--------|
| C1 未穿工服 | 员工未穿着统一工作服/围裙 | P1-一般 |
| C2 健康证未公示 | 健康证公示栏缺失或过期 | P2-提示 |
| C3 个人饰品外露 | 佩戴手表、戒指、手链等饰品操作食品 | P1-一般 |

#### Type-D: 操作规范 (Operation)

| 子项 | 判定标准 | 严重度 |
|-----|---------|--------|
| D1 配方用量错误 | 原料用量明显偏离 SOP（如珍珠量过多/过少） | P1-一般 |
| D2 交叉污染 | 生熟混放、清洁用具与食品接触 | **P0-严重** |
| D3 原料过期使用 | 使用超过保质期的原料 | **P0-严重** |

#### Type-E: 设备状态 (Equipment)

| 子项 | 判定标准 | 严重度 |
|-----|---------|--------|
| E1 冰箱门未关 | 冷藏设备门长时间开启（>30s） | P1-一般 |
| E2 设备表面污渍 | 冰箱、制冰机、封口机表面有明显污垢 | P2-提示 |
| E3 设备异常指示灯 | 设备报警灯亮起未处理 | P1-一般 |

#### Type-F: 顾客体验 (Customer Experience)

| 子项 | 判定标准 | 严重度 |
|-----|---------|--------|
| F1 取餐区混乱 | 出品未按序摆放，顾客难以识别 | P2-提示 |
| F2 排队秩序差 | 无排队引导，顾客拥挤在操作台前 | P2-提示 |
| F3 餐具/吸管裸露 | 一次性餐具未加盖或裸露放置 | P1-一般 |

### 3.2 严重度分级

| 级别 | 定义 | 响应时效 | 告警渠道 |
|-----|------|---------|---------|
| **P0-严重** | 食品安全、人身安全隐患 | 5 分钟内 | SaaS Dashboard 置顶 + 飞书 IM 强告警 |
| **P1-一般** | 操作规范、合规问题 | 30 分钟内 | SaaS Dashboard 高亮 + 飞书 IM 标准告警 |
| **P2-提示** | 体验、清洁问题 | 2 小时内 | SaaS Dashboard 记录 |

---

## 四、AI 视觉判定规范

### 4.1 API 集成方案

**模型**: 豆包 Doubao-seed-1-6-vision (通过火山引擎 API 调用)

**调用方式**:
```
POST https://ark.cn-beijing.volces.com/api/v3/chat/completions
Authorization: Bearer {VOLC_ENGINE_API_KEY}
Content-Type: application/json
```

### 4.2 Prompt 模板

#### 系统 Prompt (System)

```
你是一名专业的连锁餐饮门店巡检专家，精通食品安全规范（HACCP）、门店 SOP 和印尼当地卫生法规。

你的任务是分析门店监控视频截图，识别是否存在以下六类异常：
- 卫生规范 (Hygiene): 手套、发网、操作台清洁
- 安全隐患 (Safety): 明火、电器、通道
- 合规着装 (Compliance): 工服、健康证、饰品
- 操作规范 (Operation): 配方、交叉污染、原料保质期
- 设备状态 (Equipment): 冰箱、清洁、指示灯
- 顾客体验 (Customer): 取餐区、排队、餐具

输出要求：
1. 必须用 JSON 格式输出
2. 每条判定必须附带：异常类型、置信度(0-100)、判定依据、建议措施
3. 置信度 >= 85 视为"确认异常"，60-84 为"疑似异常"，<60 为"正常"
4. 如果没有异常，输出 {"status": "normal", "details": []}
```

#### 用户 Prompt (User) — 单帧分析

```
请分析这张门店监控截图。该门店为 MOMOYO 印尼奶茶店，区域为 {front_counter|back_kitchen|storage|pickup_area}。

关注以下检查点：
{根据摄像头位置动态注入检查点列表}

请用 JSON 输出分析结果：
{
  "status": "anomaly_detected|suspected|normal",
  "frame_id": "{uuid}",
  "timestamp": "{iso8601}",
  "camera_id": "{camera_id}",
  "anomalies": [
    {
      "type": "A1|A2|...|F3",
      "category": "hygiene|safety|compliance|operation|equipment|customer",
      "severity": "P0|P1|P2",
      "confidence": 92,
      "description": "员工在制作饮品时未佩戴一次性手套",
      "evidence": "左手直接接触珍珠容器内壁",
      "rule_reference": "《食品操作规范》第3.2条：接触即食食品须佩戴手套",
      "suggestion": "立即佩戴一次性手套，已制作饮品建议废弃"
    }
  ]
}
```

### 4.3 输出格式规范

```typescript
interface AnomalyResult {
  status: "anomaly_detected" | "suspected" | "normal";
  frame_id: string;        // 抽帧 UUID
  timestamp: string;       // ISO 8601
  camera_id: string;       // 摄像头标识
  anomalies: Array<{
    type: string;           // 异常编码如 "A1"
    category: string;       // 大类英文
    severity: "P0" | "P1" | "P2";
    confidence: number;     // 0-100
    description: string;    // 中文描述
    evidence: string;       // 视觉证据描述
    rule_reference: string; // 规则依据
    suggestion: string;     // 整改建议
  }>;
}
```

### 4.4 错误处理策略

| 错误场景 | 处理策略 |
|---------|---------|
| API 超时 (>30s) | 标记为"分析失败"，自动重试 1 次，仍失败则人工介入 |
| API 返回非 JSON | 尝试正则提取，失败则记录原始响应供人工核查 |
| 置信度全部 < 60 | 输出"正常"，但保留低置信度记录供人工抽检 |
| 网络中断 | 本地缓存抽帧，网络恢复后批量补分析 |
| 限流 (429) | 指数退避重试：1s → 2s → 4s → 8s |

---

## 五、告警链路设计

### 5.1 告警流程

```
视频输入 → 抽帧 → AI 分析 → 结果解析 → 严重度分级 → 去重判断 → 事件入库
                                                            ↓
                              ┌─────────────────────────────┼─────────────────────────────┐
                              ↓                             ↓                             ↓
                        P0-严重                         P1-一般                        P2-提示
                              ↓                             ↓                             ↓
                    SaaS Dashboard 置顶               SaaS Dashboard 高亮            SaaS Dashboard 记录
                    飞书 IM 强告警卡片                飞书 IM 标准卡片                (不推 IM)
                    (红色主题 + 声音)                 (橙色主题)
                              ↓                             ↓
                    5min 未处理 → SLA 升级              30min 未处理 → 记录
                    推送升级卡片给管理员
```

### 5.2 去重策略

- **时间窗口去重**：同一摄像头、同一异常类型，30 分钟内不重复告警
- **空间去重**：同一帧中多个同类异常合并为一条（如"3 名员工未戴手套"合并为 1 条）
- **置信度去重**：新告警置信度 < 已存在告警的 80%，视为重复

### 5.3 SLA 升级机制

| 阶段 | 触发条件 | 动作 |
|-----|---------|------|
| T0 | 检测到 P0 异常 | 立即推送飞书卡片 |
| T+5min | P0 未标记"已处理" | 推送 SLA 升级卡片，@管理员 |
| T+15min | P0 仍未处理 | 卡片变红 + 震动提醒 |
| T+30min | P0 仍未处理 | 记录为"超时未处理"，入整改跟踪 |

---

## 六、Mock 策略与视频素材规划

### 6.1 为什么需要 AI 生成视频

用户当前仅有 1 张 EZVIZ 萤石云截图（MOMOYO JTU 门店前台 PICK UP/ORDER 区域），不足以覆盖 6 类异常的演示场景。需要 AI 生成补充素材。

### 6.2 8 段视频规划

| 编号 | 场景 | 类型 | 时长 | 内容描述 | 生成 Prompt 模板 |
|-----|------|------|------|---------|-----------------|
| V01 | 前台标准操作 | 正常 | 10s | 员工规范穿戴，标准制作黑糖珍珠奶茶 | 见下方 |
| V02 | 卫生异常-手套 | 异常 | 10s | 员工未戴手套直接接触原料 | 见下方 |
| V03 | 安全异常-明火 | 异常 | 10s | 后厨明火无人看管，旁边有易燃物 | 见下方 |
| V04 | 合规异常-工服 | 异常 | 10s | 员工穿着便服操作，未穿围裙 | 见下方 |
| V05 | 操作异常-配方 | 异常 | 10s | 员工用量杯随意添加糖浆，明显过量 | 见下方 |
| V06 | 设备异常-冰箱 | 异常 | 10s | 冷藏柜门敞开，内部原料暴露 | 见下方 |
| V07 | 体验异常-取餐区 | 异常 | 10s | 取餐台饮品杂乱摆放，无取餐号牌 | 见下方 |
| V08 | 复合异常 | 异常 | 15s | 同时出现未戴手套 + 操作台脏乱 + 便服 | 见下方 |

### 6.3 视频生成 Prompt 模板

#### V01: 正常操作
```
A realistic CCTV-style security camera footage of a bubble tea shop front counter. 
A staff member wearing a clean white uniform, hairnet, and disposable gloves is 
preparing a brown sugar boba milk tea following standard procedure. The counter 
is clean and organized. The shop has warm lighting, modern MOMOYO branding visible. 
Indonesian urban setting. 24fps, slightly grainy security camera aesthetic, 
fixed overhead angle, 1080p.
```

#### V02: 卫生异常-未戴手套
```
A realistic CCTV-style security camera footage of a bubble tea shop front counter. 
A staff member is scooping boba pearls with bare hands directly into a cup. 
No gloves are worn. The counter appears reasonably clean otherwise. 
Same MOMOYO shop setting, warm lighting, fixed overhead angle. 
The action is clearly visible and the hand-to-food contact is obvious. 24fps, 1080p.
```

#### V03: 安全异常-明火
```
A realistic CCTV-style security camera footage of a bubble tea shop back kitchen. 
A gas burner with visible flame is left unattended on the stove. Next to it, 
paper packaging materials are placed too close. No staff member is in the frame. 
The scene shows a clear fire hazard. Dim kitchen lighting, fixed wall-mounted 
camera angle. 24fps, 1080p.
```

#### V04: 合规异常-未穿工服
```
A realistic CCTV-style security camera footage of a bubble tea shop front counter. 
A staff member wearing casual clothes (t-shirt and jeans) is preparing drinks 
without an apron or uniform. No hairnet or gloves. The shop interior and MOMOYO 
branding are visible. Fixed overhead camera angle, warm lighting. 24fps, 1080p.
```

#### V05: 操作异常-配方
```
A realistic CCTV-style security camera footage of a bubble tea shop front counter. 
A staff member is pouring syrup from a bottle without using a measuring cup, 
clearly adding excessive amount. The drink cup is already half-filled with syrup. 
Standard MOMOYO shop setting, fixed overhead angle. 24fps, 1080p.
```

#### V06: 设备异常-冰箱
```
A realistic CCTV-style security camera footage of a bubble tea shop storage area. 
A commercial refrigerator door is left wide open. Inside, milk cartons and fruit 
containers are visible and exposed to room temperature. Condensation is visible. 
No staff nearby. Fixed wall-mounted camera angle, fluorescent lighting. 24fps, 1080p.
```

#### V07: 体验异常-取餐区
```
A realistic CCTV-style security camera footage of a bubble tea shop pickup counter. 
Multiple finished drinks are randomly placed on the counter without order numbers. 
Customers are crowding around trying to find their orders. The area looks messy 
with spilled liquid and straw wrappers. MOMOYO branding visible. Fixed camera angle. 
24fps, 1080p.
```

#### V08: 复合异常
```
A realistic CCTV-style security camera footage of a bubble tea shop front counter. 
Multiple violations visible simultaneously: (1) staff member in casual clothes 
without gloves handling food, (2) the counter surface has spilled milk and boba 
pearls scattered around, (3) a used cleaning cloth is left on the food preparation 
area. MOMOYO shop setting, fixed overhead angle, warm lighting. 24fps, 1080p.
```

### 6.4 Mock 数据策略 (原型阶段)

由于原型阶段不接入真实 AI API，使用以下 Mock 数据策略：

1. **预置分析结果**：为 8 段视频预生成完整的 JSON 分析结果
2. **随机抖动**：置信度 ±5% 浮动，模拟真实 AI 的不确定性
3. **时间轴模拟**：上传/选择视频后，按 1fps 逐帧"播放"分析结果
4. **异常高亮**：在视频时间轴上标记异常发生的时间点

---

## 七、SaaS 原型页面规划

### 7.1 页面清单 (5-6 个核心页面)

| 页面 | 功能 | 优先级 |
|-----|------|--------|
| **Dashboard** | 摄像头网格、实时状态、异常统计、最近事件 | P0 |
| **Event Detail** | 视频播放、AI 分析结果、合规依据、处置按钮 | P0 |
| **Upload** | 本地视频上传、摄像头选择、开始分析 | P0 |
| **Camera List** | 摄像头管理、在线状态、位置信息 | P1 |
| **Rectification** | 整改跟踪列表、状态筛选、SLA 时间线 | P1 |
| **Card Preview** | 飞书卡片 JSON 示例、预览、复制 | P2 |

### 7.2 关键交互设计

#### Dashboard 主看板

```
┌─────────────────────────────────────────────────────────────┐
│  门店视觉巡检 Dashboard        [MOMOYO JTU 店]    [设置]     │
├─────────────────────────────────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐              │
│  │ 摄像头1 │ │ 摄像头2 │ │ 摄像头3 │ │ 摄像头4 │  [+添加]    │
│  │ [在线]  │ │ [在线]  │ │ [离线]  │ │ [在线]  │             │
│  │ [画面]  │ │ [画面]  │ │ [画面]  │ │ [画面]  │             │
│  └────────┘ └────────┘ └────────┘ └────────┘              │
├─────────────────────────────────────────────────────────────┤
│  今日异常: 3  |  P0: 1  |  P1: 1  |  P2: 1                 │
├─────────────────────────────────────────────────────────────┤
│  最近事件                          [查看全部 →]              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [P0] 09:23 前台摄像头 - 员工未佩戴手套 (置信度 92%)   │   │
│  │ [P1] 08:45 后厨摄像头 - 冰箱门未关闭 (置信度 87%)     │   │
│  │ [P2] 08:12 取餐区摄像头 - 取餐台杂乱 (置信度 76%)     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### Event Detail 事件详情

```
┌─────────────────────────────────────────────────────────────┐
│  [← 返回] 事件详情                              #EVT-0927-001│
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────┐  ┌─────────────────────────┐ │
│  │                          │  │ 异常类型: A1 未佩戴手套   │ │
│  │    [视频播放器]           │  │ 严重度: P0-严重           │ │
│  │    09:23:15 - 09:23:25   │  │ 置信度: 92%              │ │
│  │    [▶] [时间轴===⚠️====]  │  │ 摄像头: 前台-01           │ │
│  │                          │  │ 时间: 2026-09-27 09:23    │ │
│  └──────────────────────────┘  │                         │ │
│                                │ AI 判定依据:              │ │
│                                │ "左手直接接触珍珠容器     │ │
│                                │ 内壁，未佩戴一次性手套"   │ │
│                                │                         │ │
│                                │ 规则引用:                 │ │
│                                │ 《食品操作规范》第3.2条   │ │
│                                │                         │ │
│                                │ 整改建议:                 │ │
│                                │ 立即佩戴手套，已制作饮品  │ │
│                                │ 建议废弃                  │ │
│                                │                         │ │
│                                │ [标记已处理] [转派整改]   │ │
│  └──────────────────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 八、飞书 IM 卡片设计

### 8.1 卡片类型

#### 类型 1: 严重事件告警 (P0)

- **主题色**: 红色 (#F54A45)
- **组件**: 标题栏 + 异常截图 + 关键信息 + 深链按钮 + 已读按钮
- **动作**: 点击"查看详情"跳转 SaaS 事件页，点击"已读"回调标记

#### 类型 2: 标准事件告警 (P1)

- **主题色**: 橙色 (#FF9F00)
- **组件**: 标题栏 + 关键信息 + 深链按钮
- **动作**: 点击跳转 SaaS 详情页

#### 类型 3: SLA 升级提醒

- **主题色**: 深红色 (#D1352B)
- **组件**: 标题栏 + 超时警告 + 原事件摘要 + 升级说明
- **动作**: 强提醒管理员介入

### 8.2 深链 URL 设计

```
SaaS Dashboard 入口: https://{app_builder_domain}/dashboard
事件详情页: https://{app_builder_domain}/event/{event_id}
整改跟踪页: https://{app_builder_domain}/rectification

飞书卡片按钮跳转:
- "查看详情" → {saaS_url}/event/{event_id}
- "前往整改" → {saaS_url}/rectification?focus={event_id}
```

### 8.3 已读回调机制

```
1. 卡片中包含 "已确认" 按钮 (interactive_container)
2. 用户点击后，飞书发送 callback 到 webhook URL
3. 后端接收 callback，更新事件状态为 "已确认"
4. 同时更新卡片状态（按钮变为"已确认 ✓"）
```

---

## 九、部署方案

### 9.1 MVP 部署架构

```
阶段 1 (原型): 
  - SaaS 前端: app_builder 部署 (纯前端，Mock 数据)
  - 数据: 本地 JSON 文件
  - AI: 预置 Mock 结果
  - 飞书: 卡片 JSON 模板 (不实际推送)

阶段 2 (实现):
  - 后端: FastAPI (抽帧 + AI 调用 + 事件管理)
  - AI: 真实豆包 Vision API
  - 存储: 本地文件系统 / 轻量数据库
  - 飞书: 真实机器人 webhook 推送
```

### 9.2 环境变量

```bash
VOLC_ENGINE_API_KEY=      # 火山引擎 API Key
VOLC_ENGINE_ENDPOINT=     # 豆包 Vision API 端点
LARK_WEBHOOK_URL=         # 飞书机器人 Webhook
LARK_APP_ID=              # 飞书应用 ID
LARK_APP_SECRET=          # 飞书应用 Secret
```

---

## 十、后续演进路线

### 10.1 Phase 1: MVP Demo (当前)
- [x] 设计文档
- [x] SaaS 原型 (5-6 页面)
- [x] 飞书卡片 JSON 模板
- [ ] 8 段 AI 视频素材生成
- [ ] 接入真实豆包 Vision API
- [ ] 飞书机器人推送对接

### 10.2 Phase 2: 单门店闭环
- [ ] 真实摄像头 RTSP 流接入
- [ ] 实时抽帧 + 分析 Pipeline
- [ ] 整改闭环跟踪
- [ ] 数据报表与趋势分析

### 10.3 Phase 3: 多门店扩展
- [ ] 多门店摄像头管理
- [ ] 总部视角 Dashboard
- [ ] 异常趋势分析 + AI 归因
- [ ] 与"加盟商运营诊断"数据打通

### 10.4 Phase 4: 智能化升级
- [ ] 用户自定义规则 (自然语言配置)
- [ ] 异常预测 (时序分析)
- [ ] 自动整改建议生成
- [ ] 与供应链/订货系统联动

---

## 附录 A: 异常编码速查表

| 编码 | 名称 | 严重度 | 类别 |
|-----|------|--------|------|
| A1 | 未佩戴手套 | P0 | 卫生 |
| A2 | 未佩戴发网/帽子 | P1 | 卫生 |
| A3 | 操作台脏乱 | P1 | 卫生 |
| A4 | 地面不洁 | P2 | 卫生 |
| B1 | 明火/燃气异常 | P0 | 安全 |
| B2 | 电器线路暴露 | P0 | 安全 |
| B3 | 消防通道堵塞 | P1 | 安全 |
| C1 | 未穿工服 | P1 | 合规 |
| C2 | 健康证未公示 | P2 | 合规 |
| C3 | 个人饰品外露 | P1 | 合规 |
| D1 | 配方用量错误 | P1 | 操作 |
| D2 | 交叉污染 | P0 | 操作 |
| D3 | 原料过期使用 | P0 | 操作 |
| E1 | 冰箱门未关 | P1 | 设备 |
| E2 | 设备表面污渍 | P2 | 设备 |
| E3 | 设备异常指示灯 | P1 | 设备 |
| F1 | 取餐区混乱 | P2 | 体验 |
| F2 | 排队秩序差 | P2 | 体验 |
| F3 | 餐具/吸管裸露 | P1 | 体验 |

## 附录 B: 技术依赖清单

| 依赖 | 版本 | 用途 |
|-----|------|------|
| ffmpeg | 任意 | 视频抽帧 |
| FastAPI | 0.100+ | 后端 API (Phase 2) |
| httpx | 0.24+ | HTTP 客户端 |
| lark-cli | 最新 | 飞书操作 |
| 豆包 Vision | seed-1-6 | AI 视觉分析 |
