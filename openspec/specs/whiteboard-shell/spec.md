# whiteboard-shell Specification

## Purpose
TBD - created by archiving change replicate-ziteboard-whiteboard. Update Purpose after archive.
## Requirements
### Requirement: Full-viewport whiteboard shell
系统 SHALL 以白板工作区替换现有 Demo 页面，并让工作区占满可见浏览器视口且不产生页面级滚动条。

#### Scenario: Open root route
- **WHEN** 用户打开根路由
- **THEN** 系统显示白色画布、顶部状态条、右上工具栏和右下视图控制，且不显示原 Learn Board 导航、标题或卡片

### Requirement: Reference visual geometry
系统 SHALL 在 `1312×872`、100% 浏览器缩放的基准视口中，以参考页测量值呈现约 20px 顶部状态条、48px 圆形主工具按钮、16px 工具间距、细灰边框与轻阴影。

#### Scenario: Desktop screenshot comparison
- **WHEN** 在基准 Chrome 视口截取初始白板页面
- **THEN** 工具栏锚定右上、视图控制锚定右下，主要区域的位置和尺寸落在定义 token 的 2px 容差内

#### Scenario: Active tool appearance
- **WHEN** 用户切换到任一可用工具
- **THEN** 该工具按钮使用参考页一致的深色激活面与反色图标，其他工具保持浅色圆形按钮

#### Scenario: Pen options screenshot
- **WHEN** 在 `1312×872` 基准视口展开画笔设置
- **THEN** 系统显示与画笔按钮对齐的三列属性面板、三档宽度和黑蓝红色点，且画布内容不发生布局位移

#### Scenario: More menu screenshot
- **WHEN** 在 `1312×872` 基准视口打开更多菜单
- **THEN** 系统显示约 224px 宽的全高右侧抽屉和覆盖剩余画布的半透明遮罩

#### Scenario: Disabled control appearance
- **WHEN** 撤销、重做或未实现入口当前不可用
- **THEN** 控件使用浅灰禁用视觉、不响应执行操作，并向辅助技术暴露禁用状态

### Requirement: Responsive control layout
系统 SHALL 在窄屏和触控设备上保持所有核心工具可到达，且画布不被工具栏永久遮挡。

#### Scenario: Narrow viewport
- **WHEN** 视口宽度小于 768px
- **THEN** 核心工具收纳为可展开工具组，状态条和视图控制保持可见且不存在横向页面滚动

#### Scenario: Mobile visual baseline
- **WHEN** 在 `390×844` 基准视口打开初始白板
- **THEN** 顶部只直接显示最重要的 48px 工具入口，其余工具可从菜单访问，右侧视图控制保持完整可操作

### Requirement: Tool flyouts and menu
系统 SHALL 为画笔属性、更多工具和白板操作提供与触发按钮对齐的浮层，并支持点击外部或 Escape 关闭。

#### Scenario: Open pen options
- **WHEN** 用户再次点击已激活的画笔按钮或其展开控制
- **THEN** 系统显示粗细与颜色选项，当前值具有清晰选中状态

#### Scenario: Dismiss flyout
- **WHEN** 浮层已打开且用户点击浮层外部或按 Escape
- **THEN** 浮层关闭但当前白板工具保持不变

### Requirement: Explicit availability status
系统 SHALL 将尚未实现的协作或专业版入口显示为禁用，并提供“暂不可用”的可感知说明。

#### Scenario: Inspect unavailable collaboration item
- **WHEN** 用户打开更多菜单并聚焦邀请或同步视图入口
- **THEN** 入口不可执行网络操作，且视觉及辅助技术均能识别其禁用状态

### Requirement: Independent product identity
系统 MUST 使用项目自有或中性的产品名称、Logo、SVG 图标和文案，不得复制 Ziteboard 商标、品牌标题、私有素材或服务身份。

#### Scenario: Inspect rendered assets and network
- **WHEN** 用户打开白板、画笔面板和更多菜单
- **THEN** 界面不显示 Ziteboard 品牌资产，且不向 Ziteboard 域名请求白板功能数据或素材

### Requirement: SSR-safe document shell
系统 SHALL 由 TanStack Start 服务器输出完整 HTML 文档和稳定的白板加载骨架，同时将 Canvas 与浏览器 API 限制在客户端执行。

#### Scenario: Request initial HTML
- **WHEN** 客户端 JavaScript 尚未执行时请求根路由
- **THEN** 响应包含 head、body、脚本挂载点和与最终布局同尺寸的白板骨架，且服务器不访问 window、document 或 Canvas API

