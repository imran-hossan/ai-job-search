---
name: stellenanzeigen-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search stellenanzeigen.de, one of
  Germany's large general job boards, or look up a posting from it. It carries
  employer ads plus partner feeds (yourfirm, regional newspapers, Appcast), with
  salary ranges and application deadlines where given. Invoke for jobs in
  Germany alongside jobsuche-search, even if the user does not name the site.
  Trigger phrases: stellenanzeigen.de, Stellenanzeigen, jobs in Germany, German
  job search, Stellenangebote, Stellensuche, offene Stellen, Jobs in
  Deutschland, Job suchen, Jobbörse.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/stellenanzeigen-search/cli/src/cli.ts *)
---

# stellenanzeigen.de Search Skill (Germany)

Search live job listings on **stellenanzeigen.de** from its public search and job pages.
No login, no API key, and **zero runtime dependencies**: it runs with just `bun`.

The CLI reads the structured job data the site embeds in its own pages (the Next.js
payload on search pages, the schema.org `JobPosting` block on job pages) rather than
scraping visual markup.

## When to use this skill

- Search for jobs anywhere in Germany, optionally around a city
- Filter by how recently an ad went online (1, 7 or 30 days)
- Get the full description, employment type, salary range and "online until" date of one posting

## Commands

### Search job listings

```bash
bun run .agents/skills/stellenanzeigen-search/cli/src/cli.ts search --query "<text>" [flags]
```

Key flags:
- `--query <text>` / `-q <text>`: **required.** Job title or skill. **Use German terms.** `"Molekularbiologe"` finds exact matches where `"molecular biologist"` finds none.
- `--location <text>` / `-l <text>`: city name, e.g. `"Berlin"`, `"München"`, `"Heidelberg"`.
- `--radius <km>` / `-r <km>`: distance around `--location`. The site only accepts `10, 20, 30, 40, 50, 75, 100, 200` (default 30). Requires `--location`.
- `--jobage <days>`: ads online for at most N days. The site only accepts `1`, `7` or `30`.
- `--page <n>`: page number (1-indexed, 25 listings per page).
- `--limit <n>` / `-n <n>`: cap the results emitted (client-side).
- `--similar`: also emit the site's "ähnliche Jobs" (similar listings that do not contain the keyword), marked `"relevant": false`. **Default is exact matches only.**
- `--format json|table|plain`: default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/stellenanzeigen-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the `id` from `search` results (`SDE-129508`, `JIM-355121`, `REG-46516`, `YF-52839`,
`16417754`). A `https://www.stellenanzeigen.de/job/<slug>-<id>/` URL is accepted too.
Passing the result's `url` is the most robust form.

## Usage examples

```bash
# Molecular biology roles anywhere in Germany
bun run .agents/skills/stellenanzeigen-search/cli/src/cli.ts search -q "Molekularbiologe" --format table

# Biology roles within 50 km of Heidelberg, online for at most 30 days
bun run .agents/skills/stellenanzeigen-search/cli/src/cli.ts search -q "Biologe" -l "Heidelberg" -r 50 --jobage 30 --format table

# Lab roles in Berlin, including similar listings
bun run .agents/skills/stellenanzeigen-search/cli/src/cli.ts search -q "Laborant" -l "Berlin" --similar --format table

# Full detail for one posting
bun run .agents/skills/stellenanzeigen-search/cli/src/cli.ts detail SDE-129508 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default: programmatic use, passing `url`/`id` to `detail` |
| `table` | Quick human-readable scanning (`~` marks similar listings) |
| `plain` | Reading a single job's full detail (`detail` command) |

Search JSON: `{ "meta": { "count", "page", "total", "totalWithSimilar" }, "results": [{ id, title, company, location, date, url, relevant, deadline, salary }] }`.
`total` is the site's exact-match count ("N Jobs"). `totalWithSimilar` includes the similar listings.
`deadline` is the ad's "online until" date, which is often but not always the application deadline. Missing values are `null`.

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- robots.txt allows `/suche/` and `/job/` for generic agents (only `bingbot` is barred from `/suche/*fulltext=`). The published terms (employer AGB) contain no automation clause. The Impressum reserves copyright on site content, so keep use personal and volume low.
- Location is matched by city name (`locationIds=<city>`). There is no postcode support, and the place-suggest endpoint is disallowed by robots.txt, so the CLI does not call it.
- Thin result sets are real: narrow keyword + city + `--jobage` combinations often return 0. Drop `--jobage` or widen `--radius` before concluding a parser problem.
- Many listings also appear on the Bundesagentur Jobsuche (`jobsuche-search`), often with a link back here. stellenanzeigen.de's own copy can be more complete: partner feeds into Jobsuche sometimes truncate the text.
- `PARSE_FAILED` means a search page loaded but had no embedded job data, which points to a site redesign. See `url-reference.md`.
- Unknown or expired ids return the site's "nicht gefunden" page with HTTP 200. The CLI reports `NOT_FOUND`.
