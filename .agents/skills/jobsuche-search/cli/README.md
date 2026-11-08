# jobsuche-cli

CLI for searching jobs on the **Bundesagentur für Arbeit Jobsuche** (Germany's federal
job board, `arbeitsagentur.de/jobsuche`).

**Data source**: the public Jobsuche REST API (`pc/v6/jobs` search, `pc/v4/jobdetails` detail).
See `../url-reference.md`.
**Authentication**: none. The `X-API-Key: jobboerse-jobsuche` header is the API's fixed public client ID.
**Dependencies**: none (plain `bun` + `fetch`). `bun install` only pulls dev type definitions.

## Installation

```bash
cd .agents/skills/jobsuche-search/cli
bun install   # optional, only installs TypeScript dev types
```

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search for job listings (`--query` required) |
| `detail` | Fetch full detail for one posting by reference number or URL |

`search` accepts `--format json|table|plain` (default `json`). `detail` accepts `--format json|plain`.

```bash
bun run src/cli.ts search -q "Molekularbiologe" -l "Heidelberg" -r 50 --jobage 30 --format table
bun run src/cli.ts detail 10001-1003956881-S --format plain
bun run src/cli.ts --help
```

## Development

```bash
bun run typecheck   # tsc --noEmit
bun run test        # offline parsing tests + a small live smoke test
```

Errors go to stderr as `{ "error": "...", "code": "..." }` with exit code 1.
