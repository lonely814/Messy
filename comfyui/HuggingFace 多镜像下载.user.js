// ==UserScript==
// @name         HuggingFace 多镜像下载
// @namespace    https://huggingface.co/
// @version      2.3.0
// @description  在 Hugging Face 原下载图标右边增加 ModelScope 橙色按钮和 hf-mirror 蓝色按钮；ModelScope的下载速度最快
// @match        https://huggingface.co/*
// @grant        GM_xmlhttpRequest
// @author       AYU
// @connect      modelscope.cn
// @connect      hf-mirror.com
// @run-at       document-idle
// @license MIT
// @downloadURL https://update.greasyfork.org/scripts/585385/HuggingFace%20%E5%A4%9A%E9%95%9C%E5%83%8F%E4%B8%8B%E8%BD%BD.user.js
// @updateURL https://update.greasyfork.org/scripts/585385/HuggingFace%20%E5%A4%9A%E9%95%9C%E5%83%8F%E4%B8%8B%E8%BD%BD.meta.js
// ==/UserScript==

(function () {
  'use strict';

  const HF_MIRROR_HOST = 'https://hf-mirror.com';
  const MODELSCOPE_HOST = 'https://modelscope.cn/models';

  const checkedModelScopeUrls = new Map();

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

    // HF:
    // /namespace/repo/resolve/branch/file
    //
    // ModelScope:
    // /models/namespace/repo/resolve/branch/file
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

  function isFileDownloadLink(a) {
    if (!a || a.tagName !== 'A') return false;
    if (!a.href.includes('/resolve/')) return false;

    const text = (a.textContent || '').replace(/\s+/g, ' ').trim();

    // 只处理文件大小下载链接
    return /\b\d+(\.\d+)?\s*(B|kB|KB|MB|GB|TB)\b/i.test(text);
  }

  function findOfficialDownloadIcon(a) {
    const divs = Array.from(a.querySelectorAll('div'));

    const candidates = divs.filter(div => {
      const text = (div.textContent || '').trim();

      // xet 这种有文字，排除
      if (text) return false;

      // 必须有 svg
      if (!div.querySelector('svg')) return false;

      // 原下载按钮一般有 h-5 w-5
      const cls = div.className || '';
      return String(cls).includes('h-5') && String(cls).includes('w-5');
    });

    // 取最后一个，避免前面的 xet / badge 干扰
    return candidates[candidates.length - 1] || null;
  }

  function createDownloadIcon(options) {
    const icon = document.createElement('div');

    icon.className = `${options.className} ml-2 flex h-5 w-5 items-center justify-center rounded-sm border`;
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

    return new Promise(resolve => {
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

  async function addModelScopeIconIfExists(a, officialIcon, modelScopeUrl) {
    if (!modelScopeUrl) return;

    const exists = await urlExists(modelScopeUrl);
    if (!exists) return;

    if (a.dataset.modelScopeMirrorAdded === '1') return;
    a.dataset.modelScopeMirrorAdded = '1';

    const modelScopeIcon = createDownloadIcon({
      className: 'modelscope-mirror-icon',
      title: 'ModelScope 镜像下载',
      color: '#f97316',
      url: modelScopeUrl
    });

    // ModelScope 放在最左边：紧跟官方灰色下载图标
    officialIcon.insertAdjacentElement('afterend', modelScopeIcon);
  }

  function addHfMirrorIcon(a, officialIcon, hfMirrorUrl) {
    if (!hfMirrorUrl) return;
    if (a.dataset.hfMirrorAdded === '1') return;

    const hfMirrorIcon = createDownloadIcon({
      className: 'hf-mirror-icon',
      title: 'hf-mirror 镜像下载',
      color: '#2563eb',
      url: hfMirrorUrl
    });

    // hf-mirror 默认先插到官方按钮后面；
    // 如果 ModelScope 后续检测成功，会插到官方按钮和 hf-mirror 之间
    officialIcon.insertAdjacentElement('afterend', hfMirrorIcon);

    a.dataset.hfMirrorAdded = '1';
  }

  function patch() {
    const links = Array.from(document.querySelectorAll('a[href*="/resolve/"]'))
      .filter(isFileDownloadLink);

    links.forEach(a => {
      if (a.dataset.hfMirrorProcessing === '1') return;

      const hfMirrorUrl = toHfMirrorUrl(a.href);
      const modelScopeUrl = toModelScopeUrl(a.href);

      if (!hfMirrorUrl && !modelScopeUrl) return;

      const officialIcon = findOfficialDownloadIcon(a);
      if (!officialIcon) return;

      a.dataset.hfMirrorProcessing = '1';

      // 先加蓝色 hf-mirror，保证马上可见
      addHfMirrorIcon(a, officialIcon, hfMirrorUrl);

      // ModelScope 检测存在后，插到官方按钮右侧、hf-mirror 左侧
      addModelScopeIconIfExists(a, officialIcon, modelScopeUrl);
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