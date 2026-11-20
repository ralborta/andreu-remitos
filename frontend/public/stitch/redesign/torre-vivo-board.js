/* Tablero operativo de agentes — simulación continua (demo). */
(function () {
  var VISIBLE = 12;
  var INSERT_MS = 3600;

  var CLIENTS = [
    "Arcor S.A.",
    "Molinos",
    "Coca-Cola Andina",
    "Newsan",
    "Quilmes",
    "YPF",
    "Acindar",
    "Mastellone",
    "Sinteplast",
    "Mercado Libre Full",
    "Frigorífico La Pampa",
  ];
  var DRIVERS = [
    "R. Quiroga",
    "J. Domínguez",
    "W. Benítez",
    "C. Páez",
    "S. Ferreyra",
    "P. Cardozo",
    "M. Ojeda",
    "G. Leiva",
    "M. Aguirre",
    "F. Ledesma",
    "E. Farias",
    "H. Maldonado",
  ];
  var ROUTES = [
    "Córdoba → CABA",
    "Rosario → CABA",
    "CABA → Mar del Plata",
    "Mendoza → Córdoba",
    "Bahía Blanca → Neuquén",
    "Zárate → Mar del Plata",
    "Salta → Rosario",
    "Santa Fe → CABA",
    "Campana → Pilar",
    "Córdoba → Mendoza",
  ];
  var UNITS = [
    "AD 392 CD",
    "AE 184 BK",
    "AB 771 LM",
    "AC 905 TR",
    "AF 228 QW",
    "AA 441 HS",
    "AG 016 NP",
    "AH 673 FZ",
    "AJ 259 KR",
    "AK 808 DV",
    "AL 114 PX",
    "AM 560 JT",
  ];
  var CARGAS = ["alimentos", "bebidas", "insumos", "mercadería seca", "carga refrigerada"];
  var PLANTAS = ["planta Arcor", "playa Campana", "centro Zárate", "depósito Pilar", "muelle Dock Sud"];
  var RECEPTORES = ["J. Acosta", "L. Pereyra", "M. Rivas", "C. Gómez", "A. Núñez"];
  var PROVEEDORES = ["YPF Combustibles", "Michelin", "Scania Argentina", "Pirelli", "Agroservicios del Norte"];
  var FIN_DADORES = ["TSB Logística S.A.", "Beraldi Transportes", "MYE Cargas", "Andes Cargo SRL", "Cuyo Express"];
  var FIN_FACTURAS = ["A-0003-00018421", "A-0001-00009012", "B-0008-00004410", "A-0002-00005501", "A-0005-00001220"];
  var FIN_IMPORTES = ["$ 1.482.500", "$ 890.000", "$ 312.400", "$ 540.000", "$ 275.000"];

  var AGENTS = [
    { id: "viajes", name: "Agente de Gestión de Viajes", mod: "log" },
    { id: "tracking", name: "Tracking Express", mod: "log" },
    { id: "remitos", name: "Agente de Remitos", mod: "log" },
    { id: "destinos", name: "Confirmación de Destinos", mod: "log" },
    { id: "incidencias", name: "Gestión de Incidencias", mod: "log" },
    { id: "rendicion", name: "Rendición de Viajes", mod: "log" },
    { id: "eta", name: "ETA y Notificación Proactiva", mod: "log" },
    { id: "pod", name: "Evidencias de Transporte", mod: "log" },
    { id: "reclamos", name: "Reclamos Logísticos", mod: "log" },
    { id: "analitica", name: "Analítica de Performance", mod: "log" },
    { id: "facturas", name: "Facturas de pago (CxP)", mod: "fin" },
    { id: "facturas-cobro", name: "Facturas de cobranza (CxC)", mod: "fin" },
    { id: "cobranzas", name: "Gestión de cobranza", mod: "fin" },
    { id: "conciliacion", name: "Agente de Conciliación", mod: "fin" },
    { id: "comunicacion", name: "Agente de Comunicación", mod: "fin" },
    { id: "marketing", name: "Planificador de campañas", mod: "mkt" },
    { id: "teo", name: "Contenidos", mod: "mkt" },
    { id: "rankear", name: "Rankear", mod: "mkt" },
    { id: "marketing-email", name: "Email Marketing", mod: "mkt" },
    { id: "marketing-offers", name: "Promociones", mod: "mkt" },
    { id: "growth", name: "Menciones", mod: "mkt" },
    { id: "marketing-analytics", name: "Analítica", mod: "mkt" },
  ];

  var PROCESSES = [
    { id: "remito-enviado", agent: "remitos", kpi: "ocr", tone: "done", icon: "receipt_long", name: "Remito enviado", brief: "{chofer} terminó de enviar el remito {remito} de {cliente}", line: "Unidad {unidad} · {ruta} · {bultos} bultos de {carga}", extra: "Foto por WhatsApp. {chofer} en {unidad}, viaje {viaje}. Se leyeron {bultos} bultos y el destino de {cliente}.", story: ["Foto del remito {remito} por WhatsApp", "{bultos} bultos · unidad {unidad}", "Confirmó destino de {cliente}", "Remito cargado"] },
    { id: "unidad-trafico", agent: "eta", kpi: "etas", kpi2: "demoras", tone: "delay", icon: "traffic", name: "Tráfico en ruta", brief: "Unidad {unidad} trabada por tráfico en {ruta} · {min} min de retraso", line: "{chofer} · {carga} para {cliente} · nuevo arribo {hora}", extra: "{chofer} reportó cola sobre {ruta}. Carga de {carga} para {cliente}. Se avisó que llega a las {hora} ({min} min más tarde).", story: ["{ruta} trabada por tráfico", "{chofer} en {unidad} con {carga}", "Avisó a {cliente} arribo {hora}", "Lleva {min} min de retraso"] },
    { id: "arribo", agent: "tracking", kpi: "etas", tone: "done", icon: "flag", name: "Arribo a destino", brief: "Camión {unidad} arribó a {cliente} · {chofer} llegó a las {hora}", line: "{ruta} · {carga} · viaje {viaje} · {bultos} bultos", extra: "{chofer} llegó a planta de {cliente} a las {hora}. Carga de {carga} lista para descargar. Remito {remito}.", story: ["Unidad {unidad} en puerta de {cliente}", "Arribo {hora} vs ventana", "Confirmó llegada de {chofer}", "Camión en destino"] },
    { id: "salida", agent: "viajes", kpi: "choferes", tone: "ok", icon: "warehouse", name: "Salida de planta", brief: "Camión {unidad} salió de {planta} a las {hora} con {chofer}", line: "{ruta} · {carga} para {cliente} · {bultos} bultos · {viaje}", extra: "Muelle liberado. {chofer} salió con {unidad} rumbo a {cliente} por {ruta}. Viaje {viaje}.", story: ["Carga lista en {planta}", "Muelle libre · {bultos} bultos", "Salió {chofer} a las {hora}", "Camión en ruta a {cliente}"] },
    { id: "entrega-ok", agent: "pod", kpi: "pods", tone: "done", icon: "check_circle", name: "Entrega sin novedad", brief: "Carga de {carga} entregada sin novedad en {cliente}", line: "{chofer} · {unidad} · remito {remito} · recibió {receptor}", extra: "Firma y foto ok. {receptor} recibió {bultos} bultos en planta de {cliente} a las {hora}. Viaje {viaje}.", story: ["Camión {unidad} en planta de {cliente}", "Pidió firma a {receptor}", "Validó {bultos} bultos y foto", "Entrega sin novedad"] },
    { id: "entrega-verificada", agent: "pod", kpi: "pods", tone: "done", icon: "verified", name: "Entrega verificada", brief: "Se verificó la entrega en {cliente}: remito {remito}, {bultos} bultos", line: "{chofer} · unidad {unidad} · {carga} · {ruta}", extra: "Foto de descarga cruzada con el remito {remito}. Recibió {receptor} a las {hora}.", story: ["Foto de la descarga en {cliente}", "Cruce vs remito {remito}", "Confirmó {bultos} bultos", "Entrega verificada"] },
    { id: "retraso-carga", agent: "incidencias", kpi: "demoras", tone: "delay", icon: "hourglass_top", name: "Retraso en carga", brief: "Retraso de {min} min en la carga de {carga} en {planta}", line: "Unidad {unidad} ({chofer}) espera para {cliente} · {viaje}", extra: "{chofer} está parado en {planta} desde hace {min} min. Faltan bultos de {carga} para {cliente}. Nuevo arribo estimado {hora}.", story: ["{unidad} parada en {planta}", "Falta terminar carga de {carga}", "Avisó a {chofer} y a {cliente}", "Carga demorada {min} min"] },
    { id: "mecanico", agent: "incidencias", kpi: "demoras", tone: "delay", icon: "build", name: "Problema mecánico", brief: "Falla mecánica en {unidad} ({chofer}) sobre {ruta}", line: "{carga} a {cliente} · detenido hace {min} min · {viaje}", extra: "{chofer} paró {unidad} por falla. Auxilio pedido. {cliente} avisado: la {carga} llega a las {hora}.", story: ["{chofer} paró {unidad}", "Falla mecánica en {ruta}", "Pidió auxilio y avisó a {cliente}", "Unidad detenida {min} min"] },
    { id: "control-vial", agent: "incidencias", kpi: "demoras", tone: "warn", icon: "local_police", name: "Control vial", brief: "Unidad {unidad} detenida en un control sobre {ruta}", line: "{chofer} espera liberación · {carga} a {cliente} · {viaje}", extra: "Control vial. {chofer} reportó demora de {min} min. Papeles de {cliente} en regla. Sigue a la espera.", story: ["{unidad} parada en control", "Control vial en {ruta}", "Tomó parte de {chofer}", "Sigue en el control"] },
    { id: "chofer-confirma", agent: "viajes", kpi: "choferes", tone: "ok", icon: "badge", name: "Chofer confirmó", brief: "{chofer} confirmó el viaje {viaje} y toma {unidad}", line: "{ruta} · {carga} para {cliente} · salida {hora}", extra: "WhatsApp de OK. {chofer} sale de {planta} a las {hora} con {unidad} rumbo a {cliente}.", story: ["{viaje} sin chofer", "Ofreció {ruta} y {unidad}", "WhatsApp de confirmación", "{chofer} aceptó para las {hora}"] },
    { id: "chofer-no-responde", agent: "incidencias", kpi: "choferes", tone: "warn", icon: "sms_failed", name: "Chofer no responde", brief: "{chofer} no responde el WhatsApp · unidad {unidad} en {ruta}", line: "Se le pidió causa y foto de posición · {carga} a {cliente}", extra: "Sin parte hace {min} min. {viaje} con {carga} para {cliente}. Se reenvió el mensaje y se sigue la unidad.", story: ["Sin parte de {chofer}", "{unidad} en {ruta} hacia {cliente}", "Reenvió el WhatsApp", "Espera causa y foto"] },
    { id: "foto-entrega", agent: "pod", kpi: "pods", tone: "ok", icon: "photo_camera", name: "Foto de entrega", brief: "{chofer} mandó la foto de la entrega en {cliente}", line: "Unidad {unidad} · remito {remito} · {bultos} bultos · falta cruzar firma", extra: "Foto por WhatsApp a las {hora}. Carga de {carga}. Falta validar firma de {receptor}.", story: ["Foto llegada a las {hora}", "{carga} en planta de {cliente}", "Revisó {bultos} bultos", "Foto cargada · falta firma"] },
    { id: "destino-ok", agent: "destinos", kpi: "avisos", tone: "done", icon: "pin_drop", name: "Destino confirmado", brief: "Destino de {cliente} confirmado para {unidad} · se mandó el link a {chofer}", line: "{ruta} · {planta} · viaje {viaje}", extra: "Dirección validada. {chofer} ya tiene el pin de {cliente} para llegar con {unidad}.", story: ["Dirección incompleta de {cliente}", "Validó planta y ruta {ruta}", "Mandó el link a {chofer}", "Destino confirmado"] },
    { id: "aviso-dador", agent: "eta", kpi: "avisos", tone: "ok", icon: "notifications", name: "Aviso al dador", brief: "Se avisó a {cliente} que {unidad} llega a las {hora} ({min} min más tarde)", line: "{chofer} · {ruta} · {carga} · viaje {viaje}", extra: "Cambio de arribo por {ruta}. {chofer} en {unidad}. {cliente} quedó informado de la nueva hora {hora}.", story: ["Cambio de arribo a {hora}", "{unidad} de {chofer} en {ruta}", "Avisó a {cliente}", "Dador informado"] },
    { id: "arribo-tarde", agent: "eta", kpi: "etas", kpi2: "avisos", tone: "delay", icon: "schedule", name: "Arribo más tarde", brief: "{unidad} llega a las {hora} a {cliente} · {min} min más tarde", line: "{chofer} · {ruta} · {carga} · se avisó la nueva hora", extra: "Tráfico en {ruta}. Se recalculó el arribo a las {hora} y se avisó a {cliente}. Viaje {viaje}.", story: ["Iba a llegar tarde a {cliente}", "Tráfico en {ruta}", "Nuevo arribo {hora}", "{cliente} ya sabe"] },
    { id: "ventana-riesgo", agent: "eta", kpi: "avisos", tone: "warn", icon: "event", name: "Ventana justa", brief: "Ventana de {cliente} justa: {unidad} llega a las {hora} ({min} min de margen)", line: "{chofer} en {ruta} · si se traba, pierde el cupo de planta", extra: "Cupo de {cliente} a las {hora}. {chofer} en {unidad} por {ruta}. Margen de {min} min.", story: ["Cupo de planta de {cliente} a las {hora}", "Cruce vs arribo de {unidad}", "Avisó a {chofer}", "Ventana todavía alcanzable"] },
    { id: "dif-bultos", agent: "remitos", kpi: "ocr", tone: "warn", icon: "difference", name: "Faltan bultos", brief: "Faltan bultos en el remito {remito} de {cliente} · {chofer} mandó la foto", line: "Unidad {unidad} · se leyeron menos bultos de {carga} de los pedidos", extra: "Almacén vio la diferencia al leer el remito {remito}. {viaje} · {ruta}. Queda pendiente con {cliente}.", story: ["Foto del remito {remito}", "Cruce de bultos vs pedido de {cliente}", "Avisó a almacén", "Pendiente de {cliente}"] },
    { id: "unidad-asignada", agent: "viajes", kpi: "choferes", tone: "ok", icon: "local_shipping", name: "Unidad asignada", brief: "Unidad {unidad} asignada a {chofer} para {ruta}", line: "{viaje} · {carga} para {cliente} · salida de {planta} a las {hora}", extra: "{chofer} toma {unidad} en {planta}. {bultos} bultos de {carga} a {cliente}.", story: ["{viaje} sin unidad", "Había {unidad} libre en {planta}", "Asignó a {chofer}", "Sale a las {hora}"] },
    { id: "asig-flota", agent: "viajes", kpi: "choferes", tone: "ok", icon: "local_shipping", name: "Chofer toma unidad", brief: "{chofer} toma la unidad {unidad} en {planta} para {ruta}", line: "{carga} para {cliente} · {viaje} · salida {hora}", extra: "Equipo libre. {chofer} sale a las {hora} con {bultos} bultos de {carga}.", story: ["Pedido de equipo para {viaje}", "{unidad} libre en {planta}", "Se la dio a {chofer}", "Flota asignada"] },
    { id: "papeles", agent: "remitos", kpi: "ocr", tone: "ok", icon: "description", name: "Papeles listos", brief: "Papeles de {cliente} listos para {chofer} · unidad {unidad}", line: "Viaje {viaje} · {ruta} · carpeta en {planta}", extra: "CRT y remito {remito} armados. {chofer} los retira en {planta} antes de salir a las {hora}.", story: ["Faltaban papeles de {cliente}", "Armó CRT y remito {remito}", "Dejó la carpeta en {planta}", "Papeles en {unidad}"] },
    { id: "consolida", agent: "viajes", kpi: "ocr", tone: "ok", icon: "inventory_2", name: "Carga consolidada", brief: "Se juntaron 3 remitos de {cliente} en {unidad} para {ruta}", line: "{chofer} · {bultos} bultos de {carga} · sale de {planta} a las {hora}", extra: "Misma ruta {ruta}. Van en {unidad} con {chofer}. Viaje {viaje}.", story: ["Pedidos sueltos de {cliente}", "Misma ruta {ruta}", "Los juntó en {unidad}", "Carga armada · {bultos} bultos"] },
    { id: "consulta", agent: "tracking", kpi: "avisos", tone: "done", icon: "near_me", name: "Dónde está el camión", brief: "{cliente} preguntó por {unidad}: va por {ruta} y llega a las {hora}", line: "{chofer} · {carga} · viaje {viaje} · se respondió con posición y arribo", extra: "El dador {cliente} pidió el estado. {chofer} está en {ruta} con {unidad}. Arribo {hora}.", story: ["{cliente} preguntó por la carga", "Posición de {unidad} en {ruta}", "Arribo estimado {hora}", "Dador respondido"] },
    { id: "ticket-peaje", agent: "rendicion", kpi: "conciliadas", tone: "ok", icon: "receipt", name: "Ticket de peaje", brief: "{chofer} mandó el ticket de peaje de {ruta} · unidad {unidad}", line: "Viaje {viaje} · {cliente} · queda en la rendición del día", extra: "Foto del ticket por WhatsApp. {chofer} en {unidad}. Se cargó a la rendición de {viaje}.", story: ["Foto del ticket de {chofer}", "Peaje en {ruta}", "Lo cargó a {viaje}", "Ticket asentado"] },
    { id: "combustible", agent: "rendicion", kpi: "conciliadas", tone: "ok", icon: "local_gas_station", name: "Carga de gasoil", brief: "{chofer} cargó gasoil en {unidad} · comprobante por WhatsApp", line: "Viaje {viaje} · {ruta} · {carga} a {cliente}", extra: "Foto del surtidor. Queda en la rendición de {chofer} del viaje {viaje}.", story: ["Foto del surtidor", "{unidad} de {chofer} en {ruta}", "Cargó el comprobante", "Gasoil rendido"] },
    { id: "reclamo", agent: "reclamos", kpi: "demoras", tone: "warn", icon: "support_agent", name: "Reclamo del dador", brief: "{cliente} reclamó la carga de {viaje} · {unidad} de {chofer}", line: "{ruta} · {carga} · motivo: demora o diferencia de bultos", extra: "Entró el reclamo. {chofer} va por {ruta} con {unidad}. Se abrió seguimiento con {cliente}.", story: ["Reclamo de {cliente} por {viaje}", "Identificó {unidad} y {chofer}", "Clasificó demora o bultos", "Caso abierto"] },
    { id: "sla-justo", agent: "eta", kpi: "demoras", tone: "warn", icon: "speed", name: "Llega justo", brief: "{unidad} llega justa a {cliente} a las {hora} · {min} min de margen", line: "{chofer} en {ruta} · {carga} · si se traba hay retraso", extra: "Margen corto. {chofer} en {unidad} por {ruta}. Hay que seguirla hasta planta de {cliente}.", story: ["Margen de {min} min a {cliente}", "{unidad} en {ruta}", "Avisó a {chofer}", "Hay que seguirla"] },
    { id: "accidente", agent: "incidencias", kpi: "demoras", tone: "delay", icon: "car_crash", name: "Accidente en ruta", brief: "Accidente sobre {ruta}: {unidad} de {chofer} quedó parada", line: "{carga} a {cliente} · {min} min detenido · viaje {viaje}", extra: "{chofer} reportó choque/corte en {ruta}. Auxilio y parte. {cliente} avisado: llega a las {hora}.", story: ["Corte por accidente en {ruta}", "{unidad} de {chofer} no pasa", "Pidió auxilio y avisó a {cliente}", "Unidad parada {min} min"] },
    { id: "pinchazo", agent: "incidencias", kpi: "demoras", tone: "delay", icon: "tire_repair", name: "Pinchazo", brief: "{unidad} pinchó en {ruta} · {chofer} espera auxilio hace {min} min", line: "{carga} para {cliente} · nuevo arribo {hora} · {viaje}", extra: "Cubierta. Auxilio en camino. {cliente} sabe que la {carga} llega a las {hora}.", story: ["{chofer} paró {unidad}", "Pinchazo en {ruta}", "Pidió auxilio", "Espera hace {min} min"] },
    { id: "piquete", agent: "incidencias", kpi: "etas", kpi2: "demoras", tone: "delay", icon: "block", name: "Piquete", brief: "Piquete corta {ruta} · {unidad} de {chofer} no puede pasar", line: "{carga} a {cliente} · desvío o espera · {min} min de retraso", extra: "Corte de ruta. Se evalúa desvío. {cliente} avisado, arribo {hora}.", story: ["Piquete sobre {ruta}", "{unidad} frenada", "Buscó desvío y avisó a {cliente}", "Retraso de {min} min"] },
    { id: "anegamiento", agent: "eta", kpi: "etas", kpi2: "demoras", tone: "delay", icon: "flood", name: "Ruta anegada", brief: "{ruta} cortada por anegamiento · {unidad} tuvo que desviarse", line: "{chofer} · {carga} a {cliente} · llega a las {hora} · {min} min tarde", extra: "Agua sobre la calzada. Desvío más largo. {cliente} informado.", story: ["{ruta} anegada", "Desvió a {unidad}", "Nuevo arribo {hora}", "{min} min de retraso"] },
    { id: "cadena-frio", agent: "incidencias", kpi: "demoras", tone: "delay", icon: "ac_unit", name: "Cadena de frío", brief: "Cadena de frío en riesgo en {unidad} · {carga} refrigerada a {cliente}", line: "{chofer} en {ruta} · equipo de frío fallando · {viaje}", extra: "{chofer} reportó alarma de temperatura. Se busca planta o recambio. {cliente} avisado.", story: ["Alarma de frío en {unidad}", "{carga} a {cliente} por {ruta}", "Pidió recambio y avisó", "Carga en riesgo"] },
    { id: "rechazo", agent: "reclamos", kpi: "demoras", tone: "delay", icon: "cancel", name: "Carga rechazada", brief: "{cliente} rechazó la carga de {viaje} · {bultos} bultos de {carga}", line: "{chofer} con {unidad} en planta · remito {remito} · hay que reprogramar", extra: "Rechazo en puerta. Motivo a confirmar. {unidad} queda en planta de {cliente} hasta nueva orden.", story: ["{unidad} en planta de {cliente}", "Rechazaron {bultos} bultos", "Tomó el rechazo", "Hay que reprogramar"] },
    { id: "planta-cerrada", agent: "destinos", kpi: "demoras", tone: "delay", icon: "domain_disabled", name: "Planta cerrada", brief: "Planta de {cliente} cerrada · {unidad} de {chofer} no puede descargar", line: "Llegó a las {hora} · {carga} · {bultos} bultos · {viaje}", extra: "Nadie recibe. {chofer} espera en playa. Se busca nueva ventana.", story: ["{unidad} llegó a {cliente}", "Planta cerrada / sin reciba", "Avisó a {chofer} y al dador", "Descarga no se hizo"] },
    { id: "direccion-mala", agent: "destinos", kpi: "avisos", tone: "warn", icon: "wrong_location", name: "Dirección incorrecta", brief: "{chofer} no encuentra la planta de {cliente} · la dirección no coincide", line: "Unidad {unidad} · {ruta} · se reenvía pin y se confirma destino", extra: "Pin viejo o calle mal cargada. Se manda ubicación nueva a {chofer}.", story: ["{chofer} no llega a {cliente}", "Dirección de {ruta} no cierra", "Mandó pin nuevo", "Espera confirmación"] },
    { id: "gps-caido", agent: "tracking", kpi: "etas", tone: "warn", icon: "location_off", name: "GPS caído", brief: "Se perdió el GPS de {unidad} · última posición en {ruta}", line: "{chofer} · {carga} a {cliente} · se pidió foto de posición por WhatsApp", extra: "Sin señal hace {min} min. Se contactó a {chofer} para causa y foto.", story: ["GPS de {unidad} se cayó", "Última posición en {ruta}", "WhatsApp a {chofer}", "Espera foto de posición"] },
    { id: "descarga-lenta", agent: "pod", kpi: "pods", tone: "warn", icon: "hourglass_bottom", name: "Descarga lenta", brief: "{unidad} lleva {min} min en la descarga de {cliente}", line: "{chofer} en playa · {bultos} bultos de {carga} · {viaje}", extra: "Playa congestionada. Todavía no hay firma. Se sigue el turno de {receptor}.", story: ["{unidad} en playa de {cliente}", "Descarga lenta de {carga}", "Pidió estado a {chofer}", "Sigue en playa {min} min"] },
    { id: "fuera-horario", agent: "eta", kpi: "avisos", tone: "warn", icon: "event_busy", name: "Fuera de horario", brief: "{unidad} llegó fuera de horario a {cliente} · cupo ya cerrado", line: "{chofer} · {ruta} · se pide ventana de excepción", extra: "Llegó a las {hora}. {cliente} puede no recibir. Se gestiona excepción.", story: ["{unidad} llegó tarde a {cliente}", "Cupo de planta cerrado", "Pidió excepción", "A la espera de {cliente}"] },
    { id: "desvio", agent: "tracking", kpi: "etas", tone: "warn", icon: "alt_route", name: "Desvío de ruta", brief: "{chofer} se desvió de {ruta} · {unidad} está fuera de recorrido", line: "{carga} a {cliente} · se pidió causa y se recálcula arribo {hora}", extra: "Fuera de corredor. Puede ser atajo o error. Se espera parte de {chofer}.", story: ["{unidad} salió de {ruta}", "Desvío detectado", "WhatsApp a {chofer}", "Se recálcula arribo {hora}"] },
    { id: "lluvia", agent: "eta", kpi: "etas", tone: "warn", icon: "rainy", name: "Lluvia fuerte", brief: "Lluvia fuerte sobre {ruta} · {unidad} reduce velocidad", line: "{chofer} · {carga} a {cliente} · arribo {hora} · margen corto", extra: "Calzada pesada. Se recálcula {hora}. Si sigue, pasa a retraso.", story: ["Lluvia sobre {ruta}", "{unidad} más lenta", "Nuevo arribo {hora}", "Hay que seguirla"] },
    { id: "sin-turno", agent: "eta", kpi: "avisos", tone: "warn", icon: "event_repeat", name: "Sin turno de descarga", brief: "{cliente} no tiene turno de descarga para {unidad} de {chofer}", line: "{carga} · {bultos} bultos · se está pidiendo cupo · {viaje}", extra: "Llegó sin turno. Playón de espera. Se gestiona ventana con {cliente}.", story: ["{unidad} en {cliente} sin turno", "Playón de espera", "Pidió cupo", "A la espera de planta"] },
    { id: "chofer-ok-pos", agent: "tracking", kpi: "choferes", tone: "ok", icon: "add_a_photo", name: "Foto de posición", brief: "{chofer} mandó foto de posición · {unidad} en {ruta} hacia {cliente}", line: "{carga} · arribo {hora} · viaje {viaje} · va en tiempo", extra: "Foto y parte ok. {bultos} bultos. Sin desvío.", story: ["Se pidió posición", "Foto de {chofer} en {ruta}", "Cruzó vs GPS", "Va en tiempo a {cliente}"] },
    { id: "descarga-ok", agent: "pod", kpi: "pods", tone: "done", icon: "inventory", name: "Descarga terminada", brief: "Descarga terminada en {cliente} sin demora · {bultos} bultos", line: "{chofer} · {unidad} · remito {remito} · recibió {receptor} a las {hora}", extra: "Sin novedad. {carga} completa. {unidad} libera playa.", story: ["{unidad} en descarga", "{receptor} recibió {bultos} bultos", "Cerró remito {remito}", "Descarga sin novedad"] },
    { id: "posicion-ok", agent: "tracking", kpi: "etas", tone: "ok", icon: "my_location", name: "Posición actualizada", brief: "Se actualizó la posición de {unidad} · {chofer} va por {ruta}", line: "{carga} a {cliente} · arribo {hora} · {viaje} en tiempo", extra: "Punto fresco. Velocidad coherente. Sin alerta.", story: ["Nuevo punto de {unidad}", "Ruta {ruta} coherente", "Arribo {hora}", "Tracking al día"] },
    { id: "com-wa-tsb", agent: "comunicacion", kpi: "conciliadas", tone: "ok", icon: "sms", name: "Recordatorio WhatsApp", brief: "WhatsApp a TSB Logística S.A.: recordatorio A-0003-00018421 vencida · saldo $ 1.482.500", line: "Canal WhatsApp · el paso queda en el historial de la factura", extra: "Agente de Comunicación arma el mensaje y lo registra en CxC. No contacta proveedores de CxP.", story: ["A-0003-00018421 vencida", "Armó el WhatsApp a TSB", "Envió el recordatorio", "Paso asentado en la factura"] },
    { id: "conc-andes", agent: "conciliacion", kpi: "conciliadas", tone: "done", icon: "account_balance", name: "Cobro total conciliado", brief: "Conciliación cerró A-0002-00005501 de Andes Cargo SRL · cobro total $ 540.000", line: "Factura al día · no se concilian facturas a pagar acá", extra: "Match contra ingreso. CxC saldada.", story: ["Entró el cobro de Andes", "Cruce vs A-0002-00005501", "Match total", "Factura al día"] },
    { id: "cxc-emitida", agent: "facturas-cobro", kpi: "conciliadas", tone: "ok", icon: "receipt", name: "Alta en cartera CxC", brief: "Cartera CxC: {factura} de {cliente} por {importe} · entra desde ERP / Excel", line: "Historial de contactos vacío · distinta de la gestión de cobranza", extra: "Facturas de cobranza arma la cartera. No dispara WhatsApp: eso es Gestión de cobranza.", story: ["ERP / Excel de {cliente}", "Alta {factura}", "Importe {importe}", "Cartera actualizada"] },
    { id: "cxp-cargar", agent: "facturas", kpi: "ocr", tone: "ok", icon: "upload_file", name: "Cargar factura OCR", brief: "CxP: cargó factura de {proveedor} por WhatsApp / email · OCR en curso", line: "{importe} · digitalizar y empujar al ERP", extra: "Cuentas por pagar. No se concilia acá ni se contacta al dador.", story: ["Entró PDF de {proveedor}", "OCR leyendo CUIT y total", "{importe}", "Queda en sistema"] },
    { id: "resumen-dadores", agent: "marketing", tone: "done", icon: "campaign", name: "Campaña a dadores", brief: "Planificador armó la pieza de cierre para dadores: arribos, demoras y entregas", line: "Incluye {cliente} y el resto de la flota · cierre operativo", extra: "Pieza con arribos a tiempo, unidades con demora y entregas verificadas para {cliente} y el resto.", story: ["Cierre del día", "Armó arribos y demoras", "Diseñó la pieza", "Campaña lista para dadores"] },
    { id: "promesa-tsb", agent: "cobranzas", kpi: "conciliadas", tone: "ok", icon: "handshake", name: "Promesa de pago", brief: "TSB Logística S.A. prometió pagar hoy A-0003-00018421 · saldo $ 1.482.500", line: "Gestión de cobranza · queda en seguimiento hasta conciliar", extra: "Promesa vigente (mesa). Distinto de la cartera CxC.", story: ["A-0003-00018421 vencida", "WhatsApp de TSB", "Registró promesa para hoy", "Cobro en seguimiento"] },
    { id: "sla-dia", agent: "analitica", kpi: "etas", tone: "ok", icon: "monitoring", name: "Performance del día", brief: "Analítica midió OTIF del día: demoras, entregas y reclamos de {cliente}", line: "Flota en {ruta} · {viaje} y el resto de la operación", extra: "Tablero actualizado. Se marcan unidades con demora y entregas verificadas.", story: ["Cierre de indicadores", "Cruzó demoras y entregas", "OTIF de {cliente}", "Tablero al día"] },
    { id: "mail-dadores", agent: "marketing-email", tone: "done", icon: "mail", name: "Mail a dadores", brief: "Email Marketing despachó el resumen del día a los dadores, incluido {cliente}", line: "Arribos, demoras y entregas verificadas · cierre operativo", extra: "Borrador aprobado y enviado. Incluye flota y {viaje}.", story: ["Cierre del día", "Armó el mail", "Incluyó a {cliente}", "Mail despachado"] },
    { id: "nota-operacion", agent: "teo", tone: "done", icon: "article", name: "Nota de operación", brief: "Contenidos publicó la nota del día: entregas de {cliente} y demoras de ruta", line: "Pieza para web y redes · flota y dadores", extra: "Texto a partir de novedades reales de la torre.", story: ["Novedades del día", "Redactó la nota", "Publicó en web", "Contenido al aire"] },
    { id: "pop-retiro", agent: "pod", kpi: "pods", tone: "ok", icon: "photo_camera", name: "POP de retiro", brief: "POP de retiro: {chofer} mandó fotos de la carga en {planta}", line: "{bultos} bultos de {carga} para {cliente} · unidad {unidad} · {viaje}", extra: "Fotos de origen por WhatsApp. Falta el OK de mesa para que el viaje pase a tránsito.", story: ["{chofer} en origen {planta}", "Fotos de {bultos} bultos", "Armó el POP de {viaje}", "POP cargado · falta aprobación"] },
    { id: "pop-aprobado", agent: "pod", kpi: "pods", tone: "done", icon: "verified", name: "POP aprobado", brief: "POP aprobado en {planta}: {bultos} bultos de {carga} para {cliente}", line: "{chofer} · {unidad} · remito {remito} · {viaje} puede pasar a tránsito", extra: "Mesa validó cantidades y fotos. Cadena de custodia abierta desde origen.", story: ["Fotos de retiro en {planta}", "Cruzó vs remito {remito}", "Aprobó el POP", "{viaje} en tránsito"] },
    { id: "pop-faltante", agent: "pod", kpi: "pods", tone: "warn", icon: "difference", name: "POP con diferencia", brief: "POP con diferencia en {planta}: faltan {faltan} bultos de {carga} para {cliente}", line: "{chofer} · {unidad} · remito {remito} · {viaje} no sale hasta cerrar el POP", extra: "Las fotos de origen no cierran con el pedido. Mesa pidió recuento antes de transitar.", story: ["Fotos de retiro en {planta}", "Cruce vs pedido de {cliente}", "Faltan {faltan} bultos", "POP en revisión"] },
    { id: "pop-pendiente", agent: "pod", kpi: "pods", tone: "warn", icon: "pending", name: "POP pendiente", brief: "POP pendiente: {chofer} aún no mandó evidencia de retiro en {planta}", line: "{unidad} · {carga} para {cliente} · {viaje} no puede pasar a tránsito", extra: "Sin fotos de origen. Se le pidió el POP por WhatsApp.", story: ["{viaje} sin POP", "{chofer} en {planta}", "Pidió fotos de retiro", "Espera evidencia"] },
    { id: "pod-firma", agent: "pod", kpi: "pods", tone: "done", icon: "draw", name: "POD con firma", brief: "POD con firma de {receptor} en {cliente} · {bultos} bultos de {carga}", line: "{chofer} · {unidad} · remito {remito} · {viaje}", extra: "Foto y firma ok. Cadena de custodia origen → destino cerrada.", story: ["Entrega en {cliente}", "Firma de {receptor}", "Validó el POD", "Entrega cerrada"] },
    { id: "pod-vs-pop", agent: "pod", kpi: "pods", tone: "delay", icon: "compare", name: "POP vs POD", brief: "Diferencia POP vs POD en {viaje}: salieron {bultos} bultos y {cliente} recibió de menos", line: "{chofer} · {unidad} · remito {remito} · {carga} · {faltan} bultos de diferencia", extra: "Cruce origen vs destino. Hay que abrir reclamo o ajustar el remito.", story: ["POP de origen ok", "POD de {cliente} con menos bultos", "Cruzó las evidencias", "Diferencia de {faltan} bultos"] },
    { id: "pod-borroso", agent: "pod", kpi: "pods", tone: "warn", icon: "blur_on", name: "POD ilegible", brief: "POD ilegible: la foto de {chofer} en {cliente} no se lee · se pidió otra", line: "{unidad} · remito {remito} · {bultos} bultos de {carga} · falta evidencia clara", extra: "Firma o remito borrosos. Sin POD válido la entrega queda abierta.", story: ["Llegó foto de POD", "No se lee remito ni firma", "Pidió otra foto a {chofer}", "POD pendiente"] },
    { id: "pod-pendiente", agent: "pod", kpi: "pods", tone: "warn", icon: "fact_check", name: "POD pendiente", brief: "POD pendiente: {unidad} ya está en {cliente} y {chofer} no mandó evidencia", line: "{carga} · {bultos} bultos · remito {remito} · {viaje}", extra: "Tracking marca arribo. Falta foto y firma de {receptor}.", story: ["{unidad} arribó a {cliente}", "No hay POD", "WhatsApp a {chofer}", "Espera foto y firma"] },
    { id: "reclamo-faltante", agent: "reclamos", kpi: "demoras", tone: "delay", icon: "inventory_2", name: "Faltante de carga", brief: "{cliente} reclamó faltante: {faltan} bultos de {carga} en el viaje {viaje}", line: "Reclamo {reclamo} · {chofer} · {unidad} · remito {remito}", extra: "Entró por WhatsApp. Se cruza vs POP y POD. Caso abierto con {cliente}.", story: ["WhatsApp de {cliente}", "Faltan {faltan} bultos", "Abrió {reclamo}", "Caso en seguimiento"] },
    { id: "reclamo-rotura", agent: "reclamos", kpi: "demoras", tone: "delay", icon: "broken_image", name: "Rotura / merma", brief: "{cliente} reclamó rotura de {carga} en el viaje {viaje} · {bultos} bultos", line: "Reclamo {reclamo} · {unidad} de {chofer} · remito {remito}", extra: "Fotos de merma. Se pide POD y parte del chofer para liquidar.", story: ["Reclamo de rotura de {cliente}", "Identificó {viaje} y {unidad}", "Pidió fotos y POD", "{reclamo} abierto"] },
    { id: "reclamo-demora", agent: "reclamos", kpi: "demoras", tone: "warn", icon: "timer", name: "Demora reiterada", brief: "{cliente} reclamó demora reiterada de {unidad} · {chofer} va {min} min tarde", line: "Reclamo {reclamo} · {ruta} · {carga} · viaje {viaje}", extra: "No es el primer atraso. Se abre el caso y se avisa ETA.", story: ["Reclamo de {cliente} por demora", "Cruzó vs {viaje}", "Clasificó criticidad", "{reclamo} en cola"] },
    { id: "reclamo-wa", agent: "reclamos", kpi: "demoras", tone: "warn", icon: "sms", name: "Reclamo por WhatsApp", brief: "Entró reclamo {reclamo} de {cliente} por WhatsApp · viaje {viaje}", line: "{carga} · {unidad} de {chofer} · se está pidiendo remito y fotos", extra: "IA conversó el caso. Falta un dato para clasificar y escalar.", story: ["WhatsApp de {cliente}", "Entendió el caso {viaje}", "Pidió lo que falta", "{reclamo} en clasificación"] },
    { id: "reclamo-resuelto", agent: "reclamos", kpi: "incCerradas", tone: "done", icon: "task_alt", name: "Reclamo cerrado", brief: "Reclamo {reclamo} de {cliente} cerrado · viaje {viaje} resuelto", line: "{carga} · remito {remito} · {unidad} · se avisó al dador", extra: "Backoffice liquidó faltante o demora. Cliente informado.", story: ["{reclamo} en cola", "Cruzó evidencias de {viaje}", "Resolvió con {cliente}", "Reclamo cerrado"] },
    { id: "cxp-ocr", agent: "facturas", kpi: "ocr", tone: "done", icon: "document_scanner", name: "OCR de CxP", brief: "OCR digitalizó la factura de {proveedor} · {importe} · lista para el ERP", line: "Entró por email / WhatsApp / upload · CxP separado de CxC", extra: "Digitalizar y empujar al ERP. Sin carga manual de campos.", story: ["Mail o WhatsApp de {proveedor}", "OCR leyó CUIT y total", "{importe}", "Pendiente de transferir al ERP"] },
    { id: "cxp-erp", agent: "facturas", kpi: "conciliadas", tone: "ok", icon: "output", name: "CxP al ERP", brief: "Factura de {proveedor} transferida al ERP · {importe}", line: "Estado confirmada · cuentas por pagar", extra: "El pago queda en el circuito del ERP. Conciliación no toma CxP.", story: ["Factura digitalizada", "Controló CUIT de {proveedor}", "Empujó al ERP", "CxP confirmada"] },
    { id: "cxp-ilegible", agent: "facturas", kpi: "ocr", tone: "warn", icon: "scan_delete", name: "OCR sin CUIT", brief: "OCR no leyó CUIT ni total de {proveedor} · se pidió el PDF de nuevo", line: "CxP queda pendiente de confirmar", extra: "Discrepancia de lectura. No se empuja al ERP hasta cerrar los campos.", story: ["Entró factura de {proveedor}", "OCR no cerró el total", "Pidió el archivo", "CxP en espera"] },
    { id: "cxc-import", agent: "facturas-cobro", kpi: "conciliadas", tone: "ok", icon: "upload_file", name: "Importar ERP / Excel", brief: "Importó cartera CxC desde ERP / Excel · {cliente} · {factura} {importe}", line: "Alta de cartera + historial por factura", extra: "Facturas de cobranza. No gestiona reclamos ni WhatsApp.", story: ["Archivo ERP de {cliente}", "Alta {factura}", "Cartera {importe}", "Historial abierto"] },
    { id: "cxc-tsb", agent: "facturas-cobro", kpi: "conciliadas", tone: "warn", icon: "event_busy", name: "CxC vencida", brief: "Cartera CxC: A-0003-00018421 de TSB Logística S.A. vencida · saldo $ 1.482.500", line: "También vence MYE B-0008-00004410 · se deriva a cobranza y comunicación", extra: "La cartera marca vencido. El WhatsApp lo dispara Gestión de cobranza / Comunicación.", story: ["Venció A-0003-00018421", "Saldo $ 1.482.500", "Marcó vencida en CxC", "Pasa a cobranza"] },
    { id: "cxc-historial", agent: "facturas-cobro", kpi: "conciliadas", tone: "ok", icon: "history", name: "Historial por factura", brief: "Historial de {factura} de {cliente}: contactos, promesas y pasos de mesa", line: "CxC muestra la línea de tiempo · no dispara el mensaje", extra: "Pasos visibles factura por factura.", story: ["Abrió {factura}", "Leyó contactos de {cliente}", "Hay gestiones previas", "Historial al día"] },
    { id: "cobro-wa", agent: "cobranzas", kpi: "conciliadas", tone: "ok", icon: "sms", name: "Disparo WhatsApp", brief: "Gestión de cobranza disparó WhatsApp a {cliente} por {factura} · {importe}", line: "Reclamo operativo · queda en el historial de la factura", extra: "Toma la cartera CxC y dispara. Distinto de Facturas de cobranza.", story: ["Tomó {factura} de la cartera", "Armó el WhatsApp", "Contactó a {cliente}", "Reclamo activo"] },
    { id: "cobro-debin", agent: "cobranzas", kpi: "conciliadas", tone: "ok", icon: "qr_code", name: "Link DEBIN", brief: "Generó link DEBIN / QR a {cliente} por {factura} · {importe}", line: "Promesa o intimación con botón de pago", extra: "Demo de cobranza. No cobra en banco real.", story: ["{factura} a cobrar", "Armó el DEBIN", "Se lo mandó a {cliente}", "Link en el historial"] },
    { id: "cobro-caida", agent: "cobranzas", kpi: "conciliadas", tone: "delay", icon: "money_off", name: "Promesa caída", brief: "Promesa de {cliente} por {factura} no se acreditó · saldo {importe}", line: "Se reabre el reclamo de cobro", extra: "Vuelve a la cola de Gestión de cobranza.", story: ["Promesa de {cliente}", "No entró el cobro", "Reabrió el reclamo", "Cobro atrasado"] },
    { id: "com-beraldi", agent: "comunicacion", kpi: "conciliadas", tone: "warn", icon: "call", name: "Por contactar", brief: "Por contactar: Beraldi Transportes A-0001-00009012 y MYE Cargas B-0008-00004410", line: "WhatsApp, email o llamada · cada contacto es un paso en la factura", extra: "No contacta proveedores de CxP.", story: ["Cartera con vencidas", "Beraldi y MYE sin aviso", "Arma el mensaje", "Contacto pendiente"] },
    { id: "com-respuesta", agent: "comunicacion", kpi: "conciliadas", tone: "ok", icon: "mark_chat_read", name: "Respuesta del dador", brief: "TSB preguntó por POD y transferencia parcial de A-0003-00018421 · mesa respondió por WhatsApp", line: "El hilo queda en el historial de la factura", extra: "Comunicación registra in y out. Cobranza sigue la promesa.", story: ["WhatsApp de TSB", "Pidió POD y parcial", "Mesa respondió", "Paso en A-0003-00018421"] },
    { id: "conc-mye", agent: "conciliacion", kpi: "conciliadas", tone: "warn", icon: "link_off", name: "Pendiente de imputar", brief: "Pasarela PAS-MYE-4410 avisó $ 312.400 de MYE Cargas · B-0008-00004410 sin imputar", line: "IA propone el match · queda en revisión", extra: "Solo API de pasarela. Las facturas a pagar no se concilian acá.", story: ["Aviso PAS-MYE-4410", "Cruce vs B-0008-00004410", "No cerró la imputación", "Pendiente de imputar"] },
    { id: "conc-parcial", agent: "conciliacion", kpi: "conciliadas", tone: "ok", icon: "payments", name: "Cobro parcial", brief: "Imputó $ 120.000 a MYE Cargas B-0008-00004410 · saldo $ 192.400", line: "COB-SYS-0001 · estado parcial", extra: "Match parcial. Sigue pendiente el resto.", story: ["Cobro de pasarela", "Aplicó $ 120.000", "Saldo $ 192.400", "MYE en parcial"] },
    { id: "conc-discrepancia", agent: "conciliacion", kpi: "conciliadas", tone: "delay", icon: "report", name: "Discrepancia", brief: "Marcó discrepancia en conciliación · {factura} de {cliente} · {importe}", line: "No matchea referencia de pasarela · revisión de mesa", extra: "Avisar a cobranza. Extracto bancario es riel futuro.", story: ["Movimiento vs {factura}", "Referencia no cierra", "Marcó discrepancia", "Revisión de mesa"] },
    { id: "rend-llanta", agent: "rendicion", kpi: "conciliadas", tone: "ok", icon: "tire_repair", name: "Comprobante de llanta", brief: "{chofer} mandó el comprobante de llanta de {unidad} · viaje {viaje}", line: "{ruta} · {cliente} · queda pendiente de aprobación", extra: "Foto por WhatsApp. Rendición lo clasificó y lo deja en cola humana.", story: ["Foto del gasto de {chofer}", "Clasificó llanta", "Dejó {viaje} en aprobación", "Rendición pendiente"] },
    { id: "alerta-otif", agent: "analitica", kpi: "etas", tone: "warn", icon: "analytics", name: "Alerta de OTIF", brief: "Analítica marcó caída de OTIF en {cliente} · demoras en {ruta}", line: "Viaje {viaje} y el resto de la flota · hay que mirar incidencias", extra: "Patrón de atraso. Tablero actualizado para mesa.", story: ["Cruzó demoras del día", "OTIF de {cliente} abajo", "Generó la alerta", "Tablero con desvío"] },
    { id: "rankear-radar", agent: "rankear", tone: "ok", icon: "travel_explore", name: "Radar de visibilidad", brief: "Rankear detectó búsquedas de tracking y ETA ligadas a {cliente}", line: "Compara presencia vs competencia · alimenta al planificador", extra: "Radar de marca. Pasa la señal a campañas y contenidos.", story: ["Monitoreó Google", "Vio demanda de {cliente}", "Marcó la oportunidad", "Radar actualizado"] },
    { id: "promo-ventana", agent: "marketing-offers", tone: "done", icon: "sell", name: "Promoción de ventana", brief: "Promociones armó una oferta de ventana de descarga para {cliente}", line: "Vigencia y condiciones listas · canal web y mail", extra: "Pieza de promoción operativa. Precio y cupo controlados.", story: ["Pedido de {cliente}", "Armó la promoción", "Fijó vigencia", "Oferta publicada"] },
    { id: "mencion-medio", agent: "growth", tone: "ok", icon: "newspaper", name: "Mención en medio", brief: "Menciones encontró un medio para posicionar la operación con {cliente}", line: "Directorio / blog logístico · propuesta de contacto lista", extra: "Alianza o mención. Queda el borrador para enviar.", story: ["Buscó medios del rubro", "Encajó con {cliente}", "Armó la propuesta", "Contacto listo"] },
    { id: "mkt-resultados", agent: "marketing-analytics", tone: "ok", icon: "ssid_chart", name: "Resultado de campaña", brief: "Analítica midió la campaña a dadores: apertura y clics de {cliente}", line: "Recomienda ajustar el mensaje de arribos y demoras", extra: "Desempeño de la pieza. Pasa el ajuste al planificador.", story: ["Levantó la campaña", "Midió a {cliente}", "Vio apertura y clics", "Ajuste recomendado"] },
  ];

  var TONE = {
    ok: { label: "En curso", text: "text-emerald-700" },
    done: { label: "Sin novedad", text: "text-emerald-700" },
    warn: { label: "Atención", text: "text-amber-700" },
    delay: { label: "Retraso", text: "text-rose-700" },
  };

  function iconMark(name) {
    var lig = String(name || "local_shipping").replace(/[^a-z0-9_]/gi, "") || "local_shipping";
    return '<span class="material-symbols-outlined" aria-hidden="true">' + lig + "</span>";
  }

  var jobs = [];
  var nextId = 1;
  var nextViaje = 24890;
  var expandedId = null;
  var paused = false;
  var feedEl = null;
  var featured = null;
  var stats = {
    avisos: 41,
    etas: 18,
    pods: 27,
    ocr: 65,
    choferes: 39,
    incCerradas: 9,
    demoras: 4,
    conciliadas: 6,
    incidencias: 7,
  };

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function agentById(id) {
    for (var i = 0; i < AGENTS.length; i++) if (AGENTS[i].id === id) return AGENTS[i];
    return AGENTS[0];
  }

  function pickMod() {
    var r = Math.random();
    if (r < 0.68) return "log";
    if (r < 0.93) return "fin";
    return "mkt";
  }

  function pickProcess(mod, tone, agentId) {
    function okTone(p) {
      var t = p.tone || "ok";
      if (!tone) return true;
      if (tone === "green") return t === "ok" || t === "done";
      return t === tone;
    }
    function matchAgent(p) {
      if (agentId) return p.agent === agentId;
      if (!mod) return true;
      return agentById(p.agent).mod === mod;
    }
    var pool = PROCESSES.filter(function (p) {
      return matchAgent(p) && okTone(p);
    });
    if (!pool.length) pool = PROCESSES.filter(matchAgent);
    if (!pool.length) pool = PROCESSES.filter(okTone);
    return pick(pool.length ? pool : PROCESSES);
  }

  function neededTone() {
    var delay = 0;
    var warn = 0;
    var green = 0;
    jobs.forEach(function (j) {
      var t = toneOf(j);
      if (t === "delay") delay++;
      else if (t === "warn") warn++;
      else green++;
    });
    if (delay < 3) return "delay";
    if (warn < 4) return "warn";
    if (green < 4) return "green";
    var r = Math.random();
    if (r < 0.3) return "delay";
    if (r < 0.62) return "warn";
    return "green";
  }

  function fill(tpl, ctx) {
    return tpl.replace(/\{(\w+)\}/g, function (_, k) {
      return ctx[k] == null ? "" : ctx[k];
    });
  }

  function nowTime() {
    try {
      return new Date().toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "America/Argentina/Buenos_Aires",
      });
    } catch (e) {
      return "";
    }
  }

  function clockIn(min) {
    try {
      var d = new Date();
      d.setMinutes(d.getMinutes() + (min || 0));
      return d.toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "America/Argentina/Buenos_Aires",
      });
    } catch (e) {
      return "";
    }
  }

  function toneOf(job) {
    if (job && job.tone) return job.tone;
    var delayMin = typeof job === "number" ? job : (job && job.delayMin) || 0;
    if (delayMin >= 16) return "delay";
    if (delayMin >= 5) return "warn";
    return "ok";
  }

  function processById(id) {
    if (!id) return null;
    for (var i = 0; i < PROCESSES.length; i++) if (PROCESSES[i].id === id) return PROCESSES[i];
    return null;
  }

  function makeJob(isSeed, forcedMod, forcedTone, forcedAgent, forcedProc) {
    var toneWanted = forcedTone || neededTone();
    var mod = forcedAgent || forcedProc ? null : (forcedMod || pickMod());
    var proc = processById(forcedProc) || pickProcess(mod, toneWanted, forcedAgent);
    var agent = agentById(proc.agent);
    var tone = proc.tone || "ok";
    var delayMin = 0;
    if (tone === "warn") delayMin = 6 + Math.floor(Math.random() * 9);
    if (tone === "delay") delayMin = 18 + Math.floor(Math.random() * 28);
    var ctx = {
      viaje: "VJ-" + nextViaje++,
      remito: "R-00" + (48200 + Math.floor(Math.random() * 80)),
      inc: "INC-" + (3380 + Math.floor(Math.random() * 40)),
      reclamo: "RC-" + (1100 + Math.floor(Math.random() * 90)),
      factura: "FC-" + (44000 + Math.floor(Math.random() * 200)),
      cliente: pick(CLIENTS),
      proveedor: pick(PROVEEDORES),
      pasarela: "PAS-MYE-4410",
      saldo: "$ 192.400",
      chofer: pick(DRIVERS),
      ruta: pick(ROUTES),
      unidad: pick(UNITS),
      carga: pick(CARGAS),
      planta: pick(PLANTAS),
      min: String(delayMin || 12 + Math.floor(Math.random() * 20)),
      bultos: String(8 + Math.floor(Math.random() * 36)),
      faltan: String(1 + Math.floor(Math.random() * 6)),
      importe: "$ " + Number(180000 + Math.floor(Math.random() * 920000)).toLocaleString("es-AR"),
      hora: clockIn(tone === "delay" ? delayMin : tone === "warn" ? delayMin : 25 + Math.floor(Math.random() * 50)),
      receptor: pick(RECEPTORES),
    };
    if (agent.mod === "fin") {
      ctx.cliente = pick(FIN_DADORES);
      ctx.factura = pick(FIN_FACTURAS);
      ctx.importe = pick(FIN_IMPORTES);
    }
    return {
      id: nextId++,
      proc: proc,
      agent: agent,
      ctx: ctx,
      tone: tone,
      brief: fill(proc.brief, ctx),
      detail: fill(proc.line || "", ctx),
      extra: fill(proc.extra, ctx),
      progress: tone === "done" ? 100 : 55 + Math.floor(Math.random() * 41),
      delayMin: delayMin,
      fresh: !isSeed,
      time: nowTime(),
      story: (proc.story || []).map(function (s) {
        return fill(s, ctx);
      }),
    };
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function counts() {
    var delay = 0;
    var warn = 0;
    var ok = 0;
    jobs.forEach(function (j) {
      var t = toneOf(j);
      if (t === "delay") delay++;
      else if (t === "warn") warn++;
      else ok++;
    });
    return { delay: delay, warn: warn, n: ok };
  }

  function fmtN(n, d) {
    return Number(n).toLocaleString("es-AR", {
      minimumFractionDigits: d || 0,
      maximumFractionDigits: d || 0,
    });
  }

  function setTxt(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  var KPI_IDS = {
    avisos: "kpi-avisos",
    etas: "kpi-etas",
    pods: "kpi-pods",
    ocr: "kpi-ocr",
    choferes: "kpi-choferes",
    incCerradas: "kpi-inc-cerradas",
    demoras: "kpi-demoras",
    conciliadas: "kpi-conciliadas",
  };

  function tickTile(key) {
    var tile = document.querySelector('.kpi-tile[data-kpi="' + key + '"]');
    if (!tile) return;
    tile.classList.remove("is-tick");
    void tile.offsetWidth;
    tile.classList.add("is-tick");
    clearTimeout(tile._tickT);
    tile._tickT = setTimeout(function () {
      tile.classList.remove("is-tick");
    }, 700);
  }

  function paintMetrics(changed) {
    Object.keys(KPI_IDS).forEach(function (key) {
      setTxt(KPI_IDS[key], fmtN(stats[key]));
    });
    setTxt("kpi-inc-abiertas", String(stats.incidencias));
    if (changed) {
      Object.keys(changed).forEach(function (key) {
        if (changed[key]) tickTile(key);
      });
    }
  }

  function paintStory(job) {
    if (!job) return;
    featured = job;
    setTxt("story-agent", job.agent.name);
    setTxt("story-task", job.brief);
    var steps = job.story && job.story.length === 4 ? job.story : [job.brief, job.proc.name, job.agent.name, job.extra];
    setTxt("story-observo", steps[0]);
    setTxt("story-analizo", steps[1]);
    setTxt("story-actuo", steps[2]);
    setTxt("story-resultado", steps[3]);
    var icon = document.getElementById("story-icon");
    if (icon) {
      icon.innerHTML = iconMark(job.proc.icon);
    }
    var foco = document.getElementById("story-foco");
    if (foco) {
      var st = toneOf(job);
      var meta = TONE[st] || TONE.ok;
      foco.className = "sol-foco " + st;
      foco.setAttribute("title", meta.label);
    }
    try {
      setTxt(
        "story-time",
        new Date().toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "America/Argentina/Buenos_Aires",
        })
      );
    } catch (e) {}
  }

  function applyEffect(job) {
    var tone = toneOf(job);
    var key = job.proc.kpi;
    var changed = {};
    function bump(k, n) {
      if (!k || stats[k] == null) return;
      var next = stats[k] + (n || 1);
      if (k === "demoras") next = Math.max(0, Math.min(18, next));
      if (k === "incidencias") next = Math.max(2, Math.min(14, next));
      if (next === stats[k]) return;
      stats[k] = next;
      changed[k] = true;
    }
    if (key === "demoras") {
      if (tone === "ok" || tone === "done") {
        bump("incCerradas", 1);
        bump("demoras", -1);
        bump("incidencias", -1);
      } else {
        bump("demoras", 1);
        bump("incidencias", 1);
      }
    } else if (key) {
      bump(key, 1);
      if (job.proc.kpi2) bump(job.proc.kpi2, 1);
    }
    paintMetrics(changed);
  }

  function render() {
    if (!feedEl) return;
    var html = jobs
      .map(function (job) {
        var tone = toneOf(job);
        var meta = TONE[tone] || TONE.ok;
        var open = expandedId === job.id;
        var delayLine =
          tone === "delay"
            ? "Lleva " + job.delayMin + " min de retraso."
            : tone === "warn"
            ? "Va " + job.delayMin + " min más justo de lo previsto."
            : "Va en tiempo.";
        return (
          '<article class="board-job' +
          (job.fresh ? " is-new" : "") +
          (open ? " is-open" : "") +
          '" data-id="' +
          job.id +
          '" data-tone="' +
          tone +
          '">' +
          '<button type="button" class="board-row" aria-expanded="' +
          (open ? "true" : "false") +
          '">' +
          '<div class="flex items-start gap-3 min-w-0">' +
          '<span class="sol-ico-wrap">' +
          '<span class="sol-ico">' +
          iconMark(job.proc.icon) +
          "</span>" +
          '<span class="sol-foco ' +
          tone +
          '" title="' +
          esc(meta.label) +
          '"></span>' +
          "</span>" +
          '<div class="min-w-0">' +
          '<p class="text-[14px] leading-tight text-slate-900 font-extrabold tracking-tight truncate">' +
          esc(job.agent.name) +
          "</p>" +
          '<p class="mt-0.5 text-[12px] text-slate-500 font-medium">' +
          esc(job.brief) +
          "</p>" +
          (job.detail
            ? '<p class="mt-0.5 text-[11px] text-slate-400 font-medium">' + esc(job.detail) + "</p>"
            : "") +
          "</div></div>" +
          '<div><span class="board-pill ' +
          tone +
          '">' +
          esc(meta.label) +
          "</span></div>" +
          '<div class="text-right text-[12px] tabular-nums text-slate-400 whitespace-nowrap">' +
          esc(job.time || "") +
          "</div>" +
          "</button>" +
          (open
            ? '<div class="px-3 pb-3 pl-[68px] text-[12px] text-slate-600 leading-relaxed">' +
              "<p>" +
              esc(job.extra) +
              "</p>" +
              '<p class="mt-1 font-medium ' +
              meta.text +
              '">' +
              delayLine +
              "</p>" +
              "</div>"
            : "") +
          "</article>"
        );
      })
      .join("");
    var keepScroll = feedEl.scrollTop;
    feedEl.innerHTML = html;
    feedEl.scrollTop = keepScroll;

    var c = counts();
    var elN = document.getElementById("sol-board-n");
    var elDelay = document.getElementById("sol-board-delay");
    var elWarn = document.getElementById("sol-board-warn");
    if (elN) elN.textContent = String(c.n);
    if (elDelay) elDelay.textContent = String(c.delay);
    if (elWarn) elWarn.textContent = String(c.warn);
  }

  function leastSeenAgent() {
    var counts = {};
    AGENTS.forEach(function (a) {
      counts[a.id] = 0;
    });
    jobs.forEach(function (j) {
      if (j.agent && counts[j.agent.id] != null) counts[j.agent.id]++;
    });
    var min = Infinity;
    var id = AGENTS[0].id;
    AGENTS.forEach(function (a) {
      if (counts[a.id] < min) {
        min = counts[a.id];
        id = a.id;
      }
    });
    return id;
  }

  function setPaused(next) {
    paused = !!next;
    var chip = document.getElementById("sol-board-live");
    if (!chip) return;
    if (paused) {
      chip.className =
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 text-[11px] font-semibold";
      chip.innerHTML =
        '<span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Pausado';
      chip.setAttribute("title", "Click para seguir en vivo");
    } else {
      chip.className =
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold";
      chip.innerHTML =
        '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> En vivo';
      chip.setAttribute("title", "En vivo");
    }
  }

  function insert() {
    if (paused) return;
    jobs.forEach(function (job) {
      job.fresh = false;
    });
    var job = makeJob(false, null, neededTone(), leastSeenAgent());
    jobs = [job].concat(jobs).slice(0, VISIBLE);
    applyEffect(job);
    paintStory(job);
    render();
  }

  function pinJob(id) {
    expandedId = id;
    setPaused(true);
    for (var i = 0; i < jobs.length; i++) {
      if (jobs[i].id === expandedId) {
        paintStory(jobs[i]);
        break;
      }
    }
  }

  function onClick(e) {
    var btn = e.target.closest(".board-row");
    if (!btn) return;
    var art = btn.closest(".board-job");
    if (!art) return;
    var id = Number(art.getAttribute("data-id"));
    if (expandedId === id) {
      expandedId = null;
      setPaused(false);
    } else {
      pinJob(id);
    }
    render();
  }

  function paintClock() {
    var el = document.getElementById("sol-torre-fecha");
    if (!el) return;
    try {
      el.textContent = new Date().toLocaleString("es-AR", {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Argentina/Buenos_Aires",
      });
    } catch (err) {
      el.textContent = new Date().toISOString().slice(0, 16);
    }
  }

  var FLEET = [
    { id: "VJ-24817", unidad: "AD 392 CD", chofer: "F. Ledesma", ruta: "Córdoba → CABA", lat: -31.42, lng: -64.18, estado: "en_curso" },
    { id: "VJ-24836", unidad: "AE 184 BK", chofer: "W. Benítez", ruta: "Rosario → CABA", lat: -32.94, lng: -60.65, estado: "en_curso" },
    { id: "VJ-24829", unidad: "AB 771 LM", chofer: "C. Páez", ruta: "CABA → Mar del Plata", lat: -34.6, lng: -58.38, estado: "en_curso" },
    { id: "VJ-24831", unidad: "AC 905 TR", chofer: "S. Ferreyra", ruta: "Mendoza → Córdoba", lat: -32.89, lng: -68.84, estado: "detenido" },
    { id: "VJ-24842", unidad: "AF 228 QW", chofer: "P. Cardozo", ruta: "Bahía Blanca → Neuquén", lat: -38.72, lng: -62.27, estado: "en_curso" },
    { id: "VJ-24820", unidad: "AA 441 HS", chofer: "M. Ojeda", ruta: "Zárate → Mar del Plata", lat: -34.1, lng: -59.03, estado: "detenido" },
    { id: "VJ-24863", unidad: "AG 016 NP", chofer: "G. Leiva", ruta: "Santa Fe → CABA", lat: -31.63, lng: -60.7, estado: "en_curso" },
    { id: "VJ-24875", unidad: "AH 673 FZ", chofer: "M. Aguirre", ruta: "Campana → Pilar", lat: -34.46, lng: -58.91, estado: "en_curso" },
    { id: "VJ-24881", unidad: "AJ 259 KR", chofer: "H. Maldonado", ruta: "Córdoba → Mendoza", lat: -33.3, lng: -66.3, estado: "en_curso" },
  ];

  function mountMap() {
    var el = document.getElementById("sol-board-map");
    if (!el || !window.L) return;
    var map = window.L.map(el, { zoomControl: false, attributionControl: false, dragging: true, scrollWheelZoom: false });
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 12 }).addTo(map);
    var bounds = [];
    FLEET.forEach(function (t) {
      var color = t.estado === "detenido" ? "#f43f5e" : "#2563eb";
      var m = window.L.circleMarker([t.lat, t.lng], {
        radius: 6,
        color: "#fff",
        weight: 1.5,
        fillColor: color,
        fillOpacity: 1,
      }).addTo(map);
      m.bindTooltip(t.unidad + " · " + t.chofer + " · " + t.ruta, { direction: "top", opacity: 0.9 });
      bounds.push([t.lat, t.lng]);
    });
    if (bounds.length) map.fitBounds(bounds, { padding: [28, 28] });
    setTimeout(function () {
      map.invalidateSize();
    }, 200);
  }

  function loadLeaflet() {
    if (window.L) {
      mountMap();
      return;
    }
    if (!document.querySelector("link[data-sol-board-leaflet]")) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.setAttribute("data-sol-board-leaflet", "1");
      document.head.appendChild(link);
    }
    var s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.async = true;
    s.onload = mountMap;
    document.head.appendChild(s);
  }

  function mount() {
    feedEl = document.getElementById("sol-board-feed");
    var badge = document.getElementById("sol-torre-agentes-online");
    if (badge) badge.textContent = AGENTS.length + " agentes en línea";
    paintClock();
    setInterval(paintClock, 30000);
    jobs = [];
    var seedPlan = [
      ["log", "ok", "viajes", "chofer-confirma"],
      ["log", "delay", "incidencias", "pinchazo"],
      ["log", "delay", "eta", "arribo-tarde"],
      ["log", "delay", "pod", "pod-vs-pop"],
      ["log", "delay", "reclamos", "reclamo-faltante"],
      ["log", "done", "remitos", "remito-enviado"],
      ["log", "warn", "tracking", "desvio"],
      ["fin", "ok", "facturas", "cxp-ocr"],
      ["fin", "warn", "facturas-cobro", "cxc-tsb"],
      ["fin", "ok", "cobranzas", "promesa-tsb"],
      ["fin", "warn", "conciliacion", "conc-mye"],
      ["fin", "ok", "comunicacion", "com-wa-tsb"],
    ];
    for (var i = 0; i < VISIBLE; i++) {
      jobs.push(makeJob(true, seedPlan[i][0], seedPlan[i][1], seedPlan[i][2], seedPlan[i][3]));
    }
    if (feedEl) {
      feedEl.addEventListener("click", onClick);
      var liveBtn = document.getElementById("sol-board-live");
      if (liveBtn) {
        liveBtn.addEventListener("click", function () {
          if (!paused) return;
          expandedId = null;
          setPaused(false);
          render();
        });
      }
      render();
      paintMetrics();
      paintStory(jobs[0]);
      setInterval(insert, INSERT_MS);
    }
    if (document.getElementById("sol-board-map")) loadLeaflet();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
