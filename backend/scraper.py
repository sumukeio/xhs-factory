import os
import re
import json
import asyncio
import random
import time
from typing import Optional, List, Dict

import httpx
from playwright.async_api import async_playwright

from exception import RateLimitError, DataEmptyError, DataFetchError


# 单条抓取失败时重试次数（不含首次），默认 1 即最多共 2 次尝试
PARSE_RETRY_TIMES = max(0, int(os.getenv("PARSE_RETRY_TIMES", "1")))
# 是否输出极其详细的抓取步骤日志（便于排查 xhslink/state 等问题）
CRAWL_DEBUG = os.getenv("XHS_CRAWL_DEBUG", "").strip().lower() in ("1", "true", "yes")


def _log(msg: str, always: bool = False) -> None:
    """仅当 XHS_CRAWL_DEBUG=1 时打印步骤日志；always=True 时始终打印（用于错误）。"""
    if always or CRAWL_DEBUG:
        print(msg)
# 重试间隔（秒）
PARSE_RETRY_DELAY_MIN = float(os.getenv("PARSE_RETRY_DELAY_MIN", "1"))
PARSE_RETRY_DELAY_MAX = float(os.getenv("PARSE_RETRY_DELAY_MAX", "2"))


class XHSScraper:
    def __init__(self):
        self.browser = None
        self.context = None

    async def start(self):
        """启动浏览器"""
        if not self.browser:
            p = await async_playwright().start()
            self.browser = await p.chromium.launch(
                headless=True,
                args=["--disable-blink-features=AutomationControlled"],
            )
            self.context = await self.browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            )

    async def close(self):
        """关闭资源"""
        if self.browser:
            await self.browser.close()

    def _get_no_watermark_img(self, img_url: str) -> str:
        """保留：去水印逻辑已改为直接返回原图。"""
        return img_url

    # ---------- 解析与抓取分离：纯解析函数 ----------

    @staticmethod
    def extract_note_from_state(initial_state: dict, url: str) -> Dict:
        """
        从 __INITIAL_STATE__ 中解析出笔记数据（纯函数，便于单测与换数据源）。
        若数据结构异常或内容为空，抛出 DataFetchError / DataEmptyError。
        """
        if not initial_state:
            raise DataFetchError("__INITIAL_STATE__ 为空")

        try:
            note_data = initial_state.get("note", {}).get("noteDetailMap") or initial_state.get("note", {}).get("note_detail_map")
            if not note_data or not isinstance(note_data, dict):
                raise DataFetchError("note.noteDetailMap 不存在或为空")
            first_key = list(note_data.keys())[0]
            wrapper = note_data[first_key]
            if not isinstance(wrapper, dict):
                wrapper = {}
            # 兼容：嵌套 .note / 直接为笔记对象；以及可能的 snake_case 键名
            note_item = wrapper.get("note") or wrapper.get("noteDetail") or wrapper
            if not isinstance(note_item, dict):
                note_item = {}
            # 循环解开 .note 直到找到含 title/desc/imageList 的对象（如 wrapper.note = { comments, currentTime, note } -> 取 .note）
            while isinstance(note_item, dict) and note_item.get("note") and isinstance(note_item.get("note"), dict):
                inner = note_item["note"]
                has_content = (
                    (inner.get("title") or inner.get("note_title") or "").strip()
                    or (inner.get("desc") or inner.get("description") or "").strip()
                    or (len(inner.get("imageList") or inner.get("image_list") or []) > 0)
                )
                if has_content:
                    note_item = inner
                    break
                note_item = inner
            # 若仍空，尝试从 wrapper 取 camelCase / snake_case 字段
            if not note_item and wrapper:
                note_item = wrapper
        except KeyError as e:
            keys = list(initial_state.keys()) if isinstance(initial_state, dict) else []
            raise DataFetchError(f"数据结构解析失败: 缺少键 {e}。顶层键: {keys}")
        except (IndexError, TypeError) as e:
            raise DataFetchError(f"数据结构解析失败: noteDetailMap 为空或格式异常 ({e})")

        title = (note_item.get("title") or note_item.get("note_title") or "").strip()
        desc = (note_item.get("desc") or note_item.get("description") or "").strip()
        tag_list = note_item.get("tagList") or note_item.get("tag_list") or []
        tags = [t.get("name", t) if isinstance(t, dict) else str(t) for t in tag_list] if isinstance(tag_list, list) else []
        image_list = note_item.get("imageList") or note_item.get("image_list") or []
        if not isinstance(image_list, list):
            image_list = []
        images: List[str] = []
        for img in image_list:
            info_list = img.get("infoList", [{}])
            raw_url = (
                info_list[1].get("url", "")
                if len(info_list) > 1
                else info_list[0].get("url", "")
            )
            if raw_url:
                images.append(raw_url)

        has_title = (title or "").strip()
        has_content = (desc or "").strip()
        if not has_title and not has_content and not images:
            note_keys = list(note_item.keys()) if isinstance(note_item, dict) else []
            wrapper_keys = list(wrapper.keys()) if isinstance(wrapper, dict) else []
            print(f"❌ [抓取] 笔记内容为空。URL={url}, note_item 键: {note_keys}, wrapper 键: {wrapper_keys}")
            raise DataEmptyError(
                "笔记内容为空：未解析到标题、正文或图片。可能页面结构已变化、需登录或该链接不是笔记页。"
            )

        return {
            "title": title,
            "content": desc,
            "tags": tags,
            "images": images,
            "origin_url": url,
        }

    async def _safe_page_title(self, page) -> str:
        """安全获取页面标题，避免在页面已跳转/关闭时调用 page.title() 导致 Execution context destroyed。"""
        try:
            return await page.title() or "（无标题）"
        except Exception:
            return "（页面已跳转或无法获取）"

    async def _resolve_xhslink(self, url: str) -> str:
        """
        用 HTTP 跟随 xhslink 跳转；当前未使用（主流程改为直接 goto(url) 更稳）。
        若得到笔记页 URL（含 explore/discovery）则返回，否则返回原 url。
        """
        if "xhslink.com" not in url:
            return url
        try:
            async with httpx.AsyncClient(
                follow_redirects=True,
                timeout=12.0,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"},
            ) as client:
                r = await client.get(url)
                final_url = str(r.url)
                if not final_url or "xiaohongshu.com" not in final_url:
                    return url
                # 只有明确像笔记页（explore/discovery）才用，否则可能是首页/登录页
                if "explore" in final_url or "discovery" in final_url:
                    _log(f"   [抓取] xhslink 解析为笔记页: {final_url[:70]}...")
                    return final_url
                print(f"   [抓取] xhslink 解析到非笔记页，改用浏览器打开原链接: {final_url[:60]}...")
        except Exception as e:
            print(f"   [抓取] xhslink 解析失败，用原链接: {e}")
        return url

    async def _fetch_page_state(self, page, url: str) -> dict:
        """
        打开笔记页并返回 __INITIAL_STATE__。
        直接 goto 用户给的链接（xhslink 或 explore 均可），由浏览器自然跳转，不做 HTTP 预解析与等标题，避免引入超时/竞态。
        """
        t0 = time.time()
        _log(f"   [抓取-步骤] 1) 将打开: {url[:80]}...")
        await page.goto(url, wait_until="load", timeout=25000)
        _log(f"   [抓取-步骤] 2) goto 完成，耗时 {time.time()-t0:.1f}s")
        try:
            cur_url = page.url
            title = await self._safe_page_title(page)
            _log(f"   [抓取-步骤]    当前 URL: {cur_url[:80]}...")
            _log(f"   [抓取-步骤]    当前 title: {title!r}")
        except Exception:
            pass
        _log("   [抓取-步骤] 3) sleep 2.5s...")
        await asyncio.sleep(2.5)

        # 检测限流页（不重试）
        try:
            page_text = await page.evaluate(
                "() => document.body ? document.body.innerText : ''"
            )
            _log(f"   [抓取-步骤] 4) 限流检测: body 长度={len(page_text)}, 含安全限制={('安全限制' in page_text or '300013' in page_text)}")
            if (
                "安全限制" in page_text
                or "Too many requests" in page_text
                or "300013" in page_text
            ):
                print(f"❌ [抓取] 命中限流页。URL={url}")
                raise RateLimitError(
                    "访问受限：请求过于频繁，请稍后再试（错误码 300013）。可调低并发数或间隔几分钟再解析。"
                )
        except RateLimitError:
            raise
        except Exception:
            pass

        # 等待第一条笔记的「内容」就绪（title/desc/imageList 至少有一个），避免读到空壳导致第一次必失败
        _log("   [抓取-步骤] 5) 等待笔记内容注入（title/desc/imageList，最多 22s）...")
        try:
            await page.wait_for_function(
                """() => {
                    const s = window.__INITIAL_STATE__;
                    if (!s?.note?.noteDetailMap || typeof s.note.noteDetailMap !== 'object') return false;
                    const keys = Object.keys(s.note.noteDetailMap);
                    if (keys.length === 0) return false;
                    let note = s.note.noteDetailMap[keys[0]]?.note || s.note.noteDetailMap[keys[0]];
                    if (!note || typeof note !== 'object') return false;
                    while (note.note && typeof note.note === 'object') { note = note.note; }
                    const hasTitle = (note.title || note.note_title || '').trim().length > 0;
                    const hasDesc = (note.desc || note.description || '').trim().length > 0;
                    const imgs = note.imageList || note.image_list;
                    const hasImages = Array.isArray(imgs) && imgs.length > 0;
                    return hasTitle || hasDesc || hasImages;
                }""",
                timeout=22000,
            )
            # 在页面内只取 note 部分返回，避免整 __INITIAL_STATE__ 序列化失败或过大
            initial_state = await page.evaluate(
                """() => {
                    const s = window.__INITIAL_STATE__;
                    if (!s?.note?.noteDetailMap || typeof s.note.noteDetailMap !== 'object') return null;
                    const keys = Object.keys(s.note.noteDetailMap);
                    if (keys.length === 0) return null;
                    return { note: { noteDetailMap: s.note.noteDetailMap } };
                }"""
            )
            _log(f"   [抓取-步骤] 6) wait_for_function 通过，耗时 {time.time()-t0:.1f}s")
            if initial_state is not None and isinstance(initial_state, dict):
                _log(f"   [抓取-步骤]     state 顶层键: {list(initial_state.keys())[:15]}")
                note_map = (initial_state.get("note") or {}) if isinstance(initial_state.get("note"), dict) else {}
                detail = note_map.get("noteDetailMap") or note_map.get("note_detail_map")
                if detail and isinstance(detail, dict):
                    _log(f"   [抓取-步骤]     noteDetailMap 键数: {len(detail)}, 首键: {list(detail.keys())[:1]}")
            else:
                _log(f"   [抓取-步骤]     evaluate 返回类型: {type(initial_state).__name__}, 是否空: {not initial_state}")
        except Exception as wait_err:
            title = await self._safe_page_title(page)
            current_url = page.url or ""
            if "/login" in current_url or "login" in current_url.lower():
                print(f"❌ [抓取] 被重定向到登录页。原始 URL={url}, 当前 page.url={current_url[:80]}...")
                raise DataFetchError(
                    "本次请求被重定向到登录页（偶发、无法避免，本工具无需登录）。自动重试中，若仍失败可稍后或调低并发再试。"
                )
            print(f"❌ [抓取] 等待笔记数据注入超时或异常: {wait_err}")
            print(f"   URL: {url}")
            print(f"   页面标题: {title}")
            _log(f"   [抓取-步骤] 6) wait_for_function 异常，当前 page.url: {current_url[:80] if current_url else 'N/A'}...", always=True)
            raise DataFetchError(
                f"未检测到笔记数据（页面可能未加载完成或链接无效）。当前页面标题: {title!r}"
            )

        if not initial_state:
            title = await self._safe_page_title(page)
            print(f"❌ [抓取] __INITIAL_STATE__ 为空。URL={url}, 页面标题={title}")
            try:
                has_state = await page.evaluate("() => typeof window.__INITIAL_STATE__ !== 'undefined'")
                _log(f"   [抓取-步骤] 7) state 为空，但 window.__INITIAL_STATE__ 存在={has_state}", always=True)
            except Exception:
                pass
            raise DataFetchError(
                f"未检测到笔记数据（__INITIAL_STATE__ 为空）。当前页面标题: {title!r}"
            )
        _log(f"   [抓取-步骤] 7) 拿到 state，总耗时 {time.time()-t0:.1f}s")
        return initial_state

    async def scrape_note(self, url: str) -> Dict:
        """
        打开网页 -> 取 __INITIAL_STATE__ -> 解析笔记。
        限流不重试；其他失败按 PARSE_RETRY_TIMES 重试，间隔 PARSE_RETRY_DELAY。
        """
        _log(f"[抓取] 开始 scrape_note url={url[:70]}...")
        await self.start()
        page = await self.context.new_page()
        last_error: Optional[Exception] = None

        try:
            for attempt in range(PARSE_RETRY_TIMES + 1):
                _log(f"[抓取] 第 {attempt + 1}/{PARSE_RETRY_TIMES + 1} 次尝试")
                try:
                    state = await self._fetch_page_state(page, url)
                    _log("[抓取] _fetch_page_state 完成，开始 extract_note_from_state")
                    note = self.extract_note_from_state(state, url)
                    _log(f"[抓取] 解析成功: title={(note.get('title') or '')[:40]}..., 图片数={len(note.get('images') or [])}")
                    return note
                except RateLimitError:
                    raise
                except (DataEmptyError, DataFetchError) as e:
                    last_error = e
                    if attempt < PARSE_RETRY_TIMES:
                        delay = random.uniform(PARSE_RETRY_DELAY_MIN, PARSE_RETRY_DELAY_MAX)
                        print(f"   [抓取] 第 {attempt + 1} 次失败，{delay:.1f}s 后重试: {e}")
                        await asyncio.sleep(delay)
                    else:
                        raise
                except Exception as e:
                    last_error = e
                    if attempt < PARSE_RETRY_TIMES:
                        delay = random.uniform(PARSE_RETRY_DELAY_MIN, PARSE_RETRY_DELAY_MAX)
                        print(f"   [抓取] 第 {attempt + 1} 次失败，{delay:.1f}s 后重试: {e}")
                        await asyncio.sleep(delay)
                    else:
                        import traceback
                        print(f"❌ [抓取] 失败 URL={url}")
                        print(f"   错误: {e}")
                        traceback.print_exc()
                        raise
            if last_error:
                raise last_error
            raise DataFetchError("抓取失败")
        finally:
            await page.close()
