# J.F.D.I

Build training programmes and run them in the gym. One app with two modes: Train mode for logging sessions on the garage tablet, and Build mode for making programmes from templates or from scratch.

## Where things are

| Path | What |
| --- | --- |
| [`docs/programme-format.md`](docs/programme-format.md) | The programme file format: what a plan looks like as data |
| [`docs/equipment-and-library.md`](docs/equipment-and-library.md) | The household equipment list and the exercise library: formats and rules |
| [`docs/catalogue.md`](docs/catalogue.md) | Every piece of equipment and every exercise, as tables (generated) |
| [`data/`](data/) | The household equipment list and the exercise library |
| [`schema/`](schema/) | JSON Schemas for programmes, equipment and the library |
| [`examples/`](examples/) | Programme files that must always pass validation |
| [`tests/invalid/`](tests/invalid/) | Broken programme files that must always be rejected |
| [`scripts/validate.mjs`](scripts/validate.mjs) | Checks files against the schema and the cross-reference rules |

## Checking programme files

```
npm install
npm run validate          # data/ and every file in examples/
npm run catalogue         # regenerate docs/catalogue.md after changing data/
npm test                  # all of the above, plus every file in tests/invalid/ must be rejected for its expected reason
```

## Conventions

- Weights are kilograms and always include the bar.
- Requirements live in the J.F.D.I Requirements doc. Requirement ids (AR-1, ST-3 and so on) are used in commits and code comments.
