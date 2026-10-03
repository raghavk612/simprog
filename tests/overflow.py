from pathlib import Path
from playwright.sync_api import sync_playwright
URL=(Path(__file__).resolve().parents[1] / 'dist' / 'road-to-the-championship-offline.html').as_uri(); bad=[]; errs=[]
def chk(pg,name):
    w=pg.evaluate('[document.documentElement.scrollWidth, innerWidth]')
    if w[0]>w[1]+1:
        culprit=pg.evaluate("""()=>{const W=innerWidth;return Array.from(document.querySelectorAll('body *')).filter(e=>{const r=e.getBoundingClientRect();return r.right>W+1 && !e.closest('.table-wrap,.bracket,.tabs')}).slice(0,4).map(e=>e.tagName+'.'+e.className+' '+Math.round(e.getBoundingClientRect().right))}""")
        bad.append((name,w,culprit))
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':360,'height':780}); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("localStorage.setItem('rtc-onboarding-seen-v1','1')")
    pg.goto(URL); pg.wait_for_timeout(200); chk(pg,'title')
    pg.click('[data-act="new"]'); chk(pg,'setup'); pg.click('[data-act="setup-go"]'); pg.wait_for_selector('.try-grid'); chk(pg,'tryouts')
    pg.click('[data-act="auto-sign"]'); pg.click('[data-act="finalize"]'); chk(pg,'hub-practice')
    for t in ['roster','standings','office','log']: pg.click(f'#tab-{t}'); chk(pg,'tab-'+t)
    pg.click('#tab-week'); pg.click('[data-act="preset"][data-k="balanced"]'); pg.click('[data-act="run-practice"]'); chk(pg,'practice-done'); pg.click('[data-act="to-event"]'); chk(pg,'event'); pg.keyboard.press('1'); pg.click('[data-act="to-prep"]'); chk(pg,'prep')
    pg.click('[data-act="tipoff"]'); pg.wait_for_timeout(800); chk(pg,'game')
    pg.click('[data-act="timeout"][data-k="full"]'); chk(pg,'timeout'); pg.click('#resume-play')
    pg.click('[data-act="credits"]'); chk(pg,'credits'); pg.keyboard.press('Escape')
    b.close()
print('overflow:', bad or 'none'); print('errors:', errs or 'none')
