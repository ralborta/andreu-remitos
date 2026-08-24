"use client";

import { useEffect, useState } from "react";
import { getTripEvidenceSummary, type TripEvidenceSummary } from "@/lib/api";

const MILESTONE_LABEL: Record<string, string> = {
  not_required: "No requerido",
  pending: "Pendiente",
  received: "Recibido",
  observed: "Observado",
  approved: "Aprobado",
  rejected: "Rechazado",
};

function milestoneIcon(status: string) {
  if (status === "approved") return "✓";
  if (status === "rejected") return "✗";
  if (status === "observed") return "⚠";
  if (status === "received") return "●";
  if (status === "pending") return "○";
  return "—";
}

export function TripEvidenceSection({ tripId }: { tripId: string }) {
  const [data, setData] = useState<TripEvidenceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getTripEvidenceSummary(tripId)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [tripId]);

  if (error) return <p className="text-xs text-rose-600">{error}</p>;
  if (!data) return <p className="text-xs text-gray-500">Cargando evidencias…</p>;

  const popSt = data.milestones?.pop?.status || "not_required";
  const podSt = data.milestones?.pod?.status || "not_required";

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Cadena de custodia
      </p>
      <ul className="space-y-1 text-sm text-gray-800">
        <li>
          {milestoneIcon(popSt)} POP — {MILESTONE_LABEL[popSt] || popSt}
          {data.milestones?.pop?.codigo ? ` (${data.milestones.pop.codigo})` : ""}
        </li>
        <li>
          {milestoneIcon(podSt)} POD — {MILESTONE_LABEL[podSt] || podSt}
          {data.milestones?.pod?.codigo ? ` (${data.milestones.pod.codigo})` : ""}
        </li>
      </ul>

      {data.comparison?.hasDifference && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
          ⚠ Diferencia POP vs POD: {data.comparison.summary}
        </p>
      )}

      {data.pop && data.pod && (
        <table className="mt-3 w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1">Campo</th>
              <th className="py-1">POP</th>
              <th className="py-1">POD</th>
            </tr>
          </thead>
          <tbody>
            {(["pallets", "cajas", "bultos"] as const).map((f) => {
              const p = data.pop?.reportedQuantities?.[f];
              const d = data.pod?.reportedQuantities?.[f];
              if (p == null && d == null) return null;
              return (
                <tr key={f} className="border-t border-gray-200">
                  <td className="py-1 capitalize">{f}</td>
                  <td className="py-1">{String(p ?? "—")}</td>
                  <td className="py-1">{String(d ?? "—")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
