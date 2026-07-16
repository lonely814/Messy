# Canvas Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add canvas-level theming (background, grid, node, edge colors) to the libtv boost script

**Architecture:** Inject CSS variables + override rules in the existing `<style>` block, expand the theme data structure in the injected script, add color pickers in the theme tab

**Tech Stack:** Vanilla JS, CSS custom properties, Tampermonkey

## Global Constraints

- Only modify `libtv-boost.user.js`
- All CSS variables defined in `:root`
- Theme data stored in localStorage `_lt_theme`
- Backward compatible with existing `_lt_theme` format (add fields, don't remove)

---

### Task 1: CSS Variables + Override Rules

**Files:**
- Modify: `/srv/data/Infinite-Canvas-main/篡改猴/libtv-boost/libtv-boost.user.js` (CSS block, lines 20-230)

- [ ] **Step 1: Add 5 new `:root` CSS variables**

Add after existing `--accent-light-rgb` in the `:root` block:
```css
  --canvas-bg: #0f0f0f;
  --grid-color: rgba(255,255,255,0.06);
  --node-bg: #1a1a2e;
  --border-color: rgba(255,255,255,0.12);
  --edge-color: rgba(255,255,255,0.08);
```

- [ ] **Step 2: Add canvas-level CSS override rules**

Add before the `].join('\n')` closing:
```css
.react-flow__renderer,
.react-flow { background: var(--canvas-bg) !important; }

.react-flow__background pattern path { fill: var(--grid-color) !important; }

.react-flow__node { background: var(--node-bg) !important; border-color: var(--border-color) !important; }

.react-flow__edge-path { stroke: var(--edge-color) !important; }
```

### Task 2: Theme Data Structure + Apply Function

**Files:**
- Modify: `libtv-boost.user.js` (injected script theme init section, around line 419-440)

- [ ] **Step 1: Update `_ltThemePresets` with canvas color fields**

Each preset gets new fields: `cb`, `gc`, `nb`, `nc`, `ec`. Auto-calculated values derived from the accent.

- [ ] **Step 2: Update `_ltApplyTheme` to set 5 new CSS variables**

Add after existing `r.style.setProperty(...)` calls:
```js
r.style.setProperty("--canvas-bg", t.cb);
r.style.setProperty("--grid-color", t.gc);
r.style.setProperty("--node-bg", t.nb);
r.style.setProperty("--border-color", t.nc);
r.style.setProperty("--edge-color", t.ec);
```

- [ ] **Step 3: Add backfill for old theme data**

After loading `_ltTheme` from localStorage, fill missing canvas fields with defaults:
```js
if(!t.cb){ /* fill defaults */ }
```

### Task 3: Theme Tab UI — Canvas Color Pickers

**Files:**
- Modify: `libtv-boost.user.js` (theme tab renderBody, around line 544-568)

- [ ] **Step 1: Replace single color picker with 4 pickers**

Replace the existing `#ltp-theme-picker` single color input with 4 rows:
1. 画布背景 → `--canvas-bg`
2. 网格颜色 → `--grid-color`  
3. 节点背景 → `--node-bg`
4. 连线颜色 → `--edge-color`

Each row: label + color input + preview swatch.

- [ ] **Step 2: Update the oninput handler**

Update `oninput` to read all 4 pickers and call `_ltApplyTheme` with the full custom theme object (preset accent colors + custom canvas colors).

### Task 4: Version Bump

- [ ] **Step 1: Bump version to 1.3**

Update `@version`, `@description`, and `console.log`.
