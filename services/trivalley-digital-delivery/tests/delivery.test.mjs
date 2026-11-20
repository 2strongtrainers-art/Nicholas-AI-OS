import test from "node:test";
import assert from "node:assert/strict";
import { eligibleSession, validCheckoutSessionId } from "../src/index.js";

const env = {
  PAYMENT_LINK_ID: "plink_expected",
  EXPECTED_AMOUNT: "3900",
  EXPECTED_CURRENCY: "usd",
  REQUIRE_LIVE: "true",
};

test("accepts a valid live Checkout Session id format", () => {
  assert.equal(validCheckoutSessionId("cs_live_abc123XYZ"), true);
  assert.equal(validCheckoutSessionId("cs_test_abc123XYZ"), true);
});

test("rejects malformed Checkout Session ids", () => {
  for (const value of ["", "pi_123", "cs_live_", "../cs_live_123", null]) {
    assert.equal(validCheckoutSessionId(value), false);
  }
});

test("accepts only the exact paid live product purchase", () => {
  assert.equal(
    eligibleSession(
      {
        payment_status: "paid",
        payment_link: "plink_expected",
        amount_total: 3900,
        currency: "usd",
        livemode: true,
      },
      env,
    ),
    true,
  );
});

test("fails closed for wrong payment link, amount, currency, status, or mode", () => {
  const base = {
    payment_status: "paid",
    payment_link: "plink_expected",
    amount_total: 3900,
    currency: "usd",
    livemode: true,
  };

  for (const patch of [
    { payment_status: "unpaid" },
    { payment_link: "plink_other" },
    { amount_total: 1 },
    { currency: "eur" },
    { livemode: false },
  ]) {
    assert.equal(eligibleSession({ ...base, ...patch }, env), false);
  }
});
