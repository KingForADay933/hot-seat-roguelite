import { DEFENSIVE_SCHEMES, OFFENSIVE_PLAYBOOKS } from '../../data/presets'
import type { RunBundle } from '../../data/persistence/runRepository'
import type { Player, TeamId } from '../../data/types'
import { computeStandings, headToHeadRecord } from '../../engine/schedule/standings'
import { formatHeight } from '../playerDisplay'
import { scoutingTags } from '../playerTags'
import { splitRoster } from '../rosterGroups'
import { PlayerName } from '../components/PlayerName'
import { TeamSummary } from '../components/TeamSummary'
import { TeamSwatch } from '../components/TeamSwatch'

/** One roster row: who he is and what he is, with no attribute column anywhere on it. */
function ScoutRow({ player }: { player: Player }) {
  const tags = scoutingTags(player)
  return (
    <tr>
      <td>{player.positions[0]}</td>
      <td>
        <PlayerName playerId={player.id} name={player.name} />
      </td>
      <td className="numeric">{player.age}</td>
      <td className="numeric">{formatHeight(player.heightInches)}</td>
      <td>
        {tags.length > 0 ? (
          <div className="tag-row scout-tag-row">
            {tags.map((tag) => (
              <span key={tag.label} className={`tag tag-${tag.tone}`} title={tag.detail}>
                {tag.label}
              </span>
            ))}
          </div>
        ) : (
          'Nothing stands out.'
        )}
      </td>
    </tr>
  )
}

/** Each group gets its own heading and table, the shape RosterDetailPanel already uses on My Team. */
function RosterGroup({ label, players }: { label: string; players: Player[] }) {
  if (players.length === 0) return null

  return (
    <>
      <h3>{label}</h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Pos</th>
              <th>Player</th>
              <th className="numeric">Age</th>
              <th className="numeric">Ht</th>
              <th>Scouting Notes</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <ScoutRow key={player.id} player={player} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

/**
 * A scouting report on somebody else's team: what they run, who they start, and what kind of
 * players those are.
 *
 * Deliberately not the full attribute sheet (m3-tactical-axis.md, D3). Full visibility would turn
 * every game into homework and sits badly against synergy being a hidden property of your *own*
 * roster -- so this shows the offensive system, the defensive scheme, the starting five, and each
 * player's qualitative tags, which is enough to make a real plan without making optimal play a
 * spreadsheet exercise. Group averages are the one aggregate read that stays, via the same
 * TeamSummary My Team uses: how big and how skilled a team is on the whole is exactly the read a
 * tactical choice is made against, and it says nothing about any individual.
 *
 * Reachable for the GM's own team too, from their row in the standings. It shows the same reduced
 * view there, which is correct rather than a gap -- My Team is one click away and is the screen that
 * knows everything, so duplicating it here would mean two places to maintain the same sheet.
 */
export function TeamScoutScreen({ bundle, teamId, onBack }: { bundle: RunBundle; teamId: TeamId; onBack: () => void }) {
  const { run, teams, players, games } = bundle

  const team = teams.find((t) => t.id === teamId)
  if (!team) return null

  const roster = players.filter((p) => p.teamId === team.id)
  const { starters, bench } = splitRoster(team, roster)
  const offense = OFFENSIVE_PLAYBOOKS[team.offensiveStrategyId]
  const defense = DEFENSIVE_SCHEMES[team.defensiveStrategyId]

  const standings = computeStandings(teams, games)
  const record = standings.find((row) => row.teamId === team.id)
  const rank = standings.findIndex((row) => row.teamId === team.id) + 1

  const isUserTeam = team.id === run.teamId
  const series = isUserTeam ? null : headToHeadRecord(games, run.teamId, team.id)
  const seriesPlayed = series ? series.wins + series.losses : 0

  return (
    <main>
      <h1>
        <TeamSwatch team={team} />
        {team.city} {team.name}
      </h1>
      <p>
        Scouting report{isUserTeam && ' — your own team, seen the way the rest of the league sees it'}.
        {rank > 0 && ` Currently ${rank} of ${standings.length} in the standings.`}
      </p>

      <div className="team-summary">
        <p>
          <strong>Offense: {offense?.name ?? team.offensiveStrategyId}</strong>
          {offense && ` -- ${offense.description}`}
        </p>
        <p>
          <strong>Defense: {defense?.name ?? team.defensiveStrategyId}</strong>
          {defense && ` -- ${defense.description}`}
        </p>
        {series && (
          <p>
            <strong>Season series:</strong>{' '}
            {seriesPlayed === 0 ? (
              'Not played yet.'
            ) : (
              <span className={series.wins > series.losses ? 'text-positive' : series.wins < series.losses ? 'text-negative' : undefined}>
                {series.wins > series.losses ? 'You lead' : series.wins < series.losses ? 'You trail' : 'Split'} {series.wins}-
                {series.losses}
              </span>
            )}
          </p>
        )}
      </div>

      <h2>Season Averages</h2>
      <TeamSummary team={team} roster={roster} record={record} />

      <h2>Roster</h2>
      <p>
        Tags and roles only — the attribute sheet stays private to whoever employs them. Averages above are the aggregate read;
        click a name for what is publicly known about him.
      </p>
      <RosterGroup label="Starting Five" players={starters} />
      <RosterGroup label="Bench" players={bench} />

      <button className="primary" onClick={onBack}>
        Back
      </button>
    </main>
  )
}
