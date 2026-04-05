import { Router, Request, Response } from 'express';
import stripe from '../lib/stripe';
import { supabase } from '../lib/supabase';

const router = Router();

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

const PACKAGES: Record<string, { id: string; credits: number; priceAgorot: number; label: string }> = {
  crd_100: { id: 'crd_100', credits: 100, priceAgorot: 1500, label: '100 CRD' },
  crd_500: { id: 'crd_500', credits: 500, priceAgorot: 5900, label: '500 CRD' },
  crd_1500: { id: 'crd_1500', credits: 1500, priceAgorot: 14900, label: '1500 CRD' },
};

// יצירת קישור לתשלום
router.post('/checkout-session', async (req: Request, res: Response) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { packageId } = req.body;
  if (!packageId || !PACKAGES[packageId]) return res.status(400).json({ error: 'חבילה לא תקינה' });

  const pkg = PACKAGES[packageId];

  try {
    const { data: profile } = await supabase.from('profiles').select('email').eq('id', userId).maybeSingle();

    const session = await stripe!.checkout.sessions.create({
      mode: 'payment',
      success_url: `${CLIENT_URL}/wallet?payment=success`,
      cancel_url: `${CLIENT_URL}/wallet?payment=cancel`,
      customer_email: profile?.email || undefined,
      line_items: [{
        price_data: {
          currency: 'ils',
          product_data: { name: `INNER ${pkg.label}`, description: `טעינת ${pkg.credits} CRD לארנק` },
          unit_amount: pkg.priceAgorot,
        },
        quantity: 1,
      }],
      metadata: { user_id: userId, package_id: pkg.id, credits: String(pkg.credits) },
    });

    await supabase.from('wallet_topups').upsert({
      user_id: userId,
      stripe_session_id: session.id,
      credits: pkg.credits,
      package_id: pkg.id,
      currency: 'ils',
      amount_paid: pkg.priceAgorot,
      status: 'pending',
    });

    return res.json({ url: session.url });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// וובהוק מ-Stripe (מקבל Raw Body מה-index.ts)
router.post('/webhook', async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'];
  if (!signature || !STRIPE_WEBHOOK_SECRET) return res.status(400).send('Missing signature or secret');

  let event: any;
  try {
    event = stripe!.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('Webhook Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // הגנת כפילויות
  const { data: existing } = await supabase.from('stripe_events').select('id').eq('id', event.id).maybeSingle();
  if (existing) return res.json({ received: true });

  await supabase.from('stripe_events').insert({ id: event.id, type: event.type });

  // טיפול בתשלום שהושלם
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.user_id;
    const credits = Number(session.metadata?.credits || 0);

    if (userId && credits) {
      const { data: topup } = await supabase.from('wallet_topups').select('status').eq('stripe_session_id', session.id).maybeSingle();
      
      if (topup && topup.status !== 'paid') {
        // עדכון סטטוס תשלום
        await supabase.from('wallet_topups').update({ 
          status: 'paid', 
          stripe_payment_intent_id: session.payment_intent 
        }).eq('stripe_session_id', session.id);

        // טעינת ארנק ותיעוד עסקה
        const { data: profile } = await supabase.from('profiles').select('credits').eq('id', userId).single();
        await supabase.from('profiles').update({ credits: (profile?.credits || 0) + credits }).eq('id', userId);
        
        await supabase.from('transactions').insert({
          user_id: userId,
          amount: credits,
          type: 'deposit',
          description: `טעינת ${credits} CRD באשראי`
        });
      }
    }
  }

  res.json({ received: true });
});

export default router;
