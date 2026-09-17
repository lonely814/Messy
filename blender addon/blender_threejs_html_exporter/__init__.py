bl_info = {
    "name": "Three.js 独立 HTML 导出器",
    "author": "Gilles Tarnus / NexData",
    "version": (2, 11, 0),
    "blender": (3, 6, 0),
    "location": "文件 > 导出 > Three.js 独立 HTML (.html)",
    "description": "将场景导出为内嵌 GLB 模型的 Three.js 独立 HTML 文件",
    "category": "Import-Export",
}

import bpy
import json
import os
import base64
import gzip
import math
import mathutils
import zlib
import pathlib
import re
import tempfile
import webbrowser
from string import Template
from bpy.props import StringProperty, BoolProperty, FloatProperty, EnumProperty, PointerProperty
from bpy.types import Operator, Panel, PropertyGroup
from bpy_extras.io_utils import ExportHelper

THREE_VERSION = '0.160.0'
THREE_CDN = f'https://cdn.jsdelivr.net/npm/three@{THREE_VERSION}/'
# 运行库缓存标识：下载或相对导入改写逻辑变更时必须递增，否则会读回旧缓存
RUNTIME_CACHE_ID = f'three-{THREE_VERSION}-r1'
RUNTIME_ENTRIES = (
    'loaders/GLTFLoader.js',
    'controls/OrbitControls.js',
    'environments/RoomEnvironment.js',
    'utils/BufferGeometryUtils.js',
    'postprocessing/EffectComposer.js',
    'postprocessing/RenderPass.js',
    'postprocessing/ShaderPass.js',
    'postprocessing/OutputPass.js',
    'postprocessing/SAOPass.js',
)

HTML_TEMPLATE = r'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  :root {
    --bg-light: #edf2f7;
    --bg-dark: #111827;
    --panel-light: rgba(255,255,255,0.90);
    --panel-dark: rgba(17,24,39,0.90);
    --text-light: #172033;
    --text-dark: #f8fafc;
    --btn-bg: #27384a;
    --btn-bg-hover: #3f566f;
    --btn-active: #2563eb;
  }
  html, body {
    margin: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--bg-light);
    font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  }
  body.dark { background: var(--bg-dark); }
  #viewer { width: 100%; height: 100%; }
  .toolbar {
    position: fixed;
    top: 12px;
    z-index: 10;
    background: var(--panel-light);
    color: var(--text-light);
    padding: 9px;
    border-radius: 14px;
    box-shadow: 0 8px 26px rgba(0,0,0,0.18);
    display: flex;
    gap: 7px;
    flex-wrap: nowrap;
    align-items: center;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
    backdrop-filter: blur(8px);
    max-width: calc(50vw - 18px);
  }
  #toolbarView { left: 12px; }
  #toolbarToggles { right: 12px; }
  body.dark .toolbar { background: var(--panel-dark); color: var(--text-dark); }
  button {
    border: 0;
    padding: 8px 11px;
    flex: 0 0 auto;
    border-radius: 10px;
    background: var(--btn-bg);
    color: white;
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    box-shadow: inset 0 -1px 0 rgba(255,255,255,0.12);
    transition: background 0.15s ease;
  }
  button:hover { background: var(--btn-bg-hover); }
  button.active { background: var(--btn-active); }
  button svg {
    width: 16px;
    height: 16px;
    flex: 0 0 auto;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  #tree {
    position: fixed;
    top: 68px;
    left: 12px;
    width: 320px;
    max-height: calc(100vh - 130px);
    overflow: auto;
    z-index: 9;
    background: var(--panel-light);
    color: var(--text-light);
    border-radius: 14px;
    box-shadow: 0 8px 26px rgba(0,0,0,0.18);
    padding: 12px;
    font-size: 12px;
    display: none;
    backdrop-filter: blur(8px);
  }
  body.dark #tree { background: var(--panel-dark); color: var(--text-dark); }
  .tree-line {
    padding: 3px 0;
    user-select: none;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .tree-name { cursor: pointer; overflow: hidden; text-overflow: ellipsis; }
  .tree-name:hover { color: var(--btn-active); }
  .tree-line.sel .tree-name { color: var(--btn-active); font-weight: 600; }
  .tree-caret {
    cursor: pointer;
    width: 14px;
    flex: 0 0 auto;
    text-align: center;
    user-select: none;
  }
  #treeFilter {
    width: 100%;
    box-sizing: border-box;
    margin: 4px 0 10px;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid rgba(127,127,127,0.4);
    background: transparent;
    color: inherit;
    font-size: 12px;
  }
  .tree-eye {
    cursor: pointer;
    min-width: 18px;
    text-align: center;
    opacity: 0.95;
  }
  .tree-line.off .tree-name { opacity: 0.35; }
  #animationBar {
    position: fixed;
    left: 50%;
    bottom: 18px;
    transform: translateX(-50%);
    z-index: 30;
    background: var(--panel-light);
    color: var(--text-light);
    border-radius: 999px;
    box-shadow: 0 8px 26px rgba(0,0,0,0.20);
    padding: 8px 12px;
    display: none;
    align-items: center;
    gap: 8px;
    min-width: 420px;
    max-width: calc(100vw - 220px);
    backdrop-filter: blur(8px);
  }
  body.dark #animationBar { background: var(--panel-dark); color: var(--text-dark); }
  #animationBar button { padding: 7px 10px; border-radius: 999px; }
  #animationSelect, #speedSelect {
    height: 30px;
    border-radius: 999px;
    border: 1px solid rgba(39,56,74,0.25);
    padding: 0 8px;
    background: rgba(255,255,255,0.85);
    color: #172033;
    max-width: 160px;
  }
  body.dark #animationSelect, body.dark #speedSelect { background: rgba(17,24,39,0.85); color: #f8fafc; border-color: rgba(255,255,255,0.16); }
  #animationSlider { flex: 1 1 auto; min-width: 130px; accent-color: var(--btn-active); }
  #animationTime { font-size: 12px; min-width: 82px; text-align: right; opacity: 0.85; }
  #loading {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
    justify-content: center;
    background: var(--bg-light);
    color: #172033;
    font-size: 14px;
  }
  body.dark #loading { background: var(--bg-dark); color: var(--text-dark); }
  .spinner {
    width: 34px;
    height: 34px;
    border: 3px solid rgba(127,127,127,0.35);
    border-top-color: var(--btn-active);
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (max-width: 720px) {
    .toolbar { padding: 6px; gap: 5px; }
    .toolbar .lbl { display: none; }
    #animationBar { left: 12px; right: 12px; transform: none; min-width: 0; max-width: none; flex-wrap: wrap; }
    #tree { width: calc(100vw - 24px); }
  }
</style>
</head>
<body>
<div id="loading"><div class="spinner"></div><span>模型加载中…</span></div>
<div id="viewer"></div>
<div id="toolbarView" class="toolbar">
  <button onclick="viewFront()" title="正视 (1)"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="1"/></svg><span class="lbl">正视</span></button>
  <button onclick="viewTop()" title="顶视 (7)"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 9h16"/></svg><span class="lbl">顶视</span></button>
  <button onclick="viewIso()" title="等轴测 (3)"><svg viewBox="0 0 24 24"><path d="M12 2 2 7v10l10 5 10-5V7L12 2z"/><path d="M2 7l10 5 10-5M12 12v10"/></svg><span class="lbl">等轴测</span></button>
  <button onclick="fitView()" title="适配视图 (F)"><svg viewBox="0 0 24 24"><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/><rect x="9" y="9" width="6" height="6"/></svg><span class="lbl">适配</span></button>
  <button onclick="toggleFullscreen()" title="全屏"><svg viewBox="0 0 24 24"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/></svg><span class="lbl">全屏</span></button>
</div>
<div id="toolbarToggles" class="toolbar">
  <button id="btnEdges" onclick="toggleEdges()" title="边线 (E)"><svg viewBox="0 0 24 24"><path d="M12 3 3 21h18L12 3z"/><path d="M12 3v18M7.5 12h9"/></svg><span class="lbl">边线</span></button>
  <button id="btnSpin" onclick="toggleAutoSpin()" title="自动旋转"><svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg><span class="lbl">旋转</span></button>
  <button id="btnAO" onclick="toggleAO()" title="环境光遮蔽 (A)"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" stroke="none"/></svg><span class="lbl">遮蔽</span></button>
  <button id="btnTree" onclick="toggleTree()" title="场景结构"><svg viewBox="0 0 24 24"><path d="M9 6h12M9 12h12M9 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></svg><span class="lbl">结构</span></button>
  <button onclick="toggleTheme()" title="深色 / 浅色"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none"/></svg><span class="lbl">主题</span></button>
  <button onclick="toggleProjectionMode()" title="透视 / 正交"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="13" height="13" rx="1"/><rect x="8" y="8" width="13" height="13" rx="1"/></svg><span class="lbl">投影</span></button>
  <button onclick="saveScreenshot()" title="截图 PNG"><svg viewBox="0 0 24 24"><path d="M3 8a2 2 0 0 1 2-2h2l2-3h6l2 3h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/><circle cx="12" cy="13" r="4"/></svg><span class="lbl">截图</span></button>
</div>
<div id="tree"></div>
<div id="animationBar">
  <select id="animationSelect" title="动画"></select>
  <select id="speedSelect" title="倍速">
    <option value="0.5">0.5x</option>
    <option value="1" selected>1x</option>
    <option value="2">2x</option>
  </select>
  <button onclick="playAnimation()" title="播放 (空格)"><svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5-13-7.5z"/></svg><span class="lbl">播放</span></button>
  <button onclick="pauseAnimation()" title="暂停"><svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg><span class="lbl">暂停</span></button>
  <button onclick="stopAnimation()" title="停止"><svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1"/></svg><span class="lbl">停止</span></button>
  <input id="animationSlider" type="range" min="0" max="1000" value="0" step="1">
  <span id="animationTime">0.00 / 0.00 s</span>
</div>
<script>
// 载荷以 brotli/gzip 压缩后 base64 内嵌，用浏览器原生 DecompressionStream 解压，
// 不引入任何解码库（比内嵌 base64 原始 GLB 小 5 倍左右）。
// 压缩格式存于 meta，用动态 importmap 注入解压后的 blob URL，不依赖 "imports" 必须是内联值。
window.__viewerMeta = ${viewer_meta};
</script>

<script>
// 载荷解码管道：brotli/gzip/deflate base64 → 原生 DecompressionStream → blob URL →
// 动态 importmap + 动态 module 注入。file:// 下可用（已实测）。
// 任何一步失败都必须让用户看到原因，不能停在“加载中”。
window.__viewerBooted = false;
function fail(msg) {
  const el = document.getElementById('loading');
  if (el) el.innerHTML = '<span style="color:#dc2626">加载失败：' + msg + '</span>';
  console.error(msg);
}

async function decompressToBytes(b64, format) {
  const bin = base64ToBytes(b64);
  if (format === null) return bin;
  const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function blobURL(text, type) {
  return URL.createObjectURL(new Blob([text], { type: type }));
}

(async () => {
  if (window.__booted) return; // 模块重复执行时不要重复建场景
  window.__booted = true;
  const meta = window.__viewerMeta;
  let imports = meta.runtimeCDN;
  if (meta.runtimeFormat !== null) {
    const bundle = JSON.parse(new TextDecoder().decode(await decompressToBytes(meta.runtime, meta.runtimeFormat)));
    imports = {};
    for (const [key, src] of Object.entries(bundle)) imports[key] = blobURL(src, 'text/javascript');
  }
  const im = document.createElement('script');
  im.type = 'importmap';
  im.textContent = JSON.stringify({ imports });
  document.head.appendChild(im);

  // 直接存字节，省掉 btoa/atob 往返（btoa 处理大二进制还会因 Latin1 限制报错）
  window.__embeddedGLB = await decompressToBytes(meta.glb, meta.glbFormat);

  const s = document.createElement('script');
  s.type = 'module';
  s.textContent = document.getElementById('viewer-source').textContent;
  document.head.appendChild(s); // 模块自身在末尾启动，此时载荷已就绪
})().catch(e => fail((e && e.message) || String(e)));
</script>

<script type="text/plain" id="viewer-source">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SAOPass } from 'three/addons/postprocessing/SAOPass.js';

const embeddedGLB = window.__embeddedGLB;
const cameraData = ${camera_data}; // 场景相机初始机位，null 表示自动适配视图
const edgeAngle = ${edge_angle};
const environmentLighting = ${environment_lighting};
const envIntensity = ${env_intensity}; // 查看器环境反射强度，导出选项
const sceneLightScale = ${scene_light_scale}; // 灯光强度倍率，导出选项
const envDataURL = "${env_data_url}";
const aoDefault = ${ao_default};
const aoStrength = ${ao_strength};
let scene, camera, renderer, controls, model;
let edgesVisible = ${show_edges_default};
let isDark = ${initial_theme_dark};
let autoSpin = ${auto_spin_default};
let clock = new THREE.Clock();
let mixer = null;
let animations = [];
let currentAction = null;
let currentClip = null;
let animationPlaying = false;
let isScrubbing = false;
let isParallelCamera = false;
let viewFrustumSize = 10;
let composer = null, renderPass = null, saoPass = null;
let aoOn = aoDefault;


function init() {
  document.body.classList.toggle('dark', isDark);
  document.getElementById('btnEdges').classList.toggle('active', edgesVisible);
  document.getElementById('btnSpin').classList.toggle('active', autoSpin);
  document.getElementById('btnAO').classList.toggle('active', aoOn);
  scene = new THREE.Scene();
  scene.background = new THREE.Color(isDark ? 0x111827 : 0xedf2f7);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 100000);
  camera.position.set(5, 4, 5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  window.matchMedia(`(resolution: $${window.devicePixelRatio}dppx)`).addEventListener('change', onResize); // 跨屏拖动时更新像素比
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  document.getElementById('viewer').appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;
  controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
  controls.autoRotate = autoSpin;
  controls.autoRotateSpeed = 1.2;

  if (aoOn) initComposer();

  if (environmentLighting) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    if (envDataURL) {
      new THREE.TextureLoader().load(envDataURL, tex => {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = pmrem.fromEquirectangular(tex).texture;
        tex.dispose();
        pmrem.dispose();
      });
    } else {
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    }
  } else {
    // 灯光延到 GLB 加载回调里处理：那里才知道模型是否带了导出灯光
  }

  window.addEventListener('resize', onResize);
  window.addEventListener('contextmenu', e => e.preventDefault());
  // camera 会被 replaceCamera() 换成新对象，用 getter 保证调试句柄不失效
  window.__viewer = { renderer, scene, get camera() { return camera; } };
}

// 灯光：优先用 GLB 里导出的 Blender 灯光（KHR_lights_punctual，GLTFLoader 自动建成
// THREE.Light 并加进 gltf.scene），否则用内置三点光兵底。
// 灯光需要作用在整个场景上，因此从 model 里摘出来挂到 scene（world transform 不变）。
function handleLightSetup(root) {
  if (root) {
    const lights = [];
    root.traverse(o => { if (o.isLight) lights.push(o); });
    if (lights.length) {
      lights.forEach(l => {
        l.intensity *= sceneLightScale;
        scene.attach(l);
      });
      return;
    }
  }
  if (environmentLighting) return;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x777777, 1.3);
  scene.add(hemi);
  const dir1 = new THREE.DirectionalLight(0xffffff, 1.6);
  dir1.position.set(5, 8, 7);
  scene.add(dir1);
  const dir2 = new THREE.DirectionalLight(0xffffff, 0.7);
  dir2.position.set(-5, -4, -6);
  scene.add(dir2);
}

function bootstrapViewer() {
  if (window.__viewer) return; // 重复注入防护
  init();
  loadEmbeddedGLB();
  animate();
}

function loadEmbeddedGLB() {
  const loader = new GLTFLoader();
  loader.parse(embeddedGLB.buffer, '', gltf => {
    document.getElementById('loading').style.display = 'none';
    model = gltf.scene;
    scene.add(model);
    if (environmentLighting) {
      model.traverse(o => {
        if (o.isMesh && o.material) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
            if ('envMapIntensity' in m) m.envMapIntensity = envIntensity;
          });
        }
      });
    }
    normalizeAndFrame(model);
    handleLightSetup(model);
    if (edgesVisible) buildEdges();
    buildTree();
    setupAnimations(gltf.animations || []);
  }, error => {
    document.getElementById('loading').style.display = 'none';
    console.error(error);
    alert('内嵌 GLB 加载失败，请查看浏览器控制台。');
  });
}

function makeCamera(parallel) {
  const aspect = window.innerWidth / window.innerHeight;
  if (parallel) {
    const halfH = viewFrustumSize / 2;
    const halfW = halfH * aspect;
    return new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.01, 100000);
  }
  return new THREE.PerspectiveCamera(45, aspect, 0.01, 100000);
}

function updateCameraProjection() {
  const aspect = window.innerWidth / window.innerHeight;
  if (camera.isPerspectiveCamera) {
    camera.aspect = aspect;
  } else if (camera.isOrthographicCamera) {
    const halfH = viewFrustumSize / 2;
    const halfW = halfH * aspect;
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfH;
    camera.bottom = -halfH;
  }
  camera.updateProjectionMatrix();
}

function replaceCamera(parallel) {
  const oldCamera = camera;
  camera = makeCamera(parallel);
  if (oldCamera) {
    camera.position.copy(oldCamera.position);
    camera.quaternion.copy(oldCamera.quaternion);
    camera.up.copy(oldCamera.up);
    camera.near = oldCamera.near;
    camera.far = oldCamera.far;
  }
  if (renderPass) renderPass.camera = camera;
  if (saoPass) saoPass.camera = camera;
  controls.object = camera;
  updateCameraProjection();
  controls.update();
}

window.toggleProjectionMode = function() {
  isParallelCamera = !isParallelCamera;
  replaceCamera(isParallelCamera);
}

function initComposer() {
  composer = new EffectComposer(renderer);
  renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  saoPass = new SAOPass(scene, camera);
  saoPass.params.saoIntensity = aoStrength;
  saoPass.params.saoKernelRadius = viewFrustumSize * 0.025;
  composer.addPass(saoPass);
  composer.addPass(new OutputPass());
}
window.toggleAO = function() {
  if (!composer) initComposer();
  aoOn = !aoOn;
  document.getElementById('btnAO').classList.toggle('active', aoOn);
}

function normalizeAndFrame(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;

  if (cameraData) {
    // 场景相机机位：模型保持世界坐标，视锥按导出值设置
    viewFrustumSize = cameraData.ortho ? cameraData.orthoScale : maxDim * 2.4;
  } else {
    obj.position.sub(center);
    viewFrustumSize = maxDim * 2.4;
  }
  if (saoPass) saoPass.params.saoKernelRadius = maxDim * 0.06;
  camera.near = maxDim / 1000;
  camera.far = maxDim * 1000;

  if (cameraData && !!cameraData.ortho !== isParallelCamera) {
    isParallelCamera = !!cameraData.ortho;
    replaceCamera(isParallelCamera);
  }

  if (cameraData) {
    camera.position.fromArray(cameraData.position);
    const forward = new THREE.Vector3().fromArray(cameraData.forward);
    // 轨道中心放在模型中心所在平面，旋转时不会偏离模型
    const distToCenter = camera.position.distanceTo(center) || maxDim;
    controls.target.copy(camera.position).addScaledVector(forward, distToCenter);
    if (camera.isPerspectiveCamera && cameraData.fov) camera.fov = cameraData.fov;
  } else {
    const dist = maxDim * 1.8;
    camera.position.set(dist, dist * 0.75, dist);
    controls.target.set(0, 0, 0);
  }
  updateCameraProjection();
  controls.update();
}

let builtEdgeAngle = null; // 已建边线所用角度，变更时需重建

function disposeEdges(mesh) {
  mesh.children.filter(c => c.userData && c.userData.isEdgeHelper).forEach(c => {
    mesh.remove(c);
    c.geometry.dispose();
    c.material.dispose();
  });
}

function buildEdges() {
  if (!model) return;
  model.traverse(child => {
    if (child.userData && child.userData.isEdgeHelper) return;
    if (child.isMesh && child.geometry) {
      if (child.children.some(c => c.userData && c.userData.isEdgeHelper)) {
        if (builtEdgeAngle === edgeAngle) return; // 角度未变，复用现有边线
        disposeEdges(child);
      }
      const edges = new THREE.EdgesGeometry(child.geometry, edgeAngle);
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: isDark ? 0xd8dee9 : 0x111111 }));
      line.name = 'Edges';
      line.userData.isEdgeHelper = true;
      line.visible = edgesVisible && child.visible;
      line.renderOrder = 10;
      child.add(line);
    }
  });
  builtEdgeAngle = edgeAngle;
}

function setEdgesVisible(visible) {
  if (!model) return;
  if (visible) buildEdges();
  model.traverse(o => {
    if (o.userData && o.userData.isEdgeHelper) o.visible = visible;
  });
}

function setObjectVisibleWithEdges(o, visible) {
  o.visible = visible;
  o.traverse(child => {
    if (child.userData && child.userData.isEdgeHelper) child.visible = visible && edgesVisible;
  });
}

function buildTree() {
  const tree = document.getElementById('tree');
  tree.innerHTML = '<b>🌳 场景结构</b>';
  const filter = document.createElement('input');
  filter.id = 'treeFilter';
  filter.placeholder = '过滤对象…';
  filter.oninput = () => filterTree(filter.value.trim().toLowerCase());
  tree.appendChild(filter);
  const lines = [];
  function filterTree(q) {
    if (!q) {
      lines.forEach(l => { l._vis = true; l.style.display = ''; });
      return;
    }
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i];
      l._vis = l.dataset.name.includes(q) || l._kids.some(k => k._vis);
      l.style.display = l._vis ? '' : 'none';
    }
  }
  function walk(o, depth, parentLine, container) {
    if (o.userData && o.userData.isEdgeHelper) return;
    const kidObjects = o.children.filter(c => !(c.userData && c.userData.isEdgeHelper));
    const hasKids = kidObjects.length > 0;
    const name = o.name || o.type || '对象';
    const line = document.createElement('div');
    line.className = 'tree-line' + (o.visible ? '' : ' off');
    line.style.paddingLeft = (depth * 12) + 'px';
    line.dataset.name = name.toLowerCase();
    line._kids = [];

    const caret = document.createElement('span');
    caret.className = 'tree-caret';
    caret.textContent = hasKids ? '▾' : '';

    const eye = document.createElement('span');
    eye.className = 'tree-eye';
    eye.textContent = o.visible ? '👁️' : '🙈';
    eye.title = '显示 / 隐藏节点';
    eye.onclick = (event) => {
      event.stopPropagation();
      const newVisible = !o.visible;
      setObjectVisibleWithEdges(o, newVisible);
      eye.textContent = newVisible ? '👁️' : '🙈';
      line.classList.toggle('off', !newVisible);
    };

    const label = document.createElement('span');
    label.className = 'tree-name';
    label.textContent = name;
    label.title = '点击聚焦该对象';
    label.onclick = () => {
      if (window._selLine) window._selLine.classList.remove('sel');
      window._selLine = line;
      line.classList.add('sel');
      focusObject(o);
    };

    line.appendChild(caret);
    line.appendChild(eye);
    line.appendChild(label);
    container.appendChild(line);
    lines.push(line);

    if (hasKids) {
      const kidsBox = document.createElement('div');
      container.appendChild(kidsBox);
      caret.onclick = (event) => {
        event.stopPropagation();
        const open = kidsBox.style.display === 'none';
        kidsBox.style.display = open ? '' : 'none';
        caret.textContent = open ? '▾' : '▸';
      };
      kidObjects.forEach(c => walk(c, depth + 1, line, kidsBox));
    }
    if (parentLine) parentLine._kids.push(line);
  }
  if (model) walk(model, 0, null, tree);
}

window.toggleEdges = function() {
  edgesVisible = !edgesVisible;
  setEdgesVisible(edgesVisible);
  document.getElementById('btnEdges').classList.toggle('active', edgesVisible);
}

window.toggleAutoSpin = function() {
  autoSpin = !autoSpin;
  controls.autoRotate = autoSpin;
  document.getElementById('btnSpin').classList.toggle('active', autoSpin);
}

window.toggleTheme = function() {
  isDark = !isDark;
  document.body.classList.toggle('dark', isDark);
  scene.background = new THREE.Color(isDark ? 0x111827 : 0xedf2f7);
  if (model) model.traverse(o => { if (o.userData && o.userData.isEdgeHelper && o.material) o.material.color.setHex(isDark ? 0xd8dee9 : 0x111111); });
}

window.toggleTree = function() {
  const tree = document.getElementById('tree');
  const toolbar = document.getElementById('toolbarView');
  tree.style.top = (toolbar.offsetTop + toolbar.offsetHeight + 10) + 'px';
  tree.style.display = tree.style.display === 'block' ? 'none' : 'block';
  document.getElementById('btnTree').classList.toggle('active', tree.style.display === 'block');
}

function modelBox() {
  return new THREE.Box3().setFromObject(model || scene);
}

function setView(x, y, z) {
  if (!model) return;
  const box = modelBox();
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const dist = maxDim * 2.0;
  viewFrustumSize = maxDim * 2.4;
  updateCameraProjection();
  camera.position.set(x * dist, y * dist, z * dist);
  controls.target.set(0, 0, 0);
  controls.update();
}

window.fitView = function() {
  setView(1, 0.75, 1);
}

window.viewFront = () => setView(0, 0, 1);
window.viewTop = () => setView(0, 1, 0.001);
window.viewIso = () => setView(1, 0.75, 1);


function setupAnimations(clips) {
  animations = clips || [];
  const bar = document.getElementById('animationBar');
  const select = document.getElementById('animationSelect');
  const slider = document.getElementById('animationSlider');

  if (!animations.length || !model) {
    bar.style.display = 'none';
    return;
  }

  mixer = new THREE.AnimationMixer(model);
  select.innerHTML = '';
  animations.forEach((clip, index) => {
    const opt = document.createElement('option');
    opt.value = index;
    opt.textContent = clip.name || ('动画 ' + (index + 1));
    select.appendChild(opt);
  });

  select.onchange = () => setAnimation(parseInt(select.value, 10), false);
  slider.addEventListener('pointerdown', () => { isScrubbing = true; });
  slider.addEventListener('pointerup', () => { isScrubbing = false; seekAnimation(); });
  slider.addEventListener('input', seekAnimation);

  document.getElementById('speedSelect').onchange = (e) => {
    mixer.timeScale = parseFloat(e.target.value);
  };

  setAnimation(0, ${auto_play_animation});
  bar.style.display = 'flex';
}

function setAnimation(index, autoPlay) {
  if (!mixer || !animations.length) return;
  if (currentAction) currentAction.stop();
  currentClip = animations[index] || animations[0];
  currentAction = mixer.clipAction(currentClip);
  currentAction.reset();
  currentAction.setLoop(THREE.LoopRepeat);
  currentAction.clampWhenFinished = false;
  currentAction.enabled = true;
  currentAction.play();
  currentAction.paused = false;
  mixer.setTime(0);
  currentAction.paused = true;
  animationPlaying = false;
  updateAnimationUI(0);
  if (autoPlay) window.playAnimation();
}

function seekAnimation() {
  if (!mixer || !currentClip) return;
  const slider = document.getElementById('animationSlider');
  const t = (Number(slider.value) / 1000) * currentClip.duration;
  currentAction.enabled = true;
  currentAction.paused = false;
  currentAction.play();
  mixer.setTime(t);
  currentAction.paused = !animationPlaying;
  updateAnimationUI(t);
}

function updateAnimationUI(forcedTime) {
  if (!currentClip) return;
  const slider = document.getElementById('animationSlider');
  const timeLabel = document.getElementById('animationTime');
  const duration = currentClip.duration || 0;
  const t = Math.max(0, Math.min(duration, forcedTime !== undefined ? forcedTime : (mixer ? mixer.time % duration : 0)));
  if (!isScrubbing && duration > 0) slider.value = Math.round((t / duration) * 1000);
  timeLabel.textContent = t.toFixed(2) + ' / ' + duration.toFixed(2) + ' s';
}

window.playAnimation = function() {
  if (!currentAction) return;
  currentAction.paused = false;
  currentAction.play();
  animationPlaying = true;
}

window.pauseAnimation = function() {
  if (!currentAction) return;
  currentAction.paused = true;
  animationPlaying = false;
}

window.stopAnimation = function() {
  if (!currentAction || !mixer) return;
  currentAction.stop();
  currentAction.reset();
  currentAction.play();
  currentAction.paused = false;
  mixer.setTime(0);
  currentAction.paused = true;
  animationPlaying = false;
  updateAnimationUI(0);
}

window.toggleFullscreen = function() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen();
  }
};

window.saveScreenshot = function() {
  // 与主渲染循环保持一致：AO 开启时走 composer，否则 toDataURL 读到的是无遮蔽画面
  if (composer && aoOn) composer.render(); else renderer.render(scene, camera);
  const a = document.createElement('a');
  a.download = document.title.replace(/\.html?$$/i, '') + '.png'; // $$ 为 string.Template 转义写法
  a.href = renderer.domElement.toDataURL('image/png');
  a.click();
};

function focusObject(o) {
  const box = new THREE.Box3().setFromObject(o);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const dist = maxDim * 2.0;
  const dir = camera.position.clone().sub(controls.target).normalize();
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(dir, dist);
  controls.update();
}

window.addEventListener('keydown', (e) => {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT') return;
  switch (e.code) {
    case 'Digit1': case 'Numpad1': window.viewFront(); break;
    case 'Digit3': case 'Numpad3': window.viewIso(); break;
    case 'Digit7': case 'Numpad7': window.viewTop(); break;
    case 'KeyF': window.fitView(); break;
    case 'KeyE': window.toggleEdges(); break;
    case 'KeyA': window.toggleAO(); break;
    case 'Space':
      e.preventDefault();
      if (animationPlaying) window.pauseAnimation(); else window.playAnimation();
      break;
  }
});

function onResize() {
  updateCameraProjection();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (mixer && animationPlaying && !isScrubbing) {
    mixer.update(delta);
    updateAnimationUI();
  }
  controls.update();
  if (composer && aoOn) composer.render(); else renderer.render(scene, camera);
}

// 模块自身启动：导入是异步的，注入方无法等它定义完再调用，所以在此处自启。
// 此时 window.__embeddedGLB 已由载荷管道写好（注入顺序保证）。
bootstrapViewer();
</script>
</body>
</html>
'''


def _compress_best(data):
    """挑体积最小的压缩方案。返回 (base64 文本, DecompressionStream 格式名)。

    格式名必须与浏览器 DecompressionStream 的取值一致：brotli / gzip / deflate。
    无收益或压缩库不可用时返回 (None, None)，调用方回退到未压缩载荷。
    """
    best = None
    for fmt, fn in (
        ('brotli', lambda d: __import__('brotli').compress(d, quality=11)),
        ('gzip', lambda d: gzip.compress(d, 9)),
        ('deflate', lambda d: zlib.compress(d, 9)),
    ):
        try:
            packed = fn(data)
        except Exception:
            continue
        if best is None or len(packed) < len(best[1]):
            best = (fmt, packed)
    if best is None or len(best[1]) >= len(data):
        return None, None
    return base64.b64encode(best[1]).decode('ascii'), best[0]


class HTML3D_OT_export(Operator, ExportHelper):
    bl_idname = "export_scene.html3d_standalone"
    bl_label = "Three.js 独立 HTML (.html)"
    bl_description = "将场景导出为内嵌 GLB 模型的 Three.js 独立 HTML 文件"
    bl_options = {'REGISTER', 'UNDO'}

    filename_ext = ".html"
    filter_glob: StringProperty(default="*.html", options={'HIDDEN'})

    show_edges_default: BoolProperty(
        name="默认显示边线",
        description="打开 HTML 查看器时显示生成的边线",
        default=True,
    )
    edge_angle: FloatProperty(
        name="平滑边线角度",
        description="EdgesGeometry 边线生成的角度阈值（度）",
        default=30.0,
        min=0.0,
        max=180.0,
    )
    include_mode: EnumProperty(
        name="导出范围",
        description="选择导出哪些 Blender 对象",
        items=[
            ('ALL', "全部场景对象", "导出场景中的对象"),
            ('VISIBLE', "仅可见对象", "仅导出当前视图层可见的对象"),
            ('SELECTED', "仅选中对象", "仅导出当前选中的对象"),
        ],
        default='VISIBLE',
    )
    viewer_theme: EnumProperty(
        name="查看器主题",
        description="独立 HTML 打开时使用的初始配色",
        items=[
            ('LIGHT', "浅色", "以浅色主题打开查看器"),
            ('DARK', "深色", "以深色主题打开查看器"),
        ],
        default='LIGHT',
    )
    environment_lighting: BoolProperty(
        name="环境光照明",
        description="使用基于图像的环境光照，金属等 PBR 材质显示更准确；关闭则使用简单灯光",
        default=True,
    )
    export_world_env: BoolProperty(
        name="导出世界环境",
        description="将当前世界渲染为低分辨率全景图嵌入 HTML，查看器光照与 Blender 一致；仅当环境光照明开启且场景存在世界时生效，失败时回退内置环境",
        default=True,
    )
    env_intensity: FloatProperty(
        name="环境光强度",
        description="查看器环境光反射强度（材质 envMapIntensity）；金属偏暗可调高",
        default=2.0,
        min=0.0,
        soft_max=5.0,
    )
    enable_ao: BoolProperty(
        name="环境光遮蔽 (SSAO)",
        description="在查看器中启用实时 SSAO 后处理，增强接触阴影与层次感；查看器内可用遮蔽按钮或 A 键开关",
        default=True,
    )
    ao_strength: FloatProperty(
        name="遮蔽强度",
        description="环境光遮蔽强度；过高会脏面",
        default=0.5,
        min=0.0,
        soft_max=2.0,
    )
    embed_runtime: BoolProperty(
        name="内嵌运行库（离线可用）",
        description="导出时下载 Three.js 运行库并内嵌进 HTML，打开文件无需联网；关闭则从 jsDelivr 在线加载",
        default=True,
    )
    auto_spin_default: BoolProperty(
        name="自动旋转",
        description="打开 HTML 时自动开启模型旋转",
        default=False,
    )
    use_scene_camera: BoolProperty(
        name="使用场景相机机位",
        description="以场景当前活动相机的角度、距离与视角作为查看器初始机位；无相机时自动适配视图",
        default=True,
    )
    export_lights: BoolProperty(
        name="导出场景灯光",
        description="将 Blender 灯光（点光/日射/聚光/面光）导出进内嵌 GLB，查看器用它们照明；关闭则使用内置三点光",
        default=True,
    )
    light_scale: FloatProperty(
        name="灯光强度倍率",
        description="查看器端灯光强度系数；Blender 与 Three 的单位换算存在差异，可按需微调",
        default=1.0,
        min=0.0,
        soft_max=4.0,
    )
    texture_format: EnumProperty(
        name="纹理压缩",
        description="GLB 内嵌纹理格式；WebP 体积明显小于 PNG，浏览器原生支持，无需额外解码器",
        items=[
            ('AUTO', "自动（按 Blender 设置）", "由 glTF 导出器自行选择格式"),
            ('JPEG', "JPEG", "有损压缩，适合无透明通道的贴图"),
            ('WEBP', "WebP", "体积更小，浏览器原生支持"),
        ],
        default='AUTO',
    )
    auto_play_animation: BoolProperty(
        name="自动播放动画",
        description="打开 HTML 时自动播放第一个动画",
        default=False,
    )

    export_animations: BoolProperty(
        name="导出动画",
        description="将 Blender 动画包含进内嵌 GLB；仅当存在动画时在 HTML 中显示播放控件",
        default=True,
    )
    export_frame_range: BoolProperty(
        name="限制帧范围",
        description="受支持时仅导出当前场景帧范围内的动画关键帧",
        default=False,
    )
    animation_mode: EnumProperty(
        name="动画模式",
        description="Blender glTF 动画导出模式",
        items=[
            ('ACTIVE_ACTIONS', "合并当前动作", "受支持时将当前物体动作合并为单个动画"),
            ('ACTIONS', "动作", "受支持时将各动作导出为独立动画"),
            ('BROADCAST', "广播动作", "受支持时将兼容动作广播到物体"),
            ('NLA_TRACKS', "NLA 轨道", "受支持时导出 NLA 轨道"),
            ('SCENE', "场景", "受支持时导出场景动画"),
        ],
        default='ACTIVE_ACTIONS',
    )

    @staticmethod
    def _scene_has_animation(context):
        # 不能只看 bpy.data.actions：游离动作（fake user、未挂到任何对象）会误判为有动画
        for obj in context.scene.objects:
            ad = getattr(obj, "animation_data", None)
            if ad and (ad.action or len(ad.nla_tracks) > 0):
                return True
            data = getattr(obj, "data", None)
            ad = getattr(data, "animation_data", None) if data else None
            if ad and (ad.action or len(ad.nla_tracks) > 0):
                return True
        return False

    @staticmethod
    def _scene_camera_data(context):
        """场景活动相机的初始机位（转换到 glTF/Three 的 Y-up 空间）。无相机返回 None。"""
        cam = context.scene.camera
        if cam is None or cam.data is None:
            return None

        def to_yup(v):
            # Blender Z-up → glTF Y-up：(x, y, z) → (x, z, -y)
            return [float(v.x), float(v.z), float(-v.y)]

        matrix = cam.matrix_world
        forward = -(matrix.to_3x3() @ mathutils.Vector((0.0, 0.0, 1.0)))
        is_ortho = cam.data.type == 'ORTHO'
        data = {
            'position': to_yup(matrix.translation),
            'forward': to_yup(forward),
            'ortho': is_ortho,
            'orthoScale': float(cam.data.ortho_scale),
        }
        if not is_ortho:
            # Blender angle_y 即垂直视角，与 Three 的 PerspectiveCamera.fov 同义
            data['fov'] = math.degrees(cam.data.angle_y)
        return data

    def draw(self, context):
        layout = self.layout
        layout.prop(self, "show_edges_default")
        layout.prop(self, "edge_angle")
        layout.prop(self, "include_mode")
        layout.prop(self, "viewer_theme")
        layout.prop(self, "environment_lighting")
        layout.prop(self, "export_world_env")
        layout.prop(self, "env_intensity")
        layout.prop(self, "enable_ao")
        layout.prop(self, "ao_strength")
        layout.prop(self, "embed_runtime")
        layout.prop(self, "texture_format")
        layout.prop(self, "use_scene_camera")
        layout.prop(self, "export_lights")
        layout.prop(self, "light_scale", slider=True)
        layout.prop(self, "auto_spin_default")

        has_anim = self._scene_has_animation(context)
        box = layout.box()
        box.label(text="动画")
        if not has_anim:
            box.label(text="此 Blender 文件中未找到动画", icon='INFO')
        col = box.column()
        col.enabled = has_anim
        col.prop(self, "export_animations")
        sub = col.column()
        sub.enabled = has_anim and self.export_animations
        sub.prop(self, "animation_mode")
        sub.prop(self, "auto_play_animation")
        sub.prop(self, "export_frame_range")

    def _export_glb(self, context, glb_path):
        kwargs = dict(
            filepath=glb_path,
            export_format='GLB',
            export_apply=True,
            export_materials='EXPORT',
            export_yup=True,
            export_cameras=False,
        )

        try:
            available = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
        except Exception:
            available = set()

        def add_if_supported(name, value):
            if not available or name in available:
                kwargs[name] = value

        def add_enum_if_supported(name, preferred, fallbacks=None):
            if available and name not in available:
                return
            fallbacks = fallbacks or []
            try:
                prop = bpy.ops.export_scene.gltf.get_rna_type().properties.get(name)
                valid_values = {item.identifier for item in prop.enum_items} if prop and hasattr(prop, 'enum_items') else set()
            except Exception:
                valid_values = set()
            for candidate in [preferred] + list(fallbacks):
                if not valid_values or candidate in valid_values:
                    kwargs[name] = candidate
                    return

        add_if_supported('export_animations', bool(self.export_animations))
        add_enum_if_supported('export_animation_mode', self.animation_mode, ['ACTIVE_ACTIONS', 'ACTIONS', 'NLA_TRACKS', 'SCENE'])
        add_if_supported('export_frame_range', bool(self.export_frame_range))
        add_if_supported('export_force_sampling', True)
        add_if_supported('export_lights', bool(self.export_lights))
        # 纹理格式：WebP 浏览器原生支持，体积明显小于 PNG，无需查看器侧解码器
        if self.texture_format != 'AUTO':
            add_enum_if_supported('export_image_format', self.texture_format, ['AUTO'])
        add_if_supported('export_nla_strips', True)

        if self.include_mode == 'SELECTED':
            add_if_supported('use_selection', True)
        elif self.include_mode == 'VISIBLE':
            if 'use_visible' in available:
                kwargs['use_visible'] = True
                add_if_supported('use_selection', False)
            else:
                original_selection = list(context.selected_objects)
                active = context.view_layer.objects.active
                try:
                    bpy.ops.object.select_all(action='DESELECT')
                    visible_objects = [obj for obj in context.scene.objects if obj.visible_get()]
                    for obj in visible_objects:
                        obj.select_set(True)
                    if visible_objects:
                        context.view_layer.objects.active = visible_objects[0]
                    add_if_supported('use_selection', True)
                    bpy.ops.export_scene.gltf(**kwargs)
                finally:
                    bpy.ops.object.select_all(action='DESELECT')
                    for obj in original_selection:
                        if obj.name in context.scene.objects:
                            obj.select_set(True)
                    context.view_layer.objects.active = active
                return
        else:
            add_if_supported('use_selection', False)
            if 'use_visible' in available:
                kwargs['use_visible'] = False

        bpy.ops.export_scene.gltf(**kwargs)

    @classmethod
    def _download_runtime(cls):
        """取得内嵌运行库；优先用磁盘缓存，避免每次导出都重新下载 1.4MB。"""
        cache_dir = cls._runtime_cache_dir()
        cached = cls._read_runtime_cache(cache_dir)
        if cached:
            return cached
        runtime = cls._fetch_runtime()
        cls._write_runtime_cache(cache_dir, runtime)
        return runtime

    @staticmethod
    def _runtime_cache_dir():
        try:
            config = bpy.utils.user_resource('CONFIG', create=True)
        except Exception:
            return ''
        if not config:
            return ''
        # Blender 5.x 的 user_resource 已无 'CACHE' 类型，沿用官方 <user>/cache 布局
        return os.path.join(os.path.dirname(config), 'cache', 'threejs_html_exporter', RUNTIME_CACHE_ID)

    @staticmethod
    def _cache_file(cache_dir, key):
        return os.path.join(cache_dir, key.replace('/', '__'))

    @classmethod
    def _read_runtime_cache(cls, cache_dir):
        if not cache_dir:
            return None
        try:
            with open(os.path.join(cache_dir, 'manifest.json'), encoding='utf-8') as f:
                keys = json.load(f)
            runtime = {}
            for key in keys:
                with open(cls._cache_file(cache_dir, key), 'rb') as f:
                    runtime[key] = f.read()
        except Exception:
            return None  # 缓存缺失或损坏：当作未命中，重新下载
        return runtime or None

    @classmethod
    def _write_runtime_cache(cls, cache_dir, runtime):
        if not cache_dir:
            return
        try:
            os.makedirs(cache_dir, exist_ok=True)
            for key, data in runtime.items():
                with open(cls._cache_file(cache_dir, key), 'wb') as f:
                    f.write(data)
            # manifest 最后写，作为缓存完整的标志
            with open(os.path.join(cache_dir, 'manifest.json'), 'w', encoding='utf-8') as f:
                json.dump(sorted(runtime), f)
        except Exception:
            pass  # 缓存写失败不影响导出

    @staticmethod
    def _fetch_runtime():
        import urllib.request
        import posixpath
        from concurrent.futures import ThreadPoolExecutor
        base = THREE_CDN
        files = {}

        def read_url(url):
            import time as _time
            last = None
            for attempt in range(3):  # 中国大陆网络对 jsDelivr 偶发失败，重试比报错友好
                try:
                    with urllib.request.urlopen(url, timeout=30) as resp:
                        data = resp.read()
                    if not data:
                        raise RuntimeError(f"空响应：{url}")
                    return data
                except Exception as ex:
                    last = ex
                    _time.sleep(0.5 * (attempt + 1))
            raise RuntimeError(f"下载失败（已重试 3 次）：{url} — {last}")

        def fetch(spec):
            """下载单个 addon 文件并返回其相对依赖列表（不递归，由调用方按层展开）。"""
            data = read_url(base + 'examples/jsm/' + spec)
            files[spec] = data
            return [posixpath.normpath(posixpath.join(posixpath.dirname(spec), rel.decode('ascii')))
                    for rel in re.findall(rb"(?:from|import)\s*['\"](\.\.?/[^'\"]+)['\"]", data)]

        # 依赖图按层并行展开：同层文件互不依赖，可并发下载
        with ThreadPoolExecutor(max_workers=8) as pool:
            three_future = pool.submit(read_url, base + 'build/three.module.js')
            pending = sorted(set(RUNTIME_ENTRIES))
            while pending:
                deps = list(pool.map(fetch, pending))
                pending = sorted({d for group in deps for d in group if d not in files})
            three_src = three_future.result()

        # data: URL 模块没有基准 URL，相对导入必须改写为 importmap 裸标识符；
        # 未处理的相对引用直接报错回退 CDN。
        def rewrite(data, spec):
            def sub(m):
                rel = m.group(2).decode('ascii')
                dep = posixpath.normpath(posixpath.join(posixpath.dirname(spec), rel))
                return ("three/addons/" + dep).encode('ascii')
            return re.sub(rb"(from\s*['\"])(\.\.?/[^'\"]+)(['\"])", lambda m: m.group(1) + sub(m) + m.group(3), data)

        for spec, data in files.items():
            data = rewrite(data, spec)
            if re.search(rb"(?:from|import)\s*['\"]\.\.?/", data):
                raise RuntimeError(f"运行库 {spec} 存在未处理的相对引用")
            files[spec] = data

        runtime = {'three': three_src}
        for spec, data in files.items():
            runtime['three/addons/' + spec] = data
        return runtime

    @staticmethod
    def _build_importmap(runtime):
        """导出 CDN 回退用的裸 importmap（内嵌时改由查看器端动态构建）。"""
        if runtime:
            def data_url(data):
                return 'data:text/javascript;base64,' + base64.b64encode(data).decode('ascii')
            imports = {key: data_url(data) for key, data in runtime.items()}
        else:
            imports = {
                'three': THREE_CDN + 'build/three.module.js',
                'three/addons/': THREE_CDN + 'examples/jsm/',
            }
        return json.dumps({'imports': imports})

    def _render_world_equirect(self, context, out_base):
        """将当前世界渲染为 512x256 equirect JPEG，用于查看器环境照明。"""
        tmp_scene = bpy.data.scenes.new("TMP_HTML_ENV")
        cam_data = bpy.data.cameras.new("html_env_cam")
        cam_data.type = 'PANO'
        cam_data.panorama_type = 'EQUIRECTANGULAR'
        cam_obj = bpy.data.objects.new("html_env_cam", cam_data)
        tmp_scene.collection.objects.link(cam_obj)
        tmp_scene.camera = cam_obj
        tmp_scene.world = context.scene.world
        tmp_scene.render.engine = 'CYCLES'
        tmp_scene.cycles.samples = 32
        tmp_scene.render.resolution_x = 512
        tmp_scene.render.resolution_y = 256
        tmp_scene.render.image_settings.file_format = 'JPEG'
        tmp_scene.render.image_settings.quality = 85
        tmp_scene.render.filepath = out_base
        try:
            with bpy.context.temp_override(scene=tmp_scene):
                bpy.ops.render.render(write_still=True)
        finally:
            bpy.data.objects.remove(cam_obj, do_unlink=True)
            bpy.data.cameras.remove(cam_data, do_unlink=True)
            bpy.data.scenes.remove(tmp_scene, do_unlink=True)
        for candidate in (out_base, out_base + '.jpg'):
            if os.path.exists(candidate):
                return candidate
        raise RuntimeError("环境贴图渲染输出缺失")

    def execute(self, context):
        if self.include_mode == 'SELECTED' and not context.selected_objects:
            self.report({'WARNING'}, "导出范围为「仅选中对象」，但当前没有选中任何对象")
            return {'CANCELLED'}
        output_path = bpy.path.abspath(self.filepath)
        if not output_path.lower().endswith('.html'):
            output_path += '.html'
        folder = os.path.dirname(output_path)
        if folder:
            os.makedirs(folder, exist_ok=True)

        runtime_data = None
        if self.embed_runtime:
            try:
                runtime_data = self._download_runtime()
            except Exception as ex:
                self.report({'WARNING'}, f"运行库下载失败，已回退为在线加载：{ex}")

        env_data_url = ''
        cam_data = self._scene_camera_data(context) if self.use_scene_camera else None
        with tempfile.TemporaryDirectory() as tmpdir:
            glb_path = os.path.join(tmpdir, "scene_export.glb")
            self._export_glb(context, glb_path)
            with open(glb_path, 'rb') as f:
                glb_bytes = f.read()
            if self.environment_lighting and self.export_world_env and context.scene.world:
                try:
                    env_file = self._render_world_equirect(context, os.path.join(tmpdir, "world_env"))
                    with open(env_file, 'rb') as f:
                        env_data_url = 'data:image/jpeg;base64,' + base64.b64encode(f.read()).decode('ascii')
                except Exception as ex:
                    self.report({'WARNING'}, f"世界环境渲染失败，使用内置环境：{ex}")

        # 载荷压缩：GLB 与运行库源码都压缩后内嵌，浏览器用原生 DecompressionStream 解压。
        # 实测 GLB 缩到 1/5，three 运行库缩到 1/3。渲染进程无 DecompressionStream 时
        # GLB 回退为未压缩 base64（仍可离线），运行库回退为 CDN。
        glb_payload, glb_format = _compress_best(glb_bytes)
        if glb_format is None:
            glb_payload = base64.b64encode(glb_bytes).decode('ascii')

        runtime_payload, runtime_format = None, None
        if runtime_data:
            sources = {key: value.decode('utf-8') for key, value in runtime_data.items()}
            runtime_payload, runtime_format = _compress_best(
                json.dumps(sources, ensure_ascii=False).encode('utf-8'))
            if runtime_format is None:
                runtime_data = None  # 压缩不可用时运行库走 CDN，比内嵌未压缩源码小

        viewer_meta = json.dumps({
            'runtimeFormat': runtime_format,
            'runtime': runtime_payload,
            'runtimeCDN': None if runtime_data else {
                'three': THREE_CDN + 'build/three.module.js',
                'three/addons/': THREE_CDN + 'examples/jsm/',
            },
            'glbFormat': glb_format,
            'glb': glb_payload,
        }, ensure_ascii=False, separators=(',', ':'))

        # string.Template 一次替换全部占位符：模板本身写单花括号，注入内容
        # （base64、meta JSON）中的花括号不受影响，无顺序依赖。
        html = Template(HTML_TEMPLATE).substitute(
            title=os.path.basename(output_path),
            viewer_meta=viewer_meta,
            camera_data=json.dumps(cam_data, separators=(',', ':')) if cam_data else 'null',
            scene_light_scale=str(self.light_scale),
            env_data_url=env_data_url,
            edge_angle=str(self.edge_angle),
            show_edges_default='true' if self.show_edges_default else 'false',
            initial_theme_dark='true' if self.viewer_theme == 'DARK' else 'false',
            auto_spin_default='true' if self.auto_spin_default else 'false',
            auto_play_animation='true' if self.auto_play_animation else 'false',
            environment_lighting='true' if self.environment_lighting else 'false',
            env_intensity=str(self.env_intensity),
            ao_default='true' if self.enable_ao else 'false',
            ao_strength=str(self.ao_strength),
        )
        # 原子写：中断不会留下半个 HTML
        tmp_path = output_path + '.part'
        with open(tmp_path, 'w', encoding='utf-8') as f:
            f.write(html)
        os.replace(tmp_path, output_path)

        mode = '内嵌运行库' if runtime_data else '在线加载'
        self.report({'INFO'}, f"已导出 Three.js 独立 HTML（{mode}）：{output_path}")
        return {'FINISHED'}


class HTML3D_Settings(PropertyGroup):
    output_path: StringProperty(
        name="输出文件",
        description="导出目标 HTML 路径；以 // 开头表示相对当前 .blend 文件",
        subtype='FILE_PATH',
        default="//threejs_scene.html",
    )
    auto_open: BoolProperty(
        name="导出后自动打开",
        description="导出完成后用默认浏览器打开生成的 HTML",
        default=False,
    )
    show_edges_default: BoolProperty(name="默认显示边线", default=True)
    edge_angle: FloatProperty(name="平滑边线角度", default=30.0, min=0.0, max=180.0)
    include_mode: EnumProperty(
        name="导出范围",
        items=[
            ('ALL', "全部场景对象", "导出场景中的对象"),
            ('VISIBLE', "仅可见对象", "仅导出当前视图层可见的对象"),
            ('SELECTED', "仅选中对象", "仅导出当前选中的对象"),
        ],
        default='VISIBLE',
    )
    viewer_theme: EnumProperty(
        name="查看器主题",
        items=[('LIGHT', "浅色", ""), ('DARK', "深色", "")],
        default='LIGHT',
    )
    environment_lighting: BoolProperty(name="环境光照明", default=True)
    export_world_env: BoolProperty(name="导出世界环境", default=True)
    env_intensity: FloatProperty(name="环境光强度", default=2.0, min=0.0, soft_max=5.0)
    enable_ao: BoolProperty(name="环境光遮蔽 (SSAO)", default=True)
    ao_strength: FloatProperty(name="遮蔽强度", default=0.5, min=0.0, soft_max=2.0)
    auto_spin_default: BoolProperty(name="自动旋转", default=False)
    embed_runtime: BoolProperty(name="内嵌运行库（离线可用）", default=True)
    use_scene_camera: BoolProperty(name="使用场景相机机位", default=True)
    export_lights: BoolProperty(name="导出场景灯光", default=True)
    light_scale: FloatProperty(name="灯光强度倍率", default=1.0, min=0.0, soft_max=4.0)
    texture_format: EnumProperty(
        name="纹理压缩",
        items=[('AUTO', "自动", ""), ('JPEG', "JPEG", ""), ('WEBP', "WebP", "")],
        default='AUTO',
    )
    export_animations: BoolProperty(name="导出动画", default=True)
    export_frame_range: BoolProperty(name="限制帧范围", default=False)
    animation_mode: EnumProperty(
        name="动画模式",
        items=[
            ('ACTIVE_ACTIONS', "合并当前动作", "受支持时将当前物体动作合并为单个动画"),
            ('ACTIONS', "动作", "受支持时将各动作导出为独立动画"),
            ('BROADCAST', "广播动作", "受支持时将兼容动作广播到物体"),
            ('NLA_TRACKS', "NLA 轨道", "受支持时导出 NLA 轨道"),
            ('SCENE', "场景", "受支持时导出场景动画"),
        ],
        default='ACTIVE_ACTIONS',
    )
    auto_play_animation: BoolProperty(name="自动播放动画", default=False)


class HTML3D_OT_panel_export(Operator):
    bl_idname = "export_scene.html3d_panel_export"
    bl_label = "导出 Three.js HTML"
    bl_description = "使用侧边栏当前设置直接导出，不弹出文件对话框"
    bl_options = {'REGISTER', 'UNDO'}

    def execute(self, context):
        s = context.scene.html3d_settings
        output_path = bpy.path.abspath(s.output_path)
        result = bpy.ops.export_scene.html3d_standalone(
            'EXEC_DEFAULT',
            filepath=output_path,
            show_edges_default=s.show_edges_default,
            edge_angle=s.edge_angle,
            include_mode=s.include_mode,
            viewer_theme=s.viewer_theme,
            environment_lighting=s.environment_lighting,
            export_world_env=s.export_world_env,
            env_intensity=s.env_intensity,
            enable_ao=s.enable_ao,
            ao_strength=s.ao_strength,
            auto_spin_default=s.auto_spin_default,
            embed_runtime=s.embed_runtime,
            use_scene_camera=s.use_scene_camera,
            export_lights=s.export_lights,
            light_scale=s.light_scale,
            texture_format=s.texture_format,
            export_animations=s.export_animations,
            export_frame_range=s.export_frame_range,
            animation_mode=s.animation_mode,
            auto_play_animation=s.auto_play_animation,
        )
        if result == {'FINISHED'} and s.auto_open:
            try:
                webbrowser.open(pathlib.Path(output_path).as_uri())
            except Exception as ex:
                self.report({'WARNING'}, f"已导出但无法自动打开（路径未解析？）：{ex}")
        return result


class HTML3D_PT_view3d(Panel):
    bl_label = "Three.js 导出"
    bl_idname = "HTML3D_PT_view3d"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = "Three.js"

    def draw(self, context):
        layout = self.layout
        s = context.scene.html3d_settings
        layout.use_property_split = True
        layout.use_property_decorate = False

        layout.prop(s, "output_path")
        layout.prop(s, "auto_open")
        layout.separator()
        row = layout.row()
        row.scale_y = 1.5
        row.operator("export_scene.html3d_panel_export", icon='EXPORT', text="导出 HTML")


class HTML3D_PT_geometry(Panel):
    bl_label = "几何"
    bl_idname = "HTML3D_PT_geometry"
    bl_parent_id = "HTML3D_PT_view3d"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = "Three.js"
    ICON = 'MESH_DATA'

    def draw_header(self, context):
        self.layout.label(icon=self.ICON)

    def draw(self, context):
        layout = self.layout
        s = context.scene.html3d_settings
        layout.use_property_split = True
        layout.use_property_decorate = False
        layout.prop(s, "include_mode")
        layout.prop(s, "show_edges_default")
        layout.prop(s, "edge_angle", slider=True)


class HTML3D_PT_appearance(Panel):
    bl_label = "外观与光照"
    bl_idname = "HTML3D_PT_appearance"
    bl_parent_id = "HTML3D_PT_view3d"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = "Three.js"
    bl_options = {'DEFAULT_CLOSED'}
    ICON = 'LIGHT'

    def draw_header(self, context):
        self.layout.label(icon=self.ICON)

    def draw(self, context):
        layout = self.layout
        s = context.scene.html3d_settings
        layout.use_property_split = True
        layout.use_property_decorate = False

        layout.prop(s, "viewer_theme")

        col = layout.column(align=True)
        col.prop(s, "environment_lighting")
        sub = col.column(align=True)
        sub.enabled = s.environment_lighting
        sub.prop(s, "export_world_env")
        sub.prop(s, "env_intensity", slider=True)

        col = layout.column(align=True)
        col.prop(s, "enable_ao")
        sub = col.column()
        sub.enabled = s.enable_ao
        sub.prop(s, "ao_strength", slider=True)


class HTML3D_PT_animation(Panel):
    bl_label = "动画"
    bl_idname = "HTML3D_PT_animation"
    bl_parent_id = "HTML3D_PT_view3d"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = "Three.js"
    bl_options = {'DEFAULT_CLOSED'}
    ICON = 'PLAY'

    def draw_header(self, context):
        self.layout.label(icon=self.ICON)

    def draw(self, context):
        layout = self.layout
        s = context.scene.html3d_settings
        layout.use_property_split = True
        layout.use_property_decorate = False

        layout.prop(s, "export_animations")
        col = layout.column()
        col.enabled = s.export_animations
        col.prop(s, "animation_mode")
        col.prop(s, "auto_play_animation")
        col.prop(s, "export_frame_range")


class HTML3D_PT_misc(Panel):
    bl_label = "输出选项"
    bl_idname = "HTML3D_PT_misc"
    bl_parent_id = "HTML3D_PT_view3d"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = "Three.js"
    bl_options = {'DEFAULT_CLOSED'}
    ICON = 'PACKAGE'

    def draw_header(self, context):
        self.layout.label(icon=self.ICON)

    def draw(self, context):
        layout = self.layout
        s = context.scene.html3d_settings
        layout.use_property_split = True
        layout.use_property_decorate = False
        layout.prop(s, "embed_runtime")
        layout.prop(s, "texture_format")
        layout.prop(s, "use_scene_camera")
        layout.prop(s, "export_lights")
        layout.prop(s, "light_scale", slider=True)
        layout.prop(s, "auto_spin_default")


def menu_func_export(self, context):
    self.layout.operator(HTML3D_OT_export.bl_idname, text="Three.js 独立 HTML (.html)")


classes = (HTML3D_OT_export, HTML3D_Settings, HTML3D_OT_panel_export, HTML3D_PT_view3d,
           HTML3D_PT_geometry, HTML3D_PT_appearance, HTML3D_PT_animation, HTML3D_PT_misc)


def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    bpy.types.Scene.html3d_settings = PointerProperty(type=HTML3D_Settings)
    bpy.types.TOPBAR_MT_file_export.append(menu_func_export)
    # 导出时清理陈旧缓存，避免 cache 目录无限增长
    try:
        _prune_runtime_cache()
    except Exception:
        pass


def _prune_runtime_cache(keep=3):
    """只保留最近 keep 个版本标识的缓存目录。"""
    root = HTML3D_OT_export._runtime_cache_dir()
    if not root:
        return
    parent = os.path.dirname(root)
    if not os.path.isdir(parent):
        return
    siblings = sorted(
        (os.path.join(parent, d) for d in os.listdir(parent) if os.path.isdir(os.path.join(parent, d))),
        key=os.path.getmtime,
        reverse=True,
    )
    import shutil
    for stale in siblings[keep:]:
        shutil.rmtree(stale, ignore_errors=True)


def unregister():
    bpy.types.TOPBAR_MT_file_export.remove(menu_func_export)
    del bpy.types.Scene.html3d_settings
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":
    register()
