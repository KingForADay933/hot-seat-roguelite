import type { AttributeKey, Player, PlayerAttributes, PlayerDevelopment, PlayerHiddenTraits, Position, Team } from '../data/types'
import { SYNERGY_NEUTRAL } from './constants'

let idCounter = 0

const DEFAULT_ATTRIBUTES: PlayerAttributes = {
  insideShot: 50,
  outsideShot: 50,
  passing: 50,
  ballHandling: 50,
  rebounding: 50,
  perimeterDefense: 50,
  interiorDefense: 50,
  speed: 50,
  lateralQuickness: 50,
  vertical: 50,
}

const DEFAULT_HIDDEN: PlayerHiddenTraits = {
  consistency: 70,
  clutch: 50,
  durability: 70,
  tendency: 'balanced',
  morale: 70,
}

/** Comfortably above DEFAULT_ATTRIBUTES's 50 so gap-based development tests have room to grow. */
const DEFAULT_POTENTIAL: Record<AttributeKey, number> = {
  insideShot: 85,
  outsideShot: 85,
  passing: 85,
  ballHandling: 85,
  rebounding: 85,
  perimeterDefense: 85,
  interiorDefense: 85,
  speed: 85,
  lateralQuickness: 85,
  vertical: 85,
}

const DEFAULT_DEVELOPMENT: PlayerDevelopment = {
  potential: DEFAULT_POTENTIAL,
  developmentPoints: 0,
  ageCurveStage: 'peak',
}

/** Test-only fixture builder -- not part of the engine's public surface. */
export function makeTestPlayer(overrides: {
  attributes?: Partial<PlayerAttributes>
  hidden?: Partial<PlayerHiddenTraits>
  development?: Partial<PlayerDevelopment>
  positions?: Position[]
  name?: string
  age?: number
} = {}): Player {
  idCounter += 1
  return {
    id: `test-player-${idCounter}`,
    name: overrides.name ?? `Test Player ${idCounter}`,
    age: overrides.age ?? 25,
    positions: overrides.positions ?? ['PG'],
    heightInches: 74,
    jerseyNumber: idCounter,
    teamId: null,
    portraitPlaceholder: '',
    attributes: { ...DEFAULT_ATTRIBUTES, ...overrides.attributes },
    hidden: { ...DEFAULT_HIDDEN, ...overrides.hidden },
    development: { ...DEFAULT_DEVELOPMENT, ...overrides.development },
    overallRating: 50,
  }
}

/** Five players covering PG/SG/SF/PF/C, all default-average, for tests exercising matchup logic. */
export function makeTestFive(): Player[] {
  const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']
  return positions.map((position) => makeTestPlayer({ positions: [position] }))
}

/** Test-only fixture builder for schedule/standings tests, which only care about a Team's id. */
export function makeTestTeam(overrides: Partial<Team> = {}): Team {
  idCounter += 1
  return {
    id: `test-team-${idCounter}`,
    name: `Test Team ${idCounter}`,
    city: 'Test City',
    abbreviation: 'TST',
    primaryColor: '#000000',
    secondaryColor: '#ffffff',
    rosterPlayerIds: [],
    maxRosterSize: 12,
    startingFive: [],
    rotationMinutes: {},
    offensiveStrategyId: 'balanced',
    defensiveStrategyId: 'manToMan',
    coaching: { headCoachRating: 50 },
    practiceSettings: { individualDevelopmentShare: 50 },
    trainingFocus: {},
    synergyScore: SYNERGY_NEUTRAL,
    record: { wins: 0, losses: 0 },
    ...overrides,
  }
}
