# Manual Testing Guide - Navigation Flicker Fix

## Overview
This fix implements double-buffered real iframes with requestAnimationFrame-based swapping to eliminate navigation flicker, and updates bridge.js to prevent fallback top-level navigation.

## Changes Made

### 1. StitchFrame.tsx
- **Change**: Use `requestAnimationFrame x2` instead of `fonts.ready` for iframe swap
- **Why**: Ensures browser has fully painted the new content before showing it
- **Code**: Simplified load handler that waits two animation frames after load event

### 2. bridge.js - Three Critical Fixes

#### Fix 1: Longer Ack Timeout
- **Change**: Increased postMessage ack timeout from 150ms to 1000ms
- **Why**: Prevents fallback to top.location.href when parent is slow to respond
- **Line**: ~66 (in go() function)

#### Fix 2: Conditional target="_parent"
- **Change**: Only set `target="_parent"` when `window.parent === window` (not inside shell)
- **Why**: Prevents native anchor navigation when inside iframe shell
- **Line**: ~127 (in bind() function)

#### Fix 3: Delegated Capture-Phase Listener
- **Change**: Added document-level click listener in capture phase
- **Why**: Catches all nav clicks, even on dynamically added elements
- **Line**: ~1012 (before initWithFonts())

## Testing Checklist

### 🎯 Primary Goal: No White Screen Flicker

Test on live site: https://transitone-transitone-borrador.wd75db.easypanel.host/

#### Test 1: Top Window Never Reloads
1. Open browser DevTools Console
2. Set marker: `window.__shellMarker = Date.now()`
3. Click through all menu items TWICE:
   - Torre de Control (/)
   - Viajes (/agentes/viajes)
   - Destinos (/destinos)
   - WhatsApp (/contactos)
   - Finanzas (/agentes/finanzas)
   - Marketing (/marketing)
   - Promociones (/marketing/promociones)
   - Monitor (/monitor)
   - Métricas (/backoffice)
4. Check marker: `window.__shellMarker` (should be unchanged)
5. Check nav count: `performance.getEntriesByType('navigation').length` (should be 1)

**Expected**: Marker unchanged, nav count = 1
**Fail if**: Marker changes OR nav count > 1

#### Test 2: No Visual White Screen
1. Watch screen carefully during each navigation
2. Look for:
   - ❌ Blank white screen (even brief)
   - ❌ Content flashing off and on
   - ❌ "Loading..." or blank state visible
   - ✅ Smooth transition from old page to new page

**Expected**: Old content stays visible until new content fully rendered
**Fail if**: Any white/blank frame visible

#### Test 3: Page Scripts Work After Navigation

##### Viajes - Choferes/Camiones Tabs
1. Click "Viajes" from any page
2. Click "Choferes" tab
3. Click "Camiones" tab
**Expected**: Tabs switch, data loads
**Fail if**: Tabs don't respond or data doesn't load

##### Finanzas - Cobrar Modal
1. Click "Finanzas" from any page
2. Click "Cobrar" button on a row
3. Modal should open
4. Click "Cancelar" button
5. Modal should close
**Expected**: Modal opens and closes
**Fail if**: Cobrar does nothing OR Cancelar does nothing

##### WhatsApp - Chat List
1. Click "WhatsApp" from any page
2. Chat list should load with conversations
**Expected**: Chat conversations visible
**Fail if**: Empty or "loading" state persists

##### Destinos - Map
1. Click "Destinos" from any page
2. Map should load and render
**Expected**: Interactive map visible
**Fail if**: Blank map area or error

##### Torre - KPIs/Map/Chat
1. Click "Torre de Control" from any page
2. KPI cards should show data
3. Map should render
4. Chat list should show
**Expected**: All dashboard elements render
**Fail if**: Any section blank or broken

##### Monitor - Data Table
1. Click "Monitor" from any page
2. Service data should load
**Expected**: Table/list of services visible
**Fail if**: No data or error

### 🔍 Technical Verification

#### Check Bridge.js Loads Correctly
1. Open DevTools → Network tab
2. Navigate between pages
3. Find bridge.js requests
4. Verify `?v=` cache-busting parameter present
5. Check Response headers: should be served fresh, not stale

#### Check Console for Errors
1. Open DevTools → Console
2. Navigate through all pages
3. Look for:
   - ❌ JavaScript errors
   - ❌ "postMessage" errors
   - ❌ "Failed to load" errors
   - ✅ Should see `[StitchFrame] Content swapped successfully` logs (if added)

**Expected**: No errors in console
**Fail if**: Any errors related to navigation or bridge.js

## Regression Checklist

If ANY of these fail, REVERT IMMEDIATELY:

- [ ] All navigation links work
- [ ] No white screen on any navigation
- [ ] Viajes tabs work
- [ ] Finanzas Cobrar modal works
- [ ] WhatsApp chat list loads
- [ ] Destinos map loads
- [ ] Torre KPIs/map/chat load
- [ ] Monitor data loads
- [ ] Browser Back button works
- [ ] Browser Forward button works
- [ ] Direct URL load works (e.g., /agentes/viajes)
- [ ] No console errors

## Success Criteria

✅ **PASS**: All tests pass, no white screen visible, all features work
❌ **FAIL**: Any white screen visible OR any feature broken → REVERT

## Rollback Command

```bash
git checkout sol-borrador
git revert <commit-sha>
git push origin sol-borrador
```

Or hard reset to previous working commit (9a2ad28):

```bash
git checkout sol-borrador
git reset --hard 9a2ad28
git push --force-with-lease origin sol-borrador
```
