import { NextResponse } from 'next/server';
import { ParseRequest, ParseResponse } from '@/types';

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  try {
    const body: ParseRequest = await req.json();
    const { urls } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { message: '缺少 urls 参数或 urls 为空' },
        { status: 400 },
      );
    }

    const res = await fetch(`${BACKEND_BASE}/api/batch_parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
    });

    const data = await res.json();

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('调用后端批量解析接口失败:', error);
    return NextResponse.json(
      { message: '服务端错误，请检查 Python 后端是否已启动' },
      { status: 500 },
    );
  }
}
