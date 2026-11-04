# Phase 1: Data Trust - Implementation Constraints

**CRITICAL**: Do NOT change anything that currently works.

---

## Allowed Changes (Visual/Display Only)

### ✅ SAFE - Display Formatting
- **Number display**: Replace `1234567` with `SOL_FORMAT.number(1234567)` → `1.234.567`
- **Currency display**: Replace `"$" + amount` with `SOL_FORMAT.currency(amount)` → `$1.234.567,00`
- **Weight display**: Replace `tons + " t"` with `SOL_FORMAT.weight(tons)` → `1,8 t`
- **Date display**: Replace `new Date().toString()` with `SOL_FORMAT.date(date)` → `04/11/2026`

**Rule**: Only change the **final rendering** step. Do NOT touch the data fetching, calculations, or storage.

### ✅ SAFE - Label Translations
- **Status badges**: Replace `<span>{status}</span>` with `SOL_FORMAT.statusBadge(status)`
- **Dropdown options**: Translate labels while keeping values unchanged

**Rule**: Only change **displayed text**. Backend values stay in English/snake_case.

### ✅ SAFE - UI Additions
- **Demo badges**: Add `SOL_FORMAT.demoBadge()` next to hardcoded numbers
- **Confirmation modals**: Add modal BEFORE action, action itself unchanged

**Rule**: Add UI elements without modifying existing behavior.

---

## FORBIDDEN Changes

### ❌ NO Backend Changes
- Do NOT modify routes in `backend/src/routes/`
- Do NOT change API endpoints
- Do NOT alter database queries
- Do NOT change validation logic (unless fixing a bug like price "abc")
- Do NOT modify service layer business logic

**Exception**: Only if explicitly required by audit (e.g., "DELETE returns 400 - fix endpoint")

### ❌ NO Data Flow Changes
- Do NOT change how data is fetched
- Do NOT modify API response structure
- Do NOT alter state management
- Do NOT change data calculations (except display formatting)

**Example**:
```javascript
// ❌ WRONG - Changes calculation
var total = items.reduce((sum, item) => sum + item.price, 0) * 1.21; // Added tax!

// ✅ RIGHT - Only formats display
var total = items.reduce((sum, item) => sum + item.price, 0);
displayTotal.textContent = SOL_FORMAT.currency(total);
```

### ❌ NO Logic Refactors
- Do NOT refactor working code "to make it cleaner"
- Do NOT consolidate functions "for DRY principles"
- Do NOT reorganize files "for better structure"

**Rule**: If it works, don't touch it unless audit specifically says to.

### ❌ NO Breaking Changes
- Do NOT remove existing functions/variables that might be used
- Do NOT rename functions/classes
- Do NOT change function signatures
- Do NOT alter HTML structure that JS depends on

---

## Safe Implementation Pattern

### Example: Format a Currency Display

**Current Code** (in `finanzas-live.js`):
```javascript
function renderAmount(amount) {
  var el = document.getElementById("total");
  el.textContent = "$" + amount.toFixed(2);
}
```

**✅ SAFE Change** (display only):
```javascript
function renderAmount(amount) {
  var el = document.getElementById("total");
  el.textContent = SOL_FORMAT.currency(amount); // Only changed display
}
```

**❌ UNSAFE Change** (modifies logic):
```javascript
function renderAmount(amount) {
  var el = document.getElementById("total");
  var withTax = amount * 1.21; // DON'T ADD LOGIC!
  el.textContent = SOL_FORMAT.currency(withTax);
}
```

### Example: Translate Status

**Current Code**:
```javascript
function showStatus(status) {
  badge.textContent = status; // Shows "NOT_STARTED"
}
```

**✅ SAFE Change**:
```javascript
function showStatus(status) {
  badge.innerHTML = SOL_FORMAT.statusBadge(status); // Shows "Sin iniciar" with color
}
```

**❌ UNSAFE Change**:
```javascript
function showStatus(status) {
  // DON'T change the status value being sent to backend!
  var translated = SOL_FORMAT.status(status);
  api.updateTrip(tripId, { status: translated }); // WRONG - breaks backend
}
```

---

## Regression Testing Requirements

### Before Merging ANY PR

1. **Deploy to sol-borrador**
2. **Wait for Easypanel deploy** (~30-60 seconds)
3. **Run full regression checklist** (`REGRESSION_CHECKLIST.md`)
4. **Document results**

### If Regression Found

1. **STOP immediately**
2. **Create revert PR**: `git revert <commit> -m "Revert: regression found in <flow>"`
3. **Merge revert** to restore working state
4. **Investigate offline**
5. **Re-apply with fix** in new PR

### Zero Tolerance

- If login breaks: REVERT
- If any CRUD operation fails: REVERT
- If navigation stops working: REVERT
- If data disappears: REVERT
- If error appears that wasn't there before: REVERT

**Better to have 10 safe small PRs than 1 that breaks production.**

---

## Phase 1 Application Strategy

### Incremental Screen-by-Screen

Instead of changing all files at once:

1. **PR 1A**: Torre dashboard only
   - Test: Torre works exactly as before, just prettier numbers
   
2. **PR 1B**: Viajes only
   - Test: Viajes CRUD works exactly as before, just prettier weights/dates
   
3. **PR 1C**: Finanzas only
   - Test: Finanzas calculations identical, just prettier currency display
   
4. **PR 1D**: Marketing only
   - Test: Marketing CRUD works exactly as before, just Spanish labels

**Each PR**: Independent, tested, merged only if regression-free.

---

## Example: Money Confirmation Modal

### Requirement from Audit
> "Acciones de dinero sin jerarquía: Cobrar, Conciliar, Pagar necesitan confirmación"

### ✅ SAFE Implementation
```javascript
// In finanzas-live.js

// 1. Create modal (new code, doesn't break anything)
function showConfirmModal(action, amount, callback) {
  var modal = document.getElementById("confirm-modal");
  modal.querySelector(".action").textContent = action;
  modal.querySelector(".amount").textContent = SOL_FORMAT.currency(amount);
  modal.classList.remove("hidden");
  
  modal.querySelector(".confirm-btn").onclick = function() {
    modal.classList.add("hidden");
    callback(); // Execute original action unchanged
  };
}

// 2. Wrap existing action (minimal change)
function cobrar(invoiceId, amount) {
  showConfirmModal("Cobrar", amount, function() {
    // Original logic UNCHANGED
    api.post("/api/finanzas/cobrar", { invoiceId, amount })
      .then(handleSuccess)
      .catch(handleError);
  });
}
```

**What's safe**:
- Added modal (new UI, doesn't break existing)
- Wrapped action with confirmation (same action runs after confirm)
- Original API call and logic UNTOUCHED

**What would be UNSAFE**:
- Changing the API endpoint
- Modifying the amount calculation
- Adding new validation that might reject valid data
- Changing error handling logic

---

## Summary

**Golden Rule**: If you're not 100% sure a change is purely visual/display, DON'T make it.

**When in doubt**: Ask "Would removing this change break functionality?" If yes, it's a logic change - forbidden unless explicitly required by audit.

**Motto**: Make it prettier, not different.

---

**Last Updated**: Nov 4, 2026 - 1:58 AM UTC
