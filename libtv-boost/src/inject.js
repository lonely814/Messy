(function(){
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
  function _ltInvalidateGraph(){_ltGraphCache=null;}
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
    document.querySelectorAll(".react-flow__edge").forEach(function(ed){
      var lb=ed.getAttribute("aria-label")||"",m=lb.match(/^Edge from (\S+) to (\S+)$/);
      if(m&&(m[1]===id||m[2]===id)) ed.classList.add("libtv-edge-active");
    });
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
    document.getElementById("lt-search-results").addEventListener("click",function(e){
      var item=e.target.closest("[data-id]");
      if(!item)return;
      var id=item.getAttribute("data-id");
      var el=document.querySelector('.react-flow__node[data-id="'+id+'"],.react-flow__node#'+id);
      if(el){
        el.scrollIntoView({behavior:"smooth",block:"center"});
        el.click();
      }
      div.remove();
    });
    document.getElementById("lt-search-input").focus();
  }
  var _ltPrompts=JSON.parse(localStorage.getItem("_lt_prompts")||"[]");
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
  var _ltPromptAPI=JSON.parse(localStorage.getItem("_lt_prompt_api")||"{\"url\":\"https://api.deepseek.com/chat/completions\",\"model\":\"deepseek-v4-flash\"}");
  if(!_ltPromptAPI.url){_ltPromptAPI.url="https://api.deepseek.com/chat/completions";_ltPromptAPI.model=_ltPromptAPI.model||"deepseek-v4-flash";}
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
  var _ltTheme=JSON.parse(localStorage.getItem("_lt_theme")||"null")||_ltThemePresets[0];
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
            h+='<div class="ltp-item" data-id="'+p.id+'">'
              +'<div class="ltp-item-top">'
              +'<div class="ltp-item-info">'
              +'<span class="ltp-name">'+_ltEsc(p.name)+'</span>'
              +'<span class="ltp-cat-badge">'+_ltEsc(p.category)+'</span>'
              +'</div>'
              +'<div class="ltp-actions">'
              +'<button class="ltp-btn ltp-btn-primary ltp-btn-sm" data-action="copy" title="复制到剪贴板" data-id="'+p.id+'">复制</button>'
              +'<button class="ltp-btn ltp-btn-ghost ltp-btn-sm" data-action="view" title="查看完整内容" data-id="'+p.id+'">查看</button>'
              +'<button class="ltp-btn ltp-btn-ghost ltp-btn-sm" data-action="edit" data-id="'+p.id+'">编辑</button>'
              +'<button class="ltp-btn ltp-btn-danger ltp-btn-sm" data-action="del" data-id="'+p.id+'">×</button>'
              +'</div>'
              +'</div>'
              +'<div class="ltp-preview" data-id="'+p.id+'">'+_ltEsc(p.content.slice(0,120))+'</div>'
              +'</div>';
          });
        }
        body.innerHTML=h;
        body.querySelectorAll(".ltp-cat-btn").forEach(function(b){b.onclick=function(){_ltPCat=this.getAttribute("data-cat")||"";renderBody();};});
        body.querySelectorAll(".ltp-item .ltp-preview,.ltp-item .ltp-item-top").forEach(function(b){b.onclick=function(e){if(e.target.closest(".ltp-actions"))return;var id=this.closest(".ltp-item").getAttribute("data-id");var btn=body.querySelector("[data-action=copy][data-id='"+id+"']");if(btn)btn.click();};});
        body.querySelectorAll("[data-action=copy]").forEach(function(b){b.onclick=function(){var id=b.getAttribute("data-id"),p=_ltPrompts.find(function(x){return x.id===id;});if(!p)return;var m,pairs=[],re=/\{(\w+)(?:=([^}]*))?\}/g;while((m=re.exec(p.content))!==null)pairs.push({n:m[1],d:m[2]||""});if(!pairs.length){navigator.clipboard.writeText(p.content).then(function(){b.textContent="✅";setTimeout(function(){b.textContent="复制";},1200);});return;}var overlay=document.createElement("div");overlay.className="ltp-var-overlay";var html='<div class="ltp-var-title">'+_ltEsc(p.name)+'</div><div class="ltp-var-sub">填写变量后点击确认，替换结果将复制到剪贴板</div>';pairs.forEach(function(v){html+='<div class="ltp-var-row"><label>'+v.n+'</label><input class="ltp-var-inp" data-var="'+v.n+'" value="'+_ltEsc(v.d)+'"></div>';});html+='<div class="ltp-var-preview" id="ltp-var-ovprev">'+_ltEsc(p.content)+'</div><div class="ltp-var-actions"><button class="ltp-btn ltp-btn-ghost" id="ltp-var-cancel">取消</button><button class="ltp-btn ltp-btn-primary" id="ltp-var-ok">填充并复制</button></div></div>';overlay.innerHTML=html;_ltBodyOrigMinH=body.style.minHeight||"";body.style.minHeight="320px";body.appendChild(overlay);function _clean(){if(overlay.parentNode)overlay.parentNode.removeChild(overlay);body.style.minHeight=_ltBodyOrigMinH;}function _upd(){var r=p.content;overlay.querySelectorAll(".ltp-var-inp").forEach(function(i){r=r.replace(new RegExp("\\{"+i.getAttribute("data-var")+"(?:=[^}]*)?\\}","g"),i.value||i.getAttribute("data-var"));});overlay.querySelector("#ltp-var-ovprev").textContent=r;}overlay.querySelectorAll(".ltp-var-inp").forEach(function(i){i.addEventListener("input",_upd);});overlay.querySelector("#ltp-var-cancel").onclick=function(){_clean();};overlay.querySelector("#ltp-var-ok").onclick=function(){var r=p.content;overlay.querySelectorAll(".ltp-var-inp").forEach(function(i){r=r.replace(new RegExp("\\{"+i.getAttribute("data-var")+"(?:=[^}]*)?\\}","g"),i.value);});navigator.clipboard.writeText(r).then(function(){b.textContent="✅";setTimeout(function(){b.textContent="复制";},1200);_clean();}).catch(function(){_clean();});};};});
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
          +_ltAICustomPresetsGet().map(function(p){return '<span class="ltp-ai-task cp" data-task="'+p.id+'">'+_ltEsc(p.name)+'</span>';}).join("")
          +'</div>'
          +'<div class="ltp-ai-custom" id="ltp-ai-custom"><textarea id="ltp-ai-sys" class="ltp-ai-sys" placeholder="在此输入自定义 system prompt..." rows="2"></textarea>'
          +'<div style="display:flex;gap:4px;margin-top:6px;"><button class="ltp-ai-preset-btn" id="ltp-ai-save-preset">💾 另存为</button></div>'
          +'<div class="ltp-ai-preset-list" id="ltp-ai-preset-list"></div></div>'
          +'<div class="ltp-ai-actions"><button class="ltp-btn ltp-btn-primary" id="ltp-ai-go">🚀 执行</button><button class="ltp-btn ltp-btn-ghost" id="ltp-ai-fill">从输入框获取</button><button class="ltp-btn ltp-btn-ghost" id="ltp-ai-clear">清空</button></div>'
          +'<div id="ltp-ai-result" class="ltp-ai-result" style="display:none"></div>'
          +'<div class="ltp-status" id="ltp-ai-status">'+(api.url?"已配置 "+api.url:"未配置 API，请在⚙设置中配置")+'</div>';
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
          html+=_ltAICustomPresetsGet().map(function(p){return '<span class="ltp-ai-task cp'+(p.id===cur?" active":"")+'" data-task="'+p.id+'">'+_ltEsc(p.name)+'</span>';}).join("");
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
        document.getElementById("ltp-ai-clear").onclick=function(){_ltAIInp.value="";_ltAIInp.style.height="auto";document.getElementById("ltp-ai-result").style.display="none";};
        /* execute */
        var _ltDoAI=function(text,btn){
          var api=_ltPromptAPI;
          if(!api.url||!api.key){document.getElementById("ltp-ai-status").textContent="❌ 请先在⚙设置中配置 API";return;}
          var sysPrompt=_ltAICurTask==="custom"?_ltAICustomSys():(_ltAICurTask.indexOf("cp_")===0?function(){var pr=_ltAICustomPresetsGet();for(var _i=0;_i<pr.length;_i++){if(pr[_i].id===_ltAICurTask)return pr[_i].sys;}return "";}():(_ltAIPresets[_ltAICurTask]?_ltAIPresets[_ltAICurTask].sys:""));
          if((_ltAICurTask==="custom"||_ltAICurTask.indexOf("cp_")===0)&&!sysPrompt.trim()){document.getElementById("ltp-ai-status").textContent="❌ 请先填写 system prompt";return;}
          var statusEl=document.getElementById("ltp-ai-status");
          btn.textContent="处理中...";btn.disabled=true;
          fetch(api.url,{
            method:"POST",
            headers:{"Content-Type":"application/json","Authorization":"Bearer "+api.key},
            body:JSON.stringify({model:api.model||"deepseek-v4-flash",messages:[{role:"system",content:sysPrompt},{role:"user",content:text}],max_tokens:1000})
          }).then(function(r){if(!r.ok)return r.text().then(function(t){throw new Error("HTTP "+r.status+(t?" "+t.slice(0,120):""));});return r.json();}).then(function(d){
            var result=d.choices&&d.choices[0]&&d.choices[0].message?d.choices[0].message.content:JSON.stringify(d);
            var resEl=document.getElementById("ltp-ai-result");
            resEl.style.display="block";
            resEl.innerHTML='<div class="ai-sec"><div class="ai-label">原文</div><div class="ai-text ai-orig">'+_ltEsc(text.slice(0,300))+(text.length>300?"...":"")+'</div></div><div class="ai-sep"></div><div class="ai-sec"><div class="ai-label">增强结果</div><div class="ai-text" id="ltp-ai-res-text">'+_ltEsc(result)+'</div></div><div class="ai-res-actions"><button class="ltp-btn ltp-btn-primary ltp-btn-sm" id="ltp-ai-write">写回源输入框</button><button class="ltp-btn ltp-btn-ghost ltp-btn-sm" id="ltp-ai-copy">复制</button></div>';
            statusEl.textContent="✅ 完成";
            btn.textContent="🚀 执行";btn.disabled=false;
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
            statusEl.textContent="❌ 请求失败: "+err.message;
            btn.textContent="🚀 执行";btn.disabled=false;
          });
        };
        document.getElementById("ltp-ai-go").onclick=function(){
          var text=_ltAIInp.value.trim();
          if(!text)return;
          _ltDoAI(text,this);
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
              html+='<button class="ltp-theme-preset" data-idx="'+idx+'" style="width:76px;height:50px;border-radius:8px;border:'+sel+';cursor:pointer;padding:0;overflow:hidden;position:relative;transition:all .12s;background:'+t.nb+';display:flex;flex-direction:column;">'
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
        var _recent=JSON.parse(localStorage.getItem("_lt_pal_recent")||"[]");
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
          var _fav=JSON.parse(localStorage.getItem("_lt_pal_fav")||"[]");
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
    div.addEventListener("mousemove",function(e){
      var items=div.querySelectorAll(".ltp-item");
      items.forEach(function(it){
        var r=it.getBoundingClientRect();
        it.style.setProperty("--mx",(e.clientX-r.left)+"px");
        it.style.setProperty("--my",(e.clientY-r.top)+"px");
      });
    });
    function _ltGetCookies(){return document.cookie;}
    function _ltSetCookies(s){if(!s)return;s.split("; ").forEach(function(p){var i=p.indexOf("=");if(i<1)return;document.cookie=p.slice(0,i)+"="+p.slice(i+1)+"; path=/";});}
    function _ltSaveLS(){var o={};for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k.indexOf("_lt_")!==0)o[k]=localStorage.getItem(k);}return o;}
    function _ltRestoreLS(o){if(!o)return;for(var k in o){if(o.hasOwnProperty(k)&&k.indexOf("_lt_")!==0){try{localStorage.setItem(k,o[k]);}catch(e){}}}}
    function _ltAccBackup(){try{var d=localStorage.getItem("_lt_accounts");if(d){document.cookie="_lt_acc_bak="+encodeURIComponent(d)+"; path=/; max-age="+(86400*60)+"; SameSite=Lax";}}catch(e){}}
    function _ltAccTryRestore(){try{if(localStorage.getItem("_lt_accounts"))return;var m=document.cookie.match(/(?:^|;\s*)_lt_acc_bak=([^;]*)/);if(m){var d=decodeURIComponent(m[1]);if(d){localStorage.setItem("_lt_accounts",d);}}}catch(e){}}
    function _ltAccList(){_ltAccTryRestore();try{return JSON.parse(localStorage.getItem("_lt_accounts")||"[]");}catch(e){return [];}}
    function _ltAccSave(name){var a=_ltAccList();a.push({id:Date.now().toString(36),name:name,cookies:_ltGetCookies(),ls:_ltSaveLS(),created:Date.now()});try{localStorage.setItem("_lt_accounts",JSON.stringify(a));_ltAccBackup();}catch(e){}}
    function _ltAccRefresh(id){var a=_ltAccList();for(var i=0;i<a.length;i++){if(a[i].id===id){a[i].cookies=_ltGetCookies();a[i].ls=_ltSaveLS();a[i].created=Date.now();try{localStorage.setItem("_lt_accounts",JSON.stringify(a));_ltAccBackup();}catch(e){}break;}}_ltAccPanel();}
    function _ltAccSwitch(id){var a=_ltAccList();for(var i=0;i<a.length;i++){if(a[i].id===id){_ltSetCookies(a[i].cookies);_ltRestoreLS(a[i].ls);location.reload();return;}}}
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
    window._ltPromptRefresh=function(){var d=document.getElementById("libtv-prompt");if(d){_ltPrompts=JSON.parse(localStorage.getItem("_lt_prompts")||"[]");renderBody();}};
  }
  var _ltTagLibs=JSON.parse(localStorage.getItem("_lt_tag_libs")||"null");
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
  var _ltRecentTags=JSON.parse(localStorage.getItem("_lt_recent")||"[]");
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
    function _ltTagScan(){
      var els=document.querySelectorAll("textarea,input[type=\"text\"],[contenteditable=\"true\"]");

      els.forEach(function(ta){
        if(ta.offsetParent===null)return;
        /* unified tag icon for all inputs; anchored to parent, shows/hides with input */
        var wr=ta.parentNode;
        if(wr&&!wr.querySelector(":scope > .lt-tag-icon")){
          if(ta.parentNode&&!ta.parentNode.querySelector(".lt-tag-icon")){
            var wr=ta.parentNode;
            if(getComputedStyle(wr).position==="static")wr.style.position="relative";
            var icon=document.createElement("div");
            icon.className="lt-tag-icon";
            icon.title="\u6807\u7b7e";
            icon.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>';
            icon.style.cssText="position:absolute;right:6px;bottom:6px;z-index:2147483646;width:24px;height:24px;pointer-events:auto;border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;";
            icon.onclick=function(e){e.stopPropagation();if(document.getElementById("lt-tag-menu"))_ltCloseTagMenu();else _ltShowTagMenu(ta);};
            wr.appendChild(icon);
          }
        }
      });
    }
    var _ltTagTimer=null;
    var _ltTagObs=new MutationObserver(function(){
      if(_ltTagTimer)clearTimeout(_ltTagTimer);
      _ltTagTimer=setTimeout(_ltTagScan,100);
    });
    _ltTagObs.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["style","class","hidden"]});
    _ltTagScan();
    setInterval(_ltTagScan,1500);
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
      else if(si===3){btn.innerHTML='<span style="display:flex;align-items:center;justify-content:center;height:100%"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg><span class="s3-label" style="opacity:0;transition:opacity .2s ease .1s;margin-left:4px;font-size:13px">提示词</span></span>';}
      else{btn.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';}
      btn.style.cssText="position:fixed;right:60px;bottom:70px;z-index:99998;display:flex;align-items:center;justify-content:center;cursor:grab;user-select:none;";
      if(si===2){btn.style.width="28px";btn.style.height="28px";}else{btn.style.width="36px";btn.style.height="36px";}
      if(si===4){btn.style.fontSize="16px";btn.style.fontWeight="600";btn.style.fontFamily="-apple-system,BlinkMacSystemFont,sans-serif";}
      btn.addEventListener("contextmenu",function(e){e.preventDefault();var cur=parseInt(localStorage.getItem("_lt_pbtn_style")||"0");var next=((cur%5)+1)%5;try{localStorage.setItem("_lt_pbtn_style",String(next));}catch(ex){}btn.remove();_createBtn();});
      document.body.appendChild(btn);
      btn.onmouseenter=function(){if(si!==0){btn.style.transform="scale(1.05)";}};
      btn.onmouseleave=function(){btn.style.transform="scale(1)";};
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
        +"<div class=\"item\"><kbd>N</kbd>\u6e05\u723d\u6a21\u5f0f</div>"
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
    var _obs=new MutationObserver(function(){
      if(document.querySelector(".react-flow")){_createBtn();_ltTryWelcome();}
      else{_removeBtn();}
    });
    _obs.observe(document.body,{childList:true,subtree:true});
    if(document.querySelector(".react-flow")){_createBtn();_ltTryWelcome();}
  })();
  var _ltStepTo=null;
  function _ltStepEdges(){
    document.querySelectorAll(".react-flow__edges path").forEach(function(p){
      var d=p.getAttribute("d")||"";
      if(d.indexOf("C")===-1)return;
      try{
        var len=p.getTotalLength();
        if(!len||isNaN(len))return;
        var s=p.getPointAtLength(0),e=p.getPointAtLength(len);
        p.setAttribute("d","M "+s.x+" "+s.y+" L "+e.x+" "+s.y+" L "+e.x+" "+e.y);
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
      _ltStepEdges();
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
      var _handled=false; var _tm=document.getElementById("lt-tag-menu"); if(_tm){_ltCloseTagMenu();_handled=true;}
      _ltClearChain();
      var _ss=document.getElementById("libtv-search"); if(_ss){_ss.remove();_handled=true;}
      var _pp=document.getElementById("libtv-prompt"); if(_pp){_pp.remove();_handled=true;}
      var _dd=document.getElementById("lt-debug"); if(_dd){_dd.remove();_handled=true;}
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
    if(e.key==="n"||e.key==="N"){
      e.preventDefault(); e.stopPropagation();
      document.body.classList.toggle("libtv-clean-home");
      try{localStorage.setItem("_lt_clean",document.body.classList.contains("libtv-clean-home")?"1":"0");}catch(ex){}
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
  function _ltToast(msg, dur){var e=document.getElementById("_ltToast");if(!e){e=document.createElement("div");e.id="_ltToast";Object.assign(e.style,{position:"fixed",bottom:"20px",left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,.8)",color:"#fff",padding:"8px 18px",borderRadius:"6px",zIndex:99999,fontSize:"14px",pointerEvents:"none",transition:"opacity .3s",opacity:"0"});document.body.appendChild(e)}e.textContent=msg;e.style.opacity="1";clearTimeout(e._t);e._t=setTimeout(function(){e.style.opacity="0"},dur||2000);}
  function _ltBuildContentPack(){
    var prompts=JSON.parse(localStorage.getItem("_lt_prompts")||"[]");
    var tagLibs=JSON.parse(localStorage.getItem("_lt_tag_libs")||"null")||{};
    var curLib=localStorage.getItem("_lt_cur_lib")||"默认标签";
    return {app:"libtv-boost",type:"content-pack",version:1,exportedAt:new Date().toISOString(),currentLib:curLib,prompts:prompts,tagLibs:tagLibs};
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
    box.innerHTML='<div style="font-size:15px;font-weight:600;margin-bottom:6px;">导入内容包</div>'
      +'<div style="font-size:12px;color:rgba(255,255,255,0.55);margin-bottom:14px;">检测到 '+pcount+' 条提示词 · '+tcount+' 个标签库</div>'
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
    try{
      if(mode==="replace"){
        if(Array.isArray(data.prompts))try{localStorage.setItem("_lt_prompts",JSON.stringify(data.prompts));}catch(e){}
        if(data.tagLibs&&typeof data.tagLibs==="object")try{localStorage.setItem("_lt_tag_libs",JSON.stringify(data.tagLibs));}catch(e){}
        if(data.currentLib)try{localStorage.setItem("_lt_cur_lib",data.currentLib);}catch(e){}
      }else{
        var prompts=JSON.parse(localStorage.getItem("_lt_prompts")||"[]");
        var seen={};prompts.forEach(function(p){seen[(p&&p.id)||("n"+Math.random())]=true;});
        (data.prompts||[]).forEach(function(p){if(p&&p.id&&!seen[p.id]){prompts.push(p);seen[p.id]=true;}});
        try{localStorage.setItem("_lt_prompts",JSON.stringify(prompts));}catch(e){}
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
        try{localStorage.setItem("_lt_tag_libs",JSON.stringify(tagLibs));}catch(e){}
      }
      if(window._ltPromptRefresh)window._ltPromptRefresh();
      if(window._ltTagRefresh)window._ltTagRefresh();
      _ltToast("✅ 内容包已导入（"+(mode==="replace"?"整体替换":"合并去重")+"）");
    }catch(e){_ltToast("导入失败："+e.message);}
  }
function _ltSettingsPanel(){
    var existing=document.getElementById("lt-settings");
    if(existing){existing.remove();return;}
    var div=document.createElement("div");div.id="lt-settings";div.className="lt-settings";
    var h="<div class=\"lt-settings-head\"><span>⚙ \u8bbe\u7f6e</span><span class=\"lt-settings-close\" id=\"lt-settings-close\">\u2715</span></div>"
      +"<div class=\"lt-settings-body\" id=\"lt-settings-body\">";
    /* \u5f00\u5173 */
    var toggles=[
      {k:"perf",l:"\u6027\u80fd\u6a21\u5f0f"},
      {k:"hide",l:"\u9690\u85cf\u56fe\u7247"},
      {k:"edges",l:"\u9690\u85cf\u8fde\u7ebf"},
      {k:"grid",l:"\u9690\u85cf\u7f51\u683c"},
      {k:"focus",l:"\u4e13\u6ce8\u6a21\u5f0f"},
    ];
    h+="<div class=\"lt-settings-sec\"><div class=\"lt-settings-stitle\">\u5f00\u5173</div>";
    toggles.forEach(function(t){
      var on=document.body.classList.contains("perf-mode")||localStorage.getItem("_lt_"+t.k)==="1";
      h+="<div class=\"lt-settings-toggle\" data-key=\""+t.k+"\"><span>"+t.l+"</span><span class=\"lt-settings-switch"+(on?" on":"")+"\"></span></div>";
    });
    h+="</div>";
    /* API */
    var api=JSON.parse(localStorage.getItem("_lt_prompt_api")||"{}");
    h+="<div class=\"lt-settings-sec\"><div class=\"lt-settings-stitle\">AI \u589e\u5f3a API</div>"
      +"<div class=\"lt-settings-row\"><label>API \u5730\u5740</label><input class=\"lt-settings-inp\" id=\"lt-set-url\" value=\""+_ltEsc(api.url||"")+"\" placeholder=\"https://api.deepseek.com/chat/completions\"></div>"
      +"<div class=\"lt-settings-row\"><label>API Key</label><input class=\"lt-settings-inp\" type=\"password\" id=\"lt-set-key\" value=\""+_ltEsc(api.key||"")+"\" placeholder=\"sk-...\"></div>"
      +"<div class=\"lt-settings-row\"><label>\u6a21\u578b</label><input class=\"lt-settings-inp\" id=\"lt-set-model\" value=\""+_ltEsc(api.model||"")+"\" placeholder=\"deepseek-v4-flash\"></div>"
      +"<div style=\"margin-top:8px;\"><button class=\"lt-settings-btn lt-settings-btn-primary\" id=\"lt-set-api-save\">\u4fdd\u5b58</button><span class=\"lt-settings-status\" id=\"lt-set-api-status\"></span></div>"
      +"</div>";
    /* \u6570\u636e */
    h+="<div class=\"lt-settings-sec\"><div class=\"lt-settings-stitle\">\u6570\u636e\u7ba1\u7406</div>"
      +"<div class=\"lt-settings-dlist\" id=\"lt-settings-dlist\"></div>"
      +"<button class=\"lt-settings-btn lt-settings-btn-ghost lt-settings-btn-sm\" id=\"lt-set-export-all\">\u5bfc\u51fa\u5168\u90e8\u914d\u7f6e</button>"
      +"<div class=\"lt-settings-cpbtns\">"
      +"<button class=\"lt-settings-btn lt-settings-btn-primary lt-settings-btn-sm\" id=\"lt-set-cp-export\">\u5bfc\u51fa\u5185\u5bb9\u5305</button>"
      +"<button class=\"lt-settings-btn lt-settings-btn-ghost lt-settings-btn-sm\" id=\"lt-set-cp-import\">\u5bfc\u5165\u5185\u5bb9\u5305</button>"
      +"</div>"
      +"</div>";
    /* \u5173\u4e8e */
    h+="<div class=\"lt-settings-sec\"><div class=\"lt-settings-stitle\">\u5173\u4e8e</div>"
      +"<div class=\"lt-settings-about\">LibTV Canvas Boost v1.9.11<br>\u6e90\u7801\u6a21\u5757\u5316\u6784\u5efa\uff0c\u63d0\u4f9b\u6027\u80fd\u4f18\u5316\u3001\u89c6\u89c9\u589e\u5f3a\u3001AI \u63d0\u793a\u8bcd\u3001\u6807\u7b7e\u7cfb\u7edf</div>"
      +"<div style=\"margin-top:12px;display:flex;gap:6px;\"><button class=\"lt-settings-btn lt-settings-btn-primary lt-settings-btn-sm\" id=\"lt-set-help\">\u5e2e\u52a9 / \u91cd\u65b0\u663e\u793a\u5f15\u5bfc</button></div>"
      +"</div>";
    h+="</div>";
    div.innerHTML=h;
    document.body.appendChild(div);
    /* \u5f00\u5173\u4e8b\u4ef6 */
    div.querySelectorAll(".lt-settings-toggle").forEach(function(el){
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
    /* API \u4fdd\u5b58 */
    document.getElementById("lt-set-api-save").onclick=function(){
      var d={url:document.getElementById("lt-set-url").value.trim(),key:document.getElementById("lt-set-key").value.trim(),model:document.getElementById("lt-set-model").value.trim()||"deepseek-v4-flash"};
      try{localStorage.setItem("_lt_prompt_api",JSON.stringify(d));}catch(e){}
      document.getElementById("lt-set-api-status").textContent="\u2705 \u5df2\u4fdd\u5b58";
    };
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
      data._version="1.8.3";
      data._exportedAt=new Date().toISOString();
      var blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
      var url=URL.createObjectURL(blob);
      var a=document.createElement("a");a.href=url;a.download="libtv-boost-config-"+new Date().toISOString().slice(0,10)+".json";a.click();
      setTimeout(function(){URL.revokeObjectURL(url);},1000);
    };
    document.getElementById("lt-set-cp-export").onclick=function(){ _ltDownloadContentPack(); };
    document.getElementById("lt-set-cp-import").onclick=function(){ _ltImportContentPackFromFile(); };
    /* \u5e2e\u52a9 */
    document.getElementById("lt-set-help").onclick=function(){div.remove();try{localStorage.removeItem("_lt_first_run");}catch(e){}setTimeout(function(){_ltShowWelcome();},300)};
    /* \u5173\u95ed */
    document.getElementById("lt-settings-close").onclick=function(){div.remove();};
  }
  window._ltOpenSettings=_ltSettingsPanel;
  window._ltContent={exportPack:_ltDownloadContentPack,importFile:_ltImportContentPackFromFile};
  window._ltShowTagMenu=_ltShowTagMenu;
})();