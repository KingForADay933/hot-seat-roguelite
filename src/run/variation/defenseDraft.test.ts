import { describe, expect, it } from 'vitest'
import { DEFENSIVE_SCHEMES } from '../../data/presets'
import type { Player, Team } from '../../data/types'
import { makeTestPlayer, makeTestTeam } from '../../engine/testFixtures'
import { defensiveFits } from './defenseDraft'

/** Five starters with the given attribute overrides applied to each in turn. */
function buildTeam(overrides: Partial<Player['attributes']>[]): { team: Team; roster: Player[] } {
  const roster = overrides.map((attributes) => makeTestPlayer({ attributes }))
  const team = makeTestTeam({ rosterPlayerIds: roster.map((p) => p.id), startingFive: roster.map((p) => p.id) })
  roster.forEach((p) => (p.teamId = team.id))
  return { team, roster }
}

const flatFive = () => Array.from({ length: 5 }, () => ({}))

function fitFor(team: Team, roster: Player[], schemeId: string) {
  return defensiveFits(team, roster).find((f) => f.scheme.id === schemeId)!
}

describe('defensiveFits', () => {
  it('offers every scheme, always -- defense is chosen, not rolled', () => {
    const { team, roster } = buildTeam(flatFive())
    expect(defensiveFits(team, roster).map((f) => f.scheme.id)).toEqual(Object.keys(DEFENSIVE_SCHEMES))
  })

  it('warns on Switch-Everything when one starter is a clear weak link', () => {
    const { team, roster } = buildTeam([{}, {}, {}, {}, { perimeterDefense: 20, lateralQuickness: 20 }])
    const fit = fitFor(team, roster, 'switchEverything')

    expect(fit.tone).toBe('bad')
    expect(fit.note).toContain(roster[4].name)
  })

  it('endorses Switch-Everything when the five defend evenly', () => {
    const { team, roster } = buildTeam(flatFive())
    expect(fitFor(team, roster, 'switchEverything').tone).toBe('good')
  })

  it('judges the weak link on the floor, not the worst player on the roster', () => {
    // The liability is buried on the bench, where no offense can switch onto him.
    const { team, roster } = buildTeam(flatFive())
    const benchScrub = makeTestPlayer({ attributes: { perimeterDefense: 10, lateralQuickness: 10 } })
    benchScrub.teamId = team.id

    expect(fitFor(team, [...roster, benchScrub], 'switchEverything').tone).toBe('good')
  })

  it('endorses Full-Court Press only when the starters have the legs for it', () => {
    const quick = buildTeam(Array.from({ length: 5 }, () => ({ speed: 75, lateralQuickness: 75 })))
    const slow = buildTeam(Array.from({ length: 5 }, () => ({ speed: 35, lateralQuickness: 35 })))

    expect(fitFor(quick.team, quick.roster, 'fullCourtPress').tone).toBe('good')
    expect(fitFor(slow.team, slow.roster, 'fullCourtPress').tone).toBe('bad')
  })

  it('matches Pack-the-Paint to a roster that defends better inside than out', () => {
    const bigs = buildTeam(Array.from({ length: 5 }, () => ({ interiorDefense: 75, vertical: 75, perimeterDefense: 40, lateralQuickness: 40 })))
    const wings = buildTeam(Array.from({ length: 5 }, () => ({ interiorDefense: 40, vertical: 40, perimeterDefense: 75, lateralQuickness: 75 })))

    expect(fitFor(bigs.team, bigs.roster, 'packThePaint').tone).toBe('good')
    expect(fitFor(wings.team, wings.roster, 'packThePaint').tone).toBe('bad')
  })

  it('calls a balanced roster neutral rather than inventing a preference', () => {
    const { team, roster } = buildTeam(flatFive())
    expect(fitFor(team, roster, 'manToMan').tone).toBe('neutral')
  })

  it('falls back to the whole roster when no starting five is set', () => {
    const roster = Array.from({ length: 5 }, () => makeTestPlayer({}))
    const team = makeTestTeam({ rosterPlayerIds: roster.map((p) => p.id), startingFive: [] })
    expect(defensiveFits(team, roster)).toHaveLength(Object.keys(DEFENSIVE_SCHEMES).length)
  })

  it('degrades safely with no roster at all rather than throwing', () => {
    const team = makeTestTeam({ rosterPlayerIds: [], startingFive: [] })
    const fits = defensiveFits(team, [])
    expect(fits).toHaveLength(Object.keys(DEFENSIVE_SCHEMES).length)
    expect(fits.every((f) => f.tone === 'neutral')).toBe(true)
  })
})
