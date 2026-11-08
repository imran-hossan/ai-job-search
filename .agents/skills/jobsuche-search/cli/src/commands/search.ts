import { PAGE_SIZE, SEARCH_URL, apiFetch, parseSearch, stripInvisible, writeError, type JobResult } from "../helpers.js"

export interface SearchOpts {
  query: string
  location?: string
  radius?: number
  jobage?: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

export function buildUrl(opts: SearchOpts): string {
  const params = new URLSearchParams()
  params.set("was", opts.query)
  if (opts.location) params.set("wo", opts.location)
  if (opts.location && opts.radius !== undefined) params.set("umkreis", String(opts.radius))
  if (opts.jobage !== undefined) params.set("veroeffentlichtseit", String(opts.jobage))
  params.set("angebotsart", "1") // 1 = Arbeit (regular employment); excludes apprenticeships/self-employment
  params.set("page", String(opts.page))
  params.set("size", String(PAGE_SIZE))
  return `${SEARCH_URL}?${params.toString()}`
}

function renderTable(rows: JobResult[]): string {
  if (rows.length === 0) return "No results."
  const w = Math.max(2, ...rows.map((r) => r.id.length))
  const header = `${"ID".padEnd(w)} ${"TITLE".padEnd(42)} ${"COMPANY".padEnd(28)} ${"LOCATION".padEnd(22)} DATE`
  const lines = rows.map(
    (r) =>
      `${r.id.padEnd(w)} ${r.title.slice(0, 42).padEnd(42)} ${(r.company || "—").slice(0, 28).padEnd(28)} ${(r.location || "—").slice(0, 22).padEnd(22)} ${r.date || "—"}`,
  )
  return [header, "-".repeat(header.length), ...lines].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const raw = await apiFetch(buildUrl(opts))
    const parsed = parseSearch(raw)
    let results = stripInvisible(parsed.results)
    if (opts.limit !== undefined) results = results.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(results) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        (results.length === 0
          ? "No results."
          : results
              .map((r) => `${r.title}\n  ${r.company || "—"} · ${r.location || "—"} · ${r.date || "—"}\n  id: ${r.id}\n  ${r.url}`)
              .join("\n\n")) + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify({ meta: { count: results.length, page: opts.page, total: parsed.total }, results }, null, 2) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
