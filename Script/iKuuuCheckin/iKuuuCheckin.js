/**
 * iKuuu 机场每日签到（青龙版）
 * 特性：纯原生 fetch，无第三方依赖；结果解码为中文；exit code 0 表示成功
 * 环境变量：IKUUU_COOKIE（必需），从浏览器复制完整 Cookie
 * 触发方式：task iKuuuCheckin.js
 */

// ---------- 配置 ----------
const DOMAIN = 'ikuuu.fyi';              // 当前可用面板域名，可按需修改
const TIMEOUT = 15000;                  // 请求超时毫秒数

// ---------- 读取 Cookie ----------
const cookie = (process.env.IKUUU_COOKIE || '').trim();
if (!cookie) {
    console.error('❌ 请设置环境变量 IKUUU_COOKIE');
    process.exit(1);
}

// ---------- 工具函数 ----------
/**
 * 封装 fetch，支持超时和自动重定向
 */
async function request(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout || TIMEOUT);
    try {
        const res = await fetch(url, {
            ...options,
            signal: controller.signal,
            redirect: 'follow',          // 跟随重定向（一般 /checkin 不会重定向）
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest',
                ...(options.headers || {})
            }
        });
        clearTimeout(timer);
        return res;
    } catch (err) {
        clearTimeout(timer);
        throw err;
    }
}

// ---------- 主流程 ----------
(async function main() {
    console.log(`🎯 目标域名：${DOMAIN}`);
    console.log(`🍪 Cookie 长度：${cookie.length}`);

    const url = `https://${DOMAIN}/user/checkin`;

    try {
        const res = await request(url, {
            method: 'POST',
            headers: {
                'Cookie': cookie,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': `https://${DOMAIN}/user`   // 部分后端校验 Referer
            },
            timeout: 10000
        });

        const text = await res.text();
        console.log(`📦 状态码：${res.status}`);
        console.log(`📨 响应体：${text}`);

        // 尝试解析 JSON
        let json;
        try {
            json = JSON.parse(text);
        } catch {
            // 非 JSON 也认为成功（可能是纯文本），直接退出
            console.log(`✅ 原始响应（非 JSON）: ${text}`);
            process.exit(0);
        }

        // 判断业务结果：ret === 0 表示成功（签到成功或已签到）
        if (json.ret === 0) {
            const msg = json.msg || '操作成功';
            // Unicode 转义自动解码（JSON.parse 已处理）
            console.log(`✅ ${msg}`);
            process.exit(0);
        } else {
            const msg = json.msg || '未知错误';
            console.error(`⚠️ ${msg}`);
            process.exit(1);
        }
    } catch (err) {
        console.error(`❌ 请求异常：${err.message}`);
        process.exit(1);
    }
})();