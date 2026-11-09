# stellenanzeigen.de: URL and Data Reference

Verified live 2026-11-09. The site is a Next.js app. Both pages the CLI reads are server-rendered
and carry structured data, so the CLI never depends on styled-component class names
(`sc-2e10cdc6-…`), which change on every deploy.

Headers sent: `User-Agent: Mozilla/5.0 (compatible; stellenanzeigen-cli/1.0)`,
`Accept-Language: de-DE,de;q=0.9,en;q=0.8`.

## Search

```
GET https://www.stellenanzeigen.de/suche/?fulltext=<query>&locationIds=<city>&perimeterRadius=<km>&onlyAdsOnlineForDays=<days>&page=<n>
```

| Param | Meaning | Accepted values | CLI flag |
|-------|---------|-----------------|----------|
| `fulltext` | Keyword query | free text (German terms match) | `--query` |
| `locationIds` | Location | a city name (`Berlin`, `M%C3%BCnchen`) or an internal id (`M-DE-6481`) | `--location` |
| `perimeterRadius` | Radius around location, km | `10 20 30 40 50 75 100 200` (site default 30) | `--radius` |
| `onlyAdsOnlineForDays` | Online for at most N days | `0` (all), `1`, `7`, `30` | `--jobage` |
| `page` | 1-indexed page, 25 listings each | integer | `--page` |

Tested and **ignored** by the server: `pageNumber`, `offset`, `seite`, `locationId` (singular, which returns 0 hits).
The filter values come from the page's own `filterOptions` (`keyFilter: "onlyAdsOnlineForDays"` / `"perimeterRadius"`).

### Where the data is

The job list is not in the visible markup in a usable form. It is in the React Server Components
payload, streamed as `<script>self.__next_f.push([1,"<js-string>"])</script>` chunks. Join the
chunk strings (each decodes as a JSON string literal), then:

- `"count":<n>,"countRelevant":<m>`: `m` = exact keyword matches ("N Jobs" headline), `n` = exact + similar.
- `"jobAds":[ ... ]`: one entry per listing on this page:

```json
{ "isRelevant": true, "relevanceHighscore": <number>, "jobAd": { ... }, "companyProfile": { ... } }
```

`isRelevant: false` entries are the "ähnliche Jobs" block shown under the exact hits.

`jobAd` fields used:

| Field | Output | Notes |
|-------|--------|-------|
| `id` | `id` | `SDE-129508` (own ads), `JIM-…` (Appcast/Indeed feeds), `REG-…`, `YF-…` (yourfirm), numeric (regional newspaper feeds) |
| `positionTitle` | `title` | |
| `companyName` | `company` | |
| `region` (fallback `regionAlternative`) | `location` | may list several cities: `"Speyer, Heidelberg, Karlsruhe"` |
| `originalStartDate` (fallback `startDate`) | `date` | ISO timestamp, trimmed to the day |
| `expirationDate` | `deadline` | "online until" |
| `portalLink` / `link` | `url` | used only if on stellenanzeigen.de (`portalLink` can be a partner site or a relative path), else `/job/x-<id>/` |
| `salaryMin`, `salaryMax`, `salaryUnit` (`Year`/`Month`/…) | `salary` | |

Also present but unused: `positionAddition` (teaser), `geo`, `locationIds`, `regions` (a Python-repr string, not JSON),
`applicationTypes`, `email`, `portal` (feed source: `stanz`, `indeed`, `appcast_stanz`, `yourfirm`, `volksfreund`, `rja`), `linkInternal`.

## Detail

```
GET https://www.stellenanzeigen.de/job/<slug>-<id-lowercase>/
```

The slug is ignored: `/job/x-sde-129508/` serves the same posting. The CLI builds that form from a bare id,
and fetches the given path as-is when passed a URL. Slugs can end in words that look like id prefixes
(`…-trier-16417754`), so ids are parsed from URLs with the known prefixes (`sde|jim|reg|yf`) tried first.

The page carries `<script type="application/ld+json" data-testid="qa-googleForJobs">` with a schema.org `JobPosting`:

| JSON-LD | Output |
|---------|--------|
| `title` | `title` |
| `hiringOrganization.name` | `company` |
| `jobLocation[].address.{addressLocality,addressRegion}` | `location` |
| `datePosted` | `date` |
| `validThrough` | `deadline` |
| `employmentType` (`FULL_TIME`, `PART_TIME`, `TEMPORARY`, …) | `employmentType` (German labels) |
| `baseSalary.value.{minValue,maxValue,unitText}` | `salary` |
| `description` (HTML) | `description` (plain text: hidden markup dropped, lists as `•`) |

The full ad is also embedded via `<iframe src="/api/jobs/iframe/?jobId=…">`. The CLI doesn't use it.

**Not found:** unknown or expired ids return **HTTP 200** with `<title>Diese Seite wurde nicht gefunden` and no
`JobPosting`. The absence of the JSON-LD is the not-found signal.

## Access

- robots.txt (`User-agent: *`) disallows only tracking/ajax/print/preview paths. `/suche/` and `/job/` are allowed.
  `bingbot` alone gets `Disallow: /suche/*fulltext=`.
- Not used: `/ajax/suggestort/` (place autocomplete) is disallowed for `*`, so city names are passed directly.
- No login, and no rate limiting was observed at test volume (~25 requests). The CLI backs off on 429/5xx anyway.
- Terms: the published AGB covers employers' ad orders only. The Impressum reserves copyright on site content.
