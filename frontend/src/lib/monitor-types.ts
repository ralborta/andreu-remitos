export type MonitorServiceProbe = {
  id: string;
  ok: boolean;
  latency_ms?: number;
  status?: number;
  error?: string;
  service?: string;
  whatsapp?: string;
  phone?: string | null;
  detail?: string;
  path?: string;
  qr_available?: boolean;
  qr_updated_at?: string | null;
  auto_reconnect?: boolean;
};

export type MonitorWhatsappQr = {
  ok: boolean;
  connected: boolean;
  phone?: string | null;
  qr_available?: boolean;
  image_base64?: string;
  qr_updated_at?: string | null;
  auto_reconnect?: boolean;
  message?: string;
  error?: string;
};

export type MonitorStatus = {
  ok: boolean;
  checked_at: string;
  services: {
    api: MonitorServiceProbe;
    bot: MonitorServiceProbe;
    whatsapp: MonitorServiceProbe;
    webhook: MonitorServiceProbe;
  };
  hints?: string[];
};
