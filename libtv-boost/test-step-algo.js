/* 电路板连线算法单测：从 src/inject.js 提取 _ltStep* 块，DOM stub 后测试几何正确性 */
const fs = require('fs');
const src = fs.readFileSync('src/inject.js', 'utf8');

const start = src.indexOf('var _ltStepTo=null');
const end = src.indexOf('var _ltStepOn=');
if (start < 0 || end < 0) { console.error('提取失败'); process.exit(1); }
const block = src.slice(start, end);

// --- DOM stubs ---
const stubDoc = {
  querySelectorAll: () => [],
  querySelector: () => null,
  body: { classList: { contains: () => false, add: () => {}, remove: () => {}, toggle: () => {} } },
  addEventListener: () => {},
};
class MO { constructor() {} observe() {} disconnect() {} }
const raf = (fn) => { fn(); return 0; };

const factory = new Function('document', 'requestAnimationFrame', 'cancelAnimationFrame', 'MutationObserver',
  block + ';return {segSeg:_ltStepSegSeg,segRect:_ltStepSegRect,snap:_ltStepSnapEdge,route:_ltStepRoute,d:_ltStepD,pathLen:_ltStepPathLen,hit:_ltStepPathHit};');
const api = factory(stubDoc, raf, () => {}, MO);

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log('  ✔', name); }
  else { fail++; console.log('  ✘', name, 'got', g, 'want', w); }
}

console.log('--- 线段相交 ---');
eq('交叉', api.segSeg(0,0,10,10, 0,10,10,0), true);
eq('平行分离', api.segSeg(0,0,5,0, 0,5,5,5), false);
eq('端点接触', api.segSeg(0,0,5,5, 5,5,10,0), true);
eq('共线部分重叠', api.segSeg(0,0,10,0, 5,0,15,0), true);
eq('共线分离', api.segSeg(0,0,10,0, 20,0,30,0), false);

console.log('--- 线段-矩形 ---');
eq('穿过', api.segRect(0,5,10,5, {x:2,y:2,w:4,h:4}), true);
eq('外部', api.segRect(0,0,10,0, {x:2,y:2,w:4,h:4}), false);
eq('端点贴边', api.segRect(0,2,10,2, {x:2,y:2,w:4,h:4}), true);
eq('垂直穿过', api.segRect(5,0,5,10, {x:2,y:2,w:4,h:4}), true);
eq('矩形内含线段', api.segRect(3,3,6,3, {x:2,y:2,w:4,h:4}), true);

console.log('--- 边缘吸附 ---');
eq('水平引出(右)', api.snap(50,25, 200,100, {x:0,y:0,w:100,h:50}), {x:100,y:25});
eq('水平引出(左)', api.snap(50,25, -100,100, {x:0,y:0,w:100,h:50}), {x:0,y:25});
eq('垂直引出(上)', api.snap(50,25, 50,-100, {x:0,y:0,w:100,h:50}), {x:50,y:0});
eq('垂直引出(下)', api.snap(50,25, 60,200, {x:0,y:0,w:100,h:50}), {x:50,y:50});

console.log('--- 避让路由 ---');
// 无障碍：L 形最短（横-竖）
let r1 = api.route(0,0, 100,80, [], {}, false);
eq('无障碍最短', r1, [{x:0,y:0},{x:100,y:0},{x:100,y:80}]);
// 障碍挡住直接 L 形（横-竖路径 y=0 穿过障碍 40..60）
let box1 = {x:40,y:-10,w:20,h:30}; // 覆盖 y -10..20, x 40..60 → 挡横线 y=0
let r2 = api.route(0,0, 100,80, [box1], {}, false);
eq('绕行不穿障', api.hit(r2, [box1], {}), false);
// 起终点同水平线 + 中间障碍 → 必须绕行（上方或下方）
let box2 = {x:40,y:30,w:20,h:40}; // 覆盖 y 30..70, x 40..60
let r3 = api.route(0,50, 200,50, [box2], {}, false);
eq('同线绕行不穿障', api.hit(r3, [box2], {}), false);
eq('同线绕行3+段', r3.length >= 3, true);
// 排除起点终点节点（允许接触）：boxS/boxE 带 id 且与排除集匹配
let boxS = {x:-10,y:-10,w:30,h:120, id:'n1'}, boxE = {x:180,y:-10,w:30,h:120, id:'n2'};
let r4 = api.route(0,50, 200,50, [box2, boxS, boxE], {n1:1, n2:1}, false);
eq('排除端点节点', api.hit(r4, [box2, boxS, boxE], {n1:1, n2:1}), false);
// 性能模式：simple 只给 L 形
let r5 = api.route(0,50, 200,50, [box2], {}, true);
eq('simple 降级 L 形', r5.length, 3);

console.log('--- 圆角 d 生成 ---');
let d = api.d([{x:0,y:0},{x:100,y:0},{x:100,y:100}], 8);
console.log('  d =', d);
eq('含 Q 圆角', d.indexOf('Q') > 0, true);
eq('起点正确', d.startsWith('M 0 0'), true);
// 短段退化直角（不产生异常 Q）
let d2 = api.d([{x:0,y:0},{x:5,y:0},{x:5,y:100}], 8);
eq('短段退化', d2.indexOf('Q'), -1);

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
