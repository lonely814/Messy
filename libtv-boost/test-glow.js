/* 生成光效单测：从 src/inject.js 提取 __lt_glow_pure_* 纯函数块，测哈希稳定/参数范围/焦点几何 */
const fs = require('fs');
const src = fs.readFileSync('src/inject.js', 'utf8');

const start = src.indexOf('function _ltGlowHash(');
const end = src.indexOf('/* __lt_glow_pure_end__ */');
if (start < 0 || end < 0) { console.error('提取失败'); process.exit(1); }
const block = src.slice(start, end);

const factory = new Function(block + ';return {hash:_ltGlowHash,params:_ltGlowParams,pairs:_ltGlowPairs};');
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
const pairs = [["50% 20%","50% 80%"],["30% 30%","70% 70%"],["70% 25%","30% 75%"],["25% 60%","75% 40%"],["50% 75%","50% 25%"]];
for (const id of ['n-1', 'n-abc123', '节点中文id', 'x', 'n-2']) {
  const p = api.params(id);
  const d1 = parseFloat(p.gd1), d2 = parseFloat(p.gd2);
  ok(id + ' 快层 4.5–6.0s', d1 >= 4.5 && d1 <= 6.0, p.gd1);
  ok(id + ' 慢层 6.5–8.0s', d2 >= 6.5 && d2 <= 8.0, p.gd2);
  ok(id + ' 两层转速不同', d1 !== d2, p.gd1 + '/' + p.gd2);
  ok(id + ' 层A方向枚举', p.dir === 'normal' || p.dir === 'reverse', p.dir);
  ok(id + ' 层B方向 = 层A取反', p.dir2 === (p.dir === 'normal' ? 'reverse' : 'normal'), p.dir + '/' + p.dir2);
  const ga = parseFloat(p.ga), ga2 = parseFloat(p.ga2);
  ok(id + ' A 相位 0–359°', Number.isInteger(ga) && ga >= 0 && ga < 360, p.ga);
  const sep = Math.min(Math.abs(ga2 - ga), 360 - Math.abs(ga2 - ga));
  ok(id + ' B 相位 = A + 120–240°', sep >= 120 && sep <= 240, 'sep≈' + sep.toFixed(0) + '°');
  ok(id + ' 焦点是五组对角对之一', pairs.some(q => q[0] === p.f1 && q[1] === p.f2), p.f1 + ' | ' + p.f2);
}

console.log('--- 确定性 / 区分度 ---');
eq('同 id 两次一致', JSON.stringify(api.params('n-x')), JSON.stringify(api.params('n-x')));
const combos = new Set();
for (let i = 0; i < 50; i++) { const p = api.params('n-' + i); combos.add(p.dir + '|' + p.gd1 + '|' + p.gd2 + '|' + p.ga + '|' + p.f1); }
ok('50 个 id 产出 ≥10 种运动组合', combos.size >= 10, '仅 ' + combos.size + ' 种');
const dirs = new Set();
for (let i = 0; i < 50; i++) dirs.add(api.params('n-' + i).dir);
ok('方向两种都出现', dirs.has('normal') && dirs.has('reverse'), [...dirs].join(','));
const usedPairs = new Set();
for (let i = 0; i < 50; i++) usedPairs.add(api.params('n-' + i).f1);
ok('五组焦点都被命中过', usedPairs.size === 5, '命中 ' + usedPairs.size + ' 组');

console.log('');
console.log(pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
