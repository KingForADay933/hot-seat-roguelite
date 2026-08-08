import type { Player, PlayerId, PossessionLogEntry } from '../../data/types'
import { ACTION_PHRASES, OUTCOME_PHRASES, type OutcomeKey } from './templates'

function resolveName(id: PlayerId, playerById: Map<PlayerId, Player>): string {
  const player = playerById.get(id)
  if (!player) throw new Error(`Player ${id} referenced in the possession log was not found`)
  return player.name
}

function outcomeKeyFor(entry: PossessionLogEntry): OutcomeKey {
  if (entry.outcome === 'make') return entry.pointsScored === 3 ? 'make3' : 'make2'
  if (entry.outcome === 'miss') return entry.isThreePointAttempt ? 'miss3' : 'miss2'
  if (entry.outcome === 'foul') {
    if (entry.freeThrowsMade === 0) return 'foulNone'
    return entry.freeThrowsMade === entry.freeThrowsAttempted ? 'foulAll' : 'foulSome'
  }
  return 'turnover'
}

/**
 * Renders one possession log entry as a play-by-play sentence. Pure and deterministic: phrase
 * variants are picked by cycling on `possessionNumber` (not rng), so the same game always renders
 * identical commentary -- see design doc Section 14.2's "Broadcast Commentary" entry.
 */
export function generateCommentaryLine(entry: PossessionLogEntry, playerById: Map<PlayerId, Player>): string {
  const primaryName = resolveName(entry.primaryPlayerId, playerById)
  const secondaryName = entry.secondaryPlayerIds[0] ? resolveName(entry.secondaryPlayerIds[0], playerById) : undefined

  const actionPhrases = ACTION_PHRASES[entry.playCallUsed]
  const actionPhrase = actionPhrases[entry.possessionNumber % actionPhrases.length](primaryName, secondaryName)

  const outcomePhrases = OUTCOME_PHRASES[outcomeKeyFor(entry)]
  const outcomePhrase = outcomePhrases[entry.possessionNumber % outcomePhrases.length](primaryName)

  return `${capitalize(actionPhrase)}. ${capitalize(outcomePhrase)}`
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
