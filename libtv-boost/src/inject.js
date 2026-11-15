(function(){
  /* GM_xmlhttpRequest 封装：绕过浏览器 CORS，由油猴扩展特权上下文代发请求。
     main.js（油猴沙箱）已把 GM_xmlhttpRequest 挂到页面 window.__ltGMXHR，
     此处通过 window 访问（注入脚本运行在页面上下文，无 unsafeWindow 标识符）。
     不可用时回退到原生 fetch。返回 Promise<{r:{ok,status}, t:string}>，接口对齐原 fetch 用法。 */
  function _ltXHR(opts){
    var gm=window&&window.__ltGMXHR;
    if(gm){
      return new Promise(function(res,rej){
        try{
          gm({
            method:opts.method||'GET',
            url:opts.url,
            headers:opts.headers||{},
            data:opts.body,
            timeout:60000,
            onload:function(resp){
              var status=resp.status||0;
              res({r:{ok:status>=200&&status<300,status:status},t:resp.responseText||''});
            },
            onerror:function(){rej(new TypeError('Failed to fetch'));},
            ontimeout:function(){rej(new TypeError('Failed to fetch (timeout)'));}
          });
        }catch(e){rej(e);}
      });
    }
    // 回退：原生 fetch（仍受 CORS 约束，仅作为兜底）
    return fetch(opts.url,{method:opts.method,headers:opts.headers,body:opts.body})
      .then(function(r){return r.text().then(function(t){return {r:r,t:t};});});
  }
  function _ltClearChain(){
    document.body.classList.remove("libtv-chain");
    document.querySelectorAll(".libtv-chain-node,.libtv-chain-edge").forEach(function(e){
      e.classList.remove("libtv-chain-node","libtv-chain-edge");
          });
        };
  var _ltAutoChain=localStorage.getItem("_lt_autochain")==="1";
  if(_ltAutoChain) document.body.classList.add("libtv-autochain");
  var _ltGraphCache=null;
  function _ltGetGraph(){
    if(!_ltGraphCache){
      var up={},down={};
      document.querySelectorAll(".react-flow__edge").forEach(function(e){
        var lb=e.getAttribute("aria-label")||"",m=lb.match(/^Edge from (\S+) to (\S+)$/);
        if(!m)return;
        var s=m[1],t=m[2];
        if(!down[s])down[s]=[]; down[s].push(t);
        if(!up[t])up[t]=[]; up[t].push(s);
      });
      _ltGraphCache={up:up,down:down};
    }
    return _ltGraphCache;
  }
  function _ltInvalidateGraph(){_ltGraphCache=null;_ltEdgeIdx=null;}
  /* 节点→连线倒排索引：hover 高亮 O(1) 查表，替代每次全量遍历边+正则（随点击失效重建，与 _ltGraphCache 同步） */
  var _ltEdgeIdx=null;
  function _ltGetEdgeIdx(){
    if(!_ltEdgeIdx){
      var idx={};
      document.querySelectorAll(".react-flow__edge").forEach(function(e){
        var lb=e.getAttribute("aria-label")||"",m=lb.match(/^Edge from (\S+) to (\S+)$/);
        if(!m)return;
        (idx[m[1]]=idx[m[1]]||[]).push(e);
        (idx[m[2]]=idx[m[2]]||[]).push(e);
      });
      _ltEdgeIdx=idx;
    }
    return _ltEdgeIdx;
  }
  document.addEventListener("click",function(e){
    _ltInvalidateGraph();
    if(!_ltAutoChain) return;
    if(!e.target.closest(".react-flow__node")){
      _ltClearChain(); return;
    }
    setTimeout(function(){
      if(document.querySelector(".react-flow__node.selected")){
        var g=_ltGetGraph(),sid=document.querySelector(".react-flow__node.selected").getAttribute("data-id")||"";
        if(!sid||!g)return;
        var v={},q=[sid]; v[sid]=1;
        while(q.length){
          var c=q.shift();
          (g.up[c]||[]).forEach(function(n){if(!v[n]){v[n]=1;q.push(n);}});
          (g.down[c]||[]).forEach(function(n){if(!v[n]){v[n]=1;q.push(n);}});
        }
        document.querySelectorAll(".react-flow__node").forEach(function(n){
          n.classList[(v[n.getAttribute("data-id")||n.id||""])?"add":"remove"]("libtv-chain-node");
        });
        document.querySelectorAll(".react-flow__edge").forEach(function(e){
          var lb=e.getAttribute("aria-label")||"",m=lb.match(/^Edge from (\S+) to (\S+)$/);
          e.classList[(m&&v[m[1]]&&v[m[2]])?"add":"remove"]("libtv-chain-edge");
        });
        document.body.classList.add("libtv-chain");
      }
    }, 50);
  }, true);
  document.addEventListener("mouseover",function(e){
    var n=e.target.closest(".react-flow__node");
    if(!n)return;
    var id=n.getAttribute("data-id")||n.id||""; if(!id)return;
    var eds=_ltGetEdgeIdx()[id];
    if(eds)eds.forEach(function(ed){ed.classList.add("libtv-edge-active");});
  },true);
  document.addEventListener("mouseout",function(e){
    if(!e.target.closest(".react-flow__node"))return;
    document.querySelectorAll(".react-flow__edge.libtv-edge-active").forEach(function(ed){
      ed.classList.remove("libtv-edge-active");
    });
  },true);
  function _ltSearch(){
    var overlay=document.getElementById("libtv-search");
    if(overlay){ overlay.remove(); return; }
    var items=[];
    document.querySelectorAll(".react-flow__node").forEach(function(n){
      var id=n.getAttribute("data-id")||n.id||"";
      if(!id)return;
      var txt=(n.textContent||"").trim().split("\n")[0].trim().slice(0,50);
      items.push({id:id,name:txt||id,el:n});
    });
    var div=document.createElement("div");
    div.id="libtv-search";
    div.style.cssText="position:fixed;top:60px;right:20px;z-index:99999;background:rgba(0,0,0,0.9);border-radius:10px;padding:10px;width:280px;max-height:60vh;overflow:auto;font:12px/1.5 sans-serif;";
    div.innerHTML="<input id=\"lt-search-input\" placeholder=\"搜索节点...\" style=\"width:100%;box-sizing:border-box;padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font:12px/1.5 sans-serif;outline:none;\"><div id=\"lt-search-results\" style=\"margin-top:6px;\"></div>";
    document.body.appendChild(div);
    function render(q){
      var q=(q||"").toLowerCase(),html="";
      items.forEach(function(it){
        if(!q||it.name.toLowerCase().indexOf(q)>=0||it.id.toLowerCase().indexOf(q)>=0){
          html+="<div data-id=\""+_ltEsc(it.id)+"\" style=\"padding:4px 8px;border-radius:4px;cursor:pointer;color:#ccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\">"+_ltEsc(it.name)+"</div>";
        }
      });
      document.getElementById("lt-search-results").innerHTML=html;
    }
    render("");
    document.getElementById("lt-search-input").addEventListener("input",function(){
      render(this.value);
    });
    /* 回车直接跳第一个命中，省一次瞄准点击 */
    document.getElementById("lt-search-input").addEventListener("keydown",function(e){
      if(e.key!=="Enter")return;
      var first=document.querySelector("#lt-search-results [data-id]");
      if(first)first.click();
    });
    document.getElementById("lt-search-results").addEventListener("click",function(e){
      var item=e.target.closest("[data-id]");
      if(!item)return;
      var id=item.getAttribute("data-id");
      var el=null;
      try{el=document.querySelector('.react-flow__node[data-id="'+id.replace(/["\\]/g,"\\$&")+'"]');}catch(ex){}
      if(!el){for(var i2=0,ns2=document.querySelectorAll(".react-flow__node");i2<ns2.length;i2++){if(ns2[i2].getAttribute("data-id")===id){el=ns2[i2];break;}}}
      if(el){
        el.scrollIntoView({behavior:"smooth",block:"center"});
        el.click();
      }
      div.remove();
    });
    document.getElementById("lt-search-input").focus();
  }
  var _ltPrompts=[];
  try{_ltPrompts=JSON.parse(localStorage.getItem("_lt_prompts")||"[]");}catch(e){_ltPrompts=[];}
  if(!_ltPrompts.length){
    _ltPrompts=[
      {id:"d1",name:"产品摄影",category:"图像",content:"Product photography on {background=white} background, {lighting=studio lighting}, high detail, 8K, sharp focus, {extra}"},
      {id:"d2",name:"电影镜头",category:"图像",content:"Cinematic shot, {lens=anamorphic} lens, {lighting=dramatic} lighting, shallow depth of field, {style}"},
      {id:"d3",name:"动画-吉卜力风",category:"图像",content:"Studio Ghibli style, hand-drawn animation, {palette=soft pastel} colors, {atmosphere=whimsical}"},
      {id:"d4",name:"产品展示-环绕",category:"视频",content:"Smooth 360 orbit around {subject=product}, {lighting=soft studio} lighting, slow motion, {extra}"},
      {id:"d5",name:"风光-延时",category:"视频",content:"Timelapse, {time=golden hour}, {sky=dramatic clouds}, warm tones, smooth transition, {extra}"},
    ];
    try{localStorage.setItem("_lt_prompts",JSON.stringify(_ltPrompts));}catch(e){}
  }
  var _ltPromptAPI=null;
  try{_ltPromptAPI=JSON.parse(localStorage.getItem("_lt_prompt_api")||"null");}catch(e){_ltPromptAPI=null;}
  if(!_ltPromptAPI||!_ltPromptAPI.url){_ltPromptAPI=_ltPromptAPI||{};_ltPromptAPI.url="https://api.deepseek.com/chat/completions";_ltPromptAPI.model=_ltPromptAPI.model||"deepseek-v4-flash";try{localStorage.setItem("_lt_prompt_api",JSON.stringify(_ltPromptAPI));}catch(e){}}
  var _ltThemePresets=[
    {n:"靛蓝",a:"#6366f1",l:"#818cf8",d:"#4f46e5",ar:"99,102,241",alr:"129,140,248",cb:"#0e0e12",gc:"rgba(255,255,255,0.12)",nb:"#16162a",nc:"rgba(129,140,248,0.15)",ec:"rgba(129,140,248,0.15)",cat:"dark"},
    {n:"翡翠",a:"#10b981",l:"#34d399",d:"#059669",ar:"16,185,129",alr:"52,211,153",cb:"#0b120f",gc:"rgba(255,255,255,0.12)",nb:"#12261c",nc:"rgba(52,211,153,0.15)",ec:"rgba(52,211,153,0.15)",cat:"dark"},
    {n:"玫瑰",a:"#f43f5e",l:"#fb7185",d:"#e11d48",ar:"244,63,94",alr:"251,113,133",cb:"#120b0d",gc:"rgba(255,255,255,0.12)",nb:"#261318",nc:"rgba(251,113,133,0.15)",ec:"rgba(251,113,133,0.15)",cat:"dark"},
    {n:"琥珀",a:"#f59e0b",l:"#fbbf24",d:"#d97706",ar:"245,158,11",alr:"251,191,36",cb:"#12100a",gc:"rgba(255,255,255,0.12)",nb:"#261e12",nc:"rgba(251,191,36,0.15)",ec:"rgba(251,191,36,0.15)",cat:"dark"},
    {n:"天蓝",a:"#0ea5e9",l:"#38bdf8",d:"#0284c7",ar:"14,165,233",alr:"56,189,248",cb:"#0a1013",gc:"rgba(255,255,255,0.12)",nb:"#111f28",nc:"rgba(56,189,248,0.15)",ec:"rgba(56,189,248,0.15)",cat:"dark"},
    {n:"紫色",a:"#8b5cf6",l:"#a78bfa",d:"#7c3aed",ar:"139,92,246",alr:"167,139,250",cb:"#0e0c14",gc:"rgba(255,255,255,0.12)",nb:"#1b1730",nc:"rgba(167,139,250,0.15)",ec:"rgba(167,139,250,0.15)",cat:"dark"},
    {n:"暗夜绿",a:"#22c55e",l:"#4ade80",d:"#16a34a",ar:"34,197,94",alr:"74,222,128",cb:"#080c0a",gc:"rgba(255,255,255,0.08)",nb:"#0f1a14",nc:"rgba(74,222,128,0.12)",ec:"rgba(74,222,128,0.12)",cat:"dark"},
    {n:"赛博朋克",a:"#f472b6",l:"#fb923c",d:"#e11d48",ar:"244,114,182",alr:"251,146,60",cb:"#0a0a14",gc:"rgba(255,255,255,0.08)",nb:"#14142a",nc:"rgba(244,114,182,0.15)",ec:"rgba(244,114,182,0.15)",cat:"dark"},
    {n:"暖棕复古",a:"#d97706",l:"#f59e0b",d:"#b45309",ar:"217,119,6",alr:"245,158,11",cb:"#0f0c08",gc:"rgba(255,255,255,0.08)",nb:"#1c160e",nc:"rgba(245,158,11,0.12)",ec:"rgba(245,158,11,0.12)",cat:"dark"},
    {n:"极简白",a:"#6366f1",l:"#818cf8",d:"#4f46e5",ar:"99,102,241",alr:"129,140,248",cb:"#f5f5f0",gc:"rgba(0,0,0,0.06)",nb:"#ffffff",nc:"rgba(99,102,241,0.12)",ec:"rgba(0,0,0,0.08)",cat:"light"},
    {n:"灰银",a:"#6b7280",l:"#9ca3af",d:"#4b5563",ar:"107,114,128",alr:"156,163,175",cb:"#e8e8e5",gc:"rgba(0,0,0,0.06)",nb:"#f0f0ed",nc:"rgba(0,0,0,0.1)",ec:"rgba(0,0,0,0.08)",cat:"light"},
    {n:"暖白",a:"#d97706",l:"#f59e0b",d:"#b45309",ar:"217,119,6",alr:"245,158,11",cb:"#f0ebe3",gc:"rgba(0,0,0,0.06)",nb:"#faf5ed",nc:"rgba(217,119,6,0.1)",ec:"rgba(0,0,0,0.08)",cat:"light"},
    {n:"高对比",a:"#ffffff",l:"#e0e0e0",d:"#ffffff",ar:"255,255,255",alr:"224,224,224",cb:"#000000",gc:"rgba(255,255,255,0.15)",nb:"#1a1a1a",nc:"rgba(255,255,255,0.2)",ec:"rgba(255,255,255,0.2)",cat:"high"},
    {n:"高对比蓝",a:"#00bfff",l:"#87ceeb",d:"#00bfff",ar:"0,191,255",alr:"135,206,235",cb:"#000000",gc:"rgba(0,191,255,0.1)",nb:"#0a0a14",nc:"rgba(0,191,255,0.2)",ec:"rgba(0,191,255,0.2)",cat:"high"},
    {n:"深海蓝",a:"#0891b2",l:"#22d3ee",d:"#0e7490",ar:"8,145,178",alr:"34,211,238",cb:"#0a0e12",gc:"rgba(255,255,255,0.10)",nb:"#0e1a24",nc:"rgba(34,211,238,0.12)",ec:"rgba(34,211,238,0.12)",cat:"dark"},
    {n:"石墨",a:"#6b7280",l:"#9ca3af",d:"#4b5563",ar:"107,114,128",alr:"156,163,175",cb:"#0c0c0e",gc:"rgba(255,255,255,0.08)",nb:"#151518",nc:"rgba(255,255,255,0.08)",ec:"rgba(255,255,255,0.08)",cat:"dark"},
    {n:"咖啡",a:"#a16207",l:"#ca8a04",d:"#854d0e",ar:"161,98,7",alr:"202,138,4",cb:"#0e0a06",gc:"rgba(255,255,255,0.07)",nb:"#1a1208",nc:"rgba(202,138,4,0.12)",ec:"rgba(202,138,4,0.10)",cat:"dark"},
    {n:"极光",a:"#34d399",l:"#6ee7b7",d:"#10b981",ar:"52,211,153",alr:"110,231,183",cb:"#060e0b",gc:"rgba(255,255,255,0.07)",nb:"#0e1a14",nc:"rgba(52,211,153,0.10)",ec:"rgba(110,231,183,0.12)",cat:"dark"},
    {n:"午夜蓝",a:"#3b82f6",l:"#60a5fa",d:"#2563eb",ar:"59,130,246",alr:"96,165,250",cb:"#060810",gc:"rgba(255,255,255,0.06)",nb:"#0c1020",nc:"rgba(59,130,246,0.12)",ec:"rgba(59,130,246,0.10)",cat:"dark"},
    {n:"暗橙",a:"#ea580c",l:"#f97316",d:"#c2410c",ar:"234,88,12",alr:"249,115,22",cb:"#0e0806",gc:"rgba(255,255,255,0.08)",nb:"#1a0f08",nc:"rgba(249,115,22,0.12)",ec:"rgba(249,115,22,0.10)",cat:"dark"},
    {n:"樱花",a:"#ec4899",l:"#f472b6",d:"#db2777",ar:"236,72,153",alr:"244,114,182",cb:"#0e080c",gc:"rgba(255,255,255,0.08)",nb:"#1c0e16",nc:"rgba(244,114,182,0.12)",ec:"rgba(244,114,182,0.10)",cat:"dark"},
    {n:"星河",a:"#a78bfa",l:"#c4b5fd",d:"#8b5cf6",ar:"167,139,250",alr:"196,181,253",cb:"#08060e",gc:"rgba(255,255,255,0.08)",nb:"#12101e",nc:"rgba(167,139,250,0.12)",ec:"rgba(167,139,250,0.10)",cat:"dark"},
    {n:"红莲",a:"#ef4444",l:"#f87171",d:"#dc2626",ar:"239,68,68",alr:"248,113,113",cb:"#0e0606",gc:"rgba(255,255,255,0.07)",nb:"#1c0a0a",nc:"rgba(248,113,113,0.12)",ec:"rgba(248,113,113,0.10)",cat:"dark"},
    {n:"纸张",a:"#d97706",l:"#f59e0b",d:"#b45309",ar:"217,119,6",alr:"245,158,11",cb:"#f7f3eb",gc:"rgba(0,0,0,0.05)",nb:"#fefcf5",nc:"rgba(217,119,6,0.08)",ec:"rgba(0,0,0,0.06)",cat:"light"},
    {n:"薄荷",a:"#059669",l:"#10b981",d:"#047857",ar:"5,150,105",alr:"16,185,129",cb:"#eef5f0",gc:"rgba(0,0,0,0.05)",nb:"#ffffff",nc:"rgba(16,185,129,0.10)",ec:"rgba(0,0,0,0.06)",cat:"light"},
    {n:"玫瑰金",a:"#e11d48",l:"#f43f5e",d:"#be123c",ar:"225,29,72",alr:"244,63,94",cb:"#f5eeef",gc:"rgba(0,0,0,0.05)",nb:"#fffafa",nc:"rgba(244,63,94,0.08)",ec:"rgba(0,0,0,0.06)",cat:"light"},
    {n:"薰衣草",a:"#7c3aed",l:"#8b5cf6",d:"#6d28d9",ar:"124,58,237",alr:"139,92,246",cb:"#f0edf5",gc:"rgba(0,0,0,0.05)",nb:"#fefcff",nc:"rgba(139,92,246,0.08)",ec:"rgba(0,0,0,0.06)",cat:"light"},
    {n:"高对比绿",a:"#22c55e",l:"#4ade80",d:"#16a34a",ar:"34,197,94",alr:"74,222,128",cb:"#000000",gc:"rgba(255,255,255,0.12)",nb:"#0a0f0c",nc:"rgba(74,222,128,0.18)",ec:"rgba(74,222,128,0.18)",cat:"high"},
    {n:"高对比橙",a:"#f97316",l:"#fb923c",d:"#ea580c",ar:"249,115,22",alr:"251,146,60",cb:"#000000",gc:"rgba(255,255,255,0.12)",nb:"#0f0a06",nc:"rgba(251,146,60,0.18)",ec:"rgba(251,146,60,0.18)",cat:"high"},
  ];
  var _ltTheme=null;
  try{_ltTheme=JSON.parse(localStorage.getItem("_lt_theme")||"null");}catch(e){_ltTheme=null;}
  if(!_ltTheme)_ltTheme=_ltThemePresets[0];
  if(!_ltTheme.cb){_ltTheme.cb=_ltThemePresets[0].cb;_ltTheme.gc=_ltThemePresets[0].gc;_ltTheme.nb=_ltThemePresets[0].nb;_ltTheme.nc=_ltThemePresets[0].nc;_ltTheme.ec=_ltThemePresets[0].ec;}
  function _ltApplyTheme(t){
    var r=document.documentElement;
    r.style.setProperty("--accent",t.a);
    r.style.setProperty("--accent-light",t.l);
    r.style.setProperty("--accent-dark",t.d);
    r.style.setProperty("--accent-rgb",t.ar);
    r.style.setProperty("--accent-light-rgb",t.alr);
    r.style.setProperty("--canvas-bg",t.cb);
    r.style.setProperty("--node-bg",t.nb);
    r.style.setProperty("--border-color",t.nc);
    r.style.setProperty("--edge-color",t.ec);
    _ltTheme=t;
    try{localStorage.setItem("_lt_theme",JSON.stringify(t));}catch(e){}
    try{document.getElementById("ltp-theme-preview").style.background=t.l;}catch(e){}
    try{var _e=document.querySelectorAll(".react-flow__renderer,.react-flow");for(var _i=0;_i<_e.length;_i++)_e[_i].style.backgroundColor=t.cb;}catch(e){}
  }
  _ltApplyTheme(_ltTheme);
  setTimeout(function(){try{var _e=document.querySelectorAll(".react-flow__renderer,.react-flow");for(var _i=0;_i<_e.length;_i++)_e[_i].style.backgroundColor=_ltTheme.cb;}catch(e){}},500);
  var _ltPActiveTab="templates",_ltPCat="",_ltAISource=null,_ltBodyOrigMinH="";
  /* AI 请求代际计数（提示词面板 AI tab 与独立 AI 面板共用）：取消/重发即 ++，
     迟到回包按代际丢弃；放顶层而非各渲染闭包内——面板重挂载换闭包后旧回包才拦得住 */
  var _ltAIReqGen=0;
  function _ltPromptPanel(anchor){
        if(_ltPActiveTab==="settings")_ltPActiveTab="templates";
    var el=document.getElementById("libtv-prompt");
    if(el){el.remove();return;}
    function savePrompts(){try{localStorage.setItem("_lt_prompts",JSON.stringify(_ltPrompts));}catch(e){}}
    function _ltPromptFormModal(data,onSave){
      var body=document.getElementById("ltp-body");if(!body)return;
      var n=data?data.name:"",c=data?data.content:"",cat=data?data.category:"\u901a\u7528";
      var overlay=document.createElement("div");overlay.className="ltp-form-overlay";
      overlay.innerHTML="<div class=\"ltp-form-title\">"+(data?"\u7f16\u8f91\u6a21\u677f":"\u65b0\u589e\u6a21\u677f")+"</div>"
        +"<div class=\"ltp-form-row\"><label>\u540d\u79f0</label><input class=\"ltp-form-inp\" id=\"ltp-f-name\" value=\"" + _ltEsc(n) + "\"></div>"
        +"<div class=\"ltp-form-inp-row2\"><div class=\"ltp-form-row\"><label>\u5206\u7c7b</label><input class=\"ltp-form-inp\" id=\"ltp-f-cat\" value=\"" + _ltEsc(cat) + "\"></div></div>"
        +"<div class=\"ltp-form-row\" style=\"flex:1\"><label>\u5185\u5bb9</label><textarea class=\"ltp-form-ta\" id=\"ltp-f-ct\" rows=\"6\">"+_ltEsc(c)+"</textarea></div>"
        +"<div class=\"ltp-form-actions\"><button class=\"ltp-btn ltp-btn-ghost\" id=\"ltp-f-cancel\">\u53d6\u6d88</button><button class=\"ltp-btn ltp-btn-primary\" id=\"ltp-f-ok\">"+(data?"\u4fdd\u5b58":"\u6dfb\u52a0")+"</button></div>";
      _ltBodyOrigMinH=body.style.minHeight||"";body.style.minHeight="300px";body.appendChild(overlay);
      function _clean(){if(overlay.parentNode)overlay.parentNode.removeChild(overlay);body.style.minHeight=_ltBodyOrigMinH;}
      document.getElementById("ltp-f-cancel").onclick=_clean;
      document.getElementById("ltp-f-ok").onclick=function(){
        var nn=document.getElementById("ltp-f-name").value.trim();
        if(!nn){document.getElementById("ltp-f-name").focus();return;}
        var cc=document.getElementById("ltp-f-ct").value;
        var cat2=document.getElementById("ltp-f-cat").value.trim()||"\u901a\u7528";
        _clean();onSave({name:nn,content:cc,category:cat2});
      };
    }
    function _ltPromptViewModal(p){
      var body=document.getElementById("ltp-body");if(!body)return;
      var overlay=document.createElement("div");overlay.className="ltp-view-overlay";
      overlay.innerHTML="<div class=\"ltp-view-title\">"+_ltEsc(p.name)+"</div>"
        +"<div class=\"ltp-view-meta\">"+_ltEsc(p.category)+" \u2022 "+p.content.length+" \u5b57</div>"
        +"<div class=\"ltp-view-content\">"+_ltEsc(p.content)+"</div>"
        +"<div class=\"ltp-view-actions\"><button class=\"ltp-btn ltp-btn-primary ltp-btn-sm\" id=\"ltp-v-copy\">\u590d\u5236\u5230\u526a\u8d34\u677f</button><button class=\"ltp-btn ltp-btn-ghost ltp-btn-sm\" id=\"ltp-v-close\">\u5173\u95ed</button></div>";
      _ltBodyOrigMinH=body.style.minHeight||"";body.style.minHeight="300px";body.appendChild(overlay);
      function _clean(){if(overlay.parentNode)overlay.parentNode.removeChild(overlay);body.style.minHeight=_ltBodyOrigMinH;}
      document.getElementById("ltp-v-close").onclick=_clean;
      document.getElementById("ltp-v-copy").onclick=function(){navigator.clipboard.writeText(p.content).then(function(){var b=document.getElementById("ltp-v-copy");if(b){b.textContent="\u2714 \u5df2\u590d\u5236";setTimeout(function(){if(b)b.textContent="\u590d\u5236\u5230\u526a\u8d34\u677f";},1200);}});};
      overlay.querySelector(".ltp-view-content").onclick=function(){navigator.clipboard.writeText(p.content);var b=document.getElementById("ltp-v-copy");if(b){b.textContent="\u2714 \u5df2\u590d\u5236";setTimeout(function(){if(b)b.textContent="\u590d\u5236\u5230\u526a\u8d34\u677f";},1200);}};
    }
    function renderBody(){
      var body=document.getElementById("ltp-body"); if(!body)return;
      if(_ltPActiveTab==="templates"){
        var cats={};
        _ltPrompts.forEach(function(p){if(!cats[p.category])cats[p.category]=0;cats[p.category]++;});
        var catKeys=Object.keys(cats);
        var filtered= _ltPCat ? _ltPrompts.filter(function(p){return p.category===_ltPCat;}) : _ltPrompts;
        var h='<div class="ltp-cat"><button class="ltp-cat-btn'+(!_ltPCat?" active":"")+'" data-cat="">全部</button>';
        catKeys.forEach(function(c){h+='<button class="ltp-cat-btn'+(c===_ltPCat?" active":"")+'" data-cat="'+_ltEsc(c)+'">'+_ltEsc(c)+' ('+cats[c]+')</button>';});
        h+="</div>";
        if(!filtered.length){h+='<div class="ltp-empty">暂无模板，点击右上角 + 添加</div>';}
        else{
          filtered.forEach(function(p){
            var pid=_ltEsc(p.id); /* id 不转义直插属性曾是 XSS 口子（恶意内容包），纵深防御：导入已消毒，这里再兜一层 */
            h+='<div class="ltp-item" data-id="'+pid+'">'
              +'<div class="ltp-item-top">'
              +'<div class="ltp-item-info">'
              +'<span class="ltp-name">'+_ltEsc(p.name)+'</span>'
              +'<span class="ltp-cat-badge">'+_ltEsc(p.category)+'</span>'
              +'</div>'
              +'<div class="ltp-actions">'
              +'<button class="ltp-btn ltp-btn-primary ltp-btn-sm" data-action="copy" title="复制到剪贴板" data-id="'+pid+'">复制</button>'
              +'<button class="ltp-btn ltp-btn-ghost ltp-btn-sm" data-action="view" title="查看完整内容" data-id="'+pid+'">查看</button>'
              +'<button class="ltp-btn ltp-btn-ghost ltp-btn-sm" data-action="edit" data-id="'+pid+'">编辑</button>'
              +'<button class="ltp-btn ltp-btn-danger ltp-btn-sm" data-action="del" data-id="'+pid+'">×</button>'
              +'</div>'
              +'</div>'
              +'<div class="ltp-preview" data-id="'+pid+'">'+_ltEsc(p.content.slice(0,120))+'</div>'
              +'</div>';
          });
        }
        body.innerHTML=h;
        body.querySelectorAll(".ltp-cat-btn").forEach(function(b){b.onclick=function(){_ltPCat=this.getAttribute("data-cat")||"";renderBody();};});
        body.querySelectorAll(".ltp-item .ltp-preview,.ltp-item .ltp-item-top").forEach(function(b){b.onclick=function(e){if(e.target.closest(".ltp-actions"))return;var id=this.closest(".ltp-item").getAttribute("data-id");var btn=null;try{btn=body.querySelector("[data-action=copy][data-id='"+id+"']");}catch(ex){}if(btn)btn.click();};});
        body.querySelectorAll("[data-action=copy]").forEach(function(b){b.onclick=function(){var id=b.getAttribute("data-id"),p=_ltPrompts.find(function(x){return x.id===id;});if(!p)return;var m,pairs=[],re=/\{(\w+)(?:=([^}]*))?\}/g;while((m=re.exec(p.content))!==null)pairs.push({n:m[1],d:m[2]||""});if(!pairs.length){navigator.clipboard.writeText(p.content).then(function(){b.textContent="✅";setTimeout(function(){b.textContent="复制";},1200);});return;}var overlay=document.createElement("div");overlay.className="ltp-var-overlay";var html='<div class="ltp-var-title">'+_ltEsc(p.name)+'</div><div class="ltp-var-sub">填写变量后点击确认，替换结果将复制到剪贴板</div>';pairs.forEach(function(v){html+='<div class="ltp-var-row"><label>'+v.n+'</label><input class="ltp-var-inp" data-var="'+v.n+'" value="'+_ltEsc(v.d)+'"></div>';});html+='<div class="ltp-var-preview" id="ltp-var-ovprev">'+_ltEsc(p.content)+'</div><div class="ltp-var-actions"><button class="ltp-btn ltp-btn-ghost" id="ltp-var-cancel">取消</button><button class="ltp-btn ltp-btn-primary" id="ltp-var-ok">填充并复制</button></div>';overlay.innerHTML=html;_ltBodyOrigMinH=body.style.minHeight||"";body.style.minHeight="320px";body.appendChild(overlay);function _clean(){if(overlay.parentNode)overlay.parentNode.removeChild(overlay);body.style.minHeight=_ltBodyOrigMinH;}function _upd(){var r=p.content;overlay.querySelectorAll(".ltp-var-inp").forEach(function(i){r=r.replace(new RegExp("\\{"+i.getAttribute("data-var")+"(?:=[^}]*)?\\}","g"),i.value||i.getAttribute("data-var"));});overlay.querySelector("#ltp-var-ovprev").textContent=r;}overlay.querySelectorAll(".ltp-var-inp").forEach(function(i){i.addEventListener("input",_upd);});overlay.querySelector("#ltp-var-cancel").onclick=function(){_clean();};overlay.querySelector("#ltp-var-ok").onclick=function(){var r=p.content;overlay.querySelectorAll(".ltp-var-inp").forEach(function(i){r=r.replace(new RegExp("\\{"+i.getAttribute("data-var")+"(?:=[^}]*)?\\}","g"),i.value);});navigator.clipboard.writeText(r).then(function(){b.textContent="✅";setTimeout(function(){b.textContent="复制";},1200);_clean();}).catch(function(){_clean();});};};});
        body.querySelectorAll("[data-action=view]").forEach(function(b){b.onclick=function(){var id=this.getAttribute("data-id"),p=_ltPrompts.find(function(x){return x.id===id;});if(!p)return;_ltPromptViewModal(p);};});
        body.querySelectorAll("[data-action=edit]").forEach(function(b){b.onclick=function(){var id=this.getAttribute("data-id"),p=_ltPrompts.find(function(x){return x.id===id;});if(!p)return;_ltPromptFormModal({name:p.name,content:p.content,category:p.category},function(r){p.name=r.name;p.content=r.content;p.category=r.category||"\u901a\u7528";savePrompts();renderBody();});};});
        body.querySelectorAll("[data-action=del]").forEach(function(b){b.onclick=function(){var id=this.getAttribute("data-id");_ltPrompts=_ltPrompts.filter(function(x){return x.id!==id;});savePrompts();renderBody();};});
      }
      else if(_ltPActiveTab==="ai"){
        var api=_ltPromptAPI;
        var _ltAIPresets={
          polish:{label:"✨ 润色",sys:"你是一个提示词工程专家。请润色用户的 AI 图像/视频生成提示词，修正语法、优化表达，保持原意不变。请务必用中文回复。"},
          expand:{label:"📏 扩写",sys:"你是一个提示词工程专家。请在用户原有提示词基础上扩写，补充光影、构图、风格、氛围、色彩等细节，使提示词更丰富具体。请务必用中文回复。"},
          shorten:{label:"✂️ 缩写",sys:"你是一个提示词工程专家。请在不丢失核心信息的前提下精简提示词，保留关键修饰词，移除冗余表达。请务必用中文回复。"},
          zh2en:{label:"🌐 中→英",sys:"You are a prompt engineering expert. Translate the Chinese prompt to English while maintaining all stylistic and technical details. Output English only."},
          en2zh:{label:"🌐 英→中",sys:"你是一个提示词工程专家。将英文提示词翻译成中文，保留所有风格和技术细节。只输出中文。"},
          custom:{label:"⚙ 自定义",sys:""}
        };
        var _ltAICustomSys=function(){try{return localStorage.getItem("_lt_ai_sys")||"";}catch(e){return "";}};
        var _ltAICustomPresetsGet=function(){try{return JSON.parse(localStorage.getItem("_lt_ai_custom_presets")||"[]");}catch(e){return [];}};
        var _ltAICustomPresetsSave=function(name,sys){var a=_ltAICustomPresetsGet();a.push({id:"cp_"+Date.now().toString(36),name:name,sys:sys,created:Date.now()});try{localStorage.setItem("_lt_ai_custom_presets",JSON.stringify(a));}catch(e){}};
        var _ltAICustomPresetsDelete=function(id){var a=_ltAICustomPresetsGet();for(var i=0;i<a.length;i++){if(a[i].id===id){a.splice(i,1);break;}}try{localStorage.setItem("_lt_ai_custom_presets",JSON.stringify(a));}catch(e){}};
        var _ltAICurTask="polish";
        body.innerHTML=
          '<textarea id="ltp-ai-input" class="ltp-ai-input" placeholder="在此输入提示词..." rows="1"></textarea>'
          +'<div class="ltp-ai-tasks" id="ltp-ai-tasks">'
          +Object.keys(_ltAIPresets).map(function(k){return '<span class="ltp-ai-task'+(k==="polish"?" active":"")+'" data-task="'+k+'">'+_ltAIPresets[k].label+'</span>';}).join("")
          +_ltAICustomPresetsGet().map(function(p){return '<span class="ltp-ai-task cp" data-task="'+_ltEsc(p.id)+'">'+_ltEsc(p.name)+'</span>';}).join("")
          +'</div>'
          +'<div class="ltp-ai-custom" id="ltp-ai-custom"><textarea id="ltp-ai-sys" class="ltp-ai-sys" placeholder="在此输入自定义 system prompt..." rows="2"></textarea>'
          +'<div style="display:flex;gap:4px;margin-top:6px;"><button class="ltp-ai-preset-btn" id="ltp-ai-save-preset">💾 另存为</button></div>'
          +'<div class="ltp-ai-preset-list" id="ltp-ai-preset-list"></div></div>'
          +'<div class="ltp-ai-actions"><button class="ltp-btn ltp-btn-primary" id="ltp-ai-go">🚀 执行</button><button class="ltp-btn ltp-btn-ghost" id="ltp-ai-cancel" style="display:none">取消</button><span id="ltp-ai-model-sel" style="display:inline-flex;align-items:center;"></span><button class="ltp-btn ltp-btn-ghost" id="ltp-ai-fill">从输入框获取</button><button class="ltp-btn ltp-btn-ghost" id="ltp-ai-clear">清空</button></div>'
          +'<div id="ltp-ai-result" class="ltp-ai-result" style="display:none"></div>'
          +'<div class="ltp-status" id="ltp-ai-status">'+(api.url?("已配置 "+_ltEsc(_ltHost(api.url))+(api.model?(" · "+_ltEsc(api.model)):"")):"未配置 API，请在⚙设置中配置")+'</div>';
        /* custom init */
        var _ltCustomEl=document.getElementById("ltp-ai-custom");_ltCustomEl.style.display="none";
        /* auto-height textarea */
        var _ltAIInp=document.getElementById("ltp-ai-input");
        _ltAIInp.addEventListener("input",function(){this.style.height="auto";this.style.height=Math.min(this.scrollHeight,160)+"px";});
        _ltAIInp.addEventListener("keydown",function(e){if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();document.getElementById("ltp-ai-go").click();}});
        /* task selector */
        document.getElementById("ltp-ai-tasks").addEventListener("click",function(e){
          var t=e.target.closest(".ltp-ai-task");if(!t)return;
          _ltAICurTask=t.getAttribute("data-task");
          this.querySelectorAll(".ltp-ai-task").forEach(function(s){s.classList.toggle("active",s===t);});
          if(_ltAICurTask==="custom"){_ltCustomEl.style.display="block";document.getElementById("ltp-ai-sys").value=_ltAICustomSys();document.getElementById("ltp-ai-sys").focus();_ltRenderCustomPresets();}
          else if(_ltAICurTask.indexOf("cp_")===0){_ltCustomEl.style.display="block";var pr=_ltAICustomPresetsGet();var found=null;for(var _i=0;_i<pr.length;_i++){if(pr[_i].id===_ltAICurTask){found=pr[_i];break;}}document.getElementById("ltp-ai-sys").value=found?found.sys:_ltAICustomSys();document.getElementById("ltp-ai-sys").focus();_ltRenderCustomPresets();}
          else{_ltCustomEl.style.display="none";}
        });
        /* custom sys prompt auto-save */
        document.getElementById("ltp-ai-sys").addEventListener("input",function(){try{localStorage.setItem("_lt_ai_sys",this.value);}catch(e){}});
        /* rebuild task bar from presets */
        var _ltRebuildTaskBar=function(){
          var tasksEl=document.getElementById("ltp-ai-tasks");if(!tasksEl)return;
          var cur=_ltAICurTask;
          var html=Object.keys(_ltAIPresets).map(function(k){return '<span class="ltp-ai-task'+(k===cur?" active":"")+'" data-task="'+k+'">'+_ltAIPresets[k].label+'</span>';}).join("");
          html+=_ltAICustomPresetsGet().map(function(p){return '<span class="ltp-ai-task cp'+(p.id===cur?" active":"")+'" data-task="'+_ltEsc(p.id)+'">'+_ltEsc(p.name)+'</span>';}).join("");
          tasksEl.innerHTML=html;
        };
        /* render preset list below custom textarea */
        var _ltRenderCustomPresets=function(){
          var listEl=document.getElementById("ltp-ai-preset-list");if(!listEl)return;
          var presets=_ltAICustomPresetsGet();
          if(presets.length===0){listEl.innerHTML="";return;}
          listEl.innerHTML=presets.map(function(p){return '<div class="ltp-ai-preset-item"><span>'+_ltEsc(p.name)+'</span><span class="ltp-ai-preset-del" data-pid="'+p.id+'">🗑</span></div>';}).join("");
          listEl.querySelectorAll(".ltp-ai-preset-del").forEach(function(b){b.onclick=function(e){e.stopPropagation();var pid=this.getAttribute("data-pid");_ltAICustomPresetsDelete(pid);_ltRebuildTaskBar();_ltRenderCustomPresets();};});
        };
        /* save preset button */
        document.getElementById("ltp-ai-save-preset").onclick=function(){
          var sys=document.getElementById("ltp-ai-sys").value;
          if(!sys.trim()){document.getElementById("ltp-ai-status").textContent="⚠ 请先填写 system prompt";return;}
          var name=prompt("请输入预设名称：","自定义 "+new Date().toLocaleString("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}));
          if(!name)return;
          _ltAICustomPresetsSave(name,sys);
          _ltRebuildTaskBar();_ltRenderCustomPresets();
          document.getElementById("ltp-ai-status").textContent="✅ 已保存预设: "+name;
        };
        /* initial render */
        _ltRenderCustomPresets();
        /* fill from input */
        /* 模型下拉：缓存优先自动加载，选中即写回配置并刷新状态栏 */
        _ltModelSelect(document.getElementById("ltp-ai-model-sel"),"ltp",function(m){
          api=_ltAPIRead();
          document.getElementById("ltp-ai-status").textContent=api.url?("已配置 "+_ltEsc(_ltHost(api.url))+(api.model?(" · "+_ltEsc(api.model)):"")):"未配置 API，请在⚙设置中配置";
        });
        document.getElementById("ltp-ai-fill").onclick=function(){
          var candidates=[],best=null;
          document.querySelectorAll("textarea").forEach(function(t){var id=t.id;if(id==="ltp-ai-input"||id==="ltp-ai-sys")return;if(t.offsetParent!==null)candidates.push({el:t,val:t.value});});
          document.querySelectorAll("input[type=text]").forEach(function(t){if(t.offsetParent!==null)candidates.push({el:t,val:t.value});});
          document.querySelectorAll("[contenteditable=true]").forEach(function(t){if(t.offsetParent!==null)candidates.push({el:t,val:t.textContent||""});});
          candidates.forEach(function(c){if(c.val.trim()&&(!best||c.val.length>best.val.length))best=c;});
          _ltAIInp.value=best?best.val:"";_ltAIInp.style.height="auto";_ltAIInp.style.height=Math.min(_ltAIInp.scrollHeight,160)+"px";
          _ltAISource=best?best.el:null;
          document.getElementById("ltp-ai-status").textContent=_ltAISource?"✅ 已绑定源输入框":"⚠ 未找到可见输入框";
        };
        /* clear */
        document.getElementById("ltp-ai-clear").onclick=function(){_ltAIInp.value="";_ltAIInp.style.height="auto";document.getElementById("ltp-ai-result").style.display="none";var g=document.getElementById("ltp-ai-go");if(g)g.textContent="🚀 执行";};
        /* execute */
        var _ltDoAI=function(text,btn){
          var api=_ltPromptAPI;
          if(!api.url||!api.key){document.getElementById("ltp-ai-status").textContent="❌ 请先在⚙设置中配置 API";return;}
          var sysPrompt=_ltAICurTask==="custom"?_ltAICustomSys():(_ltAICurTask.indexOf("cp_")===0?function(){var pr=_ltAICustomPresetsGet();for(var _i=0;_i<pr.length;_i++){if(pr[_i].id===_ltAICurTask)return pr[_i].sys;}return "";}():(_ltAIPresets[_ltAICurTask]?_ltAIPresets[_ltAICurTask].sys:""));
          if((_ltAICurTask==="custom"||_ltAICurTask.indexOf("cp_")===0)&&!sysPrompt.trim()){document.getElementById("ltp-ai-status").textContent="❌ 请先填写 system prompt";return;}
          var statusEl=document.getElementById("ltp-ai-status");
          var cancelBtn=document.getElementById("ltp-ai-cancel");
          btn.textContent="处理中...";btn.disabled=true;
          if(cancelBtn)cancelBtn.style.display="";
          var myGen=++_ltAIReqGen;
          _ltAIChat(api.url,api.key,{model:api.model||"deepseek-v4-flash",messages:[{role:"system",content:sysPrompt},{role:"user",content:text}],max_tokens:4096}).then(function(d){
            if(myGen!==_ltAIReqGen)return; /* 已取消/已重发：迟到回包一律丢弃 */
            var result=_ltMsgText(d)||("\u26a0 \u6a21\u578b\u8fd4\u56de\u7a7a\u5185\u5bb9\uff08\u53ef\u80fd\u601d\u8003\u8fc7\u957f\u88ab max_tokens \u622a\u65ad\uff09\uff0c\u539f\u59cb\u54cd\u5e94: "+(JSON.stringify(d)||"").slice(0,300));
            var resEl=document.getElementById("ltp-ai-result");
            resEl.style.display="block";
            resEl.innerHTML='<div class="ai-sec"><div class="ai-label">原文</div><div class="ai-text ai-orig">'+_ltEsc(text.slice(0,300))+(text.length>300?"...":"")+'</div></div><div class="ai-sep"></div><div class="ai-sec"><div class="ai-label">增强结果</div><div class="ai-text" id="ltp-ai-res-text">'+_ltEsc(result)+'</div></div><div class="ai-res-actions"><button class="ltp-btn ltp-btn-primary ltp-btn-sm" id="ltp-ai-write">写回源输入框</button><button class="ltp-btn ltp-btn-ghost ltp-btn-sm" id="ltp-ai-copy">复制</button></div>';
            statusEl.textContent="✅ 完成";
            btn.textContent="🔄 重新生成";btn.disabled=false;
            if(cancelBtn)cancelBtn.style.display="none";
            /* write-back */
            document.getElementById("ltp-ai-write").onclick=function(){
              if(!_ltAISource){statusEl.textContent="⚠ 未绑定源输入框，请先点击“从输入框获取”";return;}
              try{
                if(_ltAISource.tagName==="TEXTAREA"||_ltAISource.tagName==="INPUT"){_ltAISource.value=result;_ltAISource.dispatchEvent(new Event("input",{bubbles:true}));}
                else if(_ltAISource.isContentEditable){_ltAISource.textContent=result;_ltAISource.dispatchEvent(new Event("input",{bubbles:true}));}
                statusEl.textContent="✅ ✅ 已写回节点";
              }catch(ex){statusEl.textContent="❌ 写入失败: "+ex.message;}
            };
            /* copy */
            document.getElementById("ltp-ai-copy").onclick=function(){
              navigator.clipboard.writeText(result).then(function(){statusEl.textContent="✅ ✅ 已复制到剪贴板";}).catch(function(){
                var sel=window.getSelection();var r=document.createRange();var el=document.getElementById("ltp-ai-res-text");r.selectNodeContents(el);sel.removeAllRanges();sel.addRange(r);
                try{var ok=document.execCommand("copy");if(ok){sel.removeAllRanges();statusEl.textContent="✅ ✅ 已复制";return;}}catch(e){}
                statusEl.textContent="✅ 选中了结果文本，请按 Ctrl+C";
              });
            };
          }).catch(function(err){
            if(myGen!==_ltAIReqGen)return;
            statusEl.textContent="❌ 请求失败: "+err.message+" | model="+(api.model||"deepseek-v4-flash");
            btn.textContent="🚀 执行";btn.disabled=false;
            if(cancelBtn)cancelBtn.style.display="none";
          });
        };
        document.getElementById("ltp-ai-go").onclick=function(){
          var text=_ltAIInp.value.trim();
          if(!text)return;
          _ltDoAI(text,this);
        };
        document.getElementById("ltp-ai-cancel").onclick=function(){
          _ltAIReqGen++;
          var g=document.getElementById("ltp-ai-go");
          if(g){g.disabled=false;g.textContent="🚀 执行";}
          this.style.display="none";
          var s=document.getElementById("ltp-ai-status");
          if(s)s.textContent="已取消（后台回包将被忽略）";
        };
      }
      else if(_ltPActiveTab==="theme"){
        function _ltRenderTheme(){
          var cats=[["dark","\u6df1\u8272\u7cfb"],["light","\u6d45\u8272\u7cfb"],["high","\u9ad8\u5bf9\u6bd4"]],html="";
          cats.forEach(function(c){
            var items=_ltThemePresets.filter(function(t){return t.cat===c[0];});
            if(!items.length)return;
            html+='<div style="margin-top:10px;font-size:10px;color:rgba(255,255,255,0.25);letter-spacing:0.04em;margin-bottom:4px;">'+c[1]+'</div>';
            html+='<div style="display:flex;flex-wrap:wrap;gap:6px;">';
            items.forEach(function(t,i){
              var idx=_ltThemePresets.indexOf(t);
              var sel=t.a===_ltTheme.a&&t.cb===_ltTheme.cb?"2px solid var(--accent-light)":"1px solid rgba(255,255,255,0.06)";
              html+='<button class="ltp-theme-preset" data-idx="'+idx+'" style="width:76px;height:50px;border-radius:8px;border:'+sel+';cursor:pointer;padding:0;overflow:hidden;position:relative;transition:border-color .12s ease-out, box-shadow .12s ease-out;background:'+t.nb+';display:flex;flex-direction:column;">'
                +'<div style="height:6px;background:'+t.a+';flex-shrink:0;"></div>'
                +'<div style="flex:1;display:flex;align-items:center;justify-content:center;font-size:9px;color:rgba(255,255,255,0.4);overflow:hidden;">'+t.n+'</div>'
                +'</button>';
            });
            html+='</div>';
          });
          html+='<div style="margin-top:12px;display:flex;gap:6px;"><button class="lt-settings-btn lt-settings-btn-ghost lt-settings-btn-sm" id="ltp-theme-reset">\u91cd\u7f6e\u4e3a\u9884\u8bbe</button></div>';
          body.innerHTML=html;
          body.querySelectorAll(".ltp-theme-preset").forEach(function(b){
            b.onclick=function(){
              var idx=parseInt(this.getAttribute("data-idx")),t=_ltThemePresets[idx];
              _ltApplyTheme(t);
              _ltRenderTheme();
            };
          });
          document.getElementById("ltp-theme-reset").onclick=function(){
            var t=_ltThemePresets[0];
            _ltApplyTheme(t);
            _ltRenderTheme();
          };
        }
        _ltRenderTheme();
      }
      else if(_ltPActiveTab==="palette"){
        var _presets={
          "电影色调":["#2c1e30","#4a2c4a","#c9a227","#e8d5b7","#1a3a4a","#2d5a7b","#8b4513","#cd853f"],
          "赛博朋克":["#ff00ff","#00ffff","#ff1493","#00bfff","#ff6ec7","#7b68ee","#ff4500","#1c1c3c"],
          "莫兰迪":["#b5c4b1","#e8e0d4","#c9b8a8","#a8b5c4","#d4c5b9","#b9c4d4","#c4b5b1","#d4d0c5"],
          "马卡龙":["#ffb3ba","#bae1ff","#baffc9","#ffffba","#e8baff","#baffee","#ffd1ba","#d4baff"],
          "暖色系":["#ff6b35","#f7c59f","#efefd0","#ffb4a2","#e5989b","#b5838d","#6d6875","#ffcdb2"],
          "冷色系":["#023e8a","#0077b6","#0096c7","#00b4d8","#48cae4","#90e0ef","#ade8f4","#caf0f8"],
          "黑白灰":["#000000","#1a1a1a","#333333","#666666","#999999","#cccccc","#e5e5e5","#ffffff"],
          "高饱和":["#ff0000","#ff8800","#ffff00","#00ff00","#0088ff","#8800ff","#ff00ff","#00ffff"],
          "低饱和":["#8b7d72","#a0937e","#b8a99a","#c4b7a6","#d1c4b0","#e0d6c8","#ebe3d7","#f5f0e8"]
        };
        function _hex2rgb(h){h=h.replace("#","");return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
        function _rgb2hsl(r,g,b){r/=255;g/=255;b/=255;var mx=Math.max(r,g,b),mn=Math.min(r,g,b),h,s,l=(mx+mn)/2;if(mx===mn){h=s=0;}else{var d=mx-mn;s=l>0.5?d/(2-mx-mn):d/(mx+mn);switch(mx){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;case b:h=((r-g)/d+4)/6;break;}}return[Math.round(h*360),Math.round(s*100),Math.round(l*100)];}
        function _aiDesc(hex){var r=_hex2rgb(hex),hsl=_rgb2hsl(r[0],r[1],r[2]);var h=hsl[0],s=hsl[1],l=hsl[2];var desc="";if(l<15)desc="very dark";else if(l<35)desc="dark";else if(l<65)desc="mid-tone";else if(l<85)desc="light";else desc="very light";if(s<10)desc+=", almost gray";else if(s<30)desc+=", muted";else if(s<60)desc+=", moderate saturation";else desc+=", highly saturated";var hue="";if(h<15||h>=345)hue="red";else if(h<45)hue="orange";else if(h<70)hue="yellow";else if(h<160)hue="green";else if(h<200)hue="cyan";else if(h<260)hue="blue";else if(h<310)hue="purple";else hue="pink";return desc+" "+hue+" ("+hex+")";}
        var _recent;try{_recent=JSON.parse(localStorage.getItem("_lt_pal_recent")||"[]")||[];}catch(e){_recent=[];}
        function _saveRecent(c){_recent=_recent.filter(function(x){return x!==c;});_recent.unshift(c);if(_recent.length>20)_recent.pop();try{localStorage.setItem("_lt_pal_recent",JSON.stringify(_recent));}catch(e){}}
        function _copySwatch(el,color){navigator.clipboard.writeText(color).then(function(){el.classList.add("copied");setTimeout(function(){el.classList.remove("copied");},800);var toast=document.createElement("div");toast.className="ltp-pal-toast show";toast.textContent="Copied "+color.toUpperCase();document.body.appendChild(toast);setTimeout(function(){toast.classList.remove("show");setTimeout(function(){toast.remove();},300);},1200);_saveRecent(color);});}
        function _renderPalette(){
          var h='<div class="ltp-pal-picker"><input type="color" id="ltp-pal-pick" value="#818cf8"><div class="ltp-pal-info"><div class="ltp-pal-hex" id="ltp-pal-hex">#818CF8</div><div class="ltp-pal-rgb" id="ltp-pal-rgb">rgb(129, 140, 248)</div><div class="ltp-pal-hsl" id="ltp-pal-hsl">hsl(235, 91%, 74%)</div></div></div>';
          h+='<div class="ltp-pal-ai"><div class="ltp-pal-ai-desc" id="ltp-pal-ai-desc">muted blue (#818cf8)</div><button class="ltp-btn ltp-btn-primary ltp-btn-sm" id="ltp-pal-ai-copy">复制AI描述</button></div>';
          h+='<div class="ltp-pal-section"><div class="ltp-pal-section-title open">我的收藏</div><div class="ltp-pal-section-body" id="ltp-pal-fav"></div><button class="ltp-btn ltp-btn-ghost ltp-btn-sm" id="ltp-pal-add-fav" style="margin-top:6px;">+ 添加当前颜色</button></div>';
          if(_recent.length){
            h+='<div class="ltp-pal-section"><div class="ltp-pal-section-title">最近使用</div><div class="ltp-pal-section-body collapsed">',
            _recent.slice(0,16).forEach(function(c){
              h+='<div class="ltp-pal-swatch" style="background:'+c+'" data-color="'+c+'"><div class="ltp-pal-tip">'+c+'</div></div>';
            });
            h+='</div></div>';
          }
          Object.keys(_presets).forEach(function(name){
            h+='<div class="ltp-pal-section"><div class="ltp-pal-section-title" data-group="'+name+'">'+name+'</div><div class="ltp-pal-section-body collapsed" data-body="'+name+'">';
            _presets[name].forEach(function(c){
              h+='<div class="ltp-pal-swatch" style="background:'+c+'" data-color="'+c+'"><div class="ltp-pal-tip">'+c+'</div></div>';
            });
            h+='</div></div>';
          });
          body.innerHTML=h;
          var _fav;try{_fav=JSON.parse(localStorage.getItem("_lt_pal_fav")||"[]")||[];}catch(e){_fav=[];}
          function _renderFav(){var fb=document.getElementById("ltp-pal-fav");if(!fb)return;fb.innerHTML="";_fav.forEach(function(c,i){var s=document.createElement("div");s.className="ltp-pal-swatch";s.style.background=c;s.setAttribute("data-color",c);s.innerHTML='<div class="ltp-pal-tip">'+_ltEsc(c)+'</div>';s.onclick=function(){_copySwatch(s,c);_updPicker(c);};fb.appendChild(s);});}
          _renderFav();
          function _updPicker(hex){document.getElementById("ltp-pal-pick").value=hex;document.getElementById("ltp-pal-hex").textContent=hex.toUpperCase();var rgb=_hex2rgb(hex);document.getElementById("ltp-pal-rgb").textContent="rgb("+rgb.join(", ")+")";var hsl=_rgb2hsl(rgb[0],rgb[1],rgb[2]);document.getElementById("ltp-pal-hsl").textContent="hsl("+hsl[0]+", "+hsl[1]+"%, "+hsl[2]+"%)";document.getElementById("ltp-pal-ai-desc").textContent=_aiDesc(hex);}
          document.getElementById("ltp-pal-pick").oninput=function(){_updPicker(this.value);};
          body.querySelectorAll(".ltp-pal-swatch").forEach(function(s){s.onclick=function(){var c=this.getAttribute("data-color");_copySwatch(s,c);_updPicker(c);};});
          body.querySelectorAll(".ltp-pal-section-title").forEach(function(t){t.onclick=function(){var b=this.nextElementSibling;if(b)b.classList.toggle("collapsed");this.classList.toggle("open");};});
          document.getElementById("ltp-pal-hex").onclick=function(){var v=this.textContent;navigator.clipboard.writeText(v);var toast=document.createElement("div");toast.className="ltp-pal-toast show";toast.textContent="Copied "+v;document.body.appendChild(toast);setTimeout(function(){toast.classList.remove("show");setTimeout(function(){toast.remove();},300);},1200);};
          document.getElementById("ltp-pal-rgb").onclick=function(){var v=this.textContent;navigator.clipboard.writeText(v);var toast=document.createElement("div");toast.className="ltp-pal-toast show";toast.textContent="Copied "+v;document.body.appendChild(toast);setTimeout(function(){toast.classList.remove("show");setTimeout(function(){toast.remove();},300);},1200);};
          document.getElementById("ltp-pal-hsl").onclick=function(){var v=this.textContent;navigator.clipboard.writeText(v);var toast=document.createElement("div");toast.className="ltp-pal-toast show";toast.textContent="Copied "+v;document.body.appendChild(toast);setTimeout(function(){toast.classList.remove("show");setTimeout(function(){toast.remove();},300);},1200);};
          document.getElementById("ltp-pal-ai-copy").onclick=function(){var v=document.getElementById("ltp-pal-ai-desc").textContent;navigator.clipboard.writeText(v);var toast=document.createElement("div");toast.className="ltp-pal-toast show";toast.textContent="Copied AI描述";document.body.appendChild(toast);setTimeout(function(){toast.classList.remove("show");setTimeout(function(){toast.remove();},300);},1200);};
          document.getElementById("ltp-pal-add-fav").onclick=function(){var hex=document.getElementById("ltp-pal-pick").value;if(!_fav.includes(hex)){_fav.push(hex);try{localStorage.setItem("_lt_pal_fav",JSON.stringify(_fav));}catch(e){}_renderFav();}};
        }
        _renderPalette();
      }
      else if(_ltPActiveTab==="settings"){
        var existing=document.getElementById("lt-settings");
        if(existing){existing.remove();return;}
        var p=document.getElementById("libtv-prompt");
        if(p)p.remove();
        _ltSettingsPanel();
        return;
      }
    }
    var div=document.createElement("div");
    div.id="libtv-prompt";
    div.innerHTML='<div class="ltp-head"><h3>提示词工具</h3><div style="display:flex;align-items:center;gap:4px"><span class="ltp-acc-btn" id="ltp-acc-btn" title="账号切换"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span><span class="ltp-close" id="ltp-close">✕</span></div></div>'
      +'<div class="ltp-tabs"><span class="ltp-tab active" data-tab="templates">模板</span><span class="ltp-tab" data-tab="palette">调色</span><span class="ltp-tab" data-tab="ai">AI 增强</span><span class="ltp-tab" data-tab="theme">主题</span><span class="ltp-tab" data-tab="settings">设置</span></div>'
      +'<div id="ltp-body" class="ltp-body"></div>'
      +'<div style="display:flex;gap:6px;padding:8px 16px 12px;border-top:1px solid rgba(var(--accent-light-rgb),0.12);">'
      +'<button class="ltp-btn ltp-btn-primary ltp-btn-sm" id="ltp-add">+ 新增模板</button>'
      +'<button class="ltp-btn ltp-btn-ghost ltp-btn-sm" id="ltp-reset">恢复默认模板</button>'
      +'</div>';
    document.body.appendChild(div);
    if(!anchor||!anchor.getBoundingClientRect){
      div.style.left="50%"; div.style.top="50%";
      div.style.transform="translate(-50%,-50%)";
    }
    renderBody();
    /* M9：mousemove→rAF 合并 + 读写分离（基线 24ms/事件：逐项边 getBoundingClientRect 边写样式
       造成布局抖动；先批量读 rect 再批量写变量，每帧一次布局） */
    var _ltSpotX=0,_ltSpotY=0,_ltSpotRaf=0;
    div.addEventListener("mousemove",function(e){
      _ltSpotX=e.clientX;_ltSpotY=e.clientY;
      if(_ltSpotRaf)return;
      _ltSpotRaf=requestAnimationFrame(function(){
        _ltSpotRaf=0;
        var items=div.querySelectorAll(".ltp-item");
        if(!items.length)return;
        var rects=[];
        for(var i=0;i<items.length;i++)rects.push(items[i].getBoundingClientRect());
        for(var j=0;j<items.length;j++){
          items[j].style.setProperty("--mx",(_ltSpotX-rects[j].left)+"px");
          items[j].style.setProperty("--my",(_ltSpotY-rects[j].top)+"px");
        }
      });
    });
    function _ltGetCookies(){return document.cookie;}
    function _ltSetCookies(s){if(!s)return;s.split("; ").forEach(function(p){var i=p.indexOf("=");if(i<1)return;document.cookie=p.slice(0,i)+"="+p.slice(i+1)+"; path=/";});}
    function _ltSaveLS(){var o={};for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k.indexOf("_lt_")!==0)o[k]=localStorage.getItem(k);}return o;}
    function _ltRestoreLS(o){if(!o)return;for(var k in o){if(o.hasOwnProperty(k)&&k.indexOf("_lt_")!==0){try{localStorage.setItem(k,o[k]);}catch(e){}}}}
    /* 账号备份只走 IndexedDB：cookie 备份（_lt_acc_bak）会把所有已存账号的会话凭据随每个请求发往站点，已移除 */
    function _ltAccBackup(){try{var d=localStorage.getItem("_lt_accounts");if(d)_ltIDBSet("_lt_accounts",d);}catch(e){}}
    function _ltAccTryRestore(){try{if(localStorage.getItem("_lt_accounts"))return;_ltIDBGet("_lt_accounts",function(d){if(d&&!localStorage.getItem("_lt_accounts")){if(_ltAccValid(d)){try{localStorage.setItem("_lt_accounts",d);}catch(e){}}}});}catch(e){}}
    function _ltAccList(){_ltAccTryRestore();try{return JSON.parse(localStorage.getItem("_lt_accounts")||"[]");}catch(e){return [];}}
    function _ltAccSave(name){var a=_ltAccList();a.push({id:Date.now().toString(36),name:name,cookies:_ltGetCookies(),ls:_ltSaveLS(),created:Date.now()});try{localStorage.setItem("_lt_accounts",JSON.stringify(a));_ltAccBackup();}catch(e){}}
    function _ltAccRefresh(id){var a=_ltAccList();for(var i=0;i<a.length;i++){if(a[i].id===id){a[i].cookies=_ltGetCookies();a[i].ls=_ltSaveLS();a[i].created=Date.now();try{localStorage.setItem("_lt_accounts",JSON.stringify(a));_ltAccBackup();}catch(e){}break;}}_ltAccPanel();}
    function _ltAccSwitch(id){var a=_ltAccList();for(var i=0;i<a.length;i++){if(a[i].id===id){_ltSetCookies(a[i].cookies);_ltRestoreLS(a[i].ls);location.reload();return;}}_ltToast("切换失败：未找到该账号（数据可能已损坏）");}
    function _ltAccDelete(id){var a=_ltAccList();for(var i=0;i<a.length;i++){if(a[i].id===id){a.splice(i,1);try{localStorage.setItem("_lt_accounts",JSON.stringify(a));_ltAccBackup();}catch(e){}break;}}_ltAccPanel();}
    function _ltAccTime(t){var d=new Date(t);return (d.getMonth()+1)+"/"+d.getDate()+" "+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");}
    function _ltAccPanel(){
      var e=document.getElementById("lt-acc-panel");if(e){e.remove();return;}
      var btn=document.getElementById("ltp-acc-btn");if(!btn)return;
      var r=btn.getBoundingClientRect();
      var a=_ltAccList();
      var p=document.createElement("div");p.id="lt-acc-panel";
      var h="<div class=\"acc-title\">\u8d26\u53f7\u5207\u6362</div>";
      if(!a.length){h+="<div class=\"acc-empty\">\u6682\u65e0\u4fdd\u5b58\u7684\u8d26\u53f7</div>";}
      else{h+="<div class=\"acc-list\">";
      for(var i=0;i<a.length;i++){
        var c=a[i];
        var age=_ltAccTime(c.created);
        h+="<div class=\"acc-item\" data-id=\""+c.id+"\"><div style=\"flex:1;min-width:0\"><div style=\"display:flex;align-items:center;gap:6px\"><span class=\"acc-name\">"+_ltEsc(c.name)+"</span><span class=\"acc-badge\">"+age+"</span></div></div><div style=\"display:flex;align-items:center;gap:4px\"><span class=\"acc-swt\" data-id=\""+c.id+"\">\u5207\u6362</span><span class=\"acc-upd\" data-id=\""+c.id+"\" title=\"刷新\u2014\u7528\u5f53\u524d\u767b\u5f55\u72b6\u6001\u66f4\u65b0\u6b64\u8d26\u53f7\">\u21bb</span><span class=\"acc-del\" data-id=\""+c.id+"\" title=\"\u5220\u9664\">\u2715</span></div></div>";
      }
      h+="</div>";}
      h+="<div class=\"acc-div\"></div><div class=\"acc-add\" id=\"lt-acc-add\"><span>+</span> \u4fdd\u5b58\u5f53\u524d\u8d26\u53f7</div>";
      p.innerHTML=h;
      p.style.left=Math.max(4,Math.min(r.left+p.offsetWidth-220,window.innerWidth-224))+"px";
      p.style.top=(r.bottom+6)+"px";
      document.body.appendChild(p);
      /* \u5207\u6362 */
      p.querySelectorAll(".acc-swt").forEach(function(el){el.onclick=function(e){e.stopPropagation();_ltAccSwitch(this.getAttribute("data-id"));};});
      /* \u5237\u65b0 */
      p.querySelectorAll(".acc-upd").forEach(function(el){el.onclick=function(e){e.stopPropagation();_ltAccRefresh(this.getAttribute("data-id"));};});
      /* \u5220\u9664 */
      p.querySelectorAll(".acc-del").forEach(function(el){el.onclick=function(e){e.stopPropagation();_ltAccDelete(this.getAttribute("data-id"));};});
      /* \u4fdd\u5b58 */
      document.getElementById("lt-acc-add").onclick=function(){
        var nn=prompt("\u8bf7\u8f93\u5165\u8d26\u53f7\u540d\u79f0\uff1a","\u4e3b\u53f7");if(nn===null||!nn.trim())return;
        _ltAccSave(nn.trim());_ltAccPanel();
      };
      /* \u70b9\u51fb\u5916\u90e8\u5173\u95ed */
      setTimeout(function(){document.addEventListener("click",function _c(e){if(!p.contains(e.target)&&e.target!==btn){p.remove();document.removeEventListener("click",_c);}},{once:true});},0);
    }
    document.getElementById("ltp-acc-btn").onclick=_ltAccPanel;
    document.getElementById("ltp-close").onclick=function(){div.remove();};
    document.getElementById("ltp-add").onclick=function(){
      _ltPromptFormModal(null,function(r){
        _ltPrompts.push({id:"p"+Date.now(),name:r.name,content:r.content,category:r.category||"\u901a\u7528"});
        savePrompts(); renderBody();
      });
    };
    document.getElementById("ltp-reset").onclick=function(){
      if(!confirm("恢复默认模板将覆盖当前所有模板，确认？"))return;
      _ltPrompts=[
        {id:"d1",name:"产品摄影",category:"图像",content:"Product photography on {background=white} background, {lighting=studio lighting}, high detail, 8K, sharp focus, {extra}"},
        {id:"d2",name:"电影镜头",category:"图像",content:"Cinematic shot, {lens=anamorphic} lens, {lighting=dramatic} lighting, shallow depth of field, {style}"},
        {id:"d3",name:"动画-吉卜力风",category:"图像",content:"Studio Ghibli style, hand-drawn animation, {palette=soft pastel} colors, {atmosphere=whimsical}"},
        {id:"d4",name:"产品展示-环绕",category:"视频",content:"Smooth 360 orbit around {subject=product}, {lighting=soft studio} lighting, slow motion, {extra}"},
        {id:"d5",name:"风光-延时",category:"视频",content:"Timelapse, {time=golden hour}, {sky=dramatic clouds}, warm tones, smooth transition, {extra}"},
      ];
      savePrompts(); renderBody();
    };
    div.querySelectorAll(".ltp-tab").forEach(function(t){t.onclick=function(){_ltPActiveTab=this.getAttribute("data-tab");div.querySelectorAll(".ltp-tab").forEach(function(x){x.classList.toggle("active",x===t);});renderBody();};});
    window._ltPromptRefresh=function(){var d=document.getElementById("libtv-prompt");if(d){try{_ltPrompts=JSON.parse(localStorage.getItem("_lt_prompts")||"[]")||[];}catch(e){_ltPrompts=[];}renderBody();}};
  }
  var _ltTagLibs=null;
  try{_ltTagLibs=JSON.parse(localStorage.getItem("_lt_tag_libs")||"null");}catch(e){_ltTagLibs=null;}
  if(!_ltTagLibs){
    _ltTagLibs={"默认标签":{categories:[
      {name:"常规标签",icon:"⭐",groups:[
        {name:"画质",open:true,items:["杰作","写实","提高质量","最佳质量","高分辨率","超高分辨率","超高清","更多细节","简单背景","模糊背景","清晰背景","清晰细节","超精细绘画","聚焦清晰","物理渲染","极详细刻画","改善细节","添加鲜艳色彩","扫描"]},
        {name:"负面标签",open:false,items:["低质量","模糊","畸形","多余手指","水印","签名","丑陋","变形","低分辨率","噪点","抖动","糟糕构图","文本","拼贴","多余的文字"]},
        {name:"摄影",open:false,items:["摄影","单反","胶片颗粒","移轴","长曝光","微距摄影","人像摄影","风景摄影"]},
        {name:"光影",open:false,items:["工作室光照","戏剧性光照","柔光","黄金时刻","霓虹灯光","轮廓光","体积光","电影光照"]},
        {name:"构图",open:false,items:["特写","广角","鸟瞰","低角度","对称构图","三分法","居中构图","前景"]}
      ]},
      {name:"艺术题材",icon:"🎨",groups:[
        {name:"题材",open:false,items:["奇幻","科幻","赛博朋克","蒸汽朋克","水墨","浮世绘","像素艺术","低多边形","超现实主义","复古"]}
      ]},
      {name:"人物类",icon:"👤",groups:[
        {name:"人物",open:false,items:["女孩","男孩","少女","少年","女人","男人","老者","儿童","多人","角色设计","五官精致","红发","蓝眼"]}
      ]},
      {name:"场景",icon:"🏞",groups:[
        {name:"场景",open:false,items:["城市","森林","山脉","海滩","星空","室内","废墟","花园","雪景","夜景","雨天"]}
      ]}
    ]}};
    try{localStorage.setItem("_lt_tag_libs",JSON.stringify(_ltTagLibs));}catch(e){}
  }
  var _ltCurLib=localStorage.getItem("_lt_cur_lib")||"默认标签";
  if(!_ltTagLibs[_ltCurLib])_ltCurLib=Object.keys(_ltTagLibs)[0];
  var _ltTagActiveCat=0;
  var _ltTagSearch="";
  var _ltRecentTags=[];
  try{_ltRecentTags=JSON.parse(localStorage.getItem("_lt_recent")||"[]");}catch(e){_ltRecentTags=[];}
  var _ltTagMenuEl=null,_ltTagInputEl=null;
  function _ltCurLibCats(){var l=_ltTagLibs[_ltCurLib];return l&&l.categories?l.categories:[];}
  function _ltCurCatGroups(){var c=_ltCurLibCats()[_ltTagActiveCat];return c&&c.groups?c.groups:[];}
  function _ltSaveLibs(){try{localStorage.setItem("_lt_tag_libs",JSON.stringify(_ltTagLibs));localStorage.setItem("_lt_cur_lib",_ltCurLib);}catch(e){}}
  window._ltTagRefresh=function(){var s=localStorage.getItem("_lt_tag_libs");if(s){try{_ltTagLibs=JSON.parse(s);}catch(e){}}if(!_ltTagLibs[_ltCurLib])_ltCurLib=Object.keys(_ltTagLibs)[0];if(_ltTagMenuEl)_ltRenderTagMenu();};
  function _ltPushRecent(t){t=String(t);if(!t)return;_ltRecentTags=_ltRecentTags.filter(function(x){return x!==t;});_ltRecentTags.push(t);if(_ltRecentTags.length>40)_ltRecentTags=_ltRecentTags.slice(-40);try{localStorage.setItem("_lt_recent",JSON.stringify(_ltRecentTags));}catch(e){}if(_ltTagMenuEl&&_ltTagActiveCat>=_ltCurLibCats().length)_ltRenderTagMenu();}
  function _ltInsertTagAtCursor(tagText){
    var ta=_ltTagInputEl; if(!ta)return;
    if(ta.tagName==="TEXTAREA"||(ta.tagName==="INPUT"&&ta.type==="text")){
      var start=ta.selectionStart,end=ta.selectionEnd,val=ta.value;
      var before=val.slice(0,start);
      var sep=(before.length>0&&!/[\s,，]$/.test(before))?", ":"";
      var ins=sep+tagText;
      var newVal=val.slice(0,start)+ins+val.slice(end);
      var proto=ta.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      var nativeSetter=Object.getOwnPropertyDescriptor(proto,"value").set;
      nativeSetter.call(ta,newVal);
      var pos=start+ins.length;
      ta.setSelectionRange(pos,pos);
      ta.dispatchEvent(new Event("input",{bubbles:true}));
    }else if(ta.isContentEditable){
      var sel=window.getSelection();
      if(!sel||!sel.rangeCount){var pre0=ta.textContent;ta.appendChild(document.createTextNode((pre0&&pre0.length?", ":"")+tagText));}
      else{
        var r=sel.getRangeAt(0);
        var pr=r.cloneRange();pr.selectNodeContents(ta);pr.setEnd(r.startContainer,r.startOffset);
        var beforeText=pr.toString();
        var sep=(beforeText.length>0&&!/[\s,，]$/.test(beforeText))?", ":"";
        r.deleteContents();
        r.insertNode(document.createTextNode(sep+tagText));
        r.collapse(false);
        sel.removeAllRanges();sel.addRange(r);
      }
      ta.dispatchEvent(new Event("input",{bubbles:true}));
    }
    ta.focus();
  }
  function _ltRenderCat(cat){
    if(!cat)return "";
    var h="";
    if(_ltRecentTags.length){
      h+="<div class=\"lt-tag-recent\"><div class=\"lt-tag-recent-head\">最近使用<span class=\"lt-rec-clear\">清空</span></div><div class=\"lt-tag-grid\">";
      _ltRecentTags.slice(-10).reverse().forEach(function(t){var s=_ltEsc(t);h+="<div class=\"lt-tag-item\" data-text=\""+s+"\" title=\""+s+"\">"+s+"</div>";});
      h+="</div></div>";
    }
    (cat.groups||[]).forEach(function(g,gi){
      h+="<div class=\"lt-tag-group\">";
      h+="<div class=\"lt-tag-group-head\" data-gi=\""+gi+"\"><span class=\"lt-tag-group-name\">"+_ltEsc(g.name)+"</span><span class=\"lt-tag-group-actions\"><span class=\"lt-tag-add-item\" data-gi=\""+gi+"\" title=\"新增标签\">+</span><span class=\"lt-tag-arrow "+(g.open?"open":"")+"\">▾</span></span></div>";
      if(g.open){
        h+="<div class=\"lt-tag-grid\">";
        (g.items||[]).forEach(function(it){var s=_ltEsc(it);h+="<div class=\"lt-tag-item\" data-text=\""+s+"\" title=\""+s+"\">"+s+"</div>";});
        h+="</div>";
      }
      h+="</div>";
    });
    h+="<div class=\"lt-tag-add-group-wrap\"><span class=\"lt-tag-add-group\">+ 新增分组</span></div>";
    return h;
  }
  function _ltRenderSearch(){
    var q=_ltTagSearch,h="<div class=\"lt-tag-search-hint\">搜索：“"+q+"”</div>",found=false;
    _ltCurLibCats().forEach(function(cat){
      (cat.groups||[]).forEach(function(g){
        var ms=(g.items||[]).filter(function(it){return String(it).toLowerCase().indexOf(q)>=0;});
        if(ms.length){
          found=true;
          h+="<div class=\"lt-tag-group\"><div class=\"lt-tag-group-head-static\"><span class=\"lt-tag-group-name\">"+_ltEsc(cat.name)+" · "+_ltEsc(g.name)+"</span></div><div class=\"lt-tag-grid\">";
          ms.forEach(function(it){var s=_ltEsc(it);h+="<div class=\"lt-tag-item\" data-text=\""+s+"\" title=\""+s+"\">"+s+"</div>";});
          h+="</div></div>";
        }
      });
    });
    if(!found)h+="<div class=\"lt-tag-empty\">无匹配标签</div>";
    return h;
  }
  function _ltRenderInserted(){
    var h="<div class=\"lt-tag-ins-head\">已插入<span class=\"lt-ins-clear\">清空</span></div>";
    if(!_ltRecentTags.length){h+="<div class=\"lt-tag-empty\">还没有插入过标签</div>";return h;}
    h+="<div class=\"lt-tag-grid\">";
    _ltRecentTags.slice().reverse().forEach(function(t){var s=_ltEsc(t);h+="<div class=\"lt-tag-item\" data-text=\""+s+"\" title=\""+s+"\">"+s+"</div>";});
    h+="</div>";
    return h;
  }
  function _ltRenderTagMenu(){
    if(!_ltTagMenuEl)return;
    var cats=_ltCurLibCats();
    var isInserted=_ltTagActiveCat>=cats.length;
    var sel=_ltTagMenuEl.querySelector("#lt-tag-lib");
    if(sel)sel.innerHTML=Object.keys(_ltTagLibs).map(function(n){return "<option value=\""+_ltEsc(n)+"\""+(_ltCurLib===n?" selected":"")+">"+_ltEsc(n)+"</option>";}).join("");
    var tabs=_ltTagMenuEl.querySelector("#lt-tag-tabs");
    var th="";
    cats.forEach(function(c,i){th+="<span class=\"lt-tag-tab"+(i===_ltTagActiveCat?" active":"")+"\" data-cat=\""+i+"\">"+(c.icon?_ltEsc(c.icon)+" ":"")+_ltEsc(c.name)+"</span>";});
    th+="<span class=\"lt-tag-tab"+(isInserted?" active":"")+"\" data-cat=\"ins\">已插入</span>";
    th+="<span class=\"lt-tag-add\" id=\"lt-tag-add-cat\" title=\"新增分类\">+</span>";
    tabs.innerHTML=th;
    var content=_ltTagMenuEl.querySelector("#lt-tag-content");
    if(isInserted)content.innerHTML=_ltRenderInserted();
    else if(_ltTagSearch)content.innerHTML=_ltRenderSearch();
    else content.innerHTML=_ltRenderCat(cats[_ltTagActiveCat]);
  }
  function _ltPosTagMenu(){
    if(!_ltTagMenuEl||!_ltTagInputEl)return;
    var mw=_ltTagMenuEl.offsetWidth||688,mh=_ltTagMenuEl.offsetHeight||420;
    var icon=_ltTagInputEl.parentNode?_ltTagInputEl.parentNode.querySelector(".lt-tag-icon"):null;
    var ir=icon?icon.getBoundingClientRect():_ltTagInputEl.getBoundingClientRect();
    var l=ir.right; if(l+mw>window.innerWidth-8)l=window.innerWidth-8-mw; if(l<8)l=8;
    var t=ir.top-mh; if(t<8)t=ir.bottom+6;
    _ltTagMenuEl.style.left=l+"px";_ltTagMenuEl.style.top=t+"px";
  }
  /* ── 通用拖拽：按住面板头部拖动（排除内部可交互元素） ── */
  function _ltMakeDraggable(el,handle){
    if(!el||!handle)return;
    handle.style.cursor="grab";
    handle.addEventListener("mousedown",function(e){
      if(e.button!==0)return;
      if(e.target.closest("button,input,select,textarea,a,[contenteditable='true'],#lt-ap-close"))return;
      e.preventDefault();
      var sx=e.clientX,sy=e.clientY;
      var r=el.getBoundingClientRect();
      var ol=r.left,ot=r.top;
      var mw=el.offsetWidth,mh=el.offsetHeight;
      function mm(ev){
        var l=Math.max(4,Math.min(ol+(ev.clientX-sx),window.innerWidth-mw-4));
        var t=Math.max(4,Math.min(ot+(ev.clientY-sy),window.innerHeight-mh-4));
        el.style.left=l+"px";el.style.top=t+"px";
      }
      function mu(){
        document.removeEventListener("mousemove",mm);
        document.removeEventListener("mouseup",mu);
        document.body.style.userSelect="";
        document.body.classList.remove("lt-dragging");
      }
      document.addEventListener("mousemove",mm);
      document.addEventListener("mouseup",mu);
      document.body.style.userSelect="none";
      document.body.classList.add("lt-dragging");
    });
  }
  /* ── AI 对话请求：失败时自动尝试 /chat/completions、/v1/chat/completions 端点，测试与 AI 调用共用，避免假阳性 ── */
  function _ltAIChat(url,key,body){
    var base=(url||"").trim().replace(/\/+$/,"");
    if(!base)return Promise.reject(new Error("API URL \u672a\u914d\u7f6e"));
    var attempts=[base];
    if(!/\/chat\/completions$/.test(base))attempts.push(base+"/chat/completions");
    if(!/\/chat\/completions$/.test(base)&&!/\/v1\/?$/.test(base))attempts.push(base+"/v1/chat/completions");
    var i=0,lastErr="";
    return new Promise(function(res,rej){
      function next(){
        var u=attempts[i++];
        if(!u){rej(new Error(lastErr||"\u6240\u6709\u7aef\u70b9\u5747\u5931\u8d25"));return;}
        _ltXHR({method:"POST",url:u,headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},body:JSON.stringify(body)})
        .then(function(o){
          if(!o.r.ok){
            lastErr="HTTP "+o.r.status+(o.t?" "+o.t.slice(0,150):"")+" @ "+u;
            if((o.r.status===404||o.r.status===405)&&i<attempts.length)return next();
            throw new Error(lastErr);
          }
          var d;
          try{d=JSON.parse(o.t);}catch(e){d=null;}
          if(d&&d.success===false){
            lastErr=(d.error?String(d.error).slice(0,200):(o.t||"").slice(0,150))+" @ "+u;
            if(i<attempts.length)return next();
            throw new Error(lastErr);
          }
          if(!d||!d.choices||!d.choices[0]||!d.choices[0].message){
            lastErr="\u54cd\u5e94\u7f3a\u5c11 choices: "+(o.t||"").slice(0,150)+" @ "+u;
            if(i<attempts.length)return next();
            throw new Error(lastErr);
          }
          res(d);
        })
        .catch(function(err){rej(err);});
      }
      next();
    });
  }
  /* ── 提取对话结果文本：兼容 reasoning_content / 多段 content / 空内容警示 ── */
  function _ltMsgText(d){
    var m=null;
    try{m=d.choices&&d.choices[0]&&d.choices[0].message;}catch(e){}
    if(!m)return "";
    var c=m.content;
    if(c==null||c==="")c=m.reasoning_content;
    if(c==null)return "";
    if(typeof c==="string")return c;
    if(Array.isArray(c))return c.map(function(p){return p&&p.text?p.text:"";}).join("");
    return String(c);
  }
  function _ltShowTagMenu(ta){
    _ltCloseTagMenu();
    _ltTagInputEl=ta;
    var div=document.createElement("div");div.className="lt-tag-menu";div.id="lt-tag-menu";
    div.innerHTML=
      "<div class=\"lt-tag-header\">"
      +"<select class=\"lt-tag-lib\" id=\"lt-tag-lib\"></select>"
      +"<input class=\"lt-tag-search\" id=\"lt-tag-search\" placeholder=\"搜索标签...\">"
      +"<button class=\"lt-tag-refresh\" id=\"lt-tag-refresh\" title=\"刷新/重置\">⟳</button>"
      +"<button class=\"lt-tag-close\" id=\"lt-tag-close\" title=\"关闭\">✕</button>"
      +"</div>"
      +"<div class=\"lt-tag-tabs\" id=\"lt-tag-tabs\"></div>"
      +"<div class=\"lt-tag-content\" id=\"lt-tag-content\"></div>"
      +"<div class=\"lt-tag-resize\" id=\"lt-tag-resize\" title=\"拖拽调整大小\"></div>";
    document.body.appendChild(div);
    _ltTagMenuEl=div;
    var libSel=div.querySelector("#lt-tag-lib");
    libSel.onchange=function(){_ltCurLib=libSel.value;_ltTagActiveCat=0;_ltSaveLibs();_ltRenderTagMenu();};
    var search=div.querySelector("#lt-tag-search");
    search.oninput=function(){_ltTagSearch=search.value.trim().toLowerCase();_ltRenderTagMenu();};
    div.querySelector("#lt-tag-refresh").onclick=function(){search.value="";_ltTagSearch="";_ltTagActiveCat=0;_ltRenderTagMenu();};
    div.querySelector("#lt-tag-close").onclick=_ltCloseTagMenu;
    div.querySelector("#lt-tag-tabs").addEventListener("click",function(e){
      var tab=e.target.closest(".lt-tag-tab");
      if(tab){var v=tab.getAttribute("data-cat");_ltTagActiveCat=(v==="ins")?_ltCurLibCats().length:parseInt(v);_ltRenderTagMenu();return;}
      var ac=e.target.closest("#lt-tag-add-cat");
      if(ac){var n=prompt("新分类名称：");if(n&&n.trim()){_ltCurLibCats().push({name:n.trim(),icon:"",groups:[{name:"新分组",open:true,items:[]}]});_ltSaveLibs();_ltTagActiveCat=_ltCurLibCats().length-1;_ltRenderTagMenu();}}
    });
    div.querySelector("#lt-tag-content").addEventListener("click",function(e){
      var item=e.target.closest(".lt-tag-item");
      if(item){_ltInsertTagAtCursor(item.getAttribute("data-text"));_ltPushRecent(item.getAttribute("data-text"));if(_ltTagActiveCat>=_ltCurLibCats().length)_ltRenderTagMenu();return;}
      var ai=e.target.closest(".lt-tag-add-item");
      if(ai){var gi=parseInt(ai.getAttribute("data-gi"));var txt=prompt("新标签：");if(txt&&txt.trim()){_ltCurCatGroups()[gi].items.push(txt.trim());_ltSaveLibs();_ltRenderTagMenu();}return;}
      var gh=e.target.closest(".lt-tag-group-head");
      if(gh){var gi=parseInt(gh.getAttribute("data-gi"));var g=_ltCurCatGroups()[gi];if(g){g.open=!g.open;_ltSaveLibs();_ltRenderTagMenu();}return;}
      var ag=e.target.closest(".lt-tag-add-group");
      if(ag){var n=prompt("新分组名称：");if(n&&n.trim()){_ltCurCatGroups().push({name:n.trim(),open:true,items:[]});_ltSaveLibs();_ltRenderTagMenu();}return;}
      var rc=e.target.closest(".lt-rec-clear");
      if(rc){_ltRecentTags=[];try{localStorage.removeItem("_lt_recent");}catch(ex){}_ltRenderTagMenu();return;}
      var ic=e.target.closest(".lt-ins-clear");
      if(ic){_ltRecentTags=[];try{localStorage.removeItem("_lt_recent");}catch(ex){}_ltRenderTagMenu();return;}
    });
    _ltRenderTagMenu();
    _ltPosTagMenu();
    var head=div.querySelector(".lt-tag-header");
    if(head)_ltMakeDraggable(div,head);
    var rz=div.querySelector("#lt-tag-resize");
    rz.addEventListener("mousedown",function(ev){
      ev.preventDefault();ev.stopPropagation();
      var sw=div.offsetWidth,sh=div.offsetHeight,sx=ev.clientX,sy=ev.clientY;
      var left=parseInt(div.style.left)||0,top=parseInt(div.style.top)||0;
      function mm(e){
        var nw=Math.max(240,sw+(e.clientX-sx));
        var nh=Math.max(160,sh+(e.clientY-sy));
        if(left+nw>window.innerWidth-8)nw=window.innerWidth-8-left;
        if(top+nh>window.innerHeight-8)nh=window.innerHeight-8-top;
        div.style.width=nw+"px";div.style.height=nh+"px";div.style.maxHeight=nh+"px";
      }
      function mu(){document.removeEventListener("mousemove",mm);document.removeEventListener("mouseup",mu);document.body.style.userSelect="";}
      document.addEventListener("mousemove",mm);
      document.addEventListener("mouseup",mu);
      document.body.style.userSelect="none";
    });
  }
  function _ltCloseTagMenu(){
    var el=document.getElementById("lt-tag-menu");if(el)el.remove();
    _ltTagMenuEl=null;_ltTagInputEl=null;
  }
  /* 标签管理已移至面板内联（新增标签 / 分组 / 分类） */
  (function(){
    var _ltScanStats={runs:0,found:0,visible:0,nodeInp:0,tagInj:0,aiInj:0,last:0,details:[]};
    function _ltTagScan(){
      _ltScanStats.runs++;
      _ltScanStats.visible=0;_ltScanStats.nodeInp=0;_ltScanStats.tagInj=0;_ltScanStats.aiInj=0;
      var els=document.querySelectorAll("textarea,input,[contenteditable]:not([contenteditable=\"false\"])");
      _ltScanStats.found=els.length;
      _ltScanStats.details=[];
      /* filter to only canvas node inputs (skip page-level search bars, etc.) */
      /* 提示词编辑器识别：节点内 + 可编辑(textarea/contenteditable) + 编辑器白名单 class */
      function _ltIsNodeInput(el){
        if(!el.closest(".react-flow__node"))return false;
        var _ce=el.getAttribute&&el.getAttribute("contenteditable");
        if(_ce==="false")return false;
        if(el.tagName==="TEXTAREA")return true;
        if(!el.closest("[contenteditable]"))return false;
        return el.closest("[class*=\"ChatRichInput\"],[class*=\"RichInput\"],[class*=\"chat-rich\"],[class*=\"prompt-editor\"],[class*=\"PromptEditor\"],[class*=\"canvas-prompt\"],[class*=\"text-fg-default\"]")!==null;
      }
      var _ltSkipTypes={hidden:1,checkbox:1,radio:1,button:1,submit:1,reset:1,file:1,image:1};

      els.forEach(function(ta){
        if(ta.tagName==="INPUT"&&_ltSkipTypes[(ta.type||"").toLowerCase()])return;
        var rects=0;
        try{rects=ta.getClientRects?ta.getClientRects().length:0;}catch(e){}
        var isNode=_ltIsNodeInput(ta);
        if(_ltScanStats.details.length<8){
          _ltScanStats.details.push((ta.tagName||"?")+" type="+((ta.getAttribute&&ta.getAttribute("type"))||ta.type||"")+" ce="+((ta.getAttribute&&ta.getAttribute("contenteditable"))||"")+" vis="+(rects>0)+" node="+isNode+" cls="+String(ta.className||"").slice(0,60));
        }
        if(rects===0)return;
        _ltScanStats.visible++;
        if(!isNode)return;
        _ltScanStats.nodeInp++;
        /* 已注册过？复用并同步位置 */
        var f=null;
        for(var _i=0;_i<_ltFloatIcons.length;_i++){if(_ltFloatIcons[_i].ta===ta){f=_ltFloatIcons[_i];break;}}
        if(f){_ltSyncOne(f);return;}
        /* 浮动图标（挂 body，不进 React 树，避免重渲染被清除）。
           z-index 压到 150：高于普通页面内容与画布（画布被 viewport transform 锁在低层级上下文），
           低于站点弹层（站点是 Mantine 7，Modal 200 / Popover 300 / AppShell 99），
           否则打开各类菜单或原图查看器时，按钮会浮在其上 */
        var tagIcon=document.createElement("div");
        tagIcon.className="lt-tag-icon";
        tagIcon.title="标签";
        tagIcon.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>';
        tagIcon.style.cssText="position:fixed;display:none;left:-999px;top:-999px;z-index:150;width:24px;height:24px;border-radius:6px;align-items:center;justify-content:center;cursor:pointer;";
        document.body.appendChild(tagIcon);
        var aiIcon=document.createElement("div");
        aiIcon.className="lt-ai-icon";
        aiIcon.title="AI 增强";
        aiIcon.style.cssText="position:fixed;display:none;left:-999px;top:-999px;z-index:150;width:24px;height:24px;align-items:center;justify-content:center;cursor:pointer;color:#fff;";
        aiIcon.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3l.5 2.5L12 6l-2.5.5L9 9l-.5-2.5L6 6l2.5-.5z"/><path d="M16 12l.5 2.5L19 15l-2.5.5L16 18l-.5-2.5L13 15l2.5-.5z"/></svg>';
        document.body.appendChild(aiIcon);
        tagIcon.onclick=function(e){e.stopPropagation();if(document.getElementById("lt-tag-menu"))_ltCloseTagMenu();else _ltShowTagMenu(ta);};
        aiIcon.onclick=function(e){e.stopPropagation();_ltAIPanel(ta,aiIcon);};
        _ltFloatIcons.push({ta:ta,tagIcon:tagIcon,aiIcon:aiIcon});
        /* 打字时输入框长高不触发 scroll/resize，用 RO + input 实时跟随；
           contenteditable 可能固定高度、长高的是外层节点，节点也一起观察 */
        if(_ltTaRO){try{_ltTaRO.observe(ta);}catch(e){}
          var nodeEl2=ta.closest(".react-flow__node");if(nodeEl2){try{_ltTaRO.observe(nodeEl2);}catch(e){}}}
        _ltFloatIcons[_ltFloatIcons.length-1].nodeEl=nodeEl2;
        ta.addEventListener("input",_ltSyncPositions);
        _ltScanStats.tagInj++;_ltScanStats.aiInj++;
        _ltSyncOne(_ltFloatIcons[_ltFloatIcons.length-1]);
      });
      _ltScanStats.last=Date.now();
      _ltGenScan();
      _ltSyncPositions();
      /* 诊断：当前浮动图标状态 */
      _ltScanStats.icons=[];
      _ltScanStats.vp=window.innerWidth+"x"+window.innerHeight+" v"+"__VERSION__";
      for(var _j=0;_j<_ltFloatIcons.length&&_j<5;_j++){
        var _fi=_ltFloatIcons[_j];
        _ltScanStats.icons.push("ta="+(_fi.ta.isConnected?1:0)+" tag="+(_fi.tagIcon?(_fi.tagIcon.style.display+"/"+((Math.round(parseFloat(_fi.tagIcon.style.left)))||0)+","+((Math.round(parseFloat(_fi.tagIcon.style.top)))||0)):"-")+" ai="+(_fi.aiIcon?(_fi.aiIcon.style.display+"/"+((Math.round(parseFloat(_fi.aiIcon.style.left)))||0)+","+((Math.round(parseFloat(_fi.aiIcon.style.top)))||0)):"-"));
      }
    }
    /* 浮动图标管理 */
    var _ltFloatIcons=[];
    _ltScanStats.clamps=[];
    var _ltTaRO=window.ResizeObserver?new ResizeObserver(function(){_ltSyncPositions();}):null;
    function _ltSyncOne(f){
      if(!f.ta.isConnected||!f.ta.getClientRects||!f.ta.getClientRects().length){_ltHideIcons(f);return;}
      var r=f.ta.getBoundingClientRect();
      if(r.width<=0||r.height<=0){_ltHideIcons(f);return;}
      /* 位置直接跟随（画布拖动高频场景，pend 会造成滞后） */
      f._lr={left:r.left,top:r.top,width:r.width,height:r.height};
      
      if(f.tagIcon||f.aiIcon){
        /* 主提示词输入的两枚按钮上移到工具栏；其余输入框维持贴输入框右下角 */
        if(f.ta.closest&&f.ta.closest('[data-practice-anchor="gen.prompt"]')&&_ltToolbarDock(f)){}
        else{
        var vr=_ltVisibleRect(f.ta);var iy=Math.max(vr.top+4,Math.min(r.bottom-30,vr.bottom-30));var ix=Math.max(4,Math.min(r.right-30,window.innerWidth-30));var ax=Math.max(4,Math.min(r.right-74,window.innerWidth-74));if(f.tagIcon){f.tagIcon.style.left=ix+"px";f.tagIcon.style.top=iy+"px";f.tagIcon.style.display="flex";}if(f.aiIcon){f.aiIcon.style.left=ax+"px";f.aiIcon.style.top=iy+"px";f.aiIcon.style.display="flex";}
        /* 钳制触发时记流水，诊断用 */
        if((iy>r.bottom-30||ix<r.right-30)&&_ltScanStats.clamps){_ltScanStats.clamps.push("ta.bottom="+Math.round(r.bottom)+" right="+Math.round(r.right)+" panel=["+Math.round(vr.top)+","+Math.round(vr.bottom)+"] vp="+window.innerWidth+"x"+window.innerHeight);if(_ltScanStats.clamps.length>5)_ltScanStats.clamps.shift();}
        }
      }
    }
    function _ltHideIcons(f){if(f.tagIcon)f.tagIcon.style.display="none";if(f.aiIcon)f.aiIcon.style.display="none";}
    /* 钳制基准 = 最近滚动祖先可视区 ∩ 视口；否则图标会钉在视口底边而脱离面板内的输入框 */
    function _ltVisibleRect(ta){
      var el=ta.parentElement,best=null;
      while(el&&el!==document.body){var cs=getComputedStyle(el);if(/(auto|scroll)/.test(cs.overflowY)){best=el;}el=el.parentElement;}
      var pr=best?best.getBoundingClientRect():null;
      return {top:Math.max(0,pr?pr.top:0),bottom:Math.min(window.innerHeight,pr?pr.bottom:window.innerHeight)};
    }
    function _ltSyncPositions(){
      for(var i=_ltFloatIcons.length-1;i>=0;i--){
        var f=_ltFloatIcons[i];
        if(!f.ta.isConnected||!document.body.contains(f.ta)){
          if(_ltTaRO){try{_ltTaRO.unobserve(f.ta);}catch(e){}if(f.nodeEl){try{_ltTaRO.unobserve(f.nodeEl);}catch(e){}}}
          if(f.tagIcon)f.tagIcon.remove();
          if(f.aiIcon)f.aiIcon.remove();
          _ltFloatIcons.splice(i,1);
          continue;
        }
        _ltSyncOne(f);
      }
      /* 搜索框并入同一条热路径（scroll/视口/拖动 rAF 全都走这里），拖节点才跟手 */
      try{_ltFindSync();}catch(e){}
    }
    _ltSyncAll=_ltSyncPositions; /* 回填给桌宠/搜索等模块共用，保证同帧同基准 */
    /* scroll 直触重排会在滚动风暴里每事件跑一轮同步；rAF 合并到每帧一次。
       画布拖动不受影响：pointerdown 已有独立 rAF 循环（_ltDragStart）每帧直调 _ltSyncPositions */
    var _ltScrollRaf=0;
    function _ltScrollSync(){
      if(_ltScrollRaf)return;
      _ltScrollRaf=requestAnimationFrame(function(){_ltScrollRaf=0;_ltSyncPositions();});
    }
    document.addEventListener("scroll",_ltScrollSync,true);
    window.addEventListener("resize",_ltSyncPositions);
    /* 画布平移/缩放同步：React Flow viewport 的 transform 变化 → 实时跟图标 */
    var _ltVpObs=null;
    /* 缩放/平移是动画过程：transform 变更只在开头触发一次 observer，量到的是中间态；
       爆发式 rAF 跟随到动画结束，按钮才不会挤作一团再跳回 */
    var _ltBurstRAF=null,_ltBurstEnd=0;
    function _ltSyncBurst(){
      _ltBurstEnd=Date.now()+500;
      if(_ltBurstRAF)return;
      function loop(){
        _ltSyncPositions();
        if(Date.now()<_ltBurstEnd)_ltBurstRAF=requestAnimationFrame(loop);
        else _ltBurstRAF=null;
      }
      _ltBurstRAF=requestAnimationFrame(loop);
    }
    function _ltWatchViewport(){
      var vp=document.querySelector(".react-flow__viewport");
      if(!vp){_ltVpObs=null;return;}
      if(_ltVpObs&&_ltVpObs.el===vp)return;
      if(_ltVpObs&&_ltVpObs.obs)_ltVpObs.obs.disconnect();
      var obs=new MutationObserver(function(){_ltSyncBurst();});
      obs.observe(vp,{attributes:true,attributeFilter:["transform","style"]});
      _ltVpObs={el:vp,obs:obs};
    }
    var _ltDragRAF=null;
    function _ltDragStart(){
      if(_ltDragRAF)return;
      function loop(){_ltSyncPositions();_ltDragRAF=requestAnimationFrame(loop);}
      _ltDragRAF=requestAnimationFrame(loop);
    }
    function _ltDragEnd(){
      if(_ltDragRAF){cancelAnimationFrame(_ltDragRAF);_ltDragRAF=null;}
      _ltSyncPositions();
    }
    document.addEventListener("pointerdown",function(e){
      var t=e.target&&e.target.closest?e.target.closest(".react-flow__pane,.react-flow__viewport"):null;
      if(t){_ltWatchViewport();_ltDragStart();}
    },true);
    document.addEventListener("pointerup",_ltDragEnd,true);
    document.addEventListener("pointercancel",_ltDragEnd,true);
    setInterval(_ltWatchViewport,2000);
    _ltWatchViewport();
    setInterval(_ltTagScan,1000);
        var _ltTagTimer=null;
    function _ltTagSchedule(delay){if(_ltTagTimer)clearTimeout(_ltTagTimer);_ltTagTimer=setTimeout(function(){_ltTagTimer=null;_ltTagScan();},delay||100);}
    /* M7：burst 窗口或已有定时器时跳过 observer 触发——busy 时三路触发合流，扫描频率从叠加变取最大 */
    var _ltTagObs=new MutationObserver(function(){ if(_ltTagTimer||_ltBurstT.length)return; _ltTagSchedule(150); });
    _ltTagObs.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["style","class","hidden"]});
    /* \u4e8b\u4ef6\u9a71\u52a8\u515c\u5e95\uff1a\u9762\u677f\u901a\u5e38\u7531\u70b9\u51fb/\u805a\u7126/\u952e\u76d8\u89e6\u53d1\uff0c\u6bd4\u5b9a\u65f6\u8f6e\u8be2\u66f4\u7cbe\u51c6\u4e14\u96f6\u7a7a\u95f2\u5f00\u9500 */
    var _ltBurstT=[],_ltBurstLast=0;
    function _ltTagBurst(){
      /* M7：400ms 内的重复 burst 只续期不重排，连点/连击不再线性放大扫描次数 */
      var n=Date.now();
      if(_ltBurstT.length&&n-_ltBurstLast<400){_ltBurstLast=n;return;}
      _ltBurstLast=n;
      for(var i=0;i<_ltBurstT.length;i++)clearTimeout(_ltBurstT[i]);
      _ltBurstT=[];
      [80,300,800,1500].forEach(function(d){_ltBurstT.push(setTimeout(function(){_ltTagTimer=null;_ltTagScan();},d));});
    }
    document.addEventListener("click",function(){_ltTagBurst();},true);
        document.addEventListener("focusin",function(){_ltTagBurst();},true);
        document.addEventListener("keydown",function(){_ltTagSchedule(300);},true);
    /* ── 生成光效：Motif Generation Overlay 风格 ──
       站点生成中给节点 img 打内联 blur(24px)（实测 DOM 特征），以此识别生成中；
       渐变层挂 img 父级 ::after（树序 = img 之上、进度胶囊之下），相位按 data-id 哈希防同步；
       完成时站点摘 blur → CSS transition 渐清晰，覆盖层同步淡出。
       状态扫描由 _ltTagScan 带跑（1s 轮询 + burst），零新增 observer/interval */
    try{if(localStorage.getItem("_lt_gen_glow")===null)localStorage.setItem("_lt_gen_glow","1");}catch(e){}
    var _ltGenSeen=new Map(); /* data-id -> {ph:"gen"|"await"|"reveal", src0, tDone} */
    /* __lt_glow_pure_begin__ */
    function _ltGlowHash(s){var h=5381;for(var i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))>>>0;return h>>>0;}
    /* 五组对角焦点（照搬 Motif FOCAL_PAIRS，两色永远错开不叠成一团） */
    var _ltGlowPairs=[["50% 20%","50% 80%"],["30% 30%","70% 70%"],["70% 25%","30% 75%"],["25% 60%","75% 40%"],["50% 75%","50% 25%"]];
    function _ltGlowParams(id){
      var h=_ltGlowHash(String(id||""));
      var gd1=4.5+(h%100)/100*1.5;                   /* 快层 4.5–6.0s（Motif spinA） */
      var gd2=6.5+((h>>>7)%100)/100*1.5;             /* 慢层 6.5–8.0s（Motif spinB） */
      var dir=(((h>>>14)^(h>>>26))&1)?"reverse":"normal"; /* 层 A 方向逐节点独立；层 B 恒反向（路径交叉不平行） */
      var ga=((h>>>16)%360);                         /* 层 A 相位 0–359° */
      var ga2=(ga+120+((h>>>25)%121))%360;           /* 层 B 相位 = A + 120–240°（Motif 层间分离） */
      var h2=_ltGlowHash(String(id||"")+"#f");
      var pair=_ltGlowPairs[h2%_ltGlowPairs.length];
      return {gd1:gd1.toFixed(2)+"s",gd2:gd2.toFixed(2)+"s",dir:dir,
              dir2:dir==="normal"?"reverse":"normal", /* 层 B 恒与层 A 相反（Motif flip） */
              ga:ga+"deg",ga2:ga2+"deg",f1:pair[0],f2:pair[1]};
    }
    /* __lt_glow_pure_end__ */
    function _ltGenEnsure(el,img,id){
      /* 挂层 + 写种子参数；站点重挂载节点/宿主后属性可能被换掉，每轮补挂 */
      var p=_ltGlowParams(id),host=img.parentElement;
      try{
        el.style.setProperty("--lt-gd1",p.gd1);el.style.setProperty("--lt-gd2",p.gd2);
        el.style.setProperty("--lt-gdir",p.dir);el.style.setProperty("--lt-gdir2",p.dir2);
        el.style.setProperty("--lt-ga",p.ga);el.style.setProperty("--lt-ga2",p.ga2);
        el.style.setProperty("--lt-gf1",p.f1);el.style.setProperty("--lt-gf2",p.f2);
      }catch(e2){}
      if(host.getAttribute("data-lt-gen-host")===null){
        host.setAttribute("data-lt-gen-host","");
        host.removeAttribute("data-lt-reveal-host");
      }
    }
    function _ltGenScan(){
      var on=true;
      try{on=localStorage.getItem("_lt_gen_glow")!=="0";}catch(e){}
      if(!on){
        if(_ltGenSeen.size){
          document.querySelectorAll("[data-lt-gen-host],[data-lt-reveal-host]").forEach(function(h){
            h.removeAttribute("data-lt-gen-host");h.removeAttribute("data-lt-reveal-host");
          });
          _ltGenSeen.clear();
        }
        return;
      }
      var anyBlur=document.querySelector('.react-flow__node-image img[style*="blur("]');
      if(!_ltGenSeen.size&&!anyBlur)return; /* 空闲态：每轮只付一次 querySelector */
      var nodes=document.querySelectorAll(".react-flow__node-image");
      for(var i=0;i<nodes.length;i++){
        var el=nodes[i],id=el.getAttribute("data-id")||"";
        if(!id)continue;
        var img=el.querySelector("img"),blur=0;
        if(img){var m=(img.style.filter||"").match(/blur\(([\d.]+)px\)/);if(m)blur=parseFloat(m[1]);}
        var st=_ltGenSeen.get(id);
        var src=img?(img.getAttribute("src")||""):"";
        /* 三态机：gen（生成中，blur≥12）→ await（站点摘了 blur 但新图 src 还没换上——
           此窗口继续用雾盖住旧图，避免"闪一下旧图"）→ reveal（src 已换/超时兜底，等 decode 后淡出） */
        if(blur>=12){ /* 站点生成中实测 blur(24px)；≥12 兼容更小值，普通图片加载不落此区间 */
          if((!st||st.ph!=="gen"||src!==st.src0)&&img&&img.parentElement){
            _ltGenEnsure(el,img,id);
            _ltGenSeen.set(id,{ph:"gen",src0:src,tDone:0});
          }else if(st&&st.ph==="gen"&&img){ _ltGenEnsure(el,img,id); }
        }else if(st){
          if(st.ph==="gen"){ st.ph="await"; st.tDone=Date.now(); } /* 站点先摘 blur：等新图 src 就位或超时 */
          if(st.ph==="await"){
            var swapped=!!(src&&st.src0!==src);
            if(swapped||!img||Date.now()-st.tDone>2500){
              /* 揭示：等新图可解码再撤雾（decode 1.2s 兜底；超时路径直接撤）。
                 IIFE 锁定本轮 img——var 循环变量在异步回调里会漂移到最后一次迭代 */
              st.ph="reveal";
              (function(imgAtFlip){
                var flip=function(){
                  var host=imgAtFlip&&imgAtFlip.parentElement&&imgAtFlip.parentElement.isConnected?imgAtFlip.parentElement:null;
                  if(host){
                    host.removeAttribute("data-lt-gen-host");
                    host.setAttribute("data-lt-reveal-host","");
                    (function(h){setTimeout(function(){if(h.isConnected)h.removeAttribute("data-lt-reveal-host");},1700);})(host);
                  }
                };
                if(imgAtFlip&&imgAtFlip.decode){ Promise.race([imgAtFlip.decode(),new Promise(function(r){setTimeout(r,1200);})]).then(flip,flip); }
                else flip();
              })(img);
            }
            else if(img&&img.parentElement){ _ltGenEnsure(el,img,id); } /* await 期间站点重挂载也保持覆盖 */
          }
          /* ph==="reveal"：淡出清理交给定时器，这里不做任何事 */
        }
      }
    }
    _ltTagScan();
    /* \u52a0\u8f7d\u540e\u4e00\u6b21\u6027\u5ef6\u65f6\u8865\u626b\uff08\u9632\u9762\u677f\u521d\u59cb\u5316\u8f83\u6162\uff09 */
    setTimeout(_ltTagScan,800);setTimeout(_ltTagScan,3000);setTimeout(_ltTagScan,10000);
    window._ltDiag={tagScan:_ltScanStats};
    /* ── 积分 ⇄ 人民币换算：站点用闪电图标展示积分（顶栏余额、节点生成消耗），在数值旁补一个 RMB 估值 ──
       比例按会员档位不同（高级/普通单价不同），故开放成设置项 _lt_rate（几分 = 1 元），默认 15；
       无官方定价，故标签带 ≈。读一次即可，设置面板改动会调 _ltCreditScan 重刷 */
    var _ltRate=15;
    try{var _lv=parseFloat(localStorage.getItem("_lt_rate"));if(isFinite(_lv)&&_lv>0)_ltRate=_lv;}catch(e){}
    function _ltRmb(n){var v=n/_ltRate;return "≈¥"+(v>=1000?Math.round(v):v.toFixed(2));}
    /* 开关默认开：只在从未存过时写一次，之后完全交给设置面板的通用开关（键 _lt_rmb） */
    try{if(localStorage.getItem("_lt_rmb")===null)localStorage.setItem("_lt_rmb","1");}catch(e){}
    var _ltRmbAny=false;
    var _ltCreditStats={on:true,labels:0,anchors:[]};
    window._ltDiag=window._ltDiag||{};
    window._ltDiag.credit=_ltCreditStats;
    function _ltCreditClear(){
      if(!_ltRmbAny)return;
      _ltRmbAny=false;
      document.querySelectorAll("[data-lt-rmb]").forEach(function(e){e.removeAttribute("data-lt-rmb");});
      _ltCreditStats.labels=0;
      _ltCreditStats.anchors=[];
    }
    /* 锚点自证 + 取值：把锚点文本解析成要显示的估值文本，解析不出来就返回 null（不认这个锚点）。
       站点已出现过四种形态：纯数字 20 / 带千分位 37,377 / 单位后缀 1.2万 / 会员折扣「现价 / 原价」196/230
       （原价在站点侧是删除线，textContent 里没有空格，分隔靠 CSS gap）。
       折扣形态两个数都换算，形式上对照站点自己的「现价 / 原价」，避免读者搞混哪个数换的是哪个 */
    function _ltCreditOne(s){
      s=String(s).replace(/[,\s]/g,"");
      var m=s.match(/^(\d+(?:\.\d+)?)(万|w|k)?$/i);
      if(!m)return null;
      var n=parseFloat(m[1]);
      if(m[2])n*=/万/.test(m[2])?10000:1000;
      return isFinite(n)?n:null;
    }
    function _ltCreditLabel(a){
      var parts=(a.textContent||"").trim().split("/");
      if(parts.length>2)return null;
      var vals=[];
      for(var i=0;i<parts.length;i++){
        var n=_ltCreditOne(parts[i]);
        if(n===null)return null;
        vals.push(n);
      }
      return vals.length?_ltRmb(vals[0])+(vals.length>1?" / "+_ltRmb(vals[1]):""):null;
    }
    function _ltCreditScan(){
      /* 关掉时连清带停：设置面板的通用开关只写 localStorage，这里每轮读一次即可保持一致 */
      if(localStorage.getItem("_lt_rmb")==="0"){_ltCreditClear();_ltCreditStats.on=false;return;}
      _ltCreditStats.on=true;
      var anchors=[];
      /* 主锚点：认站点自己的积分图标（闪电 path），再往上找最近的「图标+数值」容器，
         顶栏余额 / 节点消耗 / 以后新出现的积分位都能自动覆盖，不依赖易变的类名 */
      document.querySelectorAll('svg path[d^="M7.3.64"]').forEach(function(p){
        var el=p;
        for(var i=0;i<4&&el;i++){
          el=el.parentElement; if(!el)break;
          if(_ltCreditLabel(el)!==null){if(anchors.indexOf(el)<0)anchors.push(el);return;}
        }
      });
      /* 兜底锚点：站点换图标后，仍按类名认出节点浮动面板那一处 */
      document.querySelectorAll("span.min-w-5.text-center").forEach(function(s){
        if(s.parentElement&&anchors.indexOf(s.parentElement)<0)anchors.push(s.parentElement);
      });
      var n=0;
      anchors.forEach(function(a){
        var label=_ltCreditLabel(a); if(label===null)return;
        /* 标签用 data 属性 + CSS ::after 渲染，不插节点：React 重渲染碰不到伪元素，
           也不污染站点元素的 textContent（站点若自己读它做解析，多出的文本会把解析搞坏） */
        if(a.getAttribute("data-lt-rmb")!==label)a.setAttribute("data-lt-rmb",label);
        _ltRmbAny=true; n++;
      });
      _ltCreditStats.labels=n;
      _ltCreditStats.anchors=anchors.slice(0,6).map(function(a){
        var v=_ltCreditLabel(a);
        return a.tagName+"."+String(a.className||"").slice(0,26)+" ["+String(a.textContent||"").trim().slice(0,14)+"] => "+(v===null?"未识别":v);
      });
    }
    var _ltCreditT=null;
    function _ltCreditSchedule(){if(_ltCreditT)clearTimeout(_ltCreditT);_ltCreditT=setTimeout(_ltCreditScan,120);}
    /* 桥接给设置面板（本 IIFE 之外）：外部裸引用 _ltRate/_ltCreditScan 会变成隐式全局 / ReferenceError */
    window._ltCreditSetRate=function(r){_ltRate=r;_ltCreditScan();};
    /* characterData 兜「余额数字原地变化」（生成后扣费），childList 兜「面板重挂载」 */
    /* M8：关闭「积分换算」时真停 observer/interval（原来只是每轮空转），只留 2s 一次的开关读表，重开自动挂回 */
    var _ltCreditObs=new MutationObserver(_ltCreditSchedule);
    var _ltCreditIv=null,_ltCreditPowered=false;
    function _ltCreditPower(){
      var on=true;
      try{on=localStorage.getItem("_lt_rmb")!=="0";}catch(e){}
      if(on&&!_ltCreditPowered){
        /* characterData 兜「余额数字原地变化」（生成后扣费），childList 兜「面板重挂载」 */
        _ltCreditObs.observe(document.body,{childList:true,subtree:true,characterData:true});
        _ltCreditIv=setInterval(_ltCreditScan,1500);
        _ltCreditPowered=true;
        _ltCreditScan();
      }else if(!on&&_ltCreditPowered){
        _ltCreditObs.disconnect();clearInterval(_ltCreditIv);clearTimeout(_ltCreditT);_ltCreditPowered=false;
        _ltCreditClear();_ltCreditStats.on=false;
      }
    }
    setInterval(_ltCreditPower,2000);
    _ltCreditPower();
    /* ── standalone AI-only panel (self-contained, no dependence on _ltPromptPanel) ── */
    function _ltAIPanel(inputEl,iconEl){
      var pid="lt-ai-panel";
      var existing=document.getElementById(pid);
      if(existing){existing.remove();return;}
      var api=_ltAPIRead();
      var presets={
        polish:{label:"\u2728 \u6da6\u8272",sys:"\u4f60\u662f\u4e00\u4e2a\u63d0\u793a\u8bcd\u5de5\u7a0b\u4e13\u5bb6\u3002\u8bf7\u6da6\u8272\u7528\u6237\u7684 AI \u56fe\u50cf/\u89c6\u9891\u751f\u6210\u63d0\u793a\u8bcd\uff0c\u4fee\u6b63\u8bed\u6cd5\u3001\u4f18\u5316\u8868\u8fbe\uff0c\u4fdd\u6301\u539f\u610f\u4e0d\u53d8\u3002\u8bf7\u52a1\u5fc5\u7528\u4e2d\u6587\u56de\u590d\u3002"},
        expand:{label:"\ud83d\udccf \u6269\u5199",sys:"\u4f60\u662f\u4e00\u4e2a\u63d0\u793a\u8bcd\u5de5\u7a0b\u4e13\u5bb6\u3002\u8bf7\u5728\u7528\u6237\u539f\u6709\u63d0\u793a\u8bcd\u57fa\u7840\u4e0a\u6269\u5199\uff0c\u8865\u5145\u5149\u5f71\u3001\u6784\u56fe\u3001\u98ce\u683c\u3001\u6c1b\u56f4\u3001\u8272\u5f69\u7b49\u7ec6\u8282\uff0c\u4f7f\u63d0\u793a\u8bcd\u66f4\u4e30\u5bcc\u5177\u4f53\u3002\u8bf7\u52a1\u5fc5\u7528\u4e2d\u6587\u56de\u590d\u3002"},
        shorten:{label:"\u2702\ufe0f \u7f29\u5199",sys:"\u4f60\u662f\u4e00\u4e2a\u63d0\u793a\u8bcd\u5de5\u7a0b\u4e13\u5bb6\u3002\u8bf7\u5728\u4e0d\u4e22\u5931\u6838\u5fc3\u4fe1\u606f\u7684\u524d\u63d0\u4e0b\u7cbe\u7b80\u63d0\u793a\u8bcd\uff0c\u4fdd\u7559\u5173\u952e\u4fee\u9970\u8bcd\uff0c\u79fb\u9664\u5197\u4f59\u8868\u8fbe\u3002\u8bf7\u52a1\u5fc5\u7528\u4e2d\u6587\u56de\u590d\u3002"},
        zh2en:{label:"\ud83c\udf10 \u4e2d\u2192\u82f1",sys:"You are a prompt engineering expert. Translate the Chinese prompt to English while maintaining all stylistic and technical details. Output English only."},
        en2zh:{label:"\ud83c\udf10 \u82f1\u2192\u4e2d",sys:"\u4f60\u662f\u4e00\u4e2a\u63d0\u793a\u8bcd\u5de5\u7a0b\u4e13\u5bb6\u3002\u5c06\u82f1\u6587\u63d0\u793a\u8bcd\u7ffb\u8bd1\u6210\u4e2d\u6587\uff0c\u4fdd\u7559\u6240\u6709\u98ce\u683c\u548c\u6280\u672f\u7ec6\u8282\u3002\u53ea\u8f93\u51fa\u4e2d\u6587\u3002"},
        custom:{label:"\u2699 \u81ea\u5b9a\u4e49",sys:""}
      };
      function _ltCPGet(){try{return JSON.parse(localStorage.getItem("_lt_ai_custom_presets")||"[]");}catch(e){return [];}}
      function _ltCPSys(){try{return localStorage.getItem("_lt_ai_sys")||"";}catch(e){return "";}}
      function _ltGetSP(task){
        if(task==="custom")return _ltCPSys();
        if(task.indexOf("cp_")===0){var c=_ltCPGet();for(var i=0;i<c.length;i++){if(c[i].id===task)return c[i].sys;}return "";}
        return presets[task]?presets[task].sys:"";
      }
      var curTask="polish";
      function _ltTaskHTML(t){
        var h="";
        Object.keys(presets).forEach(function(k){h+='<span class="ltp-ai-task'+(k===t?' active':'')+'" data-task="'+k+'">'+presets[k].label+'</span>';});
        _ltCPGet().forEach(function(p){h+='<span class="ltp-ai-task cp'+(p.id===t?' active':'')+'" data-task="'+_ltEsc(p.id)+'">'+_ltEsc(p.name)+'</span>';});
        return h;
      }
      /* ── inline button styles (ltp-btn scoped to #libtv-prompt, not accessible here) ── */
      var _btn="display:inline-flex;align-items:center;gap:5px;padding:6px 14px;border-radius:8px;border:none;cursor:pointer;font:12px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;transition:background .15s ease-out,box-shadow .15s ease-out,color .15s ease-out;";
      var _btnP=_btn+"background:linear-gradient(135deg,var(--accent),var(--accent-light));color:#fff;box-shadow:0 0 12px rgba(var(--accent-light-rgb),0.3);";
      var _btnG=_btn+"background:rgba(255,255,255,0.04);color:#aaa;";
      var _btnS="padding:4px 12px;font-size:11px;border-radius:6px;";
      /* ── position: panel bottom-left corner aligns with icon top-left corner ── */
      var ir=iconEl.getBoundingClientRect();
      var div=document.createElement("div");
      div.id=pid;
      div.style.cssText="position:fixed;left:0;top:0;z-index:99999;width:540px;max-width:88vw;max-height:68vh;background:rgba(12,12,20,0.88);-webkit-backdrop-filter:blur(32px) saturate(1.4);backdrop-filter:blur(32px) saturate(1.4);border:1px solid rgba(var(--accent-light-rgb),0.25);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 0 1px rgba(var(--accent-light-rgb),0.6),0 0 8px rgba(var(--accent-light-rgb),0.15),0 0 24px rgba(var(--accent-light-rgb),0.08),0 16px 48px rgba(0,0,0,0.5);color:#d4d4d8;font:13px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;";
      div.innerHTML=
        '<div id="lt-ap-head" style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(var(--accent-light-rgb),0.12);flex-shrink:0;cursor:grab;"><span style="font-size:13px;font-weight:600;color:var(--accent-light);">AI \u589e\u5f3a</span><span id="lt-ap-close" style="cursor:pointer;font-size:16px;color:rgba(255,255,255,0.25);line-height:1;">\u2715</span></div>'
        +'<div class="ltp-ai-tasks" id="lt-ap-tasks" style="padding:8px 12px 4px;">'+_ltTaskHTML(curTask)+'</div>'
        +'<div style="padding:0 12px 4px;flex-shrink:0;"><textarea id="lt-ap-input" class="ltp-ai-input" placeholder="\u5728\u6b64\u8f93\u5165\u63d0\u793a\u8bcd..." rows="2" style="width:100%;box-sizing:border-box;"></textarea></div>'
        +'<div style="padding:4px 12px 6px;display:flex;gap:6px;flex-shrink:0;"><button style="'+_btnP+'" id="lt-ap-go">\u2728 \u6267\u884c</button><button style="'+_btnG+'display:none;" id="lt-ap-cancel">取消</button><span id="lt-ap-model-sel" style="display:inline-flex;align-items:center;"></span><button style="'+_btnG+'" id="lt-ap-fill">\u4ece\u8f93\u5165\u6846\u83b7\u53d6</button><button style="'+_btnG+'" id="lt-ap-clr">\u6e05\u7a7a</button></div>'
        +'<div id="lt-ap-result" style="display:none;flex:1;overflow-y:auto;padding:4px 12px 6px;white-space:pre-wrap;word-break:break-word;font-size:12px;"></div>'
        +'<div style="padding:4px 12px 8px;flex-shrink:0;"><span style="font-size:11px;color:rgba(255,255,255,0.3);" id="lt-ap-status">'+(api.url?("\u5df2\u914d\u7f6e "+_ltEsc(_ltHost(api.url))+(api.model?(" · "+_ltEsc(api.model)):"")):"\u672a\u914d\u7f6e API")+'</span></div>';
      document.body.appendChild(div);
      /* align panel bottom-left to icon top-left, measured after layout */
      var pw=div.offsetWidth||440,ph=div.offsetHeight||470;
      var pL=Math.max(12,Math.min(ir.left,window.innerWidth-pw-12));
      var pT=ir.top-ph;
      if(pT<12)pT=ir.bottom+8;
      if(pT+ph>window.innerHeight-12)pT=Math.max(12,window.innerHeight-ph-12);
      div.style.left=pL+"px";div.style.top=pT+"px";
      var apHead=document.getElementById("lt-ap-head");
      if(apHead)_ltMakeDraggable(div,apHead);
      /* close */
      document.getElementById("lt-ap-close").onclick=function(){div.remove();};
      /* task selector */
      var taskEl=document.getElementById("lt-ap-tasks");
      taskEl.addEventListener("click",function(e){
        var t=e.target.closest(".ltp-ai-task");if(!t)return;
        curTask=t.getAttribute("data-task");
        taskEl.querySelectorAll(".ltp-ai-task").forEach(function(s){s.classList.toggle("active",s===t);});
        var customEl=document.getElementById("lt-ap-custom");
        if(curTask==="custom"||curTask.indexOf("cp_")===0){
          if(!customEl){
            var customDiv=document.createElement("div");
            customDiv.id="lt-ap-custom";
            customDiv.style.cssText="padding:0 12px 4px;flex-shrink:0;";
            customDiv.innerHTML='<textarea id="lt-ap-sys" class="ltp-ai-sys" placeholder="\u81ea\u5b9a\u4e49 system prompt..." rows="2" style="width:100%;box-sizing:border-box;min-height:36px;max-height:80px;background:rgba(255,255,255,0.03);border:1px solid rgba(var(--accent-light-rgb),0.12);border-radius:6px;padding:6px 10px;font:12px/1.5 -apple-system,sans-serif;color:#d4d4d8;outline:none;resize:none;"></textarea>';
            taskEl.parentNode.insertBefore(customDiv,taskEl.nextSibling);
            customDiv.querySelector("#lt-ap-sys").value=_ltCPSys();
          }
          customEl=document.getElementById("lt-ap-custom");
          if(customEl)customEl.style.display="block";
          document.getElementById("lt-ap-sys").value=_ltGetSP(curTask);
        }else{
          var ce=document.getElementById("lt-ap-custom");if(ce)ce.style.display="none";
        }
      });
      /* input auto-height */
      var inp=document.getElementById("lt-ap-input");
      inp.addEventListener("input",function(){this.style.height="auto";this.style.height=Math.min(this.scrollHeight,160)+"px";});
      /* fill from input */
      document.getElementById("lt-ap-fill").onclick=function(){
        var t=inputEl.value||inputEl.textContent||"";
        inp.value=t;inp.style.height="auto";inp.style.height=Math.min(inp.scrollHeight,160)+"px";
        _ltAISource=inputEl;
        document.getElementById("lt-ap-status").textContent="\u2705 \u5df2\u7ed1\u5b9a\u6e90\u8f93\u5165\u6846";
      };
      /* clear */
      document.getElementById("lt-ap-clr").onclick=function(){
        inp.value="";inp.style.height="auto";
        var re=document.getElementById("lt-ap-result");re.style.display="none";
        var g=document.getElementById("lt-ap-go");if(g)g.textContent="\u2728 \u6267\u884c";
      };
      /* execute */
      document.getElementById("lt-ap-go").onclick=function(){
        var text=inp.value.trim();
        if(!text){document.getElementById("lt-ap-status").textContent="\u8bf7\u5148\u8f93\u5165\u63d0\u793a\u8bcd";return;}
        api=_ltAPIRead(); /* 执行时重读配置：面板打开期间设置面板可能已切换预设 */
        if(!api.url||!api.key){document.getElementById("lt-ap-status").textContent="\u8bf7\u5148\u5728\u2699\u8bbe\u7f6e\u4e2d\u914d\u7f6e API";return;}
        var sys=_ltGetSP(curTask);
        if((curTask==="custom"||curTask.indexOf("cp_")===0)&&!sys.trim()){document.getElementById("lt-ap-status").textContent="\u8bf7\u5148\u586b\u5199 system prompt";return;}
        var statusEl=document.getElementById("lt-ap-status");
        var cancelBtn=document.getElementById("lt-ap-cancel");
        var btn=this;btn.disabled=true;btn.textContent="\u5904\u7406\u4e2d...";
        if(cancelBtn)cancelBtn.style.display="";
        var myGen=++_ltAIReqGen;
        _ltAIChat(api.url,api.key,{model:api.model||"deepseek-v4-flash",messages:[{role:"system",content:sys},{role:"user",content:text}],max_tokens:4096})
        .then(function(d){
          if(myGen!==_ltAIReqGen)return;
          var result=_ltMsgText(d)||("\u26a0 \u6a21\u578b\u8fd4\u56de\u7a7a\u5185\u5bb9\uff08\u53ef\u80fd\u601d\u8003\u8fc7\u957f\u88ab max_tokens \u622a\u65ad\uff09\uff0c\u539f\u59cb\u54cd\u5e94: "+(JSON.stringify(d)||"").slice(0,300));
          var resEl=document.getElementById("lt-ap-result");
          resEl.style.display="block";
          resEl.innerHTML='<div style="margin-bottom:6px;font-size:11px;color:rgba(255,255,255,0.3);">\u589e\u5f3a\u7ed3\u679c</div><div id="lt-ap-rtext" style="color:#d4d4d8;">'+_ltEsc(result)+'</div><div style="margin-top:8px;display:flex;gap:6px;"><button style="'+_btnP+_btnS+'" id="lt-ap-write">\u5199\u56de\u6e90\u8f93\u5165\u6846</button><button style="'+_btnG+_btnS+'" id="lt-ap-copy">\u590d\u5236</button></div>';
          document.getElementById("lt-ap-write").onclick=function(){
            if(!_ltAISource){statusEl.textContent="\u26a0 \u672a\u7ed1\u5b9a\u6e90\u8f93\u5165\u6846";return;}
            try{
              if(_ltAISource.tagName==="TEXTAREA"||_ltAISource.tagName==="INPUT"){_ltAISource.value=result;_ltAISource.dispatchEvent(new Event("input",{bubbles:true}));}
              else if(_ltAISource.isContentEditable){_ltAISource.textContent=result;_ltAISource.dispatchEvent(new Event("input",{bubbles:true}));}
              statusEl.textContent="\u2705\u2705 \u5df2\u5199\u56de";
            }catch(ex){statusEl.textContent="\u5199\u5165\u5931\u8d25: "+ex.message;}
          };
          document.getElementById("lt-ap-copy").onclick=function(){
            navigator.clipboard.writeText(result).then(function(){statusEl.textContent="\u2705\u2705 \u5df2\u590d\u5236\u5230\u526a\u8d34\u677f";}).catch(function(){
              var sel=window.getSelection();var r=document.createRange();var el=document.getElementById("lt-ap-rtext");r.selectNodeContents(el);sel.removeAllRanges();sel.addRange(r);
              try{var ok=document.execCommand("copy");if(ok){sel.removeAllRanges();statusEl.textContent="\u2705\u2705 \u5df2\u590d\u5236";return;}}catch(e){}
              statusEl.textContent="\u2705 \u5df2\u9009\u4e2d\u7ed3\u679c\u6587\u672c\uff0c\u8bf7\u6309 Ctrl+C";
            });
          };
          statusEl.textContent="\u2705 \u5b8c\u6210";
          btn.disabled=false;btn.textContent="\ud83d\udd04 \u91cd\u65b0\u751f\u6210";
          if(cancelBtn)cancelBtn.style.display="none";
        })
        .catch(function(e){
          if(myGen!==_ltAIReqGen)return;
          statusEl.textContent="\u8bf7\u6c42\u5931\u8d25: "+e.message+" | model="+(api.model||"deepseek-v4-flash");
          btn.disabled=false;btn.textContent="\u2728 \u6267\u884c";
          if(cancelBtn)cancelBtn.style.display="none";
        });
      };
      document.getElementById("lt-ap-cancel").onclick=function(){
        _ltAIReqGen++;
        var g=document.getElementById("lt-ap-go");
        if(g){g.disabled=false;g.textContent="\u2728 \u6267\u884c";}
        this.style.display="none";
        var s=document.getElementById("lt-ap-status");
        if(s)s.textContent="已取消（后台回包将被忽略）";
      };
      _ltModelSelect(document.getElementById("lt-ap-model-sel"),"ap",function(m){
        api=_ltAPIRead();
        var st=document.getElementById("lt-ap-status");
        if(st)st.textContent=api.url?("已配置 "+_ltEsc(_ltHost(api.url))+(api.model?(" · "+_ltEsc(api.model)):"")):"未配置 API";
      });
      /* auto-fill on open */
      var initText=inputEl.value||inputEl.textContent||"";
      if(initText.trim()){
        inp.value=initText;inp.style.height="auto";inp.style.height=Math.min(inp.scrollHeight,160)+"px";
        _ltAISource=inputEl;
      }
    }
  })();
  (function(){
    function _createBtn(){
      if(document.getElementById("libtv-pbtn"))return;
      var si=parseInt(localStorage.getItem("_lt_pbtn_style")||"0");
      if(isNaN(si)||si<0||si>4)si=0;
      var btn=document.createElement("div");
      btn.id="libtv-pbtn";
      btn.className="s"+si;
      btn.title="提示词工具 (P) | 右键切换样式";
      if(si===4){btn.textContent="P";}
      else if(si===3){btn.innerHTML='<span style="display:flex;align-items:center;justify-content:center;height:100%"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg><span class="s3-label" style="margin-left:4px;font-size:13px">提示词</span></span>';}
      else{btn.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';}
      btn.style.cssText="position:fixed;right:60px;bottom:70px;z-index:99998;display:flex;align-items:center;justify-content:center;cursor:grab;user-select:none;";
      if(si===2){btn.style.width="28px";btn.style.height="28px";}else{btn.style.width="36px";btn.style.height="36px";}
      if(si===4){btn.style.fontSize="16px";btn.style.fontWeight="600";btn.style.fontFamily="-apple-system,BlinkMacSystemFont,sans-serif";}
      btn.addEventListener("contextmenu",function(e){e.preventDefault();var cur=parseInt(localStorage.getItem("_lt_pbtn_style")||"0");var next=((cur%5)+1)%5;try{localStorage.setItem("_lt_pbtn_style",String(next));}catch(ex){}btn.remove();_createBtn();});
      document.body.appendChild(btn);
      /* hover 反馈全部交给 CSS（极简描边族：只变颜色、不位移）
         这里不要再写 inline transform —— inline 会盖掉样式表，5 个槽位就没法统一了 */
      btn.onmouseenter=null;
      btn.onmouseleave=null;
      function _ltPosPanel(){
        var p=document.getElementById("libtv-prompt");if(!p)return;
        var r=btn.getBoundingClientRect(),pw=Math.min(520,window.innerWidth-32),ph=p.offsetHeight||400;
        p.style.left=Math.max(12,Math.min(r.left+r.width/2-pw/2,window.innerWidth-pw-12))+"px";
        var t=r.bottom+10;if(t+ph>window.innerHeight-12)t=Math.max(12,r.top-ph-10);
        p.style.top=t+"px";p.style.transform="none";
      }
      function _ltToggle(){
        var p=document.getElementById("libtv-prompt");if(p){p.remove();return;}
        _ltPromptPanel(btn);_ltPosPanel();
      }
      btn.onclick=_ltToggle;
      function _ltClamp(){var pw=36,ph=36;var l=parseInt(btn.style.left);var t=parseInt(btn.style.top);if(!isNaN(l)){l=Math.max(4,Math.min(l,window.innerWidth-pw-4));btn.style.left=l+"px";}if(!isNaN(t)){t=Math.max(4,Math.min(t,window.innerHeight-ph-4));btn.style.top=t+"px";}_ltPosPanel();}
      var dx=0,dy=0,dragging=false;
      btn.addEventListener("mousedown",function(e){dragging=true;dx=e.clientX-btn.offsetLeft;dy=e.clientY-btn.offsetTop;e.preventDefault();});
      document.addEventListener("mousemove",function(e){if(!dragging)return;var pw=36,ph=36,l=e.clientX-dx,t=e.clientY-dy;l=Math.max(4,Math.min(l,window.innerWidth-pw-4));t=Math.max(4,Math.min(t,window.innerHeight-ph-4));btn.style.left=l+"px";btn.style.top=t+"px";btn.style.right="auto";btn.style.bottom="auto";_ltPosPanel();});
      document.addEventListener("mouseup",function(){if(dragging){dragging=false;try{localStorage.removeItem("_lt_pbtn_r");localStorage.removeItem("_lt_pbtn_b");localStorage.removeItem("_lt_pbtn_x");localStorage.removeItem("_lt_pbtn_y");}catch(ex){}}});
      window.addEventListener("resize",_ltClamp);
    }
    function _removeBtn(){var b=document.getElementById("libtv-pbtn");if(b)b.remove();}
    var _ltWelcomePending=false;
    function _ltShowWelcome(){
      try{if(localStorage.getItem("_lt_first_run"))return;}catch(e){}
      if(document.getElementById("libtv-welcome-overlay"))return;
      var ov=document.createElement("div");
      ov.id="libtv-welcome-overlay";
      ov.innerHTML=
        "<div id=\"libtv-welcome\"><button class=\"w-close\" title=\"关闭\">\u2715</button>"
        +"<h1>\u6b22\u8fce\u4f7f\u7528 LibTV Canvas Boost</h1>"
        +"<p class=\"sub\">\u5feb\u6377\u952e\u00b7\u7279\u6027\u00b7\u5c0f\u8d34\u58eb</p>"
        +"<div class=\"sec-title\">\u5feb\u6377\u952e\u901f\u89c8</div>"
        +"<div class=\"w-grid\">"
        +"<div class=\"item\"><kbd>G</kbd>\u7f51\u683c</div>"
        +"<div class=\"item\"><kbd>T</kbd>\u6027\u80fd\u6a21\u5f0f</div>"
        +"<div class=\"item\"><kbd>H</kbd>\u9690\u85cf\u56fe\u7247</div>"
        +"<div class=\"item\"><kbd>L</kbd>\u8fde\u7ebf\u6a21\u5f0f</div>"
        +"<div class=\"item\"><kbd>C</kbd>\u5168\u94fe\u8def\u9ad8\u4eae</div>"
        +"<div class=\"item\"><kbd>R</kbd>\u76f4\u89d2\u8fde\u7ebf</div>"
        +"<div class=\"item\"><kbd>X</kbd>\u4e13\u6ce8\u6a21\u5f0f</div>"
        +"<div class=\"item\"><kbd>F</kbd>\u641c\u7d22\u8282\u70b9</div>"
        +"<div class=\"item\"><kbd>P</kbd>\u63d0\u793a\u8bcd\u5de5\u5177</div>"
        +"<div class=\"item\"><kbd>?</kbd>\u5e2e\u52a9\u5feb\u7167</div>"
        +"</div>"
        +"<div class=\"sec-title\">\u529f\u80fd\u6a21\u5757</div>"
        +"<div class=\"w-feats\"><span>\u63d0\u793a\u8bcd\u6a21\u677f</span><span>AI \u589e\u5f3a</span><span>\u6807\u7b7e\u7cfb\u7edf</span><span>29 \u79cd\u4e3b\u9898\u9884\u8bbe</span><span>\u8c03\u8272\u677f</span><span>\u6309\u94ae\u6837\u5f0f</span></div>"
        +"<div class=\"w-tips\"><p>\u53f3\u952e\u70b9\u51fb\u6d6e\u52a8\u6309\u94ae\u53ef\u5faa\u73af\u5207\u6362\u6837\u5f0f</p><p>\u6807\u7b7e\u56fe\u6807\u4f4d\u4e8e\u8f93\u5165\u6846\u53f3\u4e0b\u89d2</p><p>FPS \u9762\u677f\u60ac\u505c\u53ef\u67e5\u770b\u5feb\u6377\u952e\u5feb\u7167</p></div>"
        +"<div class=\"w-actions\"><button class=\"w-btn\">\u5f00\u59cb\u4f7f\u7528</button></div></div>";
      document.body.appendChild(ov);
      var close=function(){ov.remove();try{localStorage.setItem("_lt_first_run","1");}catch(e){}};
      ov.querySelector(".w-btn").onclick=close;
      ov.querySelector(".w-close").onclick=close;
      ov.addEventListener("click",function(e){if(e.target===ov)close();});
    }
    function _ltTryWelcome(){if(_ltWelcomePending)return;_ltWelcomePending=true;setTimeout(function(){_ltWelcomePending=false;_ltShowWelcome();},3000)}
    window._ltShowWelcome=_ltShowWelcome; /* 桥接：设置面板「帮助/重新显示引导」在本 IIFE 外裸调用会 ReferenceError */
    /* 监听器在命中 .react-flow 后立即 disconnect 退位：body 级 observer 常驻会让站点每次
       React 提交都唤醒一次全文档 querySelector。退位后按钮生杀交给 2s 轮询（同 _ltWatchViewport
       模式）：离开画布移除、回来重建。observer 只负责首次出现的即时性 */
    var _obs=null;
    function _ltWatchFlow(){
      if(document.querySelector(".react-flow")){_createBtn();_ltTryWelcome();if(_obs){_obs.disconnect();_obs=null;}}
      else{_removeBtn();}
    }
    _obs=new MutationObserver(_ltWatchFlow);
    _obs.observe(document.body,{childList:true,subtree:true});
    setInterval(_ltWatchFlow,2000);
    _ltWatchFlow();
  })();
  /* ===== 电路板连线（避让式直角路由 v2）=====
   * 替代旧版"固定先横后竖"的简单直角折线：
   * 1. 起点/终点吸附到节点边缘（PCB 引出，不从中心乱穿）
   * 2. 候选路径（L 形 + Z 形采样）逐一做节点避让检测（线段-矩形相交）
   * 3. 选无障碍最短路径，转折处加圆角（二次贝塞尔）
   * 4. 性能模式下降级为方向感知 L 形（跳过避让计算）
   * 5. 节点包围盒统一转换到 SVG 用户坐标（getScreenCTM 逆矩阵），
   *    与 path 的 getPointAtLength 坐标系一致
   */
  var _ltStepTo=null,_ltStepBoxes=null,_ltStepBoxSvg=null,_ltStepBoxAt=0,_ltStepRaf=0;
  function _ltStepBoxCache(svg){
    var now=Date.now();
    if(_ltStepBoxes&&_ltStepBoxSvg===svg&&now-_ltStepBoxAt<200)return _ltStepBoxes;
    var ctm=svg.getScreenCTM(),inv=ctm?ctm.inverse():null;
    var boxes=[];
    document.querySelectorAll(".react-flow__node").forEach(function(n){
      var r=n.getBoundingClientRect();
      if(inv){
        var p1=svg.createSVGPoint(),p2=svg.createSVGPoint();
        p1.x=r.left;p1.y=r.top;p2.x=r.left+r.width;p2.y=r.top+r.height;
        var a=p1.matrixTransform(inv),b=p2.matrixTransform(inv);
        boxes.push({x:a.x,y:a.y,w:b.x-a.x,h:b.y-a.y,id:n.getAttribute("data-id")||n.id||""});
      }else{
        boxes.push({x:r.left,y:r.top,w:r.width,h:r.height,id:n.getAttribute("data-id")||n.id||""});
      }
    });
    _ltStepBoxes=boxes;_ltStepBoxSvg=svg;_ltStepBoxAt=now;
    return boxes;
  }
  function _ltStepOnSeg(ax,ay,bx,by,cx,cy){
    return cx>=Math.min(ax,bx)&&cx<=Math.max(ax,bx)&&cy>=Math.min(ay,by)&&cy<=Math.max(ay,by);
  }
  function _ltStepSegSeg(x1,y1,x2,y2,x3,y3,x4,y4){
    function ccw(ax,ay,bx,by,cx,cy){return (cx-ax)*(by-ay)-(cy-ay)*(bx-ax);}
    var d1=ccw(x3,y3,x4,y4,x1,y1),d2=ccw(x3,y3,x4,y4,x2,y2);
    var d3=ccw(x1,y1,x2,y2,x3,y3),d4=ccw(x1,y1,x2,y2,x4,y4);
    if(((d1>0&&d2<0)||(d1<0&&d2>0))&&((d3>0&&d4<0)||(d3<0&&d4>0)))return true;
    if(d1===0&&_ltStepOnSeg(x3,y3,x4,y4,x1,y1))return true;
    if(d2===0&&_ltStepOnSeg(x3,y3,x4,y4,x2,y2))return true;
    if(d3===0&&_ltStepOnSeg(x1,y1,x2,y2,x3,y3))return true;
    if(d4===0&&_ltStepOnSeg(x1,y1,x2,y2,x4,y4))return true;
    return false;
  }
  function _ltStepSegRect(x1,y1,x2,y2,r){
    if(x1>=r.x&&x1<=r.x+r.w&&y1>=r.y&&y1<=r.y+r.h)return true;
    if(x2>=r.x&&x2<=r.x+r.w&&y2>=r.y&&y2<=r.y+r.h)return true;
    var ex=r.x+r.w,ey=r.y+r.h;
    return _ltStepSegSeg(x1,y1,x2,y2,r.x,r.y,ex,r.y)
      ||_ltStepSegSeg(x1,y1,x2,y2,ex,r.y,ex,ey)
      ||_ltStepSegSeg(x1,y1,x2,y2,ex,ey,r.x,ey)
      ||_ltStepSegSeg(x1,y1,x2,y2,r.x,ey,r.x,r.y);
  }
  function _ltStepPathLen(pts){
    var L=0;
    for(var i=1;i<pts.length;i++){
      L+=Math.sqrt((pts[i].x-pts[i-1].x)*(pts[i].x-pts[i-1].x)+(pts[i].y-pts[i-1].y)*(pts[i].y-pts[i-1].y));
    }
    return L;
  }
  function _ltStepPathHit(pts,boxes,exclude){
    for(var i=1;i<pts.length;i++){
      for(var b=0;b<boxes.length;b++){
        if(exclude[boxes[b].id])continue;
        if(_ltStepSegRect(pts[i-1].x,pts[i-1].y,pts[i].x,pts[i].y,boxes[b]))return true;
      }
    }
    return false;
  }
  function _ltStepSnapEdge(x,y,tx,ty,r){
    /* 把点 (x,y) 吸附到矩形 r 边缘（朝向目标 tx,ty），水平/垂直引出 */
    var cx=r.x+r.w/2,cy=r.y+r.h/2;
    if(Math.abs(tx-cx)>=Math.abs(ty-cy)){
      var nx=tx>=cx?r.x+r.w:r.x;
      return {x:nx,y:Math.max(r.y,Math.min(r.y+r.h,y))};
    }
    var ny=ty>=cy?r.y+r.h:r.y;
    return {x:Math.max(r.x,Math.min(r.x+r.w,x)),y:ny};
  }
  function _ltStepRoute(sx,sy,ex,ey,boxes,exclude,simple){
    var cands=[];
    cands.push([{x:sx,y:sy},{x:ex,y:sy},{x:ex,y:ey}]);
    cands.push([{x:sx,y:sy},{x:sx,y:ey},{x:ex,y:ey}]);
    if(!simple){
      /* 采样含外侧偏移点：起终点同线时也能向上/下/左/右绕行 */
      var gap=60;
      var xs=[sx-gap,sx+(ex-sx)*0.25,sx+(ex-sx)*0.5,sx+(ex-sx)*0.75,ex+gap,ex,sx];
      for(var i=0;i<xs.length;i++){
        var m=xs[i];
        if(Math.abs(m-sx)<2&&Math.abs(m-ex)<2)continue;
        cands.push([{x:sx,y:sy},{x:m,y:sy},{x:m,y:ey},{x:ex,y:ey}]);
      }
      var ys=[sy-gap,sy+(ey-sy)*0.25,sy+(ey-sy)*0.5,sy+(ey-sy)*0.75,ey+gap,ey,sy];
      for(var j=0;j<ys.length;j++){
        var m2=ys[j];
        if(Math.abs(m2-sy)<2&&Math.abs(m2-ey)<2)continue;
        cands.push([{x:sx,y:sy},{x:sx,y:m2},{x:ex,y:m2},{x:ex,y:ey}]);
      }
    }
    var best=null,bestLen=Infinity;
    for(var k=0;k<cands.length;k++){
      var c=cands[k],L=_ltStepPathLen(c);
      if((simple||!_ltStepPathHit(c,boxes,exclude))&&L<bestLen){best=c;bestLen=L;}
    }
    return best||cands[0];
  }
  function _ltStepD(pts,r){
    /* 折线转 SVG d，转折处加圆角（二次贝塞尔 Q） */
    var d="M "+pts[0].x+" "+pts[0].y;
    for(var i=1;i<pts.length-1;i++){
      var a=pts[i-1],b=pts[i],c=pts[i+1];
      var la=Math.sqrt((b.x-a.x)*(b.x-a.x)+(b.y-a.y)*(b.y-a.y));
      var lb=Math.sqrt((c.x-b.x)*(c.x-b.x)+(c.y-b.y)*(c.y-b.y));
      if(la<r*2||lb<r*2){d+=" L "+b.x+" "+b.y;continue;}
      d+=" L "+(b.x+(a.x-b.x)*r/la)+" "+(b.y+(a.y-b.y)*r/la)
        +" Q "+b.x+" "+b.y+" "+(b.x+(c.x-b.x)*r/lb)+" "+(b.y+(c.y-b.y)*r/lb);
    }
    var last=pts[pts.length-1];
    d+=" L "+last.x+" "+last.y;
    return d;
  }
  function _ltStepEdges(){
    var simple=document.body.classList.contains("perf-mode");
    var paths=document.querySelectorAll(".react-flow__edges path");
    var svg=null;
    for(var i=0;i<paths.length;i++){
      if(paths[i].ownerSVGElement){svg=paths[i].ownerSVGElement;break;}
    }
    var boxes=svg?_ltStepBoxCache(svg):[];
    paths.forEach(function(p){
      var d=p.getAttribute("d")||"";
      if(d.indexOf("C")===-1)return;
      try{
        var len=p.getTotalLength();
        if(!len||isNaN(len))return;
        var s=p.getPointAtLength(0),e=p.getPointAtLength(len);
        var edgeEl=p.closest?p.closest(".react-flow__edge"):null;
        var exclude={},sId="",eId="";
        if(edgeEl){
          var lb=(edgeEl.getAttribute("aria-label")||"").trim(),m=lb.match(/^Edge from (\S+) to (\S+)$/);
          if(m){sId=m[1];eId=m[2];if(sId)exclude[sId]=1;if(eId)exclude[eId]=1;}
        }
        for(var b=0;b<boxes.length;b++){
          if(boxes[b].id===sId){
            var sp=_ltStepSnapEdge(s.x,s.y,e.x,e.y,boxes[b]);s={x:sp.x,y:sp.y};
          }
          if(boxes[b].id===eId){
            var ep=_ltStepSnapEdge(e.x,e.y,s.x,s.y,boxes[b]);e={x:ep.x,y:ep.y};
          }
        }
        var pts=_ltStepRoute(s.x,s.y,e.x,e.y,boxes,exclude,simple);
        var r=Math.max(3,Math.min(8,Math.abs(e.x-s.x)/4,Math.abs(e.y-s.y)/4));
        p.setAttribute("d",_ltStepD(pts,r));
      }catch(ex){}
    });
  }
  var _ltStepObs=null,_ltStepRetries=0;
  function _ltStepApply(){
    if(_ltStepTo){clearTimeout(_ltStepTo);_ltStepTo=null;}
    var ed=document.querySelector(".react-flow__edges");
    if(!ed){if(++_ltStepRetries>5)return;_ltStepTo=setTimeout(_ltStepApply,500);return;}
    _ltStepRetries=0;
    if(document.body.classList.contains("libtv-step-edges")){
      if(_ltStepRaf)cancelAnimationFrame(_ltStepRaf);
      _ltStepRaf=requestAnimationFrame(function(){_ltStepRaf=0;_ltStepEdges();});
      if(!_ltStepObs){
        var _ltStepParent=document.querySelector(".react-flow")||document.body;
        _ltStepObs=new MutationObserver(function(){_ltStepRetries=0;_ltStepApply();});
        _ltStepObs.observe(_ltStepParent,{childList:true,subtree:true,attributes:true,attributeFilter:["d"]});
      }
    }else{
      if(_ltStepObs){_ltStepObs.disconnect();_ltStepObs=null;}
    }
  }
  var _ltStepOn=localStorage.getItem("_lt_step")==="1";
  if(_ltStepOn){ document.body.classList.add("libtv-step-edges"); _ltStepApply(); }
  document.addEventListener("keydown",function(e){
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.key==="Escape"){
      var _handled=false;
      var _tm=document.getElementById("lt-tag-menu"); if(_tm){_ltCloseTagMenu();_handled=true;}
      var _pie=document.getElementById("lt-pie"); if(_pie){_ltPieClose();_handled=true;}
      ["libtv-search","libtv-prompt","lt-settings","lt-ai-panel","lt-acc-panel","lt-cp-overlay","lt-diag","lt-pie"].forEach(function(_id){
        var el=document.getElementById(_id);
        if(el){el.remove();_handled=true;}
      });
      var _wl=document.getElementById("libtv-welcome-overlay");
      if(_wl){_wl.remove();try{localStorage.setItem("_lt_first_run","1");}catch(ex){}_handled=true;}
      _ltClearChain();
      if(_handled){e.preventDefault();e.stopPropagation();}
      return;
    }
    var t=e.target||document.activeElement;
    if(t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.isContentEditable)){
      return;
    }
    if(e.key==="g"||e.key==="G"){
      e.preventDefault(); e.stopPropagation();
      var bg=document.querySelector(".react-flow__background");
      if(bg) bg.classList.toggle("perf-no-grid");
      try{localStorage.setItem("_lt_grid",bg.classList.contains("perf-no-grid")?"1":"0");}catch(ex){}
      return;
    }
    if(e.key==="t"||e.key==="T"){
      e.preventDefault(); e.stopPropagation();
      document.body.classList.toggle("perf-mode");
      try{localStorage.setItem("_lt_perf",document.body.classList.contains("perf-mode")?"1":"0");}catch(ex){}
      return;
    }
    if(e.key==="h"||e.key==="H"){
      e.preventDefault(); e.stopPropagation();
      document.body.classList.toggle("perf-hide-imgs");
      try{localStorage.setItem("_lt_hide",document.body.classList.contains("perf-hide-imgs")?"1":"0");}catch(ex){}
      return;
    }
    if(e.key==="l"||e.key==="L"){
      e.preventDefault(); e.stopPropagation();
      var edges=document.querySelector(".react-flow__edges");
      if(edges) edges.classList.toggle("perf-hide-edges");
      try{localStorage.setItem("_lt_edges",edges.classList.contains("perf-hide-edges")?"1":"0");}catch(ex){}
      return;
    }
    if(e.key==="c"||e.key==="C"){
      e.preventDefault(); e.stopPropagation();
      _ltAutoChain=!_ltAutoChain;
      document.body.classList.toggle("libtv-autochain",_ltAutoChain);
      try{localStorage.setItem("_lt_autochain",_ltAutoChain?"1":"0");}catch(ex){}
      if(!_ltAutoChain) _ltClearChain();
      return;
    }
    if(e.key==="f"||e.key==="F"){
      e.preventDefault(); e.stopPropagation();
      _ltSearch();
      return;
    }
    if(e.key==="p"||e.key==="P"){
      e.preventDefault(); e.stopPropagation();
      _ltPromptPanel();
      return;
    }
    if(e.key==="x"||e.key==="X"){
      e.preventDefault(); e.stopPropagation();
      document.body.classList.toggle("libtv-focus");
      try{localStorage.setItem("_lt_focus",document.body.classList.contains("libtv-focus")?"1":"0");}catch(ex){}
      return;
    }
    if(e.key==="r"||e.key==="R"){
      e.preventDefault(); e.stopPropagation();
      document.body.classList.toggle("libtv-step-edges");
      try{localStorage.setItem("_lt_step",document.body.classList.contains("libtv-step-edges")?"1":"0");}catch(ex){}
      _ltStepApply();
      return;
    }
    if(e.key==="a"||e.key==="A"){
      e.preventDefault(); e.stopPropagation();
      if(!e.repeat) _ltPieToggle();
      return;
    }
    if(e.key==="?"||e.key==="/"){
      e.preventDefault(); e.stopPropagation();
      var h=document.getElementById("libtv-help");
      if(h){ h.classList.toggle("libtv-pin"); if(h.classList.contains("libtv-pin")) h.classList.remove("libtv-hide"); else h.classList.add("libtv-hide"); }
      return;
    }
  }, true);
  function _ltEsc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
  /* 从 API 地址提取「模型方」（host，去掉协议/端口/path），用于状态栏简洁展示 */
  function _ltHost(u){try{return new URL(u).host;}catch(e){return u?String(u).replace(/^https?:\/\//,'').replace(/\/.*$/,''):'';}}
  /* 安全读取 JSON localStorage（损坏返回默认值；函数声明提升，IIFE 内任意位置可用） */
  function _ltJ(k,d){try{var v=JSON.parse(localStorage.getItem(k));return v==null?d:v;}catch(e){return d;}}
  function _ltAPIRead(){var a=_ltJ("_lt_prompt_api",{});return a&&typeof a==="object"?a:{}};
  /* ── 模型列表缓存：按 base+key 维度存 localStorage，换地址/换 Key 自动失效，24h 过期 ──
     key 不进键名明文（localStorage 键名在 DevTools 一眼可见），改存 djb2 哈希；base 保留便于人工辨识 */
  function _ltModelsHash(s){var h=5381;for(var i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))>>>0;return h.toString(36);}
  function _ltModelsCacheKey(base,key){return "_lt_models_cache|"+base+"|"+_ltModelsHash(String(key||""));}
  function _ltModelsCacheGet(base,key){
    var c=_ltJ(_ltModelsCacheKey(base,key),null);
    if(!c||!Array.isArray(c.models)||!c.models.length)return null;
    if(Date.now()-(c.at||0)>86400000)return null; /* 24h 过期 */
    return c;
  }
  function _ltModelsCacheSet(base,key,list){
    try{
      localStorage.setItem(_ltModelsCacheKey(base,key),JSON.stringify({models:list,at:Date.now()}));
      /* 淘汰：过期条目直接删；仍超量则按时间删最旧（换预设/换 Key 会累积孤儿键，只过期不清理越长越多）。
         旧明文键名格式的存量条目读不到新键，也会被本轮过期清扫自然回收 */
      var del=[],keep=[];
      for(var i=0;i<localStorage.length;i++){
        var k=localStorage.key(i);
        if(!k||k.indexOf("_lt_models_cache|")!==0)continue;
        var at=0;try{at=JSON.parse(localStorage.getItem(k)).at||0;}catch(e){}
        if(Date.now()-at>86400000)del.push(k);else keep.push({k:k,at:at});
      }
      del.forEach(function(k){try{localStorage.removeItem(k);}catch(e){}});
      if(keep.length>20){
        keep.sort(function(a,b){return a.at-b.at;});
        for(var j=0;j<keep.length-20;j++){try{localStorage.removeItem(keep[j].k);}catch(e){}}
      }
    }catch(e){}
  }
  function _ltApiBase(u){
    u=(u||"").trim().replace(/\/+$/,"");
    if(!u)return "";
    return u.replace(/\/chat\/completions$/,"").replace(/\/completions$/,"");
  }
  /* ── 浮层定位助手：弹层挂 body（position:fixed），高于面板层级不被 overflow 裁剪；随按钮滚动跟随，下方空间不足翻上方 ──
     返回 stop() ，关闭弹层时调用以解绑事件 */
  function _ltFloatPop(btn,pop,minW){
    pop.style.position="fixed";
    pop.style.zIndex="100007";
    document.body.appendChild(pop);
    var raf=0;
    function place(){
      var r=btn.getBoundingClientRect();
      if(!r.width&&!r.height){return;}
      var pw=pop.offsetWidth,ph=pop.offsetHeight;
      if(minW&&pw<minW){pop.style.minWidth=minW+"px";pw=minW;}
      var x=Math.min(Math.max(8,r.left),Math.max(8,window.innerWidth-pw-8));
      var y=r.bottom+6;
      if(y+ph>window.innerHeight-8&&r.top-ph-6>8){y=r.top-ph-6;}
      pop.style.left=Math.round(x)+"px";
      pop.style.top=Math.round(y)+"px";
    }
    function onMove(){if(!raf)raf=requestAnimationFrame(function(){raf=0;place();});}
    function stop(){
      window.removeEventListener("scroll",onMove,true);
      window.removeEventListener("resize",onMove);
      if(raf)cancelAnimationFrame(raf);
    }
    window.addEventListener("scroll",onMove,true);
    window.addEventListener("resize",onMove);
    place();
    return {stop:stop,place:place};
  }

  /* ── 通用自绘下拉（替代原生 select）：对齐面板毛玻璃风格，原生 select 弹层不受 CSS 控制故自绖 ──
     用法：var dd=_ltDropdown({placeholder:"...",className:"..."}); container.appendChild(dd.el);
     dd.value 读写、dd.onchange 回调、dd.setList([{value,label}]) */
  function _ltDropdown(opts){
    opts=opts||{};
    var state={value:"",items:[],open:false,pop:null};
    var el=document.createElement("button");
    el.type="button";
    el.className=opts.className||"lt-dd-btn";
    el.style.cssText="display:inline-flex;align-items:center;gap:5px;justify-content:space-between;text-align:left;";
    var lbl=document.createElement("span");
    lbl.style.cssText="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
    lbl.textContent=opts.placeholder||"—";
    var arrow=document.createElement("span");
    arrow.textContent="▾";
    arrow.style.cssText="font-size:9px;color:rgba(255,255,255,0.4);flex-shrink:0;margin-left:auto;transition:transform .15s ease-out;";
    el.appendChild(lbl);el.appendChild(arrow);

    var stopFloat=null;
    function close(){
      if(state.pop){state.pop.remove();state.pop=null;}
      if(stopFloat){stopFloat();stopFloat=null;}
      state.open=false;
      arrow.style.transform="";
    }
    function open(){
      if(state.open){close();return;}
      state.pop=document.createElement("div");
      state.pop.className="lt-dd-pop";
      state.pop.style.cssText="max-height:260px;overflow-y:auto;scrollbar-gutter:stable;background:rgba(15,15,22,0.97);backdrop-filter:blur(24px) saturate(1.3);-webkit-backdrop-filter:blur(24px) saturate(1.3);border:1px solid rgba(var(--accent-light-rgb),0.25);border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,0.6);padding:5px;";
      /* 挂 body + fixed：高于面板层级，不被 overflow:hidden 裁剪 */
      stopFloat=_ltFloatPop(el,state.pop,el.offsetWidth||170);
      state.open=true;
      arrow.style.transform="rotate(180deg)";
      render();
      setTimeout(function(){
        document.addEventListener("mousedown",function _c(e){
          if(state.pop&&!state.pop.contains(e.target)&&!el.contains(e.target)){close();document.removeEventListener("mousedown",_c);}
        });
      },0);
    }
    function render(){
      if(!state.pop)return;
      if(!state.items.length){
        state.pop.innerHTML='<div style="padding:10px 0;text-align:center;color:rgba(255,255,255,0.3);font-size:11px;">无选项</div>';
        return;
      }
      state.pop.innerHTML=state.items.map(function(it){
        var sel=String(it.value)===String(state.value);
        return '<div class="lt-model-item'+(sel?" cur":"")+'" data-value="'+_ltEsc(it.value)+'">'+_ltEsc(it.label)+(sel?'<span style="margin-left:auto;font-size:10px;color:var(--accent-light);flex-shrink:0;">✓</span>':"")+'</div>';
      }).join("");
      state.pop.querySelectorAll(".lt-model-item").forEach(function(item){
        item.onclick=function(){
          var v=item.getAttribute("data-value");
          api.setValue(v);
          close();
        };
      });
    }
    var api={
      el:el,
      get value(){return state.value;},
      set value(v){api.setValue(v,true);},
      setList:function(items){
        state.items=items||[];
        render();
        _updLabel();
      },
      setValue:function(v,silent){
        state.value=v;
        var found=null;
        for(var i=0;i<state.items.length;i++)if(String(state.items[i].value)===String(v)){found=state.items[i];break;}
        lbl.textContent=found?found.label:(v===""?opts.placeholder||"—":String(v));
        render();
        if(!silent&&typeof api.onchange==="function")api.onchange();
      },
      open:open,close:close
    };
    function _updLabel(){
      var found=null;
      for(var i=0;i<state.items.length;i++)if(String(state.items[i].value)===String(state.value)){found=state.items[i];break;}
      lbl.textContent=found?found.label:(state.value===""?opts.placeholder||"—":String(state.value));
    }
    el.onclick=open;
    return api;
  }

  /* ── 通用模型下拉选择（自绘弹层）：任意面板可调，缓存优先自动加载，选中即写回当前 API 配置并同步预设 ──
     外观对齐面板毛玻璃风格；原生 select 的弹层不受 CSS 控制，故自绘。
     用法：_ltModelSelect(container, style, onPicked)
       container = 放置下拉的元素；style = "ltp"（CSS 类 .lt-model-sel）或 "ap"（内联样式）
       onPicked(model) = 选中回调，刷新调用方状态栏 */
  function _ltModelSelect(container,style,onPicked){
    var api=_ltAPIRead();
    var wrap=document.createElement("span");
    wrap.style.cssText="position:relative;display:inline-flex;align-items:center;gap:4px;";
    var btn=document.createElement("button");
    btn.type="button";
    btn.className="lt-model-sel";
    btn.title="切换模型";
    if(style==="ap"){
      btn.style.cssText="display:inline-flex;align-items:center;gap:5px;max-width:170px;"+_apSelBtnCss();
    }
    var lbl=document.createElement("span");
    lbl.className="lt-model-sel-label";
    lbl.style.cssText="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:130px;";
    var arrow=document.createElement("span");
    arrow.textContent="▾";
    arrow.style.cssText="font-size:9px;color:rgba(255,255,255,0.4);flex-shrink:0;transition:transform .15s ease-out;";
    btn.appendChild(lbl);btn.appendChild(arrow);
    var rf=document.createElement("span");
    rf.textContent="⟳";
    rf.title="重新拉取模型列表";
    rf.style.cssText="cursor:pointer;color:rgba(255,255,255,0.35);font-size:13px;padding:2px 4px;border-radius:4px;flex-shrink:0;transition:color .15s;";
    rf.onmouseenter=function(){this.style.color="var(--accent-light)";};
    rf.onmouseleave=function(){this.style.color="rgba(255,255,255,0.35)";};
    wrap.appendChild(btn);wrap.appendChild(rf);
    container.insertBefore(wrap,container.firstChild);

    var cur=api.model||"";
    var base=_ltApiBase(api.url||""),key=api.key||"";
    var paths=/\/v1$/.test(base)?["/models","/v1/models"]:["/v1/models","/models"];
    var listCache=[];
    var pop=null;

    function setLabel(t){lbl.textContent=t;btn.title="当前: "+(t||"(网关默认)")+(listCache.length?(" · 共 "+listCache.length+" 个模型"):"");}
    function _apSelBtnCss(){
      return "background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#aaa;border-radius:8px;padding:6px 10px;font:12px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;outline:none;cursor:pointer;transition:border-color .15s ease-out,color .15s ease-out;";
    }
    var stopFloat=null;
    function closePop(){
      if(pop){pop.remove();pop=null;}
      if(stopFloat){stopFloat();stopFloat=null;}
      arrow.style.transform="";
    }
    function openPop(){
      if(pop){closePop();return;}
      if(!api.url){_ltToast("请先在设置中配置 API 地址");return;}
      pop=document.createElement("div");
      pop.className="lt-model-pop";
      pop.style.cssText="max-width:330px;max-height:260px;overflow-y:auto;scrollbar-gutter:stable;background:rgba(15,15,22,0.97);backdrop-filter:blur(24px) saturate(1.3);-webkit-backdrop-filter:blur(24px) saturate(1.3);border:1px solid rgba(var(--accent-light-rgb),0.25);border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,0.6);padding:5px;";
      /* 挂 body + fixed：高于面板层级，不被 overflow:hidden 裁剪 */
      stopFloat=_ltFloatPop(btn,pop,230);
      arrow.style.transform="rotate(180deg)";
      renderPop();
      setTimeout(function(){
        document.addEventListener("mousedown",function _c(e){
          if(pop&&!pop.contains(e.target)&&!btn.contains(e.target)){closePop();document.removeEventListener("mousedown",_c);}
        });
      },0);
    }
    function renderPop(){
      if(!pop)return;
      cur=_ltAPIRead().model||"";
      if(!listCache.length){
        pop.innerHTML='<div style="padding:12px 0;text-align:center;color:rgba(255,255,255,0.35);font-size:11px;">拉取模型中...</div>';
        return;
      }
      var h="";
      if(!cur)h+='<div class="lt-model-item" data-model="" style="'+(listCache.indexOf("")<0?"":"")+'">(网关默认)</div>';
      listCache.forEach(function(m){
        var sel=m===cur;
        h+='<div class="lt-model-item'+(sel?" cur":"")+'" data-model="'+_ltEsc(m)+'">'+_ltEsc(m)+(sel?'<span style="margin-left:auto;font-size:10px;color:var(--accent-light);flex-shrink:0;">✓</span>':"")+'</div>';
      });
      pop.innerHTML=h;
      pop.querySelectorAll(".lt-model-item").forEach(function(el){
        el.onclick=function(){
          var m=el.getAttribute("data-model");
          pick(m);
          closePop();
        };
      });
      /* 当前项滚动到可视区 */
      var cEl=pop.querySelector(".lt-model-item.cur");
      if(cEl&&cEl.scrollIntoView)try{cEl.scrollIntoView({block:"nearest"});}catch(e){}
    }
    function pick(m){
      var d=_ltAPIRead();
      d.model=m||"";
      try{localStorage.setItem("_lt_prompt_api",JSON.stringify(d));}catch(e){}
      _ltPromptAPI=d;
      var aps=_ltJ("_lt_api_presets",[]);
      for(var i=0;i<aps.length;i++){if(aps[i].id===d.id){aps[i].model=m||"";aps[i].url=d.url;aps[i].key=d.key;break;}}
      try{localStorage.setItem("_lt_api_presets",JSON.stringify(aps));}catch(e){}
      setLabel(m||"(网关默认)");
      if(onPicked)onPicked(m||"");
    }
    function fill(list){
      listCache=list;
      var c=_ltAPIRead().model||"";
      /* 当前配置的模型不在列表中（手输/离线）也保留，避免切换后丢失 */
      if(c&&list.indexOf(c)<0)listCache=[c].concat(list);
      setLabel(c||"(网关默认)");
      if(pop){renderPop();if(stopFloat)stopFloat.place();}
    }
    function load(force){
      var cached=_ltModelsCacheGet(base,key);
      if(cached&&!force){fill(cached.models);return;}
      setLabel(cur||"拉取中...");
      _ltFetchModels(base,key,paths)
      .then(function(list){
        _ltModelsCacheSet(base,key,list);
        fill(list);
      })
      .catch(function(err){
        if(!listCache.length)setLabel(cur||"拉取失败");
        rf.title="拉取失败: "+_ltModelsErrDesc(err,api.url).slice(0,150);
      });
    }
    btn.onclick=openPop;
    rf.onclick=function(){
      try{localStorage.removeItem(_ltModelsCacheKey(base,key));}catch(e){}
      listCache=[];
      if(pop)renderPop();
      load(true);
    };
    if(!api.url){
      setLabel("未配置 API");
      btn.disabled=true;rf.style.display="none";
      return;
    }
    load(false);
  }

  function _ltModelsErrDesc(err,url){
    // \u73b0\u5728\u8bf7\u6c42\u8d70 GM_xmlhttpRequest\uff08\u6cb9\u732b\u6269\u5c55\u4ee3\u53d1\uff0c\u5df2\u7ed5\u8fc7 CORS\uff09\u3002
    // \u82e5\u4ecd\u5931\u8d25\u5e76\u629b TypeError\uff0c\u8bf4\u660e\u662f\u7f51\u7edc\u5c42\u95ee\u9898\uff1a\u5730\u5740/\u7aef\u53e3\u4e0d\u901a\u3001\u88ab\u5899\u3001\u6216\u7f51\u5173\u62d2\u7edd\u6269\u5c55\u8bf7\u6c42\u3002
    if(err&&err.name==="TypeError"){
      var tip=[];
      if(/^http:\/\//i.test(url))tip.push("\u5f53\u524d\u9875\u9762\u4e3a HTTPS\uff0c\u4f46\u7f51\u5173\u662f HTTP\uff0c\u8bf7\u6539\u7528 https:// \u6216\u672c\u5730\u4ee3\u7406");
      tip.push("\u8bf7\u786e\u8ba4\uff1a\u2460\u7f51\u5173\u5730\u5740/\u7aef\u53e3\u53ef\u8bbf\u95ee\uff08\u53ef\u7528\u5176\u4ed6\u8f6f\u4ef6\u9a8c\u8bc1\uff09 \u2461\u6ca1\u6709\u88ab\u9632\u706b\u5899/\u4ee3\u7406\u62e6\u622a \u2462\u63d0\u793a\u8bcd Key \u4e0e\u8be5\u7f51\u5173\u5339\u914d");
      return "\u8bf7\u6c42\u5931\u8d25\uff08\u7f51\u7edc\u4e0d\u901a/\u5730\u5740\u9519\u8bef/\u88ab\u62e6\u622a\uff09: "+tip.join("\uff1b");
    }
    return err?err.message:"\u672a\u77e5\u9519\u8bef";
  }
  function _ltFetchModels(base,key,paths){
    var i=0;
    return new Promise(function(res,rej){
      function next(){
        var p=paths[i++];
        if(!p)return rej(new Error("\u6240\u6709 /models \u7aef\u70b9\u5747\u5931\u8d25"));
        var u=base+p;
        _ltXHR({url:u,headers:{"Authorization":"Bearer "+key}})
        .then(function(o){
          if(!o.r.ok){
            if(o.r.status===404&&i<paths.length)return next();
            throw new Error("HTTP "+o.r.status+(o.t?" "+o.t.slice(0,120):"")+" @ "+u);
          }
          var d;try{d=JSON.parse(o.t);}catch(e){d=null;}
          var list=(d&&(d.data||d.models)||[]).map(function(m){return typeof m==="string"?m:(m.id||m.name||"");}).filter(Boolean).sort();
          if(!list.length){
            if(i<paths.length)return next();
            throw new Error("\u672a\u627e\u5230\u6a21\u578b\u5217\u8868");
          }
          res(list);
        })
        .catch(function(err){rej(err);});
      }
      next();
    });
  }

  /* 校验账号备份字符串确为 JSON 数组（cookie/IndexedDB 兑底链共用；顶层声明，避免踩「嵌套作用域函数不能顶层调用」旧坑） */
  function _ltAccValid(s){try{return Array.isArray(JSON.parse(s));}catch(e){return false;}}
  /* IndexedDB 二级兑底存储：v1.10.6 曾把这两个函数留在 _ltPromptPanel 内部，顶层启动恢复调用实际一直被 try/catch 吞掉、从未生效，现提升至 IIFE 顶层 */
  function _ltIDBSet(k,v){try{var r=indexedDB.open("_lt_boost",1);r.onupgradeneeded=function(e){e.target.result.createObjectStore("b");};r.onsuccess=function(e){var db=e.target.result,tx=db.transaction("b","readwrite");tx.objectStore("b").put(v,k);tx.oncomplete=function(){db.close();};};}catch(e){}}
  function _ltIDBGet(k,cb){try{var r=indexedDB.open("_lt_boost",1);r.onupgradeneeded=function(e){e.target.result.createObjectStore("b");};r.onsuccess=function(e){var db=e.target.result,tx=db.transaction("b","readonly");var q=tx.objectStore("b").get(k);q.onsuccess=function(){cb(q.result);db.close();};q.onerror=function(){cb(null);db.close();};};r.onerror=function(){cb(null);};}catch(e){cb(null);}}
  function _ltToast(msg, dur){var e=document.getElementById("_ltToast");if(!e){e=document.createElement("div");e.id="_ltToast";Object.assign(e.style,{position:"fixed",bottom:"20px",left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,.8)",color:"#fff",padding:"8px 18px",borderRadius:"6px",zIndex:99999,fontSize:"14px",pointerEvents:"none",transition:"opacity .3s",opacity:"0"});document.body.appendChild(e)}e.textContent=msg;e.style.opacity="1";clearTimeout(e._t);e._t=setTimeout(function(){e.style.opacity="0"},dur||2000);}
  /* 内容包导入消毒：外部 JSON 的 id 若含引号/尖括号，渲染时直插 HTML 属性就是 XSS；id 收敛为安全字符集，字符串字段收敛为字符串并限长 */
  function _ltSanitizeId(v,fb){
    var id=String(v==null?"":v).replace(/[^a-zA-Z0-9_\-]/g,"").slice(0,40);
    return id||fb;
  }
  function _ltSanitizePrompts(list){
    if(!Array.isArray(list))return [];
    return list.filter(function(p){return p&&typeof p==="object";}).map(function(p,i){
      return {id:_ltSanitizeId(p.id,"p"+Date.now().toString(36)+i),name:String(p.name||"未命名").slice(0,120),category:String(p.category||"通用").slice(0,40),content:String(p.content==null?"":p.content)};
    });
  }
  function _ltSanitizeAIPresets(list){
    if(!Array.isArray(list))return [];
    return list.filter(function(p){return p&&typeof p==="object";}).map(function(p,i){
      return {id:_ltSanitizeId(p.id,"cp_"+Date.now().toString(36)+i),name:String(p.name||"预设").slice(0,60),sys:String(p.sys==null?"":p.sys),created:+p.created||Date.now()};
    });
  }
  function _ltBuildContentPack(){
    var prompts=_ltJ("_lt_prompts",[]);
    var tagLibs=_ltJ("_lt_tag_libs",null)||{};
    var curLib=localStorage.getItem("_lt_cur_lib")||"默认标签";
    var aiPresets=_ltJ("_lt_ai_custom_presets",[]);
    var aiSys=localStorage.getItem("_lt_ai_sys")||"";
    return {app:"libtv-boost",type:"content-pack",version:2,exportedAt:new Date().toISOString(),currentLib:curLib,prompts:prompts,tagLibs:tagLibs,aiPresets:aiPresets,aiSys:aiSys};
  }
  function _ltDownloadContentPack(){
    var str=JSON.stringify(_ltBuildContentPack(),null,2);
    var blob=new Blob([str],{type:"application/json"});
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a");
    var d=new Date(),pad=function(n){return (n<10?"0":"")+n;};
    a.href=url;a.download="libtv-content-pack-"+d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+".json";
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){try{URL.revokeObjectURL(url);}catch(e){}},1000);
  }
  function _ltImportContentPackFromFile(){
    var inp=document.createElement("input");inp.type="file";inp.accept="application/json,.json";
    inp.onchange=function(){var f=inp.files&&inp.files[0];if(!f)return;var r=new FileReader();r.onload=function(){try{_ltShowContentPackChooser(String(r.result));}catch(e){_ltToast("内容包解析失败："+e.message);}};r.readAsText(f);};
    inp.click();
  }
  function _ltShowContentPackChooser(text){
    var data;try{data=JSON.parse(text);}catch(e){_ltToast("不是有效的 JSON 内容包："+e.message);return;}
    if(!data||data.type!=="content-pack"){_ltToast("文件不是 libtv-boost 内容包（缺少 type:\"content-pack\"）");return;}
    var ov=document.createElement("div");ov.id="lt-cp-overlay";
    ov.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:2147483647;display:flex;align-items:center;justify-content:center;";
    var box=document.createElement("div");
    box.style.cssText="background:#1b1d2a;border:1px solid rgba(129,140,248,0.3);border-radius:12px;padding:22px;min-width:320px;max-width:90vw;color:#e7e9f3;font-family:inherit;";
    var pcount=Array.isArray(data.prompts)?data.prompts.length:0;
    var tcount=data.tagLibs?Object.keys(data.tagLibs).length:0;
    var acount=Array.isArray(data.aiPresets)?data.aiPresets.length:0;
    var asys=data.aiSys?" · 自定义 system prompt":"";
    box.innerHTML='<div style="font-size:15px;font-weight:600;margin-bottom:6px;">导入内容包</div>'
      +'<div style="font-size:12px;color:rgba(255,255,255,0.55);margin-bottom:14px;">检测到 '+pcount+' 条提示词 · '+tcount+' 个标签库'+(acount?' · '+acount+' 个 AI 预设':'')+asys+'</div>'
      +'<div style="display:flex;flex-direction:column;gap:8px;">'
      +'<button id="lt-cp-replace" style="padding:10px;border-radius:8px;border:1px solid rgba(129,140,248,0.4);background:linear-gradient(135deg,rgba(129,140,248,0.25),rgba(167,139,250,0.25));color:#fff;cursor:pointer;font-size:13px;">整体替换（覆盖现有）</button>'
      +'<button id="lt-cp-merge" style="padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#e7e9f3;cursor:pointer;font-size:13px;">合并去重（保留现有）</button>'
      +'<button id="lt-cp-cancel" style="padding:9px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:rgba(255,255,255,0.6);cursor:pointer;font-size:12px;">取消</button>'
      +'</div>';
    ov.appendChild(box);document.body.appendChild(ov);
    function close(){if(ov.parentNode)ov.parentNode.removeChild(ov);}
    document.getElementById("lt-cp-replace").onclick=function(){close();_ltApplyContentPack(data,"replace");};
    document.getElementById("lt-cp-merge").onclick=function(){close();_ltApplyContentPack(data,"merge");};
    document.getElementById("lt-cp-cancel").onclick=close;
    ov.onclick=function(e){if(e.target===ov)close();};
  }
  function _ltApplyContentPack(data,mode){
    /* setItem 抛错=没写进去（配额超限等）：必须收集并报出来，否则 toast 假成功、刷新后全丢 */
    var fails=[];
    function _put(k,label,v){try{localStorage.setItem(k,v);}catch(e){fails.push(label);}}
    try{
      if(mode==="replace"){
        if(Array.isArray(data.prompts))_put("_lt_prompts","提示词",JSON.stringify(_ltSanitizePrompts(data.prompts)));
        if(data.tagLibs&&typeof data.tagLibs==="object")_put("_lt_tag_libs","标签库",JSON.stringify(data.tagLibs));
        if(data.currentLib)_put("_lt_cur_lib","当前标签库",data.currentLib);
        if(Array.isArray(data.aiPresets))_put("_lt_ai_custom_presets","AI 预设",JSON.stringify(_ltSanitizeAIPresets(data.aiPresets)));
        if(data.aiSys)_put("_lt_ai_sys","AI system prompt",data.aiSys);
      }else{
        // prompts merge（现有数据一并消毒：老版本导入过的恶意 id 也自愈）
        var prompts=_ltSanitizePrompts(_ltJ("_lt_prompts",[]));
        var seen={};prompts.forEach(function(p){seen[p.id]=true;});
        _ltSanitizePrompts(data.prompts).forEach(function(p){if(!seen[p.id]){prompts.push(p);seen[p.id]=true;}});
        _put("_lt_prompts","提示词",JSON.stringify(prompts));
        // tagLibs merge
        var tagLibs=JSON.parse(localStorage.getItem("_lt_tag_libs")||"null");if(!tagLibs)tagLibs={};
        var src=data.tagLibs||{};
        for(var k in src){if(!src.hasOwnProperty(k))continue;
          if(!tagLibs[k]){tagLibs[k]=src[k];continue;}
          var dstCats=tagLibs[k].categories||[];var srcCats=src[k].categories||[];
          srcCats.forEach(function(c){
            var ex=null;for(var i=0;i<dstCats.length;i++){if(dstCats[i].name===c.name){ex=dstCats[i];break;}}
            if(!ex){dstCats.push(c);return;}
            var dg=ex.groups||[];
            (c.groups||[]).forEach(function(g){
              var eg=null;for(var j=0;j<dg.length;j++){if(dg[j].name===g.name){eg=dg[j];break;}}
              if(!eg){dg.push(g);return;}
              eg.items=eg.items||[];(g.items||[]).forEach(function(it){if(eg.items.indexOf(it)<0)eg.items.push(it);});
            });
          });
          tagLibs[k].categories=dstCats;
        }
        _put("_lt_tag_libs","标签库",JSON.stringify(tagLibs));
        // aiPresets merge (by id)
        var presets=_ltSanitizeAIPresets(_ltJ("_lt_ai_custom_presets",[]));
        var pseen={};presets.forEach(function(p){pseen[p.id]=true;});
        _ltSanitizeAIPresets(data.aiPresets).forEach(function(p){if(!pseen[p.id]){presets.push(p);pseen[p.id]=true;}});
        _put("_lt_ai_custom_presets","AI 预设",JSON.stringify(presets));
        // aiSys: do not overwrite in merge mode
      }
      if(window._ltPromptRefresh)window._ltPromptRefresh();
      if(window._ltTagRefresh)window._ltTagRefresh();
      if(fails.length)_ltToast("⚠ 部分内容写入失败（"+fails.join("、")+"），刷新后会丢；请清理存储空间后重试");
      else _ltToast("✅ 内容包已导入（"+(mode==="replace"?"整体替换":"合并去重")+"）");
    }catch(e){_ltToast("导入失败："+e.message);}
  }
function _ltSettingsPanel(){
    var existing=document.getElementById("lt-settings");
    if(existing){existing.remove();return;}
    var div=document.createElement("div");div.id="lt-settings";div.className="lt-settings";
    /* Motif Settings Dialog 结构：左侧分组索引栏（图标+标签，tablist 键盘可达），右侧单面板
       （标题头 + 卡片化行：标题+描述左、控件右）。所有控件 id/class 保持不变，处理器零改动 */
    var IC={
      canvas:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 14l4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>',
      display:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z"/></svg>',
      rate:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>',
      api:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20v2"/><path d="M12 2v2"/><path d="M17 20v2"/><path d="M17 2v2"/><path d="M2 12h2"/><path d="M2 17h2"/><path d="M2 7h2"/><path d="M20 12h2"/><path d="M20 17h2"/><path d="M20 7h2"/><path d="M7 20v2"/><path d="M7 2v2"/><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/></svg>',
      data:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>',
      pet:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="4" cy="10" r="2"/><path d="M7.3 20.3c-.4-1.2-.3-2.4.3-3.4.4-.7.9-1.4 1.4-2.2.5-.9.8-1.9 1-3 1.9 0 4.2-.4 6.2-1.3.3 1 .4 2.1.3 3.1-.2 1.5-.8 3-1.7 4.3-.5.7-1.2 1.4-1.8 2.1-.7.8-1.9.9-2.8.3-.9-.5-2.2-.5-2.9.1z"/></svg>',
      about:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
    };
    var NAV=[
      {label:"\u7ad9\u70b9",items:[["canvas","\u753b\u5e03\u4e0e\u6027\u80fd"],["display","\u751f\u6210\u4e0e\u663e\u793a"],["rate","\u79ef\u5206\u6362\u7b97"]]},
      {label:"AI \u589e\u5f3a",items:[["api","API \u914d\u7f6e"]]},
      {label:"\u6570\u636e",items:[["data","\u5bfc\u5165\u5bfc\u51fa"]]},
      {label:"\u684c\u5ba0",items:[["pet","\u684c\u5ba0"]]},
      {label:"\u5176\u4ed6",items:[["about","\u5173\u4e8e"]]}
    ];
    var TITLE={canvas:"\u753b\u5e03\u4e0e\u6027\u80fd",display:"\u751f\u6210\u4e0e\u663e\u793a",rate:"\u79ef\u5206\u6362\u7b97",api:"API \u914d\u7f6e",data:"\u5bfc\u5165\u5bfc\u51fa",pet:"\u684c\u5ba0",about:"\u5173\u4e8e"};
    var navHtml=NAV.map(function(g){
      return '<div class="lt-set-rail-group"><div class="lt-set-rail-glabel">'+g.label+'</div>'
        +g.items.map(function(t){return '<button type="button" class="lt-set-rail-item" data-tab="'+t[0]+'" role="tab" tabindex="-1" aria-selected="false" title="'+t[1]+'">'+IC[t[0]]+'<span>'+t[1]+'</span></button>';}).join("")
        +'</div>';
    }).join("");
    var h='<div class="lt-set-rail"><div class="lt-set-rail-title">\u8bbe\u7f6e</div><div class="lt-set-rail-nav" id="lt-settings-nav" role="tablist" aria-orientation="vertical">'+navHtml+'</div></div>'
      +'<div class="lt-set-panel"><div class="lt-set-phead"><div class="lt-set-ptitle" id="lt-set-ptitle">\u753b\u5e03\u4e0e\u6027\u80fd</div><span class="lt-settings-close" id="lt-settings-close">\u2715</span></div>'
      +'<div class="lt-set-pbody" id="lt-settings-body">';
    /* \u5f00\u5173 */
    var canvasToggles=[
      {k:"perf",l:"\u6027\u80fd\u6a21\u5f0f",d:"\u7cbe\u7b80\u8282\u70b9\u7279\u6548\u4e0e\u5408\u6210\u5c42\uff0c\u591a\u8282\u70b9\u753b\u5e03\u66f4\u6d41\u7545\uff08T\uff09"},
      {k:"hide",l:"\u9690\u85cf\u56fe\u7247",d:"\u9690\u85cf\u5168\u90e8\u56fe\u7247\u5185\u5bb9\uff0c\u53ea\u770b\u7ed3\u6784\uff08H\uff09"},
      {k:"edges",l:"\u9690\u85cf\u8fde\u7ebf",d:"\u9690\u85cf\u8282\u70b9\u8fde\u7ebf\uff0c\u51cf\u8f7b\u6e32\u67d3\u8d1f\u62c5\uff08L\uff09"},
      {k:"grid",l:"\u9690\u85cf\u7f51\u683c",d:"\u5173\u95ed\u753b\u5e03\u80cc\u666f\u7f51\u683c\uff08G\uff09"},
      {k:"focus",l:"\u4e13\u6ce8\u6a21\u5f0f",d:"\u85cf\u8d77\u4fa7\u8fb9\u680f\u4e0e\u9876\u680f\uff0c\u53ea\u7559\u753b\u5e03\uff08X\uff09"}
    ];
    var displayToggles=[
      {k:"gen_glow",l:"\u751f\u6210\u5149\u6548",d:"\u751f\u6210\u4e2d\u7684\u56fe\u7247\u76d6\u4e00\u5c42\u6d41\u8f6c\u5149\u96fe\uff08Motif \u98ce\u683c\uff09\uff0c\u5b8c\u6210\u65f6\u6de1\u51fa\u63ed\u793a\u65b0\u56fe"},
      {k:"msel",l:"\u6a21\u578b\u9009\u62e9\u589e\u5f3a",d:"\u63a5\u7ba1\u7ad9\u70b9\u7684\u89c6\u9891/\u56fe\u7247\u6a21\u578b\u4e0b\u62c9\uff1a\u641c\u7d22\u3001\u5206\u7ec4\u3001\u6536\u85cf\u3001\u6700\u8fd1\u4f7f\u7528"}
    ];
    function _toggleRows(list){
      return list.map(function(t){
        var on=localStorage.getItem("_lt_"+t.k)==="1";
        return '<div class="lt-settings-toggle" data-key="'+t.k+'">'
          +'<span class="lt-set-rinfo"><span class="lt-set-rtitle">'+t.l+'</span><span class="lt-set-rdesc">'+t.d+'</span></span>'
          +'<span class="lt-settings-switch'+(on?" on":"")+'"></span></div>';
      }).join("");
    }
    h+='<div class="lt-settings-sec" data-sec="canvas"><div class="lt-settings-stitle">\u5f00\u5173</div><div class="lt-set-card">'+_toggleRows(canvasToggles)+'</div></div>';
    h+='<div class="lt-settings-sec" data-sec="display"><div class="lt-settings-stitle">\u751f\u6210\u4e0e\u663e\u793a</div><div class="lt-set-card">'+_toggleRows(displayToggles)+'</div></div>';
      /* 换算比例：1 积分 = X 元（显示口径是「元/积分」），存储仍是 _lt_rate = 积分/元，不改 _ltRmb 的除法。独立成卡（通用页二级卡） */
      var _rate=15;
      try{var _v=parseFloat(localStorage.getItem("_lt_rate"));if(isFinite(_v)&&_v>0)_rate=_v;}catch(e){}
      var _yuanPer=String(+(1/_rate).toFixed(4));
      h+='<div class="lt-settings-sec" data-sec="rate"><div class="lt-settings-stitle">换算比例</div><div class="lt-set-card">'
      +'<div class="lt-settings-row lt-rate-row" style="flex-wrap:wrap;"><label style="min-width:auto">1 积分 =</label><input class="lt-settings-inp" id="lt-set-rate" type="number" min="0.0001" step="0.0001" value="'+_yuanPer+'" placeholder="0.0667" style="flex:0 0 110px;"><span style="flex:1 1 140px;min-width:0;font-size:11px;color:rgba(255,255,255,0.35);line-height:1.5">元。会员档位单价不同，改这里即实时生效</span></div>'
      +'</div></div>';
    /* API */
    var api=_ltAPIRead();
    var apiPresets=_ltJ("_lt_api_presets",[]);
    /* \u9996\u6b21\u4f7f\u7528\uff1a\u9ed8\u8ba4\u9884\u8bbe DeepSeek + \u672c\u5730 Llama */
    if(!apiPresets.length){
      apiPresets=[
        {id:"ap_deepseek",name:"DeepSeek",url:"https://api.deepseek.com/chat/completions",key:"",model:"deepseek-v4-flash",created:Date.now()},
        {id:"ap_llama",name:"\u672c\u5730 Llama",url:"http://localhost:8080/v1",key:"",model:"",created:Date.now()}
      ];
      try{localStorage.setItem("_lt_api_presets",JSON.stringify(apiPresets));}catch(e){}
    }
    /* \u4f18\u5148\u9ad8\u4eae\u5f53\u524d\u6fc0\u6d3b\u914d\u7f6e\u5bf9\u5e94\u7684\u9884\u8bbe */
    var curPresetId=api.id||"";
    if(!curPresetId&&api.url){
      var _m=apiPresets.find(function(p){return p.url===api.url&&(!p.model||!api.model||p.model===api.model);});
      if(_m)curPresetId=_m.id;
    }
    if(!curPresetId&&apiPresets.length)curPresetId=apiPresets[0].id;
    h+='<div class="lt-settings-sec" data-sec="api"><div class="lt-settings-stitle">API 配置</div><div class="lt-set-card">'
      +"<div class=\"lt-settings-row\" style=\"flex-wrap:wrap;\"><label>\u9884\u8bbe</label>"
      +"<select class=\"lt-settings-inp\" id=\"lt-set-preset\" style=\"position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;z-index:-1;\">"
      +apiPresets.map(function(p){return "<option value=\""+_ltEsc(p.id)+"\""+(p.id===curPresetId?" selected":"")+">"+_ltEsc(p.name)+"</option>";}).join("")
      +"</select>"
      +"<span id=\"lt-set-preset-host\" style=\"position:relative;flex:0 1 170px;max-width:170px;min-width:120px;\"></span>"
      +"<button class=\"lt-settings-btn lt-settings-btn-ghost lt-settings-btn-sm\" id=\"lt-set-preset-add\" title=\"\u5c06\u5f53\u524d\u914d\u7f6e\u4fdd\u5b58\u4e3a\u65b0\u9884\u8bbe\">+ \u65b0\u9884\u8bbe</button>"
      +"<button class=\"lt-settings-btn lt-settings-btn-ghost lt-settings-btn-sm\" id=\"lt-set-preset-del\" title=\"\u5220\u9664\u5f53\u524d\u9884\u8bbe\">\u2715</button>"
      +"</div>"
      +"<div class=\"lt-settings-row\"><label>API \u5730\u5740</label><input class=\"lt-settings-inp\" id=\"lt-set-url\" value=\""+_ltEsc(api.url||"")+"\" placeholder=\"https://api.deepseek.com/chat/completions\"></div>"
      +"<div class=\"lt-settings-row\"><label>API Key</label><input class=\"lt-settings-inp\" type=\"password\" id=\"lt-set-key\" value=\""+_ltEsc(api.key||"")+"\" placeholder=\"sk-...\"><button class=\"lt-settings-btn lt-settings-btn-ghost lt-settings-btn-sm\" id=\"lt-set-key-eye\" title=\"\u663e\u793a/\u9690\u85cf Key\">\ud83d\udc41</button></div>"
      +"<div class=\"lt-settings-row\"><label>\u6a21\u578b</label><input class=\"lt-settings-inp\" id=\"lt-set-model\" value=\""+_ltEsc(api.model||"")+"\" placeholder=\"deepseek-v4-flash\">"
      +"<button class=\"lt-settings-btn lt-settings-btn-ghost lt-settings-btn-sm\" id=\"lt-set-model-fetch\" title=\"\u4ece API \u62c9\u53d6\u6a21\u578b\u5217\u8868\">\ud83d\udd04 \u62c9\u53d6</button></div>"
      +"<div class=\"lt-settings-mlist\" id=\"lt-set-model-list\" style=\"display:none;\"></div>"
      +'<div style="margin-top:8px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">'
      +'<button class="lt-settings-btn lt-settings-btn-primary" id="lt-set-api-save">\u4fdd\u5b58</button>'
      +'<button class="lt-settings-btn lt-settings-btn-ghost" id="lt-set-api-test">\u8fde\u63a5\u6d4b\u8bd5</button>'
      +'<span class="lt-settings-status" id="lt-set-api-status"></span></div>'
      +'</div></div>';
    /* \u6570\u636e */
    h+='<div class="lt-settings-sec" data-sec="data"><div class="lt-settings-stitle">\u6570\u636e\u7ba1\u7406</div><div class="lt-set-card">'
      +'<div class="lt-settings-dlist" id="lt-settings-dlist"></div>'
      +'<button class="lt-settings-btn lt-settings-btn-ghost lt-settings-btn-sm" id="lt-set-export-all">\u5bfc\u51fa\u5168\u90e8\u914d\u7f6e</button>'
      +'<div class="lt-settings-cpbtns">'
      +'<button class="lt-settings-btn lt-settings-btn-primary lt-settings-btn-sm" id="lt-set-cp-export">\u5bfc\u51fa\u5185\u5bb9\u5305</button>'
      +'<button class="lt-settings-btn lt-settings-btn-ghost lt-settings-btn-sm" id="lt-set-cp-import">\u5bfc\u5165\u5185\u5bb9\u5305</button>'
      +'</div>'
      +'</div></div>';
    /* \u5173\u4e8e */
    /* 桌宠 */
    h+=_ltPetSettingsHTML();
    h+='<div class="lt-settings-sec" data-sec="about"><div class="lt-set-card">'
      +"<div class=\"lt-settings-about\"><span class=\"lt-ver-badge\"><span class=\"lt-ver-dot\"></span>v__LT_VER__</span><div style=\"margin-top:8px;font-size:13px;color:rgba(255,255,255,0.55);font-weight:600;\">LibTV Canvas Boost</div>\u4e13\u4e3a liblib.tv \u753b\u5e03\u6253\u9020\u7684\u589e\u5f3a\u5de5\u5177\u3002\u4f18\u5316\u6e32\u67d3\u6027\u80fd\uff0c\u6d41\u7545\u64cd\u4f5c\u5927\u753b\u5e03\uff1b\u5185\u7f6e AI \u63d0\u793a\u8bcd\u52a9\u624b\uff08\u6da6\u8272/\u6269\u5199/\u7ffb\u8bd1\uff09\u3001\u6807\u7b7e\u7ba1\u7406\u3001\u63d0\u793a\u8bcd\u6a21\u677f\u3001\u53d8\u91cf\u7cfb\u7edf\u3001\u753b\u5e03\u4e3b\u9898\u914d\u8272\u4e0e\u591a\u79cd\u89c6\u89c9\u8f85\u52a9\uff0c\u8ba9\u5de5\u4f5c\u6d41\u66f4\u9ad8\u6548\u3002<div style=\"margin-top:12px;display:flex;gap:10px;\"><a href=\"https://github.com/lonely814/Messy\" target=\"_blank\" style=\"display:inline-flex;align-items:center;gap:4px;font-size:11px;\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z\"/></svg>GitHub</a><a href=\"https://greasyfork.org/zh-CN/scripts/586841-libtv-canvas-boost\" target=\"_blank\" style=\"display:inline-flex;align-items:center;gap:4px;font-size:11px;\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5\"/></svg>Greasy Fork</a><a href=\"https://scriptcat.org/zh-CN/script-show-page/7117\" target=\"_blank\" style=\"display:inline-flex;align-items:center;gap:4px;font-size:11px;\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 20h9\"/><path d=\"M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z\"/></svg>ScriptCat</a></div></div>"
      +'<div style="margin-top:12px;display:flex;gap:6px;"><button class="lt-settings-btn lt-settings-btn-primary lt-settings-btn-sm" id="lt-set-help">\u5e2e\u52a9 / \u91cd\u65b0\u663e\u793a\u5f15\u5bfc</button></div>'
      +'</div></div>';
    h+='</div></div>';
    div.innerHTML=h;
    document.body.appendChild(div);
    /* 面板切换（rail = tablist：↑↓/Home/End 走目的地，选择跟随焦点；记住上次所在页） */
    (function(){
      var nav=document.getElementById("lt-settings-nav");
      if(!nav)return;
      var items=Array.prototype.slice.call(nav.querySelectorAll(".lt-set-rail-item"));
      var TITLE={canvas:"\u753b\u5e03\u4e0e\u6027\u80fd",display:"\u751f\u6210\u4e0e\u663e\u793a",rate:"\u79ef\u5206\u6362\u7b97",api:"API \u914d\u7f6e",data:"\u5bfc\u5165\u5bfc\u51fa",pet:"\u684c\u5ba0",about:"\u5173\u4e8e"};
      function go(tab){
        if(!TITLE[tab])tab="canvas";
        items.forEach(function(it){
          var on=it.getAttribute("data-tab")===tab;
          it.classList.toggle("active",on);
          it.setAttribute("aria-selected",on?"true":"false");
          it.tabIndex=on?0:-1;
        });
        var pt=document.getElementById("lt-set-ptitle");
        if(pt)pt.textContent=TITLE[tab];
        div.querySelectorAll(".lt-settings-sec[data-sec]").forEach(function(s){s.classList.toggle("active",s.getAttribute("data-sec")===tab);});
        try{localStorage.setItem("_lt_set_tab",tab);}catch(e){}
      }
      nav.querySelectorAll(".lt-set-rail-item").forEach(function(it){it.onclick=function(){go(it.getAttribute("data-tab"));};});
      nav.addEventListener("keydown",function(e){
        var cur=nav.querySelector(".lt-set-rail-item.active");
        var idx=items.indexOf(cur);
        var next=-1;
        if(e.key==="ArrowDown")next=(idx+1)%items.length;
        else if(e.key==="ArrowUp")next=(idx-1+items.length)%items.length;
        else if(e.key==="Home")next=0;
        else if(e.key==="End")next=items.length-1;
        if(next>=0){e.preventDefault();items[next].focus();go(items[next].getAttribute("data-tab"));}
      });
      var saved=localStorage.getItem("_lt_set_tab")||"canvas";
      if(saved==="general")saved="canvas"; /* 旧版页名迁移 */
      go(saved);
    })();
    /* \u5f00\u5173\u4e8b\u4ef6 */
    div.querySelectorAll(".lt-settings-toggle:not([data-petk])").forEach(function(el){
      el.onclick=function(){
        var k=this.getAttribute("data-key");
        var v=localStorage.getItem("_lt_"+k)!=="1";
        try{localStorage.setItem("_lt_"+k,v?"1":"0");}catch(e){}
        if(k==="grid"){var bg=document.querySelector(".react-flow__background");if(bg)bg.classList.toggle("perf-no-grid",v);}
        else if(k==="edges"){var ed=document.querySelector(".react-flow__edges");if(ed)ed.classList.toggle("perf-hide-edges",v);}
        else document.body.classList.toggle(k==="perf"?"perf-mode":k==="hide"?"perf-hide-imgs":"libtv-"+k,v);
        this.querySelector(".lt-settings-switch").classList.toggle("on",v);
      };
    });
    /* 换算比例输入：改一次重写 _lt_rate + 经桥接重刷标签（_ltRate 是图标扫描 IIFE 的私有变量，直接赋值会变隐式全局、_ltCreditScan 裸调用直接 ReferenceError） */
    var _rateInp=document.getElementById("lt-set-rate");
    if(_rateInp){
      _rateInp.oninput=_rateInp.onchange=function(){
        var y=parseFloat(this.value);     /* 输入是「元/积分」 */
        if(!isFinite(y)||y<=0)return;     // 非法输入不写入，保留上一个合法值
        var r=1/y;                        /* 转成内部的「积分/元」再存 */
        if(!isFinite(r)||r<=0)return;
        try{localStorage.setItem("_lt_rate",String(r));}catch(e){}
        if(window._ltCreditSetRate)window._ltCreditSetRate(r); /* 改闭包内 _ltRate 并立即重扫，无需重载 */
      };
    }
    /* API \u4fdd\u5b58 / \u9884\u8bbe / \u6d4b\u8bd5 / \u62c9\u53d6\u6a21\u578b */
    var _ltSetUrl=document.getElementById("lt-set-url"),_ltSetKey=document.getElementById("lt-set-key"),_ltSetModel=document.getElementById("lt-set-model");
    function _ltApiStatus(msg,ok){
      var s=document.getElementById("lt-set-api-status");
      if(!s)return;
      s.textContent=msg;
      s.style.color=ok?"rgba(74,222,128,0.9)":"rgba(248,113,113,0.9)";
    }
    function _ltApiSaveForm(){
      var d={id:document.getElementById("lt-set-preset").value||null,url:_ltSetUrl.value.trim(),key:_ltSetKey.value.trim(),model:_ltSetModel.value.trim()||"deepseek-v4-flash"};
      _ltPromptAPI=d;
      try{localStorage.setItem("_lt_prompt_api",JSON.stringify(d));}catch(e){}
      return d;
    }
    function _ltApiPersist(){
      var d=_ltApiSaveForm();
      var cur=apiPresets.find(function(x){return x.id===d.id;});
      if(cur){cur.url=d.url;cur.key=d.key;cur.model=d.model;cur.created=Date.now();}
      if(apiPresets.length){try{localStorage.setItem("_lt_api_presets",JSON.stringify(apiPresets));}catch(e){}}
      return d;
    }
    function _ltFillPreset(p){
      _ltSetUrl.value=p.url||"";_ltSetKey.value=p.key||"";_ltSetModel.value=p.model||"";
      /* 保留预设原始 model（可为空，如本地 Llama 留空由网关用默认模型）；deepseek-v4-flash 兜底已在请求层 */
      var d={id:p.id,url:p.url,key:p.key,model:p.model||""};
      _ltPromptAPI=d;
      try{localStorage.setItem("_lt_prompt_api",JSON.stringify(d));}catch(e){}
    }
    function _ltRenderModelList(list,fromCache){
      var box=document.getElementById("lt-set-model-list");
      if(!box)return;
      if(!list||!list.length){box.style.display="none";box.innerHTML="";return;}
      /* 头部：缓存标记 + 强制刷新入口 */
      var head="<div style=\"display:flex;align-items:center;justify-content:space-between;padding:5px 10px;border-bottom:1px solid rgba(255,255,255,0.05);\">"
        +"<span style=\"font-size:10px;color:rgba(255,255,255,0.28);\">"+(fromCache?"\u2713 \u7f13\u5b58\uff0c\u70b9\u5217\u8868\u9009\u62e9":"\u6a21\u578b\u5217\u8868")+"</span>"
        +"<span id=\"lt-set-models-refresh\" style=\"font-size:10px;color:var(--accent-light);cursor:pointer;padding:1px 6px;border-radius:4px;\">\ud83d\udd04 \u91cd\u65b0\u62c9\u53d6</span></div>";
      box.innerHTML=head+list.map(function(m){return "<div class=\"lt-settings-mitem\" data-model=\""+_ltEsc(m)+"\">"+_ltEsc(m)+"</div>";}).join("");
      box.style.display="block";
      var rf=box.querySelector("#lt-set-models-refresh");
      if(rf)rf.onclick=function(){
        try{localStorage.removeItem(_ltModelsCacheKey(_ltApiBase(_ltSetUrl.value.trim()),_ltSetKey.value.trim()));}catch(e){}
        document.getElementById("lt-set-model-fetch").click();
      };
      box.querySelectorAll(".lt-settings-mitem").forEach(function(el){
        el.onclick=function(){
          var m=el.getAttribute("data-model");
          _ltSetModel.value=m;
          box.style.display="none";
          _ltApiPersist();
          _ltApiStatus("\u2705 \u5df2\u9009\u62e9\u6a21\u578b: "+m,true);
        };
      });
    }
    /* 预设下拉：自绘（替代原生 select 弹层），隐藏 select 保留 value 兼容读取 */
    var presetSel=document.getElementById("lt-set-preset");
    var presetDD=_ltDropdown({placeholder:"选择预设",className:"lt-settings-inp"});
    presetDD.el.style.maxWidth="170px";
    presetDD.el.style.display="inline-flex";
    presetDD.el.style.padding="9px 12px";
    presetDD.el.style.fontSize="13px";
    document.getElementById("lt-set-preset-host").appendChild(presetDD.el);
    presetDD.setList(apiPresets.map(function(x){return {value:x.id,label:x.name};}));
    presetDD.setValue(curPresetId,true);
    presetDD.onchange=function(){
      var p=apiPresets.find(function(x){return x.id===presetDD.value;});
      if(p){_ltFillPreset(p);_ltApiStatus("✅ 已切换预设："+p.name,true);}
      if(presetSel)presetSel.value=presetDD.value;
    };
    /* 新预设：面板内联输入（替代原生 prompt 弹窗），回车/✓保存，Esc/✕取消 */
    document.getElementById("lt-set-preset-add").onclick=function(){
      var existing=document.getElementById("lt-set-preset-name-row");
      if(existing){existing.querySelector("input").focus();return;}
      var row=document.createElement("div");
      row.className="lt-settings-row";
      row.id="lt-set-preset-name-row";
      row.style.marginTop="6px";
      row.innerHTML="<input class=\"lt-settings-inp\" id=\"lt-set-preset-name\" placeholder=\"\u9884\u8bbe\u540d\u79f0\uff0c\u5982 \"\u4e2d\u8f6c\u7f51\u5173\"\" style=\"flex:1;\">"
        +"<button class=\"lt-settings-btn lt-settings-btn-primary lt-settings-btn-sm\" id=\"lt-set-preset-ok\">\u4fdd\u5b58</button>"
        +"<button class=\"lt-settings-btn lt-settings-btn-ghost lt-settings-btn-sm\" id=\"lt-set-preset-cancel\">\u53d6\u6d88</button>";
      this.parentNode.insertBefore(row,this.nextSibling);
      var inp=row.querySelector("#lt-set-preset-name");
      inp.value="\u9884\u8bbe "+(apiPresets.length+1);
      inp.focus();inp.select();
      function _done(save){
        if(save){
          var name=inp.value.trim();
          if(name){
            var d=_ltApiSaveForm();
            var p={id:"ap_"+Date.now().toString(36),name:name,url:d.url,key:d.key,model:d.model,created:Date.now()};
            apiPresets.push(p);
            try{localStorage.setItem("_lt_api_presets",JSON.stringify(apiPresets));}catch(e){}
            presetDD.setList(apiPresets.map(function(x){return {value:x.id,label:x.name};}));
            presetDD.setValue(p.id,true);
            _ltApiStatus("\u2705 \u5df2\u4fdd\u5b58\u4e3a\u9884\u8bbe\uff1a"+p.name,true);
          }
        }
        row.remove();
      }
      row.querySelector("#lt-set-preset-ok").onclick=function(){_done(true);};
      row.querySelector("#lt-set-preset-cancel").onclick=function(){_done(false);};
      inp.addEventListener("keydown",function(e){
        if(e.key==="Enter"){e.preventDefault();_done(true);}
        else if(e.key==="Escape"){e.preventDefault();_done(false);}
      });
    };
    document.getElementById("lt-set-preset-del").onclick=function(){
      if(!apiPresets.length)return;
      var p=apiPresets.find(function(x){return x.id===presetSel.value;});
      if(!p)return;
      if(!confirm("\u5220\u9664\u9884\u8bbe\u201c"+p.name+"\u201d\uff1f"))return;
      apiPresets=apiPresets.filter(function(x){return x.id!==p.id;});
      try{localStorage.setItem("_lt_api_presets",JSON.stringify(apiPresets));}catch(e){}
      var next=apiPresets[0]||null;
      presetDD.setList(apiPresets.map(function(x){return {value:x.id,label:x.name};}));
      if(next){presetDD.setValue(next.id,true);_ltFillPreset(next);}
      _ltApiStatus("\u2705 \u5df2\u5220\u9664\u9884\u8bbe",true);
    };
    document.getElementById("lt-set-key-eye").onclick=function(){
      var inp=document.getElementById("lt-set-key");
      var show=inp.type==="password";
      inp.type=show?"text":"password";
      this.textContent=show?"\ud83d\ude48":"\ud83d\udc41";
    };
    document.getElementById("lt-set-api-save").onclick=function(){
      _ltApiPersist();
      _ltApiStatus("\u2705 \u5df2\u4fdd\u5b58",true);
    };
    document.getElementById("lt-set-api-test").onclick=function(){
      var url=_ltSetUrl.value.trim(),key=_ltSetKey.value.trim(),model=_ltSetModel.value.trim()||"deepseek-v4-flash";
      if(!url){_ltApiStatus("\u26a0 \u8bf7\u5148\u586b\u5199 API \u5730\u5740",false);return;}
      var btn=this;btn.disabled=true;
      _ltApiStatus("\u8fde\u63a5\u4e2d...",true);
      var t0=Date.now();
      _ltAIChat(url,key,{model:model,messages:[{role:"user",content:"ping"}],max_tokens:1})
      .then(function(d){
        _ltApiPersist();
        var ms=Date.now()-t0;
        var content=d.choices&&d.choices[0]&&d.choices[0].message?String(d.choices[0].message.content||""):"";
        _ltApiStatus("\u2705 \u8fde\u63a5\u6210\u529f ("+ms+"ms"+(content?" \u2022 "+content.slice(0,20):"")+")",true);
      })
      .catch(function(err){_ltApiStatus("\u2716 \u8fde\u63a5\u5931\u8d25: "+_ltModelsErrDesc(err,url),false);})
      .finally(function(){btn.disabled=false;});
    };
    /* \u62c9\u53d6\u6a21\u578b\u5217\u8868\uff1a\u591a\u7aef\u70b9\u63a2\u6d4b + \u53cb\u597d\u9519\u8bef\u8bca\u65ad */
    document.getElementById("lt-set-model-fetch").onclick=function(){
      var url=_ltSetUrl.value.trim(),key=_ltSetKey.value.trim();
      var btn=this;
      if(!url){_ltApiStatus("\u26a0 \u8bf7\u5148\u586b\u5199 API \u5730\u5740",false);return;}
      var base=_ltApiBase(url);
      if(!base){_ltApiStatus("\u2716 \u65e0\u6cd5\u8bc6\u522b API \u5730\u5740",false);return;}
      // 端点候选：按 base 是否已含 /v1 排序，避免拼出 /v1/v1/models 必 404 后再回退
      var paths=/\/v1$/.test(base)?["/models","/v1/models"]:["/v1/models","/models"];
      var box=document.getElementById("lt-set-model-list");
      /* 优先缓存：命中则免网络直接展示（头部提供「重新拉取」强制刷新） */
      var cached=_ltModelsCacheGet(base,key);
      if(cached){
        _ltRenderModelList(cached.models,true);
        _ltApiStatus("\u2713 \u5df2\u52a0\u8f7d\u7f13\u5b58\uff08"+cached.models.length+" \u4e2a\u6a21\u578b\uff0c\u53ef\u70b9\u5217\u8868\u5185\u91cd\u65b0\u62c9\u53d6\uff09",true);
        return;
      }
      btn.disabled=true;box.style.display="block";box.innerHTML="\u62c9\u53d6\u4e2d...";
      _ltFetchModels(base,key,paths)
      .then(function(list){
        _ltApiPersist();
        _ltModelsCacheSet(base,key,list);
        _ltRenderModelList(list,false);
        _ltApiStatus("\u2705 \u62c9\u53d6\u5230 "+list.length+" \u4e2a\u6a21\u578b",true);
      })
      .catch(function(err){box.style.display="none";box.innerHTML="";_ltApiStatus("\u2716 \u62c9\u53d6\u5931\u8d25: "+_ltModelsErrDesc(err,url),false);})
      .finally(function(){btn.disabled=false;});
    };
    /* 打开设置面板时：当前配置命中缓存则直接展示，免点击 */
    (function(){
      try{
        var base=_ltApiBase(_ltSetUrl.value.trim());
        if(!base)return;
        var c=_ltModelsCacheGet(base,_ltSetKey.value.trim());
        if(c)_ltRenderModelList(c.models,true);
      }catch(e){}
    })();
    /* \u6570\u636e\u6e05\u5355 */
    var keys=[["_lt_tag_libs","\u6807\u7b7e\u5e93"],["_lt_cur_lib","\u5f53\u524d\u6807\u7b7e\u5e93"],["_lt_recent","\u5df2\u63d2\u5165\u5386\u53f2"]];
    var dl=document.getElementById("lt-settings-dlist");
    keys.forEach(function(kv){
      var val=localStorage.getItem(kv[0]);
      if(!val)return;
      var size=Math.round(val.length/1024);
      var el=document.createElement("div");el.className="lt-settings-ditem";
      el.innerHTML="<span>"+kv[1]+"</span><span>"+size+"KB</span><button class=\"lt-settings-dclear\" data-key=\""+kv[0]+"\">\u6e05\u7a7a</button>";
      el.querySelector(".lt-settings-dclear").onclick=function(e){e.stopPropagation();try{localStorage.removeItem(this.getAttribute("data-key"));}catch(ex){}el.remove();};
      dl.appendChild(el);
    });
    /* \u5bfc\u51fa\u5168\u90e8 */
    document.getElementById("lt-set-export-all").onclick=function(){
      var data={};
      keys.forEach(function(kv){var v=localStorage.getItem(kv[0]);if(v)data[kv[0]]=v;});
      data._version="__LT_VER__";
      data._exportedAt=new Date().toISOString();
      var blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
      var url=URL.createObjectURL(blob);
      var a=document.createElement("a");a.href=url;a.download="libtv-boost-config-"+new Date().toISOString().slice(0,10)+".json";a.click();
      setTimeout(function(){URL.revokeObjectURL(url);},1000);
    };
    document.getElementById("lt-set-cp-export").onclick=function(){ _ltDownloadContentPack(); };
    document.getElementById("lt-set-cp-import").onclick=function(){ _ltImportContentPackFromFile(); };
    /* 桌宠分区绑定（出错不能拖垮整个设置面板） */
    try{_ltPetBindSettings(div);}catch(e){try{console.error("[libtv-boost] 桌宠设置绑定失败",e);}catch(e2){}}
    /* \u5e2e\u52a9 */
    document.getElementById("lt-set-help").onclick=function(){div.remove();try{localStorage.removeItem("_lt_first_run");}catch(e){}setTimeout(function(){_ltShowWelcome();},300)};
    /* \u5173\u95ed */
    document.getElementById("lt-settings-close").onclick=function(){div.remove();};
  }
  window._ltOpenSettings=_ltSettingsPanel;
  window._ltToast=_ltToast; /* 供油猴沙箱（main.js）调用，如诊断菜单错误提示 */
  window._ltContent={exportPack:_ltDownloadContentPack,importFile:_ltImportContentPackFromFile};
  window._ltShowTagMenu=_ltShowTagMenu;
  try{_ltIDBGet("_lt_accounts",function(d){if(d&&!localStorage.getItem("_lt_accounts")){if(_ltAccValid(d)){try{localStorage.setItem("_lt_accounts",d);}catch(e){}}}});}catch(e){}
  /* 清除历史版本写入的 _lt_acc_bak cookie（账号数据不再走 cookie 通道） */
  try{document.cookie="_lt_acc_bak=; path=/; max-age=0";}catch(e){}

  /* ===== 桌宠（画布桌宠；素材包兼容 mayi「Codex 桌宠包」） =====
     包 = pet.json + spritesheet.webp|png。图集为 8 列固定网格：v1=9 行、v2=11 行（行 9-10 为 16 向视线），
     行 0-8 对应 9 组动作。渲染 = clip div + 整图 img 位移，无 canvas/第三方库。
     纯函数块（__lt_pet_pure_* 之间）被 test-pet-pack.js 抽取做单测，勿在其中引用 DOM。 */
  /* __lt_pet_pure_begin__ */
  var _ltPetStrips=[
    {id:"idle",row:0,frames:6,fps:7,loop:true},
    {id:"running-right",row:1,frames:8,fps:12,loop:true},
    {id:"running-left",row:2,frames:8,fps:12,loop:true},
    {id:"waving",row:3,frames:4,fps:8,loop:false},
    {id:"jumping",row:4,frames:5,fps:10,loop:false},
    {id:"failed",row:5,frames:8,fps:8,loop:true},
    {id:"waiting",row:6,frames:6,fps:7,loop:true},
    {id:"running",row:7,frames:6,fps:8,loop:true},
    {id:"review",row:8,frames:6,fps:7,loop:false}
  ];
  function _ltPetStrip(id){for(var i=0;i<_ltPetStrips.length;i++)if(_ltPetStrips[i].id===id)return _ltPetStrips[i];return _ltPetStrips[0];}
  function _ltPetSlug(s){var t=String(s==null?"":s).toLowerCase().replace(/[^a-z0-9一-鿿]+/g,"-").replace(/^-+|-+$/g,"");return t||"pet";}
  function _ltPetNormConf(obj,fbName){
    if(!obj||typeof obj!=="object"||Array.isArray(obj))throw new Error("pet.json 必须是对象");
    var displayName=String(obj.displayName||obj.name||fbName||"未命名宠物");
    var sp=obj.spritesheetPath!=null?obj.spritesheetPath:(obj.spritesheet!=null?obj.spritesheet:"spritesheet.webp");
    sp=String(sp||"");
    if(!sp)throw new Error("pet.json 缺少 spritesheetPath");
    var ver=(obj.spriteVersionNumber===2||obj.spriteVersionNumber==="2")?2:1;
    return {id:_ltPetSlug(obj.id||displayName),displayName:displayName,description:String(obj.description||""),spriteVersionNumber:ver,spritesheetPath:sp};
  }
  /* 图集网格校验：8 列；v1=9 行/v2=11 行；版本以宽高比复核（v1 基准 1536×1872、v2 基准 1536×2288，容差 0.04，分界取中点） */
  function _ltPetGrid(w,h,declaredVer){
    if(!(w>=8&&h>=208))throw new Error("图集尺寸无效");
    if(w%8!==0)throw new Error("图集宽度必须能被 8 整除");
    var r1=1536/1872,r2=1536/2288,mid=(r1+r2)/2,r=w/h,d1=Math.abs(r-r1),d2=Math.abs(r-r2),ver;
    if(d1<=0.04&&d2<=0.04)ver=declaredVer===2?2:1;
    else if(d1<=0.04)ver=1;
    else if(d2<=0.04)ver=2;
    else ver=r>=mid?1:2;
    var rows=ver===2?11:9;
    var cellH=Math.round(h/rows);
    if(Math.abs(h-cellH*rows)>0.51)throw new Error("图集高度 "+h+" 无法均分成 "+rows+" 行");
    return {ver:ver,rows:rows,cellW:w/8,cellH:cellH};
  }
  function _ltPetPickFiles(fileList){
    var files=Array.prototype.slice.call(fileList||[]),conf=null,sheet=null,fb=null;
    files.forEach(function(f){
      var n=f.name||"";
      if(/^pet\.json$/i.test(n)){conf=f;return;}
      if(/^(spritesheet|sprite-sheet)\.(webp|png)$/i.test(n)){sheet=f;return;}
      if(!fb&&/\.(webp|png)$/i.test(n))fb=f;
    });
    if(!sheet)sheet=fb;
    if(!sheet)throw new Error("请选择 pet.json 与 spritesheet.webp/png");
    return {conf:conf,sheet:sheet};
  }
  /* 视线：指针相对宠物眼点（水平中心、高度 42%）方向 → 16 向索引。
     角度 atan2(dx,-dy)：0°=正上，顺时针每 22.5° 一格；36px 死区内返回 null 保持原视线（对齐 mayi）。 */
  function _ltPetLookIndex(dx,dy){
    if(!isFinite(dx)||!isFinite(dy))return null;
    if(Math.sqrt(dx*dx+dy*dy)<36)return null;
    var deg=Math.atan2(dx,-dy)*180/Math.PI;
    var t=((deg%360)+360)%360;
    return Math.round(t/22.5)%16;
  }
  function _ltPetLookCell(idx){return {row:idx<8?9:10,col:idx%8};}
  /* __lt_pet_pure_end__ */

  function _ltIDBDel(k){try{var r=indexedDB.open("_lt_boost",1);r.onupgradeneeded=function(e){e.target.result.createObjectStore("b");};r.onsuccess=function(e){var db=e.target.result,tx=db.transaction("b","readwrite");tx.objectStore("b").delete(k);tx.oncomplete=function(){db.close();};};}catch(e){}}
  /* 尺寸无级滑块（px 高）；旧三档预设仅作迁移映射 */
  var _ltPetSizeOldMap={small:72,medium:96,large:128};
  var _ltPetSizeMin=48,_ltPetSizeMax=256;
  var _ltPetPrefsCache=null;
  function _ltPetPrefs(){
    /* M6：_ltPetTick 每帧调用本函数，缓存避免每帧 localStorage 读 + JSON.parse（实测 0.67ms/帧 ≈ 4% 帧预算）。
       所有写入都走 _ltPetSavePrefs（写后回填缓存），无旁路写入者 */
    if(_ltPetPrefsCache)return _ltPetPrefsCache;
    var p=_ltJ("_lt_pet_v1",null)||{};
    var sizePx=p.sizePx;
    if(!isFinite(sizePx)||!sizePx)sizePx=_ltPetSizeOldMap[p.size]||96;
    sizePx=Math.max(_ltPetSizeMin,Math.min(_ltPetSizeMax,Math.round(sizePx)));
    _ltPetPrefsCache={enabled:!!p.enabled,sizePx:sizePx,activePetId:p.activePetId||"",pos:p.pos&&isFinite(p.pos.x)&&isFinite(p.pos.y)?p.pos:null,lookAtPointer:p.lookAtPointer===true,hoverAnimate:p.hoverAnimate===true};
    return _ltPetPrefsCache;
  }
  function _ltPetSavePrefs(p){try{localStorage.setItem("_lt_pet_v1",JSON.stringify(p));}catch(e){}_ltPetPrefsCache=p;}
  function _ltPetIndex(){return _ltJ("_lt_pets",[])||[];}
  function _ltPetSaveIndex(list){try{localStorage.setItem("_lt_pets",JSON.stringify(list));}catch(e){}}

  var _ltPetP={on:false,el:null,img:null,bub:null,rafPending:false,last:0,acc:0,frame:0,stripId:"idle",url:"",conf:null,grid:null,cw:0,ch:0,scale:0.5,busy:0,busyAt:0,trans:null,pos:{x:0,y:0},walkTo:null,nextAct:0,hovered:false,px:0,py:0,drag:false,dragDir:"",dragMoved:0};

  /* 尺寸热更新：拖滑块只改几何，不重挂载（重挂要重解码 2MB 图集，会卡） */
  function _ltPetApplySize(px){
    var P=_ltPetP;
    if(!P.grid||!P.el)return;
    var scale=px/P.grid.cellH;
    var cw=Math.round(P.grid.cellW*scale),ch=Math.round(P.grid.cellH*scale);
    P.cw=cw;P.ch=ch;P.scale=scale;
    P.el.style.width=cw+"px";P.el.style.height=ch+"px";
    if(P.img){
      P.img.style.setProperty("width",(cw*8)+"px","important");
      P.img.style.setProperty("height",(ch*P.grid.rows)+"px","important");
    }
    _ltPetClamp();
  }

  /* 单 rAF 链保障：任何入口都走 _ltPetKick，杜绝双循环倍速播放（曾疑似引发闪烁） */
  function _ltPetKick(){
    var P=_ltPetP;
    if(P.rafPending)return;
    P.rafPending=true;
    requestAnimationFrame(_ltPetTick);
  }

  function _ltPetNotify(kind){
    var P=_ltPetP;
    if(kind==="busy"){P.busy++;P.busyAt=Date.now();return;}
    P.busy=Math.max(0,P.busy-1);
    var now=Date.now();
    /* 心情映射（对齐 mayi：成功/失败为瞬态，超时回 idle） */
    if(kind==="ok")P.trans={action:"waving",until:now+2800};
    else if(kind==="fail")P.trans={action:"failed",until:now+3600};
    if(P.el){P.stripId="";P.frame=0;P.acc=0;}
  }
  function _ltPetSay(text,dur){
    var P=_ltPetP;
    if(!P.bub)return;
    P.bub.textContent=text;
    P.bub.classList.add("show");
    clearTimeout(P.bub._t);
    P.bub._t=setTimeout(function(){P.bub.classList.remove("show");},dur||1400);
  }
  function _ltPetClamp(){
    var P=_ltPetP;
    if(!P.el)return;
    var w=P.el.offsetWidth||0,h=P.el.offsetHeight||0;
    P.pos.x=Math.max(8,Math.min(P.pos.x,window.innerWidth-w-8));
    P.pos.y=Math.max(8,Math.min(P.pos.y,window.innerHeight-h-8));
    P.el.style.left=P.pos.x+"px";P.el.style.top=P.pos.y+"px";
  }
  function _ltPetSetAction(action){
    var P=_ltPetP,strip=_ltPetStrip(action);
    if(P.stripId!==action){P.stripId=action;P.frame=0;P.acc=0;}
    return strip;
  }
  function _ltPetTick(){
    var P=_ltPetP;
    P.rafPending=false;
    if(!P.on)return;
    _ltPetKick();
    if(document.hidden){P.last=0;return;}
    var ts=Date.now();
    if(!P.last)P.last=ts;
    var dt=Math.min(250,ts-P.last);P.last=ts;
    var now=ts;
    if(P.busy>0&&now-P.busyAt>120000)P.busy=0; /* busy 卡死自愈 */
    if(P.trans&&now>=P.trans.until)P.trans=null;
    /* 随机小剧场：待机时每 5-11s 演一个动作或短距走动 */
    if(!P.trans&&!P.drag&&P.walkTo==null&&now>=P.nextAct){
      P.nextAct=now+5000+Math.random()*6000;
      var r=Math.random();
      if(r<0.3)P.trans={action:"waving",until:now+1800};
      else if(r<0.5)P.trans={action:"jumping",until:now+1100};
      else if(r<0.62)P.trans={action:"waiting",until:now+2400};
      else{
        var w=P.el?P.el.offsetWidth:0;
        var dir=Math.random()<0.5?-1:1;
        var to=Math.max(4,Math.min(P.pos.x+dir*(80+Math.random()*140),window.innerWidth-w-4));
        if(Math.abs(to-P.pos.x)>24)P.walkTo=to;
      }
    }
    /* 走动位移（约 110px/s） */
    var action;
    if(P.trans)action=P.trans.action;
    else if(P.drag)action=P.dragDir==="left"?"running-left":P.dragDir==="right"?"running-right":"running";
    else if(P.busy>0)action="running";
    else if(P.walkTo!=null){
      var d=P.walkTo-P.pos.x,step=110*dt/1000;
      if(Math.abs(d)<=step){P.pos.x=P.walkTo;P.walkTo=null;}
      else P.pos.x+=d>0?step:-step;
      action=d>0?"running-right":"running-left";
      _ltPetClamp();
    }
    else action="idle";
    var strip=_ltPetSetAction(action);
    /* hoverAnimate（对齐 mayi 语义：开启后仅悬停在宠物上才播放动画，离开即定格） */
    var pr=_ltPetPrefs();
    var paused=pr.hoverAnimate&&!P.hovered&&action==="idle";
    /* 推帧（1000/fps 累加；非 loop 动画播完定格末帧） */
    if(!paused){
      P.acc+=dt;
      var need=1000/strip.fps;
      while(P.acc>=need){P.acc-=need;P.frame++;}
    }
    var row=strip.row,col=strip.loop?(P.frame%strip.frames):Math.min(P.frame,strip.frames-1);
    /* 视线：v2 图集、未悬停、开启视线跟随时，行 9-10 的 16 向单帧覆盖 idle 动画（眼点=水平中心、高度 42%） */
    if(action==="idle"&&pr.lookAtPointer&&!P.hovered&&P.grid&&P.grid.ver===2){
      var look=_ltPetLookIndex(P.px-(P.pos.x+(P.el?P.el.offsetWidth/2:0)),P.py-(P.pos.y+(P.el?P.el.offsetHeight*0.42:0)));
      if(look!=null){var c=_ltPetLookCell(look);row=c.row;col=c.col;}
    }
    if(P.img)P.img.style.transform="translate("+(-col*P.cw)+"px,"+(-row*P.ch)+"px)";
  }
  function _ltPetUnmount(){
    var P=_ltPetP;
    P.on=false;
    if(P.el&&P.el.parentNode)P.el.parentNode.removeChild(P.el);
    P.el=null;P.img=null;P.bub=null;
    if(P.url){try{URL.revokeObjectURL(P.url);}catch(e){}P.url="";} /* 不 revoke 则每次重挂载泄漏整张图集 blob（数 MB） */
  }
  function _ltPetMount(){
    var P=_ltPetP;
    var prefs=_ltPetPrefs();
    if(!prefs.enabled||!prefs.activePetId){_ltPetUnmount();return;}
    var rec=null,list=_ltPetIndex();
    for(var i=0;i<list.length;i++)if(list[i].id===prefs.activePetId){rec=list[i];break;}
    if(!rec){_ltPetUnmount();return;}
    _ltIDBGet("pet:"+rec.id,function(blob){
      if(!blob){_ltPetUnmount();return;}
      var url=URL.createObjectURL(blob);
      var probe=new Image();
      probe.onload=function(){
        var grid;
        try{grid=_ltPetGrid(probe.naturalWidth,probe.naturalHeight,rec.ver);}catch(e){URL.revokeObjectURL(url);return;}
        _ltPetUnmount();
        var targetH=prefs.sizePx||96;
        var scale=targetH/grid.cellH;
        /* 单元格显示尺寸取整：位移恒为整数像素，杜绝亚像素光栅漂移闪烁 */
        var cw=Math.round(grid.cellW*scale),ch=Math.round(grid.cellH*scale);
        var el=document.createElement("div");el.id="lt-pet";
        el.style.width=cw+"px";el.style.height=ch+"px";
        var clip=document.createElement("div");clip.className="lt-pet-clip";
        var img=document.createElement("img");img.className="lt-pet-sheet";img.src=url;img.draggable=false;
        /* 内联 !important：站点全局 img 规则不得钳制图集尺寸 */
        img.style.setProperty("width",(cw*8)+"px","important");
        img.style.setProperty("height",(ch*grid.rows)+"px","important");
        clip.appendChild(img);el.appendChild(clip);
        var bub=document.createElement("div");bub.id="lt-pet-bubble";el.appendChild(bub);
        document.body.appendChild(el);
        P.el=el;P.img=img;P.bub=bub;P.url=url;P.grid=grid;P.scale=scale;
        P.conf={spriteVersionNumber:rec.ver};
        P.pos=prefs.pos?{x:prefs.pos.x,y:prefs.pos.y}:{x:window.innerWidth-grid.cellW*scale-88,y:window.innerHeight-grid.cellH*scale-88};
        _ltPetClamp();
        /* 拖拽（拖动时按方向跑动，对齐 mayi）/ 点击（挥手 + 气泡）/ 悬停 */
        el.addEventListener("pointerdown",function(e){
          if(e.button!==0)return;
          e.preventDefault();
          P.drag=true;P.dragMoved=0;P.dragDir="";P.walkTo=null;
          var sx=e.clientX,sy=e.clientY,ox=P.pos.x,oy=P.pos.y;
          el.setPointerCapture(e.pointerId);
          el.classList.add("lt-pet-drag");
          function mm(ev){
            var dx=ev.clientX-sx,dy=ev.clientY-sy;
            P.dragMoved=Math.max(P.dragMoved,Math.sqrt(dx*dx+dy*dy));
            if(Math.abs(dx)>10)P.dragDir=dx>0?"right":"left";
            P.pos.x=ox+dx;P.pos.y=oy+dy;
            _ltPetClamp();
          }
          function mu(){
            el.removeEventListener("pointermove",mm);
            el.removeEventListener("pointerup",mu);
            el.classList.remove("lt-pet-drag");
            P.drag=false;P.dragDir="";
            var pr2=_ltPetPrefs();pr2.pos={x:P.pos.x,y:P.pos.y};_ltPetSavePrefs(pr2);
            P.nextAct=Date.now()+3000;
            if(P.dragMoved<4){P.trans={action:"waving",until:Date.now()+2000};_ltPetSay(["摸摸~","诶嘿","在呢","喵~"][Math.floor(Math.random()*4)],1200);}
          }
          el.addEventListener("pointermove",mm);
          el.addEventListener("pointerup",mu);
        });
        el.addEventListener("mouseenter",function(){P.hovered=true;});
        el.addEventListener("mouseleave",function(){P.hovered=false;});
        P.on=true;P.last=0;P.stripId="";P.frame=0;P.acc=0;
        P.cw=cw;P.ch=ch;
        P.nextAct=Date.now()+4000+Math.random()*5000;
        _ltPetKick();
      };
      probe.onerror=function(){URL.revokeObjectURL(url);_ltPetUnmount();};
      probe.src=url;
    });
  }
  var _ltPetRefreshTimer=0;
  function _ltPetRefresh(){clearTimeout(_ltPetRefreshTimer);_ltPetRefreshTimer=setTimeout(function(){try{_ltPetMount();}catch(e){}},50);}
  window.addEventListener("resize",function(){_ltPetClamp();});
  document.addEventListener("pointermove",function(e){_ltPetP.px=e.clientX;_ltPetP.py=e.clientY;},{passive:true});
  /* AI 请求状态 → 心情：请求中「思考」，成功挥手、失败瞬态失败动作 */
  try{
    var _ltPetAIChatOrig=_ltAIChat;
    _ltAIChat=function(url,key,body){
      _ltPetNotify("busy");
      return _ltPetAIChatOrig(url,key,body).then(function(d){_ltPetNotify("ok");return d;},function(err){_ltPetNotify("fail");throw err;});
    };
  }catch(e){}

  /* ---- 素材包导入（照搬 mayi 导入体验：多选 pet.json + spritesheet） ---- */
  function _ltPetImportFromFile(){
    var inp=document.createElement("input");inp.type="file";inp.multiple=true;
    inp.accept=".json,.webp,.png,application/json,image/webp,image/png";
    inp.onchange=function(){
      var pick;
      try{pick=_ltPetPickFiles(inp.files);}catch(e){_ltToast(e.message);return;}
      function withConf(obj){
        var conf;
        try{conf=_ltPetNormConf(obj,pick.conf?null:pick.sheet.name.replace(/\.(webp|png)$/i,""));}
        catch(e){_ltToast("导入失败："+e.message);return;}
        var url=URL.createObjectURL(pick.sheet);
        var probe=new Image();
        probe.onload=function(){
          var grid;
          try{grid=_ltPetGrid(probe.naturalWidth,probe.naturalHeight,conf.spriteVersionNumber);}
          catch(e){URL.revokeObjectURL(url);_ltToast("导入失败："+e.message);return;}
          URL.revokeObjectURL(url);
          _ltPetImportConfirm(conf,grid,pick.sheet);
        };
        probe.onerror=function(){URL.revokeObjectURL(url);_ltToast("导入失败：无法读取精灵图");};
        probe.src=url;
      }
      if(pick.conf){
        var rd=new FileReader();
        rd.onload=function(){
          var obj;
          try{obj=JSON.parse(String(rd.result));}catch(e){_ltToast("导入失败：pet.json 不是有效的 JSON（"+e.message+"）");return;}
          withConf(obj);
        };
        rd.readAsText(pick.conf);
      }else withConf(null);
    };
    inp.click();
  }
  function _ltPetImportConfirm(conf,grid,blob){
    var ov=document.createElement("div");ov.id="lt-cp-overlay";
    ov.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:2147483647;display:flex;align-items:center;justify-content:center;";
    var box=document.createElement("div");
    box.style.cssText="background:#1b1d2a;border:1px solid rgba(129,140,248,0.3);border-radius:12px;padding:22px;min-width:320px;max-width:90vw;color:#e7e9f3;font-family:inherit;";
    box.innerHTML='<div style="font-size:15px;font-weight:600;margin-bottom:6px;">导入桌宠</div>'
      +'<div style="font-size:12px;color:rgba(255,255,255,0.55);margin-bottom:4px;">'+_ltEsc(conf.displayName)+'（v'+grid.ver+'）</div>'
      +'<div style="font-size:12px;color:rgba(255,255,255,0.45);margin-bottom:14px;">9 组动作'+(grid.ver===2?' · 16 向视线':'')+' · 图集 '+_ltEsc(String(grid.cellW*8))+'×'+_ltEsc(String(grid.cellH*grid.rows))+'</div>'
      +'<div style="display:flex;flex-direction:column;gap:8px;">'
      +'<button id="lt-pet-ok" style="padding:10px;border-radius:8px;border:1px solid rgba(129,140,248,0.4);background:linear-gradient(135deg,rgba(129,140,248,0.25),rgba(167,139,250,0.25));color:#fff;cursor:pointer;font-size:13px;">确认导入</button>'
      +'<button id="lt-pet-cancel" style="padding:9px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:rgba(255,255,255,0.6);cursor:pointer;font-size:12px;">取消</button>'
      +'</div>';
    ov.appendChild(box);document.body.appendChild(ov);
    function close(){if(ov.parentNode)ov.parentNode.removeChild(ov);}
    document.getElementById("lt-pet-ok").onclick=function(){
      close();
      _ltIDBSet("pet:"+conf.id,blob);
      var list=_ltPetIndex().filter(function(x){return x.id!==conf.id;});
      list.push({id:conf.id,displayName:conf.displayName,description:conf.description,ver:grid.ver,at:Date.now()});
      _ltPetSaveIndex(list);
      var p=_ltPetPrefs();p.activePetId=conf.id;p.enabled=true;_ltPetSavePrefs(p);
      _ltToast("✅ 已导入 "+conf.displayName+"（v"+grid.ver+"）");
      _ltPetRefresh();
      _ltPetReopenSettings();
    };
    document.getElementById("lt-pet-cancel").onclick=close;
    ov.onclick=function(e){if(e.target===ov)close();};
  }
  function _ltPetReopenSettings(){
    var s=document.getElementById("lt-settings");
    if(s){s.remove();try{_ltSettingsPanel();}catch(e){}}
  }

  /* ---- 设置面板「桌宠」分区 ---- */
  function _ltPetSettingsHTML(){
    var p=_ltPetPrefs(),list=_ltPetIndex();
    var h="<div class=\"lt-settings-sec\" data-sec=\"pet\"><div class=\"lt-set-card\">";
    h+="<div class=\"lt-settings-toggle\" data-petk=\"enabled\"><span>启用桌宠</span><span class=\"lt-settings-switch"+(p.enabled?" on":"")+"\"></span></div>";
    h+="<div class=\"lt-settings-row\"><label>当前宠物</label><select class=\"lt-settings-inp\" id=\"lt-pet-sel\">"
      +(list.length?list.map(function(x){return "<option value=\""+_ltEsc(x.id)+"\""+(x.id===p.activePetId?" selected":"")+">"+_ltEsc(x.displayName)+"</option>";}).join(""):"<option value=\"\">（尚未导入）</option>")
      +"</select></div>";
    h+="<div class=\"lt-settings-row\" style=\"flex-wrap:wrap;gap:6px;\">"
      +"<button class=\"lt-settings-btn lt-settings-btn-primary lt-settings-btn-sm\" id=\"lt-pet-import\">导入素材包</button>"
      +"<button class=\"lt-settings-btn lt-settings-btn-ghost lt-settings-btn-sm\" id=\"lt-pet-del\">删除</button>"
      +"<button class=\"lt-settings-btn lt-settings-btn-ghost lt-settings-btn-sm\" id=\"lt-pet-reset-pos\">重置位置</button>"
      +"</div>";
    h+="<div class=\"lt-settings-row\"><label>大小</label><input type=\"range\" id=\"lt-pet-size\" min=\"48\" max=\"256\" step=\"4\" value=\""+p.sizePx+"\" style=\"flex:1;accent-color:var(--accent);\"><span id=\"lt-pet-size-val\" style=\"width:46px;text-align:right;font-size:12px;color:rgba(255,255,255,0.5);\">"+p.sizePx+"px</span></div>";
    h+="<div class=\"lt-settings-toggle\" data-petk=\"lookAtPointer\"><span>视线跟随鼠标</span><span class=\"lt-settings-switch"+(p.lookAtPointer?" on":"")+"\"></span></div>";
    h+="<div class=\"lt-settings-toggle\" data-petk=\"hoverAnimate\"><span>悬停时才播放动画</span><span class=\"lt-settings-switch"+(p.hoverAnimate?" on":"")+"\"></span></div>";
    h+="<div style=\"margin-top:8px;font-size:11px;color:rgba(255,255,255,0.32);line-height:1.7\">素材包 = pet.json + spritesheet.webp|png（Codex 桌宠包格式，8 列网格图集，v2 含 16 向视线）。两个文件一起多选导入。</div>";
    h+="</div></div>"; /* 卡片 + sec 两层闭合（本函数开头开了 sec+card 两层） */
    return h;
  }
  function _ltPetBindSettings(root){
    function tog(el,key,after){
      if(!el)return;
      var sw=el.querySelector(".lt-settings-switch");
      el.onclick=function(){
        var pr=_ltPetPrefs();
        pr[key]=!pr[key];
        _ltPetSavePrefs(pr);
        if(sw)sw.classList.toggle("on",pr[key]);
        if(after)after(pr);
      };
    }
    tog(root.querySelector('[data-petk="enabled"]'),"enabled",function(){_ltPetRefresh();});
    tog(root.querySelector('[data-petk="lookAtPointer"]'),"lookAtPointer");
    tog(root.querySelector('[data-petk="hoverAnimate"]'),"hoverAnimate");
    var sel=root.querySelector("#lt-pet-sel");
    if(sel)sel.onchange=function(){var pr=_ltPetPrefs();pr.activePetId=this.value||"";_ltPetSavePrefs(pr);_ltPetRefresh();};
    var size=root.querySelector("#lt-pet-size");
    if(size)size.oninput=function(){
      var v=Math.max(_ltPetSizeMin,Math.min(_ltPetSizeMax,parseInt(this.value,10)||96));
      var lbl=root.querySelector("#lt-pet-size-val");
      if(lbl)lbl.textContent=v+"px";
      var pr=_ltPetPrefs();pr.sizePx=v;_ltPetSavePrefs(pr);
      _ltPetApplySize(v); /* 拖动即时生效，松手不再重挂载 */
    };
    var imp=root.querySelector("#lt-pet-import");
    if(imp)imp.onclick=function(){_ltPetImportFromFile();};
    var del=root.querySelector("#lt-pet-del");
    if(del)del.onclick=function(){
      var pr=_ltPetPrefs();
      if(!pr.activePetId){_ltToast("没有可删除的宠物");return;}
      var name=pr.activePetId;
      if(sel&&sel.selectedOptions&&sel.selectedOptions[0])name=sel.selectedOptions[0].textContent;
      if(!confirm("删除宠物「"+name+"」？"))return;
      var list=_ltPetIndex().filter(function(x){return x.id!==pr.activePetId;});
      _ltPetSaveIndex(list);
      _ltIDBDel("pet:"+pr.activePetId);
      pr.activePetId=list.length?list[list.length-1].id:"";
      _ltPetSavePrefs(pr);
      _ltToast("已删除");
      _ltPetRefresh();
      _ltPetReopenSettings();
    };
    var rp=root.querySelector("#lt-pet-reset-pos");
    if(rp)rp.onclick=function(){
      var pr=_ltPetPrefs();pr.pos=null;_ltPetSavePrefs(pr);
      _ltPetRefresh();
      _ltToast("位置已重置");
    };
  }
  try{_ltPetRefresh();}catch(e){}

  /* ===== 提示词搜索：工具栏搜索框 + 提示词文本命中高亮（快速排查提示词用词） =====
     高亮走 CSS Custom Highlight API：只给文本范围上色，不改 contenteditable 内部 DOM，
     React 重渲染/光标/输入全不受影响（红线：React 面板内禁止注入/改写节点）。
     不支持 Custom Highlight 的旧浏览器只显示命中数，不高亮。 */
  var _ltFind={el:null,inp:null,cnt:null,timer:0};
  function _ltFindAnchor(){
    var chips=document.querySelector("[data-generator-action-chips]");
    if(!chips)return null;
    var ed=null;
    try{ed=chips.parentNode.querySelector('[data-practice-anchor="gen.prompt"] [contenteditable="true"]');}catch(e){}
    return {chips:chips,ed:ed};
  }
  function _ltFindRanges(ed,term){
    var out=[];
    if(!ed||!term)return out;
    var tl=term.toLowerCase();
    var w=document.createTreeWalker(ed,NodeFilter.SHOW_TEXT);
    var n;
    while((n=w.nextNode())){
      var s=n.nodeValue||"",l=s.toLowerCase(),i=l.indexOf(tl);
      while(i>=0){
        var r=document.createRange();
        r.setStart(n,i);r.setEnd(n,i+term.length);
        out.push(r);
        i=l.indexOf(tl,i+Math.max(1,term.length));
      }
    }
    return out;
  }
  function _ltFindApply(scrollFirst){
    if(!_ltFind.el)return;
    var term=_ltFind.inp.value.trim();
    var a=_ltFindAnchor();
    var ranges=_ltFindRanges(a&&a.ed,term);
    var n=ranges.length;
    var canHL=window.CSS&&CSS.highlights&&typeof Highlight!=="undefined";
    if(canHL){
      if(n)CSS.highlights.set("lt-find",new Highlight(...ranges));
      else CSS.highlights.delete("lt-find");
    }
    if(scrollFirst&&n&&a&&a.ed){
      try{
        var rect=ranges[0].getBoundingClientRect();
        var box=a.ed.closest(".mantine-ScrollArea-viewport")||a.ed;
        var br=box.getBoundingClientRect();
        if(rect.top<br.top+8||rect.bottom>br.bottom-8)box.scrollTop+=rect.top-(br.top+br.height/2);
      }catch(e){}
    }
    _ltFind.cnt.textContent=!term?"":(n?(n+" 处"+(canHL?"":"（不支持高亮）")):"无结果");
  }
  var _ltFind={el:null,inp:null,cnt:null,timer:0};
  var _ltSyncAll; /* 由图标扫描闭包回填：图标+搜索框的合并同步，避免两套位置各写各的基准（只声明不赋值——带 =null 的初始化器会在 IIFE 回填之后执行，把值冲掉） */
  /* 工具栏槽位：三原生按钮（参考/标记/风格）右侧依次排 [提示词AI][标签][搜索]。
     对齐以「最后一个原生按钮」的实测 rect 为准：top/高度都取它的值，不再按 chips 行估算（行有 pt-1 内边距，估算必偏）。
     z = 画布缩放比（chips 宽度比 offsetWidth 实测）；胶囊 transform-origin:left top，任意缩放下与原生按钮重合 */
  function _ltToolbarSlots(){
    var chips=document.querySelector("[data-generator-action-chips]");
    if(!chips)return null;
    var r=chips.getBoundingClientRect();
    var z=(chips.offsetWidth&&r.width?r.width/chips.offsetWidth:1)||1;
    var btns=chips.querySelectorAll("button");
    var last=btns.length?btns[btns.length-1].getBoundingClientRect():r;
    var nh=(last.height||26)/z;
    return {x:last.right+8*z,y:last.top,z:z,nh:isFinite(nh)&&nh>0?nh:26};
  }
  /* 主提示词输入的 标签/AI 两枚按钮上移到工具栏（其余输入框仍贴输入框右下角） */
  function _ltToolbarDock(f){
    var s=_ltToolbarSlots();
    if(!s)return false;
    [[f.aiIcon,0],[f.tagIcon,36]].forEach(function(p){
      var el=p[0];
      if(!el)return;
      el.classList.add("lt-tb-pill");
      el.style.left=(s.x+p[1]*s.z).toFixed(1)+"px";
      el.style.top=s.y.toFixed(1)+"px";
      el.style.display="flex";
      el.style.width="auto";el.style.height=s.nh.toFixed(1)+"px";el.style.borderRadius="999px";
      el.style.transform=s.z!==1?"scale("+s.z+")":"";
      el.style.transformOrigin="left top";
    });
    return true;
  }
  function _ltFindSync(){
    if(!_ltFind.el)return;
    var s=_ltToolbarSlots();
    if(!s){_ltFind.el.style.display="none";return;}
    _ltFind.el.style.display="flex";
    _ltFind.el.style.left=(s.x+72*s.z).toFixed(1)+"px";
    _ltFind.el.style.top=s.y.toFixed(1)+"px";
    _ltFind.el.style.height=s.nh.toFixed(1)+"px";
    _ltFind.el.style.transform=s.z!==1?"scale("+s.z+")":"";
    _ltFind.el.style.transformOrigin="left top";
  }
  function _ltFindInit(){
    if(_ltFind.el)return;
    var el=document.createElement("div");
    el.id="lt-find-bar";
    el.className="lt-tb-pill";
    el.title="搜提示词（Esc 清空，回车定位）";
    el.innerHTML='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>'
      +'<input id="lt-find-inp" placeholder="搜词" autocomplete="off" maxlength="24">'
      +'<span id="lt-find-count"></span>';
    document.body.appendChild(el);
    _ltFind.el=el;
    _ltFind.inp=el.querySelector("#lt-find-inp");
    _ltFind.cnt=el.querySelector("#lt-find-count");
    _ltFind.inp.addEventListener("input",function(){
      clearTimeout(_ltFind.timer);
      _ltFind.timer=setTimeout(function(){_ltFindApply(false);},120);
    });
    _ltFind.inp.addEventListener("keydown",function(e){
      if(e.key==="Enter"){e.preventDefault();_ltFindApply(true);}
      else if(e.key==="Escape"){e.preventDefault();e.stopPropagation();_ltFind.inp.value="";_ltFindApply(false);}
    });
    /* 提示词文本变化 → 重算命中（React 重渲染会换掉文本节点，旧 Range 失效） */
    document.addEventListener("input",function(e){
      if(_ltFind.inp.value.trim()&&e.target&&e.target.nodeType===1&&e.target.getAttribute&&e.target.getAttribute("contenteditable")==="true"){
        clearTimeout(_ltFind.timer);
        _ltFind.timer=setTimeout(function(){_ltFindApply(false);},200);
      }
    },true);
    var syncBusy=false;
    /* 限流而非防抖：站点 DOM 变更频繁，防抖会被无限重置饿死 */
    function kick(){
      if(syncBusy)return;
      syncBusy=true;
      setTimeout(function(){syncBusy=false;(_ltSyncAll||_ltFindSync)();if(_ltFind.inp.value.trim())_ltFindApply(false);},300);
    }
    window.addEventListener("resize",kick);
    document.addEventListener("scroll",kick,true);
    try{new MutationObserver(kick).observe(document.body,{childList:true,subtree:true});}catch(e){}
    _ltFindSync();
  }
  try{_ltFindInit();}catch(e){}

  /* ===== 节点对齐 pie 菜单（快捷键 A；甩选式 + 点击兜底） =====
     双环：内环 3 = 宫格/水平/垂直排列（直接复用站点原生 onLayoutChange，语义/间距/保存全同原生），
     外环 8 = 边/中心对齐 + 等距分布（对齐基准 = 选中节点包围盒屏幕坐标，与缩放无关）。
     位移 = 一次 onNodesChange 批量 position 变更（原子落位，不逐个拖）→ onSelectionDragStop 一次批量保存。
     批量通道不可用（站点改版）时回退合成拖拽闭环（逐节点，慢但稳）。
     纯函数块（__lt_pie_pure_* 之间）被 test-pie-align.js 抽取做单测，勿在其中引用 DOM。 */
  /* __lt_pie_pure_begin__ */
  var _ltPieSectors=[
    {action:"top",   label:"顶对齐"},
    {action:"distX", label:"水平等距"},
    {action:"right", label:"右对齐"},
    {action:"distY", label:"垂直等距"},
    {action:"bottom",label:"底对齐"},
    {action:"cx",    label:"水平居中"},
    {action:"left",  label:"左对齐"},
    {action:"cy",    label:"垂直居中"}
  ];
  var _ltPieInner=[
    {action:"grid", label:"宫格"},
    {action:"hrow",label:"横排"},
    {action:"vcol",label:"竖排"}
  ];
  /* 扇区：0=正上顺时针（同桌宠视线角约定）；r<28 死区返回 null；28≤r<84 内环 3 分（120°/格）；r≥84 外环 8 分（45°/格） */
  function _ltPieSector(dx,dy){
    if(!isFinite(dx)||!isFinite(dy))return null;
    var r=Math.sqrt(dx*dx+dy*dy);
    if(r<28)return null;
    var deg=Math.atan2(dx,-dy)*180/Math.PI;
    var t=((deg%360)+360)%360;
    if(r<84)return {ring:0,idx:Math.round(t/120)%3};
    return {ring:1,idx:Math.round(t/45)%8};
  }
  /* 对齐位移：boxes=[{x,y,w,h}] → [{dx,dy}]。
     边对齐到选区包围盒对应边，中心对齐到包围盒中心线；等距分布 = 首尾不动、等间隙摊开（非等中心距）。 */
  function _ltPieDeltas(boxes,action){
    if(!boxes||!boxes.length)throw new Error("没有可对齐的节点");
    var n=boxes.length,d=[],i,b;
    for(i=0;i<n;i++){
      b=boxes[i]||{};
      if(!(isFinite(b.x)&&isFinite(b.y)&&isFinite(b.w)&&isFinite(b.h))||!(b.w>0)||!(b.h>0))throw new Error("节点盒子数据无效");
      d.push({dx:0,dy:0});
    }
    if(action==="top"||action==="bottom"||action==="cy"){
      var minY=Infinity,maxY=-Infinity;
      for(i=0;i<n;i++){b=boxes[i];if(b.y<minY)minY=b.y;if(b.y+b.h>maxY)maxY=b.y+b.h;}
      for(i=0;i<n;i++){
        b=boxes[i];
        if(action==="top")d[i].dy=minY-b.y;
        else if(action==="bottom")d[i].dy=maxY-(b.y+b.h);
        else d[i].dy=(minY+maxY)/2-(b.y+b.h/2);
      }
      return d;
    }
    if(action==="left"||action==="right"||action==="cx"){
      var minX=Infinity,maxX=-Infinity;
      for(i=0;i<n;i++){b=boxes[i];if(b.x<minX)minX=b.x;if(b.x+b.w>maxX)maxX=b.x+b.w;}
      for(i=0;i<n;i++){
        b=boxes[i];
        if(action==="left")d[i].dx=minX-b.x;
        else if(action==="right")d[i].dx=maxX-(b.x+b.w);
        else d[i].dx=(minX+maxX)/2-(b.x+b.w/2);
      }
      return d;
    }
    if(action==="distX"||action==="distY"){
      if(n<3)throw new Error("等距分布至少需要 3 个节点");
      var horiz=action==="distX",idx=[];
      for(i=0;i<n;i++)idx.push(i);
      idx.sort(function(p,q){return horiz?(boxes[p].x-boxes[q].x):(boxes[p].y-boxes[q].y);});
      var first=boxes[idx[0]],last=boxes[idx[n-1]],sum=0;
      for(i=0;i<n;i++)sum+=horiz?boxes[idx[i]].w:boxes[idx[i]].h;
      var span=horiz?((last.x+last.w)-first.x):((last.y+last.h)-first.y);
      var gap=(span-sum)/(n-1),cur=horiz?first.x:first.y;
      for(i=0;i<n;i++){
        var it=boxes[idx[i]],pos=horiz?it.x:it.y;
        if(horiz)d[idx[i]].dx=cur-pos;else d[idx[i]].dy=cur-pos;
        cur+=(horiz?it.w:it.h)+gap;
      }
      return d;
    }
    throw new Error("未知对齐动作 "+action);
  }
  /* __lt_pie_pure_end__ */

  var _ltPie={el:null,mode:"flick",hover:null,sel:[]};
  var _ltLastMouse={x:0,y:0};
  document.addEventListener("mousemove",function(e){_ltLastMouse.x=e.clientX;_ltLastMouse.y=e.clientY;},true);
  /* 扇区形：中心角+张角（内环 3×120°、外环 8×45° 共用） */
  function _ltPieWedge(centerDeg,spanDeg,r0,r1){
    var p=function(a,r){return (r*Math.sin(a)).toFixed(2)+","+(-r*Math.cos(a)).toFixed(2);};
    var a0=(centerDeg-spanDeg/2)*Math.PI/180,a1=(centerDeg+spanDeg/2)*Math.PI/180;
    return "M"+p(a0,r0)+"L"+p(a0,r1)+"A"+r1+","+r1+" 0 0 1 "+p(a1,r1)+"L"+p(a1,r0)+"A"+r0+","+r0+" 0 0 0 "+p(a0,r0)+"Z";
  }
  function _ltPieToggle(){
    if(_ltPie.el){_ltPieClose();return;}
    var sel=Array.prototype.slice.call(document.querySelectorAll(".react-flow__node.selected"));
    if(sel.length<2){_ltToast("选中至少 2 个节点再按 A");return;}
    var h="",i,a,tr;
    /* 内环 r28-84：宫格/横排/竖排（直接调站点原生排列） */
    for(i=0;i<3;i++){
      a=i*120;tr=56;
      h+="<path class=\"lt-pie-w\" data-ring=\"0\" data-i=\""+i+"\" d=\""+_ltPieWedge(a,120,28,84)+"\"/>"+
         "<text class=\"lt-pie-t\" x=\""+(tr*Math.sin(a*Math.PI/180)).toFixed(1)+"\" y=\""+(-tr*Math.cos(a*Math.PI/180)).toFixed(1)+"\">"+_ltPieInner[i].label+"</text>";
    }
    /* 外环 r84-128：8 种对齐/分布 */
    for(i=0;i<8;i++){
      var s=_ltPieSectors[i];
      var off=(s.action==="distX"||s.action==="distY")&&sel.length<3;
      a=i*45;tr=106;
      h+="<path class=\"lt-pie-w"+(off?" lt-pie-off":"")+"\" data-ring=\"1\" data-i=\""+i+"\" d=\""+_ltPieWedge(a,45,84,128)+"\"/>"+
         "<text class=\"lt-pie-t"+(off?" lt-pie-off":"")+"\" x=\""+(tr*Math.sin(a*Math.PI/180)).toFixed(1)+"\" y=\""+(-tr*Math.cos(a*Math.PI/180)).toFixed(1)+"\">"+s.label+"</text>";
    }
    h+="<circle class=\"lt-pie-hub\" r=\"26\"/>";
    var el=document.createElement("div");
    el.id="lt-pie";
    el.style.left=(_ltLastMouse.x-160)+"px";
    el.style.top=(_ltLastMouse.y-160)+"px";
    el.innerHTML="<svg width=\"320\" height=\"320\" viewBox=\"-160 -160 320 320\">"+h+"</svg>";
    document.body.appendChild(el);
    _ltPie.el=el;_ltPie.sel=sel;_ltPie.mode="flick";_ltPie.hover=null;
    document.addEventListener("mousemove",_ltPieMove,true);
    document.addEventListener("keyup",_ltPieUp,true);
  }
  function _ltPieMove(e){
    if(!_ltPie.el)return;
    var r=_ltPie.el.getBoundingClientRect();
    var s=_ltPieSector(e.clientX-(r.left+r.width/2),e.clientY-(r.top+r.height/2));
    if(s&&s.ring===1&&(s.idx===1||s.idx===3)&&_ltPie.sel.length<3)s=null;
    var key=s?(s.ring+"-"+s.idx):"";
    var prev=_ltPie.hover?(_ltPie.hover.ring+"-"+_ltPie.hover.idx):"";
    if(key===prev)return;
    _ltPie.hover=s;
    var ws=_ltPie.el.querySelectorAll(".lt-pie-w");
    for(var i=0;i<ws.length;i++){
      ws[i].classList.toggle("lt-pie-on",!!s&&+ws[i].getAttribute("data-ring")===s.ring&&+ws[i].getAttribute("data-i")===s.idx);
    }
  }
  function _ltPieUp(e){
    if(e.key!=="a"&&e.key!=="A")return;
    document.removeEventListener("keyup",_ltPieUp,true);
    if(!_ltPie.el)return;
    if(_ltPie.hover){_ltPieExec(_ltPie.hover.ring,_ltPie.hover.idx);return;}
    /* 松开时停在死区 → 转点击模式 */
    _ltPie.mode="click";
    _ltPie.el.classList.add("lt-pie-click");
    document.addEventListener("mousedown",_ltPieDown,true);
  }
  function _ltPieDown(e){
    if(!_ltPie.el)return;
    if(_ltPie.el.contains(e.target)){
      var w=e.target.closest?e.target.closest(".lt-pie-w"):null;
      if(w&&!w.classList.contains("lt-pie-off"))_ltPieExec(+w.getAttribute("data-ring"),+w.getAttribute("data-i"));
      return;
    }
    _ltPieClose();
  }
  function _ltPieClose(){
    document.removeEventListener("mousemove",_ltPieMove,true);
    document.removeEventListener("keyup",_ltPieUp,true);
    document.removeEventListener("mousedown",_ltPieDown,true);
    if(_ltPie.el&&_ltPie.el.parentNode)_ltPie.el.parentNode.removeChild(_ltPie.el);
    _ltPie.el=null;_ltPie.hover=null;_ltPie.mode="flick";
  }
  function _ltPieExec(ring,idx){
    var sel=_ltPie.sel.slice();
    _ltPieClose();
    if(sel.length<2)return;
    if(ring===0){_ltPieArrange(sel,idx);return;}
    var s=_ltPieSectors[idx];
    if(!s)return;
    var boxes=[],i;
    for(i=0;i<sel.length;i++){
      var r=sel[i].getBoundingClientRect();
      boxes.push({x:r.left,y:r.top,w:r.width,h:r.height});
    }
    var ds;
    try{ds=_ltPieDeltas(boxes,s.action);}catch(err){_ltToast(err.message);return;}
    var targets=[];
    var zoom=_ltZoom();
    for(i=0;i<sel.length;i++){
      if(!ds[i].dx&&!ds[i].dy)continue;
      var f=_ltFlowPos(sel[i]);
      if(!f)continue;
      targets.push({el:sel[i],fx:f.x+ds[i].dx/zoom,fy:f.y+ds[i].dy/zoom});
    }
    if(!targets.length){_ltToast("已经对齐");return;}
    _ltAlignMove(sel,targets);
  }
  /* 画布缩放：屏幕位移/缩放 = 画布位移 */
  function _ltZoom(){
    var vp=document.querySelector(".react-flow__viewport");
    return vp?parseFloat((vp.style.transform.match(/scale\(([^)]+)\)/)||[0,1])[1])||1:1;
  }
  /* React Flow 受控通道：从 .react-flow 的 fiber 拿到 nodes 数组 + onNodesChange（官方批量变更入口） */
  function _ltRfApi(){
    try{
      var rf=document.querySelector(".react-flow");
      if(!rf)return null;
      var ks=Object.keys(rf),fk=null,i;
      for(i=0;i<ks.length;i++)if(ks[i].indexOf("__reactFiber$")===0){fk=ks[i];break;}
      if(!fk)return null;
      var f=rf[fk],h=0;
      while(f&&h++<120){
        var p=f.memoizedProps||{};
        if(Array.isArray(p.nodes)&&typeof p.onNodesChange==="function")return p;
        f=f.return;
      }
    }catch(e){}
    return null;
  }
  /* 一次批量 position 变更 = 所有节点同帧落位（不逐个拖）；
     位移取增量写回 position 字段（组内子节点的 position 是父相对坐标，绝对值直写会跳飞）；
     dragging:false 第二批清标志并触发 ops flush，onSelectionDragStop 走 nodes/batch 一次请求写全部；
     拿不到通道（站点改版）回退逐节点合成拖拽。 */
  function _ltAlignMove(sel,targets){
    var api=_ltRfApi(),i;
    if(api){
      var byId={},ch=[],moved=[];
      for(i=0;i<api.nodes.length;i++)byId[api.nodes[i].id]=api.nodes[i];
      for(i=0;i<targets.length;i++){
        var id=targets[i].el.getAttribute("data-id"),n=id&&byId[id];
        var cur=_ltFlowPos(targets[i].el);
        if(!n||!cur){ch=null;break;}
        var pos={x:n.position.x+(targets[i].fx-cur.x),y:n.position.y+(targets[i].fy-cur.y)};
        ch.push({type:"position",id:id,position:pos,dragging:true});
        moved.push(Object.assign({},n,{position:pos,dragging:false}));
      }
      if(ch){
        try{
          api.onNodesChange(ch);
          api.onNodesChange(moved.map(function(m){return {type:"position",id:m.id,position:m.position,dragging:false};}));
          try{if(typeof api.onSelectionDragStop==="function")api.onSelectionDragStop(new MouseEvent("mouseup"),moved);}catch(e2){}
          try{if(_ltSyncAll)for(var s=0;s<8;s++)setTimeout(_ltSyncAll,s*60);}catch(e3){}
          return;
        }catch(e4){/* 落到拖拽兑底 */}
      }
    }
    _ltSoloSelect(null,function(){
      _ltAlignRun(targets,0,function(){
        for(var j=0;j<sel.length;j++){
          try{if(sel[j].isConnected&&!sel[j].classList.contains("selected"))_ltCtrlClick(sel[j]);}catch(e5){}
        }
        try{if(_ltSyncAll)for(var k=0;k<8;k++)setTimeout(_ltSyncAll,k*60);}catch(e6){}
      });
    });
  }
  /* 内环动作：直接调站点原生 onLayoutChange（宫格/横排/竖排的排序、间距、保存全同原生菜单） */
  function _ltPieArrange(sel,idx){
    var mode=["grid","horizontal","vertical"][idx];
    if(!mode)return;
    var fn=null;
    try{
      var rf=document.querySelector(".react-flow");
      var ks=Object.keys(rf),fk=null,i;
      for(i=0;i<ks.length;i++)if(ks[i].indexOf("__reactFiber$")===0){fk=ks[i];break;}
      var root=fk?rf[fk]:null;
      while(root&&root.return)root=root.return;
      var q=root?[root]:[],vis=0,f;
      while(q.length&&vis++<20000){
        f=q.shift();if(!f)continue;
        var p=f.memoizedProps||{};
        if(typeof p.onLayoutChange==="function"){fn=p.onLayoutChange;break;}
        if(f.child)q.push(f.child);
        if(f.sibling)q.push(f.sibling);
      }
    }catch(e){fn=null;}
    if(!fn){_ltToast("原生排列不可用（站点结构变更）");return;}
    try{fn(mode);}catch(e2){_ltToast("排列失败："+e2.message);}
  }
  /* 节点画布坐标 = inline transform 的 translate 值（React Flow 定位机制，勿信屏幕矩形——中途缩放/平移会漂） */
  function _ltFlowPos(el){
    var m=(el.style.transform||"").match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    return m?{x:parseFloat(m[1]),y:parseFloat(m[2])}:null;
  }
  /* 选区隔离：多选下拖任意节点会带动全部选中节点，逐节点不同位移必须先把它单独选中。
     确定性两步：点空白 pane 清选（已实测 sel→0），再普通点 el（只选它自己） */
  function _ltSoloSelect(el,cb){
    var pane=document.querySelector(".react-flow__pane");
    if(pane)pane.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,view:window,button:0,clientX:0,clientY:0}));
    if(!el){setTimeout(function(){cb&&cb();},60);return;}
    var r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
    function mk(t,up){return new MouseEvent(t,{bubbles:true,cancelable:true,view:window,clientX:x,clientY:y,button:0,buttons:up?0:1});}
    el.dispatchEvent(mk("mousedown"));
    el.dispatchEvent(mk("mouseup",true));
    el.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,view:window,clientX:x,clientY:y,button:0}));
    setTimeout(function(){cb&&cb();},60);
  }
  /* 多轮闭环：每轮逐节点补拖残差（顺带吸收拖拽对旁节点的连带位移），达标或 3 轮封顶。
     目标/残差均用画布（flow）坐标，拖距=残差×缩放换算成屏幕像素 */
  function _ltAlignRun(targets,pass,done){
    if(pass>=3||!targets.length){done&&done();return;}
    var vp=document.querySelector(".react-flow__viewport");
    var zoom=vp?parseFloat((vp.style.transform.match(/scale\(([^)]+)\)/)||[0,1])[1])||1:1;
    var queue=targets.slice(),i=0;
    (function next(){
      if(i>=queue.length){
        setTimeout(function(){
          var rest=[];
          for(var j=0;j<queue.length;j++){
            var f=_ltFlowPos(queue[j].el);
            if(f&&queue[j].el.isConnected&&(Math.abs(queue[j].fx-f.x)>0.5||Math.abs(queue[j].fy-f.y)>0.5))
              rest.push(queue[j]);
          }
          _ltAlignRun(rest,pass+1,done);
        },60);
        return;
      }
      var t=queue[i++];
      if(!t.el.isConnected){next();return;}
      /* 先把它单独选中再拖：拖动只带 el 自己 */
      _ltSoloSelect(t.el,function(){
        if(!t.el.isConnected){next();return;}
        var f=_ltFlowPos(t.el);
        if(!f){next();return;}
        _ltSimDragAsync(t.el,(t.fx-f.x)*zoom,(t.fy-f.y)*zoom,function(){setTimeout(next,30);});
      });
    })();
  }
  function _ltSimDragAsync(el,dx,dy,done){
    if(!el.isConnected||(Math.abs(dx)<0.5&&Math.abs(dy)<0.5)){done&&done();return;}
    var r=el.getBoundingClientRect();
    var x0=r.left+r.width/2,y0=r.top+r.height/2;
    function mk(t,x,y,up){return new MouseEvent(t,{bubbles:true,cancelable:true,view:window,clientX:x,clientY:y,button:0,buttons:up?0:1});}
    el.dispatchEvent(mk("mousedown",x0,y0));
    var steps=[{x:x0+2,y:y0+2},{x:x0+dx*0.5,y:y0+dy*0.5},{x:x0+dx,y:y0+dy}],i=0;
    (function next(){
      if(i<steps.length){window.dispatchEvent(mk("mousemove",steps[i].x,steps[i].y));i++;setTimeout(next,16);}
      else{window.dispatchEvent(mk("mouseup",x0+dx,y0+dy,true));setTimeout(done,40);}
    })();
  }
  function _ltCtrlClick(el){
    /* React Flow 多选看全局按键状态（useKeyPress），仅点击事件带 ctrlKey 不够，需补 keydown/keyup */
    var r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
    function kk(type){document.dispatchEvent(new KeyboardEvent(type,{key:"Control",code:"Control",ctrlKey:true,bubbles:true,cancelable:true}));}
    function mk(t,up){return new MouseEvent(t,{bubbles:true,cancelable:true,view:window,clientX:x,clientY:y,button:0,buttons:up?0:1,ctrlKey:true});}
    kk("keydown");
    el.dispatchEvent(mk("mousedown"));
    el.dispatchEvent(mk("mouseup",true));
    el.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,view:window,clientX:x,clientY:y,button:0,ctrlKey:true}));
    kk("keyup");
  }

  /* ── 模型选择接管（Motif Model Select 风格） ──
     站点视频/图片模型下拉是 Mantine portal，自带 data-model-select-dropdown 属性（实测稳定钩子）。
     打开时在其 rect 上原位盖一层自己的面板（搜索/分组/收藏/最近使用），点行转回原生按钮 .click()，
     选中/关闭全走站点管线，不碰 React 树；解析失败或改版摘掉钩子 → 静默不接管，原生透出。
     纯函数块（__lt_msel_pure_* 之间）被 test-model-select.js 抽取做单测，勿在其中引用 DOM */
  /* __lt_msel_pure_begin__ */
  function _ltMselSub(hay,needle){
    /* 子序列命中返回起点（用于惩罚跳字距离），否则 -1 */
    if(!needle)return 0;
    for(var s=0;s<=hay.length-needle.length;s++){
      if(hay[s]!==needle[0])continue;
      var i=1;
      for(var c=s+1;c<hay.length&&i<needle.length;c++){if(hay[c]===needle[i])i++;}
      if(i===needle.length)return s;
    }
    return -1;
  }
  function _ltMselScore(q,item){
    /* cmdk 式打分，检查顺序按分值从高到低：名称子串 300（越靠前越高，惩罚封顶）
       > 名称子序列 220 > 角标子串 150 > 描述子串 100 > 描述子序列 60；
       q 内部统一转小写，item={name,badges:[],desc}，返回 0=不匹配、1=空查询（全保留） */
    q=String(q==null?"":q).toLowerCase();
    if(!q)return 1;
    var name=String(item.name||"").toLowerCase();
    var i=name.indexOf(q);
    if(i>=0)return 300-Math.min(i,40);
    var si=_ltMselSub(name,q);
    if(si>=0)return 220-Math.min(si,60);
    var tags=String((item.badges||[]).join(" ")).toLowerCase();
    if(tags.indexOf(q)>=0)return 150;
    var desc=String(item.desc||"").toLowerCase();
    if(desc.indexOf(q)>=0)return 100;
    if(_ltMselSub(desc,q)>=0)return 60;
    return 0;
  }
  function _ltMselGroups(items){
    /* 图标键分组（键=厂商 brand，能修 H3-Highspeed 这类前缀猜不出的归属），组名取组内名称首词多数派；
       无键项（未识别品牌）也用自身首词当组名，全无名才落「其它」。返回 [{label,items}]，组顺序按首现 */
    var map={},order=[];
    for(var i=0;i<items.length;i++){
      var key=items[i].icon||"_";
      if(!map[key]){map[key]=[];order.push(key);}
      map[key].push(items[i]);
    }
    return order.map(function(k){
      var g=map[k],cnt={},best="",bestN=0;
      for(var j=0;j<g.length;j++){
        var w=String(g[j].name||"").trim().split(/[\s（(]/)[0]||"";
        cnt[w]=(cnt[w]||0)+1;
        if(cnt[w]>bestN){bestN=cnt[w];best=w;}
      }
      return {label:best||"其它",items:g};
    });
  }
  function _ltMselClassify(pills){
    /* 视频表时长胶囊为 \d+min、图片表为 \d+s（实测两份下拉 DOM）；都没有归 misc */
    for(var i=0;i<pills.length;i++){
      if(/^\d+min$/.test(String(pills[i]||"")))return "video";
    }
    for(var j=0;j<pills.length;j++){
      if(/^\d+s$/.test(String(pills[j]||"")))return "image";
    }
    return "misc";
  }
  /* __lt_msel_pure_end__ */
  /* ── 厂商彩色图标与名称映射 ──
     站点规避风险：厂商图标是白色单色资产（实测 CDN PNG 即白 glyph）、部分模型名做了马甲。
     这里映射回原版品牌：彩色 logo 用 lobe-icons 静态 SVG（MIT 许可）内联为 data URI（离线可用）；
     无 SVG 的品牌（liblib 自研/中性）走彩色字母徽标。brand 前缀匹配（_ltMselBrandOf）。
     名称马甲只动显示名（_ltMselDName），收藏/最近仍按显示名存取，点击转发用的是原生按钮引用不受影响 */
  var _ltMselIcons={
bytedance:"data:image/svg+xml;charset=utf-8,%3Csvg%20height%3D%221em%22%20style%3D%22flex%3Anone%3Bline-height%3A1%22%20viewBox%3D%220%200%2024%2024%22%20width%3D%221em%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3EByteDance%3C%2Ftitle%3E%3Cpath%20d%3D%22M14.944%2018.587l-1.704-.445V10.01l1.824-.462c1-.254%201.84-.461%201.88-.453.032%200%20.056%202.235.056%204.972v4.973l-.176-.008c-.104%200-.952-.207-1.88-.446z%22%20fill%3D%22%2300C8D2%22%20fill-rule%3D%22nonzero%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M7%2016.542c0-2.736.024-4.98.064-4.98.032-.008.872.2%201.88.454l1.816.461-.016%204.05-.024%204.049-1.632.422c-.896.23-1.736.445-1.856.469L7%2021.523v-4.98z%22%20fill%3D%22%233C8CFF%22%20fill-rule%3D%22nonzero%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M19.24%2012.477c0-9.03.008-9.515.144-9.475.072.024.784.207%201.576.406.792.207%201.576.405%201.744.445l.296.08-.016%208.56-.024%208.568-1.624.414c-.888.23-1.728.437-1.856.47l-.24.055v-9.523z%22%20fill%3D%22%2378E6DC%22%20fill-rule%3D%22nonzero%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M1%2012.509c0-4.678.024-8.505.064-8.505.032%200%20.872.207%201.872.454l1.824.461v7.582c0%204.16-.016%207.574-.032%207.574-.024%200-.872.215-1.88.47L1%2021.013v-8.505z%22%20fill%3D%22%23325AB4%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E",
    kling:"data:image/svg+xml;charset=utf-8,%3Csvg%20height%3D%221em%22%20style%3D%22flex%3Anone%3Bline-height%3A1%22%20viewBox%3D%220%200%2024%2024%22%20width%3D%221em%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3EKling%3C%2Ftitle%3E%3Cpath%20d%3D%22M5.412%2013.775A23.193%2023.193%200%20017.41%209.32c3.17-5.492%207.795-8.757%2010.33-7.294C12.038-1.266%204.598.944%201.122%206.964A13.378%2013.378%200%2000.085%209.22c-.259.739.092%201.534.77%201.926l4.557%202.63z%22%20fill%3D%22url(%23lobe-icons-kling-0-_R_0_)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M18.588%2010.164a23.188%2023.188%200%2001-1.999%204.455c-3.17%205.492-7.795%208.758-10.33%207.294%205.703%203.293%2013.143%201.082%2016.619-4.938a13.392%2013.392%200%20001.037-2.255c.259-.738-.092-1.534-.77-1.925l-4.557-2.63z%22%20fill%3D%22url(%23lobe-icons-kling-1-_R_0_)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M16.59%2014.62c3.17-5.492%203.686-11.13%201.15-12.594C15.207.563%2010.582%203.83%207.41%209.32c2.074-3.59%205.809-5.315%208.344-3.852%202.534%201.464%202.908%205.56.835%209.151z%22%20fill%3D%22url(%23lobe-icons-kling-2-_R_0_)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M7.41%209.32c-3.17%205.492-3.686%2011.13-1.15%2012.593%202.534%201.464%207.159-1.802%2010.33-7.294-2.074%203.591-5.809%205.316-8.344%203.852-2.534-1.463-2.908-5.56-.835-9.15z%22%20fill%3D%22url(%23lobe-icons-kling-3-_R_0_)%22%3E%3C%2Fpath%3E%3Cdefs%3E%3CradialGradient%20cx%3D%220%22%20cy%3D%220%22%20gradientTransform%3D%22matrix(7.47772%20-12.51022%2017.14368%2010.24728%205.173%2013.637)%22%20gradientUnits%3D%22userSpaceOnUse%22%20id%3D%22lobe-icons-kling-0-_R_0_%22%20r%3D%221%22%3E%3Cstop%20offset%3D%22.095%22%20stop-color%3D%22%23FFF959%22%3E%3C%2Fstop%3E%3Cstop%20offset%3D%22.326%22%20stop-color%3D%22%230DF35E%22%3E%3C%2Fstop%3E%3Cstop%20offset%3D%22.64%22%20stop-color%3D%22%230BF2F9%22%3E%3C%2Fstop%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2304A6F0%22%3E%3C%2Fstop%3E%3C%2FradialGradient%3E%3CradialGradient%20cx%3D%220%22%20cy%3D%220%22%20gradientTransform%3D%22rotate(120.868%206.491%2010.491)%20scale(14.5747%2019.9728)%22%20gradientUnits%3D%22userSpaceOnUse%22%20id%3D%22lobe-icons-kling-1-_R_0_%22%20r%3D%221%22%3E%3Cstop%20offset%3D%22.095%22%20stop-color%3D%22%23FFF959%22%3E%3C%2Fstop%3E%3Cstop%20offset%3D%22.326%22%20stop-color%3D%22%230DF35E%22%3E%3C%2Fstop%3E%3Cstop%20offset%3D%22.64%22%20stop-color%3D%22%230BF2F9%22%3E%3C%2Fstop%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2304A6F0%22%3E%3C%2Fstop%3E%3C%2FradialGradient%3E%3ClinearGradient%20gradientUnits%3D%22userSpaceOnUse%22%20id%3D%22lobe-icons-kling-2-_R_0_%22%20x1%3D%2215.578%22%20x2%3D%2218.062%22%20y1%3D%221.798%22%20y2%3D%229.861%22%3E%3Cstop%20stop-color%3D%22%23003EFF%22%3E%3C%2Fstop%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%230BFFE7%22%3E%3C%2Fstop%3E%3C%2FlinearGradient%3E%3ClinearGradient%20gradientUnits%3D%22userSpaceOnUse%22%20id%3D%22lobe-icons-kling-3-_R_0_%22%20x1%3D%228.422%22%20x2%3D%225.938%22%20y1%3D%2222.142%22%20y2%3D%2214.079%22%3E%3Cstop%20stop-color%3D%22%23003EFF%22%3E%3C%2Fstop%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%230BFFE7%22%3E%3C%2Fstop%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3C%2Fsvg%3E",
    minimax:"data:image/svg+xml;charset=utf-8,%3Csvg%20height%3D%221em%22%20style%3D%22flex%3Anone%3Bline-height%3A1%22%20viewBox%3D%220%200%2024%2024%22%20width%3D%221em%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3EMinimax%3C%2Ftitle%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22lobe-icons-minimax-_R_0_%22%20x1%3D%220%25%22%20x2%3D%22100.182%25%22%20y1%3D%2250.057%25%22%20y2%3D%2250.057%25%22%3E%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%23E2167E%22%3E%3C%2Fstop%3E%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%23FE603C%22%3E%3C%2Fstop%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Cpath%20d%3D%22M16.278%202c1.156%200%202.093.927%202.093%202.07v12.501a.74.74%200%2000.744.709.74.74%200%2000.743-.709V9.099a2.06%202.06%200%20012.071-2.049A2.06%202.06%200%200124%209.1v6.561a.649.649%200%2001-.652.645.649.649%200%2001-.653-.645V9.1a.762.762%200%2000-.766-.758.762.762%200%2000-.766.758v7.472a2.037%202.037%200%2001-2.048%202.026%202.037%202.037%200%2001-2.048-2.026v-12.5a.785.785%200%2000-.788-.753.785.785%200%2000-.789.752l-.001%2015.904A2.037%202.037%200%200113.441%2022a2.037%202.037%200%2001-2.048-2.026V18.04c0-.356.292-.645.652-.645.36%200%20.652.289.652.645v1.934c0%20.263.142.506.372.638.23.131.514.131.744%200a.734.734%200%2000.372-.638V4.07c0-1.143.937-2.07%202.093-2.07zm-5.674%200c1.156%200%202.093.927%202.093%202.07v11.523a.648.648%200%2001-.652.645.648.648%200%2001-.652-.645V4.07a.785.785%200%2000-.789-.78.785.785%200%2000-.789.78v14.013a2.06%202.06%200%2001-2.07%202.048%202.06%202.06%200%2001-2.071-2.048V9.1a.762.762%200%2000-.766-.758.762.762%200%2000-.766.758v3.8a2.06%202.06%200%2001-2.071%202.049A2.06%202.06%200%20010%2012.9v-1.378c0-.357.292-.646.652-.646.36%200%20.653.29.653.646V12.9c0%20.418.343.757.766.757s.766-.339.766-.757V9.099a2.06%202.06%200%20012.07-2.048%202.06%202.06%200%20012.071%202.048v8.984c0%20.419.343.758.767.758.423%200%20.766-.339.766-.758V4.07c0-1.143.937-2.07%202.093-2.07z%22%20fill%3D%22url(%23lobe-icons-minimax-_R_0_)%22%20fill-rule%3D%22nonzero%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E",
    alibaba:"data:image/svg+xml;charset=utf-8,%3Csvg%20height%3D%221em%22%20style%3D%22flex%3Anone%3Bline-height%3A1%22%20viewBox%3D%220%200%2024%2024%22%20width%3D%221em%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3EAlibaba%3C%2Ftitle%3E%3Cpath%20d%3D%22M24%2014.014c-2.8%201.512-5.62%202.896-8.759%203.524-.7.139-1.476.139-2.187.043-.678-.085-1.017-.682-.776-1.31.23-.585.536-1.181.93-1.671.852-1.065%201.814-2.034%202.678-3.088a15.75%2015.75%200%20001.422-2.054c.306-.511.164-1.129-.372-1.384-.897-.437-1.859-.745-2.81-1.075-.11-.043-.274.074-.492.149.273.244.47.425.743.67-2.821.48-5.49%201.16-8.08%202.098-.012.053-.033.095-.023.117.383.585.208%201.032-.35%201.394a2.365%202.365%200%2000-.568.522c1.706.5%203.226.213%204.68-.735-.087-.127-.175-.244-.262-.372.546.096.874.394.918.862.011.107-.054.213-.087.32-.077-.086-.175-.17-.24-.267-.045-.064-.056-.138-.088-.245-1.728%201.15-3.587%201.438-5.632.842%200%20.404-.022.745.011%201.075.022.287-.098.415-.36.564-.591.362-1.204.735-1.696%201.214-.59.585-.371%201.299.427%201.597.907.34%201.859.35%202.81.234%201.126-.139%202.23-.32%203.456-.49-1.433.67-2.844%201.14-4.33%201.33-1.04.14-2.078.214-3.106-.084-1.476-.415-2.133-1.501-1.75-2.96.361-1.363%201.236-2.449%202.176-3.45%203.139-3.332%207.108-5.024%2011.7-5.365%201.072-.074%202.155.064%203.16.511%201.411.639%202.002%201.99%201.313%203.354-.448.905-1.072%201.735-1.695%202.555-.612.809-1.301%201.554-1.946%202.331-.186.234-.361.48-.503.745-.274.5-.088.83.492.778%201.213-.118%202.45-.213%203.62-.511%201.716-.437%203.389-1.054%205.084-1.597.175-.043.339-.107.492-.17z%22%20fill%3D%22%23FF6003%22%20fill-rule%3D%22evenodd%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E",
    qwen:"data:image/svg+xml;charset=utf-8,%3Csvg%20height%3D%221em%22%20style%3D%22flex%3Anone%3Bline-height%3A1%22%20viewBox%3D%220%200%2024%2024%22%20width%3D%221em%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3EQwen%3C%2Ftitle%3E%3Cpath%20d%3D%22M19.713%202.825h-5.907c0-.251-.066-.503-.196-.728L12.819.728A1.46%201.46%200%200%200%2011.559%200h-1.58c-.52%200-1%20.275-1.26.728l-2.42%204.19a1.45%201.45%200%200%200%200%201.453l.791%201.37c.26.448.74.727%201.26.727h11.36c.52%200%201-.275%201.26-.728l.79-1.37a1.45%201.45%200%200%200%200-1.451l-.79-1.37a1.46%201.46%200%200%200-1.26-.728zM.195%209.905l2.951%205.115a1.46%201.46%200%200%200-.531.531l-.791%201.37a1.45%201.45%200%200%200%200%201.452l.79%201.37c.26.448.74.727%201.26.727h4.84c.52%200%201-.275%201.26-.728l.79-1.37a1.45%201.45%200%200%200%200-1.451L5.086%207.083a1.46%201.46%200%200%200-1.26-.728h-1.58c-.52%200-1%20.276-1.26.728l-.79%201.37a1.45%201.45%200%200%200%200%201.452m15.888%2013.367%202.951-5.115c.217.125.469.196.728.196h1.582c.52%200%201-.275%201.26-.728l.79-1.37a1.45%201.45%200%200%200%200-1.451l-2.42-4.191a1.46%201.46%200%200%200-1.259-.728h-1.582c-.52%200-1%20.276-1.259.728l-5.678%209.838a1.45%201.45%200%200%200%200%201.452l.79%201.37c.26.448.74.727%201.26.727h1.582c.52%200%201-.275%201.26-.728z%22%20fill%3D%22%23082dff%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E",
    vidu:"data:image/svg+xml;charset=utf-8,%3Csvg%20height%3D%221em%22%20style%3D%22flex%3Anone%3Bline-height%3A1%22%20viewBox%3D%220%200%2024%2024%22%20width%3D%221em%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3EVidu%3C%2Ftitle%3E%3Cpath%20d%3D%22M20.607%202.247c-2.917-.966-5.426%201.084-6.011%202.96%200%200-2.105%206.76-3.002%209.58-.428%201.346-1.489%203.548-3.487%203.548-1.627%200-2.463-1.527-2.816-2.437L2.865%209.431c-.281-.681.013-2.04%201.14-2.447%201.204-.432%201.978.575%202.178%201.11l3.022%207.74c.72-.928%201.178-2.438%201.476-3.507l-1.984-5.21C7.756%204.686%205.267%203.58%202.962%204.43%201.095%205.118-.702%207.474.275%2010.435l2.504%206.44c.38.976%201.881%204.163%205.275%204.163%204.073%200%205.601-3.473%206.449-6.218.424-1.373%202.749-8.797%202.749-8.797.338-1.109%201.71-1.428%202.568-1.148.605.196%201.698%201.031%201.345%202.325-.066.236-1.92%206.209-2.604%208.026-.357.948-1.262%203.006-3.324%202.72-.628%201.39-1.15%202.199-1.94%202.925%202.572%201.218%206.32-.009%207.898-4.776.586-1.773%202.644-8.166%202.644-8.166.598-1.963-.469-4.768-3.232-5.682z%22%20fill%3D%22url(%23lobe-icons-vidu-_R_0_)%22%3E%3C%2Fpath%3E%3Cdefs%3E%3ClinearGradient%20gradientUnits%3D%22userSpaceOnUse%22%20id%3D%22lobe-icons-vidu-_R_0_%22%20x1%3D%22.759%22%20x2%3D%2226.155%22%20y1%3D%225.637%22%20y2%3D%2217.311%22%3E%3Cstop%20stop-color%3D%22%2340EDD8%22%3E%3C%2Fstop%3E%3Cstop%20offset%3D%22.024%22%20stop-color%3D%22%2338E7E2%22%3E%3C%2Fstop%3E%3Cstop%20offset%3D%22.084%22%20stop-color%3D%22%2328DAF7%22%3E%3C%2Fstop%3E%3Cstop%20offset%3D%22.124%22%20stop-color%3D%22%2322D5FF%22%3E%3C%2Fstop%3E%3Cstop%20offset%3D%22.36%22%20stop-color%3D%22%231ABFFF%22%3E%3C%2Fstop%3E%3Cstop%20offset%3D%22.85%22%20stop-color%3D%22%230786FE%22%3E%3C%2Fstop%3E%3Cstop%20offset%3D%22.909%22%20stop-color%3D%22%23047FFE%22%3E%3C%2Fstop%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3C%2Fsvg%3E",
    pixverse:"data:image/svg+xml;charset=utf-8,%3Csvg%20height%3D%221em%22%20style%3D%22flex%3Anone%3Bline-height%3A1%22%20viewBox%3D%220%200%2024%2024%22%20width%3D%221em%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3EPixVerse%3C%2Ftitle%3E%3Cpath%20d%3D%22M10.998%2023.837L5%2021.015V5.569c0-.733.32-1.547.84-2.065l1.386-1.387%206.064%2019.729c.426%201.377-.987%202.605-2.292%201.991z%22%20fill%3D%22url(%23lobe-icons-pix-verse-0-_R_0_)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M19.36%208.43L12.517.905A2.765%202.765%200%20008.517.81L5.84%203.504c-.511.584-.803%201.198-.803%201.93V20.88l13.699-8.219a2.765%202.765%200%2000.623-4.23%22%20fill%3D%22url(%23lobe-icons-pix-verse-1-_R_0_)%22%3E%3C%2Fpath%3E%3Cdefs%3E%3ClinearGradient%20gradientUnits%3D%22userSpaceOnUse%22%20id%3D%22lobe-icons-pix-verse-0-_R_0_%22%20x1%3D%22-5.894%22%20x2%3D%2213.185%22%20y1%3D%225.53%22%20y2%3D%2223.781%22%3E%3Cstop%20stop-color%3D%22%23FE9E58%22%3E%3C%2Fstop%3E%3Cstop%20offset%3D%22.396%22%20stop-color%3D%22%23E470EC%22%3E%3C%2Fstop%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23442FBA%22%3E%3C%2Fstop%3E%3C%2FlinearGradient%3E%3ClinearGradient%20gradientUnits%3D%22userSpaceOnUse%22%20id%3D%22lobe-icons-pix-verse-1-_R_0_%22%20x1%3D%2215.931%22%20x2%3D%22-3.149%22%20y1%3D%225.396%22%20y2%3D%2223.647%22%3E%3Cstop%20stop-color%3D%22%23FFA052%22%3E%3C%2Fstop%3E%3Cstop%20offset%3D%22.396%22%20stop-color%3D%22%23E36CFA%22%20stop-opacity%3D%22.8%22%3E%3C%2Fstop%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23442FBA%22%20stop-opacity%3D%22.7%22%3E%3C%2Fstop%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3C%2Fsvg%3E",
    openai:"data:image/svg+xml;charset=utf-8,%3Csvg%20fill%3D%22%2310A37F%22%20fill-rule%3D%22evenodd%22%20height%3D%221em%22%20style%3D%22flex%3Anone%3Bline-height%3A1%22%20viewBox%3D%220%200%2024%2024%22%20width%3D%221em%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3EOpenAI%3C%2Ftitle%3E%3Cpath%20d%3D%22M9.205%208.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357%201.356-.523%202.117-.523%202.854%200%204.662%202.212%204.662%204.566%200%20.167%200%20.357-.024.547l-4.71-2.759a.797.797%200%2000-.856%200l-5.97%203.473zm10.609%208.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473%201.95-1.118a.433.433%200%2001.476%200l4.543%202.617c1.309.76%202.189%202.378%202.189%203.948%200%201.808-1.07%203.473-2.76%204.163zM7.802%2012.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545%201.95-4.472%204.591-4.472%201%200%201.927.333%202.712.928L8.23%205.067c-.285.166-.428.404-.428.737v6.898zM12%2015.128l-2.795-1.57v-3.33L12%208.658l2.795%201.57v3.33L12%2015.128zm1.796%207.23c-1%200-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974%201.142c.167.095.238.238.238.428v5.233c0%202.545-1.974%204.472-4.614%204.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482%204.482%200%20014.21%206.327v5.423c0%20.333.143.571.428.738l5.947%203.449-1.95%201.118a.432.432%200%2001-.476%200zm-.262%203.9c-2.688%200-4.662-2.021-4.662-4.519%200-.19.024-.38.047-.57l4.686%202.71c.286.167.571.167.856%200l5.97-3.448v2.26c0%20.19-.07.333-.237.428l-4.543%202.616c-.619.357-1.356.523-2.117.523zm5.899%202.83a5.947%205.947%200%20005.827-4.756C22.287%2018.339%2024%2015.84%2024%2013.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498%200-3.401-2.759-5.947-5.946-5.947-.642%200-1.26.095-1.88.31A5.962%205.962%200%200010.205%200a5.947%205.947%200%2000-5.827%204.757C1.713%205.447%200%207.945%200%2010.49c0%201.666.713%203.283%201.998%204.448-.119.5-.19%201-.19%201.499%200%203.401%202.759%205.946%205.946%205.946.642%200%201.26-.095%201.88-.309a5.96%205.96%200%20004.162%201.713z%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E",
    gemini:"data:image/svg+xml;charset=utf-8,%3Csvg%20height%3D%221em%22%20style%3D%22flex%3Anone%3Bline-height%3A1%22%20viewBox%3D%220%200%2024%2024%22%20width%3D%221em%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3EGemini%3C%2Ftitle%3E%3Cpath%20d%3D%22M20.616%2010.835a14.147%2014.147%200%2001-4.45-3.001%2014.111%2014.111%200%2001-3.678-6.452.503.503%200%2000-.975%200%2014.134%2014.134%200%2001-3.679%206.452%2014.155%2014.155%200%2001-4.45%203.001c-.65.28-1.318.505-2.002.678a.502.502%200%20000%20.975c.684.172%201.35.397%202.002.677a14.147%2014.147%200%20014.45%203.001%2014.112%2014.112%200%20013.679%206.453.502.502%200%2000.975%200c.172-.685.397-1.351.677-2.003a14.145%2014.145%200%20013.001-4.45%2014.113%2014.113%200%20016.453-3.678.503.503%200%20000-.975%2013.245%2013.245%200%2001-2.003-.678z%22%20fill%3D%22%233186FF%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M20.616%2010.835a14.147%2014.147%200%2001-4.45-3.001%2014.111%2014.111%200%2001-3.678-6.452.503.503%200%2000-.975%200%2014.134%2014.134%200%2001-3.679%206.452%2014.155%2014.155%200%2001-4.45%203.001c-.65.28-1.318.505-2.002.678a.502.502%200%20000%20.975c.684.172%201.35.397%202.002.677a14.147%2014.147%200%20014.45%203.001%2014.112%2014.112%200%20013.679%206.453.502.502%200%2000.975%200c.172-.685.397-1.351.677-2.003a14.145%2014.145%200%20013.001-4.45%2014.113%2014.113%200%20016.453-3.678.503.503%200%20000-.975%2013.245%2013.245%200%2001-2.003-.678z%22%20fill%3D%22url(%23lobe-icons-gemini-0-_R_0_)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M20.616%2010.835a14.147%2014.147%200%2001-4.45-3.001%2014.111%2014.111%200%2001-3.678-6.452.503.503%200%2000-.975%200%2014.134%2014.134%200%2001-3.679%206.452%2014.155%2014.155%200%2001-4.45%203.001c-.65.28-1.318.505-2.002.678a.502.502%200%20000%20.975c.684.172%201.35.397%202.002.677a14.147%2014.147%200%20014.45%203.001%2014.112%2014.112%200%20013.679%206.453.502.502%200%2000.975%200c.172-.685.397-1.351.677-2.003a14.145%2014.145%200%20013.001-4.45%2014.113%2014.113%200%20016.453-3.678.503.503%200%20000-.975%2013.245%2013.245%200%2001-2.003-.678z%22%20fill%3D%22url(%23lobe-icons-gemini-1-_R_0_)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M20.616%2010.835a14.147%2014.147%200%2001-4.45-3.001%2014.111%2014.111%200%2001-3.678-6.452.503.503%200%2000-.975%200%2014.134%2014.134%200%2001-3.679%206.452%2014.155%2014.155%200%2001-4.45%203.001c-.65.28-1.318.505-2.002.678a.502.502%200%20000%20.975c.684.172%201.35.397%202.002.677a14.147%2014.147%200%20014.45%203.001%2014.112%2014.112%200%20013.679%206.453.502.502%200%2000.975%200c.172-.685.397-1.351.677-2.003a14.145%2014.145%200%20013.001-4.45%2014.113%2014.113%200%20016.453-3.678.503.503%200%20000-.975%2013.245%2013.245%200%2001-2.003-.678z%22%20fill%3D%22url(%23lobe-icons-gemini-2-_R_0_)%22%3E%3C%2Fpath%3E%3Cdefs%3E%3ClinearGradient%20gradientUnits%3D%22userSpaceOnUse%22%20id%3D%22lobe-icons-gemini-0-_R_0_%22%20x1%3D%227%22%20x2%3D%2211%22%20y1%3D%2215.5%22%20y2%3D%2212%22%3E%3Cstop%20stop-color%3D%22%2308B962%22%3E%3C%2Fstop%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2308B962%22%20stop-opacity%3D%220%22%3E%3C%2Fstop%3E%3C%2FlinearGradient%3E%3ClinearGradient%20gradientUnits%3D%22userSpaceOnUse%22%20id%3D%22lobe-icons-gemini-1-_R_0_%22%20x1%3D%228%22%20x2%3D%2211.5%22%20y1%3D%225.5%22%20y2%3D%2211%22%3E%3Cstop%20stop-color%3D%22%23F94543%22%3E%3C%2Fstop%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23F94543%22%20stop-opacity%3D%220%22%3E%3C%2Fstop%3E%3C%2FlinearGradient%3E%3ClinearGradient%20gradientUnits%3D%22userSpaceOnUse%22%20id%3D%22lobe-icons-gemini-2-_R_0_%22%20x1%3D%223.5%22%20x2%3D%2217.5%22%20y1%3D%2213.5%22%20y2%3D%2212%22%3E%3Cstop%20stop-color%3D%22%23FABC12%22%3E%3C%2Fstop%3E%3Cstop%20offset%3D%22.46%22%20stop-color%3D%22%23FABC12%22%20stop-opacity%3D%220%22%3E%3C%2Fstop%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3C%2Fsvg%3E"
  };
  var _ltMselBrandColor={bytedance:"#00C8D2",kling:"#0BF2F9",minimax:"#E2167E",alibaba:"#FF6003",qwen:"#082dff",vidu:"#1ABFFF",pixverse:"#E470EC",openai:"#10A37F",gemini:"#4285F4",liblib:"#4F6BFF"};
  var _ltMselBrandKeys=["Seedance","Seedream","OmniHuman","Kling","Minimax H3","Minimax H3 Max","H3-Highspeed","Hailuo","Wan","Qwen","Z-image","Happy Horse","Vidu","Pixverse","Lib Image","General image","AutoPic","Genesis"];
  var _ltMselBrandMap={Seedance:"bytedance",Seedream:"bytedance",OmniHuman:"bytedance",Kling:"kling","Minimax H3":"minimax","Minimax H3 Max":"minimax","H3-Highspeed":"minimax",Hailuo:"minimax",Wan:"alibaba",Qwen:"qwen","Z-image":"alibaba","Happy Horse":"alibaba",Vidu:"vidu",Pixverse:"pixverse","Lib Image":"openai","General image":"gemini",AutoPic:"liblib",Genesis:"liblib"};
  /* 品牌分组头显示名（多数派首词不够表意时用：GPT/Nano 这种截断读不通） */
  var _ltMselBrandLabel={openai:"GPT Image 2",gemini:"Nano Banana"};
  var _ltMselRename={"Happy Horse":"Wan","Lib Image":"GPT Image 2","General image":"Nano Banana"};
  function _ltMselBrandOf(name){
    /* 大小写不敏感：站点两表拼写不一（视频表 Minimax / 图片表 MiniMax），前缀匹配统一小写比 */
    var s=String(name||"").toLowerCase();
    for(var i=0;i<_ltMselBrandKeys.length;i++){
      var k=_ltMselBrandKeys[i].toLowerCase();
      if(s.indexOf(k)===0)return _ltMselBrandMap[_ltMselBrandKeys[i]]||"";
    }
    return "";
  }
  function _ltMselDName(name){
    /* 马甲名还原显示名（只动前缀品牌段，版本号原样保留） */
    var s=String(name||"");
    for(var k in _ltMselRename){
      if(s.indexOf(k)===0)return _ltMselRename[k]+s.slice(k.length);
    }
    return s;
  }
  function _ltMselIconHTML(brand,fallbackLabel){
    var ic=brand?_ltMselIcons[brand]:null;
    if(ic)return '<img class="lt-msel-cic" src="'+ic+'" alt="">';
    var col=(brand&&_ltMselBrandColor[brand])||"#6b7280";
    return '<span class="lt-msel-fb" style="background:'+col+'">'+_ltEsc((fallbackLabel||"?").slice(0,1).toUpperCase())+'</span>';
  }
  try{if(localStorage.getItem("_lt_msel")===null)localStorage.setItem("_lt_msel","1");}catch(e){}
  function _ltMselOn(){try{return localStorage.getItem("_lt_msel")!=="0";}catch(e){return true;}}
  function _ltMselStore(){
    /* 收藏/最近使用，按列表分表；容错还原形状（旧版本/手改不炸）。
       条目名过一遍 _ltMselDName：老版本存的是站点名（马甲名），读取时自动迁移到显示名 */
    var s=_ltJ("_lt_model_sel_v1",null);
    if(!s||typeof s!=="object")s={};
    ["video","image","misc"].forEach(function(k){
      if(!s[k]||typeof s[k]!=="object")s[k]={};
      if(!Array.isArray(s[k].favs))s[k].favs=[];
      if(!Array.isArray(s[k].recent))s[k].recent=[];
      s[k].favs=s[k].favs.map(function(n){return _ltMselDName(n);});
      s[k].recent=s[k].recent.map(function(n){return _ltMselDName(n);});
    });
    return s;
  }
  function _ltMselSaveStore(s){try{localStorage.setItem("_lt_model_sel_v1",JSON.stringify(s));}catch(e){}}
  function _ltMselParse(dd){
    /* 解析失败返回 null → 不接管，原生透出（防御站点改版）。
       行结构（2026-11 实测）：button[data-selected] > span.text-fg-default 名称 +
       角标 span（上新/限时X折/首发/版本号）+ 时长胶囊 span（\d+min|\d+s）+ p 描述 + img 图标。
       全量 querySelectorAll 抓行而容器序遍历：部分行被包在 span.block.w-full 引导壳里
       （实测视频表 38 行中 4 行：Vidu Q4 Preview/Hailuo 2.3 Fast/Kling3.0 动作迁移/Style Video），
       文档序天然保序，壳里壳外一视同仁 */
    try{
      var btns=dd.querySelectorAll("button[data-selected]");
      if(!btns.length)return null;
      var rows=[],seen={},pills=[];
      for(var i=0;i<btns.length;i++){
        var c=btns[i];
        var nameEl=c.querySelector("span.text-fg-default");
        var name=nameEl?String(nameEl.textContent||"").trim():"";
        if(!name||seen[name])continue; /* 站点偶现重复行（视频表 a11y 里 Vidu Q2 Pro ×2），按名去重 */
        seen[name]=1;
        var dur="",badges=[],spans=c.querySelectorAll("span");
        for(var j=0;j<spans.length;j++){
          var t=String(spans[j].textContent||"").trim();
          if(!t||t===name)continue;
          if(!dur&&/^\d+(s|min)$/.test(t)){dur=t;continue;}
          if(badges.indexOf(t)<0)badges.push(t);
        }
        if(dur)pills.push(dur);
        var p=c.querySelector("p");
        var brand=_ltMselBrandOf(name);
        /* name 存显示名（马甲还原+搜索都打它）；icon=brand 替代站点白色单色图标做分组键与展示 */
        rows.push({name:_ltMselDName(name),brand:brand,badges:badges,dur:dur,desc:p?String(p.textContent||"").trim():"",
                   icon:brand,sel:c.getAttribute("data-selected")==="true",btn:c});
      }
      if(!rows.length)return null;
      return {type:_ltMselClassify(pills),rows:rows};
    }catch(e){return null;}
  }
  var _ltMselOverlays=new Map(); /* 原生下拉元素 -> 覆盖层状态 {root,input,list,cnt,parsed,type,vis,act} */
  /* ── 指针/焦点事件守卫（脚本加载期注册的 document 捕获单例） ──
     站点在面板层和弹出层都有自己的外点关闭监听，注册时机不可控；合成 .click() 不带
     pointer/mousedown/focus 序列所以自动化测不出，真实鼠标一点（点覆盖层任何地方）
     面板/弹出层就把自己关掉，覆盖层跟着被清扫=「列表消失」（实测复现）。
     脚本加载期注册的捕获监听必然最先跑，stopImmediatePropagation 把起点在覆盖层内
     的指针/焦点事件全部吞掉，站点各层什么都看不见；页面其余事件不受影响 */
  function _ltMselOwner(target){
    var hit=null;
    _ltMselOverlays.forEach(function(o){
      if(!hit&&o.root.contains(target))hit=o;
    });
    return hit;
  }
  function _ltMselGuard(e){
    if(_ltMselOwner(e.target))e.stopImmediatePropagation();
  }
  ["pointerdown","mousedown","touchstart","focusout","focusin"].forEach(function(ev){
    document.addEventListener(ev,_ltMselGuard,true);
  });
  function _ltMselClickGuard(e){
    var o=_ltMselOwner(e.target);
    if(!o)return;
    e.stopImmediatePropagation(); /* 同上：不让站点各层看到覆盖层内的 click */
    var rb=e.target.closest?e.target.closest(".lt-msel-rb"):null;
    if(rb){
      var idx=parseInt(rb.getAttribute("data-sec"),10);
      if(o.input.value){o.input.value="";_ltMselRender(o);}
      var el=o.secEls&&o.secEls[idx];
      if(el){
        /* 只滚自己的列表（scrollIntoView 会连带滚动所有可滚动祖先）；瞬间落位 */
        o.list.scrollTo({top:Math.max(el.offsetTop-6,0),behavior:"auto"});
      }
      _ltMselSpy(o);
      return;
    }
    var item=e.target.closest?e.target.closest(".lt-msel-item"):null;
    if(!item)return;
    var star=e.target.closest(".lt-msel-star");
    var idx2=parseInt(item.getAttribute("data-i"),10),it=o.vis[idx2];
    if(!it)return;
    if(star){_ltMselToggleFav(o,it.name);return;}
    _ltMselPick(o,it);
  }
  document.addEventListener("click",_ltMselClickGuard,true);
  function _ltMselItemHTML(o,it,idx,favs){
    var fav=favs.indexOf(it.name)>=0;
    return '<div class="lt-msel-item'+(it.sel?" cur":"")+'" data-i="'+idx+'">'
      +'<div class="lt-msel-ic">'+_ltMselIconHTML(it.brand,it.name)+'</div>'
      +'<div class="lt-msel-main"><div class="lt-msel-l1"><span class="lt-msel-name">'+_ltEsc(it.name)+'</span>'
      +it.badges.map(function(b){return '<span class="lt-msel-badge">'+_ltEsc(b)+'</span>';}).join("")
      +'<span class="lt-msel-star'+(fav?" on":"")+'" title="收藏">★</span></div>'
      +(it.desc?'<div class="lt-msel-desc">'+_ltEsc(it.desc)+'</div>':"")
      +'</div>'
      +(it.dur?'<span class="lt-msel-dur">'+_ltEsc(it.dur)+'</span>':"")
      +'</div>';
  }
  function _ltMselRender(o){
    var q=String(o.input&&o.input.value||"").trim();
    var st=_ltMselStore()[o.type]||{favs:[],recent:[]};
    var favs=st.favs,rows=o.parsed.rows,vis=[],html="";
    var secs=_ltMselSecs(o,st,rows);
    if(q){
      /* 搜索视图：打分排序平铺（cmdk 式），无分组头；索引栏仍显示（镜像默认分区序） */
      var scored=[];
      for(var i=0;i<rows.length;i++){
        var sc=_ltMselScore(q,{name:rows[i].name,badges:rows[i].badges,desc:rows[i].desc});
        if(sc>0)scored.push([sc,rows[i]]);
      }
      scored.sort(function(a,b){return b[0]-a[0];});
      for(var v=0;v<scored.length;v++)vis.push(scored[v][1]);
      if(!vis.length)html='<div class="lt-msel-empty">无匹配模型</div>';
      for(var v2=0;v2<vis.length;v2++)html+=_ltMselItemHTML(o,vis[v2],v2,favs);
      o.cnt.textContent=vis.length+" / "+rows.length;
    }else{
      for(var si=0;si<secs.length;si++){
        html+='<div class="lt-msel-sec">'+_ltEsc(secs[si].label)+'</div>';
        for(var ii=0;ii<secs[si].items.length;ii++){html+=_ltMselItemHTML(o,secs[si].items[ii],vis.length,favs);vis.push(secs[si].items[ii]);}
      }
      o.cnt.textContent=String(rows.length);
    }
    o.list.innerHTML=html;
    o.vis=vis;o.act=-1;
    o.secEls=[].slice.call(o.list.querySelectorAll(".lt-msel-sec"));
    _ltMselRailRender(o,secs.map(function(s){return {label:s.label,icon:s.items.length?s.items[0].icon:""};}));
    _ltMselSpy(o);
  }
  function _ltMselMark(o){
    var items=o.list.querySelectorAll(".lt-msel-item");
    for(var i=0;i<items.length;i++){
      var idx=parseInt(items[i].getAttribute("data-i"),10);
      items[i].classList.toggle("act",idx===o.act);
      /* 同 rail 点击的教训：scrollIntoView 会连带滚动所有可滚动祖先，这里手写视口内钳制 */
      if(idx===o.act){
        var top=items[i].offsetTop-6,bottom=items[i].offsetTop+items[i].offsetHeight+6;
        if(top<o.list.scrollTop)o.list.scrollTop=Math.max(top,0);
        else if(bottom>o.list.scrollTop+o.list.clientHeight)o.list.scrollTop=bottom-o.list.clientHeight;
      }
    }
  }
  function _ltMselPick(o,it){
    if(!it||!it.btn||!it.btn.isConnected)return;
    if(it.btn.getAttribute("aria-disabled")==="true")return;
    /* 先记账再转发：站点选中后会立即卸下拉（Step 0 实测） */
    try{
      var s=_ltMselStore(),t=s[o.type];
      var ri=t.recent.indexOf(it.name);
      if(ri>=0)t.recent.splice(ri,1);
      t.recent.unshift(it.name);
      if(t.recent.length>3)t.recent.length=3;
      _ltMselSaveStore(s);
    }catch(e){}
    it.btn.click(); /* React 响应程序化 click（Step 0 实测两次），选中/关下拉走站点管线 */
  }
  function _ltMselToggleFav(o,name){
    try{
      var s=_ltMselStore(),t=s[o.type];
      var i=t.favs.indexOf(name);
      if(i>=0)t.favs.splice(i,1);else t.favs.push(name);
      _ltMselSaveStore(s);
    }catch(e){}
    var sc=o.list.scrollTop;
    _ltMselRender(o);
    o.list.scrollTop=sc;
  }
  function _ltMselPlace(o,r){
    /* 底边对齐原生底边（top-start 展开，上方有余量），向上生长出搜索栏；不够就 clamp 视口顶 8px。
       高度显式钉死=原生高度+搜索栏：搜索结果再少面板也不缩，原生列表不会从下面露出来（实测教训） */
    var total=r.height+46,top=r.bottom-total;
    if(top<8)top=8;
    o.root.style.top=top+"px";
    o.root.style.height=(r.bottom-top)+"px";
    o.root.style.maxHeight=(r.bottom-top)+"px";
  }
  function _ltMselChrome(o,dd){
    /* 复制原生抽层的 computed chrome（背景/边框/圆角/模糊/阴影/文字色），视觉与原生一致且随站点主题走；
       读取失败退回 CSS 里的玻璃样式兜底。注：行内文字用的白色系透明度在浅色主题下对比度偏弱，
       当前画布主题恒为深色系（18 套主题全是深色面板），接受此限制 */
    try{
      var cs=getComputedStyle(dd),s=o.root.style;
      if(cs.backgroundColor&&cs.backgroundColor!=="rgba(0, 0, 0, 0)")s.background=cs.backgroundColor;
      if(cs.backdropFilter&&cs.backdropFilter!=="none")s.backdropFilter=cs.backdropFilter;
      if(cs.borderRadius&&cs.borderRadius!=="0px")s.borderRadius=cs.borderRadius;
      if(parseFloat(cs.borderBottomWidth)>0){s.borderColor=cs.borderBottomColor;s.borderWidth=cs.borderBottomWidth;s.borderStyle="solid";}
      if(cs.boxShadow&&cs.boxShadow!=="none")s.boxShadow=cs.boxShadow;
      if(cs.color)s.color=cs.color;
    }catch(e){}
  }
  function _ltMselSecs(o,st,rows){
    /* 默认视图分区：★ 收藏 / 最近使用 / 厂商分组（收藏与最近是置顶镜像，组内仍在原位） */
    var byName={},used=[];
    for(var b=0;b<rows.length;b++)byName[rows[b].name]=rows[b];
    function pickRows(names,exclude){
      var a=[];
      for(var k=0;k<names.length;k++){var r=byName[names[k]];if(r&&exclude.indexOf(names[k])<0){a.push(r);exclude.push(names[k]);}}
      return a;
    }
    var favRows=pickRows(st.favs,used),recRows=pickRows(st.recent,used),groups=_ltMselGroups(rows),secs=[];
    if(favRows.length)secs.push({label:"★ 收藏",items:favRows});
    if(recRows.length)secs.push({label:"最近使用",items:recRows});
    for(var gi=0;gi<groups.length;gi++){
      var it0=groups[gi].items[0]||{},label=groups[gi].label;
      /* 多数派首词读不通的品牌（GPT/Nano）用品牌全称做组名 */
      if(it0.brand&&_ltMselBrandLabel[it0.brand])label=_ltMselBrandLabel[it0.brand];
      secs.push({label:label,items:groups[gi].items});
    }
    return secs;
  }
  function _ltMselRailRender(o,secs){
    /* 左侧索引栏（Motif 同款）：每分区一枚小图标（厂商彩色 logo/字母徽标，无图标落首字）；
       搜索视图仍显示（镜像默认分区序），点击 = 退出搜索并滚到分区 */
    var html="";
    for(var i=0;i<secs.length;i++){
      var lb=secs[i].label;
      /* 收藏/最近两个镜像区用字形徽标，不用首行厂商图标 */
      var inner=lb==="★ 收藏"
        ?'<span class="lt-msel-fb" style="background:#B45309">★</span>'
        :lb==="最近使用"
          ?'<span class="lt-msel-fb" style="background:#4b5563">↺</span>'
          :_ltMselIconHTML(secs[i].icon||"",lb);
      html+='<button type="button" class="lt-msel-rb" data-sec="'+i+'" title="'+_ltEsc(lb)+'" aria-label="'+_ltEsc(lb)+'">'+inner+'</button>';
    }
    o.rail.innerHTML=html;
  }
  function _ltMselSpy(o){
    /* scroll-spy：视口顶压着哪个分区头就亮哪个；滚到底强判最后分区（Motif 同款规则） */
    var els=o.secEls,rbs=o.rail.querySelectorAll(".lt-msel-rb");
    if(!els.length){for(var j=0;j<rbs.length;j++)rbs[j].classList.remove("on");return;}
    var st=o.list.scrollTop,cur=0;
    /* 容差 10px：rail 点击落点是 offsetTop-6，阈值小了会差 2px 漏判当前区 */
    for(var i=0;i<els.length;i++){if(els[i].offsetTop<=st+10)cur=i;}
    if(st+o.list.clientHeight>=o.list.scrollHeight-4)cur=els.length-1;
    for(var k=0;k<rbs.length;k++)rbs[k].classList.toggle("on",parseInt(rbs[k].getAttribute("data-sec"),10)===cur);
  }
  function _ltMselFollow(o,dd,prev,frames){
    /* 逐帧跟随直到位置连续两帧一致（Mantine 定稿位置晚于我们的 MO 回调：
       实测首开时下拉还在 (0,0)，一次性 rAF 校正赶不上它的 useEffect 定位） */
    if(!dd.isConnected)return;
    if(frames>120)return;
    var r=dd.getBoundingClientRect();
    if(!r.width||!r.height){requestAnimationFrame(function(){_ltMselFollow(o,dd,prev,frames+1);});return;}
    o.root.style.left=r.left+"px";
    o.root.style.width=Math.max(r.width,380)+"px";
    _ltMselPlace(o,r);
    var key=Math.round(r.left)+","+Math.round(r.top)+","+Math.round(r.width)+","+Math.round(r.height);
    if(prev===key)return;
    requestAnimationFrame(function(){_ltMselFollow(o,dd,key,frames+1);});
  }
  function _ltMselWatchRows(o,dd){
    /* 行数变化兜底：行数变了才重解析重渲染。本次 34/38 的缺口实为 span 引导壳所致
       （已在解析层修掉），此 observer 防御站点未来真做懒加载；用户搜索中不打断
       （等下一次输入自然带上新行），卸载清扫时统一断开 */
    o.rowsObs=new MutationObserver(function(){
      if(!dd.isConnected)return;
      var n=dd.querySelectorAll("button[data-selected]").length;
      if(n===o.parsed.rows.length)return;
      var p2=_ltMselParse(dd);
      /* 只在行数增长时重建（收缩多为站点重渲染瞬时态，重建会让列表变短甚至看似消失）；
         重建前后保持滚动位置，避免用户正在看的位置被拽走 */
      if(p2&&p2.rows.length>o.parsed.rows.length){
        var sc=o.list.scrollTop;
        o.parsed=p2;if(p2.type)o.type=p2.type;
        if(!o.input.value){_ltMselRender(o);o.list.scrollTop=Math.min(sc,Math.max(o.list.scrollHeight-o.list.clientHeight,0));}
      }
    });
    o.rowsObs.observe(dd,{childList:true,subtree:true});
  }
  function _ltMselTrigger(dd){
    /* 触发器定位：dd 的 data-guide-parameter-owner 即节点面板 testid（v-zfTWkKAHpo ↔ rf__node-v-zfTWkKAHpo，
       视频/图片两表实测一致），面板内唯一带 data-quick-guide-anchor="generator-model-select" 的按钮就是触发器 */
    try{
      var owner=dd.getAttribute("data-guide-parameter-owner");
      if(owner){
        var t=document.querySelector('[data-testid="rf__node-'+owner+'"] [data-quick-guide-anchor="generator-model-select"]');
        if(t)return t;
      }
      return document.querySelector('[data-quick-guide-anchor="generator-model-select"]');
    }catch(e){return null;}
  }
  function _ltMselTakeover(dd,frames){
    if(!_ltMselOn())return;
    if(_ltMselOverlays.has(dd))return;
    var parsed=_ltMselParse(dd);
    if(!parsed)return;
    var r=dd.getBoundingClientRect();
    if(!r.width||!r.height){
      /* Mantine 可能还没定稿尺寸：rAF 内重试（有 isConnected 守卫+上限，卸载即停，
         否则 detached 节点 getBoundingClientRect 恒 0 会变成每帧空转）；位置滞后交给 _ltMselFollow */
      if(!dd.isConnected||(frames|0)>20)return;
      requestAnimationFrame(function(){_ltMselTakeover(dd,frames+1);});
      return;
    }
    var root=document.createElement("div");
    root.className="lt-msel";
    root.style.left=r.left+"px";
    root.style.width=Math.max(r.width,380)+"px";
    var input=document.createElement("input");
    input.className="lt-msel-inp";
    input.placeholder="搜索模型，支持缩写如 k4 / sd25";
    input.setAttribute("spellcheck","false");
    var cnt=document.createElement("span");cnt.className="lt-msel-cnt";
    var searchWrap=document.createElement("div");searchWrap.className="lt-msel-search";
    searchWrap.appendChild(input);searchWrap.appendChild(cnt);
    var list=document.createElement("div");list.className="lt-msel-list";
    var rail=document.createElement("div");rail.className="lt-msel-rail";
    var body=document.createElement("div");body.className="lt-msel-body";
    body.appendChild(rail);body.appendChild(list);
    root.appendChild(searchWrap);root.appendChild(body);
    var o={root:root,input:input,list:list,rail:rail,cnt:cnt,parsed:parsed,type:parsed.type,vis:[],act:-1,dd:dd,secEls:[]};
    document.body.appendChild(root);
    _ltMselChrome(o,dd);
    _ltMselOverlays.set(dd,o);
    /* 覆盖层内的指针/焦点事件由脚本加载期注册的 _ltMselGuard/_ltMselClickGuard
       在 document 捕获阶段统一吞掉与路由（真实鼠标点击会让站点各层外点关闭监听
       把下拉关掉，冒泡拦截来不及——详见 _ltMselOverlays 上方的守卫注释） */
    input.addEventListener("input",function(){_ltMselRender(o);});
    /* scroll-spy 用 rAF 合帧，滚动风暴不逐事件重排（M9 同款纪律） */
    var spyRAF=0;
    list.addEventListener("scroll",function(){
      if(spyRAF)return;
      spyRAF=requestAnimationFrame(function(){spyRAF=0;_ltMselSpy(o);});
    });
    input.addEventListener("keydown",function(e){
      if(e.key==="ArrowDown"||e.key==="ArrowUp"){
        e.preventDefault();
        var n=o.vis.length;if(!n)return;
        o.act=(o.act+(e.key==="ArrowDown"?1:-1)+n)%n;
        _ltMselMark(o);
      }else if(e.key==="Enter"){
        e.preventDefault();
        var it=o.vis[o.act>=0?o.act:0];
        if(it)_ltMselPick(o,it);
      }
      /* Escape 由 o.docKey 在 document 层统一转发，这里不处理 */
    });
    _ltMselRender(o);
    input.focus();
    _ltMselPlace(o,r);
    var cur=o.list.querySelector(".lt-msel-item.cur");
    if(cur)o.list.scrollTop=Math.max(cur.offsetTop-6,0);
    /* 逐帧跟随至 Mantine 定稿位置（见 _ltMselFollow 注释）；首帧先按当前 rect 落位避免闪到 (0,0) */
    _ltMselFollow(o,dd,undefined,0);
    _ltMselWatchRows(o,dd);
    /* Escape 转发（覆盖层存活期间挂、卸载清扫时摘）：站点 Mantine 忽略输入框源的 Escape
       （实测 target=INPUT/BODY/合成派发都不关），Step 0 的 Esc 关下拉实为面板层处理。
       统一转成触发器点击走站点自己的 toggle 语义——顺带比原生优雅：只关下拉，不连带关整个生成面板 */
    o.docKey=function(e){
      if(e.key!=="Escape")return;
      var trig=_ltMselTrigger(dd);
      if(trig)trig.click();
      else if(o.input===document.activeElement)o.input.blur();
    };
    document.addEventListener("keydown",o.docKey);
  }
  /* 专属观察者：挂载快筛 data-model-select-dropdown（回调零布局读取，命中才接管）；
     卸载清扫顺带跑（Map ≤2 项，isConnected 检查便宜）。下拉是罕见事件，大子树插入时
     每个 addedNode 一次 querySelector 兜底，实测量级远低于 _ltTagObs 的全文档扫描 */
  var _ltMselObs=new MutationObserver(function(muts){
    for(var i=0;i<muts.length;i++){
      var add=muts[i].addedNodes;
      for(var j=0;j<add.length;j++){
        var n=add[j];
        if(n.nodeType!==1)continue;
        var dd=n.hasAttribute&&n.hasAttribute("data-model-select-dropdown")?n:(n.querySelector?n.querySelector("[data-model-select-dropdown]"):null);
        if(dd)_ltMselTakeover(dd); /* 同步接管：MutationObserver 回调在 paint 前，原生列表零闪烁 */
      }
    }
    _ltMselOverlays.forEach(function(o,dd2){
      if(!dd2.isConnected){
        if(o.rowsObs)o.rowsObs.disconnect();
        if(o.docKey)document.removeEventListener("keydown",o.docKey);
        o.root.remove();_ltMselOverlays.delete(dd2);
      }
    });
  });
  _ltMselObs.observe(document.body,{childList:true,subtree:true});
})();