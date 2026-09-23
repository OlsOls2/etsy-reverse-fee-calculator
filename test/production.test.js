import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readText = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("publishes complete social metadata and consent-gated GA4", async () => {
  const [html, analytics, build] = await Promise.all([
    readText("../index.html"),
    readText("../analytics.js"),
    readText("../scripts/build.mjs"),
  ]);

  assert.match(html, /property="og:image" content="https:\/\/takehomefees\.online\/social-card\.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /name="twitter:image" content="https:\/\/takehomefees\.online\/social-card\.png"/);
  assert.match(html, /<script src="\.\/analytics\.js" defer><\/script>/);
  assert.match(html, /<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml">/);
  assert.match(build, /"analytics\.js"/);
  assert.match(build, /"favicon\.svg"/);
  assert.match(build, /"social-card\.png"/);
  assert.match(build, /https:\/\/takehomefees\.online\//);
  assert.match(analytics, /G-XECHZYT8G1/);
  assert.match(analytics, /reverseprice\.analytics-consent\.v1/);
  assert.match(analytics, /consent\(\) !== "granted"/);
  assert.match(analytics, /url\.searchParams\.delete\("session_id"\)/);
  assert.match(analytics, /allow_google_signals: false/);
  assert.match(analytics, /allow_ad_personalization_signals: false/);
});

test("social card is a 1200 by 630 PNG", async () => {
  const image = await readFile(new URL("../social-card.png", import.meta.url));
  assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(image.readUInt32BE(16), 1200);
  assert.equal(image.readUInt32BE(20), 630);
});

test("publishes legal pages, footer links and a pre-purchase CSV sample", async () => {
  const [html, terms, privacy, sample, build, server] = await Promise.all([
    readText("../index.html"), readText("../terms/index.html"), readText("../privacy/index.html"),
    readText("../sample-listings.csv"), readText("../scripts/build.mjs"), readText("../functions/server.js"),
  ]);
  assert.match(html, /href="\/terms\/"/);
  assert.match(html, /href="\/privacy\/"/);
  assert.match(html, /Download sample CSV/);
  assert.match(sample, /sku,desired_profit,product_cost,shipping_charged,shipping_cost/);
  assert.match(terms, /Mizzen Studios/);
  assert.match(terms, /mailto:support@json-translate\.com/);
  assert.match(privacy, /localStorage/);
  assert.match(privacy, /CSV files never leave/);
  assert.match(privacy, /Google Analytics 4/);
  assert.match(privacy, /mailto:support@json-translate\.com/);
  assert.doesNotMatch(`${terms}\n${privacy}`, /CONTACT_EMAIL/);
  assert.doesNotMatch(`${terms}${privacy}`, /support@mizzen-studios\.com/);
  for (const page of [html, terms, privacy]) {
    assert.match(page, /href="\/terms\/"/);
    assert.match(page, /href="\/privacy\/"/);
  }
  assert.match(build, /"terms"/);
  assert.match(server, /statement_descriptor_suffix: "REVERSE FEE"/);
  assert.match(server, /price_1UI33sDBB6JJzhj63kTs5xhg/);
  assert.match(server, /Etsy Reverse Fee — CSV Pro lifetime unlock/);
  assert.match(server, /const ORIGIN = "https:\/\/takehomefees\.online"/);
});
