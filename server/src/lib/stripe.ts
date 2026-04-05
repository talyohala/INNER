let stripe: any = null;

const secret = process.env.STRIPE_SECRET_KEY;

if (secret) {
  const Stripe = require('stripe');
  stripe = new Stripe(secret);
} else {
  console.log('⚠️ Stripe disabled (no STRIPE_SECRET_KEY)');
}

export default stripe;
