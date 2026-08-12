import { useState } from 'react'
import { MARKET_SIZES } from '../../run/marketSize'
import { HOUSE_RULES, type HouseRuleId } from '../../run/variation/houseRules'
import { ROSTER_QUIRKS, type RosterQuirkId } from '../../run/variation/rosterQuirks'
import { DraftOptionCard } from '../components/DraftOptionCard'
import type { PendingDraft } from '../state/runContext.core'
import { ScreenActions } from '../components/ScreenActions'

/**
 * Phase one of run setup: the two picks that reshape the roster itself. The system draft used to
 * live here too, but it scores against a finished roster, so it moved to the reveal screen -- see
 * PendingDraft's doc comment.
 */
export function RunDraftScreen({
  draft,
  onConfirm,
}: {
  draft: PendingDraft
  onConfirm: (rosterQuirk: RosterQuirkId, houseRule: HouseRuleId) => void
}) {
  const [rosterQuirk, setRosterQuirk] = useState<RosterQuirkId | null>(null)
  const [houseRule, setHouseRule] = useState<HouseRuleId | null>(null)
  const market = MARKET_SIZES[draft.marketSize]

  const canConfirm = rosterQuirk && houseRule

  return (
    <main>
      <ScreenActions>
        <button className="primary" disabled={!canConfirm} onClick={() => canConfirm && onConfirm(rosterQuirk, houseRule)}>
          Meet the Team
        </button>
      </ScreenActions>

      <h1>Build Your Roster</h1>
      <p>
        <strong>{market.label}</strong> -- {market.description}
      </p>
      <p>Two calls that shape the roster you inherit. You&apos;ll pick a system after you&apos;ve seen what they left you.</p>

      <h2>Roster Quirk</h2>
      <div className="draft-options">
        {draft.rosterQuirkOptions.map((id) => (
          <DraftOptionCard
            key={id}
            label={ROSTER_QUIRKS[id].label}
            description={ROSTER_QUIRKS[id].description}
            selected={id === rosterQuirk}
            onSelect={() => setRosterQuirk(id)}
          />
        ))}
      </div>

      <h2>House Rule</h2>
      <div className="draft-options">
        {draft.houseRuleOptions.map((id) => (
          <DraftOptionCard
            key={id}
            label={HOUSE_RULES[id].label}
            description={HOUSE_RULES[id].description}
            selected={id === houseRule}
            onSelect={() => setHouseRule(id)}
          />
        ))}
      </div>

    </main>
  )
}
