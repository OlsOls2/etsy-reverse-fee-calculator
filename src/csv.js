import { LOCATIONS, findMinimumListPrice } from "./fees.js";

const REQUIRED = ["sku", "desired_profit", "product_cost", "shipping_charged", "shipping_cost"];

function rows(text) {
  const output = [];
  let row = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell); if (row.some((value) => value.trim())) output.push(row); row = []; cell = "";
    } else cell += char;
  }
  row.push(cell); if (row.some((value) => value.trim())) output.push(row);
  return output;
}

function number(value, label, rowNumber, fallback = 0) {
  if (value == null || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Row ${rowNumber}: ${label} must be zero or more.`);
  return parsed;
}

export function priceCsv(text) {
  const parsed = rows(text);
  if (parsed.length < 2) throw new Error("Add a header and at least one listing row.");
  const headers = parsed[0].map((value) => value.trim().toLowerCase());
  for (const field of REQUIRED) if (!headers.includes(field)) throw new Error(`Missing required column: ${field}`);

  return parsed.slice(1).map((values, index) => {
    const source = Object.fromEntries(headers.map((header, column) => [header, values[column]?.trim() ?? ""]));
    const rowNumber = index + 2;
    const locationCode = (source.location || "GB").toUpperCase();
    const location = LOCATIONS[locationCode];
    if (!location) throw new Error(`Row ${rowNumber}: location must be GB or US.`);
    const desiredProfit = number(source.desired_profit, "desired_profit", rowNumber);
    const result = findMinimumListPrice({
      location,
      desiredProfit,
      productCost: number(source.product_cost, "product_cost", rowNumber),
      shippingCharged: number(source.shipping_charged, "shipping_charged", rowNumber),
      shippingCost: number(source.shipping_cost, "shipping_cost", rowNumber),
      offsiteRate: number(source.offsite_rate, "offsite_rate", rowNumber),
      feeTaxRate: source.fee_tax_rate === "" || source.fee_tax_rate == null ? location.feeTaxRate : number(source.fee_tax_rate, "fee_tax_rate", rowNumber),
      listingFee: source.listing_fee === "" || source.listing_fee == null ? location.listingFee : number(source.listing_fee, "listing_fee", rowNumber),
      offsiteCap: source.offsite_cap === "" || source.offsite_cap == null ? location.offsiteCap : number(source.offsite_cap, "offsite_cap", rowNumber)
    });
    const currentPrice = source.current_price ? number(source.current_price, "current_price", rowNumber) : null;
    return {
      sku: source.sku || `row-${rowNumber}`,
      location: locationCode,
      desired_profit: desiredProfit,
      minimum_list_price: result.listPrice,
      buyer_total: result.orderTotal,
      estimated_fees: result.totalFees,
      projected_profit: result.profit,
      current_price: currentPrice,
      audit: currentPrice == null ? "not supplied" : currentPrice >= result.listPrice ? "target met" : "raise price"
    };
  });
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function resultsCsv(results) {
  const headers = ["sku", "location", "desired_profit", "minimum_list_price", "buyer_total", "estimated_fees", "projected_profit", "current_price", "audit"];
  return [headers, ...results.map((result) => headers.map((header) => result[header]))].map((row) => row.map(csvCell).join(",")).join("\n");
}
