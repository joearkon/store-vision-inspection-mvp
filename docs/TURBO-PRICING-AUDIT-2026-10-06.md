# Turbo 费用配置审计（2026-10-06）

实现：为 doubao-seed-2-1-turbo-260628 补齐常规非音频输入 3 元/百万 Token、输出 15 元/百万 Token。官方 https://docs.volcengine.com/docs/ark/model-pricing?lang=en&redirect=1 ，输入 [0,256]K。按已记录用量估算，未扣缓存优惠与折扣；历史模型和用量不改写，未知模型仍无确定费用。不再次调用模型或发送通知。

验证：scripts/verify.ps1 通过，后端 110 项、前端 55 项、构建及 diff 检查通过。新测试覆盖 Turbo 输入输出分别计价；已有历史模型区间及缺失用量测试保持通过。

发布：42 条任务、19 条事件及既有图片已更新 Cloudflare，部署 https://e091f542.store-vision-inspection-static.pages.dev 。本地 API 已重启加载费率。

线上逻辑及视觉检查：冰箱 RUN-F54D32EDF701 费用 0.0777 元（粗筛 0.0217、复核 0.0560）；口罩 RUN-03D7FCB718F5 费用 0.2206 元（粗筛 0.0213、复核 0.0347、回退 0.1646）。总费用含回退，两页各 3 张图片完整加载，无页面错误。沿用原页面布局，截图 data/cloudflare-fridge-new.png、data/cloudflare-mask-new.png。

已知限制：缺少缓存明细，不提供账单精确值；历史缺失用量的多任务视频合计仍显示用量尚未完整记录。
