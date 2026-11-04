# Regression Checklist - SOL (sol-borrador)

**Use before merging ANY phase to ensure no regressions.**

Demo: https://transitone-transitone-borrador.wd75db.easypanel.host  
Credentials: demo / demo123

---

## Critical Flows to Test

### ✅ Authentication
- [ ] Login with demo/demo123 works
- [ ] Dashboard loads after login
- [ ] Logout works (user menu → Cerrar sesión)
- [ ] Redirects to login after logout

### ✅ Torre de Control
- [ ] Dashboard loads without errors
- [ ] Date displays correctly (not hardcoded)
- [ ] "Sistemas activos" pill shows correct color (green if healthy, red if services down)
- [ ] Agent activity feed updates
- [ ] Can click on cards/interactions without errors

### ✅ Viajes
- [ ] List loads with trips
- [ ] Can view trip details (click on row)
- [ ] Tabs work: Viajes / Tracking Express / Choferes / Camiones
- [ ] Filters work: Estado dropdown
- [ ] "Nueva conversación con agente" navigates to Chat Central (not WhatsApp)
- [ ] Can create new trip (if applicable)
- [ ] Can assign trip to driver (if applicable)
- [ ] Can cancel trip (if applicable)
- [ ] Float numbers display correctly (no 1.799999998)

### ✅ Marketing
- [ ] Dashboard loads
- [ ] Can navigate between: Dashboard / Planificador / Email / Contenidos / Promociones / Visibilidad / Difusión / Resultados
- [ ] Planificador: Can create catalog item (name + description required)
- [ ] Planificador: Price validation works (rejects "abc")
- [ ] **Promociones: DELETE works** (no 400 error)
- [ ] **Planificador: Catalog DELETE works** (no 400 error)
- [ ] Can create offer (Desde date shows correctly, not -1 day)
- [ ] Can create campaign

### ✅ WhatsApp / Contactos
- [ ] Contact list loads
- [ ] Can open conversation
- [ ] Chat messages display correctly
- [ ] **No raw JS errors in message bubbles** (shows "⚠ Error procesando mensaje" instead)
- [ ] Can send message (if session active)
- [ ] Remito panel works
- [ ] Bot pause/resume works

### ✅ Finanzas
- [ ] Dashboard loads with KPIs
- [ ] Can navigate: Dashboard / Clientes / Facturas / Cobranza / Conciliación / Comunicación
- [ ] Cobrar action works
- [ ] Conciliar action works
- [ ] Pagar action works
- [ ] WhatsApp messaging works
- [ ] Numbers display without errors

### ✅ Monitor
- [ ] Service status loads
- [ ] Shows correct agent counts (matches Torre)
- [ ] Date/time displays correctly in timezone
- [ ] QR code display works (if WhatsApp down)

### ✅ Métricas / Backoffice
- [ ] Dashboard loads
- [ ] Charts render
- [ ] KPIs display

### ✅ Agentes (Tracking, Remitos, Destinos, Incidencias, Rendición, ETA, POD, Reclamos, Analítica)
- [ ] Each screen loads without errors
- [ ] Basic interactions work (view lists, open details)

---

## What to Check After Each Change

### Visual Changes Only ✅
- Number formats (es-AR with comma decimal)
- Date formats (dd/mm/aaaa, timezone correct)
- Status translations (Spanish, no English/snake_case)
- Color/styling changes

### MUST NOT Change ❌
- Data fetching logic
- API calls / endpoints
- Business logic (calculations, validations that affect data)
- Database operations
- Authentication flow
- Navigation flow (except fixing bugs like "Nueva conversación")
- Existing working functionality

---

## Regression Test Procedure

1. **Before merge**: Test on local/staging if possible
2. **After merge to sol-borrador**: Wait for Easypanel deploy (~30-60 sec)
3. **Run through checklist above**
4. **If ANY item fails that worked before**:
   - Document the failure
   - Immediately create revert PR
   - Merge revert
   - Investigate fix offline
   - Re-apply with fix in new PR

---

## Quick Smoke Test (Minimum)

If time is limited, at minimum test these **critical paths**:

1. ✅ Login → Dashboard loads
2. ✅ Torre de Control displays without errors
3. ✅ Viajes list loads and can view details
4. ✅ Marketing: Create offer + DELETE works
5. ✅ WhatsApp: Open conversation, messages display
6. ✅ Finanzas: Dashboard loads, can view data
7. ✅ Logout works

**If all 7 pass**: Likely safe  
**If any fail**: Full regression check required

---

## Phase 1 Foundation (PR #4) - Regression Status

**Date**: Nov 4, 2026 - 1:55 AM UTC  
**PR**: #4  
**Commit**: 53fb356

**Changes Made**:
- Added format-utils.js (new file, no existing code modified)
- Added `<script>` tags to 6 HTML files (additive only)
- No logic changes, no API changes, no data changes

**Expected Result**: Zero regressions (changes are purely additive)

**Actual Result**: ⏳ **Pending verification**

### Regression Test Results

Run tests and record results here:

- [ ] **Login/Logout**: 
- [ ] **Torre**: 
- [ ] **Viajes**: 
- [ ] **Marketing CRUD**: 
- [ ] **WhatsApp**: 
- [ ] **Finanzas**: 
- [ ] **Monitor**: 

**Overall**: ⏳ Pending

---

**Last Updated**: Nov 4, 2026 - 1:55 AM UTC
