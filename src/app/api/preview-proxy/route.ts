import { NextRequest, NextResponse } from "next/server";

function isAllowed(url: URL, allowed: string[]): boolean {
  return allowed.some((a) => a && (url.origin === a || url.href.startsWith(a)));
}

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("url");
  if (!target) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  const t = new URL(target);

  try {
    const upstream = await fetch(t.toString(), { redirect: "follow" });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") || "text/html; charset=utf-8",
        "cache-control": "private, max-age=10",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Upstream error" }, { status: 500 });
  }
}
