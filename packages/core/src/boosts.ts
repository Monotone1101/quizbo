/**
 * Power-ups ("boosts"). Every player is dealt a random hand at the start of a battle and may fire
 * one boost per round, before answering. The battle service owns the hands; these are the pure rules.
 *
 *   instant — takes effect the moment it's used (Med Kit, Fifty-Fifty, Time Warp, Overclock, Ink Splat)
 *   armed   — waits until its trigger, then is spent (Bubble Shield, Double Tap, Mirror Coat,
 *             Streak Anchor, Vampire Bite)
 */
import { applyAnswer, BATTLE_RULES, type AnswerEffect, type AnswerOutcome, type BattleRules, type CombatState } from "./battle";
import type { Rng } from "./orders";

export const BOOST_IDS = [
  "shield",
  "double",
  "fifty",
  "warp",
  "medkit",
  "mirror",
  "anchor",
  "vampire",
  "ink",
  "overclock",
] as const;

export type BoostId = (typeof BOOST_IDS)[number];

export interface BoostDef {
  id: BoostId;
  name: string;
  blurb: string;
  kind: "instant" | "armed";
}

export const BOOSTS: Record<BoostId, BoostDef> = {
  shield: { id: "shield", name: "Bubble Shield", blurb: "Blocks the next damage you would take.", kind: "armed" },
  double: { id: "double", name: "Double Tap", blurb: "Your next correct answer hits twice as hard.", kind: "armed" },
  fifty: { id: "fifty", name: "Fifty-Fifty", blurb: "Knocks out two wrong options on this question.", kind: "instant" },
  warp: { id: "warp", name: "Time Warp", blurb: "Adds 5 seconds to your clock on this question.", kind: "instant" },
  medkit: { id: "medkit", name: "Med Kit", blurb: "Restores 15 HP right now.", kind: "instant" },
  mirror: { id: "mirror", name: "Mirror Coat", blurb: "Half of the next hit you take bounces back.", kind: "armed" },
  anchor: { id: "anchor", name: "Streak Anchor", blurb: "Your next miss won't break your streak.", kind: "armed" },
  vampire: { id: "vampire", name: "Vampire Bite", blurb: "Your next correct answer heals you for half its damage.", kind: "armed" },
  ink: { id: "ink", name: "Ink Splat", blurb: "Splatters ink over your rival's screen for 3 seconds.", kind: "instant" },
  overclock: { id: "overclock", name: "Overclock", blurb: "The speed bonus stays on for this whole question.", kind: "instant" },
};

export const BOOST_TUNING = {
  handSize: 3,
  medkitHp: 15,
  warpMs: 5_000,
  inkMs: 3_000,
} as const;

export const isBoostId = (value: unknown): value is BoostId =>
  typeof value === "string" && (BOOST_IDS as readonly string[]).includes(value);

/** A hand of distinct boosts. */
export function dealBoosts(rng: Rng, size: number = BOOST_TUNING.handSize): BoostId[] {
  const pool = [...BOOST_IDS];
  const hand: BoostId[] = [];
  while (hand.length < size && pool.length > 0) {
    const [pick] = pool.splice(Math.floor(rng() * pool.length), 1);
    if (pick) hand.push(pick);
  }
  return hand;
}

export type BoostSlotState = "ready" | "armed" | "spent";

export interface BoostSlot {
  id: BoostId;
  state: BoostSlotState;
}

export const newHand = (ids: BoostId[]): BoostSlot[] => ids.map((id) => ({ id, state: "ready" }));

export const isArmed = (hand: BoostSlot[], id: BoostId) => hand.some((slot) => slot.id === id && slot.state === "armed");

/** Marks the armed boosts that an answer used up as spent. */
export function spend(hand: BoostSlot[], used: BoostId[]): BoostSlot[] {
  return hand.map((slot) => (slot.state === "armed" && used.includes(slot.id) ? { ...slot, state: "spent" } : slot));
}

/** Two wrong options (by bank index) to hide, picked at random. */
export function fiftyFifty(correctIndex: number, optionCount: number, rng: Rng): number[] {
  const wrong = Array.from({ length: optionCount }, (_, i) => i).filter((i) => i !== correctIndex);
  const hidden: number[] = [];
  while (hidden.length < 2 && wrong.length > 0) {
    const [pick] = wrong.splice(Math.floor(rng() * wrong.length), 1);
    if (pick !== undefined) hidden.push(pick);
  }
  return hidden.sort((a, b) => a - b);
}

export interface BoostedEffect extends AnswerEffect {
  /** The defender's Bubble Shield soaked the hit (or your own shield soaked self-damage). */
  blocked: boolean;
  /** Damage the defender's Mirror Coat sent back (already included in damageToSelf). */
  reflected: number;
  /** HP the answerer got back from Vampire Bite. */
  healed: number;
  doubled: boolean;
  /** The Streak Anchor held the streak. */
  anchored: boolean;
  /** Armed boosts that were spent, per side. */
  spentBySelf: BoostId[];
  spentByOpponent: BoostId[];
}

/**
 * `applyAnswer` plus the boosts in play: the answerer's armed boosts and this round's Overclock,
 * and the defender's Shield and Mirror.
 */
export function applyBoostedAnswer(
  self: CombatState,
  opponent: CombatState,
  outcome: AnswerOutcome,
  hands: { self: BoostSlot[]; opponent: BoostSlot[]; overclock?: boolean },
  rules: BattleRules = BATTLE_RULES,
): BoostedEffect {
  const base = applyAnswer(self, opponent, outcome, rules);
  const spentBySelf: BoostId[] = [];
  const spentByOpponent: BoostId[] = [];

  if (outcome.kind === "correct") {
    let damage = base.damageToOpponent;
    let speedBonus = base.speedBonus;
    if (hands.overclock && !speedBonus) {
      damage += rules.speedBonusDamage;
      speedBonus = true;
    }
    const doubled = isArmed(hands.self, "double");
    if (doubled) {
      damage *= 2;
      spentBySelf.push("double");
    }

    let blocked = false;
    let reflected = 0;
    if (isArmed(hands.opponent, "shield")) {
      blocked = true;
      spentByOpponent.push("shield");
    } else if (isArmed(hands.opponent, "mirror")) {
      reflected = Math.floor(damage / 2);
      spentByOpponent.push("mirror");
    }
    const dealt = blocked ? 0 : damage - reflected;

    let healed = 0;
    if (isArmed(hands.self, "vampire")) {
      spentBySelf.push("vampire");
      healed = Math.min(rules.startHp - self.hp, Math.ceil(dealt / 2));
    }

    return {
      ...base,
      self: { ...base.self, hp: Math.max(0, Math.min(rules.startHp, self.hp + healed - reflected)) },
      opponent: { ...opponent, hp: Math.max(0, opponent.hp - dealt) },
      damageToOpponent: dealt,
      damageToSelf: reflected,
      speedBonus,
      blocked,
      reflected,
      healed,
      doubled,
      anchored: false,
      spentBySelf,
      spentByOpponent,
    };
  }

  let state = base.self;
  let damageToSelf = base.damageToSelf;
  let blocked = false;
  if (isArmed(hands.self, "shield")) {
    blocked = true;
    damageToSelf = 0;
    state = { ...state, hp: self.hp };
    spentBySelf.push("shield");
  }
  let anchored = false;
  if (isArmed(hands.self, "anchor")) {
    anchored = self.streak > 0;
    state = { ...state, streak: self.streak };
    spentBySelf.push("anchor");
  }
  return {
    ...base,
    self: state,
    damageToSelf,
    blocked,
    reflected: 0,
    healed: 0,
    doubled: false,
    anchored,
    spentBySelf,
    spentByOpponent,
  };
}

/** HP after a Med Kit. */
export const medkit = (state: CombatState, rules: BattleRules = BATTLE_RULES): CombatState => ({
  ...state,
  hp: Math.min(rules.startHp, state.hp + BOOST_TUNING.medkitHp),
});
