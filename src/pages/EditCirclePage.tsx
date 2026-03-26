import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { Circle } from '../types';
import { MediaUploader } from '../components/MediaUploader';
import { GlassCard, Input, Button, PageTitle, FadeIn } from '../components/ui';

export const EditCirclePage: React.FC = () => {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [circle, setCircle] = useState<Circle | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [teaserText, setTeaserText] = useState('');
  const [joinPrice, setJoinPrice] = useState(19);
  const [vipPrice, setVipPrice] = useState(49);
  const [coverUrl, setCoverUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ circle: Circle }>(`/api/creator/circles/${slug}/edit`)
      .then((res) => {
        setCircle(res.circle);
        setName(res.circle.name);
        setDescription(res.circle.description || '');
        setTeaserText(res.circle.teaser_text || '');
        setJoinPrice(res.circle.join_price);
        setVipPrice(res.circle.vip_price);
        setCoverUrl(res.circle.cover_url || '');
        setAvatarUrl(res.circle.avatar_url || '');
      })
      .catch((err) => {
        if (err.message !== 'Failed to fetch') toast.error(err.message || 'טעינה נכשלה');
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const save = async () => {
    try {
      setSaving(true);
      await apiFetch(`/api/creator/circles/${slug}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, description, teaser_text: teaserText, join_price: Number(joinPrice), vip_price: Number(vipPrice), cover_url: coverUrl || null, avatar_url: avatarUrl || null })
      });
      toast.success('הקהילה עודכנה בהצלחה');
      navigate(`/studio/${slug}`);
    } catch (err: any) {
      if (err.message !== 'Failed to fetch') toast.error(err.message || 'עדכון נכשל');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center text-muted">טוען...</div>;
  if (!circle) return <div className="min-h-[60vh] flex items-center justify-center text-muted">לא נמצא</div>;

  return (
    <FadeIn className="flex flex-col gap-6 pt-2">
      <PageTitle>עריכת קהילה</PageTitle>

      <GlassCard>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm text-muted mb-2">שם הקהילה</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-muted mb-2">תיאור הקהילה</label>
            <textarea className="w-full border border-white/5 bg-black/20 text-white rounded-2xl px-4 py-3.5 outline-none focus:border-[#8C6D53]/50 transition-colors min-h-[120px] shadow-inner" value={description} onChange={(e) => setDescription(e.target.value)} disabled={saving} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-muted mb-2">טיזר (למי שעדיין לא חבר)</label>
            <textarea className="w-full border border-white/5 bg-black/20 text-white rounded-2xl px-4 py-3.5 outline-none focus:border-[#8C6D53]/50 transition-colors min-h-[80px] shadow-inner" value={teaserText} onChange={(e) => setTeaserText(e.target.value)} disabled={saving} />
          </div>
          <div>
            <label className="block text-sm text-muted mb-2">מחיר חבר (₪)</label>
            <Input type="number" value={joinPrice} onChange={(e) => setJoinPrice(Number(e.target.value))} disabled={saving} />
          </div>
          <div>
            <label className="block text-sm text-muted mb-2">מחיר VIP (₪)</label>
            <Input type="number" value={vipPrice} onChange={(e) => setVipPrice(Number(e.target.value))} disabled={saving} />
          </div>
        </div>
      </GlassCard>

      <MediaUploader bucket="avatars" label="תמונת פרופיל לקהילה" value={avatarUrl} onChange={setAvatarUrl} />
      <MediaUploader bucket="covers" label="תמונת רקע" value={coverUrl} onChange={setCoverUrl} />

      <Button onClick={save} disabled={saving} className="w-full py-4 mt-2 text-lg">
        {saving ? 'שומר...' : 'שמירת שינויים'}
      </Button>
    </FadeIn>
  );
};
