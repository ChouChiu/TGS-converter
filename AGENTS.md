# AGENTS.md

本文件为开发与协作 Agent 在此代码仓库中的工程开发规范与设计指引。

## 开发原则

1. **接口核查优先**：调用任何接口或共享模块前，务必查阅实际类型定义与源码实现，不推断或假设参数、返回值及异常处理逻辑。
2. **充分复用已有模块**：新增逻辑前优先检索 `src/shared/lib`（文件处理、压缩解包、存储、TGS 解析等）与 `src/shared/ui`，避免重复实现。
3. **保持架构分层清晰**：严格遵循 Feature-Sliced Design（FSD）分层边界：
   - `shared` 不能引用 `features` 或 `app`；
   - `features` 彼此独立，不能互相跨模块引用，跨功能协作由 `app` 层或 `shared` 抽象统一组织；
   - 外部调用仅能从各 feature 的顶层入口（`index.ts`）导入，内部实现文件不直接暴露。
4. **验证驱动交付**：任何改动完成后，必须运行 `bun run check`（规范与格式检查）和 `bun run test`（测试套件），并为新增或重构的关键路径补充自动化测试。
5. **最小必要修改**：避免大范围无关格式化或非必要的扩散性修改，保留既有有效注释，保持改动精准聚焦。

## 架构与分层说明

- **app** (`src/app`)：应用根入口、Provider 包装（`I18nProvider`、`TooltipProvider`）、主页面布局以及各功能切片间的协同调度。
- **features** (`src/features`)：独立业务功能切片：
  - `convert-stickers`：格式选择、贴图转换流水线调度、离屏渲染与 Web Worker 编码线程池。
  - `upload-stickers`：文件拖拽上传、ZIP 解包与 Telegram Bot API 贴图拉取。
  - `download-results`：转换结果预览、动图播放控制、单项下载与批量 ZIP 打包。
- **shared** (`src/shared`)：项目通用底座：
  - `config`：体积阈值、规格上限等静态配置（`limits.ts`）。
  - `model`：全局通用数据类型（`types.ts`）。
  - `lib`：通用工具函数（`archive.ts`、`files.ts`、`i18n.tsx`、`storage.ts`、`tgs.ts`、`utils.ts`）。
  - `locales`：国际化语言字典（`zh-CN.json`、`en-US.json`）。
  - `ui`：通用基础组件与图标库。

## 性能与资源控制

- **解压防护**：所有 TGS 均经由 `src/shared/lib/tgs.ts` 检查 gzip 头部与解压上限，防御 ZIP 炸弹。
- **帧渲染调度**：使用离屏 Canvas 逐帧光栅化，每 12ms 通过 `scheduler.yield()` 或 `setTimeout(0)` 切分时间片，确保主线程交互流畅。
- **Worker 并发编码**：密集计算（WebP、GIF、APNG）全部在 Web Worker 中执行，通过 Transferable 传递帧缓冲；任务取消时及时释放资源。
- **内存及时清理**：转换完成或取消时，及时销毁 Lottie 实例、终止空闲 Worker、通过 `URL.revokeObjectURL` 回收内存。
- **多语言对齐**：所有用户界面可见文案必须同步维护至 `zh-CN.json` 与 `en-US.json`。

## 常用命令

- 依赖安装：`bun install`
- 本地开发：`bun dev`
- 规范与类型检查：`bun run check`
- 自动格式化与修复：`bun run check:write`
- 测试运行：`bun run test`
- 生产构建：`bun run build`
