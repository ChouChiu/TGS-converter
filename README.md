# TGS Converter

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FChouChiu%2FTGS-Converter)

Telegram 动态贴图（.tgs）本地转换工具。无需后端服务，所有转换均在本地浏览器中完成，安全且不上传任何贴图数据。

支持将 `.tgs` 单文件、ZIP 贴图包或通过 Telegram Bot API 获取的贴图，转换为 **WebP**、**GIF** 和 **APNG** 格式。

## 主要特性

- **多种导入方式**：支持文件拖拽、剪贴板粘贴（Ctrl+V）、文件选择，以及通过 Telegram Bot API 直接拉取公开贴图包。
- **三种输出格式**：
  - **WebP**：体积小、画质高，保留完整透明通道（推荐）。
  - **GIF**：兼容各类主流聊天软件，支持直接发送。
  - **APNG**：无损动图，完整保留半透明渐变细节。
- **批量与打包**：支持多贴图批量并行转换、动画即时预览、单项下载以及一键打包 ZIP。
- **本地安全**：无需上传文件至远程服务器，保护隐私；内置防卡顿调度与规格校验机制。

## 部署与运行

### 一键部署

点击下方按钮即可一键克隆并部署到 Vercel：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FChouChiu%2FTGS-Converter)

### 本地运行与构建

本项目基于 [Bun](https://bun.sh/) 运行：

```bash
# 安装依赖
bun install

# 启动本地开发服务 (http://localhost:5173)
bun dev

# 打包构建生产版本 (输出至 dist/)
bun run build
```

## Telegram Bot API 反代配置（Cloudflare Worker）

由于浏览器的跨域安全限制（CORS），网页端无法直接向 `api.telegram.org` 发起请求。可以通过免费的 Cloudflare Worker 搭建反向代理进行中转。

### 1. 部署 Worker

登录 [Cloudflare 控制台](https://dash.cloudflare.com/)，进入 **Workers & Pages** -> **Create application** 创建 Worker，进入代码编辑页面，粘贴以下代码并点击 **Deploy**：

```text
const e={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"*","Access-Control-Max-Age":"86400"};export default{async fetch(s){if("OPTIONS"===s.method)return new Response(null,{status:204,headers:e});const t=new URL(s.url);t.host="api.telegram.org";try{return(s=>{const t=new Headers(s.headers);for(const s in e)t.set(s,e[s]);return new Response(s.body,{status:s.status,headers:t})})(await fetch(new Request(t,s)))}catch(s){return new Response(JSON.stringify({ok:!1,error:s.message}),{status:502,headers:{...e,"Content-Type":"application/json"}})}}};
```

### 2. 绑定自定义域名（重要）

> [!WARNING]
> Cloudflare Worker 默认分配的 `*.workers.dev` 域名在**中国大陆地区已被屏蔽阻断**，直接请求会出现连接超时或失败。
>
> **解决方法**：在 Worker 设置页进入 **Settings** -> **Domains & Routes** -> **Custom Domains**，绑定在 Cloudflare 托管的自定义域名（例如 `tg.yourdomain.com`）。在转换器界面的反向代理地址栏填入该域名即可正常使用。
