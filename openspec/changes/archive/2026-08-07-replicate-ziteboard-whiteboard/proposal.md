## Why

当前应用仍是展示 TanStack Start 能力的学习看板 Demo，与用户需要的在线白板产品不符。需要以 Ziteboard 当前繁体中文界面为视觉与交互基准，将入口页替换为可实际绘制、编辑和导航的全屏白板，同时保留现有 TanStack Start 应用模型与部署方式。

## What Changes

- **BREAKING**：移除现有 Learn Board 的 Board、Focus、Settings Demo 页面、导航和示例数据，根路由改为全屏白板工作区。
- 像素级还原 Ziteboard 的白色无限画布、顶部连接状态条、右上圆形工具栏、右下视图控制及浮层视觉。
- 视觉验收覆盖桌面初始态、画笔设置展开态、更多菜单展开态、工具激活/禁用态和移动端工具栏，而不只比较空白初始页面。
- 提供自由画笔、橡皮擦、便签/文本、框选、移动画布、撤销、重做和清空白板等核心工具。
- 提供画笔颜色、粗细和工具激活状态；支持鼠标、触控笔及单指/多指触控输入。
- 提供无限画布的缩放、平移、回到初始视图与内容适配视图。
- 使用浏览器本地存储恢复白板内容和视口；提供可下载的 PNG 导出。
- 保持白板交互为客户端能力，TanStack Start 根文档继续由服务器输出；白板路由采用适合 Canvas/browser API 的选择性 SSR 边界。
- 本次不实现 Ziteboard 的账号、付费功能、服务端持久化或实时多人协作；邀请、仅查看和同步视图入口以禁用/说明状态呈现，避免伪装为已实现功能。
- 复刻限于布局、交互模式和视觉语言；产品名称、Logo、图标和文案使用项目自有或中性资产，不连接或冒充 Ziteboard 服务。

## Capabilities

### New Capabilities

- `whiteboard-shell`: 全屏白板页面的像素级视觉结构、响应式布局、工具栏、状态条和浮层行为。
- `infinite-canvas`: 无限画布坐标系、绘制渲染、平移、缩放、命中测试和高 DPI 适配。
- `whiteboard-editing-tools`: 画笔、橡皮、便签/文本、框选、移动、撤销、重做、清空和键盘快捷键。
- `whiteboard-persistence-export`: 本地自动保存、恢复、版本容错及 PNG 导出。

### Modified Capabilities

<!-- 无现有 OpenSpec 能力需要修改。 -->

## Impact

- 删除或替换 `src/routes` 中现有 Demo 路由，以及对应的示例 server functions、schema 和样式。
- 新增白板领域模型、Canvas 渲染器、输入控制器、工具状态、历史记录和持久化模块。
- 根路由文档壳、路由 SSR 策略和全局 CSS 将调整为全视口应用布局。
- 预计使用原生 Canvas 2D、Pointer Events、ResizeObserver、localStorage/IndexedDB 与浏览器导出 API；优先不引入重量级白板框架。
- 不改变 Vite、TanStack Start、TanStack Router 或 Node/srvx 的构建和部署模型。
- 视觉基线采用固定 Chrome 视口和状态清单；实施阶段须将参考图与本地结果保存到测试目录，避免外部页面变化导致验收漂移。
