import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Circle } from '../types';
import { GlassCard, Button } from './ui';
import { Users } from 'lucide-react';

export const FeedCard: React.FC<{ circle: Circle }> = ({ circle }) => {
  const navigate = useNavigate();
  const safeSlug = circle?.slug?.trim();

  return (
    <GlassCard className="flex flex-col gap-4 p-5 bg-white/5 border-white/10 backdrop-blur-2xl">
      <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/circle/${safeSlug}`)}>
        <div className="w-14 h-14 rounded-full bg-white/10 overflow-hidden border border-white/20 shadow-lg">
          {circle?.avatar_url ? (
            <img src={circle.avatar_url} className="w-full h-full object-cover" alt="" />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-bold text-xl text-white">
              {circle?.name?.[0] || '?'}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg text-white truncate">{circle?.name}</h3>
          <p className="text-white/50 text-sm truncate">@{safeSlug}</p>
        </div>
      </div>
      
      <p className="text-sm text-white/80 line-clamp-2">
        {circle?.description || 'קהילה פעילה עם תוכן בלעדי.'}
      </p>

      <div className="flex items-center justify-between mt-2 pt-3 border-t border-white/5">
        <span className="flex items-center gap-1.5 text-xs text-white/60">
          <Users size={14} /> {circle?.members_count || 0} חברים
        </span>
        <Button size="sm" onClick={() => navigate(`/circle/${safeSlug}`)}>
          כניסה לקהילה
        </Button>
      </div>
    </GlassCard>
  );
};
