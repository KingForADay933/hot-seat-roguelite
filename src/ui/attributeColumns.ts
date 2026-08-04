import type { AttributeKey } from '../data/types'

export const ATTRIBUTE_COLUMNS: { key: AttributeKey; label: string }[] = [
  { key: 'insideShot', label: 'INS' },
  { key: 'outsideShot', label: 'OUT' },
  { key: 'passing', label: 'PAS' },
  { key: 'ballHandling', label: 'BH' },
  { key: 'rebounding', label: 'REB' },
  { key: 'perimeterDefense', label: 'PD' },
  { key: 'interiorDefense', label: 'ID' },
  { key: 'speed', label: 'SPD' },
  { key: 'lateralQuickness', label: 'LAT' },
  { key: 'vertical', label: 'VERT' },
]
