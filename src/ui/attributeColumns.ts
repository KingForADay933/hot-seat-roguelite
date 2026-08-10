import type { AttributeKey } from '../data/types'

/**
 * `label` is the column abbreviation every dense table uses; `long` is the same attribute written out
 * for prose. Both are needed because the two read badly in each other's place -- a ten-column roster
 * header has no room for "Lateral Quickness", and "Best on the floor at LAT" is not a sentence.
 */
export const ATTRIBUTE_COLUMNS: { key: AttributeKey; label: string; long: string }[] = [
  { key: 'insideShot', label: 'INS', long: 'Inside Shot' },
  { key: 'outsideShot', label: 'OUT', long: 'Outside Shot' },
  { key: 'passing', label: 'PAS', long: 'Passing' },
  { key: 'ballHandling', label: 'BH', long: 'Ball Handling' },
  { key: 'rebounding', label: 'REB', long: 'Rebounding' },
  { key: 'perimeterDefense', label: 'PD', long: 'Perimeter Defense' },
  { key: 'interiorDefense', label: 'ID', long: 'Interior Defense' },
  { key: 'speed', label: 'SPD', long: 'Speed' },
  { key: 'lateralQuickness', label: 'LAT', long: 'Lateral Quickness' },
  { key: 'vertical', label: 'VERT', long: 'Vertical' },
]
