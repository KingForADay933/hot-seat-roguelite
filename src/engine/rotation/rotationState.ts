import type { Player, PlayerId, Team } from '../../data/types'

export interface RotationState {
  /** Current on-court five; length always 5, replaced (not mutated in place) as substitutions happen. */
  onCourt: Player[]
  /** 0-100, keyed by every rostered player (bench included). */
  fatigue: Map<PlayerId, number>
  /** Game seconds this player has been on court for, so far this game. Keyed by every rostered
   *  player. Seconds rather than possessions since the clock became real -- a possession is no
   *  longer a fixed slice of the game, so counting them would drift against target minutes. */
  secondsPlayed: Map<PlayerId, number>
  /** Game seconds elapsed when the player currently in this slot last entered -- for the
   *  shift-length cooldown. */
  shiftEnteredAtSeconds: Map<PlayerId, number>
}

export function createRotationState(team: Team, playersById: Map<PlayerId, Player>): RotationState {
  const fatigue = new Map<PlayerId, number>()
  const secondsPlayed = new Map<PlayerId, number>()
  const shiftEnteredAtSeconds = new Map<PlayerId, number>()

  team.rosterPlayerIds.forEach((id) => {
    fatigue.set(id, 0)
    secondsPlayed.set(id, 0)
  })

  const onCourt = team.startingFive.map((id) => {
    const player = playersById.get(id)
    if (!player) throw new Error(`Player ${id} in ${team.name}'s starting five was not found`)
    shiftEnteredAtSeconds.set(id, 0)
    return player
  })

  return { onCourt, fatigue, secondsPlayed, shiftEnteredAtSeconds }
}
