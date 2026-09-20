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
  const location = input.location ?? LOCATIONS.GB;
  const shippingCharged = finiteNonNegative(input.shippingCharged ?? 0, "Shipping charged");
  const productCost = finiteNonNegative(input.productCost ?? 0, "Product cost");
  const shippingCost = finiteNonNegative(input.shippingCost ?? 0, "Shipping cost");
  const offsiteRate = finiteNonNegative(input.offsiteRate ?? 0, "Offsite Ads rate");
  const feeTaxRate = finiteNonNegative(input.feeTaxRate ?? location.feeTaxRate, "Fee tax rate");
  const listingFee = roundMoney(finiteNonNegative(input.listingFee ?? location.listingFee, "Listing fee"));
  const offsiteCap = finiteNonNegative(input.offsiteCap ?? location.offsiteCap, "Offsite Ads cap");
  const totalCosts = roundMoney(productCost + shippingCost);
  const effectivePercentageRate = (
    location.transactionRate
    + location.paymentRate
    + location.regulatoryRate
    + offsiteRate
  ) * (1 + feeTaxRate);

  if (effectivePercentageRate >= 1) {
    throw new RangeError("Combined percentage fees must be less than 100%");
  }

  const atPrice = (priceInCents) => calculateBreakdown({
    ...input,
    listPrice: priceInCents / 100
  });

  // Individually rounded fee lines can make exact profit dip briefly as price
  // rises, so exact profit is not a safe binary-search predicate. This upper
  // bound allows up to half a cent of downward rounding on each percentage
  // fee and on fee tax, plus half a cent on final profit. It is monotonic for
  // supported rates and cannot exclude a price that really meets the target.
  const optimisticProfit = (priceInCents) => {
    const orderTotal = roundMoney(priceInCents / 100 + shippingCharged);
    const unroundedFeesBeforeTax = listingFee
      + orderTotal * location.transactionRate
      + orderTotal * location.paymentRate + location.paymentFixed
      + orderTotal * location.regulatoryRate
      + Math.min(orderTotal * offsiteRate, offsiteCap);
    const feeRoundingAllowance = 4 * 0.005;
    const feesBeforeTaxLowerBound = unroundedFeesBeforeTax - feeRoundingAllowance;
    const totalFeesLowerBound = Math.max(
      0,
      feesBeforeTaxLowerBound * (1 + feeTaxRate) - 0.005
    );

    return orderTotal - totalCosts - totalFeesLowerBound + 0.005;
  };

  let low = 0;
  let high = 100;
  const maximumCents = 100_000_000;

  if (optimisticProfit(0) >= desiredProfit) {
    high = 0;
  }

  while (optimisticProfit(high) < desiredProfit) {
    if (high === maximumCents) {
      throw new RangeError("A price could not be calculated with these fee settings");
    }
    low = high + 1;
    high = Math.min(high * 2, maximumCents);
  }

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (optimisticProfit(middle) >= desiredProfit) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }

  for (let priceInCents = low; priceInCents <= maximumCents; priceInCents += 1) {
    const result = atPrice(priceInCents);
    if (result.profit >= desiredProfit) {
      return result;
    }
  }

  throw new RangeError("A price could not be calculated with these fee settings");
}
