import type { Player, PlayerId } from '../../data/types'
import type { RunBundle } from '../../data/persistence/runRepository'
import { aggregateSeasonTotals, type SeasonTotals } from '../../engine/boxScore'
import { ATTRIBUTE_COLUMNS } from '../attributeColumns'
import { AGE_CURVE_LABELS, attributeLabel, currentTrainingFocus, formatHeight, TENDENCY_LABELS } from '../playerDisplay'
import { playerTags, scoutingTags } from '../playerTags'
import { ScreenActions } from '../components/ScreenActions'

/** Per-game average, or a dash when he hasn't played -- "0.0" would imply he played and scored none. */
function perGame(total: number, gamesPlayed: number): string {
  return gamesPlayed > 0 ? (total / gamesPlayed).toFixed(1) : '—'
}

/** Made-attempted plus a percentage, the way a real player page quotes a split. */
function shootingSplit(made: number, attempted: number, gamesPlayed: number): string {
  if (gamesPlayed === 0 || attempted === 0) return '—'
  return `${perGame(made, gamesPlayed)}-${perGame(attempted, gamesPlayed)} (${Math.round((made / attempted) * 100)}%)`
}

/** Same display bands the reveal card uses, so an attribute reads the same colour everywhere. */
function attributeTone(value: number): string {
  if (value >= 80) return ' attr-elite'
  if (value >= 68) return ' attr-good'
  if (value <= 45) return ' attr-weak'
  return ''
}

function SeasonLine({ totals }: { totals: SeasonTotals }) {
  const gp = totals.gamesPlayed
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th className="numeric">GP</th>
            <th className="numeric">MIN</th>
            <th className="numeric">PTS</th>
            <th className="numeric">FG</th>
            <th className="numeric">3P</th>
            <th className="numeric">FT</th>
            <th className="numeric">AST</th>
            <th className="numeric">REB</th>
            <th className="numeric">STL</th>
            <th className="numeric">BLK</th>
            <th className="numeric">TO</th>
            <th className="numeric">PF</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="numeric">{gp}</td>
            <td className="numeric">{perGame(totals.minutesPlayed, gp)}</td>
            <td className="numeric">{perGame(totals.points, gp)}</td>
            <td className="numeric">{shootingSplit(totals.fieldGoalsMade, totals.fieldGoalsAttempted, gp)}</td>
            <td className="numeric">{shootingSplit(totals.threePointersMade, totals.threePointersAttempted, gp)}</td>
            <td className="numeric">{shootingSplit(totals.freeThrowsMade, totals.freeThrowsAttempted, gp)}</td>
            <td className="numeric">{perGame(totals.assists, gp)}</td>
            <td className="numeric">{perGame(totals.rebounds, gp)}</td>
            <td className="numeric">{perGame(totals.steals, gp)}</td>
            <td className="numeric">{perGame(totals.blocks, gp)}</td>
            <td className="numeric">{perGame(totals.turnovers, gp)}</td>
            <td className="numeric">{perGame(totals.fouls, gp)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/**
 * One player, everything the GM is allowed to know about him.
 *
 * Consolidates what was previously spread across three panels on My Team -- attributes and growth
 * headroom in the roster sheet, intangibles in the scouting table, minutes and training focus in the
 * rotation controls -- plus this season's box-score averages, which weren't shown per player
 * anywhere. The point of a detail page is that "who is this guy" is answerable in one place rather
 * than by scrolling between three tables and holding a name in your head.
 *
 * Read-only by design. Every editable thing about a player (minutes, training focus, his place in
 * the rotation chart) already has a home on My Team where it sits next to its peers, and moving one
 * copy of those controls here would mean two places to change the same value.
 *
 * Renders a reduced version for a player on somebody else's roster (m3-tactical-axis.md, D3): the
 * attribute table and the hidden-rating block are for the GM who employs him. Scouting reports link
 * here for every player in the league, so without the split this page would quietly reinstate the
 * full-sheet visibility D3 rules out -- and would hand over consistency, clutch and durability,
 * which are hidden even on your own attribute sheet. What stays is what the league can see: who he
 * is, his qualitative tags, and his box-score line.
 */
export function PlayerScreen({
  bundle,
  playerId,
  onBack,
}: {
  bundle: RunBundle
  playerId: PlayerId
  onBack: () => void
}) {
  const { run, teams, players, games } = bundle
  const player: Player | undefined = players.find((p) => p.id === playerId)
  if (!player) return null

  const team = teams.find((t) => t.id === player.teamId)
  const isUserTeam = player.teamId === run.teamId
  const userTeam = teams.find((t) => t.id === run.teamId)
  const isStarter = team?.startingFive.includes(player.id) ?? false
  const tags = isUserTeam ? playerTags(player) : scoutingTags(player)
  const totals = aggregateSeasonTotals(games).get(player.id)

  // Rotation role only means anything for the GM's own players -- an opponent's minutes aren't
  // something they set, and their training focus isn't something they'd know.
  const minutes = isUserTeam && userTeam ? Math.round(userTeam.rotationMinutes[player.id] ?? 0) : null
  const focus = isUserTeam && userTeam ? currentTrainingFocus(userTeam, player.id) : null

  return (
    <main>
      <ScreenActions>
        <button className="primary" onClick={onBack}>
          Back
        </button>
      </ScreenActions>

      <h1>
        <span className="player-pos">{player.positions[0]}</span> {player.name}
      </h1>
      <p>
        {player.age}y · {formatHeight(player.heightInches)} · #{player.jerseyNumber}
        {/* Overall is a display-only summary the sim is barred from reading, but it is still the
            one number that ranks a roster at a glance -- exactly the homework D3 rules out for
            somebody else's players. Their aggregate strength stays readable through the scouting
            report's group averages. */}
        {isUserTeam && ` · Overall ${player.overallRating}`}
        {team && ` · ${team.city} ${team.name}`}
        {` · ${isStarter ? 'Starter' : 'Bench'}`}
      </p>

      {tags.length > 0 && (
        <div className="tag-row">
          {tags.map((tag) => (
            <span key={tag.label} className={`tag tag-${tag.tone}`} title={tag.detail}>
              {tag.label}
            </span>
          ))}
        </div>
      )}

      {isUserTeam ? (
        <>
          <h2>Attributes</h2>
          <p>
            Current rating, and the ceiling he can still grow toward. A green <span className="headroom">+N</span> is room left
            before that fixed potential — the number season-end development actually works against.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Attribute</th>
                  <th className="numeric">Now</th>
                  <th className="numeric">Potential</th>
                  <th className="numeric">Room</th>
                </tr>
              </thead>
              <tbody>
                {ATTRIBUTE_COLUMNS.map((col) => {
                  const now = Math.round(player.attributes[col.key])
                  const potential = Math.round(player.development.potential[col.key])
                  const room = Math.max(0, potential - now)
                  return (
                    <tr key={col.key}>
                      <td>{col.label}</td>
                      <td className={`numeric${attributeTone(now)}`}>{now}</td>
                      <td className="numeric">{potential}</td>
                      <td className="numeric">{room > 0 ? <span className="headroom">+{room}</span> : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <h2>Scouting</h2>
          <p>Ratings the simulation reads that never appear in the attribute sheet.</p>
          <div className="team-summary">
            <p>
              <strong>Age curve:</strong> {AGE_CURVE_LABELS[player.development.ageCurveStage]} ·{' '}
              <strong>DP last season:</strong>{' '}
              <span className={player.development.developmentPoints < 0 ? 'text-negative' : undefined}>
                {player.development.developmentPoints.toFixed(1)}
              </span>
            </p>
            <p>
              <strong>Consistency:</strong> {Math.round(player.hidden.consistency)} — night-to-night variance ·{' '}
              <strong>Clutch:</strong> {Math.round(player.hidden.clutch)} — late-game modifier ·{' '}
              <strong>Durability:</strong> {Math.round(player.hidden.durability)} — fatigue resistance
            </p>
            <p>
              <strong>Tendency:</strong> {TENDENCY_LABELS[player.hidden.tendency]}
            </p>
          </div>
        </>
      ) : (
        <p>
          {team ? `${team.city} ${team.name} keep` : 'His team keeps'} his attribute sheet to themselves — what you get is what
          the league can see: the tags above, and what he has actually produced on the floor.
        </p>
      )}

      {isUserTeam && (
        <>
          <h2>Rotation Role</h2>
          <div className="team-summary">
            <p>
              <strong>Target minutes:</strong> {minutes} · <strong>Training focus:</strong>{' '}
              {focus ? attributeLabel(focus) : 'Auto (spread by gap to potential)'}
            </p>
            <p>Both are set on the My Team screen, alongside the rest of the roster.</p>
          </div>
        </>
      )}

      <h2>This Season</h2>
      {totals && totals.gamesPlayed > 0 ? (
        <SeasonLine totals={totals} />
      ) : (
        <p>No games played yet this season.</p>
      )}

    </main>
  )
}
