import test from "node:test";
import assert from "node:assert/strict";
import { LOCATIONS, calculateBreakdown, findMinimumListPrice } from "../src/fees.js";

test("UK item fee maths uses current transaction, processing and regulatory rates", () => {
  const result = calculateBreakdown({
    location: LOCATIONS.GB,
    listPrice: 20,
    shippingCharged: 0,
    productCost: 5,
    shippingCost: 0,
    offsiteRate: 0,
    feeTaxRate: 0,
    listingFee: 0.15
  });

  assert.equal(result.transactionFee, 1.3);
  assert.equal(result.paymentProcessingFee, 1);
  assert.equal(result.regulatoryFee, 0.1);
  assert.equal(result.totalFees, 2.55);
  assert.equal(result.profit, 12.45);
});

test("shipping charged is fee-bearing while actual shipping is a separate cost", () => {
  const noShipping = calculateBreakdown({
    location: LOCATIONS.GB,
    listPrice: 20,
    shippingCharged: 0,
    shippingCost: 4,
    feeTaxRate: 0,
    listingFee: 0.15
  });
  const chargedShipping = calculateBreakdown({
    location: LOCATIONS.GB,
    listPrice: 20,
    shippingCharged: 4,
    shippingCost: 4,
    feeTaxRate: 0,
    listingFee: 0.15
  });

  assert.equal(chargedShipping.orderTotal, 24);
  assert.equal(chargedShipping.transactionFee, 1.56);
  assert.equal(chargedShipping.paymentProcessingFee, 1.16);
  assert.ok(Math.abs((chargedShipping.profit - noShipping.profit) - 3.56) < 1e-9);
});

test("Offsite Ads off, 15% and 12% produce the expected fee", () => {
  const base = {
    location: LOCATIONS.US,
    listPrice: 40,
    shippingCharged: 5,
    productCost: 0,
    shippingCost: 0,
    feeTaxRate: 0,
    listingFee: 0.2
  };

  assert.equal(calculateBreakdown({ ...base, offsiteRate: 0 }).offsiteAdsFee, 0);
  assert.equal(calculateBreakdown({ ...base, offsiteRate: 0.15 }).offsiteAdsFee, 6.75);
  assert.equal(calculateBreakdown({ ...base, offsiteRate: 0.12 }).offsiteAdsFee, 5.4);
});

test("Offsite Ads fee respects the per-order cap", () => {
  const result = calculateBreakdown({
    location: LOCATIONS.US,
    listPrice: 1000,
    shippingCharged: 0,
    offsiteRate: 0.15,
    offsiteCap: 100
  });

  assert.equal(result.offsiteAdsFee, 100);
});

test("reverse calculator finds the minimum cent that still reaches target profit", () => {
  const input = {
    location: LOCATIONS.GB,
    desiredProfit: 10,
    productCost: 4,
    shippingCharged: 3,
    shippingCost: 3.5,
    offsiteRate: 0.15,
    feeTaxRate: 0.2,
    listingFee: 0.15,
    offsiteCap: 75
  };
  const result = findMinimumListPrice(input);
  const previous = calculateBreakdown({ ...input, listPrice: result.listPrice - 0.01 });

  assert.ok(result.profit >= input.desiredProfit);
  assert.ok(previous.profit < input.desiredProfit);
});

test("reverse calculator remains minimal across cent-rounding profit dips", () => {
  const input = {
    location: LOCATIONS.GB,
    desiredProfit: 0.8,
    productCost: 3.47,
    shippingCharged: 2.83,
    shippingCost: 2.19,
    offsiteRate: 0,
    feeTaxRate: 0.2,
    listingFee: 0.15,
    offsiteCap: 75
  };
  const result = findMinimumListPrice(input);
  const previous = calculateBreakdown({ ...input, listPrice: result.listPrice - 0.01 });

  assert.equal(result.listPrice, 5.09);
  assert.equal(result.profit, 0.8);
  assert.ok(previous.profit < input.desiredProfit);
});

test("reverse calculator rejects percentage settings that cannot be searched monotonically", () => {
  assert.throws(
    () => findMinimumListPrice({
      location: LOCATIONS.US,
      desiredProfit: 10,
      offsiteRate: 1
    }),
    /Combined percentage fees must be less than 100%/
  );
});

test("shipping revenue can cover the complete target and produce a zero list price", () => {
  const result = findMinimumListPrice({
    location: LOCATIONS.US,
    desiredProfit: 2,
    productCost: 1,
    shippingCharged: 10,
    shippingCost: 1,
    offsiteRate: 0,
    listingFee: 0.2
  });

  assert.equal(result.listPrice, 0);
  assert.ok(result.profit >= 2);
});

test("reverse results match a brute-force cent oracle across representative fee combinations", () => {
  const scenarios = [
    {
      location: LOCATIONS.GB,
      productCost: 7.35,
      shippingCharged: 0,
      shippingCost: 2.8,
      offsiteRate: 0,
      feeTaxRate: 0.2
    },
    {
      location: LOCATIONS.GB,
      productCost: 12.49,
      shippingCharged: 4.25,
      shippingCost: 3.95,
      offsiteRate: 0.15,
      feeTaxRate: 0.2
    },
    {
      location: LOCATIONS.US,
      productCost: 18.75,
      shippingCharged: 6.5,
      shippingCost: 5.25,
      offsiteRate: 0.12,
      feeTaxRate: 0
    },
    {
      location: LOCATIONS.US,
      productCost: 850,
      shippingCharged: 25,
      shippingCost: 20,
      offsiteRate: 0.15,
      offsiteCap: 100,
      feeTaxRate: 0
    }
  ];

  for (const scenario of scenarios) {
    for (const desiredProfit of [0, 0.01, 1, 9.99, 25, 125]) {
      const input = { ...scenario, desiredProfit };
      const actual = findMinimumListPrice(input);
      let expected;

      for (let cents = 0; cents <= Math.round(actual.listPrice * 100); cents += 1) {
        const candidate = calculateBreakdown({ ...input, listPrice: cents / 100 });
        if (candidate.profit >= desiredProfit) {
          expected = candidate;
          break;
        }
      }

      assert.ok(expected, `expected a brute-force result for ${JSON.stringify(input)}`);
      assert.equal(actual.listPrice, expected.listPrice, `minimum price for ${JSON.stringify(input)}`);
      assert.deepEqual(actual, expected);
    }
  }
});
