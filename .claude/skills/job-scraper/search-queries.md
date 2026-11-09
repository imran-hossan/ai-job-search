# Search Queries for Job Scraper

<!-- SETUP: Customize these queries based on your skills, target roles, and location -->

## Installed portal CLIs (primary for `/scrape`)

`/scrape` discovers every portal skill under `.agents/skills/*/SKILL.md` and runs its CLI first. Shipped country-agnostic CLIs include `linkedin-search` and `freehire-search`; Danish demos and any skill you add with `/add-portal` are included the same way. You do **not** need a matching `site:` line below for those CLIs to run.

The `site:` query templates in this file are the **WebSearch fallback** — for portals without a CLI, company career pages, or when a CLI fails.

**Language scope:** write every query category in every language listed in your CLAUDE.md Languages table (typically 1-2, sometimes more). A posting requiring a language you have *not* declared, as a job condition, is excluded before scoring; a posting requiring a *higher level* than you declared in a language you *do* work in is flagged for your own judgment, not excluded — see `04-job-evaluation.md`'s Language Gate, the single source of truth for this rule. Translate each category's keywords rather than machine-translating word-for-word (e.g. "Frontend Developer" -> "Desarrollador Frontend", not a literal word-for-word translation) if you work in more than one language.

## Search Sites

Primary (your market's job boards - scaffold one with `/add-portal`):
- **[YOUR_JOB_BOARD]** - your market's largest general job board
- **linkedin.com/jobs** - LinkedIn job listings (filter: [YOUR_COUNTRY] / [YOUR_CITY]); also covered by `linkedin-search` CLI
- **arbeitsagentur.de/jobsuche** - Germany's federal job board; covered by the `jobsuche-search` CLI (no `site:` line needed)
- **stellenanzeigen.de** - large German general board (own ads plus yourfirm, Appcast and regional-newspaper feeds); covered by the `stellenanzeigen-search` CLI (no `site:` line needed)
- **xing.com/jobs** - XING, the DACH professional network's job board. **No CLI:** robots.txt disallows `/jobs/search` and the GraphQL API for generic agents (it allows only a few named AI crawlers), so it is reached only through the `site:xing.com/jobs` WebSearch queries below
- **de.indeed.com** - Indeed Germany. **No CLI:** robots.txt allows search, but the site serves a bot "Security Check" and Indeed's terms bar automated access, so it is reached only through the `site:de.indeed.com` WebSearch queries below
- **jobvector.de** - German STEM/life-science board (science, engineering, IT, medicine). **No CLI:** the site sits behind a Cloudflare challenge, so it is reached only through the `site:jobvector.de` WebSearch queries below
- **[YOUR_INDUSTRY_JOB_BOARD]** - a niche/industry board for your field (optional)
- **[YOUR_ADDITIONAL_JOB_BOARD]** - another major board for your market (optional)

Secondary (company career pages via Google):
- Direct Google searches with `site:` filters for known target companies

## Query Categories

Queries are grouped by priority. Write **each category in every language from your Languages table** (see Language scope above). Combine each query with your location terms (e.g. your city, region, or metro area) where the site supports it.

**Organize by function, not job title.** The same underlying work carries different titles across companies and markets (a "Data Scientist" role at one employer may be posted as "Insights Analyst" or "Data Consultant" at another). Name each priority category after the function it covers, and list several plausible job titles as query variants within that category rather than betting an entire priority tier on one exact title string.

### Priority 1: [YOUR_PRIMARY_ROLE_TYPE]

These match your strongest and most desired career direction.

```
site:[YOUR_JOB_BOARD] "[YOUR_PRIMARY_JOB_TITLE_1]" [YOUR_CITY]
site:[YOUR_JOB_BOARD] "[YOUR_PRIMARY_JOB_TITLE_2]" [YOUR_CITY]
site:[YOUR_JOB_BOARD] "[YOUR_KEY_SKILL]" [YOUR_CITY]
site:linkedin.com/jobs "[YOUR_PRIMARY_JOB_TITLE_1]" [YOUR_COUNTRY]
```

### Priority 2: [YOUR_DOMAIN_EXPERTISE]

These match your domain expertise.

```
site:[YOUR_JOB_BOARD] [YOUR_DOMAIN_KEYWORD_1] [YOUR_CITY] OR [YOUR_REGION]
site:[YOUR_JOB_BOARD] [YOUR_DOMAIN_KEYWORD_2] [YOUR_COUNTRY]
site:linkedin.com/jobs [YOUR_DOMAIN_KEYWORD_1] [YOUR_CITY] [YOUR_COUNTRY]
```

### Priority 3: [YOUR_ADJACENT_ROLE_TYPE]

Adjacent roles you could pivot into.

```
site:[YOUR_JOB_BOARD] "[YOUR_ADJACENT_TITLE_1]" [YOUR_KEY_SKILL] [YOUR_CITY]
site:[YOUR_JOB_BOARD] "[YOUR_ADJACENT_TITLE_2]" [YOUR_KEY_SKILL] [YOUR_CITY]
```

### Priority 4: Broader Technical / Consulting

Wider net for general technical roles.

```
site:[YOUR_JOB_BOARD] [YOUR_KEY_SKILL] developer [YOUR_CITY]
site:linkedin.com/jobs "[YOUR_KEY_SKILL] developer" [YOUR_CITY]
site:[YOUR_JOB_BOARD] "technical consultant" [YOUR_DOMAIN] [YOUR_CITY]
```

### jobvector.de (WebSearch only)

jobvector has no portal CLI (Cloudflare blocks automated fetches), so these queries are its only coverage. Search snippets give title, employer and city. Open a promising hit through the employer's own career page or the Jobsuche CLI rather than fetching jobvector directly. Run each in German and English:

```
site:jobvector.de "[YOUR_PRIMARY_JOB_TITLE_1]" [YOUR_CITY]
site:jobvector.de "[YOUR_PRIMARY_JOB_TITLE_2]" [YOUR_COUNTRY]
site:jobvector.de [YOUR_DOMAIN_KEYWORD_1] [YOUR_CITY] OR [YOUR_REGION]
site:jobvector.de "[YOUR_KEY_SKILL]" Stellenangebot
```

Example (molecular biology):

```
site:jobvector.de "Molekularbiologe" OR "Molekularbiologin"
site:jobvector.de "molecular biologist" Germany
site:jobvector.de Molekularbiologie qPCR Postdoc OR Wissenschaftler
```

### de.indeed.com (WebSearch only)

Indeed has no portal CLI (bot challenge on every page, and its terms prohibit automated access), so these queries are its only coverage. Use the search snippets for title, employer and city, then follow up on the employer's own career page or via the Jobsuche/LinkedIn CLIs, which carry many of the same listings. Do not fetch Indeed pages directly. Run each in German and English:

```
site:de.indeed.com "[YOUR_PRIMARY_JOB_TITLE_1]" [YOUR_CITY]
site:de.indeed.com "[YOUR_PRIMARY_JOB_TITLE_2]" [YOUR_COUNTRY]
site:de.indeed.com [YOUR_DOMAIN_KEYWORD_1] [YOUR_CITY] OR [YOUR_REGION]
```

Example (molecular biology):

```
site:de.indeed.com "Molekularbiologe" OR "Molekularbiologin"
site:de.indeed.com "molecular biologist" Germany
site:de.indeed.com Molekularbiologie qPCR Labor
```

### xing.com/jobs (WebSearch only)

XING has no portal CLI: its robots.txt disallows the job search and its API for generic agents. Search engines index the individual posting pages (`xing.com/jobs/<city>-<title>-<id>`), so `site:` queries find them. Use the snippets for title, employer and city, then follow up on the employer's own career page or via the Jobsuche/LinkedIn CLIs. Do not fetch XING search pages directly. Run each in German and English:

```
site:xing.com/jobs "[YOUR_PRIMARY_JOB_TITLE_1]" [YOUR_CITY]
site:xing.com/jobs "[YOUR_PRIMARY_JOB_TITLE_2]" [YOUR_COUNTRY]
site:xing.com/jobs [YOUR_DOMAIN_KEYWORD_1] [YOUR_CITY] OR [YOUR_REGION]
```

Example (molecular biology):

```
site:xing.com/jobs "Molekularbiologe" OR "Molekularbiologin"
site:xing.com/jobs "molecular biologist" Germany
site:xing.com/jobs Molekularbiologie qPCR Labor
```

### Other German boards (WebSearch only)

Checked 2026-11-09 with an honest tool user agent. None of these qualifies for a portal CLI, so `site:` queries are their only coverage. Use the snippets for title, employer and city, then follow up on the employer's own career page or via the Jobsuche/stellenanzeigen/LinkedIn CLIs. Do not fetch these sites directly.

| Board | Why no CLI | `site:` filter |
|-------|-----------|----------------|
| StepStone | No response to automated requests | `site:stepstone.de/stellenangebote` |
| Monster | 403 to automated requests | `site:monster.de` |
| Jobware | 403 to automated requests | `site:jobware.de` |
| meinestadt.de | 403 to automated requests | `site:jobs.meinestadt.de` |
| academics.de (science/research) | robots.txt legal notice prohibits automated access | `site:academics.de` |
| ZEIT Jobs (science/research) | robots.txt legal notice prohibits automated access | `site:jobs.zeit.de` |
| EURAXESS (EU research jobs) | robots.txt disallows parameterised search (`/*?`) | `site:euraxess.ec.europa.eu/jobs` |
| service.bund.de (federal public sector) | robots.txt disallows `/Content/DE/Stellen/Suche/` | `site:service.bund.de Stellenangebot` |
| Interamt (public sector) | Stateful app; search ignores URL keywords | `site:interamt.de` |
| Absolventa (graduates) | Search ignores the keyword server-side | `site:absolventa.de/stellenangebote` |
| kimeta (aggregator) | robots.txt `Disallow: /` | skip (it re-lists other boards) |

Run each in German and English, prioritising the science boards (academics.de, ZEIT Jobs, EURAXESS) for research roles:

```
site:academics.de "[YOUR_PRIMARY_JOB_TITLE_1]"
site:jobs.zeit.de "[YOUR_PRIMARY_JOB_TITLE_1]" [YOUR_CITY]
site:euraxess.ec.europa.eu/jobs "[YOUR_DOMAIN_KEYWORD_1]" Germany
site:stepstone.de/stellenangebote "[YOUR_PRIMARY_JOB_TITLE_1]" [YOUR_CITY]
site:service.bund.de OR site:interamt.de "[YOUR_PRIMARY_JOB_TITLE_1]"
```

Example (molecular biology):

```
site:academics.de Molekularbiologie Postdoc OR Wissenschaftler
site:jobs.zeit.de Molekularbiologe OR Molekularbiologin
site:euraxess.ec.europa.eu/jobs "molecular biology" Germany
site:stepstone.de/stellenangebote Molekularbiologe
site:service.bund.de OR site:interamt.de Biologe Labor
```

## Location Filter

When evaluating results, verify the job location is within reasonable commute distance from your home. Define acceptable areas:
- [YOUR_CITY] and surrounding areas
- [ACCEPTABLE_AREA_1]
- [ACCEPTABLE_AREA_2]
- [BORDERLINE_AREA] (borderline - ~X min by transit)
- [TOO_FAR_AREA] (too far)

## Language Filter

Your working languages and levels are in CLAUDE.md's Languages table. When filtering scraped results, apply `04-job-evaluation.md`'s Language Gate: a posting requiring a language you haven't declared at all is excluded; a posting requiring a higher level than you declared in a language you do work in is not excluded, flag it clearly instead (see `job-scraper/SKILL.md`'s Step 3 "Quick Fit Assessment" for how the flag surfaces in `/scrape` output). Postings simply *written* in a language you don't work in, that don't require it on the job, are fine.

## Date Filter

Only include jobs posted within the last 14 days, or with an application deadline that has not yet passed. If a posting date cannot be determined, include it but flag as "date unknown".

## Adapting Queries

If the user specifies a focus area, select queries from the matching category and also generate 2-3 custom queries for that focus. For example:
- "/scrape [focus_area]" -> relevant category queries + custom focus-specific queries
