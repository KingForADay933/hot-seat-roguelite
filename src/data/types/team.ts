import type { AttributeKey } from './player'
import type { PlayerId, TeamId } from './common'

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
  /** Target minutes (0-48) per rostered player, auto-generated at team-creation time by
   *  depth-chart rank within each position group. Drives in-game substitution timing —
   *  not GM-editable yet. */
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
  /** Attribute-scale (40-99ish), neutral at engine/constants.ts's SYNERGY_NEUTRAL (65) -- feeds a
   *  small offense-strength multiplier via engine/possession/possessionStrength.ts's
   *  synergyMultiplier. Every AI-generated team stays neutral; only a roguelite run's
   *  user-controlled team deviates, set once at system-draft time from roster fit
   *  (run/variation/systemDraft.ts's computeInitialSynergyScore) and expected to grow from there
   *  via later camps/coaching-upgrades/consumables systems. Morale itself is still unbuilt. */
  synergyScore: number

  /** Derived by engine/schedule/standings.ts; cached here for convenience. */
  record: TeamRecord
}
