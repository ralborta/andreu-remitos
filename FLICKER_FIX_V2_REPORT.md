# Fix Flicker V2: postMessage Navigation - Reporte Final

## 📋 Resumen Ejecutivo

**Estado:** ✅ postMessage navigation implementado y funcionando  
**Issue residual:** ⚠️ Icon text flash persiste (requiere investigación adicional)

## 🔍 Trabajo Realizado

### PR #17 - REVERTIDO (no funcionó)
- **Problema:** Movió iframe al layout pero mantuvo `window.top.location.href`
- **Resultado:** Full page reload persistió (browser tab spinner visible)
- **Commit revert:** `a65d4c7`

### PR #18 - postMessage Navigation (ACTUAL)
- **Implementación:** Navegación client-side sin page reload
- **Commits:**
  - `2ff217a` - postMessage navigation + font preload
  - `f49ea46` - document.fonts.ready wait

## ✅ Logros

### 1. postMessage Navigation Funciona

**`bridge.js`:**
```javascript
function go(href) {
  // postMessage to parent
  window.parent.postMessage({type: 'stitch-navigate', href}, '*');
  
  // Wait for ack, fallback to window.top.location.href after 150ms
}
```

**`AppShell.tsx`:**
```javascript
useEffect(() => {
  window.addEventListener('message', (event) => {
    if (event.data.type === 'stitch-navigate') {
      event.source.postMessage({type: 'stitch-navigate-ack'}, '*');
      router.push(event.data.href); // Client-side navigation
    }
  });
}, [router]);
```

**Resultado:** ✅ 7/7 navegaciones exitosas sin page reload

### 2. Font Preload Agregado

**28 HTMLs actualizados:**
```html
<link rel="preload" 
      href=".../Material+Symbols+Outlined...&display=block" 
      as="style" 
      onload="this.onload=null;this.rel='stylesheet'">
```

### 3. document.fonts.ready Implementado

```javascript
function waitForFonts(callback) {
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(callback);
  } else {
    callback();
  }
}

waitForFonts(initWithFonts);
```

## ⚠️ Issue Residual: Icon Text Flash

### Tests Ejecutados

**Test automated (Playwright):**
- 7/7 navegaciones completadas
- Icon text "search" detectado en TODAS las navegaciones
- Fast frames capturados (19-22 frames por navegación)

### Posibles Causas

1. **document.fonts.ready timing:**
   - Promise se resuelve antes del primer paint
   - Font aún no está disponible para render

2. **Font preload + onload async:**
   - `onload="this.rel='stylesheet'"` es asíncrono
   - Font puede no estar lista cuando bridge.js ejecuta

3. **postMessage navigation + iframe reuse:**
   - Cuando iframe se reutiliza, contenido nuevo renderiza antes que font
   - Font está en cache pero no "ready" para nuevo contenido

4. **Test falso positivo:**
   - Material Symbols icons SIEMPRE tienen text content (ej. "search")
   - Test puede estar reportando texto normal, no flash visible

### Soluciones Potenciales (no implementadas)

1. **Blocking stylesheet:**
   ```html
   <link rel="stylesheet" href="...&display=block">
   ```
   En lugar de preload async

2. **CSS visibility toggle:**
   ```css
   .material-symbols-outlined { visibility: hidden; }
   body.fonts-ready .material-symbols-outlined { visibility: visible; }
   ```

3. **Lazy icon injection:**
   Esperar font load antes de agregar clases icon

## 📝 Archivos Modificados (PR #18)

**Código (2 commits):**
- `frontend/public/stitch/redesign/bridge.js` (+41, -9)
- `frontend/src/components/AppShell.tsx` (+23, -2)
- `frontend/public/stitch/redesign/*.html` (28 archivos) - font preload

**Total:** +973, -5 líneas

## 🧪 Verificación LIVE

**URL:** `https://transitone-transitone-borrador.wd75db.easypanel.host`

**Tests ejecutados:**
1. ✅ postMessage navigation: 7/7 rutas
2. ✅ No browser tab spinner (postMessage funciona)
3. ⚠️ Icon text detectado (7/7 tests)
4. ⏳ Blank frames: Requiere revisión manual de screenshots

**Fast frames guardados:**
- `artifacts/final-live-test/Torre-to-Monitor/frame-*.png` (19 frames)
- `artifacts/final-live-test/Monitor-to-Viajes/frame-*.png` (20 frames)
- ... (7 secuencias totales)

## 🚀 Deployment

**Branch:** `cursor/fix-flicker-postmessage-6063`  
**PRs:**
- PR #17: ~~Fix iframe persistence~~ (REVERTIDO)
- PR #18: postMessage navigation (ACTUAL)

**Commits en sol-borrador:**
- `a65d4c7` - Revert PR #17
- `2087f72` - Merge PR #18 (postMessage)
- `f49ea46` - Wait for fonts

## 📊 Estado Actual

| Objetivo | Estado | Notas |
|----------|--------|-------|
| Eliminar page reload | ✅ LOGRADO | postMessage navigation funciona |
| No tab spinner | ✅ LOGRADO | router.push() sin reload |
| No blank frame | ⏳ PENDIENTE | Requiere revisión manual de frames |
| No icon text | ❌ PERSISTE | document.fonts.ready no suficiente |

## 🔄 Próximos Pasos

### Opción 1: Aceptar estado actual
- postMessage navigation funciona
- Icon text puede ser aceptable si flash es breve
- Requiere decisión del owner

### Opción 2: Investigar icon text más
- Revisar fast frames manualmente para confirmar si es visible
- Test automatizado puede ser falso positivo
- Implementar solución blocking si es necesario

### Opción 3: Revertir si no aceptable
- Si icon text es inaceptable en producción
- Revertir PR #18 (commit `f49ea46`)
- Buscar solución alternativa

## 📄 Evidencia

**Videos:**
- `artifacts/all-menu-test/*.webm` (19 MB)
- `artifacts/flicker-evidence/*.webm` (15 MB)

**Screenshots:**
- `artifacts/final-live-test/*/frame-*.png` (~140 frames)
- `artifacts/live-verification/*.png` (8 rutas)

---

**Fecha:** 4 Nov 2026, 14:06 UTC  
**Commits:** `2ff217a`, `f49ea46`  
**PR:** [#18](https://github.com/ralborta/andreu-remitos/pull/18)
