import { createId } from '../../data/ids'
import type { Position, Team } from '../../data/types'
import {
  DEFAULT_INDIVIDUAL_DEVELOPMENT_SHARE,
  ROSTER_TALENT_LADDER,
  SYNERGY_NEUTRAL,
  TALENT_BASELINE,
  TALENT_JITTER,
  TEAM_TALENT_SPREAD,
} from '../constants'
import { ALL_POSITIONS, deriveDepthChart } from '../depthChart'
import type { Rng } from '../rng'
import { focusForSystem } from '../tacticalFocus'
import { generatePlayer } from './randomPlayer'

const MAX_ROSTER_SIZE = 12
/** One of each position starts; the second of each plus two rolled spares fill the bench. Same
 *  composition the flat template always produced -- what is new is which *rung* each slot draws. */
const BENCH_TEMPLATE: Position[] = [...ALL_POSITIONS]
const ROLLED_BENCH_SLOTS = MAX_ROSTER_SIZE - ALL_POSITIONS.length - BENCH_TEMPLATE.length

function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Bell-ish draw across [-spread, +spread], so most teams sit near the league average and the
 *  extremes are rare -- a uniform draw would make every league a flat spread of quality. */
function centeredRoll(rng: Rng, spread: number): number {
  return ((rng() + rng() + rng()) / 3 - 0.5) * 2 * spread
}

export interface GenerateTeamParams {
  name: string
  city: string
  abbreviation: string
  primaryColor: string
  secondaryColor: string
  offensiveStrategyId: string
  defensiveStrategyId: string
  rng: Rng
  averageOverallShift?: number
  /** Names already spoken for elsewhere. Read and added to, so generateLeague can thread one set
   *  through every team and get league-wide unique names rather than per-roster ones. */
  takenNames?: Set<string>
}

export interface GeneratedTeam {
  team: Team
  players: ReturnType<typeof generatePlayer>[]
}

export function generateTeam(params: GenerateTeamParams): GeneratedTeam {
  // Defaulted rather than left undefined so a team generated on its own still has unique names
  // within itself -- the roster is the smallest scope where a repeat is confusing.
  const { rng, averageOverallShift = 0, takenNames = new Set<string>() } = params
  const teamId = createId('team')

  // How good this team is before any individual is rolled. Drawn once, added to every player.
  const teamTalent = centeredRoll(rng, TEAM_TALENT_SPREAD)

  /**
   * The roster in depth order: five starters, one per position, then the bench.
   *
   * Shuffled so the franchise player is not always a point guard, and so which position carries the
   * better backup varies from team to team. Because slot order *is* talent order, the existing
   * best-overall-at-each-position starter selection in depthChart.ts picks exactly these five --
   * which is the whole depth-chart fix, with no change to that selection.
   */
  const rolledBench = Array.from({ length: ROLLED_BENCH_SLOTS }, () => ALL_POSITIONS[Math.floor(rng() * ALL_POSITIONS.length)])
  const slots: Position[] = [...shuffle(ALL_POSITIONS, rng), ...shuffle([...BENCH_TEMPLATE, ...rolledBench], rng)]

  const players = slots.map((position, rung) => {
    const talent = TALENT_BASELINE + teamTalent + ROSTER_TALENT_LADDER[rung] + centeredRoll(rng, TALENT_JITTER)
    const player = generatePlayer(position, rng, talent + averageOverallShift, takenNames)
    player.teamId = teamId
    return player
  })

  const team: Team = {
    id: teamId,
    name: params.name,
    city: params.city,
    abbreviation: params.abbreviation,
    primaryColor: params.primaryColor,
    secondaryColor: params.secondaryColor,
    rosterPlayerIds: players.map((p) => p.id),
    maxRosterSize: MAX_ROSTER_SIZE,
    ...deriveDepthChart(players),
    offensiveStrategyId: params.offensiveStrategyId,
    // Derived from the system rather than rolled, so no rng draw moves and a scouted opponent's
    // dials agree with its identity. See engine/tacticalFocus.ts's focusForSystem. Undefined for
    // the systems with no particular lean, which is most of them.
    tacticalFocus: focusForSystem(params.offensiveStrategyId),
    defensiveStrategyId: params.defensiveStrategyId,
    coaching: { headCoachRating: Math.round(40 + rng() * 50) },
    practiceSettings: { individualDevelopmentShare: DEFAULT_INDIVIDUAL_DEVELOPMENT_SHARE },
    trainingFocus: {},
    // Neutral by default -- only a roguelite run's user-controlled team ever deviates, via the
    // drafted-system roster fit (run/variation/systemDraft.ts). Every AI opponent stays neutral.
    synergyScore: SYNERGY_NEUTRAL,
    record: { wins: 0, losses: 0 },
  }

  return { team, players }
}
