import type { AttributeKey } from './player'
import type { PlayerId, Position, TeamId } from './common'

/**
 * One span of game time, within one period, for one on-court slot: who fills it, or 'auto' to
 * defer to the fatigue/pace heuristic (engine/rotation/substitution.ts) for that span. Boundaries
 * are seconds *into the period*, not the whole game -- a chart is authored per period, so every
 * period's segments start counting from 0 again, matching the period clock itself (PERIOD_SECONDS).
 */
export interface RotationSegment {
  startSeconds: number
  endSeconds: number
  fill: { kind: 'player'; playerId: PlayerId } | { kind: 'auto' }
}

/**
 * A GM's rotation chart: per period, per on-court slot, an ordered list of RotationSegments
 * (rotation-charts.md Phase F). Keyed sparsely by period number (1-4 regulation, 5+ overtime) and
 * then by slot -- a period or slot absent from the plan is exactly the same as an explicit `auto`
 * segment covering the whole period (Decision 3: "unfilled time is implicitly Auto"), which is what
 * lets a GM chart just Q1 and Q4 and leave the rest to the coach.
 */
export type RotationPlan = Partial<Record<number, Partial<Record<Position, RotationSegment[]>>>>

export interface Coaching {
  /** Single scalar. Multiplies DP earned during season-end development (Section 3) --
   *  see engine/development/dpFormula.ts's applyCoachingMultiplier. Splitting this into a
   *  multi-rating Coaching Staff entity (Strategy Execution, Motivation) is deferred until the
   *  systems those ratings would feed (Section 4, Strategy Synergy & Morale) exist. */
  headCoachRating: number
}

export interface PracticeSettings {
  /** 0-100 share of practice time spent on Individual Skill Development, feeding the DP practice
   *  bonus (engine/development/dpFormula.ts). The remaining share is implicitly spent on
   *  team-level categories (Team Offense Reps / Strategy Execution Drilling / Conditioning) that
   *  do nothing yet -- those depend on the unbuilt Section 4 synergy/morale system. */
  individualDevelopmentShare: number
}

export interface TeamRecord {
  wins: number
  losses: number
}

/**
 * Four standing dials for *how* a team plays, as against the offensive system and defensive scheme
 * that say *who it is* (m3-tactical-axis.md, D2).
 *
 * Every dial is an offset on a quantity the engine already computes -- see engine/tacticalFocus.ts,
 * which is the only place the offsets live. Nothing here adds resolution logic, and every dial's
 * middle value is a true no-op, which is what lets an absent focus be identical to a balanced one.
 *
 * Each has a real cost, deliberately: a dial with only an upside stops being a decision and becomes
 * a setting everyone picks once.
 *
 *  - `pace` -- possession length. Push for more possessions on both ends, at slightly worse looks.
 *  - `shotSelection` -- scales the playbook's play-call weights. The only dial that moves synergy,
 *    because it is the only one that changes the *mix* the roster is scored against, which is what
 *    makes the right answer roster-dependent rather than universal.
 *  - `defensiveTilt` -- nudges the scheme's interiorFocus. Gaining inside loses outside by
 *    construction (engine/possession/resistance.ts's applyInteriorFocus).
 *  - `glass` -- offensive rebounding. Crash for second chances and concede fast breaks off the
 *    boards you lose; get back to smother transition and give the second chances up.
 */
export interface TacticalFocus {
  pace: 'control' | 'balanced' | 'push'
  shotSelection: 'rim' | 'balanced' | 'threes'
  defensiveTilt: 'paint' | 'balanced' | 'perimeter'
  glass: 'crash' | 'balanced' | 'getBack'
}

/** Every dial at its no-op setting -- what an absent Team.tacticalFocus means. */
export const BALANCED_FOCUS: TacticalFocus = {
  pace: 'balanced',
  shotSelection: 'balanced',
  defensiveTilt: 'balanced',
  glass: 'balanced',
}

export interface Team {
  id: TeamId
  name: string
  city: string
  abbreviation: string
  primaryColor: string
  secondaryColor: string

  rosterPlayerIds: PlayerId[]
  maxRosterSize: number
  /** Exactly 5 ids — who's on the floor at the opening tip. In-game substitutions move players
   *  in and out from there; see engine/rotation. */
  startingFive: PlayerId[]
  /** Target minutes per rostered player, auto-generated at team-creation time by depth-chart rank
   *  within each position group. Drives in-game substitution timing, and is the Auto fallback a
   *  rotationPlan defers to (see below).
   *
   *  Allocated per position, not per player: each position group has exactly REGULATION_MINUTES to
   *  share out, since one slot is occupied for the whole game. The generator already normalizes to
   *  that (engine/generator/randomTeam.ts), and run/minutesBudget.ts is what holds GM edits to it —
   *  raising one player means lowering a teammate at his position. */
  rotationMinutes: Record<PlayerId, number>

  /** Key into presets.ts OFFENSIVE_PLAYBOOKS. */
  offensiveStrategyId: string
  /** Key into presets.ts DEFENSIVE_SCHEMES. */
  defensiveStrategyId: string

  coaching: Coaching
  practiceSettings: PracticeSettings
  /** Sparse GM overrides: playerId -> per-attribute Training Focus weight (any positive number;
   *  normalized at growth-resolution time, doesn't need to sum to anything). A player absent
   *  here, or present with an empty/all-zero object, falls back to an auto-computed weighting
   *  proportional to that attribute's gap-to-potential. See engine/development/trainingFocus.ts. */
  trainingFocus: Record<PlayerId, Partial<Record<AttributeKey, number>>>
  /** Absent means fully Auto -- every AI team, and a user team until a chart is authored in the My
   *  Team editor (ui/components/RotationChartEditor.tsx). engine/rotation/substitution.ts's
   *  checkSubstitutions consults this before falling through to the fatigue/pace heuristic. */
  rotationPlan?: RotationPlan

  /** How this team wants to play, as against who it is. Absent means every dial balanced, which is
   *  byte-identical to the game as it behaved before focus points existed -- so an old save loads
   *  and plays unchanged, and isValidBundleShape needs no new check.
   *
   *  Set from My Team, a checkpoint, or mid-broadcast, all writing this one field (m3-tactical-axis.md
   *  D2), exactly as defensiveStrategyId already does. AI teams get one derived from their offensive
   *  system at generation time (engine/generator/randomLeague.ts), so a scouted opponent's dials agree
   *  with its identity rather than contradicting it. */
  tacticalFocus?: TacticalFocus

  /** Attribute-scale (40-99ish), neutral at engine/constants.ts's SYNERGY_NEUTRAL (65) -- feeds a
   *  small offense-strength multiplier via engine/possession/possessionStrength.ts's
   *  synergyMultiplier. Every AI-generated team stays neutral; only a roguelite run's
   *  user-controlled team deviates, set at system-draft time from roster fit
   *  (run/variation/systemDraft.ts's computeInitialSynergyScore) and recomputed from there whenever
   *  its inputs move -- camps, coaching upgrades, rotation-minutes edits and rotation-chart edits all
   *  route through RunProvider's teamsWithRecomputedSynergy. Morale itself is still unbuilt. */
  synergyScore: number

  /** Derived by engine/schedule/standings.ts; cached here for convenience. */
  record: TeamRecord
}
