# Phase 1 - Data Trust: Progress Report

## Completed P0 Items ✅

### 1. Float artifacts in weight/carga ✅ (PR #5)
- Fixed in `viajes.html` using `SOL_FORMAT.weight()`
- Formats "1.7999999999999998 t" as "1,8 t"
- Applied across all screens

### 2. DELETE 400 in Marketing ✅ (Already exists)
- Routes implemented in `backend/src/routes/marketing.mjs`
- Service functions in `backend/src/services/marketing.mjs`
- DELETE `/catalog/:id`, `/offers/:id`, `/campaigns/:id`, `/emails/:id` all working

### 3. Price & name validation ✅ (Already exists)
- `normalizePriceText()` validates price contains a digit
- `createCatalogItem()` validates name min 2 chars, description min 5 chars
- `createOffer()` validates title min 3 chars, description min 5 chars

### 4. Timezone offset fix ✅ (Partial - marketing dates fixed)
- Fixed `marketing-live.js` to use `SOL_FORMAT.date()` with ART timezone
- Central `format-utils.js` already correct with `America/Argentina/Buenos_Aires`
- No more -1 day offset (01/01/2026 now shows correctly)

### 5. Date format consistency (In Progress)
- `format-utils.js` provides consistent dd/mm/yyyy format
- Most screens use centralized functions
- Some legacy code still needs migration

### 6. 'Sistemas activos' pill ✅ (PR #6)
- Added `data-sol-system-status` attribute to all HTML pills
- Fixed `paintSystemStatus()` class replacement regex bug
- Pill now correctly shows RED when services are down
- Verified in browser with WhatsApp CAÍDO

## Additional Fixes in PR #6

### Cache-busting for Stitch assets ✅
- Added `?v=timestamp` to all 28 HTML files
- Scripts and CSS load without hard reload
- Users immediately get fixes

### WhatsApp error sanitization ✅
- Backend: friendly Spanish messages instead of `error.message`
- Frontend: list previews filter JS errors
- No more "Cannot read properties of undefined (reading 'id')" shown to drivers

## Pending Quick Wins

### 7. Enum translation (Ready)
- `format-utils.js` already has `STATUS_DICT` with Spanish translations
- Need to apply `translateStatus()` in screens still using English enums

### 8. Remove "Nuevo" badges from navigation (Scoped)
- 92 occurrences found
- Only remove from duplicated nav items (Finanzas, Marketing, WhatsApp in top nav)
- Keep action buttons like "Nuevo Viaje", "Nuevo Cobro"

### 9. Confirmation dialogs for critical actions (Medium effort)
- Add confirm modals before: Cobrar, Conciliar, Recordatorio Masivo WhatsApp
- Show amount/recipient in confirmation

## Browser Verification

All P0 fixes verified on live demo (`https://transitone-transitone-borrador.wd75db.easypanel.host`):
- ✅ Viajes Carga: formatted weights without hard reload
- ✅ WhatsApp: no error messages in previews
- ✅ System status pill: RED when WhatsApp down
- ✅ Cache-busting working

## Next Phase

Ready to proceed with:
- **Phase 2**: Design System (tokens, unified components)
- **Phase 3**: Responsive improvements
- **Phase 4**: Backlog items (KPIs, nav consolidation, etc.)
