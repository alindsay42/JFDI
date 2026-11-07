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

## The app

The live app is at https://alindsay42.github.io/JFDI/. Every pull request gets a test version at `/JFDI/pr-preview/pr-<number>/`, linked from the pull request. A test version keeps its data apart from the live app.

| Path | What |
| --- | --- |
| [`src/engine/`](src/engine/) | Training rules, with no screen code. Every line must be tested |
| [`src/store/`](src/store/) | The on-device database |
| [`src/train/`](src/train/), [`src/shared/`](src/shared/) | Screens |
| [`src/formats/generated/`](src/formats/generated/) | Types generated from `schema/` |
| [`tests/engine/`](tests/engine/) | Rule tables (`*.rules.ts`), which are both tests and [`docs/rules.md`](docs/rules.md) |
| [`tests/e2e/`](tests/e2e/) | Whole-app tests in a real browser |
| [`.github/workflows/`](.github/workflows/) | Checks on every pull request, test versions, publishing on merge |

## Commands

```
npm install
npm run dev               # the app, locally
npm run validate          # data/ and every file in examples/
npm run catalogue         # regenerate docs/catalogue.md after changing data/
npm run types             # regenerate src/formats/generated/ after changing schema/
npm run rules             # regenerate docs/rules.md after changing a rule table
npm test                  # formats, generated files, type check, unit tests with coverage
npm run check             # npm test, then build and run the whole-app tests
```

## Conventions

- Weights are kilograms and always include the bar.
- Requirements live in the J.F.D.I Requirements doc. Requirement ids (AR-1, ST-3 and so on) are used in commits and code comments.
