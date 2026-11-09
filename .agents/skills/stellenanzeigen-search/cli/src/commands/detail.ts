import { htmlFetch, normalizeId, parseDetail, stripInvisible, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const ref = normalizeId(opts.id)
  if (!ref) {
    writeError(
      `Could not parse a stellenanzeigen.de job id from "${opts.id}" (expected e.g. SDE-129508, 16417754 or a stellenanzeigen.de/job/... URL)`,
      "BAD_ID",
    )
    return 1
  }
  try {
    const html = await htmlFetch(ref.url)
    // Unknown or expired ids return a 200 "Diese Seite wurde nicht gefunden"
    // page without JobPosting data, so absence of the JSON-LD is the 404 signal.
    const parsed = html ? parseDetail(html, ref.id, ref.url) : null
    if (!parsed) {
      writeError("Job not found (expired or withdrawn)", "NOT_FOUND")
      return 1
    }
    const job = stripInvisible(parsed)

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.employmentType ? `Anstellung: ${job.employmentType}` : null,
        job.salary ? `Gehalt: ${job.salary}` : null,
        job.date ? `Veröffentlicht: ${job.date}` : null,
        job.deadline ? `Online bis: ${job.deadline}` : null,
        "",
        job.description || "(no description)",
        "",
        `URL: ${job.url}`,
      ].filter((l): l is string => l !== null)
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
