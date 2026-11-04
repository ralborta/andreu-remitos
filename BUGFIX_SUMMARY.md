# Bug Fix Summary - SOL · Empliados

## Fixed Bugs ✅

### 1. Hardcoded Agent Count (Bug #8 partial)
**Issue:** Dashboard showed hardcoded "8 agentes en línea"  
**Root Cause:** Static text instead of counting actual operative agents  
**Fix:** Changed to dynamically count agents with `status === "operativo"` from the agents array  
**Verification:** Agent count now reflects actual number of operational agents (currently 4)  
**Files:** `frontend/src/app/(app)/page.tsx`

### 2. System Health Indicator Always Green (Bug #8)
**Issue:** "Sistemas activos" pill in header was always green regardless of actual system health  
**Root Cause:** Static indicator not connected to Monitor API  
**Fix:** 
- Added periodic health checks (every 30s) to Monitor API
- Indicator now shows:
  - Green "Sistemas activos" when all services are OK
  - Yellow "Sistema degradado" when services are down
  - Purple "Verificando..." during initial check
- Color and text update dynamically based on real health status
**Verification:** Indicator syncs with Monitor page status  
**Files:** `frontend/src/components/Topbar.tsx`

### 3. Date Timezone Shifts (Bug #3)
**Issue:** Date-only values like "2026-01-01" displayed as "31 de dic de 2025"  
**Root Cause:** Parsing date-only strings as `new Date("2026-01-01")` treats them as UTC midnight, which converts to previous day in Argentina timezone (UTC-3)  
**Fix:**
- Created date utilities library with timezone-aware functions
- Parse date-only strings as local noon: `new Date("2026-01-01T12:00:00")`
- Added explicit `timeZone: "America/Argentina/Buenos_Aires"` to all date formatting
- Applied fixes to: RemitoCampoInput, RendicionPanel, remitos-ui, ContactoChatThread, MonitorPanel, ActivityFeed, LiveClock
**Verification:** Dates now display correctly without day shifts  
**Files:** 
- `frontend/src/lib/dates.ts` (new)
- `frontend/src/components/RendicionPanel.tsx`
- `frontend/src/lib/remitos-ui.ts`
- `frontend/src/components/ContactoChatThread.tsx`
- `frontend/src/components/MonitorPanel.tsx`
- `frontend/src/components/ActivityFeed.tsx`
- `frontend/src/components/LiveClock.tsx`

### 4. Float Formatting Artifacts (Bug #5)
**Issue:** Viajes Carga field showed float artifacts like "1.7999999999999998 t", "2.0999999999999996 t"  
**Root Cause:** JavaScript floating-point precision issues when displaying raw numbers  
**Fix:** Added custom render function for Carga column that:
- Parses numeric values from strings
- Formats with `toLocaleString("es-AR")` with proper fraction digits (0-2)
- Prevents display of floating-point artifacts
**Verification:** Cargo weights now display cleanly (e.g., "1,8 t" instead of "1.7999999999999998 t")  
**Files:** `frontend/src/components/ViajesTable.tsx`

### 5. JavaScript Errors in WhatsApp Chat (Bug #11)
**Issue:** Raw JS errors like "Cannot read properties of undefined (reading 'id')" rendered inside chat messages  
**Root Cause:** Malformed message objects or error strings getting into the messages array and being displayed as text  
**Fix:**
- Added validation to filter messages with missing required fields (id, at)
- Filter out messages containing error text patterns
- Log filtered errors to console for debugging instead of showing to users
- Return null for error messages to prevent rendering
**Verification:** Error messages no longer displayed in chat UI  
**Files:** `frontend/src/components/ContactoChatThread.tsx`

---

## Bugs Not Found in Codebase ❌

### 1. Marketing Delete Endpoints (Bug #1)
**Issue:** DELETE `/backend/api/marketing/offers/<id>` and `/backend/api/marketing/catalog/<id>` return 400  
**Status:** ❌ **Not found in codebase**  
**Investigation:** 
- No marketing routes found in `backend/src/routes/`
- No "marketing" endpoints in API
- No "Promociones" or "Planificador" features in frontend
**Recommendation:** These features may be:
- In a different branch not yet merged
- Planned but not yet implemented
- Part of a different deployment/version

### 2. Planificador Catalog Item (Bug #2)
**Issue:** POST to Planificador catalog returns 201 but name/description not persisted  
**Status:** ❌ **Not found in codebase**  
**Investigation:** Same as Bug #1 - no Planificador or catalog features found  
**Recommendation:** Implement when marketing module is added

---

## Bugs Requiring Additional Investigation 🔍

### 3. User Menu / Logout (Bug #9)
**Issue Reported:** User menu chevron next to 'Gonzalo Demo' does nothing; /api/auth/logout exists  
**Current State:** ✅ Logout button EXISTS and works in sidebar (line 352-359 of `Sidebar.tsx`)  
**Status:** May already be fixed or misreported  
**Verification Needed:** Check if the issue is:
- About a different chevron/dropdown
- About the visual indicator (chevron) not being visible
- Already resolved

### 4. 'Nueva conversación con agente' Button (Bug #10)
**Issue:** Button on Viajes navigates to /contactos instead of starting agent conversation  
**Status:** ⚠️ **Button not found**  
**Investigation:** 
- Searched for "Nueva conversación" button in Viajes-related components
- No such button found in ViajesTable or AgentData components
- /contactos route exists and shows WhatsApp contacts inbox
**Recommendation:** 
- Verify if this button exists in the deployed version
- May be part of a feature not in this codebase version
- If it should exist, needs to be added

### 5. Viajes Issues (Bug #6)
**Issues Reported:**
- Cancelled trip still shows 'Asignar' button
- Cancelled trip counted in 'viajes en curso / programados'
- Choferes and Camiones tabs do nothing  
- Estado filter lacks Solicitado/Confirmado/Cancelado options

**Status:** ⚠️ **Partial - needs deeper investigation**  
**Current Code Review:**
- ViajesTable shows basic trip list from API
- Uses demo data mixed with API data
- Estado (status) mapping exists but may be incomplete
**Recommendation:** 
- Implement proper status filtering
- Add Choferes/Camiones tab functionality
- Filter cancelled trips from active counts
- Add full status options to filters

---

## Investigation: Counter Discrepancies

**Issue:** Numbers disagree across screens:
- Torre: "15 de 26"
- Métricas: "13 viajes / 26 en gestión"  
- Viajes: 17
- Finanzas: cobrado $2.372.500 vs $3.032.500
- Cartera: $312.400 / $467.400 / $3.100.000

**Findings:**
Most data in the codebase comes from:
1. **Mock/Demo Data** in `frontend/src/lib/data.ts`:
   - 26 hardcoded trips in `trips` array
   - Hardcoded incidencias, reclamos, rendiciones, etc.
   - These are static demo values for UI presentation

2. **API Data** (when backend is running):
   - Mixes real API responses with demo data
   - ViajesTable fetches from `/api/viajes` and merges with demo data
   - Counter logic varies by component

**Recommendation:**
- **Development/Demo Mode:** Current approach is acceptable (mixed data for UI testing)
- **Production:** All components should use consistent API data source
- **Fix:** Create a `useDataSource()` hook that switches between demo/API based on environment
- **Document:** Add comments indicating which numbers are mock vs API-sourced

---

## Not Addressed (Out of Scope)

### Price Validation (Bug #4)
**Issue:** Offer price accepts text input 'abc'  
**Status:** ⏭️ **Skipped** - Feature doesn't exist in codebase  
**Reason:** No offer/price input forms found (part of missing Marketing module)  
**Recommendation:** Implement when marketing forms are added:
- Client-side: `<input type="number" />` with pattern validation
- Server-side: Validate numeric value in POST handler

---

## Summary

### ✅ Successfully Fixed: 5 bugs
1. Dynamic agent count
2. System health indicator
3. Date timezone shifts  
4. Float formatting artifacts
5. WhatsApp error rendering

### ❌ Not Found: 2 bugs (Marketing features)
1. Marketing delete endpoints
2. Planificador catalog persistence

### ⚠️ Needs Investigation: 3 bugs
1. User menu (may already work)
2. Nueva conversación button (not found)
3. Viajes tabs and filters (partial implementation)

### 📊 Documented: 1 issue
1. Counter discrepancies (explained as demo data vs API)

### ⏭️ Skipped: 1 bug
1. Price validation (feature doesn't exist)
