import json, sys
from playwright.sync_api import sync_playwright
N = int(sys.argv[1]) if len(sys.argv) > 1 else 60
with sync_playwright() as p:
    b = p.chromium.launch(headless=True); pg = b.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/rtc/dist/road-to-the-championship-offline.html'); pg.wait_for_load_state('load')
    res = pg.evaluate("""(N) => { const out = {}; for (const diff of ['rookie','varsity','legend']) for (const pol of ['smart','naive']) {
        const k = diff+'/'+pol; const bySeason = [{},{},{},{}]; const careers = {}; let titles=[0,0,0,0], n=[0,0,0,0];
        for (let i=0;i<N;i++){ const r = RTC.autoCareer({diff, policy:pol, seed:k+i}); careers[r.career]=(careers[r.career]||0)+1;
          r.seasons.forEach((s,j)=>{ n[j]++; if (s.kind==='champion'||s.kind==='perfect') titles[j]++; bySeason[j][s.kind]=(bySeason[j][s.kind]||0)+1; }); }
        out[k] = { titleRateBySeason: titles.map((t,j)=> n[j] ? (t/n[j]).toFixed(2) : '-'), seasonsPlayed: n, careers }; } return out; }""", N)
    for k,v in res.items(): print(k, json.dumps(v))
    print('page errors:', errs[:5])
    b.close()
