// Live smoke tests against stellenanzeigen.de: a handful of requests, not a crawl.
import { describe, expect, test } from "bun:test"
import { parseJSON, runCLI } from "./helpers.ts"

interface SearchOut {
  meta: { count: number; page: number; total: number | null; totalWithSimilar: number | null }
  results: { id: string; title: string; company: string | null; location: string | null; date: string | null; url: string; relevant: boolean }[]
}

describe("live search + detail", () => {
  test("search returns exact matches with id/title/url, and detail resolves one", async () => {
    const out = parseJSON<SearchOut>(await runCLI(["search", "-q", "Biologe", "--limit", "3"]))
    expect(out.meta.page).toBe(1)
    expect(out.results.length).toBeGreaterThanOrEqual(1)
    for (const r of out.results) {
      expect(r.id).toBeTruthy()
      expect(r.title).toBeTruthy()
      expect(r.relevant).toBe(true)
      expect(r.url).toStartWith("https://www.stellenanzeigen.de/job/")
      for (const k of ["company", "location", "date"] as const) expect(k in r).toBe(true)
    }

    const detail = parseJSON<{ id: string; title: string; description: string | null }>(
      await runCLI(["detail", out.results[0].url]),
    )
    expect(detail.id).toBe(out.results[0].id)
    expect(detail.title).toBeTruthy()
    expect(detail.description).toBeTruthy()
  })
})

describe("argument errors exit 1 with JSON on stderr", () => {
  const cases: [string, string[]][] = [
    ["bogus flag", ["search", "-q", "Biologe", "--bogus", "x"]],
    ["missing query", ["search"]],
    ["jobage not a site value", ["search", "-q", "Biologe", "--jobage", "14"]],
    ["radius not a site value", ["search", "-q", "Biologe", "-l", "Berlin", "-r", "25"]],
    ["radius without location", ["search", "-q", "Biologe", "-r", "50"]],
    ["similar with a value", ["search", "-q", "Biologe", "--similar", "yes"]],
    ["missing detail id", ["detail"]],
    ["foreign detail url", ["detail", "https://example.com/job/x-sde-129508/"]],
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
