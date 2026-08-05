import { useState } from 'react'
import { OFFENSIVE_PLAYBOOKS, type SystemId } from '../../data/presets'
import { MARKET_SIZES } from '../../run/marketSize'
import { HOUSE_RULES, type HouseRuleId } from '../../run/variation/houseRules'
import { ROSTER_QUIRKS, type RosterQuirkId } from '../../run/variation/rosterQuirks'
import { DraftOptionCard } from '../components/DraftOptionCard'
import type { PendingDraft } from '../state/runContext.core'

export function RunDraftScreen({
  draft,
  onConfirm,
}: {
  draft: PendingDraft
  onConfirm: (rosterQuirk: RosterQuirkId, houseRule: HouseRuleId, system: SystemId) => void
}) {
  const [rosterQuirk, setRosterQuirk] = useState<RosterQuirkId | null>(null)
  const [houseRule, setHouseRule] = useState<HouseRuleId | null>(null)
  const [system, setSystem] = useState<SystemId | null>(null)
  const market = MARKET_SIZES[draft.marketSize]

  const canConfirm = rosterQuirk && houseRule && system

  return (
    <main>
      <h1>Build Your Roster</h1>
      <p>
        <strong>{market.label}</strong> -- {market.description}
      </p>
      <p>Three choices before the season starts. Pick one from each.</p>

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

      <h2>System</h2>
      <div className="draft-options">
        {draft.systemOptions.map((id) => (
          <DraftOptionCard
            key={id}
            label={OFFENSIVE_PLAYBOOKS[id].name}
            description={OFFENSIVE_PLAYBOOKS[id].description}
            selected={id === system}
            onSelect={() => setSystem(id)}
          />
        ))}
      </div>

      <button className="primary" disabled={!canConfirm} onClick={() => canConfirm && onConfirm(rosterQuirk, houseRule, system)}>
        Confirm
      </button>
    </main>
  )
}
