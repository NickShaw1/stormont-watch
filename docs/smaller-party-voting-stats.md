# Smaller Party Vote Alignment — Stat Design

## What it shows

For each of the four scenarios below, the % of divisions where each smaller party voted the same way as the named big party:

| Party | SF Yes | SF No | DUP Yes | DUP No |
|-------|--------|-------|---------|--------|
| Alliance | ?% | ?% | ?% | ?% |
| SDLP | ?% | ?% | ?% | ?% |
| UUP | ?% | ?% | ?% | ?% |
| TUV | ?% | ?% | ?% | ?% |
| PBP | ?% | ?% | ?% | ?% |
| Ind | ?% | ?% | ?% | ?% |

- **SF Yes** — of all divisions where SF voted Yes, % where this party also voted Yes
- **SF No** — of all divisions where SF voted No, % where this party also voted No
- **DUP Yes** — of all divisions where DUP voted Yes, % where this party also voted Yes
- **DUP No** — of all divisions where DUP voted No, % where this party also voted No

A party vote counts if the majority of that party's present members voted that way.

---

## Display

- Full-width table
- Placed below the Party Attendance chart in the MLA Voting section of the stats page
- Section heading: **"How smaller parties vote with SF & DUP"** (or similar)
- No chart — table only

---

## Data / SQL sketch

For each scenario, the denominator is all divisions where SF (or DUP) voted a given way as a party majority. The numerator is the subset of those where the smaller party also voted the same way as a majority.

```sql
-- Example: SF Yes alignment for Alliance
SELECT
  COUNT(*) FILTER (
    WHERE alliance_majority_vote = 'yes'
  )::float
  / COUNT(*) AS alliance_sf_yes_alignment
FROM (
  SELECT
    d.id,
    -- SF majority vote on this division
    -- Alliance majority vote on this division
  FROM divisions d
  -- join votes, group by party per division
) sub
WHERE sf_majority_vote = 'yes'
```

Party majority vote per division = whichever way the majority of that party's present members voted (ignoring absences).
