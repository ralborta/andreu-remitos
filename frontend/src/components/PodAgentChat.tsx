"use client";

import { forwardRef } from "react";
import { AgentChat, type AgentChatHandle } from "./AgentChat";
import { postAgentChat } from "@/lib/api";
import { BRAND } from "@/lib/brand";

export const POD_CHAT_SUGGESTIONS = [
  "¿cuántos POD recibimos hoy?",
  "¿cuántos están pendientes?",
  "¿cuáles fueron rechazados?",
  "mostrame los últimos 10",
];

type PodAgentChatProps = {
  hideSuggestions?: boolean;
  className?: string;
};

/** Chat contextual del módulo POD (mesa). */
export const PodAgentChat = forwardRef<AgentChatHandle, PodAgentChatProps>(
  function PodAgentChat({ hideSuggestions = false, className }, ref) {
    return (
      <AgentChat
        ref={ref}
        agentId="pod"
        agentLabel="POD"
        tenant={BRAND.remitoTenantSlug}
        suggestions={POD_CHAT_SUGGESTIONS}
        hideSuggestions={hideSuggestions}
        className={className}
        placeholder="Escribí tu consulta…"
        emptyHint="Hola. Soy el asistente de POD. Preguntame por pendientes, rechazos, últimos del día o el viaje de un código."
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
  },
);
