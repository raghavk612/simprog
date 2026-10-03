from playwright.sync_api import sync_playwright
URL='file:///home/claude/rtc/dist/road-to-the-championship-offline.html'; bad=[]; errs=[]
def chk(pg,name):
    w=pg.evaluate('[document.documentElement.scrollWidth, innerWidth]')
    if w[0]>w[1]+1:
        culprit=pg.evaluate("""()=>{const W=innerWidth;return Array.from(document.querySelectorAll('body *')).filter(e=>{const r=e.getBoundingClientRect();return r.right>W+1 && !e.closest('.table-wrap,.bracket,.tabs')}).slice(0,4).map(e=>e.tagName+'.'+e.className+' '+Math.round(e.getBoundingClientRect().right))}""")
        bad.append((name,w,culprit))
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':360,'height':780}); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(200); chk(pg,'title')
    pg.click('[data-act="new"]'); chk(pg,'setup'); pg.click('[data-act="setup-go"]'); pg.wait_for_selector('.try-grid'); chk(pg,'tryouts')
    pg.click('[data-act="auto-sign"]'); pg.click('[data-act="finalize"]'); chk(pg,'hub-practice')
    for t in ['roster','standings','office','log']: pg.click(f'#tab-{t}'); chk(pg,'tab-'+t)
    pg.click('#tab-week'); pg.click('[data-act="preset"][data-k="balanced"]'); pg.click('[data-act="run-practice"]'); chk(pg,'practice-done'); pg.click('[data-act="to-event"]'); chk(pg,'event'); pg.keyboard.press('1'); pg.click('[data-act="to-prep"]'); chk(pg,'prep')
    pg.click('[data-act="tipoff"]'); pg.wait_for_timeout(800); chk(pg,'game')
    pg.click('[data-act="timeout"][data-k="full"]'); chk(pg,'timeout'); pg.click('#resume-play')
    # fast-forward the rest of the career via hooks, then view offseason/career screens
    pg.evaluate("""()=>{ RTC.UI.play && clearTimeout(RTC.UI.play.timer); }""")
    pg.evaluate("""()=>{ const G=RTC.G; RTC.UI.play=null; RTC.UI.sim=null; G.step='prep'; }""")
    pg.evaluate("""()=>{ const r=RTC; let g=0; while(r.G.phase!=='ended' && g++<40){ r.G.plan=['shooting','defense','scrimmage','film'].slice(0,r.G.phase==='playoffs'?3:4); r.runPractice(); r.G.step='event'; r.drawEvent(); r.resolveEvent(0); r.G.step='prep'; const sim=r.newGameSim(); sim.headless=true; while(!sim.done) r.simQuarter(sim); r.finishGame(sim); r.G.step='recap'; r.endWeek(); } }""")
    pg.evaluate("()=>{ RTC.UI.screen='ending'; }"); pg.click('[data-act="settings"]'); pg.keyboard.press('Escape')
    chk(pg,'ending')
    if pg.query_selector('[data-act="offseason"]'):
        pg.click('[data-act="offseason"]'); chk(pg,'offseason'); pg.click('[data-act="next-season"]'); chk(pg,'tryouts-s2')
    pg.evaluate("()=>{ RTC.G.ending = RTC.G.ending || {kind:'missed'}; }")
    pg.evaluate("()=>{ endCareer(); RTC.UI.screen='career'; }"); pg.click('[data-act="settings"]'); pg.keyboard.press('Escape'); chk(pg,'career'); pg.screenshot(path='shots/n-m-career.png', full_page=True)
    b.close()
print('overflow:', bad or 'none'); print('errors:', errs or 'none')
