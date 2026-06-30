/** Schema Document AI — remito Quilmes / Corina (viajes cortos). */
export const CORINA_DOCUMENT_SCHEMA = {
  displayName: "Remito Quilmes Corina",
  description: "Remito Cervecería Quilmes — viajes cortos Andreu",
  entityTypes: [
    {
      name: "custom_extraction_document_type",
      baseTypes: ["document"],
      properties: [
        { name: "nro_remito", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "fecha", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "cliente", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "cod_cliente", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "transportista", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "conductor", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "patente", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "total_bultos", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "total_litros", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "pedido", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "entrega", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "tr_numero", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
      ],
    },
  ],
};
