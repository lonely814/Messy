// ==UserScript==
// @name         InfiniteCanvas Turbo
// @namespace    https://github.com/hero8152/Infinite-Canvas
// @version      11.1
// @icon         https://github.com/lonely814/Messy/blob/main/InfiniteCanvas%20Turbo/icon.png
// @description  FPS+节点统计 · 菜单开关 · G网格 T性能 H隐藏图 L连线 O列表 C链高亮 F搜索 X专注 · 主题 · 圆角 · DOM虚拟化
// @author       oocc00
// @license      MIT
// @match        *://*/static/canvas.html*
// @match        *://*/static/smart-canvas.html*
// @match        *://*/canvas.html*
// @match        *://*/canvas*
// @exclude      *://*.iblib.tv/canvas*
// @exclude      *://*.liblib.tv/canvas*
// @run-at       document-idle
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @downloadURL https://update.greasyfork.org/scripts/586722/InfiniteCanvas%20Turbo.user.js
// @updateURL https://update.greasyfork.org/scripts/586722/InfiniteCanvas%20Turbo.meta.js
// ==/UserScript==

(function(){
    'use strict';

    /* ———— 智能画布检测 ———— */
    var _pfSmart = location.pathname.indexOf('smart-canvas') !== -1;

    /* =========================================================
     *  1. CSS 注入
     * ========================================================= */
    var style = document.createElement('style');
    style.id = 'ict-css';

    var css = [
        /* ———— 可视化自定义（改这里调整颜色/粗细） ———— */
        ':root {',
        '  --pf-link-width: 2.2;          /* 连线粗细 */',
        '  --pf-link-opacity: 0.7;        /* 连线透明度 */',
        '}',

        /* content-visibility 按节点类型 */
        '.image-node',
        '  { content-visibility: auto; contain-intrinsic-size: auto 260px 336px; }',
        '.node:not(.image-node)',
        '  { content-visibility: visible; }',

        '#world { will-change: transform; }',

        /* 拖拽时隐藏图片 */
        'body.canvas-board-pan .node img, body.canvas-node-drag .node img,',
        'body.canvas-board-pan .node video, body.canvas-node-drag .node video,',
        'body.canvas-board-pan .image-node img, body.canvas-node-drag .image-node img,',
        'body.canvas-board-pan .image-node video, body.canvas-node-drag .image-node video',
        '  { display: none !important; }',

        /* 网格背景开关 — 兼容两种画布 */
        '.board.perf-no-grid, .shell.perf-no-grid { background-image: none !important; }',

        /* 隐藏所有图片（H 键） */
        'body.perf-hide-imgs .node img, body.perf-hide-imgs .node video,',
        'body.perf-hide-imgs .image-node img, body.perf-hide-imgs .image-node video,',
        'body.perf-hide-imgs .media-card',
        '  { display: none !important; }',

        /* 隐藏连线（L 键） — 兼容两种画布 */
        '#links.perf-hide-links, .connection-layer.perf-hide-links { display: none !important; }',

        /* ———— 选中节点 ———— */

        /* ———— 输出节点列表模式（O 键切换） ———— */
        'body.perf-output-list .output-grid {',
        '  display: flex !important; flex-direction: column !important;',
        '  gap: 1px !important; grid-template-columns: none !important;',
        '  justify-content: start !important;',
        '}',
        'body.perf-output-list .output-img-wrap {',
        '  max-width: none !important; aspect-ratio: auto !important;',
        '  display: flex !important; flex-direction: row !important;',
        '  align-items: center !important; gap: 8px !important;',
        '  padding: 2px 6px !important; cursor: pointer !important;',
        '}',
        'body.perf-output-list .output-img-wrap img,',
        'body.perf-output-list .output-img-wrap video {',
        '  width: 36px !important; height: 36px !important;',
        '  object-fit: cover !important; border-radius: 4px !important;',
        '  flex: 0 0 auto !important; min-width: 36px !important;',
        '}',
        'body.perf-output-list .output-img-wrap .output-del {',
        '  position: static !important;',
        '  margin: 0 0 0 8px !important;',
        '  opacity: 0.6 !important; flex: 0 0 auto !important;',
        '}',
        'body.perf-output-list .output-img-wrap .output-del:hover {',
        '  opacity: 1 !important;',
        '}',
        'body.perf-output-list .output-img-wrap .canvas-video-play,',
        'body.perf-output-list .output-img-wrap .output-video-badge {',
        '  display: none !important;',
        '}',
        /* 列表模式拖动时保持缩略图可见，防止布局突然紧凑 */
        'body.perf-output-list.canvas-board-pan .output-img-wrap img,',
        'body.perf-output-list.canvas-node-drag .output-img-wrap img,',
        'body.perf-output-list.canvas-board-pan .output-img-wrap video,',
        'body.perf-output-list.canvas-node-drag .output-img-wrap video {',
        '  display: block !important;',
        '}',
        'body.perf-output-list .output-file-card,',
        'body.perf-output-list .output-audio-card {',
        '  flex-direction: row !important; gap: 6px !important;',
        '  padding: 2px 0 !important; border: none !important;',
        '}',
        'body.perf-output-list .output-audio-card audio {',
        '  display: none !important;',
        '}',
        '.pf-label {',
        '  font: 11px/1.4 -apple-system, sans-serif;',
        '  color: var(--text, #333);',
        '  overflow: hidden; text-overflow: ellipsis;',
        '  white-space: nowrap; min-width: 0; flex: 1;',
        '}',
        '.theme-dark .pf-label { color: var(--text, #ccc); }',

        /* ———— 连线样式 ———— */
        '.link {',
        '  stroke: var(--faint) !important;',
        '  stroke-width: 2.2 !important;',
        '  opacity: 0.7 !important;',
        '  stroke-linecap: round !important;',
        '  stroke-linejoin: round !important;',
        '}',
        '.link.link-active {',
        '  stroke: var(--strong) !important;',
        '  opacity: 1 !important;',
        '}',
        '.theme-dark .link.link-active {',
        '  filter: drop-shadow(0 0 6px rgba(96,165,250,0.25));',
        '}',

        /* ———— 性能模式 ———— */
        'body.perf-mode .node, body.perf-mode .image-node {',
        '  box-shadow: none !important; border-radius: 0 !important;',
        '  opacity: 0.85; contain: content !important;',
        '  will-change: auto !important; isolation: auto !important;',
        '  mix-blend-mode: normal !important;',
        '  border-color: rgba(255,255,255,0.06) !important;',
        '}',
        'body.perf-mode .node:hover, body.perf-mode .image-node:hover { opacity: 1; }',
        'body.perf-mode .node.selected, body.perf-mode .image-node.selected { opacity: 1; }',
        'body.perf-mode .node::before { display: none !important; }',
        'body.perf-mode .panel,',
        'body.perf-mode .library,',
        'body.perf-mode .log-panel,',
        'body.perf-mode .prompt-template-panel,',
        'body.perf-mode .canvas-asset-panel,',
        'body.perf-mode .workflow-transfer-panel',
        '  { box-shadow: none !important;',
        '    backdrop-filter: none !important;',
        '    background: var(--card-solid) !important;',
        '    border-radius: 0 !important; resize: none !important; }',
        'body.perf-mode .topbar .panel { background: var(--card-solid) !important; }',
        'body.perf-mode .node-run-status.running .dot { animation: none !important; }',
        'body.perf-mode * { backdrop-filter: none !important; animation: none !important; transition: none !important; filter: none !important; cursor: default !important; }',
        'body.perf-mode .minimap, body.perf-mode .smart-minimap { box-shadow: none !important; }',
        'body.perf-mode .node-head { border-bottom-color: var(--line-2) !important; }',
        'body.perf-mode ::-webkit-scrollbar { width: 4px !important; height: 4px !important; }',
        'body.perf-mode ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1) !important; }',
        'body.perf-mode * { scrollbar-width: thin !important; scrollbar-color: rgba(255,255,255,0.1) transparent !important; }',

        /* LOD */
        '.world.zoom-lod-1 .node img, .world.zoom-lod-1 .node video,',
        '.world.zoom-lod-1 .image-node img, .world.zoom-lod-1 .image-node video',
        '  { filter: blur(5px); opacity: 0.25; }',
        '.world.zoom-lod-1 .node .image-caption,',
        '.world.zoom-lod-1 .node .node-run-status { display: none !important; }',
        '.world.zoom-lod-2 .node img, .world.zoom-lod-2 .node video,',
        '.world.zoom-lod-2 .image-node img, .world.zoom-lod-2 .image-node video,',
        '.world.zoom-lod-2 .media-card { display: none !important; }',
        '.world.zoom-lod-2 .node .node-body, .world.zoom-lod-2 .image-node .node-body',
        '  { min-height: 24px !important; padding: 3px 6px !important; }',
        '.world.zoom-lod-2 .node .image-caption,',
        '.world.zoom-lod-2 .node .node-run-status { display: none !important; }',
        '.world.zoom-lod-3 .node .node-body, .world.zoom-lod-3 .image-node .node-body { display: none !important; }',
        '.world.zoom-lod-3 .node, .world.zoom-lod-3 .image-node',
        '  { min-width: 48px !important; min-height: 22px !important;',
        '    border-radius: 5px !important; }',
        '.world.zoom-lod-3 .node-head',
        '  { height: 22px !important; flex-basis: 22px !important;',
        '    border-radius: 4px 4px 0 0 !important; padding: 0 4px !important; }',
        '.world.zoom-lod-3 .node-title { font-size: 5px !important; }',
        '.world.zoom-lod-3 .node-head button { display: none !important; }',
        '.world.zoom-lod-3 .links path, .world.zoom-lod-3 .links line,',
        '.world.zoom-lod-3 .connection-layer path',
        '  { stroke-width: 0.3 !important; opacity: 0.1 !important; }',

        '.node:not(.selected) img, .image-node:not(.selected) img { fetchpriority: low; }',

        /* FPS 药丸 — 紧凑悬浮药丸 (与 libtv-boost 同步) */
        '#perf-fps {',
        '  position: fixed; left: 14px; bottom: 14px; z-index: 99999;',
        '  padding: 5px 12px 5px 10px; border-radius: 20px;',
        '  background: rgba(0,0,0,0.4); color: #aaa;',
        '  font: 12px/1.5 -apple-system, "SF Mono", monospace;',
        '  user-select: none;',
        '  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);',
        '  border: 1px solid rgba(255,255,255,0.05);',
        '  white-space: nowrap;',
        '  display: inline-flex; align-items: center; gap: 4px;',
        '  cursor: grab;',
        '  transition: all 0.2s ease;',
        '}',
        '#perf-fps:hover {',
        '  background: rgba(0,0,0,0.55);',
        '  border-color: rgba(255,255,255,0.1);',
        '  padding: 5px 12px 5px 10px;',
        '}',
        '#perf-fps:active { cursor: grabbing; }',
        '#perf-fps .pf-fps-val { color: #8f8; font-weight: 600; }',
        '#perf-fps .pf-mem   { color: #7fc; }',
        '#perf-fps .pf-lod   { color: #88f; }',
        '#perf-fps .pf-flag  { color: #fa0; }',
        '#perf-fps .pf-sep   { color: rgba(255,255,255,0.12); }',
        '#perf-fps .pf-nodes { color: #aaa; }',
        '#perf-fps .pf-cnt   { color: #aaa; }',

        /* 快捷键提示 — 底部居中，无背景无边框 */
        '#perf-help {',
        '  position:fixed; left:50%; bottom:12px; z-index:99998;',
        '  transform:translateX(-50%);',
        '  color:rgba(255,255,255,0.3);',
        '  font:10px/1.7 -apple-system,"SF Mono",monospace;',
        '  pointer-events:none; user-select:none;',
        '  white-space:nowrap; letter-spacing:0.04em;',
        '  transition:opacity .3s;',
        '}',
        '#perf-help.pf-hide { opacity:0; }',

        /* ———— 链高亮模式 ———— */
        'body.pf-chain #nodes .node { opacity:0.06 !important; }',
        'body.pf-chain #nodes .node.selected,',
        'body.pf-chain #nodes .node.pf-chain-node',
        '  { opacity:1 !important; }',
        'body.pf-chain #links .link, body.pf-chain .connection-layer path { opacity:0.03 !important; }',
        'body.pf-chain #links .link.pf-chain-edge',
        '  { opacity:0.8 !important; stroke:var(--strong,#818cf8) !important; }',

        /* ———— 专注模式 ———— */
        'body.pf-focus .topbar,',
        'body.pf-focus .panel-group,',
        'body.pf-focus .library,',
        'body.pf-focus .canvas-asset-panel,',
        'body.pf-focus .workflow-transfer-panel,',
        'body.pf-focus .log-panel,',
        'body.pf-focus .property-panel,',
        'body.pf-focus .minimap,',
        'body.pf-focus .smart-minimap,',
        'body.pf-focus .smart-back,',
        'body.pf-focus .smart-title,',
        'body.pf-focus #composer',
        '  { display:none !important; }',
        'body.pf-focus #board, body.pf-focus #shell {',
        '  width:100vw !important; height:100vh !important;',
        '  max-width:none !important; left:0 !important; top:0 !important;',
        '}',

        /* ———— 搜索框 ———— */
        '#pf-search {',
        '  position:fixed; top:60px; right:20px; z-index:99999;',
        '  background:rgba(0,0,0,0.9); backdrop-filter:blur(20px);',
        '  -webkit-backdrop-filter:blur(20px);',
        '  border:1px solid rgba(255,255,255,0.08);',
        '  border-radius:10px; padding:10px; width:280px;',
        '  max-height:60vh; overflow:auto;',
        '  font:12px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
        '}',

        /* ———— DOM 虚拟化 — 含 150% 边距，拖动时自动全显 ———— */
        '.node.pf-vhide, .node.pf-vhide-force, .image-node.pf-vhide, .image-node.pf-vhide-force { display:none !important; }',
        '.node.pf-vhide img, .node.pf-vhide-force img, .image-node.pf-vhide img, .image-node.pf-vhide-force img { display:none !important; }',

        /* board 背景由应用自身 --page 变量处理 */


    ];
    style.textContent = css.join('\n');
    document.head.appendChild(style);

    /* =========================================================
     *  2. FPS + 内存 + 节点统计 显示
     * ========================================================= */
    var fpsEl = document.createElement('div');
    fpsEl.id = 'perf-fps';
    fpsEl.textContent = 'FPS: --';
    document.body.appendChild(fpsEl);

    var helpEl = document.createElement('div');
    helpEl.id = 'perf-help';
    helpEl.textContent = _pfSmart
        ? 'G网格  T性能  H隐藏  L连线  F搜索  X专注  ?帮助'
        : 'G网格  T性能  H隐藏  L连线  O列表  C链高亮  F搜索  X专注  ?帮助';
    document.body.appendChild(helpEl);

    var _frameCnt = 0;
    var _lastFpsT = performance.now();
    var _fps = 0;

    var TYPE_LABELS = {
        image: '图片', video: '视频', prompt: '提示词', llm: 'LLM',
        generator: '生成', msgen: 'MS', comfy: 'Comfy', rh: 'RH',
        ltxDirector: 'LTX', output: '输出', loop: '循环',
        group: '分组', promptGroup: '提示组',
        'prompt-smart-node': '提示词', 'loop-smart-node': '循环',
        'smart-group-node': '分组', 'history-group': '历史分组',
    };

    function fmtNodeTypes(nodesArr){
        if (!nodesArr || !nodesArr.length) return '';
        var map = {};
        for (var i = 0; i < nodesArr.length; i++){
            var t = nodesArr[i].type || '?';
            map[t] = (map[t] || 0) + 1;
        }
        var parts = [];
        var order = ['image','video','prompt','llm','generator','msgen','comfy','rh','ltxDirector','output','loop','group','promptGroup','prompt-smart-node','loop-smart-node','smart-group-node','history-group'];
        for (var o = 0; o < order.length; o++){
            if (map[order[o]]) parts.push(TYPE_LABELS[order[o]] + map[order[o]]);
        }
        for (var k in map){
            if (order.indexOf(k) === -1) parts.push(k+':'+map[k]);
        }
        return parts.join(' ');
    }

    function fmtMem(){
        try {
            var m = performance.memory;
            if (m && m.usedJSHeapSize) return Math.round(m.usedJSHeapSize / 1048576) + 'MB';
        } catch(e){}
        return '';
    }

    function fpsLoop(now){
        _frameCnt++;
        if (now - _lastFpsT >= 1000){
            _fps = Math.round(_frameCnt * 1000 / (now - _lastFpsT));
            var nodeArr = typeof nodes !== 'undefined' ? nodes : [];
            var nTotal = nodeArr.length;
            var types = fmtNodeTypes(nodeArr);
            var mem = fmtMem();

            var lod = '';
            var w = document.getElementById('world');
            if (w){
                if (w.classList.contains('zoom-lod-3')) lod = 'L3';
                else if (w.classList.contains('zoom-lod-2')) lod = 'L2';
                else if (w.classList.contains('zoom-lod-1')) lod = 'L1';
            }

            var flags = '';
            var b = document.getElementById('board') || document.getElementById('shell');
            if (b && b.classList.contains('perf-no-grid')) flags += '<span class="pf-flag">■</span>';
            if (document.body.classList.contains('perf-mode')) flags += '<span class="pf-flag">◆</span>';
            if (document.body.classList.contains('perf-hide-imgs')) flags += '<span class="pf-flag">⊙</span>';
            if (document.body.classList.contains('perf-output-list')) flags += '<span class="pf-flag">≡</span>';
            var _lk = document.getElementById('links') || document.querySelector('.connection-layer');
            if (_lk && _lk.classList.contains('perf-hide-links')) flags += '<span class="pf-flag">╳</span>';
            if (document.body.classList.contains('pf-chain')) flags += '<span class="pf-flag">◉</span>';
            if (document.body.classList.contains('pf-autochain')) flags += '<span class="pf-flag">⟷</span>';
            if (document.body.classList.contains('pf-focus')) flags += '<span class="pf-flag">◎</span>';

            fpsEl.innerHTML = '<span class="pf-fps-val">' + _fps + 'fps</span>'
                + (mem ? '<span class="pf-sep">|</span><span class="pf-mem">' + mem + '</span>' : '')
                + (lod ? '<span class="pf-sep">|</span><span class="pf-lod">' + lod + '</span>' : '')
                + '<span class="pf-sep">|</span><span class="pf-cnt">' + nTotal + '节点</span>'
                + (types ? '<span class="pf-sep">|</span><span class="pf-nodes">' + types + '</span>' : '')
                + (flags ? '<span class="pf-sep">|</span>' + flags : '');
            _frameCnt = 0;
            _lastFpsT = now;
        }
        requestAnimationFrame(fpsLoop);
    }
    requestAnimationFrame(fpsLoop);

    /* =========================================================
     *  3. 删除节点时清理图片内存
     * ========================================================= */
    function clearNodeImages(el){
        if (!el || el.nodeType !== 1) return;
        if (el.tagName === 'IMG') { el.src = ''; return; }
        var imgs = el.querySelectorAll ? el.querySelectorAll('img') : [];
        for (var i = 0; i < imgs.length; i++) imgs[i].src = '';
    }

    var _pfNodeSel = _pfSmart ? '.image-node' : '.node';
    var _pfContainerSel = _pfSmart ? '#world' : '#nodes';
    var _clearObs = new MutationObserver(function(records){
        for (var r = 0; r < records.length; r++){
            var removed = records[r].removedNodes;
            for (var n = 0; n < removed.length; n++){
                if (removed[n].nodeType === 1){
                    if (removed[n].matches && removed[n].matches(_pfNodeSel)) clearNodeImages(removed[n]);
                    else if (removed[n].querySelectorAll){
                        var nodes = removed[n].querySelectorAll(_pfNodeSel);
                        for (var i = 0; i < nodes.length; i++) clearNodeImages(nodes[i]);
                    }
                }
            }
        }
    });

    var _initNodes = setInterval(function(){
        var el = document.getElementById(_pfSmart ? 'world' : 'nodes');
        if (el){
            clearInterval(_initNodes);
            _clearObs.observe(el, { childList: true, subtree: true });
        }
    }, 100);

    /* =========================================================
     *  4. LOD
     * ========================================================= */
    var _lastScale = 1;

    function updateLOD(s){
        if (_pfSmart) return;
        var w = document.getElementById('world');
        if (!w) return;
        var add = s < 0.12 ? 'zoom-lod-3' : s < 0.25 ? 'zoom-lod-2' : s < 0.45 ? 'zoom-lod-1' : '';
        var L = ['zoom-lod-1','zoom-lod-2','zoom-lod-3'];
        var cur = w.className, need = false;
        for (var i = 0; i < 3; i++){
            if ((add === L[i]) !== (cur.indexOf(L[i]) !== -1)){ need = true; break; }
        }
        if (!need) return;
        w.classList.remove.apply(w.classList, L);
        if (add) w.classList.add(add);
    }

    var _world = document.getElementById('world');
    if (_world){
        new MutationObserver(function(){
            var s = 1, m = (_world.style.transform || '').match(/scale\(([^)]+)\)/);
            if (m) s = parseFloat(m[1]);
            if (Math.abs(s - _lastScale) < 0.005) return;
            _lastScale = s;
            updateLOD(s);
        }).observe(_world, { attributes: true, attributeFilter: ['style'] });
    }

    /* =========================================================
     *  5. 图片后优化
     * ========================================================= */
    var _pfImgNodeSel = _pfSmart ? '.image-node img:not([data-pfO])' : '.node img:not([data-pfO])';
    function optimizeImages(){
        var c = document.getElementById(_pfSmart ? 'world' : 'nodes');
        if (!c) return;
        var list = c.querySelectorAll(_pfImgNodeSel);
        for (var i = 0; i < list.length; i++){
            list[i].setAttribute('loading', 'lazy');
            list[i].setAttribute('decoding', 'async');
            list[i].setAttribute('fetchpriority', 'low');
            list[i].dataset.pfO = '1';
        }
    }

    var nodesEl = document.getElementById(_pfSmart ? 'world' : 'nodes');
    if (nodesEl){
        new MutationObserver(function(){
            optimizeImages();
        }).observe(nodesEl, { childList: true, subtree: true });
    }

    /* =========================================================
     *  6. <script> 注入 — 钩子 + 快捷键
     *     G: 网格  T: 性能模式
     * ========================================================= */
    var hook = document.createElement('script');
    hook.textContent = [
        '(function(){',
        '  var _pfS=location.pathname.indexOf("smart-canvas")!==-1;',
        '  if(!_pfS && typeof applyViewport==="undefined") return;',

        /* selectors */
        '  var _pfNS=_pfS?"#world .image-node":"#nodes .node",',
        '      _pfVS=_pfS?".image-node":"#nodes .node",',
        '      _pfVSel=_pfS?".image-node.pf-vhide":".node.pf-vhide",',
        '      _pfGS=_pfS?"#shell":"#board",',
        '      _pfLS=_pfS?".connection-layer":"#links";',

        /* LOD（智能画布跳过） */
        '  var _upd=function(){ if(_pfS)return;',
        '    var _w=document.getElementById("world"); if(!_w)return;',
        '    var _s=1,_m=(_w.style.transform||"").match(/scale\\(([^)]+)\\)/);',
        '    if(_m)_s=parseFloat(_m[1]);',
        '    var _a=_s<0.12?"zoom-lod-3":_s<0.25?"zoom-lod-2":_s<0.45?"zoom-lod-1":"";',
        '    _w.classList.remove("zoom-lod-1","zoom-lod-2","zoom-lod-3");',
        '    if(_a)_w.classList.add(_a);',
        '  };',

        /* 图片优化 */
        '  var _opt=function(){ if(_pfS)return;',
        '    var _c=document.getElementById("nodes"); if(!_c)return;',
        '    var _im=_c.querySelectorAll(".node img:not([data-pfO])");',
        '    for(var _i=0;_i<_im.length;_i++){',
        '      _im[_i].setAttribute("loading","lazy");',
        '      _im[_i].setAttribute("decoding","async");',
        '      _im[_i].setAttribute("fetchpriority","low");',
        '      _im[_i].dataset.pfO="1";',
        '    }',
        '  };',

        /* ———— DOM 虚拟化 ———— */
        '  var _pfVTO=null,_pfVRaf=null;',
        '  function _pfVRun(force){',
        '    if(document.body.classList.contains("canvas-node-drag")||document.body.classList.contains("canvas-board-pan")){',
        '      document.querySelectorAll(_pfVSel).forEach(function(n){n.classList.remove("pf-vhide");});',
        '      return;',
        '    }',
        '    var _w=document.getElementById("world"); if(!_w)return;',
        '    var s=1,tx=0,ty=0,m;',
        '    m=(_w.style.transform||"").match(/translate\\(([^,]+),([^)]+)\\)/); if(m){tx=parseFloat(m[1]);ty=parseFloat(m[2]);}',
        '    m=(_w.style.transform||"").match(/scale\\(([^)]+)\\)/); if(m)s=parseFloat(m[1]);',
        '    var vw=window.innerWidth,vh=window.innerHeight,mg=_pfS?(force?0.5:3):(force?0.5:1.5);',
        '    var cx=(-tx+vw/2)/s,cy=(-ty+vh/2)/s,hw=(vw/s/2)*mg,hh=(vh/s/2)*mg;',
        '    document.querySelectorAll(_pfVS).forEach(function(n){',
        '      if(n.classList.contains("selected"))return;',
        '      var x=parseFloat(n.style.left)||0,y=parseFloat(n.style.top)||0;',
        '      var on=x>=cx-hw&&x<=cx+hw&&y>=cy-hh&&y<=cy+hh;',
        '      n.classList.toggle("pf-vhide",!on);',
        '    });',
        '  }',
        '  function _pfV(force){',
        '    if(_pfVRaf){cancelAnimationFrame(_pfVRaf);_pfVRaf=null;}',
        '    _pfVRaf=requestAnimationFrame(function(){_pfVRaf=null;_pfVRun(force);});',
        '  }',
        '  document.addEventListener("mouseup",function(){if(_pfVTO)clearTimeout(_pfVTO);_pfVTO=setTimeout(function(){_pfV(false);},50);});',

        /* hook */
        '  if(typeof applyViewport==="function"){',
        '    var _a=applyViewport; applyViewport=function(){ _a.apply(this,arguments); _upd(); _pfV(false); };',
        '  }',
        '  if(typeof render==="function"){',
        '    var _r=render; render=function(){ _r.apply(this,arguments); _upd(); _pfV(false); };',
        '  }',
        '  if(!_pfS && typeof refreshNodes==="function"){',
        '    var _rf=refreshNodes; refreshNodes=function(){ _rf.apply(this,arguments); _upd(); _opt(); _pfV(false); };',
        '  }',
        '  if(!_pfS && typeof renderLinks==="function"){',
        '    var _rl=renderLinks; renderLinks=function(){',
        '      document.querySelectorAll(_pfVSel).forEach(function(n){n.classList.remove("pf-vhide");});',
        '      _rl.apply(this,arguments); _pfVRun(false);',
        '    };',
        '  }',
        /* smart canvas: hook refreshConnectionLayer */
        '  if(_pfS && typeof refreshConnectionLayer==="function"){',
        '    var _rcl=refreshConnectionLayer; refreshConnectionLayer=function(){',
        '      document.querySelectorAll(_pfVSel).forEach(function(n){n.classList.remove("pf-vhide");});',
        '      _rcl.apply(this,arguments); _pfVRun(false);',
        '    };',
        '  }',

        /* ———— 链高亮引擎 ———— */
        '  function _pfClearChain(){',
        '    document.body.classList.remove("pf-chain");',
        '    document.querySelectorAll(".pf-chain-node,.pf-chain-edge").forEach(function(e){',
        '      e.classList.remove("pf-chain-node","pf-chain-edge");',
        '    });',
        '  };',
        '  if(!_pfS){',
        '  var _pfAutoChain=localStorage.getItem("_pf_autochain")==="1";',
        '  if(_pfAutoChain) document.body.classList.add("pf-autochain");',
        '  var _pfGraphCache=null;',
        '  function _pfGetGraph(){',
        '    if(!_pfGraphCache){',
        '      var up={},down={},conns=typeof connections!="undefined"?connections:[];',
        '      conns.forEach(function(c){',
        '        var fr=c.from,to=c.to;',
        '        if(!fr||!to)return;',
        '        if(!down[fr])down[fr]=[]; down[fr].push(to);',
        '        if(!up[to])up[to]=[]; up[to].push(fr);',
        '      });',
        '      _pfGraphCache={up:up,down:down};',
        '    }',
        '    return _pfGraphCache;',
        '  }',
        '  function _pfInvalidateGraph(){_pfGraphCache=null;}',
        '  document.addEventListener("click",function(e){',
        '    if(!_pfAutoChain) return;',
        '    if(!e.target.closest(_pfNS)){',
        '      _pfClearChain(); return;',
        '    }',
        '    setTimeout(function(){',
        '      var sel=document.querySelector(_pfNS+".selected");',
        '      if(sel){',
        '        var g=_pfGetGraph(),sid=sel.getAttribute("data-id")||"";',
        '        if(!sid||!g)return;',
        '        var v={},q=[sid]; v[sid]=1;',
        '        while(q.length){',
        '          var c=q.shift();',
        '          (g.up[c]||[]).forEach(function(n){if(!v[n]){v[n]=1;q.push(n);}});',
        '          (g.down[c]||[]).forEach(function(n){if(!v[n]){v[n]=1;q.push(n);}});',
        '        }',
        '        document.querySelectorAll(_pfNS).forEach(function(n){',
        '          n.classList[(v[n.getAttribute("data-id")||""])?"add":"remove"]("pf-chain-node");',
        '        });',
        '        var conns=typeof connections!="undefined"?connections:[];',
        '        document.querySelectorAll("#links > .link-hit").forEach(function(h){',
        '          var cid=h.getAttribute("data-connection-id")||"",on=false;',
        '          for(var _i=0;_i<conns.length;_i++){',
        '            if(conns[_i].id===cid){on=v[conns[_i].from]&&v[conns[_i].to];break;}',
        '          }',
        '          h.classList.toggle("pf-chain-edge",on);',
        '          var p=h.previousElementSibling;',
        '          if(p&&p.classList.contains("link"))p.classList.toggle("pf-chain-edge",on);',
        '        });',
        '        document.body.classList.add("pf-chain");',
        '      }',
        '    }, 50);',
        '  }, true);',
        '  }',
        '  function _pfSearch(){',
        '    var overlay=document.getElementById("pf-search");',
        '    if(overlay){ overlay.remove(); return; }',
        '    var items=[];',
        '    document.querySelectorAll(_pfNS).forEach(function(n){',
        '      var id=n.getAttribute("data-id")||"";',
        '      if(!id)return;',
        '      var txt=(n.textContent||"").trim().split("\\n")[0].trim().slice(0,50);',
        '      items.push({id:id,name:txt||id,el:n});',
        '    });',
        '    var div=document.createElement("div");',
        '    div.id="pf-search";',
        '    div.innerHTML="<input id=\\\"pf-search-input\\\" placeholder=\\\"搜索节点...\\\" style=\\\"width:100%;box-sizing:border-box;padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font:12px/1.5 sans-serif;outline:none;\\\"><div id=\\\"pf-search-results\\\" style=\\\"margin-top:6px;\\\"></div>";',
        '    document.body.appendChild(div);',
        '    function _pfRender(q){',
        '      var q=(q||"").toLowerCase(),html="";',
        '      items.forEach(function(it){',
        '        if(!q||it.name.toLowerCase().indexOf(q)>=0||it.id.toLowerCase().indexOf(q)>=0){',
        '          html+="<div data-id=\\\""+it.id+"\\\" style=\\\"padding:4px 8px;border-radius:4px;cursor:pointer;color:#ccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\\">"+it.name.replace(/</g,"&lt;")+"</div>";',
        '        }',
        '      });',
        '      document.getElementById("pf-search-results").innerHTML=html;',
        '    }',
        '    _pfRender("");',
        '    document.getElementById("pf-search-input").addEventListener("input",function(){',
        '      _pfRender(this.value);',
        '    });',
        '    document.getElementById("pf-search-results").addEventListener("click",function(e){',
        '      var item=e.target.closest("[data-id]");',
        '      if(!item)return;',
        '      var id=item.getAttribute("data-id");',
        '      var el=document.querySelector(_pfNS+"[data-id=\\""+id+"\\"]");',
        '      if(el){',
        '        el.scrollIntoView({behavior:"smooth",block:"center"});',
        '        el.click();',
        '      }',
        '      div.remove();',
        '    });',
        '    document.getElementById("pf-search-input").focus();',
        '  }',

        /* (theme removed) */

        /* ———— 快捷键 ———— */
        '  document.addEventListener("keydown",function(e){',
        '    if(e.ctrlKey||e.metaKey||e.altKey)return;',
        '    var t=e.target||document.activeElement;',
        '    if(t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.isContentEditable))return;',

        /* G: 网格 */
        '    if(e.key==="g"||e.key==="G"){',
        '      e.preventDefault();',
        '      var b=document.querySelector(_pfGS);',
        '      if(b) b.classList.toggle("perf-no-grid");',
        '      try{localStorage.setItem("_pf_grid",b.classList.contains("perf-no-grid")?"1":"0");}catch(ex){}',
        '      return;',
        '    }',

        /* T: 性能模式 */
        '    if(e.key==="t"||e.key==="T"){',
        '      e.preventDefault();',
        '      document.body.classList.toggle("perf-mode");',
        '      try{localStorage.setItem("_pf_perf",document.body.classList.contains("perf-mode")?"1":"0");}catch(ex){}',
        '      return;',
        '    }',

        /* H: 隐藏图片 */
        '    if(e.key==="h"||e.key==="H"){',
        '      e.preventDefault();',
        '      document.body.classList.toggle("perf-hide-imgs");',
        '      try{localStorage.setItem("_pf_hide",document.body.classList.contains("perf-hide-imgs")?"1":"0");}catch(ex){}',
        '      return;',
        '    }',

        /* L: 连线开关 */
        '    if(e.key==="l"||e.key==="L"){',
        '      e.preventDefault();',
        '      var _lk=document.querySelector(_pfLS);',
        '      if(_lk) _lk.classList.toggle("perf-hide-links");',
        '      try{localStorage.setItem("_pf_links",_lk.classList.contains("perf-hide-links")?"1":"0");}catch(ex){}',
        '      return;',
        '    }',

        /* O: 输出节点列表模式（经典画布专用） */
        '    if(!_pfS && (e.key==="o"||e.key==="O")){',
        '      e.preventDefault();',
        '      var _on=document.body.classList.toggle("perf-output-list");',
        '      _pfLabel(_on);',
        '      try{localStorage.setItem("_pf_list",_on?"1":"0");}catch(ex){}',
        '      return;',
        '    }',

        /* C: 自动全链路模式（经典画布专用） */
        '    if(!_pfS && (e.key==="c"||e.key==="C")){',
        '      e.preventDefault();',
        '      _pfAutoChain=!_pfAutoChain;',
        '      document.body.classList.toggle("pf-autochain",_pfAutoChain);',
        '      try{localStorage.setItem("_pf_autochain",_pfAutoChain?"1":"0");}catch(ex){}',
        '      if(!_pfAutoChain) _pfClearChain();',
        '      return;',
        '    }',

        /* F: 搜索 */
        '    if(e.key==="f"||e.key==="F"){',
        '      e.preventDefault();',
        '      _pfSearch();',
        '      return;',
        '    }',

        /* X: 专注模式 */
        '    if(e.key==="x"||e.key==="X"){',
        '      e.preventDefault();',
        '      document.body.classList.toggle("pf-focus");',
        '      try{localStorage.setItem("_pf_focus",document.body.classList.contains("pf-focus")?"1":"0");}catch(ex){}',
        '      return;',
        '    }',

        /* ?: 帮助面板 */
        '    if(e.key==="?"||e.key==="/"){',
        '      e.preventDefault();',
        '      var _h=document.getElementById("perf-help");',
        '      if(_h) _h.classList.toggle("pf-hide");',
        '      return;',
        '    }',
        '  });',

        /* list 文件名管理（经典画布专用） */
        '  if(!_pfS){',
        '  function _pfName(u){',
        '    var c=(u||"").split("?")[0];',
        '    var n=c.split("/").filter(Boolean).pop();',
        '    return n?decodeURIComponent(n):"output";',
        '  }',
        '  function _pfLabel(on){',
        '    var ws=document.querySelectorAll(".output-img-wrap");',
        '    for(var i=0;i<ws.length;i++){',
        '      var w=ws[i];',
        '      if(on){',
        '        if(!w.querySelector(".pf-label")){',
        '          var l=document.createElement("span");',
        '          l.className="pf-label";',
        '          l.textContent=_pfName(w.getAttribute("data-output-url")||"");',
        '          var _del=w.querySelector(".output-del");',
        '          if(_del) w.insertBefore(l, _del); else w.appendChild(l);',
        '        }',
        '      }else{',
        '        var l=w.querySelector(".pf-label");',
        '        if(l)l.remove();',
        '      }',
        '    }',
        '  }',
        '  new MutationObserver(function(){',
        '    if(document.body.classList.contains("perf-output-list")){',
        '      var ws=document.querySelectorAll(".output-img-wrap:not(:has(.pf-label))");',
        '      for(var i=0;i<ws.length;i++){',
        '        var w=ws[i];',
        '        var l=document.createElement("span");',
        '        l.className="pf-label";',
        '        l.textContent=_pfName(w.getAttribute("data-output-url")||"");',
        '        var _del=w.querySelector(".output-del");',
        '        if(_del) w.insertBefore(l, _del); else w.appendChild(l);',
        '      }',
        '    }',
        '  }).observe(document.getElementById("nodes")||document.body,{childList:true,subtree:true});',
        '  new MutationObserver(function(){',
        '    _pfLabel(document.body.classList.contains("perf-output-list"));',
        '  }).observe(document.body,{attributes:true,attributeFilter:["class"]});',
        '  }',

        '  _pfV(false); setTimeout(function(){ _upd(); _opt(); _pfV(false); }, 300);',
        '  window.addEventListener("resize",function(){ _pfV(false); });',
        '  console.log("[InfiniteCanvas Turbo] G网格 T性能 H隐藏 L连线 O列表 C链高亮 F搜索 X专注 ?帮助 · DOM虚拟化 v2 · 圆角");',
        '})();'
    ].join('\n');
    document.body.appendChild(hook);

    /* =========================================================
     *  7. 油猴菜单开关 + 状态持久化
     * ========================================================= */
    var _pfToggleFns = {
        perf: function(v){ document.body.classList.toggle('perf-mode', v); },
        list: function(v){ if(!_pfSmart) document.body.classList.toggle('perf-output-list', v); },
        hide: function(v){ document.body.classList.toggle('perf-hide-imgs', v); },
        grid: function(v){
            var b = document.getElementById('board') || document.getElementById('shell');
            if(b) b.classList.toggle('perf-no-grid', v);
        },
        links: function(v){
            var lk = document.getElementById('links') || document.querySelector('.connection-layer');
            if(lk) lk.classList.toggle('perf-hide-links', v);
        },
        focus: function(v){ document.body.classList.toggle('pf-focus', v); },
    };

    function _pfRead(){
        var s = {};
        for(var k in _pfToggleFns)
            s[k] = localStorage.getItem('_pf_'+k) === '1';
        return s;
    }

    function _pfApply(){
        var s = _pfRead();
        for(var k in _pfToggleFns)
            if(_pfToggleFns.hasOwnProperty(k)) _pfToggleFns[k](s[k]);
    }

    function _pfClick(key){
        var v = localStorage.getItem('_pf_'+key) !== '1';
        localStorage.setItem('_pf_'+key, v ? '1' : '0');
        _pfToggleFns[key](v);
    }

    // 等待 body/list 就绪后还原状态
    setTimeout(_pfApply, 500);

    GM_registerMenuCommand('⏱ 性能模式', function(){ _pfClick('perf'); });
    GM_registerMenuCommand('≡ 输出列表', function(){ _pfClick('list'); });
    GM_registerMenuCommand('⊙ 隐藏图片', function(){ _pfClick('hide'); });
    GM_registerMenuCommand('╳ 隐藏连线', function(){ _pfClick('links'); });
    GM_registerMenuCommand('▦ 隐藏网格', function(){ _pfClick('grid'); });
    GM_registerMenuCommand('◎ 专注模式', function(){ _pfClick('focus'); });
    // (theme menu removed)
})();
