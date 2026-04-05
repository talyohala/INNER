const fs = require('fs');
const path = 'src/pages/CirclePage.tsx';
let code = fs.readFileSync(path, 'utf8');

const startMarker = 'const handlePost = async () => {';
const endMarker = 'const handleLike = async (postId: string, isLiked: boolean) => {';

if (code.includes(startMarker) && code.includes(endMarker)) {
  const before = code.substring(0, code.indexOf(startMarker));
  const after = code.substring(code.indexOf(endMarker));
  
  const newFunction = `const handlePost = async () => {
    if (!newPost.trim() && !selectedFile && !editingPost) return;
    setPosting(true);
    try {
      if (editingPost) {
        await supabase.from('posts').update({ content: newPost.trim() }).eq('id', editingPost.id);
        toast.success('עודכן בהצלחה'); closeOverlay();
      } else {
        let media_url: string | null = null;
        let media_type = 'text';
        if (selectedFile) {
          const fileName = \`\${Date.now()}_\${Math.random().toString(36).substring(7)}\`;
          const { data: uploadData, error: uploadError } = await supabase.storage.from('feed_images').upload(fileName, selectedFile);
          if (uploadError) throw uploadError;
          if (uploadData) {
            media_url = supabase.storage.from('feed_images').getPublicUrl(uploadData.path).data.publicUrl;
            media_type = selectedFile.type.startsWith('video/') ? 'video' : 'image';
          }
        }
        
        const { error } = await supabase.from('posts').insert({
          circle_id: data.circle.id,
          user_id: currentUserId,
          content: newPost.trim(),
          media_url,
          media_type,
        });

        if (error) throw error;
        
        // הוספה מקומית מיידית - הפוסט כבר לא נבלע
        const optimisticPost = {
          id: Math.random().toString(),
          circle_id: data.circle.id,
          user_id: currentUserId,
          content: newPost.trim(),
          media_url,
          media_type,
          created_at: new Date().toISOString(),
          profiles: myProfile,
          likes_count: 0,
          comments_count: 0,
          is_liked: false
        };

        setData((curr: any) => ({
          ...curr,
          posts: [optimisticPost, ...curr.posts]
        }));
      }
      setNewPost(''); setSelectedFile(null); setEditingPost(null); triggerFeedback('pop');
      fetchCircleData(); // רענון שקט ברקע לוודא שהכל תקין
    } catch (err: any) { 
      toast.error('שגיאה: ' + (err.message || 'לא ניתן לשלוח את הפוסט')); 
    } finally { setPosting(false); }
  };

  `;

  fs.writeFileSync(path, before + newFunction + after);
  console.log('✅ Post sending fixed successfully!');
} else {
  console.log('❌ Could not find the function to replace.');
}
