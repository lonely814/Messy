# HANDOFF — playblast_puls

Machine-oriented handoff. Optimized for AI agents / fresh sessions, not humans.
Read this fully before touching code.

---

## 1. IDENTITY

- **Extension id**: `playblast_puls`
- **Display name**: `Playblast Puls 快照`
- **Version**: `1.0.0` (declared in TWO places — keep in sync: `blender_manifest.toml` `version`, and `__init__.py` `bl_info["version"]` as tuple `(1,0,0)`)
- **Upstream origin**: Blendermarket addon "Playblast" by carlosmu, was v1.3.3, id `playblast`. This tree is a renamed fork; version deliberately reset to 1.0.0.
- **License**: GPL-3.0-or-later
- **blender_version_min**: 3.6.0
- **Type**: Blender extension (add-on), NOT a legacy addon
- **Source dir**: `portable/extensions/extensions_blender_defender_com/playblast_puls`
- **Blender used for all testing**: `C:/Blender/stable/blender-5.2.0-windows-x64/blender.exe` (5.2.0 LTS, bundled python 3.13)
- **Built artifact**: `dist/playblast_puls-1.0.0.zip`

### Rename invariants (do not break)
Renaming was NOT cosmetic. The operator/panel identifiers were renamed too, because installing
both the original and this fork in one Blender would double-register `Scene.enable_overrides`
and the `playblast.*` operators → class-registration errors.

| Layer | Value |
|---|---|
| extension id | `playblast_puls` |
| operator ids | `playblast_puls.playblast`, `.player`, `.open_filebrowser`, `.open_preferences`, `.recover_version`, `.increase_version`, `.decrease_version`, `.turnaround_camera` |
| panel idname | `PLAYBLAST_PULS_PT_popover` |
| keymap ids | `playblast_puls.playblast` (Ctrl+Shift+F12), `playblast_puls.player` (Ctrl+Shift+F11) |

`bpy.types.Scene.*` and window-manager property names are STILL generic
(`enable_overrides`, `version_number`, `custom_folder`, …). Unchanged from upstream.
If coexistence with the original addon becomes a hard requirement, these must be namespaced too.

---

## 2. MODULE MAP

```
__init__.py                 register/unregister fan-out; bl_info; version
blender_manifest.toml       extension manifest; id + version
keymap.py                   Ctrl+Shift+F12 playblast / F11 player, on Screen keymap
user_prefs.py               PB_Prefs (all pb_* settings), enum-list helpers, STAMP_FIELDS, draw()
op_playblast.py             main render op; SHARED HELPERS live here (see §4)
op_player.py                replay last video; imports op_playblast
op_turnaround_camera.py     turntable camera rig creator
op_version_numbering.py     3 tiny version ops (+1/-1/reset)
op_open_filebrowser.py      open output folder
op_open_preferences.py      jump to addon prefs
pt_popover.py               PL_PT_popover panel + draw; override_row() helper; scene override props
```

Line counts (~1898 total): op_playblast 580, user_prefs 401, pt_popover 264, op_player 207,
op_turnaround_camera 201, __init__ 82, op_version_numbering 60, op_open_filebrowser 54,
op_open_preferences 28, keymap 21.

### What the addon does
Viewport OpenGL render (`bpy.ops.render.opengl(animation=True)`) to a video, using addon-owned
settings (`pb_*` prefs + optional per-scene overrides), while saving/restoring the user's real
scene render config so it is never permanently modified. Purpose = fast animation review.

---

## 3. NAMING / OUTPUT PIPELINE

Single source of truth = `op_playblast.generate_filename(context, prefs, segment_name, is_marker_segment, frame_start, frame_end)`.

Order of assembly:
1. base name ← `pb_playblast_name`: `FILENAME` (blend stem) | `SCENE_NAME` | `CUSTOM_NAME` (`pb_custom_name`)
2. scene override (if `scene.enable_filename and scene.enable_overrides and scene.custom_playblast_name`)
3. `+ sep + scene.name` if `pb_use_scene_name`
4. `+ sep + action.name` if `pb_use_action_name` (via `get_action_name`; armature action, shape-key action, or first selected object's action)
5. `+ sep + marker_name` if marker segment
6. `+ sep + {start:04d} + sep + {end:04d}` if `pb_framerange`
7. `+ sep + 'v' + {version:03d}` if `scene.enable_version and scene.enable_overrides`
8. `+ get_extension(prefs)` from `pb_container`

Separator from `get_separator(prefs)`: `_` `-` `.` ` ` (default `-`).

Output dir from `get_output_dir(context, prefs)`:
- scene override (`enable_folder and enable_overrides`) → `scene.custom_folder`
- else `pb_output_options`: `PROYECT_FOLDER` → `//` | `SYSTEM_FOLDER` → `pb_system_folder` | `PROYECT_RENDER_SETTINGS` → scene render filepath
- `+ pb_subfolder_name + "/"` when `pb_subfolder`

Frame range comes from `get_frame_range(context)`: preview range when
`scene.use_preview_range and frame_preview_end > frame_preview_start`, else scene range.
**The preview flag is force-disabled during the actual render** (see §6, gotcha) so explicit
segment ranges win.

Container→extension map (`get_extension`): MPEG4→.mp4, QUICKTIME→.mov, AVI→.avi,
WEBM→.webm, MPEG2→.mpg, OGG→.ogv, default→.mkv.

---

## 4. SHARED HELPERS (op_playblast.py is the hub)

`op_player` imports `op_playblast` as a MODULE (`from . import op_playblast`) and calls
`op_playblast.X`. Do not switch to `from .op_playblast import X` for `last_output` — it is
module-global and rebound per render.

- `last_output` (module global) — path of the most recent successful render. Replay uses this
  first; falls back to regenerate name only when nothing rendered yet. Marker-split segments are
  ONLY reachable through it.
- `get_separator(prefs)`, `get_extension(prefs)`, `get_output_dir(context, prefs)`
- `get_frame_range(context)`
- `generate_filename(...)`
- `get_action_name(context)`
- `get_stamp_fields(render)` — discovers every `use_stamp_*` toggle from RNA (returns suffixes)
- `save_render_state(context)` / `restore_render_state(state)` — THE critical pair; see below
- `OVERLAY_FLAGS` — tuple of viewport overlay flags toggled/restored
- `STAMP_FIELDS` (in user_prefs) — `(suffix, label, tip)` for the 6 user-facing fields
- `PL_OT_playblast.get_divisor(percentage)` — percentage 0 → 1 (avoids ZeroDivisionError)
- `PL_OT_playblast.force_divisible(number)` — bumps odd resolution to even

### save_render_state / restore_render_state
Captures and restores: use_file_extension, filepath, view_transform, look, color_mode,
color_depth, resolution (x,y,pct), use_stamp, stamp_font_size, film_transparent,
show_reconstruction, gopsize, ALL stamp fields, all OVERLAY_FLAGS, and version-dependent
format keys (5.0+: media_type/ffmpeg_format/ffmpeg_codec; pre-5.0: file_format + container/codec).
`op_playblast.render_segment` and `op_player.plblast` both use it. Adding a new render setting
means editing this pair ONLY — that is the point of the refactor. (Before it, the two ops had
~100 duplicated lines and bug fixes had to be applied twice.)

Note: `audio_codec` is saved/restored but NOT overridden from prefs (see §7).

---

## 5. VERIFIED BLENDER 5.2 API FACTS

All established empirically on 5.2.0 LTS. Do not re-derive; do not trust memory over this.

1. `AnimData.action_slots` **does not exist** (only `action_slot`, singular). `action.slots` and
   `action.layers` exist; `action.fcurves` does not.
2. `action_slot` is `None` until the first keyframe exists. Passing it to
   `anim_utils.action_ensure_channelbag_for_slot` raises
   `RuntimeError: Cannot return channelbag when slot is None`.
   → `op_turnaround_camera.get_fcurves()` handles this and may return `None`.
3. `image_settings.media_type` switching IMAGE→VIDEO **silently resets `ffmpeg.codec` to H264 and
   `ffmpeg.gopsize` to 18 — but only the first time**. Repeat switches do not re-reset.
   → always set `media_type` BEFORE container/codec/gop.
4. `image_settings.file_format` no longer contains `AVI_JPEG` / `AVI_RAW` (removed in 5.0).
   `ffmpeg.format` = MPEG4 MKV WEBM AVI DV FLASH MPEG1 MPEG2 OGG QUICKTIME.
   `ffmpeg.codec` = 17 values incl. NONE (see §8); `audio_codec` = NONE AAC AC3 FLAC MP2 MP3 OPUS PCM VORBIS.
5. enum `codec` list is **NOT container-dependent** — 17 items for every container. Blender's own
   UI filtering is in `5.2/scripts/startup/bl_ui/properties_output.py` (`use_gop`, `use_bitrate`, …).
6. `@staticmethod` on a `bpy.types` subclass is **NOT preserved** — `type(cls.attr)` is `function`,
   and access via an instance binds `self` → TypeError. Use a module-level function. (This crashed
   the popover once.)
7. `bpy.ops` is a **dynamic namespace**: `bpy.ops.render.opengl = fake` silently does nothing, and
   `hasattr(bpy.ops.x, 'y')` is ALWAYS True. To stub operators in tests, patch the module's `bpy`
   reference; to test operator existence use `bpy.ops.mod.op.idname()`.
8. `bpy.ops.render.opengl` params: `animation`, `write_still`, `view_context` (default **True** =
   render the current 3D view), `render_keyed_only`, `sequencer`. The addon does not pass
   `view_context`, so it renders the VIEWPORT view, not necessarily `scene.camera`. **UNVERIFIED
   in a real UI** — worth checking; may be a real bug for the turnaround-camera workflow.
9. `UILayout.grid_flow` exists but is in `bl_rna.functions`, NOT `.properties`.
10. A `bpy.types.Panel`/`Operator` subclass cannot be instantiated (`bpy_struct.__new__ takes one arg`).
11. `bool` enum items: with `items=<callable>`, `default` must be an **integer index**, not a string.
    (Registration fails otherwise: `'default' can only be an integer when 'items' is a function`.)
12. Registered class names get an uppercased prefix: `PL_OT_playblast` → `PLAYBLAST_PULS_OT_playblast`.

---

## 6. TESTING — HOW TO RUN (critical)

**There is no test framework.** Tests are standalone scripts in
`C:/Users/Administrator/AppData/Local/Temp/pb_*.py` (OUTSIDE the repo, so they are not packaged).
19 files exist.

### The mandatory invocation pattern
```
cd C:/Blender/stable/blender-5.2.0-windows-x64
BLENDER_USER_SCRIPTS="$(cygpath -w /tmp/pbtest)" \
BLENDER_USER_CONFIG="$(cygpath -w /tmp/pbtest/cfg)" \
./blender.exe -b --factory-startup --python "$T/pb_<name>.py" > "$T/<log>" 2>&1
```
- `/tmp/pbtest/addons/playblast_puls` must contain a copy of the source. Re-copy after EVERY edit
  (`rm -rf` the old copy first, and delete `__pycache__`), or you test stale code.
- **`--factory-startup` is required.** The user's real Blender config has unrelated broken addons
  that throw during `addon_disable` (`bgl` missing, `CYCLES_RENDER_PT_sampling_advanced` missing)
  and can crash the process.
- `BLENDER_USER_CONFIG` does **NOT** relocate extension repos — only prefs.
- Pass scripts as WINDOWS paths (`C:/Users/.../Temp/pb_x.py`). Relative/`/tmp` paths have silently
  produced missing-log confusion.

### Pass/fail detection
Scripts print `PASS <label>` / `FAIL <label>` and end with `ALL_CHECKS_PASSED` or exit 1.
Harness convention: detect failure with
`grep -qE 'Traceback|Error: Python|FAILED [1-9]' <log>`.

### Harness list and what each covers
| file | covers |
|---|---|
| pb_apply_test.py | full render-segment apply + exact save/restore equality |
| pb_marker_test.py | marker splitting, per-segment ranges/names |
| pb_marker_dup.py | duplicate marker names |
| pb_roundtrip.py | playblast→replay targets the last written segment |
| pb_player_test.py / _test2.py | replay filename resolution |
| pb_realistic.py / _image.py | settings restore across VIDEO / IMAGE starting states |
| pb_prefs_gop.py | prefs gop reaches encoder |
| pb_popover_test.py / _test2.py | popover scene override toggles |
| pb_folder_test.py | folder opener matches render dir (3 override combos) |
| pb_fixes_test.py | failure-doesn't-increment-version, marker coverage/dupes, preview range, div-by-zero, path report |
| pb_ui_name_test.py | filename override precedence + suffix stacking |
| pb_ui_draw_test.py | popover draw() via mock layout, 7 branches |
| pb_prefs_draw_test.py | preferences draw() via mock layout, 14 branches |
| pb_stamp_test.py | stamp field select/apply/restore, audio option removal |
| pb_codec_test.py | dynamic codec list matches Blender, all accepted, reaches encoder |
| pb_codec_probe.py | (probe, not a test) codec enum behaviour |

### Mocking the UI (headless has NO UI, so draw() never runs)
Both draw tests use a recording mock layout:
- Must implement: `row() column() box() separator() label() prop() operator() grid_flow()`, plus
  attributes `enabled`, `scale_y`, `use_property_split`, `use_property_decorate`, `alignment`.
- `prop()` must `hasattr()`-check the datablock → catches wrong property names.
- `operator()` should resolve the idname → catches wrong operator ids.
- For the **preferences** panel, `self` IS the prefs datablock: the mock must delegate attribute
  access to the real prefs or every `prop(self, "pb_*")` fails.
- For the **popover**, `self` is the Panel; borrow helpers as class attributes (cannot subclass
  instantiate a bpy type — see §5.10).

### Harness breakage modes (all hit already)
- Harnesses duck-type the operator via a `Proxy` class that hand-binds methods
  (`force_divisible`, `get_divisor`, `execute`, `playblast_master`, `render_segment`,
  `render_by_markers`). **Adding/removing an operator method breaks them** with AttributeError.
- Harnesses import the module and look up `preferences.addons['playblast_puls']`. After a rename,
  BOTH the import name AND the string key must be updated (a regex over imports misses the string).
- `__import__('playblast_puls.user_prefs')` style strings need updating too.
- `progress_end=lambda: None` breaks — it becomes a bound method taking `self`; use `lambda *a: None`.

---

## 7. DELIBERATE DECISIONS / REMOVALS

- **`pb_audio` REMOVED** (with `get_audio_items`). Rationale: `render.opengl` produces no audio
  source, so the setting was inert. `ffmpeg.audio_codec` is still saved/restored by
  save/restore_render_state — the user's own value is preserved, just not overridden.
  **UNVERIFIED**: whether an audio track could ever appear. If it turns out one can, re-add.
- **`pb_video_codec` is now a dynamic callback** (`items=get_codec_items`, `default=0`), reading
  Blender's RNA. NONE is filtered out; H264 forced to index 0. `CODEC_LABELS` maps ids to friendly
  labels; unknown ids fall through to their identifier so future Blender codecs appear automatically.
  There is NO "follow the OS" behaviour and there cannot be: Blender statically links FFmpeg, so
  OS-installed codecs are invisible to it. Follow-the-Blender-build is the real semantic.
- **"NONE"/last of hardcoded 3-item codec list** gone: it was `H264 / H265 / QTRLE` only.
- **`pb_format` is version-gated** (`get_format_items`): 5.0+ → FFMPEG only; pre-5.0 → AVI_JPEG,
  AVI_RAW, FFMPEG. Again: no OS dependency.
- Marker splitting covers the WHOLE range: boundaries are `range_start → markers(strictly inside
  range) → range_end`; each segment's last frame is `next_start - 1` so no frame renders twice and
  none is skipped. Segment name = the marker that STARTS it (first segment gets `""`, shown as
  `start` in the report).
- Version increments ONLY on render success. `render_segment` returns bool; `render_by_markers`
  aborts at the first failure; `playblast_master` warns instead of incrementing.
- `pb_resize_percentage` 0 → treated as 100 with a warning (the UI allows 0).
- Autoplay is suppressed when splitting by markers.
- `pb_gop` is currently ALWAYS shown. It is meaningless for intra-frame codecs
  (QTRLE/ProRes/FFV1/HuffYUV/PNG/DNxHD) — Blender's own UI gates it via
  `use_gop = codec not in {'DNXHD','HUFFYUV','PNG','PRORES'}`. **Open improvement.**
- `pb_gop` semantics of 0 (Blender range 0..500, Blender default 25, addon default 18) are
  **UNVERIFIED**. Probably "every frame is a keyframe". Not tested.

---

## 8. BUG HISTORY (all FIXED, all reproduced first)

Round 1 — user-reported:
1. Replay couldn't find the video (duplicated, drifted filename builder in op_player). Fixed via
   shared generators + `last_output`.
2. Popover quick-setting toggles were dead UI (`enable_markers` / `enable_auto_version` /
   `enable_color_mgmt` were never read by the op). Now OR'd with prefs, gated by `enable_overrides`.
3. `pb_gop` / `pb_audio` never reached the encoder on 5.x.
4. Turnaround camera keyframes ACCUMULATED across runs; 5.2's `action_slots` guard never matched so
   clearing was skipped. Fixed with `get_fcurves()`.
5. `interpolation_type` never applied (same root cause); now set on every keyframe.
6. Marker segment files indistinguishable; now carry their own frame range.
+ `op_open_filebrowser` ignored `enable_overrides` and opened the wrong dir.

Round 2:
7. Failed render still incremented version; marker loop continued. Fixed (§7).
8. Frames before the first marker never rendered; boundary frames rendered twice. Fixed (§7).
9. `pb_resize_percentage = 0` → ZeroDivisionError. Fixed.
10. Added preview-range support; added absolute output path to the completion report.
11. Refreshed enums for 5.x (format/container/audio + extension map).

Round 3:
12. Deduplicated op_player vs render_segment behind save/restore_render_state
    (op_player 322 → 207 lines).

Round 4:
13. UI: popover restructured into 输出/画面/行为 boxes with a stable override row pattern;
    preferences panel restructured into 输出/文件名/视频设置/画面/行为+UI.
    Preferences panel UI (this session): same treatment.
14. Stamp fields made configurable (6 fields, only frame on by default). NOTE: Blender enables
    ~9 of 15 stamp fields by default, so ALL fields not offered in the panel are FORCED OFF while
    stamping, otherwise the image is buried in text. Implemented generically via
    `get_stamp_fields(render)`.
15. `pb_audio` removed. `pb_video_codec` made dynamic (16 codecs, was 3).

---

## 9. BUILD / DIST

```
cd C:/Blender/stable/blender-5.2.0-windows-x64
./blender.exe -b --factory-startup --command extension validate <srcdir>
./blender.exe -b --factory-startup --command extension build \
    --source-dir <srcdir> --output-dir C:/Blender/stable/blender-5.2.0-windows-x64/dist
```
- Output: `dist/playblast_puls-1.0.0.zip` (~23 KB, 11 entries: 10 .py + manifest).
- **`dist/` must stay OUTSIDE the source dir** or the build packs the previous zip.
- Remove `__pycache__` before building.
- Version bump = edit BOTH places (§1), then rebuild (filename embeds the version).

### Installing the built zip for a REAL test
```
bpy.ops.extensions.package_install_files(filepath=<zip>, repo='user_default', enable_on_install=True)
```
**WARNING: this writes into the REAL install** at
`portable/extensions/user_default/<id>/` — `BLENDER_USER_CONFIG` does NOT redirect repos.
Always delete `portable/extensions/user_default` afterwards. (Hit twice.)
`extension_repo_add` takes `name` / `custom_directory` / `use_custom_directory` — NOT `module` /
`directory`; and a repo added in the same session is not immediately selectable as a `repo=` enum.

Verified install result: module `bl_ext.user_default.playblast_puls`, panel present,
`bpy.ops.playblast_puls.playblast.idname()` == `PLAYBLAST_PULS_OT_playblast`,
keymap bound to `playblast_puls.*`.

---

## 10. ENVIRONMENT / REPO NOTES

- **Not a git repo.** No version control at all. No CI. Be careful with destructive edits.
- Working dir at session start = the OLD `playblast` directory. The rename left an **EMPTY
  directory** `.../extensions_blender_defender_com/playblast/` that could not be removed (Windows
  refused: the shell's cwd, plus 9 running blender.exe processes, held it). It contains no manifest,
  so Blender does NOT load it. Delete it when no blender.exe is running.
- The user's Blender config contains many unrelated/broken addons; never run Blender without
  `--factory-startup` for tests.
- `portable/extensions/blender_org/basedplayblast` is an UNRELATED third-party addon that happens to
  own the `PLAYBLAST_OT_playblast` class name. Do not confuse it with this project when grepping.
- `maintainer` and `website` in blender_manifest.toml still point at the ORIGINAL author
  (carlosmu / Blendermarket). Flagged to the user; unresolved. If this fork is to be published,
  these must change.
- Earlier TODAY.md / TODO.md was DELETED at the user's request during packaging. It is not in the tree.

---

## 11. OPEN / UNRESOLVED

Priority-ordered. None are known bugs in the shipped path.

1. **`view_context` (UI-only, may be a real bug)** — `render.opengl` defaults to rendering the 3D
   view's current view, not `scene.camera`. The turnaround-camera op sets `scene.camera`. Verify in
   a real UI: create turnaround camera, do NOT switch the viewport to camera view (Numpad 0), then
   playblast. If the output is the viewport and not the camera, add a "use camera view" option.
2. **`pb_gop` shown for intra-frame codecs** — hide it for QTRLE/PROORES/FFV1/HUFFYUV/PNG/DNXHD,
   mirroring Blender's `use_gop`. Table needs maintaining.
3. **Codec↔container compatibility is not validated** — Blender's codec list does not filter by
   container, so e.g. QTRLE+MPEG4 is selectable and fails at encode time. Could add a mapping
   copied from `properties_output.py`.
4. **Render is not cancellable** — `render.opengl(animation=True)` is blocking; a modal operator
   would allow cancel + live failure detection.
5. **Playback depends on an external player** — `render.play_rendered_anim` delegates movies to
   `preferences.filepaths.animation_player`; if unset the user gets "视频播放器错误". Consider
   bundling playback or guiding the user on first run.
6. **Stamp visual quality unverified** — font size default 12 may be too large for e.g. 960x540,
   and position/occlusion were never inspected. Cannot be verified headless.
7. **UI aesthetics unverified** — both panels were tested for correct drawing only. Grouping,
   column alignment and indentation need human/visual inspection.
8. **`pb_gop = 0` semantics** untested.
9. Upstream TODO "Rewrite all addon" — largely satisfied by the §4 refactor; remainder is taste.

---

## 12. QUICK ORIENTATION FOR A NEW SESSION

1. Read §5 (API facts) and §6 (how to test) before editing anything. Both were expensive to learn.
2. To change a render setting: edit `save_render_state` / `restore_render_state` / `render_segment`
   in `op_playblast.py` — but check whether `op_player` also needs it (it calls the shared helpers,
   so usually not).
3. After ANY edit: re-copy to `/tmp/pbtest/addons/playblast_puls`, then run the 15-test suite:
   pb_apply_test pb_marker_test pb_roundtrip pb_player_test pb_realistic pb_realistic_image
   pb_prefs_gop pb_popover_test2 pb_folder_test pb_fixes_test pb_ui_name_test pb_ui_draw_test
   pb_stamp_test pb_codec_test pb_prefs_draw_test
4. Claim nothing without running the suite and reading actual output. Several bugs here were
   only caught because a harness failed after a "safe" edit.
