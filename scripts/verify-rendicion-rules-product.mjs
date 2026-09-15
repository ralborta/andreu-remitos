/**
 * Verifica: SOL no exige viaje Delfos; Andreu sí.
 */
import assert from "node:assert/strict";

process.env.PRODUCT_PROFILE = "sol";
const sol = await import("../lib/rendicion-rules.mjs");
assert.equal(sol.getProductId(), "sol");
assert.equal(sol.getRendicionRules().requireNroViajeDelfosOnApprove, false);

process.env.PRODUCT_PROFILE = "andreu";
// Re-import won't re-evaluate getProductId from env if module cached —
// getProductId reads env each call, so OK.
assert.equal(sol.getProductId(), "andreu");
assert.equal(sol.getRendicionRules().requireNroViajeDelfosOnApprove, true);

console.log("OK verify-rendicion-rules-product");
