type Props = {
  value: string
  onChange(seed: string): void
  onRandomize(): void
}

/**
 * Seed input — always visible (idea.md requires displaying the seed) with a
 * randomize action and the reproducibility hint.
 */
export function SeedField({ value, onChange, onRandomize }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Seed"
          spellCheck={false}
          className="w-56 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={onRandomize}
          className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
        >
          Randomize
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Same seed + settings = same scenario.
      </p>
    </div>
  )
}
