# 门店 AI 视频巡检 MVP

独立于加盟商运营系统的视频巡店分析项目。第一阶段验证真实视频上传、抽帧、豆包 Vision 判定、多帧事件聚合、事件看板和飞书告警闭环。

## 已确认边界

- 独立组织架构、门店、账号与权限，不依赖现有订货/盘点系统。
- 上传视频和预置演示视频共用同一条分析管线。
- 视频、抽帧、模型响应和巡检事件由本系统独立保存。
- 后续仅通过稳定的 `store_code`、事件摘要和整改任务接口与运营系统按需关联。
- 原型与设计文档评审通过后再进入实现。

## 目标管线

```text
本地 MP4 / 预置视频
  → FastAPI 接收与任务入队
  → FFmpeg 抽帧
  → 豆包 Vision 结构化判定
  → 连续多帧聚合与去重
  → SQLite 事件记录
  → Dashboard 事件流
  → 飞书机器人告警
```

## 计划目录

```text
apps/api/          FastAPI 接口
apps/worker/       视频分析任务进程
apps/web/          SaaS Dashboard
docs/              产品、架构、规则与原型契约
seed/              组织、门店、账号和权限初始化数据
tests/             规则、接口、流程和视觉验收
```

真实的火山引擎密钥、飞书 Webhook 和其他凭据不得提交到仓库。

## 设计文档

- [项目章程](./docs/PROJECT-CHARTER.md)
- [MVP 场景与技术实现设计](./docs/MVP-SCENARIOS-TECHNICAL-DESIGN.md)
- [视觉实现契约](./docs/VISUAL-IMPLEMENTATION-CONTRACT.md)
- [原始交付物清单](./references/original-v1/README.md)
- [可运行视觉原型基线](./prototypes/visual-baseline-v1/README.md)
- [第一阶段产品与交付审计](./docs/PHASE-1-PRODUCT-AUDIT.md)
- [E1 本地真实闭环测试](./docs/E1-LOCAL-CLOSED-LOOP-TEST-2026-09-27.md)
- [双模式分析设计与真实 A/B](./docs/DUAL-MODE-ANALYSIS-DESIGN.md)
- [事件证据交互复核](./docs/EVENT-EVIDENCE-REVIEW.md)
- [A1 口罩/手套实验规则交付审计](./docs/A1-PPE-RULE-AUDIT-2026-09-27.md)

## 本地运行

```powershell
# API
python -m uvicorn apps.api.app.main:app --host 127.0.0.1 --port 8797

# Worker（另一个终端）
python -m apps.worker.run

# Web（另一个终端）
cd apps/web
npm install
npm run dev
```

访问 `http://127.0.0.1:5173/`。首次真实分析前，将 `.env.example` 复制为 `.env` 并配置火山引擎密钥；不要提交 `.env`。

## 验证

```powershell
./scripts/verify.ps1
```
