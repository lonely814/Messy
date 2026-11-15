---
name: libtv-boost-dev
description: libtv-boost 油猴脚本（liblib.tv/iblib.tv 画布增强）的功能开发、实测与发布流程，含 Motif 组件复刻子流程。凡在 libtv-boost 目录下工作，或涉及该插件任何功能改动（模型选择、生成光效、桌宠、积分换算、链路高亮、节点对齐、标签、画布主题、账号切换、提示词面板、AI 增强等）、给出 motif.sweetretry.com 链接要求复刻到站点、或报告插件 bug 要修，先读本 skill 再动手。
---

# libtv-boost 开发流程

给 liblib.tv / iblib.tv 商业画布（React Flow + Mantine 7）做增强的 Tampermonkey 油猴脚本。仓库是 Messy 的子目录，零依赖：没有 package.json，构建与测试全用 node 原生。本 skill 只存**流程与纪律**；站点坑位、版本状态等**事实**去 memory 档案查（见末节），不要在这里复制——事实会过时，流程才会沉淀。

## 项目布局

| 文件 | 角色 |
|---|---|
| `src/inject.js` | 主体注入代码，页面里实际跑的逻辑全在这 |
| `src/style.css` | 全部样式，构建时逐行转字符串数组 |
| `src/main.js` | 油猴壳：脚本头元数据 + CSS/JS 占位符 |
| `build.js` | 零依赖构建：VERSION 单源、占位符替换、div 平衡自检 |
| `test-*.js` | node 原生测试：glow / model-select / pie-align / pet-pack / step-algo |
| `libtv-boost.user.js` | 构建产物，随仓库提交，是油猴 @updateURL 的指向 |

版本号只改 `build.js` 顶部 `VERSION`；产物里的版本经 `__VERSION__`/`__LT_VER__` 占位符在构建时注入，**不要手改产物**。

## 迭代与发布（两阶段，版本号只随收尾走）

**迭代期（用户未收尾）**：改完 → `node --check` + 对应测试 → `node build.js`（div 平衡自检在这一步）→ IAB 实测。**不动 VERSION、不写 README 日志、不 push**；每个修复可单独 commit 便于逐项归因（信息不带版本号，如 `libtv-boost：修复 xxx（未发布）`）。期间用户油猴仍跑旧版，属预期。

**收尾发布**：用户明确说收尾/可以了/肯定/上线/发版，才走完整清单（把这批迭代累计的改动一次性升版）：

1. `build.js` 顶部 `VERSION` 改为新一版
2. `README.md` 更新日志加条目（新条目放最上，汇总本批改动）
3. `node --check src/inject.js && node --check src/main.js`
4. `node test-glow.js && node test-model-select.js && node test-pie-align.js && node test-pet-pack.js && node test-step-algo.js`（改哪块至少跑对应的，全跑也不亏）
5. `node build.js`
6. commit（格式 `libtv-boost X.Y.Z：中文摘要——细节`）→ push

push 即发布：`@updateURL`/`@downloadURL` 指向 raw.githubusercontent main 分支，用户油猴自动检查更新。版本号是稀缺资源：**迭代不升版，收尾才升**——否则用户每条反馈都上线一版，线上版本号虚高（1.25.1–1.25.4 一天四版的教训）。

## 实现纪律

- **不碰站点 React 树**。交互接管走"覆盖层代理"：原位盖自己的面板（rect 对齐原生弹层），从站点 DOM 解析数据，点击转回原生元素 `.click()`——选中/关闭全走站点管线。接管的关键前提（转发是否被站点接受）实测不过就**停工汇报**，不做半吊子 CSS 兜底。
- **纯逻辑进纯函数块**：`/* __lt_<名>_pure_begin__ */ … __lt_<名>_pure_end__ */`，块内禁引 DOM；测试从标记提取后 `new Function` 实例化断言（参照 test-model-select.js，克隆 test-glow.js 的 harness）。新逻辑先写纯函数 + 断言再接 DOM。
- **HTML 字符串模板开闭成对核对**：少一个闭合，浏览器解析会把后续面板吞进前一个区块（1.26.1 关于页空白的教训）；build.js 的 div 平衡自检只兜全文件总量，局部成对要自己核对。
- **所有插值过 `_ltEsc`**；localStorage 开关用 `_lt_<key>` 命名，读取用 inline `try/catch`。
- **z-index 分层**（基准详见 memory `liblib-mantine-zindex`）：站点 Mantine 弹层 200/300；脚本常驻悬浮件 150；脚本面板段 10000x；用户面板 99999+。
- **覆盖层内禁用 scrollIntoView**（它连带滚动所有可滚动祖先，列表会整体跳掉），只滚动自己的列表容器，用 `scrollTo({behavior:"auto"})` 瞬间落位。
- 设置面板重构只动 chrome，**控件 id 与处理器保持不变**；新开关进 toggles 数组，默认开，存 `_lt_<key>`（"1" 开 "0" 关）。
- 代码注释记"为什么"，坑位细节记 memory；两者都不记的等于没发生过。

## 实测纪律（真实注入链路，合成事件不算数）

1. `node build.js` 出最新产物。
2. 内嵌浏览器（IAB）打开/刷新 liblib 画布页，**前台标签页**（后台被节流，探针读数不可信）。
3. 注入构建产物（liblib 无 CSP，一次性注入生效）。
4. 点击路径必须用 **CUA 真实鼠标事件**——合成 `.click()` 不带 pointer/focus 事件序列，永远测不出"真实点击触发站点外点关闭"这类 bug（1.25.4 教训，靠事件日志器 + CUA 才复现）。
5. 断言用 computed-style 探针（颜色/rect/文本），不用截图（截图面会超时）。
6. evaluate 只收单表达式，多语句包 IIFE。
7. **turn 边界 tab 会释放**：每个回合开始重新核对 tabs 清单并重新认领，别假设上个回合的句柄还活着。
8. CUA 点击前先确认目标行可见：列表滚动后 `getBoundingClientRect` 可能是负值，点到 `<html>` 上等于外点关闭，会误判成 bug。
9. 破坏性测试绝不碰用户真实画布；需要造数据先确认。

## Motif 复刻子流程

用户给出 motif.sweetretry.com 组件文档链接 + liblib 元素圈选时（已验证三次：生成光效、模型选择、设置面板）：

1. WebFetch 文档页，提取交互模型（布局、状态、键盘行为、动画语义）。
2. 对照圈选 DOM 确认可解析性。接管型（替代站点交互，如模型选择）找稳定钩子属性（如 `data-model-select-dropdown`）并确认行结构无虚拟滚动；附加型（盖在站点特征上，无站点交互可接管，如生成光效挂在生成中节点的内联 blur）找稳定的附着点特征。
3. 进 plan mode 出计划；关键决策 AskUserQuestion 拍板（作用范围、默认开关、失败策略），别自作主张。
4. **Step 0**：写码前把方案里未验证的风险点在真机实测（接管型如点击转发是否被站点管线接受；附加型如附着特征是否稳定出现）。失败即停工汇报，换路线或放弃——这条是用户拍板的纪律。
5. 实现 → 本地测试 → IAB 实测（按上节）→ 用户反馈逐条迭代 → 收尾发布（按发布清单）。

视觉复刻技巧：别硬编码颜色，从站点原生抽层——`getComputedStyle` 逐项复制背景/圆角/边框/模糊/阴影/文字色，随站点主题走。

## 反馈修复循环

用户报 bug 时按序：

1. 先查 memory 坑位档案（末节）——不少"bug"是站点已知行为或已修项，勿当新 bug 重修（如触发器标签只显示版本段 "2.0" 是站点藏图标行为，不是解析丢了）。
2. 复现优先：CUA 真实事件重演 + 事件日志器定位是哪个事件关掉了什么；合成事件复现不了不等于没有。
3. 修 → 本地测试 → IAB 实测 → commit（不升版、不 push）；用户收尾后统一走发布清单升版上线。

## 事实查询路由（本 skill 不存事实）

| 查什么 | 去哪 |
|---|---|
| 模型选择接管/设置面板的站点坑位 | memory `model-select-takeover` |
| 实测授权与注入链路细节 | memory `live-test-needs-real-injection` |
| z 层级基准 | memory `liblib-mantine-zindex` |
| 已修/有意不修清单（审查勿重报） | memory `audit-findings-2026-11-03`、`review-findings-2026-11-08` |
| 生成覆盖层（完成时序、reduce-motion、后台节流） | memory `generation-overlay-feasibility` |
| 桌宠素材格式（pet.json）与 Codex 包 | infinite-canvas-projects skill 的 mayi.md 桌宠章节 |
| 逐版变更 | README 更新日志与 git 历史 |

## 维护纪律

- 新坑位/新结论**当场**追加进对应 memory 文件，不要只留在会话里。
- 流程本身被证伪（某步实测不出问题、某纪律不再适用）→ 修本 skill，并说明为什么。
- 站点改版导致的事实变化（模型名单、马甲名、DOM 结构）只更新 memory，不动本 skill。
