import { Router } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

router.get('/stats', async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // 1. משיכת הקהילות בבעלות היוצר ומספר החברים
    const { data: circles } = await supabase
      .from('circles')
      .select('id, name, slug, circle_members(user_id)')
      .eq('owner_id', userId);

    let active_members = 0;
    const owned_circles = (circles || []).map((c: any) => {
      const membersCount = c.circle_members?.length || 0;
      active_members += membersCount;
      return { id: c.id, name: c.name, slug: c.slug, members: membersCount, revenue: 0 };
    });

    // 2. חישוב הכנסות ומתנות (הפקדות לארנק)
    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, type, created_at, description')
      .eq('user_id', userId)
      .eq('type', 'deposit');

    let total_revenue_crd = 0;
    let gifts_received_today = 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    (transactions || []).forEach((tx: any) => {
      total_revenue_crd += tx.amount; // סכימת ההכנסות
      
      // בדיקה אם ההכנסה היא מתנה מהיום
      if (tx.description?.includes('מתנה') && new Date(tx.created_at) >= today) {
        gifts_received_today += 1;
      }
    });

    res.json({
      total_revenue_crd,
      active_members,
      gifts_received_today,
      profile_views: Math.floor(Math.random() * 50) + 10, // נתון מדומה זמני לצפיות
      owned_circles
    });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
