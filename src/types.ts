export type UserProfile = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role_label: string;
  xp: number;
  level: number;
  streak_days: number;
  credits: number;
  is_admin: boolean;
  created_at: string;
};

export type Circle = {
  id: string;
  creator_id: string;
  name: string;
  slug: string;
  description: string | null;
  teaser_text: string | null;
  cover_url: string | null;
  avatar_url: string | null;
  join_price: number;
  vip_price: number;
  members_count: number;
  is_private: boolean;
  is_flagged: boolean;
  moderation_status: 'active' | 'pending' | 'flagged' | 'suspended';
  ranking_score?: number;
  created_at: string;
  creator?: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
};

export type Membership = {
  id: string;
  user_id: string;
  circle_id: string;
  tier: 'free' | 'inner' | 'core';
  points: number;
  badge: string;
  is_og: boolean;
  joined_at: string;
};

export type Drop = {
  id: string;
  circle_id: string;
  creator_id: string;
  title: string;
  teaser: string | null;
  body: string | null;
  media_url: string | null;
  unlock_tier: 'free' | 'inner' | 'core';
  expires_at: string | null;
  is_flagged: boolean;
  moderation_status: 'active' | 'pending' | 'flagged' | 'suspended';
  created_at: string;
};

export type CircleMessage = {
  id: string;
  circle_id: string;
  user_id: string;
  content: string;
  is_pinned: boolean;
  is_highlighted: boolean;
  created_at: string;
  profile?: {
    username: string;
    avatar_url: string | null;
    role_label: string;
  };
};

export type NotificationItem = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: 'system' | 'drop' | 'message' | 'membership' | 'gift' | 'wallet';
  is_read: boolean;
  created_at: string;
};

export type WalletLedgerItem = {
  id: string;
  user_id: string;
  type: 'topup' | 'gift_sent' | 'gift_received' | 'boost_purchase' | 'system';
  amount: number;
  currency: 'CRD' | 'ILS';
  description: string | null;
  created_at: string;
};

export type BoostItem = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  price_credits: number;
  active: boolean;
  created_at: string;
};

export type CreatorCircleSummary = {
  circle: Circle;
  latestDrop?: Drop | null;
};

export type StudioCirclePayload = {
  circle: Circle;
  drops: Drop[];
  recentMessages: Array<{
    id: string;
    content: string;
    is_highlighted: boolean;
    created_at: string;
    profile?: {
      username: string;
      avatar_url: string | null;
      role_label: string;
    };
  }>;
  members: Array<{
    id: string;
    user_id: string;
    circle_id: string;
    tier: 'free' | 'inner' | 'core';
    points: number;
    badge: string;
    is_og: boolean;
    joined_at: string;
    profile?: {
      username: string;
      avatar_url: string | null;
      role_label: string;
    };
  }>;
  analytics: {
    last7Days: Array<{
      stat_date: string;
      new_members: number;
      drops_count: number;
      messages_count: number;
      gifts_count: number;
      gifts_credits: number;
    }>;
    totals: {
      members: number;
      drops: number;
      messages: number;
      giftsCredits: number;
      highlightedMessages: number;
    };
  };
};

export type CreatorPayoutAccount = {
  id: string;
  creator_id: string;
  provider: string;
  provider_account_id: string | null;
  status: 'not_connected' | 'pending' | 'connected' | 'restricted';
  created_at: string;
};

export type CreatorFinanceSummary = {
  payoutAccount: CreatorPayoutAccount | null;
  totals: {
    giftsCredits: number;
    giftsCount: number;
    topupsEquivalentILS: number;
    estimatedPayoutILS: number;
  };
  recentGifts: Array<{
    id: string;
    amount: number;
    note: string | null;
    created_at: string;
    sender?: {
      username: string;
      avatar_url: string | null;
    };
  }>;
};

export type ModerationQueueItem = {
  id: string;
  entity_type: 'circle' | 'drop';
  entity_id: string;
  reason: string;
  status: 'open' | 'reviewed' | 'dismissed' | 'actioned';
  created_at: string;
};
