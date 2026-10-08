# 上传通知默认开启

按用户要求，将AutoUploadPage飞书通知开关初值改为true，同步说明文案，支持用户手动关闭。仅更改未来上传页默认选择，未补发历史任务消息。

既有通知策略保留：自动上传当前仅E1、M1可请求自动通知；G2待核查线索仍需人工复核。开关开启不等于所有规则均发送。

SSR回归检查默认checkbox checked和文案。105项后端、54项前端测试、构建及差异检查通过，日志data/verify-notification-default.log。1280×720 Edge真实浏览器检查默认开启、手动关闭及截图data/ui-notification-default.png。不触发外部通知。
