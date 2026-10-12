/* 桌宠素材包单测：从 src/inject.js 提取 __lt_pet_pure_* 纯函数块，测图集校验/包解析/视线数学 */
const fs = require('fs');
const src = fs.readFileSync('src/inject.js', 'utf8');

const start = src.indexOf('var _ltPetStrips=');
const end = src.indexOf('/* __lt_pet_pure_end__ */');
if (start < 0 || end < 0) { console.error('提取失败'); process.exit(1); }
const block = src.slice(start, end);

const factory = new Function(block +
  ';return {slug:_ltPetSlug,norm:_ltPetNormConf,grid:_ltPetGrid,pick:_ltPetPickFiles,look:_ltPetLookIndex,cell:_ltPetLookCell,strips:_ltPetStrips,strip:_ltPetStrip};');
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

console.log('--- 动作表 ---');
eq('9 组动作', api.strips.length, 9);
eq('idle 行', api.strip('idle'), { id: 'idle', row: 0, frames: 6, fps: 7, loop: true });
eq('running-right 行', api.strip('running-right'), { id: 'running-right', row: 1, frames: 8, fps: 12, loop: true });
eq('waving 非循环', api.strip('waving').loop, false);
eq('未知 id 兜底 idle', api.strip('nope').id, 'idle');

console.log('--- slug ---');
eq('英文+符号', api.slug('Codex Bot!'), 'codex-bot');
eq('中文保留', api.slug('喵喵'), '喵喵');
eq('全非法兜底', api.slug('!!!'), 'pet');

console.log('--- pet.json 容错映射 ---');
eq('完整字段', api.norm({ id: 'Codex', displayName: 'Codex · 小机器人', description: 'd', spriteVersionNumber: 2, spritesheetPath: 'spritesheet.webp' }, null),
  { id: 'codex', displayName: 'Codex · 小机器人', description: 'd', spriteVersionNumber: 2, spritesheetPath: 'spritesheet.webp' });
eq('name/displayName 别名', api.norm({ name: '阿猫', spritesheet: 'sheet.png' }, null).displayName, '阿猫');
eq('数字 2 → v2', api.norm({ spriteVersionNumber: 2 }, 'x').spriteVersionNumber, 2);
eq('字符串 "2" → v2', api.norm({ spriteVersionNumber: '2' }, 'x').spriteVersionNumber, 2);
eq('其他值 → v1', api.norm({ spriteVersionNumber: 3 }, 'x').spriteVersionNumber, 1);
eq('缺省 → v1 + 默认图集名', api.norm({}, 'fallback名'), { id: 'fallback名', displayName: 'fallback名', description: '', spriteVersionNumber: 1, spritesheetPath: 'spritesheet.webp' });
throws('非对象报错', () => api.norm('x', null), '必须是对象');
throws('空 spritesheetPath 报错', () => api.norm({ spritesheetPath: '' }, null), 'spritesheetPath');

console.log('--- 图集网格校验 ---');
eq('v2 基准 1536×2288', api.grid(1536, 2288, 1), { ver: 2, rows: 11, cellW: 192, cellH: 208 });
eq('v1 基准 1536×1872', api.grid(1536, 1872, 2), { ver: 1, rows: 9, cellW: 192, cellH: 208 });
eq('半尺寸 v2 768×1144', api.grid(768, 1144, 1), { ver: 2, rows: 11, cellW: 96, cellH: 104 });
eq('模糊比值取中点偏 v1', api.grid(752, 1008, 2), { ver: 1, rows: 9, cellW: 94, cellH: 112 });
eq('模糊比值取中点偏 v2', api.grid(744, 1001, 1), { ver: 2, rows: 11, cellW: 93, cellH: 91 });
throws('宽度非 8 倍数', () => api.grid(1540, 2288, 2), '被 8 整除');
throws('尺寸过小', () => api.grid(1536, 100, 2), '尺寸无效');
throws('高度无法均分 11 行', () => api.grid(1536, 2289, 2), '无法均分');
throws('高度无法均分 9 行', () => api.grid(1536, 1871, 1), '无法均分');

console.log('--- 文件挑选 ---');
const f = (n) => ({ name: n });
eq('标准两文件', api.pick([f('pet.json'), f('spritesheet.webp')]), { conf: f('pet.json'), sheet: f('spritesheet.webp') });
eq('大小写/连字符变体', api.pick([f('PET.JSON'), f('sprite-sheet.PNG')]), { conf: f('PET.JSON'), sheet: f('sprite-sheet.PNG') });
eq('无 pet.json 用图片兜底', api.pick([f('my-pet.png')]), { conf: null, sheet: f('my-pet.png') });
eq('任意 png 回退为图集', api.pick([f('pet.json'), f('art.png')]), { conf: f('pet.json'), sheet: f('art.png') });
throws('缺图集报错', () => api.pick([f('pet.json')]), 'spritesheet');

console.log('--- 视线数学（0°=正上，顺时针，对齐 mayi） ---');
eq('死区内返回 null', api.look(10, 10), null);
eq('非有限值返回 null', api.look(NaN, 10), null);
eq('正上 = 0', api.look(0, -100), 0);
eq('正右 = 4', api.look(100, 0), 4);
eq('正下 = 8', api.look(0, 100), 8);
eq('正左 = 12', api.look(-100, 0), 12);
eq('右上 30° → 1', api.look(58, -100), 1);
eq('右下 30° → 7', api.look(58, 100), 7);
eq('环绕：左上微角 → 15', api.look(-26, -100), 15);
eq('lookCell 0', api.cell(0), { row: 9, col: 0 });
eq('lookCell 7', api.cell(7), { row: 9, col: 7 });
eq('lookCell 8', api.cell(8), { row: 10, col: 0 });
eq('lookCell 15', api.cell(15), { row: 10, col: 7 });

console.log(pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
