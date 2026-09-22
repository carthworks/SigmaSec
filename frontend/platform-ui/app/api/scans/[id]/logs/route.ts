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
  const backendUrl = `${base}/scans/${id}/logs`;

  try {
    const res = await fetch(backendUrl, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 404) {
        return new NextResponse("Scan not found", { status: 404 });
      }
      return new NextResponse(`Backend responded with status ${res.status}`, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching scan logs:", error?.message || error);
    return NextResponse.json({ scan_id: id, logs: [] });
  }
}
