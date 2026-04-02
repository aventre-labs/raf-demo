# CHANGES.md

## Parameter Controls + Pipeline Update

### New: `src/components/ParameterPanel.tsx`
A collapsible glass-morphism panel inserted between the mode tabs and the input area.

**Controls added:**
- **Number of Voters** — slider, range 1–7, default 3 (paper default)
- **Decompose TopK** — slider, range 1–20, default 2
- **Solve TopK** — slider, range 1–20, default 4
- **Decomposition Depth** — slider, range 1–10, default 5
- **Voting Strategy** — pill selector: Majority / Weighted / Unanimous
- **"Reset to paper defaults (Auto)"** — resets all to paper defaults; disabled when already at defaults
- **Model badge** — live indicator showing "Llama 3.1 8B · Taalas HC1 · ~17k tok/s"
- Amber dot appears in collapsed header when non-default params are active
- Summary line in collapsed state shows current config at a glance

### Updated: `src/services/raf-pipeline.ts`
- `runRAFPipeline` now accepts an optional `RAFParams` argument (3rd param, defaults to paper defaults)
- Decompose step uses `params.decompTopK` and `params.decompositionDepth`
- Solve step uses `params.solveTopK`
- Number of voters is fully dynamic (`params.numVoters`, clamped 1–7)
- New `voter_start` stage event fires before each voter — carries `index`, `color`, `total` for graph
- Three voting strategies implemented: `majority`, `weighted` (frequency-ratio, currently same as majority), `unanimous` (falls back to majority if not all agree)
- Voter colors extended to 7 (orange, green, cyan, purple, pink, yellow, teal)

### Updated: `src/App.tsx`
- `RAFParams` state initialized to `DEFAULT_PARAMS`
- `ParameterPanel` rendered between tabs and mode content area
- `voterColors` array extended to 7 entries
- `voting` stage replaced by `voter_start` — graph adds all voter nodes dynamically based on `total`
- Custom tab description reflects live voter count + voting strategy
- `params` passed through to `runRAFPipeline`

### Build
- `npm run build` — clean, no errors, no warnings
- Output: `dist/` (380 kB JS gzip 124 kB, 28 kB CSS)

### Known Issues / Future Work
- Weighted voting is currently identical to majority vote — true confidence weighting would require the model to output a confidence score
- CORS proxy (`corsproxy.io`) is subject to downtime; simulation fallback in `chatjimmy.ts` handles this
- GitHub Pages deployment workflow exists but PAT in `TASK.md` may be expired
