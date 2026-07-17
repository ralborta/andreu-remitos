/** Schema Document AI — remito Beraldi (14 campos). */
export const BERALDI_DOCUMENT_SCHEMA = {
  displayName: "Remito Beraldi",
  description: "Campos remito Transportes Beraldi / YPF",
  entityTypes: [
    {
      name: "custom_extraction_document_type",
      baseTypes: ["document"],
      properties: [
        { name: "nro_remito", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "fecha", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "ot", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "chofer", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "tractor", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "semi", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "peso", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "destino", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "origen", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "unidad", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "hora_carga_entrada", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "hora_carga_salida", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "hora_descarga_llegada", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "hora_descarga_inicio", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
        { name: "hora_descarga_fin", valueType: "string", occurrenceType: "OPTIONAL_ONCE" },
      ],
    },
  ],
};
