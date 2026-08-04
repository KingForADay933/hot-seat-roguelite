import type { PlayerId, Position, TeamId } from './common'

/** All attributes are on a 0-100 scale. Simulation always reads these directly — never `overallRating`. */
export interface PlayerAttributes {
  insideShot: number
  outsideShot: number
  passing: number
  ballHandling: number
  rebounding: number
  perimeterDefense: number
  interiorDefense: number
  speed: number
  lateralQuickness: number
  vertical: number
}

export type AttributeKey = keyof PlayerAttributes

/** MVP simplification of the design doc's "Tendencies" field (shoot-first vs. pass-first). */
export type TendencyProfile = 'pass-first' | 'balanced' | 'shoot-first'

export type AgeCurveStage = 'rising' | 'peak' | 'declining'

export interface PlayerHiddenTraits {
  /** Higher = less night-to-night variance. Active in outcome resolution. */
  consistency: number
  /** Late-game performance modifier. Active in outcome resolution during clutch time. */
  clutch: number
  /** Injury risk (contract-only, no injury simulation yet) AND in-game fatigue resistance
   *  (active — see engine/rotation/fatigue.ts). Higher durability means slower fatigue gain
   *  and faster recovery on the bench. */
  durability: number
  /** Active — feeds Isolation's shot-selection modifier (see engine/constants.ts). */
  tendency: TendencyProfile
  /** Contract-only for MVP — synergy/morale system not built yet. */
  morale: number
}

export interface PlayerDevelopment {
  /** Growth ceiling per attribute, 40-99. Fixed for the player's whole career at generation --
   *  never re-rolled as they age. See engine/development/growPlayerOneSeason.ts. */
  potential: Record<AttributeKey, number>
  /** Net DP earned *last* season (age/stage + playing time + practice + coaching, see
   *  engine/development/dpFormula.ts). Fully overwritten every rollover -- never banked/rolling,
   *  by design (no "save up and dump into one stat" exploit). Can be negative for a
   *  declining-stage player whose minutes/practice/coaching didn't offset base decline. */
  developmentPoints: number
  ageCurveStage: AgeCurveStage
}

export interface Player {
  id: PlayerId
  name: string
  age: number
  positions: Position[]
  heightInches: number
  jerseyNumber: number
  teamId: TeamId | null
  /** Placeholder identity marker (e.g. initials/color) — no real portrait art in MVP. */
  portraitPlaceholder: string

  attributes: PlayerAttributes
  hidden: PlayerHiddenTraits
  development: PlayerDevelopment

  /** UI/scouting flavor only — derived from attributes for display. Simulation must never read this. */
  overallRating: number
}
