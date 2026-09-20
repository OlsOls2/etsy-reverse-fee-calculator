# Etsy Reverse Fee Calculator

A calculator that works backwards from desired profit to the minimum Etsy list price. It includes product costs, shipping charged versus shipping paid, Offsite Ads and a visible fee breakdown. The £4 CSV Pro unlock batch-prices local files after server-side Stripe entitlement verification.

## Run locally

```bash
npm test
npm run build
python3 -m http.server 4173 -d dist
```

Then open <http://localhost:4173>.

## Deploy to Firebase Hosting

Production hosting:

- Firebase/GCP project ID: `etsy-reverse-fee`
- Canonical URL: <https://etsy-reverse-fee.online/>
- Firebase fallback URL: <https://etsy-reverse-fee.web.app/>
- Build output directory: `dist`

Deploy with an interactive Firebase login:

```bash
firebase login
npm ci
npm test
npm run build
firebase deploy --only hosting --project etsy-reverse-fee
```

The currently authenticated OpenClaw host can deploy without another login.
For CI, use a Google service account with Firebase Hosting deployment access and
provide its credentials through the CI platform's protected secret mechanism;
no service-account key is required for normal local deployment.

Set `SITE_URL=https://another-production-domain.example/` while building only
when intentionally targeting a different production domain. `SITE_URL` rewrites
the canonical URL, Open Graph URL, structured-data URL, robots sitemap URL and
sitemap entry. If omitted, the canonical custom domain above is used.

The build defaults to the production billing service. Set
`BILLING_API_URL=https://another-service.example` only for an intentional
alternate deployment.

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

Each fee line is rounded to the nearest penny/cent. Because several fee lines can round up on the same cent, exact profit is not perfectly monotonic. The reverse calculator binary-searches a safe optimistic bound, then checks exact cent prices in order and returns the first list price whose resulting profit meets or exceeds the target. This also handles the Offsite Ads cap without relying on an inaccurate single linear formula.

## Payments and CSV privacy

The static frontend sends only Checkout and entitlement requests to the billing service. CSV content is parsed and priced locally in the browser and is never uploaded. The production billing service verifies the fixed Mizzen Studios Stripe account before creating or retrieving a session.

## License

MIT
