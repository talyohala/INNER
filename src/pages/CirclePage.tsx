import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion'; 
import { supabase } from '../lib/supabase';              
import { FadeIn, GlassCard, Button } from '../components/ui';
import { Users, Loader2, ArrowRight, MessageSquare, Heart, Activity, Send, Lock, X, UserCircle, Trash2, Edit2, Reply } from 'lucide-react';         
import { triggerFeedback } from '../lib/sound';          
import toast from 'react-hot-toast';

export const CirclePage: React.FC = () => {                
  const { slug } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);           
  const [joining, setJoining] = useState(false);                                                                    
  const [activePost, setActivePost] = useState<any>(null);                                                          
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {                                          
    fetchCircleData();
    const channel = supabase.channel(`circle_${slug}`).on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchCircleData()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [slug]);                                                                                                       

  const fetchCircleData = async () => {                      
    try {                                                      
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id;
      if (uid) setCurrentUserId(uid);

      let { data: circle } = await supabase.from('circles').select('*').eq('slug', slug).single();
      if (!circle) {
        const { data: circleById } = await supabase.from('circles').select('*').eq('id', slug).single();
        circle = circleById;
      }
      if (!circle) throw new Error('מועדון לא נמצא');

      let isMember = false;
      if (uid) {
        const { data: memberData } = await supabase.from('circle_members').select('id').eq('circle_id', circle.id).eq('user_id', uid);
        isMember = memberData && memberData.length > 0;
      }

      let formattedPosts = [];
      // התיקון הקריטי: שימוש בטבלאות likes ו-comments!
      const { data: pData } = await supabase.from('posts').select('*, profiles(*), likes(user_id), comments(id)').eq('circle_id', circle.id).order('created_at', { ascending: false });
      if (pData) {
        formattedPosts = pData.map(p => ({ ...p, likes_count: p.likes?.length || 0, comments_count: p.comments?.length || 0, is_liked: p.likes?.some((l:any) => l.user_id === uid) }));
      }

      setData({ circle, isMember, posts: formattedPosts });                                       
    } catch (err) { navigate('/'); } finally { setLoading(false); }                                                 
  };

  const handleJoin = async () => {
    if (!currentUserId) return toast.error('יש להתחבר תחילה');
    setJoining(true); triggerFeedback('pop');
    try {
      if (data.isMember) {
        await supabase.from('circle_members').delete().match({ circle_id: data.circle.id, user_id: currentUserId });
        setData((prev: any) => ({ ...prev, isMember: false, circle: { ...prev.circle, members_count: Math.max((prev.circle.members_count || 1) - 1, 0) } }));
      } else {
        // התיקון הקריטי: הוספת role: 'member' לשאילתה
        const { error } = await supabase.from('circle_members').insert({ circle_id: data.circle.id, user_id: currentUserId, role: 'member' });
        if (error) throw error;
        setData((prev: any) => ({ ...prev, isMember: true, circle: { ...prev.circle, members_count: (prev.circle.members_count || 0) + 1 } }));                                    
        triggerFeedback('success'); toast.success('ברוך הבא למועדון! 👑');  
        fetchCircleData(); 
      }                                                      
    } catch (err: any) { toast.error('שגיאה בהצטרפות: ' + err.message); } finally { setJoining(false); }
  };                                                                                                                

  const handlePost = async () => {                           
    if (!newPost.trim() || !currentUserId) return;
    setPosting(true);                                        
    try {
      const { error } = await supabase.from('posts').insert({ circle_id: data.circle.id, user_id: currentUserId, content: newPost.trim(), media_type: 'text' });
      if (error) throw error;
      setNewPost(''); triggerFeedback('pop'); fetchCircleData();                                     
    } catch (err: any) { toast.error('שגיאה בשליחה: ' + err.message); } finally { setPosting(false); }               
  };
                                                           
  const handleLike = async (postId: string, isLiked: boolean) => {
    if (!currentUserId) return;
    triggerFeedback('pop');
    setData((curr: any) => ({ ...curr, posts: curr.posts.map((p: any) => p.id === postId ? { ...p, is_liked: !isLiked, likes_count: isLiked ? p.likes_count - 1 : p.likes_count + 1 } : p) }));                                         
    try { 
      if (isLiked) await supabase.from('likes').delete().match({ post_id: postId, user_id: currentUserId });
      else await supabase.from('likes').insert({ post_id: postId, user_id: currentUserId });
    } catch (err) { fetchCircleData(); }
  };                                                                                                                

  const openComments = async (post: any) => {                
    triggerFeedback('pop'); setActivePost(post); setLoadingComments(true);                                
    try {
      const { data: commentsData } = await supabase.from('comments').select('*, profiles(*)').eq('post_id', post.id).order('created_at', { ascending: true });
      setComments(commentsData || []);
    } catch (err) { toast.error('שגיאה בתגובות'); } finally { setLoadingComments(false); }                                  
  };
                                                           
  const submitComment = async () => {                        
    if (!newComment.trim() || !activePost || !currentUserId) return;
    try {                                                      
      const { data: newComm, error } = await supabase.from('comments').insert({ post_id: activePost.id, user_id: currentUserId, content: newComment.trim() }).select('*, profiles(*)').single();
      if (error) throw error;
      setComments([...comments, newComm]); setNewComment('');                                       
      setData((curr: any) => ({ ...curr, posts: curr.posts.map((p: any) => p.id === activePost.id ? { ...p, comments_count: p.comments_count + 1 } : p) }));
      triggerFeedback('coin');
    } catch (err) { toast.error('שגיאה בשליחת תגובה'); }
  };

  const deleteComment = async (commentId: string) => {
    triggerFeedback('error');
    setComments(comments.filter(c => c.id !== commentId));
    await supabase.from('comments').delete().eq('id', commentId);
  };

  if (loading || !data) return <div className="min-h-screen bg-[#030303] flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>;

  const { circle, isMember, posts } = data;                
  const activeNow = Math.floor((circle.members_count || 1) * 0.4) + 1;
                                                           
  return (
    <FadeIn className="px-5 pt-8 pb-32 bg-[#030303] min-h-screen font-sans flex flex-col gap-5 relative" dir="rtl">                                                              
      <div className="flex items-center justify-between relative z-10">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center text-white/30 bg-white/5 rounded-full z-10 absolute right-0"><ArrowRight size={18} /></button>
        <div className="flex flex-col items-center w-full">
          <h1 className="text-xl font-black text-white tracking-tight">{circle.name}</h1>
          <span className="text-[10px] text-green-400 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]"></span> LIVE</span>                                 
        </div>                                                 
      </div>                                             
      
      <GlassCard className="p-0 rounded-[32px] flex flex-col items-center text-center border-white/5 shadow-2xl relative overflow-hidden min-h-[240px] justify-center mt-2">                                                                
        {circle.cover_url && (                                     
          <div className="absolute inset-0 z-0"><img src={circle.cover_url} className="w-full h-full object-cover opacity-30" /><div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/60 to-transparent"></div></div>
        )}                                                       
        <div className="relative z-10 flex flex-col items-center p-6 w-full mt-auto">                                       
          <h2 className="text-2xl font-black text-white drop-shadow-lg mb-2">{circle.name}</h2>                             
          <p className="text-white/70 text-xs font-medium max-w-[250px] mb-5 leading-relaxed drop-shadow-md">{circle.description}</p>                                                
          <div className="flex items-center gap-4 bg-black/60 backdrop-blur-md rounded-2xl py-3 px-6 w-full text-white font-black text-[10px] justify-around uppercase tracking-widest border border-white/10">
            <span className="flex flex-col items-center gap-1 text-white/70"><Users size={14} className="text-white" /> {circle.members_count || 0} חברים</span>                       
            <div className="w-px h-6 bg-white/20"></div>             
            <span className="flex flex-col items-center gap-1 text-green-400"><Activity size={14} /> {activeNow} אונליין</span>
          </div>                                                 
        </div>                                                 
      </GlassCard>                                                                                                      
      
      <div className="relative mt-2">
        {!isMember && (                                            
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center backdrop-blur-xl bg-[#0A0A0A]/60 rounded-[32px] border border-white/10 p-6 h-[400px]">
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4 shadow-inner"><Lock size={24} className="text-white/60" /></motion.div>
            <h2 className="text-white font-black text-lg mb-1">תוכן חסוי</h2>                                                 
            <p className="text-white/50 text-xs text-center mb-6">רק חברי המועדון יכולים לראות את הפוסטים ולהשתתף בשיח.</p>                                                            
            <Button onClick={handleJoin} disabled={joining} className="w-full h-14 bg-white text-black font-black text-sm uppercase tracking-widest rounded-2xl">{joining ? <Loader2 className="animate-spin" /> : 'הצטרף עכשיו (חינם)'}</Button>                                                      
          </div>                                                 
        )}                                                                                                                
        
        <div className={`flex flex-col gap-4 ${!isMember ? 'opacity-20 pointer-events-none h-[400px] overflow-hidden' : ''}`}>                                                       
          {isMember && (
            <GlassCard className="bg-white/[0.02] p-4 rounded-[28px] border-white/5 relative overflow-hidden">                  
              <textarea value={newPost} onChange={(e) => setNewPost(e.target.value)} placeholder="כתוב משהו למועדון..." className="w-full bg-transparent border-none text-white text-sm h-12 outline-none resize-none placeholder:text-white/30 relative z-10" />                                            
              <div className="flex justify-end mt-2 relative z-10 border-t border-white/5 pt-2">                                  
                <Button onClick={handlePost} disabled={posting || !newPost.trim()} className="bg-white text-black px-6 py-2 h-9 rounded-full font-black text-[10px] uppercase tracking-widest active:scale-95">{posting ? <Loader2 size={14} className="animate-spin" /> : 'שדר'}</Button>                 
              </div>
            </GlassCard>
          )}

          {posts?.map((post: any) => (
            <GlassCard key={post.id} className="p-4 rounded-[24px] bg-[#0A0A0A] border-white/5">
              <div className="flex items-center gap-3 mb-3">                                                                      
                <div className="w-10 h-10 rounded-full bg-[#050505] overflow-hidden border border-white/5 shrink-0">                                                                         
                  {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <Users size={16} className="text-white/20 m-auto mt-2" />}                                                           
                </div>                                                   
                <div className="flex flex-col"><span className="text-white font-black text-sm">{post.profiles?.full_name || 'אנונימי'}</span></div>                                                 
              </div>                                                   
              <p className="text-white/80 text-sm text-right leading-relaxed px-1">{post.content}</p>
                                                                       
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/5">                                         
                <button onClick={() => handleLike(post.id, post.is_liked)} className={`flex items-center gap-1.5 transition-all ${post.is_liked ? 'text-red-500' : 'text-white/30 hover:text-red-400'}`}>                                             
                  <Heart size={16} fill={post.is_liked ? "currentColor" : "none"} /> <span className="text-[10px] font-black">{post.likes_count}</span>                                    
                </button>                                                
                <button onClick={() => openComments(post)} className="flex items-center gap-1.5 text-white/30 hover:text-blue-400 transition-all">
                  <MessageSquare size={16} /> <span className="text-[10px] font-black">{post.comments_count}</span>                                                                        
                </button>                                              
              </div>                                                 
            </GlassCard>                                           
          ))}                                                    
        </div>
      </div>                                                                                                            
      
      <AnimatePresence>
        {activePost && (                                           
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[999] flex flex-col justify-end bg-black/80 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={() => setActivePost(null)}></div>                                      
            <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.8 }} onDragEnd={(e, { offset, velocity }) => { if (offset.y > 100 || velocity.y > 500) setActivePost(null); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="bg-[#0A0A0A] border-t border-white/10 rounded-t-[32px] h-[75vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)] relative z-10 pb-8">
              <div className="w-full flex justify-center pt-4 pb-2 cursor-grab active:cursor-grabbing"><div className="w-16 h-1 bg-white/20 rounded-full"></div></div>                   
              <div className="flex justify-between items-center px-6 pb-4 border-b border-white/5"><h2 className="text-white font-black text-sm">תגובות ({activePost.comments_count})</h2><button onClick={() => setActivePost(null)} className="text-white/30 hover:text-white transition-colors"><X size={18} /></button></div>                                                   
              
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
                {loadingComments ? <Loader2 className="animate-spin mx-auto text-white/20" /> : comments.map((comment, idx) => (
                  <div key={idx} className="flex gap-3">                     
                    <div className="w-8 h-8 rounded-full bg-black shrink-0 mt-1 overflow-hidden">{comment.profiles?.avatar_url ? <img src={comment.profiles.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-white/5" />}</div>                                          
                    <div className="flex flex-col flex-1 bg-white/[0.03] p-3 rounded-2xl rounded-tr-sm border border-white/5">
                      <span className="text-white font-black text-xs mb-1 text-right">{comment.profiles?.full_name || 'אנונימי'}</span>                                                          
                      <p className="text-white/70 text-sm text-right">{comment.content}</p>
                      {comment.user_id === currentUserId && <button onClick={() => deleteComment(comment.id)} className="text-red-400 text-[10px] font-bold mt-2 flex items-center gap-1 w-fit"><Trash2 size={12}/> מחק</button>}
                    </div>                                                 
                  </div>
                ))}
              </div>                                                   
              
              <div className="p-4 border-t border-white/5 bg-[#050505]">
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full pr-2 pl-4 h-12">
                  <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="הוסף תגובה..." className="flex-1 bg-transparent border-none text-white text-sm text-right outline-none" />                       
                  <button onClick={submitComment} disabled={!newComment.trim()} className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shrink-0 active:scale-95 disabled:opacity-50"><Send size={14} className="-ml-1" /></button>                                              
                </div>
              </div>                                                 
            </motion.div>                                          
          </motion.div>                                          
        )}                                                     
      </AnimatePresence>                                     
    </FadeIn>                                              
  );                                                     
};
