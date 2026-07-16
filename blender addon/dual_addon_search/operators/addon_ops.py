"""【用途】插件操作 - 打开文件夹、移除插件、Google 搜索、右键菜单"""

import os
import sys
import bpy
from bpy.props import StringProperty

from ..utils.ui_helpers import redraw_preferences


class DUAL_FIRSTROW_OT_open_addon_folder(bpy.types.Operator):
    """打开插件文件夹"""
    bl_idname = "dual_firstrow_addon_search.open_folder"
    bl_label = "打开插件文件夹"
    bl_description = "在系统文件管理器中打开这个插件所在文件夹"

    filepath: StringProperty(
        name="插件文件路径",
        default="",
        options={"HIDDEN"},
    )

    def execute(self, context):
        filepath = bpy.path.abspath(self.filepath) if self.filepath else ""

        if not filepath:
            self.report({"WARNING"}, "没有找到插件文件路径")
            return {"CANCELLED"}

        folder = filepath if os.path.isdir(filepath) else os.path.dirname(filepath)

        if not folder or not os.path.exists(folder):
            self.report({"WARNING"}, "插件文件夹不存在")
            return {"CANCELLED"}

        try:
            bpy.ops.wm.path_open(filepath=folder)
            return {"FINISHED"}
        except Exception:
            pass

        try:
            import subprocess
            if sys.platform.startswith("win"):
                os.startfile(folder)
            elif sys.platform == "darwin":
                subprocess.Popen(["open", folder])
            else:
                subprocess.Popen(["xdg-open", folder])
            return {"FINISHED"}
        except Exception as ex:
            self.report({"ERROR"}, "打开插件文件夹失败: %s" % ex)
            return {"CANCELLED"}


class DUAL_FIRSTROW_OT_google_search(bpy.types.Operator):
    """Google 搜索"""
    bl_idname = "dual_firstrow_addon_search.google_search"
    bl_label = "Google 搜索"
    bl_description = "在 Google 中搜索该插件的名称和作者"
    bl_options = {"INTERNAL"}

    module_name: StringProperty(options={"HIDDEN"})
    addon_name: StringProperty(options={"HIDDEN"})
    addon_author: StringProperty(options={"HIDDEN"})

    def execute(self, context):
        from urllib.parse import quote
        query = f"{self.addon_name} {self.addon_author} Blender"
        url = f"https://www.google.com/search?q={quote(query)}"
        bpy.ops.wm.url_open(url=url)
        return {"FINISHED"}


class DUAL_FIRSTROW_OT_context_menu(bpy.types.Operator):
    """打开插件菜单"""
    bl_idname = "dual_firstrow_addon_search.context_menu"
    bl_label = "打开插件菜单"
    bl_description = "打开插件操作菜单"
    bl_options = {"INTERNAL"}

    module_name: StringProperty(options={"HIDDEN"})
    addon_name: StringProperty(options={"HIDDEN"})
    addon_author: StringProperty(options={"HIDDEN"})
    addon_file: StringProperty(options={"HIDDEN"})
    addon_doc_url: StringProperty(options={"HIDDEN"})

    def execute(self, context):
        wm = context.window_manager
        wm.dual_ctx_module = self.module_name
        wm.dual_ctx_name = self.addon_name
        wm.dual_ctx_author = self.addon_author
        wm.dual_ctx_file = self.addon_file
        wm.dual_ctx_doc_url = self.addon_doc_url
        bpy.ops.wm.call_menu(name="DUAL_FIRSTROW_MT_addon_actions")
        return {"FINISHED"}


class DUAL_FIRSTROW_OT_copy_text(bpy.types.Operator):
    """复制文本"""
    bl_idname = "dual_firstrow_addon_search.copy_text"
    bl_label = "复制"
    bl_description = "复制到剪贴板"

    text_to_copy: StringProperty(options={"HIDDEN"})

    def execute(self, context):
        context.window_manager.clipboard = self.text_to_copy
        self.report({"INFO"}, f"已复制: {self.text_to_copy}")
        return {"FINISHED"}


class DUAL_FIRSTROW_OT_link_github(bpy.types.Operator):
    """手动关联 GitHub 仓库"""
    bl_idname = "dual_firstrow_addon_search.link_github"
    bl_label = "关联 GitHub 仓库"
    bl_description = "手动关联此插件的 GitHub 仓库以显示星标和下载量"
    bl_options = {"REGISTER", "INTERNAL"}

    module_name: StringProperty(
        name="模块名",
        default="",
        options={"HIDDEN"},
    )
    repo: StringProperty(
        name="GitHub Repository",
        description="格式: owner/repo (例如: CYX66/DualAddonSearch)",
        default="",
    )

    def invoke(self, context, event):
        wm = context.window_manager
        return wm.invoke_props_dialog(self)

    def draw(self, context):
        self.layout.prop(self, "repo")

    def execute(self, context):
        repo = self.repo.strip()
        if repo:
            if "/" not in repo or len(repo.split("/")) != 2:
                self.report({"ERROR"}, "格式错误，需要 owner/repo")
                return {"CANCELLED"}
            from ..utils.cache import set_github_cache
            set_github_cache(repo, 0, 0)
        redraw_preferences()
        self.report({"INFO"}, f"已关联 {repo}" if repo else "已取消关联")
        return {"FINISHED"}


class DUAL_FIRSTROW_OT_remove_addon(bpy.types.Operator):
    """移除插件"""
    bl_idname = "dual_firstrow_addon_search.remove"
    bl_label = "移除插件"
    bl_description = "移除这个插件；普通插件走原生移除，扩展插件走扩展卸载接口"
    bl_options = {"REGISTER", "INTERNAL"}

    module: StringProperty(
        name="插件模块",
        default="",
        options={"HIDDEN"},
    )

    filepath: StringProperty(
        name="插件文件路径",
        default="",
        options={"HIDDEN"},
    )

    def invoke(self, context, event):
        return context.window_manager.invoke_confirm(self, event)

    def execute(self, context):
        from ..utils.cache import clear_search_caches
        clear_search_caches()

        module_name = (self.module or "").strip()
        module_file = bpy.path.abspath(self.filepath) if self.filepath else ""

        if not module_name:
            self.report({"WARNING"}, "没有找到插件模块名")
            return {"CANCELLED"}

        errors = []

        try:
            if module_name in context.preferences.addons:
                bpy.ops.preferences.addon_disable(module=module_name)
        except Exception as ex:
            errors.append("禁用失败: %s" % ex)

        try:
            ret = bpy.ops.preferences.addon_remove(module=module_name)
            if "FINISHED" in ret:
                redraw_preferences()
                self.report({"INFO"}, "已移除插件")
                return {"FINISHED"}
        except Exception as ex:
            errors.append("普通插件移除失败: %s" % ex)

        # --- 扩展插件卸载 fallback ---
        repo_info = _get_extension_repo_info(context, module_name, module_file)
        pkg_id = repo_info.get("pkg_id", "")
        if pkg_id and hasattr(bpy.ops, "extensions"):
            # 尝试多种参数组合以兼容不同 Blender 版本
            call_kwargs_list = []
            repo_directory = repo_info.get("repo_directory", "")
            repo_index = repo_info.get("repo_index", -1)

            if repo_directory:
                call_kwargs_list.append({
                    "repo_directory": repo_directory,
                    "repo_index": repo_index,
                    "pkg_id": pkg_id,
                })
            if repo_index != -1:
                call_kwargs_list.append({
                    "repo_index": repo_index,
                    "pkg_id": pkg_id,
                })
            call_kwargs_list.append({"pkg_id": pkg_id})

            for kwargs in call_kwargs_list:
                try:
                    ret = bpy.ops.extensions.package_uninstall(**kwargs)
                    if "FINISHED" in ret:
                        try:
                            bpy.ops.preferences.addon_refresh()
                        except Exception:
                            pass
                        redraw_preferences()
                        self.report({"INFO"}, "已卸载扩展插件")
                        return {"FINISHED"}
                except Exception as ex:
                    errors.append("扩展插件卸载失败: %s" % ex)

        # 手动移除文件
        try:
            removed = _manual_remove_addon_path(context, module_file)
            try:
                bpy.ops.preferences.addon_refresh()
            except Exception:
                pass
            redraw_preferences()
            self.report({"INFO"}, "已移除插件文件: %s" % removed)
            return {"FINISHED"}
        except Exception as ex:
            errors.append("手动移除失败: %s" % ex)

        self.report({"ERROR"}, "移除失败，详情见控制台")
        print("[Dual Add-on Search] Remove failed for %s" % module_name)
        for line in errors:
            print("  -", line)
        return {"CANCELLED"}


def _extension_module_parts(module_name: str):
    """分解扩展插件模块名 → (repo_module, pkg_id)"""
    parts = (module_name or "").split(".")
    if len(parts) >= 3 and parts[0] == "bl_ext":
        return parts[1], parts[2]
    return "", ""


def _get_extension_repo_info(context, module_name: str, module_file: str = ""):
    """获取扩展插件所在仓库信息"""
    import bpy
    repo_module, pkg_id = _extension_module_parts(module_name)
    result = {
        "repo_module": repo_module,
        "pkg_id": pkg_id,
        "repo_index": -1,
        "repo_directory": "",
    }

    if not repo_module or not pkg_id:
        return result

    try:
        prefs = context.preferences
        extensions = getattr(prefs, "extensions", None)
        repos = getattr(extensions, "repos", None) if extensions else None
    except Exception:
        repos = None

    if not repos:
        return result

    abs_file = ""
    try:
        abs_file = bpy.path.abspath(module_file) if module_file else ""
    except Exception:
        abs_file = module_file or ""

    for index, repo in enumerate(repos):
        repo_dir = str(getattr(repo, "directory", "") or "")
        repo_dir_abs = ""
        try:
            repo_dir_abs = bpy.path.abspath(repo_dir) if repo_dir else ""
        except Exception:
            repo_dir_abs = repo_dir

        names = {
            str(getattr(repo, "module", "") or ""),
            str(getattr(repo, "name", "") or ""),
            str(getattr(repo, "id", "") or ""),
        }

        by_name = repo_module in names
        by_path = False
        if abs_file and repo_dir_abs:
            try:
                by_path = bpy.path.is_subdir(abs_file, repo_dir_abs)
            except Exception:
                by_path = False

        if by_name or by_path:
            result["repo_index"] = index
            result["repo_directory"] = repo_dir_abs or repo_dir
            return result

    return result


def _manual_remove_addon_path(context, module_file: str) -> str:
    """手动移除插件文件"""
    import shutil
    import stat

    target = _remove_target_from_module_file(module_file)
    if not target or not os.path.exists(target):
        raise RuntimeError("没有找到可删除的插件文件")

    if ".zip" in os.path.normpath(target).split(os.sep):
        raise RuntimeError("该插件位于 .zip 压缩包内，不支持自动移除，请手动删除")

    roots = _known_removable_roots(context)
    allowed = False
    for root in roots:
        if _safe_is_subdir(target, root) and os.path.realpath(target) != os.path.realpath(root):
            allowed = True
            break

    if not allowed:
        raise RuntimeError("为安全起见，只允许移除用户插件目录或用户扩展目录里的插件")

    def _rmtree_onerror(func, path, exc_info):
        if not os.access(path, os.W_OK):
            os.chmod(path, stat.S_IWRITE)
            func(path)
        else:
            raise

    if os.path.isdir(target):
        if os.path.islink(target):
            os.unlink(target)
        else:
            shutil.rmtree(target, onerror=_rmtree_onerror)
    else:
        if not os.access(target, os.W_OK):
            os.chmod(target, stat.S_IWRITE)
        os.remove(target)

    return target


def _remove_target_from_module_file(module_file: str) -> str:
    if not module_file:
        return ""
    path = bpy.path.abspath(module_file)
    if os.path.isdir(path):
        return path
    if os.path.basename(path) == "__init__.py":
        return os.path.dirname(path)
    return path


def _safe_is_subdir(path: str, directory: str) -> bool:
    try:
        if path and directory:
            return bpy.path.is_subdir(path, directory)
    except Exception:
        pass
    try:
        path = os.path.realpath(path)
        directory = os.path.realpath(directory)
        common = os.path.commonpath([path, directory])
        return common == directory
    except Exception:
        return False


def _known_removable_roots(context) -> list:
    roots = []

    def add(path):
        if not path:
            return
        try:
            path = bpy.path.abspath(path)
        except Exception:
            pass
        if path and os.path.exists(path) and path not in roots:
            roots.append(path)

    try:
        prefs = context.preferences
        script_dir = getattr(prefs.filepaths, "script_directory", "")
        if script_dir:
            add(os.path.join(script_dir, "addons"))
    except Exception:
        pass

    try:
        add(bpy.utils.user_resource("SCRIPTS", path="addons"))
    except Exception:
        pass

    try:
        add(bpy.utils.user_resource("EXTENSIONS"))
    except Exception:
        pass

    try:
        prefs = context.preferences
        extensions = getattr(prefs, "extensions", None)
        repos = getattr(extensions, "repos", None) if extensions else None
        if repos:
            for repo in repos:
                add(getattr(repo, "directory", ""))
    except Exception:
        pass

    return roots


class DUAL_FIRSTROW_MT_addon_actions(bpy.types.Menu):
    """插件操作菜单"""
    bl_label = "插件操作"
    bl_idname = "DUAL_FIRSTROW_MT_addon_actions"

    def draw(self, context):
        layout = self.layout
        wm = context.window_manager

        name = getattr(wm, "dual_ctx_name", "")
        mod = getattr(wm, "dual_ctx_module", "")
        author = getattr(wm, "dual_ctx_author", "")
        fpath = getattr(wm, "dual_ctx_file", "")
        doc_url = getattr(wm, "dual_ctx_doc_url", "")

        layout.label(text=f"「{name}」", icon="PLUGIN")
        layout.separator()

        # 复制名称
        op = layout.operator("dual_firstrow_addon_search.copy_text", text="复制名称", icon="COPYDOWN")
        op.text_to_copy = name

        # 复制模块名
        op = layout.operator("dual_firstrow_addon_search.copy_text", text="复制模块名", icon="COPYDOWN")
        op.text_to_copy = mod

        # 复制作者
        if author:
            op = layout.operator("dual_firstrow_addon_search.copy_text", text="复制作者", icon="COPYDOWN")
            op.text_to_copy = author

        layout.separator()

        # Google 搜索
        op = layout.operator("dual_firstrow_addon_search.google_search", text="Google 搜索", icon="URL")
        op.module_name = mod
        op.addon_name = name
        op.addon_author = author

        # 打开文件夹
        if fpath:
            op = layout.operator("dual_firstrow_addon_search.open_folder", text="打开文件夹", icon="FILE_FOLDER")
            op.filepath = fpath

        # 打开网站
        if doc_url:
            layout.operator("wm.url_open", text="打开网站", icon="WORLD").url = doc_url

        layout.separator()

        # 标签子菜单
        layout.menu("DUAL_FIRSTROW_MT_tag_menu", text="标签管理", icon="TAG")
