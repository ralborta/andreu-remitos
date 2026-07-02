# Plantillas Excel — Planillas Andreu

Acá van los **archivos Excel originales del cliente** (Gisela / Paola). Los usamos como referencia exacta para headers, hojas y formato de import.

## Qué copiar acá

| Archivo sugerido | Contenido |
|------------------|-----------|
| `proforma-tsb-ejemplo.xlsx` | Excel con hojas **Planilla Diaria** + **Proforma** (ej. `Proforma_TSB_ARENA_…`) |
| `delfos-tsb-ejemplo.xlsx` | Planilla Delfos / Arianna (columnas A–Y, headers con `_`) |
| `proforma-beraldi-ejemplo.xlsx` | Igual que TSB pero Beraldi (si difiere) |
| `delfos-beraldi-ejemplo.xlsx` | Delfos Beraldi (km en Cantidad / UnidadDeMedida) |

Podés mandar **uno solo** si TSB y Beraldi comparten el mismo layout; si no, uno por tenant.

## Cómo subirlos

1. Arrastrá los `.xlsx` a esta carpeta en Cursor:  
   `Andreu/docs/planillas/templates/`
2. O desde terminal:
   ```bash
   cp ~/Downloads/Proforma_TSB_ARENA_2026-07-02.xlsx docs/planillas/templates/proforma-tsb-ejemplo.xlsx
   ```
3. Avisame en el chat: *“ya están las plantillas”* — leo los headers y alineamos el export.

## Importante

- Preferí el archivo **tal cual lo usa el cliente** (el que importan sin editar).
- Si tienen versión “buena” vs “mala”, la **buena** es la que el sistema acepta.
- Estos archivos **sí pueden commitearse** (son plantillas, sin datos sensibles). Si alguno trae datos reales de clientes, renombrá o anonimizá antes.

## Alternativa rápida

Si no querés tocar el repo: **adjuntá los Excel en el chat de Cursor** (como las capturas). Sirve igual para leer headers; tenerlos en esta carpeta ayuda para tests automáticos después.
