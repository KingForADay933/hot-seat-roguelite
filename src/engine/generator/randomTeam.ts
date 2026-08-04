import { createId } from '../../data/ids'
import type { Player, PlayerId, Position, Team } from '../../data/types'
import { DEFAULT_INDIVIDUAL_DEVELOPMENT_SHARE, ROTATION_DEPTH_WEIGHTS, REGULATION_MINUTES } from '../constants'
import type { Rng } from '../rng'
import { generatePlayer } from './randomPlayer'

const MAX_ROSTER_SIZE = 12
/** Two of each position guarantees a fillable starting five with bench depth; 2 extra add variety. */
const ROSTER_TEMPLATE: Position[] = ['PG', 'PG', 'SG', 'SG', 'SF', 'SF', 'PF', 'PF', 'C', 'C']
const ALL_POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']

/** Target minutes per rostered player, ranked by overallRating within each position group (the
 *  same sanctioned roster-construction use of overallRating as startingFive's own selection). */
function computeRotationMinutes(players: Player[]): Record<PlayerId, number> {
  const minutes: Record<PlayerId, number> = {}
  ALL_POSITIONS.forEach((position) => {
    const group = players.filter((p) => p.positions[0] === position).sort((a, b) => b.overallRating - a.overallRating)
    const weights = group.map((_, rank) => ROTATION_DEPTH_WEIGHTS[Math.min(rank, ROTATION_DEPTH_WEIGHTS.length - 1)])
    const totalWeight = weights.reduce((sum, w) => sum + w, 0)
    group.forEach((p, i) => {
      minutes[p.id] = totalWeight > 0 ? (REGULATION_MINUTES * weights[i]) / totalWeight : 0
    })
  })
  return minutes
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
}

export interface GeneratedTeam {
  team: Team
  players: ReturnType<typeof generatePlayer>[]
}

export function generateTeam(params: GenerateTeamParams): GeneratedTeam {
  const { rng, averageOverallShift = 0 } = params
  const teamId = createId('team')

  const extraPositions = Array.from({ length: MAX_ROSTER_SIZE - ROSTER_TEMPLATE.length }, () => {
    return ALL_POSITIONS[Math.floor(rng() * ALL_POSITIONS.length)]
  })

  const players = [...ROSTER_TEMPLATE, ...extraPositions].map((position) => {
    const player = generatePlayer(position, rng, averageOverallShift)
    player.teamId = teamId
    return player
  })

  const startingFive = ALL_POSITIONS.map((position) => {
    const atPosition = players.filter((p) => p.positions.includes(position))
    return atPosition.reduce((best, p) => (p.overallRating > best.overallRating ? p : best))
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
    startingFive: startingFive.map((p) => p.id),
    rotationMinutes: computeRotationMinutes(players),
    offensiveStrategyId: params.offensiveStrategyId,
    defensiveStrategyId: params.defensiveStrategyId,
    coaching: { headCoachRating: Math.round(40 + rng() * 50) },
    practiceSettings: { individualDevelopmentShare: DEFAULT_INDIVIDUAL_DEVELOPMENT_SHARE },
    trainingFocus: {},
    synergyScore: 0,
    record: { wins: 0, losses: 0 },
  }

  return { team, players }
}
