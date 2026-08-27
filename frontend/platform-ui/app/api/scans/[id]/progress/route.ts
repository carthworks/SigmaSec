import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  // Retrieve NextAuth token from current session cookies
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !token.accessToken) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Resolve backend URL cleanly
  let base = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  base = base.replace(/\/api\/backend\/?$/, "").replace(/\/+$/, "");
  const backendUrl = `${base}/scans/${id}/progress`;

  // Attach abort signal listener to prevent TypeError: terminated when browser disconnects
  const controller = new AbortController();
  request.signal.addEventListener("abort", () => {
    controller.abort();
  });

  try {
    const res = await fetch(backendUrl, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      if (res.status === 404) {
        return new NextResponse("Scan progress not found", { status: 404 });
      }
      return new NextResponse(`Backend progress endpoint responded with status ${res.status}`, { status: res.status });
    }

    // Proxy the stream body directly to the client as text/event-stream
    const stream = res.body;
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: any) {
    if (error?.name === "AbortError" || request.signal.aborted) {
      // Normal browser disconnection / navigation away
      return new NextResponse(null, { status: 204 });
    }
    console.error("Error proxying SSE progress stream:", error?.message || error);
    return new NextResponse(JSON.stringify({ error: "Stream disconnected" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
