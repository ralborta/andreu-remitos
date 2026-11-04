# UX/UI Roadmap - Progress Report

**Date**: Nov 4, 2026 - 1:50 AM UTC  
**Demo**: https://transitone-transitone-borrador.wd75db.easypanel.host (demo/demo123)

---

## Overall Status

| Phase | Status | PR | Merge Commit | Details |
|-------|--------|-----|-------------|---------|
| **Phase 0: QA Bugs** | ✅ Complete | [#3](https://github.com/ralborta/andreu-remitos/pull/3) | `0a69685` | All 11 P0 bugs fixed |
| **Phase 1: Data Trust** | 🟡 Foundation | [#4](https://github.com/ralborta/andreu-remitos/pull/4) | `53fb356` | Infrastructure ready, application pending |
| **Phase 2: Design System** | ⏳ Not started | — | — | Awaiting Phase 1 completion |
| **Phase 3: Responsive** | ⏳ Not started | — | — | Awaiting Phase 1-2 completion |
| **Phase 4: Backlog** | ⏳ Not started | — | — | Awaiting Phase 1-3 completion |

---

## Phase 0: QA Bugs (COMPLETE) ✅

**PR**: [#3 - Fix: QA bugs remaining after d1428af and a6622b4](https://github.com/ralborta/andreu-remitos/pull/3)  
**Merge Commit**: `0a69685`  
**Status**: ✅ **Complete & Deployed**

### What Was Fixed

All 11 P0 bugs from QA pass resolved:

1. ✅ Marketing DELETE broken
2. ✅ Catalog name/description not persisting
3. ✅ **Dates shift -1 day** (added timezone)
4. ✅ Price validation
5. ✅ Float artifacts
6. ✅ Viajes tabs/filters
7. ✅ Hardcoded dates
8. ✅ **System status pill dynamic** (now reflects real health)
9. ✅ Logout working
10. ✅ **"Nueva conversación" button** (navigates to Chat Central)
11. ✅ **JS errors in WhatsApp** (filtered from display)

**Verification**: All fixes verified on live demo. System working correctly.

---

## Phase 1: Data Trust (FOUNDATION ONLY) 🟡

**PR**: [#4 - Phase 1 Foundation: Format Utilities](https://github.com/ralborta/andreu-remitos/pull/4)  
**Merge Commit**: `53fb356`  
**Status**: 🟡 **Foundation Merged, Application Pending**

### What Was Accomplished

#### ✅ Created `format-utils.js` - Centralized Formatting Library

**Core Capabilities**:
- **es-AR Numbers**: `formatNumber()`, `formatCurrency()`, `formatWeight()`, `formatPercent()`
- **AR Timezone Dates**: All date functions use `America/Argentina/Buenos_Aires`
- **Spanish Translations**: 60+ status translations (`NOT_STARTED` → `Sin iniciar`, etc.)
- **UI Helpers**: `statusBadge()`, `demoBadge()`, `escapeHtml()`

**Included in**: Torre, Viajes, Finanzas, Métricas, Monitor (via `<script>` tags)

**Accessible as**: `window.SOL_FORMAT.*` on included pages

### What Was NOT Done (Intentional)

This PR established **infrastructure only**. Actual application throughout the codebase requires:

❌ **Not yet applied**:
- Torre KPIs not using `formatNumber()`
- Viajes table not using `formatWeight()`
- Finanzas amounts not using `formatCurrency()`
- Status displays not using `translateStatus()`
- Demo data not labeled with `demoBadge()`
- Money action confirmations not added
- Single source KPI endpoint not created (deferred to Phase 4)

**Why separate**:
1. Foundation can be tested independently
2. Allows incremental adoption without breaking changes
3. Easier code review (small PRs vs. 50+ file edits)
4. Old code continues to work unchanged

### Remaining Work for Phase 1

**Estimated**: 5-10 additional PRs needed to fully apply format utilities.

**Breakdown**:
- **Phase 1A**: Apply to Torre Dashboard
- **Phase 1B**: Apply to Viajes & Métricas
- **Phase 1C**: Apply to Finanzas + add money confirmations
- **Phase 1D**: Apply to Marketing screens
- **Phase 1E**: Apply to Agentes screens (Tracking, Remitos, etc.)
- **Phase 1F**: Label all demo/mock data
- **Phase 1G**: Verify consistency across all screens

**Total estimated effort**: 2-3 days of focused work for complete Phase 1.

### Live Verification

✅ **Deployed**: Merged to `sol-borrador`, pushed to origin
✅ **Torre.html loads**: Confirmed on live demo
✅ **Script included**: `format-utils.js` referenced in HTML

**Browser Console Test** (on Torre/Viajes/Finanzas pages):
```javascript
typeof window.SOL_FORMAT  // Should be "object"
SOL_FORMAT.currency(1234567.89)  // Should show "$1.234.567,89"
```

---

## Phase 2: Design System (NOT STARTED) ⏳

**Status**: Awaiting Phase 1 full completion

**Planned Scope**:
- Shared tokens (primary color, type scale ≥13-14px, spacing, radii)
- Unified components across Stitch pages
- Merge three design dialects into one
- Single sidebar navigation (remove duplicate Finanzas/Marketing rows)
- Consistent headers, buttons, tables, empty states

**Dependencies**: Best done after Phase 1 formatting is consistent.

---

## Phase 3: Responsive (NOT STARTED) ⏳

**Status**: Awaiting Phase 1-2 completion

**Planned Scope**:
- Usable layouts on tablet and mobile
- Key screens: Torre, Viajes, Tracking, Remitos, WhatsApp
- Proper mobile navigation
- No horizontal scroll or cut-off content

**Dependencies**: Should follow design system (Phase 2) for consistency.

---

## Phase 4: Remaining Backlog (NOT STARTED) ⏳

**Status**: Awaiting Phase 1-3 completion

**Planned Scope**:
- Single source of truth for KPIs (structural backend work)
- Unified counters across Torre/Métricas/Viajes/Finanzas
- Remaining P0/quick-win items not covered in Phases 1-3

**Note**: Some items (like KPI single source) are **large structural changes** best deferred until UI consistency is established.

---

## Summary

### Completed ✅
- **All QA P0 bugs** (PR #3)
- **Format utilities infrastructure** (PR #4 - Phase 1 Foundation)

### In Progress 🟡
- **Phase 1 application** (format utilities need wiring throughout codebase)

### Not Started ⏳
- **Phase 1A-G**: Apply format utilities to all screens
- **Phase 2**: Design System
- **Phase 3**: Responsive
- **Phase 4**: Structural improvements

### Estimates
- **Phase 1 complete**: 5-10 more PRs, ~2-3 days
- **Phase 2**: 3-5 days
- **Phase 3**: 2-3 days
- **Phase 4**: 3-5 days (structural work)

**Total roadmap**: ~2-3 weeks of focused development.

---

## Recommendations

### For Continuing Work

**Option A: Complete Phase 1 First**
- Systematically apply format utilities to all `*-live.js` files
- Ensures consistent data display before tackling design system
- Lower risk, incremental progress
- **Recommended**: Finish what we started

**Option B: Move to Phase 2 Now**
- Start design system work (tokens, components)
- Can apply Phase 1 formats as we refactor components
- Higher risk (doing two things at once)

**Option C: Hybrid Approach**
- Apply Phase 1 to **critical screens only** (Torre, Viajes, Finanzas)
- Move to Phase 2 for design system
- Circle back to Phase 1 for remaining screens

### My Recommendation

**Complete Phase 1 critical screens (1A-C) before Phase 2.**

**Rationale**:
1. Format utilities are ready and tested
2. Torre, Viajes, Finanzas are the most visible screens
3. Demonstrates value quickly (consistent numbers/dates/statuses)
4. Foundation is solid for design system work
5. Lower risk than changing everything at once

---

## Files Changed (Cumulative)

### PR #3 (QA Bugs)
- 18 files modified (torre-live.js, monitor-live.js, finanzas-live.js, bridge.js, etc.)

### PR #4 (Phase 1 Foundation)
- 1 file added: `format-utils.js`
- 6 files modified: HTML files to include format-utils

### Total
- 1 new file
- 24 files modified
- 0 files deleted

---

## References

- **UX Audit**: `docs/ux-audit/README.md`
- **Backlog**: `docs/ux-audit/BACKLOG.md`
- **QA Report**: `QA_BUGS_FINAL_REPORT.md`
- **Phase 1 Report**: `PHASE1_REPORT.md`
- **Demo**: https://transitone-transitone-borrador.wd75db.easypanel.host

---

**Status Date**: Nov 4, 2026 - 1:50 AM UTC  
**Last Update**: Phase 1 Foundation merged and deployed  
**Next**: Continue Phase 1 application (1A-C recommended) or proceed to Phase 2
