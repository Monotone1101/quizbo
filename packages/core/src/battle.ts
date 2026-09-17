/**
 * Battle scoring rules (features.md §1.3). Pure state transitions — the battle service owns the
 * timers and sockets and calls these to decide HP, streaks and the winner.
 */
export interface BattleRules {
  startHp: number;
  maxQuestions: number;
  /** A battle never starts with fewer validated questions than this. */
  minQuestions: number;
  timeLimitMs: number;
  speedBonusWindowMs: number;
  baseDamage: number;
  speedBonusDamage: number;
  streakBonusDamage: number;
  /** Streak length (after the current answer) from which the streak bonus applies. */
  streakBonusFrom: number;
  wrongSelfDamage: number;
  timeoutSelfDamage: number;
  reconnectGraceMs: number;
  countdownMs: number;
  /** Pause between rounds so answer effects resolve before the next question renders. */
  revealMs: number;
}

export const BATTLE_RULES: BattleRules = {
  startHp: 100,
  maxQuestions: 15,
  minQuestions: 5,
  timeLimitMs: 12_000,
  speedBonusWindowMs: 4_000,
  baseDamage: 10,
  speedBonusDamage: 5,
  streakBonusDamage: 3,
  streakBonusFrom: 3,
  wrongSelfDamage: 8,
  timeoutSelfDamage: 5,
  reconnectGraceMs: 20_000,
  countdownMs: 3_000,
  revealMs: 1_400,
};

export interface CombatState {
  hp: number;
  streak: number;
  bestStreak: number;
  correct: number;
  /** Answers actually submitted (timeouts excluded). */
  answered: number;
  totalAnswerMs: number;
}

export type AnswerOutcome =
  | { kind: "correct"; timeTakenMs: number }
  | { kind: "wrong"; timeTakenMs: number }
  | { kind: "timeout" };

export interface AnswerEffect {
  self: CombatState;
  opponent: CombatState;
  damageToOpponent: number;
  damageToSelf: number;
  speedBonus: boolean;
  streakBonus: boolean;
}

export function initialCombatState(rules: BattleRules = BATTLE_RULES): CombatState {
  return { hp: rules.startHp, streak: 0, bestStreak: 0, correct: 0, answered: 0, totalAnswerMs: 0 };
}

/** Correct answers damage the opponent; wrong answers and timeouts damage yourself and reset the streak. */
export function applyAnswer(
  self: CombatState,
  opponent: CombatState,
  outcome: AnswerOutcome,
  rules: BattleRules = BATTLE_RULES,
): AnswerEffect {
  if (outcome.kind === "correct") {
    const streak = self.streak + 1;
    const speedBonus = outcome.timeTakenMs < rules.speedBonusWindowMs;
    const streakBonus = streak >= rules.streakBonusFrom;
    const damage =
      rules.baseDamage + (speedBonus ? rules.speedBonusDamage : 0) + (streakBonus ? rules.streakBonusDamage : 0);
    return {
      self: {
        ...self,
        streak,
        bestStreak: Math.max(self.bestStreak, streak),
        correct: self.correct + 1,
        answered: self.answered + 1,
        totalAnswerMs: self.totalAnswerMs + outcome.timeTakenMs,
      },
      opponent: { ...opponent, hp: Math.max(0, opponent.hp - damage) },
      damageToOpponent: damage,
      damageToSelf: 0,
      speedBonus,
      streakBonus,
    };
  }

  const submitted = outcome.kind === "wrong";
  const damage = submitted ? rules.wrongSelfDamage : rules.timeoutSelfDamage;
  return {
    self: {
      ...self,
      hp: Math.max(0, self.hp - damage),
      streak: 0,
      answered: self.answered + (submitted ? 1 : 0),
      totalAnswerMs: self.totalAnswerMs + (submitted ? outcome.timeTakenMs : 0),
    },
    opponent,
    damageToOpponent: 0,
    damageToSelf: damage,
    speedBonus: false,
    streakBonus: false,
  };
}

export function isKnockedOut(state: CombatState): boolean {
  return state.hp <= 0;
}

export function roundsForPool(poolSize: number, rules: BattleRules = BATTLE_RULES): number {
  return Math.min(rules.maxQuestions, poolSize);
}

/** Server-measured answer time, clamped to the question window. */
export function clampAnswerTime(elapsedMs: number, rules: BattleRules = BATTLE_RULES): number {
  return Math.max(0, Math.min(rules.timeLimitMs, Math.round(elapsedMs)));
}

export interface Contender {
  userId: string;
  state: CombatState;
}

export interface BattleVerdict {
  winnerId: string | null;
  loserId: string | null;
}

/** Higher HP wins; ties go to more correct answers, then less total answer time; otherwise a draw. */
export function decideWinner(a: Contender, b: Contender): BattleVerdict {
  const byHp = a.state.hp - b.state.hp;
  const byCorrect = a.state.correct - b.state.correct;
  const byTime = b.state.totalAnswerMs - a.state.totalAnswerMs;
  const score = byHp !== 0 ? byHp : byCorrect !== 0 ? byCorrect : byTime;
  if (score > 0) return { winnerId: a.userId, loserId: b.userId };
  if (score < 0) return { winnerId: b.userId, loserId: a.userId };
  return { winnerId: null, loserId: null };
}
