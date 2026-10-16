# 验证记录

日期：2026-10-16。针对生产 `dist/`，使用 Playwright 1.63.0。

## 页面验证

| 范围 | 结果 |
| --- | --- |
| Chromium | 14 项通过 |
| Firefox | 14 项通过 |
| WebKit Linux | 14 项通过，包含单独复验的无 JavaScript 键盘导航 |
| Caddy 配置合并 | 4 项单元测试通过 |
| TypeScript 与 Vite 生产构建 | 通过 |
| 部署 Shell 与 Python 语法检查 | 通过 |

覆盖：生产资源完整性、工具目标 URL、主题与系统偏好/存储/标签页同步、快捷搜索和空结果、方向键/Enter/Esc、弹窗焦点恢复和背景关闭、减少动效、320/390/768/1440px 无横向溢出、两种主题和弹窗的 WCAG A/AA 自动检查、JavaScript 关闭后的核心导航。

人工检查了桌面与手机截图、深色桌面以及关于弹窗。截图位于忽略跟踪的 `artifacts/` 和 `artifacts/screenshots/`。

WebKit 在 CachyOS 上通过隔离启动器使用官方 Ubuntu 的 libicu74、libxml2、libflite1，依赖提取到 `artifacts/webkit-runtime/`。未向系统安装库。初次无 JavaScript 测试受 WebKit 的鼠标稳定性等待影响，改为验证键盘 Enter 原生导航，单独复验通过。真实 macOS Safari 与 iPhone 设备未人工测试。

## 部署检查

部署脚本在激活时校验：归档 SHA-256、Caddy 配置、当前 Git 版本、首页响应、未知路径 404、歌词工具尾斜杠 308，并逐字节核对已有歌词工具入口 HTML。

部署前已有歌词工具 HTML 的 SHA-256：

```text
a53974e284212a9638457b72ff2adde9670c0e4ed41c59a7d12174d9033f53c2
```

公开站点验收结果在部署完成后追加。
