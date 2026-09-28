# A2/C1 · 着装类检测 · 能力设计

> 规则编码：A2（未戴工帽/发网）+ C1（未穿围裙/工服）
> 优先级：P1 | 类别：合规 | 合并策略：统一为「着装规范」能力
> 对应 MVP §4.1 正式规则

---

## 1. 能力类型

| 维度 | 定义 |
|------|------|
| **检测类型** | 检测型 + 分类型 |
| **输入** | 视频片段（8-10s，固定机位监控画面） |
| **输出** | 着装状态列表（`hat_missing` / `hairnet_missing` / `apron_missing` / `uniform_missing` / `apron_incomplete` / `compliant`）+ 置信度 + 人员 bbox |
| **核心能力** | 在人员多姿态/遮挡/相似服饰干扰下，准确识别后厨员工着装规范性 |

### 1.1 检测目标细分

| 子类型 | 定义 | 视觉特征 |
|--------|------|----------|
| `hat_missing` | 完全未戴工帽 | 头部无帽子/发网，头发可见 |
| `hairnet_missing` | 未戴发网（女性长发） | 长发未完全收束，无发网包裹 |
| `apron_missing` | 完全未穿围裙 | 躯干无围裙覆盖 |
| `uniform_missing` | 未穿工服 | 上身穿着非工服（颜色/款式/logo 不符） |
| `apron_incomplete` | 围裙穿戴不规范 | 围裙部分系戴（如只系颈带未系腰带） |
| `compliant` | 完全规范 | 所有着装要素完整且正确 |

---

## 2. 确认策略

### 2.1 分层确认架构

```
前置步骤：人物检测 + 身份判定（员工 vs 顾客）
  └── 仅后厨/操作区人员进入后续检测
        └── 顾客、大厅区域人员直接排除

Layer 1（整段视频）
  └── 豆包 Vision 初判：输出着装状态 + confidence
        ├── confidence ≥ 0.90 且任一 missing
        │     └── 直接触发后端规则
        ├── confidence 0.60-0.90
        │     └── 进入 Layer 2 局部复核
        └── confidence < 0.60
              └── 标记为 uncertain，不入告警

Layer 2（局部复核）
  └── 抽帧 → 裁剪人物上半身 → 二次 Vision 判定
        ├── 二次 confidence ≥ 0.85
        │     └── 确认触发
        └── 二次 confidence < 0.85
              └── 标记为不可判定

后端确定性规则
  └── 硬编码兜底
        ├── hat_missing / apron_missing / uniform_missing：持续 ≥ 5s → Major
        ├── hairnet_missing / apron_incomplete：持续 ≥ 10s → Minor
        └── 单帧瞬时缺失不触发（如转头时帽子被遮挡）
```

### 2.2 多帧聚合策略

- **瞬时遮挡豁免**：单帧判定 missing 但相邻帧 compliant → 不触发（处理转头/侧身遮挡）
- **持续缺失判定**：连续 ≥ 5s（150 帧）判定为同一 missing 类型 → 触发告警
- **多人员处理**：画面中有多人时，逐人独立判定，各自生成 evidence 记录

---

## 3. 严重度分级

| 严重度 | 条件 | 响应动作 | 通知渠道 |
|--------|------|----------|----------|
| **Major** | 工帽/围裙/工服 完全缺失，持续 ≥ 5s | 告警 + 推 SaaS Dashboard + 飞书 IM | IM + SaaS |
| **Minor** | 发网缺失 / 围裙穿戴不规范，持续 ≥ 10s | 仅推 SaaS Dashboard | SaaS |
| **Info** | 疑似但 confidence < 0.60 | 仅入 evidence.json | 无 |

---

## 4. 边界 Case（≥3 个）

### Case 1：相似服饰混淆

- **场景**：员工穿深蓝色 polo 衫（颜色接近工服但无 logo），戴黑色棒球帽（颜色接近工帽但款式不同）
- **风险**：误报为 compliant 或漏报为 missing
- **处理**：
  - Layer 1 Prompt 增加细节要求："检查是否有工服 logo/工牌，帽子是否为标准工帽款式"
  - Layer 2 放大上半身，二次确认 logo 和帽子款式
  - 后端：如 Layer 2 仍无法确认，默认标记为 `uniform_missing`（偏严格）

### Case 2：部分身体遮挡

- **场景**：员工站在物料架后方，上半身部分可见，围裙被遮挡无法确认
- **风险**：误报 apron_missing（实际被遮挡而非未穿）
- **处理**：
  - 人物检测输出可见比例（visibility_ratio）
  - visibility_ratio < 0.7 时，被遮挡的着装要素标记为 `uncertain` 而非 `missing`
  - 仅当 visibility_ratio ≥ 0.7 且判定 missing 时才触发告警

### Case 3：远距离/小像素人员

- **场景**：广角画面中 4-5 米深处的员工，头部和上身细节模糊（约 30×50 像素）
- **风险**：无法准确判断着装状态
- **处理**：
  - 人物检测过滤：像素面积 < 2000px² 的人员不进入着装检测
  - 或标记为 `uncertain`，不触发告警但记录入 evidence.json

---

## 5. 与双层判定架构的对接

### 5.1 Layer 1（整段视频 URL → AI 初判）

| 字段 | 说明 |
|------|------|
| 输入 | 视频 URL（8-10s mp4） |
| 触发条件 | 所有样本过 Layer 1 |
| Prompt 指令 | "分析这段后厨监控视频，识别所有后厨员工的着装规范性。对每个人员输出：1) 工帽/发网状态（佩戴/缺失/不规范）；2) 围裙状态（佩戴/缺失/不规范）；3) 工服状态（合规/缺失）；4) 置信度 0-1；5) 人员位置描述" |
| 输出格式 | JSON 数组：`[{"person_id": 1, "hat_status": "missing", "apron_status": "compliant", "uniform_status": "compliant", "confidence": 0.88, "location": "操作台左侧"}]` |

### 5.2 Layer 2（局部复核）

| 字段 | 说明 |
|------|------|
| 触发条件 | confidence 0.60-0.90；或检测到「不规范/部分遮挡」 |
| 裁剪策略 | 以人物上半身中心裁剪 500×600 区域 |
| 二次 Prompt | "放大观察这个人的上半身着装细节。重点检查：1) 头部是否有标准工帽/发网（不是棒球帽/厨师帽）；2) 躯干是否有围裙（颈带和腰带是否都系好）；3) 上衣是否有工服 logo/标识。输出：1) 各要素状态；2) 置信度；3) 判别依据" |
| 输出格式 | JSON：`{"hat": {"status": "missing", "confidence": 0.87, "reason": "头部无帽子，头发可见"}, "apron": {"status": "compliant", "confidence": 0.92}}` |

### 5.3 后端确定性规则

```python
def a2c1_backend_rule(layer1_results, layer2_results=None):
    """
    A2/C1 后端确定性规则
    """
    alerts = []
    for person in layer1_results:
        # 瞬时遮挡豁免：单帧不触发
        # 实际实现需跨帧追踪，这里简化为Layer结果已含持续时间

        for check_type in ['hat', 'apron', 'uniform']:
            status = person.get(f'{check_type}_status')
            conf = person.get('confidence', 0)
            duration = person.get('duration_sec', 0)

            if status in ['missing', 'hairnet_missing', 'uniform_missing']:
                if conf >= 0.85 and duration >= 5:
                    alerts.append({
                        'person_id': person['person_id'],
                        'type': check_type,
                        'status': status,
                        'severity': 'major',
                        'duration_sec': duration
                    })
            elif status in ['apron_incomplete']:
                if conf >= 0.80 and duration >= 10:
                    alerts.append({
                        'person_id': person['person_id'],
                        'type': check_type,
                        'status': status,
                        'severity': 'minor',
                        'duration_sec': duration
                    })
    return alerts
```

---

## 6. Golden Set 规模建议

| 类型 | 数量 | 说明 |
|------|------|------|
| 正样本（hat_missing） | ≥ 8 段 | 不同发型/性别/角度 |
| 正样本（apron_missing） | ≥ 8 段 | 不同上身服装/角度 |
| 正样本（uniform_missing） | ≥ 5 段 | 不同便装类型 |
| 正样本（mixed） | ≥ 4 段 | 多项同时缺失 |
| 负样本（fully_compliant） | ≥ 15 段 | 不同人员/角度/服装颜色 |
| 负样本（customers） | ≥ 5 段 | 顾客在大厅/后厨附近 |
| 边界样本 | ≥ 10 段 | 相似服饰、部分遮挡、不规范穿戴、远距离模糊 |
| **合计** | **≥ 60 段** | |

---

## 7. 与 E1 的对照

| 维度 | E1（已实现） | A2/C1（本规则） |
|------|-------------|----------------|
| 检测目标 | [E1] | 工帽/发网 + 围裙/工服 |
| 最大难点 | [E1] | 多姿态/遮挡/相似服饰；顾客 vs 员工身份 |
| 确认策略 | [E1] | 人物检测前置 + 上半身聚焦 + 多帧聚合（瞬时遮挡豁免） |
| 严重度 | [E1] | Major（完全缺失）/ Minor（不规范） |
| 延迟要求 | [E1] | ≤ 10s（P1） |
| 特殊处理 | [E1] | 需人物检测 + 可见比例过滤 + 身份判定 |
| Golden Set | [E1] | ≥ 60 |
