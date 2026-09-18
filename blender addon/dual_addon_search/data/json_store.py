"""JSON 持久化工具：读取失败回退，写入使用原子替换，并保留上一份备份。"""

import json
import os
import shutil

def backup_path(path: str) -> str:
    """.bak 路径：上一份已知良好内容。"""
    return path + ".bak"

def load_json(path: str, default):
    if not path or not os.path.exists(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as file:
            data = json.load(file)
        return data if isinstance(data, type(default)) else default
    except (OSError, ValueError, TypeError):
        return default

def restore_json(path: str, default):
    """主文件损坏时回退到 .bak；供异常恢复使用。"""
    data = load_json(path, None)
    if data is not None:
        return data
    return load_json(backup_path(path), default)

def save_json(path: str, data, *, indent=None) -> None:
    if not path:
        raise OSError("JSON 保存路径为空")
    directory = os.path.dirname(path)
    if directory:
        os.makedirs(directory, exist_ok=True)

    # 先把当前内容复制为 .bak，再写新内容。
    # 这样即使写入的数据本身是错的（曾因缓存别名 bug 把整份标签写成
    # 仅含 __starred__ 的一条），上一份已知良好内容仍可恢复。
    if os.path.exists(path):
        try:
            shutil.copy2(path, backup_path(path))
        except OSError:
            pass

    temp_path = path + ".tmp"
    try:
        with open(temp_path, "w", encoding="utf-8") as file:
            json.dump(data, file, indent=indent, ensure_ascii=False)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temp_path, path)
    finally:
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except OSError:
            pass
