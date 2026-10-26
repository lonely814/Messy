/* 节点对齐 pie 菜单单测：从 src/inject.js 提取 __lt_pie_pure_* 纯函数块，测扇区映射/对齐数学 */
const fs = require('fs');
const src = fs.readFileSync('src/inject.js', 'utf8');

const start = src.indexOf('var _ltPieSectors=');
const end = src.indexOf('/* __lt_pie_pure_end__ */');
if (start < 0 || end < 0) { console.error('提取失败'); process.exit(1); }
const block = src.slice(start, end);

const factory = new Function(block + ';return {sectors:_ltPieSectors,sector:_ltPieSector,deltas:_ltPieDeltas};');
const api = factory();

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log('  ✔', name); }
  else { fail++; console.log('  ✘', name, 'got', g, 'want', w); }
}
function throws(name, fn, msgPart) {
  try { fn(); fail++; console.log('  ✘', name, '未抛错'); }
  catch (e) {
    if (!msgPart || String(e.message).includes(msgPart)) { pass++; console.log('  ✔', name); }
    else { fail++; console.log('  ✘', name, '错误信息不符:', e.message); }
  }
}

console.log('--- 扇区表 ---');
eq('8 扇区', api.sectors.length, 8);
eq('0°=顶对齐', api.sectors[0].action, 'top');
eq('45°=水平等距', api.sectors[1].action, 'distX');
eq('90°=右对齐', api.sectors[2].action, 'right');
eq('135°=垂直等距', api.sectors[3].action, 'distY');
eq('180°=底对齐', api.sectors[4].action, 'bottom');
eq('225°=水平居中', api.sectors[5].action, 'cx');
eq('270°=左对齐', api.sectors[6].action, 'left');
eq('315°=垂直居中', api.sectors[7].action, 'cy');

console.log('--- 角度映射（0°=正上顺时针） ---');
eq('正上', api.sector(0, -100), 0);
eq('右上', api.sector(100, -100), 1);
eq('正右', api.sector(100, 0), 2);
eq('右下', api.sector(100, 100), 3);
eq('正下', api.sector(0, 100), 4);
eq('左下', api.sector(-100, 100), 5);
eq('正左', api.sector(-100, 0), 6);
eq('左上', api.sector(-100, -100), 7);
eq('边界 22.5° 归右上', api.sector(Math.sin(Math.PI / 8) * 100, -Math.cos(Math.PI / 8) * 100), 1);
eq('边界 22.4° 归正上', api.sector(Math.sin(22.4 / 180 * Math.PI) * 100, -Math.cos(22.4 / 180 * Math.PI) * 100), 0);
eq('48px 死区内', api.sector(30, -30), null);
eq('恰好 48px 边界外', api.sector(0, -48) === null ? null : api.sector(0, -48), 0);
eq('非法输入', api.sector(NaN, 1), null);

console.log('--- 边对齐 ---');
const b2 = [{ x: 0, y: 0, w: 100, h: 50 }, { x: 200, y: 300, w: 60, h: 80 }];
eq('顶对齐', api.deltas(b2, 'top'), [{ dx: 0, dy: 0 }, { dx: 0, dy: -300 }]);
eq('底对齐', api.deltas(b2, 'bottom'), [{ dx: 0, dy: 330 }, { dx: 0, dy: 0 }]);
eq('左对齐', api.deltas(b2, 'left'), [{ dx: 0, dy: 0 }, { dx: -200, dy: 0 }]);
eq('右对齐', api.deltas(b2, 'right'), [{ dx: 160, dy: 0 }, { dx: 0, dy: 0 }]);

console.log('--- 中心对齐 ---');
// 包围盒 x: 0→260 中心 130；盒子中心 50 / 230
eq('水平居中', api.deltas(b2, 'cx'), [{ dx: 80, dy: 0 }, { dx: -100, dy: 0 }]);
// 包围盒 y: 0→380 中心 190；盒子中心 25 / 340
eq('垂直居中', api.deltas(b2, 'cy'), [{ dx: 0, dy: 165 }, { dx: 0, dy: -150 }]);

console.log('--- 等距分布（等间隙非等中心） ---');
const b3 = [{ x: 0, y: 0, w: 100, h: 10 }, { x: 120, y: 0, w: 100, h: 10 }, { x: 400, y: 0, w: 100, h: 10 }];
// 跨度 400→500-0=500，尺寸和 300，间隙 (500-300)/2=100；目标 x: 0 / 200 / 400
eq('水平等距', api.deltas(b3, 'distX'), [{ dx: 0, dy: 0 }, { dx: 80, dy: 0 }, { dx: 0, dy: 0 }]);
const b4 = [
  { x: 0, y: 0, w: 10, h: 40 }, { x: 0, y: 60, w: 10, h: 20 }, { x: 0, y: 200, w: 10, h: 100 }, { x: 0, y: 400, w: 10, h: 100 }];
// 跨度 500，尺寸和 260，间隙 (500-260)/3=80；目标 y: 0 / 120 / 220 / 400
eq('垂直等距', api.deltas(b4, 'distY'), [
  { dx: 0, dy: 0 }, { dx: 0, dy: 60 }, { dx: 0, dy: 20 }, { dx: 0, dy: 0 }]);
throws('等距 <3 节点', () => api.deltas(b2, 'distX'), '需要 3 个节点');

console.log('--- 退化情形 ---');
const same = [{ x: 10, y: 10, w: 20, h: 20 }, { x: 10, y: 40, w: 20, h: 20 }];
eq('已对齐左缘 dx 全 0', api.deltas(same, 'left'), [{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }]);
throws('空集合', () => api.deltas([], 'top'), '没有可对齐的节点');
throws('负宽盒子', () => api.deltas([{ x: 0, y: 0, w: -1, h: 10 }, b2[1]], 'top'), '无效');
throws('NaN 盒子', () => api.deltas([{ x: NaN, y: 0, w: 10, h: 10 }, b2[1]], 'top'), '无效');
throws('未知动作', () => api.deltas(b2, 'nope'), '未知对齐动作');

console.log('');
console.log(pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
