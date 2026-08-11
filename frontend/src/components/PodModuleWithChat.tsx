"use client";

import { PodPanel } from "./PodPanel";
import { PodAgentChat } from "./PodAgentChat";

/** Módulo POD: panel de casos + chat contextual debajo. */
export function PodModuleWithChat() {
  return (
    <div className="space-y-6">
      <PodPanel />
      <div className="mx-auto w-full max-w-3xl">
        <PodAgentChat />
      </div>
    </div>
  );
}
