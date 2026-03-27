import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const secret = process.env.STRIPE_SECRET_KEY || '';

// אנו משתמשים בגרסת ה-API העדכנית (מוגדר כ-any כדי למנוע שגיאות טייפ בגרסאות שונות)
export const stripe = secret
  ? new Stripe(secret, {
      apiVersion: '2023-10-16' as any
    })
  : null;
