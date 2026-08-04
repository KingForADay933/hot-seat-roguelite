import type { Player, PlayerId, Team } from '../../data/types'

export interface RotationState {
  /** Current on-court five; length always 5, replaced (not mutated in place) as substitutions happen. */
  onCourt: Player[]
  /** 0-100, keyed by every rostered player (bench included). */
  fatigue: Map<PlayerId, number>
  /** Possessions this player has been on court for, so far this game. Keyed by every rostered player. */
  possessionsPlayed: Map<PlayerId, number>
  /** possessionNumber the player currently in this slot last entered at -- for the shift-length cooldown. */
  shiftEnteredAt: Map<PlayerId, number>
}

export function createRotationState(team: Team, playersById: Map<PlayerId, Player>): RotationState {
  const fatigue = new Map<PlayerId, number>()
  const possessionsPlayed = new Map<PlayerId, number>()
  const shiftEnteredAt = new Map<PlayerId, number>()

  team.rosterPlayerIds.forEach((id) => {
    fatigue.set(id, 0)
    possessionsPlayed.set(id, 0)
  })

  const onCourt = team.startingFive.map((id) => {
    const player = playersById.get(id)
    if (!player) throw new Error(`Player ${id} in ${team.name}'s starting five was not found`)
    shiftEnteredAt.set(id, 0)
    return player
  })

  return { onCourt, fatigue, possessionsPlayed, shiftEnteredAt }
}
