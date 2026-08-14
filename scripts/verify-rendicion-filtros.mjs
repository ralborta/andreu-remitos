#!/usr/bin/env node
/**
 * Verifica filtros de listado de rendiciones: q, desde, hasta (+ estado).
 * Usa DATA_DIR temporal; sin mocks permanentes.
 *
 *   node scripts/verify-rendicion-filtros.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rendicion-filtros-"));
process.env.DATA_DIR = tmp;

const store = await import("../backend/src/db/rendicion-store.mjs");

const rows = [
  {
    id: "RG-A1",
    codigo: "RG-0001",
    estado: "pendiente_aprobacion",
    categoria: "peaje",
    monto: 1500,
    moneda: "ARS",
    proveedor: null,
    fecha_comprobante: null,
    descripcion: "Peaje Panamericana",
    viaje_ref: "REM-7788",
    telefono: "5491111111111",
    chofer_nombre: "Juan Pérez",
    patente: "AB123CD",
    imagen_url: null,
    nota_chofer: null,
    texto_ocr: null,
    nota_aprobacion: null,
    aprobado_por: null,
    historial: [],
    created_at: "2026-08-10T12:00:00.000Z",
    updated_at: "2026-08-10T12:00:00.000Z",
  },
  {
    id: "RG-B2",
    codigo: "RG-0002",
    estado: "aprobado",
    categoria: "combustible",
    monto: 80000,
    moneda: "ARS",
    proveedor: "YPF",
    fecha_comprobante: null,
    descripcion: "Nafta",
    viaje_ref: "REM-9900",
    telefono: "5491222222222",
    chofer_nombre: "María López",
    patente: "AC456EF",
    imagen_url: "/media/x.jpg",
    nota_chofer: null,
    texto_ocr: null,
    nota_aprobacion: "ok",
    aprobado_por: "backoffice",
    historial: [],
    created_at: "2026-08-12T15:00:00.000Z",
    updated_at: "2026-08-12T15:00:00.000Z",
  },
  {
    id: "RG-C3",
    codigo: "RG-0003",
    estado: "rechazado",
    categoria: "otro",
    monto: 500,
    moneda: "ARS",
    proveedor: null,
    fecha_comprobante: null,
    descripcion: "Viejo",
    viaje_ref: null,
    telefono: "5491333333333",
    chofer_nombre: "Carlos",
    patente: "ZZ999ZZ",
    imagen_url: null,
    nota_chofer: null,
    texto_ocr: null,
    nota_aprobacion: "ilegible",
    aprobado_por: "backoffice",
    historial: [],
    created_at: "2026-07-01T10:00:00.000Z",
    updated_at: "2026-07-01T10:00:00.000Z",
  },
];

fs.writeFileSync(path.join(tmp, "rendicion-gastos.json"), JSON.stringify(rows, null, 2));

const all = await store.listGastos({ limit: 100 });
assert.equal(all.length, 3, "sin filtros: 3");

const byChofer = await store.listGastos({ q: "pérez" });
assert.equal(byChofer.length, 1);
assert.equal(byChofer[0].id, "RG-A1");

const byPatente = await store.listGastos({ q: "AC456EF" });
assert.equal(byPatente.length, 1);
assert.equal(byPatente[0].id, "RG-B2");

const byRemito = await store.listGastos({ q: "REM-7788" });
assert.equal(byRemito.length, 1);
assert.equal(byRemito[0].id, "RG-A1");

const porFecha = await store.listGastos({ desde: "2026-08-11", hasta: "2026-08-13" });
assert.equal(porFecha.length, 1);
assert.equal(porFecha[0].id, "RG-B2");

const combo = await store.listGastos({
  estado: "pendiente_aprobacion",
  q: "juan",
  desde: "2026-08-01",
  hasta: "2026-08-31",
});
assert.equal(combo.length, 1);
assert.equal(combo[0].id, "RG-A1");

const vacio = await store.listGastos({ q: "no-existe-xyz" });
assert.equal(vacio.length, 0);

const legacy = await store.listGastos({ estado: "aprobado" });
assert.equal(legacy.length, 1, "backward compatible: solo estado");

console.log("OK verify-rendicion-filtros");
