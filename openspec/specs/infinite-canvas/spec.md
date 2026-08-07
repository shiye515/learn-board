# infinite-canvas Specification

## Purpose
TBD - created by archiving change replicate-ziteboard-whiteboard. Update Purpose after archive.
## Requirements
### Requirement: Infinite world coordinate system
系统 SHALL 使用独立于屏幕像素的世界坐标保存所有白板元素，并允许画布向任意方向平移而不裁切文档元素。

#### Scenario: Draw after panning
- **WHEN** 用户平移到远离初始原点的位置并绘制笔划
- **THEN** 笔划以正确世界坐标保存，返回该区域后仍位于绘制位置

### Requirement: Anchored zoom
系统 SHALL 支持 10% 至 800% 的连续缩放，并以鼠标指针或多指手势中心作为缩放锚点。

#### Scenario: Mouse wheel zoom
- **WHEN** 用户在画布某一点执行带修饰键的滚轮缩放
- **THEN** 该世界坐标点在缩放前后保持位于同一屏幕位置，缩放值不超出允许范围

#### Scenario: Pinch zoom
- **WHEN** 触控用户执行双指捏合
- **THEN** 系统同时更新缩放和平移，使手势中心下的内容稳定跟随

### Requirement: View navigation controls
系统 SHALL 提供放大、缩小、回到初始视图和适配全部内容的视图控制。

#### Scenario: Reset view
- **WHEN** 用户点击回到初始视图
- **THEN** 视口恢复为 100% 缩放和初始平移位置，但白板文档内容不改变

#### Scenario: Fit content
- **WHEN** 用户点击适配内容且白板存在元素
- **THEN** 系统调整视口，使全部元素在保留安全边距的情况下进入可见区域

### Requirement: High-DPI rendering
系统 SHALL 根据设备像素比设置 Canvas backing store，并保持 CSS 坐标、输入坐标和渲染坐标一致。

#### Scenario: Retina display
- **WHEN** 设备像素比大于 1 或窗口移动到不同像素比的屏幕
- **THEN** Canvas 重新调整内部尺寸并清晰重绘，已有元素的视觉位置和尺寸不跳变

### Requirement: Unified pointer input
系统 SHALL 通过 Pointer Events 支持鼠标、触控笔和触摸，并在活动手势期间捕获指针和处理取消事件。

#### Scenario: Pointer leaves canvas during stroke
- **WHEN** 用户按下并绘制后将指针移出画布再释放
- **THEN** 系统正确结束或取消该笔划，不留下持续绘制或卡住的工具状态

#### Scenario: Stylus pressure
- **WHEN** 触控笔事件提供有效压力值
- **THEN** 画笔使用压力调节线宽，并在无压力数据时回退到所选固定线宽

### Requirement: Interactive rendering performance
系统 SHALL 通过动画帧合并和点采样简化，在包含 500 条普通笔划的基准文档上维持流畅的平移和绘制反馈。

#### Scenario: Draw on populated board
- **WHEN** 基准文档包含 500 条平均 100 个采样点的笔划且用户继续绘制
- **THEN** 当前笔划在下一动画帧内出现，输入处理不因同步持久化阻塞

