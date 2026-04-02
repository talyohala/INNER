-- מניעת כפילויות: משתמש יכול להיות חבר בקהילה רק פעם אחת
ALTER TABLE public.circle_members ADD CONSTRAINT unique_circle_user UNIQUE (circle_id, user_id);

-- טרנזקציה מאובטחת להצטרפות למועדון בתשלום (הכל קורה בפעולה אחת אטומית)
CREATE OR REPLACE FUNCTION secure_join_circle(
  p_user_id UUID, 
  p_circle_id UUID, 
  p_price INT, 
  p_owner_id UUID,
  p_circle_name TEXT,
  p_user_name TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_balance INT;
BEGIN
  -- בדיקה אם כבר חבר
  IF EXISTS (SELECT 1 FROM circle_members WHERE circle_id = p_circle_id AND user_id = p_user_id) THEN
    RETURN TRUE; 
  END IF;

  -- טיפול בתשלום
  IF p_price > 0 THEN
    -- נעילת שורת המשתמש כדי למנוע משיכה כפולה במקביל (Row-level lock)
    SELECT credits INTO v_balance FROM profiles WHERE id = p_user_id FOR UPDATE;
    
    IF v_balance < p_price THEN
      RAISE EXCEPTION 'Not enough credits';
    END IF;

    -- חיוב הרוכש
    UPDATE profiles SET credits = credits - p_price WHERE id = p_user_id;
    INSERT INTO transactions (user_id, amount, type, description) 
    VALUES (p_user_id, -p_price, 'purchase', 'דמי כניסה למועדון: ' || p_circle_name);

    -- זיכוי היוצר ושליחת התראה
    IF p_owner_id IS NOT NULL AND p_owner_id != p_user_id THEN
      UPDATE profiles SET credits = credits + p_price WHERE id = p_owner_id;
      INSERT INTO transactions (user_id, amount, type, description) 
      VALUES (p_owner_id, p_price, 'deposit', 'הכנסה מהצטרפות חבר למועדון: ' || p_circle_name);
      
      INSERT INTO notifications (user_id, actor_id, type, title, content, is_read)
      VALUES (p_owner_id, p_user_id, 'membership', 'חבר חדש במועדון! 🎉', p_user_name || ' הצטרף/ה ושילם/ה ' || p_price || ' CRD.', false);
    END IF;
  END IF;

  -- צירוף החבר
  INSERT INTO circle_members (circle_id, user_id, role) VALUES (p_circle_id, p_user_id, 'member');
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
