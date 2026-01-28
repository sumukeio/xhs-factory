import { NextResponse } from 'next/server';

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { path } = body;

    const res = await fetch(`${BACKEND_BASE}/api/browse_folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });

    const data = await res.json();

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('调用后端浏览文件夹接口失败:', error);
    return NextResponse.json(
      { message: '服务端错误，请检查 Python 后端是否已启动' },
      { status: 500 },
    );
  }
}
