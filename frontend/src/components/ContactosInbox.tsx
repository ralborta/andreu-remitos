"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { MessageCircle, RefreshCw } from "lucide-react";
import {
  getConversacion,
  getRemito,
  listConversaciones,
  imagenUrl,
} from "@/lib/api";
import type { Conversacion, ConversacionListItem } from "@/lib/conversaciones-types";
import type { RemitoRow } from "@/lib/types";
import { tenantLabel } from "@/lib/remitos-ui";
import { Card, PageHeader, Pill, SectionTitle } from "./ui";
import { ContactoChatThread } from "./ContactoChatThread";
import { ContactoMessageComposer } from "./ContactoMessageComposer";

function formatPhone(p: string) {
  if (p.length > 10) return `+${p.slice(0, 2)} ${p.slice(2)}`;
  return p;
}

export function ContactosInbox() {
  const [lista, setLista] = useState<ConversacionListItem[]>([]);
  const [selectedTel, setSelectedTel] = useState<string | null>(null);
  const [conv, setConv] = useState<Conversacion | null>(null);
  const [remito, setRemito] = useState<RemitoRow | null>(null);
  const [filtroTenant, setFiltroTenant] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLista = useCallback(async () => {
    try {
      const data = await listConversaciones({
        tenant: filtroTenant || undefined,
        limit: 100,
      });
      setLista(data);
      if (data.length > 0 && !selectedTel) setSelectedTel(data[0].telefono);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [filtroTenant, selectedTel]);

  const loadConv = useCallback(async (tel: string) => {
    try {
      const c = await getConversacion(tel);
      setConv(c);
      if (c.ultimo_remito_id) {
        const r = await getRemito(c.ultimo_remito_id).catch(() => null);
        setRemito(r);
      } else {
        setRemito(null);
      }
    } catch {
      setConv(null);
      setRemito(null);
    }
  }, []);

  useEffect(() => {
    loadLista();
  }, [loadLista]);

  useEffect(() => {
    if (selectedTel) loadConv(selectedTel);
  }, [selectedTel, loadConv]);

  const selected = lista.find((c) => c.telefono === selectedTel);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Contactos"
        subtitle="WhatsApp con choferes — respondé desde acá (como support-desk, mejorado)"
        icon={<MessageCircle size={24} />}
      />

      <div className="flex flex-wrap gap-2">
        {["", "tsb", "beraldi"].map((t) => (
          <button
            key={t || "all"}
            type="button"
            onClick={() => setFiltroTenant(t)}
            className={clsx(
              "rounded-full px-3 py-1 text-xs font-medium transition",
              filtroTenant === t
                ? "bg-[var(--violet)] text-white"
                : "bg-white/5 text-[var(--text-dim)] hover:text-white",
            )}
          >
            {t ? tenantLabel(t) : "Todos"}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            loadLista().then(() => {
              if (selectedTel) return loadConv(selectedTel);
            });
          }}
          className="ml-auto flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-xs text-[var(--text-dim)] hover:text-white"
        >
          <RefreshCw size={12} /> Actualizar
        </button>
      </div>

      {error && <p className="text-sm text-[var(--red)]">{error}</p>}

      <div className="grid min-h-[560px] grid-cols-1 gap-4 lg:grid-cols-[minmax(240px,28%)_minmax(0,1fr)_minmax(260px,30%)]">
        {/* Lista contactos */}
        <Card className="flex max-h-[calc(100vh-12rem)] flex-col overflow-hidden p-0">
          <div className="border-b border-[var(--border)] px-3 py-2 text-xs font-semibold uppercase text-[var(--text-faint)]">
            Choferes
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin">
            {loading && <p className="p-4 text-sm text-[var(--text-dim)]">Cargando…</p>}
            {!loading && lista.length === 0 && (
              <p className="p-4 text-sm text-[var(--text-dim)]">
                Sin conversaciones. Llegan cuando un chofer escribe al bot.
              </p>
            )}
            {lista.map((c) => (
              <button
                key={c.telefono}
                type="button"
                onClick={() => setSelectedTel(c.telefono)}
                className={clsx(
                  "w-full border-b border-[var(--border-soft)] px-3 py-3 text-left transition hover:bg-white/5",
                  selectedTel === c.telefono && "bg-[var(--violet)]/10",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium text-white">
                    {c.nombre || "Chofer"}
                  </p>
                  {c.tenant && (
                    <Pill color={c.tenant === "tsb" ? "#38bdf8" : "#a78bfa"}>
                      {tenantLabel(c.tenant)}
                    </Pill>
                  )}
                </div>
                <p className="text-xs text-[#25d366]">{formatPhone(c.telefono)}</p>
                {c.ultimo_mensaje?.texto && (
                  <p className="mt-1 truncate text-xs text-[var(--text-faint)]">
                    {c.ultimo_mensaje.texto}
                  </p>
                )}
                {c.bot_pausado && (
                  <span className="mt-1 inline-block text-[10px] text-amber-400">Bot pausado</span>
                )}
              </button>
            ))}
          </div>
        </Card>

        {/* Chat */}
        <Card className="flex max-h-[calc(100vh-12rem)] flex-col overflow-hidden p-0">
          {selectedTel && conv ? (
            <>
              <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[#202c33] px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--violet)] to-[var(--magenta)] text-sm font-bold text-white">
                  {(conv.nombre || "CH").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{conv.nombre || "Chofer"}</p>
                  <p className="text-xs text-[#8696a0]">{formatPhone(conv.telefono)}</p>
                </div>
                <span className="rounded-full bg-[#25d366]/15 px-2 py-0.5 text-[10px] font-semibold text-[#25d366]">
                  WhatsApp
                </span>
              </div>
              <ContactoChatThread mensajes={conv.mensajes} />
              <ContactoMessageComposer
                telefono={conv.telefono}
                botPausado={!!conv.bot_pausado}
                onSent={() => loadConv(conv.telefono)}
                onBotToggle={() => loadConv(conv.telefono)}
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-[var(--text-dim)]">
              {selected ? "Cargando chat…" : "Elegí un contacto"}
            </div>
          )}
        </Card>

        {/* Contexto remito */}
        <Card className="max-h-[calc(100vh-12rem)] overflow-y-auto">
          <SectionTitle>Último remito</SectionTitle>
          {!remito && (
            <p className="text-sm text-[var(--text-dim)]">
              Sin remito vinculado a esta conversación.
            </p>
          )}
          {remito && (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-black/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagenUrl(remito.id)} alt="" className="w-full object-contain" />
              </div>
              <p className="text-sm text-white">
                {tenantLabel(remito.tenant)} · {remito.estado.replace(/_/g, " ")}
              </p>
              <Link
                href={`/remitos/${remito.tenant}/${remito.id}`}
                className="block rounded-xl bg-[var(--violet)] py-2 text-center text-sm font-semibold text-white hover:bg-[var(--violet)]/90"
              >
                Abrir remito
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
