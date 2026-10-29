# Agent run reaper

Long agent jobs stay `running` or `claimed` while they are still working. The reaper fails a row only when it has had **no heartbeat for more than one hour**. `started_at` alone does not end a job that is still touching `heartbeat_at`.

A run that has never heartbeated is judged by `started_at`. Exactly one hour is still alive.

The Hebrew reason stored on the row is `ההרצה נתקעה יותר משעה בלי לסיים.`

## Heartbeat

`agent_runs.heartbeat_at` is set when work happens:

- `os.start_run` (including a resume of a run that is already running)
- `os.poll_work` after a queued run is claimed
- `os.heartbeat` for every open run of that agent
- `os.log`, `os.report_cost`, and call/social tools that carry a `run_id`

`os.heartbeat` remains the presence ping on `agents.hermes_last_seen_at`. It also refreshes open runs, so a long job survives while the worker keeps calling it.

The column is added by `supabase/migrations/20261029201500_agent_runs_heartbeat.sql`. **That migration is not applied from this repo.** Until it is applied, heartbeat writes are ignored and the reaper still uses `started_at`, which is the previous behavior. Claiming a queued run also sets `heartbeat_at` inside `claim_queued_agent_run` once that migration is applied.

## Cron route

The reaper already runs from agent poll, heartbeat, start, and the call-control screen. A clock can call it when no agent is polling:

`POST` or `GET` `/api/cron/reap-agent-runs`

Middleware does not match `/api`, so the route checks its own secret.

| | |
|---|---|
| Env | `AGENT_REAPER_CRON_SECRET` |
| Header | `Authorization: Bearer <secret>` or `x-cron-secret: <secret>` |
| Unset secret | `503` `{ "ok": false, "error": "cron secret is not configured" }` |
| Wrong secret | `401` |
| Success | `200` `{ "ok": true, "failed": <number> }` |

The secret is only an environment variable. It is not stored in the repo. `.env.example` lists the name with an empty value.

The route does nothing useful until the secret is set **and** something calls it. A 10–15 minute timer is enough. Example, with the secret in the environment of the caller, not in this file:

```bash
curl -fsS -X POST \
  -H "Authorization: Bearer ${AGENT_REAPER_CRON_SECRET}" \
  "https://liba.os.example/api/cron/reap-agent-runs"
```

Replace the host with the real site URL. Do not commit the secret or put it in the query string.
