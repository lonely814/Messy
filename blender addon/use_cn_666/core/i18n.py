"""国际化 / 翻译引擎模块 — AI 翻译 + .mo 加载"""
import bpy, os, json, urllib.request, urllib.error, gettext, re as _re
from .. import (zh, pmo, AI_CACHE_FILE, AI_TRANSLATIONS_ID,
                _translation_stats, mo_date)


def _load_ai_cache():
    """读取 AI 翻译缓存 JSON"""
    if not os.path.exists(AI_CACHE_FILE):
        return {}
    try:
        with open(AI_CACHE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        from .utils import log
        log(f"读取 AI 缓存失败: {e}")
        return {}


def _save_ai_cache(cache):
    """保存 AI 翻译缓存 JSON"""
    try:
        with open(AI_CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
    except Exception as e:
        from .utils import log
        log(f"保存 AI 缓存失败: {e}")


def _ai_translate_batch(texts, api_key, provider="deepseek"):
    """调用 AI API 批量翻译。成功返回 [译文,...]，失败抛出 RuntimeError"""
    if not texts or not api_key:
        raise ValueError("缺少 API Key 或待翻译文本")
    url = ("https://api.deepseek.com/v1/chat/completions" if provider == "deepseek"
           else "https://api.openai.com/v1/chat/completions")
    model = "deepseek-chat" if provider == "deepseek" else "gpt-3.5-turbo"

    lines = [f"[{i}] {t}" for i, t in enumerate(texts)]
    prompt = (
        "你是 Blender 插件翻译专家。将以下名称翻译为简体中文。\n"
        "规则：- 专业术语准确  - 品牌名保留原文  - 每行 [序号] 译文\n"
        + "\n".join(lines)
    )
    data = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1, "max_tokens": 4096,
    }

    req = urllib.request.Request(
        url, data=json.dumps(data).encode('utf-8'),
        headers={"Authorization": f"Bearer {api_key}",
                 "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read()
            charset = resp.headers.get_content_charset() or 'utf-8'
            body = json.loads(raw.decode(charset))
            content = body["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as e:
        status = e.code
        detail = ""
        try:
            raw = e.read()
            detail = json.loads(raw.decode('utf-8', errors='replace'))["error"]["message"]
        except Exception:
            detail = str(e)
        raise RuntimeError(f"API 请求失败 (HTTP {status}): {detail}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"网络连接失败: {e.reason}")
    except (KeyError, json.JSONDecodeError) as e:
        raise RuntimeError(f"API 返回格式异常: {e}")
    except Exception as e:
        raise RuntimeError(f"未知错误: {e}")

    results = [""] * len(texts)
    for line in content.split("\n"):
        m = _re.match(r'^\s*\[(\d+)\]\s*(.+)$', line.strip())
        if m:
            idx = int(m.group(1))
            if 0 <= idx < len(texts):
                results[idx] = m.group(2).strip()
    return results


def _register_ai_translations(cache_dict):
    """注册 AI 翻译到 Blender 翻译系统"""
    from .utils import log
    if not cache_dict:
        return
    try:
        bpy.app.translations.unregister(AI_TRANSLATIONS_ID)
    except RuntimeError:
        pass  # 尚未注册，忽略
    mo_style = {}
    for src, tgt in cache_dict.items():
        if src and tgt:
            mo_style.setdefault(zh, {})[("*", src)] = tgt
    if mo_style:
        try:
            bpy.app.translations.register(AI_TRANSLATIONS_ID, mo_style)
        except Exception as e:
            log(f"注册 AI 翻译失败: {e}")


def _collect_untranslated_addon_names():
    """扫描已安装插件，返回未被 .mo 或 AI 缓存覆盖的名称列表"""
    from .utils import log
    names = set()
    try:
        import addon_utils
        for mod in addon_utils.modules(refresh=False):
            try:
                name = addon_utils.module_bl_info(mod).get("name", "")
                if name:
                    names.add(name)
            except Exception as e:
                log(f"读取模块信息失败: {e}")
    except Exception as e:
        log(f"扫描插件模块失败: {e}")
    translated = set()
    for n in list(names):
        try:
            t = bpy.app.translations.pgettext(n)
            if t and t != n:
                translated.add(n)
        except Exception as e:
            log(f"翻译检测失败: {e}")
    ai_cache = _load_ai_cache()
    translated.update(ai_cache.keys())
    return sorted(n for n in names if n not in translated)


def load_mo():
    """加载 patch.mo 补丁翻译文件并注册到 Blender 翻译系统。同时更新翻译统计。"""
    from .utils import log
    global _translation_stats
    if os.path.exists(pmo):
        try:
            with open(pmo, 'rb') as f:
                lang = gettext.GNUTranslations(f)
            catalog = lang._catalog
            mo_dict = {}
            entry_count = 0
            for key, msgstr in catalog.items():
                if not msgstr or isinstance(key, tuple):
                    continue
                if isinstance(key, str) and '\x04' in key:
                    msgctxt, msgid = key.split('\x04', 1)
                else:
                    msgctxt, msgid = '*', key
                mo_dict.setdefault(zh, {})[(msgctxt, msgid)] = msgstr
                entry_count += 1
            if mo_dict:
                bpy.app.translations.register("mo", mo_dict)
            _translation_stats["mo_entries"] = entry_count
            _translation_stats["last_update"] = str(mo_date) if mo_date else "未知"
        except Exception as e:
            log(f"加载 patch.mo 失败: {e}")
            _translation_stats["mo_entries"] = 0
    try:
        from .. import zh_CN
        _translation_stats["brush_entries"] = len(zh_CN.BRUSH_DICT)
    except ImportError:
        _translation_stats["brush_entries"] = 0
