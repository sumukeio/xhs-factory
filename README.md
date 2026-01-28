# XHS Factory - 小红书内容工厂

一个功能强大的小红书笔记爬取与管理工具，支持批量解析、预览、选择性下载等功能。

## 功能特性

### 🎨 爆款图生成器（主页）
- 可视化编辑小红书爆款图
- 支持多种布局和主题配色
- AI 智能识别图片文字

### 🕷️ 笔记爬取工具（`/crawler`）
- **批量解析**：支持一次性解析多个小红书笔记链接
- **智能提取**：粘贴文本时自动提取其中的链接
- **预览方块**：上图下文展示，直观查看笔记内容
- **预览弹窗**：点击预览方块查看详细信息
  - 左侧：图片轮播（支持滑动/箭头翻页）
  - 右侧：标题、文字、标签
  - 支持选择性下载图片
- **批量操作**：
  - 批量选中笔记
  - 一键下载（全部图片+文字）
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
3. 点击"开始解析"按钮
4. 解析完成后，笔记会以预览方块的形式展示在预览区
5. 点击预览方块可以查看详细信息并选择性下载

### 批量操作

1. 点击"批量选中"按钮进入批量模式
2. 点击预览方块进行选择
3. 选择完成后，可以：
   - 点击"一键下载"：下载所有选中笔记的全部图片和文字
   - 点击"批量删除"：将选中笔记移至回收站

### 选择性下载

1. 点击预览方块打开预览弹窗
2. 在底部缩略图区域点击图片进行选择/取消选择
3. 点击"下载"按钮，只下载选中的图片和全部文字

### 回收站

1. 切换到"回收站"标签页
2. 可以批量恢复或永久删除笔记

## 项目结构

```
xhs-factory/
├── backend/              # Python 后端
│   ├── main.py          # FastAPI 主文件
│   ├── scraper.py       # 爬虫核心逻辑
│   └── requirements.txt # Python 依赖
├── src/
│   ├── app/
│   │   ├── page.tsx              # 主页（爆款图生成器）
│   │   ├── crawler/
│   │   │   └── page.tsx          # 爬取工具页面
│   │   └── api/
│   │       ├── batch-parse/     # 批量解析 API
│   │       └── download-note/   # 下载 API
│   ├── components/
│   │   ├── EditorPanel.tsx       # 编辑器面板
│   │   ├── CanvasPreview.tsx    # 画布预览
│   │   └── NotePreviewModal.tsx # 笔记预览弹窗
│   ├── types.ts                  # TypeScript 类型定义
│   └── lib/
│       └── utils.ts              # 工具函数
└── package.json
```

## 注意事项

1. **Playwright 环境**：确保已安装 Playwright 浏览器驱动
   ```bash
   playwright install chromium
   ```

2. **后端地址**：如需修改后端地址，可在 `.env.local` 中设置：
   ```
   NEXT_PUBLIC_BACKEND_URL=http://your-backend-url:8000
   ```

3. **数据存储**：笔记数据存储在浏览器的 localStorage 中，清除浏览器数据会丢失所有记录。

## License

MIT
