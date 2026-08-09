import { DEFENSIVE_SCHEMES, type DefensiveScheme, type DefensiveSchemeId } from '../../data/presets'
import type { Player, Team } from '../../data/types'
import { avgInteriorDefense, avgPerimeterDefense } from '../../engine/matchup'
import { average } from '../../engine/math'

/**
 * How well a roster suits each defensive scheme, for the draft screen.
 *
 * Every signal below is read off the same quantity the engine itself consumes, rather than invented
 * for display -- the same discipline systemDraft.ts follows for offense. A note that disagreed with
 * what the simulation then did would be worse than no note at all.
 *
 * Unlike offensive synergy this produces **no score and no multiplier**. Defensive schemes reach the
 * sim as a shape (which defender is picked, which actions are resisted, how much ball pressure),
 * not as a scalar, so there is no honest single number to show. What the GM gets is a read on the
 * specific trade each scheme makes against these specific players.
 */

/** The five the scheme will actually be run with most of the time. Weak-link exposure is a property
 *  of who is *on the floor together*, not of the roster at large -- the twelfth man cannot be hunted
 *  from the bench. */
function likelyFive(team: Team, roster: Player[]): Player[] {
  const byId = new Map(roster.map((p) => [p.id, p]))
  const starters = team.startingFive.map((id) => byId.get(id)).filter((p): p is Player => p !== undefined)
  return starters.length > 0 ? starters : roster
}

export type DefensiveFitTone = 'good' | 'neutral' | 'bad'

export interface DefensiveFit {
  scheme: DefensiveScheme
  tone: DefensiveFitTone
  /** One sentence naming the trade this roster is actually making by picking this scheme. */
  note: string
}

/** How far the weakest link on the floor sits below that five's average. Switch-Everything hands
 *  him the possession (playerSelector.ts's weakLinkSensitive branches), so this gap *is* the cost. */
function weakLinkGap(five: Player[]): { gap: number; name: string } {
  const perimeter = five.reduce((worst, p) => (avgPerimeterDefense(p) < avgPerimeterDefense(worst) ? p : worst))
  const interior = five.reduce((worst, p) => (avgInteriorDefense(p) < avgInteriorDefense(worst) ? p : worst))
  const perimeterGap = average(five.map(avgPerimeterDefense)) - avgPerimeterDefense(perimeter)
  const interiorGap = average(five.map(avgInteriorDefense)) - avgInteriorDefense(interior)
  return perimeterGap >= interiorGap ? { gap: perimeterGap, name: perimeter.name } : { gap: interiorGap, name: interior.name }
}

/** Gap in points below the five's average at which a weak link stops being a rounding error and
 *  starts being the thing opponents aim at. Sits near the spread a single out-of-place starter
 *  opens up; below it a five is even enough that switching costs nothing worth warning about. */
const WEAK_LINK_WARN_GAP = 8

/** How far the roster's inside defence outweighs its perimeter defence (or the reverse). Mirrors
 *  the two halves resistance.ts's applyInteriorFocus trades against each other. */
function interiorTilt(five: Player[]): number {
  return average(five.map(avgInteriorDefense)) - average(five.map(avgPerimeterDefense))
}

/** The exact quantity computePressResistance multiplies by pressureCoefficient. */
function pressAthleticism(five: Player[]): number {
  return average(five.map((p) => (p.attributes.speed + p.attributes.lateralQuickness) / 2))
}

const PRESS_GOOD_ATHLETICISM = 60
const PRESS_BAD_ATHLETICISM = 48
const TILT_SIGNIFICANT = 5

function describeFit(scheme: DefensiveScheme, five: Player[]): { tone: DefensiveFitTone; note: string } {
  if (scheme.weakLinkSensitive) {
    const { gap, name } = weakLinkGap(five)
    if (gap >= WEAK_LINK_WARN_GAP) {
      return { tone: 'bad', note: `${name} is ${Math.round(gap)} below your starters' average -- switching hands him the possession.` }
    }
    return { tone: 'good', note: 'Your starters defend evenly enough that there is no obvious man to hunt.' }
  }

  if (scheme.pressureCoefficient > 1) {
    const athleticism = pressAthleticism(five)
    if (athleticism >= PRESS_GOOD_ATHLETICISM) {
      return { tone: 'good', note: `Your starters average ${Math.round(athleticism)} for speed and quickness -- enough legs to press with.` }
    }
    if (athleticism <= PRESS_BAD_ATHLETICISM) {
      return { tone: 'bad', note: `Your starters average only ${Math.round(athleticism)} for speed and quickness -- pressing amplifies that.` }
    }
    return { tone: 'neutral', note: 'Middling speed and quickness -- the press will neither win nor lose you much.' }
  }

  const tilt = interiorTilt(five)
  const leansInside = scheme.interiorFocus > 0.5
  if (Math.abs(tilt) < TILT_SIGNIFICANT) {
    return { tone: 'neutral', note: 'Your starters guard inside and out about equally, so this asks nothing unusual of them.' }
  }
  const rosterIsInside = tilt > 0
  if (leansInside === rosterIsInside) {
    return {
      tone: 'good',
      note: rosterIsInside
        ? `Your starters are ${Math.round(tilt)} better inside than out -- this leans on the half they are good at.`
        : `Your starters are ${Math.round(-tilt)} better on the perimeter, which is where this scheme spends its effort.`,
    }
  }
  return {
    tone: 'bad',
    note: rosterIsInside
      ? `Your starters are ${Math.round(tilt)} better inside, and this scheme spends its effort on the perimeter instead.`
      : `Your starters are ${Math.round(-tilt)} better on the perimeter, and this scheme concedes there to protect the rim.`,
  }
}

/** Every scheme scored against the roster, in a fixed order so the cards don't reshuffle between
 *  renders. All five are always offered: defence is the standing instruction the GM gives, not one
 *  of the run's imposed variation axes, so there is nothing here to roll a hand from. */
export function defensiveFits(team: Team, roster: Player[]): DefensiveFit[] {
  const five = likelyFive(team, roster)
  return (Object.keys(DEFENSIVE_SCHEMES) as DefensiveSchemeId[]).map((id) => {
    const scheme = DEFENSIVE_SCHEMES[id]
    if (five.length === 0) return { scheme, tone: 'neutral' as const, note: 'No roster to judge this against yet.' }
    return { scheme, ...describeFit(scheme, five) }
  })
}
