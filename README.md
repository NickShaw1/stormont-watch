# Stormont Watch

Every vote. Every MLA. Since May 2022.

Stormont Watch tracks every division vote in the Northern Ireland Assembly,
attendance records, expenses and legislation covering the full 2022-2027 mandate.

## Tech stack

- Next.js 14 (static generation)
- TypeScript
- Neon Postgres + Drizzle ORM
- Cloudflare Pages

## Data source

All data sourced from the [NI Assembly Open Data API](http://data.niassembly.gov.uk).

## Sync scripts

Daily sync runs automatically via GitHub Actions. See `scripts/` for individual sync scripts.

## Development

```bash
npm install
npm run dev
```

Requires `DATABASE_URL` in `.env.local`.

## Environment variables

| Variable                      | Description                                              |
|-------------------------------|----------------------------------------------------------|
| `ASSEMBLY_API_BASE`           | NI Assembly API base URL (default: `http://data.niassembly.gov.uk`) |
| `ASSEMBLY_SUSPENDED`          | Set to `true` to display the suspension banner           |
| `ASSEMBLY_LAST_SITTING_DATE`  | ISO date of last sitting, shown in the suspension banner |
| `ASSEMBLY_RETURN_DATE`        | ISO date the Assembly returned, shown in the banner      |

## Data attribution

Voting data is sourced from the [NI Assembly Open Data API](http://data.niassembly.gov.uk), published by the Northern Ireland Assembly.
