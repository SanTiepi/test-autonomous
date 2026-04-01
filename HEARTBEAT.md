# Heartbeat Checklist — Idea Lab

Read heartbeat-state.json. Run whichever check is most overdue.

## Repo Health (every 4h)
- git status on C:\PROJET IA\test-autonomous
- Check for uncommitted changes or stale branches
- Report ONLY if action needed

## Idea Quality Audit (every 12h)
- Read docs/idea-lab/BEST.md
- Count total ideas, check for duplicates
- Verify last 3 ideas have tavily-sourced market data
- Report ONLY if quality issues found

## Trend Freshness (every 24h)
- Check age of latest idea-lab output
- If > 48h since last generation, flag as stale
- Report ONLY if stale

If nothing needs attention: HEARTBEAT_OK
