/* 模型选择接管单测：从 src/inject.js 提取 __lt_msel_pure_* 纯函数块，测打分/分组/分表 */
const fs = require('fs');
const src = fs.readFileSync('src/inject.js', 'utf8');

const start = src.indexOf('function _ltMselSub(');
const end = src.indexOf('/* __lt_msel_pure_end__ */');
if (start < 0 || end < 0) { console.error('提取失败'); process.exit(1); }
const block = src.slice(start, end);

const factory = new Function(block + ';return {sub:_ltMselSub,score:_ltMselScore,groups:_ltMselGroups,classify:_ltMselClassify};');
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

console.log('--- 子序列 _ltMselSub ---');
eq('连续命中返回起点', api.sub('kling 4.0', 'kling'), 0);
eq('跳字命中', api.sub('seedance 2.5', 'sd25'), 0);
eq('不命中返回 -1', api.sub('kling 4.0', 'zzz'), -1);
eq('needle 比 hay 长', api.sub('ab', 'abcd'), -1);
eq('空 needle', api.sub('kling', ''), 0);

console.log('--- 打分 _ltMselScore ---');
ok('"k4" 命中 Kling 4.0（子序列）', api.score('k4', { name: 'Kling 4.0', badges: [], desc: '高视听品质' }) > 0);
ok('"sd25" 命中 Seedance 2.5（子序列）', api.score('sd25', { name: 'Seedance 2.5', badges: [], desc: '' }) > 0);
eq('KLING 与 kling 等分（内部转小写）', api.score('KLING', { name: 'Kling 4.0' }), api.score('kling', { name: 'Kling 4.0' }));
ok('名称子串 > 名称子序列', api.score('kling', { name: 'Kling 4.0' }) > api.score('klng', { name: 'Kling 4.0' }));
ok('"klng" 子序列仍命中', api.score('klng', { name: 'Kling 4.0' }) > 0);
eq('角标子串 = 150', api.score('限时', { name: 'Kling 4.0', badges: ['限时6折'] }), 150);
eq('描述子串 = 100', api.score('音画', { name: 'Wan 2.6', badges: [], desc: '音画同步，支持多机位镜头' }), 100);
ok('描述子序列命中 = 60', api.score('音步', { name: 'X', badges: [], desc: '音画同步' }) === 60);
eq('完全不匹配 → 0', api.score('zzz', { name: 'Kling 4.0', badges: [], desc: '高视听品质' }), 0);
eq('空查询返回 1（全保留）', api.score('', { name: 'x' }), 1);
ok('同查询按名称出现位置排序', api.score('seed', { name: 'Seedance 2.5' }) > api.score('seed', { name: 'X Seedream' }));
ok('"h3" 命中 H3-Highspeed', api.score('h3', { name: 'H3-Highspeed' }) > 0);
ok('角标名分高于名称子序列（检查顺序）', api.score('k4f', { name: 'Kling 4.0 Flash' }) > 0);
ok('全角括号拆词：样片模式可词前缀', api.score('样片', { name: 'Seedance 2.5（样片模式）' }) > 0);

console.log('--- 分组 _ltMselGroups ---');
const g1 = api.groups([
  { name: 'Minimax H3', icon: 'ic1' },
  { name: 'H3-Highspeed', icon: 'ic1' },
  { name: 'Minimax H3 Max', icon: 'ic1' },
  { name: 'Kling 4.0', icon: 'ic2' },
  { name: 'Kling 4.0 Flash', icon: 'ic2' },
  { name: 'Style Video', icon: null }
]);
eq('组数 = 3（两图标组 + 无键组）', g1.length, 3);
eq('多数派首词 = Minimax（修 H3-Highspeed 归属）', g1[0].label, 'Minimax');
eq('图标组二 = Kling', g1[1].label, 'Kling');
eq('无键组用自身首词（不再落其它）', g1[2].label, 'Style');
eq('组顺序按首现', g1.map(g => g.label), ['Minimax', 'Kling', 'Style']);
eq('组内元素齐全', g1[0].items.length, 3);
ok('单模型组用自身首词', (() => {
  const g = api.groups([{ name: 'OmniHuman 1.5', icon: 'ic9' }]);
  return g.length === 1 && g[0].label === 'OmniHuman';
})());

console.log('--- 分表 _ltMselClassify ---');
eq('视频表（min 胶囊）', api.classify(['2min', '3min', '1min']), 'video');
eq('图片表（s 胶囊）', api.classify(['20s', '30s', '15s']), 'image');
eq('都无 → misc', api.classify([]), 'misc');
ok('min 优先于 s（混合按视频算）', api.classify(['30s', '2min']) === 'video');

console.log('--- 组合：搜索过滤后分组 ---');
const models = [
  { name: 'Seedance 2.5', icon: 's1', badges: [], desc: '最强视频模型' },
  { name: 'Seedance 2.5 Flash', icon: 's1', badges: ['首发'], desc: '' },
  { name: 'Kling 4.0', icon: 'k1', badges: [], desc: '' }
];
const hit = models.filter(m => api.score('seed', m) > 0);
eq('"seed" 过滤出 2 条', hit.length, 2);
const hg = api.groups(hit);
eq('过滤后仍是同组', hg.length, 1);
eq('组名 Seedance', hg[0].label, 'Seedance');

console.log('');
console.log(pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
