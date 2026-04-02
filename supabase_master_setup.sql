-- ==========================================
-- INNER APP: MASTER SQL & SECURITY SETUP
-- ==========================================

-- 1. פונקציה מאובטחת להעברת קרדיטים (CRD) בין משתמשים
-- פונקציה זו רצה כטרנזקציה אחת (Atomic). אם משהו נכשל, הכל מתבטל.
CREATE OR REPLACE FUNCTION transfer_credits(
  sender_id UUID,
  receiver_id UUID,
  transfer_amount INT
) RETURNS INT AS $$
DECLARE
  v_sender_balance INT;
  v_receiver_balance INT;
  v_sender_name TEXT;
BEGIN
  -- וידוא שהסכום חיובי
  IF transfer_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  -- נעילת שורת השולח למניעת משיכה כפולה (Row-level lock)
  SELECT credits, full_name INTO v_sender_balance, v_sender_name 
  FROM profiles WHERE id = sender_id FOR UPDATE;

  IF v_sender_balance < transfer_amount THEN
    RAISE EXCEPTION 'Not enough credits';
  END IF;

  -- ניכוי מהשולח
  UPDATE profiles SET credits = credits - transfer_amount WHERE id = sender_id;
  
  -- הוספה למקבל
  UPDATE profiles SET credits = credits + transfer_amount WHERE id = receiver_id;

  -- תיעוד הפעולות בארנק
  INSERT INTO transactions (user_id, amount, type, description) 
  VALUES (sender_id, -transfer_amount, 'transfer_out', 'העברה לחבר');
  
  INSERT INTO transactions (user_id, amount, type, description) 
  VALUES (receiver_id, transfer_amount, 'transfer_in', 'העברה מ-' || COALESCE(v_sender_name, 'משתמש'));

  -- שליחת התראה למקבל
  INSERT INTO notifications (user_id, actor_id, type, title, content, is_read, action_url)
  VALUES (receiver_id, sender_id, 'wallet', 'קיבלת CRD! 💸', 'הועברו אליך ' || transfer_amount || ' קרדיטים.', false, '/wallet');

  -- החזרת היתרה החדשה של השולח
  RETURN v_sender_balance - transfer_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. הפעלת Realtime על הטבלאות החשובות
-- זה מה שגורם לאפליקציה להתעדכן בלי לרענן את העמוד
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE likes;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE circle_messages;

-- 3. טריגר אוטומטי: יצירת פרופיל ברגע שמשתמש נרשם במערכת ה-Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, username, credits, level, xp, streak)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name',
    COALESCE(new.raw_user_meta_data->>'username', 'user_' || substr(md5(random()::text), 0, 8)),
    100, -- מתנת הצטרפות 100 CRD
    1, 0, 0
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

