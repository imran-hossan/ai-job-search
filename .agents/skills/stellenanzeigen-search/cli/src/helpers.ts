// Data source: stellenanzeigen.de public pages. No authentication required.
// - Search: /suche/?fulltext=... is a Next.js page whose job list is embedded as
//   structured data in the React Server Components payload
//   (self.__next_f.push([1,"..."]) chunks) under "jobAds".
// - Detail: /job/<slug>-<id>/ carries a schema.org JobPosting JSON-LD block.
// robots.txt allows /suche/ and /job/ for generic agents (verified 2026-11-09).
// See ../../url-reference.md for parameters and field paths.

export const BASE = "https://www.stellenanzeigen.de"
export const SEARCH_URL = `${BASE}/suche/`

const UA = "Mozilla/5.0 (compatible; stellenanzeigen-cli/1.0)"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

/** Fetch HTML with exponential backoff + jitter on 429/5xx. Returns "" on a 404. */
export async function htmlFetch(url: string): Promise<string> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return ""
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.text()
  }
  throw new Error("Request failed after max retries")
}

// ---------------------------------------------------------------------------
// Output hygiene (copied from linkedin-search/cli/src/helpers.ts)
// ---------------------------------------------------------------------------

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

/**
 * Characters a reader of the posting never sees but a model reading this
 * output does: C0/C1 controls other than tab, newline and carriage return, the
 * soft hyphen, bidi marks/embeddings/overrides/isolates, zero-width characters
 * and invisible operators, the BOM, variation selectors, and Unicode tag
 * characters (U+E0000-E007F). Listing text is third-party data.
 */
const INVISIBLE_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F­؜᠎​-‏‪-‮⁠-⁯︀-️﻿\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]/gu

/** Strip INVISIBLE_CHARS from every string in a result, recursively: the CLI's output boundary. */
export function stripInvisible<T>(value: T): T {
  if (typeof value === "string") return value.replace(INVISIBLE_CHARS, "") as T
  if (Array.isArray(value)) return value.map(stripInvisible) as T
  if (value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripInvisible(v)])) as T
  }
  return value
}

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"])

function isHiddenTag(attrs: string): boolean {
  for (const m of attrs.matchAll(/([^\s"'=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    const name = m[1].toLowerCase()
    const value = m[2] ?? m[3] ?? m[4] ?? ""
    if (name === "hidden") return true
    if (name === "style" && /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden|mso-hide\s*:\s*all)\b/i.test(value)) {
      return true
    }
  }
  return false
}

/**
 * Drop markup a browser never renders - comments, <script>/<style>/<template>
 * blocks, and elements marked hidden - before tags are stripped.
 */
export function visibleHtml(html: string): string {
  const src = html
    .replace(/<!--[\s\S]*?(?:-->|$)/g, "")
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, "")
  const open = /<([a-zA-Z][a-zA-Z0-9-]*)(\s[^>]*)?>/g
  const kept: string[] = []
  let from = 0
  let m: RegExpExecArray | null
  while ((m = open.exec(src)) !== null) {
    if (!m[2] || !isHiddenTag(m[2])) continue
    const tag = m[1].toLowerCase()
    let end = open.lastIndex
    if (!VOID_TAGS.has(tag) && !m[0].endsWith("/>")) {
      const same = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi")
      same.lastIndex = end
      end = src.length
      let depth = 1
      let s: RegExpExecArray | null
      while ((s = same.exec(src)) !== null) {
        if (s[1]) depth--
        else if (!s[0].endsWith("/>")) depth++
        if (depth === 0) {
          end = same.lastIndex
          break
        }
      }
    }
    kept.push(src.slice(from, m.index))
    from = end
    open.lastIndex = end
  }
  kept.push(src.slice(from))
  return kept.join("")
}



/** Turn employer HTML (JSON-LD description) into readable plain text with paragraph breaks. */
export function htmlToText(raw: string | null | undefined): string | null {
  if (!raw) return null
  const text = decodeHtmlEntities(
    visibleHtml(raw)
      .replace(/\s+/g, " ")
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n• ")
      .replace(/<\/(p|li|ul|ol|div|h\d|tr|b|strong|section)>/gi, "\n")
      .replace(/<\/?[a-zA-Z][^>]*>/g, ""),
  )
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n+• /g, "\n• ")
    .trim()
  return text || null
}

// ---------------------------------------------------------------------------
// Embedded data extraction
// ---------------------------------------------------------------------------

/**
 * Join the Next.js RSC payload chunks (`self.__next_f.push([1,"..."])`) into
 * one string. Each chunk is a JS string literal; JSON string syntax decodes it.
 * A chunk that fails to decode is skipped rather than failing the page.
 */
export function rscPayload(html: string): string {
  const out: string[] = []
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) {
    try {
      out.push(JSON.parse(`"${m[1]}"`))
    } catch {
      // skip an undecodable chunk
    }
  }
  return out.join("")
}

/**
 * Parse the JSON value (object or array) that starts at `start`, by scanning
 * for its matching close bracket while respecting strings. Returns null if
 * the value is unterminated or not valid JSON.
 */
export function jsonValueAt(text: string, start: number): unknown | null {
  const open = text[start]
  if (open !== "{" && open !== "[") return null
  let depth = 0
  let inStr = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      if (c === "\\") i++
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === "{" || c === "[") depth++
    else if (c === "}" || c === "]") {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Ids
// ---------------------------------------------------------------------------

/** Posting ids seen live: SDE-129508, JIM-338822, REG-46516, YF-52839, 16417754. */
const JOB_ID = /^(?:[A-Za-z]{2,5}-\d{3,}|\d{5,})$/

export function jobUrl(id: string): string {
  // The detail route ignores the slug and resolves on the trailing id.
  return `${BASE}/job/x-${id.toLowerCase()}/`
}

export interface JobRef {
  id: string
  /** The page to fetch: the given URL's own path, or the slugless /job/x-<id>/ form. */
  url: string
}

/** Posting-id prefixes seen live, tried first so a slug word ("…-trier-16417754") is not mistaken for one. */
const KNOWN_PREFIX = /-((?:sde|jim|reg|yf)-\d{3,})\/?$/i

/** The posting id at the end of a /job/<slug>-<id>/ path. */
function idFromPath(path: string): string | null {
  const m = path.match(KNOWN_PREFIX) ?? path.match(/-(\d{5,})\/?$/) ?? path.match(/-([a-z]{2,5}-\d{3,})\/?$/i)
  return m ? m[1].toUpperCase() : null
}

/**
 * Accept a raw posting id or a stellenanzeigen.de /job/<slug>-<id>/ URL (with
 * or without scheme). For a URL, its own path is fetched (on the fixed host),
 * so detail never depends on re-deriving the id from a slug. Other hosts are
 * rejected through real URL parsing, so look-alike hosts and userinfo tricks
 * fall on the reject side.
 */
export function normalizeId(input: string): JobRef | null {
  const trimmed = input.trim()
  if (JOB_ID.test(trimmed)) return { id: trimmed.toUpperCase(), url: jobUrl(trimmed) }
  const hasScheme = /^https?:\/\//i.test(trimmed)
  if (!hasScheme && !/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(trimmed)) return null
  let parsed: URL
  try {
    parsed = new URL(hasScheme ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
  if (!/(^|\.)stellenanzeigen\.de$/i.test(parsed.hostname)) return null
  if (!/^\/job\/[^/]+\/?$/.test(parsed.pathname)) return null
  const id = idFromPath(parsed.pathname.replace(/\/?$/, ""))
  if (!id) return null
  return { id, url: `${BASE}${parsed.pathname.endsWith("/") ? parsed.pathname : parsed.pathname + "/"}` }
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

export interface JobResult {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  relevant: boolean
  deadline: string | null
  salary: string | null
}

export interface JobDetail {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  deadline: string | null
  employmentType: string | null
  salary: string | null
  description: string | null
}

type Raw = Record<string, unknown>

function obj(v: unknown): Raw | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : null
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null
  const s = decodeHtmlEntities(v).replace(/\s+/g, " ").trim()
  return s || null
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return null
}

/** "2026-10-29T00:00:01Z" -> "2026-10-29". */
function day(v: unknown): string | null {
  const s = str(v)
  const m = s?.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

const UNIT: Record<string, string> = { YEAR: "€/Jahr", MONTH: "€/Monat", WEEK: "€/Woche", DAY: "€/Tag", HOUR: "€/Stunde" }

function salaryText(min: number | null, max: number | null, unit: string | null): string | null {
  if (min === null && max === null) return null
  const fmt = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 2 })
  const u = unit ? UNIT[unit.toUpperCase()] ?? `€/${unit}` : "€"
  if (min !== null && max !== null && min !== max) return `${fmt(min)}–${fmt(max)} ${u}`
  return `${fmt((min ?? max) as number)} ${u}`
}

function onPortal(url: string | null): string | null {
  if (!url) return null
  try {
    return /(^|\.)stellenanzeigen\.de$/i.test(new URL(url).hostname) ? url : null
  } catch {
    return null
  }
}

/** Map one `jobAds` entry ({ isRelevant, jobAd }). Returns null without a usable id and title. */
export function toResult(entry: unknown): JobResult | null {
  const e = obj(entry)
  const ad = obj(e?.jobAd) ?? e // tolerate an unwrapped jobAd
  if (!ad) return null
  const id = str(ad.id)
  const title = str(ad.positionTitle) ?? str(ad.title)
  if (!id || !title) return null
  return {
    id,
    title,
    company: str(ad.companyName),
    location: str(ad.region) ?? str(ad.regionAlternative),
    date: day(ad.originalStartDate) ?? day(ad.startDate),
    url: onPortal(str(ad.portalLink)) ?? onPortal(str(ad.link)) ?? jobUrl(id),
    relevant: e?.isRelevant !== false,
    deadline: day(ad.expirationDate),
    salary: salaryText(num(ad.salaryMin), num(ad.salaryMax), str(ad.salaryUnit)),
  }
}

export interface SearchPage {
  /** Exact keyword matches across all pages (the site's "N Jobs" headline). */
  total: number | null
  /** Exact matches plus "ähnliche Jobs" (similar listings). */
  totalWithSimilar: number | null
  results: JobResult[]
}

/** Parse a search page. Each entry is mapped independently so one malformed entry cannot break the rest. */
export function parseSearch(html: string): SearchPage {
  const payload = rscPayload(html)
  const counts = payload.match(/"count":(\d+),"countRelevant":(\d+)/)
  const at = payload.indexOf('"jobAds":[')
  const list = at >= 0 ? jsonValueAt(payload, at + '"jobAds":'.length) : null
  const results: JobResult[] = []
  if (Array.isArray(list)) {
    for (const entry of list) {
      try {
        const r = toResult(entry)
        if (r) results.push(r)
      } catch {
        // skip a malformed entry
      }
    }
  }
  return {
    total: counts ? Number(counts[2]) : null,
    totalWithSimilar: counts ? Number(counts[1]) : null,
    results,
  }
}

/** Whether the page carries the search payload at all (guards against silent markup drift). */
export function hasSearchPayload(html: string): boolean {
  return /"count":\d+,"countRelevant":\d+/.test(rscPayload(html))
}

function findJobPosting(html: string): Raw | null {
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown
    try {
      data = JSON.parse(m[1])
    } catch {
      continue
    }
    const items = Array.isArray(data) ? data : obj(data)?.["@graph"] && Array.isArray(obj(data)!["@graph"]) ? (obj(data)!["@graph"] as unknown[]) : [data]
    for (const it of items) {
      const o = obj(it)
      if (o && o["@type"] === "JobPosting") return o
    }
  }
  return null
}

function locationOf(jp: Raw): string | null {
  const locs = Array.isArray(jp.jobLocation) ? jp.jobLocation : jp.jobLocation ? [jp.jobLocation] : []
  const parts: string[] = []
  for (const l of locs) {
    const a = obj(obj(l)?.address)
    const city = str(a?.addressLocality)
    const region = str(a?.addressRegion)
    const p = city ? (region && region !== city ? `${city} (${region})` : city) : region
    if (p && !parts.includes(p)) parts.push(p)
  }
  return parts.length ? parts.join("; ") : null
}

const EMPLOYMENT: Record<string, string> = {
  FULL_TIME: "Vollzeit",
  PART_TIME: "Teilzeit",
  CONTRACTOR: "Freiberuflich",
  TEMPORARY: "Befristet",
  INTERN: "Praktikum",
  VOLUNTEER: "Ehrenamt",
  PER_DIEM: "Tageweise",
  OTHER: "Sonstiges",
}

/** Parse a detail page's JobPosting JSON-LD. Returns null when the page has none (soft 404 / expired). */
export function parseDetail(html: string, id: string, url: string = jobUrl(id)): JobDetail | null {
  const jp = findJobPosting(html)
  if (!jp) return null
  const et = Array.isArray(jp.employmentType) ? jp.employmentType : jp.employmentType ? [jp.employmentType] : []
  const employment = et.map((x) => (typeof x === "string" ? EMPLOYMENT[x] ?? x : null)).filter((x): x is string => !!x)
  const value = obj(obj(jp.baseSalary)?.value)
  return {
    id,
    title: str(jp.title) ?? "(untitled)",
    company: str(obj(jp.hiringOrganization)?.name),
    location: locationOf(jp),
    date: day(jp.datePosted),
    url,
    deadline: day(jp.validThrough),
    employmentType: employment.length ? employment.join(", ") : null,
    salary: salaryText(num(value?.minValue ?? value?.value), num(value?.maxValue), str(value?.unitText)),
    description: htmlToText(typeof jp.description === "string" ? jp.description : null),
  }
}
