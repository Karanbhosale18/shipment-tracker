import test from "node:test";
import assert from "node:assert/strict";
import { canTransition, STATUSES, TRANSITIONS } from "./statuses";

test("happy path is allowed", () => {
  assert.ok(canTransition("BOOKED", "IN_TRANSIT"));
  assert.ok(canTransition("IN_TRANSIT", "CUSTOMS_HOLD"));
  assert.ok(canTransition("CUSTOMS_HOLD", "IN_TRANSIT"));
  assert.ok(canTransition("OUT_FOR_DELIVERY", "DELIVERED"));
});

test("cannot skip or go backwards", () => {
  assert.equal(canTransition("BOOKED", "DELIVERED"), false);
  assert.equal(canTransition("IN_TRANSIT", "BOOKED"), false);
});

test("terminal states have no exits", () => {
  assert.equal(TRANSITIONS.DELIVERED.length, 0);
  assert.equal(TRANSITIONS.CANCELLED.length, 0);
});

test("every status has a transition entry", () => {
  for (const s of STATUSES) assert.ok(s in TRANSITIONS);
});
