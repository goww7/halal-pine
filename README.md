<p align="center">
  <h1 align="center">Halal Pine</h1>
  <p align="center"><strong>TradingView Pine Script that overlays Shariah-compliance status on any chart.</strong></p>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <a href="https://www.tradingview.com/pine-script-docs/en/v5/"><img src="https://img.shields.io/badge/Pine%20Script-v5-2962FF" alt="Pine v5"></a>
  <a href="https://halalterminal.com"><img src="https://img.shields.io/badge/HalalTerminal-API-10b981" alt="Halal Terminal API"></a>
  <a href=".github/workflows/refresh.yml"><img src="https://img.shields.io/badge/data-refreshed%20daily-22c55e" alt="Refreshed daily"></a>
</p>

```
TSLA  HALAL ✓                 ← rendered as a label on your chart
JPM   NON-COMPLIANT ✗
ABCD  NOT IN DATASET
```

---

## Why this exists

TradingView is where most retail traders live, but its native screening has nothing for Muslim investors. This is a Pine v5 indicator that overlays AAOIFI Shariah-compliance status on any chart, with:

- **Top-right summary table** — symbol + status + methodology
- **Above-bar label** — quick visual cue
- **Background ribbon** — green / red / gray tint
- **Alert** — fires when a non-compliant ticker is loaded
- **Plottable signal** — `+1 / -1 / 0` so you can chain it into screeners or strategies

Because Pine Script can't make HTTP calls, the compliance dataset is **baked into the script** at build time and refreshed daily by a GitHub Action against the [Halal Terminal API](https://halalterminal.com).

---

## Use it (no install — just copy)

1. Open the latest [`pine/halal-screener.pine`](pine/halal-screener.pine).
2. Copy the whole file into TradingView's Pine Editor (Pine v5).
3. **Save** → **Add to chart**.
4. Switch tickers and watch the badge update.

That's it. No build step required for end users.

> ℹ️ The committed `halal-screener.pine` ships as a hand-curated starter. Every day at 06:00 UTC the GitHub Action regenerates it against the live API and pushes the update — pull the repo or copy from GitHub for the freshest dataset.

---

## Build it yourself (full universe)

If you want to control the symbol universe or methodology:

```bash
git clone https://github.com/goww7/halal-pine.git
cd halal-pine
cp .env.example .env
# add HALAL_TERMINAL_API_KEY=ht_... — free key at halalterminal.com
node scripts/generate-pine.mjs
```

Edit `pine/symbols.txt` to include your tickers (one per line, `#` comments allowed). Re-run the script and copy `pine/halal-screener.pine` into TradingView.

---

## How it works

1. `pine/symbols.txt` lists the ticker universe.
2. `scripts/generate-pine.mjs` calls `POST /api/screen/{symbol}` for each, classifies the verdict as `pass`/`fail`/`unknown`, and writes a Pine v5 file that contains two embedded `array<string>` constants — `HALAL` and `HARAM`.
3. The Pine indicator looks up `syminfo.ticker` against those arrays, draws the badge/ribbon/table, and fires an alert if the ticker is non-compliant.
4. A GitHub Action runs `node scripts/generate-pine.mjs` every day at 06:00 UTC and commits the refreshed file.

To enable the daily refresh on a fork, set a `HALAL_TERMINAL_API_KEY` repo secret.

---

## Configuration

| Env var | Default | Description |
|---|---|---|
| `HALAL_TERMINAL_API_KEY` | required | Free key at [halalterminal.com](https://halalterminal.com) |
| `HALAL_API_BASE` | `https://api.halalterminal.com` | Override the API host |
| `HALAL_PINE_LIMIT` | unlimited | Cap symbols screened (useful during dev) |
| `HALAL_PINE_CONCURRENCY` | `4` | Parallel screen requests |

---

## Customizing the Pine

- **Methodology** — the API returns AAOIFI by default. To use DJIM/FTSE/MSCI/S&P, extend the `screen` call in `scripts/generate-pine.mjs` to pass `methodology` and bake separate `HALAL_DJIM` / `HALAL_FTSE` arrays.
- **Visual style** — tweak `statusColor` and `statusBg` in `scripts/generate-pine.mjs` (the renderer template).
- **More fields** — Pine arrays support strings only, so to embed ratios you'd need parallel arrays (`HALAL_DEBT_RATIO`, etc.). Keep the symbol list short if you go that route — Pine has line-count limits.

---

## Disclaimer

Automated screening, **not a fatwa**. Consult a qualified scholar for personal rulings.

---

## Related projects

Other open-source tools in the Halal Terminal ecosystem:

| Project | What it is |
|---|---|
| [**halal-discord-bot**](https://github.com/goww7/halal-discord-bot) | Discord bot — `/halal`, `/portfolio`, `/trending` slash commands |
| [**halal-portfolio-tracker**](https://github.com/goww7/halal-portfolio-tracker) | Next.js portfolio compliance tracker (one-click Vercel deploy) |
| [**halalterminal-claude-skills**](https://github.com/goww7/halalterminal-claude-skills) | Claude Code plugin with screening skills + portfolio-builder subagent |
| [**halalterminal-mcp**](https://github.com/goww7/halalterminal-mcp) | MCP server for any MCP-compatible client (Cursor, Cline, Codex…) |
| [**yassir-oss**](https://github.com/goww7/yassir-oss) | Open-source ReAct agent for financial research |

---

## License

MIT — see [LICENSE](LICENSE).

<p align="center"><sub>Built on top of <a href="https://halalterminal.com">Halal Terminal</a>.</sub></p>
