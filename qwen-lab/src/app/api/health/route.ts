import { NextResponse } from "next/server";
import { OLLAMA_BASE_URL, OLLAMA_MODEL, LAB_HOST_LABEL } from "../../lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const t0 = Date.now();
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as {
      models?: Array<{ name: string; size?: number; modified_at?: string }>;
    };
    const models = (data.models || []).map((m) => m.name);
    return NextResponse.json({
      ok: res.ok,
      online: res.ok,
      latencyMs: Date.now() - t0,
      baseUrl: OLLAMA_BASE_URL,
      defaultModel: OLLAMA_MODEL,
      host: LAB_HOST_LABEL,
      models,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        online: false,
        latencyMs: Date.now() - t0,
        baseUrl: OLLAMA_BASE_URL,
        defaultModel: OLLAMA_MODEL,
        host: LAB_HOST_LABEL,
        models: [] as string[],
        error: e instanceof Error ? e.message : "unreachable",
      },
      { status: 503 },
    );
  }
}
