#!/usr/bin/env bun
// Self-contained CLI for searching jobs on the Bundesagentur für Arbeit
// Jobsuche (Germany's federal job board, arbeitsagentur.de/jobsuche) via its
// public JSON API. No external CLI framework and zero runtime dependencies.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"
import { writeError } from "./helpers.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", l: "location", n: "limit", r: "radius" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const HELP = `jobsuche-cli — search jobs on the Bundesagentur für Arbeit Jobsuche (Germany)

USAGE
  bun run src/cli.ts search --query "<text>" [flags]
  bun run src/cli.ts detail <refnr|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords: job title, occupation or skill. REQUIRED.
                          German terms match far better ("Molekularbiologe" vs "molecular biologist").
  --location, -l <text>   City or postcode, e.g. "Berlin", "München", "69120".
  --radius, -r <km>       Radius around --location in km (e.g. 10, 25, 50, 100).
  --jobage <days>         Published within the last N days (1-100).
  --page <n>              1-indexed page (25 results/page). Default 1.
  --limit, -n <n>         Cap results emitted (client-side).
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "Molekularbiologe" --format table
  bun run src/cli.ts search -q "Biologe" -l "Heidelberg" -r 50 --jobage 14 --format table
  bun run src/cli.ts search -q "Data Scientist" -l "Berlin" --format table
  bun run src/cli.ts detail 10001-1003956881-S --format plain
`

const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set(["query", "location", "radius", "jobage", "page", "limit", "format", "help", "h"]),
  detail: new Set(["format", "help", "h"]),
}

function intFlag(name: string, raw: string | boolean | string[], min: number, max?: number): number | null {
  // Number(), not parseInt(): parseInt truncates "0.5" to 0 and accepts "7days".
  const val = typeof raw === "string" ? Number(raw.trim()) : NaN
  if (!Number.isInteger(val) || val < min || (max !== undefined && val > max)) {
    const range = max !== undefined ? `between ${min} and ${max}` : `of at least ${min}`
    writeError(`--${name} must be a whole number ${range}, got "${raw}"`, "BAD_ARG")
    return null
  }
  return val
}

async function main(): Promise<number> {
  const flags = parseFlags(process.argv.slice(2))
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  // Unknown flags are rejected, never silently ignored: a dropped filter
  // changes what the search returns with no error.
  const known = KNOWN_FLAGS[cmd]
  if (known) {
    for (const key of Object.keys(flags)) {
      if (key === "_" || known.has(key)) continue
      writeError(`unknown flag --${key} for '${cmd}'; see --help for the supported flags`, "UNKNOWN_FLAG")
      return 1
    }
  }

  if (cmd === "search") {
    if (typeof flags.query !== "string" || !flags.query.trim()) {
      writeError('the --query/-q flag is required and must be non-empty (e.g. -q "Molekularbiologe")', "NO_QUERY")
      return 1
    }
    if (flags.location !== undefined && (typeof flags.location !== "string" || !flags.location.trim())) {
      writeError("--location requires a non-empty value", "BAD_ARG")
      return 1
    }
    const fmt = flags.format !== undefined ? String(flags.format) : "json"
    if (!["json", "table", "plain"].includes(fmt)) {
      writeError(`--format must be one of json|table|plain, got "${fmt}"`, "BAD_ARG")
      return 1
    }
    if (flags.radius !== undefined && flags.location === undefined) {
      writeError("--radius needs --location (it is the distance around that place)", "BAD_ARG")
      return 1
    }

    let radius: number | undefined
    let jobage: number | undefined
    let page = 1
    let limit: number | undefined
    if (flags.radius !== undefined) {
      const v = intFlag("radius", flags.radius, 0, 200)
      if (v === null) return 1
      radius = v
    }
    if (flags.jobage !== undefined) {
      const v = intFlag("jobage", flags.jobage, 1, 100)
      if (v === null) return 1
      jobage = v
    }
    if (flags.page !== undefined) {
      const v = intFlag("page", flags.page, 1)
      if (v === null) return 1
      page = v
    }
    if (flags.limit !== undefined) {
      const v = intFlag("limit", flags.limit, 1)
      if (v === null) return 1
      limit = v
    }

    const opts: SearchOpts = {
      query: flags.query.trim(),
      location: typeof flags.location === "string" ? flags.location.trim() : undefined,
      radius,
      jobage,
      page,
      limit,
      format: fmt as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) {
      writeError("detail requires a <refnr|url>", "NO_ID")
      return 1
    }
    const fmt = flags.format !== undefined ? String(flags.format) : "json"
    if (!["json", "plain"].includes(fmt)) {
      writeError(`--format must be one of json|plain, got "${fmt}"`, "BAD_ARG")
      return 1
    }
    const opts: DetailOpts = { id, format: fmt as DetailOpts["format"] }
    return runDetail(opts)
  }

  writeError(`Unknown command "${cmd}"`, "BAD_CMD")
  return 1
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    writeError(e instanceof Error ? e.message : String(e), "INTERNAL_ERROR")
    process.exit(1)
  })
