import { Router } from "express";
import Stripe from "stripe";
import { auth, ah } from "../middleware.js";
import { pool } from "../db.js";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const r = Router();

const PRICES = {
  monthly:  { price: process.env.STRIPE_PRICE_MONTHLY,  mode: "subscription" },
  annual:   { price: process.env.STRIPE_PRICE_ANNUAL,   mode: "subscription" },
  lifetime: { price: process.env.STRIPE_PRICE_LIFETIME, mode: "payment" },
};

r.post(
  "/checkout",
  auth,
  ah(async (req, res) => {
    const sel = PRICES[req.body?.plan] || PRICES.monthly;
    if (!sel.price) return res.status(500).json({ error: "price not configured" });
    const session = await stripe.checkout.sessions.create({
      mode: sel.mode,
      line_items: [{ price: sel.price, quantity: 1 }],
      success_url: process.env.BILLING_SUCCESS_URL,
      cancel_url: process.env.BILLING_CANCEL_URL,
      client_reference_id: String(req.user.id),
      metadata: { user_id: String(req.user.id) },
    });
    res.json({ url: session.url });
  })
);

// Stripe webhook. Mounted with express.raw() in index.js so the signature verifies.
// checkout.session.completed flips the user to premium for BOTH subscription and
// one-time (lifetime) payments. Lifetime never emits customer.subscription.deleted,
// so premium stays on forever.
export async function webhookHandler(req, res) {
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (e) {
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object;
      const userId = s.metadata?.user_id || s.client_reference_id;
      if (userId) {
        await pool.query(
          "UPDATE users SET is_premium=TRUE, stripe_customer_id=COALESCE($2, stripe_customer_id) WHERE id=$1",
          [userId, s.customer || null]
        );
      }
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      await pool.query("UPDATE users SET is_premium=FALSE WHERE stripe_customer_id=$1", [sub.customer]);
    }
  } catch (e) {
    console.error("webhook handling failed", e);
    return res.status(500).json({ error: "handler_failed" });
  }

  res.json({ received: true });
}

export default r;
