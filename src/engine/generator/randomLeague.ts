import { createId } from '../../data/ids'
import { DEFENSIVE_SCHEMES, OFFENSIVE_PLAYBOOKS } from '../../data/presets'
import type { League, Player, Team } from '../../data/types'
import type { Rng } from '../rng'
import { generateTeam } from './randomTeam'

/** Small fictional city/nickname pool -- avoids any real-league branding. */
const TEAM_POOL: { city: string; name: string; abbreviation: string }[] = [
  { city: 'Ashford', name: 'Comets', abbreviation: 'ASH' },
  { city: 'Brightwater', name: 'Foxes', abbreviation: 'BRW' },
  { city: 'Cedar Bluff', name: 'Miners', abbreviation: 'CDB' },
  { city: 'Dunmore', name: 'Sentries', abbreviation: 'DUN' },
  { city: 'Eastvale', name: 'Vipers', abbreviation: 'EVL' },
  { city: 'Fairport', name: 'Marlins', abbreviation: 'FRP' },
  { city: 'Granite Falls', name: 'Wolverines', abbreviation: 'GRF' },
  { city: 'Harborview', name: 'Admirals', abbreviation: 'HBV' },
  { city: 'Ironwood', name: 'Highlanders', abbreviation: 'IRN' },
  { city: 'Jasper Peak', name: 'Cougars', abbreviation: 'JSP' },
  { city: 'Kingston', name: 'Serpents', abbreviation: 'KGS' },
  { city: 'Lakeshore', name: 'Herons', abbreviation: 'LKS' },
  { city: 'Millbrook', name: 'Ospreys', abbreviation: 'MLB' },
  { city: 'Northgate', name: 'Guardians', abbreviation: 'NGT' },
  { city: 'Oakridge', name: 'Rebels', abbreviation: 'OAK' },
  { city: 'Pinecrest', name: 'Wildcats', abbreviation: 'PIN' },
]

const COLOR_PALETTE: [string, string][] = [
  ['#1d3557', '#e63946'],
  ['#2a9d8f', '#264653'],
  ['#e76f51', '#2a2a2a'],
  ['#3a5a40', '#dad7cd'],
  ['#023047', '#fb8500'],
  ['#6a4c93', '#f4a261'],
  ['#780000', '#c1121f'],
  ['#003049', '#669bbc'],
  ['#5f0f40', '#9a031e'],
  ['#283618', '#bc6c25'],
  ['#14213d', '#fca311'],
  ['#4a4e69', '#c9ada7'],
  ['#264653', '#e9c46a'],
  ['#606c38', '#dda15e'],
  ['#1b263b', '#778da9'],
  ['#3d0000', '#813405'],
]

function shuffled<T>(items: T[], rng: Rng): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function pickKey(pool: Record<string, unknown>, rng: Rng): string {
  const keys = Object.keys(pool)
  return keys[Math.floor(rng() * keys.length)]
}

export interface GenerateLeagueParams {
  teamCount: number
  leagueName: string
  rng: Rng
  seasonLength?: number
  possessionsPerGame?: number
  /** League-wide additive shift applied to every generated player's attribute rolls -- a
   *  parity/difficulty knob. See engine/generator/randomPlayer.ts's generatePlayer. */
  averageOverallShift?: number
}

export interface GeneratedLeague {
  league: League
  teams: Team[]
  players: Player[]
}

export function generateLeague(params: GenerateLeagueParams): GeneratedLeague {
  // 200 total possessions -- ~100 per team, the real NBA rate. The old 100 gave each team ~50 and
  // implied 28.8 seconds of clock per possession, longer than a shot clock; nothing could sample a
  // believable duration at that pace. Points-per-possession was already realistic, so doubling the
  // possessions is also what brings scoring up to a real ~115 a side without touching the shot model.
  const { teamCount, leagueName, rng, seasonLength = 16, possessionsPerGame = 200, averageOverallShift = 0 } = params

  if (teamCount < 2 || teamCount > TEAM_POOL.length) {
    throw new Error(`teamCount must be between 2 and ${TEAM_POOL.length}, got ${teamCount}`)
  }

  const chosen = shuffled(TEAM_POOL, rng).slice(0, teamCount)

  const generated = chosen.map((entry, i) => {
    const [primaryColor, secondaryColor] = COLOR_PALETTE[i % COLOR_PALETTE.length]
    return generateTeam({
      name: entry.name,
      city: entry.city,
      abbreviation: entry.abbreviation,
      primaryColor,
      secondaryColor,
      offensiveStrategyId: pickKey(OFFENSIVE_PLAYBOOKS, rng),
      defensiveStrategyId: pickKey(DEFENSIVE_SCHEMES, rng),
      rng,
      averageOverallShift,
    })
  })

  const teams = generated.map((g) => g.team)
  const players = generated.flatMap((g) => g.players)

  const league: League = {
    id: createId('league'),
    name: leagueName,
    structure: 'single-conference',
    teamIds: teams.map((t) => t.id),
    scheduleGameIds: [],
    rules: { seasonLength, playoffFormat: null },
    pacePresets: { possessionsPerGame },
    currentDate: new Date().toISOString(),
    userControlledTeamId: null,
    seasonNumber: 1,
    seasonHistory: [],
  }

  return { league, teams, players }
}
