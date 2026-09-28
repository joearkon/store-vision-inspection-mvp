# A3/A4 · 环境类检测 · 能力设计

> 规则编码：A3（操作台脏乱）+ A4（地面垃圾）
> 优先级：P1 | 类别：卫生 | 合并策略：统一为「环境卫生」能力
> 对应 MVP §4.1 正式规则

---

## 1. 能力类型

| 维度 | 定义 |
|------|------|
| **检测类型** | 检测型 + 时序型 |
| **输入** | 视频片段（8-10s，固定机位监控画面） |
| **输出** | 环境状态（`counter_messy` / `floor_litter` / `clean`）+ 置信度 + 脏区 bbox + 面积估算 |
| **核心能力** | 在光影干扰和正常运营干扰下，识别「持续脏乱」状态并排除瞬时凌乱 |

### 1.1 检测目标细分

| 子类型 | 定义 | 视觉特征 |
|--------|------|----------|
| `counter_messy` | 操作台脏乱 | 液体溢出、残渣堆积、器具未归位、污渍 |
| `floor_litter` | 地面垃圾 | 纸杯、纸巾、包装纸、食物碎屑、液体污渍 |
| `clean` | 整洁 | 台面光洁、地面干净、器具归位 |

---

## 2. 确认策略

### 2.1 分层确认架构

```
Layer 1（整段视频）
  └── 豆包 Vision 初判：输出环境状态 + confidence + 脏区位置
        ├── confidence ≥ 0.90 且状态 = messy/litter
        │     └── 进入 Layer 2（环境类高置信度也需二次确认面积/持续时间）
        ├── confidence 0.60-0.90
        │     └── 进入 Layer 2 局部复核
        └── confidence < 0.60
              └── 标记为 clean/uncertain

Layer 2（局部复核）
  └── 抽帧 → 放大脏区 → 二次 Vision 判定
        ├── 二次确认污渍真实（非光影）+ 面积估算
        │     └── 进入后端规则
        └── 判断为光影/正常物料/瞬时凌乱
              └── 不触发

后端确定性规则（关键差异：时间基线）
  └── 硬编码兜底 + 时间累积逻辑
        ├── 单次检测 messy/litter：记录但不告警（入时间基线）
        ├── 同一区域连续 3 次检测（间隔 ≥ 60s）均 messy/litter：触发 Minor
        ├── 同一区域持续 ≥ 300s 均 messy/litter：升级 Major
        └── 清洁动作检测（拖把/抹布在场）：重置时间基线
```

### 2.2 时间基线策略（环境类核心差异）

环境类规则与即时事件类（B1）的最大差异：**单次画面脏 ≠ 违规**。

- **时间基线记录**：每个检测区域维护一个「脏乱累计时长」计数器
- **刷新机制**：检测到清洁动作或画面变干净 → 计数器归零
- **触发阈值**：
  - Minor：累计 ≥ 60s（约 1 分钟未清理）
  - Major：累计 ≥ 300s（约 5 分钟未清理）
- **采样间隔**：每 60s 采样一次（降低 API 调用量）

---

## 3. 严重度分级

| 严重度 | 条件 | 响应动作 | 通知渠道 |
|--------|------|----------|----------|
| **Major** | 显性脏乱持续 ≥ 300s（顾客可见区域） | 告警 + 推 SaaS Dashboard + 飞书 IM | IM + SaaS |
| **Minor** | 脏乱持续 ≥ 60s；或隐蔽区域脏乱 | 仅推 SaaS Dashboard | SaaS |
| **Info** | 单次检测脏乱但未满 60s | 记录时间基线，不入告警 | 无 |

---

## 4. 边界 Case（≥3 个）

### Case 1：光影造成的「假污渍」

- **场景**：射灯阴影、窗外树影、反光在台面形成深色区域
- **风险**：误报为 counter_messy
- **处理**：
  - Layer 2 增加时序分析：光影会随时间轻微移动（如树影随风摆动），污渍静止
  - 后端：连续 3 帧（间隔 2s）脏区位置完全一致 → 可能是真污渍；位置有偏移 → 可能是光影

### Case 2：正常制作过程中的「有序忙碌」

- **场景**：员工制作复杂饮品，操作台上有多个小料碗、量杯暂时摆放
- **风险**：误报为 counter_messy
- **处理**：
  - Layer 1 Prompt 增加语义要求："判断台面上的物品是有序摆放的制作物料，还是无序堆积的垃圾/残渣"
  - 后端：检测到人员在场且 actively 操作 → 不累积时间基线（给予清洁宽限期）

### Case 3：清洁过程中（拖把/抹布/清洁剂在场）

- **场景**：员工正在拖地，地面有水渍和泡沫；或正在擦拭台面，台面上有清洁剂和抹布
- **风险**：误报为 messy
- **处理**：
  - Layer 1 检测清洁工具（拖把/抹布/水桶）和清洁动作
  - 检测到清洁中 → 直接标记为 `cleaning_in_progress`，重置时间基线
  - 清洁结束后重新开始计时

---

## 5. 与双层判定架构的对接

### 5.1 Layer 1（整段视频 URL → AI 初判）

| 字段 | 说明 |
|------|------|
| 输入 | 视频 URL（8-10s mp4） |
| 触发条件 | 所有样本过 Layer 1 |
| Prompt 指令 | "分析这段监控视频中的环境卫生状况。对操作台和地面分别评估：1) 是否有液体溢出、残渣、垃圾、污渍；2) 物品是有序摆放还是无序堆积；3) 是否有人正在清洁。输出：操作台状态（clean/messy/uncleaning）、地面状态（clean/litter/uncleaning）、置信度、脏区位置描述、是否有清洁动作" |
| 输出格式 | JSON：`{"counter": {"status": "messy", "confidence": 0.85, "area_desc": "操作台右侧有液体溢出和纸巾"}, "floor": {"status": "clean", "confidence": 0.92}, "cleaning_detected": false}` |

### 5.2 Layer 2（局部复核）

| 字段 | 说明 |
|------|------|
| 触发条件 | confidence 0.60-0.90；或检测到疑似光影/正常物料 |
| 裁剪策略 | 以脏区中心裁剪 600×600 区域 |
| 二次 Prompt | "放大观察这个区域，判断是否为真实的污渍/垃圾。注意区分：1) 光影造成的深色区域（会随时间移动）；2) 正常物料/器具（有固定功能）；3) 真正的污渍/垃圾。输出：确认结果（real_stain/fake_shadow/normal_item/uncertain）、置信度、面积估算（小/中/大）" |
| 输出格式 | JSON：`{"result": "real_stain", "confidence": 0.87, "area": "medium", "reason": "颜色偏黄褐色，边缘渗入缝隙，不随时间移动"}` |

### 5.3 后端确定性规则

```python
class EnvironmentalMonitor:
    """A3/A4 环境监控时间基线"""
    def __init__(self):
        self.baselines = {}  # region_id -> {counter_sec, floor_sec, last_clean_time}

    def update(self, region_id, layer_result, timestamp):
        """每次 Layer 1/2 结果更新时调用"""
        if region_id not in self.baselines:
            self.baselines[region_id] = {'counter_sec': 0, 'floor_sec': 0}

        baseline = self.baselines[region_id]

        # 清洁动作检测：重置时间基线
        if layer_result.get('cleaning_detected'):
            baseline['counter_sec'] = 0
            baseline['floor_sec'] = 0
            baseline['last_clean_time'] = timestamp
            return []

        alerts = []
        for area in ['counter', 'floor']:
            status = layer_result.get(area, {}).get('status')
            if status in ['messy', 'litter']:
                baseline[f'{area}_sec'] += 60  # 采样间隔 60s
                if baseline[f'{area}_sec'] >= 300:
                    alerts.append({
                        'region': region_id,
                        'area': area,
                        'severity': 'major',
                        'duration_sec': baseline[f'{area}_sec']
                    })
                elif baseline[f'{area}_sec'] >= 60:
                    alerts.append({
                        'region': region_id,
                        'area': area,
                        'severity': 'minor',
                        'duration_sec': baseline[f'{area}_sec']
                    })
            else:
                baseline[f'{area}_sec'] = 0  # 画面变干净，重置

        return alerts
```

---

## 6. Golden Set 规模建议

| 类型 | 数量 | 说明 |
|------|------|------|
| 正样本（counter_messy） | ≥ 12 段 | 液体溢出、残渣堆积、器具混乱、长期污渍 |
| 正样本（floor_litter） | ≥ 13 段 | 纸杯、纸巾、食物碎屑、液体污渍、垃圾桶满溢 |
| 负样本（fully_clean） | ≥ 15 段 | 标准 SOP 操作后的整洁状态 |
| 负样本（making_in_progress） | ≥ 5 段 | 制作过程中的有序忙碌 |
| 负样本（cleaning） | ≥ 5 段 | 清洁进行中（拖把/抹布/水渍） |
| 边界样本 | ≥ 10 段 | 光影假污渍、微小瑕疵、临界脏乱、物料 vs 垃圾混淆 |
| **合计** | **≥ 60 段** | |

---

## 7. 与 E1 的对照

| 维度 | E1（已实现） | A3/A4（本规则） |
|------|-------------|----------------|
| 检测目标 | [E1] | 操作台脏乱 + 地面垃圾 |
| 最大难点 | [E1] | 污渍定义主观；光影干扰；需时间基线；正常物料 vs 垃圾 |
| 确认策略 | [E1] | 多帧聚合 + 面积阈值 + **时间累积（核心差异）** + 清洁动作检测 |
| 严重度 | [E1] | Major（显性持续脏乱）/ Minor（隐蔽/初发） |
| 延迟要求 | [E1] | ≤ 10s（P1），但后端规则需 ≥ 60s 持续才触发 |
| 特殊处理 | [E1] | **时间基线机制** + 清洁动作重置 + 采样间隔 60s |
| Golden Set | [E1] | ≥ 60 |
