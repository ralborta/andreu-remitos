# Navigation Flicker Fix - Summary Report

## ✅ Actions Completed

### 1. Emergency Revert (COMPLETED)
- **Action**: Reverted `sol-borrador` from broken innerHTML-swap code to commit `9a2ad28`
- **Status**: ✅ Deployed and verified on live site
- **Commit**: `9a2ad28` - "Fix white screen: persistent iframe + unified backgrounds"
- **Result**: Live site working again, features restored (Finanzas, WhatsApp, Torre)

### 2. New Fix Implementation (COMPLETED)
- **Branch**: `cursor/fix-flicker-double-buffer-final-6063`
- **PR**: [#21](https://github.com/ralborta/andreu-remitos/pull/21)
- **Commits**: 
  - `03f16b1` - Fix navigation flicker: double-buffer with rAF x2, fix bridge.js
  - `b00faf6` - Add manual testing guide

### 3. Code Changes

#### StitchFrame.tsx
```typescript
// BEFORE: Used fonts.ready (unreliable for paint completion)
iframeDocument.fonts.ready.then(() => {
  swapped = true;
  setShowNext(true);
  ...
});

// AFTER: Use requestAnimationFrame x2 (ensures painted)
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    if (swapped) return;
    swapped = true;
    setShowNext(true);
    setCurrentSrc(nextSrc);
    setNextSrc(null);
  });
});
```

#### bridge.js - Three Critical Fixes

**Fix 1: Timeout Increase**
```javascript
// BEFORE: 150ms timeout (too short)
setTimeout(function() { ... }, 150);

// AFTER: 1000ms timeout (sufficient for ack)
setTimeout(function() { ... }, 1000);
```

**Fix 2: Conditional target="_parent"**
```javascript
// BEFORE: Always set target="_parent" (causes native navigation)
el.setAttribute("target", "_parent");

// AFTER: Only set when NOT inside shell
if (window.parent === window) {
  el.setAttribute("target", "_parent");
}
```

**Fix 3: Delegated Listener**
```javascript
// NEW: Catch ALL nav clicks, even dynamic elements
document.addEventListener("click", function(e) {
  var target = e.target;
  while (target && target !== document) {
    if ((target.tagName === "A" || target.tagName === "BUTTON") 
        && target.getAttribute("href")) {
      var href = routeFor(target);
      if (href) {
        e.preventDefault();
        e.stopPropagation();
        go(href);
        return;
      }
    }
    target = target.parentElement;
  }
}, true); // true = capture phase
```

## 🎯 Root Cause Analysis

### Why Previous Attempts Failed

**PR #17**: Iframe in layout, but bridge.js still used `window.top.location.href`
- **Issue**: Full page reload on every nav click
- **Evidence**: Browser tab spinner, blank white pages

**PR #18**: postMessage navigation, but iframe src still changed
- **Issue**: New document loads caused blank frames
- **Evidence**: Caught blank frame on Viajes ~1.5s after click

**Commit 9a2ad28**: Double-buffer with fonts.ready
- **Issue**: fonts.ready doesn't guarantee painting complete
- **Evidence**: Owner still saw white screen (browser hadn't painted yet)

**PR #20**: innerHTML content swap
- **Issue**: Removed event listeners, broke page scripts
- **Evidence**: Navigation broke after first click, Finanzas/WhatsApp/Torre failed
- **Why**: bridge.js bind() added listeners to DOM elements, innerHTML replaced them

### Why This Fix Should Work

1. **requestAnimationFrame x2**: Browser spec guarantees next two animation frames wait for paint
2. **No target="_parent"**: Inside shell, links never use native navigation
3. **1000ms timeout**: Sufficient time for slow postMessage ack
4. **Delegated listener**: Catches ALL clicks, even on elements added later
5. **Real iframes**: Each page is full document, bridge.js and scripts run normally

## 📋 Next Steps (User/Owner Actions)

### Step 1: Review PR
- Read PR description: https://github.com/ralborta/andreu-remitos/pull/21
- Read MANUAL_TEST_GUIDE.md for testing procedure
- Understand changes and rollback plan

### Step 2: Deploy to Test Environment (Optional)
If you have a staging environment:
1. Merge PR #21 to staging branch
2. Deploy to staging
3. Run all tests from MANUAL_TEST_GUIDE.md
4. Verify no white screen, all features work

### Step 3: Deploy to Production (sol-borrador)
**⚠️ ONLY after manual verification passes**

```bash
# Merge PR
gh pr merge 21 --merge

# OR manually:
git checkout sol-borrador
git merge cursor/fix-flicker-double-buffer-final-6063
git push origin sol-borrador
```

### Step 4: Verify Live Deployment
**IMMEDIATELY after deploy, test on live:**

1. Open https://transitone-transitone-borrador.wd75db.easypanel.host/
2. Open DevTools Console
3. Run: `window.__shellMarker = Date.now()`
4. Click through ALL menu items TWICE
5. Check: `window.__shellMarker` (must be unchanged)
6. Check: `performance.getEntriesByType('navigation').length` (must be 1)
7. Test all features: Viajes tabs, Finanzas modal, WhatsApp, Destinos, Torre, Monitor

### Step 5: If Tests Fail - IMMEDIATE REVERT
**DO NOT WAIT - Revert immediately if:**
- Any white screen visible
- Any feature broken
- Console errors appear

```bash
git checkout sol-borrador
git reset --hard 9a2ad28
git push --force-with-lease origin sol-borrador
```

## 🔍 Verification Evidence

### Pre-Deployment Checks (Completed)
- ✅ TypeScript compiles: No errors
- ✅ bridge.js syntax: Valid
- ✅ Stitch pages load: Torre.html loads bridge.js
- ✅ Git history clean: Clear revert + fix commits

### Post-Deployment Checks (Required)
- [ ] No white screen on any navigation
- [ ] Top window never reloads (marker test)
- [ ] All 9 menu items work
- [ ] Viajes tabs work
- [ ] Finanzas modal works
- [ ] WhatsApp chat loads
- [ ] Destinos map loads
- [ ] Torre KPIs load
- [ ] Monitor data loads
- [ ] Browser back/forward work
- [ ] Direct URL loads work

## 📊 Risk Assessment

### Low Risk ✅
- Changes are minimal and targeted
- StitchFrame: Only swap timing changed (rAF x2)
- bridge.js: Only navigation-related changes
- No data model changes
- No API changes
- Rollback is instant (one git reset)

### Medium Risk ⚠️
- Owner has seen failures on 4 previous attempts
- Automated tests couldn't catch the issue
- Must rely on manual testing
- Production environment behavior may differ from local

### Mitigation ✅
- Emergency revert completed FIRST
- Clear rollback plan documented
- Manual testing guide created
- PR includes all context and reasoning
- Test ALL features, not just navigation

## 🎓 Lessons Learned

1. **Automated tests insufficient**: Browser paint timing issues require visual inspection
2. **innerHTML is fragile**: Breaks event listeners and scripts
3. **fonts.ready ≠ painted**: Need rAF x2 for guaranteed paint
4. **Delegated listeners required**: Dynamic content needs capture-phase delegation
5. **Always test live**: Local/production differences matter

## 📞 Support

If issues occur:
1. Check MANUAL_TEST_GUIDE.md
2. Check PR #21 description
3. Review this summary
4. Revert if needed (don't debug in production)

---

**Status**: ✅ Ready for manual testing and deployment
**PR**: https://github.com/ralborta/andreu-remitos/pull/21
**Branch**: `cursor/fix-flicker-double-buffer-final-6063`
**Base**: `sol-borrador` (at commit `9a2ad28`)
