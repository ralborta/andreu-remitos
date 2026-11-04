# Reporte: PR #15 - Sidebar Intento #2 Fallido + Revert

**Fecha:** 4 de noviembre de 2026, 13:32 UTC  
**PR Implementación:** [#15](https://github.com/ralborta/andreu-remitos/pull/15)  
**PR Revert:** [#16](https://github.com/ralborta/andreu-remitos/pull/16)  
**Estado:** ❌ FALLIDO - Revertido inmediatamente

---

## 📋 Resumen Ejecutivo

Segundo intento de implementar sidebar única + status pill dinámico **FALLÓ en producción** a pesar de pasar tests locales exhaustivos.

**Local:** ✅ 29 links, íconos correctos, responsive  
**Live:** ❌ 0 links, sidebar vacía (misma regresión que PR #13)

**Acción tomada:** Revert inmediato según regla del owner.

---

## 🔄 Timeline

| Hora UTC | Evento |
|----------|--------|
| 13:21 | Build local exitoso |
| 13:25 | Tests locales PASS (29 links en 7 páginas × 2 viewports) |
| 13:26 | Commit e0ce108 + a5421da |
| 13:27 | PR #15 creado |
| 13:27:52 | PR #15 merged a sol-borrador |
| 13:28 | Cache-busting bump (v=1793798901) |
| 13:31 | Test live ejecutado → **0 links detectados** |
| 13:32 | PR #16 (revert) creado y merged |

**Tiempo del incidente:** ~5 minutos (merge → detección → revert)

---

## ✅ Testing Local (Exitoso)

### Metodología
- **Build:** `npm run build` + `npm run start` (production mode)
- **Server:** localhost:3456
- **Tests:** Playwright headless browser
- **Acceso:** Directo a `/stitch/redesign/*.html` (bypass Next.js auth)

### Resultados

**7 páginas testeadas:**
- Torre (`torre.html`)
- Viajes (`viajes.html`)
- Destinos (`destinos.html`)
- WhatsApp (`whatsapp.html`)
- Finanzas (`finanzas.html`)
- Promociones (`marketing-ofertas.html`)
- Monitor (`monitor.html`)

**2 viewports:**
- Desktop: 1440×900
- Mobile: 390×844

**Métricas:**
```
✅ Sidebar presente: 14/14 páginas
✅ Enlaces funcionando: 29/29 por página
✅ Material Icons font cargado: true
✅ Íconos como símbolos: ✓ (no como texto literal)
✅ Pill sin overlap: "Sistemas activos"
✅ Responsive: Desktop visible, Mobile hidden (-translate-x-full)
```

### Verificación de Íconos

Script `check-icons.mjs` confirmó:
```javascript
Material Icons font loaded: true
Found 52 material-symbols-outlined spans
Icon 1: font="Material Symbols Outlined" ✓
Icon 2: font="Material Symbols Outlined" ✓
...
```

### Screenshots Locales

Generados en `artifacts/screenshots-local/`:
- 14 screenshots (7 páginas × 2 viewports)
- Todos muestran sidebar poblada con 29 links
- Íconos renderizan correctamente
- No hay overlaps en pill

---

## ❌ Testing Live (Fallido)

### Metodología
- **URL:** https://transitone-transitone-borrador.wd75db.easypanel.host
- **Test:** Playwright contra deploy real post-merge
- **Viewports:** 1440px, 390px

### Resultados

```
📱 1440px
  torre...      ❌ (0 links)
  viajes...     ❌ (0 links)
  destinos...   ❌ (0 links)
  contactos...  ❌ (0 links)
  finanzas...   ❌ (0 links)
  ofertas...    ❌ (0 links)
  monitor...    ❌ (0 links)

📱 390px
  torre...      ❌ (0 links)
  viajes...     ❌ (0 links)
  destinos...   ❌ (0 links)
  contactos...  ❌ (0 links)
  finanzas...   ❌ (0 links)
  ofertas...    ❌ (0 links)
  monitor...    ❌ (0 links)
```

**0/14 páginas con links funcionales**

### Screenshots Live

Generados en `artifacts/screenshots-live-v2/`:
- 14 screenshots confirman sidebar VACÍA
- Sidebar element existe (`[data-sol-sidebar]`) pero sin contenido
- Sin elementos `<a>` dentro de sidebar

---

## 🔍 Análisis de Causa Raíz

### Diferencia Local vs. Live

| Aspecto | Local (localhost:3456) | Live (Easypanel) |
|---------|------------------------|------------------|
| Build | `next build` + `next start` | Producción optimizada |
| Bridge.js ejecuta | ✅ Completo | ⚠️ Parcial o timing issue |
| Links generados | 29 | 0 |
| Material Icons | ✅ Carga | ? |

### Hipótesis Principales

#### 1. **Timing Issue - DOM No Listo**
```javascript
// En bridge.js línea ~980
installSidebar();  // Se ejecuta inmediatamente

// Pero createSidebarNav() depende de:
// - AGENT_LINKS, FINANCE_LINKS, MARKETING_LINKS
// - función bind()
// - función isActive()
```

Si el script ejecuta antes de que estas dependencias estén completamente definidas, los links no se generan.

#### 2. **Production Build Optimizations**
- Next.js production puede minificar/optimizar de forma diferente
- `next start` con `output: standalone` tiene advertencia en logs
- Posible tree-shaking o dead code elimination

#### 3. **SSR/Hydration Mismatch**
- Los Stitch HTMLs se sirven estáticos pero bridge.js es dinámico
- Posible conflicto entre HTML estático y JS dinámico en producción

#### 4. **Cache-Busting No Propagado**
```bash
# HTML servido live mostró:
bridge.js?v=   # Sin número de versión
```

Esto sugiere que el HTML actualizado no se deployó correctamente, aunque el browser cargó el bridge.js nuevo (que generaba sidebar vacía).

### Evidence del Problema

**Console.log en bridge.js línea ~1059:**
```javascript
console.log('[SOL] Sidebar created with ' + linkCount + ' links');
```

Este log probablemente mostró `linkCount = 0` en live, activando el fallback:
```javascript
if (linkCount > 0) {
  // Esconder nav antiguas
} else {
  console.warn('[SOL] Sidebar has no links, keeping old navigation');
}
```

Pero el problema es que la navegación antigua TAMBIÉN fue escondida (o no presente), dejando el sistema innavegable.

---

## 📊 Comparación PR #13 vs. PR #15

| Aspecto | PR #13 (intento 1) | PR #15 (intento 2) |
|---------|-------------------|-------------------|
| Testing local | ❌ Playwright solo (no real browser) | ✅ Build local + Playwright real |
| Verificación íconos | ❌ No verificado | ✅ Font loading confirmado |
| Links generados | 0 | 29 local, 0 live |
| Precauciones | ⚠️ Esconde nav antes de verificar | ✅ Verifica linkCount > 0 |
| Resultado live | ❌ Sidebar vacía, íconos como texto | ❌ Sidebar vacía (mejor pero aún roto) |
| Revert | PR #14 (3 min) | PR #16 (5 min) |

**Ambos intentos fallaron en producción** a pesar de diferentes niveles de testing.

---

## 🛠️ Código Implementado (Pre-Revert)

### Nuevas Funciones en bridge.js

```javascript
function ensureMaterialIconsFont() {
  // Carga font explícitamente
  if (document.getElementById('sol-material-icons-font')) return;
  var link = document.createElement('link');
  link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined...';
  document.head.appendChild(link);
}

function createSidebarNav() {
  // Genera sidebar con 29 enlaces reales
  var sections = [
    { title: 'Operación', links: [...] },
    { title: 'Agentes', links: AGENT_LINKS },      // 10 enlaces
    { title: 'Finanzas', links: FINANCE_LINKS },   // 6 enlaces
    { title: 'Marketing', links: MARKETING_LINKS } // 7 enlaces
  ];
  
  // Genera HTML con loops
  // Bindea con bind() existente
  // Retorna sidebar element
}

function installSidebar() {
  ensureMaterialIconsFont();
  var sidebar = createSidebarNav();
  var linkCount = sidebar.querySelectorAll('a[href]').length;
  
  console.log('[SOL] Sidebar created with ' + linkCount + ' links');
  
  if (linkCount > 0) {
    // Ajustar main, esconder nav antiguas
  } else {
    console.warn('[SOL] Sidebar has no links, keeping old navigation');
  }
}
```

### Ejecución

```javascript
// Línea ~980
installSidebar();
fetchAndUpdateStatus();

document.addEventListener("DOMContentLoaded", function() {
  paintShell();
  installSidebar();  // Segunda ejecución
  fetchAndUpdateStatus();
});
```

---

## 🚨 Revert Aplicado

### PR #16 Commits

1. Revert de `c5d4350` - feat: Sidebar única + Status pill dinámico (v2)
2. Revert de `880c3d5` - chore: bump cache-busting

### Estado Post-Revert

✅ Bridge.js restaurado a 989 líneas (estado funcional)  
✅ Navegación antigua visible  
✅ 27 enlaces `<a>` accesibles  
✅ Sistema navegable  

---

## 🎯 Conclusiones

### Lo Que Funcionó

✅ Testing local exhaustivo  
✅ Material Icons verificación  
✅ Precaución de linkCount > 0  
✅ Console.log para debug  
✅ Revert rápido (5 minutos)  

### Lo Que Falló

❌ Diferencia crítica local vs. producción  
❌ Tests locales no replicaron comportamiento live  
❌ Sidebar genera 29 links local, 0 links live  
❌ Causa raíz no identificada antes de deploy  

### Lección Aprendida

**Tests locales exitosos NO garantizan éxito en producción.**

Necesario:
1. Testing en ambiente de staging idéntico a producción
2. Deploy incremental (canary/blue-green)
3. Monitoreo post-deploy en tiempo real
4. O aceptar que la navegación actual funciona y no cambiarla

---

## 📝 Recomendación

**No intentar sidebar nuevamente** hasta identificar y resolver causa raíz local/live.

Opciones:
1. **Mantener navegación actual** (funcional, probada, estable)
2. **Investigar diferencias build** (localhost vs. Easypanel production)
3. **Modificar approach** (editar HTMLs estáticos en lugar de JS dinámico)

---

**Autor:** Cursor Agent  
**Fecha:** 4 de noviembre de 2026, 13:35 UTC  
**Estado:** Revertido y analizado
