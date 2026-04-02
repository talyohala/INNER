// ... (אותם ייבואים)

router.post('/:slug/join', async (req, res) => {
  const { slug } = req.params;
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data: circle } = await supabase.from('circles').select('id, name, slug, is_private, join_price, owner_id').eq('slug', slug).maybeSingle();
    if (!circle) return res.status(404).json({ error: 'Circle not found' });

    const { data: existing } = await supabase.from('circle_members').select('user_id').eq('circle_id', circle.id).eq('user_id', userId).maybeSingle();

    if (existing) {
      await supabase.from('circle_members').delete().eq('circle_id', circle.id).eq('user_id', userId);
      return res.json({ joined: false });
    } else {
      
      const { data: profile } = await supabase.from('profiles').select('full_name, username').eq('id', userId).single();
      const joinerName = profile?.full_name || profile?.username || 'משתמש חדש';

      // שימוש ב-RPC המאובטח שיצרנו ב-SQL
      const { error } = await supabase.rpc('secure_join_circle', {
        p_user_id: userId,
        p_circle_id: circle.id,
        p_price: circle.is_private ? circle.join_price : 0,
        p_owner_id: circle.owner_id,
        p_circle_name: circle.name,
        p_user_name: joinerName
      });

      if (error) {
        if (error.message.includes('Not enough credits')) {
          return res.status(400).json({ error: 'אין לך מספיק CRD בארנק.' });
        }
        throw error;
      }

      return res.json({ joined: true });
    }
  } catch (err: any) { 
    res.status(500).json({ error: err.message }); 
  }
});
// ... (שאר הראוטר)
