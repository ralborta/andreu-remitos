/** Schema Document AI — guía TSB (Custom Extractor). */
export const TSB_DOCUMENT_SCHEMA = {
  displayName: "Guia TSB",
  description: "Campos guia de transporte TSB",
  entityTypes: [
    {
      name: "custom_extraction_document_type",
      baseTypes: ["document"],
      properties: [
        { name: "nro_guia", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "fecha", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "conductor", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "chasis", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "acoplado", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "peso", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "procedencia", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "destino", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "malla", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "remito_cliente", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "nro_interno", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "hora_carga_entrada", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "hora_carga_salida", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "hora_descarga_llegada", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "hora_descarga_inicio", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "hora_descarga_fin", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
      ],
    },
  ],
};
