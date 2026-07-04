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
