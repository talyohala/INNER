import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion'; 
import { supabase } from '../lib/supabase';              
import { FadeIn, GlassCard, Button, Input } from '../components/ui';
import { 
  Users, Loader2, ArrowRight, MessageSquare, Heart, Activity, 
  Send, Lock, X, UserCircle, Trash2, Reply, MoreVertical, Paperclip 
} from 'lucide-react';         
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
  
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const commentsDragControls = useDragControls();
  
  useEffect(() => {                                          
    fetchCircleData();
    const channel = supabase.channel(`circle_${slug}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchCircleData())
      .subscribe();
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
        const { data: memberData } = await supabase.from('circle_members').select('user_id').eq('circle_id', circle.id).eq('user_id', uid);
        isMember = memberData && memberData.length > 0;
      }

      let formattedPosts = [];
      const { data: pData } = await supabase.from('posts').select('*, profiles(*), likes(user_id), comments(id)').eq('circle_id', circle.id).order('created_at', { ascending: false });
      if (pData) {
        formattedPosts = pData.map(p => ({ 
          ...p, 
          likes_count: p.likes?.length || 0, 
          comments_count: p.comments?.length || 0, 
          is_liked: p.likes?.some((l:any) => l.user_id === uid) 
        }));
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
        const { error } = await supabase.rpc('secure_join_circle', {
          p_user_id: currentUserId,
          p_circle_id: data.circle.id,
          p_price: data.circle.is_private ? data.circle.join_price : 0,
          p_owner_id: data.circle.owner_id,
          p_circle_name: data.circle.name,
          p_user_name: 'משתמש'
        });
        
        if (error) throw error;
        
        setData((prev: any) => ({ ...prev, isMember: true, circle: { ...prev.circle, members_count: (prev.circle.members_count || 0) + 1 } }));                                    
        triggerFeedback('success'); toast.success('ברוך הבא למועדון!');  
        fetchCircleData(); 
      }                                                      
    } catch (err: any) { 
      toast.error(err.message.includes('Not enough') ? 'אין מספיק יתרה' : 'שגיאה בהצטרפות'); 
    } finally { setJoining(false); }
  };                                                                                                                

  const handlePost = async () => {                           
    if (!newPost.trim() || !currentUserId) return;
    setPosting(true);                                        
    try {
      const { error } = await supabase.from('posts').insert({ circle_id: data.circle.id, user_id: currentUserId, content: newPost.trim(), media_type: 'text' });
      if (error) throw error;
      setNewPost(''); triggerFeedback('pop'); fetchCircleData();                                     
    } catch (err: any) { toast.error('שגיאה בשליחה'); } finally { setPosting(false); }               
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
    triggerFeedback('pop'); setActivePost(post); setActiveCommentsPostId(post.id); setLoadingComments(true);                                
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

  if (loading || !data) return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>;

  const { circle, isMember, posts } = data;                
  const activeNow = Math.floor((circle.members_count || 1) * 0.4) + 1;
                                                           
  return (
    <FadeIn className="px-4 pt-8 pb-32 bg-[#0A0A0A] min-h-screen font-sans flex flex-col gap-6 relative" dir="rtl">                                                              
      <div className="flex items-center justify-between relative z-10 px-1">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center text-white/80 bg-white/5 border border-white/10 rounded-full shadow-inner active:scale-90 transition-transform"><ArrowRight size={18} /></button>
        <div className="flex flex-col items-center w-full absolute left-0 right-0 pointer-events-none">
          <h1 className="text-[18px] font-black text-white tracking-tight drop-shadow-md truncate max-w-[200px]">{circle.name}</h1>
          <span className="text-[10px] text-green-400 font-bold flex items-center gap-1.5 mt-0.5"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]"></span> LIVE</span>                                 
        </div>                                                 
      </div>                                             
      
      <GlassCard className="p-0 flex flex-col items-center text-center relative overflow-hidden min-h-[260px] justify-center mt-2 border-0 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">                                                                
        {circle.cover_url ? (                                     
          <div className="absolute inset-0 z-0">
            <img src={circle.cover_url} className="w-full h-full object-cover opacity-50" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/40 to-transparent"></div>
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#2196f3]/20 to-transparent z-0"></div>
        )}                                                       
        <div className="relative z-10 flex flex-col items-center p-6 w-full mt-auto pb-8">                                       
          <h2 className="text-3xl font-black text-white drop-shadow-lg mb-3">{circle.name}</h2>                             
          <p className="text-white/80 text-[13px] font-medium max-w-[280px] mb-6 leading-relaxed drop-shadow-md">{circle.description}</p>                                                
          <div className="flex items-center gap-4 bg-black/60 backdrop-blur-xl rounded-[20px] py-3.5 px-8 w-fit text-white font-black text-[11px] justify-center uppercase tracking-widest border border-white/10 shadow-2xl">
            <span className="flex flex-col items-center gap-1.5 text-white/70"><Users size={16} className="text-white" /> {circle.members_count || 0} חברים</span>                       
            <div className="w-px h-8 bg-white/20 mx-2"></div>             
            <span className="flex flex-col items-center gap-1.5 text-green-400"><Activity size={16} /> {activeNow} אונליין</span>
          </div>                                                 
        </div>                                                 
      </GlassCard>                                                                                                      
      
      <div className="relative">
        {!isMember && (                                            
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center backdrop-blur-2xl bg-[#0A0A0A]/80 rounded-[32px] border border-white/5 p-6 h-[400px]">
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-5 shadow-inner">
              <Lock size={28} className="text-white/60" />
            </motion.div>
            <h2 className="text-white font-black text-2xl mb-2 tracking-tight">תוכן חסוי</h2>                                                 
            <p className="text-white/50 text-[13px] text-center mb-8 max-w-[250px] leading-relaxed">רק חברי המועדון יכולים לראות את הפוסטים ולהשתתף בשיח.</p>                                                            
            <Button onClick={handleJoin} disabled={joining} className="w-full h-14 rounded-full text-sm uppercase tracking-widest">
              {joining ? <Loader2 className="animate-spin" /> : circle.is_private && circle.join_price > 0 ? `הצטרף תמורת ${circle.join_price} CRD` : 'הצטרף עכשיו (חינם)'}
            </Button>                                                      
          </div>                                                 
        )}                                                                                                                
        
        <div className={`flex flex-col gap-6 ${!isMember ? 'opacity-10 pointer-events-none h-[400px] overflow-hidden' : ''}`}>                                                       
          {isMember && (
            <GlassCard className="p-5">                  
              <div className="flex gap-3 items-start">
                <div className="w-10 h-10 rounded-[14px] bg-[#111] border border-white/10 shrink-0 overflow-hidden shadow-inner">
                  {supabase.auth.getUser() ? <UserCircle className="w-full h-full p-2 text-white/10" /> : null}
                </div>
                <textarea value={newPost} onChange={(e) => setNewPost(e.target.value)} placeholder="כתוב משהו למועדון..." className="w-full bg-transparent border-none text-white/90 text-[15px] h-12 outline-none resize-none placeholder:text-white/30 pt-2" />                                            
              </div>
              <div className="flex justify-between items-center mt-2 border-t border-white/5 pt-3">                                  
                <button className="text-white/40 hover:text-white transition-colors p-2"><Paperclip size={18}/></button>
                <Button onClick={handlePost} disabled={posting || !newPost.trim()} size="sm" className="rounded-full px-6 py-0 h-9 font-black text-[12px] uppercase tracking-widest">
                  {posting ? <Loader2 size={14} className="animate-spin" /> : 'שדר'}
                </Button>                 
              </div>
            </GlassCard>
          )}

          {posts?.map((post: any) => (
            <GlassCard key={post.id} className="p-0 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/[0.01]">                                                                      
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/profile/${post.user_id}`)}>
                  <div className="w-10 h-10 rounded-[12px] bg-[#111] border border-white/10 overflow-hidden shrink-0 shadow-inner">                                                                         
                    {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={20} className="text-white/20 m-auto mt-2" />}                                                           
                  </div>                                                   
                  <div className="flex flex-col">
                    <span className="text-white font-black text-[14px]">{post.profiles?.full_name || 'אנונימי'}</span>
                    <span className="text-white/30 text-[10px] tracking-widest">{new Date(post.created_at).toLocaleDateString('he-IL')}</span>
                  </div>                                                 
                </div> 
                <button className="text-white/30 hover:text-white transition-colors p-2"><MoreVertical size={18}/></button>                                                  
              </div>                                                   
              
              <div className="p-6"><p className="text-white/90 text-[15px] text-right leading-relaxed whitespace-pre-wrap">{post.content}</p></div>
                                                                       
              <div className="flex items-center gap-6 px-6 py-4 border-t border-white/5 bg-white/[0.01]">                                         
                <button onClick={() => handleLike(post.id, post.is_liked)} className={`flex items-center gap-2 transition-all active:scale-90 ${post.is_liked ? 'text-red-500' : 'text-white/30 hover:text-red-400'}`}>                                             
                  <Heart size={20} fill={post.is_liked ? "currentColor" : "none"} /> <span className="text-[13px] font-black">{post.likes_count}</span>                                    
                </button>                                                
                <button onClick={() => openComments(post)} className="flex items-center gap-2 text-white/30 hover:text-blue-400 transition-all active:scale-90">
                  <MessageSquare size={20} /> <span className="text-[13px] font-black">{post.comments_count}</span>                                                                        
                </button>                                              
              </div>                                                 
            </GlassCard>                                           
          ))}                                                    
        </div>
      </div>                                                                                                            
      
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {activeCommentsPostId && (                                           
            <div className="fixed inset-0 z-[10000] flex flex-col justify-end">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setActiveCommentsPostId(null)}></motion.div>                                      
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, { offset }) => { if (offset.y > 100) setActiveCommentsPostId(null); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="bg-[#0F0F0F] border-t border-white/10 rounded-t-[32px] h-[80vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)] relative z-10" dir="rtl">
                <div className="w-full flex justify-center pt-5 pb-3 cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/20 rounded-full"></div></div>                   
                
                <div className="flex justify-between items-center px-6 pb-4 border-b border-white/5">
                  <h2 className="text-white font-black text-[16px]">תגובות</h2>
                  <button onClick={() => setActiveCommentsPostId(null)} className="text-white/40 hover:text-white transition-colors bg-white/5 w-8 h-8 rounded-full flex items-center justify-center"><X size={16} /></button>
                </div>                                                   
                
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 scrollbar-hide">
                  {loadingComments ? <Loader2 className="animate-spin mx-auto text-white/20 mt-10" /> : comments.map((comment, idx) => (
                    <div key={idx} className="flex gap-3">                     
                      <div className="w-10 h-10 rounded-[12px] bg-[#111] shrink-0 overflow-hidden border border-white/10 shadow-inner">
                        {comment.profiles?.avatar_url ? <img src={comment.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={20} className="m-auto mt-2.5 text-white/20" />}
                      </div>                                          
                      <div className="flex flex-col flex-1">
                        <div className="bg-white/5 p-3.5 rounded-[20px] rounded-tr-sm border border-white/5">
                          <span className="text-white font-black text-[13px] mb-1.5 block">{comment.profiles?.full_name || 'אנונימי'}</span>                                                          
                          <p className="text-white/80 text-[14px] leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                        </div>
                      </div>                                                 
                    </div>
                  ))}
                </div>                                                   
                
                <div className="p-4 border-t border-white/5 bg-[#050505] pb-8">
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full pr-2 pl-4 h-14">
                    <Input type="text" value={newComment} onChange={(e:any) => setNewComment(e.target.value)} placeholder="הוסף תגובה..." className="flex-1 bg-transparent border-none text-white text-[15px] outline-none py-0 shadow-none px-2" />                       
                    <Button onClick={submitComment} disabled={!newComment.trim()} className="w-10 h-10 rounded-full p-0 flex items-center justify-center shrink-0">
                      <Send size={16} className="rtl:-scale-x-100 -ml-0.5" />
                    </Button>                                              
                  </div>
                </div>                                                 
              </motion.div>                                          
            </div>                                          
          )}
        </AnimatePresence>,
        document.body
      )}                                     
    </FadeIn>                                              
  );                                                     
};
