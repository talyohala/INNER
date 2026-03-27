import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';

export interface AuthedRequest extends Request {
  user?: { id: string; email?: string; [key: string]: any; };
}

export const requireAuth = async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (!token) return res.status(401).json({ error: 'חסר טוקן התחברות' });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'טוקן פג תוקף או לא חוקי' });

    req.user = data.user;
    next();
  } catch (err) {
    res.status(500).json({ error: 'שגיאת אבטחה פנימית' });
  }
};
