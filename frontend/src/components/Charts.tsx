"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  LineChart,
} from "recharts";

const tooltipStyle = {
  background: "#1a1436",
  border: "1px solid #2a2147",
  borderRadius: 12,
  fontSize: 12,
  color: "#ECEAF6",
};

export function ViajesArea({
  data,
}: {
  data: { dia: string; viajes: number; entregados: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gViajes" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gEnt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d946ef" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#d946ef" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="dia" stroke="#6f6796" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="#6f6796" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "#2a2147" }} />
        <Area type="monotone" dataKey="viajes" stroke="#a78bfa" strokeWidth={2} fill="url(#gViajes)" name="Viajes" />
        <Area type="monotone" dataKey="entregados" stroke="#e879f9" strokeWidth={2} fill="url(#gEnt)" name="Entregados" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SlaBars({ data }: { data: { zona: string; sla: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <XAxis dataKey="zona" stroke="#6f6796" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis domain={[80, 100]} stroke="#6f6796" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff08" }} />
        <Bar dataKey="sla" radius={[6, 6, 0, 0]} name="SLA %">
          {data.map((d, i) => (
            <Cell key={i} fill={d.sla >= 92 ? "#8b5cf6" : d.sla >= 89 ? "#f59e0b" : "#ef4444"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function IncidenciasDonut({
  data,
}: {
  data: { tipo: string; valor: number; color: string }[];
}) {
  const total = data.reduce((s, d) => s + d.valor, 0);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="valor"
            nameKey="tipo"
            innerRadius={62}
            outerRadius={88}
            paddingAngle={3}
            stroke="none"
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular font-[var(--font-display)] text-2xl font-bold text-white">
          {total}
        </span>
        <span className="text-xs text-[var(--text-faint)]">eventos</span>
      </div>
    </div>
  );
}

export function EtaLine({ data }: { data: { h: string; precision: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <XAxis dataKey="h" stroke="#6f6796" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis domain={[80, 100]} stroke="#6f6796" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "#2a2147" }} />
        <Line type="monotone" dataKey="precision" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3, fill: "#38bdf8" }} name="Precisión %" />
      </LineChart>
    </ResponsiveContainer>
  );
}
