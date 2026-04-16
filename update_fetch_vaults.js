const fs = require('fs');
const file = 'src/pages/CirclePage.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldFetchVaults = `  const fetchVaults = async () => {
    if(!data?.circle?.slug) return;
    setLoadingVaults(true);
    try {
      const res = await apiFetch(\`/api/circles/\${data.circle.slug}/vaults\`);
      setVaults(res.vaults || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingVaults(false);
    }
  };`;

const newFetchVaults = `  const fetchVaults = async () => {
    if(!data?.circle?.id) return;
    setLoadingVaults(true);
    try {
      const { data: vaultData, error } = await supabase
        .from('vaults')
        .select('*')
        .eq('circle_id', data.circle.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      let unlockedIds: string[] = [];
      if (currentUserId) {
        const { data: unlocks } = await supabase.from('vault_unlocks').select('vault_id').eq('user_id', currentUserId);
        unlockedIds = (unlocks || []).map(u => u.vault_id);
      }

      const enrichedVaults = (vaultData || []).map(v => ({
        ...v,
        is_unlocked: unlockedIds.includes(v.id) || v.creator_id === currentUserId
      }));

      setVaults(enrichedVaults);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingVaults(false);
    }
  };`;

code = code.replace(oldFetchVaults, newFetchVaults);
fs.writeFileSync(file, code);
console.log('fetchVaults updated successfully!');
