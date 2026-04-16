export type UserProfile = {
  id: string;
  username: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  location: string | null;
  zodiac: string | null;
  birth_date: string | null;
  social_link: string | null;
  relationship_status: string | null;

  level: number;
  xp: number;
  crd_balance: number;
  streak_days: number;
  last_seen_at: string;

  role_label: 'MEMBER' | 'CORE' | 'CREATOR' | 'ADMIN';
  is_admin: boolean;
  is_verified: boolean;
  is_ghost: boolean;
  dm_filter: boolean;

  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  slug: string;
  name_he: string;
  icon: string | null;
  color: string;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
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

  category_id: string | null;
  subcategory_id: string | null;
  tags: string[];

  is_private: boolean;
  join_price: number;
  core_price: number;
  min_level: number;

  members_count: number;
  posts_count: number;
  ranking_score: number;

  moderation_status: 'active' | 'pending' | 'flagged' | 'suspended';
  is_featured: boolean;

  created_at: string;
  updated_at: string;

  creator?: Pick<UserProfile, 'username' | 'full_name' | 'avatar_url'>;
  category?: Pick<Category, 'name_he' | 'icon' | 'color'>;
};

export type CircleMember = {
  id: string;
  circle_id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'member';
  tier: 'INNER' | 'CORE';
  xp_earned: number;
  is_og: boolean;
  joined_at: string;
  profiles?: UserProfile;
};

export type Post = {
  id: string;
  circle_id: string;
  user_id: string;
  content: string | null;
  media_urls: string[];
  media_types: string[];
  tier_required: 'INNER' | 'CORE';
  parent_id: string | null;

  seals_count: number;
  comments_count: number;
  views_count: number;

  is_pinned: boolean;
  is_highlighted: boolean;

  created_at: string;
  updated_at: string;

  profiles?: Pick<UserProfile, 'id' | 'username' | 'full_name' | 'avatar_url' | 'role_label' | 'level'>;
  has_sealed?: boolean;
  my_seal_type?: SealType | null;
  is_bookmarked?: boolean;
};

export type SealType = 'fire' | 'diamond' | 'alliance' | 'crown' | 'heart';

export type PostSeal = {
  id: string;
  post_id: string;
  user_id: string;
  seal_type: SealType;
  created_at: string;
};

export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  profiles?: Pick<UserProfile, 'id' | 'username' | 'full_name' | 'avatar_url' | 'role_label' | 'level'>;
};

export type Story = {
  id: string;
  user_id: string;
  circle_id: string | null;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string | null;
  bg_color: string;
  views_count: number;
  expires_at: string;
  created_at: string;
  profiles?: Pick<UserProfile, 'username' | 'avatar_url'>;
};

export type CircleEvent = {
  id: string;
  circle_id: string;
  creator_id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  location: string | null;
  is_online: boolean;
  meeting_url: string | null;
  starts_at: string;
  ends_at: string | null;
  max_attendees: number | null;
  rsvp_count: number;
  tier_required: 'INNER' | 'CORE';
  created_at: string;
};

export type Poll = {
  id: string;
  circle_id: string;
  creator_id: string;
  question: string;
  options: PollOption[];
  total_votes: number;
  ends_at: string | null;
  created_at: string;
  has_voted?: boolean;
  profiles?: Pick<UserProfile, 'username' | 'avatar_url'>;
};

export type PollOption = {
  id: number;
  text: string;
  votes_count: number;
};

export type Notification = {
  id: string;
  user_id: string;
  from_user_id: string | null;
  type: 'seal' | 'comment' | 'join' | 'gift' | 'dm' | 'system' | 'event' | 'poll';
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
  profiles?: Pick<UserProfile, 'username' | 'avatar_url'>;
};

export type WalletTransaction = {
  id: string;
  user_id: string;
  amount: number;
  type: 'topup' | 'gift_sent' | 'gift_received' | 'join_fee' | 'core_upgrade' | 'boost' | 'dm_fee' | 'join_revenue';
  description: string | null;
  ref_id: string | null;
  created_at: string;
};

export type Conversation = {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message_at: string;
  created_at: string;
  other_user?: Pick<UserProfile, 'id' | 'username' | 'full_name' | 'avatar_url' | 'level' | 'role_label'>;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
};

export type Badge = {
  id: string;
  slug: string;
  name_he: string;
  description_he: string | null;
  icon: string;
  color: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  xp_reward: number;
};

export type UserBadge = {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  badges?: Badge;
};

export type Boost = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_crd: number;
  boost_type: string;
  duration_hours: number;
  is_active: boolean;
};

export type Bookmark = {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
  posts?: Post & { circles?: Pick<Circle, 'name' | 'slug'> };
};

export type CircleInvite = {
  id: string;
  circle_id: string;
  created_by: string | null;
  code: string;
  uses_count: number;
  max_uses: number | null;
  expires_at: string | null;
  created_at: string;
  circles?: Pick<Circle, 'name' | 'slug' | 'avatar_url' | 'description' | 'members_count'>;
};

export type LeaderboardEntry = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  level: number;
  xp: number;
  crd_balance: number;
  streak_days: number;
  role_label: string;
};

// Vault Types
export type Vault = {
  id: string;
  circle_id: string;
  creator_id: string;
  title: string;
  teaser: string | null;
  teaser_blur_url: string | null;
  content_type: string;
  content_text: string | null;
  content_media_urls: string[];
  content_link: string | null;
  unlock_type: 'tier' | 'time' | 'members' | 'gift' | 'combined';
  unlock_tier: string;
  unlock_at: string | null;
  unlock_members: number | null;
  unlock_gift_crd: number | null;
  views_count: number;
  unlocks_count: number;
  is_active: boolean;
  created_at: string;
  is_unlocked?: boolean;
};

export type Signal = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  circle_id: string;
  status: 'pending' | 'matched' | 'expired' | 'declined';
  crd_cost: number;
  message: string | null;
  revealed_at: string | null;
  expires_at: string;
  created_at: string;
};

export type ApiResponse<T = {}> = { ok: true } & T;

export const SEAL_DEFS = [
  { id: 'fire' as SealType,     icon: '🔥', label: 'אש',    color: 'text-orange-400', xp: 15 },
  { id: 'diamond' as SealType,  icon: '💎', label: 'יהלום', color: 'text-blue-400',   xp: 50 },
  { id: 'alliance' as SealType, icon: '🤝', label: 'ברית',  color: 'text-emerald-400', xp: 100 },
  { id: 'crown' as SealType,    icon: '👑', label: 'כתר',   color: 'text-yellow-400', xp: 75 },
  { id: 'heart' as SealType,    icon: '❤️', label: 'לב',    color: 'text-pink-400',   xp: 20 },
] as const;

export const TIER_LABELS: Record<string, string> = {
  INNER: 'INNER',
  CORE: 'CORE',
};

export const LEVEL_TITLES: Record<number, string> = {
  1: 'NEWCOMER',
  2: 'MEMBER',
  3: 'REGULAR',
  5: 'TRUSTED',
  8: 'VETERAN',
  10: 'ELITE',
  15: 'LEGEND',
  20: 'INNER GOD',
};

export const getLevelTitle = (level: number): string => {
  const keys = Object.keys(LEVEL_TITLES).map(Number).sort((a, b) => b - a);
  for (const k of keys) {
    if (level >= k) return LEVEL_TITLES[k];
  }
  return 'NEWCOMER';
};
