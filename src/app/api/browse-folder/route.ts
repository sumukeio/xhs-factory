import { NextResponse } from 'next/server';

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { path } = body;

    let res: Response;
    try {
      res = await fetch(`${BACKEND_BASE}/api/browse_folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
    } catch (e) {
      console.error('无法连接后端浏览文件夹接口:', e);
      return NextResponse.json(
        { message: '无法连接后端，请确认 backend 已启动且地址可访问' },
        { status: 502 },
      );
    }

    const contentType = res.headers.get('content-type') || '';
    let data: any = null;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = { message: text || '后端返回非 JSON 响应' };
    }

    // 确保错误时也有可读 message
    if (!res.ok) {
      const msg = data?.detail || data?.message || '浏览文件夹失败';
      return NextResponse.json({ ...data, message: msg }, { status: res.status });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('调用后端浏览文件夹接口失败:', error);
    return NextResponse.json(
      { message: '服务端错误，请检查 Python 后端是否已启动' },
      { status: 500 },
    );
  }
}
