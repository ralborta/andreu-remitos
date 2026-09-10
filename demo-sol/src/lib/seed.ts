export type DemoTrip = {
  id: string;
  cliente: string;
  origen: string;
  destino: string;
  chofer: string;
  patente: string;
  estado: "en_curso" | "demorado" | "asignado" | "entregado";
  progreso: number;
  eta: string;
};

export const CIUDADES: Record<string, { lat: number; lng: number }> = {
  CABA: { lat: -34.6037, lng: -58.3816 },
  Rosario: { lat: -32.9442, lng: -60.6505 },
  Córdoba: { lat: -31.4201, lng: -64.1888 },
  Mendoza: { lat: -32.8895, lng: -68.8458 },
  "Mar del Plata": { lat: -38.0055, lng: -57.5426 },
  Tucumán: { lat: -26.8083, lng: -65.2176 },
  "Bahía Blanca": { lat: -38.7183, lng: -62.2663 },
  "Santa Fe": { lat: -31.6333, lng: -60.7 },
  Neuquén: { lat: -38.9516, lng: -68.0591 },
  Ezeiza: { lat: -34.8531, lng: -58.5228 },
  Pilar: { lat: -34.4587, lng: -58.9142 },
  Campana: { lat: -34.1635, lng: -58.9592 },
};

export const DEMO_TRIPS: DemoTrip[] = [
  {
    id: "VJ-DEM-001",
    cliente: "Cliente Demo Norte",
    origen: "Córdoba",
    destino: "CABA",
    chofer: "Martín Ríos",
    patente: "AB 123 CD",
    estado: "en_curso",
    progreso: 62,
    eta: "18:40",
  },
  {
    id: "VJ-DEM-002",
    cliente: "Cliente Demo Litoral",
    origen: "Rosario",
    destino: "CABA",
    chofer: "Lucía Fernández",
    patente: "AC 456 EF",
    estado: "en_curso",
    progreso: 35,
    eta: "17:15",
  },
  {
    id: "VJ-DEM-003",
    cliente: "Cliente Demo Cuyo",
    origen: "Mendoza",
    destino: "Córdoba",
    chofer: "Diego Suárez",
    patente: "AD 789 GH",
    estado: "demorado",
    progreso: 48,
    eta: "21:05",
  },
  {
    id: "VJ-DEM-004",
    cliente: "Cliente Demo Atlántico",
    origen: "CABA",
    destino: "Mar del Plata",
    chofer: "Paula Gómez",
    patente: "AE 321 IJ",
    estado: "en_curso",
    progreso: 78,
    eta: "16:50",
  },
  {
    id: "VJ-DEM-005",
    cliente: "Cliente Demo NOA",
    origen: "Tucumán",
    destino: "Rosario",
    chofer: "Hernán Paz",
    patente: "AF 654 KL",
    estado: "asignado",
    progreso: 5,
    eta: "—",
  },
  {
    id: "VJ-DEM-006",
    cliente: "Cliente Demo Sur",
    origen: "Bahía Blanca",
    destino: "Neuquén",
    chofer: "Sofía Castro",
    patente: "AG 987 MN",
    estado: "entregado",
    progreso: 100,
    eta: "Entregado",
  },
];

export const STATUS_COLOR: Record<DemoTrip["estado"], string> = {
  en_curso: "#38bdf8",
  demorado: "#f59e0b",
  asignado: "#a79fc9",
  entregado: "#22c55e",
};

export const STATUS_LABEL: Record<DemoTrip["estado"], string> = {
  en_curso: "En curso",
  demorado: "Demorado",
  asignado: "Asignado",
  entregado: "Entregado",
};

export function tripPosition(t: DemoTrip) {
  const o = CIUDADES[t.origen];
  const d = CIUDADES[t.destino];
  if (!o || !d) return null;
  const p = Math.min(100, Math.max(0, t.progreso)) / 100;
  return {
    lat: o.lat + (d.lat - o.lat) * p,
    lng: o.lng + (d.lng - o.lng) * p,
    origin: o,
    dest: d,
  };
}

export function diagnosticBullets(painPoint?: string, company?: string) {
  const co = company || "tu operación";
  const base = [
    `${co}: hoy la mesa depende de WhatsApp disperso y planillas para cerrar viajes.`,
    "Oportunidad: unificar remitos, evidencias POP/POD y excepciones en una sola mesa.",
    "En esta demo podés recorrer los 10 agentes y el mapa de flota con datos de ejemplo.",
  ];
  if (!painPoint) return base;
  const p = painPoint.toLowerCase();
  if (p.includes("remito")) {
    base[0] = `${co}: el cuello de botella está en captura y validación de remitos.`;
  } else if (p.includes("pod") || p.includes("eviden")) {
    base[0] = `${co}: falta cadena de custodia clara (POP/POD) entre origen y destino.`;
  } else if (p.includes("track") || p.includes("gps") || p.includes("mapa")) {
    base[0] = `${co}: necesitan visibilidad de flota y ETA sin app nativa.`;
  } else if (p.includes("incidencia") || p.includes("demora")) {
    base[0] = `${co}: las demoras llegan tarde a la mesa y al cliente.`;
  }
  return base;
}
