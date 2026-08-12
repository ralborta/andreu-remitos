/**
 * Cliente OpenAI JSON para Desk Chat Runtime (sin cambiar proveedor).
 */

export async function callDeskChatLlmJson({
  system,
  userContent,
  model,
  timeoutMs,
  temperature = 0.1,
  maxTokens = 1200,
  log,
} = {}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "openai_api_key_missing", parsed: null };
  }

  const resolvedModel =
    model ||
    process.env.OPENAI_DESK_CHAT_MODEL?.trim() ||
    process.env.OPENAI_POD_DESK_MODEL?.trim() ||
    process.env.OPENAI_POD_MODEL?.trim() ||
    process.env.OPENAI_VIAJES_MODEL?.trim() ||
    "gpt-4o-mini";

  const ms = Number(timeoutMs) || Number(process.env.DESK_CHAT_IA_TIMEOUT_MS) || 28000;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: resolvedModel,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(ms),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI ${res.status}: ${body.slice(0, 160)}`);
    }
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "";
    const m = String(raw).match(/\{[\s\S]*\}/);
    if (!m) return { ok: false, error: "llm_sin_json", parsed: null, raw };
    return { ok: true, error: null, parsed: JSON.parse(m[0]), raw, model: resolvedModel };
  } catch (err) {
    log?.warn?.({ err: err.message }, "desk-chat LLM falló");
    return { ok: false, error: err.message || "llm_error", parsed: null };
  }
}
