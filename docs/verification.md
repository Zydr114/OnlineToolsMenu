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

## 公开站点验收

- 地址：`https://tool.talium.site/`。
- 部署源码：`fb457ef49fb0109b9f55bc898601b6fcc95dcde0`。
- 激活时间：2026-10-16 13:12:57（Asia/Shanghai）。
- 线上 Chromium 的全部 14 项回归通过（7.0 秒），包含两种主题、搜索、弹窗、无 JavaScript 导航、响应式和无障碍扫描。
- 首页 200，未配置路径 404，`/MakoLrcStudio` 308，`/MakoLrcStudio/` 200。
- 首页 JavaScript、CSS、两份字体、启动主题脚本和图标的公开响应均与本地构建逐字节一致。
- 首页使用 `no-cache`，哈希 CSS/JS 使用一年 `immutable`；菜单安全响应头已启用。
- 原有歌词工具入口 HTML 的 SHA-256 与部署前一致。
- Caddy 服务状态 `active`。

服务器版本目录：

```text
/var/www/tool.talium.site/menu/releases/20261016T051257187828Z-fb457ef49fb0
```

原始 Caddy 配置备份：

```text
/var/backups/talium-menu/20261016T051257187828Z.Caddyfile
```

本条验收记录提交仅更新文档；公开 `/release.json` 标识的是已验收的部署源码提交。

## 黑白几何改版（2026-10-16）

本节针对用户后续要求的黑白、精简文案与科技风格版本，替代首版的视觉验收结论。

- 生产构建与 TypeScript 检查通过。
- Chromium / Firefox / WebKit 原有 42 项回归全部通过（21.8 秒）。
- 新增几何像素中性灰阶、实际画面持续变化、离屏停止绘制、回到视口恢复、整卡视觉区点击；三浏览器 6 项通过（4.7 秒）。合计 48 项。
- 减少动效下停止循环，点击立即变换静态结构；使用真实画布像素验证形态改变。
- 两种主题与弹窗的 WCAG AA 自动检查通过。手工检查 1440px 黑白主题、方形结构及 390px 深色手机截图。
- Caddy 配置合并 4 项测试通过；部署机制与目标不变。
- 交付构建：HTML 11.44 kB、CSS 23.01 kB、JS 8.18 kB；字体中文子集从 62.2 kB 缩至 26.1 kB。

截图：`artifacts/mono-dark-1440.png`、`artifacts/mono-light-1440.png`、`artifacts/mono-dark-390.png`、`artifacts/mono-dark-square.png`。

### 黑白版线上验收

- 部署源码：`c2399962d3008d7e8def340a30cb4bbbd253c93c`。
- 激活时间：2026-10-16 13:29:50（Asia/Shanghai）。
- `https://tool.talium.site/` 返回新版标题与精简内容；生产资源与本地构建逐字节一致。
- 线上 Chromium 的全部 16 项回归通过（4.9 秒），包括真实画布黑白像素、离屏暂停和整卡跳转。
- 既有歌词工具 HTML 校验值不变；上一版不可变资源仍返回 200，支持切换期间的旧页面请求。
- 上一版本：`/var/www/tool.talium.site/menu/releases/20261016T051257187828Z-fb457ef49fb0`。
- 当前版本：`/var/www/tool.talium.site/menu/releases/20261016T052950211872Z-c2399962d300`。
- 本次配置备份：`/var/backups/talium-menu/20261016T052950211872Z.Caddyfile`。

回滚命令见 README。本条记录提交仅更新文档，不改变已验收的线上源码。

## 空间结动画升级（2026-10-16）

- 首屏升级为闭合参数曲线构成的空间结，包含透视、深度遮挡、平滑结形变换、局部红蓝流线、拖动旋转和衰减惯性。
- 生产构建通过；Chromium / Firefox / WebKit 共 54 项回归通过（26.5 秒）。
- 真实画布像素验证红蓝强调线存在，灰阶像素占比高于 85%；两种结构均不在画布边缘裁切。
- 验证减少动效时可直接变形和拖动静态结构、拖动不误触点击、离屏暂停与恢复。
- Chromium 模拟 Pixel 7 触摸环境，纵向滑过几何体能滚动页面，且不会误切换结构。真实触屏设备未人工验收。
- 手工检查 1440px 深浅主题、两种结构及 390px 深色手机截图；无 JavaScript 时提供静态结形轮廓，并复验三浏览器入口和原生导航。
- 构建体积：HTML 13.64 kB、CSS 23.14 kB、JS 10.54 kB。
- 截图：`artifacts/knot-final-dark-1440.png`、`artifacts/knot-final-eight-dark-1440.png`、`artifacts/knot-final-light-1440.png`、`artifacts/knot-final-dark-390.png`。

### 空间结版本线上验收

- 部署源码：`988a21ef5e7eb971c5ab0bb699fbe56216063aba`；2026-10-16 13:44:13（Asia/Shanghai）激活。
- 线上 Chromium 全部 18 项回归通过（5.0 秒），包括红蓝像素比例、两种结形的边界、减少动效和拖动行为。
- 公开 CSS/JS 与本地生产构建逐字节一致；MakoLrc Studio 入口 HTML 校验值与升级前相同。
- 当前版本：`/var/www/tool.talium.site/menu/releases/20261016T054413845738Z-988a21ef5e7e`。
- 配置备份：`/var/backups/talium-menu/20261016T054413845738Z.Caddyfile`；保留上一版用于回滚。

此验收记录提交仅更新文档。
