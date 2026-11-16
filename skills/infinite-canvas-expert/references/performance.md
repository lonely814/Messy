# 无限画布性能优化手册

实测背景：FastAPI + 原生 JS 节点画布（DOM/SVG 渲染，单文件 canvas.js ~16k 行）。所有数字来自真实基准：2-4MB 噪点 PNG + 混合节点类型。**空节点基准不成立**——空节点下 render() 数字好看，用户装上真图立刻打回原形。

## 基准方法论

1. 造真实负载：噪点图（压缩后仍 2-4MB）、混合节点类型、真实分布密度。
2. 量这四个数：悬停命中耗时、render() 耗时、renderLinks 耗时、小地图每帧耗时。
3. 用 performance.now() 打点 + DevTools Performance 火焰图对照；N 取 100/200/400 三档看曲线形状（线性还是平方）。
4. 改一件 → 复测同一基准 → 数字说话。不要在 commit message 里写没复测过的数字（错数据被用户抓过一次）。

## 四大热点：病根与修法

### 1. mousemove 命中测试（悬停卡）

病根：每次 mousemove 全量遍历连线 O(C·N)，遍历中读布局属性触发强制 reflow。

修法（实测 悬停 N=100/200/400：15.48 → 0.29ms，超线性变平坦）：
- 节点 id→DOM 索引 `nodeById` Map，杜绝按 id 全树 querySelector。
- 端口坐标缓存，**按帧失效**（rAF 开头清 dirty），不是按时间失效。
- 连线几何从数据模型取，不走 getBoundingClientRect。

遗留示例（供对照）：连线悬停仍是 mousemove O(28×连线数) + elementFromPoint——量小可容忍，量大时上空间索引（quadtree/R-tree，领域通识）。

### 2. render() 全量重建（节点多卡死）

病根：任何小改动触发全量重建 DOM + lucide 图标全文档重扫 O(N²)。

修法（实测 render() 88.7→3.6ms @N=100、632→25.9ms @N=400；后期复测 57 节点 0.3ms、500 节点 0.9ms）：
- 增量渲染：每节点内容签名（`RENDER_EPOCH` + `dataset.renderSig`），签名未变直接复用 DOM，只重建变化的节点。
- 图标刷新限定容器：`refreshIconsWithin(subtree)`，绝不 `document.querySelectorAll` 全扫。
- 平移缩放走 CSS transform，不重建任何节点。

**增量渲染注入陷阱**：增量更新按 key 复用 DOM，外部往 render() 里"捎带"注入新标签无效——新元素必须直接增删 DOM，并挂进 `if(rebuiltAny)` 分支。

### 3. 小地图（每帧 O(N²)）

病根：每帧 querySelector 全 DOM 取节点位置。

修法（实测 15.45→3.55ms）：小地图几何**从数据模型读**，不碰 DOM。
遗留示例：平移时小地图 innerHTML 全量重建——数据源改对了但重建方式仍全量，量大时同样套 render signature。

### 4. wheel/拖拽掉帧

病根：每个事件同步重排，无合并。

修法：
- rAF 合并：事件只记 dirty，rAF 里统一计算一次、重绘一次（实测 renderLinks 18.5→3.78ms）。
- 缩放平滑/缓动参数/捏合 1:1 直映 → 详见 interaction.md 滚轮缩放（主归属）。

## JS 修完之后：合成层

实测剩余瓶颈：60 节点带 115 图，平移约 46fps——JS 已无关，卡在浏览器合成。检查项目里 `contain` / `content-visibility` / `will-change` 出现次数，0 处 = 药方开了没抓药。节点容器加 `contain: layout style`，平移层提 `will-change: transform`（只给真正每帧动的层，滥加反而多吃显存）。

## 图像与内存

- 图懒加载 + 解码后离屏释放（已验证足够：JS 堆 25-41MB @500 节点）。
- 大图 LOD：缩略图先行、原图按需（拖拽中只画缩略图）。
- **节点禁用 backdrop-filter**：位置固定的面板可以毛玻璃（模糊算一次复用）；节点平移时每帧重模糊，必卡。要磨砂感用伪毛玻璃：半透明渐变底 + 1px 内侧高光 + 下缘暗线，无 filter。注意级联：后置压平段可能盖掉高光层。

## 何时收手（实测依据，别凭直觉加活）

- 连线 ≤30 条：不做视口裁剪——transform-only 平移会留空洞，收益测不出。
- 节点几百个：不做虚拟化——索引 + 增量渲染已达标，虚拟化引入的 DOM 复用 bug 代价更高。
- 先量再改，改一件验一件。用户要的是"流畅不卡顿"，验收标准是真实数据下的手感，不是架构美感。
