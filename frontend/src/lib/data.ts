// Datos operativos de la plataforma. Argentina.

export type TripStatus =
  | "pendiente"
  | "en_curso"
  | "detenido"
  | "entregado"
  | "cerrado";

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  detenido: "Detenido",
  entregado: "Entregado",
  cerrado: "Cerrado",
};

export const TRIP_STATUS_COLOR: Record<TripStatus, string> = {
  pendiente: "#a79fc9",
  en_curso: "#38bdf8",
  detenido: "#f59e0b",
  entregado: "#22c55e",
  cerrado: "#6f6796",
};

export interface Trip {
  id: string;
  cliente: string;
  origen: string;
  destino: string;
  chofer: string;
  patente: string;
  estado: TripStatus;
  progreso: number;
  eta: string;
  carga: string;
  km: number;
  // posición normalizada (0-100) sobre el mapa estilizado
  x: number;
  y: number;
}

export const CLIENTES = [
  "Arcor S.A.",
  "Molinos Río de la Plata",
  "Cervecería Quilmes",
  "Coca-Cola Andina",
  "YPF Distribución",
  "Frigorífico La Pampa",
  "Acindar Grupo",
  "La Serenísima",
  "Distribuidora del Sur",
  "Ledesma S.A.A.I.",
  "Andreani Logística",
  "Mercado Libre Full",
  "Newsan",
  "Toyota Argentina",
  "Bagley Argentina",
  "Sinteplast",
  "Mastellone Hnos.",
  "Grupo Logístico Patagónico",
];

export const CHOFERES = [
  { nombre: "Carlos Páez", patente: "AD 482 KP", tel: "+54 9 11 5821-4477" },
  { nombre: "Miguel Sosa", patente: "AC 119 RT", tel: "+54 9 341 612-8890" },
  { nombre: "Roberto Quiroga", patente: "AE 730 LM", tel: "+54 9 351 447-2231" },
  { nombre: "Juan Domínguez", patente: "AB 905 FC", tel: "+54 9 11 3344-9087" },
  { nombre: "Héctor Maldonado", patente: "AF 214 NB", tel: "+54 9 261 558-1120" },
  { nombre: "Sergio Ferreyra", patente: "AD 661 QW", tel: "+54 9 223 470-6654" },
  { nombre: "Daniel Acosta", patente: "AC 388 HD", tel: "+54 9 381 419-2278" },
  { nombre: "Walter Benítez", patente: "AE 057 PZ", tel: "+54 9 291 533-7741" },
  { nombre: "Pablo Cardozo", patente: "AB 742 GV", tel: "+54 9 342 488-3309" },
  { nombre: "Marcelo Ojeda", patente: "AF 593 TK", tel: "+54 9 11 6612-0098" },
  { nombre: "Gustavo Leiva", patente: "AG 812 DX", tel: "+54 9 11 6041-3377" },
  { nombre: "Fernando Ledesma", patente: "AF 090 ZM", tel: "+54 9 358 421-9981" },
  { nombre: "Luis Cabrera", patente: "AE 445 NU", tel: "+54 9 379 511-2044" },
  { nombre: "Raúl Varela", patente: "AC 761 YP", tel: "+54 9 221 618-7732" },
  { nombre: "Nicolás Peralta", patente: "AD 030 JS", tel: "+54 9 2966 512-338" },
  { nombre: "Martín Aguirre", patente: "AF 668 CV", tel: "+54 9 11 5097-1142" },
  { nombre: "Oscar Medina", patente: "AG 194 HR", tel: "+54 9 343 470-9001" },
  { nombre: "Ezequiel Farias", patente: "AE 921 BT", tel: "+54 9 236 462-3199" },
];

// Posiciones aproximadas (x,y en %) de ciudades sobre el mapa estilizado de Argentina
export const CIUDADES: Record<string, { x: number; y: number }> = {
  "CABA": { x: 62, y: 55 },
  "La Plata": { x: 64, y: 58 },
  "Rosario": { x: 58, y: 49 },
  "Córdoba": { x: 48, y: 44 },
  "Mendoza": { x: 30, y: 50 },
  "Mar del Plata": { x: 68, y: 64 },
  "Bahía Blanca": { x: 54, y: 68 },
  "Tucumán": { x: 45, y: 26 },
  "Salta": { x: 44, y: 16 },
  "San Nicolás": { x: 59, y: 51 },
  "Zárate": { x: 61, y: 53 },
  "Santa Fe": { x: 56, y: 44 },
  "Neuquén": { x: 35, y: 70 },
  "Posadas": { x: 72, y: 30 },
  "Paraná": { x: 57, y: 45 },
  "Corrientes": { x: 66, y: 35 },
  "Resistencia": { x: 64, y: 34 },
  "Río Cuarto": { x: 45, y: 50 },
  "Villa María": { x: 50, y: 47 },
  "Rafaela": { x: 55, y: 43 },
  "Campana": { x: 61, y: 52 },
  "Pilar": { x: 61, y: 54 },
  "Ezeiza": { x: 62, y: 56 },
  "Olavarría": { x: 59, y: 63 },
  "Tres Arroyos": { x: 59, y: 68 },
  "San Luis": { x: 38, y: 50 },
  "Comodoro Rivadavia": { x: 38, y: 88 },
};

export const trips: Trip[] = [
  {
    id: "VJ-24817",
    cliente: "Arcor S.A.",
    origen: "Córdoba",
    destino: "CABA",
    chofer: "Carlos Páez",
    patente: "AD 482 KP",
    estado: "en_curso",
    progreso: 68,
    eta: "14:35",
    carga: "Pallets golosinas · 24 t",
    km: 695,
    x: 55,
    y: 49,
  },
  {
    id: "VJ-24820",
    cliente: "Cervecería Quilmes",
    origen: "Zárate",
    destino: "Mar del Plata",
    chofer: "Juan Domínguez",
    patente: "AB 905 FC",
    estado: "detenido",
    progreso: 41,
    eta: "16:10",
    carga: "Bebidas · 28 t",
    km: 470,
    x: 65,
    y: 60,
  },
  {
    id: "VJ-24823",
    cliente: "YPF Distribución",
    origen: "Bahía Blanca",
    destino: "Neuquén",
    chofer: "Walter Benítez",
    patente: "AE 057 PZ",
    estado: "en_curso",
    progreso: 33,
    eta: "18:40",
    carga: "Lubricantes · 21 t",
    km: 540,
    x: 46,
    y: 69,
  },
  {
    id: "VJ-24826",
    cliente: "Molinos Río de la Plata",
    origen: "Rosario",
    destino: "Tucumán",
    chofer: "Miguel Sosa",
    patente: "AC 119 RT",
    estado: "en_curso",
    progreso: 54,
    eta: "21:05",
    carga: "Harina · 30 t",
    km: 820,
    x: 48,
    y: 38,
  },
  {
    id: "VJ-24829",
    cliente: "La Serenísima",
    origen: "CABA",
    destino: "Santa Fe",
    chofer: "Pablo Cardozo",
    patente: "AB 742 GV",
    estado: "entregado",
    progreso: 100,
    eta: "—",
    carga: "Lácteos refrigerados · 18 t",
    km: 475,
    x: 56,
    y: 44,
  },
  {
    id: "VJ-24831",
    cliente: "Acindar Grupo",
    origen: "San Nicolás",
    destino: "Córdoba",
    chofer: "Roberto Quiroga",
    patente: "AE 730 LM",
    estado: "en_curso",
    progreso: 77,
    eta: "13:50",
    carga: "Acero · 31 t",
    km: 560,
    x: 51,
    y: 46,
  },
  {
    id: "VJ-24834",
    cliente: "Coca-Cola Andina",
    origen: "Mendoza",
    destino: "CABA",
    chofer: "Héctor Maldonado",
    patente: "AF 214 NB",
    estado: "pendiente",
    progreso: 0,
    eta: "—",
    carga: "Bebidas · 26 t",
    km: 1040,
    x: 30,
    y: 50,
  },
  {
    id: "VJ-24836",
    cliente: "Frigorífico La Pampa",
    origen: "Mar del Plata",
    destino: "CABA",
    chofer: "Sergio Ferreyra",
    patente: "AD 661 QW",
    estado: "en_curso",
    progreso: 88,
    eta: "12:25",
    carga: "Carne refrigerada · 22 t",
    km: 410,
    x: 64,
    y: 59,
  },
  {
    id: "VJ-24839",
    cliente: "Ledesma S.A.A.I.",
    origen: "Salta",
    destino: "Rosario",
    chofer: "Daniel Acosta",
    patente: "AC 388 HD",
    estado: "detenido",
    progreso: 22,
    eta: "—",
    carga: "Azúcar · 29 t",
    km: 1180,
    x: 45,
    y: 22,
  },
  {
    id: "VJ-24842",
    cliente: "Distribuidora del Sur",
    origen: "CABA",
    destino: "La Plata",
    chofer: "Marcelo Ojeda",
    patente: "AF 593 TK",
    estado: "entregado",
    progreso: 100,
    eta: "—",
    carga: "Consumo masivo · 12 t",
    km: 62,
    x: 64,
    y: 57,
  },
  {
    id: "VJ-24845",
    cliente: "Andreani Logística",
    origen: "Campana",
    destino: "Rosario",
    chofer: "Gustavo Leiva",
    patente: "AG 812 DX",
    estado: "en_curso",
    progreso: 61,
    eta: "15:20",
    carga: "Paquetería consolidada · 16 t",
    km: 245,
    x: 59,
    y: 51,
  },
  {
    id: "VJ-24848",
    cliente: "Mercado Libre Full",
    origen: "Pilar",
    destino: "Córdoba",
    chofer: "Martín Aguirre",
    patente: "AF 668 CV",
    estado: "en_curso",
    progreso: 46,
    eta: "17:05",
    carga: "E-commerce · 18 t",
    km: 675,
    x: 56,
    y: 50,
  },
  {
    id: "VJ-24851",
    cliente: "Toyota Argentina",
    origen: "Zárate",
    destino: "Río Cuarto",
    chofer: "Fernando Ledesma",
    patente: "AF 090 ZM",
    estado: "en_curso",
    progreso: 28,
    eta: "20:15",
    carga: "Autopartes · 24 t",
    km: 640,
    x: 57,
    y: 53,
  },
  {
    id: "VJ-24854",
    cliente: "Newsan",
    origen: "CABA",
    destino: "Posadas",
    chofer: "Luis Cabrera",
    patente: "AE 445 NU",
    estado: "en_curso",
    progreso: 72,
    eta: "19:45",
    carga: "Electrodomésticos · 20 t",
    km: 1035,
    x: 69,
    y: 39,
  },
  {
    id: "VJ-24857",
    cliente: "Bagley Argentina",
    origen: "Villa María",
    destino: "Mendoza",
    chofer: "Oscar Medina",
    patente: "AG 194 HR",
    estado: "pendiente",
    progreso: 0,
    eta: "—",
    carga: "Alimentos secos · 26 t",
    km: 610,
    x: 50,
    y: 47,
  },
  {
    id: "VJ-24860",
    cliente: "Sinteplast",
    origen: "Ezeiza",
    destino: "Bahía Blanca",
    chofer: "Raúl Varela",
    patente: "AC 761 YP",
    estado: "en_curso",
    progreso: 39,
    eta: "18:05",
    carga: "Pinturas y químicos · 22 t",
    km: 615,
    x: 59,
    y: 61,
  },
  {
    id: "VJ-24863",
    cliente: "Mastellone Hnos.",
    origen: "Rafaela",
    destino: "CABA",
    chofer: "Ezequiel Farias",
    patente: "AE 921 BT",
    estado: "en_curso",
    progreso: 81,
    eta: "13:25",
    carga: "Lácteos refrigerados · 19 t",
    km: 575,
    x: 60,
    y: 52,
  },
  {
    id: "VJ-24866",
    cliente: "Grupo Logístico Patagónico",
    origen: "Bahía Blanca",
    destino: "Comodoro Rivadavia",
    chofer: "Nicolás Peralta",
    patente: "AD 030 JS",
    estado: "detenido",
    progreso: 34,
    eta: "—",
    carga: "Carga general · 25 t",
    km: 980,
    x: 47,
    y: 76,
  },
  {
    id: "VJ-24869",
    cliente: "YPF Distribución",
    origen: "La Plata",
    destino: "San Luis",
    chofer: "Héctor Maldonado",
    patente: "AF 214 NB",
    estado: "en_curso",
    progreso: 57,
    eta: "22:10",
    carga: "Lubricantes · 23 t",
    km: 825,
    x: 49,
    y: 55,
  },
  {
    id: "VJ-24872",
    cliente: "Arcor S.A.",
    origen: "Córdoba",
    destino: "Paraná",
    chofer: "Roberto Quiroga",
    patente: "AE 730 LM",
    estado: "entregado",
    progreso: 100,
    eta: "—",
    carga: "Alimentos · 21 t",
    km: 390,
    x: 57,
    y: 45,
  },
  {
    id: "VJ-24875",
    cliente: "Cervecería Quilmes",
    origen: "Tres Arroyos",
    destino: "CABA",
    chofer: "Sergio Ferreyra",
    patente: "AD 661 QW",
    estado: "cerrado",
    progreso: 100,
    eta: "—",
    carga: "Bebidas retornables · 24 t",
    km: 500,
    x: 62,
    y: 55,
  },
  {
    id: "VJ-24878",
    cliente: "Molinos Río de la Plata",
    origen: "Santa Fe",
    destino: "Corrientes",
    chofer: "Miguel Sosa",
    patente: "AC 119 RT",
    estado: "en_curso",
    progreso: 64,
    eta: "16:55",
    carga: "Alimentos secos · 27 t",
    km: 495,
    x: 62,
    y: 39,
  },
  {
    id: "VJ-24881",
    cliente: "La Serenísima",
    origen: "Olavarría",
    destino: "Mar del Plata",
    chofer: "Pablo Cardozo",
    patente: "AB 742 GV",
    estado: "entregado",
    progreso: 100,
    eta: "—",
    carga: "Refrigerados · 14 t",
    km: 310,
    x: 68,
    y: 64,
  },
  {
    id: "VJ-24884",
    cliente: "Ledesma S.A.A.I.",
    origen: "Tucumán",
    destino: "Resistencia",
    chofer: "Daniel Acosta",
    patente: "AC 388 HD",
    estado: "en_curso",
    progreso: 52,
    eta: "18:30",
    carga: "Azúcar · 30 t",
    km: 650,
    x: 56,
    y: 31,
  },
  {
    id: "VJ-24887",
    cliente: "Distribuidora del Sur",
    origen: "La Plata",
    destino: "Campana",
    chofer: "Marcelo Ojeda",
    patente: "AF 593 TK",
    estado: "pendiente",
    progreso: 0,
    eta: "—",
    carga: "Consumo masivo · 10 t",
    km: 115,
    x: 64,
    y: 58,
  },
  {
    id: "VJ-24890",
    cliente: "Acindar Grupo",
    origen: "San Nicolás",
    destino: "Rosario",
    chofer: "Juan Domínguez",
    patente: "AB 905 FC",
    estado: "en_curso",
    progreso: 18,
    eta: "14:05",
    carga: "Bobinas de acero · 29 t",
    km: 70,
    x: 59,
    y: 50,
  },
];

// ---------- Remitos ----------
export interface Remito {
  id: string;
  viaje: string;
  cliente: string;
  chofer: string;
  tipo: "Salida" | "Entrega";
  estado: "Leído" | "Validado" | "En revisión" | "Pendiente";
  bultos: number;
  fuente: "Impreso" | "Manuscrito";
  hora: string;
  confianza: number;
}

export const remitos: Remito[] = [
  { id: "R-0048213", viaje: "VJ-24817", cliente: "Arcor S.A.", chofer: "Carlos Páez", tipo: "Salida", estado: "Validado", bultos: 480, fuente: "Impreso", hora: "08:12", confianza: 98 },
  { id: "R-0048219", viaje: "VJ-24836", cliente: "Frigorífico La Pampa", chofer: "Sergio Ferreyra", tipo: "Entrega", estado: "Validado", bultos: 60, fuente: "Manuscrito", hora: "11:48", confianza: 91 },
  { id: "R-0048224", viaje: "VJ-24826", cliente: "Molinos Río de la Plata", chofer: "Miguel Sosa", tipo: "Salida", estado: "Leído", bultos: 600, fuente: "Impreso", hora: "07:30", confianza: 97 },
  { id: "R-0048231", viaje: "VJ-24831", cliente: "Acindar Grupo", chofer: "Roberto Quiroga", tipo: "Salida", estado: "En revisión", bultos: 22, fuente: "Manuscrito", hora: "09:05", confianza: 74 },
  { id: "R-0048238", viaje: "VJ-24829", cliente: "La Serenísima", chofer: "Pablo Cardozo", tipo: "Entrega", estado: "Validado", bultos: 360, fuente: "Impreso", hora: "10:22", confianza: 99 },
  { id: "R-0048244", viaje: "VJ-24820", cliente: "Cervecería Quilmes", chofer: "Juan Domínguez", tipo: "Salida", estado: "Pendiente", bultos: 560, fuente: "Impreso", hora: "—", confianza: 0 },
  { id: "R-0048251", viaje: "VJ-24842", cliente: "Distribuidora del Sur", chofer: "Marcelo Ojeda", tipo: "Entrega", estado: "Validado", bultos: 240, fuente: "Manuscrito", hora: "10:58", confianza: 88 },
  { id: "R-0048258", viaje: "VJ-24845", cliente: "Andreani Logística", chofer: "Gustavo Leiva", tipo: "Salida", estado: "Validado", bultos: 312, fuente: "Impreso", hora: "09:18", confianza: 97 },
  { id: "R-0048262", viaje: "VJ-24848", cliente: "Mercado Libre Full", chofer: "Martín Aguirre", tipo: "Salida", estado: "Leído", bultos: 780, fuente: "Impreso", hora: "09:42", confianza: 96 },
  { id: "R-0048269", viaje: "VJ-24851", cliente: "Toyota Argentina", chofer: "Fernando Ledesma", tipo: "Salida", estado: "Validado", bultos: 84, fuente: "Manuscrito", hora: "10:16", confianza: 90 },
  { id: "R-0048274", viaje: "VJ-24854", cliente: "Newsan", chofer: "Luis Cabrera", tipo: "Salida", estado: "Validado", bultos: 420, fuente: "Impreso", hora: "06:55", confianza: 99 },
  { id: "R-0048281", viaje: "VJ-24860", cliente: "Sinteplast", chofer: "Raúl Varela", tipo: "Salida", estado: "En revisión", bultos: 190, fuente: "Manuscrito", hora: "08:48", confianza: 79 },
  { id: "R-0048286", viaje: "VJ-24863", cliente: "Mastellone Hnos.", chofer: "Ezequiel Farias", tipo: "Entrega", estado: "Validado", bultos: 220, fuente: "Impreso", hora: "12:02", confianza: 98 },
  { id: "R-0048290", viaje: "VJ-24866", cliente: "Grupo Logístico Patagónico", chofer: "Nicolás Peralta", tipo: "Salida", estado: "Leído", bultos: 330, fuente: "Impreso", hora: "07:12", confianza: 95 },
  { id: "R-0048297", viaje: "VJ-24878", cliente: "Molinos Río de la Plata", chofer: "Miguel Sosa", tipo: "Salida", estado: "Validado", bultos: 540, fuente: "Impreso", hora: "08:04", confianza: 97 },
  { id: "R-0048301", viaje: "VJ-24884", cliente: "Ledesma S.A.A.I.", chofer: "Daniel Acosta", tipo: "Salida", estado: "Validado", bultos: 600, fuente: "Manuscrito", hora: "07:50", confianza: 86 },
];

// ---------- Incidencias ----------
export interface Incidencia {
  id: string;
  viaje: string;
  tipo: "Parada no prevista" | "Desvío de ruta" | "Demora" | "Anomalía";
  criticidad: "Alta" | "Media" | "Baja";
  causa: string;
  estado: "Abierta" | "En gestión" | "Resuelta";
  hora: string;
  chofer: string;
}

export const incidencias: Incidencia[] = [
  { id: "INC-3391", viaje: "VJ-24820", tipo: "Parada no prevista", criticidad: "Alta", causa: "Desperfecto mecánico — revisión en taller ruta", estado: "En gestión", hora: "11:20", chofer: "Juan Domínguez" },
  { id: "INC-3392", viaje: "VJ-24839", tipo: "Demora", criticidad: "Media", causa: "Corte de ruta por manifestación (RN 34)", estado: "Abierta", hora: "10:05", chofer: "Daniel Acosta" },
  { id: "INC-3388", viaje: "VJ-24826", tipo: "Desvío de ruta", criticidad: "Baja", causa: "Reabastecimiento de combustible autorizado", estado: "Resuelta", hora: "09:14", chofer: "Miguel Sosa" },
  { id: "INC-3385", viaje: "VJ-24817", tipo: "Demora", criticidad: "Baja", causa: "Tránsito intenso acceso CABA", estado: "Resuelta", hora: "08:50", chofer: "Carlos Páez" },
  { id: "INC-3394", viaje: "VJ-24823", tipo: "Anomalía", criticidad: "Media", causa: "Variación de temperatura detectada — pendiente confirmación", estado: "Abierta", hora: "11:42", chofer: "Walter Benítez" },
  { id: "INC-3397", viaje: "VJ-24866", tipo: "Parada no prevista", criticidad: "Alta", causa: "Control vial extendido en RN 3 — documentación verificada", estado: "En gestión", hora: "12:08", chofer: "Nicolás Peralta" },
  { id: "INC-3398", viaje: "VJ-24860", tipo: "Desvío de ruta", criticidad: "Media", causa: "Desvío por obra en RN 3, ETA recalculada", estado: "Abierta", hora: "12:22", chofer: "Raúl Varela" },
  { id: "INC-3399", viaje: "VJ-24854", tipo: "Demora", criticidad: "Baja", causa: "Retención en peaje Zárate-Brazo Largo", estado: "Resuelta", hora: "12:36", chofer: "Luis Cabrera" },
  { id: "INC-3401", viaje: "VJ-24848", tipo: "Anomalía", criticidad: "Media", causa: "Sensor de puerta reportó apertura en parada autorizada", estado: "En gestión", hora: "12:51", chofer: "Martín Aguirre" },
  { id: "INC-3402", viaje: "VJ-24884", tipo: "Demora", criticidad: "Media", causa: "Lluvia intensa en tramo Santiago del Estero", estado: "Abierta", hora: "13:05", chofer: "Daniel Acosta" },
];

// ---------- Reclamos ----------
export interface Reclamo {
  id: string;
  cliente: string;
  viaje: string;
  motivo: "Demora en entrega" | "Faltante" | "Avería" | "Documentación" | "Trato";
  criticidad: "Alta" | "Media" | "Baja";
  estado: "Nuevo" | "En proceso" | "Escalado" | "Resuelto";
  canal: "WhatsApp" | "Email" | "Web";
  abierto: string;
  sla: string;
}

export const reclamos: Reclamo[] = [
  { id: "RC-1182", cliente: "Coca-Cola Andina", viaje: "VJ-24834", motivo: "Demora en entrega", criticidad: "Alta", estado: "En proceso", canal: "WhatsApp", abierto: "Hoy 09:32", sla: "En SLA" },
  { id: "RC-1180", cliente: "Arcor S.A.", viaje: "VJ-24817", motivo: "Faltante", criticidad: "Media", estado: "Escalado", canal: "Email", abierto: "Hoy 08:10", sla: "En SLA" },
  { id: "RC-1178", cliente: "La Serenísima", viaje: "VJ-24829", motivo: "Avería", criticidad: "Alta", estado: "Nuevo", canal: "Web", abierto: "Hoy 10:48", sla: "Por vencer" },
  { id: "RC-1175", cliente: "Distribuidora del Sur", viaje: "VJ-24842", motivo: "Documentación", criticidad: "Baja", estado: "Resuelto", canal: "WhatsApp", abierto: "Ayer 17:20", sla: "Cumplido" },
  { id: "RC-1173", cliente: "Cervecería Quilmes", viaje: "VJ-24820", motivo: "Demora en entrega", criticidad: "Media", estado: "En proceso", canal: "WhatsApp", abierto: "Hoy 07:55", sla: "En SLA" },
  { id: "RC-1186", cliente: "Andreani Logística", viaje: "VJ-24845", motivo: "Documentación", criticidad: "Baja", estado: "En proceso", canal: "Email", abierto: "Hoy 11:18", sla: "En SLA" },
  { id: "RC-1187", cliente: "Mercado Libre Full", viaje: "VJ-24848", motivo: "Demora en entrega", criticidad: "Media", estado: "Nuevo", canal: "Web", abierto: "Hoy 11:44", sla: "En SLA" },
  { id: "RC-1189", cliente: "Toyota Argentina", viaje: "VJ-24851", motivo: "Faltante", criticidad: "Alta", estado: "Escalado", canal: "Email", abierto: "Hoy 12:12", sla: "Por vencer" },
  { id: "RC-1191", cliente: "Sinteplast", viaje: "VJ-24860", motivo: "Trato", criticidad: "Baja", estado: "Resuelto", canal: "WhatsApp", abierto: "Ayer 15:05", sla: "Cumplido" },
  { id: "RC-1194", cliente: "Grupo Logístico Patagónico", viaje: "VJ-24866", motivo: "Demora en entrega", criticidad: "Alta", estado: "En proceso", canal: "WhatsApp", abierto: "Hoy 12:40", sla: "En SLA" },
];

// ---------- Rendiciones ----------
export interface Rendicion {
  id: string;
  viaje: string;
  chofer: string;
  combustible: number;
  peajes: number;
  viaticos: number;
  otros: number;
  estado: "Borrador" | "En aprobación" | "Aprobada" | "Liquidada";
  comprobantes: number;
}

export const rendiciones: Rendicion[] = [
  { id: "RD-7741", viaje: "VJ-24817", chofer: "Carlos Páez", combustible: 184500, peajes: 21300, viaticos: 32000, otros: 4800, estado: "En aprobación", comprobantes: 9 },
  { id: "RD-7738", viaje: "VJ-24836", chofer: "Sergio Ferreyra", combustible: 121800, peajes: 14200, viaticos: 24000, otros: 0, estado: "Aprobada", comprobantes: 6 },
  { id: "RD-7735", viaje: "VJ-24829", chofer: "Pablo Cardozo", combustible: 96400, peajes: 9800, viaticos: 18000, otros: 2200, estado: "Liquidada", comprobantes: 5 },
  { id: "RD-7733", viaje: "VJ-24831", chofer: "Roberto Quiroga", combustible: 142000, peajes: 17600, viaticos: 28000, otros: 6100, estado: "Borrador", comprobantes: 7 },
  { id: "RD-7730", viaje: "VJ-24842", chofer: "Marcelo Ojeda", combustible: 28900, peajes: 3200, viaticos: 8000, otros: 0, estado: "Aprobada", comprobantes: 3 },
  { id: "RD-7744", viaje: "VJ-24845", chofer: "Gustavo Leiva", combustible: 76500, peajes: 8400, viaticos: 16000, otros: 0, estado: "Aprobada", comprobantes: 5 },
  { id: "RD-7748", viaje: "VJ-24848", chofer: "Martín Aguirre", combustible: 173200, peajes: 19400, viaticos: 29000, otros: 3500, estado: "En aprobación", comprobantes: 8 },
  { id: "RD-7751", viaje: "VJ-24851", chofer: "Fernando Ledesma", combustible: 168900, peajes: 18200, viaticos: 30000, otros: 0, estado: "Borrador", comprobantes: 6 },
  { id: "RD-7755", viaje: "VJ-24863", chofer: "Ezequiel Farias", combustible: 133400, peajes: 15100, viaticos: 26000, otros: 2400, estado: "Aprobada", comprobantes: 7 },
  { id: "RD-7758", viaje: "VJ-24872", chofer: "Roberto Quiroga", combustible: 89400, peajes: 7300, viaticos: 18000, otros: 0, estado: "Liquidada", comprobantes: 4 },
  { id: "RD-7761", viaje: "VJ-24875", chofer: "Sergio Ferreyra", combustible: 119700, peajes: 12100, viaticos: 22000, otros: 1700, estado: "Liquidada", comprobantes: 6 },
];

// ---------- ETA / Notificaciones ----------
export interface EtaItem {
  viaje: string;
  cliente: string;
  destino: string;
  eta: string;
  ventana: string;
  estado: "En horario" | "Demora leve" | "Demora" | "Adelantado";
  notificado: boolean;
}

export const etas: EtaItem[] = [
  { viaje: "VJ-24836", cliente: "Frigorífico La Pampa", destino: "CABA", eta: "12:25", ventana: "12:00 – 13:00", estado: "En horario", notificado: true },
  { viaje: "VJ-24831", cliente: "Acindar Grupo", destino: "Córdoba", eta: "13:50", ventana: "13:00 – 14:00", estado: "En horario", notificado: true },
  { viaje: "VJ-24817", cliente: "Arcor S.A.", destino: "CABA", eta: "14:35", ventana: "13:30 – 14:30", estado: "Demora leve", notificado: true },
  { viaje: "VJ-24820", cliente: "Cervecería Quilmes", destino: "Mar del Plata", eta: "16:10", ventana: "15:00 – 16:00", estado: "Demora", notificado: false },
  { viaje: "VJ-24826", cliente: "Molinos Río de la Plata", destino: "Tucumán", eta: "21:05", ventana: "20:00 – 22:00", estado: "En horario", notificado: true },
  { viaje: "VJ-24845", cliente: "Andreani Logística", destino: "Rosario", eta: "15:20", ventana: "15:00 – 16:00", estado: "En horario", notificado: true },
  { viaje: "VJ-24848", cliente: "Mercado Libre Full", destino: "Córdoba", eta: "17:05", ventana: "16:30 – 17:30", estado: "Demora leve", notificado: true },
  { viaje: "VJ-24854", cliente: "Newsan", destino: "Posadas", eta: "19:45", ventana: "19:00 – 21:00", estado: "En horario", notificado: true },
  { viaje: "VJ-24860", cliente: "Sinteplast", destino: "Bahía Blanca", eta: "18:05", ventana: "17:30 – 18:30", estado: "En horario", notificado: true },
  { viaje: "VJ-24866", cliente: "Grupo Logístico Patagónico", destino: "Comodoro Rivadavia", eta: "—", ventana: "Mañana 08:00 – 10:00", estado: "Demora", notificado: false },
  { viaje: "VJ-24890", cliente: "Acindar Grupo", destino: "Rosario", eta: "14:05", ventana: "14:00 – 15:00", estado: "Adelantado", notificado: true },
];

// ---------- Conversaciones (WhatsApp) ----------
export interface ChatMessage {
  from: "agent" | "driver" | "client";
  text: string;
  time: string;
  attachment?: "remito" | "ubicacion" | "comprobante";
}

export interface Conversation {
  id: string;
  agentSlug: string;
  contactName: string;
  contactRole: string;
  viaje?: string;
  channel: "WhatsApp" | "Email";
  messages: ChatMessage[];
}

export const conversations: Conversation[] = [
  {
    id: "cv-rem-1",
    agentSlug: "remitos",
    contactName: "Carlos Páez",
    contactRole: "Chofer · VJ-24817",
    viaje: "VJ-24817",
    channel: "WhatsApp",
    messages: [
      { from: "agent", text: "Hola Carlos 👋 Soy el asistente de Empliados. Cuando salgas del recinto, envíame una foto del remito de salida, por favor.", time: "08:05" },
      { from: "driver", text: "Listo, saliendo de Córdoba", time: "08:10" },
      { from: "driver", text: "", time: "08:11", attachment: "remito" },
      { from: "agent", text: "¡Recibido! Leí el remito R-0048213 · 480 bultos · Arcor S.A. ✅ Quedó registrado. Buen viaje 🚛", time: "08:12" },
      { from: "agent", text: "Te aviso al llegar para el remito de entrega.", time: "08:12" },
    ],
  },
  {
    id: "cv-inc-1",
    agentSlug: "incidencias",
    contactName: "Juan Domínguez",
    contactRole: "Chofer · VJ-24820",
    viaje: "VJ-24820",
    channel: "WhatsApp",
    messages: [
      { from: "agent", text: "Hola Juan, detectamos que el camión está detenido hace 18 min cerca de Las Flores. ¿Está todo bien?", time: "11:18" },
      { from: "driver", text: "Se prendió una luz en el tablero, paré para revisar", time: "11:20" },
      { from: "agent", text: "Entiendo. ¿Podés continuar o necesitás asistencia mecánica?", time: "11:20" },
      { from: "driver", text: "Por ahora no arranca bien, mejor manden grúa", time: "11:22" },
      { from: "agent", text: "Registrado como INC-3391 · criticidad Alta. Aviso al coordinador y gestiono asistencia. Te confirmo en minutos.", time: "11:23" },
    ],
  },
  {
    id: "cv-dest-1",
    agentSlug: "destinos",
    contactName: "Logística Coca-Cola Andina",
    contactRole: "Cliente · Pedido PD-9921",
    channel: "WhatsApp",
    messages: [
      { from: "agent", text: "Hola, para coordinar la entrega de hoy necesito confirmar la dirección exacta. Tengo: Av. Mitre 2450, Avellaneda. ¿Es correcta?", time: "09:40" },
      { from: "client", text: "Es Mitre 2540, no 2450", time: "09:43" },
      { from: "agent", text: "Corregido ✅ Validé la ubicación en el mapa. ¿El acceso para descarga es por el portón lateral?", time: "09:44" },
      { from: "client", text: "Sí, portón lateral. Preguntar por Depósito 3", time: "09:45" },
      { from: "agent", text: "Perfecto. Envío el punto exacto y la referencia al chofer. Gracias 🙌", time: "09:45", attachment: "ubicacion" },
    ],
  },
  {
    id: "cv-rec-1",
    agentSlug: "reclamos",
    contactName: "Mariana — Coca-Cola Andina",
    contactRole: "Cliente · Reclamo RC-1182",
    viaje: "VJ-24834",
    channel: "WhatsApp",
    messages: [
      { from: "client", text: "Buen día, el pedido de Mendoza todavía no llegó y nos urge", time: "09:30" },
      { from: "agent", text: "Hola Mariana, lamento la demora. Identifiqué el viaje VJ-24834. Está en preparación de salida desde Mendoza, ETA estimada para mañana 10:30.", time: "09:32" },
      { from: "agent", text: "Lo registré como reclamo RC-1182 y activé seguimiento prioritario. Te voy a ir informando el avance.", time: "09:32" },
      { from: "client", text: "Gracias, necesito que se cumpla", time: "09:33" },
      { from: "agent", text: "Quedó escalado al coordinador de zona Cuyo. Te confirmo la salida en cuanto el chofer cargue. 🙏", time: "09:34" },
    ],
  },
  {
    id: "cv-eta-1",
    agentSlug: "eta",
    contactName: "Recepción — Frigorífico La Pampa",
    contactRole: "Destinatario · VJ-24836",
    viaje: "VJ-24836",
    channel: "WhatsApp",
    messages: [
      { from: "agent", text: "Hola 👋 Su envío VJ-24836 (carne refrigerada, 60 bultos) está a 38 km. ETA estimada: 12:25, dentro de la ventana 12:00–13:00.", time: "11:46" },
      { from: "client", text: "Perfecto, dejamos el muelle 2 libre", time: "11:47" },
      { from: "agent", text: "Excelente. Les aviso cuando esté a 10 minutos para que preparen la descarga. 🚛❄️", time: "11:48" },
    ],
  },
  {
    id: "cv-via-1",
    agentSlug: "viajes",
    contactName: "Compras — Acindar Grupo",
    contactRole: "Solicitud de transporte",
    channel: "Email",
    messages: [
      { from: "client", text: "Necesitamos transporte para 31 t de acero desde San Nicolás a Córdoba, retiro mañana 7:00.", time: "Ayer 16:20" },
      { from: "agent", text: "Recibido. Validé la solicitud: 31 t · San Nicolás → Córdoba · retiro 7:00. Consulté disponibilidad: tenemos unidad apta (semi con baranda).", time: "Ayer 16:24" },
      { from: "agent", text: "Viaje confirmado y registrado en TMS como VJ-24831. Chofer asignado: Roberto Quiroga (AE 730 LM). Les comparto seguimiento al iniciar.", time: "Ayer 16:31" },
      { from: "client", text: "Perfecto, gracias por la rapidez", time: "Ayer 16:40" },
    ],
  },
  {
    id: "cv-ren-1",
    agentSlug: "rendicion",
    contactName: "Carlos Páez",
    contactRole: "Chofer · VJ-24817",
    viaje: "VJ-24817",
    channel: "WhatsApp",
    messages: [
      { from: "agent", text: "Carlos, para la rendición del viaje VJ-24817 mandame las fotos de los comprobantes (combustible, peajes, viáticos).", time: "10:02" },
      { from: "driver", text: "", time: "10:08", attachment: "comprobante" },
      { from: "driver", text: "Ese es el de YPF, cargué 320 litros", time: "10:08" },
      { from: "agent", text: "Leído ✅ Combustible $184.500. Sumé también 3 peajes ($21.300). ¿Tenés viáticos para cargar?", time: "10:09" },
      { from: "driver", text: "Sí, almuerzo, ahí va", time: "10:11", attachment: "comprobante" },
      { from: "agent", text: "Listo. Rendición RD-7741 armada: total $242.600 con 9 comprobantes. Queda en aprobación del backoffice.", time: "10:12" },
    ],
  },
];

export function conversationsFor(slug: string): Conversation[] {
  return conversations.filter((c) => c.agentSlug === slug);
}

// ---------- Feed de actividad (Torre de Control) ----------
export interface ActivityEvent {
  id: number;
  agent: string;
  agentSlug: string;
  text: string;
  time: string;
  level: "info" | "ok" | "warn" | "alert";
}

export const baseActivity: ActivityEvent[] = [
  { id: 1, agent: "Remitos", agentSlug: "remitos", text: "Remito R-0048213 validado · Arcor S.A. (VJ-24817)", time: "08:12", level: "ok" },
  { id: 2, agent: "Gestión de Viajes", agentSlug: "viajes", text: "Viaje VJ-24831 confirmado y asignado a R. Quiroga", time: "08:31", level: "ok" },
  { id: 3, agent: "Incidencias", agentSlug: "incidencias", text: "INC-3391 abierta · parada no prevista (VJ-24820)", time: "11:20", level: "alert" },
  { id: 4, agent: "ETA", agentSlug: "eta", text: "Notificación de llegada enviada · VJ-24836", time: "11:46", level: "info" },
  { id: 5, agent: "Destinos", agentSlug: "destinos", text: "Dirección corregida y validada · Coca-Cola Andina", time: "09:44", level: "ok" },
  { id: 6, agent: "Reclamos", agentSlug: "reclamos", text: "RC-1182 escalado a coordinador zona Cuyo", time: "09:34", level: "warn" },
  { id: 7, agent: "Rendición", agentSlug: "rendicion", text: "Rendición RD-7741 armada · $242.600 (9 comprob.)", time: "10:12", level: "info" },
  { id: 8, agent: "Analítica", agentSlug: "analitica", text: "Alerta: SLA zona NOA por debajo del objetivo (-3,1%)", time: "10:55", level: "warn" },
  { id: 9, agent: "Remitos", agentSlug: "remitos", text: "Remito R-0048274 validado · Newsan (VJ-24854)", time: "10:58", level: "ok" },
  { id: 10, agent: "ETA", agentSlug: "eta", text: "ETA recalculada por obra en RN 3 · Sinteplast (VJ-24860)", time: "12:22", level: "warn" },
  { id: 11, agent: "Gestión de Viajes", agentSlug: "viajes", text: "Solicitud Mercado Libre Full convertida en viaje VJ-24848", time: "11:06", level: "ok" },
  { id: 12, agent: "Incidencias", agentSlug: "incidencias", text: "INC-3397 en gestión · control vial extendido (RN 3)", time: "12:08", level: "alert" },
  { id: 13, agent: "Destinos", agentSlug: "destinos", text: "Punto de descarga confirmado · Parque Industrial Pilar", time: "12:14", level: "ok" },
  { id: 14, agent: "Rendición", agentSlug: "rendicion", text: "Rendición RD-7755 aprobada · Mastellone Hnos.", time: "12:31", level: "ok" },
];

// Posibles eventos para la simulación "en vivo"
export const liveTemplates: Omit<ActivityEvent, "id" | "time">[] = [
  { agent: "Remitos", agentSlug: "remitos", text: "Nuevo remito recibido por WhatsApp · lectura en curso", level: "info" },
  { agent: "Remitos", agentSlug: "remitos", text: "Remito validado automáticamente (confianza 97%)", level: "ok" },
  { agent: "ETA", agentSlug: "eta", text: "ETA recalculada · cliente notificado proactivamente", level: "info" },
  { agent: "Incidencias", agentSlug: "incidencias", text: "Chofer informó causa del evento · clasificado", level: "ok" },
  { agent: "Gestión de Viajes", agentSlug: "viajes", text: "Solicitud por email interpretada y validada", level: "ok" },
  { agent: "Destinos", agentSlug: "destinos", text: "Destino validado en Google Maps · link enviado al chofer", level: "ok" },
  { agent: "Reclamos", agentSlug: "reclamos", text: "Reclamo recibido · viaje identificado automáticamente", level: "warn" },
  { agent: "Rendición", agentSlug: "rendicion", text: "Comprobante leído y clasificado · combustible", level: "info" },
  { agent: "Analítica", agentSlug: "analitica", text: "Patrón detectado · pico de demoras acceso CABA 13–15h", level: "warn" },
  { agent: "Gestión de Viajes", agentSlug: "viajes", text: "Unidad asignada según disponibilidad de flota", level: "ok" },
  { agent: "ETA", agentSlug: "eta", text: "Cliente avisado por ventana horaria actualizada", level: "info" },
  { agent: "Remitos", agentSlug: "remitos", text: "Diferencia de bultos detectada · enviado a revisión", level: "warn" },
  { agent: "Incidencias", agentSlug: "incidencias", text: "Evento resuelto · causa trazada en backoffice", level: "ok" },
  { agent: "Analítica", agentSlug: "analitica", text: "Dashboard operativo actualizado en BigQuery", level: "info" },
];

// ---------- Series para gráficos ----------
export const viajesPorDia = [
  { dia: "Lun", viajes: 82, entregados: 76 },
  { dia: "Mar", viajes: 91, entregados: 86 },
  { dia: "Mié", viajes: 88, entregados: 83 },
  { dia: "Jue", viajes: 103, entregados: 96 },
  { dia: "Vie", viajes: 97, entregados: 92 },
  { dia: "Sáb", viajes: 64, entregados: 60 },
  { dia: "Dom", viajes: 39, entregados: 38 },
];

export const slaPorZona = [
  { zona: "AMBA", sla: 97 },
  { zona: "Centro", sla: 95 },
  { zona: "Litoral", sla: 93 },
  { zona: "Cuyo", sla: 91 },
  { zona: "NOA", sla: 88 },
  { zona: "Patagonia", sla: 92 },
];

export const incidenciasPorTipo = [
  { tipo: "Demoras", valor: 68, color: "#f59e0b" },
  { tipo: "Paradas", valor: 31, color: "#ef4444" },
  { tipo: "Desvíos", valor: 27, color: "#38bdf8" },
  { tipo: "Anomalías", valor: 14, color: "#a78bfa" },
];

export const etaTrend = [
  { h: "06h", precision: 88 },
  { h: "08h", precision: 90 },
  { h: "10h", precision: 92 },
  { h: "12h", precision: 91 },
  { h: "14h", precision: 93 },
  { h: "16h", precision: 90 },
  { h: "18h", precision: 92 },
];
