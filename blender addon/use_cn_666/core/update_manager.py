"""更新管理模块 — 检查 / 下载 / 应用汉化包更新"""
import bpy, os, threading, shutil, lzma
from .utils import (log, connect_ftp, get_xz_info, read_log, write_log,
                    d_file_with_progress, check_mo)
from .. import _root
from .. import (pmo, mo_dir, lo9, tang, who_mo, mo_date)


def c_updates():
    """检查是否有新更新（后台线程用，不抛异常）"""
    from .utils import install_lang
    ftp = None
    try:
        ftp = connect_ftp()
        xz8, su8, xz7, su7 = get_xz_info(ftp)
        log("检查更新完成")
        if not xz8 and not xz7:
            return
        main_8, pack_7 = read_log(lo9)
        if who_mo != 'bude':
            main_8 = 0
            write_log("00000000", lo9)
        if not os.path.exists(pmo):
            pack_7 = 0
            write_log("0000000", lo9)
        if main_8 == 0 and who_mo == 'bude':
            write_log(mo_date, lo9)
            if xz8 and su8 > mo_date:
                _root.up_ok, _root.z_file, _root.z_time = True, xz8, su8
        else:
            if xz8 and su8 and (main_8 == 0 or su8 > main_8):
                _root.up_ok, _root.z_file, _root.z_time = True, xz8, su8
            elif not _root.up_ok and xz7 and su7 and (pack_7 == 0 or su7 > pack_7):
                _root.up_ok, _root.z_file, _root.z_time = True, xz7, su7
    except Exception as e:
        error_type = type(e).__name__
        error_messages = {
            'timeout': '网络超时，请稍后重试',
            'TimeoutError': '网络超时，请稍后重试',
            'ConnectionRefusedError': '服务器拒绝连接，可能维护中',
            'ConnectionResetError': '连接被重置，网络不稳定',
            'ConnectionAbortedError': '连接被中止，网络不稳定',
            'gaierror': '无法解析服务器地址，请检查DNS',
            'socket.gaierror': '无法解析服务器地址，请检查DNS',
            'OSError': '网络连接失败，请检查网络',
            'ConnectionError': '网络连接错误',
        }
        chinese_msg = error_messages.get(error_type, error_type)
        print(f"检查更新失败: {chinese_msg}")
    finally:
        if ftp is not None:
            try:
                ftp.quit()
            except Exception:
                pass


def update_a():
    """检查更新（同步，供算子按钮触发）"""
    _root.up_ok = False  # 先清零，避免上次状态残留导致无限下载
    ftp = None
    try:
        ftp = connect_ftp()
        xz8, su8, xz7, su7 = get_xz_info(ftp)
        log("检查更新完成")
        if not xz8 and not xz7:
            return
        main_8, pack_7 = read_log(lo9)
        if xz8 and su8 and (main_8 == 0 or su8 > main_8):
            _root.up_ok, _root.z_file, _root.z_time = True, xz8, su8
        elif not _root.up_ok and xz7 and su7 and (pack_7 == 0 or su7 > pack_7):
            _root.up_ok, _root.z_file, _root.z_time = True, xz7, su7
    except Exception as e:
        log(f"检查更新失败: {e}")
    finally:
        if ftp is not None:
            try:
                ftp.quit()
            except Exception:
                pass


def update_p():
    """下载完成后处理（重启前调用）"""
    update_a()
    if _root.up_ok:
        bpy.ops.ftp.u_a()
    else:
        from .utils import re_bl
        bpy.app.timers.register(re_bl, first_interval=1.0)


def download_worker(z_file, z_time, progress_obj):
    """后台下载线程：从 FTP 下载 .xz → 解压 → 写入 .mo"""
    import shutil, lzma
    try:
        progress_obj.progress = 0
        ftp = connect_ftp()
        if not z_file:
            progress_obj.message = "错误：未找到更新文件信息,也许网络原因,请重试!"
            return
        mulu = os.path.dirname(os.path.dirname(__file__))
        temp = os.path.join(mulu, "temp")
        os.makedirs(temp, exist_ok=True)
        xz_path = os.path.join(temp, z_file)
        progress_obj.message = "开始下载..."
        d_file_with_progress(ftp, z_file, xz_path, progress_obj)
        progress_obj.message = "解压文件中..."
        z_len = len(str(z_time))
        if z_len == 8:
            os.makedirs(mo_dir, exist_ok=True)
            mo_p = os.path.join(mo_dir, 'blender.mo')
        else:
            mo_p = pmo
        with lzma.open(xz_path, 'rb') as f:
            with open(mo_p, 'wb') as target:
                shutil.copyfileobj(f, target)
        write_log(z_time, lo9)
        if os.path.exists(temp):
            shutil.rmtree(temp)
        if z_len == 8:
            from .utils import install_lang
            if not os.path.exists(tang):
                install_lang()
            if os.path.exists(pmo):
                os.remove(pmo)
        progress_obj.message = "更新完成!"
        progress_obj.progress = 100
    except Exception as e:
        progress_obj.message = f"网络原因,更新失败: {str(e)}"
    finally:
        try:
            if ftp is not None:
                ftp.quit()
        except Exception as e:
            log(f"FTP 关闭失败: {e}")
