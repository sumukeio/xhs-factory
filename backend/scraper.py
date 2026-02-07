import os
import re
import json
import asyncio
import random
from typing import Optional, List, Dict

from playwright.async_api import async_playwright

from exception import RateLimitError, DataEmptyError, DataFetchError


# 单条抓取失败时重试次数（不含首次），默认 1 即最多共 2 次尝试
PARSE_RETRY_TIMES = max(0, int(os.getenv("PARSE_RETRY_TIMES", "1")))
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
            note_data = initial_state["note"]["noteDetailMap"]
            first_key = list(note_data.keys())[0]
            note_item = note_data[first_key]["note"]
        except KeyError as e:
            keys = list(initial_state.keys()) if isinstance(initial_state, dict) else []
            raise DataFetchError(f"数据结构解析失败: 缺少键 {e}。顶层键: {keys}")
        except (IndexError, TypeError) as e:
            raise DataFetchError(f"数据结构解析失败: noteDetailMap 为空或格式异常 ({e})")

        title = note_item.get("title", "")
        desc = note_item.get("desc", "")
        tags = [tag["name"] for tag in note_item.get("tagList", [])]
        image_list = note_item.get("imageList", [])
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
            print(f"❌ [抓取] 笔记内容为空。URL={url}, note_item 键: {note_keys}")
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

    async def _fetch_page_state(self, page, url: str) -> dict:
        """
        打开笔记页并返回 __INITIAL_STATE__。
        检测到限流页时抛出 RateLimitError；超时或取不到 state 时抛出 DataFetchError。
        """
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)

        # 检测限流页（不重试）
        try:
            page_text = await page.evaluate(
                "() => document.body ? document.body.innerText : ''"
            )
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

        try:
            await page.wait_for_function(
                "typeof window.__INITIAL_STATE__ !== 'undefined' && window.__INITIAL_STATE__ != null",
                timeout=12000,
            )
        except Exception as wait_err:
            title = await page.title()
            print(f"❌ [抓取] 等待 __INITIAL_STATE__ 超时或异常: {wait_err}")
            print(f"   URL: {url}")
            print(f"   页面标题: {title}")
            raise DataFetchError(
                f"未检测到笔记数据（页面可能未加载完成、需登录或链接无效）。当前页面标题: {title!r}"
            )

        initial_state = await page.evaluate("() => window.__INITIAL_STATE__")
        if not initial_state:
            title = await page.title()
            print(f"❌ [抓取] __INITIAL_STATE__ 为空。URL={url}, 页面标题={title}")
            raise DataFetchError(
                f"未检测到笔记数据（__INITIAL_STATE__ 为空）。当前页面标题: {title!r}"
            )
        return initial_state

    async def scrape_note(self, url: str) -> Dict:
        """
        打开网页 -> 取 __INITIAL_STATE__ -> 解析笔记。
        限流不重试；其他失败按 PARSE_RETRY_TIMES 重试，间隔 PARSE_RETRY_DELAY。
        """
        await self.start()
        page = await self.context.new_page()
        last_error: Optional[Exception] = None

        try:
            for attempt in range(PARSE_RETRY_TIMES + 1):
                try:
                    state = await self._fetch_page_state(page, url)
                    return self.extract_note_from_state(state, url)
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
