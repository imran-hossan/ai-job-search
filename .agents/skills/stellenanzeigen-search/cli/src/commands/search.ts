import { SEARCH_URL, hasSearchPayload, htmlFetch, parseSearch, stripInvisible, writeError, type JobResult } from "../helpers.js"

export interface SearchOpts {
  query: string
  location?: string
  radius?: number
  jobage?: number
  page: number
  limit?: number
  similar: boolean
  format: "json" | "table" | "plain"
}

export function buildUrl(opts: SearchOpts): string {
  const params = new URLSearchParams()
  params.set("fulltext", opts.query)
  if (opts.location) params.set("locationIds", opts.location)
  if (opts.location && opts.radius !== undefined) params.set("perimeterRadius", String(opts.radius))
  if (opts.jobage !== undefined) params.set("onlyAdsOnlineForDays", String(opts.jobage))
  if (opts.page > 1) params.set("page", String(opts.page))
  return `${SEARCH_URL}?${params.toString()}`
}

function renderTable(rows: JobResult[]): string {
  if (rows.length === 0) return "No results."
  const w = Math.max(2, ...rows.map((r) => r.id.length))
  const header = `${"ID".padEnd(w)} ${"TITLE".padEnd(44)} ${"COMPANY".padEnd(28)} ${"LOCATION".padEnd(22)} DATE`
  const lines = rows.map(
    (r) =>
      `${r.id.padEnd(w)} ${((r.relevant ? "" : "~ ") + r.title).slice(0, 44).padEnd(44)} ${(r.company || "—").slice(0, 28).padEnd(28)} ${(r.location || "—").slice(0, 22).padEnd(22)} ${r.date || "—"}`,
  )
  return [header, "-".repeat(header.length), ...lines].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const html = await htmlFetch(buildUrl(opts))
    if (!html || !hasSearchPayload(html)) {
      // A 200 page without the embedded search data means the markup changed;
      // reporting "0 results" would hide that.
      writeError("search page did not contain the expected job data (site markup may have changed; see url-reference.md)", "PARSE_FAILED")
      return 1
    }
    const page = parseSearch(html)
    let results = stripInvisible(page.results)
    if (!opts.similar) results = results.filter((r) => r.relevant)
    if (opts.limit !== undefined) results = results.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(results) + (opts.similar ? "\n(~ = similar listing, not an exact keyword match)" : "") + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        (results.length === 0
          ? "No results."
          : results
              .map(
                (r) =>
                  `${r.relevant ? "" : "[similar] "}${r.title}\n  ${r.company || "—"} · ${r.location || "—"} · ${r.date || "—"}${r.deadline ? ` · bis ${r.deadline}` : ""}\n  id: ${r.id}\n  ${r.url}`,
              )
              .join("\n\n")) + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          { meta: { count: results.length, page: opts.page, total: page.total, totalWithSimilar: page.totalWithSimilar }, results },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
