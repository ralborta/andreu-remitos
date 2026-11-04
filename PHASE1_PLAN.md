# FASE 1: Data Trust - Plan de Implementación

## Objetivo
Establecer confianza en los datos mostrando información consistente y precisa en toda la aplicación.

## Prioridades

### 1. Formatos Consistentes es-AR (Quick Wins)
- **Números**: Punto separador miles, coma decimal → `1.234,56`
- **Moneda**: `$1.234.567,00` (siempre 2 decimales)
- **Toneladas**: `1,8 t` (1 decimal)
- **Fechas**: `dd/mm/aaaa` o formato largo español
- **Horas**: formato 24h `14:30`

**Archivos**:
- Crear `frontend/public/stitch/redesign/format-utils.js` con funciones centralizadas
- Actualizar todos los `*-live.js` para usar las funciones

### 2. Estados en Español (Quick Win)
- Traducir todos los enums: `NOT_STARTED` → `Sin iniciar`, `en_gestión` → `En gestión`
- Crear diccionario de traducciones

**Archivos**:
- Agregar diccionario en `format-utils.js`
- Actualizar renderizado de badges/estados

### 3. Labels Demo/Mock Claros
- Identificar números hardcoded
- Agregar badges "Dato de demo" donde corresponda
- Comentar en código qué es mock vs API real

**Archivos**:
- Principalmente `*-live.js` y HTML

### 4. Confirmaciones en Acciones de Dinero
- Modal de confirmación antes de: Cobrar, Conciliar, Pagar, Autorizar
- Mostrar monto y destinatario

**Archivos**:
- `finanzas-live.js`

## NO en Fase 1 (Diferir a Fase 2 o 4)
- Single source of truth de KPIs (requiere backend grande - Fase 4)
- Unificar contadores entre Torre/Métricas/Viajes (estructural - Fase 4)
- Design system tokens (Fase 2)

## Criterios de Éxito
✅ Todos los números usan coma decimal
✅ Todas las fechas en formato español consistente
✅ No aparecen estados en inglés o snake_case
✅ Acciones de dinero piden confirmación
✅ Datos mock tienen label claro
