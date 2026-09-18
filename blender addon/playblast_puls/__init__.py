# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation; either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful, but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTIBILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
# General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. If not, see <http://www.gnu.org/licenses/>.

bl_info = {
    "name": "Playblast Puls \u5feb\u7167",
    "author": "carlosmu <carlos.damian.munoz@gmail.com>",
    "blender": (3, 6, 0),
    "version": (1, 0, 0),
    "category": "Animation",
    "location": "3D View \u4e3b\u83dc\u5355 / \u53f3\u952e\u83dc\u5355",
    "description": "\u5c06\u6e32\u67d3\u8bbe\u7f6e\u548c\u5feb\u7167\u8bbe\u7f6e\u5206\u5f00\u7ba1\u7406\uff0c\u4e0d\u5f71\u54cd\u6b63\u5f0f\u6e32\u67d3\u914d\u7f6e",
    "warning": "",
    "doc_url": "https://blendermarket.com/products/playblast",
    "tracker_url": "https://blendermarket.com/creators/carlosmu",
}

import bpy
import importlib

####################################
# IMPORT MODULES
####################################

from . import keymap
from . import op_open_filebrowser
from . import op_open_preferences
from . import op_playblast
from . import op_player
from . import op_turnaround_camera
from . import op_version_numbering
from . import pt_popover
from . import user_prefs

# For reaload modules when updating addon
if "bpy" in locals():
    importlib.reload(keymap)
    importlib.reload(op_open_filebrowser)
    importlib.reload(op_open_preferences)
    importlib.reload(op_playblast)
    importlib.reload(op_player)
    importlib.reload(op_turnaround_camera)
    importlib.reload(op_version_numbering)
    importlib.reload(pt_popover)
    importlib.reload(user_prefs)


####################################
# REGISTER/UNREGISTER
####################################


def register():
    keymap.register()
    op_open_filebrowser.register()
    op_open_preferences.register()
    op_playblast.register()
    op_player.register()
    op_turnaround_camera.register()
    op_version_numbering.register()
    pt_popover.register()
    user_prefs.register()


def unregister():
    keymap.unregister()
    op_open_filebrowser.unregister()
    op_open_preferences.unregister()
    op_playblast.unregister()
    op_player.unregister()
    op_turnaround_camera.unregister()
    op_version_numbering.unregister()
    pt_popover.unregister()
    user_prefs.unregister()