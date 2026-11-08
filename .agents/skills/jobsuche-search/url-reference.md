# Bundesagentur für Arbeit Jobsuche: API Reference

Public JSON API behind `https://www.arbeitsagentur.de/jobsuche`. Community docs:
<https://jobsuche.api.bund.dev>. Verified live 2026-11-09.

Every request sends:

| Header | Value |
|--------|-------|
| `X-API-Key` | `jobboerse-jobsuche` (fixed public client ID of the web app, not a secret) |
| `User-Agent` | `Mozilla/5.0 (compatible; jobsuche-cli/1.0)` |
| `Accept` | `application/json` |

Base: `https://rest.arbeitsagentur.de/jobboerse/jobsuche-service`

> Version quirk (2026-11): search answers only on **`pc/v6/jobs`** (v3/v4/v5 return 403).
> Detail answers only on **`pc/v4/jobdetails`** (v2/v6 return 403). If either starts
> returning 403, probe neighbouring versions first.

## Search

```
GET /pc/v6/jobs?was=<query>&wo=<place>&umkreis=<km>&veroeffentlichtseit=<days>&angebotsart=1&page=<n>&size=<n>
```

| Param | Meaning | CLI flag |
|-------|---------|----------|
| `was` | Free-text query (title, occupation, skill). German terms match far better | `--query` |
| `wo` | City name or postcode | `--location` |
| `umkreis` | Radius around `wo`, km | `--radius` |
| `veroeffentlichtseit` | Published within N days (bund.dev: 0-100; 100 verified) | `--jobage` |
| `angebotsart` | 1 = Arbeit (other values per bund.dev: 2 Selbständigkeit, 4 Ausbildung/Duales Studium, 34 Praktikum/Trainee) | fixed `1` |
| `page` | 1-indexed page | `--page` |
| `size` | Page size | fixed `25` |

Other params documented at jobsuche.api.bund.dev but not exposed or verified by this CLI: `arbeitszeit` (`vz`, `tz`, `snw`, `ho`, `mj`), `befristung` (1 = befristet, 2 = unbefristet), `zeitarbeit`, `arbeitgeber`, `berufsfeld`.

### Response

```json
{
  "ergebnisliste": [ { ...posting... } ],
  "maxErgebnisse": 31,
  "page": 1,
  "size": 25,
  "facetten": { ... }
}
```

An empty search returns `maxErgebnisse: 0` and **no** `ergebnisliste` key.

Per posting (field → CLI output):

| API field | Output | Notes |
|-----------|--------|-------|
| `referenznummer` | `id` | e.g. `10001-1003857296-S`, `11858-SDE-129508-STA-S`, `17296-0008376:01-S` (colons occur) |
| `stellenangebotsTitel` | `title` | |
| `firma` | `company` | |
| `stellenlokationen[].adresse.{ort,region,land}` | `location` | `region` is an enum like `BADEN_WUERTTEMBERG`, mapped to display names |
| `veroeffentlichungszeitraum.von` (fallback `datumErsteVeroeffentlichung`) | `date` | `YYYY-MM-DD` |
| (derived) | `url` | `https://www.arbeitsagentur.de/jobsuche/jobdetail/<refnr>` (raw colon is fine) |
| `hauptberuf` | `occupation` | |
| `externeURL` | `externalUrl` | present for partner-board postings |

## Detail

```
GET /pc/v4/jobdetails/<base64(referenznummer)>
```

The path key is standard base64 (with padding) of the UTF-8 reference number.
404 means the posting is gone (`{"messages":[{"code":"STELLENANGEBOT_NICHT_GEFUNDEN"}]}`).

The detail response repeats the search fields and adds:

| API field | Output |
|-----------|--------|
| `stellenangebotsBeschreibung` | `description`: mostly plain text with `\n` and markdown (`***bold***`, `### heading`, `- item`). HTML is handled if present |
| `arbeitszeitVollzeit`, `arbeitszeitTeilzeit*`, `arbeitszeitSchichtNachtWochenende`, `istGeringfuegigeBeschaeftigung` | `workingTime` |
| `vertragsdauer` (`BEFRISTET`/`UNBEFRISTET`/`KEINE_ANGABE`) + `befristungInMonaten` / `befristetBis` | `contract` |
| `eintrittszeitraum.von` | `startDate` |
| `gehaltsspanneVon`, `gehaltsspanneBis`, `verguetungsangabe` | `salary` |
| `homeofficemoeglich` | `homeOffice` |
| `externeURL` ?? public URL | `applyUrl` |

No application-deadline field exists. Deadlines live in the description text.

## Access

- `https://www.arbeitsagentur.de/robots.txt`: `User-agent: * / Allow: /`.
- `https://rest.arbeitsagentur.de/robots.txt`: 403 (API host, none published).
- No login and no rate limit was observed at test volume. The CLI backs off on 429/5xx anyway.
