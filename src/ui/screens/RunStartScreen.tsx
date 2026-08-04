export function RunStartScreen({ onStart }: { onStart: () => void }) {
  return (
    <main>
      <h1>Hot Seat</h1>
      <p>
        You&apos;re taking over the worst team in the league. Three seasons to finish top-half of standings or
        you&apos;re fired. Clear it, and the bar rises.
      </p>
      <button className="primary" onClick={onStart}>
        Start New Run
      </button>
    </main>
  )
}
