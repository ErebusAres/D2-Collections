# Fireteam reliability rollout — September 2026

## Implemented in this stage

- Fireteam and Recent Loot reads no longer execute Bungie refreshes through `waitUntil`.
- Existing Worker cron invocations drain durable D1 work: one full-progress job and one Recent Loot job per minute; presence handles up to three active viewers independently. Full progress is due every five minutes. Idle sharing alone does not schedule expensive progress work. Enabled watchers remain independent of browser activity.
- Recent Loot requests persist demand, selected character, retry deadline, and lease. Its inventory-definition lookup uses eight compact shards instead of up to 24 companion shards. The old lookup remains only for the API-before-web rollout window.
- Missing transitory data is not a departure observation. Repeated presence snapshots do not advance absence counters. Source timestamps determine presence freshness. Full-progress commits retain newer roster observations and reject concurrent settings changes.
- Browser reads time out after 15 seconds, including response-body reads. Five-second Fireteam polling ends after the first 30 seconds of a refresh attempt. Browser cooldowns no longer create additional Cloudflare incidents.
- Watcher actions check their claim before each action/batch; character/configuration changes invalidate the claim. Completion uses the same claim guard. Junk tagging preserves manual tags written during the run. Lock actions are bounded to five per pass; remaining locks retain retry eligibility. The last result summary is visible on Fireteam.
- Help retains the last service incident for copying after the live banner clears. Roster checks and shared-progress status are shown separately. Expired authorization has specific reconnect text.

## Production evidence before rollout

Read-only D1 inspection on September 12 found three shared accounts, one account requiring reauthorization, a recently successful independent watcher, an abandoned full-refresh lease, and a recorded Recent Loot subrequest-limit error. These are separate failure modes. The historical 1102 reports alone do not identify CPU versus memory exhaustion.

No hosting subscription, billing limit, or paid service is added. Equivalent minute cron expressions distinguish workload families in the existing Worker. Jobs still obey persisted due times; polling does not create duplicate queue entries.

## Release and observation gates

1. Run `pnpm run audit` (the repository script, not the package-manager vulnerability audit).
2. CI generates the compact observation artifacts, applies additive migration 0034, and deploys API then web. Preserve old data and migrations for rollback; do not drop tables or clear user state.
3. Verify the five scheduled expressions are installed, the compact artifact is served, and D1 records successful Recent Loot / watcher checks after deployment. Observe the desktop Fireteam refresh without reloading.
4. Observe for 48 hours before calling the work stable. Check active viewers' source/check times, expired leases, last error categories, watcher summaries, and runtime errors. An idle roster is intentionally not refreshed; enabled watchers must continue.

## Still requires evidence or follow-up

- Three-account party join/leave, offline, privacy, and character-switch validation against the real game.
- Closed-browser watcher actions under new loot, full inventory/vault, partial Bungie failures, and settings changes. Do not enable watchers or move gear merely to manufacture a test.
- Sustained CPU/memory/subrequest measurements and fault injection. Wall-clock request durations are not CPU measurements.
- Broader Xur/Build Advisor background isolation, cross-tab request coordination, and the complete item-card/desktop usability checklist from the accepted plan.
- Dependency audit separately reported development-tool advisories; dependency upgrades are not included in this reliability stage.

Passing tests or quieter banners is not proof that all external failures are resolved.
