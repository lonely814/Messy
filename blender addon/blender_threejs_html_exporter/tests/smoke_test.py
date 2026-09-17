import base64
import gzip
import importlib.util
import json
import re
import struct
import tempfile
import zlib
from pathlib import Path

import bpy


def _decompress_bytes(b64, fmt):
    raw = base64.b64decode(b64)
    if fmt == "gzip":
        return gzip.decompress(raw)
    if fmt == "deflate":
        return zlib.decompress(raw)
    if fmt == "brotli":
        return __import__("brotli").decompress(raw)
    return raw


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
        meta_match = re.search(r'window\.__viewerMeta = (\{.*?\});', html)
        assert meta_match, "Viewer meta not found"
        meta = json.loads(meta_match.group(1))
        assert meta["glbFormat"] in ("gzip", "deflate", "brotli", None), meta["glbFormat"]
        assert meta["glbFormat"], "GLB should be compressed on this platform"
        assert meta["runtimeFormat"], "Runtime should be compressed on this platform"
        glb = _decompress_bytes(meta["glb"], meta["glbFormat"])
        assert glb[:4] == b"glTF", glb[:4]
        # 压缩必须真的省体积，否则功能形同虚设
        assert len(meta["glb"]) < len(base64.b64encode(glb)), "Compressed payload not smaller"

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
        assert not importmap_match, "Importmap must be built at runtime, not inlined"
        imports = json.loads(_decompress_bytes(meta["runtime"], meta["runtimeFormat"]))
        assert "export" in imports["three"], "Runtime source is not JavaScript"
        three_source = imports["three"].encode("utf-8")
        assert len(three_source) > 1_000_000, f"three.module.js too small: {len(three_source)}"
        assert "revision" in imports["three"], "three.module.js content unexpected"
        for key in ("three/addons/loaders/GLTFLoader.js",
                    "three/addons/controls/OrbitControls.js",
                    "three/addons/environments/RoomEnvironment.js",
                    "three/addons/utils/BufferGeometryUtils.js",
                    "three/addons/postprocessing/EffectComposer.js",
                    "three/addons/postprocessing/SAOPass.js",
                    "three/addons/postprocessing/OutputPass.js"):
            assert key in imports, f"{key} not embedded"
        # 运行库相对导入必须在导出时改写完，否则 data/blob URL 模块解析不到
        assert not re.search(r'from\s*["\']\.\.?/', imports["three/addons/loaders/GLTFLoader.js"]), \
            "Unrewritten relative import in runtime"
        assert "DecompressionStream" in html, "Native decompression pipeline missing"
        assert "function bootstrapViewer" in html, "Viewer bootstrap missing"

        # 场景相机机位导出（帧型/位置/视角）
        cam_data = bpy.data.cameras.new("smoke_cam")
        cam_obj = bpy.data.objects.new("smoke_cam", cam_data)
        bpy.context.scene.collection.objects.link(cam_obj)
        bpy.context.scene.camera = cam_obj
        cam_obj.location = (0.0, -10.0, 0.0)
        cam_data.type = "ORTHO"
        cam_data.ortho_scale = 7.5
        try:
            result = bpy.ops.export_scene.html3d_standalone(
                filepath=str(tmp / "smoke_cam.html"),
                include_mode="VISIBLE", embed_runtime=False, environment_lighting=False,
                use_scene_camera=True,
            )
            assert result == {"FINISHED"}, result
            cam_html = tmp.joinpath("smoke_cam.html").read_text(encoding="utf-8")
            cd = json.loads(re.search(r'const cameraData = (\{.*?\});', cam_html).group(1))
            assert cd["ortho"] is True, cd
            assert cd["orthoScale"] == 7.5, cd
            # Blender Z-up (0,-10,0) → Three Y-up (0,0,10)
            assert cd["position"] == [0.0, 0.0, 10.0], cd
            assert "fov" not in cd, "Ortho camera should not export fov"
        finally:
            bpy.context.scene.camera = None
            bpy.data.objects.remove(cam_obj, do_unlink=True)
            bpy.data.cameras.remove(cam_data, do_unlink=True)

        # 关闭该选项时必须回落为自动适配
        result = bpy.ops.export_scene.html3d_standalone(
            filepath=str(tmp / "smoke_nocam.html"),
            include_mode="VISIBLE", embed_runtime=False, environment_lighting=False,
            use_scene_camera=False,
        )
        assert "const cameraData = null;" in tmp.joinpath("smoke_nocam.html").read_text(encoding="utf-8"), \
            "Camera export must fall back to auto-fit when disabled"

        result = bpy.ops.export_scene.html3d_standalone(
            filepath=str(tmp / "smoke_cdn.html"),
            include_mode="VISIBLE",
            export_animations=False,
            embed_runtime=False,
            environment_lighting=False,
        )
        assert result == {"FINISHED"}, result
        html_cdn = tmp.joinpath("smoke_cdn.html").read_text(encoding="utf-8")
        cdn_meta = json.loads(re.search(r'window\.__viewerMeta = (\{.*?\});', html_cdn).group(1))
        assert cdn_meta["runtimeFormat"] is None, "Runtime should not be embedded when disabled"
        assert cdn_meta["runtime"] is None
        assert cdn_meta["runtimeCDN"] and "cdn.jsdelivr.net" in cdn_meta["runtimeCDN"]["three"], "CDN fallback missing"
        assert "environmentLighting = false" in html_cdn, "Env flag not off"
        assert "environmentLighting = true" not in html_cdn
        assert 'envDataURL = ""' in html_cdn, "Env data URL should be empty when disabled"

        # 场景灯光导出（KHR_lights_punctual）
        light_data = bpy.data.lights.new("smoke_light", type="POINT")
        light_obj = bpy.data.objects.new("smoke_light", light_data)
        bpy.context.scene.collection.objects.link(light_obj)
        light_data.energy = 500.0
        try:
            result = bpy.ops.export_scene.html3d_standalone(
                filepath=str(tmp / "smoke_lights.html"),
                include_mode="VISIBLE", embed_runtime=False, environment_lighting=False,
                export_lights=True, light_scale=2.5,
            )
            assert result == {"FINISHED"}, result
            light_html = tmp.joinpath("smoke_lights.html").read_text(encoding="utf-8")
            light_meta = json.loads(re.search(r'window\.__viewerMeta = (\{.*?\});', light_html).group(1))
            light_glb = _decompress_bytes(light_meta["glb"], light_meta["glbFormat"])
            light_len = struct.unpack_from("<I", light_glb, 12)[0]
            light_doc = json.loads(light_glb[20:20 + light_len].decode("utf-8"))
            assert "KHR_lights_punctual" in light_doc.get("extensionsUsed", []), \
                "Light extension not exported"
            exported = light_doc["extensions"]["KHR_lights_punctual"]["lights"]
            assert any(l["type"] == "point" for l in exported), exported
            assert "const sceneLightScale = 2.5;" in light_html, "Light scale not applied"
            assert "function handleLightSetup" in light_html, "Light handler missing"
        finally:
            bpy.data.objects.remove(light_obj, do_unlink=True)
            bpy.data.lights.remove(light_data, do_unlink=True)

        # 关闭灯光导出时必须不写入灯光扩展
        result = bpy.ops.export_scene.html3d_standalone(
            filepath=str(tmp / "smoke_nolights.html"),
            include_mode="VISIBLE", embed_runtime=False, environment_lighting=False,
            export_lights=False,
        )
        assert result == {"FINISHED"}, result
        no_light_html = tmp.joinpath("smoke_nolights.html").read_text(encoding="utf-8")
        no_light_meta = json.loads(re.search(r'window\.__viewerMeta = (\{.*?\});', no_light_html).group(1))
        no_light_glb = _decompress_bytes(no_light_meta["glb"], no_light_meta["glbFormat"])
        no_light_len = struct.unpack_from("<I", no_light_glb, 12)[0]
        no_light_doc = json.loads(no_light_glb[20:20 + no_light_len].decode("utf-8"))
        assert "KHR_lights_punctual" not in no_light_doc.get("extensionsUsed", []), \
            "Lights exported while disabled"

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
