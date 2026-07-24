// ==UserScript==
// @name         LibTV Canvas Boost
// @version      1.10.1
// @icon         https://raw.githubusercontent.com/lonely814/Messy/refs/heads/main/libtv-boost/libtv-boost-icon.png
// @license      MIT
// @author       oocc00
// @description  性能优化 · G网格 T性能 H隐藏 L连线 C全链 F搜索 P提示词 X专注 R直角 ?帮助 · AI增强 · 标签 · 提示词模板 · 模板变量 · 主题(画布配色DIY)
// @match        *://*.iblib.tv/canvas*
// @match        *://*.liblib.tv/canvas*
// @match        https://www.liblib.tv/*
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
    style.textContent = [__INJECT_CSS__].join('\n');
    document.head.appendChild(style);

    /* =========================================================
     *  2. FPS 面板
     * ========================================================= */
    var fpsEl = document.createElement('div');
    fpsEl.id = 'libtv-fps';
    fpsEl.innerHTML = '<span class="fps-val">--fps</span><span class="fps-sep">|</span><span class="fps-zoom">100%</span><span class="fps-sep">|</span><span class="fps-cnt">-节点</span><span class="fps-sep fps-flag-sep">|</span><span class="fps-flags"></span>';
    var fpsVal = fpsEl.querySelector('.fps-val');
    var fpsZoom = fpsEl.querySelector('.fps-zoom');
    var fpsCnt = fpsEl.querySelector('.fps-cnt');
    var fpsFlags = fpsEl.querySelector('.fps-flags');
    var fpsFlagSep = fpsEl.querySelector('.fps-flag-sep');
    document.body.appendChild(fpsEl);

    var helpEl = document.createElement('div');
    helpEl.id = 'libtv-help';
    helpEl.classList.add('libtv-hide');
    helpEl.textContent = '画布\n  G 网格   T 性能   H 隐藏   L 连线\n  C 全链   R 直角   X 专注\n工具\n  F 搜索   P 提示词   N 清爽   ? 帮助';
    document.body.appendChild(helpEl);
    function _showHelp(){ if(helpEl) helpEl.classList.remove('libtv-hide'); }
    function _hideHelp(){ if(helpEl && !helpEl.classList.contains('libtv-pin')) helpEl.classList.add('libtv-hide'); }
    if(fpsEl){ fpsEl.addEventListener('mouseenter', _showHelp); fpsEl.addEventListener('mouseleave', _hideHelp); }

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
        if (document.hidden) { _lastT = now; requestAnimationFrame(fpsLoop); return; }
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
            if (document.body.classList.contains('libtv-clean-home')) flags += '<span class="fps-flag">♡</span>';            
            var nTotal = document.querySelectorAll('.react-flow__node').length;

            // 缩放级别
            var vp = document.querySelector('.react-flow__viewport');
            if(vp){
                var m = (vp.style.transform || '').match(/scale\(([^)]+)\)/);
                if(m) zoom = Math.round(parseFloat(m[1]) * 100) + '%';
            }

            fpsVal.textContent = _fps + 'fps';
            fpsZoom.textContent = zoom || '';
            fpsZoom.style.display = zoom ? '' : 'none';
            fpsCnt.textContent = nTotal + '节点';
            fpsFlags.innerHTML = flags;
            fpsFlagSep.style.display = flags ? '' : 'none';
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
    var hook;
    try {
        hook = document.createElement('script');
        hook.textContent = [__INJECT_SCRIPT__].join('\n');
    document.body.appendChild(hook);
} catch(e) {
    console.error('[LibTV] Hook error:', e);
    if (typeof alert !== 'undefined') alert('LibTV hook error: ' + e.message);
}

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
            try{ s[k] = localStorage.getItem('_lt_'+k) === '1'; }catch(e){}
        return s;
    }
    function _apply(){
        var s = _read();
        for(var k in _toggles) if(_toggles.hasOwnProperty(k)) _toggles[k](s[k]);
    }
    function _click(key){
        var v = true;
        try{ v = localStorage.getItem('_lt_'+key) !== '1'; }catch(e){}
        try{localStorage.setItem('_lt_'+key, v ? '1' : '0');}catch(e){}
        _toggles[key](v);
    }

    setTimeout(_apply, 1000);

    GM_registerMenuCommand('⚙ 设置', function(){
        if(unsafeWindow._ltOpenSettings) unsafeWindow._ltOpenSettings();
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
        } catch(e){ try{_ltToast(e.message);}catch(ex){} }
    });
})();







