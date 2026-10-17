# Objectives v2 Step 1 独立对抗审阅

审阅者：独立代理 `/root/step1_adversarial_review`。审阅日期：2026-10-18。

## 当前结论

**最新生产复审：R1–R6 全部关闭，candidate-08 已审代码没有剩余静态 must-fix。raw 0.2 T6 的质量差异已定位为声明的前二朝向近似边界；其最终性能专项已裁决为显著的量化阶段风险，可继续验收，但完整语料性能、旧测试迁移与全套执行闭环仍未完成，不能给出整体验收结论。** 本记录不代表完整验收或最终合入批准。

审阅只读生产代码、测试和已有验证材料；未运行 cargo、Node 构建或 Playwright，未修改实现。运行验证由实施负责人持统一令牌完成。以下结论来自独立的静态数据流、数学和标准核查，不以实现者自报测试通过代替代码审查。

## 范围与依据

- 基准：`main=41d6b7d68544601f7a206af69c5b91286a2ed7c9`。
- 不可变候选：`target/objectives-v2-validation/review-candidate-01`；`review-manifest.json` SHA-256：`621209fd57cb8ee7e204ac5bc92c316cd7007f0ed87542c124cd95cf438df4c6`。
- 对 manifest 所列生产文件及相对基准的改动进行了完整通读；测试迁移逐文件对照，新增配置、CURRENT、路由、CLI 和 wasm 验收测试阅读。后续生产修改不自动继承本候选结论。
- 优先依据：用户交接 `C:/Users/jielu/Downloads/codex-handoff-objectives-v3.md`、只读主方案 `objectives-v2-proposal.md` v2.1、逐条回复 `objectives-v2-phase0-reply.md`，及本仓库 gate/implementation-contract。
- 标准基线：`D:/repositories/rnl-dev` 提交 `b5b2b1402045f8b4f0716afd51fbafa87c0a9d8b` 的 0.3 标准，重点 8.5、9.2.4、11.7、13.1/13.3/13.7、14.8、15.2、16.4、17；虚拟件补查 12.1/12.2。

下述代码行号均指 **candidate-01 中的同名文件**，不是移动中的工作树。

## 必须修复

### R1 — P1：附件符号朝向被旧规则覆写，绕开配置计分

位置：`crates/rnl-solver/src/search.rs:1506–1525`、`1653–1664`。

`Search::candidate` 对单成员 Port 类直接选择第一个让 pin 面向宿主的朝向并覆写 `plan.values`；`class_node` 又排除纯 Port 类。这使显式 `symbol_direction` 无法在这些合法虚拟件上选择最低分朝向，且无 Element 的图不进入根搜索。例：一个 R0 下从单 pin 指向框中心为 down 的 TAG，挂接到 left 出线宿主，只配置 TAG 朝 down；旧覆写可强制左右朝向、得分 1，并排除可达的 0 分候选。

依据：交接 Step 1“参数化结构 proposal”“完整配置排序”；v2.1 第 4 步删除隐性固定目标；标准 12.1 第 5 项规定虚拟件独立朝向不跟随主对象出线方向。

修复要求：移除固定覆写，让 Port 自由朝向类也使用完整配置评分的候选排序；无 Element 但存在自由朝向类时也可搜索。Step 1 保留前二截断可以接受。

最小回归：单 pin 自定义 TAG + 侧向宿主，单独 `symbol_direction=down` 得 0；再覆盖纯 Port 图和保留 ORIENT 事实。

状态：实施负责人接受；工作树已修并增加 fixture，待冻结复审。

### R2 — P1：生产硬路由仍固定使用旧 bend/crossing 成本

位置：`crates/rnl-solver/src/route.rs:2135–2148`，与硬 A* 原固定成本路径。

`configured_layout` 直接调用 legacy `hard_layout/route_layout`，只把 `RoutingWeights` 注入软搜索。通常硬阶段成功即停止，因此变更/关闭配置中的 wire_turns、wire_crossings 等项不会作用于生产硬阶段的局部比较。

依据：逐条回复 A02 明确把“新硬阶段成本受配置影响”与“固定旧成本的兼容承诺”分开；A04 和第 4 步不允许关闭项偷偷进入计分。“硬阶段不变”指保留旧障碍、连接/换对重试算法及 legacy seam，不能据此延后生产成本配置。

修复要求：生产硬搜索注入精确有限层级权重；关闭项 primary cost 为 0；保留显式旧成本 seam。允许按约定使用 legacy tie。A02 检查使用相同旧成本模式，不能要求新配置模拟全部旧 EXIT/ALONG tradeoff。

最小回归：同一 Layout 有“短而多弯”“长而少弯”两条可行路线，改变单项/层级后生产硬路线发生对应变化；显式旧成本下，新逐网驱动全硬成功与旧 seam 的 NetOut 和 expansions 相同。

状态：实施负责人接受，路由实施者返工中。

### R3 — P1：先跑完所有硬网络，再补软/兜底，破坏后续网络障碍上下文

位置：`crates/rnl-solver/src/route.rs:1331–1382`、`2143–2217`。

候选先以既定 half-perimeter/anchors/id 顺序完成所有硬路由，再按 problem 顺序处理失败网络的 soft/fallback。于是较早网络的软/兜底输出不进入后续网络的硬搜索障碍；软处理顺序也不等于已定网络顺序。这会改变之后网络的硬成功路径及交叉/沿线局部代价。

依据：主方案第 4 步明确要求软路由输出作为其他网络的线影响后续网络，并单独测试；A02 的全硬成功局部兼容 seam 仍须保留。

修复要求：生产使用既定网络顺序逐网 hard → soft → fallback，把完成几何交给下一个网络；或可证明等价的重路由流程。各网软预算独立于硬预算。

最小回归：先处理的 N1 硬失败但软/兜底完成，后处理 N2 的直接硬路径穿 N1；N2 必须观察到 N1 的其他网几何。改变 problem 存储顺序不能改变已定排序；全硬成功旧成本 seam 不变。

状态：实施负责人接受，路由实施者返工中。

### R4 — P2：切换配置文件及 Restore Defaults 后仍使用旧 defaults

位置：`apps/viewer-ui/solve-settings.js:71`、`83–90`、`117–143`。

defaults 仅在开窗时读取一次。选择或手输新 TOML 路径只改路径，显示值、来源文字和“是否省略 override”的判定仍针对旧文件。例：A 的 beam=2，B 的 beam=8；从 A 切到 B 后界面仍显示 2，保存却不发 beam override，实际 solve 使用 8。Restore Defaults 清空路径也继续显示 A 的值。

依据：Step 1 已要求可用的配置文件选择和标量规则 UI；显示有效值与实际求解不一致不是 Step 3 编辑器扩展事项。

修复要求：路径变化/Restore 时重载对应 defaults/source，保留显式 overrides 和精确文本，保存等待当前路径解析；过期异步响应不能覆盖新路径。

最小回归：fake shell 为 A/B 返回不同默认值，覆盖选择、手输、Restore、已有 override、异步乱序和加载中保存。

状态：实施负责人接受，工作树已修并加回归，待冻结复审。

### R5 — P2：虚拟件所有角色网络被错误映射到物理 pin 0

位置：`crates/rnl-solver/src/structure.rs:1093–1102`；下游 `route.rs:2334–2344`。

去除内置角色名时改成遍历 usage 的所有 role，但每个 Net filler 都插入 `(object, 0)`。合法双端虚拟件 roles a/b、symbol PIN(a)=0 / PIN(b)=1、ATTACH na/nb 会变成 pin 0 同属 na 和 nb，同时漏掉 pin 1 的 nb 身份。该图进入软短路计分和结构邻接，例如 nb 导线穿 pin 0 时会误认为同网而免罚。

依据：标准 12.1 明确 role 即 usage terminal，12.2 明确允许多端虚拟件；runtime `interp/export.rs:360–374` 已导出准确的 object/pin/net 映射。Step 2 的完整 net-table 升级延期并不允许本次新增错误 pin 0 身份。

修复要求：对 usage 使用已导出的逐 pin 网络映射，或严格匹配 role 对应的 symbol pin terminals；不恢复角色名硬编码。

最小回归：双 pin 自定义 usage，na 仅 pin 0，nb 仅 pin 1；nb 线穿 pin 0 的最终 wire_shorts=1。

状态：实施负责人独立核实并接受，工作树已修并加 fixture/回归，待冻结复审。

## 已核查且可接受

| 能力 | candidate-01 静态结论 |
| --- | --- |
| 精确配置 | 原始 TOML span/十进制词素直接进 BigInt 比值；canonical 归一化参数与执行顺序；同级整数分类不受分数 weight 干扰；禁用项/空层剔除；未知字段、非法值及 Step 2 kind 拒绝；宿主 fallback 只允许默认路径 NotFound。 |
| CURRENT 与签名 | final CURRENT 按原 host terminal 导出；bundle 映射后仍保留独立语义端子；显式 direction_written 与生成默认 pin 区别；sig1/sig2 历史投影保留，新增 sig3 纳入新语义。 |
| CURRENT 图 | 原 semantic host 上先 SCC，再 DAG 分层，最后映射 display/bundle；多 direction 候选通过框架旋转 coexist；局部端口保留导出并诊断 inactive。 |
| 无名字结构 | 删除器件/供电/差分名称推理；生产 Rust 字面量 guard；stub 不再从 parent 参数重建 disabled rise/alignment；组归属来自 attached_host。R1/R5 是本项仍需修的具体缺口。 |
| 机制开关 | separate_symbols=false 在候选中归零 Gap/RowsApart/BlocksApart 几何间隙，并关闭 LP overlap/row-gap repair；事实仍先保留。 |
| 几何身份 | 独立 authored/generated wire ID、物理 pin/branch/bend ID、net 集和 source；生成边按身份组件连接；同坐标不同 pin 可输出零长度线；只切分 generated 路段，保留 authored WIRE 原点列及环。 |
| 软阶段与兜底 | 硬/软预算独立，局部 penalty seen-set 防同一对象反复收费；精确比较；兜底使用精确端点、组件逐步连接。R2/R3 修复后需重核调度/权重。 |
| 配置评分 | 排名只用已配置层及 code；容差采用锚定窗口；最终用实际 routing geometry 重算；报表有 canonical/digest、参数、raw/weight/weighted、层总分/容差、estimated/inactive/diagnostics。 |
| 宿主与兼容 | CLI problem/preview/solve 同一 resolver；solve 操作错误为 1、未知 CLI 选项为 2；旧 objectives localStorage 丢弃并一次提示，保留标量。R4 修复后需重核设置交互。 |
| wasm 与 CI | test-solver feature 直接解析 embedded TOML 并真实放置/路由；Node harness 实例化 wasm 并比较完整逻辑解和精确报告，而非仅 compile；config 路径已纳入 Rust/viewer/desktop CI 触发。实际运行结果由统一验证日志确认。 |

明确接受 Step 1 临时语义：旧正面积 symbol overlap；旧逐段 wire short/interior-box overlap；旧 texts_over；旧 bends/异网 crossing；符号包络 area 和新版 aspect；LP 四级及贴 resolution witness；朝向前二；auto WIRE 直线、不写回。symmetry、pin_wire_alignment、orientation_r0、origin_distance、include_wires=true 在本步拒绝，不要求提前实现。

极近端点的 fallback 引出若与无环身份树冲突，接受 D011 的确定性截断/去环优先级：保留不同身份连接与作者线。9.2.4 的出线方向作为正常引导，不据此要求保留必然产生几何回环的固定长度引出；这不是允许一般端点无故忽略方向。后续复审仍需检查新增 hard/soft 逻辑未破坏该边界。

## 非阻塞建议

- 更新 `lib.rs` 的 sig2 示例，以及 objectives/search/score 的旧固定目标、供电器件推理注释；其描述已与运行代码不符。
- 迁移测试中的旧注释（gap_kinds 小数部分、隐式 current depth 等）也应同步；避免仅改断言而留下反向说明。
- 最终证据应绑定最终生产快照和提交，说明哪些测试运行在旧 binary；candidate-01 之前的绿灯不能替代 R1–R5 修复后的定向和完整回归。

## 复审记录

### candidate-02：生产增量复审

`review-manifest.json` SHA-256：`24578866796e0fdd1b2879afaa5bf4e463ed3ad18351931f80db69eedb4e9137`；`production-manifest.json` SHA-256：`451c871ae337e93e73e171504ea299fa0e2c1e1dea4ba8a62a7d47ed183035c3`。清单所有文件 SHA 均重新核对一致。完整阅读相对 candidate-01 的生产增量及对应测试。

- **R1 关闭**：`search.rs` 删除 candidate 阶段 Port 朝向覆写；纯 Port 类由根节点参与完整配置排名；无 Element 但有自由类也启动搜索。单 pin TAG 回归直接验证取 R0 且 raw=0。
- **R2 关闭**：`route.rs:1031` 的 `search_configured` 使用 exact Q；primary 只加已配置 length/turns/crossings，随后 raw length 和 legacy tie。硬障碍语义保留；显式 None 旧成本模式仍走原搜索。`route/tests.rs:547` 以小于 f64 可保留范围的 `2^-1100` turns 权重验证路线选择反转；`:522` 比较全硬成功多网 seam 的完整输出和工作数。
- **R3 关闭**：`route.rs:2346` 逐网按共同 `net_order` 完成 hard/soft/fallback；完成线条 mark 到同一硬 grid 再处理下网。`:723` 新分数坐标轴段标记保持精确交叉/端点/共线区分，不重建 lattice；新增回归覆盖 soft、fallback、反向存储顺序及离格点段。
- **R5 关闭**：`structure.rs:1093` 对 usage 读取 runtime 的逐物理 pin 网络，不再合到 pin 0；双端虚拟件测试验证独立 membership 及 nb 线穿 na pin 的最终 short=1。
- **额外 rank 修复通过**：零容差快速分支仅比较配置的层数，none 配置忽略残留 score slice，纯 code 决胜。旧 joins-counter 断言改为纯 code 顺序，原容差窗口断言保留。
- 已读取集中验证日志 `step1-review-current-02.log`（9/9）、`step1-review-route-01.log`（30/30）、`step1-review-score-01.log`（5/5）；这些是执行者日志证据，审阅者未自行编译。

**R4 保持开放（candidate-02 的 `apps/viewer-ui/solve-settings.js`）：**

1. `read` 在约 136 行仅用 `explicit.has(key)` 决定发送。host defaults 的 tolerance 是 `1/1000000`（`apps/desktop/src/solve.rs:84`），但 `options.rs:333` override 只接受十进制。开窗后把 tolerance 改为 0.1，再改回显示的 `1/1000000`，就会发送非法 override 而无法保存。原先相等默认值被省略，这属于本轮显式状态跟踪引入的回归。应提供可解析的精确有限十进制文本或精确转换通道，不能用 JS Number/f64。
2. `answer` 等待 defaults 的代际检查正确，但在随后 `await shell.checkSolverOptions(...)` 期间字段仍可编辑（dialog 只禁用 OK）。校验 A 尚未返回时改为 B，旧校验返回会保存旧 `kept`，丢失用户当前路径/标量值。须在校验完成后核对表单 revision 并重试，或禁用校验期间可变字段。

两处已及时发送实施负责人和 root。现有 A/B 默认值切换、Restore、defaults 乱序/加载中保存测试保持有效；还需补“显示默认重新输入”和“host 校验中编辑”的回归。

### 旧测试失败迁移：待后继候选

独立读取 `step1-solver-lib-01.log`：旧 binary 177/192，通过数不视作修复后结果。实施者提供了逐项原因/选择/替代保障表 `notes/solver-design/objectives-v2-step1-test-migration.md`，目前只是待执行计划。

特别要求保留：tiny-budget 只对 `routing_fallbacks` 对应网放开 through-box 检查，其余 hard 网及全部身份树/事实不放开；正常 hard 引出方向失败不能使用 D011 极近 fallback 例外；旧精确布局测试的替代固定 frame 必须通过明确 PLACE/ORIENT 事实构建，不暗设 witness，不修改原始输入或通用 case helper。candidate-02 新 0.3 fixture 有来源及变换清单，原 0.2 测试保留并新增独立 0.3 覆盖。最终测试增量及固定布局评分工具尚待复审。

### candidate-03-ui：R4 残余关闭

增量基于 candidate-02；`review-manifest.json` SHA-256：`be42421c2d52738233ec05f2f3362cccc0c4f48bf8bd70bcef948ab56767dbd0`。三个文件 hash 全部独立核对一致。

`written` 用 BigInt 检查分母仅含 2/5 因子，再做精确有限长除，显示值可原样输入十进制 override，未经过 Number/f64；超过 f64 精度的默认值回输回归检查完整文本。表单 revision 覆盖 input/change、文件选择和 Restore；host 校验返回后若 revision/path 改变，重新等最新 defaults 并校验，不会保存旧 `kept`。慢校验 A→B 回归要求第二次校验 B 后才保存。

**R4 静态复审关闭。** 截至这一增量，已审生产修复没有剩余 must-fix；浏览器执行日志尚待统一验证提供，最终测试迁移/评分工具和验收结论仍未审结。

后续执行证据：独立读取 `target/objectives-v2-validation/step1-gates/P0-settings-r4-02-ui03.log` 与对应 JSON，Chromium 9 项、WebKit 9 项，共 18/18 通过，进程 exit=0。包含精确默认值回输、默认值异步乱序、加载中保存及 host 校验中切换路径。R4 已完成执行闭环。

### candidate-04-tool：固定记录评分工具，覆盖校验待修

清单 SHA-256：`d7dc21606b0f730d5e22617ce4ac3fe9ddc2aaf5ebbc0851b455f25253fd880b`，四个文件 hash 均独立核对一致。适度审阅 `crates/rnl-solver/tests/unit/current.rs:238–343` 的 test-only 评分入口及其旧 T1 输入、输出与执行日志。

可接受部分：原始 problem 与 runtime previous 通过稳定身份映射既有 placed/wire 记录；所有样本共享同一 effective config；未调用 search/place/route，8.5 resolve 只作为原始事实及结构基底。最终从固定几何执行真实 `active.report`，输出精确 FractionReport。PreviousWire 不携带端点身份，因此输出顶点使用独立 Bend；这与 Step 1 的形状/网络计数兼容，但工具不得据此宣称完成 Step 2 身份计数验收。

验收证据缺口已发送实施负责人：输入解释的 sink errors 未拒绝，且仅检查 previous 存在/签名兼容，未确认自由坐标和朝向由记录完整覆盖。缺失字段会静默保留新 resolve witness，结果不能称为纯旧解评分。应拒绝解释错误，并报告/校验覆盖情况；未覆盖且不能由原事实唯一确定的可计分自由量应拒绝或明确排除。此项属于验收工具可靠性，未发现相应生产回归；待小增量和回归证据后复审。

### candidate-05-coverage：评分工具覆盖缺口静态关闭

清单 SHA-256：`14bf216cd96f1f92bdf26cb98c527315abe873888cedb0596f65e4d64e9f886c`；两个文件 hash 独立核对一致，增量完整阅读。两次解释的 error 均产生 N/A；缺失自由轴或朝向使整层 N/A，并输出 missing/excluded/逐对象证书。证书只接受 solver record、保留且 as-written 的直接常量、由已覆盖父对象递归求值的 Position 关系；未把普通 LP witness 或 ALIGN 当作唯一解。作者线重建不再 filter_map，避免漏计和按原 wire ID 索引 compact Vec 的错位。

静态缺口关闭，新增完整/缺轴/缺朝向回归和批评分覆盖统计仍待集中执行。N/A 必须在最终对比表明确显示，不能转成 0 或称为完整评分。此工具只验证 Step 1 定义。

### driver-migration-review：测试增量复审，执行与出口诊断待闭环

清单 SHA-256：`766f288cd9e066c052c984bc3c31019a444ca364db0c8540fd34344a718e814d`；before/after 及八份 fixture hash 全部独立核对，完整阅读 22KB 测试增量。保留原通用 raw-input helper；历史 frame 通过显式 PLACE/ORIENT 加入，并断言原有 kept 列表不变及新增事实全部保留。固定 frame 测试只证明该机制，不再证明自由布局的旧质量。

迁移有据：tiny-budget 仅按精确 route+net 的 soft/fallback 报告放开穿框，其他轴/身份/树检查不变；结构 orphan 例外仍受 Port+Generated+无 attachable pin 约束和有限精确清单限制；T3 只在目标 out 网络要求正长度，保留其他网零长度身份连接；T5 显式选择原七对象，T6 用固定几何 x/id 邻居替换私有 candidate row；作者 WIRE 保留精确形状并补独立 1 short/1 body 夹具。原 raw facts/readback/determinism 保障继续存在。两项长测试被主动中断，不能算通过。

固定 T3 的 XU1:inp 与 VB:p 沿框边偏离 direction 提示，不能套 D011 fallback 例外。标准 9.2.4 说 direction 是提示；更高优先级交接能力表明确将“对自己的框只许沿引脚方向出框”列为 Step 2。因此可接受 Step 1 有限 legacy EXIT/tie 近似，但需保留：同 Layout 的 None/Some 诊断、open/blocked-exit 微夹具、其余 pin 原出口断言，以及两个具体例外首段沿自己框边且不穿内部的几何断言。禁止仅按 label 全局忽略。最终代码及执行证据待复审。

### candidate-06-performance：新实测风险与无损表示增量

同 raw 0.2 T6 的端到端记录约 6.342→305.568 秒。独立读取内部报告亦为 3.066→173.051 秒，A* 工作 13045→177821、LP pivots 3252→8943、routed 候选仍为 4，不能仅用并行墙钟噪声解释。root 授权进行定向性能修复，不改目标、预算或搜索策略。

清单 SHA-256：`863eca0edfe0ab504bda627fa4c471c21bb337919adbd65f58692705e2fb58e9`；route.rs/tests.rs hash 一致，完整阅读相对 candidate-02 的增量。HardScale 取 `D=lcm(den(length)*unit,den(turns),den(crossings))`，D 与 lattice unit 均正；weighted 乘 D、raw length/legacy 乘 unit，所以比较与原 exact Q 同构。hard clearance 恒 0，省略不改变字典序。BigInt 无定长溢出；零权重和极小非零权重保留；原 Q 搜索仅留作 test oracle，算法分支、障碍、预算和 state tie 未改。

生产增量静态无 must-fix；分数格点/混合权重/2^-1100 的完整 NetOut+expansion 对照、T6 串行前后计时与完整回归待执行。性能风险尚未因静态等价自动关闭。

### driver-migration-review-02 与路由执行证据

第二份 driver 清单 SHA-256：`2af6644423a44ac31d5fb0e0cdf0c143f128cd4eced7513a96cec71aea1197a6`，全部 hash 独立核对一致。只读比较第一份 after 与第二份 after：ExitViolation 现在保留物理 pin、起点和首个非零段；仅 fixed T3 文件主层允许 XU1:0/VB:0，逐个断言沿自己的 bbox 边且不穿内部，seen 集合必须精确等于这两 pin，其余 pin 仍必须满足方向提示。**测试契约边界静态关闭**，新 driver binary 执行仍待后续。

独立读取 `logs/step1-integer-hard-route-01.log`：32 通过、1 ignored；T3 同 Layout 的 None legacy 为 426 expansions / 0 个出口偏离，configured 为 1461 / 恰好两个。日志逐项记录 bbox/start/next，两个起点均不在框内部，首段均不穿体。open/blocked-exit 原微夹具继续通过。

独立读取 `logs/step1-exact-hard-profile-01.log`：fixed T6 同 Layout 原 Q 2.444586 秒、整数 0.244732 秒，约 9.989 倍；完整 NetOut、分叉顺序和 29378 expansions 相同。执行源码包含 candidate-06 test helper 的借用修正，最终须由后继快照绑定，不能声称不可变 06 原文件原样编译通过。

整 CLI 受控旧 02 记录另为 wall 337.820 秒 / CPU 307.797 秒，新整数 CLI 尚未完成，因此局部 10 倍提升不等于整流程退化已闭环。只读检查支持后续 profile 假设：`search.rs:1373` 每自由类八朝向各计算全配置精确 estimate，含全级碰撞/文字扫描、连接段平方交叉计数；`orient` 逐类执行且更新当前 ori。安全优化应先按阶段和 score_term 计数/计时，再在同一 View 内共享确定相同的几何中间值。跨类缓存不能仅按 class id，必须涵盖变化的 ori/at；不得把全配置评分缩为当前对象局部评分或恢复隐藏朝向偏好。任何优化均需保留完整 Q 层值、八朝向排序及最终输出/work 的 oracle 对照。

后续整 CLI 已完成：同 input/config hash，旧 02 wall/CPU 为 337.820/307.797 秒，整数为 267.626/250.109 秒。独立比较两份输出字节完全相同（SHA-256 `bb59c4ea8920c1bc100b9f9300e31e23b118cb726f43e710e3e669eebb7ccc43`）。这确认无损但未关闭全程性能风险；继续仅在 profile 证据触发的范围检查。

评分覆盖执行闭环：独立读取 `step1-gates/step1-record-coverage-regression-01.log`（1/1）与 `step1-fixed-score-t6-01.log`（1/1）；`fixed-scores-t6/{main,candidate02,integer}.json` 三份均 complete、missing=0，整数与 02 每项相同。main 和 02 的前五层皆 0，首个差异 wire_turns 为 33→59；后者 area 虽变小，也不能解释为完整配置下更优的交换。最终验收应明确这是有限候选搜索的质量退化及其已核查原因，不得以低优先级收益掩盖首个恶化层。

### 全流程 profile 与 T6 最终池排序的独立核查

已读 `step1-gates/step1-isolated-stage-profile-02.log`、`performance-integer-hard/stage-profile.json` 及 test-only `profile.rs`。入口用 Options::solver 忽略生成记录，按生产步骤执行；工作数与 CLI 一致。总 102.351 秒中 search 95.774、coords 5.232、route 1.173、final_score 0.045；4417 次 estimate，其中 orient/ranked_values 分别 94.436/94.351 秒。嵌套计时不能相加。`Search::made` 不包含逐类八朝向估计，因此 71 candidates 不是完整计分次数。

用 Python Fraction 对 JSON 中完整层值和 code 做独立数学重排（未构建/调用 solver）：10 个 placed 的 estimate 顺序与报告一致；4 个 routed 的严格字典序为 `[8,9,0,1]`，chosen=8。P0 候选 8/9 的前三层为 0/0/0，turns 为 59/61；beam 0/1 的 symbol_overlaps=4、wire_overlaps=4，turns 为 35/36，不能越过更高层胜过 P0。因此本例未见最终排序错误。旧固定解可合法、较优但不在有限候选池中；其具体缺席原因仍待旧事实有效性与实际八朝向 trace 证据，不推断全局不可达。

窄优化建议已给实施者：每次完整 View 共享作者线几何、按 object 索引的 bbox/pin、保留原 PointId/点序/Prim tie 的连接及 envelope。仍须各项分别应用 components/solid/owner-stub/nets_of 等原 eligibility；不能统一过滤集合，不能按 kind 缓存不同参数的 raw 分数，也不能跨 class/plan 复用 ori/at 已变化的数据。待冻结实现和完整 Q/八朝向 rank/work oracle 后复审。

### candidate-07-scoring-cache：完整增量复审；R6/P2 待修

清单 SHA-256：`6c7b9b8a7a60f4857afbe1f2096600f292b3864b011a53b77a2d8e3278f0387c`，八文件 hash 全部独立核对一致；完整阅读相对已审候选的生产、oracle 测试和 profile 增量。06 测试借用修正及 T3 None/Some 精确 pin 集合、沿边断言已经纳入该候选。

**R6 — P2 must-fix：退化符号框被误计为正面积重叠。** 位置为该候选 `crates/rnl-solver/src/score.rs:110–113`。缓存的 `ViewGeometry::overlaps` 改用原先用于文字的 `meet` 交叉不等式，和旧 `coords::overlapping` 的 `max(loA,loB)<min(hiA,hiB)` 不等价。反例：A=`[0,0,0,1]`、B=`[-1,-1,1,2]`；旧 x 相交宽度为 0，计 0；新 meet 四个不等式均真，计 1。合法线状/点状符号可以有零宽/零高 bbox，交接 Step 1 明确保留有面积重叠定义，因此不能由性能优化修改。

要求仅缓存 symbol-overlap 路径恢复旧 max/min 判定，并加入零宽、零高、点框包含于普通框的逐 term oracle。不得修改共享 `score::meet` 来顺便改变 label_overlaps 的旧口径。已及时通知实施者及 root，实施者独立确认接受。

其余静态检查可接受：Scoring cache 仅存在于单次 score/report；None 时 author collision 与 Prim estimate 集合分离；Prim 点序、PointId、重复点和 tie 不变；各 term 原 eligibility/inner-pin 豁免保留；同 kind 不同参数仍分别计算，Some(routed) 路径保持原定义。新 oracle 逐 term/full Q/rank/report 对照有实质覆盖；实际 T6 full-search oracle 与旧解事实/八朝向 trace 仍在执行，不能提前称全部等价通过。

### candidate-08-scoring-cache：R6 关闭；T6 质量边界闭环

清单 SHA-256：`6d0e17b8d6614f90aa6bcb65d177c66fe738cd5458cf1ebb3d7fe0f77d589053`，八文件 hash 独立核对一致。相对 07 唯一生产差异是 overlaps 恢复原 max/min 正面积公式，没有改共享 meet。新增零宽/零高/点框含于普通框的八朝向 oracle，通用 oracle 另增加 author 与 ROUTE 同网混合。独立读取 `step1-scoring-cache-degenerate-oracle-01.log`，2/2 通过。**R6 静态与定向执行闭环。**

07 的完整 T6 oracle 已完成：4417 次完整 Q 层数组与旧函数相同，候选 code/层值/route 层值及工作数与 pre-cache 相同；旧记录新增 102 个 PLACE/ORIENT 后全部保留，原 18 个 kept facts 不变。该 T6 的 symbol_overlaps 独占一层，07 每次该层等于旧函数；08 恢复旧函数，因此可复用 07 本例的语义 trace，无须重跑旧 337 秒 CLI。

独立读取全部 544 条真实 ranked_values trace，并用 Fraction 逐条重排，544/544 一致。34 类皆为单成员且 class label=R0。旧解 VB0/VB2/VB3/VB4/VB7 的 MY 根每类 16 次均排第 8（零基 rank=7），从未进入前二；P0 两份的前 34 个朝向均为 R0，故至少 VB0 的旧 MY 既不在 beam 的实际分支也不在 P0。旧整朝向在本次实际有限搜索中缺席，不能归罪最终 rank 错选。

技术裁决：raw 0.2 T6 的 33→59 turns 是明确的 Step 1 前二朝向/固定 sketch 近似局限；旧解合法且在当前完整评分下更优，不能写成更低层 area 的合理交换。用户允许 0.2 绘图质量下降，能力表明确 Step 2 才保证八朝向可达，因此本步不应恢复名字偏好、改预算或追求全局最优来掩盖。最终基准说明应列明此退化和实际证据。

性能仍需最终 08 纯运行证明：07 oracle 多花 73.108 秒 reference.score，不能作为无 oracle 性能数字；后续一次最终 raw T6 CLI 的受控 CPU/墙钟、输出字节和 work 对照可绑定最终生产源码，无须无依据重复旧基准。driver 新 binary 回归及交接全套门禁仍待集中执行。


### 最终 08 的性能风险专项裁决（不代替整体验收）

重新核对交接 v3：第 3 节（原文第 87/89 行）要求 0.2 能读能解且不新增失败，搜索/LP/A* 按工作量计；第 4 节能力表及临时行为（125/170 行）保留 Step 1 朝向前二；第 4/5 节（179/317–322 行）要求全套基准、用时和逐项计分前后并列、解释变化。没有数值倍率门槛，但这不能推导为任意退化都合格。

独立读取最终 `performance-integer-hard/comparison.json`（SHA-256 `55e7588e1e48ccf172fe7382dc1b3a0d2491a92dec763a5ada8066ad594e1bb1`）、原始 CLI stdout/stderr、纯 profile 和资源记录。最终 CLI exit=0，wall=179.946247 秒、CPU=172.203125 秒；受控旧 02 为 337.820340/307.796875 秒，分别改善 1.877/1.787 倍。对先前 main 的 6.342 秒跨轮比约 28.374 倍，只作为退化量级参考，不能写成严格隔离的倍率。最终期间存在其他任务的 CPU 活动，空闲内存由启动前 8.956/8.590 GiB 降到采样的 4.615 GiB；不能宣称机器完全空闲，也不能据此抹去真实的 172 秒 CPU 消耗。

最终 binary SHA-256 为 `97f5ae8745f7c0b8246b0175d39f5525efebf067efb050827a1adbf60efa5c1d`；build-input manifest SHA-256 为 `65b6ccc2a805ad12f54980ff7f635779bf523fcaf1b0590d32fd8f6def491062`，159 项当前文件 hash 全部重新核对一致。02、整数化和最终缓存三份解字节一致（`bb59c4ea8920c1bc100b9f9300e31e23b118cb726f43e710e3e669eebb7ccc43`）。最终 work=2993 resolve nodes / 8943 pivots / 71 candidates / 177821 A* expansions，配置、P0 选择、事实及精确分数不变。

08 纯单层 profile 的总值为 88.844 秒（测试进程 88.96 秒），search=80.893、coords=6.193、route=1.354。ranked_values 占 79.627 秒；16 次 orient × 34 个自由类 × 8 个朝向=4352 次完整配置评分，另 65 次 estimate，共 4417 次。08 与 07 的全部 544 条真实朝向 trace、old-record facts、placed 层数组/code、routed 数组和工作量独立逐项比较相等；最终 CLI 的单层 time=88.746 秒。`solve.rs:364/408` 的原有 0.2 升级前后两次 pass 解释了 raw 0.2 整 CLI 约两倍于最终单层时间，不能把两者混作同一口径。

**专项结论：当前 T6 剩余成本不新增技术 must-fix，可作为显著、已量化的 Step 1 已知风险保留，继续完成阶段验证。** 理由不仅是没有倍率门槛：完整精确配置排序属于已定行为；本例调用数由现有有限朝向/草图循环直接解释；此前两类可局部修复的重复成本已有无损优化和独立 oracle；最终输出、计分、预算和工作不变，未见错误重试、超出既定阶段或不终止的证据。当前再改变采样、启发式、预算或用局部评分替代完整配置，会改变已审语义，不能仅为恢复旧速度混入本轮。

保留边界：4417 只适用于此例，不是所有输入的评分上限；定位了成本不等于证明不可继续无损优化，也不等于性能已解决。最终 T1–T6 与 20 个电路仍须按同一要求完成并解释，若出现新增读/解失败、不完成、异常资源增长或成本无法由有限工作解释，必须重新审查，不能引用本单点裁决一并豁免。最终 PR/验收说明必须突出剩余耗时及适用范围；Step 2 几何和全八朝向实现应沿同基线重新测量，不能预先承诺恢复主干速度。本节只关闭当前已定位 T6 性能风险的代码返工要求，不关闭 driver、新测试执行或交接全套门禁验收。


### 最终 driver 新暴露的 T3 子层出口（证据待闭环）

已读取 `step1-gates/T-driver-final08-corrections-01.log`：4 个定向测试中 3 个通过，原主层精确两 pin 例外检查通过后，严格出口测试在 T3 的 ota5t 子层失败。M1:s 的首正段为 (-8,-7)→(-4,-7)，提示方向为 (0,-1)；62/62 facts 保留，4 placed/4 routed，107 expansions。未把此失败算通过，未修改实现或测试。

静态核查 fixture 第 12 行明确选择 0.2 NMOS；`libraries/standard/0.2/rnl-std-symbols.rnl:112–115` 的 box=[-3,-2,0,2]、source=(0,-2)。M1 的 R0 原点 (-8,-5) 给出实际 box=[-11,-7,-8,-3]，已观测首段是从右下角向框外离开，除起点不碰框。它不同于主层有正长度的沿框边段，`route::runs_along` 对此应为 false，不能无差别复用主层 true 断言。M2 的对称情形只能预测，不能据此提前加入允许集合。

标准边界仍是 Step 1 direction 提示与 Step 2 严格自盒出口。现有几何支持“角点向外而偏离提示”的临时近似分类，但最终裁决待同 Layout 的 None/Some 全部物理 pin、bbox、首段、inside/through 和完整集合诊断。若确认，新增测试须仅在具体 fixture+子层+实际 pin 集合内锁定 corner/outward/除起点不交框，保持主层 along-edge 条件及其他 pin 严格要求；不得仅按名字豁免，也不能把 D011 极近 fallback 当理由。


### T3 ota5t 子层实际诊断裁决

独立读取 `step1-gates/T-t3-ota-exit-diagnostic-01.log`（SHA-256 `ed9da91bd7c33944de9d5bb642f74ea8099d7a327716cd0d632db9f2ff9d3948`）和对应 JSON，及执行源码 `route/tests.rs`（SHA-256 `20a88f9614ba5bad5c09e5e71e138702a25d2b43990f1dcd7100a1aee22d2c4b`）。该诊断完整遍历每根输出线的两个物理端点，None 与 Some 使用同一 fixed Layout。None 为 96 expansions、违例空；Some 为 107、违例恰 `[(0,Some(2)),(1,Some(2))]`，均为 tail 网络的 terminal=s。M1 实际首段 (-8,-7)→(-4,-7)、box=[-11,-7,-8,-3]；M2 为 (0,-7)→(-4,-7)、box=[0,-7,3,-3]。二者 inside/through/along 均 false。其余存在首正段的端点均符合 direction；M3 的两个零长度身份边无可定义首正段，不伪造方向。

**技术裁决：可接受为 Step 1 已声明 direction hint 近似，不新增生产 must-fix。** 本例不是沿自己框边有正长度交集，而是从角点向框外离开，首正段与闭框仅交于起点；严格沿指示方向出自己框属于交接能力表 Step 2。不能使用 D011 fallback 或“配置成本改变”单独作为理由。旧 None seam 仍保留原行为。

已给实施者和验证者的必要测试边界：仅固定 `T3-ota5t.sp` 的 `ota5t` 子层允许 M1:s/M2:s 的物理 pin 2，确认 tail 网络与实际 terminal；违例数恰 2、集合精确相等，其他 pin/层仍严格。各例需断言起点为 bbox 角点、首段非零轴向；本例水平时必须从 x-max 向更大 x 或 x-min 向更小 x，固定 y 是 bbox 边，因此除起点不交闭框，并保留 !inside/!through。不能只用不穿内部代替向外条件。主层两个有正长度沿边的条件保持原样。route 的打印诊断应转为 None 空集/Some 精确物理 key 集合及相同几何回归；96/107 作为实测工作证据，无需额外锁死计步值。

当前诊断 1/1 只是成功运行并产出证据，其源码尚无违例集合/几何回归断言；最终测试迁移增量仍需复审并执行，不能将本裁决写成新 driver 已通过。

### 上游 main 476578a（#92）的证据复用边界

完整读取 `41d6b7d68544601f7a206af69c5b91286a2ed7c9..476578a74010cf37406f15fd82bd978298ad8248`：四文件 85+/5-，唯一生产逻辑改变是 `crates/rnl-edit/src/form.rs` 的 `Op::AddText`，有 key 时不再省略显式 halign=start、valign=baseline、rotate=0；另为测试、README 和 TypeScript 注释。它不改变 runtime 对既有 RNL 的解释、符号或文本测量。

复用依据不是仅无文件交叉。调用链核查：`rnl solve` 在 `crates/rnl-cli/src/solve.rs:534/542` 使用 `rnl_runtime::solution::write_record` 和 `rnl_view::finish_record`，后者直接调用 runtime 的 finish_record；`rnl-view` 无 `rnl-edit` 依赖。CLI 中 edit::write 只在单独 write 命令分支；wasm 的 write 请求独立调用它。现有 T6 profile、固定记录 evaluator 和基准输入只经 interpret/solver/runtime 写回，不经过新的 AddText 分支。固定文本/配置未重生成时，此上游改动不改变已核查的 solver 几何、计分或朝向 trace。

因此允许复用旧 main41 与 candidate08 的固定输入性能/质量证据及技术风险裁决，无须仅因这次 merge 再做 T6 专项长跑。保留原始 commit、binary、input/config hash 和实际测量时间，不能把旧测量改名为 main476 或合并后 binary 的实测；在验收说明注明调用路径等价的复用理由。合并后仍应核对 solver/runtime/render/config 与相关固定输入未变，按计划重建 CLI 绑定新 revision 并执行最终完整门禁。若冲突处理改变上述路径，则重新评估。使用新 AddText 导出而变化的文本、editor 往返、wasm write 行为不在此复用结论内；其正确性由更新后的相应测试和全门禁覆盖。
