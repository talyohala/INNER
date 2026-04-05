import { supabase } from './supabase';

export const rewardXP = async (userId: string, xpToAdd: number) => {
  try {
    const { data: profile } = await supabase.from('profiles').select('xp, level').eq('id', userId).single();
    if (!profile) return null;

    let currentXP = profile.xp || 0;
    let currentLevel = profile.level || 1;
    let leveledUp = false;

    currentXP += xpToAdd;
    let xpRequired = currentLevel * 1000;

    // בדיקה אם המשתמש חצה את הרף ועלה רמה
    if (currentXP >= xpRequired) {
      currentLevel += 1;
      currentXP -= xpRequired; // מאפסים את המד לרמה החדשה
      leveledUp = true;
    }

    await supabase.from('profiles').update({ xp: currentXP, level: currentLevel }).eq('id', userId);
    
    return { xp: currentXP, level: currentLevel, leveledUp };
  } catch (err) {
    console.error('Error adding XP:', err);
    return null;
  }
};
