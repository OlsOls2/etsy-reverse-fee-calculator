const Stripe = require('stripe');

const APPROVED_ACCOUNT_ID = 'acct_1RWiEYDBB6JJzhj6';
const PRICE_ID = 'price_1UI33sDBB6JJzhj63kTs5xhg';

async function main() {
  const stripe = new Stripe(process.env.ETSYRF_STRIPE_SECRET_KEY_LIVE);
  const before = await stripe.accounts.retrieveCurrent();
  if (before.id !== APPROVED_ACCOUNT_ID) throw new Error('Stripe account is not the approved Mizzen Studios account.');

  const accountNames = [before.business_profile?.name, before.settings?.dashboard?.display_name].filter(Boolean);
  if (!accountNames.includes('Mizzen Studios')) throw new Error('Stripe Checkout is not branded for Mizzen Studios.');
  if (before.settings?.payments?.statement_descriptor !== 'MIZZEN') throw new Error('Stripe statement descriptor is not the approved Mizzen Studios value.');

  const price = await stripe.prices.retrieve(PRICE_ID, { expand: ['product'] });
  if (!price.active || typeof price.product !== 'object') throw new Error('Configured Etsy Reverse Fee Price is not an active expanded Product.');
  const product = price.product;
  if (product.name !== 'Etsy Reverse Fee — CSV Pro') throw new Error('Configured Stripe Product name does not match Etsy Reverse Fee.');
  if (product.statement_descriptor !== 'ETSY REVERSE FEE') throw new Error('Configured Stripe Product statement descriptor is incorrect.');
  console.log(JSON.stringify({
    accountId: before.id,
    accountDisplayNames: accountNames,
    accountStatementDescriptor: before.settings?.payments?.statement_descriptor,
    productId: product.id,
    productName: product.name,
    productStatementDescriptor: product.statement_descriptor,
    checkoutStatementSuffix: 'REVERSE FEE',
  }));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
