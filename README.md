# DSP极简网络 · 离线网页版

基于上游项目 [snowsnow0926/DSPONLINE](https://github.com/snowsnow0926/DSPONLINE)（v1.3.0）构建的**完全离线**网页版：
所有代码、样式、图标、Worker 全部打包进本地文件，**无需联网、无需安装任何依赖**，双击即可在浏览器里玩。

> 第一次玩？直接看 **[游玩教程.md](./游玩教程.md)**（30 秒上手 + 与游戏内一致的 16 节完整教程）。

## 快速开始（macOS）

1. 下载本仓库里的 [`DSP极简网络-离线版.html`](./DSP极简网络-离线版.html)（约 9.3 MB）
2. 双击文件，用浏览器打开（Safari、Chrome、Edge 均可）
3. 首次进入会有「版本更新记录」弹窗，点右上角 × 关闭
4. 点「开始游戏」→「开始新游戏」，即可进入工厂

> 文件可以放在「访达」任意文件夹里保存；建议保留一份备份。

## 存档说明

- 存档保存在**浏览器本地**（localStorage / IndexedDB），全程离线，不上传任何数据。
- 不同浏览器、不同文件位置的存档互相独立；清理浏览器网站数据会删除存档。
- 重要进度请用游戏内的「导出存档」功能备份。
- 离线模式下云端账号、云存档、排行榜不可用（构建时已关闭官方云 API，属预期行为）。

## 文件说明

| 路径 | 说明 |
| --- | --- |
| `DSP极简网络-离线版.html` | **单文件版**：双击即玩，推荐 macOS 用户使用 |
| `游玩教程.md` | **完整游玩教程**：30 秒上手、新手路线图、16 节教程正文、FAQ |
| `offline-web/` | 多文件版：适合用静态服务器 / 自建站点托管（不建议用 file:// 直开） |
| `screenshots/` | 离线验证截图（启动菜单、游戏内画面） |
| `build/` | 离线构建配置与内联脚本（可复现构建） |
| `LICENSE.txt` 等 | 上游许可与第三方声明 |

## 离线验证记录

在浏览器层拦截**全部 http/https 请求**的无网络环境下实测：

- `file://` 直开单文件版：启动菜单正常渲染，**0 条网络请求、0 条控制台错误、0 条页面异常**
- 进入游戏：内联 Worker 正常启动（3 个 Worker 实例），初始工厂 6 个建筑节点完整渲染
- 内置教程实测：从建筑检查器进入教程工作台，**16 节全部存在、可切换、0 报错**（见 `screenshots/offline-tutorial.png`）
- 存档写入 localStorage 正常（`file://` 协议下可写）
- 多文件版经本地静态服务器托管：同样通过（另有 4 条 `/api` 404 属未部署云服务的预期行为，不影响游戏）

验证环境：Microsoft Edge（Chromium 内核，headless），Windows 11。

## 构建方式（可复现）

- 源码：DSPONLINE v1.3.0（React 19 + Vite 8，Node.js 24）
- 离线构建配置 [`build/vite.offline.config.ts`](./build/vite.offline.config.ts)：
  - `base: "./"` —— 全部资源使用相对路径
  - 把 `new Worker(new URL("./x.worker.ts", import.meta.url))` 重写为内联 Worker（`?worker&inline`），**包括 Worker 内部再创建的嵌套 Worker**；否则 `file://` 下浏览器会以 CORS 为由拒绝加载 Worker 脚本
  - 单文件模式：关闭代码分割，并用 [`build/inline-singlefile.mjs`](./build/inline-singlefile.mjs) 把 JS/CSS 内联进 HTML
- 构建命令：

  ```bash
  npm ci
  npx vite build --config vite.offline.config.ts --outDir dist-offline
  # 单文件版（macOS/Linux）
  DSP_OFFLINE_SINGLE_FILE=1 npx vite build --config vite.offline.config.ts --outDir dist-single
  node build/inline-singlefile.mjs dist-single
  ```

## 许可与署名

- 上游项目：**DSPONLINE**（作者 snowsnow0926），采用 [PolyForm Noncommercial License 1.0.0](./LICENSE.txt)：
  允许个人非商业用途的使用、修改与分发；**禁止未经授权的商业使用**。
- 本仓库仅为个人离线构建产物，完整保留原项目的许可与声明文件
  （`LICENSE.txt` / `NOTICE.txt` / `COMMERCIAL_USE.md` / `TRADEMARKS.md` / `THIRD_PARTY_LICENSES.txt`）。
- 项目名称与 Logo 使用规则见 [TRADEMARKS.md](./TRADEMARKS.md)。
