// Live smoke tests against the Jobsuche API: a handful of requests, not a crawl.
import { describe, expect, test } from "bun:test"
import { parseJSON, runCLI } from "./helpers.ts"

interface SearchOut {
  meta: { count: number; page: number; total: number | null }
  results: { id: string; title: string; company: string | null; location: string | null; date: string | null; url: string }[]
}

describe("live search + detail", () => {
  test("search returns results with id/title/url, and detail resolves one", async () => {
    const out = parseJSON<SearchOut>(await runCLI(["search", "-q", "Molekularbiologe", "--limit", "3"]))
    expect(out.meta.page).toBe(1)
    expect(out.results.length).toBeGreaterThanOrEqual(1)
    for (const r of out.results) {
      expect(r.id).toBeTruthy()
      expect(r.title).toBeTruthy()
      expect(r.url).toStartWith("https://www.arbeitsagentur.de/jobsuche/jobdetail/")
      for (const k of ["company", "location", "date"] as const) expect(k in r).toBe(true)
    }

    const detail = parseJSON<{ id: string; title: string; description: string | null }>(
      await runCLI(["detail", out.results[0].id]),
    )
    expect(detail.id).toBe(out.results[0].id)
    expect(detail.title).toBeTruthy()
  })
})

describe("argument errors exit 1 with JSON on stderr", () => {
  const cases: [string, string[]][] = [
    ["bogus flag", ["search", "-q", "Biologe", "--bogus", "x"]],
    ["missing query", ["search"]],
    ["bad jobage", ["search", "-q", "Biologe", "--jobage", "0.5"]],
    ["radius without location", ["search", "-q", "Biologe", "-r", "25"]],
    ["missing detail id", ["detail"]],
    ["foreign detail url", ["detail", "https://example.com/jobsuche/jobdetail/10001-1-S"]],
  ]
  for (const [name, args] of cases) {
    test(name, async () => {
      const r = await runCLI(args)
      expect(r.exitCode).toBe(1)
      expect(r.stdout).toBe("")
      const err = JSON.parse(r.stderr)
      expect(typeof err.error).toBe("string")
      expect(typeof err.code).toBe("string")
    })
  }
})
