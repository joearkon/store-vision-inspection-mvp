# 视频分析判定链：字段级业务字典与待裁定口径

> 2026-10-04 · 试行稿 v0.1，供业务裁定。范围为本地真实分析任务（含合成视频）的增量数据记录；不是实时萤石或真实门店准确率验收。本文不改变既有事件严重度、SLA、通知或人工复核制度。

## 1. 五类结果的边界

| 术语 | 判定单位与含义 | 不能被解释为 | 数据承载与责任 |
| --- | --- | --- | --- |
| 观察（observation） | 模型在一个视频时间点对可见画面返回的状态、置信度、文字证据和画质 | 单帧命中不是事件；`unknown` 不是“正常” | `frame_findings`；模型提供可见事实，服务端写入并保留原始响应 |
| 候选（candidate） | 双层模式的粗筛时间段，或逐帧模式中未成事件的正向观察区间 | 不是已确认异常，也不自动进入整改 | 粗筛原文保留在 `analysis_runs.screening_result_json`；逐段判定新增 `analysis_decisions(scope=candidate)`，服务端负责范围与关联 |
| 已确认事件（event_created） | 服务端按某次运行的规则聚合后写入 `inspection_events` 的业务异常，初始为待人工确认 | 不代表人工已经认可、整改已经完成、模型规则已经正式验收 | `inspection_events` + `event_evidence`；创建时等级固化，人工再决定业务处理 |
| 证据不足（insufficient_evidence） | 已观察到的画面/帧都无法支持正常或异常结论，或模型标注画质不足 | 不是负样本、不是“0 异常”准确率成功 | `image_quality`、`visual_state` 和 `analysis_decisions.reason_code`；模型报不足，服务端保守归类 |
| 分析失败（failed） | 读取视频、抽帧、模型调用或聚合流程未完成；也包括不可恢复的软件错误 | 不是“正常”或“未形成事件”；飞书发送失败不得改写分析成功 | `analysis_runs.status/error_code/error_message` + 任务级判定；服务端处理 |

**任务完成、候选存在、事件形成、人工确认、通知送达是五个不同事实。** 任务可以成功完成但没有候选；也可以有粗筛候选却未过规则门槛；已形成事件仍待人工裁决。

## 2. 现有表与增量字段

| 对象/字段 | 含义与来源 | 空值/历史解释 |
| --- | --- | --- |
| `video_assets.id/source_kind/sha256/duration_seconds` | 素材身份、来源、哈希和视频时长。`source_kind` 应明确合成、受控实拍或真实来源；旧值仅按原字段解释 | 旧素材来源不清楚时不可推断真实/合成 |
| `analysis_runs.id/video_id/rule_code/analysis_mode/frame_rate` | 一次任务的输入与所选规则、模式、抽帧率；同一视频每次运行有独立 ID | `analysis_mode` 是创建时选择；获批回退后的实际执行模式见判定详情 |
| `analysis_runs.rule_config_snapshot_json`（新增） | 新任务创建时固化规则聚合阈值、有效状态、帧率、粗筛率及模式配置；带人工版本名与配置 SHA-256 指纹 | `NULL` = 当时未记录，**不得用当前设置倒填** |
| `analysis_runs.prompt_snapshot_json`（新增） | 新任务创建时固化相关代码内 Prompt 模板源码、SHA-256 指纹、所选模型配置；不含密钥、运行时图片/视频内容 | `NULL` = 当时未记录；仅模板快照，不等于完整请求回放 |
| `analysis_runs.screening_result_json` | 双层粗筛返回的画质和候选段原值 | 逐帧模式或未走到粗筛时可为空；不可据空值推断“无异常” |
| `frame_findings.captured_offset` | 视频内秒数；`frame_index/frame_rate` 形成，不是任务处理时间或摄像头实时时钟 | 对旧任务按已存值展示，不补推绝对发生时间 |
| `frame_findings.image_quality/visual_state/confidence/evidence/raw_response_json` | 一帧的画质、视觉状态、模型信心、说明与原响应 | `confidence` 是视觉输出，不是业务确认概率；`unknown`/不足不能算合规 |
| `analysis_decisions`（新增） | 每任务一条 `scope=task` 结论；每可识别候选时间段一条 `scope=candidate` 判定，关联证据帧 ID 与可选事件 ID | 旧任务没有记录时显示“当时未记录”；不能根据既有事件反造当年的候选与原因 |
| `inspection_events.severity/status/*_offset` | 事件创建时业务风险等级、处理状态和视频内首次/确认/最后/恢复时间 | 旧事件等级不随新规则重写；已解决不证明模型原判正确 |
| `event_evidence.finding_id/evidence_type/captured_offset` | 事件关键帧与证据角色 | 标记误报后仍保留；不是整改验收凭证 |
| `event_action_logs.actor_id/action/from_status/to_status/note/created_at` | 人工或系统动作审计 | 独立复核人、复核制度尚未定义，不通过空字段假装已有 |
| `notification_deliveries` | 事件通知尝试与投递状态 | 通知失败不应把成功分析改为失败；本轮验收不以飞书为条件 |

### 新增 `analysis_decisions` 字段

| 字段 | 口径 |
| --- | --- |
| `id`, `run_id` | 判定记录标识与任务外键；不能脱离任务阅读 |
| `scope`, `candidate_index` | `task` 恒为索引 0；`candidate` 从 0 顺序编号；任务级即使零候选也必须存在 |
| `source` | `run`、`video_screening`、`frame_aggregation`、`positive_frame_span`。最后一类是逐帧正向观察区间，不伪称粗筛输出 |
| `start_offset`, `end_offset` | 候选在视频中的秒数；任务级为空；均非处理墙钟时间 |
| `outcome` | `event_created`、`no_event`、`insufficient_evidence`、`not_confirmed`、`not_evaluated`、`paused`、`failed`。`not_evaluated` 不能计为负例 |
| `reason_code` | 有限原因码，见下表；不得用自由文本替代可统计编码 |
| `evidence_finding_ids_json` | 本次判定能关联的帧观察 ID 数组；空数组可表示粗筛没有精查帧，**不代表看见正常** |
| `event_id` | 仅当该候选关联已创建业务事件时填写；不关联整改工单 |
| `detail_json` | 粗筛置信度/文字、任务状态、候选数、事件数、失败信息和实际执行模式等补充信息；不能覆盖主字段语义 |
| `created_at`, `updated_at` | 判定记录写入/重算的 UTC 时间，不是视频事件发生时间 |

## 3. 原因码（试行，待业务裁定）

| 原因码 | 触发口径 | 结论边界 |
| --- | --- | --- |
| `EVENT_CREATED` | 服务端聚合已写入事件 | 后续人工可确认或标记误报 |
| `NO_CANDIDATE` | 任务成功，但没有粗筛候选或逐帧正向观察区间 | 不是证明“绝对正常”；仅本次算法未发现候选 |
| `CANDIDATES_NOT_CONFIRMED` | 有候选，但本次没有事件 | 任务级汇总，逐候选查下方原因 |
| `BELOW_DURATION_THRESHOLD` | 候选视频跨度小于规则固化时长门槛 | 仅适用于有明确时长阈值的规则 |
| `NO_REFINEMENT_EVIDENCE` | 粗筛有候选，但完成任务时该段没有可关联的精查帧 | 不推测为正常或画质不足；需核查局部复核流程 |
| `RULE_THRESHOLD_NOT_MET` | 候选没有通过多帧/状态/置信度等综合门槛 | 当前是保守汇总代码；未来若需精确到 3/5、ROI、置信度，应由聚合器显式输出，不凭现有表推测 |
| `INSUFFICIENT_EVIDENCE` | 已有证据帧全为不足、不可见或未知 | 不作为正常负样本；当粗筛没有精查帧时也不能臆断“不足” |
| `FALLBACK_APPROVAL_REQUIRED` | 双层模式无法继续、等待人工批准逐帧回退 | 流程暂停，不能算分析失败或正常 |
| `ANALYSIS_FAILED` | 任务处理异常终止 | 留原错误信息；不形成模型结论 |

## 4. 状态值、时间与责任

- 任务：`queued → running → completed`，或 `awaiting_approval`、`failed`。`completed` 只表示该次分析程序结束。`started_at/completed_at/created_at` 是 UTC 墙钟时间，分析耗时不能代替视频异常持续时长。
- 帧视觉状态按规则区分。E1：`open/closed/unknown`；A1/A2/C1/A4：`violation/compliant/unknown`；A3：`messy/clean/in_use/unknown`；B1：`smoke/flame/steam/clear/unknown`；G1：`departed_residual/occupied/clean/cleaning/unknown`。必须连同 `rule_code` 和画质理解，不跨规则比较置信度。
- 事件处理：`pending_confirmation → acknowledged → rectifying → resolved`，可转 `false_positive/ignored`。`acknowledged` 是人接受处理，不回写模型观察。`overdue` 根据时限计算，不是事件独立状态。
- 视频时间：`captured_offset`、候选 `start_offset/end_offset`、事件 `first_seen_offset/confirmed_offset/last_seen_offset/recovered_offset` 都是**相对视频起点的秒数**。任务和人工日志的 `*_at` 是 UTC 墙钟时间。上传素材没有可靠摄像头原始时间时，不从上传时间反推拍摄日期。
- 责任：模型输出视觉事实；服务端规则决定候选能否成事件及创建时等级；授权人决定确认、误报、整改和解决；通知仅记录投递。规则成熟度和 P0/P1/P2 业务严重度相互独立。

## 5. 本轮实现范围与不应误读的缺口

- 只给**新建任务**写规则/Prompt 快照；历史任务保留 `NULL`。事件/行动表不迁移、不回写等级、不自动通知。
- 判定记录由当前任务的已存粗筛、帧观察与真实事件生成；不会再调用模型。零候选任务仍写任务级结论。若失败/等待批准，候选标为 `not_evaluated`。
- 现有逐帧回退复用任务 ID 且会替换旧帧观察；新表因此记录该任务的**当前尝试**，不宣称已保存所有重试历史。这是以后要单独处理的审计缺口。
- Prompt 快照保存的是代码内模板和所选模型配置，运行时摄像头名及视觉输入未复制进快照；原始模型响应仍由既有字段保存。还不能声称任意历史任务可以百分百重放。
- 本轮不改页面。任务详情 API 可读 `decisions`；产品展示如何区分“当时未记录”与“本次无候选”，需后续页面验收。

## 6. 请业务裁定（不替你决定）

1. `RULE_THRESHOLD_NOT_MET` 是否够用，还是 E1/A1/B1 首批就必须细分为时长、多帧命中、ROI、置信度、前后矛盾等互斥原因码？现有聚合器要做精细原因输出才可准确细分。
2. 双层粗筛有候选但局部复核矛盾时，目前任务停在“需批准逐帧回退”；是否允许定义为“证据不足”并结束，还是必须保持暂停等待人决定？
3. 已解决/误报的事件是否需要**独立复核人**？如需要，请定适用规则与等级、复核角色、时限、证据要求和同人回避要求，然后再设计复核对象。
4. 重试/回退是否要求保留每次尝试的原始帧与判定历史？若是，下一步应新增 `analysis_attempts`，而不是靠覆盖本表字段。

## 7. 验收矩阵与本轮工程记录

| 场景 | 应有结果 |
| --- | --- |
| 正常、无候选 | 任务成功；一条任务级 `NO_CANDIDATE`，没有伪事件 |
| 正向短段 | 候选 `BELOW_DURATION_THRESHOLD`，不形成事件 |
| 不可见/画质不足 | `INSUFFICIENT_EVIDENCE`，不能算正常 |
| 成事件 | 候选关联真实 `event_id` 和证据帧；等级取事件创建值 |
| 粗筛异常/回退待批准 | 任务 `paused`；候选 `not_evaluated`，不强制输出阴性 |
| 分析失败 | 任务 `failed` 及错误原因，不写“正常” |
| 重复生成判定 | 同任务/范围/索引幂等更新，不重复插入任务级记录 |
| 旧任务 | 快照和判定记录缺失显示“当时未记录”；不倒填 |
| 跨日与时间 | 所有候选/事件时间是视频相对秒数，UTC 墙钟另列 |
| 页面/移动端 | 本轮无 UI 修改；视觉对照不适用，后续展示需按 1280×720 和移动/窄视口单独验收 |

自动化证据：2026-10-04 使用隔离的 `.venv` 执行 `scripts/verify.ps1` 通过；后端 76 项、前端 43 项及 Vite 构建均通过，`git diff --check` 通过。新增用例见 `tests/test_decision_trace.py`，既有视频链路见 `tests/test_analysis_pipeline.py`，API 创建任务快照见 `tests/test_api.py`。

产品逻辑审计：本轮不改变规则门槛或严重度，只增加可追溯输出；零候选、短候选、证据不足、暂停和重复写入有单独断言。视觉比较：无页面改动，因此未新增截图基线；任务详情 API 已返回 `decisions`，但前端尚未展示判定链。未过集成门禁：真实模型新样本、飞书、萤石与线上 Pages 均未因本轮改动重新验收；四项业务待裁定与回退历史缺口见上节。
