import { useEffect, useState } from 'react'
import type { Player, PlayerId, Position, RotationPlan, RotationSegment, Team } from '../../data/types'
import { PERIOD_SECONDS } from '../../engine/constants'
import { POSITION_ORDER } from '../../engine/matchup'
import { clamp } from '../../engine/math'
import { slotSlideDistance } from '../../engine/positionFit'
import { MIN_ROTATION_SEGMENT_SECONDS } from '../../run/constants'
import { CHARTABLE_PERIODS, getSegments, mergeWithNext, moveBoundary, setSegmentFill, splitSegment } from '../../run/rotationChart'
import { chartedMinutesByPlayer, doubleBookedConflicts, projectedFatigueAtPeriodEnd } from '../../run/rotationChartValidation'
import { splitRoster } from '../rosterGroups'

function formatClock(seconds: number): string {
  const total = Math.round(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Last name only -- a segment as narrow as MIN_ROTATION_SEGMENT_SECONDS has room for little else. */
function shortLabel(player: Player | undefined): string {
  if (!player) return '?'
  const parts = player.name.split(' ')
  return parts[parts.length - 1]
}

interface Selection {
  period: number
  slot: Position
  index: number
}

function segmentKey(period: number, slot: Position, index: number): string {
  return `${period}-${slot}-${index}`
}

function TimelineBar({
  period,
  slot,
  segments,
  playersById,
  selection,
  onSelect,
  onDragBoundary,
  onDragBoundaryEnd,
}: {
  period: number
  slot: Position
  segments: RotationSegment[]
  playersById: Map<PlayerId, Player>
  selection: Selection | null
  onSelect: (selection: Selection) => void
  onDragBoundary: (period: number, slot: Position, boundaryIndex: number, seconds: number) => void
  onDragBoundaryEnd: () => void
}) {
  return (
    <div className="rotation-timeline">
      {segments.map((segment, index) => {
        const player = segment.fill.kind === 'player' ? playersById.get(segment.fill.playerId) : undefined
        const outOfPosition = player ? slotSlideDistance(player.positions[0], slot) > 0 : false
        const isSelected = selection?.period === period && selection.slot === slot && selection.index === index
        const left = (segment.startSeconds / PERIOD_SECONDS) * 100
        const width = ((segment.endSeconds - segment.startSeconds) / PERIOD_SECONDS) * 100

        return (
          <button
            type="button"
            key={segmentKey(period, slot, index)}
            className={[
              'rotation-segment',
              segment.fill.kind === 'auto' ? 'rotation-segment-auto' : '',
              isSelected ? 'rotation-segment-selected' : '',
              outOfPosition ? 'rotation-segment-out-of-position' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ left: `${left}%`, width: `${width}%` }}
            title={`${formatClock(segment.startSeconds)}-${formatClock(segment.endSeconds)}: ${player ? player.name : 'Auto'}${outOfPosition ? ` (charted at ${slot}, plays ${player!.positions[0]})` : ''}`}
            onClick={() => onSelect({ period, slot, index })}
          >
            {player ? shortLabel(player) : 'Auto'}
          </button>
        )
      })}
      {segments.slice(0, -1).map((segment, index) => (
        <div
          key={`boundary-${segmentKey(period, slot, index)}`}
          className="rotation-boundary"
          style={{ left: `${(segment.endSeconds / PERIOD_SECONDS) * 100}%` }}
          onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
          onPointerMove={(e) => {
            if (e.buttons === 0) return
            const bar = e.currentTarget.parentElement
            if (!bar) return
            const rect = bar.getBoundingClientRect()
            const fraction = clamp((e.clientX - rect.left) / rect.width, 0, 1)
            onDragBoundary(period, slot, index, fraction * PERIOD_SECONDS)
          }}
          onPointerUp={(e) => {
            e.currentTarget.releasePointerCapture(e.pointerId)
            onDragBoundaryEnd()
          }}
        />
      ))}
    </div>
  )
}

/**
 * The rotation chart itself (rotation-charts.md Phase G): five slot rows, Q1-Q4 columns, each cell a
 * draggable timeline of who's charted into that slot when. Supersedes nothing -- rotationMinutes
 * (RotationControls, elsewhere on this screen) stays the Auto-fallback target every un-charted span
 * (and every AI team) still runs on, per Phase F's decision to leave availability() reading minutes
 * rather than the chart.
 *
 * Edits are optimistic and local (`draft`) so a boundary drag redraws every frame without writing to
 * IndexedDB on every pixel of mouse movement; only pointerup persists. Every other action (fill
 * change, split, merge) is a single discrete edit and persists immediately, matching how
 * MinutesInput/TrainingFocusSelect behave elsewhere on this screen.
 */
export function RotationChartEditor({
  team,
  roster,
  playersById,
  onSetRotationPlan,
}: {
  team: Team
  roster: Player[]
  playersById: Map<PlayerId, Player>
  onSetRotationPlan: (plan: RotationPlan) => void
}) {
  const [draft, setDraft] = useState<RotationPlan | undefined>(team.rotationPlan)
  const [selection, setSelection] = useState<Selection | null>(null)

  // Resync when the persisted plan changes from outside this component (e.g. a fresh bundle load) --
  // but not on every keystroke of our own edits, which already flow through commit() below.
  useEffect(() => setDraft(team.rotationPlan), [team.rotationPlan])

  function commit(next: RotationPlan) {
    setDraft(next)
    onSetRotationPlan(next)
  }

  const { starters, bench } = splitRoster(team, roster)
  const draftTeam: Team = { ...team, rotationPlan: draft }
  const chartedMinutes = chartedMinutesByPlayer(draftTeam)
  const conflicts = doubleBookedConflicts(draftTeam)
  const fatigue = projectedFatigueAtPeriodEnd(draftTeam, playersById)

  const selectedSegment = selection ? getSegments(draft, selection.period, selection.slot)[selection.index] : null
  const selectedLength = selectedSegment ? selectedSegment.endSeconds - selectedSegment.startSeconds : 0
  const selectedSegmentCount = selection ? getSegments(draft, selection.period, selection.slot).length : 0

  return (
    <div>
      <p className="section-note">
        Click a span to assign it or change it. Drag the divider between two spans to move the
        boundary between them. Auto spans (and any AI team) still run on the fatigue/pace coach --
        this only takes over the spans you actually chart.
      </p>

      <div className="rotation-chart-periods">
        <div />
        {CHARTABLE_PERIODS.map((period) => (
          <div key={period} className="rotation-period-label">
            Q{period}
          </div>
        ))}
      </div>
      {POSITION_ORDER.map((slot) => (
        <div key={slot} className="rotation-chart-row">
          <div className="rotation-slot-label">{slot}</div>
          {CHARTABLE_PERIODS.map((period) => (
            <TimelineBar
              key={period}
              period={period}
              slot={slot}
              segments={getSegments(draft, period, slot)}
              playersById={playersById}
              selection={selection}
              onSelect={setSelection}
              onDragBoundary={(p, s, boundaryIndex, seconds) => setDraft(moveBoundary(draft, p, s, boundaryIndex, seconds))}
              onDragBoundaryEnd={() => draft !== undefined && onSetRotationPlan(draft)}
            />
          ))}
        </div>
      ))}

      {selection && selectedSegment && (
        <div className="team-summary rotation-segment-editor">
          <strong>
            Q{selection.period} {selection.slot}, {formatClock(selectedSegment.startSeconds)}-{formatClock(selectedSegment.endSeconds)}
          </strong>
          <label>
            Assign to
            <select
              value={selectedSegment.fill.kind === 'auto' ? 'auto' : selectedSegment.fill.playerId}
              onChange={(e) => {
                const value = e.target.value
                const fill: RotationSegment['fill'] = value === 'auto' ? { kind: 'auto' } : { kind: 'player', playerId: value }
                commit(setSegmentFill(draft, selection.period, selection.slot, selection.index, fill))
              }}
            >
              <option value="auto">Auto (coach's call)</option>
              <optgroup label="Starting Five">
                {starters.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.positions[0]} {p.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Bench">
                {bench.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.positions[0]} {p.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <div className="stretch-actions">
            <button
              type="button"
              disabled={selectedLength < 2 * MIN_ROTATION_SEGMENT_SECONDS}
              onClick={() => commit(splitSegment(draft, selection.period, selection.slot, selection.index))}
            >
              Split in two
            </button>
            <button
              type="button"
              disabled={selection.index === 0}
              onClick={() => {
                commit(mergeWithNext(draft, selection.period, selection.slot, selection.index - 1))
                setSelection({ ...selection, index: selection.index - 1 })
              }}
            >
              Merge with previous
            </button>
            <button
              type="button"
              disabled={selection.index >= selectedSegmentCount - 1}
              onClick={() => commit(mergeWithNext(draft, selection.period, selection.slot, selection.index))}
            >
              Merge with next
            </button>
            <button type="button" className="link-button" onClick={() => setSelection(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      {(chartedMinutes.size > 0 || conflicts.length > 0) && (
        <div className="team-summary">
          <h3>Chart Summary</h3>
          {conflicts.length > 0 && (
            <p className="text-negative">
              {conflicts.length} double-booked conflict{conflicts.length === 1 ? '' : 's'}: e.g.{' '}
              {playersById.get(conflicts[0].playerId)?.name ?? conflicts[0].playerId} is charted at both{' '}
              {conflicts[0].slots.join(' and ')} during Q{conflicts[0].period} from {formatClock(conflicts[0].overlapStartSeconds)} to{' '}
              {formatClock(conflicts[0].overlapEndSeconds)}.
            </p>
          )}
          {chartedMinutes.size > 0 && (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Player</th>
                    <th className="numeric">Charted Min</th>
                    <th className="numeric">Q1 Fatigue</th>
                    <th className="numeric">Q2 Fatigue</th>
                    <th className="numeric">Q3 Fatigue</th>
                    <th className="numeric">Q4 Fatigue</th>
                  </tr>
                </thead>
                <tbody>
                  {[...chartedMinutes.entries()].map(([playerId, minutes]) => {
                    const trajectory = fatigue.get(playerId) ?? []
                    return (
                      <tr key={playerId}>
                        <td>{playersById.get(playerId)?.name ?? playerId}</td>
                        <td className="numeric">{minutes.toFixed(1)}</td>
                        {[0, 1, 2, 3].map((i) => (
                          <td key={i} className={`numeric${(trajectory[i] ?? 0) >= 80 ? ' text-negative' : ''}`}>
                            {trajectory[i] ?? '--'}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="section-note">
            Fatigue assumes every un-charted second for a charted player is bench time -- a real game
            may play them more than that during their Auto spans, so this reads as a floor, not a
            guarantee.
          </p>
        </div>
      )}
    </div>
  )
}
