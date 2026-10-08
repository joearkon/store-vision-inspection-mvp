# 冰箱与口罩复测及发布记录（2026-10-06）

- 冰箱任务 RUN-F54D32EDF701：沿用已验证的合成开关门视频，双层判定，10 次请求，22,369 Token；30 秒确认持续开启，41 秒观察关闭恢复。生成 EVT-1006-2222E5，飞书发送成功。
- 真实口罩任务 RUN-03D7FCB718F5：双层处理不足以满足时序确认后逐帧回退；粗筛 1 次、关键帧 5 次、回退 24 次，共 30 次、60,620 Token。11 秒形成 P2 待核查事件 EVT-1006-19D989；脸部未戴口罩，手部被遮挡，不能据此认定未戴手套。飞书发送成功。
- 使用 doubao-seed-2-1-turbo-260628。当前费用显示模型费率待配置，不套用旧 Pro 费率。
- 已导出 42 条任务、19 条事件、62 张事件证据图片，并包含任务报告图片和监控静帧；未上传原始 MP4。
- Cloudflare 部署完成：https://cb2fc5cc.store-vision-inspection-static.pages.dev 。生产地址 https://store-vision-inspection-static.pages.dev 。
- 线上浏览器检查：两条任务各 3 张报告截图全部加载成功，无页面脚本错误；口罩正确显示“双层 → 逐帧回退”。截图保存在 data/cloudflare-fridge-new.png 和 data/cloudflare-mask-new.png。
- 本次仅运行分析、导出数据和发布，未修改业务代码。
