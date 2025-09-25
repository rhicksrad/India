# India Food × Cancer Insight

This project explores potential relationships between Indian regional cuisine patterns and reported cancer incidence by state/UT from 2019–2022. It ships as a static, client-side dashboard built with Vite, TypeScript, pnpm, and D3. The site renders an interactive tile-based choropleth of India, multiple cuisine/cancer metrics, and comparison tooling including scatterplots, correlation estimates, and residual analysis.

## Data

The repository includes two source CSV files under `data/`:

- `cancer_incidence_india.csv`: annual incident cancer case counts per State/UT (2019–2022). Source: RS_Session_258_AU_1555_1.csv (provided).
- `indian_food.csv`: dishes by region/state with ingredients, diet, timings, and flavor profile from the “Indian Food 101” dataset.

A preprocessing script (`scripts/build-data.ts`) normalises state names, aggregates cuisine features, computes incidence CAGR for 2019→2022, and writes derived JSON artifacts to `public/derived/`:

- `cancer_by_state.json`
- `cuisine_by_state.json`
- `joined_state_metrics.json`

The map geometry lives at `public/geo/india_states.topo.json` and encodes a simplified state tile topology.

All derived files are generated locally (no network fetches at build time) and remain under 1 MiB.

## Development

Prerequisites: Node 20+ and pnpm.

```bash
pnpm install
pnpm dev
```

Open the printed local URL to view the app in development mode. The `prebuild` hook runs the data preparation script so derived JSON stays in sync.

### Build

```bash
pnpm run build
```

This command regenerates derived data and bundles the static site into `dist/`. The repository includes a GitHub Actions workflow (`.github/workflows/pages.yml`) that deploys the `dist` folder to GitHub Pages on pushes to `main`.

## Notes & Limitations

- State names from both datasets are normalised to a canonical set (e.g. “NCT of Delhi” → “Delhi”, “Orissa” → “Odisha”, “Pondicherry” → “Puducherry”, aggregated union territory entries, etc.). Rows with ambiguous state identifiers such as `-1` are ignored.
- Cuisine ingredient tokens are derived by lowercasing, trimming punctuation, and splitting on commas; ingredient frequency counts are stored per state for UI inspection.
- The choropleth uses a tile-based topology to keep the asset lightweight while preserving quick regional comparisons; it is not an exact geographic outline.
- Cancer incidence residuals are based on simple linear regression and Pearson r; they should be interpreted cautiously and not as causal evidence.

Data sources retain their original licensing terms.
