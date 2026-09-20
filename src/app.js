import { FEE_DATA_UPDATED, LOCATIONS, findMinimumListPrice } from "./fees.js";

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
