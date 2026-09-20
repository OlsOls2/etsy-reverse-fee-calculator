# Etsy Reverse Fee Calculator

A client-side calculator that works backwards from desired profit to the minimum Etsy list price. It includes product costs, shipping charged versus shipping paid, Offsite Ads and a visible fee breakdown.

## Run locally

```bash
npm test
npm run build
python3 -m http.server 4173 -d dist
```

Then open <http://localhost:4173>.

## Fee assumptions

Rates were checked on 20 September 2026 against Etsy's official documentation:

- Transaction fee: 6.5% of item price plus shipping charged.
- UK Etsy Payments: 4% plus £0.20 per order; US Etsy Payments: 3% plus $0.25.
- UK Regulatory Operating fee: 0.48% of item price plus shipping charged.
- Offsite Ads: 15% below Etsy's $10,000 shop threshold, or 12% at/above it; fee capped at $100 USD per order.
- Listing fee: $0.20 USD. The UK preset uses a user-editable £0.15 estimate because Etsy converts this fixed USD fee at its current rate.
- UK VAT on seller fees: optional 20% toggle, enabled by default. Sellers able to reclaim it can turn it off.

The calculator assumes no separately added buyer tax. Deposit fees, currency conversion, Etsy Ads budgets, Pattern and optional services are outside v1.

Official sources:

- [Etsy Fees & Payments Policy](https://www.etsy.com/legal/fees/)
- [Etsy Payments Policy](https://www.etsy.com/legal/etsy-payments)
- [Offsite Ads](https://help.etsy.com/hc/en-us/articles/360000338367-How-Etsy-s-Offsite-Ads-Work)
- [Regulatory Operating fee](https://help.etsy.com/hc/en-us/articles/1500011073202-What-is-a-Regulatory-Operating-Fee)

## Maths and rounding

Each fee line is rounded to the nearest penny/cent. The reverse calculator uses an integer-cent binary search and returns the first list price whose resulting profit meets or exceeds the target. This also handles the Offsite Ads cap without relying on an inaccurate single linear formula.

## Scope

v1 is deliberately single-listing only. CSV batch pricing and shop margin audits are represented as a disabled Pro preview.

## License

MIT
