"use client";

import { SpecialistAgentChat } from "./SpecialistAgentChat";

/** Chat Central embebido en Torre de Control (mismo runtime desk-chat). */
export function TorreChat() {
  return (
    <SpecialistAgentChat
      agentId="commander"
      agentLabel="Chat Central"
      hideSuggestions={false}
      suggestions={[
        "¿Cuántos camiones están por salir?",
        "¿Qué incidencias tenemos?",
        "¿Qué camiones tienen demora?",
        "¿Qué viajes están pendientes?",
      ]}
      emptyHint="¡Hola! Soy el Chat Central. Preguntame por viajes, incidencias, ETA, POD, remitos o rendiciones."
      placeholder="Preguntá algo sobre la operación…"
    />
  );
}
