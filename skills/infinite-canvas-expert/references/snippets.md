# 代码片段库（写法与思路存档）

与手册并行：手册收「手法与判据」，本文件收**可直接参考的代码写法**。每段 ≤15 行、带来源 `file:line`、附一行思路说明。抄录自 `_repos\` 下的克隆仓库，复核时直接看原仓。持续补充。

## 来源仓库许可速查（片段许可随来源仓，复制前必查）

| 仓库 | License | 复制约束 |
|---|---|---|
| tldraw | tldraw 自有 source-available | 学思路可以，搬代码进产品受限 |
| excalidraw / fabric / konva / quickdraw / mind-map / leafer / toonflow / grida / ComfyUI-Local-Infinite-Canvas / ComfyUI-Infinite-Canvas / DirectorsConsole / basketikun / dim0 / opencove / thoughtdag / TapCanvas | MIT | 可复制，保留版权声明 |
| ComfyUI_frontend | GPL-3.0（内嵌 litegraph MIT） | **片段有传染性，只学思路勿复制** |
| ComfyTV | README 自述 GPL-3.0 与 MIT 矛盾 [未验证] | 复制前先裁决 |
| X6 / LogicFlow / InvokeAI | Apache-2.0 | 可复制，保留声明 |
| AI-Canvas-tauri（10k stars 转 MIT 前）/ BeefTV | Source-Available | 只学思路 |
| tigerowo | AGPL-3.0 | **传染性最强，只学思路勿复制** |
| TapCanvas 的 new-api 子模块 | AGPL | 勿碰 |
| make-real | package.json MIT 但注释自称 AGPL [未验证] | 复制前先裁决 |
| ic / mayi / wanvas | 用户自有项目 | 自由使用 |

使用规则：片段是**思路参考**不是可复制粘贴的成品——引用前看本表与所在函数完整逻辑。

## 分类索引

- 渲染与缓存（13）：tldraw ×2、excalidraw ×3、fabric ×1、quickdraw ×1、leafer ×1、AI-Canvas-tauri ×1、InvokeAI ×1、tapcanvas ×2、grida ×1
- 命中与拾取（4）：konva ×2、fabric ×1、tldraw ×1
- 坐标与变换（1）：basketikun ×1
- 交互手感（5）：mind-map ×1、grida ×4
- 状态与历史（2）：grida ×2
- 任务与网络（11）：quickdraw ×2、basketikun ×1、X6 ×2、ComfyUI_frontend ×1、toonflow ×2、tapcanvas ×3

注：tldraw 与 mind-map 工作树为空（仅剩 .git），源码取自 `_tmp\tldraw-src\`、`_tmp\mindmap-extract\` 的 `git archive HEAD` 快照，来源行号即仓库内路径行号。补充批次（14 段：ComfyTV ×4、ComfyUI-Local-Infinite-Canvas ×3、ComfyUI-Infinite-Canvas ×3、DirectorsConsole ×1、tigerowo ×2、258-Canvas ×1）见文末一~六节，未计入上表分类索引。

## 渲染与缓存

### 环形 HistoryBuffer：computed 增量重算的底座（tldraw）

```ts
getChangesSince(sinceEpoch: number): RESET_VALUE | Diff[] {
  for (let i = 0; i < this.capacity; i++) {
    const offset = (this.index - 1 + this.capacity - i) % this.capacity // 从最新写入位向旧端环形回扫
    const elem = this.buffer[offset]
    if (!elem) return RESET_VALUE // 空槽 = 历史断层 → 退化为全量重算
    const [fromEpoch, toEpoch] = elem
    if (i === 0 && sinceEpoch >= toEpoch) return EMPTY_ARRAY
    if (fromEpoch <= sinceEpoch && sinceEpoch < toEpoch) { // 覆盖该 epoch 的条目起，拼接其后全部 diff
      const result = new Array(i + 1)
      for (let j = 0; j <= i; j++) result[j] = this.buffer[(offset + j) % this.capacity]![2]
      return result
    }
  }
  return RESET_VALUE
}
```

思路：每个 computed 可挂一个固定容量环形缓冲存 epoch→diff，消费方 `getDiffSince(epoch)` 拿增量、缓冲不连续时拿 RESET_VALUE 优雅退化为全量——这是「derived 支持增量重算」的通用底座，空间索引/查询层都可搭在这上面。
来源：packages/state/src/lib/HistoryBuffer.ts:126-162

### 脏集沿父子/binding 关系闭包扩散到不动点（tldraw）

```ts
        // Step 3: expand to a fixpoint. Any shape whose bounds may have changed
        // can resize its ancestor groups and move arrows bound to it.
        while (queue.length) {
            const id = queue.pop()!

            const record = this.editor.store.unsafeGetWithoutCapture(id)
            if (record && isShape(record) && !isPageId(record.parentId)) {
                markDirty(record.parentId)
            }

            for (const binding of this.editor.getBindingsInvolvingShape(id)) {
                markDirty(binding.fromId)
                markDirty(binding.toId)
            }
        }
```

思路：record diff 先标脏直接变更者，再沿 parent/child（组边界随子形状缩放）与 binding（箭头跟随目标）双向扩散到不动点，另一步（Step 2）沿 transform 扩散到全部子孙——代价 O(affected) 而非 O(页)；配套 `RBushIndex.applyBatch` 旁挂 Map 逐条 mutate，源码注释实测「整树重建即使只有 ~10% 批量也更慢」（RBushIndex.ts:60-77）。
来源：packages/editor/src/lib/editor/managers/SpatialIndexManager/SpatialIndexManager.ts:222-238

### 两级元素缓存的失效传播键：只有几何键变化才删缓存（excalidraw）

```ts
  if (!didChange) {
    return element;
  }

  if (
    typeof updates.height !== "undefined" ||
    typeof updates.width !== "undefined" ||
    typeof fileId != "undefined" ||
    typeof points !== "undefined"
  ) {
    ShapeCache.delete(element);
  }

  element.version = updates.version ?? element.version + 1;
  element.versionNonce = updates.versionNonce ?? randomInteger();
```

思路：`ShapeCache.delete` 同时清两级 WeakMap（roughjs 矢量形状 + 烘焙位图），但 x/y 移动不在键内——形状全部画在元素局部坐标 (0,0)，移动零失效、变换全留给 blit；失效键检查的是「键是否存在」而非值比较。
来源：packages/element/src/mutateElement.ts:129-141

### 整像素对齐 blit：取整对象换成矩阵原点（excalidraw）

```ts
const canSnapElement = (element, appState) => //（类型标注省略）
  !appState?.shouldCacheIgnoreZoom &&
  (!element.angle || isRightAngleRads(element.angle));

      const { a, b, c, d, e, f } = transform;
      context.setTransform(
        a, b, c, d,
        Math.round(a * anchorX + c * anchorY + e) +
          Math.round(a * dx + c * dy + SNAP_TIE_BIAS),
        Math.round(b * anchorX + d * anchorY + f) +
          Math.round(b * dx + d * dy + SNAP_TIE_BIAS),
      );
      drawX = 0;
      drawY = 0;
```

思路：fractional offset 下 GPU canvas 会逐扫描线决定舍入，产生随滚动漂移的双描边/断线；解法是把变换原点精确放到 blit 左上角 round 后的设备像素再在 (0,0) 画，旋转/镜像/缩放留在 a–d，`SNAP_TIE_BIAS=1e-6` 稳定半像素 tie 的舍入方向——round(drawX) 只在 100% zoom 才落在设备像素上。
来源：packages/element/src/renderElement.ts:794-807, 916-947

### 位图重生成键与缩放手势豁免（excalidraw）

```ts
  const shouldRegenerateBecauseZoom =
    prevElementWithCanvas &&
    prevElementWithCanvas.zoomValue !== zoom.value &&
    !appState?.shouldCacheIgnoreZoom; // 缩放手势期间豁免，用旧位图重采样
  if (
    !prevElementWithCanvas ||
    shouldRegenerateBecauseZoom ||
    prevElementWithCanvas.theme !== appState.theme ||
    prevElementWithCanvas.deviceScale !== renderConfig.scale ||
    prevElementWithCanvas.environment !== renderEnvironment ||
    prevElementWithCanvas.imageCrop !== imageCrop ||
    prevElementWithCanvas.containingFrameOpacity !== containingFrameOpacity
  ) {
    // （判空省略）重烘位图并写回 elementWithCanvasCache
  }
```

思路：手势期 `shouldCacheIgnoreZoom=true` 跳过重生成、结束后 debounce 300ms 恢复（App.wheel.ts:166 + resetShouldCacheIgnoreZoomDebounced），用「手势豁免 + 结束重烘」替代 zoom 分桶——源码注释明说这是故意的：缩放中模糊比闪烁好。
来源：packages/element/src/renderElement.ts:740-757

### objectCaching 的 dirty 只增不减冒泡（fabric.js）

```ts
    const isChanged = this[key as keyof this] !== value;
    this[key as keyof this] = value;
    // invalidate caches
    if (isChanged && (this.constructor as typeof FabricObject).cacheProperties.includes(key)) {
      this.dirty = true;
    }
    // a dirty child makes the parent dirty.
    // but a non dirty child does not make the parent not dirty.
    this.parent &&
      (this.dirty || (isChanged && (this.constructor as typeof FabricObject).stateProperties.includes(key))) &&
      this.parent._set('dirty', true);
```

思路：失效模型两套正交机制之一——显式 `cacheProperties` 白名单（fill/stroke/width 等 14 项）触发 dirty，dirty 沿 parent 冒泡且只增不减（非脏子级不清父级脏，父级可能因其他原因脏）；对象级位图缓存失效传播的最小实现。
来源：packages/core/src/shapes/Object/Object.ts:611-628

### 网格墨量恒定渐显：倍频程步长带 + fade 公式（quickdraw）

```js
    let step = GRID_STEP / 2
    while (step * cam.z < GRID_BAND) step *= 2
    while (step * cam.z >= GRID_BAND * 2) step /= 2
    const r = (step * cam.z) / GRID_BAND // 1 → 2 across the octave
    // ink of the in-between marks: lines per px stay constant at r − 1,
    // points per px² at (r² − 1) / 3
    const fade = points ? (r * r - 1) / 3 : r - 1
    const MINOR = 0, MINOR_FADE = 1, MAJOR = 2, MAJOR_FADE = 3
    const passes = [[g.minor, 1], [g.minor, fade], [g.major, 1], [g.major, fade]]
    const lineKind = (i) =>
      mod(i, 2 * GRID_MAJOR) === 0 ? MAJOR : mod(i, GRID_MAJOR) === 0 ? MAJOR_FADE : mod(i, 2) === 0 ? MINOR : MINOR_FADE
```

思路：步长保持在 [40,80) 屏幕像素的一个倍频程带内（GRID_STEP=80/GRID_BAND=40/GRID_MAJOR=5，palette.js:86-90），带内「中间刻度」按 fade=r−1（线）/(r²−1)/3（点）渐显，恰使单位屏幕面积墨量恒定——缩放时网格不变亮不变暗不跳变。
来源：packages/core/src/editor.js:1701-1721

### 部分渲染的重入双闸门（leafer）

```ts
    public renderOnce(callback?: IFunction): void {
        if (this.rendering) return debug.warn('rendering')
        if (this.times > 3) return debug.warn('render max times') // 补偿循环硬上限
        this.times++
        /* …… requestLayout + partRender（期间新请求由 renderAgain 置 waitAgain=true）…… */
        this.rendering = false
        if (this.waitAgain) {
            this.waitAgain = false
            this.renderOnce() // 渲染期间被请求过 → 本轮结束立刻补一轮
        }
    }
```

思路：「本轮结束后再跑一遍」的补偿循环必须配次数上限，`waitAgain` 布尔与 `times > 3` 硬截断成对出现，防「渲染中改属性→again→又改」死循环；同构代码在 Layouter.layoutOnce。脏块合并 mergeBlocks（Renderer.ts:225-233）用 `Bounds.setList` 把帧内全部脏块 union 成单矩形——实现与残影风险最小，离散多点变化代价退化接近全屏。
来源：packages/partner/renderer/src/Renderer.ts:116-157

### 节点 LOD：滞回阈值 + 每帧预算渐进恢复（AI-Canvas-tauri）

```ts
export const CANVAS_NODE_LOD = {
  enter: 0.16, exit: 0.25, restorePerFrame: CANVAS_DISPLAY_BUDGET.maxPerFrame, idleMs: CANVAS_DISPLAY_BUDGET.idleMs,
} as const;

  viewport(zoom: number, centerX = 0, centerY = 0) {
    latestZoom = zoom;
    center = { x: centerX, y: centerY };
    updateFar(far ? zoom < thresholds.exit : zoom < thresholds.enter); // 滞回：进出阈值分离防抖
  },
  function queue(entry: Entry) {
    entry.cancel?.();
    if (entry.full === (!far || entry.pins.size > 0)) return; // 选中/编辑/播放节点 pin 保活
    entry.cancel = display.enqueue(entry, () => {
      if (entries.get(entry.id) === entry) publish(entry, !far || entry.pins.size > 0);
    }, () => priority(entry.id)); // priority=距视口中心距离²；display 按 restorePerFrame 逐帧限量恢复
  }
```

思路：远景换轻预览而非卸载——「换源而不是卸载」+ pin 保活例外表 + 每帧恢复预算限量 + 进/出滞回双阈值（0.16/0.25，性能模式 0.55/0.65），交互期暂停换图、停止后渐进提交；LOD 调度做成独立 runtime，节点组件只消费布尔快照。
来源：src/services/canvasNodeLodRuntime.ts:8-11, 41-49, 103-108

### frameDemand：分配任何缓存前先算「这一帧需要谁」（InvokeAI）

```ts
export const calculateActiveFrameLayerIds = (input: FrameDemandInput): Set<string> => {
  const plan =
    input.preparation ??
    prepareComposite(input.document, { /* isolation / overlay / transformOverrides */ });
  const active = new Set<string>();
  plan.leaves.forEach((leaf, index) => {
    const bounds =
      plan.bounds?.[index] ??
      committedLeafBounds(leaf, plan.matrices[index]!, input.document, input.liveCacheRects?.get(leaf.id));
    if (bounds && intersect(bounds, input.viewport)) {
      active.add(leaf.id);
    }
  });
  return active;
};
```

思路：纯函数把每个可绘制 leaf 的文档空间 bounds 与视口求交，只有被需要的层才 rasterize、离屏启用层绝不急切分配——按需分配才能被 LRU 驱逐，平移露出时再光栅化；「描述计算」与「像素绘制」分离，各有各的缓存键。
来源：invokeai/frontend/webv2/src/workbench/canvas-engine/render/frameDemand.ts:42-60

### 拖拽帧旁路 React：直改内部 nodeLookup + DOM transform（tapcanvas）

```ts
    internalNode.position = change.position
    internalNode.dragging = true
    internalNode.internals.positionAbsolute = positionAbsolute

    let element = elementCache.get(change.id) ?? null
    if (!element && canvasRoot) {
      element = canvasRoot.querySelector<HTMLElement>(`[data-id="${CSS.escape(change.id)}"]`)
      if (element) elementCache.set(change.id, element)
    }
    if (element) {
      element.style.transform = `translate(${positionAbsolute.x}px, ${positionAbsolute.y}px)`
    }
```

思路：受控 1000 节点数组里应用每个 pointer 帧是 O(N)/帧；拖拽中只改 React Flow 内部 nodeLookup 与 DOM transform（元素带 elementCache 缓存），松手才走正常 applyNodeChanges 提交——重交互帧与 React 渲染彻底解耦。
来源：apps/web/src/canvas/applyActiveNodeDragFrame.ts:23-35（入口分支 Canvas.tsx:2135-2153）

### LOD 降档判定带滞回：只暴露粗布尔，跨阈值才批渲染一次（tapcanvas）

```ts
export function shouldUseCanvasOverviewLod(input: Readonly<{
  heavyCanvas: boolean
  zoom: number
  currentlyOverview: boolean
}>): boolean {
  if (!input.heavyCanvas) return false
  return input.currentlyOverview
    ? input.zoom < CANVAS_LOD_OVERVIEW_EXIT_ZOOM
    : input.zoom <= CANVAS_LOD_OVERVIEW_ENTER_ZOOM
}
```

思路：enter 0.32 / exit 0.38 两个阈值构成滞回，防止在边界缩放值上来回抖动；同时把 zoom 折叠成一个布尔 context，节点只在跨阈值时批渲染一次，不随缩放逐帧重渲染。
来源：apps/web/src/canvas/canvasPerformancePolicy.ts:12-21（设计注释 CanvasLODContext.ts:3-15）

### Immer patch 流 → 有序引擎 op：结构/属性分通道，links 例外跳过（grida）

```ts
for (const patch of patches) {
  const path = patch.path;
  if (path[0] !== "document") continue;
  if (path[1] === "links") continue; // 结构编辑由 tracked-Graph 精确出 sync_links
  if (path[1] !== "nodes") return { structural: true };
  const nodeId = path[2];
  if (typeof nodeId !== "string") return { structural: true };
  const isExactSlot = path.length === 3;
  if (isExactSlot && patch.op === "remove") {
    removed.add(nodeId);
    continue;
  }
  replaced.add(nodeId);
}
```

思路：JS 侧 immer state 是唯一事实源、WASM 引擎是投影——patch 流按路径分类成 replace/delete 节点集，非节点路径直接升级 full_resync；`links` 单独豁免是因为 tracked-Graph 已精确发射 sync_links，否则会触发冗余且破坏性的全量重同步。批次内任一 full_resync 即塌缩为单个 resync。
来源：editor/grida-canvas/sync.ts:58-77

## 命中与拾取

### 色键网格吸附：读写两端同一 snap 函数吞掉读回噪声（konva）

```ts
  getHitColorKey(r: number, g: number, b: number): string {
    // hit colours live on a grid, so a pixel of the hit graph that reads
    // back slightly off still rounds to the key of its shape: an edge pixel
    // is stored premultiplied by its alpha and comes back off by up to one
    // per channel, canvas farbling (Brave) adds a little noise on top
    const step = this.isCanvasFarblingActive() ? 5 : 3;
    const snap = (value: number) => Math.round(value / step) * step;
    return HASH + this._rgbToHex(snap(r), snap(g), snap(b));
  },
```

思路：hit canvas 半透明边缘像素预乘存储读回偏差 ±1，Brave farbling 还会注噪——所有键色生成时吸附到步长网格、读回时同函数吸附，噪声自然归位；farbling 检测在 `isCanvasFarblingActive`（Util.ts:696-734：画 #282828 读回比对 40,40,40，结果缓存），抢不到唯一键重试 1 万次兜底。泛化：任何「位图编码 ID + 有损读回」场景。
来源：src/Util.ts:754-762

### 抗锯齿边缘环搜：alpha 停涨即停（konva）

```ts
    let r = HIT_SEARCH_RADIUS, size = r * 2 + 1, data = read(r),
      previousMax = data[(r * size + r) * 4 + 3];
    for (let d = 1; d <= HIT_SEARCH_MAX_DISTANCE; d++) {
      //（d > r 时把读取窗口半径翻倍重取，省略）
      let max = 0;
      for (let y = -d; y <= d; y++) {
        const step = Math.abs(y) === d ? 1 : d * 2; // 上下整行 + 左右两端，环遍历
        for (let x = -d; x <= d; x += step) {
          const i = ((y + r) * size + x + r) * 4;
          const shape = getHitShape(data, i);
          if (shape) return shape;
          max = Math.max(max, data[i + 3]);
        }
      }
      if (max <= previousMax && max !== 255) return null; // alpha 不再上升即停
      previousMax = max;
    }
    return null;
```

思路：点落在两形状混色边/放大后的缓存边缘上读不到键时，从命中点向外逐环搜最近的有效形状像素，半径 10 起翻倍到上限 256；「alpha 不再上升即停」保证细线（平坦 alpha）不会沿线索走到远处无关形状——纯像素命中方案的必要补丁。
来源：src/Layer.ts:358-405

### perPixel 命中：专用小离屏 canvas，成本与画布大小解耦（fabric.js）

```ts
  isTargetTransparent(target: FabricObject, x: number, y: number): boolean {
    const tolerance = this.targetFindTolerance;
    const ctx = this.pixelFindContext;
    this.clearContext(ctx);
    ctx.save();
    ctx.translate(-x + tolerance, -y + tolerance);
    ctx.transform(...this.viewportTransform);
    //（selectionBackgroundColor 暂存清空再还原，省略）
    target.render(ctx); // 只把目标对象本身画进小 canvas
    ctx.restore();
    const enhancedTolerance = Math.round(tolerance * this.getRetinaScaling());
    return isTransparent(ctx, enhancedTolerance, enhancedTolerance, enhancedTolerance);
  }
```

思路：不读主 canvas，而是维护 `(tolerance*2+1)*retina` 大小的专用离屏（`willReadFrequently: true` 创建），把目标单独画进去读中心点 alpha——开销 = 单个对象重绘；粗筛走多边形（getCoords 四角），perPixel 只在开启时兜底。
来源：packages/core/src/canvas/SelectableCanvas.ts:468-489

### 命中 margin：屏幕像素定义除以 zoom，粗指针加粗（tldraw）

```ts
    @computed getHitTestMargin(): number {
        const { hitTestMargin, coarseHitTestMargin } = this.options
        const margin = this.getInstanceState().isCoarsePointer ? coarseHitTestMargin : hitTestMargin
        return margin / this.getZoomLevel()
    }
```

思路：命中容差按屏幕像素定义、除以 zoom 转页面空间，任何缩放下手感恒定；手指（coarse pointer）用更大的 margin 保证触屏可点性——候选集先在 R-tree 上按 margin 膨胀搜，再从 z 序最高处向下精测。
来源：packages/editor/src/lib/editor/Editor.ts:5881-5885

## 坐标与变换

### 光标锚点缩放公式与逆缩放恒定屏显（basketikun）

```ts
        const delta = -event.deltaY;
        const factor = Math.pow(1.1, delta / 100);
        const newScale = Math.min(Math.max(viewport.k * factor, 0.05), 5);
        //（rect = 容器 getBoundingClientRect，此处省略）
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const worldX = (mouseX - viewport.x) / viewport.k; // 先取光标下世界坐标
        const worldY = (mouseY - viewport.y) / viewport.k;
        onViewportChange({
            x: mouseX - worldX * newScale, // 再反推新平移：光标点钉在原位
            y: mouseY - worldY * newScale,
            k: newScale,
        });

        // 逆缩放：节点面板屏幕尺寸恒定（框选虚线同理 strokeWidth={1/k}）
        style={{ transform: `translateX(-50%) scale(${1 / scale})`, transformOrigin: "top center" }}
```

思路：缩放只 set 一个 viewport 三元组，transform-only；画布缩放后浮层/描边/命中半径全部除以 k（project.tsx:3282 的 `strokeWidth={1/viewport.k}`）把屏幕尺寸归一——DOM-transform 派画布的标配两件套。
来源：web/src/components/canvas/infinite-canvas.tsx:87-106；web/src/components/canvas/canvas-node.tsx:450-453

## 交互手感

### fakeClone 伪造最小节点树，调真实布局引擎画预览连线（mind-map）

```js
    parent = parent.fakeClone()
    node = node.fakeClone()
    const tmpNode = this.beingDragNodeList[0].fakeClone()
    tmpNode.left = x
    tmpNode.top = y
    tmpNode.width = w
    tmpNode.height = h
    parent.children = [tmpNode]
    parent._lines = []
    this.mindMap.renderer.layout.renderLine(
      parent,
      [this.placeHolderLine],
      (...args) => {},
      node.style.getStyle('lineStyle', true)
    )
    this.placeHolderExtraLines = [...parent._lines]
```

思路：fakeClone（core/render/node/MindMapNode.js:1090）浅拷贝真实节点实例，伪造 parent→tmpNode 最小树后直接调真实布局引擎的 `renderLine`——不重算整树布局也能得到与落点完全一致的线型；拖拽判定与提交分离，mouseup 才走命令入 undo。
来源：plugins/Drag.js:1090-1107（快照 `_tmp\mindmap-extract`）

### zoom 自适应吸附阈值：世界坐标阈值恒定、屏幕像素阈值反比放大（grida）

```ts
export function threshold(factor: number, t: number | cmath.Transform): number {
  const zoom = typeof t === "number" ? t : cmath.transform.getScale(t)[0];
  return cmath.quantize(Math.ceil(factor / zoom), 1) - 0.5;
}
```

思路：吸附手感要求"屏幕上 5px 内吸上"，换算到世界坐标就是 `ceil(5/zoom)`（zoom=0.02 时阈值 250 世界单位）；quantize 取整再 -0.5 修正整数边界偏置。所有"屏幕交互 vs 世界坐标"的半径类参数（命中 margin、手柄半径）都该走这个公式，与 tldraw 的 `getHitTestMargin`（margin/zoom）互证。
来源：editor/grida-canvas/reducers/tools/snap.ts:21-26

### 边缘自动滚屏：视口内缩矩形 + 偏移量即滚动量（grida）

```ts
const inset = cmath.rect.inset(vrect, EDGE_SCROLLING_THRESHOLD); // 视口内缩 16px
const offset = cmath.rect.offset(inset, pointer.client);
if (cmath.vector2.isZero(offset)) return;
const delta = cmath.vector2.clamp(
  cmath.vector2.invert(offset),
  [-EDGE_SCROLLING_THRESHOLD, -EDGE_SCROLLING_THRESHOLD],
  [EDGE_SCROLLING_THRESHOLD, EDGE_SCROLLING_THRESHOLD]
);
const next = cmath.transform.translate(transform, delta);
instance.camera.transform = next;
rafId = requestAnimationFrame(loop);
```

思路：指针在内缩矩形外多出的偏移量天然就是"该滚多少"——出界越远滚得越快，clamp 封顶 16px/帧，rAF 循环驱动；仅 cursor 工具 + dragging 时生效。比 tldraw 的 proximity factor + easeInCubic 缓动少一层手感调校，但两行几何就成立。
来源：editor/grida-canvas-react/viewport/hooks/use-edge-scrolling.ts:44-62

### 单/双击同键双动作：300ms 窗口判 pressType（grida）

```ts
function useSingleDoublePressHotkey(
  key: string,
  cb: (pressType: "single" | "double") => void
) {
  const lastTime = useRef(0);
  useHotkeys(key, () => {
    const now = Date.now();
    if (now - lastTime.current < 300) {
      cb("double");
    } else {
      cb("single");
    }
    lastTime.current = now;
  });
}
```

思路：一个 `0` 键挂两个动作（单击=透明度 100%、双击=0%），单击动作不做延迟等待而是立即触发、双击时再补发——延迟确认会让单键手感变黏；配套 keybinding 包把 multi-tap 定性为“时钟消歧手势”、明确不进 clockless 的 chord 词表；同键分义阈值词汇表 → 详见 interaction.md 手势阈值词汇表。
来源：editor/grida-canvas-react/viewport/hotkeys.tsx:44-60

### 方向键微移伪造手势态：500ms debounce 让键盘微移也显示吸附线（grida）

```ts
if (gesture) {
  instance.surface.surfaceLockNudgeGesture("on");
  __gesture_nudge_debounced(delay);
}
instance.surface.a11yArrow(direction, shiftKey);
```

思路：nudge 是命令不是手势（无时长），但吸附参考线只挂手势态渲染——于是每次按键 lock 开、500ms 无后续按键才关，键盘操作与鼠标拖拽共享同一套吸附可视化；这是「给无周期交互补一个可续期的事务态」的通用模式。
来源：editor/grida-canvas-react/provider.tsx:614-639（action.ts:743-751 注释明说 mimic）

## 状态与历史

### 时间桶 undo：同类型 action 300ms 内合并为一个撤销步（grida）

```ts
if (this._bucket && this._bucket.actionType === actionType) {
  // Same action type within the timeout window — extend the bucket.
  clearTimeout(this._bucket.timer);
  this._bucket.afterSnapshot = captureDocumentSnapshot(afterState);
  this._bucket.patches = filteredPatches;
  this._bucket.inversePatches = filteredInverse;
  this._bucket.timer = setTimeout(
    () => this._flushBucket(),
    this.bucketTimeoutMs
  );
  return;
}
// Different action type or no bucket — flush previous, start new
this._flushBucket();
```

思路：保留最初的 beforeSnapshot、只刷新 afterSnapshot 与 timer——连环按键（打字、nudge、滑杆）自动合成一步 undo，换动作类型立即 flush 不误合并；比“手势开始/结束配对”少一套配对协议，比“每 action 一步”少一半栈深。与 tldraw 的事务粒度、quickdraw 的 beginBatch/endBatch 构成三种 undo 粒度策略（撤销三派判据 → 详见 distilled-external.md 撤销/持久化/协作节）。
来源：editor/grida-canvas/editor-history-adapter.ts:243-262

### 订阅即比较：回调前先更新 previous，断掉递归 dispatch 环（grida）

```ts
const next = selector(this.mstate);
if (!isEqual(previous, next)) {
  const prev = previous;
  // previous is assigned before invoking the listener, preventing recursive dispatch loops
  previous = next;
  fn(this, next, prev, action, patches, ops);
}
```

思路：监听器内合法地再入 dispatch（不变量钩子就是这么用的）——若在回调之后再赋 previous，回调里的 dispatch 触发本监听器时会拿旧值再进回调，死循环；先赋值把「同一次变更的重复通知」在入口处吞掉。两行顺序就是正确性。
来源：editor/grida-canvas/editor.ts:746-757

## 任务与网络

### transact 嵌套共享外层，一份 diff 三处消费（quickdraw）

```js
  transact(fn, source = 'user') {
    if (this._tx) { fn(); return }
    this._tx = { diff: emptyDiff(), source }
    try { fn() } finally {
      const { diff } = this._tx
      this._tx = null
      if (!isDiffEmpty(diff)) {
        if (source === 'user' && !this._applyingHistory) {
          if (this._batch) {
            this._batch = composeDiff(this._batch, diff)
            this.redos.length = 0
          } else this._pushUndo(diff)
        }
        this._emit(diff, source)
        if (source === 'user') this._notifyHistory()
      }
    }
  }
```

思路：同一份 diff 同时是 undo 单元、事件报文、历史通知——三合一避免三套记录漂移；嵌套 transact 直接执行内层 fn、diff 归并到最外层一次 emit；`source === 'user'` + `_applyingHistory` 双闸门防止远端回放和 undo 自身再入栈。
来源：packages/core/src/store.js:205-222

### netDiff 深比较剔除空操作：undo 永远「看得见」（quickdraw）

```js
const sameValue = (a, b) => {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  for (const k of ka) if (!sameValue(a[k], b[k])) return false
  return true
}

export const netDiff = (d) => {
  const updated = {}
  for (const [id, pair] of Object.entries(d.updated)) if (!sameValue(pair[0], pair[1])) updated[id] = pair
  return { added: d.added, removed: d.removed, updated }
}
```

思路：拖回原点、把样式设回原值的 diff 在入栈前被剔除（store.js:282 应用），⌘Z 永远不会「按了没反应」；记录不可变的前提下深比较只发生在事务边界一次，成本可控。
来源：packages/core/src/store.js:51-68

### rAF pending-ref 合帧：每显示器帧最多一次 setState（basketikun）

```ts
            nextViewportRef.current = {
                x: panState.current.initialX + dx,
                y: panState.current.initialY + dy,
                k: scaleRef.current,
            };
            if (frameRef.current) return; // 已有 pending rAF：只更新目标值
            frameRef.current = requestAnimationFrame(() => {
                frameRef.current = null;
                if (nextViewportRef.current) onViewportChange(nextViewportRef.current);
            });
```

思路：pointermove 只把目标视口写入 ref，已有 pending rAF 直接 return——比节流更省：高频事件零 React 提交，消费点统一在 rAF；位置 = 初始值 + 全量 delta 重算而非累加，无漂移。
来源：web/src/components/canvas/infinite-canvas.tsx:162-170

### 16ms 帧预算分帧执行（X6）

```ts
  flushJobs(deadline?: IdleDeadline) {
    const startTime = this.getCurrentTime()
    let budget = this.frameInterval // 16ms 帧预算
    if (deadline && typeof deadline.timeRemaining === 'function') {
      const remain = deadline.timeRemaining()
      budget = Math.max(0, Math.min(budget, remain)) // 防止过长占用单帧
    }
    while (this.queue.length > 0) {
      const job = this.queue.shift()!
      job.cb()
      this.pendingJobs.delete(job.id)
      if (this.getCurrentTime() - startTime >= budget) break // 超预算，余下任务排下一帧
    }
    if (this.queue.length) this.queueFlush()
  }
```

思路：异步模式下每帧 16ms 预算、超时 break 留到下一帧，raf→requestIdleCallback→setTimeout 三级降级；配合 pendingJobs Map 同 id 去重与 `flag |= flag` 按位或合并（scheduler.ts:122-147）——防抖靠「合批 + 去重」而非节流；translate/resize/rotate 自动升级 PRIOR 同步直保跟手。
来源：src/renderer/queueJob.ts:66-90

### confirmUpdate 消费-返还协议：依赖未就绪就挂起（X6）

```ts
  confirmUpdate(flag: number, options: any = {}) {
    let ref = flag
    if (this.hasAction(ref, 'source')) {
      if (!this.updateTerminalProperties('source')) {
        return ref // 端点视图未就绪：原样返还剩余 flag，留待下次重试
      }
      ref = this.removeAction(ref, 'source')
    }
    //（'target' 分支与 'source' 对称，省略）
    if (this.hasAction(ref, 'render')) {
      this.render()
      return this.removeAction(ref, ['render', 'update', 'labels', 'tools'])
    }
    ref = this.handleAction(ref, 'update', () => this.update(options))
    return this.handleAction(ref, 'tools', () => this.renderTools())
  }
```

思路：view 按优先级消费各动作并返回「未消化完的剩余 flag」，scheduler 把剩余位存回 viewItem 等下次触发再试——「跨视图依赖未就绪就挂起」的通用解法；渲染动作一次消费掉一串依赖它的 flag（render/update/labels/tools）。
来源：src/view/edge/index.ts:165-191

### last-write-wins rAF 合并器 + 丢弃计数可观测（ComfyUI_frontend）

```ts
export function createRafCoalescer<T>(apply: (value: T) => void, label?: string) {
  let hasPending = false
  let pendingValue: T | undefined
  let droppedCount = 0
  const batch = createRafBatch(() => {
    if (!hasPending) return
    const value = pendingValue as T
    droppedCount = 0; hasPending = false; pendingValue = undefined
    apply(value) // DEV 下先 performance.mark(label, {detail:{dropped}}) 记录丢弃量
  })
  const push = (value: T) => {
    if (hasPending) droppedCount++
    pendingValue = value // last-write-wins：同帧多次 push 只留最新
    hasPending = true
    batch.schedule()
  }
  return { push, cancel, isScheduled: batch.isScheduled }
}
```

思路：高频 WS 进度消息最多每帧写一次 store，被顶掉的次数计入 droppedCount 并在 DEV 下打 performance.mark——合批收益在 profiler 里直接可见；比裸 rAF 合帧多了可观测性，适合任何「高频推送 → 响应式 store」落点。
来源：src/utils/rafBatch.ts:39-76

### 原子写 writeAtomic：wx 独占临时文件 + rename 提交 + 不吞原错误（toonflow）

```ts
const temporary = join(dirname(path), `.write-${crypto.randomUUID()}.tmp`);
let failed = false, created = false;
try {
  const handle = await promises.open(temporary, "wx", options.mode ?? 0o600); // wx 独占创建
  created = true;
  try { await handle.writeFile(content); }
  catch (error) { failed = true; throw error; }
  finally { await handle.close().catch((error) => { if (!failed) throw error; }); }
  if (options.exclusive) {
    if (useExclusiveRename) require("./renameExclusive.ts").renameExclusive(temporary, path);
    else await promises.link(temporary, path);
  }
  else await stubborn.retry.rename(retryOptions)(temporary, path);
} finally {
  if (created) await promises.unlink(temporary).catch((e) => { if (e.code === "ENOENT") return; /* 清理失败不覆盖原错误 */ });
}
```

思路：任何 JSON 快照/画布文档落盘都该这么做——同目录临时文件 `wx` 独占创建、写完 rename/link 提交、失败清理且清理失败不能覆盖原错误也不能把已提交的保存报为失败；exclusive 模式用 link/renameExclusive 实现「仅新建」。
来源：packages/file/src/index.ts:150-179

### 取消先落盘中断墓碑：覆盖未来可能的乱序提交（toonflow）

```ts
      let task = await load(cwd, taskId, key, owner); //（locked(key) 互斥内）
      const exclusive = !task;
      if (!task) {
        // 不存在的 taskId 也写 cancelled 墓碑，防乱序请求稍后创建付费任务
        task = { key, blobs: [], active: false, settledAt: now, record: {
          version: 1, taskId, cwd, ownerUserId: owner?.role === "user" ? owner.id : undefined,
          state: "cancelled", checkpoint: {}, createdAt: now, updatedAt: now,
          result: error<GeneratedMedia[]>("生成已取消", null, 499),
        } };
        tasks.set(key, task);
      }
      task.record.state = "cancelled";
      task.record.result = error<GeneratedMedia[]>("生成已取消", null, 499);
      // 取消先落盘（exclusive=仅新建）；已终态任务的幂等分支省略
      await persist(task, exclusive);
      await releaseCharge(task);
```

思路：取消/拒绝也要持久化——对「还没见到提交回执的 taskId」写 cancelled 墓碑并 exclusive 提交，之后迟到的提交请求撞上墓碑被拒，防止重复付费；配套状态机：断线/超时一律 `interrupted` 而非 failed，只有「证明尚未调用供应商」才允许置 failed。
来源：apps/server/src/utils/media/tasks.ts:535-562

### 远端应用守卫：单例深度计数断掉 SSE 回写乒乓（tapcanvas）

```ts
function createApplyGuard(): ApplyGuard {
  let depth = 0
  return {
    begin(): void { depth += 1 },
    end(): void { if (depth > 0) depth -= 1 },
    get active(): boolean { return depth > 0 },
    run<T>(fn: () => T): T {
      depth += 1
      try { return fn() } finally { if (depth > 0) depth -= 1 }
    },
  }
}
export const remoteApplyGuard = createApplyGuard()
```

思路：两个模块各自订阅节点变化并落盘（增量 patch + 整图 PUT），A 端应用 B 端的远端 patch 时若不标记「这是远端变更」，本端会照常回写→过期 revision→409→重取→再触发，每秒级 409 风暴；进程内单例守卫让「正在应用远端 patch」成为所有订阅者可读的事实，深度计数容忍嵌套 apply。配套 derivedApplyGuard 把「媒体自然尺寸水合」这类非用户编辑挡在 autosave 之外。
来源：apps/web/src/canvas/sync/remoteApplyGuard.ts:21-44

### 任务轮询租约双层兜底：Redis NX 覆盖多副本，内存 Map 兜住单进程（tapcanvas）

```ts
  const current = options.leases.get(key);
  if (current && current.expiresAt > nowMs) return null;

  const token = `${process.pid}-${nowMs.toString(36)}-${Math.trunc(Math.random() * 1e9).toString(36)}`;
  const redis = getSharedRedis();
  if (redis) {
    try {
      const acquired = await redis.set(
        `${options.prefix}${key}`,
        token,
        "EX",
        TASK_POLL_LEASE_TTL_SECONDS,
        "NX",
      );
      if (acquired !== "OK") return null;
    } catch ...
  }
  options.leases.set(key, { token, expiresAt: nowMs + TASK_POLL_LEASE_TTL_MS });
```

思路：供应商任务轮询必须单持有者，否则多副本重复轮询/重复扣费；Redis SET NX EX 是标准租约，本地 Map 作为无 Redis 的单进程开发环境兜底；token 带 pid+随机数，释放走 Lua compare-and-del 防误删他人租约。
来源：apps/hono-api/src/modules/task/task-poll-lease.ts:51-73

### AI 批量建节点的行游标：同批兄弟共享一张 4 列网格（tapcanvas）

```ts
const batchRowCursors = new Map<string, BatchGridCursor>()

function advanceBatchCursor(cursor: BatchGridCursor, nodeW: number, nodeH: number): void {
  cursor.rowH = Math.max(cursor.rowH, nodeH)
  cursor.col += 1
  if (cursor.col >= MAX_BATCH_COLS) {
    cursor.col = 0
    cursor.x = cursor.startX
    cursor.y += cursor.rowH + BATCH_ITEM_GAP
    cursor.rowH = 0
  } else {
    cursor.x += nodeW + BATCH_ITEM_GAP
  }
}
```

思路：agent 一次提交几十个 add_node 时逐个「放在来源右侧」会横向铺成长条；以 `${batchUlid}:${sourceNodeId}` 为 key 的游标让同批同源兄弟共享一张 ≤4 列网格（行高取行内最大值），commit 后清理——AI 编排结果天然成可读管线。
来源：apps/web/src/canvas/applyFlowPatchToStore.ts:130-143（commit 后 clearBatchRowCursor :145-149）

## 补充批次（grida / TapCanvas / ComfyUI 系三仓 / DirectorsConsole / tigerowo / 258-Canvas）


来源仓库（均只读抄录，未改动源文件）：
1. jtydhr88/ComfyTV（`_repos/jtydhr88/ComfyTV`）
2. 1314521gjy/ComfyUI-Local-Infinite-Canvas（`_repos/1314521gjy/ComfyUI-Local-Infinite-Canvas`）
3. YangShu2103/ComfyUI-Infinite-Canvas（`_repos/YangShu2103/ComfyUI-Infinite-Canvas`）

---

## 一、ComfyTV

### 1.1 per-node Run：复用 ComfyUI 执行器只跑单个节点
`src/composables/stages/stageRun.ts:156-161`（配套 `:140-141`）
思路：不另起执行通道，直接用 ComfyUI 前端 `queuePrompt` 的 `partialExecutionTargets` 参数把这次提交裁剪成"只执行目标节点"；提交前把 `force_run_token` widget 写成 `Date.now() & 0x7fffffff`，靠输入变化击穿 ComfyUI 的节点缓存。

```ts
;(pm as any).__comfytvOwnRun = true
const queueResp = await a.api.queuePrompt(0, pm, {
  partialExecutionTargets: [targetId],
  previewMethod: a.extensionManager?.setting?.get?.('Comfy.Execution.PreviewMethod'),
})
runningPromptId = queueResp?.prompt_id ? String(queueResp.prompt_id) : null
```

### 1.2 上游快照解析：FX 链节点透明穿透
`src/stores/stageStore.ts:245-255`
思路：下游取上游输出时，若上游是"链式 FX"节点（自身也是消费者），递归穿透它继续向上找真正的 stage 产物；深度上限 16 防环。产物是字符串引用（后端输出库的 id/URL），即"快照"本体。

```ts
if (srcNode && srcSlot === 0 && isChainableFx(srcNode)) {
  const vin = (srcNode.inputs || []).find((i: any) => i?.name === 'video')
  if (vin?.link != null) return resolveUpstreamValue(app, vin.link, depth + 1)
  return null
}
if (srcState) {
  const slotted = srcState.outputs?.[srcSlot]
  if (slotted != null && String(slotted).length > 0) return String(slotted)
  if (srcSlot === 0 && srcState.output) return String(srcState.output)
}
return null
```

### 1.3 播放仲裁：全页捕获 play，暂停同节点组之外的视频
`src/composables/widgets/playbackArbiter.ts:18-29`
思路：document 级 capture 监听 `play`，凡带 `data-ctv-media` 的 video 开始播放，就暂停"最近 `[data-node-id]` 祖先不同组"的其他视频——画布上几十个视频节点同时出声的杀手锏。

```ts
useEventListener(root, 'play', (e: Event) => {
  const target = e.target
  if (!(target instanceof HTMLVideoElement)) return
  if (!target.matches(SELECTOR)) return
  if (target.paused) return
  const group = groupOf(target)
  for (const v of root.querySelectorAll<HTMLVideoElement>(SELECTOR)) {
    if (v === target || v.paused) continue
    if (groupOf(v) === group) continue
    v.pause()
  }
}, { capture: true, passive: true })
```

### 1.4 猴子补丁 /view 路由：包装既有 handler 而不重注册
`api/view_patch.py:42-54`
思路：直接改 aiohttp `routes._items` 里的 RouteDef，把 ComfyUI 自带 `/view` 处理函数包一层（救援文件名含 `..` 的 Windows 子目录媒体）；用 `handler._comfytv_view_patch` 标记防重复包装。

```python
def install(routes=None) -> bool:
    routes = routes if routes is not None else PromptServer.instance.routes
    items = getattr(routes, '_items', None)
    if items is None:
        return False
    for i, r in enumerate(items):
        if not isinstance(r, web.RouteDef) or r.method != 'GET' or r.path != '/view':
            continue
        if getattr(r.handler, '_comfytv_view_patch', False):
            return True
        items[i] = web.RouteDef(r.method, r.path, _wrap(r.handler), r.kwargs)
        return True
    return False
```

---

## 二、ComfyUI-Local-Infinite-Canvas

### 2.1 Promise 链互斥锁（无需依赖）
`assistant/repair-tools.mjs:44-59`
思路：把每个互斥任务挂在前一个任务的 Promise 尾部，天然 FIFO；比布尔 flag 不会漏唤醒。

```js
export function createAsyncMutex() {
    let tail = Promise.resolve();
    return async function runExclusive(task) {
        let release;
        const previous = tail;
        tail = new Promise((resolve) => { release = resolve; });
        await previous;
        try {
            return await task();
        } finally {
            release();
        }
    };
}
```

### 2.2 修复方案落盘：乐观锁 + 全量备份再写
`assistant/repair-tools.mjs:460-476`
思路：Agent 生成的补丁先存成 proposal，用户点「应用」才执行；写前校验当前内容与生成方案时的 oldContent 逐字节一致（防方案过期/被他人改动），改前逐文件备份到 proposal 专属目录，失败可 rollbackProposalFiles 逆向恢复。

```js
const plan = proposal.edits.map((edit) => {
    const file = resolveInside(root, edit.path);
    if (edit.isCreate) {
        if (fs.existsSync(file)) throw new Error(`文件已被创建，方案过期：${edit.path}`);
    } else {
        if (!fs.existsSync(file)) throw new Error(`文件已不存在，方案过期：${edit.path}`);
        const current = fs.readFileSync(file, "utf8");
        if (current !== edit.oldContent) throw new Error(`文件已被其他操作修改，请重新生成方案：${edit.path}`);
    }
    return { edit, file };
});
fs.mkdirSync(backupDir, { recursive: true });
for (const { edit, file } of plan) {
    if (edit.isCreate) continue;
    const backupFile = path.join(backupDir, edit.path);
    fs.mkdirSync(path.dirname(backupFile), { recursive: true });
    fs.copyFileSync(file, backupFile);
}
```

### 2.3 与宿主会话恢复的竞态：afterLoadGraph 防抖抢占
`comfyui-gateway/comfyui-bridge/open-workflow.js:84-105`
思路：ComfyUI 启动会自动恢复上次会话并覆盖当前图；扩展把"打开指定工作流"推迟到 `afterLoadGraph` 防抖 900ms（兜底 12s）之后执行，确保目标工作流最后加载、不被恢复会话顶掉。

```js
let timer = null;
function scheduleLoad(delay = DEBOUNCE_MS) {
  if (window[LOADED_KEY]) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = null;
    void loadRequestedWorkflow();
  }, delay);
}

app.registerExtension({
  name: "LocalCanvas.OpenWorkflow",
  setup() {
    if (readTarget()) scheduleLoad(FALLBACK_MS);
  },
  afterLoadGraph() {
    if (readTarget()) scheduleLoad();
  },
});
```

---

## 三、ComfyUI-Infinite-Canvas（YangShu2103）

### 3.1 output→input 素材接驳：内容哈希命名 + 硬链接优先
`__init__.py:893-912`（`_link_into_input` 主体）
思路：产物文件留在 ComfyUI output 目录，被下游当输入引用时才"接"进 input——优先 `os.link` 硬链接（零拷贝），失败退回复制；目标名 = sha1(来源路径+纳秒 mtime+大小)，同名重新生成的文件不会复用旧链接。

```python
digest = hashlib.sha1(
    f"{source_type}/{subfolder}/{filename}/{stat.st_mtime_ns}/{stat.st_size}".encode("utf-8")
).hexdigest()[:16]
ext = os.path.splitext(filename)[1] or ".png"
target_name = f"infinite_canvas_{digest}{ext}"
target = os.path.join(_input_dir(), target_name)
if os.path.isfile(target):
    return target_name

try:
    os.makedirs(_input_dir(), exist_ok=True)
    try:
        os.link(source, target)
    except OSError:
        # 跨磁盘或不支持硬链接时退回复制
        shutil.copyfile(source, target)
```

### 3.2 环形进度条：pathLength=100 归一化，真实采样步数驱动
`frontend/src/components/Node/index.vue:1162-1174`（SVG 模板见 `:163-186`，rect 上加 `pathLength="100"`）
思路：把整圈周长归一化成 100 单位，`strokeDasharray = "pct 100-pct"` 就是精确百分比，与节点尺寸无关；未收到 progress 事件（排队/加载模型）时 `stepMax=0`，CSS 走不定态流动动画，绝不显示假百分比。

```ts
const ringPercent = computed(() => {
  const max = Number(runState.value?.stepMax) || 0;
  if (max <= 0) return 0;
  const value = Math.min(Number(runState.value?.stepValue) || 0, max);
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
});
const ringHasProgress = computed(() => (Number(runState.value?.stepMax) || 0) > 0);
const ringStyle = computed(() => {
  if (!ringHasProgress.value) return {};
  // pathLength=100 把整圈归一化成 100，虚线长度即百分比，与节点尺寸无关
  return { strokeDasharray: `${ringPercent.value} ${100 - ringPercent.value}` };
});
```

### 3.3 采样进度归属：只认 max>1 的多步节点
`frontend/src/composables/useGraph.js:1569-1583`
思路：ComfyUI 的 progress 消息里每个节点都报 value/max；把 max=1 的节点（加载模型、单图处理）全部过滤掉，只取"正在运行的多步采样"节点当进度源——否则采样还没开始就显示 100%。

```ts
function readProgress(data) {
  const nodes = data?.nodes;
  if (nodes && typeof nodes === "object") {
    // max > 1 才是多步采样；max = 1 的节点（加载模型等）不参与进度计算
    const list = Object.values(nodes).filter((item) => Number(item?.max) > 1);
    const active =
      list.find((item) => item?.state === "running") ||
      list.find((item) => {
        const value = Number(item?.value) || 0;
        return value > 0 && value < Number(item?.max);
      });
    if (!active) return null;
    const max = Number(active.max) || 0;
    return { value: Math.min(Number(active.value) || 0, max), max };
  }
```

---

# 三小仓补充抄录（DirectorsConsole / tigerowo-canvas / 258-Canvas）

来源仓库（均只读抄录，未改动源文件）：
4. NickPittas/DirectorsConsole（`_repos/NickPittas/DirectorsConsole`）
5. tigerowo/infinite-canvas 克隆（`_repos/tigerowo-canvas`）
6. ken571571/258-Canvas（`_repos/ken571571/258-Canvas`）

## 四、DirectorsConsole

### 4.1 跨 OS 工作流路径归一化
`_repos/NickPittas/DirectorsConsole/CinemaPromptEngineering/frontend/src/storyboard/services/workflow-parser.ts:56-77`（节选）
思路：workflow JSON 发往 ComfyUI 节点前，按目标机 OS（`/system_stats` 探测，见 `detectNodeOS` 同文件:91）把 PATH_INPUTS 白名单圈定的模型/输出路径字段做分隔符归一化；含 `://` 的协议串跳过不转换。解决 Windows 作者的 workflow 在 Linux 节点上 ck_name/filename_prefix 全部失效的问题。

```ts
export function normalizeWorkflowPaths(
  workflow: Record<string, any>,
  targetOS: TargetOS,
): void {
  const useBackslash = targetOS === 'windows';
  for (const node of Object.values(workflow)) {
    const inputs = node?.inputs;
    if (!inputs || typeof inputs !== 'object') continue;
    for (const [key, value] of Object.entries(inputs)) {
      if (!PATH_INPUTS.has(key) || typeof value !== 'string') continue;
      if (useBackslash) {
        if (!value.includes('://') && value.includes('/')) {
          inputs[key] = value.replace(/\//g, '\\');
        }
      } // else 分支把 value 中的 \ 镜像换成 /
    }
  }
}
```

## 五、tigerowo-canvas

### 5.1 SSRF 防护：先解析校验全部 IP，再只拨向已校验 IP
`_repos/tigerowo-canvas/service/ssrf.go:38-68`（节选）
思路：代理 HTTP client（`safeProxyHTTPClient`，禁用 env 代理、重定向 ≤5 次且仅 http/https）自定义 DialContext——自己解析域名，逐个校验解析结果（isBlockedProxyIP 同文件:71 拦环回/内网/链路本地/组播/0.x/100.64.0.0/10 云 metadata 段），然后只拨向校验过的 IP 本身；"检查"与"拨号"共用同一次解析结果，封死检查后二次解析的 DNS rebinding 缝隙。

```go
func safeProxyDialContext(ctx context.Context, network, address string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return nil, err
	}
	ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil || len(ips) == 0 {
		return nil, errors.New("无法解析目标地址")
	}
	for _, item := range ips { // 校验解析出的每一个 IP
		if isBlockedProxyIP(item.IP) {
			return nil, errors.New("禁止访问本地或内网地址")
		}
	}
	// 随后仅拨向已校验 IP：dialer.DialContext(ctx, network, net.JoinHostPort(item.String(), port))
```

### 5.2 参考素材必须显式映射到工作流字段（fail loud）
`_repos/tigerowo-canvas/service/workflow_mapping.go:120-128`
思路：用户传入的参考图/视频/音频/蒙版若没有任何字段映射消费它，直接报错拒绝执行而不是静默丢弃——防"上传了参考图但生成结果根本没用上"的静默失败；配套 `validateWorkflowMedia`（同文件:129）只收 data URL（MIME 匹配 + base64、≤64MB）或无 userinfo 的公网 HTTPS 地址。

```go
	for kind, items := range map[string][]string{"image": input.ReferenceImages, "video": input.ReferenceVideos, "audio": input.ReferenceAudios} {
		for index, item := range items {
			if strings.TrimSpace(item) != "" && !mappedMedia[fmt.Sprintf("%s:%d", kind, index)] {
				return nil, fmt.Errorf("第 %d 个%s素材没有对应的工作流字段映射", index+1, kind)
			}
		}
	}
	if input.Mask != "" && !mappedMedia["mask"] {
		return nil, errors.New("蒙版没有对应的工作流字段映射")
	}
```

## 六、258-Canvas

### 6.1 打开画布聚焦内容包围盒（放大上限 1.25）
`_repos/ken571571/258-Canvas/static/js/canvas-viewport.js:34-64`（节选）
思路：打开画布时把视口对准内容包围盒并居中，避免遗留在空白原点；scale 取 `min(fitScale, 1.25)`——内容很小时不过度放大，需要缩小则按需缩。同文件 `_applyZoom`(:68) 演示了以画布中心为锚点的缩放平移补偿公式。

```js
  proto._focusContent = function() {
    if (!this.nodes || !this.nodes.length) return;
    // ……遍历节点求内容包围盒 minX/minY/maxX/maxY（padding=80，略）
    const rect = this.board.getBoundingClientRect();
    const scaleX = (vw - padding * 2) / rangeX;
    const scaleY = (vh - padding * 2) / rangeY;
    // 打开时最多放大到 1.25（内容很小时不过度放大），需要缩小则按需缩放
    this.view.scale = Math.max(0.1, Math.min(scaleX, scaleY, 1.25));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    this.view.x = vw / 2 - cx * this.view.scale;
    this.view.y = vh / 2 - cy * this.view.scale;
    this._renderTransform();
  };
```
