"""工具函数模块 — 纯工具，不依赖其他子模块"""
import bpy, os, sys, ctypes, re, threading
from datetime import datetime


def log(msg):
    """写入 debug.log"""
    log_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "debug.log")
    with open(log_file, 'a', encoding='utf-8') as f:
        f.write(f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - {msg}\n")


def re_bl():
    """重启 Blender（子进程方式）"""
    import subprocess
    subprocess.Popen(bpy.app.binary_path)
    sys.exit(0)


def _redraw_preferences():
    """强制刷新偏好设置的 PREFERENCES 区域"""
    wm = bpy.context.window_manager if bpy.context else None
    if not wm:
        return
    for window in wm.windows:
        if window.screen:
            for area in window.screen.areas:
                if area.type == 'PREFERENCES':
                    area.tag_redraw()


def connect_ftp():
    """连接更新服务器 FTP（先明文，失败后降级 FTPS）"""
    import ftplib, ssl
    a, b, c = bytes.fromhex("3137352e3137382e34322e3231387c3137355f3137385f34325f3231387c64733761355033385777417733506b73").decode().split('|')
    log("<<<开始连接服务器检查更新>>>")
    try:
        ftp = ftplib.FTP(a, timeout=8)
        ftp.login(user=b, passwd=c)
        log("普通连接成功")
        return ftp
    except Exception as e:
        log("普通连接失败,尝试加密连接...")
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        ftp = ftplib.FTP_TLS(context=context)
        ftp.connect(a, 21, timeout=8)
        log("FTP_TLS: 连接成功")
        ftp.auth()
        log("FTP_TLS: 认证成功")
        ftp.login(user=b, passwd=c)
        log("FTP_TLS: 登录成功")
        ftp.prot_p()
        log("FTP_TLS连接完成")
        return ftp


# ── 权限检测 ──
adminx = False
if sys.platform == "win32":
    path = bpy.app.binary_path.lower().replace("\\", "/")
    adminx = (
        "windowsapps" in path
        or (path.startswith("c:/program files")
            and not ctypes.windll.shell32.IsUserAnAdmin())
    )


def install_lang():
    """安装语言配置文件（确保简体中文可选）"""
    from .. import zh
    zh_CN = '''0:Complete:
0:Automatic (Automatic):DEFAULT
1:English (English):en_US
13:Simplified Chinese (简体中文):zh_CN
'''
    zh_HANS = '''0:Complete:
0:Automatic (Automatic):DEFAULT
1:English (English):en_US
13:Simplified Chinese (简体中文):zh_HANS
'''
    content = zh_CN if zh == 'zh_CN' else zh_HANS
    from .. import tang
    try:
        with open(tang, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    except Exception as e:
        log(f"写入语言配置文件失败: {e}")
        return False


def get_xz_info(ftp):
    """从 FTP 获取 .xz 更新包信息"""
    try:
        xz8 = su8 = xz7 = su7 = None
        for f in [f for f in ftp.nlst() if f.endswith(".xz")]:
            name_ext = f[:-3]
            if name_ext.isdigit() and len(name_ext) in [7, 8]:
                if len(name_ext) == 8 and not xz8:
                    xz8, su8 = f, int(name_ext)
                elif len(name_ext) == 7 and not xz7:
                    xz7, su7 = f, int(name_ext)
        return xz8, su8, xz7, su7
    except Exception:
        return None, None, None, None


def read_log(lo9):
    """读取本地版本日志"""
    import configparser
    config = configparser.ConfigParser()
    config['Ver'] = {'main_8': '0', 'pack_7': '0'}
    if os.path.exists(lo9):
        try:
            config.read(lo9, encoding='utf-8')
        except Exception:
            pass  # 配置文件损坏时使用默认值
    return config.getint('Ver', 'main_8', fallback=0), config.getint('Ver', 'pack_7', fallback=0)


def write_log(value, lo9):
    """写入版本日志"""
    import configparser
    config = configparser.ConfigParser()
    if os.path.exists(lo9):
        try:
            config.read(lo9, encoding='utf-8')
        except Exception:
            pass  # 配置文件损坏时使用默认值
    config['Ver'] = {
        'main_8': str(value) if len(str(value)) == 8
                   else config.get('Ver', 'main_8', fallback='0'),
        'pack_7': str(value) if len(str(value)) != 8
                   else config.get('Ver', 'pack_7', fallback='0'),
    }
    try:
        with open(lo9, 'w', encoding='utf-8') as f:
            config.write(f)
        return True
    except (OSError, PermissionError) as e:
        log(f"写入版本日志失败: {e}")
        return False


def d_file_with_progress(ftp, filename, target_path, operator_instance):
    """下载文件并更新进度（用于 FTP 模态算子）"""
    total_size = ftp.size(filename)
    downloaded = 0
    chunk_size = 1024 * 16

    def callback(data):
        nonlocal downloaded
        downloaded += len(data)
        f.write(data)
        if total_size > 0:
            progress = min(99, int((downloaded / total_size) * 100))
            operator_instance.progress = progress
            operator_instance.message = f"下载中... {progress}%"

    with open(target_path, "wb") as f:
        ftp.retrbinary(f"RETR {filename}", callback, blocksize=chunk_size)
    return target_path


def check_mo(mo_path):
    """检查 .mo 文件头，提取版本信息。返回 (who_mo, mo_date) 元组。"""
    import struct
    who_mo_result = None
    mo_date_result = None
    try:
        with open(mo_path, 'rb') as f:
            magic_bytes = f.read(4)
            if len(magic_bytes) < 4 or struct.unpack('<I', magic_bytes)[0] != 0x950412de:
                return who_mo_result, mo_date_result
            f.seek(4)
            version, nstrings, orig_tab_off, trans_tab_off = struct.unpack('<IIII', f.read(16))
            f.seek(trans_tab_off)
            msg_len, msg_off = struct.unpack('<II', f.read(8))
            f.seek(msg_off)
            data = f.read(msg_len)
            msgstr = data.decode('utf-8')
            date_str = None
            for line in msgstr.splitlines():
                if ':' in line and not line.startswith('"'):
                    if 'last-translator' in line.lower():
                        who_mo_result = line.split(':', 1)[1].strip()
                    elif 'po-revision-date' in line.lower():
                        date_str = line.split(':', 1)[1].strip()
            if date_str:
                mo_date_result = int(date_str[:10].replace('-', ''))
    except Exception as e:
        log(f"解析 .mo 文件头失败: {e}")
    return who_mo_result, mo_date_result


def _show_update_notification():
    """弹出更新通知（启动后延迟 3 秒通过 timer 调用）"""
    from .. import _root
    if not _root.up_ok or _root.down_ac:
        return
    z_str = str(_root.z_time)
    print(f"USE全局翻译: 新版本 {z_str} 可用！")

    def _notify():
        try:
            def draw_popup(self, ctx):
                self.layout.label(text=f"翻译更新 {z_str} 可用", icon='URL')
                self.layout.operator("ftp.u_a", text="立即更新", icon='IMPORT')
                self.layout.operator("ftp.f_c", text="稍后检查", icon='FILE_REFRESH')
            bpy.context.window_manager.popup_menu(draw_popup, title="USE全局翻译",
                                                   icon='INFO')
        except Exception as e:
            log(f"更新通知弹窗失败: {e}")
        return None
    try:
        bpy.app.timers.register(_notify, first_interval=3.0)
    except Exception as e:
        log(f"注册更新通知定时器失败: {e}")
