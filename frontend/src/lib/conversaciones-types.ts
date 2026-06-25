export type MensajeActor = "customer" | "bot" | "human";

export interface ConversacionMensaje {
  id: string;
  dir: "in" | "out";
  from?: MensajeActor;
  texto: string | null;
  tipo: "text" | "image" | "audio" | "note";
  remito_id?: string | null;
  imagen_url?: string | null;
  transcripcion?: string | null;
  at: string;
}

export interface ConversacionListItem {
  id: string;
  telefono: string;
  tenant: string | null;
  nombre: string | null;
  ultimo_remito_id: string | null;
  bot_pausado?: boolean;
  created_at: string;
  updated_at: string;
  ultimo_mensaje: ConversacionMensaje | null;
  total_mensajes: number;
}

export interface Conversacion extends Omit<ConversacionListItem, "ultimo_mensaje" | "total_mensajes"> {
  mensajes: ConversacionMensaje[];
}
