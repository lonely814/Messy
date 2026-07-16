// ==UserScript==
// @name         LibTV Canvas Boost
// @namespace    https://github.com/hero8152/Infinite-Canvas
// @version      1.6
// @description  性能优化 · G网格 T性能 H隐藏 L连线 C全链 F搜索 P提示词 X专注 R直角 I标签 ?帮助 · AI增强 · 标签 · 提示词模板 · 模板变量 · 主题(画布配色DIY)
// @match        *://*.iblib.tv/canvas*
// @match        *://*.liblib.tv/canvas*
// @run-at       document-idle
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// ==/UserScript==

(function(){
    'use strict';

    /* =========================================================
     *  1. CSS 注入
     * ========================================================= */
    var style = document.createElement('style');
    style.id = 'libtv-boost-css';
    style.textContent = [
        /* 主题变量 */
        ':root {',
        '  --accent: #6366f1;',
        '  --accent-light: #818cf8;',
        '  --accent-dark: #4f46e5;',
        '  --accent-rgb: 99,102,241;',
        '  --accent-light-rgb: 129,140,248;',
        '  --canvas-bg: #0f0f0f;',
        '  --grid-color: rgba(255,255,255,0.12);',
        '  --node-bg: #1a1a2e;',
        '  --border-color: rgba(255,255,255,0.12);',
        '  --edge-color: rgba(255,255,255,0.08);',
        '}',

        /* 节点过渡 */
        '.react-flow__node {',
        '  transition: box-shadow 0.25s ease, opacity 0.2s ease !important;',
        '  border-radius: 12px;',
        '}',

        /* 选中节点 — 发光轮廓 + 底部光晕 */
        '.react-flow__node.selected {',
        '  outline: none !important;',
        '  box-shadow:',
        '    0 0 0 2px rgba(255,255,255,0.7),',
        '    0 0 0 5px var(--accent, #6366f1),',
        '    0 0 16px var(--accent, #6366f1),',
        '    0 0 48px rgba(var(--accent-rgb),0.4) !important;',
        '}',
        '.react-flow__node.selected::after {',
        '  content: ""; position: absolute;',
        '  left: 10%; right: 10%; bottom: -4px; height: 3px;',
        '  border-radius: 2px; opacity: 1;',
        '  background: linear-gradient(90deg,transparent,var(--accent,#818cf8),transparent);',
        '  box-shadow: 0 0 10px var(--accent,#818cf8),',
        '              0 0 20px rgba(var(--accent-light-rgb),0.4);',
        '}',

        /* 网格背景隐藏 */
        '.react-flow__background.perf-no-grid { display: none !important; }',

        /* 隐藏连线 */
        '.react-flow__edges.perf-hide-edges { display: none !important; }',

        /* 连线美化 */
        '.react-flow__edge-path {',
        '  stroke: var(--faint, rgba(255,255,255,0.15)) !important;',
        '  stroke-width: 1.8 !important;',
        '  transition: stroke 0.15s, stroke-width 0.15s !important;',
        '}',
        '.react-flow__edge.libtv-edge-active .react-flow__edge-path {',
        '  stroke: var(--strong, #818cf8) !important;',
        '  stroke-width: 2.5 !important;',
        '}',
        'body.libtv-chain .react-flow__edge.libtv-chain-edge .react-flow__edge-path {',
        '  stroke: var(--accent, #818cf8) !important;',
        '  stroke-width: 2.5 !important;',
        '  filter: drop-shadow(0 0 6px rgba(var(--accent-light-rgb),0.6));',
        '}',
        'body.perf-mode .react-flow__edge-path {',
        '  stroke-width: 0.8 !important;',
        '  transition: none !important;',
        '  filter: none !important;',
        '}',
        'body.libtv-step-edges .react-flow__edge-path {',
        '  transition: none !important;',
        '}',

        /* 隐藏图片 */
        'body.perf-hide-imgs .react-flow__node img {',
        '  display: none !important;',
        '}',

        /* 性能模式 */
        'body.perf-mode .react-flow__node {',
        '  box-shadow: none !important; border-radius: 0 !important;',
        '  backdrop-filter: none !important;',
        '  border-color: rgba(255,255,255,0.06) !important;',
        '  opacity: 0.85;',
        '  transition: none !important;',
        '  animation: none !important;',
        '}',
        'body.perf-mode .react-flow__node [class*="rounded"] { border-radius: 0 !important; }',
        'body.perf-mode .react-flow__node:hover {',
        '  opacity: 1;',
        '}',
        'body.perf-mode .react-flow {',
        '  backdrop-filter: none !important;',
        '}',
        'body.perf-mode * {',
        '  animation-duration: 0s !important;',
        '  animation-delay: 0s !important;',
        '  transition-duration: 0s !important;',
        '  backdrop-filter: none !important;',
        '}',
        'body.perf-mode #libtv-glow { display: none !important; }',

        /* FPS 面板 — 紧凑小药丸 */
        '#libtv-fps {',
        '  position: fixed; right: 14px; bottom: 14px; z-index: 99999;',
        '  padding: 4px 10px 4px 8px; border-radius: 20px;',
        '  background: rgba(0,0,0,0.4); color: #aaa;',
        '  font: 10px/1.5 -apple-system, "SF Mono", monospace;',
        '  user-select: none;',
        '  backdrop-filter: blur(16px);',
        '  border: 1px solid rgba(255,255,255,0.05);',
        '  white-space: nowrap;',
        '  display: inline-flex; align-items: center; gap: 4px;',
        '  cursor: grab;',
        '  transition: all 0.2s ease;',
        '}',
        '#libtv-fps:hover {',
        '  background: rgba(0,0,0,0.55);',
        '  border-color: rgba(255,255,255,0.1);',
        '  padding: 5px 12px 5px 10px;',
        '}',
        '#libtv-fps:active { cursor: grabbing; }',
        '#libtv-fps .fps-val { color: #8f8; font-weight: 600; }',
        '#libtv-fps .fps-flag { color: #fa0; }',
        '#libtv-fps .fps-sep  { color: rgba(255,255,255,0.12); }',
        '#libtv-fps .fps-zoom { color: #88f; }',

        /* 快捷键提示 — 底部滑入/出 */
        '#libtv-help {',
        '  position:fixed; left:50%; bottom:12px; z-index:99998;',
        '  transform:translateX(-50%) translateY(0);',
        '  color:rgba(255,255,255,0.25);',
        '  font:10px/1.7 -apple-system,"SF Mono",monospace;',
        '  pointer-events:none; user-select:none;',
        '  white-space:nowrap; letter-spacing:0.04em;',
        '  transition: opacity 0.35s ease, transform 0.35s ease;',
        '}',
        '#libtv-help.libtv-hide {',
        '  opacity:0;',
        '  transform:translateX(-50%) translateY(12px);',
        '}',

        /* 链高亮模式 */
        'body.libtv-chain .react-flow__node { opacity: 0.08 !important; }',
        'body.libtv-chain .react-flow__node.selected,',
        'body.libtv-chain .react-flow__node.libtv-chain-node',
        '  { opacity: 1 !important; }',
        'body.libtv-chain .react-flow__edge   { opacity: 0.03 !important; }',
        'body.libtv-chain .react-flow__edge.libtv-chain-edge',
        '  { opacity: 0.6 !important; }',

        /* 专注模式 — 隐藏工具栏/侧栏/顶栏/头像等 */
        'body.libtv-focus [data-toolbar-collapsed],' +
        'body.libtv-focus [data-sidebar-container],' +
        'body.libtv-focus header,' +
        'body.libtv-focus nav,' +
        'body.libtv-focus aside {',
        '  display: none !important;',
        '}',

        /* 专注模式时放大画布区域 */
        'body.libtv-focus .react-flow {',
        '  width: 100vw !important;',
        '  height: 100vh !important;',
        '  max-width: none !important;',
        '}',

        /* 搜索框玻璃效果 */
        '#libtv-search {',
        '  backdrop-filter: blur(20px) !important;',
        '  -webkit-backdrop-filter: blur(20px) !important;',
        '  border: 1px solid rgba(255,255,255,0.08) !important;',
        '}',

        /* 提示词面板 — 霓虹玻璃风格 */
        '#libtv-prompt {',
        '  position:fixed; z-index:99999;',
        '  width:440px; max-width:88vw; max-height:68vh;',
        '  background:rgba(12,12,20,0.88);',
        '  backdrop-filter:blur(32px) saturate(1.4); -webkit-backdrop-filter:blur(32px) saturate(1.4);',
        '  border:1px solid rgba(129,140,248,0.25);',
        '  border-radius:16px; padding:0; overflow:hidden;',
        '  display:flex; flex-direction:column;',
        '  font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; color:#d4d4d8;',
        '  box-shadow:',
        '    0 0 1px rgba(129,140,248,0.6),',
        '    0 0 8px rgba(129,140,248,0.15),',
        '    0 0 24px rgba(129,140,248,0.08),',
        '    0 16px 48px rgba(0,0,0,0.5);',
        '  animation: libtv-panel-glow 4s ease-in-out infinite alternate;',
        '}',
        '@keyframes libtv-panel-glow {',
        '  0%   { border-color:rgba(129,140,248,0.2); box-shadow:0 0 1px rgba(129,140,248,0.5),0 0 8px rgba(129,140,248,0.1),0 0 20px rgba(129,140,248,0.05),0 16px 48px rgba(0,0,0,0.5); }',
        '  100% { border-color:rgba(129,140,248,0.4); box-shadow:0 0 1px rgba(129,140,248,0.8),0 0 12px rgba(129,140,248,0.25),0 0 32px rgba(129,140,248,0.12),0 16px 48px rgba(0,0,0,0.5); }',
        '}',
        '#libtv-prompt::before {',
        '  content:""; position:absolute; top:-1px; left:20%; right:20%; height:1px;',
        '  background:linear-gradient(90deg,transparent,rgba(129,140,248,0.6),transparent);',
        '  pointer-events:none;',
        '}',
        '#libtv-prompt .ltp-head {',
        '  display:flex; align-items:center; justify-content:space-between;',
        '  padding:14px 18px 10px; border-bottom:1px solid rgba(129,140,248,0.12);',
        '  flex-shrink:0;',
        '}',
        '#libtv-prompt .ltp-head h3 { margin:0; font-size:13px; color:#e0e7ff; font-weight:600; letter-spacing:0.02em; text-shadow:0 0 12px rgba(129,140,248,0.4); }',
        '#libtv-prompt .ltp-close { cursor:pointer; font-size:16px; color:rgba(255,255,255,0.25); transition:all .15s; line-height:1; }',
        '#libtv-prompt .ltp-close:hover { color:#818cf8; text-shadow:0 0 8px rgba(129,140,248,0.5); }',
        '#libtv-prompt .ltp-tabs { display:flex; gap:0; padding:0 18px; border-bottom:1px solid rgba(129,140,248,0.12); flex-shrink:0; }',
        '#libtv-prompt .ltp-tab { padding:10px 16px; cursor:pointer; color:rgba(255,255,255,0.3); font-size:12px; border-bottom:1.5px solid transparent; transition:all .15s; letter-spacing:0.02em; user-select:none; }',
        '#libtv-prompt .ltp-tab:hover { color:rgba(224,231,255,0.7); }',
        '#libtv-prompt .ltp-tab.active { color:#818cf8; border-bottom-color:#818cf8; text-shadow:0 0 8px rgba(129,140,248,0.5); }',
        '#libtv-prompt .ltp-body { padding:14px 18px; overflow-y:auto; flex:1; max-height:42vh; position:relative; }',
        '#libtv-prompt .ltp-body textarea { width:100%; box-sizing:border-box; min-height:80px; padding:10px 12px; border-radius:10px; border:1px solid rgba(129,140,248,0.2); background:rgba(129,140,248,0.04); color:#e0e7ff; font:12px/1.5 ui-monospace,SFMono-Regular,monospace; outline:none; resize:vertical; transition:border-color .15s, box-shadow .15s; }',
        '#libtv-prompt .ltp-body textarea:focus { border-color:#818cf8; box-shadow:0 0 12px rgba(129,140,248,0.2); }',
        '#libtv-prompt .ltp-body input[type="text"],#libtv-prompt .ltp-body input[type="password"] { width:100%; box-sizing:border-box; padding:8px 12px; border-radius:8px; border:1px solid rgba(129,140,248,0.2); background:rgba(129,140,248,0.04); color:#e0e7ff; font:12px/1.5 ui-monospace,SFMono-Regular,monospace; outline:none; transition:border-color .15s, box-shadow .15s; }',
        '#libtv-prompt .ltp-body input:focus { border-color:#818cf8; box-shadow:0 0 12px rgba(129,140,248,0.2); }',
        '#libtv-prompt .ltp-btn { display:inline-flex; align-items:center; gap:5px; padding:6px 14px; border-radius:8px; border:none; cursor:pointer; font:12px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; transition:all .15s; }',
        '#libtv-prompt .ltp-btn-primary { background:linear-gradient(135deg,#6366f1,#818cf8); color:#fff; box-shadow:0 0 12px rgba(129,140,248,0.3); }',
        '#libtv-prompt .ltp-btn-primary:hover { background:linear-gradient(135deg,#818cf8,#a5b4fc); box-shadow:0 0 16px rgba(129,140,248,0.4); }',
        '#libtv-prompt .ltp-btn-sm { padding:4px 12px; font-size:11px; border-radius:6px; }',
        '#libtv-prompt .ltp-btn-danger { background:rgba(239,68,68,0.12); color:#f87171; }',
        '#libtv-prompt .ltp-btn-danger:hover { background:rgba(239,68,68,0.22); }',
        '#libtv-prompt .ltp-btn-ghost { background:rgba(255,255,255,0.04); color:#aaa; }',
        '#libtv-prompt .ltp-btn-ghost:hover { background:rgba(255,255,255,0.08); color:#fff; }',
        '#libtv-prompt .ltp-cat { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px; }',
        '#libtv-prompt .ltp-cat-btn { padding:3px 12px; border-radius:14px; border:1px solid rgba(129,140,248,0.2); cursor:pointer; font:11px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; color:rgba(255,255,255,0.4); background:transparent; transition:all .15s; }',
        '#libtv-prompt .ltp-cat-btn:hover { border-color:rgba(129,140,248,0.4); color:#818cf8; }',
        '#libtv-prompt .ltp-cat-btn.active { background:rgba(129,140,248,0.2); border-color:#818cf8; color:#a5b4fc; box-shadow:0 0 8px rgba(129,140,248,0.2); }',
        '#libtv-prompt .ltp-item { display:flex; align-items:center; justify-content:space-between; padding:7px 10px; border-radius:8px; cursor:pointer; transition:background .12s; position:relative; overflow:hidden; }',
        '#libtv-prompt .ltp-item::before { content:""; position:absolute; inset:0; border-radius:8px; opacity:0; transition:opacity .25s; background:radial-gradient(300px circle at var(--mx,50%) var(--my,50%),rgba(129,140,248,0.18),transparent 55%); pointer-events:none; }',
        '#libtv-prompt .ltp-item:hover::before { opacity:1; }',
        '#libtv-prompt .ltp-item:hover { background:rgba(255,255,255,0.04); }',
        '#libtv-prompt .ltp-item .ltp-name { font-size:12px; color:#c7d2fe; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
        '#libtv-prompt .ltp-item .ltp-actions { display:flex; gap:4px; opacity:0; transition:opacity .15s; }',
        '#libtv-prompt .ltp-item:hover .ltp-actions { opacity:1; }',
        '#libtv-prompt .ltp-item .ltp-preview { font-size:11px; color:rgba(255,255,255,0.25); margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
        '#libtv-prompt .ltp-status { font-size:11px; color:rgba(255,255,255,0.3); margin-top:6px; }',
        '#libtv-prompt .ltp-empty { text-align:center; padding:30px 0; color:rgba(255,255,255,0.2); font-size:13px; }',

        /* 模板变量填充弹窗 */
        '#libtv-prompt .ltp-var-overlay { position:absolute; inset:0; z-index:10; background:rgba(8,8,16,0.94); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); display:flex; flex-direction:column; padding:16px 18px; border-radius:12px; border:1px solid rgba(129,140,248,0.15); }',
        '#libtv-prompt .ltp-var-title { font-size:13px; color:#fff; font-weight:600; margin-bottom:10px; }',
        '#libtv-prompt .ltp-var-sub { font-size:11px; color:rgba(255,255,255,0.25); margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.06); }',
        '#libtv-prompt .ltp-var-row { margin-bottom:8px; display:flex; align-items:center; gap:8px; }',
        '#libtv-prompt .ltp-var-row label { font-size:11px; color:rgba(255,255,255,0.4); min-width:64px; flex-shrink:0; text-align:right; }',
        '#libtv-prompt .ltp-var-row input { flex:1; padding:6px 10px; border-radius:6px; border:1px solid rgba(129,140,248,0.2); background:rgba(129,140,248,0.04); color:#e0e7ff; font:12px/1.4 ui-monospace,SFMono-Regular,monospace; outline:none; transition:border-color .15s, box-shadow .15s; }',
        '#libtv-prompt .ltp-var-row input:focus { border-color:#818cf8; box-shadow:0 0 8px rgba(129,140,248,0.2); }',
        '#libtv-prompt .ltp-var-preview { margin-top:8px; padding:8px 10px; border-radius:6px; background:rgba(255,255,255,0.03); font-size:11px; color:rgba(255,255,255,0.3); white-space:pre-wrap; word-break:break-all; max-height:80px; overflow-y:auto; flex-shrink:0; }',
        '#libtv-prompt .ltp-var-actions { display:flex; gap:6px; margin-top:auto; padding-top:10px; justify-content:flex-end; border-top:1px solid rgba(255,255,255,0.06); }',

        /* 调色板 */
        '.ltp-pal-section { margin-bottom:14px; }',
        '.ltp-pal-section-title { font-size:11px; color:rgba(255,255,255,0.35); letter-spacing:0.05em; margin-bottom:8px; cursor:pointer; display:flex; align-items:center; gap:6px; user-select:none; }',
        '.ltp-pal-section-title::before { content:"▸"; font-size:9px; transition:transform .15s; }',
        '.ltp-pal-section-title.open::before { transform:rotate(90deg); }',
        '.ltp-pal-section-body { display:grid; grid-template-columns:repeat(auto-fill,minmax(32px,1fr)); gap:6px; }',
        '.ltp-pal-section-body.collapsed { display:none; }',
        '.ltp-pal-swatch { width:32px; height:32px; border-radius:6px; cursor:pointer; border:2px solid transparent; transition:all .15s; position:relative; }',
        '.ltp-pal-swatch:hover { transform:scale(1.15); border-color:rgba(255,255,255,0.4); z-index:1; }',
        '.ltp-pal-swatch.copied { border-color:#22c55e !important; }',
        '.ltp-pal-swatch .ltp-pal-tip { position:absolute; bottom:calc(100% + 4px); left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.85); color:#fff; font-size:10px; padding:2px 6px; border-radius:4px; white-space:nowrap; opacity:0; pointer-events:none; transition:opacity .15s; }',
        '.ltp-pal-swatch:hover .ltp-pal-tip { opacity:1; }',
        '.ltp-pal-picker { display:flex; align-items:center; gap:12px; margin-bottom:16px; padding:12px; border-radius:10px; background:rgba(255,255,255,0.03); border:1px solid rgba(129,140,248,0.12); }',
        '.ltp-pal-picker input[type="color"] { width:48px; height:48px; border:none; border-radius:8px; cursor:pointer; background:none; padding:0; }',
        '.ltp-pal-picker input[type="color"]::-webkit-color-swatch-wrapper { padding:0; }',
        '.ltp-pal-picker input[type="color"]::-webkit-color-swatch { border-radius:8px; border:2px solid rgba(255,255,255,0.1); }',
        '.ltp-pal-info { flex:1; }',
        '.ltp-pal-hex { font-size:16px; font-weight:600; color:#e0e7ff; cursor:pointer; letter-spacing:0.03em; }',
        '.ltp-pal-hex:hover { color:#a5b4fc; }',
        '.ltp-pal-rgb, .ltp-pal-hsl { font-size:11px; color:rgba(255,255,255,0.35); margin-top:2px; cursor:pointer; }',
        '.ltp-pal-rgb:hover, .ltp-pal-hsl:hover { color:rgba(255,255,255,0.6); }',
        '.ltp-pal-ai { display:flex; gap:6px; align-items:center; margin-top:10px; padding:8px 10px; border-radius:8px; background:rgba(129,140,248,0.08); border:1px solid rgba(129,140,248,0.15); }',
        '.ltp-pal-ai-desc { flex:1; font-size:11px; color:rgba(255,255,255,0.5); line-height:1.5; }',
        '.ltp-pal-recent { display:flex; gap:4px; flex-wrap:wrap; margin-top:12px; }',
        '.ltp-pal-recent-title { width:100%; font-size:11px; color:rgba(255,255,255,0.3); margin-bottom:4px; }',
        '.ltp-pal-toast { position:fixed; bottom:30px; left:50%; transform:translateX(-50%); background:rgba(129,140,248,0.9); color:#fff; font-size:12px; padding:6px 16px; border-radius:8px; z-index:999999; pointer-events:none; opacity:0; transition:opacity .2s; }',
        '.ltp-pal-toast.show { opacity:1; }',

        /* 提示词悬浮按钮 */
        '#libtv-pbtn {',
        '  transition: transform 0.2s ease !important;',
        '  background: #000 !important;',
        '  border: none !important;',
        '  box-shadow:',
        '    inset 0 0 8px #fff,',
        '    inset 3px 0 10px #f0f,',
        '    inset -3px 0 10px #0ff,',
        '    inset 3px 0 30px #f0f,',
        '    inset -3px 0 30px #0ff,',
        '    0 0 8px #fff,',
        '    -2px 0 10px #f0f,',
        '    2px 0 10px #0ff !important;',
        '  animation: libtv-pbtn-glow 3s ease-in-out infinite alternate !important;',
        '}',
        '@keyframes libtv-pbtn-glow {',
        '  0%   { box-shadow: inset 0 0 6px #fff, inset 2px 0 8px #f0f, inset -2px 0 8px #0ff, inset 2px 0 20px #f0f, inset -2px 0 20px #0ff, 0 0 6px #fff, -1px 0 8px #f0f, 1px 0 8px #0ff !important; }',
        '  100% { box-shadow: inset 0 0 12px #fff, inset 4px 0 14px #f0f, inset -4px 0 14px #0ff, inset 4px 0 40px #f0f, inset -4px 0 40px #0ff, 0 0 12px #fff, -3px 0 14px #f0f, 3px 0 14px #0ff !important; }',
        '}',
        '#libtv-pbtn:hover {',
        '  transform: scale(1.08) !important;',
        '}',
        '#libtv-pbtn:active {',
        '  cursor: grabbing !important;',
        '  transform: scale(0.94) !important;',
        '}',

        /* 画布主题覆盖 — 仅覆盖节点/连线的颜色，不动画布背景（保留站点原生网格） */
        '.react-flow__node { background: var(--node-bg) !important; border-color: var(--border-color) !important; }',
        '.react-flow__edge-path { stroke: var(--edge-color) !important; }',

        /* 标签系统 */
        '.lt-tag-menu { position:fixed; z-index:100000; width:320px; max-height:340px; background:rgba(15,15,20,0.92); backdrop-filter:blur(24px) saturate(1.3); -webkit-backdrop-filter:blur(24px) saturate(1.3); border:1px solid rgba(129,140,248,0.2); border-radius:12px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 8px 32px rgba(0,0,0,0.6),0 0 0 1px rgba(129,140,248,0.08); }',
        '.lt-tag-head { display:flex; align-items:center; justify-content:space-between; padding:10px 14px 8px; border-bottom:1px solid rgba(129,140,248,0.1); font-size:12px; color:#e0e7ff; font-weight:600; flex-shrink:0; letter-spacing:0.03em; }',
        '.lt-tag-close { cursor:pointer; font-size:14px; color:rgba(255,255,255,0.2); transition:color .15s; line-height:1; }',
        '.lt-tag-close:hover { color:#818cf8; }',
        '.lt-tag-tabs { display:flex; gap:2px; padding:6px 10px 0; border-bottom:1px solid rgba(129,140,248,0.08); flex-shrink:0; overflow-x:auto; }',
        '.lt-tag-tab { padding:6px 12px 8px; cursor:pointer; font-size:11px; color:rgba(255,255,255,0.3); border-bottom:1.5px solid transparent; transition:all .15s; user-select:none; white-space:nowrap; letter-spacing:0.02em; }',
        '.lt-tag-tab:hover { color:rgba(224,231,255,0.6); }',
        '.lt-tag-tab.active { color:#818cf8; border-bottom-color:#818cf8; text-shadow:0 0 8px rgba(129,140,248,0.4); }',
        '.lt-tag-body { flex:1; overflow-y:auto; padding:8px 10px; display:flex; flex-wrap:wrap; align-content:flex-start; gap:6px; }',
        '.lt-tag-item { padding:5px 12px; border-radius:16px; font-size:11px; color:rgba(255,255,255,0.7); background:rgba(129,140,248,0.08); border:1px solid rgba(129,140,248,0.12); cursor:pointer; transition:all .12s; user-select:none; line-height:1.4; }',
        '.lt-tag-item:hover { background:rgba(129,140,248,0.2); color:#c7d2fe; border-color:rgba(129,140,248,0.3); box-shadow:0 0 10px rgba(129,140,248,0.15); }',
        '.lt-tag-foot { padding:6px 10px 8px; border-top:1px solid rgba(129,140,248,0.08); flex-shrink:0; text-align:center; }',
        '.lt-tag-mgr { background:none; border:none; font-size:11px; color:rgba(255,255,255,0.25); cursor:pointer; padding:2px 8px; transition:color .15s; }',
        '.lt-tag-mgr:hover { color:#818cf8; }',
        /* 管理面板 */
        '.lt-mgr-overlay { position:fixed; inset:0; z-index:100001; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.5); backdrop-filter:blur(4px); }',
        '.lt-mgr-panel { width:400px; max-width:88vw; max-height:70vh; background:rgba(15,15,20,0.95); backdrop-filter:blur(32px) saturate(1.3); -webkit-backdrop-filter:blur(32px) saturate(1.3); border:1px solid rgba(129,140,248,0.2); border-radius:14px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 16px 48px rgba(0,0,0,0.6); }',
        '.lt-mgr-head { display:flex; align-items:center; justify-content:space-between; padding:14px 16px 10px; border-bottom:1px solid rgba(129,140,248,0.1); font-size:13px; color:#e0e7ff; font-weight:600; flex-shrink:0; }',
        '.lt-mgr-body { flex:1; overflow-y:auto; padding:12px 16px; }',
        '.lt-mgr-foot { padding:10px 16px 14px; border-top:1px solid rgba(129,140,248,0.08); flex-shrink:0; }',
        '.lt-mgr-group { margin-bottom:14px; border:1px solid rgba(129,140,248,0.1); border-radius:8px; padding:10px 12px; background:rgba(129,140,248,0.03); }',
        '.lt-mgr-ghead { display:flex; align-items:center; gap:8px; margin-bottom:8px; }',
        '.lt-mgr-gname { flex:1; background:rgba(255,255,255,0.04); border:1px solid rgba(129,140,248,0.12); border-radius:5px; padding:4px 8px; font:12px/1.5 -apple-system,sans-serif; color:#d4d4d8; outline:none; transition:border-color .12s; }',
        '.lt-mgr-gname:focus { border-color:#818cf8; }',
        '.lt-tag-delg { background:none; border:none; color:rgba(239,68,68,0.5); cursor:pointer; font-size:10px; padding:2px 6px; border-radius:4px; transition:all .12s; }',
        '.lt-tag-delg:hover { background:rgba(239,68,68,0.15); color:#f87171; }',
        '.lt-mgr-item { display:flex; align-items:center; gap:6px; margin:4px 0; }',
        '.lt-mgr-itext { flex:1; background:rgba(255,255,255,0.04); border:1px solid rgba(129,140,248,0.1); border-radius:4px; padding:3px 8px; font:11px/1.5 -apple-system,sans-serif; color:#d4d4d8; outline:none; }',
        '.lt-mgr-itext:focus { border-color:#818cf8; }',
        '.lt-tag-deli { background:none; border:none; color:rgba(239,68,68,0.4); cursor:pointer; font-size:9px; padding:2px 4px; border-radius:3px; }',
        '.lt-tag-deli:hover { background:rgba(239,68,68,0.12); color:#f87171; }',
        '.lt-mgr-add-item { margin-top:4px; }',

        /* 标签栏 — 吸附在输入框右侧 */
        '.lt-tag-bar { display:flex; flex-direction:column; gap:2px; flex-shrink:0; padding:4px 2px; justify-content:center; align-items:stretch; min-width:50px; }',
        '.lt-tag-bar-item { padding:1px 6px; border-radius:8px; font-size:10px; color:rgba(255,255,255,0.45); background:rgba(129,140,248,0.04); border:1px solid rgba(129,140,248,0.06); cursor:pointer; transition:all .12s; user-select:none; white-space:nowrap; line-height:1.7; text-align:center; }',
        '.lt-tag-bar-item:hover { background:rgba(129,140,248,0.12); color:#c7d2fe; border-color:rgba(129,140,248,0.2); }',
        '.lt-tag-bar-expand { font-size:8px; color:rgba(255,255,255,0.15); cursor:pointer; text-align:center; padding:1px 0 0; transition:color .12s; line-height:1.4; }',
        '.lt-tag-bar-expand:hover { color:#818cf8; }',
        '.lt-tag-bar-nav { display:flex; align-items:center; justify-content:center; gap:2px; margin-bottom:2px; }',
        '.lt-tag-bar-arrow { font-size:10px; color:rgba(255,255,255,0.25); cursor:pointer; padding:0 2px; user-select:none; transition:color .12s; line-height:1; }',
        '.lt-tag-bar-arrow:hover { color:#818cf8; }',
        '.lt-tag-bar-gname { font-size:8px; color:rgba(255,255,255,0.2); white-space:nowrap; letter-spacing:0.02em; }',
        '.lt-tag-bar-head { text-align:center; cursor:pointer; padding:1px 0 2px; opacity:0.35; color:#fff; transition:opacity .15s; line-height:1; }',
        '.lt-tag-bar-head:hover { opacity:0.7; }',
    ].join('\n');
    document.head.appendChild(style);

    /* =========================================================
     *  2. FPS 面板
     * ========================================================= */
    var fpsEl = document.createElement('div');
    fpsEl.id = 'libtv-fps';
    fpsEl.textContent = 'FPS: --';
    document.body.appendChild(fpsEl);

    var helpEl = document.createElement('div');
    helpEl.id = 'libtv-help';
    helpEl.textContent = 'G网格  T性能  H隐藏  L连线  C全链  F搜索  P提示词  X专注  R直角  I标签  ?帮助';
    document.body.appendChild(helpEl);

    var _fc = 0, _lastT = performance.now(), _fps = 0;

    // FPS 拖拽
    (function(){
        var dx = 0, dy = 0, dragging = false;
        fpsEl.addEventListener('mousedown', function(e){
            dragging = true;
            dx = e.clientX - fpsEl.offsetLeft;
            dy = e.clientY - fpsEl.offsetTop;
            e.preventDefault();
        });
        document.addEventListener('mousemove', function(e){
            if(!dragging) return;
            var l = e.clientX - dx, t = e.clientY - dy;
            var pw = fpsEl.offsetWidth, ph = fpsEl.offsetHeight;
            l = Math.max(4, Math.min(l, window.innerWidth - pw - 4));
            t = Math.max(4, Math.min(t, window.innerHeight - ph - 4));
            fpsEl.style.left = l + 'px';
            fpsEl.style.top = t + 'px';
            fpsEl.style.bottom = 'auto';
            fpsEl.style.right = 'auto';
        });
        document.addEventListener('mouseup', function(){
            dragging = false;
        });
    })();

    function fpsLoop(now){
        _fc++;
        if (now - _lastT >= 1000){
            _fps = Math.round(_fc * 1000 / (now - _lastT));
            var flags = '', zoom = '';
            var bg = document.querySelector('.react-flow__background');
            if (bg && bg.classList.contains('perf-no-grid')) flags += '<span class="fps-flag">■</span>';
            if (document.body.classList.contains('perf-mode')) flags += '<span class="fps-flag">◆</span>';
            if (document.body.classList.contains('perf-hide-imgs')) flags += '<span class="fps-flag">⊙</span>';
            var edges = document.querySelector('.react-flow__edges');
            if (edges && edges.classList.contains('perf-hide-edges')) flags += '<span class="fps-flag">╳</span>';
            if (document.body.classList.contains('libtv-chain')) flags += '<span class="fps-flag">◉</span>';
            if (document.body.classList.contains('libtv-autochain')) flags += '<span class="fps-flag">⟷</span>';
            if (document.body.classList.contains('libtv-focus')) flags += '<span class="fps-flag">◎</span>';
            if (document.body.classList.contains('libtv-step-edges')) flags += '<span class="fps-flag">└</span>';
            var nTotal = document.querySelectorAll('.react-flow__node').length;

            // 缩放级别
            var vp = document.querySelector('.react-flow__viewport');
            if(vp){
                var m = (vp.style.transform || '').match(/scale\(([^)]+)\)/);
                if(m) zoom = Math.round(parseFloat(m[1]) * 100) + '%';
            }

            fpsEl.innerHTML = '<span class="fps-val">' + _fps + 'fps</span>'
                + (zoom ? '<span class="fps-sep">|</span><span class="fps-zoom">' + zoom + '</span>' : '')
                + '<span class="fps-sep">|</span><span class="fps-cnt">' + nTotal + '节点</span>'
                + (flags ? '<span class="fps-sep">|</span>' + flags : '');
            _fc = 0;
            _lastT = now;
        }
        requestAnimationFrame(fpsLoop);
    }
    requestAnimationFrame(fpsLoop);

    /* =========================================================
     *  流动光效 — 全屏 SVG overlay，不碰节点 DOM
     * ========================================================= */
    (function(){
        var svgNS='http://www.w3.org/2000/svg';
        var overlay=document.createElementNS(svgNS,'svg');
        overlay.id='libtv-glow';
        overlay.style.cssText='position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:50;';
        document.body.appendChild(overlay);

        var glowDefs=document.createElementNS(svgNS,'defs');
        var filter=document.createElementNS(svgNS,'filter');
        filter.setAttribute('id','glowBlur');
        filter.setAttribute('x','-50%');filter.setAttribute('y','-50%');
        filter.setAttribute('width','200%');filter.setAttribute('height','200%');
        var blur=document.createElementNS(svgNS,'feGaussianBlur');
        blur.setAttribute('stdDeviation','6');
        filter.appendChild(blur);
        glowDefs.appendChild(filter);
        overlay.appendChild(glowDefs);

        var animGroup=document.createElementNS(svgNS,'g');
        overlay.appendChild(animGroup);

        var prevNodes=new Set();
        var animRaf=null;

        function readAccent(){
            var n=document.querySelector('.react-flow__node');
            if(!n)return{accent:'#6366f1',accentLight:'#818cf8'};
            var s=getComputedStyle(n);
            return{
                accent:s.getPropertyValue('--accent').trim()||'#6366f1',
                accentLight:s.getPropertyValue('--accent-light').trim()||'#818cf8'
            };
        }

        function buildFrame(){
            while(animGroup.firstChild)animGroup.removeChild(animGroup.firstChild);
            var nodes=document.querySelectorAll('.react-flow__node.selected');
            if(!nodes.length){prevNodes.clear();return;}
            var c=readAccent();
            var now=performance.now();

            nodes.forEach(function(node){
                var r=node.getBoundingClientRect();
                var w=r.width,h=r.height;
                var cssW=node.offsetWidth||w,cssH=node.offsetHeight||h;
                var zoomX=cssW?w/cssW:1,zoomY=cssH?h/cssH:1;
                var zoom=Math.min(zoomX,zoomY);
                var cssBr=parseFloat(getComputedStyle(node).borderRadius)||12;
                var br=cssBr*zoom;
                var perim=2*(w+h);
                var dash=Math.round(perim*0.12),gap=perim-dash;

                function mkRect(stroke,sw){
                    var el=document.createElementNS(svgNS,'rect');
                    el.setAttribute('x',0);el.setAttribute('y',0);
                    el.setAttribute('width',w);el.setAttribute('height',h);
                    el.setAttribute('rx',br);el.setAttribute('fill','none');
                    el.setAttribute('stroke',stroke);el.setAttribute('stroke-width',sw);
                    el.setAttribute('stroke-dasharray',dash+' '+gap);
                    return el;
                }

                var g1=mkRect(c.accentLight,8);
                g1.setAttribute('filter','url(#glowBlur)');
                var g2=mkRect('#fff',2);

                var p=((now%7000)/7000);
                var off=Math.round(p*perim);
                g1.setAttribute('stroke-dashoffset',off);
                g2.setAttribute('stroke-dashoffset',off);

                var wrap=document.createElementNS(svgNS,'g');
                wrap.setAttribute('transform','translate('+r.left+','+r.top+')');
                wrap.appendChild(g1);
                wrap.appendChild(g2);
                animGroup.appendChild(wrap);
            });
        }

        function loop(){buildFrame();animRaf=requestAnimationFrame(loop);}
        loop();
    })();

    /* =========================================================
     *  AI Agent Drawer 适配 — 动态读宽度右推
     * ========================================================= */
    (function(){
        var drawerSel = '.canvas-agent-drawer-chat';
        function drawerEl(){ return document.querySelector(drawerSel) || document.querySelector('.mantine-Drawer-content.canvas-agent-drawer-chat'); }
        function adjust(){
            var el = drawerEl(), dw = el ? el.offsetWidth : 0;
            var fps = document.getElementById('libtv-fps');
            var pbtn = document.getElementById('libtv-pbtn');
            if(dw > 0 && el.getBoundingClientRect().right > window.innerWidth / 2){
                /* Drawer on right — shift our elements if they're still in default right position (not dragged) */
                var gap = 16;
                [fps, pbtn].forEach(function(x){
                    if(x && !x.style.left){
                        if(!x._dd){ x._dd = true; x._dr = x.style.right; x._db = x.style.bottom; }
                        x.style.right = (dw + gap + (x === pbtn ? 46 : 0)) + 'px';
                    }
                });
            } else if(dw === 0){
                [fps, pbtn].forEach(function(x){
                    if(x && x._dd){ x.style.right = x._dr; x.style.bottom = x._db; delete x._dd; delete x._dr; delete x._db; }
                });
            }
        }
        var obs = new MutationObserver(function(){
            if(obs._t) clearTimeout(obs._t);
            obs._t = setTimeout(adjust, 50);
        });
        obs.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('resize', function(){
            if(drawerEl()) setTimeout(adjust, 50);
        });
        setTimeout(adjust, 500);
    })();

    /* =========================================================
     *  3. 快捷键 + 状态持久化
     * ========================================================= */
    var hook = document.createElement('script');
    hook.textContent = [
        '(function(){',

        /* ———— 链高亮引擎 ———— */
        '  function _ltClearChain(){',
        '    document.body.classList.remove("libtv-chain");',
        '    document.querySelectorAll(".libtv-chain-node,.libtv-chain-edge").forEach(function(e){',
        '      e.classList.remove("libtv-chain-node","libtv-chain-edge");',
'          });',
'        };',
        '  var _ltAutoChain=localStorage.getItem("_lt_autochain")==="1";',
        '  if(_ltAutoChain) document.body.classList.add("libtv-autochain");',
        '  var _ltGraphCache=null;',
        '  function _ltGetGraph(){',
        '    if(!_ltGraphCache){',
        '      var up={},down={};',
        '      document.querySelectorAll(".react-flow__edge").forEach(function(e){',
        '        var lb=e.getAttribute("aria-label")||"",m=lb.match(/^Edge from (\\S+) to (\\S+)$/);',
        '        if(!m)return;',
        '        var s=m[1],t=m[2];',
        '        if(!down[s])down[s]=[]; down[s].push(t);',
        '        if(!up[t])up[t]=[]; up[t].push(s);',
        '      });',
        '      _ltGraphCache={up:up,down:down};',
        '    }',
        '    return _ltGraphCache;',
        '  }',
        '  function _ltInvalidateGraph(){_ltGraphCache=null;}',
        '  document.addEventListener("click",function(e){',
        '    _ltInvalidateGraph();',
        '    if(!_ltAutoChain) return;',
        '    if(!e.target.closest(".react-flow__node")){',
        '      _ltClearChain(); return;',
        '    }',
        '    setTimeout(function(){',
        '      if(document.querySelector(".react-flow__node.selected")){',
        '        var g=_ltGetGraph(),sid=document.querySelector(".react-flow__node.selected").getAttribute("data-id")||"";',
        '        if(!sid||!g)return;',
        '        var v={},q=[sid]; v[sid]=1;',
        '        while(q.length){',
        '          var c=q.shift();',
        '          (g.up[c]||[]).forEach(function(n){if(!v[n]){v[n]=1;q.push(n);}});',
        '          (g.down[c]||[]).forEach(function(n){if(!v[n]){v[n]=1;q.push(n);}});',
        '        }',
        '        document.querySelectorAll(".react-flow__node").forEach(function(n){',
        '          n.classList[(v[n.getAttribute("data-id")||n.id||""])?"add":"remove"]("libtv-chain-node");',
        '        });',
        '        document.querySelectorAll(".react-flow__edge").forEach(function(e){',
        '          var lb=e.getAttribute("aria-label")||"",m=lb.match(/^Edge from (\\S+) to (\\S+)$/);',
        '          e.classList[(m&&v[m[1]]&&v[m[2]])?"add":"remove"]("libtv-chain-edge");',
        '        });',
        '        document.body.classList.add("libtv-chain");',
        '      }',
        '    }, 50);',
        '  }, true);',

        /* ———— 连线 hover 高亮 ———— */
        '  document.addEventListener("mouseover",function(e){',
        '    var n=e.target.closest(".react-flow__node");',
        '    if(!n)return;',
        '    var id=n.getAttribute("data-id")||n.id||""; if(!id)return;',
        '    document.querySelectorAll(".react-flow__edge").forEach(function(ed){',
        '      var lb=ed.getAttribute("aria-label")||"",m=lb.match(/^Edge from (\\S+) to (\\S+)$/);',
        '      if(m&&(m[1]===id||m[2]===id)) ed.classList.add("libtv-edge-active");',
        '    });',
        '  },true);',
        '  document.addEventListener("mouseout",function(e){',
        '    if(!e.target.closest(".react-flow__node"))return;',
        '    document.querySelectorAll(".react-flow__edge.libtv-edge-active").forEach(function(ed){',
        '      ed.classList.remove("libtv-edge-active");',
        '    });',
        '  },true);',

        /* ———— 节点搜索 ———— */
        '  function _ltSearch(){',
        '    var overlay=document.getElementById("libtv-search");',
        '    if(overlay){ overlay.remove(); return; }',
        '    var items=[];',
        '    document.querySelectorAll(".react-flow__node").forEach(function(n){',
        '      var id=n.getAttribute("data-id")||n.id||"";',
        '      if(!id)return;',
        '      var txt=(n.textContent||"").trim().split("\\n")[0].trim().slice(0,50);',
        '      items.push({id:id,name:txt||id,el:n});',
        '    });',
        '    var div=document.createElement("div");',
        '    div.id="libtv-search";',
        '    div.style.cssText="position:fixed;top:60px;right:20px;z-index:99999;background:rgba(0,0,0,0.9);border-radius:10px;padding:10px;width:280px;max-height:60vh;overflow:auto;font:12px/1.5 sans-serif;";',
        '    div.innerHTML="<input id=\\\"lt-search-input\\\" placeholder=\\\"搜索节点...\\\" style=\\\"width:100%;box-sizing:border-box;padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font:12px/1.5 sans-serif;outline:none;\\\"><div id=\\\"lt-search-results\\\" style=\\\"margin-top:6px;\\\"></div>";',
        '    document.body.appendChild(div);',
        '    function render(q){',
        '      var q=(q||"").toLowerCase(),html="";',
        '      items.forEach(function(it){',
        '        if(!q||it.name.toLowerCase().indexOf(q)>=0||it.id.toLowerCase().indexOf(q)>=0){',
        '          html+="<div data-id=\\\""+it.id+"\\\" style=\\\"padding:4px 8px;border-radius:4px;cursor:pointer;color:#ccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\\">"+it.name.replace(/</g,"&lt;")+"</div>";',
        '        }',
        '      });',
        '      document.getElementById("lt-search-results").innerHTML=html;',
        '    }',
        '    render("");',
        '    document.getElementById("lt-search-input").addEventListener("input",function(){',
        '      render(this.value);',
        '    });',
        '    document.getElementById("lt-search-results").addEventListener("click",function(e){',
        '      var item=e.target.closest("[data-id]");',
        '      if(!item)return;',
        '      var id=item.getAttribute("data-id");',
        '      var el=document.querySelector(\'.react-flow__node[data-id="\'+id+\'"],.react-flow__node#\'+id);',
        '      if(el){',
        '        el.scrollIntoView({behavior:"smooth",block:"center"});',
        '        el.click();',
        '      }',
        '      div.remove();',
        '    });',
        '    document.getElementById("lt-search-input").focus();',
        '  }',

        /* ———— 提示词工具 ———— */
        '  var _ltPrompts=JSON.parse(localStorage.getItem("_lt_prompts")||"[]");',
        '  if(!_ltPrompts.length){',
        '    _ltPrompts=[',
        '      {id:"d1",name:"产品摄影",category:"图像",content:"Product photography on {background=white} background, {lighting=studio lighting}, high detail, 8K, sharp focus, {extra}"},',
        '      {id:"d2",name:"电影镜头",category:"图像",content:"Cinematic shot, {lens=anamorphic} lens, {lighting=dramatic} lighting, shallow depth of field, {style}"},',
        '      {id:"d3",name:"动画-吉卜力风",category:"图像",content:"Studio Ghibli style, hand-drawn animation, {palette=soft pastel} colors, {atmosphere=whimsical}"},',
        '      {id:"d4",name:"产品展示-环绕",category:"视频",content:"Smooth 360 orbit around {subject=product}, {lighting=soft studio} lighting, slow motion, {extra}"},',
        '      {id:"d5",name:"风光-延时",category:"视频",content:"Timelapse, {time=golden hour}, {sky=dramatic clouds}, warm tones, smooth transition, {extra}"},',
        '    ];',
        '    localStorage.setItem("_lt_prompts",JSON.stringify(_ltPrompts));',
        '  }',
        '  var _ltPromptAPI=JSON.parse(localStorage.getItem("_lt_prompt_api")||"{\\"url\\":\\"https://api.deepseek.com/chat/completions\\",\\"model\\":\\"deepseek-v4-flash\\"}");',
        '  if(!_ltPromptAPI.url){_ltPromptAPI.url="https://api.deepseek.com/chat/completions";_ltPromptAPI.model=_ltPromptAPI.model||"deepseek-v4-flash";}',
'  var _ltThemePresets=[',
    '    {n:"靛蓝",a:"#6366f1",l:"#818cf8",d:"#4f46e5",ar:"99,102,241",alr:"129,140,248",cb:"#0e0e12",gc:"rgba(255,255,255,0.12)",nb:"#16162a",nc:"rgba(129,140,248,0.15)",ec:"rgba(129,140,248,0.15)"},',
    '    {n:"翡翠",a:"#10b981",l:"#34d399",d:"#059669",ar:"16,185,129",alr:"52,211,153",cb:"#0b120f",gc:"rgba(255,255,255,0.12)",nb:"#12261c",nc:"rgba(52,211,153,0.15)",ec:"rgba(52,211,153,0.15)"},',
    '    {n:"玫瑰",a:"#f43f5e",l:"#fb7185",d:"#e11d48",ar:"244,63,94",alr:"251,113,133",cb:"#120b0d",gc:"rgba(255,255,255,0.12)",nb:"#261318",nc:"rgba(251,113,133,0.15)",ec:"rgba(251,113,133,0.15)"},',
    '    {n:"琥珀",a:"#f59e0b",l:"#fbbf24",d:"#d97706",ar:"245,158,11",alr:"251,191,36",cb:"#12100a",gc:"rgba(255,255,255,0.12)",nb:"#261e12",nc:"rgba(251,191,36,0.15)",ec:"rgba(251,191,36,0.15)"},',
    '    {n:"天蓝",a:"#0ea5e9",l:"#38bdf8",d:"#0284c7",ar:"14,165,233",alr:"56,189,248",cb:"#0a1013",gc:"rgba(255,255,255,0.12)",nb:"#111f28",nc:"rgba(56,189,248,0.15)",ec:"rgba(56,189,248,0.15)"},',
    '    {n:"紫色",a:"#8b5cf6",l:"#a78bfa",d:"#7c3aed",ar:"139,92,246",alr:"167,139,250",cb:"#0e0c14",gc:"rgba(255,255,255,0.12)",nb:"#1b1730",nc:"rgba(167,139,250,0.15)",ec:"rgba(167,139,250,0.15)"},',
    '  ];',
'  var _ltTheme=JSON.parse(localStorage.getItem("_lt_theme")||"null")||_ltThemePresets[0];',
'  if(!_ltTheme.cb){_ltTheme.cb=_ltThemePresets[0].cb;_ltTheme.gc=_ltThemePresets[0].gc;_ltTheme.nb=_ltThemePresets[0].nb;_ltTheme.nc=_ltThemePresets[0].nc;_ltTheme.ec=_ltThemePresets[0].ec;}',
'  function _ltApplyTheme(t){',
'    var r=document.documentElement;',
'    r.style.setProperty("--accent",t.a);',
'    r.style.setProperty("--accent-light",t.l);',
'    r.style.setProperty("--accent-dark",t.d);',
'    r.style.setProperty("--accent-rgb",t.ar);',
'    r.style.setProperty("--accent-light-rgb",t.alr);',
'    r.style.setProperty("--canvas-bg",t.cb);',
'    r.style.setProperty("--node-bg",t.nb);',
'    r.style.setProperty("--border-color",t.nc);',
'    r.style.setProperty("--edge-color",t.ec);',
'    _ltTheme=t;',
'    localStorage.setItem("_lt_theme",JSON.stringify(t));',
'    try{document.getElementById("ltp-theme-preview").style.background=t.l;}catch(e){}',
'    try{var _e=document.querySelectorAll(".react-flow__renderer,.react-flow");for(var _i=0;_i<_e.length;_i++)_e[_i].style.backgroundColor=t.cb;}catch(e){}',
'  }',
'  _ltApplyTheme(_ltTheme);',
'  setTimeout(function(){try{var _e=document.querySelectorAll(".react-flow__renderer,.react-flow");for(var _i=0;_i<_e.length;_i++)_e[_i].style.backgroundColor=_ltTheme.cb;}catch(e){}},500);',
        '  var _ltPActiveTab="templates",_ltPCat="",_ltAISource=null,_ltBodyOrigMinH="";',
        '  function _ltPromptPanel(anchor){',
        '    var el=document.getElementById("libtv-prompt");',
        '    if(el){el.remove();return;}',
        '    function savePrompts(){localStorage.setItem("_lt_prompts",JSON.stringify(_ltPrompts));}',
        '    function renderBody(){',
        '      var body=document.getElementById("ltp-body"); if(!body)return;',
        '      if(_ltPActiveTab==="templates"){',
        '        var cats={};',
        '        _ltPrompts.forEach(function(p){if(!cats[p.category])cats[p.category]=0;cats[p.category]++;});',
        '        var catKeys=Object.keys(cats);',
        '        var filtered= _ltPCat ? _ltPrompts.filter(function(p){return p.category===_ltPCat;}) : _ltPrompts;',
        '        var h=\'<div class="ltp-cat"><button class="ltp-cat-btn\'+(!_ltPCat?" active":"")+\'" data-cat="">全部</button>\';',
        '        catKeys.forEach(function(c){h+=\'<button class="ltp-cat-btn\'+(c===_ltPCat?" active":"")+\'" data-cat="\'+c+\'">\'+c+\' (\'+cats[c]+\')</button>\';});',
        '        h+="</div>";',
        '        if(!filtered.length){h+=\'<div class="ltp-empty">暂无模板，点击右上角 + 添加</div>\';}',
        '        else{',
        '          filtered.forEach(function(p){',
        '            h+=\'<div class="ltp-item" data-id="\'+p.id+\'">\'',
        '              +\'<div><div class="ltp-name">\'+p.name.replace(/</g,"&lt;")+\'</div>\'',
        '              +\'<div class="ltp-preview">\'+p.content.slice(0,60).replace(/</g,"&lt;")+\'</div></div>\'',
        '              +\'<div class="ltp-actions">\'',
        '              +\'<button class="ltp-btn ltp-btn-primary ltp-btn-sm" data-action="copy" data-id="\'+p.id+\'">复制</button>\'',
        '              +\'<button class="ltp-btn ltp-btn-ghost ltp-btn-sm" data-action="edit" data-id="\'+p.id+\'">编辑</button>\'',
        '              +\'<button class="ltp-btn ltp-btn-danger ltp-btn-sm" data-action="del" data-id="\'+p.id+\'">×</button>\'',
        '              +\'</div></div>\';',
        '          });',
        '        }',
        '        body.innerHTML=h;',
        '        body.querySelectorAll(".ltp-cat-btn").forEach(function(b){b.onclick=function(){_ltPCat=this.getAttribute("data-cat")||"";renderBody();};});',
        '        body.querySelectorAll("[data-action=copy]").forEach(function(b){b.onclick=function(){var id=b.getAttribute("data-id"),p=_ltPrompts.find(function(x){return x.id===id;});if(!p)return;var m,pairs=[],re=/\\{(\\w+)(?:=([^}]*))?\\}/g;while((m=re.exec(p.content))!==null)pairs.push({n:m[1],d:m[2]||""});if(!pairs.length){navigator.clipboard.writeText(p.content).then(function(){b.textContent="✅";setTimeout(function(){b.textContent="复制";},1200);});return;}var overlay=document.createElement("div");overlay.className="ltp-var-overlay";var html=\'<div class="ltp-var-title">\'+p.name.replace(/</g,"&lt;")+\'</div><div class="ltp-var-sub">填写变量后点击确认，替换结果将复制到剪贴板</div>\';pairs.forEach(function(v){html+=\'<div class="ltp-var-row"><label>\'+v.n+\'</label><input class="ltp-var-inp" data-var="\'+v.n+\'" value="\'+v.d.replace(/"/g,"&quot;").replace(/</g,"&lt;")+\'"></div>\';});html+=\'<div class="ltp-var-preview" id="ltp-var-ovprev">\'+p.content.replace(/</g,"&lt;")+\'</div><div class="ltp-var-actions"><button class="ltp-btn ltp-btn-ghost" id="ltp-var-cancel">取消</button><button class="ltp-btn ltp-btn-primary" id="ltp-var-ok">填充并复制</button></div></div>\';overlay.innerHTML=html;_ltBodyOrigMinH=body.style.minHeight||"";body.style.minHeight="320px";body.appendChild(overlay);function _clean(){if(overlay.parentNode)overlay.parentNode.removeChild(overlay);body.style.minHeight=_ltBodyOrigMinH;}function _upd(){var r=p.content;overlay.querySelectorAll(".ltp-var-inp").forEach(function(i){r=r.replace(new RegExp("\\\\{"+i.getAttribute("data-var")+"(?:=[^}]*)?\\\\}","g"),i.value||i.getAttribute("data-var"));});overlay.querySelector("#ltp-var-ovprev").textContent=r;}overlay.querySelectorAll(".ltp-var-inp").forEach(function(i){i.addEventListener("input",_upd);});overlay.querySelector("#ltp-var-cancel").onclick=function(){_clean();};overlay.querySelector("#ltp-var-ok").onclick=function(){var r=p.content;overlay.querySelectorAll(".ltp-var-inp").forEach(function(i){r=r.replace(new RegExp("\\\\{"+i.getAttribute("data-var")+"(?:=[^}]*)?\\\\}","g"),i.value);});navigator.clipboard.writeText(r).then(function(){b.textContent="✅";setTimeout(function(){b.textContent="复制";},1200);_clean();}).catch(function(){_clean();});};};});',
        '        body.querySelectorAll("[data-action=edit]").forEach(function(b){b.onclick=function(){var id=this.getAttribute("data-id"),p=_ltPrompts.find(function(x){return x.id===id;});if(!p)return;var nn=prompt("名称:",p.name);if(nn===null)return;var cc=prompt("内容:",p.content);if(cc===null)return;var cat=prompt("分类:",p.category);if(cat===null)return;p.name=nn;p.content=cc;p.category=cat||"通用";savePrompts();renderBody();};});',
        '        body.querySelectorAll("[data-action=del]").forEach(function(b){b.onclick=function(){var id=this.getAttribute("data-id");_ltPrompts=_ltPrompts.filter(function(x){return x.id!==id;});savePrompts();renderBody();};});',
        '      }',
        '      else if(_ltPActiveTab==="ai"){',
        '        var api=_ltPromptAPI;',
        '        body.innerHTML=\'<div style="margin-bottom:8px;color:rgba(255,255,255,0.5);font-size:11px;">输入或修改提示词，AI 将帮你润色/扩写</div>\'',
        '          +\'<textarea id="ltp-ai-input" placeholder="在此输入提示词..."></textarea>\'',
        '          +\'<div style="display:flex;gap:6px;margin-top:8px;">\'',
        '          +\'<button class="ltp-btn ltp-btn-primary" id="ltp-ai-zh">🇨🇳 中文增强</button>\'',
        '          +\'<button class="ltp-btn ltp-btn-primary" id="ltp-ai-en">🇺🇸 English Enhance</button>\'',
        '          +\'<button class="ltp-btn ltp-btn-ghost" id="ltp-ai-fill">从输入框获取</button>\'',
        '          +\'<button class="ltp-btn ltp-btn-ghost" id="ltp-ai-clear">清空</button>\'',
        '          +\'</div>\'',
        '          +\'<div id="ltp-ai-result" style="margin-top:8px;padding:8px 10px;border-radius:6px;background:rgba(255,255,255,0.03);min-height:30px;font-size:12px;color:#aaa;white-space:pre-wrap;word-break:break-all;-webkit-user-select:text;user-select:text;"></div>\'',
        '          +\'<div class="ltp-status" id="ltp-ai-status">\'+(api.url?"已配置 "+api.url:"未配置 API，请在⚙设置中配置")+\'</div>\';',
                '        document.getElementById("ltp-ai-fill").onclick=function(){',
        '          var candidates=[],best=null;',
        '          document.querySelectorAll("textarea").forEach(function(t){if(t.offsetParent!==null)candidates.push({el:t,val:t.value});});',
        '          document.querySelectorAll("input[type=text]").forEach(function(t){if(t.offsetParent!==null)candidates.push({el:t,val:t.value});});',
        '          document.querySelectorAll("[contenteditable=true]").forEach(function(t){if(t.offsetParent!==null)candidates.push({el:t,val:t.textContent||""});});',
        '          candidates.forEach(function(c){if(c.val.trim()&&(!best||c.val.length>best.val.length))best=c;});',
        '          document.getElementById("ltp-ai-input").value=best?best.val:"";',
        '          _ltAISource=best?best.el:null;',
        '          document.getElementById("ltp-ai-status").textContent=_ltAISource?"✅ 已绑定源输入框，增强结果点击即可写入":"⚠ 未找到可见输入框";',
        '        };',
        '        document.getElementById("ltp-ai-clear").onclick=function(){document.getElementById("ltp-ai-input").value="";document.getElementById("ltp-ai-result").textContent="";};',
        '        var _ltDoAI=function(text,btn,sysPrompt,langLabel){',
        '          var api=_ltPromptAPI;',
        '          if(!api.url||!api.key){document.getElementById("ltp-ai-status").textContent="❌ 请先在⚙设置中配置 API";btn.textContent=langLabel;btn.disabled=false;return;}',
        '          fetch(api.url,{',
        '            method:"POST",',
        '            headers:{"Content-Type":"application/json","Authorization":"Bearer "+api.key},',
        '            body:JSON.stringify({model:api.model||"deepseek-v4-flash",messages:[{role:"system",content:sysPrompt},{role:"user",content:text}],max_tokens:1000})',
        '          }).then(function(r){return r.json();}).then(function(d){',
        '            var result=d.choices&&d.choices[0]&&d.choices[0].message?d.choices[0].message.content:JSON.stringify(d);',
        '            document.getElementById("ltp-ai-result").textContent=result;',
        '            document.getElementById("ltp-ai-result").style.cursor="pointer";',
        '            if(_ltAISource){',
'              document.getElementById("ltp-ai-status").textContent="✅ 完成，点击结果直接写回节点";',
'              document.getElementById("ltp-ai-result").onclick=function(){',
'                try{',
'                  if(_ltAISource.tagName==="TEXTAREA"||_ltAISource.tagName==="INPUT"){_ltAISource.value=result;_ltAISource.dispatchEvent(new Event("input",{bubbles:true}));}',
'                  else if(_ltAISource.isContentEditable){_ltAISource.textContent=result;_ltAISource.dispatchEvent(new Event("input",{bubbles:true}));}',
'                  document.getElementById("ltp-ai-status").textContent="✅ ✅ 已写回节点";',
'                }catch(ex){document.getElementById("ltp-ai-status").textContent="❌ 写入失败: "+ex.message;}',
'              };',
        '            }else{',
'              document.getElementById("ltp-ai-status").textContent="✅ 完成，点击结果可复制";',
'              document.getElementById("ltp-ai-result").onclick=function(){',
'                var sel=window.getSelection();var r=document.createRange();r.selectNodeContents(this);sel.removeAllRanges();sel.addRange(r);',
'                try{var ok=document.execCommand("copy");if(ok){sel.removeAllRanges();document.getElementById("ltp-ai-status").textContent="✅ ✅ 已复制到剪贴板";return;}}catch(e){}',
'                document.getElementById("ltp-ai-status").textContent="✅ 文本已选中，请按 Ctrl+C";',
'              };',
        '            }',
        '            btn.textContent=langLabel; btn.disabled=false;',
        '          }).catch(function(err){',
        '            document.getElementById("ltp-ai-status").textContent="❌ 请求失败: "+err.message;',
        '            btn.textContent=langLabel; btn.disabled=false;',
        '          });',
'        };',
'        document.getElementById("ltp-ai-zh").onclick=function(){',
        '          var text=document.getElementById("ltp-ai-input").value.trim();',
        '          if(!text)return;',
        '          var btn=this; btn.textContent="处理中..."; btn.disabled=true;',
        '          _ltDoAI(text,btn,"你是一个提示词工程专家。请优化并扩展用户的 AI 图像/视频生成提示词，保持简洁的同时补充光影、构图、风格、氛围等细节。请务必用中文回复，只输出中文提示词，不要输出英文。","🇨🇳 中文增强");',
        '        };',
        '        document.getElementById("ltp-ai-en").onclick=function(){',
        '          var text=document.getElementById("ltp-ai-input").value.trim();',
        '          if(!text)return;',
        '          var btn=this; btn.textContent="Processing..."; btn.disabled=true;',
        '          _ltDoAI(text,btn,"You are a prompt engineering expert. Improve and expand the user\'s prompt for AI image/video generation. Keep it concise but add details about lighting, composition, style, and atmosphere. Output only the enhanced prompt, no explanations.","🇺🇸 English Enhance");',
'        };',
'      }',
'      else if(_ltPActiveTab==="theme"){',
'        body.innerHTML=\'<div style="margin-bottom:8px;color:rgba(255,255,255,0.5);font-size:11px;">选择主题配色</div>\'',
'          +\'<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">\'',
'          +_ltThemePresets.map(function(t,i){return\'<button class="ltp-theme-preset" data-idx="\'+i+\'" style="width:48px;height:48px;border-radius:12px;border:2px solid \'+(t.a===_ltTheme.a?"var(--accent-light)":"rgba(255,255,255,0.08)")+\';background:\'+t.a+\';cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:all .15s;" title="\'+t.n+\'"><span style="font-size:9px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.5);">\'+t.n+\'</span></button>\';}).join("")',
'          +\'</div>\'',
'          +\'<div style="margin-top:10px;font-size:11px;color:rgba(255,255,255,0.4);">主题色</div>\'',
'          +\'<div style="display:flex;gap:8px;align-items:center;margin-top:4px;">\'',
'          +\'<input type="color" id="ltp-theme-accent" value="\'+_ltTheme.a+\'" style="width:36px;height:36px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);cursor:pointer;background:none;padding:1px;">\'',
'          +\'<div style="flex:1;height:36px;border-radius:6px;background:\'+_ltTheme.l+\';border:1px solid rgba(255,255,255,0.08);"></div>\'',
'          +\'<span style="font-size:10px;color:rgba(255,255,255,0.3);">accent</span>\'',
'          +\'</div>\'',
'          +\'<div style="margin-top:10px;font-size:11px;color:rgba(255,255,255,0.4);">画布</div>\'',
'          +["画布背景","网格颜色","节点背景","连线颜色"].map(function(label,i){',
'            var ids=["cb","gc","nb","ec"],defs=[_ltTheme.cb,_ltTheme.gc,_ltTheme.nb,_ltTheme.ec];',
'            return\'<div style="display:flex;gap:8px;align-items:center;margin-top:4px;">\'',
'              +\'<input type="color" data-target="\'+ids[i]+\'" value="\'+defs[i]+\'" style="width:36px;height:36px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);cursor:pointer;background:none;padding:1px;">\'',
'              +\'<div style="flex:1;height:36px;border-radius:6px;background:\'+defs[i]+\';border:1px solid rgba(255,255,255,0.08);"></div>\'',
'              +\'<span style="font-size:10px;color:rgba(255,255,255,0.3);">\'+label+\'</span>\'',
'              +\'</div>\';',
'          }).join("")',
'          +\'<div class="ltp-status" style="margin-top:10px;" id="ltp-theme-status">当前: \'+_ltTheme.n+\'</div>\';',
'        body.querySelectorAll(".ltp-theme-preset").forEach(function(b){',
'          b.onclick=function(){',
'            var idx=parseInt(this.getAttribute("data-idx")),t=_ltThemePresets[idx];',
'            _ltApplyTheme(t);',
'            renderBody();',
'          };',
'        });',
'        var _tInputs=body.querySelectorAll("input[type=color]");',
'        function _tRefresh(){',
'          var c=document.getElementById("ltp-theme-accent").value;',
'          function h2r(h){return parseInt(h.slice(1,3),16)+","+parseInt(h.slice(3,5),16)+","+parseInt(h.slice(5,7),16);}',
'          var cv={};',
'          _tInputs.forEach(function(inp){var t=inp.getAttribute("data-target");if(t)cv[t]=inp.value;});',
'          _ltApplyTheme({n:"自定义",a:c,l:c,d:c,ar:h2r(c),alr:h2r(c),cb:cv.cb||_ltTheme.cb,gc:cv.gc||_ltTheme.gc,nb:cv.nb||_ltTheme.nb,nc:cv.nc||_ltTheme.nc,ec:cv.ec||_ltTheme.ec});',
'          renderBody();',
'        }',
'        _tInputs.forEach(function(inp){inp.oninput=_tRefresh;});',
        '      }',
        '      else if(_ltPActiveTab==="palette"){',
        '        var _presets={',
        '          "电影色调":["#2c1e30","#4a2c4a","#c9a227","#e8d5b7","#1a3a4a","#2d5a7b","#8b4513","#cd853f"],',
        '          "赛博朋克":["#ff00ff","#00ffff","#ff1493","#00bfff","#ff6ec7","#7b68ee","#ff4500","#1c1c3c"],',
        '          "莫兰迪":["#b5c4b1","#e8e0d4","#c9b8a8","#a8b5c4","#d4c5b9","#b9c4d4","#c4b5b1","#d4d0c5"],',
        '          "马卡龙":["#ffb3ba","#bae1ff","#baffc9","#ffffba","#e8baff","#baffee","#ffd1ba","#d4baff"],',
        '          "暖色系":["#ff6b35","#f7c59f","#efefd0","#ffb4a2","#e5989b","#b5838d","#6d6875","#ffcdb2"],',
        '          "冷色系":["#023e8a","#0077b6","#0096c7","#00b4d8","#48cae4","#90e0ef","#ade8f4","#caf0f8"],',
        '          "黑白灰":["#000000","#1a1a1a","#333333","#666666","#999999","#cccccc","#e5e5e5","#ffffff"],',
        '          "高饱和":["#ff0000","#ff8800","#ffff00","#00ff00","#0088ff","#8800ff","#ff00ff","#00ffff"],',
        '          "低饱和":["#8b7d72","#a0937e","#b8a99a","#c4b7a6","#d1c4b0","#e0d6c8","#ebe3d7","#f5f0e8"]',
        '        };',
        '        function _hex2rgb(h){h=h.replace("#","");return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}',
        '        function _rgb2hsl(r,g,b){r/=255;g/=255;b/=255;var mx=Math.max(r,g,b),mn=Math.min(r,g,b),h,s,l=(mx+mn)/2;if(mx===mn){h=s=0;}else{var d=mx-mn;s=l>0.5?d/(2-mx-mn):d/(mx+mn);switch(mx){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;case b:h=((r-g)/d+4)/6;break;}}return[Math.round(h*360),Math.round(s*100),Math.round(l*100)];}',
        '        function _aiDesc(hex){var r=_hex2rgb(hex),hsl=_rgb2hsl(r[0],r[1],r[2]);var h=hsl[0],s=hsl[1],l=hsl[2];var desc="";if(l<15)desc="very dark";else if(l<35)desc="dark";else if(l<65)desc="mid-tone";else if(l<85)desc="light";else desc="very light";if(s<10)desc+=", almost gray";else if(s<30)desc+=", muted";else if(s<60)desc+=", moderate saturation";else desc+=", highly saturated";var hue="";if(h<15||h>=345)hue="red";else if(h<45)hue="orange";else if(h<70)hue="yellow";else if(h<160)hue="green";else if(h<200)hue="cyan";else if(h<260)hue="blue";else if(h<310)hue="purple";else hue="pink";return desc+" "+hue+" ("+hex+")";}',
        '        var _recent=JSON.parse(localStorage.getItem("_lt_pal_recent")||"[]");',
        '        function _saveRecent(c){_recent=_recent.filter(function(x){return x!==c;});_recent.unshift(c);if(_recent.length>20)_recent.pop();localStorage.setItem("_lt_pal_recent",JSON.stringify(_recent));}',
        '        function _copySwatch(el,color){navigator.clipboard.writeText(color).then(function(){el.classList.add("copied");setTimeout(function(){el.classList.remove("copied");},800);var toast=document.createElement("div");toast.className="ltp-pal-toast show";toast.textContent="Copied "+color.toUpperCase();document.body.appendChild(toast);setTimeout(function(){toast.classList.remove("show");setTimeout(function(){toast.remove();},300);},1200);_saveRecent(color);});}',
        '        function _renderPalette(){',
        '          var h=\'<div class="ltp-pal-picker"><input type="color" id="ltp-pal-pick" value="#818cf8"><div class="ltp-pal-info"><div class="ltp-pal-hex" id="ltp-pal-hex">#818CF8</div><div class="ltp-pal-rgb" id="ltp-pal-rgb">rgb(129, 140, 248)</div><div class="ltp-pal-hsl" id="ltp-pal-hsl">hsl(235, 91%, 74%)</div></div></div>\';',
        '          h+=\'<div class="ltp-pal-ai"><div class="ltp-pal-ai-desc" id="ltp-pal-ai-desc">muted blue (#818cf8)</div><button class="ltp-btn ltp-btn-primary ltp-btn-sm" id="ltp-pal-ai-copy">复制AI描述</button></div>\';',
        '          h+=\'<div class="ltp-pal-section"><div class="ltp-pal-section-title open">我的收藏</div><div class="ltp-pal-section-body" id="ltp-pal-fav"></div><button class="ltp-btn ltp-btn-ghost ltp-btn-sm" id="ltp-pal-add-fav" style="margin-top:6px;">+ 添加当前颜色</button></div>\';',
        '          if(_recent.length){',
        '            h+=\'<div class="ltp-pal-section"><div class="ltp-pal-section-title">最近使用</div><div class="ltp-pal-section-body collapsed">\',',
        '            _recent.slice(0,16).forEach(function(c){',
        '              h+=\'<div class="ltp-pal-swatch" style="background:\'+c+\'" data-color="\'+c+\'"><div class="ltp-pal-tip">\'+c+\'</div></div>\';',
        '            });',
        '            h+=\'</div></div>\';',
        '          }',
        '          Object.keys(_presets).forEach(function(name){',
        '            h+=\'<div class="ltp-pal-section"><div class="ltp-pal-section-title" data-group="\'+name+\'">\'+name+\'</div><div class="ltp-pal-section-body collapsed" data-body="\'+name+\'">\';',
        '            _presets[name].forEach(function(c){',
        '              h+=\'<div class="ltp-pal-swatch" style="background:\'+c+\'" data-color="\'+c+\'"><div class="ltp-pal-tip">\'+c+\'</div></div>\';',
        '            });',
        '            h+=\'</div></div>\';',
        '          });',
        '          body.innerHTML=h;',
        '          var _fav=JSON.parse(localStorage.getItem("_lt_pal_fav")||"[]");',
        '          function _renderFav(){var fb=document.getElementById("ltp-pal-fav");if(!fb)return;fb.innerHTML="";_fav.forEach(function(c,i){var s=document.createElement("div");s.className="ltp-pal-swatch";s.style.background=c;s.setAttribute("data-color",c);s.innerHTML=\'<div class="ltp-pal-tip">\'+c+\'</div>\';s.onclick=function(){_copySwatch(s,c);_updPicker(c);};fb.appendChild(s);});}',
        '          _renderFav();',
        '          function _updPicker(hex){document.getElementById("ltp-pal-pick").value=hex;document.getElementById("ltp-pal-hex").textContent=hex.toUpperCase();var rgb=_hex2rgb(hex);document.getElementById("ltp-pal-rgb").textContent="rgb("+rgb.join(", ")+")";var hsl=_rgb2hsl(rgb[0],rgb[1],rgb[2]);document.getElementById("ltp-pal-hsl").textContent="hsl("+hsl[0]+", "+hsl[1]+"%, "+hsl[2]+"%)";document.getElementById("ltp-pal-ai-desc").textContent=_aiDesc(hex);}',
        '          document.getElementById("ltp-pal-pick").oninput=function(){_updPicker(this.value);};',
        '          body.querySelectorAll(".ltp-pal-swatch").forEach(function(s){s.onclick=function(){var c=this.getAttribute("data-color");_copySwatch(s,c);_updPicker(c);};});',
        '          body.querySelectorAll(".ltp-pal-section-title").forEach(function(t){t.onclick=function(){var b=this.nextElementSibling;if(b)b.classList.toggle("collapsed");this.classList.toggle("open");};});',
        '          document.getElementById("ltp-pal-hex").onclick=function(){var v=this.textContent;navigator.clipboard.writeText(v);var toast=document.createElement("div");toast.className="ltp-pal-toast show";toast.textContent="Copied "+v;document.body.appendChild(toast);setTimeout(function(){toast.classList.remove("show");setTimeout(function(){toast.remove();},300);},1200);};',
        '          document.getElementById("ltp-pal-rgb").onclick=function(){var v=this.textContent;navigator.clipboard.writeText(v);var toast=document.createElement("div");toast.className="ltp-pal-toast show";toast.textContent="Copied "+v;document.body.appendChild(toast);setTimeout(function(){toast.classList.remove("show");setTimeout(function(){toast.remove();},300);},1200);};',
        '          document.getElementById("ltp-pal-hsl").onclick=function(){var v=this.textContent;navigator.clipboard.writeText(v);var toast=document.createElement("div");toast.className="ltp-pal-toast show";toast.textContent="Copied "+v;document.body.appendChild(toast);setTimeout(function(){toast.classList.remove("show");setTimeout(function(){toast.remove();},300);},1200);};',
        '          document.getElementById("ltp-pal-ai-copy").onclick=function(){var v=document.getElementById("ltp-pal-ai-desc").textContent;navigator.clipboard.writeText(v);var toast=document.createElement("div");toast.className="ltp-pal-toast show";toast.textContent="Copied AI描述";document.body.appendChild(toast);setTimeout(function(){toast.classList.remove("show");setTimeout(function(){toast.remove();},300);},1200);};',
        '          document.getElementById("ltp-pal-add-fav").onclick=function(){var hex=document.getElementById("ltp-pal-pick").value;if(!_fav.includes(hex)){_fav.push(hex);localStorage.setItem("_lt_pal_fav",JSON.stringify(_fav));_renderFav();}};',
        '        }',
        '        _renderPalette();',
        '      }',
        '      else if(_ltPActiveTab==="settings"){',
        '        var api=_ltPromptAPI;',
        '        body.innerHTML=\'<div style="margin-bottom:10px;color:rgba(255,255,255,0.5);font-size:11px;">配置 AI 增强 API（兼容 OpenAI 格式）</div>\'',
        '          +\'<label style="font-size:11px;color:rgba(255,255,255,0.4);">API 地址</label>\'',
        '          +\'<input type="text" id="ltp-set-url" placeholder="https://api.deepseek.com/chat/completions" value="\'+(api.url||"").replace(/"/g,"&quot;")+\'">\'',
        '          +\'<label style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:8px;display:block;">API Key</label>\'',
        '          +\'<input type="password" id="ltp-set-key" placeholder="sk-..." value="\'+(api.key||"").replace(/"/g,"&quot;")+\'">\'',
        '          +\'<label style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:8px;display:block;">模型</label>\'',
        '          +\'<input type="text" id="ltp-set-model" placeholder="deepseek-v4-flash" value="\'+(api.model||"").replace(/"/g,"&quot;")+\'">\'',
        '          +\'<div style="margin-top:10px;"><button class="ltp-btn ltp-btn-primary" id="ltp-set-save">保存配置</button></div>\'',
        '          +\'<div class="ltp-status" id="ltp-set-status"></div>\';',
        '        document.getElementById("ltp-set-save").onclick=function(){',
        '          _ltPromptAPI={url:document.getElementById("ltp-set-url").value.trim(),key:document.getElementById("ltp-set-key").value.trim(),model:document.getElementById("ltp-set-model").value.trim()||"deepseek-v4-flash"};',
        '          localStorage.setItem("_lt_prompt_api",JSON.stringify(_ltPromptAPI));',
        '          document.getElementById("ltp-set-status").textContent="✅ 已保存";',
        '        };',
        '      }',
        '    }',
        '    var div=document.createElement("div");',
        '    div.id="libtv-prompt";',
        '    div.innerHTML=\'<div class="ltp-head"><h3>提示词工具</h3><span class="ltp-close" id="ltp-close">✕</span></div>\'',
        '      +\'<div class="ltp-tabs"><span class="ltp-tab active" data-tab="templates">模板</span><span class="ltp-tab" data-tab="palette">调色</span><span class="ltp-tab" data-tab="ai">AI 增强</span><span class="ltp-tab" data-tab="theme">主题</span><span class="ltp-tab" data-tab="settings">设置</span></div>\'',
        '      +\'<div id="ltp-body" class="ltp-body"></div>\'',
        '      +\'<div style="display:flex;gap:6px;padding:8px 16px 12px;border-top:1px solid rgba(129,140,248,0.12);">\'',
        '      +\'<button class="ltp-btn ltp-btn-primary ltp-btn-sm" id="ltp-add">+ 新增模板</button>\'',
        '      +\'<button class="ltp-btn ltp-btn-ghost ltp-btn-sm" id="ltp-reset">恢复默认模板</button>\'',
        '      +\'</div>\';',
        '    document.body.appendChild(div);',
        '    if(!anchor||!anchor.getBoundingClientRect){',
        '      div.style.left="50%"; div.style.top="50%";',
        '      div.style.transform="translate(-50%,-50%)";',
        '    }',
        '    renderBody();',
        '    div.addEventListener("mousemove",function(e){',
        '      var items=div.querySelectorAll(".ltp-item");',
        '      items.forEach(function(it){',
        '        var r=it.getBoundingClientRect();',
        '        it.style.setProperty("--mx",(e.clientX-r.left)+"px");',
        '        it.style.setProperty("--my",(e.clientY-r.top)+"px");',
        '      });',
        '    });',
        '    document.getElementById("ltp-close").onclick=function(){div.remove();};',
        '    document.getElementById("ltp-add").onclick=function(){',
        '      var nn=prompt("模板名称:"); if(nn===null)return;',
        '      var cc=prompt("提示词内容:"); if(cc===null)return;',
        '      var cat=prompt("分类(如:图像/视频/通用):")||"通用";',
        '      _ltPrompts.push({id:"p"+Date.now(),name:nn,content:cc,category:cat});',
        '      savePrompts(); renderBody();',
        '    };',
        '    document.getElementById("ltp-reset").onclick=function(){',
        '      if(!confirm("恢复默认模板将覆盖当前所有模板，确认？"))return;',
        '      _ltPrompts=[',
        '        {id:"d1",name:"产品摄影",category:"图像",content:"Product photography on {background=white} background, {lighting=studio lighting}, high detail, 8K, sharp focus, {extra}"},',
        '        {id:"d2",name:"电影镜头",category:"图像",content:"Cinematic shot, {lens=anamorphic} lens, {lighting=dramatic} lighting, shallow depth of field, {style}"},',
        '        {id:"d3",name:"动画-吉卜力风",category:"图像",content:"Studio Ghibli style, hand-drawn animation, {palette=soft pastel} colors, {atmosphere=whimsical}"},',
        '        {id:"d4",name:"产品展示-环绕",category:"视频",content:"Smooth 360 orbit around {subject=product}, {lighting=soft studio} lighting, slow motion, {extra}"},',
        '        {id:"d5",name:"风光-延时",category:"视频",content:"Timelapse, {time=golden hour}, {sky=dramatic clouds}, warm tones, smooth transition, {extra}"},',
        '      ];',
        '      savePrompts(); renderBody();',
        '    };',
        '    div.querySelectorAll(".ltp-tab").forEach(function(t){t.onclick=function(){_ltPActiveTab=this.getAttribute("data-tab");div.querySelectorAll(".ltp-tab").forEach(function(x){x.classList.toggle("active",x===t);});renderBody();};});',
        '  }',

        /* ———— 标签系统 ———— */
        '  var _ltTagGroups=JSON.parse(localStorage.getItem("_lt_tags")||"[]");',
        '  if(!_ltTagGroups.length){',
        '    _ltTagGroups=[',
        '      {id:"tg_quality",name:"\\u8d28\\u91cf",items:[',
        '        {id:"tq1",text:"masterpiece"},{id:"tq2",text:"high quality"},{id:"tq3",text:"8K"},{id:"tq4",text:"highly detailed"},{id:"tq5",text:"sharp focus"},{id:"tq6",text:"best quality"},{id:"tq7",text:"ultra-detailed"},{id:"tq8",text:"4K"}',
        '      ]},',
        '      {id:"tg_style",name:"\\u98ce\\u683c",items:[',
        '        {id:"ts1",text:"photorealistic"},{id:"ts2",text:"cinematic"},{id:"ts3",text:"anime"},{id:"ts4",text:"concept art"},{id:"ts5",text:"digital painting"},{id:"ts6",text:"3D render"},{id:"ts7",text:"oil painting"},{id:"ts8",text:"watercolor"}',
        '      ]},',
        '      {id:"tg_light",name:"\\u5149\\u7167",items:[',
        '        {id:"tl1",text:"studio lighting"},{id:"tl2",text:"dramatic lighting"},{id:"tl3",text:"soft light"},{id:"tl4",text:"golden hour"},{id:"tl5",text:"neon lighting"},{id:"tl6",text:"rim light"},{id:"tl7",text:"volumetric lighting"},{id:"tl8",text:"cinematic lighting"}',
        '      ]},',
        '      {id:"tg_compose",name:"\\u6784\\u56fe",items:[',
        '        {id:"tc1",text:"close-up"},{id:"tc2",text:"wide angle"},{id:"tc3",text:"aerial view"},{id:"tc4",text:"low angle"},{id:"tc5",text:"bird\'s eye view"},{id:"tc6",text:"macro"},{id:"tc7",text:"symmetrical composition"},{id:"tc8",text:"rule of thirds"}',
        '      ]},',
        '    ];',
        '    localStorage.setItem("_lt_tags",JSON.stringify(_ltTagGroups));',
        '  }',
        '  var _ltTagActiveGroup=0;',
        '  var _ltTagMenuEl=null,_ltTagInputEl=null;',
        '  function _ltInsertTagAtCursor(tagText){',
        '    var ta=_ltTagInputEl; if(!ta)return;',
        '    if(ta.tagName==="TEXTAREA"||(ta.tagName==="INPUT"&&ta.type==="text")){',
        '      var start=ta.selectionStart,end=ta.selectionEnd,val=ta.value;',
        '      var ins=tagText+(val.length>0&&start>0&&val[start-1]!==" "?" ":"");',
        '      var newVal=val.slice(0,start)+ins+val.slice(end);',
        '      var proto=ta.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;',
        '      var nativeSetter=Object.getOwnPropertyDescriptor(proto,"value").set;',
        '      nativeSetter.call(ta,newVal);',
        '      var pos=start+ins.length;',
        '      ta.setSelectionRange(pos,pos);',
        '      ta.dispatchEvent(new Event("input",{bubbles:true}));',
        '    }else if(ta.isContentEditable){',
        '      var sel=window.getSelection();',
        '      if(!sel||!sel.rangeCount){ta.appendChild(document.createTextNode(tagText));}',
        '      else{',
        '        var r=sel.getRangeAt(0);',
        '        r.deleteContents();',
        '        r.insertNode(document.createTextNode(tagText));',
        '        r.collapse(false);',
        '        sel.removeAllRanges();sel.addRange(r);',
        '      }',
        '      ta.dispatchEvent(new Event("input",{bubbles:true}));',
        '    }',
        '    ta.focus();',
        '  }',
        '  function _ltRenderTagMenu(){',
        '    if(!_ltTagMenuEl)return;',
        '    var group=_ltTagGroups[_ltTagActiveGroup]; if(!group)return;',
        '    var body=_ltTagMenuEl.querySelector(".lt-tag-body"); if(!body)return;',
        '    var h="";',
        '    group.items.forEach(function(it){',
        '      h+="<div class=\\"lt-tag-item\\" data-text=\\""+it.text.replace(/"/g,"&quot;")+"\\">"+it.text+"</div>";',
        '    });',
        '    body.innerHTML=h;',
        '    body.querySelectorAll(".lt-tag-item").forEach(function(el){',
        '      el.addEventListener("click",function(){_ltInsertTagAtCursor(this.getAttribute("data-text"));_ltCloseTagMenu();});',
        '    });',
        '    _ltTagMenuEl.querySelector(".lt-tag-tabs").innerHTML=_ltTagGroups.map(function(g,i){',
        '      return "<span class=\\"lt-tag-tab"+(i===_ltTagActiveGroup?" active":"")+"\\" data-idx=\\""+i+"\\">"+g.name+"</span>";',
        '    }).join("");',
        '    _ltTagMenuEl.querySelectorAll(".lt-tag-tab").forEach(function(tab){',
        '      tab.addEventListener("click",function(){_ltTagActiveGroup=parseInt(this.getAttribute("data-idx"));_ltRenderTagMenu();_ltRefreshTagBars();});',
        '    });',
        '  }',
        '  function _ltPosTagMenu(){',
        '    if(!_ltTagMenuEl||!_ltTagInputEl)return;',
        '    var r=_ltTagInputEl.getBoundingClientRect(),mw=_ltTagMenuEl.offsetWidth||320,mh=_ltTagMenuEl.offsetHeight||300;',
        '    var l=Math.max(8,r.left+r.width-mw-4); if(l+mw>window.innerWidth-8)l=window.innerWidth-mw-8;',
        '    var t=r.top-mh-6; if(t<8)t=r.bottom+6;',
        '    _ltTagMenuEl.style.left=l+"px";_ltTagMenuEl.style.top=t+"px";',
        '  }',
        '  function _ltShowTagMenu(ta){',
        '    _ltCloseTagMenu();',
        '    _ltTagInputEl=ta;',
        '    var div=document.createElement("div");div.className="lt-tag-menu";div.id="lt-tag-menu";',
        '    div.innerHTML="<div class=\\"lt-tag-head\\"><span>\\u6807\\u7b7e</span><span class=\\"lt-tag-close\\" id=\\"lt-tag-close\\">\\u2715</span></div>"',
        '      +"<div class=\\"lt-tag-tabs\\"></div>"',
        '      +"<div class=\\"lt-tag-body\\"></div>"',
        '      +"<div class=\\"lt-tag-foot\\"><button class=\\"lt-tag-mgr\\" id=\\"lt-tag-mgr\\">+ \\u7ba1\\u7406\\u5206\\u7ec4</button></div>";',
        '    document.body.appendChild(div);',
        '    _ltTagMenuEl=div;',
        '    _ltRenderTagMenu();',
        '    _ltPosTagMenu();',
        '    var close=document.getElementById("lt-tag-close");',
        '    if(close)close.onclick=_ltCloseTagMenu;',
        '    var mgr=document.getElementById("lt-tag-mgr");',
        '    if(mgr)mgr.onclick=_ltManageTags;',
        '  }',
        '  function _ltCloseTagMenu(){',
        '    var el=document.getElementById("lt-tag-menu");if(el)el.remove();',
        '    _ltTagMenuEl=null;_ltTagInputEl=null;',
        '  }',
        '  function _ltSaveTags(){localStorage.setItem("_lt_tags",JSON.stringify(_ltTagGroups));}',
        '  function _ltManageTags(){',
        '    var h="<div class=\\"lt-mgr-overlay\\" id=\\"lt-mgr-overlay\\">"',
        '      +"<div class=\\"lt-mgr-panel\\"><div class=\\"lt-mgr-head\\"><span>\\u7ba1\\u7406\\u5206\\u7ec4</span><span class=\\"lt-tag-close\\" id=\\"lt-mgr-close\\">\\u2715</span></div>"',
        '      +"<div class=\\"lt-mgr-body\\" id=\\"lt-mgr-body\\"></div>"',
        '      +"<div class=\\"lt-mgr-foot\\"><button class=\\"ltp-btn ltp-btn-primary\\" id=\\"lt-mgr-add-group\\">+ \\u65b0\\u5efa\\u5206\\u7ec4</button></div></div></div>";',
        '    var ov=document.createElement("div");ov.innerHTML=h;document.body.appendChild(ov.firstElementChild);',
        '    var body=document.getElementById("lt-mgr-body");',
        '    function renderMgr(){',
        '      body.innerHTML=_ltTagGroups.map(function(g,gi){',
        '        var gh="<div class=\\"lt-mgr-group\\"><div class=\\"lt-mgr-ghead\\"><input class=\\"lt-mgr-gname\\" value=\\""+g.name.replace(/"/g,"&quot;")+"\\" data-idx=\\""+gi+"\\"><button class=\\"lt-tag-delg\\" data-idx=\\""+gi+"\\">\\u2715 \\u5220\\u9664</button></div>";',
        '        gh+=g.items.map(function(it,ii){',
        '          return "<div class=\\"lt-mgr-item\\"><input class=\\"lt-mgr-itext\\" value=\\""+it.text.replace(/"/g,"&quot;")+"\\" data-g=\\""+gi+"\\" data-i=\\""+ii+"\\"><button class=\\"lt-tag-deli\\" data-g=\\""+gi+"\\" data-i=\\""+ii+"\\">\\u2715</button></div>";',
        '        }).join("");',
        '        gh+="<button class=\\"ltp-btn ltp-btn-ghost ltp-btn-sm lt-mgr-add-item\\" data-idx=\\""+gi+"\\">+ \\u6dfb\\u52a0\\u6807\\u7b7e</button></div>";',
        '        return gh;',
        '      }).join("");',
        '      body.querySelectorAll(".lt-mgr-gname").forEach(function(inp){inp.addEventListener("change",function(){var idx=parseInt(this.getAttribute("data-idx"));if(_ltTagGroups[idx])_ltTagGroups[idx].name=this.value;_ltSaveTags();});});',
        '      body.querySelectorAll(".lt-mgr-itext").forEach(function(inp){inp.addEventListener("change",function(){var g=parseInt(this.getAttribute("data-g")),i=parseInt(this.getAttribute("data-i"));if(_ltTagGroups[g]&&_ltTagGroups[g].items[i])_ltTagGroups[g].items[i].text=this.value;_ltSaveTags();});});',
        '      body.querySelectorAll(".lt-tag-delg").forEach(function(btn){btn.addEventListener("click",function(){var idx=parseInt(this.getAttribute("data-idx"));_ltTagGroups.splice(idx,1);_ltSaveTags();renderMgr();if(_ltTagActiveGroup>=_ltTagGroups.length)_ltTagActiveGroup=_ltTagGroups.length-1;if(_ltTagMenuEl)_ltRenderTagMenu();_ltRefreshTagBars();});});',
        '      body.querySelectorAll(".lt-tag-deli").forEach(function(btn){btn.addEventListener("click",function(){var g=parseInt(this.getAttribute("data-g")),i=parseInt(this.getAttribute("data-i"));if(_ltTagGroups[g]){_ltTagGroups[g].items.splice(i,1);_ltSaveTags();renderMgr();if(_ltTagMenuEl)_ltRenderTagMenu();}});});',
        '      body.querySelectorAll(".lt-mgr-add-item").forEach(function(btn){btn.addEventListener("click",function(){var idx=parseInt(this.getAttribute("data-idx"));if(_ltTagGroups[idx]){_ltTagGroups[idx].items.push({id:"tu"+Date.now(),text:"new tag"});_ltSaveTags();renderMgr();if(_ltTagMenuEl)_ltRenderTagMenu();}});});',
        '    }',
        '    renderMgr();',
        '    document.getElementById("lt-mgr-close").onclick=function(){var el=document.getElementById("lt-mgr-overlay");if(el)el.remove();if(_ltTagMenuEl)_ltRenderTagMenu();_ltRefreshTagBars();};',
        '    document.getElementById("lt-mgr-add-group").onclick=function(){_ltTagGroups.push({id:"tg"+Date.now(),name:"\\u65b0\\u5206\\u7ec4",items:[{id:"tu"+Date.now(),text:"new tag"}]});_ltSaveTags();renderMgr();if(_ltTagMenuEl)_ltRenderTagMenu();_ltRefreshTagBars();};',
        '  }',
        '  (function(){',
        '    function _ltTagScan(){',
        '      var els=document.querySelectorAll("textarea,input[type=\\"text\\"],[contenteditable=\\"true\\"]");',
        '      console.log("[LibTV Tag] scanning",els.length,"elements");',
        '      els.forEach(function(ta){',
        '        var isCE=ta.isContentEditable;',
        '        if(!isCE&&ta.offsetParent===null)return;',
        '        if(isCE){',
        '          var flexRow=ta.parentNode&&ta.parentNode.parentNode;',
        '          if(flexRow&&!flexRow.querySelector(".lt-tag-bar")){',
        '            var cs=getComputedStyle(flexRow);',
        '            if(cs.display==="flex"||cs.display==="inline-flex"){',
        '              console.log("[LibTV Tag] found CE, attaching bar");',
        '              _ltRenderTagBarInner(ta,flexRow);',
        '            }',
        '          }',
        '        }else{',
        '          if(ta.parentNode&&!ta.parentNode.querySelector(".lt-tag-icon")){',
        '            var wr=ta.parentNode;',
        '            if(getComputedStyle(wr).position==="static")wr.style.position="relative";',
        '            var icon=document.createElement("div");',
        '            icon.className="lt-tag-icon";',
        '            icon.title="\\u6807\\u7b7e (I)";',
        '            icon.innerHTML=\'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>\';',
        '            icon.style.cssText="position:absolute;right:6px;bottom:6px;z-index:5;width:22px;height:22px;border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0.35;color:#fff;background:rgba(0,0,0,0.3);transition:opacity 0.15s,background 0.15s;";',
        '            icon.onmouseenter=function(){this.style.opacity="0.7";this.style.background="rgba(0,0,0,0.5)";};',
        '            icon.onmouseleave=function(){this.style.opacity="0.35";this.style.background="rgba(0,0,0,0.3)";};',
        '            icon.onclick=function(e){e.stopPropagation();_ltShowTagMenu(ta);};',
        '            wr.appendChild(icon);',
        '            console.log("[LibTV Tag] attached icon to",ta.tagName);',
        '          }',
        '        }',
        '      });',
        '    }',
        '    _ltTagScan();',
        '    setTimeout(function(){console.log("[LibTV Tag] retry scan");_ltTagScan();},3000);',
        '    function _ltRenderTagBarInner(ta,flexRow){',
        '      var old=flexRow.querySelector(".lt-tag-bar");',
        '      if(old)old.remove();',
        '      var bar=document.createElement("div");',
        '      bar.className="lt-tag-bar";',
        '      var head=document.createElement("div");',
        '      head.className="lt-tag-bar-head";',
        '      head.innerHTML=\'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>\';',
        '      head.title="\\u6253\\u5f00\\u6807\\u7b7e\\u83dc\\u5355";',
        '      head.onclick=function(e){e.stopPropagation();_ltShowTagMenu(ta);};',
        '      bar.appendChild(head);',
        '      var nav=document.createElement("div");',
        '      nav.className="lt-tag-bar-nav";',
        '      var prev=document.createElement("span");',
        '      prev.textContent="\\u25c0";prev.className="lt-tag-bar-arrow";',
        '      prev.onclick=function(e){e.stopPropagation();if(_ltTagGroups.length<2)return;_ltTagActiveGroup=(_ltTagActiveGroup-1+_ltTagGroups.length)%_ltTagGroups.length;_ltRefreshTagBars();};',
        '      var next=document.createElement("span");',
        '      next.textContent="\\u25b6";next.className="lt-tag-bar-arrow";',
        '      next.onclick=function(e){e.stopPropagation();if(_ltTagGroups.length<2)return;_ltTagActiveGroup=(_ltTagActiveGroup+1)%_ltTagGroups.length;_ltRefreshTagBars();};',
        '      var gname=document.createElement("span");',
        '      gname.className="lt-tag-bar-gname";',
        '      gname.textContent=_ltTagGroups[_ltTagActiveGroup]?_ltTagGroups[_ltTagActiveGroup].name:"";',
        '      nav.appendChild(prev);nav.appendChild(gname);nav.appendChild(next);',
        '      bar.appendChild(nav);',
        '      var group=_ltTagGroups[_ltTagActiveGroup];',
        '      if(group){',
        '        var items=group.items.slice(0,4);',
        '        items.forEach(function(it){',
        '          var el=document.createElement("div");',
        '          el.className="lt-tag-bar-item";',
        '          el.textContent=it.text;',
        '          el.onclick=function(e){e.stopPropagation();_ltTagInputEl=ta;_ltInsertTagAtCursor(it.text);};',
        '          bar.appendChild(el);',
        '        });',
        '      }',
        '      var expand=document.createElement("div");',
        '      expand.className="lt-tag-bar-expand";',
        '      expand.textContent="\\u25b6 \\u66f4\\u591a";',
        '      expand.onclick=function(e){e.stopPropagation();_ltShowTagMenu(ta);};',
        '      bar.appendChild(expand);',
        '      flexRow.appendChild(bar);',
        '    }',
        '    function _ltRefreshTagBars(){',
        '      document.querySelectorAll(".lt-tag-bar").forEach(function(bar){',
        '        var flexRow=bar.parentNode; if(!flexRow)return;',
        '        var ta=flexRow.querySelector("[contenteditable=true],textarea,input[type=\\"text\\"]");',
        '        if(ta)_ltRenderTagBarInner(ta,flexRow);',
        '      });',
        '    }',
        '    _ltTagScan();',
        '    var _ltTagTimer=null;',
        '    var _ltTagObs=new MutationObserver(function(){',
        '      if(_ltTagTimer)clearTimeout(_ltTagTimer);',
        '      _ltTagTimer=setTimeout(_ltTagScan,100);',
        '    });',
        '    _ltTagObs.observe(document.body,{childList:true,subtree:true});',
        '  })();',

        /* ———— 悬浮提示词按钮 ———— */
        '  (function(){',
        '    var btn=document.createElement("div");',
        '    btn.id="libtv-pbtn";',
        '    btn.title="提示词工具 (P)";',
        '    btn.innerHTML=\'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>\';',
        '    btn.style.cssText="position:fixed;right:60px;bottom:70px;z-index:99998;width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,rgba(99,102,241,0.9),rgba(79,70,229,0.9));color:#fff;display:flex;align-items:center;justify-content:center;cursor:grab;user-select:none;box-shadow:0 4px 16px rgba(99,102,241,0.25);";',
        '    btn.onmouseenter=function(){btn.style.transform="scale(1.08)";btn.style.boxShadow="0 6px 24px rgba(99,102,241,0.35)";};',
        '    btn.onmouseleave=function(){btn.style.transform="scale(1)";btn.style.boxShadow="0 4px 16px rgba(99,102,241,0.25)";};',
        '    document.body.appendChild(btn);',
        '    function _ltPosPanel(){',
        '      var p=document.getElementById("libtv-prompt");if(!p)return;',
        '      var r=btn.getBoundingClientRect(),pw=Math.min(520,window.innerWidth-32),ph=p.offsetHeight||400;',
        '      p.style.left=Math.max(12,Math.min(r.left+r.width/2-pw/2,window.innerWidth-pw-12))+"px";',
        '      var t=r.bottom+10;if(t+ph>window.innerHeight-12)t=Math.max(12,r.top-ph-10);',
        '      p.style.top=t+"px";p.style.transform="none";',
        '    }',
        '    function _ltToggle(){',
        '      var p=document.getElementById("libtv-prompt");if(p){p.remove();return;}',
        '      _ltPromptPanel(btn);_ltPosPanel();',
        '    }',
        '    btn.onclick=_ltToggle;',
        '    function _ltClamp(){var pw=36,ph=36;var l=parseInt(btn.style.left);var t=parseInt(btn.style.top);if(!isNaN(l)){l=Math.max(4,Math.min(l,window.innerWidth-pw-4));btn.style.left=l+"px";}if(!isNaN(t)){t=Math.max(4,Math.min(t,window.innerHeight-ph-4));btn.style.top=t+"px";}_ltPosPanel();}',
        '    var dx=0,dy=0,dragging=false;',
        '    btn.addEventListener("mousedown",function(e){dragging=true;dx=e.clientX-btn.offsetLeft;dy=e.clientY-btn.offsetTop;e.preventDefault();});',
        '    document.addEventListener("mousemove",function(e){if(!dragging)return;var pw=36,ph=36,l=e.clientX-dx,t=e.clientY-dy;l=Math.max(4,Math.min(l,window.innerWidth-pw-4));t=Math.max(4,Math.min(t,window.innerHeight-ph-4));btn.style.left=l+"px";btn.style.top=t+"px";btn.style.right="auto";btn.style.bottom="auto";_ltPosPanel();});',
        '    document.addEventListener("mouseup",function(){if(dragging){dragging=false;try{localStorage.removeItem("_lt_pbtn_r");localStorage.removeItem("_lt_pbtn_b");localStorage.removeItem("_lt_pbtn_x");localStorage.removeItem("_lt_pbtn_y");}catch(ex){}}});',
        '    window.addEventListener("resize",_ltClamp);',
        '  })();',

        /* ———— 直角连线 ———— */
        '  var _ltStepTo=null;',
        '  function _ltStepEdges(){',
        '    document.querySelectorAll(".react-flow__edges path").forEach(function(p){',
        '      var d=p.getAttribute("d")||"";',
        '      if(d.indexOf("C")===-1)return;',
        '      try{',
        '        var len=p.getTotalLength();',
        '        if(!len||isNaN(len))return;',
        '        var s=p.getPointAtLength(0),e=p.getPointAtLength(len);',
        '        p.setAttribute("d","M "+s.x+" "+s.y+" L "+e.x+" "+s.y+" L "+e.x+" "+e.y);',
        '      }catch(ex){}',
        '    });',
        '  }',
        '  var _ltStepObs=null,_ltStepRetries=0;',
        '  function _ltStepApply(){',
        '    if(_ltStepTo){clearTimeout(_ltStepTo);_ltStepTo=null;}',
        '    var ed=document.querySelector(".react-flow__edges");',
        '    if(!ed){if(++_ltStepRetries>5)return;_ltStepTo=setTimeout(_ltStepApply,500);return;}',
        '    _ltStepRetries=0;',
        '    if(document.body.classList.contains("libtv-step-edges")){',
        '      _ltStepEdges();',
        '      if(!_ltStepObs){',
        '        var _ltStepParent=document.querySelector(".react-flow")||document.body;',
        '        _ltStepObs=new MutationObserver(function(){_ltStepRetries=0;_ltStepApply();});',
        '        _ltStepObs.observe(_ltStepParent,{childList:true,subtree:true,attributes:true,attributeFilter:["d"]});',
        '      }',
        '    }else{',
        '      if(_ltStepObs){_ltStepObs.disconnect();_ltStepObs=null;}',
        '    }',
        '  }',
        '  var _ltStepOn=localStorage.getItem("_lt_step")==="1";',
        '  if(_ltStepOn){ document.body.classList.add("libtv-step-edges"); _ltStepApply(); }',

        /* ———— 快捷键 ———— */
        '  document.addEventListener("keydown",function(e){',
        '    if(e.ctrlKey||e.metaKey||e.altKey)return;',

        /* Escape 始终可用 */
        '    if(e.key==="Escape"){',
        '      var _handled=false;',
        '      _ltClearChain();',
        '      var _ss=document.getElementById("libtv-search"); if(_ss){_ss.remove();_handled=true;}',
        '      var _pp=document.getElementById("libtv-prompt"); if(_pp){_pp.remove();_handled=true;}',
        '      var _dd=document.getElementById("lt-debug"); if(_dd){_dd.remove();_handled=true;}',
        '      if(_handled){e.preventDefault();e.stopPropagation();}',
        '      return;',
        '    }',

        '    var t=e.target||document.activeElement;',
        '    if(t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.isContentEditable)){',
        '      if(e.key!=="i"&&e.key!=="I")return;',
        '    }',

        /* G: 网格 */
        '    if(e.key==="g"||e.key==="G"){',
        '      e.preventDefault(); e.stopPropagation();',
        '      var bg=document.querySelector(".react-flow__background");',
        '      if(bg) bg.classList.toggle("perf-no-grid");',
        '      try{localStorage.setItem("_lt_grid",bg.classList.contains("perf-no-grid")?"1":"0");}catch(ex){}',
        '      return;',
        '    }',

        /* T: 性能 */
        '    if(e.key==="t"||e.key==="T"){',
        '      e.preventDefault(); e.stopPropagation();',
        '      document.body.classList.toggle("perf-mode");',
        '      try{localStorage.setItem("_lt_perf",document.body.classList.contains("perf-mode")?"1":"0");}catch(ex){}',
        '      return;',
        '    }',

        /* H: 隐藏图片 */
        '    if(e.key==="h"||e.key==="H"){',
        '      e.preventDefault(); e.stopPropagation();',
        '      document.body.classList.toggle("perf-hide-imgs");',
        '      try{localStorage.setItem("_lt_hide",document.body.classList.contains("perf-hide-imgs")?"1":"0");}catch(ex){}',
        '      return;',
        '    }',

        /* L: 隐藏连线 */
        '    if(e.key==="l"||e.key==="L"){',
        '      e.preventDefault(); e.stopPropagation();',
        '      var edges=document.querySelector(".react-flow__edges");',
        '      if(edges) edges.classList.toggle("perf-hide-edges");',
        '      try{localStorage.setItem("_lt_edges",edges.classList.contains("perf-hide-edges")?"1":"0");}catch(ex){}',
        '      return;',
        '    }',

        /* C: 自动全链路模式 */
        '    if(e.key==="c"||e.key==="C"){',
        '      e.preventDefault(); e.stopPropagation();',
        '      _ltAutoChain=!_ltAutoChain;',
        '      document.body.classList.toggle("libtv-autochain",_ltAutoChain);',
        '      try{localStorage.setItem("_lt_autochain",_ltAutoChain?"1":"0");}catch(ex){}',
        '      if(!_ltAutoChain) _ltClearChain();',
        '      return;',
        '    }',

        /* F: 搜索 */
        '    if(e.key==="f"||e.key==="F"){',
        '      e.preventDefault(); e.stopPropagation();',
        '      _ltSearch();',
        '      return;',
        '    }',

        /* P: 提示词工具 */
        '    if(e.key==="p"||e.key==="P"){',
        '      e.preventDefault(); e.stopPropagation();',
        '      _ltPromptPanel();',
        '      return;',
        '    }',

        /* X: 专注模式 */
        '    if(e.key==="x"||e.key==="X"){',
        '      e.preventDefault(); e.stopPropagation();',
        '      document.body.classList.toggle("libtv-focus");',
        '      try{localStorage.setItem("_lt_focus",document.body.classList.contains("libtv-focus")?"1":"0");}catch(ex){}',
        '      return;',
        '    }',

        /* R: 直角连线 */
        '    if(e.key==="r"||e.key==="R"){',
        '      e.preventDefault(); e.stopPropagation();',
        '      document.body.classList.toggle("libtv-step-edges");',
        '      try{localStorage.setItem("_lt_step",document.body.classList.contains("libtv-step-edges")?"1":"0");}catch(ex){}',
        '      _ltStepApply();',
        '      return;',
        '    }',

        /* I: 标签 */
        '    if(e.key==="i"||e.key==="I"){',
        '      e.preventDefault(); e.stopPropagation();',
        '      var ta=document.activeElement;',
        '      if(ta&&(ta.tagName==="TEXTAREA"||(ta.tagName==="INPUT"&&ta.type==="text")||ta.isContentEditable)&&ta.offsetParent!==null){',
        '        _ltShowTagMenu(ta);',
        '      }else{',
        '        var _tas=document.querySelectorAll("textarea,input[type=\\"text\\"],[contenteditable=\\"true\\"]");',
        '        for(var _ti=0;_ti<_tas.length;_ti++){var t=_tas[_ti];if(t.offsetParent!==null){_ltShowTagMenu(t);break;}}',
        '      }',
        '      return;',
        '    }',

        /* ?: 帮助 */
        '    if(e.key==="?"||e.key==="/"){',
        '      e.preventDefault(); e.stopPropagation();',
        '      var h=document.getElementById("libtv-help");',
        '      if(h) h.classList.toggle("libtv-hide");',
        '      return;',
        '    }',
        '  }, true);',

        '  window._ltShowTagMenu=_ltShowTagMenu;',
        '  console.log("[LibTV Boost] v1.5 · G网格 T性能 H隐藏 L连线 C全链 F搜索 P提示词 X专注 R直角 I标签 ?帮助 · AI增强 · DIY主题 · 画布配色 · 模板变量 · 标签");',
        '})();'
    ].join('\n');
    document.body.appendChild(hook);

    /* =========================================================
     *  4. 菜单开关 + 状态持久化
     * ========================================================= */
    var _toggles = {
        perf: function(v){ document.body.classList.toggle('perf-mode', v); },
        hide: function(v){ document.body.classList.toggle('perf-hide-imgs', v); },
        grid: function(v){
            var bg = document.querySelector('.react-flow__background');
            if(bg) bg.classList.toggle('perf-no-grid', v);
        },
        edges: function(v){
            var edges = document.querySelector('.react-flow__edges');
            if(edges) edges.classList.toggle('perf-hide-edges', v);
        },
        focus: function(v){ document.body.classList.toggle('libtv-focus', v); },
    };

    function _read(){
        var s = {};
        for(var k in _toggles) if(_toggles.hasOwnProperty(k))
            s[k] = localStorage.getItem('_lt_'+k) === '1';
        return s;
    }
    function _apply(){
        var s = _read();
        for(var k in _toggles) if(_toggles.hasOwnProperty(k)) _toggles[k](s[k]);
    }
    function _click(key){
        var v = localStorage.getItem('_lt_'+key) !== '1';
        localStorage.setItem('_lt_'+key, v ? '1' : '0');
        _toggles[key](v);
    }

    setTimeout(_apply, 1000);

    GM_registerMenuCommand('⏱ 性能模式', function(){ _click('perf'); });
    GM_registerMenuCommand('⊙ 隐藏图片', function(){ _click('hide'); });
    GM_registerMenuCommand('╳ 隐藏连线', function(){ _click('edges'); });
    GM_registerMenuCommand('▦ 隐藏网格', function(){ _click('grid'); });
    GM_registerMenuCommand('◎ 专注模式', function(){ _click('focus'); });
    GM_registerMenuCommand('🏷️ 标签', function(){
        var ta=document.querySelector('textarea,input[type="text"],[contenteditable="true"]');
        if(ta&&ta.offsetParent!==null){ unsafeWindow._ltShowTagMenu(ta); }
    });
    GM_registerMenuCommand('🔍 诊断', function(){
        try {
            var info = [];
            info.push('=== 边 (class 含 edge) ===');
            var es = document.querySelectorAll('[class*="edge"]');
            info.push('数量: ' + es.length);
            for(var i=0;i<Math.min(es.length,10);i++){
                var e = es[i];
                var attrs = '';
                for(var a=0;a<e.attributes.length;a++){
                    var attr = e.attributes[a];
                    if(attr.name.indexOf('__react')===0) continue;
                    attrs += '\n  ' + attr.name + '="' + (attr.value||'').slice(0,80) + '"';
                }
                var path = e.querySelector('path');
                var d = path ? (path.getAttribute('d')||'').slice(0,100) : '无path';
                info.push(i + ' class="' + (e.getAttribute('class')||'') + '"' + attrs);
                info.push('  d="' + d + '"');
            }
            info.push('');
            info.push('=== 节点 (data-id) ===');
            // 找所有有 data-id 的元素
            var all = document.querySelectorAll('[data-id]');
            info.push('有 data-id 的元素: ' + all.length);
            var ns = [];
            for(var j=0;j<all.length;j++){
                var id = all[j].getAttribute('data-id');
                if(id && (id.indexOf('i-')===0 || id.indexOf('n-')===0 || id.indexOf('m-')===0)){
                    ns.push(all[j]);
                }
            }
            info.push('节点(data-id以i-/n-/m-开头): ' + ns.length);
            for(var k=0;k<Math.min(ns.length,10);k++){
                var n = ns[k];
                var transform = n.style.transform || '';
                var text = (n.textContent||'').trim().split('\n')[0].slice(0,40);
                info.push(k + ' data-id=' + n.getAttribute('data-id') + ' transform="' + transform + '" text="' + text + '" class=' + (n.getAttribute('class')||'').slice(0,40));
            }
            var txt = info.join('\n');
            var div = document.createElement('div');
            div.style.cssText = 'position:fixed;top:10px;left:10px;z-index:999999;background:rgba(0,0,0,0.92);color:#0f0;padding:12px;border-radius:8px;font:10px/1.4 monospace;max-width:700px;max-height:80vh;overflow:auto;pointer-events:auto;';
            div.innerHTML = '<div style="font-weight:bold;margin-bottom:6px;color:#fff;">🔍 诊断</div><pre style="margin:0;">' + txt.replace(/</g,'&lt;') + '</pre><div style="margin-top:6px;display:flex;gap:6px;"><button id="lt-dbg-copy" style="padding:2px 12px;cursor:pointer;">📋 复制</button><button id="lt-dbg-close" style="padding:2px 12px;cursor:pointer;">关闭</button></div>';
            document.body.appendChild(div);
            document.getElementById('lt-dbg-copy').onclick = function(){
                navigator.clipboard.writeText(txt).then(function(){ document.getElementById('lt-dbg-copy').textContent = '✅ 已复制'; });
            };
            document.getElementById('lt-dbg-close').onclick = function(){ div.remove(); };
        } catch(e){ alert(e.message); }
    });
})();
