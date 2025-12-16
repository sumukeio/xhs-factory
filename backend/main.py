import os
import base64
import httpx
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
from dotenv import load_dotenv
from scraper import XHSScraper

# 加载环境变量
load_dotenv()

# === 核心配置区 ===
GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY")

# 1. 修正模型名称 (千万别写 2.5)
MODEL_NAME = "gemini-2.5-flash"

# 2. 你的 Vercel 代理地址 (如果本地直连 Google 还是不行，就走这个)
PROXY_BASE_URL = "https://gemini.sumukeio.xyz"

# 3. 【关键】本地 VPN 代理地址
# 请检查你的梯子软件，看"端口"是多少。Clash 默认是 7890，v2ray 可能是 10809
LOCAL_VPN_PROXY = None 

if not GOOGLE_API_KEY:
    print("⚠️ 警告: 未检测到 GEMINI_API_KEY，AI 功能将无法使用。")

app = FastAPI()

class GenerateRequest(BaseModel):
    url: str

class GeneratedContent(BaseModel):
    title: str
    content: List[str]
    tags: List[str]
    englishHook: str
    images: List[str]
    ocrText: str = "" 

async def download_image_as_bytes(url: str):
    """
    下载图片 (图片通常不需要走代理，或者走代理也行)
    这里为了稳妥，我们让图片下载也尝试走一下代理，或者直连
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.xiaohongshu.com/"
    }
    
    # 图片通常国内能访问，所以这里 proxy=None (不走代理)，速度更快
    # 如果下载失败，可以改成 proxy=LOCAL_VPN_PROXY
    async with httpx.AsyncClient(headers=headers, follow_redirects=True, verify=False) as client:
        try:
            resp = await client.get(url, timeout=15.0)
            if resp.status_code == 200:
                print(f"   - 图片下载成功: {url[:30]}...")
                return {
                    "mime_type": resp.headers.get("content-type", "image/jpeg"),
                    "data": resp.content
                }
            else:
                print(f"   - 图片下载失败 (状态码 {resp.status_code}): {url[:30]}...")
        except Exception as e:
            print(f"   - 图片下载出错: {e}")
    return None

async def call_gemini_via_proxy(prompt: str, image_parts: list):
    """
    通过 Cloudflare的Worker 调用 Gemini
    """
    if not GOOGLE_API_KEY:
        return "未配置 API Key"

    # 构造 URL
    api_url = f"{PROXY_BASE_URL}/v1beta/models/{MODEL_NAME}:generateContent?key={GOOGLE_API_KEY}"
    
    # 构造请求体
    contents_parts = [{"text": prompt}]
    for img in image_parts:
        b64_data = base64.b64encode(img['data']).decode('utf-8')
        contents_parts.append({
            "inline_data": {
                "mime_type": img['mime_type'],
                "data": b64_data
            }
        })

    payload = {"contents": [{"parts": contents_parts}]}

    print(f"📡 正在连接 Gemini ({MODEL_NAME})...")
    # Cloudflare 一般国内直连没问题，不需要 proxy 参数
    # verify=False 是为了防止某些 SSL 握手报错，加上更稳
    async with httpx.AsyncClient(timeout=60.0, verify=False) as client:
        try:
            resp = await client.post(api_url, json=payload)
            
            if resp.status_code != 200:
                print(f"❌ 请求失败: {resp.status_code} - {resp.text}")
                return f"AI 报错: {resp.status_code}"
            
            result = resp.json()
            try:
                text = result['candidates'][0]['content']['parts'][0]['text']
                return text
            except (KeyError, IndexError):
                print(f"❌ 解析响应失败: {result}")
                return "AI 返回格式异常"
                
        except Exception as e:
            print(f"❌ 网络连接失败: {e}")
            return "网络连接失败"

@app.post("/api/generate", response_model=GeneratedContent)
async def generate_content(request: GenerateRequest):
    print(f"\n🚀 [1/3] 开始爬取: {request.url}")
    
    scraper = XHSScraper()
    try:
        data = await scraper.scrape_note(request.url)
        if not data:
            raise HTTPException(status_code=400, detail="抓取失败")
    finally:
        await scraper.close()

    print(f"✅ [2/3] 抓取完成: {data['title']}")

    extracted_text_from_images = ""
    
    if data['images'] and GOOGLE_API_KEY:
        print(f"👀 [3/3] 准备 AI 识别 (共 {len(data['images'])} 张)...")
        
        image_parts = []
        # 为了速度和成功率，先只发前 3 张
        for img_url in data['images'][:3]:
            img_data = await download_image_as_bytes(img_url)
            if img_data:
                image_parts.append(img_data)
        
        if image_parts:
            prompt = "你是一个 OCR 助手。请提取图片中的所有文字，重点提取大字标题和金句。直接输出文字，用换行分隔。"
            extracted_text_from_images = await call_gemini_via_proxy(prompt, image_parts)
            print("✅ AI 识别流程结束")
        else:
            print("⚠️ 图片下载失败，跳过 AI")
    else:
        print("⏭️ 跳过 AI (无 Key 或 无图)")

    content_lines = [line for line in data['content'].split('\n') if line.strip()]
    
    return {
        "title": data['title'],
        "englishHook": "AI EXTRACTED", 
        "content": content_lines, 
        "tags": data['tags'],
        "images": data['images'],
        "ocrText": extracted_text_from_images
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)