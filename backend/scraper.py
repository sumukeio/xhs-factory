import re
import json
from playwright.async_api import async_playwright
from typing import Optional, List, Dict

class XHSScraper:
    def __init__(self):
        self.browser = None
        self.context = None

    async def start(self):
        """启动浏览器"""
        if not self.browser:
            p = await async_playwright().start()
            # 启动无头模式
            self.browser = await p.chromium.launch(headless=True, args=['--disable-blink-features=AutomationControlled'])
            self.context = await self.browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )

    async def close(self):
        """关闭资源"""
        if self.browser:
            await self.browser.close()

    def _get_no_watermark_img(self, img_url: str) -> str:
        """
        [修复版] 
        之前的去水印逻辑会导致部分图片 404。
        为了保证 OCR 识别绝对成功，我们暂时直接返回原图。
        Gemini 足够智能，可以忽略水印。
        """
        return img_url

    async def scrape_note(self, url: str) -> Dict:
        """
        核心功能：打开网页 -> 提取 INITIAL_STATE 数据 -> 解析
        """
        await self.start()
        page = await self.context.new_page()
        
        try:
            # print(f"🕷️ 正在抓取: {url}")
            await page.goto(url, wait_until='domcontentloaded')
            
            initial_state = await page.evaluate("() => window.__INITIAL_STATE__")
            
            if not initial_state:
                raise Exception("未检测到笔记数据")

            try:
                note_data = initial_state['note']['noteDetailMap']
                first_key = list(note_data.keys())[0]
                note_item = note_data[first_key]['note']
            except (KeyError, IndexError):
                raise Exception("数据结构解析失败")

            title = note_item.get('title', '')
            desc = note_item.get('desc', '')
            tags = [tag['name'] for tag in note_item.get('tagList', [])]
            
            image_list = note_item.get('imageList', [])
            images = []
            for img in image_list:
                # 优先获取 infoList 里的链接
                info_list = img.get('infoList', [{}])
                # 尝试获取 urlDefault (通常是原图) 或者 url
                raw_url = info_list[1].get('url', '') if len(info_list) > 1 else info_list[0].get('url', '')
                
                if raw_url:
                    # 不再去尝试转换高清域名，直接用官方给的链接
                    images.append(raw_url)

            # print(f"✅ 抓取成功: {title}")
            return {
                "title": title,
                "content": desc,
                "tags": tags,
                "images": images,
                "origin_url": url
            }

        except Exception as e:
            print(f"❌ 抓取失败: {e}")
            return None
        finally:
            await page.close()