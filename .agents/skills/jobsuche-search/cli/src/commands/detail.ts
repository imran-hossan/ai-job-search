import { DETAIL_URL, apiFetch, encodeRefnr, normalizeId, stripInvisible, toDetail, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.id)
  if (!id) {
    writeError(
      `Could not parse a Jobsuche reference number from "${opts.id}" (expected e.g. 10001-1003857296-S or an arbeitsagentur.de/jobsuche/jobdetail/... URL)`,
      "BAD_ID",
    )
    return 1
  }
  try {
    const raw = await apiFetch(`${DETAIL_URL}/${encodeRefnr(id)}`)
    if (raw === null) {
      writeError("Job not found (expired or withdrawn)", "NOT_FOUND")
      return 1
    }
    const job = stripInvisible(toDetail(raw, id))

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.occupation ? `Beruf: ${job.occupation}` : null,
        job.workingTime ? `Arbeitszeit: ${job.workingTime}` : null,
        job.contract ? `Vertrag: ${job.contract}` : null,
        job.startDate ? `Eintritt: ${job.startDate}` : null,
        job.salary ? `Gehalt: ${job.salary}` : null,
        job.homeOffice !== null ? `Homeoffice: ${job.homeOffice ? "ja" : "nein"}` : null,
        job.date ? `Veröffentlicht: ${job.date}` : null,
        "",
        job.description || "(no description)",
        "",
        `URL: ${job.url}`,
        job.externalUrl ? `Apply / original posting: ${job.externalUrl}` : null,
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
