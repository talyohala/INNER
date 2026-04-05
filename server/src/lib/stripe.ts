import Stripe from 'stripe';

// חשוב מאוד — לא להשאיר any כאן
const secret = process.env.STRIPE_SECRET_KEY;

if (!secret) {
  throw new Error('Missing STRIPE_SECRET_KEY');
}

// זה הפתרון לבעיה שלך:
const stripe = new (Stripe as any)(secret, {
  apiVersion: '2023-10-16'
});

export default stripe;
