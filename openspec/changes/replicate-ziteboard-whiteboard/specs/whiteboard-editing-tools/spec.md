## ADDED Requirements

### Requirement: Freehand pen tool
系统 SHALL 提供自由画笔，并允许选择至少三档线宽及黑、蓝、红三种参考颜色。

#### Scenario: Draw a stroke
- **WHEN** 画笔激活且用户按下、移动并释放指针
- **THEN** 系统实时显示连续笔划，并在释放时将一条带颜色、宽度和点集的 stroke 元素提交到文档

### Requirement: Eraser tool
系统 SHALL 提供能够命中并删除笔划或笔划片段的橡皮擦，且操作可撤销。

#### Scenario: Erase a stroke
- **WHEN** 橡皮擦路径穿过已有笔划
- **THEN** 命中部分从画布消失，并作为一个原子历史操作记录

### Requirement: Note and text editing
系统 SHALL 允许用户在世界坐标位置创建、编辑和移动纯文本便签。

#### Scenario: Create note
- **WHEN** 便签工具激活且用户点击空白区域并输入文本后确认
- **THEN** 系统在点击位置创建便签元素，并保留文本、位置和尺寸

#### Scenario: Cancel empty note
- **WHEN** 用户创建便签但未输入非空内容即取消
- **THEN** 系统不向文档或历史记录添加元素

### Requirement: Selection and transform
系统 SHALL 支持点击和矩形框选一个或多个元素，并允许移动或删除所选元素。

#### Scenario: Marquee selection
- **WHEN** 选择工具激活且用户从空白处拖出选择框
- **THEN** 与选择框相交的可编辑元素进入选中状态并显示选择边界

#### Scenario: Move selection
- **WHEN** 用户拖动已选择元素
- **THEN** 所有选中元素按相同世界坐标偏移移动，并产生一个可撤销历史操作

### Requirement: Pan tool and temporary pan
系统 SHALL 提供显式平移工具，并允许用户在其他工具激活时通过 Space 临时进入平移。

#### Scenario: Temporary space pan
- **WHEN** 用户按住 Space 并拖动画布后释放 Space
- **THEN** 视口完成平移并自动恢复之前激活的编辑工具

### Requirement: Undo and redo history
系统 SHALL 对添加、擦除、编辑、移动和清空操作维护最多 100 步可逆历史，并正确维护按钮可用状态。

#### Scenario: Undo and redo edit
- **WHEN** 用户完成一次编辑后依次执行撤销和重做
- **THEN** 文档先恢复编辑前状态再恢复编辑后状态，视口本身的平移缩放不进入文档历史

#### Scenario: Branch history
- **WHEN** 用户撤销后执行新的文档编辑
- **THEN** 系统清除原重做分支并将新编辑设为最新历史状态

### Requirement: Clear board safeguard
系统 SHALL 在清空非空白板前要求确认，并将确认后的清空作为单个可撤销操作。

#### Scenario: Cancel clear
- **WHEN** 用户选择清除全部但在确认界面取消
- **THEN** 文档、历史和视口均不改变

### Requirement: Keyboard shortcuts
系统 SHALL 提供撤销、重做、删除、画笔、橡皮、选择和平移的键盘快捷键，且在文本编辑时不拦截文本输入快捷键。

#### Scenario: Undo shortcut outside editor
- **WHEN** 焦点不在文本编辑器且用户按平台对应的撤销快捷键
- **THEN** 系统执行一次白板撤销

#### Scenario: Shortcut while editing text
- **WHEN** 焦点位于便签文本编辑器且用户输入普通字符或编辑快捷键
- **THEN** 输入由文本编辑器处理，不意外切换白板工具

