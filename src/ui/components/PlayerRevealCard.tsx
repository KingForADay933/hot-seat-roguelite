import type { Player } from '../../data/types'
import { ATTRIBUTE_COLUMNS } from '../attributeColumns'
import { attributeExtremes, growthHeadroom, playerTags } from '../playerTags'

/** 74 -> 6'2". Height is generated but has never been shown anywhere until this screen. */
function formatHeight(inches: number): string {
  return `${Math.floor(inches / 12)}'${inches % 12}"`
}

/** Attribute cells are tinted rather than numbered-only so a 13-player wall of numbers still reads
 *  at a glance. Thresholds are display bands only -- the sim reads the raw values. */
function attributeTone(value: number): string {
  if (value >= 80) return ' attr-elite'
  if (value >= 68) return ' attr-good'
  if (value <= 45) return ' attr-weak'
  return ''
}

/** Affinity is signed and centered on 0, so the sign carries the meaning -- anything inside a
 *  point of neutral is noise and stays uncoloured rather than implying a lean that isn't there. */
function affinityTone(affinity: number): string {
  if (affinity >= AFFINITY_NOTABLE) return ' text-positive'
  if (affinity <= -AFFINITY_NOTABLE) return ' text-negative'
  return ''
}

const AFFINITY_NOTABLE = 1.5

function formatAffinity(affinity: number): string {
  const rounded = Math.round(affinity)
  return rounded > 0 ? `+${rounded}` : `${rounded}`
}

export interface SystemFitEntry {
  systemId: string
  name: string
  /** Signed system affinity -- see run/variation/systemDraft.ts's computePlayerSystemAffinity. */
  affinity: number
  /** Projected share of the team's offense under this system, 0-1, or null before one is picked.
   *  Only shown for the selected system: touch share is a property of the system you actually run,
   *  and listing four of them per player would bury the signal. */
  usageShare: number | null
}

/**
 * One roster player's full scouting readout: identity, every attribute, the derived trait tags
 * (see ui/playerTags.ts), growth headroom, and -- while the system is still being drafted -- how
 * he fits each candidate system. `systemFits` is empty once a system is locked in, which collapses
 * the card to the pure scouting view.
 */
export function PlayerRevealCard({
  player,
  systemFits,
  selectedSystemId,
  starter,
}: {
  player: Player
  systemFits: SystemFitEntry[]
  selectedSystemId: string | null
  starter: boolean
}) {
  const tags = playerTags(player)
  const { best, worst } = attributeExtremes(player)
  const headroom = growthHeadroom(player)
  const selectedUsageShare = systemFits.find((entry) => entry.systemId === selectedSystemId)?.usageShare ?? null

  return (
    <div className="player-card">
      <div className="player-card-head">
        <span className="player-card-name">
          <span className="player-pos">{player.positions[0]}</span> {player.name}
          {starter && <span className="starter-pip" title="Opening-night starter" />}
        </span>
        <span className="player-card-meta">
          {player.age}y &middot; {formatHeight(player.heightInches)} &middot; #{player.jerseyNumber}
        </span>
        <span className="player-card-ovr">{player.overallRating}</span>
      </div>

      <div className="attr-grid">
        {ATTRIBUTE_COLUMNS.map((col) => (
          <span key={col.key} className={`attr-cell${attributeTone(player.attributes[col.key])}`}>
            <span className="attr-key">{col.label}</span>
            <span className="attr-value">{player.attributes[col.key]}</span>
          </span>
        ))}
      </div>

      <p className="player-card-line">
        Best: <strong>{best.label} {best.value}</strong> &middot; Weakest: <strong>{worst.label} {worst.value}</strong> &middot; Growth room:{' '}
        <strong>{headroom}</strong> pts
        {selectedUsageShare !== null && (
          <>
            {' '}
            &middot; Touches:{' '}
            <strong title="Projected share of the team's offensive possessions he'd run under the selected system, using the same selection weighting the game simulation uses.">
              {(selectedUsageShare * 100).toFixed(1)}%
            </strong>
          </>
        )}
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

      {systemFits.length > 0 && (
        <p className="player-card-line player-card-fits">
          System fit:{' '}
          {systemFits.map((entry, i) => (
            <span key={entry.systemId}>
              {i > 0 && ' · '}
              <span className={entry.systemId === selectedSystemId ? 'fit-selected' : undefined}>
                {entry.name}{' '}
                <strong className={affinityTone(entry.affinity)} title={`${entry.name} suits him ${formatAffinity(entry.affinity)} versus an even play-call mix.`}>
                  {formatAffinity(entry.affinity)}
                </strong>
              </span>
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
