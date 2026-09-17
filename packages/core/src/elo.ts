/**
 * Competitive rating, tracked per (user, subject). Deliberately separate from topic mastery
 * (mastery.ts): ELO drives matchmaking; mastery drives the breakdown and the scheduler.
 */
export const DEFAULT_RATING = 1200;
export const PLACEMENT_MATCHES = 5;
export const PLACEMENT_K = 40;
export const SETTLED_K = 20;
/** A forfeit win still counts, but earns half of what a played-out win would (architecture.md §4). */
export const FORFEIT_WIN_DISCOUNT = 0.5;

export type Outcome = "win" | "loss" | "draw";

export interface RatingState {
  rating: number;
  matchesPlayed: number;
}

export interface EloParticipant extends RatingState {
  userId: string;
}

export interface EloChange {
  userId: string;
  before: number;
  after: number;
  delta: number;
}

export function kFactor(matchesPlayed: number): number {
  return matchesPlayed < PLACEMENT_MATCHES ? PLACEMENT_K : SETTLED_K;
}

export function expectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
}

/**
 * newRating = rating + K × (actual − expected), rounded to a whole point.
 * `forfeitWin` halves the winner's gain only. The player who dropped takes the full loss so
 * abandoning a losing match is never cheaper than playing it out (see ASSUMPTIONS.md).
 */
export function eloDelta(
  player: RatingState,
  opponentRating: number,
  outcome: Outcome,
  options: { forfeitWin?: boolean } = {},
): number {
  const actual = outcome === "win" ? 1 : outcome === "loss" ? 0 : 0.5;
  const raw = kFactor(player.matchesPlayed) * (actual - expectedScore(player.rating, opponentRating));
  const scaled = options.forfeitWin && outcome === "win" ? raw * FORFEIT_WIN_DISCOUNT : raw;
  return Math.round(scaled) || 0;
}

export function applyBattleElo(
  a: EloParticipant,
  b: EloParticipant,
  result: { winnerId: string | null; forfeit: boolean },
): [EloChange, EloChange] {
  const change = (player: EloParticipant, opponent: EloParticipant): EloChange => {
    const outcome: Outcome =
      result.winnerId === null ? "draw" : result.winnerId === player.userId ? "win" : "loss";
    const delta = eloDelta(player, opponent.rating, outcome, { forfeitWin: result.forfeit });
    return { userId: player.userId, before: player.rating, after: player.rating + delta, delta };
  };
  return [change(a, b), change(b, a)];
}

/** Starting rating band from the onboarding self-rated confidence (1–5). */
export function placementRating(confidence: number | null | undefined): number {
  const bands = [1050, 1125, 1200, 1275, 1350];
  if (!confidence) return DEFAULT_RATING;
  const index = Math.min(5, Math.max(1, Math.round(confidence))) - 1;
  return bands[index] ?? DEFAULT_RATING;
}
