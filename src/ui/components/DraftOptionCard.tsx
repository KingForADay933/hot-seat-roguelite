export function DraftOptionCard({
  label,
  description,
  selected,
  onSelect,
}: {
  label: string
  description: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button type="button" className={`draft-option${selected ? ' selected' : ''}`} onClick={onSelect}>
      <strong>{label}</strong>
      <p>{description}</p>
    </button>
  )
}
