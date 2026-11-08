---
name: jobsuche-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs in Germany or look up
  a German job posting — via the Bundesagentur für Arbeit Jobsuche
  (arbeitsagentur.de), Germany's federal job board and the largest German
  listing source, covering industry, research institutes, universities and
  public employers. Invoke for open positions, vacancies and hiring anywhere in
  Germany, even if the user does not mention the Arbeitsagentur. Trigger
  phrases: jobs in Germany, German job search, find a job in Berlin/München/
  Hamburg/Heidelberg, Jobsuche, Jobbörse, Arbeitsagentur, Stellenangebote,
  Stellensuche, offene Stellen, Jobs in Deutschland, Stelle finden, Job suchen.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/jobsuche-search/cli/src/cli.ts *)
---

# Jobsuche Search Skill (Bundesagentur für Arbeit, Germany)

Search live job listings from the **Bundesagentur für Arbeit Jobsuche**, the German
Federal Employment Agency's job board (`arbeitsagentur.de/jobsuche`), through its
public JSON API. No login, no personal API key, and **zero runtime dependencies**:
it runs with just `bun`.

The board aggregates employer postings plus partner boards (stellenanzeigen.de and
others). Partner postings carry an `externalUrl` that points to the original listing.

## When to use this skill

- Search for job openings anywhere in Germany, optionally around a city or postcode
- Filter by recency (published in the last N days)
- Get the full description, contract type, working time, start date and salary range of one posting

## Commands

### Search job listings

```bash
bun run .agents/skills/jobsuche-search/cli/src/cli.ts search --query "<text>" [flags]
```

Key flags:
- `--query <text>` / `-q <text>`: **required.** Job title, occupation or skill. **Use German terms.** The index is German, so `"Molekularbiologe"` returns dozens of hits where `"molecular biologist"` returns almost none. For English-titled roles (`"Data Scientist"`, `"Postdoc"`) the English title works.
- `--location <text>` / `-l <text>`: city or postcode, e.g. `"Berlin"`, `"München"`, `"69120"`.
- `--radius <km>` / `-r <km>`: distance around `--location` in km (0-200). Requires `--location`.
- `--jobage <days>`: published within the last N days (1-100). Omit for all postings.
- `--page <n>`: page number (1-indexed, 25 results per page).
- `--limit <n>` / `-n <n>`: cap the results emitted (client-side).
- `--format json|table|plain`: default `json`.

Only regular employment (`angebotsart=1`, "Arbeit") is searched. Apprenticeships and
self-employment listings are excluded.

### Fetch full job detail

```bash
bun run .agents/skills/jobsuche-search/cli/src/cli.ts detail <refnr|url> [--format json|plain]
```

`refnr` is the `id` from `search` results (e.g. `10001-1003956881-S`, `17296-0008376:01-S`).
A public `https://www.arbeitsagentur.de/jobsuche/jobdetail/<refnr>` URL is accepted too.

## Usage examples

```bash
# Molecular biology roles anywhere in Germany
bun run .agents/skills/jobsuche-search/cli/src/cli.ts search -q "Molekularbiologe" --format table

# Biology roles within 50 km of Heidelberg, last 14 days
bun run .agents/skills/jobsuche-search/cli/src/cli.ts search -q "Biologe" -l "Heidelberg" -r 50 --jobage 14 --format table

# Postdoc positions in Berlin
bun run .agents/skills/jobsuche-search/cli/src/cli.ts search -q "Postdoc" -l "Berlin" -r 25 --format table

# Lab technician roles around Munich, second page
bun run .agents/skills/jobsuche-search/cli/src/cli.ts search -q "Biologielaborant" -l "München" -r 30 --page 2 --format table

# Full detail for one posting
bun run .agents/skills/jobsuche-search/cli/src/cli.ts detail 10001-1003956881-S --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default: programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

Search JSON: `{ "meta": { "count", "page", "total" }, "results": [{ id, title, company, location, date, url, occupation, externalUrl }] }`.
`total` is the API's total hit count across all pages. Missing values are `null`.

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data source: `rest.arbeitsagentur.de/jobboerse/jobsuche-service` (search `pc/v6/jobs`, detail `pc/v4/jobdetails/<base64 refnr>`). The `X-API-Key: jobboerse-jobsuche` header is the API's fixed public client ID, documented at jobsuche.api.bund.dev. It is not a personal credential.
- `www.arbeitsagentur.de/robots.txt` allows all paths. The API host has no robots.txt. Keep volume modest anyway, since this is a public service.
- **Query language matters:** search in German occupation terms (`Biologe`, `Molekularbiologe`, `Laborleiter`, `Wissenschaftliche/r Mitarbeiter/in`).
- Descriptions are the employer's own text. Some partner feeds arrive truncated or with words cut short (seen live: "analytischen Met" for "Methoden"). That is the source data, not a parsing bug. Open `externalUrl` for the original.
- `date` is the publication start (`veroeffentlichungszeitraum.von`). The API returns no application deadline field; deadlines ("Bewerbungsschluss") appear inside the description when the employer gives one.
- `detail` returns `NOT_FOUND` when a posting has expired or been withdrawn.
- jobvector.de (STEM-focused) is not covered by a CLI because it sits behind a Cloudflare challenge. `/scrape` reaches it through `site:jobvector.de` web searches instead (see `.claude/skills/job-scraper/search-queries.md`).
