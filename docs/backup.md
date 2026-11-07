# Backup, restore and importing

Status: **built in step 2**.

## Backup file

One JSON file holds everything the app keeps for the household. It's checked by [`schema/backup.schema.json`](../schema/backup.schema.json).

| Field | Holds |
| --- | --- |
| `format`, `formatVersion` | `jfdi-backup`, version 1 |
| `exportedAt` | When the backup was made |
| `app` | The app version and commit that made it |
| `profiles` | Every person, in the [profile format](profile-and-log.md) |
| `programmes` | Every programme on the device, in the [programme format](programme-format.md) |
| `logs` | One [training log](profile-and-log.md) per person |

The equipment list and the exercise library come with the app, so they aren't in the backup.

The file is named `jfdi-backup-YYYY-MM-DD.json` and saved to the device's Downloads folder.

## Restore

- **All or nothing.** The whole file is checked first: every schema, and every cross-check between profiles, programmes, logs, the library and the equipment list. If anything fails, nothing changes, and the problems are listed.
- **Replaces everything.** Restoring replaces every person, programme and log on the device. The app asks first, and says how many people and sessions the backup holds.
- Programmes that come with the app are brought up to date after a restore.

## Importing from Rebuild Log

This brings a Rebuild Log backup into one person's history. The conversion is described in [profile-and-log.md](profile-and-log.md#importing-from-rebuild-log).

- **Safe to repeat.** Imported sessions are added, or updated if they came from Rebuild Log before. Days and weigh-ins only fill dates that are empty.
- **Never overwrites J.F.D.I's own data.** A session logged in J.F.D.I is never replaced by an imported one.
- The app reports what came across, and anything it couldn't match.

## Backup reminder

A reminder shows on the "Who's training?" screen when something has changed since the last backup, and that backup was 7 or more days ago, or there has never been one. Restoring a backup counts as backed up.

## Test versions

Each pull request's test version keeps its own database, named `jfdi-test-pr-<number>`. Backups and restores there never touch the live app.
