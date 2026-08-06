import { useState } from 'react'
import type { AttributeKey, Player } from '../../data/types'
import { ATTRIBUTE_COLUMNS } from '../attributeColumns'

/**
 * One camp purchase action (Section 8.5) -- the GM picks both the target (a specific roster
 * player, via `players`; omit `players` for a team-wide camp with no per-player target) and
 * which attribute the camp boosts, replacing the old rolled-offer-card flow.
 */
export function CampPurchaseForm({
  title,
  description,
  cost,
  remaining,
  budget,
  players,
  onBuy,
}: {
  title: string
  description: string
  cost: number
  remaining: number
  budget: number
  players?: Player[]
  onBuy: (attribute: AttributeKey, playerId?: string) => void
}) {
  const [attribute, setAttribute] = useState<AttributeKey>(ATTRIBUTE_COLUMNS[0].key)
  const [playerId, setPlayerId] = useState<string>(players?.[0]?.id ?? '')

  if (remaining <= 0) return null

  const affordable = budget >= cost
  const canBuy = affordable && (!players || playerId !== '')

  return (
    <div className="team-summary">
      <strong>{title}</strong>
      <p>{description}</p>
      <p>
        ${cost} -- {remaining} left this visit
      </p>
      {players && (
        <label>
          Player
          <select value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.positions[0]} {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Attribute
        <select value={attribute} onChange={(e) => setAttribute(e.target.value as AttributeKey)}>
          {ATTRIBUTE_COLUMNS.map((col) => (
            <option key={col.key} value={col.key}>
              {col.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="primary"
        disabled={!canBuy}
        onClick={() => onBuy(attribute, players ? playerId : undefined)}
      >
        Send to Camp
      </button>
    </div>
  )
}
