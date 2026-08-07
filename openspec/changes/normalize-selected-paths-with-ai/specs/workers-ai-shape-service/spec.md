## ADDED Requirements

### Requirement: Workers AI 必须位于仅服务端边界之后
系统 SHALL 仅从 `.server.ts` 服务端模块通过 `cloudflare:workers` 的 `env.AI` 绑定调用 Cloudflare Workers AI，并 SHALL 通过受现有 CSRF 中间件保护的类型化 TanStack Start 服务端函数向浏览器公开该操作。

#### Scenario: 浏览器请求标准化
- **WHEN** 客户端提交符合条件的归一化路径载荷
- **THEN** POST 服务端函数 SHALL 校验载荷、执行应用限流并通过 Worker 绑定调用 Workers AI

#### Scenario: 审计客户端包
- **WHEN** 检查生产构建产物
- **THEN** 客户端包中 SHALL 不包含 Cloudflare 绑定访问、模型提示、Provider 配置和服务端推理实现

### Requirement: 请求载荷最小化且必须校验
服务 SHALL 只接受选区局部归一化点元组、有界几何元数据和选区专用单色 PNG 预览，并 MUST 在推理前拒绝非有限、超大、格式错误或超出范围的输入。

#### Scenario: 有效的简化载荷
- **WHEN** 请求包含不超过 8 条笔画、总计 512 个有限归一化点、有界宽高比，以及不超过 64 KiB 的 256×256 PNG 预览
- **THEN** 服务 SHALL 接受该载荷进入限流检查

#### Scenario: 超大或格式错误的载荷
- **WHEN** 请求超过笔画、点或预览大小限制，预览不是 256×256 PNG，包含非有限坐标、未知字段或无效边界元数据
- **THEN** 服务 SHALL 拒绝请求，且不调用 Workers AI

#### Scenario: 隐私检查
- **WHEN** 检查发送到推理服务的输入
- **THEN** 输入 SHALL 只包含选区局部点、宽高比和选中路径单色预览，且 SHALL 不包含完整白板文档、世界坐标位置、便签文本、本地存储内容、笔画 ID、时间戳、颜色、笔画粗细或凭据

### Requirement: AI 返回结构化图形描述符
服务 SHALL 通过 Workers AI Provider 使用 AI SDK 结构化输出 Schema，返回 `known-shape`、`common-symbol` 或 `unsupported` 可辨识结果；已知图形包含 `five-point-star`，常用符号无需预先枚举名称但 MUST 携带受约束的单位坐标矢量模板。

#### Scenario: 有效模型响应
- **WHEN** Workers AI 返回符合 Schema 的输出
- **THEN** 服务 SHALL 向客户端返回类型化描述符

#### Scenario: 模型返回额外或格式错误的数据
- **WHEN** 模型输出未通过 Schema 校验、已知图形包含不支持的标签，或常用符号缺少有效矢量模板
- **THEN** 服务 SHALL 返回类型化无效结果，且 SHALL 不向客户端转发原始输出

### Requirement: AI 矢量模板必须安全且有界
服务 SHALL 只允许常用符号模板使用有限的 `move`、`line`、`quadratic` 和 `cubic` 段；`symbolName` MUST 是 1–64 字符小写 ASCII slug，模板 MUST 不超过 8 条路径、32 个总段和 512 个预估采样点。每条路径 MUST 以且只能以一个 `move` 开始并至少包含一个可绘制段；端点 MUST 位于 `[0, 1]`，控制点 MUST 位于 `[-0.25, 1.25]`。

#### Scenario: 有效的常用符号模板
- **WHEN** AI 返回符合语法、坐标和复杂度限制的一条或多条路径
- **THEN** 服务 SHALL 返回经过规范化和校验的 `common-symbol` 结果

#### Scenario: 模板包含不可执行内容
- **WHEN** 模型尝试返回 SVG/HTML、脚本、URL、事件处理器、白板元素、未知字段或其他 Schema 外内容
- **THEN** 服务 SHALL 拒绝完整结果，且 SHALL 不解析、执行或转发这些内容

#### Scenario: 模板复杂度或坐标越界
- **WHEN** 矢量模板包含非有限或越界坐标，或超过路径、段数、名称长度或预估采样点上限
- **THEN** 服务 SHALL 返回类型化无效结果

### Requirement: 分类使用固定且有界的推理设置
服务 SHALL 使用生产模型 `@cf/meta/llama-4-scout-17b-16e-instruct`、`shape-normalization-v1` 提示、零温度、最多 2048 个输出 Token、8 秒截止时间和非流式结构化对象生成，并 SHALL 通过 Zod Schema 和模型的 `guided_json` 能力约束输出。服务 MUST 将 AI SDK `maxRetries` 设为 `0`。

#### Scenario: 生产推理使用固定模型
- **WHEN** 服务处理图形标准化请求
- **THEN** 服务 SHALL 通过 Workers AI `AI` 绑定调用 `@cf/meta/llama-4-scout-17b-16e-instruct`，且 SHALL 不在运行时静默切换到其他模型

#### Scenario: 模型接收多模态选区输入
- **WHEN** 服务调用 Llama 4 Scout
- **THEN** 提示 SHALL 同时包含简化归一化点和 256×256 选区单色预览，并 SHALL 指示模型保持预览中的方向与路径拓扑、不确定时返回 `unsupported`

#### Scenario: 重复分类同一测试夹具
- **WHEN** 在相同模型和提示版本下重复提交集成测试夹具
- **THEN** 响应 SHALL 符合相同的可辨识联合 Schema；常用符号结果 SHALL 始终满足矢量模板限制

#### Scenario: 模型无法满足结构化输出
- **WHEN** Llama 4 Scout 无法生成符合 `guided_json` 和 Zod Schema 的完整非流式结果
- **THEN** 服务 SHALL 返回类型化无效结果，且 SHALL 不使用未校验文本、自动重试或调用备用模型

### Requirement: 服务故障必须类型化且有界
服务 SHALL 将绑定不可用、超时、限流、Provider 和校验故障转换为类型化结果，并 SHALL 不向浏览器暴露 Provider 堆栈信息或密钥。

#### Scenario: AI 绑定不可用
- **WHEN** Worker 未提供已配置的 AI 绑定
- **THEN** 服务 SHALL 返回不可用结果，且不尝试推理

#### Scenario: 推理超过超时时间
- **WHEN** 推理未在 8 秒服务截止时间内完成
- **THEN** 服务 SHALL 返回超时结果，并 SHALL 忽略任何迟到结果

#### Scenario: 达到 Workers AI 平台限流阈值
- **WHEN** Workers AI 报告限流状态
- **THEN** 服务 SHALL 返回适合非破坏性 UI 反馈的 `rate-limited` 结果

### Requirement: AI 调用受到两级费用保护
服务 SHALL 在载荷校验通过后、调用 Workers AI 前，使用 Cloudflare Rate Limiting 绑定执行单来源和单位置总量限制；任一限制失败时 MUST 不调用 AI。

#### Scenario: 单来源达到应用限制
- **WHEN** 同一 `cf-connecting-ip` 在同一 Cloudflare 位置 60 秒内已获准 20 次标准化推理
- **THEN** `AI_ACTOR_RATE_LIMITER` SHALL 拒绝后续请求并返回类型化 `rate-limited` 结果

#### Scenario: 单位置达到应用总量限制
- **WHEN** `shape-normalization` 固定 key 在同一 Cloudflare 位置 60 秒内已获准 120 次标准化推理
- **THEN** `AI_COLO_RATE_LIMITER` SHALL 拒绝后续请求并返回类型化 `rate-limited` 结果

#### Scenario: 请求来源头缺失
- **WHEN** 请求不包含 `cf-connecting-ip`
- **THEN** 服务 SHALL 使用共享 `unknown` actor key，且 SHALL 不绕过单来源限制

#### Scenario: 限流标识隐私
- **WHEN** 服务使用来源地址作为 Rate Limiting key
- **THEN** 服务 SHALL 不将该地址写入日志、模型输入或客户端响应

### Requirement: 图形推理可观测性不得包含绘图数据
服务 SHALL 记录分类后的运行遥测数据，但不记录原始选中点、选区预览图、生成的提示内容、来源地址、白板坐标或文档数据。

#### Scenario: 记录成功推理
- **WHEN** 推理完成
- **THEN** 日志 SHALL 只包含请求 ID、模型和提示版本、笔画和点数量、延迟、结果类别及置信度分桶

#### Scenario: 记录失败推理
- **WHEN** 校验、限流或推理失败
- **THEN** 日志 SHALL 包含请求 ID、延迟和分类错误代码，但不包含原始载荷、预览图或 Provider 响应内容

### Requirement: Cloudflare 配置和开发流程可复现
项目 SHALL 在 Wrangler 配置中声明 `AI`、`AI_ACTOR_RATE_LIMITER` 和 `AI_COLO_RATE_LIMITER` 绑定、为两个 Rate Limiting 绑定分配账户内唯一 namespace ID、生成绑定类型，并记录本地集成测试使用经过认证的 Cloudflare 推理服务。

#### Scenario: 生产 Worker 被构建
- **WHEN** 项目执行 Cloudflare 生产构建
- **THEN** 生成的 Worker SHALL 能解析全部三个绑定，并通过服务端推理模块的类型检查

#### Scenario: 开发者运行真实 AI 冒烟测试
- **WHEN** 开发者选择在本地运行集成冒烟测试
- **THEN** 测试 SHALL 使用经过认证的远程或已部署 Workers AI 绑定，并 SHALL 明确说明推理用量可能产生费用
