# 原生视频进度条诊断（2026-10-06）

用户报告真实口罩事件 EVT-1006-19D989 原生播放器进度条无法拖动。本地接口分段读取返回 206、Accept-Ranges bytes 和正确 Content-Range。Edge 浏览器视频 duration 24.333333，seekable [0,24.333333]。

通过真实事件页面鼠标 down/move/up 测试：暂停时拖动 currentTime 18.338253；播放中向后拖动 currentTime 4.825337，保持播放。没有复现无法拖动。证据脚本 data/native-seek-test.cjs、data/native-seek-playing-test.cjs；截图 data/native-seek-before.png。

原生控件与下方异常时间轴是两种控件。最初误以为是下方时间轴，临时新增 range 已撤回，不作为修复交付。尚需用户提供发生问题的页面来源以复现；未发布代码变更。
