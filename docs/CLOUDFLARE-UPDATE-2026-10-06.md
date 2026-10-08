# Cloudflare 演示站更新

按用户“像上次一样”发布至既有store-vision-inspection-static项目、main生产分支，保留D1绑定和演示账号数据。部署完成地址https://0b942c4c.store-vision-inspection-static.pages.dev，正式地址https://store-vision-inspection-static.pages.dev。

构建为showcase模式；复用既有公开合成snapshot：22条任务、10条事件、31张证据图。没有调用本地全库导出器，因为本地已含真实门店监控。没有发布真实视频、真实门店截图、SQLite、凭据或原始模型响应。构建目录后缀检查通过。

同步最新页面与CSS、左右监控大盘、规则通知说明；新运营入口仍明确线上未开放。线上保持原范围：模拟角色/D1操作可用，视频上传、AI推理和飞书外发不可用。本地新增真实分析记录、桌位截图与任务证据不会出现在公开站点。

发布前107项后端、54项前端、生产构建及差异检查通过，另showcase构建通过。增加静态API运营数据兼容检查。部署Wrangler成功返回，Functions编译成功，无D1重置操作。

1280×720 Edge线上实际登录管理员，访问大盘、任务详情及事件详情，浏览器pageerror为空，事件页图片全部加载。查看登录和大盘截图，保持原壳层与演示范围。截图位于data/cloudflare-login-20261006.png、cloudflare-dashboard-20261006.png、cloudflare-run-20261006.png及cloudflare-event-20261006.png。未执行线上状态变更。

已知边界：免密码演示角色不是真实鉴权；公开站仍仅提供合成演示。最新实时模型与飞书闭环需在本地演示，公开静态站不会执行。
