import { useState } from 'react'
import type { AttributeKey } from '../../data/types'
import type { RunBundle } from '../../data/persistence/runRepository'
import { PLAYER_CAMP_COST, TEAM_CAMP_COST } from '../../run/constants'
import { ATTRIBUTE_COLUMNS } from '../attributeColumns'

export function ShopScreen({
  bundle,
  onBuyPlayerCamp,
  onBuyTeamCamp,
  onContinue,
}: {
  bundle: RunBundle
  onBuyPlayerCamp: (playerId: string, attribute: AttributeKey) => void
  onBuyTeamCamp: (attribute: AttributeKey) => void
  onContinue: () => void
}) {
  const { run, players, shop } = bundle
  const roster = players.filter((p) => p.teamId === run.teamId)
  const [playerId, setPlayerId] = useState(roster[0]?.id ?? '')
  const [playerAttribute, setPlayerAttribute] = useState<AttributeKey>(ATTRIBUTE_COLUMNS[0].key)
  const [teamAttribute, setTeamAttribute] = useState<AttributeKey>(ATTRIBUTE_COLUMNS[0].key)

  if (!shop) return null

  const canBuyPlayerCamp = shop.playerCampsRemaining > 0 && run.budget >= PLAYER_CAMP_COST && playerId !== ''
  const canBuyTeamCamp = shop.teamCampsRemaining > 0 && run.budget >= TEAM_CAMP_COST
  const nothingLeft = shop.playerCampsRemaining === 0 && shop.teamCampsRemaining === 0

  return (
    <main>
      <h1>{shop.tier === 'expanded' ? 'Expanded Shop' : 'Shop'}</h1>
      <p>
        {shop.tier === 'expanded'
          ? 'Stretch cleared -- more camp purchases this visit, plus the whole-team option.'
          : 'A quick, cheap look before the next season.'}
      </p>
      <p>Budget: ${run.budget}</p>

      {shop.playerCampsRemaining > 0 && (
        <div className="team-summary">
          <p>
            <strong>Player Camp</strong> ({shop.playerCampsRemaining} left) -- send one player to camp for a bounded boost to the
            attribute you pick. ${PLAYER_CAMP_COST}
          </p>
          <label>
            Player
            <select value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
              {roster.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Attribute
            <select value={playerAttribute} onChange={(e) => setPlayerAttribute(e.target.value as AttributeKey)}>
              {ATTRIBUTE_COLUMNS.map((col) => (
                <option key={col.key} value={col.key}>
                  {col.label}
                </option>
              ))}
            </select>
          </label>
          <button className="primary" disabled={!canBuyPlayerCamp} onClick={() => onBuyPlayerCamp(playerId, playerAttribute)}>
            Send to Camp
          </button>
        </div>
      )}

      {shop.teamCampsRemaining > 0 && (
        <div className="team-summary">
          <p>
            <strong>Whole-Team Camp</strong> ({shop.teamCampsRemaining} left) -- send the entire roster to camp for a smaller
            per-player boost to the attribute you pick, spread across everyone. ${TEAM_CAMP_COST}
          </p>
          <label>
            Attribute
            <select value={teamAttribute} onChange={(e) => setTeamAttribute(e.target.value as AttributeKey)}>
              {ATTRIBUTE_COLUMNS.map((col) => (
                <option key={col.key} value={col.key}>
                  {col.label}
                </option>
              ))}
            </select>
          </label>
          <button className="primary" disabled={!canBuyTeamCamp} onClick={() => onBuyTeamCamp(teamAttribute)}>
            Send Whole Team to Camp
          </button>
        </div>
      )}

      {nothingLeft && <p>Nothing left to buy this visit.</p>}

      <p>
        <button className="primary" onClick={onContinue}>
          Sim Next Season
        </button>
      </p>
    </main>
  )
}
