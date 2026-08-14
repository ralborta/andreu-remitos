"use client";

import { forwardRef } from "react";
import { AssistantChatPanel } from "./ChatCentralPanel";
import type { AgentChatHandle } from "./AgentChat";
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

/** Chat contextual POD — mismo diseño que Chat Central. */
export const PodAgentChat = forwardRef<AgentChatHandle, PodAgentChatProps>(
  function PodAgentChat({ className }, ref) {
    return (
      <AssistantChatPanel
        ref={ref}
        agentId="pod"
        agentLabel="POD"
        tenant={BRAND.remitoTenantSlug}
        suggestions={POD_CHAT_SUGGESTIONS}
        className={className}
        heroSubtitle="Preguntame por pendientes, rechazos, últimos del día o el viaje de un código."
      />
    );
  },
);
