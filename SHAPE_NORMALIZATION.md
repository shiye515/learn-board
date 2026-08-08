# AI 图形标准化：实现、运行与排障手册

本文是交给后续开发者和 Luna 模型的实现约束与排障记录。修改图形标准化功能前，应先阅读本文，再阅读对应代码和测试。代码是最终事实来源；若本文与代码不一致，应先确认差异，不要凭旧提案恢复已经淘汰的实现。

## 当前结论

生产模型固定为 `@cf/mistralai/mistral-small-3.1-24b-instruct`，提示版本为 `shape-normalization-v6-rounded-contours`。服务端直接通过 Cloudflare 原生 `env.AI.run` 调用模型，并显式传递 data URL 图片和 `guided_json`。

当前参数：

- 服务端截止时间：20 秒
- 客户端截止时间：25 秒
- 常用符号矢量阶段最大输出：768 Token
- 自动重试：0 次
- 已知图形置信度门槛：`0.80`
- 常用符号置信度门槛：`0.85`
- 单次请求最多 8 条笔画、512 个简化点、64 KiB 的 256×256 PNG

模型、提示版本、超时和限制常量集中在 `src/whiteboard/normalization.ts`。不要在组件、服务端函数或测试里复制这些值。

## 端到端流程

1. 用户选择一条或一组样式一致的笔画，点击选框右侧外部、顶部对齐的标准化按钮。
2. 浏览器只提取选中笔画，将坐标转换为选区局部单位坐标并简化，同时生成只包含选中路径的黑白 PNG 预览。
3. 类型化 TanStack Start POST 服务端函数再次校验载荷并执行两级限流。
4. `.server.ts` 推理模块通过 `cloudflare:workers` 读取 `env.AI`，使用第一阶段扁平 Schema 分类。
5. 已知图形只返回分类，由本地确定性几何代码重建；`common-symbol` 才触发第二次 AI 调用，生成受限矢量 DSL。
6. 所有模型输出都经过 Zod 严格校验。响应回来后，客户端还会验证源笔画指纹，防止迟到响应覆盖用户的新编辑。
7. 成功结果作为一次原子文档提交替换原笔画，保留颜色、粗细、视觉边界、撤销/重做和自动保存行为。
8. 无法识别、低置信度、无效输出、超时、限流或服务错误都只显示 Toast，原图保持不变。Toast 应在约 4 秒后自动消失。

## Luna 必须遵守的实现边界

### 仅服务端边界

- `cloudflare:workers`、`env.AI`、模型提示和推理实现只能存在于 `.server.ts` 服务端模块。
- 浏览器不得直接调用 Workers AI REST API，不得持有 Cloudflare 凭据，也不得接收模型原始响应。
- 客户端只能通过类型化 TanStack Start 服务端函数获得经过校验的公开结果。
- 修改后必须审计 `dist/client`，确保客户端包中没有模型名、提示版本、`guided_json`、`cloudflare:workers` 或图片 data URL 组装逻辑。

### 原生 Workers AI 调用

- 当前可靠路径是 `env.AI.run` 配合模型原生 `guided_json`，不是 AI SDK Provider。
- 不要重新引入 `ai` 或 `workers-ai-provider`，除非先新增真实回归测试并证明 Provider 能把该模型需要的结构化输出参数正确映射为 `guided_json`。
- 模型输入同时包含简化点数据和 `image_url` data URL。图片是选区专用预览，不是完整白板截图。
- 结构化响应仍必须由 Zod 解析；`guided_json` 不能替代应用层校验。

### 两阶段输出

第一阶段必须保持扁平、紧凑：

```ts
{
  recognizable: boolean
  category:
    | 'circle'
    | 'ellipse'
    | 'square'
    | 'rectangle'
    | 'triangle'
    | 'parallelogram'
    | 'pentagon'
    | 'hexagon'
    | 'five-point-star'
    | 'common-symbol'
  symbolName: string
  confidence?: number
}
```

- 不要把已知图形分类、`unsupported` 联合类型和完整矢量 DSL 合并进一个巨大的首阶段 Schema。实践中这会提高超时、空结果和错误选择 `unsupported` 的概率。
- `category === 'common-symbol'` 时才执行第二阶段矢量生成，以减少延迟、Token 和复杂度。
- Mistral 可能正确识别图形但省略 `confidence`。当 `recognizable === true` 且置信度缺失时，服务端使用 `0.9`；不可识别时使用 `0`。不要因为可选置信度缺失而丢弃正确分类。
- 已知图形的公开响应仍应标准化为 `{ kind: 'known-shape', shape, confidence }`。

### AI 判断与本地几何的职责

- 图形类别交给 AI 判断，不建立本地分类器，也不要在 AI 给出高置信度结果后增加一套本地轮廓分类来否决它。
- 本地代码负责安全校验、确定性重建、尺寸与样式保持、复杂度上限以及原子替换。
- 已知图形由本地策略生成规整路径。常用符号的 AI 矢量 DSL 仍必须执行坐标、段类型、路径数、段数和采样点数校验。
- 若 AI 无法判断或结果未通过安全校验，显示“暂时无法识别这个图形，已保留原图”，不得修改文档或历史记录。

## 已验证的失败模式

| 现象                                                      | 根因                                                                         | 处理结论                                                              |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Kimi K2.6 每次约 30 秒超时                                | 模型在当前多模态结构化任务中响应过慢                                         | 不作为当前生产模型                                                    |
| Mistral 将明显矩形返回为 `unsupported` 或输出不可解析文本 | 通用 Provider 发送了 `response_format`，没有按模型原生接口发送 `guided_json` | 改为原生 `env.AI.run`                                                 |
| 去掉 `unsupported` 后矢量生成仍超时                       | 首阶段 Schema 同时承担分类和复杂 DSL 生成                                    | 拆为“扁平分类 + 按需矢量”的两阶段调用                                 |
| 模型返回 `rectangle`，服务仍判为无效                      | 模型省略了可选语义的 `confidence`，旧 Schema 要求必填                        | 允许缺省并对可识别结果使用 `0.9`                                      |
| PNG 大小偶发误判                                          | Base64 末尾填充字节未扣除                                                    | 字节数按 Base64 padding 精确计算                                      |
| 模型结构化输出对元组坐标不稳定                            | 部分模型或 JSON Schema 实现对 tuple 支持不一致                               | 模型侧 Schema 优先使用简单对象坐标；应用内部类型可继续使用元组        |
| Mistral 返回短说明或类 JSON 文本                          | `guided_json` 输出偶尔在 JSON 外包裹解释，首阶段直接 JSON.parse 会误报无效   | 仅提取文本中的分类字段，再交给同一 Zod Schema；不从几何数据本地猜类别 |
| AI 已识别，客户端仍拒绝旋转矩形或粗糙轮廓                 | 本地相似度门使用不同坐标尺度，或使用轴对齐假设否决旋转形状                   | 已知图形不再增加本地分类否决门；只做重建和安全约束                    |

排障时先判断问题位于哪一层，不要同时改模型、提示、Schema、几何重建和 UI：

- `timeout`：模型或网络未在 20 秒内完成。
- `provider-error`：原生绑定调用失败或平台返回错误。
- `invalid-output`：模型响应存在，但未通过严格 Schema。
- `unsupported`：AI 明确无法识别。
- `low-confidence`：AI 给出候选，但置信度低于门槛。
- UI 显示成功但形状错误：重点检查本地重建和坐标映射，而不是分类调用。

## 安全日志

服务端日志可以包含：

- `requestId`
- 模型和提示版本
- 笔画数、点数
- 延迟
- 结果类别
- 置信度分桶
- 分类后的错误代码

禁止记录原始点、PNG/Base64、完整提示、模型原始响应、来源 IP、世界坐标、白板文档或便签内容。排查 `invalid-output` 时只能记录响应字段名和字段类型等脱敏元数据。

一个成功的矩形请求应出现类似日志：

```text
model: @cf/mistralai/mistral-small-3.1-24b-instruct
promptVersion: shape-normalization-v6-rounded-contours
strokeCount: 1
resultKind: known-shape
confidenceBucket: 0.9
```

## 本地真实 AI 测试

```bash
pnpm install
pnpm dev
```

在 `http://localhost:3000/` 打开白板，画一个接近矩形、三角形或圆形的闭合轮廓，切换到选择工具，选中路径并点击标准化按钮。

本地真实 AI 冒烟测试仍会调用 Cloudflare 远程 Workers AI，消耗账户配额并可能产生费用。未配置或未认证 `AI` 绑定时，应用应返回 `unavailable`，不得用本地假结果冒充成功。

验收时同时观察：

- 浏览器 Toast 是否先显示处理中，再显示成功或非破坏性错误，并自动消失。
- 原粗糙路径是否被规整路径替换，宽高、位置、颜色和粗细是否基本保持。
- 服务端日志是否包含安全元数据，且没有点数据、图片或原始模型响应。
- 撤销是否恢复原路径，重做是否恢复同一标准化结果且不再次调用 AI。

## 回归验收清单

至少手工测试以下场景：

- 近似矩形、旋转矩形、正方形、三角形、圆形、椭圆、多边形和五角星。
- 一种可识别的生活符号，确认第二阶段生成的多路径或曲线路径安全可用。
- 一条随意涂鸦，确认显示无法识别 Toast 且原图不变。
- 请求过程中移动、删除或重新绘制选中路径，确认迟到响应不覆盖新状态。
- 超时、限流、绑定不可用和模型无效输出，确认都不产生历史记录。
- Toast 自动消失，按钮忙碌状态恢复，白板其他工具仍可操作。

提交前运行：

```bash
pnpm format:src
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm wrangler deploy --dry-run
git diff --check
```

再执行客户端泄漏审计：

```bash
rg -n "mistral-small|shape-normalization-v6|guided_json|cloudflare:workers|data:image" dist/client
```

预期没有命中。若命中，先确认是否为普通 UI 文案；任何绑定、提示或推理实现进入客户端包都必须修复。

## 模型或提示变更规则

只有满足下列条件才更换模型或显著修改提示：

1. 使用固定的真实手绘样本集复现当前问题。
2. 记录候选模型的正确率、无法识别率、错误替换率、P50/P95 延迟和超时率。
3. 验证候选模型支持视觉输入和原生 `guided_json`。
4. 保持不自动重试、不静默回退模型，并完成成本评估。
5. 同步修改模型常量、提示版本、测试夹具、本手册和 OpenSpec 工件。

不要只凭单个成功样本切换模型，也不要通过降低所有安全门槛掩盖结构化输出问题。

## Cloudflare 配置与部署

`AI_ACTOR_RATE_LIMITER` 按 `cf-connecting-ip` 与操作名组合限制为 20 次/60 秒；`AI_COLO_RATE_LIMITER` 按固定操作 key 限制为 120 次/60 秒。Cloudflare Rate Limiting 是位置局部且最终一致的，不能作为精确计费计数器；缺少来源头时使用 `unknown`，不能绕过限制。

两个 namespace ID 位于 `wrangler.jsonc`。若与账户已有 namespace 冲突，应在 Cloudflare 账户内重新分配唯一 ID，再运行 `pnpm cf-typegen`。项目沿用 Cloudflare 后台关联 `main` 分支的部署流程，不新增 GitHub Actions，不改变 TanStack Start Worker 入口或应用模型。

官方资料：

- [Workers AI + Wrangler 入门](https://developers.cloudflare.com/workers-ai/get-started/workers-wrangler/)
- [Workers AI 模型列表](https://developers.cloudflare.com/workers-ai/models/)
- [Mistral Small 3.1 24B Instruct](https://developers.cloudflare.com/workers-ai/models/mistral-small-3.1-24b-instruct/)
- [Workers AI 的 AI SDK 配置](https://developers.cloudflare.com/workers-ai/configuration/ai-sdk/)
