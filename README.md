# Talium 工具箱

**线上入口：[tool.talium.site](https://tool.talium.site/)** · [MakoLrc Studio](https://tool.talium.site/MakoLrcStudio/)

一个为个人在线工具打造的菜单页。暖白、墨绿与青柠色，Material You 圆角形态，自绘渐变花形和歌词时间轴意象。

- 指针视差、点击绽放、滚动入场、卡片聚光、波形与歌词同步动画。
- 跟随系统的浅色/深色主题；支持的浏览器以圆形扩散动画切换，可保存偏好并跨标签同步。
- `Ctrl/⌘ K` 或 `/` 搜索；关键词匹配、空结果、方向键和 Enter 导航；Esc 关闭并恢复焦点。
- 移动端布局、语义化导航、可见键盘焦点、减少动效偏好和手动动效开关。
- 无前端框架、无生产依赖、无统计或第三方运行时请求。字体和矢量素材均随站点提供。

## 本地开发

需要 Node.js 22.12+（或更高的兼容版本）：

```bash
npm ci
npm run dev
```

```bash
npm run build
npm run preview
```

`src/main.ts` 负责交互，`src/style.css` 负责布局与动画，`index.html` 提供可直接访问的内容。关闭 JavaScript 后，工具入口仍可使用。

## 验证

```bash
npx playwright install chromium firefox webkit
npm run build
npm test
npm run test:deploy
```

生产构建在 Chromium、Firefox、WebKit 上检查主题持久化、键盘搜索、真实目标 URL、弹窗焦点、减少动效、存储受限模式、320/390/768/1440px 布局，以及两种主题和弹窗的 WCAG AA 自动检查。截图写入 `artifacts/screenshots/`，报告写入 `playwright-report/`。WebKit Linux 是浏览器引擎验证，不代表真实 iPhone/Safari 人工验收。

Playwright 在不受支持的 Linux 发行版可能缺少 Ubuntu ABI 运行库。可通过 `PLAYWRIGHT_WEBKIT_EXECUTABLE` 指定独立测试启动器，不要求修改系统库；受支持的 CI 系统可使用 Playwright 官方镜像或安装对应浏览器依赖。

## 部署与回滚

部署目标固定为 SSH 别名 `tencent` / Ubuntu 用户的 `https://tool.talium.site/`，由 Caddy 提供静态文件。部署需已获得用户的服务器 sudo 授权。

```bash
# 工作区必须干净，先完成构建和测试并提交推送。
bash scripts/deploy.sh
```

该脚本本地构建、计算 SHA-256、上传归档，然后通过免密 sudo 调用服务器激活脚本：

1. 校验归档摘要与内容，解压到独立版本目录。
2. 只在现有 `tool.talium.site` 中添加首页路径处理；保留 `/MakoLrcStudio/`、尾斜杠重定向、原有缓存规则与其他站点。
3. 备份并验证 Caddy 配置，再原子切换 `current` 符号链接并重载。
4. 核对首页、公开版本信息、未知路径 404 与原有应用内容；任一步失败则自动恢复原配置与版本。

菜单版本存于 `/var/www/tool.talium.site/menu/releases/`。上一部署状态存于 `menu/last-deployment.json`，配置备份存于 `/var/backups/talium-menu/`。保留旧版本和旧哈希资源供回滚及切换期间的浏览器请求使用。

```bash
# 仅在需要撤销最新一次部署时执行：
ssh tencent 'sudo -n python3 /home/ubuntu/.local/share/talium-menu/activate.py rollback'
```

`/release.json` 返回当前 Git 提交和部署时间。哈希资源设置一年 immutable 缓存，其余菜单文件要求重新验证。菜单的 CSP、隐私和 MIME 安全响应头只作用于首页资源。

现有 MakoLrc Studio 部署脚本会重写整段站点配置并断言根路径 404；未来运行它之前需同步保留 `scripts/menu.caddyfile` 中的路由及调整该断言，或在其完成后重新部署本菜单。本仓库不修改相邻项目的源码。

## 字体与设计维护

Manrope 和 Noto Sans SC 按 SIL Open Font License 随附授权文件。中文字体仅收录当前文案所需字形；浏览器会为其他文本使用系统字体。增加文案后可重新生成子集：

```bash
python -m pip install fonttools brotli
python scripts/update-fonts.py
```

字体更新脚本会从 Google Fonts 官方仓库下载源文件，正常构建与线上访问均不需要该网络请求。

设计约定见 [docs/design.md](docs/design.md)。
