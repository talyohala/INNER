export function calcRankingScore(params: {
  membersCount: number;
  joinPrice: number;
  latestDropAt?: string | null;
  giftsCredits7d?: number;
  messages7d?: number;
}) {
  const freshnessBoost = params.latestDropAt
    ? Math.max(0, 100 - Math.floor((Date.now() - new Date(params.latestDropAt).getTime()) / (1000 * 60 * 60 * 12)))
    : 0;

  return (
    params.membersCount * 2 +
    params.joinPrice * 1.5 +
    (params.giftsCredits7d || 0) * 0.08 +
    (params.messages7d || 0) * 0.5 +
    freshnessBoost
  );
}
