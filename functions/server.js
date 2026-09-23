const express = require("express");
const Stripe = require("stripe");

const APP_ID = "mm-etsy-reverse-fee";
const APPROVED_ACCOUNT_ID = "acct_1RWiEYDBB6JJzhj6";
const PRICE_ID = "price_1UI33sDBB6JJzhj63kTs5xhg";
const ORIGIN = "https://takehomefees.online";
const ALLOWED_ORIGINS = new Set([
  ORIGIN,
  "https://www.takehomefees.online",
  "https://etsy-reverse-fee.online",
  "https://www.etsy-reverse-fee.online",
  "https://etsy-reverse-fee.web.app",
]);
const app = express();
let verifiedStripe;

app.use((request, response, next) => {
  const origin = request.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) return response.status(403).json({ error: "Origin is not allowed." });
  if (origin) response.set("Access-Control-Allow-Origin", origin).set("Vary", "Origin");
  response.set("Access-Control-Allow-Headers", "Content-Type").set("Access-Control-Allow-Methods", "GET, POST, OPTIONS").set("Cache-Control", "no-store");
  if (request.method === "OPTIONS") return response.status(204).send("");
  next();
});

async function stripeClient() {
  if (!verifiedStripe) {
    verifiedStripe = (async () => {
      const stripe = new Stripe(process.env.ETSYRF_STRIPE_SECRET_KEY_LIVE);
      const account = await stripe.accounts.retrieveCurrent();
      if (account.id !== APPROVED_ACCOUNT_ID) {
        throw new Error("Stripe account identity is not approved for Mizzen Studios.");
      }
      return stripe;
    })().catch((error) => {
      verifiedStripe = undefined;
      throw error;
    });
  }
  return verifiedStripe;
}

app.post("/webhook", express.raw({ type: "application/json" }), async (request, response) => {
  try {
    const stripe = await stripeClient();
    const event = stripe.webhooks.constructEvent(request.body, request.get("stripe-signature"), process.env.ETSYRF_STRIPE_WEBHOOK_SECRET_LIVE);
    if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
      console.log("reverseprice_billing_event", { id: event.id, type: event.type, livemode: event.livemode });
    }
    response.json({ received: true });
  } catch (error) {
    console.error("stripe_webhook_rejected", error instanceof Error ? error.message : error);
    response.status(400).json({ error: "Invalid webhook signature." });
  }
});

app.use(express.json({ limit: "12kb" }));

app.get("/health", async (_request, response) => {
  try {
    await stripeClient();
    response.json({ ok: true, app: APP_ID, accountVerified: true });
  } catch {
    response.status(503).json({ ok: false, app: APP_ID, accountVerified: false });
  }
});

app.post("/checkout", async (_request, response) => {
  try {
    const stripe = await stripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      success_url: `${ORIGIN}/?checkout=success&session_id={CHECKOUT_SESSION_ID}#csv-pro`,
      cancel_url: `${ORIGIN}/?checkout=cancelled#csv-pro`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      customer_creation: "always",
      custom_text: { submit: { message: "Etsy Reverse Fee CSV Pro is provided by Mizzen Studios. Your CSV stays on your device." } },
      payment_intent_data: {
        description: "Etsy Reverse Fee — CSV Pro lifetime unlock",
        statement_descriptor_suffix: "REVERSE FEE",
        metadata: { app: APP_ID, entitlement: "csv-pro", environment: "live" }
      },
      metadata: { app: APP_ID, entitlement: "csv-pro", environment: "live" }
    });
    if (!session.url) return response.status(502).json({ error: "Stripe did not return a checkout URL." });
    response.json({ url: session.url });
  } catch (error) {
    console.error("checkout_create_failed", error instanceof Error ? error.message : error);
    response.status(500).json({ error: "Stripe Checkout is temporarily unavailable. Please try again." });
  }
});

app.get("/entitlement", async (request, response) => {
  const sessionId = String(request.query.session_id || "");
  if (!sessionId.startsWith("cs_live_")) return response.status(400).json({ error: "Invalid checkout session." });
  try {
    const stripe = await stripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.app !== APP_ID || session.metadata?.entitlement !== "csv-pro" || session.metadata?.environment !== "live") {
      return response.status(403).json({ error: "This purchase is not for ReversePrice CSV Pro." });
    }
    response.json({ pro: session.payment_status === "paid", paymentStatus: session.payment_status });
  } catch (error) {
    console.error("entitlement_lookup_failed", error instanceof Error ? error.message : error);
    response.status(404).json({ error: "Purchase could not be verified." });
  }
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`ReversePrice billing listening on ${port}`));
