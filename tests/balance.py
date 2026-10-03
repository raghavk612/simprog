from pathlib import Path
import json, sys
from playwright.sync_api import sync_playwright
N = int(sys.argv[1]) if len(sys.argv) > 1 else 150
with sync_playwright() as p:
    b = p.chromium.launch(headless=True); pg = b.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto((Path(__file__).resolve().parents[1] / 'dist' / 'road-to-the-championship-offline.html').as_uri()); pg.wait_for_load_state('load')
    res = pg.evaluate("""(N) => { const out = {}; for (const diff of ['rookie','varsity','legend']) for (const pol of ['smart','naive']) {
        const k = diff+'/'+pol; const c = {}; let w=0,l=0; const grades={};
        for (let i=0;i<N;i++){ const r = RTC.autoSeason({diff, policy:pol, seed: k+i}); c[r.kind]=(c[r.kind]||0)+1; w+=r.rec.w; l+=r.rec.l; grades[r.grade]=(grades[r.grade]||0)+1; }
        out[k] = {endings:c, winPct:(w/(w+l)).toFixed(3), grades}; } return out; }""", N)
    for k,v in res.items(): print(k, json.dumps(v))
    print('page errors:', errs[:5])
    b.close()
