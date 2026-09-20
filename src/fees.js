export const FEE_DATA_UPDATED = "2026-09-20";

export const LOCATIONS = Object.freeze({
  GB: Object.freeze({
    code: "GB",
    name: "United Kingdom",
    currency: "GBP",
    locale: "en-GB",
    symbol: "£",
    transactionRate: 0.065,
    paymentRate: 0.04,
    paymentFixed: 0.2,
    regulatoryRate: 0.0048,
    listingFee: 0.15,
    feeTaxRate: 0.2,
    offsiteCap: 75,
    exchangeNote: "The listing fee and Offsite Ads cap are GBP estimates because Etsy publishes them in USD. You can edit both below."
  }),
  US: Object.freeze({
    code: "US",
    name: "United States",
    currency: "USD",
    locale: "en-US",
    symbol: "$",
    transactionRate: 0.065,
    paymentRate: 0.03,
    paymentFixed: 0.25,
    regulatoryRate: 0,
    listingFee: 0.2,
    feeTaxRate: 0,
    offsiteCap: 100,
    exchangeNote: "Etsy publishes the listing fee and Offsite Ads cap in USD, so these values do not need converting."
  })
});

export function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function finiteNonNegative(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new RangeError(`${label} must be a non-negative number`);
  }
  return parsed;
}

export function calculateBreakdown(input) {
  const location = input.location ?? LOCATIONS.GB;
  const listPrice = finiteNonNegative(input.listPrice, "List price");
  const shippingCharged = finiteNonNegative(input.shippingCharged ?? 0, "Shipping charged");
  const productCost = finiteNonNegative(input.productCost ?? 0, "Product cost");
  const shippingCost = finiteNonNegative(input.shippingCost ?? 0, "Shipping cost");
  const offsiteRate = finiteNonNegative(input.offsiteRate ?? 0, "Offsite Ads rate");
  const feeTaxRate = finiteNonNegative(input.feeTaxRate ?? location.feeTaxRate, "Fee tax rate");
  const listingFeeInput = input.listingFee ?? location.listingFee;
  const listingFee = roundMoney(finiteNonNegative(listingFeeInput, "Listing fee"));
  const offsiteCap = finiteNonNegative(input.offsiteCap ?? location.offsiteCap, "Offsite Ads cap");
  const orderTotal = roundMoney(listPrice + shippingCharged);

  const transactionFee = roundMoney(orderTotal * location.transactionRate);
  const paymentProcessingFee = roundMoney(orderTotal * location.paymentRate + location.paymentFixed);
  const regulatoryFee = roundMoney(orderTotal * location.regulatoryRate);
  const offsiteAdsFee = roundMoney(Math.min(orderTotal * offsiteRate, offsiteCap));
  const feesBeforeTax = roundMoney(
    listingFee + transactionFee + paymentProcessingFee + regulatoryFee + offsiteAdsFee
  );
  const feeTax = roundMoney(feesBeforeTax * feeTaxRate);
  const totalFees = roundMoney(feesBeforeTax + feeTax);
  const totalCosts = roundMoney(productCost + shippingCost);
  const profit = roundMoney(orderTotal - totalFees - totalCosts);

  return {
    listPrice: roundMoney(listPrice),
    shippingCharged: roundMoney(shippingCharged),
    orderTotal,
    listingFee,
    transactionFee,
    paymentProcessingFee,
    regulatoryFee,
    offsiteAdsFee,
    feesBeforeTax,
    feeTax,
    totalFees,
    productCost: roundMoney(productCost),
    shippingCost: roundMoney(shippingCost),
    totalCosts,
    profit
  };
}

export function findMinimumListPrice(input) {
  const desiredProfit = finiteNonNegative(input.desiredProfit, "Desired profit");
  const atPrice = (priceInCents) => calculateBreakdown({
    ...input,
    listPrice: priceInCents / 100
  });

  if (atPrice(0).profit >= desiredProfit) {
    return atPrice(0);
  }

  let low = 0;
  let high = 100;
  const maximumCents = 100_000_000;

  while (atPrice(high).profit < desiredProfit) {
    low = high + 1;
    high *= 2;
    if (high > maximumCents) {
      throw new RangeError("A price could not be calculated with these fee settings");
    }
  }

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (atPrice(middle).profit >= desiredProfit) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }

  return atPrice(low);
}
