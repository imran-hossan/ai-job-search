# stellenanzeigen-cli

CLI for searching jobs on **stellenanzeigen.de** (Germany).

**Data source**: the site's public pages. Search reads the job list embedded in the Next.js payload of
`/suche/`, and detail reads the schema.org `JobPosting` JSON-LD on `/job/<slug>-<id>/`. See `../url-reference.md`.
**Authentication**: none.
**Dependencies**: none (plain `bun` + `fetch` + regex/JSON parsing). `bun install` only pulls dev type definitions.

## Installation

```bash
cd .agents/skills/stellenanzeigen-search/cli
bun install   # optional, only installs TypeScript dev types
```

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search for job listings (`--query` required; exact matches unless `--similar`) |
| `detail` | Fetch full detail for one posting by id or URL |

`search` accepts `--format json|table|plain` (default `json`). `detail` accepts `--format json|plain`.

```bash
bun run src/cli.ts search -q "Molekularbiologe" --format table
bun run src/cli.ts search -q "Biologe" -l "Heidelberg" -r 50 --jobage 30 --format table
bun run src/cli.ts detail SDE-129508 --format plain
bun run src/cli.ts --help
```

## Development

```bash
bun run typecheck   # tsc --noEmit
bun run test        # offline fixture tests + a small live smoke test
```

Errors go to stderr as `{ "error": "...", "code": "..." }` with exit code 1.
