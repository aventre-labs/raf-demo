# RAF Demo — Recursive Agent Framework

[![Live Demo](https://img.shields.io/badge/Live%20Demo-aventre--labs.github.io%2Fraf--demo-10b981?style=for-the-badge)](https://aventre-labs.github.io/raf-demo/)

An interactive single-page demo of the **Recursive Agent Framework (RAF)**: a structured inference pipeline showing how an **8B model can reach 92% on GSM8K, surpassing a 70B model baseline at 83.7%** through decomposition and majority voting.

## What this demonstrates

RAF improves reasoning quality by replacing single-pass generation with a structured execution graph:

```text
Problem
  ↓
Decompose into sub-steps
  ↓
Run 3 independent solver traces
  ↓
Extract answers from each trace
  ↓
Majority vote final result
```

Instead of asking a model to “just solve it,” RAF explicitly scaffolds intermediate reasoning, creates diverse solution attempts, and aggregates them into a more reliable answer.

## Features

- **Interactive D3 execution graph** with force simulation, drag, zoom, and animated edges
- **Custom prompt mode** for arbitrary reasoning tasks
- **Benchmark explorer** with GSM8K, logic puzzles, Tower of Hanoi, HumanEval, arithmetic, and competition math
- **Animated results UI** with decomposition steps, voter traces, and majority-vote summary
- **Inference stats bar** showing tokens/sec, TTFT, total tokens, and runtime
- **Fallback simulation mode** so the demo still works if the ChatJimmy API is unavailable
- **Local session history** persisted in browser localStorage
- **GitHub Pages-ready** Vite config and deployment workflow

## Screenshots

> Placeholder — add polished product screenshots after deployment.

## Paper

The RAF paper is bundled in `public/RAF-Paper.pdf` and linked directly from the UI.

## Run locally

```bash
git clone https://github.com/aventre-labs/raf-demo.git
cd raf-demo
npm install
npm run dev
```

Build for production:

```bash
npm run build
npm run preview
```

## Tech stack

- **Vite** + **React** + **TypeScript**
- **Tailwind CSS v4**
- **D3.js v7** for the execution graph
- **Framer Motion** for interface animation
- **Lucide React** for iconography
- **Google Fonts**: Space Grotesk, Plus Jakarta Sans, JetBrains Mono

## Deployment

GitHub Pages deployment is handled by `.github/workflows/deploy.yml`.

Vite is configured with:

```ts
base: '/raf-demo/'
```

so the site resolves correctly at:

<https://aventre-labs.github.io/raf-demo/>

## Citation

```bibtex
@misc{raf_demo_2026,
  title        = {RAF Demo — Recursive Agent Framework},
  author       = {Aventre Labs},
  year         = {2026},
  howpublished = {GitHub Pages},
  url          = {https://aventre-labs.github.io/raf-demo/}
}
```

## License

MIT License

## Credits

Built for public demonstration of the Recursive Agent Framework concept and its structured-reasoning performance advantages.
