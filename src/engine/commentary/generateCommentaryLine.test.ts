import { describe, expect, it } from 'vitest'
import type { PlayCallType, PlayerId, PossessionLogEntry, PossessionOutcome } from '../../data/types'
import { makeTestPlayer } from '../testFixtures'
import { generateCommentaryLine } from './generateCommentaryLine'

const ALL_PLAY_CALLS: PlayCallType[] = ['pick-and-roll', 'isolation', 'post-up', 'spot-up', 'cutting', 'transition']
const ALL_OUTCOMES: PossessionOutcome[] = ['make', 'miss', 'turnover', 'foul']

function makeEntry(overrides: Partial<PossessionLogEntry> & { primaryPlayerId: PlayerId }): PossessionLogEntry {
  return {
    possessionNumber: 1,
    offenseTeamId: 'team-1',
    playCallUsed: 'isolation',
    secondaryPlayerIds: [],
    outcome: 'make',
    pointsScored: 2,
    isThreePointAttempt: false,
    playersInvolved: [],
    homeOnCourtIds: [],
    awayOnCourtIds: [],
    ...overrides,
  }
}

describe('generateCommentaryLine', () => {
  it('never throws across every play call x outcome x shot-type x with/without a secondary', () => {
    const primary = makeTestPlayer({ name: 'Primary' })
    const secondary = makeTestPlayer({ name: 'Secondary' })
    const playerById = new Map([
      [primary.id, primary],
      [secondary.id, secondary],
    ])

    for (const playCallUsed of ALL_PLAY_CALLS) {
      for (const outcome of ALL_OUTCOMES) {
        for (const isThreePointAttempt of [false, true]) {
          for (const secondaryPlayerIds of [[], [secondary.id]] as PlayerId[][]) {
            const entry = makeEntry({
              playCallUsed,
              outcome,
              isThreePointAttempt,
              pointsScored: outcome === 'make' ? (isThreePointAttempt ? 3 : 2) : 0,
              primaryPlayerId: primary.id,
              secondaryPlayerIds,
            })
            expect(() => generateCommentaryLine(entry, playerById)).not.toThrow()
          }
        }
      }
    }
  })

  it('is deterministic given the same entry and player map', () => {
    const primary = makeTestPlayer({ name: 'Primary' })
    const playerById = new Map([[primary.id, primary]])
    const entry = makeEntry({ primaryPlayerId: primary.id, possessionNumber: 42 })

    const a = generateCommentaryLine(entry, playerById)
    const b = generateCommentaryLine(entry, playerById)
    expect(a).toBe(b)
  })

  it("includes the primary player's name for every play call", () => {
    const primary = makeTestPlayer({ name: 'Jordan Primary' })
    const secondary = makeTestPlayer({ name: 'Alex Secondary' })
    const playerById = new Map([
      [primary.id, primary],
      [secondary.id, secondary],
    ])

    for (const playCallUsed of ALL_PLAY_CALLS) {
      const entry = makeEntry({ playCallUsed, primaryPlayerId: primary.id, secondaryPlayerIds: [secondary.id] })
      expect(generateCommentaryLine(entry, playerById)).toContain('Jordan Primary')
    }
  })

  it("includes the secondary player's name for play calls that use one", () => {
    const primary = makeTestPlayer({ name: 'Jordan Primary' })
    const secondary = makeTestPlayer({ name: 'Alex Secondary' })
    const playerById = new Map([
      [primary.id, primary],
      [secondary.id, secondary],
    ])
    // Transition's secondary-using phrase is only one of its three variants -- sweep possessionNumber
    // 0-2 so every play call's full phrase-variant set gets a chance to include the secondary.
    const usesSecondary: PlayCallType[] = ['pick-and-roll', 'spot-up', 'cutting', 'transition']

    for (const playCallUsed of usesSecondary) {
      const foundSecondary = [0, 1, 2].some((possessionNumber) => {
        const entry = makeEntry({
          playCallUsed,
          primaryPlayerId: primary.id,
          secondaryPlayerIds: [secondary.id],
          possessionNumber,
        })
        return generateCommentaryLine(entry, playerById).includes('Alex Secondary')
      })
      expect(foundSecondary).toBe(true)
    }
  })

  it('produces more than one distinct rendering across different possessionNumbers', () => {
    const primary = makeTestPlayer({ name: 'Primary' })
    const secondary = makeTestPlayer({ name: 'Secondary' })
    const playerById = new Map([
      [primary.id, primary],
      [secondary.id, secondary],
    ])

    const renderings = new Set<string>()
    for (let possessionNumber = 0; possessionNumber < 12; possessionNumber++) {
      const entry = makeEntry({
        playCallUsed: 'pick-and-roll',
        primaryPlayerId: primary.id,
        secondaryPlayerIds: [secondary.id],
        possessionNumber,
      })
      renderings.add(generateCommentaryLine(entry, playerById))
    }
    expect(renderings.size).toBeGreaterThan(1)
  })
})
