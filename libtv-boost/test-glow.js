/* 生成光效单测：从 src/inject.js 提取 __lt_glow_pure_* 纯函数块，测哈希稳定/参数范围/焦点几何 */
const fs = require('fs');
const src = fs.readFileSync('src/inject.js', 'utf8');

const start = src.indexOf('function _ltGlowHash(');
const end = src.indexOf('/* __lt_glow_pure_end__ */');
if (start < 0 || end < 0) { console.error('提取失败'); process.exit(1); }
const block = src.slice(start, end);

const factory = new Function(block + ';return {hash:_ltGlowHash,params:_ltGlowParams};');
const api = factory();

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log('  ✔', name); }
  else { fail++; console.log('  ✘', name, 'got', g, 'want', w); }
}
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✔', name); }
  else { fail++; console.log('  ✘', name, extra || ''); }
}

console.log('--- 哈希 ---');
eq('djb2("a") 已知向量', api.hash('a'), 177670);
ok('结果落在 uint32', api.hash('libtv') >= 0 && api.hash('libtv') <= 4294967295);

console.log('--- 参数范围 ---');
for (const id of ['n-1', 'n-abc123', '节点中文id', 'x', 'n-2']) {
  const p = api.params(id);
  const dur = parseFloat(p.dur);
  ok(id + ' 时长 4.5–8.5s', dur >= 4.5 && dur <= 8.5, p.dur);
  ok(id + ' 方向枚举', p.dir === 'normal' || p.dir === 'reverse', p.dir);
  const ang = parseFloat(p.ang);
  ok(id + ' 起始角 0–359°', Number.isInteger(ang) && ang >= 0 && ang < 360, p.ang);
  const m1 = p.f1.match(/^(\d+)% (\d+)%$/), m2 = p.f2.match(/^(\d+)% (\d+)%$/);
  ok(id + ' 焦点格式 "x% y%"', !!m1 && !!m2, p.f1 + ' | ' + p.f2);
  if (m1 && m2) {
    const f1x = +m1[1], f1y = +m1[2], f2x = +m2[1], f2y = +m2[2];
    ok(id + ' 焦点均在画布内', [f1x, f1y, f2x, f2y].every(v => v >= 4 && v <= 96),
      JSON.stringify([f1x, f1y, f2x, f2y]));
    /* 焦点角距（0°=正上顺时针），设计 120–240°，取整误差留 20° 余量 */
    const raw = Math.abs(Math.atan2(f2x - 50, -(f2y - 50)) - Math.atan2(f1x - 50, -(f1y - 50))) * 180 / Math.PI;
    const d = Math.min(raw, 360 - raw);
    ok(id + ' 焦点角距 ≥100°', d >= 100, 'sep≈' + d.toFixed(1) + '°');
  }
}

console.log('--- 确定性 / 区分度 ---');
eq('同 id 两次一致', JSON.stringify(api.params('n-x')), JSON.stringify(api.params('n-x')));
const combos = new Set();
for (let i = 0; i < 50; i++) { const p = api.params('n-' + i); combos.add(p.dir + '|' + p.dur + '|' + p.ang); }
ok('50 个 id 产出 ≥10 种运动组合', combos.size >= 10, '仅 ' + combos.size + ' 种');
const dirs = new Set();
for (let i = 0; i < 50; i++) dirs.add(api.params('n-' + i).dir);
ok('方向两种都出现', dirs.has('normal') && dirs.has('reverse'), [...dirs].join(','));

console.log('');
console.log(pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
