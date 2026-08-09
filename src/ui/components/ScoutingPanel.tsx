import type { Player, Team } from '../../data/types'
import { AGE_CURVE_LABELS, TENDENCY_LABELS } from '../playerDisplay'
import { splitRoster } from '../rosterGroups'
import { PlayerName } from './PlayerName'

function ScoutingGroup({ label, players }: { label: string; players: Player[] }) {
  if (players.length === 0) return null

  return (
    <>
      <h3>{label}</h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Age Curve</th>
              <th className="numeric">DP Last Season</th>
              <th className="numeric">Consistency</th>
              <th className="numeric">Clutch</th>
              <th className="numeric">Durability</th>
              <th>Tendency</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id}>
                <td>
                  <PlayerName playerId={player.id} name={player.name} />
                </td>
                <td>{AGE_CURVE_LABELS[player.development.ageCurveStage]}</td>
                <td className={`numeric${player.development.developmentPoints < 0 ? ' text-negative' : ''}`}>
                  {/* dpFormula sums fractional bonuses, so this is routinely 37.599999999999994. */}
                  {player.development.developmentPoints.toFixed(1)}
                </td>
                {/* Rounded for the same reason as the attribute sheet -- coaching upgrades and
                    consumables shift these by non-integer amounts. */}
                <td className="numeric">{Math.round(player.hidden.consistency)}</td>
                <td className="numeric">{Math.round(player.hidden.clutch)}</td>
                <td className="numeric">{Math.round(player.hidden.durability)}</td>
                <td>{TENDENCY_LABELS[player.hidden.tendency]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

/**
 * The ratings that drive the simulation without appearing in the attribute sheet: age-curve stage
 * and last season's development points (what the roster's growth is about to do), plus the three
 * numeric intangibles the sim actually reads -- Consistency (night-to-night variance), Clutch
 * (late-game modifier) and Durability (fatigue resistance). Several coaching upgrades and
 * consumables buy exactly these, so the shop is unreadable without them.
 *
 * Morale is deliberately left out: it's generated but nothing reads it yet (see PlayerHiddenTraits),
 * and showing an inert number as decision input would be worse than showing nothing.
 */
export function ScoutingPanel({ team, roster }: { team: Team; roster: Player[] }) {
  const { starters, bench } = splitRoster(team, roster)

  return (
    <>
      <ScoutingGroup label="Starting Five" players={starters} />
      <ScoutingGroup label="Bench" players={bench} />
    </>
  )
}
