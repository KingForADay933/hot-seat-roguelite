# Working on Hot Seat

## Verifying a change

Run all three. They catch different things and none of them subsumes another:

```
npm test -- --run
npm run typecheck
npm run lint
```

### `npx tsc --noEmit` does not work here — use `npm run typecheck`

The root `tsconfig.json` is a solution-style file: `"files": []` plus references to
`tsconfig.app.json` and `tsconfig.node.json`. `tsc --noEmit` therefore type-checks an **empty file
list**, prints nothing, and exits 0 — indistinguishable from success, on a codebase it never looked
at.

This is not hypothetical. It let two type errors reach master (an unimported `TeamId`, an unused
parameter caught by `noUnusedParameters`), which broke `npm run build` and failed the Pages deploy
for commit `19ff058`.

`npm run typecheck` runs `tsc -b --force`, which follows the project references and actually checks
`src`. `--force` because build mode caches results in `node_modules/.tmp/*.tsbuildinfo` and will
happily report nothing on an unchanged-looking tree.

### The test suite will not catch a type error

Vitest transforms TypeScript by stripping types without checking them, so a missing type import or a
bad annotation passes 556 green tests. Tests prove behaviour; only the typecheck proves types.

### Some checks are stricter than others

`tsconfig.app.json` sets `noUnusedLocals` and `noUnusedParameters`. An unused function parameter is
an error here, not a warning — prefer removing it to silencing it, since a parameter nothing reads
is usually a sign the function's shape is wrong.

## Verifying in the browser

Anything a GM can see should be exercised in the running app before it ships, not just unit-tested.
Several bugs this codebase has hit were invisible to tests and obvious on screen within seconds — a
minutes input rendering `min=20 max=16`, a checkpoint listing the same insight eight times, a
fractional `max` attribute. If a change is observable, open it.

## Releasing

See `docs/releasing-to-itch.md`. In short: `npm run package:itch`, upload `hot-seat-itch.zip`.
Do not zip the working folder — that is `node_modules`, and itch rejects it.
