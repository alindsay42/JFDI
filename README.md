# J.F.D.I

Build training programmes and run them in the gym. One app with two modes: Train mode for logging sessions on the garage tablet, and Build mode for making programmes from templates or from scratch.

## Where things are

| Path | What |
| --- | --- |
| [`docs/programme-format.md`](docs/programme-format.md) | The programme file format: what a plan looks like as data |
| [`docs/equipment-and-library.md`](docs/equipment-and-library.md) | The household equipment list and the exercise library: formats and rules |
| [`docs/profile-and-log.md`](docs/profile-and-log.md) | Profiles (one per person) and the training log, plus importing from Rebuild Log |
| [`docs/architecture.md`](docs/architecture.md) | How the app is built: technology, code layout, testing, releases and build order (proposal) |
| [`docs/catalogue.md`](docs/catalogue.md) | Every piece of equipment and every exercise, as tables (generated) |
| [`data/`](data/) | The household equipment list and the exercise library |
| [`schema/`](schema/) | JSON Schemas for programmes, equipment, the library, profiles and logs |
| [`examples/`](examples/) | Programmes, profiles and logs that must always pass validation |
| [`tests/invalid/`](tests/invalid/) | Broken files that must always be rejected, each for the reason listed in `expected-errors.json` |
| [`tests/fixtures/`](tests/fixtures/) | A sample Rebuild Log backup for testing the importer |
| [`scripts/validate.mjs`](scripts/validate.mjs) | Checks every file against its schema and the cross-reference rules |
| [`scripts/import-rebuild-log.mjs`](scripts/import-rebuild-log.mjs) | Converts a Rebuild Log backup into a J.F.D.I training log |

## Checking programme files

```
npm install
npm run validate          # data/ and every file in examples/
npm run catalogue         # regenerate docs/catalogue.md after changing data/
npm test                  # all of the above, the Rebuild Log import, and every file in tests/invalid/ rejected for its listed reason
```

## Conventions

- Weights are kilograms and always include the bar.
- Requirements live in the J.F.D.I Requirements doc. Requirement ids (AR-1, ST-3 and so on) are used in commits and code comments.
