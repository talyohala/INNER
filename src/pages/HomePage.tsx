import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import { FadeIn, GlassCard, Button } from '../components/ui';
import { Loader2, Bell, Users, Lock, Flame, Heart, MessageSquare, Send, X, Image as ImageIcon } from 'lucide-react';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [circles, setCircles] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // States for new post
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // States for comments
  const [activePost, setActivePost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  
  const [onlineUsers, setOnlineUsers] = useState(3420);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => setOnlineUsers(prev => prev + Math.floor(Math.random() * 5) - 2), 5000);
    const channel = supabase.channel('global_feed').on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: 'circle_id=is.null' }, () => fetchData()).subscribe();
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, []);

  const fetchData = async () => {
    try {
      const [circlesData, postsData] = await Promise.all([apiFetch<any[]>('/api/circles'), apiFetch<any[]>('/api/feed')]);
      setCircles((Array.isArray(circlesData) ? circlesData : []).sort((a, b) => (b.members_count || 0) - (a.members_count || 0)));
      setPosts(Array.isArray(postsData) ? postsData : []);
    } catch (err) { } finally { setLoading(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
    } else if (file) {
      toast.error('אנא בחר קובץ תמונה תקין');
    }
  };

  const handlePost = async () => {
    if (!newPost.trim() && !selectedFile) return;
    setPosting(true);
    try {
      let media_url = null;
      
      if (selectedFile) {
        setUploadingImage(true);
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('feed_images')
          .upload(fileName, selectedFile);
        
        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          throw new Error(`שגיאת אחסון (Storage): ${uploadError.message}`);
        }
        
        media_url = supabase.storage.from('feed_images').getPublicUrl(uploadData.path).data.publicUrl;
        setUploadingImage(false);
      }

      await apiFetch<any>('/api/feed', { 
        method: 'POST', 
        body: JSON.stringify({ content: newPost, media_url }) 
      });
      
      setNewPost('');
      setSelectedFile(null);
      triggerFeedback('pop');
      fetchData();
    } catch (err: any) { 
      setUploadingImage(false);
      console.error("Post Error:", err);
      // עכשיו נראה בדיוק מה הודעת השגיאה!
      toast.error(err.message || 'שגיאה לא ידועה בשליחה', { duration: 5000 }); 
    } finally { 
      setPosting(false); 
    }
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    triggerFeedback('pop');
    setPosts(curr => curr.map(p => p.id === postId ? { ...p, is_liked: !isLiked, likes_count: isLiked ? p.likes_count - 1 : p.likes_count + 1 } : p));
    try { await apiFetch(`/api/posts/${postId}/like`, { method: 'POST' }); } catch (err) { fetchData(); }
  };

  const openComments = async (post: any) => {
    triggerFeedback('pop');
    setActivePost(post);
    setLoadingComments(true);
    try {
      const data = await apiFetch<any[]>(`/api/posts/${post.id}/comments`);
      setComments(data || []);
    } catch (err) { toast.error('שגיאה בטעינת תגובות'); } finally { setLoadingComments(false); }
  };

  const submitComment = async () => {
    if (!newComment.trim() || !activePost) return;
    try {
      const added = await apiFetch(`/api/posts/${activePost.id}/comments`, { method: 'POST', body: JSON.stringify({ content: newComment }) });
      setComments([...comments, added]);
      setNewComment('');
      setPosts(curr => curr.map(p => p.id === activePost.id ? { ...p, comments_count: p.comments_count + 1 } : p));
      triggerFeedback('coin');
    } catch (err) { toast.error('שגיאה בשליחת תגובה'); }
  };

  if (loading) return <div className="min-h-screen bg-[#030303] flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>;

  return (
    <FadeIn className="px-5 pt-8 pb-32 bg-[#030303] min-h-screen relative overflow-x-hidden" dir="rtl">
      
      {/* Header */}
      <div className="flex justify-between items-start relative z-10 mb-8 h-12">
        <div className="w-10"></div>
        <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2">
          <motion.h1 animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 4 }} className="text-2xl font-black text-white tracking-tighter uppercase">INNER</motion.h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_#22c55e] animate-pulse"></span>
            <span className="text-[10px] font-black text-white/60 tracking-widest">{onlineUsers.toLocaleString()}</span>
          </div>
        </div>
        <button onClick={() => { triggerFeedback('pop'); navigate('/notifications'); }} className="w-10 h-10 flex justify-center items-center bg-white/5 rounded-full shadow-inner active:scale-90">
          <Bell size={18} className="text-white/60" />
        </button>
      </div>

      {/* Circles Horizontal List */}
      <div className="mb-8">
        <h3 className="text-white/50 text-[10px] font-black uppercase tracking-[0.2em] mb-3 px-1 flex items-center gap-1.5"><Flame size={12} className="text-yellow-500" /> מועדונים חמים</h3>
        <div className="flex gap-4 overflow-x-auto scrollbar-hide -mx-5 px-5 pb-4">
          {circles.map((circle, idx) => (
            <motion.div key={circle.id} whileTap={{ scale: 0.95 }} className="shrink-0 w-40">
              <GlassCard onClick={() => { triggerFeedback('pop'); navigate(`/circle/${circle.slug}`); }} className="p-1 rounded-[24px] overflow-hidden relative border border-white/5 cursor-pointer bg-[#0A0A0A] h-48 flex flex-col justify-end">
                <div className="absolute inset-0 z-0">
                  <div className={`absolute inset-0 bg-black/40 z-10 ${circle.is_member ? 'opacity-0' : 'opacity-100'}`}></div>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/80 to-transparent z-10"></div>
                  {circle.cover_url ? <img src={circle.cover_url} className={`w-full h-full object-cover ${circle.is_member ? 'blur-none' : 'blur-[3px]'}`} /> : <div className="w-full h-full flex items-center justify-center bg-[#111]"><Users size={24} className="text-white/20" /></div>}
                </div>
                {!circle.is_member && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/10"><Lock size={12} className="text-white/60" /></div>}
                <div className="relative z-20 p-3">
                  <h2 className="text-white font-black text-xs drop-shadow-md line-clamp-1">{circle.name}</h2>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Composer (New Post) */}
      <GlassCard className="p-3 rounded-[24px] mb-6 border-white/5 bg-white/[0.02]">
        <textarea 
          value={newPost} 
          onChange={(e) => setNewPost(e.target.value)} 
          placeholder="שדר משהו לכולם..." 
          className="w-full bg-transparent border-none text-white text-sm font-medium focus:outline-none h-12 resize-none placeholder:text-white/20 px-2 mt-1" 
        />
        
        {/* תצוגה מקדימה של תמונה */}
        {selectedFile && (
          <div className="relative mt-2 mb-2 px-2">
            <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="w-24 h-24 rounded-xl object-cover border border-white/10 shadow-lg" />
            <button onClick={() => setSelectedFile(null)} className="absolute -top-2 -right-1 w-6 h-6 bg-red-500 rounded-full text-white flex items-center justify-center text-xs shadow-md">X</button>
          </div>
        )}

        <div className="flex justify-end items-center gap-3 border-t border-white/5 pt-3 mt-1">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
          
          <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 flex items-center justify-center text-white/40 hover:text-white transition-colors bg-white/5 rounded-full">
            <ImageIcon size={18} />
          </button>
          
          <Button onClick={handlePost} disabled={posting || uploadingImage || (!newPost.trim() && !selectedFile)} className="w-10 h-10 p-0 rounded-full bg-white text-black active:scale-95 flex items-center justify-center shrink-0">
            {posting || uploadingImage ? <Loader2 size={18} className="animate-spin text-black" /> : <Send size={16} className="rtl:-scale-x-100 -ml-0.5" />}
          </Button>
        </div>
      </GlassCard>

      {/* Feed List */}
      <div className="flex flex-col gap-4">
        {posts.map((post) => (
          <GlassCard key={post.id} className="p-4 rounded-[24px] bg-[#0A0A0A] border-white/5 relative overflow-hidden">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-black border border-white/5 overflow-hidden shrink-0">
                {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-white/5" />}
              </div>
              <div className="flex flex-col">
                <span className="text-white font-black text-sm">{post.profiles?.full_name || 'אנונימי'}</span>
              </div>
            </div>
            
            {/* הצגת תמונה במידה ויש בפוסט */}
            {post.media_url && (
              <div className="mb-4 rounded-2xl overflow-hidden border border-white/5 bg-black/50">
                <img src={post.media_url} alt="Drop media" className="w-full h-auto object-cover max-h-[400px]" />
              </div>
            )}

            <p className="text-white/80 text-sm leading-relaxed font-medium mb-4 text-right px-1">{post.content}</p>
            
            <div className="flex items-center gap-5 border-t border-white/5 pt-3">
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

      {/* מגירת תגובות (Comments Drawer) */}
      <AnimatePresence>
        {activePost && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[999] flex flex-col justify-end bg-black/80 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={() => setActivePost(null)}></div>
            <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.8 }} onDragEnd={(e, { offset, velocity }) => { if (offset.y > 100 || velocity.y > 500) setActivePost(null); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="bg-[#0A0A0A] border-t border-white/10 rounded-t-[32px] h-[75vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)] relative z-10 pb-8">
              <div className="w-full flex justify-center pt-4 pb-2 cursor-grab active:cursor-grabbing"><div className="w-16 h-1 bg-white/20 rounded-full"></div></div>
              <div className="flex justify-between items-center px-6 pb-4 border-b border-white/5">
                <h2 className="text-white font-black text-sm">תגובות ({activePost.comments_count})</h2>
                <button onClick={() => setActivePost(null)} className="text-white/30 hover:text-white transition-colors"><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
                {loadingComments ? <Loader2 className="animate-spin mx-auto text-white/20" /> : comments.map((comment, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-black shrink-0 mt-1 overflow-hidden">{comment.profiles?.avatar_url ? <img src={comment.profiles.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-white/5" />}</div>
                    <div className="flex flex-col flex-1 bg-white/[0.03] p-3 rounded-2xl rounded-tr-sm border border-white/5">
                      <span className="text-white font-black text-xs mb-1 text-right">{comment.profiles?.full_name || 'אנונימי'}</span>
                      <p className="text-white/70 text-sm text-right">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-white/5 bg-[#050505]">
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full pr-2 pl-4 h-12">
                  <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="הוסף תגובה..." className="flex-1 bg-transparent border-none text-white text-sm text-right outline-none" />
                  <button onClick={submitComment} disabled={!newComment.trim()} className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shrink-0 active:scale-95 disabled:opacity-50">
                    <Send size={14} className="-ml-1" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </FadeIn>
  );
};
