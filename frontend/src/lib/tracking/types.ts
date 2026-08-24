export type LinkStatus =
  | "valid"
  | "expired"
  | "revoked"
  | "trip_finalized"
  | "trip_cancelled"
  | "invalid";

export type TrackingStep =
  | "loading"
  | "invalid"
  | "detail"
  | "consent"
  | "gps"
  | "ready"
  | "pop"
  | "active"
  | "incident"
  | "arrival"
  | "pod"
  | "done";

export type PublicTripPayload = {
  empresa: string | null;
  viaje: {
    id: string;
    codigo: string;
    estado: string;
    cliente: string;
    origen: string;
    destino: string;
    fecha: string | null;
    hora: string | null;
    carga: string | null;
    notas: string | null;
  };
  chofer: string | null;
  vehiculo: { tractor: string | null; semi: string | null };
  link: { id: string; expiresAt: string; usedAt: string | null };
  session: { id: string; status: string; startedAt: string | null; source: string } | null;
  tracking: {
    status: string;
    lastPosition: { latitude: number; longitude: number; accuracy: number | null; recordedAt: string } | null;
    lastPositionAt: string | null;
    positionAgeSeconds: number | null;
    accuracy: number | null;
    source: string;
    currentEta: string | null;
    distanceRemaining: number | null;
  } | null;
  consentVersion: string;
  evidence?: {
    requirePop: boolean;
    requirePod: boolean;
    popStatus: string;
    podStatus: string;
  };
  disclaimer: string;
};

export type PositionInput = {
  sessionId: string;
  sequence: number;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  altitudeMeters: number | null;
  speedMps: number | null;
  headingDegrees: number | null;
  recordedAt: string;
};

export const INCIDENT_TYPES = [
  { id: "demora", label: "Demora" },
  { id: "accidente", label: "Accidente" },
  { id: "problema_mecanico", label: "Problema mecánico" },
  { id: "direccion_incorrecta", label: "Dirección incorrecta" },
  { id: "rechazo_entrega", label: "Rechazo de entrega" },
  { id: "mercaderia_danada", label: "Mercadería dañada" },
  { id: "problema_carga_descarga", label: "Problema en carga o descarga" },
  { id: "otro", label: "Otro" },
] as const;

export const POD_OUTCOMES = [
  { id: "complete", label: "Entrega completa" },
  { id: "partial", label: "Entrega parcial" },
  { id: "rejected", label: "Rechazada" },
] as const;

export const LINK_STATUS_LABEL: Record<string, string> = {
  expired: "Este enlace venció. Pedile a operaciones uno nuevo.",
  revoked: "Este enlace fue revocado.",
  trip_finalized: "El viaje ya fue finalizado.",
  trip_cancelled: "El viaje fue cancelado.",
  invalid: "Enlace inválido o inexistente.",
};
