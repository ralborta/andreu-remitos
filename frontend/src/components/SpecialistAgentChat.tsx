"use client";

import { forwardRef } from "react";
import { AssistantChatPanel } from "./ChatCentralPanel";
import type { AgentChatHandle } from "./AgentChat";
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

/** Binding genérico al desk-chat — mismo diseño visual que Chat Central. */
export const SpecialistAgentChat = forwardRef<AgentChatHandle, SpecialistAgentChatProps>(
  function SpecialistAgentChat(
    {
      agentId,
      agentLabel,
      suggestions = [],
      emptyHint,
      placeholder,
      className,
      tenant,
    },
    ref,
  ) {
    return (
      <AssistantChatPanel
        ref={ref}
        agentId={agentId}
        agentLabel={agentLabel}
        suggestions={suggestions}
        heroSubtitle={emptyHint}
        placeholder={placeholder}
        className={className}
        tenant={tenant ?? BRAND.remitoTenantSlug}
      />
    );
  },
);
