import { FEE_DATA_UPDATED, LOCATIONS, findMinimumListPrice } from "./fees.js";
import { priceCsv, resultsCsv } from "./csv.js";

const BILLING_API = "__BILLING_API__";
const ENTITLEMENT_KEY = "reverseprice.csv-pro.session.v1";

const form = document.querySelector("#calculator-form");
const locationInput = document.querySelector("#location");
const updatedDate = document.querySelector("#fee-date");
const locationName = document.querySelector("#location-name");
const assumptionNote = document.querySelector("#assumption-note");
const feeTaxRow = document.querySelector("#fee-tax-row");
const feeTaxInput = document.querySelector("#fee-tax");
const listingFeeInput = document.querySelector("#listing-fee");
const offsiteCapInput = document.querySelector("#offsite-cap");
const currencyLabels = [...document.querySelectorAll("[data-currency-symbol]")];
const proCheckout = document.querySelector("#pro-checkout");
const proNote = document.querySelector("#pro-note");
const proWorkspace = document.querySelector("#pro-workspace");
const csvFile = document.querySelector("#csv-file");
const csvDownload = document.querySelector("#csv-download");
const csvStatus = document.querySelector("#csv-status");
let pricedCsv = "";

const outputs = [...document.querySelectorAll("[data-output]")].reduce((map, element) => {
  const key = element.dataset.output;
  map[key] ??= [];
  map[key].push(element);
  return map;
}, {});

const money = (value, location) => new Intl.NumberFormat(location.locale, {
  style: "currency",
  currency: location.currency
}).format(value);

function readNumber(id) {
  const value = Number(document.querySelector(`#${id}`).value);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function setLocationDefaults() {
  const location = LOCATIONS[locationInput.value];
  listingFeeInput.value = location.listingFee.toFixed(2);
  offsiteCapInput.value = location.offsiteCap.toFixed(2);
  feeTaxInput.checked = location.feeTaxRate > 0;
  feeTaxRow.hidden = location.feeTaxRate === 0;
  currencyLabels.forEach((label) => { label.textContent = location.symbol; });
  assumptionNote.textContent = location.exchangeNote;
  locationName.textContent = location.name;
  calculate();
}

function calculate() {
  const location = LOCATIONS[locationInput.value];
  const selectedOffsite = form.querySelector("input[name='offsite-rate']:checked");

  try {
    const result = findMinimumListPrice({
      location,
      desiredProfit: readNumber("desired-profit"),
      productCost: readNumber("product-cost"),
      shippingCharged: readNumber("shipping-charged"),
      shippingCost: readNumber("shipping-cost"),
      offsiteRate: Number(selectedOffsite?.value ?? 0),
      feeTaxRate: feeTaxInput.checked ? location.feeTaxRate : 0,
      listingFee: readNumber("listing-fee"),
      offsiteCap: readNumber("offsite-cap")
    });

    const values = {
      listPrice: result.listPrice,
      orderTotal: result.orderTotal,
      listingFee: result.listingFee,
      transactionFee: result.transactionFee,
      paymentProcessingFee: result.paymentProcessingFee,
      regulatoryFee: result.regulatoryFee,
      offsiteAdsFee: result.offsiteAdsFee,
      feeTax: result.feeTax,
      totalFees: result.totalFees,
      productCost: result.productCost,
      shippingCost: result.shippingCost,
      profit: result.profit
    };

    Object.entries(values).forEach(([key, value]) => {
      outputs[key]?.forEach((element) => { element.textContent = money(value, location); });
    });

    document.querySelector("#regulatory-breakdown").hidden = location.regulatoryRate === 0;
    document.querySelector("#fee-tax-breakdown").hidden = result.feeTax === 0;
    document.querySelector("#offsite-breakdown").hidden = result.offsiteAdsFee === 0;
    document.querySelector("#result-card").classList.remove("has-error");
    document.querySelector("#calculation-error").hidden = true;
  } catch (error) {
    document.querySelector("#result-card").classList.add("has-error");
    const errorElement = document.querySelector("#calculation-error");
    errorElement.textContent = error.message;
    errorElement.hidden = false;
  }
}

async function billing(path, init) {
  const response = await fetch(`${BILLING_API}${path}`, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Payment service is unavailable.");
  return payload;
}

function activatePro() {
  proCheckout.textContent = "✓ CSV Pro active";
  proCheckout.disabled = true;
  proNote.textContent = "Payment verified with Stripe on this browser.";
  proWorkspace.hidden = false;
}

async function restorePro() {
  const params = new URLSearchParams(location.search);
  const returned = params.get("session_id");
  const sessionId = returned || localStorage.getItem(ENTITLEMENT_KEY);
  if (params.get("checkout") === "cancelled") proNote.textContent = "Checkout cancelled — no charge was made.";
  if (!sessionId) return;
  try {
    const entitlement = await billing(`/entitlement?session_id=${encodeURIComponent(sessionId)}`);
    if (entitlement.pro) {
      localStorage.setItem(ENTITLEMENT_KEY, sessionId);
      activatePro();
    } else if (returned) proNote.textContent = "Payment is not complete; CSV Pro remains locked.";
  } catch {
    localStorage.removeItem(ENTITLEMENT_KEY);
    if (returned) proNote.textContent = "The purchase could not be verified.";
  } finally {
    if (params.has("checkout") || params.has("session_id")) history.replaceState({}, "", `${location.pathname}#csv-pro`);
  }
}

proCheckout.addEventListener("click", async () => {
  proCheckout.disabled = true;
  proNote.textContent = "Opening secure Stripe Checkout…";
  try {
    const { url } = await billing("/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const target = new URL(url);
    if (target.protocol !== "https:" || !target.hostname.endsWith(".stripe.com")) throw new Error("Checkout returned an invalid destination.");
    location.assign(target.toString());
  } catch (error) {
    proCheckout.disabled = false;
    proNote.textContent = error.message;
  }
});

csvFile.addEventListener("change", async () => {
  const file = csvFile.files?.[0];
  if (!file) return;
  try {
    const results = priceCsv(await file.text());
    pricedCsv = resultsCsv(results);
    const raises = results.filter((row) => row.audit === "raise price").length;
    csvStatus.textContent = `${results.length} listing${results.length === 1 ? "" : "s"} priced · ${raises} below target.`;
    csvDownload.disabled = false;
  } catch (error) {
    pricedCsv = "";
    csvDownload.disabled = true;
    csvStatus.textContent = error.message;
  }
});

csvDownload.addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([pricedCsv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = "reverseprice-listing-prices.csv"; link.click();
  URL.revokeObjectURL(url);
});

updatedDate.dateTime = FEE_DATA_UPDATED;
updatedDate.textContent = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric"
}).format(new Date(`${FEE_DATA_UPDATED}T00:00:00Z`));

locationInput.addEventListener("change", setLocationDefaults);
form.addEventListener("input", calculate);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  calculate();
});

setLocationDefaults();
restorePro();
