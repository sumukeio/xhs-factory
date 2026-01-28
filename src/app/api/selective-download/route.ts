import { NextResponse } from 'next/server';
import { DownloadRequest } from '@/types';

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  try {
    const body: DownloadRequest = await req.json();
    const { noteIds, selectedImages, baseDir } = body;

    if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
      return NextResponse.json(
        { message: '缺少 noteIds 参数或 noteIds 为空' },
        { status: 400 },
      );
    }

    // 这里需要从localStorage获取笔记数据，但API路由无法访问localStorage
    // 所以改为前端直接调用后端，或者改为传递完整笔记数据
    // 暂时返回错误，提示前端需要传递完整数据
    return NextResponse.json(
      { message: '请使用前端直接调用后端接口，或传递完整笔记数据' },
      { status: 400 },
    );
  } catch (error) {
    console.error('调用后端选择性下载接口失败:', error);
    return NextResponse.json(
      { message: '服务端错误，请检查 Python 后端是否已启动' },
      { status: 500 },
    );
  }
}
