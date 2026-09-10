import { NextResponse } from "next/server";
import { OLLAMA_BASE_URL } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    return NextResponse.json({
      models: (data.models || []).map((m) => m.name),
    });
  } catch (e) {
    return NextResponse.json(
      { models: [], error: e instanceof Error ? e.message : "error" },
      { status: 503 },
    );
  }
}
