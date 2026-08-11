"use client";

import { AgentChat } from "./AgentChat";
import { postAgentChat } from "@/lib/api";
import { BRAND } from "@/lib/brand";

const SUGGESTIONS = [
  "¿cuántos POD recibimos hoy?",
  "¿cuántos están pendientes?",
  "¿cuáles fueron rechazados?",
  "mostrame los últimos 10",
];

/** Chat contextual del módulo POD (mesa). */
export function PodAgentChat() {
  return (
    <AgentChat
      agentId="pod"
      agentLabel="POD"
      tenant={BRAND.remitoTenantSlug}
      suggestions={SUGGESTIONS}
      placeholder="Ej. ¿cuántos están pendientes?"
      emptyHint="Consultá pendientes, rechazos, últimos POD o el viaje de un código."
      onSend={async ({ message, conversationId, agentId, tenant }) => {
        const res = await postAgentChat({
          agentId,
          message,
          conversationId: conversationId || undefined,
          tenant: tenant || undefined,
        });
        return {
          conversationId: res.conversationId,
          text: res.message.text,
          engine: res.message.engine,
          dataSources: res.message.dataSources,
          citedIds: res.message.citedIds,
        };
      }}
    />
  );
}
