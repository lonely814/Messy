// ==UserScript==
// @name         ComfyUI 缺失模型镜像下载
// @namespace    https://comfy.org/
// @version      1.0.0
// @description  在 ComfyUI 缺模型面板（右侧 Errors / Missing Models）每个模型的下载按钮旁，增加 hf-mirror 蓝色按钮和 ModelScope 橙色按钮，从镜像站下载（ModelScope 更快）。
// @match        http://127.0.0.1:8188/*
// @match        http://localhost:8188/*
// @grant        GM_xmlhttpRequest
// @author       AYU
// @connect      hf-mirror.com
// @connect      modelscope.cn
// @run-at       document-idle
// @license MIT
// ==/UserScript==

(function () {
  'use strict';

  const HF_MIRROR_HOST = 'https://hf-mirror.com';
  const MODELSCOPE_HOST = 'https://modelscope.cn/models';

  const checkedModelScopeUrls = new Map();

  // ---- 与 HuggingFace 多镜像下载.user.js 保持一致的 URL 转换逻辑 ----

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

    // HF:       /namespace/repo/resolve/branch/file
    // ModelScope:/models/namespace/repo/resolve/branch/file
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

  // ---- 图标与探测 ----

  function createDownloadIcon(options) {
    const icon = document.createElement('div');

    icon.className = `${options.className} ml-1 flex h-6 w-6 items-center justify-center rounded-sm border`;
    icon.title = options.title;

    icon.style.backgroundColor = options.color;
    icon.style.borderColor = options.color;
    icon.style.color = '#ffffff';
    icon.style.flexShrink = '0';
    icon.style.cursor = 'pointer';

    icon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg"
           aria-hidden="true"
           focusable="false"
           role="img"
           width="1em"
           height="1em"
           viewBox="0 0 32 32">
        <path fill="currentColor"
              d="M26 24v4H6v-4H4v4a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2v-4zm0-10l-1.41-1.41L17 20.17V2h-2v18.17l-7.59-7.58L6 14l10 10l10-10z">
        </path>
      </svg>
    `;

    icon.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      window.open(options.url, '_blank');
    }, true);

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

  // ---- 从 DOM 读取模型源 URL ----
  // 注意：ComfyUI 生产构建会剥离 Vue 实例（__vueParentComponent 不可用），
  // 但每个缺失模型行内都含一个 huggingface.co 的 <a> 锚点（即模型直链）。
  // 从下载按钮向上回溯，其所在行子树内的首个 hf 锚点即该模型的源地址。

  function findRowUrl(btn) {
    let node = btn;
    while (node) {
      const a = node.querySelector('a[href*="huggingface.co/"]');
      if (a && a.href) return a.href;
      node = node.parentElement;
    }
    return null;
  }

  // ---- 注入按钮 ----

  async function addModelScopeIcon(btn, modelScopeUrl) {
    const exists = await urlExists(modelScopeUrl);
    if (!exists) return;

    const modelScopeIcon = createDownloadIcon({
      className: 'comfy-modelscope-mirror',
      title: 'ModelScope 镜像下载',
      color: '#f97316',
      url: modelScopeUrl
    });

    // 放在官方下载按钮右侧
    btn.insertAdjacentElement('afterend', modelScopeIcon);
  }

  function patch() {
    const buttons = document.querySelectorAll('[data-testid="missing-model-download"]');

    buttons.forEach((btn) => {
      // 已注入则跳过；基于图标存在判断，兼容 Vue 重渲染把图标清掉的情况
      if (btn.parentElement.querySelector(':scope > .comfy-hf-mirror')) return;

      const url = findRowUrl(btn);
      // 没拿到 URL（锚点尚未渲染）就下次重试，不要永久跳过
      if (!url || !url.includes('huggingface.co')) return;

      const hfUrl = toHfMirrorUrl(url);
      const msUrl = toModelScopeUrl(url);
      if (!hfUrl) return;

      // hf-mirror 蓝色按钮，紧跟官方下载按钮
      const hfIcon = createDownloadIcon({
        className: 'comfy-hf-mirror',
        title: 'hf-mirror 镜像下载',
        color: '#2563eb',
        url: hfUrl
      });
      btn.insertAdjacentElement('afterend', hfIcon);

      // ModelScope 橙色按钮：存在才显示，插在官方按钮与 hf-mirror 之间
      if (msUrl) {
        addModelScopeIcon(btn, msUrl);
      }
    });
  }

  patch();

  const observer = new MutationObserver(() => {
    patch();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();
