# XHS Factory - 小红书内容工厂

一个功能强大的小红书笔记爬取与管理工具，支持批量解析、预览、ZIP下载等功能。

## 功能特性

### 🎨 爆款图生成器（主页）
- 可视化编辑小红书爆款图
- 支持多种布局和主题配色
- AI 智能识别图片文字

### 🕷️ 笔记爬取工具（`/crawler`）
- **批量解析**：支持一次性解析多个小红书笔记链接
  - **实时进度**：解析过程中显示「已解析 3/10」等流式进度（SSE）
  - **解析历史**：自动保存最近解析过的链接，可展开「解析历史」点击填入再次解析
  - **失败重试**：若上次有解析失败，可点击「重试失败链接」仅重试失败项
- **智能提取**：粘贴文本时自动提取其中的链接（支持 Ctrl+V 和右键粘贴）
- **预览方块**：上图下文展示，直观查看笔记内容（默认显示20个，支持查看更多）
- **预览弹窗**：点击预览方块查看详细信息
  - 左侧：图片轮播（支持滑动/箭头翻页，适配手机和电脑端）
  - 右侧：标题、文字、标签；**正文区域带「一键复制」**，可复制整段文本到剪贴板
  - 支持选择性下载图片（在底部缩略图区域选择）
  - 下载旁有「同时下载文本」勾选框，取消后 ZIP 仅含图片
- **ZIP下载**：📦 自动打包成ZIP文件下载到本地
  - 单个笔记下载：选择图片与是否含文本后点击下载，自动生成ZIP
  - 批量下载：一键下载多个笔记，每个笔记一个ZIP；旁有「同时下载文本」勾选框
  - ZIP内容：可选包含文本文件（标题+内容+标签+链接）和选中的图片
- **批量操作**：
  - 批量选中笔记
  - 一键下载（自动打包成ZIP，可选是否含文本）
  - 批量删除（移至回收站）
- **回收站**：
  - 查看已删除的笔记
  - 批量恢复
  - 批量永久删除（需确认）

## 技术栈

- **前端**：Next.js 16 + React 19 + TypeScript + Tailwind CSS
- **后端**：FastAPI + Python + Playwright
- **存储**：localStorage（前端本地存储）

## 快速开始

### 1. 安装依赖

```bash
# 前端依赖
npm install

# 后端依赖
cd backend
pip install -r requirements.txt
```

### 2. 启动后端服务

```bash
cd backend
python main.py
```

后端服务将在 `http://127.0.0.1:8000` 启动。

### 3. 启动前端服务

```bash
npm run dev
```

前端服务将在 `http://localhost:3000` 启动。

### 4. 访问应用

- **主页（爆款图生成器）**：http://localhost:3000
- **爬取工具**：http://localhost:3000/crawler

## 使用说明

### 爬取笔记

1. 访问 `/crawler` 页面
2. 在输入框中粘贴小红书笔记链接（支持多个，每行一个）
   - 支持 **Ctrl+V** 快捷键粘贴
   - 支持 **右键菜单粘贴**
   - 粘贴包含链接的文本时，会自动提取其中的链接
3. 点击"开始解析"按钮
4. 解析完成后，笔记会以预览方块的形式展示在预览区
5. 点击预览方块可以查看详细信息并下载

### 下载笔记（ZIP格式）

#### 单个笔记下载
1. 点击预览方块打开预览弹窗
2. 在底部缩略图区域点击图片进行选择/取消选择（默认全选）
3. 点击"下载"按钮
4. 浏览器会自动下载一个ZIP文件到本地下载文件夹
5. ZIP文件包含：
   - `笔记标题.txt` - 包含标题、正文、标签、来源链接
   - `image_1.jpg` - 第一张图片
   - `image_2.png` - 第二张图片
   - ...（其他选中的图片）

#### 批量下载
1. 点击"批量选中"按钮进入批量模式
2. 点击预览方块进行选择（或点击"全选"）
3. 点击"一键下载"按钮
4. 系统会依次下载多个ZIP文件（每个笔记一个ZIP）
5. 批量下载时会在每个文件之间添加延迟，避免浏览器阻止多个下载

### 批量操作

1. 点击"批量选中"按钮进入批量模式
2. 点击预览方块进行选择
3. 选择完成后，可以：
   - 点击"一键下载"：自动打包成ZIP文件下载
   - 点击"批量删除"：将选中笔记移至回收站

### 回收站

1. 切换到"回收站"标签页
2. 可以批量恢复或永久删除笔记

## 项目结构

```
xhs-factory/
├── backend/              # Python 后端
│   ├── main.py          # FastAPI 主文件（包含ZIP下载接口）
│   ├── scraper.py       # 爬虫核心逻辑
│   ├── requirements.txt # Python 依赖
│   └── Dockerfile       # Fly.io 部署配置
├── src/
│   ├── app/
│   │   ├── page.tsx              # 主页（爆款图生成器）
│   │   ├── crawler/
│   │   │   └── page.tsx          # 爬取工具页面
│   │   ├── api/
│   │   │   ├── batch-parse/        # 批量解析 API（一次性）
│   │   │   ├── batch-parse-stream/ # 批量解析流式 API（SSE 实时进度）
│   │   │   ├── download-note/    # 下载 API（旧版）
│   │   │   └── browse-folder/    # 文件夹浏览 API
│   │   └── layout.tsx            # 根布局（包含图标配置）
│   ├── components/
│   │   ├── EditorPanel.tsx       # 编辑器面板
│   │   ├── CanvasPreview.tsx     # 画布预览
│   │   └── NotePreviewModal.tsx  # 笔记预览弹窗
│   ├── types.ts                  # TypeScript 类型定义
│   └── lib/
│       └── utils.ts              # 工具函数
├── public/
│   ├── icon-option-1.svg        # 图标选项1（已应用）
│   ├── icon-option-2.svg         # 图标选项2
│   ├── ...                        # 其他图标选项
│   └── icon-preview.html         # 图标预览页面
├── fly.toml                      # Fly.io 配置文件
├── FLY_DEPLOY.md                 # Fly.io 部署详细说明
├── ICON_SELECTION.md             # 图标选择指南
└── package.json
```

## API 接口说明

### 后端接口（FastAPI）

- `POST /api/batch_parse` - 批量解析笔记链接（一次性返回）
- `POST /api/batch_parse_stream` - 批量解析笔记链接（SSE 流式，实时进度）
- `POST /api/download_zip` - ZIP下载（推荐，直接下载到本地；支持 `include_text` 参数）
- `POST /api/selective_download` - 选择性下载（旧版，保存到服务器）
- `POST /api/browse_folder` - 浏览文件夹（用于选择保存路径）
- `POST /api/generate` - 生成爆款图内容（主页使用）

### 前端 API 路由（Next.js）

- `POST /api/batch-parse` - 批量解析代理（一次性）
- `POST /api/batch-parse-stream` - 批量解析流式代理（SSE，用于实时进度）
- `POST /api/download-note` - 下载代理（旧版）
- `POST /api/browse-folder` - 文件夹浏览代理

### 后端环境变量（可选）

- `BATCH_PARSE_CONCURRENCY` - 批量解析并发数（默认 `5`，范围 1～10）。目标站限流严时可调小。

## 部署说明

### 本地开发

1. **启动后端**：
   ```bash
   cd backend
   python main.py
   ```
   后端服务将在 `http://127.0.0.1:8000` 启动。

2. **启动前端**：
   ```bash
   npm run dev
   ```
   前端服务将在 `http://localhost:3000` 启动。

### 生产环境部署

#### 前端部署（Vercel）

1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. 设置环境变量：
   - `NEXT_PUBLIC_BACKEND_URL` = `https://your-fly-app.fly.dev`
4. 部署完成

#### 后端部署（Fly.io）

详细部署步骤请参考：[FLY_DEPLOY.md](./FLY_DEPLOY.md)

**快速部署**：
```bash
# 1. 安装 flyctl（如果还没安装）
# Windows: 下载 https://github.com/superfly/flyctl/releases/latest

# 2. 登录
flyctl auth login

# 3. 部署
flyctl deploy
```

**部署后的URL**：
- 后端地址：`https://xhs-factory-backend.fly.dev`（或你自定义的app名称）
- API文档：`https://your-app.fly.dev/docs`

**重要配置**：
- ✅ 已配置自动停机（`min_machines_running = 0`）
- ✅ 空闲时自动停止，节省免费额度
- ✅ 有请求时自动启动（会有几秒冷启动延迟）

## 注意事项

1. **Playwright 环境**：
   - 本地开发：确保已安装 Playwright 浏览器驱动
     ```bash
     playwright install chromium
     ```
   - Fly.io 部署：Dockerfile 已自动安装，无需手动操作

2. **后端地址配置**：
   - 本地开发：默认 `http://127.0.0.1:8000`
   - 生产环境：在 Vercel 环境变量中设置 `NEXT_PUBLIC_BACKEND_URL`

3. **数据存储**：
   - 笔记数据存储在浏览器的 localStorage 中，清除浏览器数据会丢失所有记录
   - 下载的ZIP文件保存在本地下载文件夹，不会占用服务器存储

4. **ZIP下载功能**：
   - 所有下载都会自动打包成ZIP文件
   - 可选择「同时下载文本」；取消勾选时 ZIP 仅含图片
   - 支持选择性下载（只下载选中的图片）

5. **解析并发与限流**：
   - 后端通过环境变量 `BATCH_PARSE_CONCURRENCY` 控制批量解析并发数（默认 5）
   - 若目标站限流较严，可在 backend 目录下设置该变量为较小值（如 3）

6. **Fly.io 免费额度**：
   - 免费额度有限，建议合理使用
   - 已配置自动停机，空闲时不消耗资源
   - 如果超出免费额度，服务会自动停止（需要升级账户才能继续使用）

## 图标选择

项目提供了 8 个不同风格的图标供选择：

- **选项1-3**：小红书风格（红色主题）
- **选项4-8**：硅谷风格（简约大方，无XHS字样）

预览和选择图标：
1. 启动开发服务器：`npm run dev`
2. 访问：`http://localhost:3000/icon-preview.html`
3. 选择喜欢的图标后告诉我，我会帮你应用到项目中

当前已应用：**选项1（现代简约风格）**

## License

MIT
