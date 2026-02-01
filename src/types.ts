export type LayoutStyle = 'cover-big' | 'list-simple' | 'quote-classic';

export interface PostData {
  layout: LayoutStyle;
  themeColor: string; // // 主题色类名 (如 bg-xhs-bg-cream)
  englishHook: string;// 英文钩子 (如 AWAKENING)
  title: string;// 标题
  subTitle: string;// 副标题
  content: string[]; // 正文段落数组，方便列表渲染
  tags: string[];// 标签数组
  footerText: string;// 底部版权文字
  images?: string[];      // [新增] 爬虫抓取的图片列表 (可选)
}

// === 爬取功能相关类型 ===
export interface Note {
  id: string; // 唯一ID（基于URL生成）
  url: string; // 原始链接
  title: string; // 标题
  content: string; // 正文（完整文本）
  tags: string[]; // 标签
  images: string[]; // 图片URL列表
  coverImage?: string; // 封面图（第一张图片）
  createdAt: number; // 创建时间戳
  isDeleted?: boolean; // 是否在回收站
}

export interface ParseRequest {
  urls: string[]; // 要解析的URL列表
}

export interface ParseResponse {
  notes: Note[]; // 解析成功的笔记列表
  failed: Array<{ url: string; error: string }>; // 解析失败的URL及错误信息
}

export interface DownloadRequest {
  noteIds: string[]; // 要下载的笔记ID列表
  selectedImages?: Record<string, number[]>; // 每个笔记选中的图片索引（可选，不传则下载全部）
  baseDir?: string; // 保存根目录（可选）
}

/** 待办库单项：链接 + 是否已解析 */
export interface TodoItem {
  url: string;
  parsed: boolean;
}