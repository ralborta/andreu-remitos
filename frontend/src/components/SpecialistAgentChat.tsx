"use client";

import { forwardRef } from "react";
import { AgentChat, type AgentChatHandle } from "./AgentChat";
import { postAgentChat } from "@/lib/api";
import { BRAND } from "@/lib/brand";

type SpecialistAgentChatProps = {
  agentId: string;
  agentLabel: string;
  suggestions?: string[];
  emptyHint?: string;
  placeholder?: string;
  hideSuggestions?: boolean;
  className?: string;
  tenant?: string | null;
};

/** Binding genérico al desk-chat runtime (mismo AgentChat reutilizable). */
export const SpecialistAgentChat = forwardRef<AgentChatHandle, SpecialistAgentChatProps>(
  function SpecialistAgentChat(
    {
      agentId,
      agentLabel,
      suggestions = [],
      emptyHint,
      placeholder = "Escribí tu consulta…",
      hideSuggestions = false,
      className,
      tenant,
    },
    ref,
  ) {
    return (
      <AgentChat
        ref={ref}
        agentId={agentId}
        agentLabel={agentLabel}
        tenant={tenant ?? BRAND.remitoTenantSlug}
        suggestions={suggestions}
        hideSuggestions={hideSuggestions}
        className={className}
        placeholder={placeholder}
        emptyHint={emptyHint ?? `Hola. Soy el asistente de ${agentLabel}. Consultá datos reales del módulo.`}
        onSend={async ({ message, conversationId, agentId: id, tenant: t }) => {
          const res = await postAgentChat({
            agentId: id,
            message,
            conversationId: conversationId || undefined,
            tenant: t || undefined,
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
