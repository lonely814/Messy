import bpy

addon_keymaps = []


def register():
    wm = bpy.context.window_manager
    kc = wm.keyconfigs.addon
    if kc:
        km = kc.keymaps.new(name='Screen', space_type='EMPTY')
        kmi_player = km.keymap_items.new(
            "playblast_puls.player", type='F11', value='PRESS', ctrl=True, shift=True)
        kmi_playblast = km.keymap_items.new(
            "playblast_puls.playblast", type='F12', value='PRESS', ctrl=True, shift=True)
        addon_keymaps.append((km, kmi_player))
        addon_keymaps.append((km, kmi_playblast))


def unregister():
    for km, kmi in addon_keymaps:
        km.keymap_items.remove(kmi)
    addon_keymaps.clear()