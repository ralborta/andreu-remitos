"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TrackingButton,
  TrackingCard,
  TrackingField,
  TrackingShell,
  TrackingStatusPill,
} from "./TrackingShell";
import {
  fetchPublicTrip,
  postArrive,
  postConsent,
  postHeartbeat,
  postIncident,
  postPod,
  postPop,
  postPositionsBatch,
  postStart,
  postStop,
  uploadPhoto,
} from "@/lib/tracking/api";
import { compressImageFile } from "@/lib/tracking/compress-image";
import {
  googleMapsNavigateUrl,
  requestSinglePosition,
  requestWakeLock,
  TrackingGeolocationEngine,
  wazeNavigateUrl,
  type GeoReading,
} from "@/lib/tracking/geolocation";
import {
  countPending,
  enqueuePosition,
  listPending,
  removePositions,
  trimOldPositions,
} from "@/lib/tracking/offline-queue";
import { clearPersistedStep, loadPersistedStep, persistStep } from "@/lib/tracking/session-storage";
import {
  INCIDENT_TYPES,
  LINK_STATUS_LABEL,
  POD_OUTCOMES,
  type PublicTripPayload,
  type TrackingStep,
} from "@/lib/tracking/types";

function statusTone(status: string): "green" | "amber" | "red" | "gray" | "blue" {
  if (["ACTIVE"].includes(status)) return "green";
  if (["LOW_ACCURACY", "STALE", "BACKGROUND_SUSPECTED", "OFFLINE"].includes(status)) return "amber";
  if (["PERMISSION_DENIED"].includes(status)) return "red";
  if (["ARRIVED", "COMPLETED"].includes(status)) return "blue";
  return "gray";
}

function formatAge(seconds: number | null) {
  if (seconds == null) return "sin datos";
  if (seconds < 60) return `hace ${seconds} s`;
  return `hace ${Math.floor(seconds / 60)} min`;
}

export function TrackingDriverApp({ token }: { token: string }) {
  const [step, setStep] = useState<TrackingStep>("loading");
  const [linkStatus, setLinkStatus] = useState<string>("valid");
  const [trip, setTrip] = useState<PublicTripPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [confirmDriver, setConfirmDriver] = useState<boolean | null>(null);
  const [confirmVehicle, setConfirmVehicle] = useState<boolean | null>(null);

  const [gpsReading, setGpsReading] = useState<GeoReading | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [trackingStatus, setTrackingStatus] = useState("NOT_STARTED");
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [lastAccuracy, setLastAccuracy] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [online, setOnline] = useState(true);

  const [incidentType, setIncidentType] = useState("");
  const [incidentText, setIncidentText] = useState("");
  const [incidentPhoto, setIncidentPhoto] = useState<File | null>(null);

  const [podOutcome, setPodOutcome] = useState("complete");
  const [receiverName, setReceiverName] = useState("");
  const [receiverDoc, setReceiverDoc] = useState("");
  const [podNotes, setPodNotes] = useState("");
  const [podPhoto, setPodPhoto] = useState<File | null>(null);

  const [popPallets, setPopPallets] = useState("");
  const [popCajas, setPopCajas] = useState("");
  const [popPhoto, setPopPhoto] = useState<File | null>(null);
  const [popSubmitted, setPopSubmitted] = useState(false);

  const engineRef = useRef<TrackingGeolocationEngine | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flushRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sessionId = trip?.session?.id ?? "";

  const popBlocking = Boolean(
    trip?.evidence?.requirePop &&
      !popSubmitted &&
      !["received", "observed", "approved"].includes(trip?.evidence?.popStatus || ""),
  );

  const goStep = useCallback(
    (s: TrackingStep) => {
      setStep(s);
      persistStep(token, s);
    },
    [token],
  );

  const refreshPending = useCallback(async (sid: string) => {
    if (!sid) return;
    setPendingCount(await countPending(sid));
  }, []);

  const flushOffline = useCallback(
    async (sid: string) => {
      if (!sid || !navigator.onLine) return;
      const rows = await listPending(sid);
      if (!rows.length) return;
      try {
        const res = await postPositionsBatch(
          token,
          rows.map(({ sessionId: s, sequence, latitude, longitude, accuracyMeters, altitudeMeters, speedMps, headingDegrees, recordedAt }) => ({
            sessionId: s,
            sequence,
            latitude,
            longitude,
            accuracyMeters,
            altitudeMeters,
            speedMps,
            headingDegrees,
            recordedAt,
          })),
        );
        if (res.accepted > 0 || res.duplicates > 0) {
          await removePositions(
            sid,
            rows.map((r) => r.sequence),
          );
        }
        setTrackingStatus(res.status);
      } catch {
        /* reintento después */
      }
      await refreshPending(sid);
    },
    [token, refreshPending],
  );

  const sendPosition = useCallback(
    async (position: Parameters<typeof postPositionsBatch>[1][number]) => {
      setLastSentAt(position.recordedAt);
      setLastAccuracy(position.accuracyMeters);
      if (!navigator.onLine) {
        await enqueuePosition(token, position);
        await trimOldPositions(position.sessionId);
        await refreshPending(position.sessionId);
        return;
      }
      try {
        const res = await postPositionsBatch(token, [position]);
        setTrackingStatus(res.status);
      } catch {
        await enqueuePosition(token, position);
        await refreshPending(position.sessionId);
      }
    },
    [token, refreshPending],
  );

  const loadTrip = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchPublicTrip(token);
      setLinkStatus(data.linkStatus);
      if (data.linkStatus !== "valid" || !data.trip) {
        goStep("invalid");
        return;
      }
      setTrip(data.trip);
      const persisted = loadPersistedStep(token);
      const sessStatus = data.trip.session?.status || "NOT_STARTED";
      if (sessStatus === "COMPLETED") {
        goStep("done");
      } else if (sessStatus === "ACTIVE" || sessStatus === "ARRIVED") {
        goStep(persisted === "pod" || persisted === "arrival" ? persisted : "active");
      } else if (sessStatus === "AWAITING_PERMISSION") {
        // Nunca restaurar "active"/POD si el servidor aún no recibió /start.
        const allowed = new Set(["detail", "consent", "gps", "ready"]);
        goStep(persisted && allowed.has(persisted) ? persisted : "gps");
      } else if (persisted && ["detail", "consent", "gps", "ready"].includes(persisted)) {
        goStep(persisted);
      } else {
        goStep("detail");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
      goStep("invalid");
    }
  }, [token, goStep]);

  useEffect(() => {
    void loadTrip();
  }, [loadTrip]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (step !== "active" || !sessionId) return;

    const engine = new TrackingGeolocationEngine((pos) => {
      void sendPosition(pos);
    });
    engineRef.current = engine;
    const startSeq = trip?.tracking?.lastPosition ? 0 : 0;
    engine.start(sessionId, startSeq);

    void requestWakeLock().then((lock) => {
      wakeLockRef.current = lock;
    });

    heartbeatRef.current = setInterval(() => {
      const hidden = document.visibilityState === "hidden";
      void postHeartbeat(token, hidden ? "hidden" : "visible").catch(() => {});
    }, 30_000);

    flushRef.current = setInterval(() => {
      void flushOffline(sessionId);
    }, 15_000);

    const onVis = () => {
      void postHeartbeat(token, document.visibilityState === "hidden" ? "hidden" : "visible");
    };
    document.addEventListener("visibilitychange", onVis);

    void refreshPending(sessionId);
    void flushOffline(sessionId);

    return () => {
      engine.stop();
      engineRef.current = null;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (flushRef.current) clearInterval(flushRef.current);
      document.removeEventListener("visibilitychange", onVis);
      void wakeLockRef.current?.release?.();
      wakeLockRef.current = null;
    };
  }, [step, sessionId, token, sendPosition, flushOffline, refreshPending, trip?.tracking?.lastPosition]);

  useEffect(() => {
    if (online && sessionId) void flushOffline(sessionId);
  }, [online, sessionId, flushOffline]);

  const destino = trip?.viaje.destino ?? "";
  // Solo dirección de destino: no usar la última posición del chofer como destino de navegación.
  const mapsUrl = useMemo(() => googleMapsNavigateUrl(destino), [destino]);
  const wazeUrl = useMemo(() => wazeNavigateUrl(destino), [destino]);

  async function handleConsent() {
    setBusy(true);
    setError(null);
    try {
      const res = await postConsent(token, trip?.consentVersion || "1.0");
      setTrip((t) =>
        t ? { ...t, session: { ...t.session!, id: res.sessionId, status: "AWAITING_PERMISSION", startedAt: null, source: "BROWSER_GEOLOCATION" } } : t,
      );
      goStep("gps");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function handleGpsCheck() {
    setBusy(true);
    setGpsError(null);
    try {
      const reading = await requestSinglePosition();
      setGpsReading(reading);
      goStep("ready");
    } catch (e) {
      setGpsError(e instanceof Error ? e.message : "No se pudo obtener ubicación");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitPop() {
    setBusy(true);
    setError(null);
    try {
      let imageUrl: string | undefined;
      if (popPhoto) {
        const blob = await compressImageFile(popPhoto);
        const up = await uploadPhoto(token, blob, "pop.jpg");
        imageUrl = up.url;
      }
      const quantities: { pallets?: number; cajas?: number } = {};
      if (popPallets) quantities.pallets = Number(popPallets);
      if (popCajas) quantities.cajas = Number(popCajas);
      await postPop(token, {
        imageUrl,
        quantities: Object.keys(quantities).length ? quantities : undefined,
        photoRequired: false,
      });
      setPopSubmitted(true);
      await loadTrip();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al registrar POP");
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    setBusy(true);
    setError(null);
    try {
      await postStart(token, {
        confirmDriver: confirmDriver !== false,
        confirmVehicle: confirmVehicle !== false,
      });
      setTrackingStatus("ACTIVE");
      goStep("active");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al iniciar");
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    setBusy(true);
    try {
      await postStop(token);
      engineRef.current?.stop();
      goStep("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function handleIncidentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!incidentType) return;
    setBusy(true);
    setError(null);
    try {
      let imageUrl: string | undefined;
      if (incidentPhoto) {
        const blob = await compressImageFile(incidentPhoto);
        const up = await uploadPhoto(token, blob, "incident.jpg");
        imageUrl = up.url;
      }
      const lat = engineRef.current?.getLastReading()?.latitude ?? gpsReading?.latitude;
      const lng = engineRef.current?.getLastReading()?.longitude ?? gpsReading?.longitude;
      await postIncident(token, {
        type: incidentType,
        text: incidentText,
        latitude: lat,
        longitude: lng,
        imageUrl,
      });
      setIncidentType("");
      setIncidentText("");
      setIncidentPhoto(null);
      goStep("active");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al reportar");
    } finally {
      setBusy(false);
    }
  }

  async function handlePodSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!receiverName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      let imageUrl: string | undefined;
      if (podPhoto) {
        const blob = await compressImageFile(podPhoto);
        const up = await uploadPhoto(token, blob, "pod.jpg");
        imageUrl = up.url;
      }
      await postPod(token, {
        deliveryOutcome: podOutcome,
        receiverName: receiverName.trim(),
        receiverDocument: receiverDoc.trim() || undefined,
        observations: podNotes.trim() || undefined,
        imageUrl,
      });
      engineRef.current?.stop();
      clearPersistedStep(token);
      goStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al registrar POD");
    } finally {
      setBusy(false);
    }
  }

  if (step === "loading") {
    return (
      <TrackingShell title="Cargando viaje…" subtitle="Validando enlace seguro">
        <TrackingCard>
          <p className="text-sm text-[var(--text-dim)]">Un momento…</p>
        </TrackingCard>
      </TrackingShell>
    );
  }

  if (step === "invalid") {
    return (
      <TrackingShell title="Enlace no disponible">
        <TrackingCard>
          <p className="text-sm text-[var(--text)]">
            {LINK_STATUS_LABEL[linkStatus] || error || "No pudimos validar este enlace."}
          </p>
        </TrackingCard>
      </TrackingShell>
    );
  }

  if (!trip) return null;

  if (step === "detail") {
    return (
      <TrackingShell title="Confirmá el viaje" subtitle={trip.viaje.codigo}>
        <TrackingCard className="mb-4 space-y-0">
          <TrackingField label="Cliente" value={trip.viaje.cliente} />
          <TrackingField label="Chofer" value={trip.chofer} />
          <TrackingField
            label="Unidad"
            value={[trip.vehiculo.tractor, trip.vehiculo.semi].filter(Boolean).join(" · ")}
          />
          <TrackingField label="Origen" value={trip.viaje.origen} />
          <TrackingField label="Destino" value={trip.viaje.destino} />
          <TrackingField
            label="Horario"
            value={[trip.viaje.fecha, trip.viaje.hora].filter(Boolean).join(" ")}
          />
          <TrackingField label="Carga" value={trip.viaje.carga} />
          {trip.viaje.notas && <TrackingField label="Instrucciones" value={trip.viaje.notas} />}
        </TrackingCard>

        <div className="mb-4 space-y-3">
          <p className="text-sm font-medium text-[var(--text)]">¿Sos el chofer indicado?</p>
          <div className="flex gap-2">
            <TrackingButton variant={confirmDriver === true ? "primary" : "secondary"} onClick={() => setConfirmDriver(true)}>
              Sí, soy yo
            </TrackingButton>
            <TrackingButton variant={confirmDriver === false ? "danger" : "secondary"} onClick={() => setConfirmDriver(false)}>
              No
            </TrackingButton>
          </div>
          <p className="text-sm font-medium text-[var(--text)]">¿Es la unidad correcta?</p>
          <div className="flex gap-2">
            <TrackingButton variant={confirmVehicle === true ? "primary" : "secondary"} onClick={() => setConfirmVehicle(true)}>
              Sí
            </TrackingButton>
            <TrackingButton variant={confirmVehicle === false ? "danger" : "secondary"} onClick={() => setConfirmVehicle(false)}>
              No
            </TrackingButton>
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-[var(--red)]">{error}</p>}

        <TrackingButton
          disabled={confirmDriver !== true || confirmVehicle !== true}
          onClick={() => goStep("consent")}
        >
          Continuar
        </TrackingButton>
        {(confirmDriver === false || confirmVehicle === false) && (
          <p className="mt-3 text-sm text-[var(--amber)]">
            Si hay un error, contactá a operaciones antes de continuar.
          </p>
        )}
      </TrackingShell>
    );
  }

  if (step === "consent") {
    return (
      <TrackingShell title="Privacidad y ubicación" subtitle="Consentimiento informado">
        <TrackingCard className="mb-4 space-y-3 text-sm leading-relaxed text-[var(--text-dim)]">
          <p>
            SOL recopilará tu ubicación GPS mientras dure este viaje, únicamente para seguimiento
            operativo y seguridad.
          </p>
          <p>Podés detener el seguimiento en cualquier momento desde esta pantalla.</p>
          <p>
            La continuidad depende del navegador, permisos y conectividad. No es un rastreo en
            segundo plano garantizado.
          </p>
          <p className="text-xs text-[var(--text-faint)]">Versión consentimiento: {trip.consentVersion}</p>
        </TrackingCard>
        {error && <p className="mb-3 text-sm text-[var(--red)]">{error}</p>}
        <TrackingButton disabled={busy} onClick={() => void handleConsent()}>
          Acepto y continúo
        </TrackingButton>
      </TrackingShell>
    );
  }

  if (step === "gps") {
    return (
      <TrackingShell title="Verificación GPS" subtitle="Necesitamos una primera posición">
        <TrackingCard className="mb-4">
          {gpsReading ? (
            <div className="space-y-2 text-sm">
              <p className="text-[var(--green)] font-semibold">Permiso concedido</p>
              <p>Precisión: ±{Math.round(gpsReading.accuracyMeters ?? 0)} m</p>
              <p className="text-[var(--text-faint)]">
                {gpsReading.latitude.toFixed(5)}, {gpsReading.longitude.toFixed(5)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-dim)]">
              Tocá el botón para solicitar acceso a la ubicación del dispositivo.
            </p>
          )}
          {gpsError && (
            <p className="mt-3 text-sm text-[var(--red)]">
              {gpsError}. Habilitá ubicación en ajustes del navegador e intentá de nuevo.
            </p>
          )}
        </TrackingCard>
        <div className="space-y-2">
          {!gpsReading ? (
            <TrackingButton disabled={busy} onClick={() => void handleGpsCheck()}>
              Solicitar ubicación
            </TrackingButton>
          ) : (
            <TrackingButton onClick={() => goStep("ready")}>Continuar</TrackingButton>
          )}
        </div>
      </TrackingShell>
    );
  }

  if (step === "ready") {
    return (
      <TrackingShell title="Listo para salir" subtitle={trip.viaje.destino}>
        {error && <p className="mb-3 text-sm text-[var(--red)]">{error}</p>}
        {popBlocking && (
          <TrackingCard className="mb-4 space-y-3">
            <p className="text-sm font-medium text-[var(--text)]">Registro de retiro (POP)</p>
            <p className="text-xs text-[var(--text-dim)]">
              Antes de salir, registrá la carga que retirás en origen.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">
                Pallets
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-2 py-2 text-sm"
                  value={popPallets}
                  onChange={(e) => setPopPallets(e.target.value)}
                />
              </label>
              <label className="text-xs">
                Cajas
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-2 py-2 text-sm"
                  value={popCajas}
                  onChange={(e) => setPopCajas(e.target.value)}
                />
              </label>
            </div>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setPopPhoto(e.target.files?.[0] || null)}
              className="text-xs"
            />
            <TrackingButton disabled={busy} onClick={() => void handleSubmitPop()}>
              Registrar retiro (POP)
            </TrackingButton>
          </TrackingCard>
        )}
        <div className="space-y-2">
          <TrackingButton disabled={busy || popBlocking} onClick={() => void handleStart()}>
            Iniciar seguimiento
          </TrackingButton>
          <TrackingButton variant="secondary" onClick={() => window.open(mapsUrl, "_blank")}>
            Abrir Google Maps
          </TrackingButton>
          <TrackingButton variant="secondary" onClick={() => window.open(wazeUrl, "_blank")}>
            Abrir Waze
          </TrackingButton>
          <TrackingButton variant="ghost" onClick={() => goStep("incident")}>
            Reportar problema
          </TrackingButton>
        </div>
      </TrackingShell>
    );
  }

  if (step === "active") {
    const ageSec = lastSentAt
      ? Math.max(0, Math.round((Date.now() - new Date(lastSentAt).getTime()) / 1000))
      : trip.tracking?.positionAgeSeconds ?? null;

    return (
      <TrackingShell title="Viaje en curso" subtitle={trip.viaje.codigo}>
        <TrackingCard className="mb-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <TrackingStatusPill label={trackingStatus} tone={statusTone(trackingStatus)} />
            {!online && <TrackingStatusPill label="Sin conexión" tone="amber" />}
          </div>
          <p className="text-sm text-[var(--text-dim)]">
            Última ubicación enviada: {formatAge(ageSec)}
          </p>
          <p className="text-sm text-[var(--text-dim)]">
            Precisión: {lastAccuracy != null ? `±${Math.round(lastAccuracy)} m` : "—"}
          </p>
          <p className="text-sm text-[var(--text-dim)]">Fuente: navegador del chofer</p>
          {pendingCount > 0 && (
            <p className="text-sm text-[var(--amber)]">{pendingCount} posiciones pendientes de envío</p>
          )}
          <TrackingField label="Destino" value={trip.viaje.destino} />
        </TrackingCard>
        <div className="space-y-2">
          <TrackingButton variant="secondary" onClick={() => window.open(mapsUrl, "_blank")}>
            Google Maps
          </TrackingButton>
          <TrackingButton variant="secondary" onClick={() => window.open(wazeUrl, "_blank")}>
            Waze
          </TrackingButton>
          <TrackingButton variant="secondary" onClick={() => goStep("incident")}>
            Reportar incidencia
          </TrackingButton>
          <TrackingButton onClick={() => goStep("arrival")}>Confirmar llegada</TrackingButton>
          <TrackingButton variant="ghost" onClick={() => void handleStop()}>
            Detener seguimiento
          </TrackingButton>
        </div>
      </TrackingShell>
    );
  }

  if (step === "incident") {
    return (
      <TrackingShell title="Reportar incidencia" subtitle="Describí qué pasó">
        <form onSubmit={(e) => void handleIncidentSubmit(e)} className="space-y-4">
          <TrackingCard className="space-y-3">
            <label className="block text-sm font-medium">Tipo</label>
            <select
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3 py-3 text-sm"
              value={incidentType}
              onChange={(e) => setIncidentType(e.target.value)}
              required
            >
              <option value="">Seleccionar…</option>
              {INCIDENT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <label className="block text-sm font-medium">Detalle</label>
            <textarea
              className="min-h-[100px] w-full rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-sm"
              value={incidentText}
              onChange={(e) => setIncidentText(e.target.value)}
              placeholder="Opcional"
            />
            <label className="block text-sm font-medium">Foto</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setIncidentPhoto(e.target.files?.[0] ?? null)}
            />
          </TrackingCard>
          {error && <p className="text-sm text-[var(--red)]">{error}</p>}
          <TrackingButton type="submit" disabled={busy || !incidentType}>
            Enviar incidencia
          </TrackingButton>
          <TrackingButton type="button" variant="ghost" onClick={() => goStep("active")}>
            Volver
          </TrackingButton>
        </form>
      </TrackingShell>
    );
  }

  if (step === "arrival") {
    return (
      <TrackingShell title="Llegada al destino" subtitle="Confirmá antes del POD">
        <TrackingCard className="mb-4">
          <p className="text-sm text-[var(--text-dim)]">
            ¿Estás en el punto de entrega {trip.viaje.destino}?
          </p>
        </TrackingCard>
        {error && <p className="mb-3 text-sm text-[var(--red)]">{error}</p>}
        <div className="space-y-2">
          <TrackingButton
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await postArrive(token);
                goStep("pod");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Error");
              } finally {
                setBusy(false);
              }
            }}
          >
            Sí, llegué
          </TrackingButton>
          <TrackingButton variant="ghost" onClick={() => goStep("active")}>
            Todavía no
          </TrackingButton>
        </div>
      </TrackingShell>
    );
  }

  if (step === "pod") {
    return (
      <TrackingShell title="Constancia de entrega (POD)" subtitle="Completá los datos">
        <form onSubmit={(e) => void handlePodSubmit(e)} className="space-y-4">
          <TrackingCard className="space-y-3">
            <label className="block text-sm font-medium">Resultado</label>
            <select
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3 py-3 text-sm"
              value={podOutcome}
              onChange={(e) => setPodOutcome(e.target.value)}
            >
              {POD_OUTCOMES.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <label className="block text-sm font-medium">Nombre quien recibe *</label>
            <input
              required
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3 py-3 text-sm"
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
            />
            <label className="block text-sm font-medium">Documento (opcional)</label>
            <input
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3 py-3 text-sm"
              value={receiverDoc}
              onChange={(e) => setReceiverDoc(e.target.value)}
            />
            <label className="block text-sm font-medium">Foto evidencia *</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              required={!podPhoto}
              onChange={(e) => setPodPhoto(e.target.files?.[0] ?? null)}
            />
            <label className="block text-sm font-medium">Observaciones</label>
            <textarea
              className="min-h-[80px] w-full rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-sm"
              value={podNotes}
              onChange={(e) => setPodNotes(e.target.value)}
            />
          </TrackingCard>
          {error && <p className="text-sm text-[var(--red)]">{error}</p>}
          <TrackingButton type="submit" disabled={busy || !receiverName.trim() || !podPhoto}>
            Finalizar viaje
          </TrackingButton>
        </form>
      </TrackingShell>
    );
  }

  return (
    <TrackingShell title="Viaje completado" subtitle="Gracias">
      <TrackingCard>
        <p className="text-sm text-[var(--text-dim)]">
          Registramos la entrega. Podés cerrar esta pantalla.
        </p>
      </TrackingCard>
    </TrackingShell>
  );
}
