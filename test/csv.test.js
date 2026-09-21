import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { priceCsv, resultsCsv } from "../src/csv.js";

test("prices a UK listing batch and audits the current price", () => {
  const [row] = priceCsv("sku,desired_profit,product_cost,shipping_charged,shipping_cost,current_price\nMUG-1,10,6,3.5,3.2,10");
  assert.equal(row.sku, "MUG-1");
  assert.equal(row.location, "GB");
  assert.ok(row.minimum_list_price > 10);
  assert.equal(row.audit, "raise price");
});

test("supports quoted SKUs and exports priced results", () => {
  const results = priceCsv('sku,location,desired_profit,product_cost,shipping_charged,shipping_cost\n"MUG, BLUE",US,8,4,5,4');
  const exported = resultsCsv(results);
  assert.match(exported, /"MUG, BLUE"/);
  assert.match(exported, /minimum_list_price/);
});

test("rejects missing required columns", () => {
  assert.throws(() => priceCsv("sku,desired_profit\nA,10"), /Missing required column/);
});

test("sample CSV produces list prices and margin audits end to end", async () => {
  const sample = await readFile(new URL("../sample-listings.csv", import.meta.url), "utf8");
  const results = priceCsv(sample);
  const exported = resultsCsv(results);

  assert.equal(results.length, 3);
  assert.deepEqual(results.map(({ sku, audit }) => [sku, audit]), [
    ["CERAMIC-MUG", "target met"],
    ["LINEN-TOTE", "target met"],
    ["ART-PRINT", "raise price"],
  ]);
  assert.ok(results.every((row) => row.minimum_list_price > 0));
  assert.match(exported, /minimum_list_price/);
  assert.match(exported, /projected_profit/);
  assert.match(exported, /raise price/);
});
