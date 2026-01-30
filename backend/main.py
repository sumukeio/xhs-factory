import os
import base64
import httpx
import uvicorn
import hashlib
import asyncio
import zipfile
import io
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
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

# 下载内容根目录（相对 backend 目录）
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOAD_ROOT = os.path.join(BASE_DIR, "downloads")
os.makedirs(DOWNLOAD_ROOT, exist_ok=True)

if not GOOGLE_API_KEY:
    print("⚠️ 警告: 未检测到 GEMINI_API_KEY，AI 功能将无法使用。")

app = FastAPI()

# 添加CORS支持
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应该限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class GenerateRequest(BaseModel):
    url: str

class GeneratedContent(BaseModel):
    title: str
    content: List[str]
    tags: List[str]
    englishHook: str
    images: List[str]
    ocrText: str = "" 


class DownloadRequest(BaseModel):
    """专用于下载到本地磁盘的请求体"""
    url: str
    # 可选：自定义保存根目录（绝对路径或相对 backend 的路径）
    base_dir: str | None = None


class DownloadResponse(BaseModel):
    """返回下载后的基本信息"""
    title: str
    folder: str
    text_file: str
    image_files: List[str]


# === 新增：批量解析相关模型 ===
class BatchParseRequest(BaseModel):
    """批量解析请求"""
    urls: List[str]


class ParsedNote(BaseModel):
    """解析后的笔记数据（返回给前端）"""
    id: str  # 基于URL生成的唯一ID
    url: str
    title: str
    content: str
    tags: List[str]
    images: List[str]
    coverImage: str | None = None  # 封面图（第一张）


class BatchParseResponse(BaseModel):
    """批量解析响应"""
    notes: List[ParsedNote]
    failed: List[Dict[str, str]]  # [{"url": "...", "error": "..."}]


# === 新增：选择性下载相关模型 ===
class SelectiveDownloadRequest(BaseModel):
    """选择性下载请求"""
    note_data: Dict  # 笔记数据（包含 title, content, tags, images 等）
    selected_image_indices: List[int] | None = None  # 选中的图片索引（None表示全部）
    base_dir: str | None = None


class SelectiveDownloadResponse(BaseModel):
    """选择性下载响应"""
    title: str
    folder: str
    text_file: str
    image_files: List[str]


# === 新增：文件夹浏览相关模型 ===
class BrowseFolderRequest(BaseModel):
    """浏览文件夹请求"""
    path: Optional[str] = None  # 如果为空，返回默认路径


class FolderItem(BaseModel):
    """文件夹项"""
    name: str
    path: str
    is_directory: bool


class BrowseFolderResponse(BaseModel):
    """浏览文件夹响应"""
    current_path: str
    items: List[FolderItem]
    parent_path: Optional[str] = None

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


def _sanitize_filename(name: str) -> str:
    """
    将标题转换为适合作为文件/文件夹名的字符串
    - 去除 Windows 不允许的字符: \ / : * ? " < > |
    - 去掉前后空格，并限制长度
    """
    invalid_chars = r'\/:*?"<>|'
    sanitized = "".join(c for c in name if c not in invalid_chars)
    sanitized = sanitized.strip()
    if not sanitized:
        sanitized = "xhs_note"
    # 避免路径过长，简单限制到 60 个字符
    return sanitized[:60]


def _generate_note_id(url: str) -> str:
    """基于URL生成唯一ID"""
    return hashlib.md5(url.encode()).hexdigest()[:12]


async def _save_note_to_disk(data: Dict, selected_indices: List[int] | None = None) -> Dict:
    """
    根据爬虫返回的数据，将图片和文字保存到本地
    目录结构示例:
    backend/
      downloads/
        笔记标题/
          笔记标题.txt
          image_1.jpg
          image_2.png
    """
    title = data.get("title") or "xhs_note"
    desc = data.get("content") or ""
    tags = data.get("tags") or []
    origin_url = data.get("origin_url") or ""
    images = data.get("images") or []

    folder_name = _sanitize_filename(title)
    folder_path = os.path.join(DOWNLOAD_ROOT, folder_name)
    os.makedirs(folder_path, exist_ok=True)

    # 1. 保存文字到 txt
    text_filename = f"{folder_name}.txt"
    text_path = os.path.join(folder_path, text_filename)
    lines = [
        title,
        "",
        desc,
        "",
    ]
    if tags:
        lines.append("标签: " + ", ".join(tags))
    if origin_url:
        lines.append(f"来源链接: {origin_url}")

    with open(text_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    # 2. 下载并保存图片（支持选择性下载）
    image_files: List[str] = []
    images_to_download = images
    if selected_indices is not None:
        # 只下载选中的图片
        images_to_download = [images[i] for i in selected_indices if 0 <= i < len(images)]
    
    for idx, img_url in enumerate(images_to_download, start=1):
        img_data = await download_image_as_bytes(img_url)
        if not img_data:
            continue
        mime = img_data.get("mime_type", "image/jpeg").lower()
        ext = "jpg"
        if "png" in mime:
            ext = "png"
        elif "webp" in mime:
            ext = "webp"
        elif "gif" in mime:
            ext = "gif"

        img_filename = f"image_{idx}.{ext}"
        img_path = os.path.join(folder_path, img_filename)
        try:
            with open(img_path, "wb") as f:
                f.write(img_data["data"])
            image_files.append(img_filename)
        except Exception as e:
            print(f"   - 保存图片失败: {e}")

    return {
        "title": title,
        "folder": folder_name,
        "text_file": text_filename,
        "image_files": image_files,
    }

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


@app.post("/api/download_note", response_model=DownloadResponse)
async def download_note(request: DownloadRequest):
    """
    独立的“爬取并落盘”接口：
    - 使用现有爬虫抓取笔记
    - 将图片与文字保存到 backend/downloads/标题/ 下
    """
    print(f"\n📥 [下载] 开始爬取并保存: {request.url}")

    scraper = XHSScraper()
    try:
        data = await scraper.scrape_note(request.url)
        if not data:
            raise HTTPException(status_code=400, detail="抓取失败")
    finally:
        await scraper.close()

    # 如果前端传了自定义 base_dir，则覆盖默认 DOWNLOAD_ROOT
    global DOWNLOAD_ROOT
    original_root = DOWNLOAD_ROOT
    try:
        if request.base_dir:
            # 支持绝对路径 & 相对 backend 的路径
            if os.path.isabs(request.base_dir):
                DOWNLOAD_ROOT = request.base_dir
            else:
                DOWNLOAD_ROOT = os.path.join(BASE_DIR, request.base_dir)
            os.makedirs(DOWNLOAD_ROOT, exist_ok=True)

        saved = await _save_note_to_disk(data)
    finally:
        # 还原全局配置，避免影响其他请求
        DOWNLOAD_ROOT = original_root

    print(f"✅ [下载] 已保存到文件夹: {saved['folder']}")

    return saved

# === 新增：批量解析接口 ===
@app.post("/api/batch_parse", response_model=BatchParseResponse)
async def batch_parse(request: BatchParseRequest):
    """
    批量解析小红书笔记链接
    """
    print(f"\n📥 [批量解析] 开始解析 {len(request.urls)} 个链接...")
    
    notes: List[ParsedNote] = []
    failed: List[Dict[str, str]] = []
    
    # 并发解析（限制并发数避免过载）
    semaphore = asyncio.Semaphore(3)  # 最多3个并发
    
    async def parse_single(url: str):
        async with semaphore:
            scraper = XHSScraper()
            try:
                data = await scraper.scrape_note(url)
                if not data:
                    failed.append({"url": url, "error": "抓取失败"})
                    return
                
                note_id = _generate_note_id(url)
                cover_image = data['images'][0] if data.get('images') else None
                
                notes.append(ParsedNote(
                    id=note_id,
                    url=url,
                    title=data.get('title', ''),
                    content=data.get('content', ''),
                    tags=data.get('tags', []),
                    images=data.get('images', []),
                    coverImage=cover_image
                ))
                print(f"✅ [批量解析] 成功: {data.get('title', '')[:30]}")
            except Exception as e:
                print(f"❌ [批量解析] 失败 {url}: {e}")
                failed.append({"url": url, "error": str(e)})
            finally:
                await scraper.close()
    
    # 并发执行所有解析任务
    await asyncio.gather(*[parse_single(url) for url in request.urls])
    
    print(f"✅ [批量解析] 完成: 成功 {len(notes)} 个，失败 {len(failed)} 个")
    return BatchParseResponse(notes=notes, failed=failed)


# === 新增：ZIP下载接口（推荐，直接下载到用户本地） ===
@app.post("/api/download_zip")
async def download_zip(request: ZipDownloadRequest):
    """
    将笔记打包成ZIP并返回给前端下载
    """
    print(f"\n📦 [ZIP下载] 开始打包: {request.note_data.get('title', '')}")
    
    try:
        title = request.note_data.get('title', 'xhs_note')
        content = request.note_data.get('content', '')
        tags = request.note_data.get('tags', [])
        origin_url = request.note_data.get('origin_url', '')
        images = request.note_data.get('images', [])
        
        # 确定要下载的图片
        images_to_download = images
        if request.selected_image_indices is not None:
            images_to_download = [images[i] for i in request.selected_image_indices if 0 <= i < len(images)]
        
        # 创建内存中的ZIP文件
        zip_buffer = io.BytesIO()
        folder_name = _sanitize_filename(title)
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # 1. 添加文本文件
            text_filename = f"{folder_name}.txt"
            text_content = f"{title}\n\n{content}\n\n"
            if tags:
                text_content += f"标签: {', '.join(tags)}\n"
            if origin_url:
                text_content += f"来源链接: {origin_url}\n"
            
            zip_file.writestr(text_filename, text_content.encode('utf-8'))
            
            # 2. 下载并添加图片
            for idx, img_url in enumerate(images_to_download, start=1):
                img_data = await download_image_as_bytes(img_url)
                if not img_data:
                    continue
                
                mime = img_data.get("mime_type", "image/jpeg").lower()
                ext = "jpg"
                if "png" in mime:
                    ext = "png"
                elif "webp" in mime:
                    ext = "webp"
                elif "gif" in mime:
                    ext = "gif"
                
                img_filename = f"image_{idx}.{ext}"
                zip_file.writestr(img_filename, img_data["data"])
                print(f"   - 已添加图片: {img_filename}")
        
        zip_buffer.seek(0)
        zip_filename = f"{folder_name}.zip"
        
        print(f"✅ [ZIP下载] 打包完成: {zip_filename} ({len(zip_buffer.getvalue())} bytes)")
        
        # 返回ZIP文件
        return Response(
            content=zip_buffer.getvalue(),
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="{zip_filename}"',
                "Content-Length": str(len(zip_buffer.getvalue()))
            }
        )
        
    except Exception as e:
        print(f"❌ [ZIP下载] 失败: {e}")
        raise HTTPException(status_code=500, detail=f"打包ZIP失败: {str(e)}")


# === 旧版：选择性下载接口（保存到服务器，保留用于兼容） ===
@app.post("/api/selective_download", response_model=SelectiveDownloadResponse)
async def selective_download(request: SelectiveDownloadRequest):
    """
    选择性下载笔记（支持选择特定图片）- 保存到服务器
    注意：Fly.io 文件系统是临时的，建议使用 /api/download_zip 接口
    """
    print(f"\n📥 [选择性下载] 开始下载: {request.note_data.get('title', '')}")
    
    # 如果前端传了自定义 base_dir，则覆盖默认 DOWNLOAD_ROOT
    global DOWNLOAD_ROOT
    original_root = DOWNLOAD_ROOT
    try:
        if request.base_dir:
            if os.path.isabs(request.base_dir):
                DOWNLOAD_ROOT = request.base_dir
            else:
                DOWNLOAD_ROOT = os.path.join(BASE_DIR, request.base_dir)
            os.makedirs(DOWNLOAD_ROOT, exist_ok=True)
        
        saved = await _save_note_to_disk(
            request.note_data, 
            selected_indices=request.selected_image_indices
        )
    finally:
        DOWNLOAD_ROOT = original_root
    
    print(f"✅ [选择性下载] 已保存到文件夹: {saved['folder']}")
    return SelectiveDownloadResponse(**saved)


# === 新增：浏览文件夹接口 ===
@app.post("/api/browse_folder", response_model=BrowseFolderResponse)
async def browse_folder(request: BrowseFolderRequest):
    """
    浏览文件夹（用于前端选择保存路径）
    """
    try:
        if request.path:
            target_path = request.path
            # 如果是相对路径，转换为绝对路径
            if not os.path.isabs(target_path):
                target_path = os.path.join(BASE_DIR, target_path)
        else:
            # 默认返回backend目录
            target_path = BASE_DIR
        
        if not os.path.exists(target_path):
            raise HTTPException(status_code=404, detail="路径不存在")
        
        if not os.path.isdir(target_path):
            raise HTTPException(status_code=400, detail="不是有效的文件夹路径")
        
        # 获取父目录
        parent_path = None
        if target_path != BASE_DIR and os.path.dirname(target_path) != target_path:
            parent_path = os.path.dirname(target_path)
        
        # 列出文件夹内容
        items: List[FolderItem] = []
        try:
            for item_name in sorted(os.listdir(target_path)):
                item_path = os.path.join(target_path, item_name)
                if os.path.isdir(item_path):
                    items.append(FolderItem(
                        name=item_name,
                        path=item_path,
                        is_directory=True
                    ))
        except PermissionError:
            raise HTTPException(status_code=403, detail="无权限访问该文件夹")
        
        return BrowseFolderResponse(
            current_path=target_path,
            items=items,
            parent_path=parent_path
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"浏览文件夹失败: {str(e)}")


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)