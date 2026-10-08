# 门店 AI 视频巡检 MVP

判定链业务字典与待裁定口径：[视频分析判定链：字段级业务字典](docs/DECISION-TRACE-BUSINESS-DICTIONARY-2026-10-04.md)。

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
- [语义—策略—行动三层业务定义与现状差距](./docs/THREE-LAYER-DECISION-MODEL-2026-10-04.md)
- [飞书 P0/P1/P2 卡片联调与卡内裁决方案](./docs/FEISHU-SEVERITY-CARD-AND-INTERACTION-AUDIT-2026-10-04.md)

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

## Cloudflare Pages 演示环境

当前版本：<https://store-vision-inspection-static.pages.dev/#/login>。先打开独立的左右分栏登录页，再选择免密码演示账号进入后台；后台左侧用户区可切换账号。管理员可处理事件、管理演示摄像头/规则/账号；巡检员可处理事件和启停视频源；查看者只读。普通操作通过 Pages Functions 写入 D1，刷新后仍保留。视频上传、抽帧/AI 分析、实时摄像头及飞书发送仍不开放。

账号切换**不是身份认证**：公开链接访客可自行选择管理员，只适用于合成数据产品演示，不得放真实门店数据。Cloudflare Free 额度用尽时写入会失败，不应自动开通付费服务。

更新静态快照时，在本地已有数据且通过验证后执行：

```powershell
cd apps/web
npm run build:showcase
cd ../..
python -m scripts.export_static_showcase
cd apps/web
wrangler pages deploy dist --project-name store-vision-inspection-static --branch main
```

初次部署还须在 Cloudflare 建立 `store-vision-inspection-demo` D1 数据库、在 `apps/web/wrangler.jsonc` 配置 `DEMO_DB` 绑定，并执行 `apps/web/migrations/0001_demo.sql`。导出器只发布白名单 JSON 与事件证据帧，不发布 MP4、SQLite、模型原始响应或密钥。详见[部署与验收记录](./docs/CLOUDFLARE-STATIC-SHOWCASE-AUDIT-2026-10-04.md)。
