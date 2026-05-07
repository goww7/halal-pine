#!/usr/bin/env node
// Generate a Pine Script v5 indicator with embedded Shariah-compliance data.
// Pine Script can't make HTTP calls, so we bake the verdicts into the script
// at build time and refresh daily via GitHub Action.
//
// Usage:  HALAL_TERMINAL_API_KEY=ht_... node scripts/generate-pine.mjs
// Output: pine/halal-screener.pine

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'pine', 'halal-screener.pine');
const SYMBOLS_FILE = resolve(ROOT, 'pine', 'symbols.txt');

const BASE_URL = process.env.HALAL_API_BASE || 'https://api.halalterminal.com';
const API_KEY = process.env.HALAL_TERMINAL_API_KEY;
const LIMIT = Number(process.env.HALAL_PINE_LIMIT || 0) || Infinity;
const CONCURRENCY = Number(process.env.HALAL_PINE_CONCURRENCY || 4);

if (!API_KEY) {
  console.error('HALAL_TERMINAL_API_KEY is required. Get a free key at https://halalterminal.com');
  process.exit(1);
}

function loadSymbols() {
  if (!existsSync(SYMBOLS_FILE)) {
    console.error(`Symbols file not found: ${SYMBOLS_FILE}`);
    process.exit(1);
  }
  return readFileSync(SYMBOLS_FILE, 'utf8')
    .split(/\r?\n/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s && !s.startsWith('#'));
}

async function screen(symbol) {
  const res = await fetch(`${BASE_URL}/api/screen/${encodeURIComponent(symbol)}`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
      'User-Agent': 'halal-pine/0.1',
    },
    body: '{}',
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${symbol}: ${json?.error || text.slice(0, 120)}`);
  return json;
}

function classify(raw) {
  const s = (raw || '').toString();
  // Order matters: "non-compliant" contains "compliant", so fail must be checked first.
  if (/fail|non[\s-]?compliant|haram|reject/i.test(s)) return 'fail';
  if (/pass|compliant|halal|accept/i.test(s)) return 'pass';
  return 'unknown';
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        try {
          out[idx] = await fn(items[idx]);
        } catch (err) {
          out[idx] = { error: err?.message || String(err) };
        }
      }
    }),
  );
  return out;
}

async function main() {
  const symbols = loadSymbols().slice(0, LIMIT);
  console.log(`Screening ${symbols.length} symbols (concurrency=${CONCURRENCY})...`);
  const t0 = Date.now();

  const responses = await pool(symbols, CONCURRENCY, async (sym) => {
    const r = await screen(sym);
    const result = r?.result || r || {};
    return {
      symbol: sym,
      status: classify(result.status || result.compliance || result.verdict),
      raw: result.status || result.compliance || result.verdict || 'unknown',
      methodology: result.methodology || result.standard || 'AAOIFI',
    };
  });

  const ok = responses.filter((r) => r && !r.error);
  const failed = responses.filter((r) => !r || r.error);
  console.log(`  ✓ ${ok.length} screened, ${failed.length} failed (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

  const halal = ok.filter((r) => r.status === 'pass').map((r) => r.symbol).sort();
  const haram = ok.filter((r) => r.status === 'fail').map((r) => r.symbol).sort();
  const generated = new Date().toISOString().split('T')[0];

  const pine = renderPine({ halal, haram, generated, total: ok.length });
  writeFileSync(OUT, pine, 'utf8');
  console.log(`Wrote ${OUT}`);
  console.log(`  halal:  ${halal.length}`);
  console.log(`  haram:  ${haram.length}`);
}

function pineList(symbols) {
  if (symbols.length === 0) return '""';
  // Pine arrays of strings, chunked across multiple lines for readability.
  const chunks = [];
  for (let i = 0; i < symbols.length; i += 12) {
    chunks.push(symbols.slice(i, i + 12).map((s) => `"${s}"`).join(', '));
  }
  return chunks.join(',\n      ');
}

function renderPine({ halal, haram, generated, total }) {
  return `// © Halal Terminal — MIT License
// SPDX-License-Identifier: MIT
//@version=5
//
// Halal Screener — overlays Shariah-compliance status on a chart.
//
// Data baked from Halal Terminal API on ${generated} (${total} symbols).
// Refreshed daily by GitHub Action — see https://github.com/goww7/halal-pine
//
// Powered by https://halalterminal.com — free API key, 200 screens/month.

indicator("Halal Screener", overlay = true, max_labels_count = 1)

// === Configuration ============================================================
var string GROUP_DISPLAY = "Display"
showBadge   = input.bool(true,  "Show compliance badge",      group = GROUP_DISPLAY)
showRibbon  = input.bool(true,  "Tint background by status",  group = GROUP_DISPLAY)
showSummary = input.bool(true,  "Show summary table",         group = GROUP_DISPLAY)

// === Embedded compliance data (generated ${generated}) ========================
var array<string> HALAL = array.from(
      ${pineList(halal)})

var array<string> HARAM = array.from(
      ${pineList(haram)})

// === Lookup ===================================================================
sym = syminfo.ticker
isHalal = array.includes(HALAL, sym)
isHaram = array.includes(HARAM, sym)

statusText = isHalal ? "HALAL ✓" : isHaram ? "NON-COMPLIANT ✗" : "NOT IN DATASET"
statusColor = isHalal ? color.new(color.green, 0) : isHaram ? color.new(color.red, 0) : color.new(color.gray, 30)
statusBg    = isHalal ? color.new(color.green, 92) : isHaram ? color.new(color.red, 92) : color.new(color.gray, 95)

// === Background ribbon ========================================================
bgcolor(showRibbon ? statusBg : na)

// === Top-right badge (drawn once per chart) ===================================
if showBadge and barstate.islast
    var label badge = na
    label.delete(badge)
    badge := label.new(
         x = bar_index, y = high,
         text = sym + "  " + statusText,
         style = label.style_label_left,
         color = statusColor,
         textcolor = color.white,
         size = size.normal,
         yloc = yloc.abovebar)

// === Summary table (top-right corner) =========================================
if showSummary and barstate.islast
    var table tbl = table.new(position.top_right, 2, 4, border_width = 1)
    table.cell(tbl, 0, 0, "Halal Screener", text_color = color.white, bgcolor = color.new(color.teal, 20))
    table.cell(tbl, 1, 0, "v" + str.tostring("${generated}"), text_color = color.white, bgcolor = color.new(color.teal, 20))
    table.cell(tbl, 0, 1, "Symbol",       text_color = color.gray)
    table.cell(tbl, 1, 1, sym,            text_color = color.white)
    table.cell(tbl, 0, 2, "Status",       text_color = color.gray)
    table.cell(tbl, 1, 2, statusText,     text_color = isHalal ? color.lime : isHaram ? color.red : color.silver)
    table.cell(tbl, 0, 3, "Methodology",  text_color = color.gray)
    table.cell(tbl, 1, 3, "AAOIFI",       text_color = color.silver)

// === Plottable signal (for use in screeners / strategies) =====================
plot(isHalal ? 1 : isHaram ? -1 : 0, title = "Halal Signal", color = color.new(color.teal, 100), display = display.none)

// === Alerts ===================================================================
alertcondition(isHaram, title = "Non-compliant ticker", message = "{{ticker}} is non-compliant under AAOIFI screening (Halal Terminal).")
`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
