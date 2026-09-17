import base64
import importlib.util
import json
import re
import struct
import tempfile
from pathlib import Path

import bpy


addon_path = Path(__file__).parents[1] / "__init__.py"
spec = importlib.util.spec_from_file_location("blender_threejs_html_exporter", addon_path)
addon = importlib.util.module_from_spec(spec)
spec.loader.exec_module(addon)

addon.register()
try:
    assert hasattr(bpy.types, "HTML3D_PT_view3d"), "Sidebar panel not registered"
    assert hasattr(bpy.types, "HTML3D_PT_appearance"), "Sub-panel not registered"
    assert hasattr(bpy.types.Scene, "html3d_settings"), "Settings group not registered"

    cube = bpy.data.objects["Cube"]
    cube.keyframe_insert("location", frame=1, index=0)
    cube.location.x = 2
    cube.keyframe_insert("location", frame=20, index=0)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        result = bpy.ops.export_scene.html3d_standalone(
            filepath=str(tmp / "smoke_embedded.html"),
            include_mode="VISIBLE",
            export_animations=True,
            animation_mode="ACTIVE_ACTIONS",
            auto_play_animation=False,
            show_edges_default=False,
            embed_runtime=True,
            environment_lighting=True,
        )
        assert result == {"FINISHED"}, result

        html = tmp.joinpath("smoke_embedded.html").read_text(encoding="utf-8")
        match = re.search(r'const embeddedGLB = "([A-Za-z0-9+/=]+)";', html)
        assert match, "Embedded GLB not found"
        glb = base64.b64decode(match.group(1))
        assert glb[:4] == b"glTF", glb[:4]

        json_length = struct.unpack_from("<I", glb, 12)[0]
        document = json.loads(glb[20:20 + json_length].decode("utf-8"))
        assert document.get("meshes"), "GLB has no meshes"
        assert document.get("animations"), "GLB has no animations"
        assert "if (edgesVisible) buildEdges();" in html
        assert "mixer.setTime(t);" in html
        assert "PMREMGenerator" in html and "RoomEnvironment" in html
        assert "environmentLighting = true" in html, "Environment flag not on"
        assert "environmentLighting = false" not in html
        assert "envIntensity = 2.0" in html, "Env intensity default missing"
        assert "data:image/jpeg;base64" in html, "World env equirect not embedded"
        assert "SAOPass" in html, "SSAO missing"
        assert "const aoDefault = true" in html, "AO default on missing"

        assert "if (composer && aoOn) composer.render(); else renderer.render(scene, camera);" in html, \
            "Screenshot must render through the composer"
        assert "if (bpy.data.actions:" not in open(addon_path, encoding="utf-8").read(), \
            "Orphan-action shortcut must be gone"
        assert not list(tmp.glob("*.part")), "Atomic write left a .part file"

        importmap_match = re.search(
            r'<script type="importmap">\s*({.*})\s*</script>', html
        )
        assert importmap_match, "Importmap not found"
        imports = json.loads(importmap_match.group(1))["imports"]
        assert imports["three"].startswith("data:text/javascript;base64,"), "Runtime not embedded"
        three_source = base64.b64decode(imports["three"].split(",", 1)[1])
        assert len(three_source) > 1_000_000, f"three.module.js too small: {len(three_source)}"
        assert b"revision" in three_source, "three.module.js content unexpected"
        for key in ("three/addons/loaders/GLTFLoader.js",
                    "three/addons/controls/OrbitControls.js",
                    "three/addons/environments/RoomEnvironment.js",
                    "three/addons/utils/BufferGeometryUtils.js",
                    "three/addons/postprocessing/EffectComposer.js",
                    "three/addons/postprocessing/SAOPass.js",
                    "three/addons/postprocessing/OutputPass.js"):
            assert imports.get(key, "").startswith("data:"), f"{key} not embedded"

        result = bpy.ops.export_scene.html3d_standalone(
            filepath=str(tmp / "smoke_cdn.html"),
            include_mode="VISIBLE",
            export_animations=False,
            embed_runtime=False,
            environment_lighting=False,
        )
        assert result == {"FINISHED"}, result
        html_cdn = tmp.joinpath("smoke_cdn.html").read_text(encoding="utf-8")
        assert '"three/addons/": "https://cdn.jsdelivr.net' in html_cdn, "CDN importmap missing"
        assert "data:text/javascript;base64," not in html_cdn, "Runtime unexpectedly embedded"
        assert "environmentLighting = false" in html_cdn, "Env flag not off"
        assert "environmentLighting = true" not in html_cdn
        assert 'envDataURL = ""' in html_cdn, "Env data URL should be empty when disabled"

        # 空选中导出必须被拦下，而不是静默产出空场景
        bpy.ops.object.select_all(action="DESELECT")
        try:
            result = bpy.ops.export_scene.html3d_standalone(
                filepath=str(tmp / "smoke_empty.html"),
                include_mode="SELECTED",
                embed_runtime=False,
            )
            assert result == {"CANCELLED"}, f"Empty selection should cancel, got {result}"
            assert not (tmp / "smoke_empty.html").exists(), "Cancelled export still wrote a file"
        finally:
            bpy.data.objects["Cube"].select_set(True)

        # 侧边栏设置组 + 面板导出（不经文件对话框），并拦截 webbrowser 验证自动打开
        settings = bpy.context.scene.html3d_settings
        panel_html = tmp / "smoke_panel.html"
        settings.output_path = str(panel_html)
        settings.auto_open = True
        settings.show_edges_default = False
        settings.enable_ao = True
        opened = []
        original_open = addon.webbrowser.open
        addon.webbrowser.open = lambda url: opened.append(url)
        try:
            result = bpy.ops.export_scene.html3d_panel_export()
        finally:
            addon.webbrowser.open = original_open
        assert result == {"FINISHED"}, result
        assert panel_html.exists(), "Panel export did not write output"
        panel_source = panel_html.read_text(encoding="utf-8")
        assert "edgesVisible = false" in panel_source, "Panel settings not applied"
        assert len(opened) == 1 and opened[0].endswith("smoke_panel.html"), opened
finally:
    addon.unregister()

print("SMOKE_TEST_OK")
