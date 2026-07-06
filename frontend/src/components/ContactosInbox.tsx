"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { MessageCircle, RefreshCw, Search } from "lucide-react";
import {
  getConversacion,
  getRemito,
  listChoferes,
  listConversaciones,
  imagenUrl,
} from "@/lib/api";
import type { Conversacion, ConversacionListItem } from "@/lib/conversaciones-types";
import type { RemitoRow } from "@/lib/types";
import type { Chofer } from "@/lib/parametros-types";
import { tenantLabel } from "@/lib/remitos-ui";
import { tenantColor } from "@/lib/tenants";
import { Card, PageHeader, Pill, SectionTitle } from "./ui";
import { ContactoChatThread } from "./ContactoChatThread";
import { ContactoMessageComposer } from "./ContactoMessageComposer";

function formatPhone(p: string) {
  if (p.length > 10) return `+${p.slice(0, 2)} ${p.slice(2)}`;
  return p;
}

export function ContactosInbox() {
  const [lista, setLista] = useState<ConversacionListItem[]>([]);
  const [choferes, setChoferes] = useState<Chofer[]>([]);
  const [selectedTel, setSelectedTel] = useState<string | null>(null);
  const [conv, setConv] = useState<Conversacion | null>(null);
  const [remito, setRemito] = useState<RemitoRow | null>(null);
  const [filtroTenant, setFiltroTenant] = useState<string>("");
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatScrollKey, setChatScrollKey] = useState(0);

  const loadLista = useCallback(async () => {
    try {
      const [data, ch] = await Promise.all([
        listConversaciones({
          tenant: filtroTenant || undefined,
          limit: 200,
        }),
        listChoferes(filtroTenant || undefined).catch(() => [] as Chofer[]),
      ]);
      setLista(data);
      setChoferes(ch);
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

  useEffect(() => {
    if (!selectedTel || !conv?.bot_pausado) return;
    const id = setInterval(() => {
      loadConv(selectedTel);
      loadLista();
    }, 30_000);
    return () => clearInterval(id);
  }, [selectedTel, conv?.bot_pausado, loadConv, loadLista]);

  const selected = lista.find((c) => c.telefono === selectedTel);

  const choferPorTel = useMemo(() => {
    const map = new Map<string, Chofer>();
    for (const c of choferes) {
      const tel = c.telefono?.replace(/\D/g, "") ?? "";
      if (tel) map.set(tel, c);
    }
    return map;
  }, [choferes]);

  const listaFiltrada = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return lista;
    const qDigits = q.replace(/\D/g, "");
    return lista.filter((c) => {
      const tel = c.telefono.replace(/\D/g, "");
      const ch = choferPorTel.get(tel);
      const nombre = (c.nombre || ch?.nombre || "").toLowerCase();
      if (nombre.includes(q)) return true;
      if (qDigits.length >= 4 && tel.includes(qDigits)) return true;
      return false;
    });
  }, [lista, busqueda, choferPorTel]);

  function elegirContacto(tel: string) {
    setSelectedTel(tel);
    setChatScrollKey((k) => k + 1);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Contactos"
        subtitle="WhatsApp con choferes — respondé desde acá (como support-desk, mejorado)"
        icon={<MessageCircle size={24} />}
      />

      <div className="flex flex-wrap gap-2">
        {["", "tsb", "beraldi", "corina"].map((t) => (
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
          <div className="border-b border-[var(--border-soft)] p-2">
            <label className="relative block">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
              />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar chofer o teléfono…"
                className="w-full rounded-lg border border-[var(--border)] bg-white/5 py-1.5 pl-8 pr-2 text-sm text-white outline-none placeholder:text-[var(--text-faint)] focus:ring-1 focus:ring-[var(--violet)]"
              />
            </label>
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin">
            {loading && <p className="p-4 text-sm text-[var(--text-dim)]">Cargando…</p>}
            {!loading && listaFiltrada.length === 0 && (
              <div className="p-4 text-center">
                <p className="text-sm font-medium text-white">
                  {lista.length === 0 ? "Sin conversaciones todavía" : "Sin resultados"}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-[var(--text-dim)]">
                  {lista.length === 0
                    ? 'Aparecen acá cuando un chofer escribe al bot de WhatsApp. Podés probar mandando "Hola" al número de Andreu Remitos.'
                    : "Probá otro nombre o teléfono."}
                </p>
              </div>
            )}
            {listaFiltrada.map((c) => {
              const tel = c.telefono.replace(/\D/g, "");
              const ch = choferPorTel.get(tel);
              const nombre = c.nombre || ch?.nombre || "Chofer";
              return (
              <button
                key={c.telefono}
                type="button"
                onClick={() => elegirContacto(c.telefono)}
                className={clsx(
                  "w-full border-b border-[var(--border-soft)] px-3 py-3 text-left transition hover:bg-white/5",
                  selectedTel === c.telefono && "bg-[var(--violet)]/10",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium text-white">
                    {nombre}
                  </p>
                  {c.tenant && (
                    <Pill color={tenantColor(c.tenant ?? "")}>
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
                  <span className="mt-1 inline-block text-[10px] text-amber-400">Bot pausado · auto 5 min</span>
                )}
              </button>
            );
            })}
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
              <ContactoChatThread mensajes={conv.mensajes} scrollKey={chatScrollKey} />
              <ContactoMessageComposer
                telefono={conv.telefono}
                botPausado={!!conv.bot_pausado}
                onSent={() => loadConv(conv.telefono)}
                onBotToggle={() => loadConv(conv.telefono)}
              />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <MessageCircle size={40} className="text-[var(--text-faint)]" />
              <p className="text-sm font-medium text-white">
                {lista.length === 0 ? "Inbox WhatsApp listo" : "Elegí un contacto"}
              </p>
              <p className="max-w-xs text-xs text-[var(--text-dim)]">
                {lista.length === 0
                  ? "Cuando haya mensajes de choferes, el chat se muestra acá."
                  : "Seleccioná un chofer de la lista para ver el historial."}
              </p>
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
