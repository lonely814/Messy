// ==UserScript==
// @name         MultiMirror Download (HuggingFace + ComfyUI)
// @name:zh-CN   多镜像下载 (HuggingFace + ComfyUI)
// @namespace    https://huggingface.co/
// @version      1.0.2
// @icon         https://raw.githubusercontent.com/lonely814/Messy/main/comfyui/icon.png
// @description  Add hf-mirror (yellow) and ModelScope (purple) download buttons to Hugging Face file pages and the ComfyUI missing-model panel, plus a folder-open shortcut.
// @description:zh-CN  在 Hugging Face 文件页与 ComfyUI 缺模型面板，为每个下载入口增加 hf-mirror（黄）与 ModelScope（紫）镜像按钮，并提供打开模型目录的快捷键。
// @match        https://huggingface.co/*
// @match        http://127.0.0.1:8188/*
// @match        http://localhost:8188/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @author       oocc00
// @connect      modelscope.cn
// @connect      hf-mirror.com
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  const HF_MIRROR_HOST = 'https://hf-mirror.com';
  const MODELSCOPE_HOST = 'https://modelscope.cn/models';

  // 模型根目录（绝对路径）。填了你本机 ComfyUI 的 models 目录后，
  // “打开目录”按钮会尝试用 file:// 打开对应子文件夹，并把绝对路径复制到剪贴板。
  // 例：Windows   -> C:\\Users\\你的用户名\\ComfyUI\\models
  //     macOS/Linux -> /home/你的用户名/ComfyUI/models
  // 留空则只复制相对路径 models/<类型>/<文件名>（浏览器无法直接打开本地文件夹）。
  const COMFY_MODELS_ROOT = '';

  const checkedModelScopeUrls = new Map();

  // ---- 共享：URL 转换 ----
  // HF:       /namespace/repo/resolve/branch/file
  // ModelScope:/models/namespace/repo/resolve/branch/file

  function normalizeHfPath(hfUrl) {
    try {
      const u = new URL(hfUrl, location.href);

      if (u.hostname !== 'huggingface.co') return null;

      const path = u.pathname.replace('/blob/', '/resolve/');
      if (!path.includes('/resolve/')) return null;

      return { u, path };
    } catch {
      return null;
    }
  }

  function toHfMirrorUrl(hfUrl) {
    const parsed = normalizeHfPath(hfUrl);
    if (!parsed) return null;

    const { u, path } = parsed;
    const mirror = new URL(HF_MIRROR_HOST + path);

    u.searchParams.forEach((value, key) => {
      mirror.searchParams.set(key, value);
    });

    mirror.searchParams.set('download', 'true');

    return mirror.toString();
  }

  function toModelScopeUrl(hfUrl) {
    const parsed = normalizeHfPath(hfUrl);
    if (!parsed) return null;

    const { u, path } = parsed;
    const parts = path.split('/').filter(Boolean);

    if (parts.length < 5) return null;
    if (parts[2] !== 'resolve') return null;

    const modelScopePath = '/' + parts.join('/');
    const mirror = new URL(MODELSCOPE_HOST + modelScopePath);

    u.searchParams.forEach((value, key) => {
      mirror.searchParams.set(key, value);
    });

    mirror.searchParams.set('download', 'true');

    return mirror.toString();
  }

  // ---- 共享：图标与探测 ----

  function createDownloadIcon(options) {
    // 有 url 的做成真实 <a href target="_blank" rel="noreferrer" noopener">：
    //   - 新标签页触发下载（hf-mirror 需无 referer 才返回附件，否则给 HTML 导致页面跳转）
    //   - 是真实链接，可右键 → “Download with IDM” 用 IDM 下载
    // 说明：IDM 不会自动捕获 target="_blank" 新标签页下载，故左键走浏览器下载，
    //       如需走 IDM 请右键选择 “Download with IDM”。
    // 只有 onClick（如 📂 打开目录）的做成 <div>。
    const isLink = !!options.url;
    const icon = document.createElement(isLink ? 'a' : 'div');

    icon.className = `${options.className} ml-2 flex h-5 w-5 items-center justify-center rounded-sm border`;
    icon.title = options.title;

    if (isLink) {
      icon.href = options.url;
      icon.target = '_blank';
      icon.rel = 'noreferrer noopener';
    }

    icon.style.backgroundColor = options.color;
    icon.style.borderColor = options.color;
    icon.style.color = options.textColor || '#ffffff';
    icon.style.flexShrink = '0';
    icon.style.cursor = 'pointer';
    icon.style.textDecoration = 'none';

    const label = options.label || '↗';
    icon.innerHTML = `<span style="font-size:11px;font-weight:700;line-height:1;">${label}</span>`;

    if (!isLink && options.onClick) {
      icon.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        options.onClick();
      }, true);
    }

    return icon;
  }

  function urlExists(url) {
    if (checkedModelScopeUrls.has(url)) {
      return Promise.resolve(checkedModelScopeUrls.get(url));
    }

    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: 'HEAD',
        url,
        timeout: 8000,
        onload: function (res) {
          const ok = res.status >= 200 && res.status < 400;
          checkedModelScopeUrls.set(url, ok);
          resolve(ok);
        },
        onerror: function () {
          checkedModelScopeUrls.set(url, false);
          resolve(false);
        },
        ontimeout: function () {
          checkedModelScopeUrls.set(url, false);
          resolve(false);
        }
      });
    });
  }

  // =====================================================================
  // 模块 A：Hugging Face 文件页
  // =====================================================================

  function isFileDownloadLink(a) {
    if (!a || a.tagName !== 'A') return false;
    if (!a.href.includes('/resolve/')) return false;

    const text = (a.textContent || '').replace(/\s+/g, ' ').trim();
    return /\b\d+(\.\d+)?\s*(B|kB|KB|MB|GB|TB)\b/i.test(text);
  }

  function findOfficialDownloadIcon(a) {
    const divs = Array.from(a.querySelectorAll('div'));

    const candidates = divs.filter((div) => {
      const text = (div.textContent || '').trim();
      if (text) return false;
      if (!div.querySelector('svg')) return false;
      const cls = div.className || '';
      return String(cls).includes('h-5') && String(cls).includes('w-5');
    });

    return candidates[candidates.length - 1] || null;
  }

  function addHfMirrorIcon(a, officialIcon, hfMirrorUrl) {
    if (!hfMirrorUrl) return;
    if (a.dataset.hfMirrorAdded === '1') return;

    const hfMirrorIcon = createDownloadIcon({
      className: 'hf-mirror-icon',
      title: 'hf-mirror 镜像下载',
      color: '#f5b301',
      textColor: '#1f2937',
      label: 'HF',
      url: hfMirrorUrl
    });

    officialIcon.insertAdjacentElement('afterend', hfMirrorIcon);
    a.dataset.hfMirrorAdded = '1';
  }

  async function addModelScopeIconIfExists(a, officialIcon, modelScopeUrl) {
    if (!modelScopeUrl) return;

    const exists = await urlExists(modelScopeUrl);
    if (!exists) return;

    if (a.dataset.modelScopeMirrorAdded === '1') return;
    a.dataset.modelScopeMirrorAdded = '1';

    const modelScopeIcon = createDownloadIcon({
      className: 'modelscope-mirror-icon',
      title: 'ModelScope 镜像下载',
      color: '#7c3aed',
      label: 'MS',
      url: modelScopeUrl
    });

    officialIcon.insertAdjacentElement('afterend', modelScopeIcon);
  }

  function patchHuggingFace() {
    const links = Array.from(document.querySelectorAll('a[href*="/resolve/"]'))
      .filter(isFileDownloadLink);

    links.forEach((a) => {
      if (a.dataset.hfMirrorProcessing === '1') return;

      const hfMirrorUrl = toHfMirrorUrl(a.href);
      const modelScopeUrl = toModelScopeUrl(a.href);

      if (!hfMirrorUrl && !modelScopeUrl) return;

      const officialIcon = findOfficialDownloadIcon(a);
      if (!officialIcon) return;

      a.dataset.hfMirrorProcessing = '1';

      addHfMirrorIcon(a, officialIcon, hfMirrorUrl);
      addModelScopeIconIfExists(a, officialIcon, modelScopeUrl);
    });
  }

  // =====================================================================
  // 模块 B：ComfyUI 缺模型面板
  // 缺模型面板(右侧 Errors)的下载按钮所在子树里没有模型 URL；
  // URL 实际在画布上那个 markdown 节点(hf 链接列表)里，二者是独立子树。
  // 关联方式：面板每行显示模型文件名 = 画布节点里 hf 链接末端的文件名。
  // 用「文件名精确元素匹配 + 一对一去重」配对，避免爬到共享祖先拿错。
  // =====================================================================

  function buildAnchorMap() {
    const map = new Map(); // 文件名(解码) -> hf url
    document.querySelectorAll('a[href*="huggingface.co"]').forEach((a) => {
      let u;
      try { u = new URL(a.href); } catch { return; }
      const seg = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
      if (seg) map.set(seg, a.href);
    });
    return map;
  }

  function candidateNames(btn, anchorMap) {
    let node = btn;
    let text = '';
    for (let i = 0; i < 5 && node; i++) {
      text += ' ' + (node.textContent || '');
      node = node.parentElement;
    }
    const hits = [];
    for (const name of anchorMap.keys()) {
      if (text.includes(name)) hits.push(name);
    }
    return hits;
  }

  function resolveUrl(btn, anchorMap, assigned) {
    // 精确：行内只含一个候选文件名的元素即模型名
    let node = btn;
    for (let i = 0; i < 5 && node; i++) {
      const els = node.querySelectorAll('*');
      for (const el of els) {
        const t = (el.textContent || '').trim();
        const matched = [];
        for (const name of anchorMap.keys()) {
          if (t.includes(name)) matched.push(name);
        }
        if (matched.length === 1 && !assigned.has(matched[0])) {
          return anchorMap.get(matched[0]);
        }
      }
      node = node.parentElement;
    }
    // 兜底：取尚未被分配的候选
    const cands = candidateNames(btn, anchorMap).filter((n) => !assigned.has(n));
    return cands.length ? anchorMap.get(cands[0]) : null;
  }

  async function addComfyModelScopeIcon(btn, modelScopeUrl) {
    const exists = await urlExists(modelScopeUrl);
    if (!exists) return;

    const modelScopeIcon = createDownloadIcon({
      className: 'comfy-modelscope-mirror',
      title: 'ModelScope 镜像下载',
      color: '#7c3aed',
      label: 'MS',
      url: modelScopeUrl
    });

    btn.insertAdjacentElement('afterend', modelScopeIcon);
  }

  // 已知 ComfyUI 模型子目录类型（长名在前，避免 clip 误匹配 clip_vision 等）
  const DIR_TYPES = [
    'diffusion_models', 'text_encoders', 'controlnet', 'clip_vision',
    'upscale_models', 'vae_approx', 'style_models', 'audio_encoders',
    'photomaker', 'hypernetworks', 'embeddings', 'diffusers',
    'model_patches', 'recognizers', 'checkpoints', 'loras', 'clip',
    'vae', 'unet', 'gligen'
  ];

  function extractDirectory(btn) {
    let node = btn;
    let text = '';
    for (let i = 0; i < 5 && node; i++) {
      text += ' ' + (node.textContent || '');
      node = node.parentElement;
    }
    for (const d of DIR_TYPES) {
      if (new RegExp('\\b' + d + '\\b', 'i').test(text)) return d;
    }
    return null;
  }

  function openModelFolder(directory, filename) {
    const dir = directory || 'models';
    const relFolder = 'models/' + dir;
    const relFile = relFolder + '/' + filename;

    if (COMFY_MODELS_ROOT) {
      const root = COMFY_MODELS_ROOT.replace(/\\/g, '/').replace(/\/+$/, '');
      const absFolder = root + '/' + dir;
      try { window.open('file:///' + absFolder); } catch (e) { /* 浏览器可能拦截 */ }
      GM_setClipboard(absFolder);
      console.log('[多镜像下载] 已尝试打开并复制绝对路径: ' + absFolder);
    } else {
      GM_setClipboard(relFile);
      console.log('[多镜像下载] 未配置 COMFY_MODELS_ROOT，已复制相对路径: ' + relFile);
    }
  }

  function addComfyOpenFolderIcon(btn, directory, filename) {
    const icon = createDownloadIcon({
      className: 'comfy-open-folder',
      title: '打开模型目录 / 复制目标路径\nmodels/' + (directory || 'models') + '/' + filename,
      color: '#16a34a',
      label: '📂',
      url: '',
      onClick: () => openModelFolder(directory, filename)
    });
    // 放到整行最右侧，与下载按钮（HF / MS）视觉上分开
    btn.parentElement.appendChild(icon);
  }

  function patchComfyUI() {
    const anchorMap = buildAnchorMap();
    if (anchorMap.size === 0) return; // 画布节点尚未渲染，等下次

    const buttons = document.querySelectorAll('[data-testid="missing-model-download"]');
    const assigned = new Set();

    buttons.forEach((btn) => {
      if (btn.parentElement.querySelector(':scope > .comfy-hf-mirror')) return;

      const url = resolveUrl(btn, anchorMap, assigned);
      if (!url || !url.includes('huggingface.co')) return;
      const filename = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop());
      assigned.add(filename);

      const directory = extractDirectory(btn);

      const hfUrl = toHfMirrorUrl(url);
      const msUrl = toModelScopeUrl(url);
      if (!hfUrl) return;

      const hfIcon = createDownloadIcon({
        className: 'comfy-hf-mirror',
        title: 'hf-mirror 镜像下载',
        color: '#f5b301',
        textColor: '#1f2937',
        label: 'HF',
        url: hfUrl
      });
      btn.insertAdjacentElement('afterend', hfIcon);

      if (msUrl) {
        addComfyModelScopeIcon(btn, msUrl);
      }

      // 📂 打开目录 / 复制目标路径（放到整行最右侧，与下载按钮分开）
      addComfyOpenFolderIcon(btn, directory, filename);
    });
  }

  // =====================================================================
  // 分发
  // =====================================================================

  function start(patchFn) {
    patchFn();

    const observer = new MutationObserver(() => {
      patchFn();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (location.hostname === 'huggingface.co') {
    start(patchHuggingFace);
  } else {
    start(patchComfyUI);
  }
})();
