// Data source: the Bundesagentur für Arbeit (German Federal Employment Agency)
// Jobsuche REST API - the JSON backend of https://www.arbeitsagentur.de/jobsuche.
// Public and unauthenticated: the X-API-Key header carries the API's fixed,
// publicly documented client ID ("jobboerse-jobsuche"), not a user credential.
// See ../../url-reference.md for endpoints and field paths.

export const API_BASE = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service"
export const SEARCH_URL = `${API_BASE}/pc/v6/jobs`
export const DETAIL_URL = `${API_BASE}/pc/v4/jobdetails`
export const PUBLIC_DETAIL_URL = "https://www.arbeitsagentur.de/jobsuche/jobdetail"
/** Public client ID of the Jobsuche web app (documented at jobsuche.api.bund.dev). Not a secret. */
export const PUBLIC_CLIENT_ID = "jobboerse-jobsuche"
export const PAGE_SIZE = 25

const UA = "Mozilla/5.0 (compatible; jobsuche-cli/1.0)"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

/** GET JSON with exponential backoff + jitter on 429/5xx. Returns null on a 404. */
export async function apiFetch(url: string): Promise<unknown | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        "X-API-Key": PUBLIC_CLIENT_ID,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
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
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.json()
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

/**
 * Turn the API's description into readable plain text. The field is usually
 * plain text with newlines and markdown-style emphasis (`***bold***`), but
 * employer-supplied text can carry HTML, so markup is handled when present.
 * Only real tags (`<p>`, `</div>`, `<!-- -->`) are stripped, never a bare
 * "<5 Jahre".
 */
export function cleanDescription(raw: string | null | undefined): string | null {
  if (!raw) return null
  let text = raw.replace(/\r\n?/g, "\n")
  if (/<[a-zA-Z!/]/.test(text)) {
    text = visibleHtml(text)
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|ul|ol|div|h\d|tr)>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n• ")
      .replace(/<\/?[a-zA-Z][^>]*>/g, "")
  }
  text = decodeHtmlEntities(text)
    .replace(/\*{2,}/g, "")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text || null
}

// ---------------------------------------------------------------------------
// Ids
// ---------------------------------------------------------------------------

/**
 * A Jobsuche reference number, e.g. 10001-1003857296-S, 11858-SDE-129508-STA-S
 * or 17296-0008376:01-S (some partner feeds put a colon in the id).
 */
const REFNR = /^\d{3,6}-[A-Za-z0-9][A-Za-z0-9:_.-]*$/

/**
 * Accept a raw reference number or a public arbeitsagentur.de jobdetail URL
 * (with or without scheme). URLs on any other host are rejected, through real
 * URL parsing so look-alike hosts and userinfo tricks fall on the reject side.
 */
export function normalizeId(input: string): string | null {
  const trimmed = input.trim()
  if (REFNR.test(trimmed)) return trimmed
  const hasScheme = /^https?:\/\//i.test(trimmed)
  if (!hasScheme && !/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(trimmed)) return null
  let parsed: URL
  try {
    parsed = new URL(hasScheme ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
  if (!/(^|\.)arbeitsagentur\.de$/i.test(parsed.hostname)) return null
  const m = parsed.pathname.match(/\/jobsuche\/jobdetail\/([^/]+)\/?$/)
  if (!m) return null
  const id = decodeURIComponent(m[1])
  return REFNR.test(id) ? id : null
}

/** The detail endpoint addresses a posting by the base64 of its reference number. */
export function encodeRefnr(refnr: string): string {
  return Buffer.from(refnr, "utf8").toString("base64")
}

export function publicUrl(refnr: string): string {
  // REFNR's character set is URL-path safe as-is; the site links ids with a raw colon.
  return `${PUBLIC_DETAIL_URL}/${REFNR.test(refnr) ? refnr : encodeURIComponent(refnr)}`
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
  occupation: string | null
  externalUrl: string | null
}

export interface JobDetail extends JobResult {
  description: string | null
  workingTime: string | null
  contract: string | null
  startDate: string | null
  salary: string | null
  homeOffice: boolean | null
  applyUrl: string
}

type Raw = Record<string, unknown>

function str(v: unknown): string | null {
  if (typeof v !== "string") return null
  const s = decodeHtmlEntities(v).replace(/\s+/g, " ").trim()
  return s || null
}

function obj(v: unknown): Raw | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : null
}

function httpUrl(v: unknown): string | null {
  const s = str(v)
  return s && /^https?:\/\//i.test(s) ? s : null
}

const REGION_NAMES: Record<string, string> = {
  BADEN_WUERTTEMBERG: "Baden-Württemberg",
  BAYERN: "Bayern",
  BERLIN: "Berlin",
  BRANDENBURG: "Brandenburg",
  BREMEN: "Bremen",
  HAMBURG: "Hamburg",
  HESSEN: "Hessen",
  MECKLENBURG_VORPOMMERN: "Mecklenburg-Vorpommern",
  NIEDERSACHSEN: "Niedersachsen",
  NORDRHEIN_WESTFALEN: "Nordrhein-Westfalen",
  RHEINLAND_PFALZ: "Rheinland-Pfalz",
  SAARLAND: "Saarland",
  SACHSEN: "Sachsen",
  SACHSEN_ANHALT: "Sachsen-Anhalt",
  SCHLESWIG_HOLSTEIN: "Schleswig-Holstein",
  THUERINGEN: "Thüringen",
}

/** "Ort (Region)" for each posting location, joined with "; ". */
function locationOf(r: Raw): string | null {
  const locs = Array.isArray(r.stellenlokationen) ? r.stellenlokationen : []
  const parts: string[] = []
  for (const l of locs) {
    const a = obj(obj(l)?.adresse)
    if (!a) continue
    const ort = str(a.ort)
    const regionRaw = str(a.region)
    const region = regionRaw ? REGION_NAMES[regionRaw] ?? regionRaw : null
    const land = str(a.land)
    const tail = land && land !== "DEUTSCHLAND" ? land : region
    const p = ort ? (tail && tail !== ort ? `${ort} (${tail})` : ort) : tail
    if (p && !parts.includes(p)) parts.push(p)
  }
  return parts.length ? parts.join("; ") : null
}

function dateOf(r: Raw): string | null {
  return str(obj(r.veroeffentlichungszeitraum)?.von) ?? str(r.datumErsteVeroeffentlichung)
}

/** Map one search-list entry. Returns null when the entry has no usable id or title. */
export function toResult(raw: unknown): JobResult | null {
  const r = obj(raw)
  if (!r) return null
  const id = str(r.referenznummer)
  const title = str(r.stellenangebotsTitel) ?? str(r.titel) ?? str(r.beruf)
  if (!id || !title) return null
  return {
    id,
    title,
    company: str(r.firma) ?? str(r.arbeitgeber),
    location: locationOf(r),
    date: dateOf(r),
    url: publicUrl(id),
    occupation: str(r.hauptberuf) ?? str(r.beruf),
    externalUrl: httpUrl(r.externeURL),
  }
}

/** Map the search response; each entry is mapped independently so one malformed entry cannot break the rest. */
export function parseSearch(raw: unknown): { total: number | null; results: JobResult[] } {
  const r = obj(raw)
  const list = r && Array.isArray(r.ergebnisliste) ? r.ergebnisliste : []
  const results: JobResult[] = []
  for (const item of list) {
    try {
      const m = toResult(item)
      if (m) results.push(m)
    } catch {
      // skip a malformed entry
    }
  }
  const total = r && typeof r.maxErgebnisse === "number" ? r.maxErgebnisse : null
  return { total, results }
}

function workingTimeOf(r: Raw): string | null {
  const t: string[] = []
  if (r.arbeitszeitVollzeit === true) t.push("Vollzeit")
  if (
    r.arbeitszeitTeilzeitVormittag === true ||
    r.arbeitszeitTeilzeitNachmittag === true ||
    r.arbeitszeitTeilzeitAbend === true ||
    r.arbeitszeitTeilzeitFlexibel === true
  ) {
    t.push("Teilzeit")
  }
  if (r.arbeitszeitSchichtNachtWochenende === true) t.push("Schicht/Nacht/Wochenende")
  if (r.istGeringfuegigeBeschaeftigung === true) t.push("Minijob")
  return t.length ? t.join(", ") : null
}

function contractOf(r: Raw): string | null {
  const v = str(r.vertragsdauer)
  if (v === "BEFRISTET") {
    const months = typeof r.befristungInMonaten === "number" ? ` (${r.befristungInMonaten} Monate)` : ""
    const until = str(r.befristetBis) ? ` (bis ${str(r.befristetBis)})` : ""
    return `befristet${months || until}`
  }
  if (v === "UNBEFRISTET") return "unbefristet"
  return null
}

function salaryOf(r: Raw): string | null {
  const from = typeof r.gehaltsspanneVon === "number" ? r.gehaltsspanneVon : null
  const to = typeof r.gehaltsspanneBis === "number" ? r.gehaltsspanneBis : null
  if (from === null && to === null) return null
  const fmt = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 0 })
  const unit = str(r.verguetungsangabe) === "JAHRESGEHALT" ? " €/Jahr" : str(r.verguetungsangabe) === "MONATSGEHALT" ? " €/Monat" : " €"
  if (from !== null && to !== null && from !== to) return `${fmt(from)}–${fmt(to)}${unit}`
  return `${fmt((from ?? to) as number)}${unit}`
}

export function toDetail(raw: unknown, fallbackId: string): JobDetail {
  const r = obj(raw) ?? {}
  const id = str(r.referenznummer) ?? fallbackId
  const url = publicUrl(id)
  const externalUrl = httpUrl(r.externeURL)
  return {
    id,
    title: str(r.stellenangebotsTitel) ?? str(r.titel) ?? "(untitled)",
    company: str(r.firma) ?? str(r.arbeitgeber),
    location: locationOf(r),
    date: dateOf(r),
    url,
    occupation: str(r.hauptberuf) ?? str(r.beruf),
    externalUrl,
    description: cleanDescription(typeof r.stellenangebotsBeschreibung === "string" ? r.stellenangebotsBeschreibung : null),
    workingTime: workingTimeOf(r),
    contract: contractOf(r),
    startDate: str(obj(r.eintrittszeitraum)?.von),
    salary: salaryOf(r),
    homeOffice: typeof r.homeofficemoeglich === "boolean" ? r.homeofficemoeglich : null,
    applyUrl: externalUrl ?? url,
  }
}
