// ==UserScript==
// @name         LibTV Canvas Boost
// @version      __VERSION__
// @icon         https://raw.githubusercontent.com/lonely814/Messy/refs/heads/main/libtv-boost/libtv-boost-icon.png
// @license      MIT
// @author       oocc00
// @description  LibTV 画布增强 · 性能优化 · AI 提示词 · 标签 · 模板 · 主题
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
    helpEl.textContent = '画布\n  G 网格   T 性能   H 隐藏   L 连线\n  C 全链   R 直角   X 专注\n工具\n  F 搜索   P 提示词   ? 帮助';
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
        filter.setAttribute('x','-60%');filter.setAttribute('y','-60%');
        filter.setAttribute('width','220%');filter.setAttribute('height','220%');
        var blur=document.createElementNS(svgNS,'feGaussianBlur');
        blur.setAttribute('stdDeviation','6');
        filter.appendChild(blur);
        glowDefs.appendChild(filter);
        overlay.appendChild(glowDefs);

        var animGroup=document.createElementNS(svgNS,'g');
        overlay.appendChild(animGroup);

        /* 元素缓存：每节点一组 rect，帧内只改属性，不重建 DOM */
        var entries=[],lastT=0;

        function readAccent(){
            var n=document.querySelector('.react-flow__node');
            if(!n)return{accent:'#6366f1',accentLight:'#818cf8'};
            var st=getComputedStyle(n);
            return{
                accent:st.getPropertyValue('--accent').trim()||'#6366f1',
                accentLight:st.getPropertyValue('--accent-light').trim()||'#818cf8'
            };
        }

        function geomOf(node){
            var r=node.getBoundingClientRect();
            var w=r.width,h=r.height;
            var cssW=node.offsetWidth||w,cssH=node.offsetHeight||h;
            var zoom=Math.min(cssW?w/cssW:1,cssH?h/cssH:1);
            var cssBr=parseFloat(getComputedStyle(node).borderRadius)||12;
            return{w:w,h:h,zoom:zoom,br:cssBr*zoom};
        }
        function perimOf(g){
            var hw=Math.max(0,g.w-2*g.br),hh=Math.max(0,g.h-2*g.br);
            return 2*hw+2*hh+4*g.br*Math.PI/2;
        }
        function mkRect(g,sw,stroke,dashLen,op){
            var el=document.createElementNS(svgNS,'rect');
            el.setAttribute('x',0);el.setAttribute('y',0);
            el.setAttribute('width',g.w);el.setAttribute('height',g.h);
            el.setAttribute('rx',g.br);el.setAttribute('fill','none');
            el.setAttribute('stroke',stroke);el.setAttribute('stroke-width',sw);
            el.setAttribute('stroke-opacity',op);
            el.setAttribute('stroke-dasharray',dashLen+' '+Math.max(0,g.perim-dashLen));
            return el;
        }
        function buildEntry(node,g,c){
            var wrap=document.createElementNS(svgNS,'g');
            wrap.setAttribute('opacity','0');
            animGroup.appendChild(wrap);
            var perim=g.perim;
            var outer=mkRect(g,7,c.accentLight,Math.round(perim*0.13),0.6);
            outer.setAttribute('filter','url(#glowBlur)');
            var core=mkRect(g,2,'#fff',Math.max(10,Math.round(perim*0.13)),0.95);
            var outer2=mkRect(g,7,c.accentLight,Math.round(perim*0.13),0.6);
            outer2.setAttribute('filter','url(#glowBlur)');
            var core2=mkRect(g,2,'#fff',Math.max(10,Math.round(perim*0.13)),0.95);
            wrap.appendChild(outer);wrap.appendChild(core);
            wrap.appendChild(outer2);wrap.appendChild(core2);
            return{node:node,wrap:wrap,outer:outer,core:core,outer2:outer2,core2:core2,
                   w:g.w,h:g.h,br:g.br,zoom:g.zoom,perim:perim,
                   t0:performance.now(),fade:0,fadeDir:1};
        }
        function rebuildEntry(e,g,c){
            var perim=g.perim;
            e.outer.setAttribute('width',g.w);e.outer.setAttribute('height',g.h);e.outer.setAttribute('rx',g.br);
            e.outer.setAttribute('stroke',c.accentLight);
            e.outer.setAttribute('stroke-dasharray',Math.round(perim*0.13)+' '+Math.max(0,perim-Math.round(perim*0.13)));
            e.core.setAttribute('width',g.w);e.core.setAttribute('height',g.h);e.core.setAttribute('rx',g.br);
            e.core.setAttribute('stroke-dasharray',Math.max(10,Math.round(perim*0.13))+' '+Math.max(0,perim-Math.max(10,Math.round(perim*0.13))));
            e.core2.setAttribute('width',g.w);e.core2.setAttribute('height',g.h);e.core2.setAttribute('rx',g.br);
            e.core2.setAttribute('stroke-dasharray',Math.max(10,Math.round(perim*0.13))+' '+Math.max(0,perim-Math.max(10,Math.round(perim*0.13))));
            e.outer2.setAttribute('width',g.w);e.outer2.setAttribute('height',g.h);e.outer2.setAttribute('rx',g.br);
            e.outer2.setAttribute('stroke',c.accentLight);
            e.outer2.setAttribute('stroke-dasharray',Math.round(perim*0.13)+' '+Math.max(0,perim-Math.round(perim*0.13)));
            e.w=g.w;e.h=g.h;e.br=g.br;e.zoom=g.zoom;e.perim=perim;
        }
        function buildFrame(now){
            var nodes=document.querySelectorAll('.react-flow__node.selected');
            var sel=new Set();
            nodes.forEach(function(n){sel.add(n);});
            var c=readAccent();
            /* 新选中节点：从顶边中点出发，淡入 */
            nodes.forEach(function(node){
                var found=false;
                for(var i=0;i<entries.length;i++){if(entries[i].node===node){found=true;break;}}
                if(!found){
                    var g=geomOf(node);
                    g.perim=perimOf(g);
                    entries.push(buildEntry(node,g,c));
                }
            });
            /* 更新 / 淡出 / 清理 */
            for(var i=entries.length-1;i>=0;i--){
                var e=entries[i];
                if(!sel.has(e.node)){
                    e.fade-=0.22;
                    if(e.fade<=0){e.wrap.remove();entries.splice(i,1);continue;}
                }else{
                    if(e.fadeDir<0)e.fadeDir=1;
                    e.fade=Math.min(1,e.fade+0.09);
                    var g2=geomOf(e.node);
                    if(Math.abs(g2.w-e.w)>1||Math.abs(g2.h-e.h)>1||Math.abs(g2.br-e.br)>0.5){
                        g2.perim=perimOf(g2);
                        rebuildEntry(e,g2,c);
                    }
                    var r=e.node.getBoundingClientRect();
                    e.wrap.setAttribute('transform','translate('+r.left+','+r.top+')');
                    var d=((now-e.t0)%7000)/7000*e.perim;
                    var startPos=Math.max(0,e.w-2*e.br)/2;
                    var off=((d-startPos)%e.perim+e.perim)%e.perim;
                    var off2=(off+e.perim/2)%e.perim;
                    e.outer.setAttribute('stroke-dashoffset',off);
                    e.core.setAttribute('stroke-dashoffset',off);
                    e.outer2.setAttribute('stroke-dashoffset',off2);
                    e.core2.setAttribute('stroke-dashoffset',off2);
                }
                e.wrap.setAttribute('opacity',Math.max(0,Math.min(1,e.fade)).toFixed(3));
            }
        }

        /* 30fps：视觉顺滑且开销减半 */
        function loop(t){
            if(t-lastT>=33){buildFrame(t);lastT=t;}
            requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);
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
            var diag = unsafeWindow._ltDiag && unsafeWindow._ltDiag.tagScan;
            if(diag){
                info.push('');
                info.push('=== 图标扫描自检 ===');
                info.push('扫描次数: ' + diag.runs + '  最近: ' + (diag.last ? new Date(diag.last).toLocaleTimeString() : '从未'));
                info.push('找到输入框: ' + diag.found + '  可见: ' + diag.visible + '  节点内: ' + diag.nodeInp);
                info.push('注入 标签图标: ' + diag.tagInj + '  AI图标: ' + diag.aiInj);
                info.push('页面 textarea 总数: ' + document.querySelectorAll('textarea').length);
                if(diag.details && diag.details.length){
                    info.push('前 ' + diag.details.length + ' 个输入详情:');
                    diag.details.forEach(function(d){ info.push('  ' + d); });
                }
                if(diag.icons && diag.icons.length){
                    info.push('浮动图标状态 (注册 ' + diag.icons.length + ' 组):');
                    diag.icons.forEach(function(d){ info.push('  ' + d); });
                }
            } else {
                info.push('');
                info.push('=== 图标扫描自检 ===');
                info.push('未初始化 — inject 脚本未运行到扫描逻辑');
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







