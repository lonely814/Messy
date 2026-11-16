// 无限画布性能基准模板（浏览器控制台粘贴使用）
// 来源：IC-main 性能专项方法论（先立真实基准 → 量四大热点 → 改一件验一件）
// 用法：1) 把 NODES 换成你的画布节点数组与真实数据 2) 全量粘贴进控制台 3) 每改一处代码复测同一基准
// 铁律：空节点基准不成立——必须带 2-4MB 噪点 PNG 的混合节点（见 performance.md）

(function bench() {
  const NODES = (window.nodes || []).filter(Boolean); // ← 按你的画布改：节点数组变量名
  if (!NODES.length) return console.warn('[bench] 没有节点，加载真实工程再测');

  const now = () => performance.now();
  const t = { render: 0, hover: 0, minimap: 0, links: 0, n: NODES.length };

  // 热点 1：render() 全量重绘（连续 10 次取均值，排除首帧 JIT）
  for (let i = 0; i < 11; i++) {
    const s = now();
    // window.renderBoard?.() || window.render?.();  ← 按你的画布改：渲染入口函数
    t.render += (now() - s) / (i ? 1 : 0); // 首帧不计
  }
  t.render = +(t.render / 10).toFixed(2);

  // 热点 2：悬停命中（模拟 mousemove 遍历，N 次取均值）
  const pts = NODES.slice(0, 50).map(n => ({ x: n.x + 10, y: n.y + 10 }));
  const s2 = now();
  for (const p of pts) {
    // elementFromPoint 或你的命中函数  ← 按你的画布改
    document.elementFromPoint(p.x, p.y);
  }
  t.hover = +((now() - s2) / pts.length).toFixed(3);

  // 热点 3+4：小地图/连线重绘——在对应函数入口打点 30 秒日常操作后读数：
  // const t0=performance.now(); ...原逻辑...; console.debug('minimap', (performance.now()-t0).toFixed(2))

  console.table([t]);
  console.log('[bench] N=%d。改一处 → 刷新 → 重跑本脚本 → 对比同表。', t.n);
})();
