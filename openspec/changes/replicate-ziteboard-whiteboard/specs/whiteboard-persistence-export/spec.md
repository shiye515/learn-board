## ADDED Requirements

### Requirement: Local automatic persistence
系统 SHALL 在文档或视口变化停止 300ms 后，将版本化白板文档和视口写入浏览器本地存储，且保存过程不阻塞绘制帧。

#### Scenario: Autosave after edit
- **WHEN** 用户完成一次文档编辑并停止操作至少 300ms
- **THEN** 最新文档和视口被持久化，界面显示已保存或失败状态

### Requirement: Restore last local board
系统 SHALL 在白板初始化时恢复最近一次有效本地文档和视口，并在恢复完成前避免覆盖存储内容。

#### Scenario: Reload page
- **WHEN** 用户绘制内容、等待保存并刷新页面
- **THEN** 系统恢复全部已保存元素、工具属性和视口位置

### Requirement: Storage version and corruption handling
系统 SHALL 为持久化数据包含 schema 版本，并在数据损坏或版本不受支持时安全打开空白板而不使应用崩溃。

#### Scenario: Corrupt stored payload
- **WHEN** 本地存储包含无法解析或校验失败的数据
- **THEN** 系统隔离该数据、显示非阻塞恢复提示，并允许用户在空白板继续工作

### Requirement: Storage fallback
系统 SHALL 优先使用 IndexedDB，并在其不可用时回退到 localStorage；两个后端均不可用时仍允许内存内编辑。

#### Scenario: Persistent storage unavailable
- **WHEN** 浏览器拒绝 IndexedDB 和 localStorage 写入
- **THEN** 白板功能继续工作，保存状态明确提示本次内容不会在刷新后保留

### Requirement: PNG export
系统 SHALL 将所有白板内容按紧致世界坐标包围盒加 32px 边距渲染为白色背景 PNG，并通过用户触发下载。

#### Scenario: Export populated board
- **WHEN** 用户在非空白板选择导出 PNG
- **THEN** 浏览器下载包含全部元素且不包含工具栏、选择框或状态 UI 的 PNG 文件

#### Scenario: Export empty board
- **WHEN** 用户在空白板选择导出 PNG
- **THEN** 系统禁用导出或给出空白板提示，不下载无意义文件

### Requirement: Local-only privacy boundary
系统 SHALL 在本阶段仅向本地浏览器存储写入白板内容，且不因自动保存或导出向远程服务发送文档数据。

#### Scenario: Save and export without collaboration
- **WHEN** 用户执行自动保存或 PNG 导出
- **THEN** 操作仅访问浏览器本地能力，不发起包含白板文档内容的网络请求
