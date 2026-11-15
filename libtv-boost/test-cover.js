/* 生成占位封面单测：从 src/inject.js 提取 __lt_cover_pure_* 纯函数块，测 FNV/确定性/SVG 结构/调色板/图案/URI 编码 */
const fs = require('fs');
const src = fs.readFileSync('src/inject.js', 'utf8');

const start = src.indexOf('function _ltCovFnv(');
const end = src.indexOf('/* __lt_cover_pure_end__ */');
if (start < 0 || end < 0) { console.error('提取失败'); process.exit(1); }
const block = src.slice(start, end);

const factory = new Function(block + ';return {fnv:_ltCovFnv,svg:_ltCovSvg,uri:_ltCovDataUri,palettes:_ltCovPalettes,palKeys:_ltCovPalKeys,patKeys:_ltCovPatKeys};');
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

console.log('--- FNV-1a / PRNG ---');
eq('FNV-1a("") 已知向量', api.fnv(''), 2166136261);
eq('FNV-1a("a") 已知向量', api.fnv('a'), 3826002220);
ok('结果落在 uint32', api.fnv('libtv') >= 0 && api.fnv('libtv') <= 4294967295);

console.log('--- 确定性 ---');
eq('同 seed 两次一致', api.uri('i-PJhOxcJfjF'), api.uri('i-PJhOxcJfjF'));
eq('同 seed + 强制参数两次一致', api.uri('s1', 'dusk', 'waves'), api.uri('s1', 'dusk', 'waves'));
ok('不同 seed 输出不同', api.uri('i-1') !== api.uri('i-2'));
ok('强制 palette 影响输出', api.uri('s2', 'dusk') !== api.uri('s2', 'sunset'));

console.log('--- SVG 结构 ---');
const r = api.svg('seed-1', 'dusk', 'plain');
ok('高斯模糊 filter（stdDeviation 44）', r.svg.includes('<feGaussianBlur stdDeviation="44"/>'), '');
ok('turbulence 颗粒 + overlay 混合', r.svg.includes('feTurbulence type="fractalNoise" baseFrequency="0.8"') && r.svg.includes('mix-blend-mode:overlay'), '');
ok('径向渐隐 mask', r.svg.includes('<radialGradient id="f"') && r.svg.includes('<mask id="m">'), '');
eq('五个色场 circle', (r.svg.match(/<circle /g) || []).length, 5);
{
  const base = api.palettes[r.pal].base;
  ok('底色 rect 用所选调色板 base', r.svg.includes('<rect width="400" height="400" fill="' + base + '"/>'), base);
}
ok('色场都在 blur 组内', r.svg.includes('<g filter="url(#b)">') && r.svg.includes('</g><rect'), '');
{
  const rs = [...r.svg.matchAll(/ r="([\d.]+)" fill=/g)].map(m => parseFloat(m[1]));
  ok('色场半径 128–176（0.32–0.44×400）', rs.every(v => v >= 128 && v <= 176), JSON.stringify(rs));
}
ok('渐隐 mask 中心落在 0.3–0.7', (() => {
  const m = r.svg.match(/<radialGradient id="f" cx="([\d.]+)" cy="([\d.]+)"/);
  return !!m && +m[1] >= 0.3 && +m[1] <= 0.7 && +m[2] >= 0.3 && +m[2] <= 0.7;
})(), '');

console.log('--- 调色板 / 图案可达 ---');
for (const p of api.palKeys) ok('强制 ' + p, api.svg('z', p).svg.indexOf(api.palettes[p].base) >= 0, '');
ok('plain 无线条', !api.svg('z', 'dusk', 'plain').svg.includes('<path'), '');
eq('waves 30 条线', (api.svg('z', 'dusk', 'waves').svg.match(/<path /g) || []).length, 30);
eq('petals 11 片叶形', (api.svg('z', 'dusk', 'petals').svg.match(/<path /g) || []).length, 11);
ok('dots 单圆 pattern（5 色场圆 + 1 pattern 圆）', (api.svg('z', 'dusk', 'dots').svg.match(/<circle /g) || []).length === 6 && api.svg('z', 'dusk', 'dots').svg.includes('patternUnits="userSpaceOnUse"'), '');
ok('hairline 白描边细线', api.svg('z', 'dusk', 'waves').svg.includes('stroke="#fff" stroke-width="0.75"'), '');

console.log('--- data URI ---');
const u = api.uri('u-1');
ok('URI 前缀 data:image/svg+xml,', u.startsWith('data:image/svg+xml,'), '');
ok('URI 编码后无裸 # < > " 或空格', !/[#<>"\s]/.test(u.slice('data:image/svg+xml,'.length)), '');
ok('URI 解码后含调色板 hex', decodeURIComponent(u.slice('data:image/svg+xml,'.length)).includes('#'), '');

console.log('--- 区分度 ---');
{
  const pals = new Set(), pats = new Set();
  for (let i = 0; i < 60; i++) { const s = api.svg('n-' + i); pals.add(s.pal); pats.add(s.pat); }
  ok('60 个 seed 覆盖 ≥2 调色板', pals.size >= 2, [...pals].join(','));
  ok('60 个 seed 覆盖 ≥2 图案', pats.size >= 2, [...pats].join(','));
}

console.log('');
console.log(pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
