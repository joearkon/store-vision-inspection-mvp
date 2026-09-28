# Golden Set 通用标注规范

> 适用于门店视觉巡检 MVP 全部规则（B1/A2/C1/A3/A4/G1/A1/F1/F2/E1）
> 版本：v1 | 日期：2026-09-28

---

## 1. 核心指标定义

### 1.1 准确率（Accuracy）

```
Accuracy = (TP + TN) / (TP + TN + FP + FN)
```

- **TP（True Positive）**：规则应触发，模型正确触发
- **TN（True Negative）**：规则不应触发，模型正确不触发
- **FP（False Positive / 误报）**：规则不应触发，模型错误触发
- **FN（False Miss / 漏报）**：规则应触发，模型未触发

### 1.2 漏报率（Miss Rate / FN Rate）

```
Miss Rate = FN / (TP + FN)
```

> **安全类规则（B1 烟雾/明火）漏报率目标：< 0.1%**
> **着装/环境类规则（A2/C1/A3/A4）漏报率目标：< 2%**
> **实验规则（G1/A1/F1/F2）漏报率目标：< 5%**

### 1.3 误报率（False Alarm Rate / FP Rate）

```
FP Rate = FP / (FP + TN)
```

> **安全类规则误报率目标：< 5%**
> **着装/环境类规则误报率目标：< 10%**
> **实验规则误报率目标：< 15%**

### 1.4 检测延迟（Detection Latency）

从事件真实发生到系统发出告警的时间间隔。

| 规则类型 | 目标延迟 | 最大容忍延迟 |
|----------|----------|-------------|
| P0 安全类（B1） | ≤ 3 秒 | ≤ 5 秒 |
| P1 合规类（A2/C1/A3/A4） | ≤ 10 秒 | ≤ 30 秒 |
| P2 实验类（G1/A1/F1/F2） | ≤ 30 秒 | ≤ 60 秒 |

> 检测延迟 = 视频片段结束时间 - 事件首次可见帧时间戳 + 模型推理耗时 + 后端规则校验耗时

---

## 2. 标注 Schema

### 2.1 文件命名规范

```
{rule-id}_{sample-type}_{index}_{variant}.mp4
```

| 字段 | 取值 | 示例 |
|------|------|------|
| `rule-id` | 规则编码 | `B1`, `A2-C1`, `A3-A4`, `G1` |
| `sample-type` | `pos` / `neg` / `edge` | `pos`=正样本, `neg`=负样本, `edge`=边界 |
| `index` | 三位序号 | `001`, `002` |
| `variant` | 变体标记（可选） | `day`, `night`, `crowded`, `empty` |

**示例：**
- `B1_pos_001_day.mp4` — B1 规则白天正样本
- `A2-C1_neg_003_crowded.mp4` — A2/C1 规则拥挤场景负样本
- `G1_edge_002_night.mp4` — G1 规则夜间边界样本

### 2.2 标注文件格式（JSON）

每个视频样本对应一个同名的 `.json` 标注文件。

```json
{
  "sample_id": "B1_pos_001_day",
  "rule_id": "B1",
  "rule_name": "烟雾/明火检测",
  "sample_type": "positive",
  "variant": "day",
  "video": {
    "duration_sec": 10.0,
    "resolution": "1080x1920",
    "fps": 30,
    "source": "豆包视频生成"
  },
  "annotations": [
    {
      "event_id": "evt_001",
      "event_type": "smoke",
      "start_frame": 45,
      "end_frame": 180,
      "start_time_sec": 1.5,
      "end_time_sec": 6.0,
      "bbox": [120, 340, 280, 520],
      "confidence_gt": 1.0,
      "severity": "critical",
      "notes": "烟雾从操作台后方升起，颜色偏灰"
    }
  ],
  "model_predictions": [
    {
      "model": "doubao-vision-v4",
      "event_type": "smoke",
      "confidence": 0.92,
      "latency_ms": 850
    }
  ],
  "labeler": "reviewer_001",
  "review_status": "approved",
  "review_notes": ""
}
```

### 2.3 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `sample_id` | string | ✅ | 唯一标识，与视频文件名一致（不含扩展名） |
| `rule_id` | string | ✅ | 规则编码 |
| `rule_name` | string | ✅ | 规则中文名称 |
| `sample_type` | enum | ✅ | `positive` / `negative` / `edge` |
| `variant` | string | ❌ | 场景变体：`day`/`night`/`crowded`/`empty`/`rain`/`backlight` |
| `video.duration_sec` | float | ✅ | 视频时长（秒） |
| `video.resolution` | string | ✅ | 分辨率，如 `1080x1920` |
| `video.fps` | int | ✅ | 帧率 |
| `video.source` | string | ✅ | 生成平台：`豆包` / `可灵` / `海螺` / `Minimax` / `真实摄像头` |
| `annotations` | array | ✅ | 人工标注的事件列表（负样本为空数组） |
| `annotations[].event_id` | string | ✅ | 事件唯一 ID |
| `annotations[].event_type` | string | ✅ | 细分类别，如 `smoke`/`flame`/`uniform_missing`/`hat_missing` 等 |
| `annotations[].start_frame` | int | ✅ | 事件起始帧号（0-based） |
| `annotations[].end_frame` | int | ✅ | 事件结束帧号 |
| `annotations[].start_time_sec` | float | ✅ | 事件起始时间（秒） |
| `annotations[].end_time_sec` | float | ✅ | 事件结束时间（秒） |
| `annotations[].bbox` | [int×4] | ❌ | 边界框 `[x1, y1, x2, y2]`，像素坐标 |
| `annotations[].confidence_gt` | float | ✅ | 人工标注置信度（0-1），边界 case 可填 0.5-0.7 |
| `annotations[].severity` | enum | ✅ | `critical` / `major` / `minor` / `info` |
| `annotations[].notes` | string | ❌ | 人工备注 |
| `model_predictions` | array | ❌ | 模型预测结果（评估阶段填写） |
| `labeler` | string | ✅ | 标注者 ID |
| `review_status` | enum | ✅ | `pending` / `reviewing` / `approved` / `rejected` |
| `review_notes` | string | ❌ | 审核备注 |

---

## 3. 样本规模建议

### 3.1 按规则分级

| 规则 | P0/P1/P2 | 正样本 | 负样本 | 边界样本 | 合计 |
|------|----------|--------|--------|----------|------|
| B1 烟雾/明火 | P0 | ≥ 30 | ≥ 30 | ≥ 15 | ≥ 75 |
| A2/C1 着装类 | P1 | ≥ 25 | ≥ 25 | ≥ 10 | ≥ 60 |
| A3/A4 环境类 | P1 | ≥ 25 | ≥ 25 | ≥ 10 | ≥ 60 |
| G1 餐桌残留 | P2 | ≥ 20 | ≥ 20 | ≥ 10 | ≥ 50 |
| A1/F1/F2 实验规则 | P2 | ≥ 15 | ≥ 15 | ≥ 8 | ≥ 38 |

### 3.2 变体覆盖要求

每条规则的正样本需覆盖以下变体（至少 60%）：

- **光照**：白天自然光 / 夜间灯光 / 逆光 / 侧光
- **角度**：正面 / 侧面 / 俯视 / 斜视
- **密度**：空旷 / 正常客流 / 高峰期拥挤
- **时段**：营业前 / 营业中 / 打烊后
- **设备**：不同摄像头型号（如有真实数据）

负样本需覆盖常见误报源：
- **相似物干扰**：与目标规则视觉相似但不应触发的场景
- **正常运营状态**：标准 SOP 执行中的画面
- **极端画质**：模糊 / 过曝 / 欠曝 / 运动模糊

---

## 4. 标注流程

```
Step 1: 视频生成 → 按 prompts/*.md 生成视频
    ↓
Step 2: 初筛 → 删除明显失败/与 prompt 不符的样本
    ↓
Step 3: 初标 → 标注员 A 按 schema 填写 JSON
    ↓
Step 4: 复核 → 标注员 B 抽检 30%，争议样本仲裁
    ↓
Step 5: 模型初测 → 跑一遍 doubao-vision，记录 predictions
    ↓
Step 6: 冲突分析 → 对比 annotations vs predictions，定位系统性偏差
    ↓
Step 7: 补充采样 → 针对冲突场景补充正/负/边界样本
    ↓
Step 8: 定版 → review_status = approved，进入 golden set
```

---

## 5. 评估标准

### 5.1 单规则验收标准

规则上线前必须满足：

| 指标 | P0 | P1 | P2 |
|------|-----|-----|-----|
| Accuracy | ≥ 95% | ≥ 90% | ≥ 85% |
| Miss Rate | < 0.1% | < 2% | < 5% |
| FP Rate | < 5% | < 10% | < 15% |
| Latency P99 | ≤ 5s | ≤ 30s | ≤ 60s |
| Golden Set 规模 | ≥ 75 | ≥ 60 | ≥ 38 |

### 5.2 端到端验收

- 双层判定架构通跑 100 条样本无报错
- evidence.json 输出完整，含所有必填字段
- 后端确定性规则命中路径可追溯

---

## 6. 版本控制

| 版本 | 日期 | 变更 |
|------|------|------|
| v1 | 2026-09-28 | 初始版本，覆盖 B1/A2/C1/A3/A4/G1/A1/F1/F2 |
