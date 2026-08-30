"use strict";

const assert = require("assert");
const { validateCart, COURSES, normalizeOrigin } = require("../server");

const valid = validateCart([
  { courseId: "atelier-paris", date: "2026-09-13", quantity: 2 },
  { courseId: "atelier-clichy", date: "2026-09-20", quantity: 1 }
]);

assert(valid, "valid cart must pass");
assert.strictEqual(valid.total, "60.00");
assert.strictEqual(valid.items.length, 2);

const merged = validateCart([
  { courseId: "atelier-paris", date: "2026-09-13", quantity: 1 },
  { courseId: "atelier-paris", date: "2026-09-13", quantity: 2 }
]);
assert(merged);
assert.strictEqual(merged.items.length, 1);
assert.strictEqual(merged.items[0].quantity, 3);

assert.strictEqual(validateCart([]), null);
assert.strictEqual(validateCart([{ courseId: "fake", date: "2026-09-13", quantity: 1 }]), null);
assert.strictEqual(validateCart([{ courseId: "atelier-paris", date: "2026-01-01", quantity: 1 }]), null);
assert.strictEqual(validateCart([{ courseId: "atelier-paris", date: "2026-09-13", quantity: 5 }]), null);
assert.strictEqual(validateCart([
  { courseId: "atelier-paris", date: "2026-09-13", quantity: 3 },
  { courseId: "atelier-paris", date: "2026-09-13", quantity: 2 }
]), null);

assert.strictEqual(normalizeOrigin("https://example.com/path/"), "https://example.com");
assert.strictEqual(COURSES["atelier-paris"].price, 20);

console.log("Tests serveur BY FIGGY : OK");
