import { ParseRequest } from "@/types";

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

/**
 * 流式批量解析：代理后端 SSE，返回 text/event-stream，前端可实时收到「已解析 3/10」进度。
 */
export async function POST(req: Request) {
  try {
    const body: ParseRequest = await req.json();
    const { urls } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ message: "缺少 urls 参数或 urls 为空" }),
        { status: 400 }
      );
    }

    const res = await fetch(`${BACKEND_BASE}/api/batch_parse_stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls }),
    });

    if (!res.ok || !res.body) {
      const text = await res.text();
      return new Response(
        JSON.stringify({ message: text || "流式解析请求失败" }),
        { status: res.status }
      );
    }

    return new Response(res.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("调用后端流式解析接口失败:", error);
    return new Response(
      JSON.stringify({
        message: "服务端错误，请检查 Python 后端是否已启动",
      }),
      { status: 500 }
    );
  }
}
