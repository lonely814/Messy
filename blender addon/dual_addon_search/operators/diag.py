"""【用途】面板状态自检 - 诊断 USERPREF_PT_addons.draw 的 patch 状态

用于排查「底部重复出现第二组搜索框」类问题：
- 面板 draw 当前是 本插件 / 原生 / 其他函数 / 动态分发器
- 动态分发器中是否残留 bl_pkg.addons_panel_draw（扩展系统）或本插件函数
- 本插件的 _IS_PATCHED / _ORIGINAL_ADDONS_DRAW 状态
"""

import bpy


def collect_panel_diag() -> list:
    """收集面板状态诊断信息（模块级，便于测试/复用）"""
    from ..panels import addon_list as al

    out = []
    panel = al._get_panel_class()
    if panel is None:
        out.append("未找到 USERPREF_PT_addons（面板类不存在）")
        out.append("patch 状态: _IS_PATCHED = %s" % al._IS_PATCHED)
        return out

    cur = getattr(panel, "draw", None)
    if cur is al._safe_patched_addons_draw:
        out.append("✔ 面板 draw = 本插件绘制函数（正常）")
    elif cur is None:
        out.append("✘ 面板 draw = None（异常，面板将空白）")
    else:
        funcs = getattr(cur, "_draw_funcs", None)
        if funcs is not None:
            out.append("⚠ 面板 draw = 动态分发器（共 %d 个函数）：" % len(funcs))
            for f in funcs:
                fn = "%s.%s" % (
                    getattr(f, "__module__", "?"),
                    getattr(f, "__name__", "?"),
                )
                flag = ""
                if "bl_pkg" in fn and "addons_panel_draw" in fn:
                    flag = "  ← 原生扩展面板（与本插件并存会双绘）"
                elif "dual_addon_search" in fn:
                    flag = "  ← 本插件函数（残留）"
                out.append("  · " + fn + flag)
        else:
            fn = "%s.%s" % (
                getattr(cur, "__module__", "?"),
                getattr(cur, "__name__", "?"),
            )
            out.append("· 面板 draw = 其他函数：%s（本插件未接管）" % fn)

    out.append("patch 状态: _IS_PATCHED = %s" % al._IS_PATCHED)
    orig = al._ORIGINAL_ADDONS_DRAW
    if orig is None:
        out.append("原生引用: _ORIGINAL_ADDONS_DRAW = None")
    else:
        on = "%s.%s" % (
            getattr(orig, "__module__", "?"),
            getattr(orig, "__name__", "?"),
        )
        if getattr(orig, "_draw_funcs", None) is not None:
            on += "（动态分发器）"
        out.append("原生引用: _ORIGINAL_ADDONS_DRAW = " + on)
    return out


class DUAL_FIRSTROW_OT_panel_diag(bpy.types.Operator):
    """面板状态自检"""
    bl_idname = "dual_firstrow_addon_search.panel_diag"
    bl_label = "检查面板状态"
    bl_description = "诊断插件面板 draw 当前状态（本插件/原生/动态分发器），排查重复搜索框等问题"
    bl_options = {"INTERNAL"}

    _lines = None  # 非 RNA 属性，仅会话内使用

    def invoke(self, context, event):
        self._lines = collect_panel_diag()
        return context.window_manager.invoke_props_dialog(self, width=620)

    def draw(self, context):
        layout = self.layout
        for line in self._lines or []:
            row = layout.row()
            if line.startswith("✘") or line.startswith("⚠"):
                row.label(text=line, icon="ERROR", translate=False)
            elif line.startswith("✔"):
                row.label(text=line, icon="CHECKMARK", translate=False)
            else:
                row.label(text=line, translate=False)

    def execute(self, context):
        for line in self._lines or []:
            print("[Dual Add-on Search] " + line)
        self.report({"INFO"}, "面板自检完成，详情见系统控制台")
        return {"FINISHED"}
