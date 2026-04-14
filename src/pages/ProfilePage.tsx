import React, { useEffect, useMemo, useRef, useState } from 'react';                                              
import { createPortal } from 'react-dom';                
import { useNavigate, useParams } from 'react-router-dom';                                                        
import { motion, AnimatePresence, useDragControls, useScroll, useTransform } from 'framer-motion';                
import {                                                   
  UserCircle, Loader2, MessageSquare, MoreVertical, MoreHorizontal, Share2, Reply, Trash2, X, Send, Download, 
  Link as LinkIcon, Edit2, Bookmark, MapPin, GraduationCap, ChevronDown, ChevronUp, Briefcase, Calendar, 
  Sparkles, LogOut, Crown, Flame, Diamond, Handshake, ShieldCheck, Heart, Lock, Coins
} from 'lucide-react';                                   
import { useAuth } from '../context/AuthContext';        
import { apiFetch } from '../lib/api';                   
import { supabase } from '../lib/supabase';              
import { FadeIn, Button } from '../components/ui';       
import { triggerFeedback } from '../lib/sound';          
import toast from 'react-hot-toast';                     
import { Share } from '@capacitor/share';                                                                         

const SEAL_TYPES = [
  { id: 'fire', icon: <Flame size={24} />, label: 'אש', color: 'text-orange-500', xp: 15 },
  { id: 'diamond', icon: <Diamond size={24} />, label: 'יהלום', color: 'text-blue-400', xp: 50 },
  { id: 'alliance', icon: <Handshake size={24} />, label: 'ברית', color: 'text-emerald-400', xp: 100 }
];                                                                                                              

export const ProfilePage: React.FC = () => {               
  const navigate = useNavigate();                          
  const { username: routeId } = useParams<{ username?: string }>();                                                 
  const { user, profile: authProfile, loading: authLoading } = useAuth();                                                                                                    
  
  const [mounted, setMounted] = useState(false);           
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);                                           
  
  const followersDragControls = useDragControls();         
  const followingDragControls = useDragControls();         
  const commentsDragControls = useDragControls();          
  const gridActionDragControls = useDragControls();                                                                 
  
  const { scrollY } = useScroll();                         
  const coverY = useTransform(scrollY, [0, 250], [0, -100]);                                                        
  const coverOpacity = useTransform(scrollY, [0, 200], [1, 0]);                                                     
  const coverScale = useTransform(scrollY, [0, 200], [1, 0.95]);                                                                                                             
  
  const [data, setData] = useState<any>({ profile: {}, memberships: [], ownedCircles: [], posts: [], savedPosts: [] });                                                      
  const [loadingData, setLoadingData] = useState(true);                                                             
  
  const [isFollowing, setIsFollowing] = useState(false);   
  const [followersCount, setFollowersCount] = useState(0);                                                          
  const [followingCount, setFollowingCount] = useState(0);                                                          
  const [followLoading, setFollowLoading] = useState(false);
  
  const [showFollowersList, setShowFollowersList] = useState(false);                                                
  const [showFollowingList, setShowFollowingList] = useState(false);                                                
  const [usersListData, setUsersListData] = useState<any[]>([]);                                                    
  const [loadingUsersList, setLoadingUsersList] = useState(false);                                                                                                           
  
  const [activeTab, setActiveTab] = useState<'posts' | 'joined' | 'saved'>('posts');                                                                                         
  const [fullScreenMedia, setFullScreenMedia] = useState<any[] | null>(null);                                       
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);                                                    
  const scrollTimeout = useRef<any>(null);                                                                          
  
  const [activePost, setActivePost] = useState<any>(null);                                                          
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);                            
  const [comments, setComments] = useState<any[]>([]);     
  const [newComment, setNewComment] = useState('');        
  const [loadingComments, setLoadingComments] = useState(false);                                                                                                             
  
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);                                    
  const [replyingTo, setReplyingTo] = useState<any | null>(null);                                                   
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});                              
  const [commentActionModal, setCommentActionModal] = useState<any | null>(null);                                   
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  
  const [optionsMenuPost, setOptionsMenuPost] = useState<any>(null);                                                
  const [activeDescPost, setActiveDescPost] = useState<any>(null);                                                  
  const [gridActionModal, setGridActionModal] = useState<{ item: any, type: 'post' | 'saved' | 'circle' } | null>(null);                                                                                                              
  const [sealSelectorPost, setSealSelectorPost] = useState<any | null>(null);
  
  const [isDropMode, setIsDropMode] = useState(false);
  const [contributeModal, setContributeModal] = useState<any | null>(null);
  const [contributeAmount, setContributeAmount] = useState<number | ''>(50);
  const [contributing, setContributing] = useState(false);

  const [currentUserId, setCurrentUserId] = useState('');  
  const [showCreatePost, setShowCreatePost] = useState(false);                                                      
  const [editingPost, setEditingPost] = useState<any | null>(null);                                                 
  const [editPostText, setEditPostText] = useState('');    
  const [aboutOpen, setAboutOpen] = useState(false);                                                                
  
  const isMyProfile = !routeId || routeId === authProfile?.username || routeId === user?.id;                                                                                 
  
  const stateRef = useRef({ 
    comments: false, options: false, desc: false, fullscreen: false, commentAction: false, 
    followers: false, following: false, create: false, gridAction: false, seals: false, contribute: false 
  });                                                                                                    
  
  const openOverlay = (action: () => void) => {              
    window.history.pushState({ overlay: true }, '');         
    action();                                              
  };                                                                                                                
  
  const closeOverlay = () => {                               
    window.history.back();                                 
  };                                                                                                                
  
  useEffect(() => {                                          
    setMounted(true);                                        
    setPortalNode(document.getElementById('root') || document.body);                                                
  }, []);                                                                                                           
  
  useEffect(() => {                                          
    stateRef.current = { 
      comments: !!activeCommentsPostId, options: !!optionsMenuPost, desc: !!activeDescPost, 
      fullscreen: !!fullScreenMedia, commentAction: !!commentActionModal, followers: showFollowersList, 
      following: showFollowingList, create: showCreatePost, gridAction: !!gridActionModal, seals: !!sealSelectorPost,
      contribute: !!contributeModal
    };                                                 
  }, [activeCommentsPostId, optionsMenuPost, activeDescPost, fullScreenMedia, commentActionModal, showFollowersList, showFollowingList, showCreatePost, gridActionModal, sealSelectorPost, contributeModal]);                                                            
  
  useEffect(() => {                                          
    const handlePopState = () => {                             
      const s = stateRef.current;                              
      if (s.gridAction) setGridActionModal(null);              
      else if (s.commentAction) setCommentActionModal(null);                                                            
      else if (s.seals) setSealSelectorPost(null);
      else if (s.contribute) setContributeModal(null);
      else if (s.followers) setShowFollowersList(false);       
      else if (s.following) setShowFollowingList(false);       
      else if (s.comments) { setActiveCommentsPostId(null); setActivePost(null); setReplyingTo(null); setEditingCommentId(null); setNewComment(''); }                            
      else if (s.options) setOptionsMenuPost(null);            
      else if (s.desc) setActiveDescPost(null);                
      else if (s.create) { setShowCreatePost(false); setEditingPost(null); setEditPostText(''); }                       
      else if (s.fullscreen) setFullScreenMedia(null);       
    };                                                                                                                
    window.addEventListener('popstate', handlePopState);     
    return () => window.removeEventListener('popstate', handlePopState);                                            
  }, []);                                                                                                           
  
  useEffect(() => {                                          
    let isMounted = true;                                                                                             
    
    const loadProfileData = async () => {                      
      try {                                                      
        setLoadingData(true);                                    
        const { data: authData } = await supabase.auth.getUser();                                                         
        const me = authData.user?.id || '';                      
        if (me) setCurrentUserId(me);                                                                                     
        
        let targetId = '';                                                                                                
        
        if (isMyProfile) {                                         
          const headers = me ? { 'x-user-id': me } : {};           
          const result = await apiFetch<any>('/api/profile/collection', { headers }).catch(() => ({ profile: authProfile }));                                                        
          targetId = result.profile?.id || authProfile?.id || me;                                                                                                                    
          
          const [{ data: memberships }, { data: ownedCircles }, { data: myPosts }] = await Promise.all([                      
            supabase.from('circle_members').select('circle:circles(*)').eq('user_id', targetId).neq('role', 'admin'),                                                                  
            supabase.from('circles').select('*').eq('owner_id', targetId),                                                    
            supabase.from('posts').select('*, seals:post_seals(id, seal_type, user_id), comments_count:comments(count)').eq('user_id', targetId).order('created_at', { ascending: false }),           
          ]);                                                                                                               
          
          const formattedPosts = (myPosts || []).map((p: any) => ({
            ...p,
            seals_count: p.seals?.length || 0,
            has_sealed: !!me && p.seals?.some((s: any) => s.user_id === me),
            comments_count: p.comments_count?.[0]?.count || 0,
            profiles: result.profile || authProfile
          }));

          let mySavedPosts: any[] = [];                            
          try {                                                      
            const { data: saved } = await supabase.from('saved_posts').select('post_id, posts(*, seals:post_seals(id, seal_type, user_id), comments_count:comments(count), profiles:user_id(*))').eq('user_id', targetId);                                                            
            mySavedPosts = saved?.map((s: any) => {
              if(!s.posts) return null;
              return {
                ...s.posts,
                seals_count: s.posts.seals?.length || 0,
                has_sealed: !!me && s.posts.seals?.some((seal: any) => seal.user_id === me),
                comments_count: s.posts.comments_count?.[0]?.count || 0
              };
            }).filter(Boolean) || [];                                           
          } catch {}                                                                                                        
          
          if (isMounted) {                                           
            setData({ profile: result.profile || authProfile, memberships: memberships || result.memberships || [], ownedCircles: ownedCircles || result.ownedCircles || [], posts: formattedPosts, savedPosts: mySavedPosts });               
          }                                                      
        } else {                                                   
          const identifier = routeId || '';                        
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);                                                                         
          let query = supabase.from('profiles').select('*');                                                                
          query = isUuid ? query.eq('id', identifier) : query.eq('username', identifier);                                                                                            
          
          const { data: publicProfile } = await query.maybeSingle();                                                        
          if (!publicProfile) throw new Error('Profile not found');                                               
          
          targetId = publicProfile.id;                             
          
          const [{ data: memberships }, { data: ownedCircles }, { data: userPosts }] = await Promise.all([                    
            supabase.from('circle_members').select('circle:circles(*)').eq('user_id', targetId).neq('role', 'admin'),                                                                  
            supabase.from('circles').select('*').eq('owner_id', targetId),                                                    
            supabase.from('posts').select('*, seals:post_seals(id, seal_type, user_id), comments_count:comments(count)').eq('user_id', targetId).order('created_at', { ascending: false }),           
          ]);                                                                                                               
          
          const formattedPosts = (userPosts || []).map((p: any) => ({
            ...p,
            seals_count: p.seals?.length || 0,
            has_sealed: !!me && p.seals?.some((s: any) => s.user_id === me),
            comments_count: p.comments_count?.[0]?.count || 0,
            profiles: publicProfile
          }));

          let isFollowingUser = false;                             
          if (me) {                                                  
            try {                                                      
              const { data: followData } = await supabase.from('followers').select('*').eq('follower_id', me).eq('following_id', targetId).maybeSingle();                                
              if (followData) isFollowingUser = true;                
            } catch {}                                             
          }                                                                                                                 
          
          if (isMounted) {                                           
            setData({ profile: publicProfile, memberships: memberships || [], ownedCircles: ownedCircles || [], posts: formattedPosts, savedPosts: [] });                             
            setIsFollowing(isFollowingUser);                       
          }                                                      
        }                                                                                                                 
        
        if (targetId && isMounted) {                               
          const [{ count: followers }, { count: following }] = await Promise.all([                                            
            supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', targetId),              
            supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', targetId),             
          ]);                                                      
          setFollowersCount(followers || 0);                       
          setFollowingCount(following || 0);                     
        }                                                      
      } catch {                                                  
        toast.error('הפרופיל לא נמצא');                          
        navigate('/');                                         
      } finally {                                                
        if (isMounted) setLoadingData(false);                  
      }                                                      
    };                                                                                                                
    
    if (!authLoading) loadProfileData();                     
    return () => { isMounted = false; };                   
  }, [user, routeId, isMyProfile, authLoading, navigate, authProfile]);                                                                                                      
  
  const mediaPosts = useMemo(() => {                         
    const pool = activeTab === 'saved' && isMyProfile ? data.savedPosts || [] : data.posts || [];                     
    return pool.filter((p: any) => p.media_url);           
  }, [data.posts, data.savedPosts, activeTab, isMyProfile]);                                                                                                                 
  
  const getRandomMediaBatch = (size = 4) => {                
    if (!mediaPosts.length) return [];                       
    return Array.from({ length: size }).map(() => {            
      const picked = mediaPosts[Math.floor(Math.random() * mediaPosts.length)];                                         
      return { ...picked, _uid: `${picked.id}-${Math.random().toString(36).slice(2)}` };                              
    });                                                    
  };                                                                                                                
  
  useEffect(() => {                                          
    if (!fullScreenMedia) return;                            
    const observer = new IntersectionObserver((entries) => {                                                            
      entries.forEach((entry) => {                               
        const vid = entry.target as HTMLVideoElement;            
        if (vid.tagName !== 'VIDEO') return;                     
        if (entry.isIntersecting) { vid.muted = false; vid.play().catch(() => {}); }                                      
        else { vid.pause(); vid.muted = true; vid.currentTime = 0; }                                                    
      });                                                    
    }, { threshold: 0.7 });                                  
    document.querySelectorAll('.profile-full-media-item').forEach((v) => observer.observe(v));                        
    return () => observer.disconnect();                    
  }, [fullScreenMedia, currentMediaIndex]);                                                                         
  
  const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {                                               
    const target = e.currentTarget;                          
    if (scrollTimeout.current) return;                       
    scrollTimeout.current = setTimeout(() => {                 
      scrollTimeout.current = null;                            
      const index = Math.round(target.scrollTop / target.clientHeight);                                                 
      if (index !== currentMediaIndex) setCurrentMediaIndex(index);                                                     
      if (target.scrollHeight - target.scrollTop <= target.clientHeight * 2 && fullScreenMedia) {                         
        const more = getRandomMediaBatch(4);                     
        if (more.length) setFullScreenMedia((prev) => [...(prev || []), ...more]);                                      
      }                                                      
    }, 120);                                               
  };                                                                                                                
  
  const handleFollowToggle = async () => {                   
    if (followLoading) return;                               
    setFollowLoading(true);                                  
    triggerFeedback('pop');                                  
    try {                                                      
      const { data: authData } = await supabase.auth.getUser();                                                         
      const myId = authData.user?.id;                          
      const targetId = data.profile?.id;                       
      if (!myId || !targetId) throw new Error('missing');                                                               
      await apiFetch(`/api/profile/${targetId}/follow`, { method: 'POST', headers: { 'x-user-id': myId } });                                                                     
      if (isFollowing) { setIsFollowing(false); setFollowersCount((prev) => Math.max(0, prev - 1)); }                   
      else { setIsFollowing(true); setFollowersCount((prev) => prev + 1); triggerFeedback('success'); }               
    } catch { toast.error('שגיאה'); } finally { setFollowLoading(false); }                                          
  };                                                                                                                
  
  const openUsersListSheet = async (type: 'followers' | 'following') => {                                             
    triggerFeedback('pop');                                  
    openOverlay(() => { if (type === 'followers') setShowFollowersList(true); else setShowFollowingList(true); });    
    setLoadingUsersList(true);                               
    setUsersListData([]);                                    
    try {                                                      
      const targetId = data.profile?.id;                       
      let userIds: string[] = [];                              
      if (type === 'followers') {                                
        const { data: fData } = await supabase.from('followers').select('follower_id').eq('following_id', targetId);                                                               
        userIds = fData ? fData.map((d: any) => d.follower_id) : [];                                                    
      } else {                                                   
        const { data: fData } = await supabase.from('followers').select('following_id').eq('follower_id', targetId);                                                               
        userIds = fData ? fData.map((d: any) => d.following_id) : [];                                                   
      }                                                               
      if (userIds.length > 0) {                                  
        const { data: pData } = await supabase.from('profiles').select('*').in('id', userIds);                            
        setUsersListData(pData || []);                         
      }                                                      
    } catch { toast.error('שגיאה בטעינת הרשימה'); } finally { setLoadingUsersList(false); }                         
  };                                                     
  
  const handleSeal = async (postId: string, sealType: string) => {
    triggerFeedback('pop');
    closeOverlay();
    
    const update = (list: any[]) => list.map((p) => p.id === postId ? { ...p, has_sealed: true, seals_count: (p.seals_count || 0) + 1 } : p);
    setData((prev: any) => ({ ...prev, posts: update(prev.posts || []), savedPosts: update(prev.savedPosts || []) }));
    if (fullScreenMedia) setFullScreenMedia((prev) => (prev ? update(prev) : prev));

    try {
      const { error } = await supabase.from('post_seals').insert({ post_id: postId, user_id: currentUserId, seal_type: sealType });
      if (error) {
        if (error.code === '23505') toast.error('כבר נתת חותם לפוסט זה');
        else throw error;
        const revert = (list: any[]) => list.map((p) => p.id === postId ? { ...p, has_sealed: false, seals_count: Math.max(0, (p.seals_count || 0) - 1) } : p);
        setData((prev: any) => ({ ...prev, posts: revert(prev.posts || []), savedPosts: revert(prev.savedPosts || []) }));
      } else {
        triggerFeedback('success');
      }
    } catch (err) {
      toast.error('שגיאה בהענקת חותם');
    }
  };
  
  const handleShare = async (post: any) => {                 
    triggerFeedback('pop');                                  
    const publicUrl = `https://inner-app.com/post/${post.id}`;                                                        
    const textToShare = `${post.content ? `${post.content}\n\n` : ''}צפה בפוסט הזה ב-INNER!`;                         
    try {                                                      
      const isNative = typeof window !== 'undefined' && !!(window as any).Capacitor && (window as any).Capacitor.isNativePlatform?.();                                           
      if (isNative) await Share.share({ title: 'INNER', text: textToShare, url: publicUrl, dialogTitle: 'שתף עם חברים' });                                                       
      else if (navigator.share && window.isSecureContext) await navigator.share({ title: 'INNER', text: textToShare, url: publicUrl });                                          
      else { await navigator.clipboard.writeText(`${textToShare}\n${publicUrl}`); toast.success('הקישור הועתק ללוח'); }                                                        
    } catch {}                                             
  };                                                                                                                
  
  const submitComment = async () => {                        
    if (!newComment.trim() || !activePost) return;           
    try {                                                      
      if (editingCommentId) {                                    
        await supabase.from('comments').update({ content: newComment.trim() }).eq('id', editingCommentId);                
        setComments((prev) => prev.map((c) => (c.id === editingCommentId ? { ...c, content: newComment.trim() } : c)));                                                            
        setEditingCommentId(null);                             
      } else {                                                   
        const payload: any = { post_id: activePost.id, user_id: currentUserId, content: newComment.trim() };                   
        if (replyingTo) payload.parent_id = replyingTo.id;                                                                
        const { data: resData } = await supabase.from('comments').insert(payload).select('*, profiles(*)').single();                                                               
        if (resData) {                                             
          setComments((prev) => [...prev, resData]);               
          const update = (list: any[]) => list.map((p) => p.id === activePost.id ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p);                                       
          setData((prev: any) => ({ ...prev, posts: update(prev.posts || []), savedPosts: update(prev.savedPosts || []) }));                                                         
          if (fullScreenMedia) setFullScreenMedia((prev) => (prev ? update(prev) : prev));                                  
          if (replyingTo) setExpandedThreads((prev) => ({ ...prev, [replyingTo.id]: true }));                               
          triggerFeedback('coin');                               
        }                                                      
      }                                                        
      setNewComment(''); setReplyingTo(null);                
    } catch { toast.error('שגיאה בשרת'); }                 
  };                                                                                                                
  
  const toggleCommentLike = (commentId: string) => {
    setLikedComments((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
    triggerFeedback('pop');
  };

  const deleteComment = async (commentId: string) => {       
    triggerFeedback('error');                                
    setComments((curr) => curr.filter((c) => c && c.id !== commentId && c.parent_id !== commentId));                  
    const update = (list: any[]) => list.map((p) => p.id === activePost?.id ? { ...p, comments_count: Math.max(0, (p.comments_count || 0) - 1) } : p);
    setData((prev: any) => ({ ...prev, posts: update(prev.posts || []), savedPosts: update(prev.savedPosts || []) }));
    if (fullScreenMedia) setFullScreenMedia((prev) => (prev ? update(prev) : prev));
    try { await supabase.from('comments').delete().eq('id', commentId); } catch {}                                  
  };                                                                                                                
  
  const handleDownloadMedia = async (mediaUrl: string) => {                                                           
    try {                                                      
      toast.loading('מוריד קובץ...', { id: 'dl' });            
      const response = await fetch(mediaUrl);                  
      const blob = await response.blob();                      
      const url = window.URL.createObjectURL(blob);            
      const a = document.createElement('a'); a.href = url; a.download = `INNER_Media_${Date.now()}`;                    
      document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a);           
      toast.success('הקובץ נשמר בהצלחה', { id: 'dl' });      
    } catch { toast.error('לא ניתן להוריד את הקובץ', { id: 'dl' }); }                                                 
    if (optionsMenuPost) closeOverlay();                   
  };                                                                                                                
  
  const handleCopyLink = async (post: any) => {              
    const publicUrl = `https://inner-app.com/post/${post.id}`;                                                        
    try { await navigator.clipboard.writeText(publicUrl); toast.success('הקישור הועתק ללוח', { icon: '🔗' }); } catch { toast.error('שגיאה בהעתקה'); }                         
    if (optionsMenuPost || gridActionModal) closeOverlay();                                                         
  };                                                                                                                
  
  const deletePost = async (postId: string) => {             
    triggerFeedback('error');                                
    if (optionsMenuPost || gridActionModal) closeOverlay();                                                           
    if (fullScreenMedia) setFullScreenMedia((curr) => curr?.filter((p) => p.id !== postId) || null);                  
    setData((prev: any) => ({ ...prev, posts: (prev.posts || []).filter((p: any) => p.id !== postId), savedPosts: (prev.savedPosts || []).filter((p: any) => p.id !== postId) }));                                                      
    await supabase.from('posts').delete().eq('id', postId);                                                         
  };                                                                                                                
  
  const removeFromSaved = async (postId: string) => {        
    triggerFeedback('pop');                                  
    if (gridActionModal) closeOverlay();                     
    setData((prev: any) => ({ ...prev, savedPosts: (prev.savedPosts || []).filter((p: any) => p.id !== postId) }));                                                            
    try { await supabase.from('saved_posts').delete().match({ user_id: currentUserId, post_id: postId }); toast.success('הוסר מהשמורים'); } catch { toast.error('שגיאה בהסרה'); }                                                     
  };                                                                                                                
  
  const leaveCircle = async (circleId: string) => {          
    triggerFeedback('error');                                
    if (gridActionModal) closeOverlay();                     
    setData((prev: any) => ({ ...prev, memberships: (prev.memberships || []).filter((m: any) => m.circle?.id !== circleId) }));                                                
    try { await supabase.from('circle_members').delete().match({ user_id: currentUserId, circle_id: circleId }); toast.success('עזבת את המועדון'); } catch { toast.error('שגיאה בעזיבת המועדון'); }                                   
  };                                                                                                                
  
  const saveEditedPost = async () => {                       
    if (!editingPost || !editPostText.trim()) return;        
    try {                                                      
      await supabase.from('posts').update({ content: editPostText.trim() }).eq('id', editingPost.id);                   
      const update = (list: any[]) => list.map((p) => (p.id === editingPost.id ? { ...p, content: editPostText.trim() } : p));                                                   
      setData((prev: any) => ({ ...prev, posts: update(prev.posts || []), savedPosts: update(prev.savedPosts || []) }));                                                         
      if (fullScreenMedia) setFullScreenMedia((prev) => (prev ? update(prev) : prev));                                  
      toast.success('הפוסט עודכן'); closeOverlay();            
      setTimeout(() => { setShowCreatePost(false); setEditingPost(null); setEditPostText(''); }, 50);                 
    } catch { toast.error('שגיאה בעדכון הפוסט'); }         
  };                                                                                                                

  const handleContribute = async () => {
    if (!contributeModal || !contributeAmount || contributeAmount <= 0) return;
    setContributing(true);
    triggerFeedback('pop');
    try {
      const { error } = await supabase.rpc('contribute_to_drop', {
        p_post_id: contributeModal.id,
        p_amount: contributeAmount
      });
      if (error) throw error;
      toast.success('תרומתך התקבלה! 🎉');
      closeOverlay();
      triggerFeedback('coin');
    } catch (err: any) {
      triggerFeedback('error');
      toast.error(err.message || 'שגיאה בתרומה. בדוק יתרה בארנק.');
    } finally {
      setContributing(false);
    }
  };
  
  const stopPropagation = (e: any) => e.stopPropagation();                                                                                                                   
  
  if (authLoading || loadingData) {                          
    return <div className="min-h-screen bg-surface flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" size={32} /></div>;               
  }                                                                                                                 
  
  const userProfile = isMyProfile ? { ...(authProfile || {}), ...(data?.profile || {}) } : data?.profile || {};     
  const currentLevel = userProfile.level || 1;             
  const currentXP = userProfile.xp || 0;                   
  const streak = userProfile.streak || 0;                  
  const xpToNextLevel = currentLevel * 1000;               
  const xpProgress = Math.min((currentXP / xpToNextLevel) * 100, 100);                                              
  const trueReputation = Math.floor(currentXP / 10) + currentLevel * 5;                                             
  
  const joinedCircles = data.memberships?.map((m: any) => m?.circle).filter(Boolean) || [];                         
  const userPosts = data.posts || [];                      
  const userSavedPosts = data.savedPosts || [];            
  const displayLink = userProfile?.social_link ? userProfile.social_link.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : '';                                                                                                 
  
  const aboutItems = [                                       
    { key: 'location', label: 'מתגורר ב', value: userProfile?.location, icon: <MapPin size={16} /> },                 
    { key: 'relationship_status', label: 'מצב משפחתי', value: userProfile?.relationship_status, icon: <Heart size={16} /> },                                                   
    { key: 'education', label: 'השכלה', value: userProfile?.education, icon: <GraduationCap size={16} /> },           
    { key: 'job_title', label: 'עיסוק', value: userProfile?.job_title, icon: <Briefcase size={16} /> },               
    { key: 'birth_date', label: 'תאריך לידה', value: userProfile?.birth_date ? new Date(userProfile.birth_date).toLocaleDateString('he-IL') : '', icon: <Calendar size={16} /> },                                                       
    { key: 'bio', label: 'ביו', value: userProfile?.bio, icon: <Sparkles size={16} />, full: true },                
  ].filter((item) => item.value);                                                                                   
  
  return (                                                   
    <div className="bg-surface min-h-screen relative font-sans" dir="rtl">                                                                                                       
      
      {/* Edit Profile Button */}
      <div className="fixed top-4 left-4 right-4 flex justify-between items-center z-50 pointer-events-none">             
        <div className="w-10" />                                 
        {isMyProfile && (                                          
          <button onClick={() => { triggerFeedback('pop'); navigate('/edit-profile'); }} className="pointer-events-auto w-10 h-10 flex justify-center items-center bg-surface-card border border-white/[0.05] rounded-full shadow-lg active:scale-90 transition-all hover:bg-white/[0.05]">                                                          
            <Edit2 size={16} className="text-white" />             
          </button>                                              
        )}                                                     
      </div>                                                                                                            
      
      {/* Cover Image Parallax */}
      <motion.div style={{ y: coverY, opacity: coverOpacity, scale: coverScale }} className="fixed top-0 left-0 w-full h-[240px] bg-surface z-0 overflow-hidden origin-top">                                                                
        {userProfile.cover_url ? (                                 
          <img src={userProfile.cover_url} className="w-full h-full object-cover opacity-70" />                           
        ) : (                                                      
          <div className="absolute inset-0 bg-surface-card" />                                                            
        )}                                                       
        <div className="absolute top-6 right-5 flex flex-col items-center">                                                 
          <span className="text-accent-primary text-[10px] font-black uppercase tracking-widest mb-0.5">רמה</span>          
          <span className="text-white font-black text-[24px] leading-none drop-shadow-md">{currentLevel}</span>           
        </div>                                                 
      </motion.div>                                                                                                     
      
      {/* Main Content Area */}
      <FadeIn className="relative z-10 pt-[200px] pb-32">        
        <div className="bg-surface rounded-t-[40px] px-4 min-h-screen flex flex-col items-center shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/[0.05]">                                                                         
          
          {/* Avatar */}
          <motion.div whileHover={{ scale: 1.05 }} className="w-[100px] h-[100px] rounded-full bg-surface p-1.5 relative -mt-[50px] z-20 shadow-xl">                                   
            <div className="w-full h-full rounded-full overflow-hidden bg-surface-card border-2 border-white/[0.05] relative flex items-center justify-center">                          
              {userProfile?.avatar_url ? (                               
                <img src={userProfile.avatar_url} className="w-full h-full object-cover object-center" alt="" />                
              ) : (                                                      
                <span className="text-brand-muted font-black text-4xl flex items-center justify-center leading-none">{(userProfile?.full_name || 'א')[0]}</span>                                                           
              )}                                                     
            </div>                                                 
          </motion.div>                                                                                                     
          
          {/* Name & Title */}
          <div className="text-center mt-3 w-full">                  
            <div className="flex items-center justify-center gap-2 mb-1">                                                       
              <h2 className="text-[22px] font-black text-brand tracking-tight">{userProfile?.full_name || 'משתמש'}</h2>                                                                  
              {userProfile?.role_label === 'CORE' && <Crown size={16} className="text-accent-primary drop-shadow-sm" />}                                                               
            </div>                                                   
            <p className="text-brand-muted font-bold text-[13px] tracking-widest mb-5" dir="ltr">@{userProfile?.username || 'user'}</p>                                                                                                         
            
            {/* Stats */}
            <div className="flex items-center justify-center gap-3 text-[14px] text-brand-muted font-medium mb-6 w-full max-w-[300px] mx-auto flex-wrap">                                
              <span className="cursor-pointer hover:text-brand transition-colors" onClick={() => openUsersListSheet('followers')}>עוקבים <span className="font-black text-white">{followersCount}</span></span>                                   
              <span className="text-white/[0.1]">•</span>              
              <span className="cursor-pointer hover:text-brand transition-colors" onClick={() => openUsersListSheet('following')}>נעקבים <span className="font-black text-white">{followingCount}</span></span>                                   
              <span className="text-white/[0.1]">•</span>              
              <span>מוניטין <span className="font-black text-white">{trueReputation}</span></span>                            
            </div>                                                                                                            
            
            {/* Actions (Follow & Message) */}
            {!isMyProfile && (                                         
              <div className="flex justify-center gap-3 mb-6 w-full px-2">                                                        
                <button onClick={handleFollowToggle} disabled={followLoading} className={`flex-1 h-12 rounded-full font-black text-[14px] flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 ${isFollowing ? 'bg-surface-card text-brand border border-white/[0.05]' : 'bg-accent-primary text-surface shadow-lg'}`}>                                                          
                  {followLoading ? <Loader2 size={18} className="animate-spin" /> : isFollowing ? 'נעקב' : 'עקוב'}                
                </button>                                                
                <button onClick={() => navigate(`/chat/${userProfile.id}`)} className="flex-1 h-12 bg-white/[0.03] text-brand border border-white/[0.05] rounded-full font-black text-[14px] flex items-center justify-center gap-2 transition-all active:scale-95">                                                 
                  <MessageSquare size={16} className="text-brand-muted" />
                  הודעה                                                  
                </button>                                              
              </div>                                                 
            )}                                                                                                                
            
            {/* About Section */}
            {(userProfile?.zodiac || userProfile?.social_link || aboutItems.length > 0) && (                                    
              <div className="flex flex-col items-center gap-2 mb-6 w-full">                                                      
                {userProfile?.social_link && (                             
                  <a href={userProfile.social_link.startsWith('http') ? userProfile.social_link : `https://${userProfile.social_link}`} target="_blank" rel="noopener noreferrer" className="text-white text-[13px] font-bold flex items-center gap-1.5 hover:text-white/80 transition-colors">                                                                           
                    <span dir="ltr" className="tracking-wide text-white">{displayLink}</span>                                         
                    <LinkIcon size={14} className="text-white" />                                                                   
                  </a>                                                   
                )}                                                       
                
                {userProfile?.zodiac && <span className="text-brand-muted text-[13px] font-medium">{userProfile.zodiac}</span>}                                                                                                                     
                
                {aboutItems.length > 0 && (                                
                  <div className="w-full max-w-[360px] mt-2">                                                                         
                    <button onClick={() => { triggerFeedback('pop'); setAboutOpen((prev) => !prev); }} className="w-full flex items-center justify-center gap-2 text-brand-muted hover:text-brand transition-colors">                                     
                      <span className="text-[13px] font-black tracking-wide">אודות</span>                                               
                      {aboutOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}                                               
                    </button>                                                                                                         
                    <AnimatePresence initial={false}>                          
                      {aboutOpen && (                                            
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">                                                                                
                          <div className="mt-4 bg-surface-card border border-white/[0.05] rounded-[24px] p-4 text-right shadow-lg">                                                                    
                            <div className="grid grid-cols-1 gap-3">                                                                            
                              {aboutItems.map((item: any) => (                                                                                    
                                <div key={item.key} className={`flex items-start gap-3 rounded-[16px] border border-white/[0.02] bg-white/[0.02] px-4 py-3 ${item.full ? 'flex-col items-stretch' : ''}`}>                                                            
                                  {!item.full ? (                                            
                                    <>                                                         
                                      <div className="mt-0.5 text-accent-primary">{item.icon}</div>                                                     
                                      <div className="flex-1">                                                                                            
                                        <div className="text-brand-muted text-[10px] font-black tracking-widest mb-1 uppercase">{item.label}</div>                                                                 
                                        <div className="text-brand text-[13px] font-medium">{item.value}</div>                                          
                                      </div>                                                 
                                    </>                                                    
                                  ) : (                                                      
                                    <>                                                         
                                      <div className="flex items-center gap-2 text-accent-primary">                                                       
                                        {item.icon}                                              
                                        <div className="text-brand-muted text-[10px] font-black tracking-widest uppercase">{item.label}</div>                                                                    
                                      </div>                                                   
                                      <div className="text-brand text-[13px] font-medium leading-6 whitespace-pre-wrap">{item.value}</div>                                                                     
                                    </>                                                    
                                  )}                                                     
                                </div>                                                 
                              ))}                                                    
                            </div>                                                 
                          </div>                                                 
                        </motion.div>                                          
                      )}                                                     
                    </AnimatePresence>                                     
                  </div>                                                 
                )}                                                     
              </div>                                                 
            )}                                                     
          </div>                                                                                                            
          
          {/* XP Progress */}
          <div className="w-full flex flex-col gap-6 px-4 mb-8 mt-2">                                                         
            <div className="flex items-center justify-between">                                                                 
              <div className="flex items-center gap-3">                  
                <Flame size={24} className="text-orange-500" />                                             
                <span className="text-brand-muted text-[14px] font-black tracking-widest">רצף כניסות</span>                     
              </div>                                                   
              <span className="text-white font-black text-[18px]">{streak} ימים</span>                                        
            </div>                                                                                                            
            
            {isMyProfile && (                                          
              <div className="flex flex-col gap-2.5">                    
                <div className="flex justify-between items-end">                                                                    
                  <span className="text-brand-muted text-[12px] font-black tracking-widest">פעילות יומית</span>                     
                  <span className="text-brand-muted text-[12px] font-bold"><span className="text-accent-primary font-black drop-shadow-md">{currentXP}</span> / {xpToNextLevel}</span>                                                              
                </div>                                                   
                <div className="w-full h-3 bg-surface-card border border-white/[0.02] rounded-full overflow-hidden relative shadow-inner">                                                   
                  <motion.div initial={{ width: 0 }} animate={{ width: `${xpProgress}%` }} transition={{ duration: 1.5, ease: 'easeOut' }} className="absolute top-0 right-0 h-full bg-gradient-to-l from-accent-primary via-indigo-400 to-purple-400 rounded-full" />                                       
                </div>                                                 
              </div>                                                 
            )}                                                     
          </div>                                                                                                            
          
          {/* TABS & GRID */}
          <div className="w-full mb-10">                             
            <div className="flex gap-2 bg-white/[0.03] border border-white/[0.05] p-1.5 rounded-full z-10 relative mb-6 shadow-lg mx-0">                                                 
              <button onClick={() => setActiveTab('posts')} className={`flex-1 py-3 text-[13px] font-black transition-all rounded-full flex items-center justify-center ${activeTab === 'posts' ? 'bg-surface-card text-brand shadow-md' : 'text-brand-muted hover:text-brand'}`}>פוסטים</button>                                                                   
              <button onClick={() => setActiveTab('joined')} className={`flex-1 py-3 text-[13px] font-black transition-all rounded-full flex items-center justify-center ${activeTab === 'joined' ? 'bg-surface-card text-brand shadow-md' : 'text-brand-muted hover:text-brand'}`}>מועדונים</button>                                                               
              {isMyProfile && <button onClick={() => setActiveTab('saved')} className={`flex-1 py-3 text-[13px] font-black transition-all rounded-full flex items-center justify-center ${activeTab === 'saved' ? 'bg-surface-card text-brand shadow-md' : 'text-brand-muted hover:text-brand'}`}>שמורים</button>}                                                
            </div>                                                                                                            
            
            <AnimatePresence mode="wait">                              
              
              {/* POSTS TAB */}
              {activeTab === 'posts' && (                                
                <motion.div key="posts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-3 gap-1 -mx-3.5">                                  
                  {userPosts.length === 0 ? (                                
                    <div className="col-span-3 text-center py-10 text-brand-muted text-[14px] font-bold">אין פוסטים עדיין</div>                                                              
                  ) : (                                                      
                    userPosts.map((post: any) => (                             
                      <div key={post.id} onClick={() => { openOverlay(() => { const first = { ...post, _uid: `${post.id}-${Math.random().toString(36).slice(2)}` }; const rest = mediaPosts.filter((p: any) => p.id !== post.id).map((p: any) => ({ ...p, _uid: `${p.id}-${Math.random().toString(36).slice(2)}` })); setFullScreenMedia([first, ...rest]); }); }} className="aspect-[2/3] bg-surface-card relative overflow-hidden cursor-pointer active:opacity-70 border border-white/[0.05] rounded-[16px]">                                         
                        {isMyProfile && (                                          
                          <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setGridActionModal({ item: post, type: 'post' })); }} className="absolute top-2 left-2 z-20 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] hover:text-white/70 transition-colors">                                        
                            <MoreHorizontal size={24} strokeWidth={2.5} />                                                                  
                          </button>                                              
                        )}                                                       
                        {post.media_url ? (
                          post.media_type === 'video' ? <video src={post.media_url} className="w-full h-full object-cover" /> : <img src={post.media_url} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center p-2 text-center text-brand-muted text-[11px] line-clamp-3 font-medium">{post.content}</div>
                        )}                                                  
                      </div>                                                 
                    ))                                                     
                  )}                                                     
                </motion.div>                                          
              )}                                                                                                                
              
              {/* JOINED CIRCLES TAB */}
              {activeTab === 'joined' && (                               
                <motion.div key="joined" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-3 gap-1 -mx-3.5">                                 
                  {joinedCircles.map((circle: any) => (                      
                    <div key={circle.id} onClick={() => navigate(`/circle/${circle.slug}`)} className="aspect-[2/3] bg-surface-card relative overflow-hidden cursor-pointer border border-white/[0.05] rounded-[16px] group">                             
                      <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setGridActionModal({ item: circle, type: 'circle' })); }} className="absolute top-2 left-2 z-20 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] hover:text-white/70 transition-colors opacity-0 group-hover:opacity-100 touch-manipulation">                                        
                        <MoreHorizontal size={24} strokeWidth={2.5} />                                                                  
                      </button>                                                
                      {circle.cover_url ? (
                        <img src={circle.cover_url} className="w-full h-full object-cover opacity-80" /> 
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-brand-muted font-black text-2xl">{circle.name?.charAt(0)}</div>
                      )}                                                  
                      <div className="absolute bottom-0 w-full p-2 bg-surface/80 backdrop-blur-sm text-center border-t border-white/[0.05]">
                        <span className="text-brand text-[10px] font-bold line-clamp-1">{circle.name}</span>
                      </div>                                                                           
                    </div>                                                 
                  ))}                                                    
                </motion.div>                                          
              )}                                                                                                                
              
              {/* SAVED POSTS TAB */}
              {activeTab === 'saved' && isMyProfile && (                 
                <motion.div key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-3 gap-1 -mx-3.5">                                  
                  {userSavedPosts.length === 0 ? (                           
                    <div className="col-span-3 text-center py-10 text-brand-muted text-[14px] font-bold">אין פוסטים שמורים</div>                                                             
                  ) : (                                                      
                    userSavedPosts.map((post: any) => (                        
                      <div key={post.id} onClick={() => { const savedMedia = userSavedPosts.filter((p: any) => p.media_url); openOverlay(() => { const first = { ...post, _uid: `${post.id}-${Math.random().toString(36).slice(2)}` }; const rest = savedMedia.filter((p: any) => p.id !== post.id).map((p: any) => ({ ...p, _uid: `${p.id}-${Math.random().toString(36).slice(2)}` })); setFullScreenMedia([first, ...rest]); }); }} className="aspect-[2/3] bg-surface-card relative overflow-hidden cursor-pointer active:opacity-70 border border-white/[0.05] rounded-[16px]">                               
                        <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setGridActionModal({ item: post, type: 'saved' })); }} className="absolute top-2 left-2 z-20 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] hover:text-white/70 transition-colors">                                       
                          <MoreHorizontal size={24} strokeWidth={2.5} />                                                                  
                        </button>                                                
                        {post.media_url ? (
                          post.media_type === 'video' ? <video src={post.media_url} className="w-full h-full object-cover" /> : <img src={post.media_url} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center p-2 text-center text-brand-muted text-[11px] line-clamp-3 font-medium">{post.content}</div>
                        )}                                                  
                      </div>                                                 
                    ))                                                     
                  )}                                                     
                </motion.div>                                          
              )}                                                     
            </AnimatePresence>                                     
          </div>                                                 
        </div>                                                 
      </FadeIn>                                                                                                         
      
      {/* OVERLAYS (All Dark Mode, Clean UI) */}          
      {mounted && portalNode && createPortal(                    
        <>                                                         
          <AnimatePresence>                                          
            
            {/* FULL SCREEN MEDIA */}                                
            {fullScreenMedia && (                                      
              <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed inset-0 z-[999999] bg-surface">                     
                <div className="w-full h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide" onScroll={handleContainerScroll}>                                                      
                  {fullScreenMedia.map((vid, idx) => {                       
                    const isVid = vid.media_url?.match(/\.(mp4|webm|mov)$/i);                                                         
                    const keyVal = vid._uid ? vid._uid : `${vid.id}-${idx}`;                                                          
                    return (                                                   
                      <div key={keyVal} className="w-full h-screen snap-center relative bg-surface flex items-center justify-center">                                                              
                        {isVid ? (
                          <video src={vid.media_url} loop playsInline className="w-full h-full object-cover full-media-item" onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause())} /> 
                        ) : (
                          <img src={vid.media_url} className="w-full h-full object-contain full-media-item" onError={(e) => { e.currentTarget.src = 'https://placehold.co/500x500/111/333?text=Media+Unavailable'; }} />
                        )}                                                           
                        
                        {/* Action Buttons: Left Side Column (No Background, No blur) */}
                        <div className="absolute bottom-32 left-4 flex flex-col gap-6 items-center z-50 pointer-events-auto">                                   
                          <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setSealSelectorPost(vid)); }} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
                            <Flame size={32} className={vid.has_sealed ? 'text-orange-500' : 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]'} fill={vid.has_sealed ? 'currentColor' : 'none'} strokeWidth={1.5} />
                            <span className="text-white text-[13px] font-black drop-shadow-md">{vid.seals_count || 0}</span>
                          </button>                                                
                          <button onClick={(e) => { e.stopPropagation(); openOverlay(() => { setActivePost(vid); setActiveCommentsPostId(vid.id); setLoadingComments(true); supabase.from('comments').select('*, profiles!user_id(*)').eq('post_id', vid.id).order('created_at', { ascending: true }).then((r) => { setComments(r.data || []); setLoadingComments(false); }); }); }} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
                            <MessageSquare size={32} className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" strokeWidth={1.5} />
                            <span className="text-white text-[13px] font-black drop-shadow-md">{vid.comments_count}</span>
                          </button>                           
                        </div>                                                   
                        
                        {/* 3 Dots Menu */}
                        <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setOptionsMenuPost(vid)); }} className="absolute bottom-8 left-5 z-[60] active:scale-90 transition-transform p-1">
                          <MoreVertical size={28} strokeWidth={2} className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
                        </button>                                                   

                        {/* Bottom Info Area */}
                        <div className="absolute bottom-0 left-0 right-0 p-6 pt-32 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex flex-col justify-end pointer-events-none">                                                            
                          
                          {/* Content */}
                          {vid.content && (
                            <p className="text-white drop-shadow-md text-[15px] font-medium text-right pr-2 w-5/6 line-clamp-3 pointer-events-auto cursor-pointer mb-4" onClick={(e) => { e.stopPropagation(); openOverlay(() => setActiveDescPost(vid)); }}>
                              {vid.content}
                            </p>                                                             
                          )}

                          {/* Circles (Round Pills) */}
                          {vid.user_circles && vid.user_circles.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto scrollbar-hide items-center mb-3 pointer-events-auto">
                              {vid.user_circles.slice(0, 10).map((circle: any) => (
                                <div key={circle.id} onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/circle/${circle.slug || circle.id}`), 50); }} className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-transform">
                                  <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20 shadow-sm bg-surface flex items-center justify-center">
                                    {circle.cover_url ? <img src={circle.cover_url} className="w-full h-full object-cover" loading="lazy" /> : <Users className="w-4 h-4 text-white/70" />}
                                  </div>
                                  <span className="text-[9px] text-white drop-shadow-md font-bold max-w-[55px] truncate text-center uppercase tracking-wider">{circle.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* User Info */}
                          <div className="flex items-center gap-3 cursor-pointer w-fit pointer-events-auto" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${vid.user_id}`), 50); }}>                                                                              
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-card border border-white/20 shrink-0 shadow-lg flex items-center justify-center">
                              {vid.profiles?.avatar_url ? <img src={vid.profiles.avatar_url} className="w-full h-full object-cover" /> : <span className="text-white font-black text-lg flex items-center justify-center leading-none">{(vid.profiles?.full_name || 'א')[0]}</span>}
                            </div>                                     
                            <div className="flex flex-col text-right">
                              <span className="text-white font-black text-[15px] drop-shadow-md">{vid.profiles?.full_name || 'אנונימי'}</span>                                                         
                              <span className="text-white/80 text-[10px] font-bold drop-shadow-md">{new Date(vid.created_at).toLocaleDateString('he-IL')}</span>
                            </div>
                          </div>                                                   
                          
                        </div>                                                 
                      </div>                                                 
                    );                                                     
                  })}                                                    
                </div>                                                 
              </motion.div>                                          
            )}                                                                                                                
            
            {/* SEAL SELECTOR MODAL */}
            {sealSelectorPost && (
              <div className="fixed inset-0 z-[9999999] flex flex-col justify-end p-4" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div initial={{ y: '100%', scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: '100%', scale: 0.95 }} transition={{ type: 'spring', damping: 25, stiffness: 400 }} className="relative z-10 bg-surface border border-surface-border rounded-[40px] p-8 shadow-2xl flex flex-col items-center gap-6">
                  <div className="w-12 h-1.5 bg-white/10 rounded-full mb-2" />
                  <div className="text-center">
                    <h3 className="text-brand font-black text-xl tracking-tighter uppercase">הענק חותם יוקרה</h3>
                    <p className="text-brand-muted text-[13px] mt-2 font-medium">החותם יישאר לשבוע ויעניק ליוצר XP</p>
                  </div>

                  <div className="grid grid-cols-3 gap-4 w-full">
                    {SEAL_TYPES.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => handleSeal(sealSelectorPost.id, type.id)}
                        className="flex flex-col items-center gap-3 p-5 rounded-[28px] bg-surface-card border border-surface-border hover:bg-white/5 transition-all active:scale-95 shadow-sm"
                      >
                        <div className={`${type.color} drop-shadow-lg`}>{type.icon}</div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-brand font-black text-[12px] uppercase tracking-widest">{type.label}</span>
                          <span className="text-accent-primary bg-accent-primary/10 border border-accent-primary/20 px-2 py-0.5 rounded-md text-[10px] font-black tracking-widest">+{type.xp} XP</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </div>
            )}

            {/* CONTRIBUTE MODAL */}
            {contributeModal && (
              <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[40px] p-6 flex flex-col gap-4 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border text-center">
                  <div className="w-full py-2 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/10 rounded-full" /></div>
                  
                  <div className="flex flex-col items-center gap-2 mb-2">
                    <div className="w-16 h-16 bg-surface-card border border-surface-border rounded-full flex items-center justify-center shadow-inner mb-2">
                      <Lock size={28} className="text-accent-primary" />
                    </div>
                    <h2 className="text-xl font-black text-brand tracking-widest uppercase">שחרר את הדרופ</h2>
                    <p className="text-brand-muted text-[13px] font-medium leading-relaxed max-w-[250px]">
                      השקע CRD כדי לעזור לחשוף את הפוסט הזה לכולם.
                    </p>
                  </div>

                  <div className="bg-surface-card border border-surface-border p-4 rounded-2xl flex flex-col gap-2">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-[11px] font-black text-brand-muted tracking-widest uppercase">התקדמות</span>
                      <span className="text-[13px] font-black text-brand">{contributeModal.current_crd} / {contributeModal.required_crd}</span>
                    </div>
                    <div className="w-full h-2.5 bg-surface rounded-full overflow-hidden border border-surface-border">
                      <div className="h-full bg-accent-primary" style={{ width: `${Math.min(100, (contributeModal.current_crd / contributeModal.required_crd) * 100)}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-surface-card border border-surface-border rounded-2xl p-2 pl-4 mt-2">
                    <div className="w-12 h-12 bg-surface rounded-xl flex items-center justify-center shrink-0">
                      <Coins size={20} className="text-brand-muted" />
                    </div>
                    <input type="number" value={contributeAmount} onChange={(e) => setContributeAmount(Number(e.target.value))} placeholder="50" className="flex-1 bg-transparent border-none text-xl font-black text-brand outline-none text-left" dir="ltr" />
                    <span className="text-brand-muted font-bold text-[13px] tracking-widest">CRD</span>
                  </div>

                  <Button onClick={handleContribute} disabled={contributing || !contributeAmount} className="h-14 bg-accent-primary text-white font-black text-[15px] uppercase tracking-widest rounded-full mt-2 shadow-md active:scale-95 transition-all">
                    {contributing ? <Loader2 className="animate-spin text-white" /> : 'השקע בדרופ'}
                  </Button>
                </motion.div>
              </div>
            )}

            {/* FOLLOWERS / FOLLOWING MODAL */}                                                                   
            {(showFollowersList || showFollowingList) && (                                                                      
              <div className="fixed inset-0 z-[100000] flex flex-col justify-end" dir="rtl" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>                                  
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />                                                             
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="relative z-10 bg-surface rounded-t-[40px] h-[75vh] flex flex-col overflow-hidden pb-10 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border">                                  
                  <div className="w-full py-5 flex justify-center cursor-grab active:cursor-grabbing border-b border-surface-border" onPointerDown={(e) => (showFollowersList ? followersDragControls.start(e) : followingDragControls.start(e))} style={{ touchAction: 'none' }}><div className="w-16 h-1.5 bg-white/10 rounded-full" /></div>                         
                  <div className="text-center py-4 border-b border-surface-border"><h3 className="text-brand font-black text-lg">{showFollowersList ? 'עוקבים' : 'נעקבים'}</h3></div>                                                                 
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-hide">                                     
                    {loadingUsersList ? <Loader2 className="animate-spin mx-auto text-accent-primary mt-10" /> : usersListData.length === 0 ? <div className="text-center text-brand-muted mt-10 text-[14px]">אין נתונים להצגה</div> : usersListData.map((item) => (                                               
                      <div key={item.id} onClick={() => { closeOverlay(); setTimeout(() => navigate(`/profile/${item.username || item.id}`), 50); }} className="flex items-center gap-4 bg-surface-card p-4 rounded-[24px] border border-surface-border cursor-pointer active:scale-[0.98] transition-all shadow-sm">                                                         
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-surface border border-surface-border shrink-0 flex items-center justify-center">
                          {item.avatar_url ? <img src={item.avatar_url} className="w-full h-full object-cover" /> : <span className="text-brand-muted font-black text-sm flex items-center justify-center leading-none">{(item.full_name || 'א')[0]}</span>}
                        </div>                                                                               
                        <div className="flex flex-col flex-1">                                                                              
                          <span className="text-brand font-black text-[15px] flex items-center gap-1.5">{item.full_name || 'אנונימי'}</span>                                                         
                          <span className="text-brand-muted text-[12px] font-medium" dir="ltr">@{item.username || 'user'}</span>                                                                   
                        </div>                                                 
                      </div>                                                 
                    ))}                                                    
                  </div>                                                 
                </motion.div>                                          
              </div>                                                 
            )}                                                                                                                
            
            {/* COMMENTS MODAL */}                       
            {activeCommentsPostId && (                                 
              <div className="fixed inset-0 z-[99999] flex flex-col justify-end" dir="rtl" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>                                   
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />                                                             
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="relative z-10 bg-surface rounded-t-[40px] h-[85vh] flex flex-col overflow-hidden pb-10 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border">                                  
                  <div className="w-full py-5 flex justify-center cursor-grab active:cursor-grabbing border-b border-surface-border" onPointerDown={(e) => commentsDragControls.start(e)} style={{ touchAction: 'none' }}><div className="w-16 h-1.5 bg-white/10 rounded-full" /></div>                        
                  <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 scrollbar-hide">                                     
                    {loadingComments ? <Loader2 className="animate-spin mx-auto text-accent-primary mt-10" /> : comments.filter((c) => c && !c.parent_id).map((c) => {                           
                      const replies = comments.filter((r) => r && r.parent_id === c.id);                                                
                      return (                                                   
                        <div key={c.id} className="flex flex-col gap-2">                                                                    
                          <div className="flex gap-3">                               
                            <div className="w-10 h-10 min-w-[40px] rounded-full bg-surface-card shrink-0 overflow-hidden cursor-pointer border border-surface-border flex items-center justify-center" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${c.user_id}`), 50); }}>                                                          
                              {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} className="w-full h-full object-cover object-center" /> : <span className="text-brand-muted font-black text-sm flex items-center justify-center leading-none">{(c.profiles?.full_name || 'א')[0]}</span>}                                               
                            </div>                                                   
                            <div className="flex flex-col flex-1">                                                                              
                              <div className="bg-surface-card p-4 rounded-[24px] rounded-tr-sm cursor-pointer border border-surface-border shadow-sm" onClick={() => openOverlay(() => setCommentActionModal(c))}>                                                  
                                <span className="text-brand font-black text-[13px] mb-1 inline-block uppercase tracking-widest" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${c.user_id}`), 50); }}>{c.profiles?.full_name || 'אנונימי'}</span>                                                         
                                <p className="text-brand text-[13px] whitespace-pre-wrap leading-relaxed">{c.content}</p>                                                                                
                              </div>                                                 
                            </div>                                                 
                          </div>                                                   
                          {replies.length > 0 && (                                   
                            <div className="pr-10 flex flex-col gap-2 mt-1">                                                                    
                              {replies.map((reply) => (                                  
                                <div key={reply.id} className="bg-surface/50 rounded-[20px] p-3 border border-surface-border">                                                                               
                                  <div className="text-brand text-[11px] font-black mb-1 uppercase tracking-widest">{reply.profiles?.full_name || 'אנונימי'}</div>                                                                     
                                  <div className="text-brand-muted text-[12px]">{reply.content}</div>                                             
                                </div>                                                 
                              ))}                                                    
                            </div>                                                 
                          )}                                                     
                        </div>                                                 
                      );                                                     
                    })}                                                    
                  </div>                                                   
                  <div className="p-4 bg-surface border-t border-surface-border flex gap-2 pb-8">                                     
                    <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="הוסף תגובה..." className="flex-1 bg-surface-card border border-surface-border text-brand rounded-full px-5 outline-none text-[15px] placeholder:text-brand-muted shadow-inner" />                                                                  
                    <Button onClick={submitComment} disabled={!newComment.trim()} className="w-14 h-14 p-0 rounded-full shrink-0 bg-white text-black shadow-[0_5px_15px_rgba(255,255,255,0.1)] active:scale-95 disabled:opacity-50 transition-all"><Send size={20} className="rtl:-scale-x-100 -ml-1" /></Button>                                                       
                  </div>                                                 
                </motion.div>                                          
              </div>                                                 
            )}                                                                                                                
            
            {/* OPTIONS MODAL */}                        
            {optionsMenuPost && (                                      
              <div className="fixed inset-0 z-[99999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>                                             
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />                                                         
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[40px] p-6 flex flex-col gap-3 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border">                                                     
                  <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/10 rounded-full" /></div>                          
                  <button onClick={() => { closeOverlay(); setTimeout(() => handleShare(optionsMenuPost), 100); }} className="w-full p-4 bg-surface-card rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm"><span>שתף פוסט</span><Share2 size={20} className="text-brand-muted" /></button>                              
                  {optionsMenuPost.media_url && <button onClick={() => handleDownloadMedia(optionsMenuPost.media_url)} className="w-full p-4 bg-surface-card rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm"><span>שמור למכשיר</span><Download size={20} className="text-brand-muted" /></button>}                    
                  <button onClick={async () => { try { await supabase.from('saved_posts').insert({ user_id: currentUserId, post_id: optionsMenuPost.id }); toast.success('הפוסט נשמר במועדפים!'); } catch { toast.error('הפוסט כבר שמור אצלך'); } closeOverlay(); }} className="w-full p-4 bg-surface-card rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm"><span>שמור במועדפים</span><Bookmark size={20} className="text-brand-muted" /></button>                                                
                  <button onClick={() => handleCopyLink(optionsMenuPost)} className="w-full p-4 bg-surface-card rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm"><span>העתק קישור</span><LinkIcon size={20} className="text-brand-muted" /></button>                                                                   
                  {optionsMenuPost.user_id === currentUserId && (                                                                     
                    <>                                                         
                      <button onClick={() => { closeOverlay(); setTimeout(() => { openOverlay(() => { setEditingPost(optionsMenuPost); setEditPostText(optionsMenuPost.content || ''); setShowCreatePost(true); }); }, 100); }} className="w-full p-4 bg-surface-card rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm mt-2"><span>ערוך פוסט</span><Edit2 size={20} className="text-brand-muted" /></button>                                  
                      <button onClick={() => { if (window.confirm('למחוק פוסט?')) { deletePost(optionsMenuPost.id); } }} className="w-full p-4 bg-surface-card border border-red-500/30 rounded-2xl text-red-500 font-black flex justify-between items-center text-[15px] mt-2 active:scale-[0.98] transition-all"><span>מחק פוסט</span><Trash2 size={20} className="text-red-500" /></button>                                     
                    </>                                                    
                  )}                                                     
                </motion.div>                                          
              </div>                                                 
            )}                                                                                                                
            
            {/* COMMENT ACTION MODAL */}                 
            {commentActionModal && (                                   
              <div className="fixed inset-0 z-[100000] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>                                            
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />                                                         
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[40px] p-6 flex flex-col gap-3 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border">                                                     
                  <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/10 rounded-full" /></div>                          
                  <button onClick={() => { closeOverlay(); setReplyingTo(commentActionModal.parent_id ? comments.find((c) => c?.id === commentActionModal.parent_id) : commentActionModal); setNewComment(`@${commentActionModal.profiles?.full_name} `); }} className="w-full p-4 bg-surface-card rounded-2xl text-brand font-black flex justify-between items-center text-[15px] hover:bg-white/5 transition-all border border-surface-border shadow-sm"><span>השב לתגובה</span><Reply size={20} className="text-brand-muted" /></button>                                                                 
                  {commentActionModal.user_id === currentUserId && (                                                                  
                    <>                                                         
                      <button onClick={() => { closeOverlay(); setEditingCommentId(commentActionModal.id); setNewComment(commentActionModal.content); }} className="w-full p-4 bg-surface-card rounded-2xl text-brand font-black flex justify-between items-center text-[15px] hover:bg-white/5 transition-all border border-surface-border shadow-sm"><span>ערוך תגובה</span><Edit2 size={20} className="text-brand-muted" /></button>                                                       
                      <button onClick={() => { if (window.confirm('למחוק תגובה?')) { closeOverlay(); deleteComment(commentActionModal.id); } }} className="w-full p-4 bg-surface-card border border-red-500/30 rounded-2xl text-red-500 font-black flex justify-between items-center text-[15px] mt-2 active:scale-[0.98] transition-all"><span>מחק תגובה</span><Trash2 size={20} className="text-red-500" /></button>                                                                      
                    </>                                                    
                  )}                                                     
                </motion.div>                                          
              </div>                                                 
            )}                                                                                                                
            
            {/* FULL DESC POST */}                       
            {activeDescPost && (                                       
              <div className="fixed inset-0 z-[99999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>                                             
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />                                                         
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[40px] flex flex-col overflow-hidden pb-10 max-h-[75vh] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border">                                  
                  <div className="w-full py-5 flex justify-center cursor-grab active:cursor-grabbing border-b border-surface-border"><div className="w-16 h-1.5 bg-white/10 rounded-full" /></div>                                                    
                  <div className="px-6 py-4 border-b border-surface-border"><h2 className="text-brand font-black text-[16px] text-center">תיאור מלא</h2></div>                               
                  <div className="p-6 overflow-y-auto" onPointerDown={stopPropagation} onTouchStart={stopPropagation}><p className="text-brand text-[15px] leading-relaxed text-right whitespace-pre-wrap">{activeDescPost.content}</p></div>                                                                
                </motion.div>                                          
              </div>                                                 
            )}                                                                                                                
            
            {/* GRID ACTION MODAL */}
            {gridActionModal && (                                      
              <div className="fixed inset-0 z-[100000] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>                                            
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />                                                         
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[40px] p-6 flex flex-col gap-3 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border" onPointerDown={(e) => gridActionDragControls.start(e)} style={{ touchAction: 'none' }}>                       
                  <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/10 rounded-full" /></div>                          
                  {gridActionModal.type === 'post' && (                      
                    <>                                                         
                      <button onClick={() => { closeOverlay(); setTimeout(() => { openOverlay(() => { setEditingPost(gridActionModal.item); setEditPostText(gridActionModal.item.content || ''); setShowCreatePost(true); }); }, 100); }} className="w-full p-4 bg-surface-card rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm"><span>ערוך פוסט</span><Edit2 size={20} className="text-brand-muted" /></button>                             
                      <button onClick={() => { if (window.confirm('למחוק פוסט?')) deletePost(gridActionModal.item.id); }} className="w-full p-4 bg-surface-card border border-red-500/30 rounded-2xl text-red-500 font-black flex justify-between items-center text-[15px] mt-2 active:scale-[0.98] transition-all"><span>מחק פוסט</span><Trash2 size={20} className="text-red-500" /></button>                                    
                    </>                                                    
                  )}                                                       
                  {gridActionModal.type === 'saved' && (                     
                    <button onClick={() => removeFromSaved(gridActionModal.item.id)} className="w-full p-4 bg-surface-card rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm"><span>הסר משמורים</span><Bookmark size={20} className="text-brand-muted" /></button>                                                       
                  )}                                                       
                  {gridActionModal.type === 'circle' && (                    
                    <>                                                         
                      <button onClick={() => { closeOverlay(); setTimeout(() => { navigate(`/circle/${gridActionModal.item.slug}`); }, 100); }} className="w-full p-4 bg-surface-card rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm"><span>כנס למועדון</span><LinkIcon size={20} className="text-brand-muted" /></button>                                                         
                      <button onClick={() => { if (window.confirm('לעזוב את המועדון?')) leaveCircle(gridActionModal.item.id); }} className="w-full p-4 bg-surface-card border border-red-500/30 rounded-2xl text-red-500 font-black flex justify-between items-center text-[15px] mt-2 active:scale-[0.98] transition-all"><span>עזוב מועדון</span><LogOut size={20} className="text-red-500" /></button>                          
                    </>                                                    
                  )}                                                     
                </motion.div>                                          
              </div>                                                 
            )}                                                                                                                
            
            {/* CREATE POST MODAL */}                    
            {showCreatePost && (                                       
              <div className="fixed inset-0 z-[100000] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>                                            
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />                                                             
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[40px] p-6 flex flex-col gap-4 pb-12 border-t border-surface-border shadow-[0_-20px_50px_rgba(0,0,0,0.8)]">                                                     
                  <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/10 rounded-full" /></div>                          
                  <div className="flex justify-between items-center px-2"><h3 className="text-brand font-black text-[16px] uppercase tracking-widest">עריכת פוסט</h3><button onClick={closeOverlay} className="text-brand-muted hover:text-brand"><X size={24} /></button></div>                               
                  <textarea value={editPostText} onChange={(e) => setEditPostText(e.target.value)} placeholder="כתוב משהו..." className="h-36 bg-surface-card rounded-[24px] p-5 text-brand text-[15px] outline-none resize-none border border-surface-border placeholder:text-brand-muted shadow-inner" />                                                             
                  <Button onClick={saveEditedPost} disabled={!editPostText.trim()} className="h-14 bg-white text-black font-black text-[15px] uppercase tracking-widest rounded-full mt-2 shadow-[0_5px_20px_rgba(255,255,255,0.15)] active:scale-95 transition-all">שמור עריכה</Button>                     
                </motion.div>                                          
              </div>                                                 
            )}                                                                                                              
          </AnimatePresence>                                     
        </>,                                                     
        portalNode                                             
      )}                                                     
    </div>                                                 
  );                                                     
};
