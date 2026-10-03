from pathlib import Path
import sys, os
from playwright.sync_api import sync_playwright
URL = (Path(__file__).resolve().parents[1] / 'dist' / 'road-to-the-championship-offline.html').as_uri()
OUT = str(Path(__file__).resolve().parent / 'shots'); os.makedirs(OUT, exist_ok=True)
errors = []; stats = {'clutch': 0, 'timeouts': 0, 'subs': 0}
def shot(pg, name): pg.screenshot(path=f'{OUT}/{name}.png', full_page=True)
def finish_game(pg, tag, snap):
    for _ in range(40):
        if pg.query_selector('#to-recap'): break
        if pg.query_selector('#clutch-go'):
            stats['clutch'] += 1
            if snap or not os.path.exists(f'{OUT}/{tag}-clutch.png'): shot(pg, f'{tag}-clutch')
            pg.click('input[name="cl-t"][value="three"]', force=True); pg.click('#clutch-go'); pg.wait_for_timeout(60); continue
        if pg.query_selector('[data-act="talk"]'):
            if snap: shot(pg, f'{tag}-halftime')
            pg.click('[data-act="talk"][data-t="calm"]')
        if pg.query_selector('#resume-q'): pg.click('#resume-q'); pg.wait_for_timeout(30); continue
        if pg.query_selector('#resume-play'): pg.click('#resume-play'); continue
        if pg.query_selector('[data-act="skipq"]'): pg.click('[data-act="skipq"]')
        pg.wait_for_timeout(30)
    pg.wait_for_selector('#to-recap')
def play_week(pg, tag=None, snap=False, timeout_test=False):
    pg.click('[data-act="preset"][data-k="balanced"]')
    if snap: shot(pg, f'{tag}-practice')
    pg.click('[data-act="run-practice"]'); pg.click('[data-act="to-event"]')
    if snap: shot(pg, f'{tag}-event')
    pg.keyboard.press('1'); pg.wait_for_selector('.outcome'); pg.click('[data-act="to-prep"]')
    if snap: shot(pg, f'{tag}-prep')
    pg.click('[data-act="tipoff"]'); pg.wait_for_selector('#court')
    if timeout_test:
        pg.wait_for_timeout(2500); shot(pg, f'{tag}-game-live')
        pg.click('[data-act="timeout"][data-k="full"]'); pg.wait_for_selector('#resume-play'); stats['timeouts'] += 1
        # sub: put the 6th man in for slot 0
        opts = pg.eval_on_selector('#sub-0', 'el => Array.from(el.options).map(o => o.value)')
        cur = pg.eval_on_selector('#sub-0', 'el => el.value')
        onc = [pg.eval_on_selector(f'#sub-{i}', 'el => el.value') for i in range(5)]
        bench = [o for o in opts if o not in onc]
        if bench: pg.select_option('#sub-0', bench[0]); stats['subs'] += 1
        pg.check('input[name="tq-rot"][value="manual"]', force=True)
        shot(pg, f'{tag}-timeout')
        assert pg.eval_on_selector('#sub-0', 'el => el.value') == (bench[0] if bench else cur)
        pg.click('#resume-play'); pg.wait_for_timeout(1500)
        pg.keyboard.press('t'); pg.wait_for_selector('#resume-play'); stats['timeouts'] += 1; pg.click('#resume-play')
    finish_game(pg, tag, snap)
    if snap: shot(pg, f'{tag}-final')
    pg.click('#to-recap')
    if snap: shot(pg, f'{tag}-recap')
    pg.click('[data-act="end-week"]')
def play_season(pg, tag, first_snap=False):
    weeks = 0
    while not pg.query_selector('.grade') and weeks < 20:
        play_week(pg, f'{tag}-w{weeks+1}', snap=(first_snap and weeks == 0), timeout_test=(first_snap and weeks == 0)); weeks += 1
    pg.wait_for_selector('.grade'); return weeks
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    for vp, tag in [({'width': 1366, 'height': 900}, 'desk'), ({'width': 390, 'height': 844}, 'mob')]:
        ctx = b.new_context(viewport=vp); pg = ctx.new_page()
        pg.on('pageerror', lambda e, tag=tag: errors.append(f'{tag} pageerror: {e}'))
        pg.on('console', lambda m, tag=tag: errors.append(f'{tag} console.{m.type}: {m.text}') if m.type == 'error' and 'fonts.g' not in m.text and 'ERR_' not in m.text else None)
        pg.add_init_script("localStorage.setItem('rtc-onboarding-seen-v1','1')")
        pg.goto(URL); pg.wait_for_load_state('load'); pg.wait_for_timeout(300)
        pg.check('input[name="tdiff"][value="rookie"]', force=True)
        assert 'Easy' in pg.inner_text('.diff-pick') and '$3,200' in pg.inner_text('#tdiff-d')
        pg.check('input[name="tdiff"][value="varsity"]', force=True)
        shot(pg, f'{tag}-01-title')
        pg.click('[data-act="new"]')
        assert pg.eval_on_selector('input[name="diff"][value="varsity"]', 'el => el.checked')
        pg.fill('#f-name', 'Oak Grove'); pg.check('input[name="pal"][value="royal"]', force=True); pg.check('input[name="mascot"][value="bolts"]', force=True)
        pg.click('details summary'); pg.fill('#f-seed', 'DEMO2027')
        pg.click('[data-act="setup-go"]'); pg.wait_for_selector('.try-grid'); shot(pg, f'{tag}-03-tryouts')
        pg.click('[data-act="auto-sign"]'); pg.click('[data-act="finalize"]'); pg.wait_for_selector('.stepper'); shot(pg, f'{tag}-04-hub')
        w = play_season(pg, f'{tag}-s1', first_snap=(tag == 'desk'))
        shot(pg, f'{tag}-s1-ending')
        print(tag, 'S1 weeks:', w, '|', pg.inner_text('.title-hero h1'))
        assert not pg.query_selector('[data-act="offseason"]')
        assert not pg.query_selector('[data-act="retire"]')
        assert pg.query_selector('[data-act="again"]')
        assert pg.evaluate('RTC.G.season') == 1
        assert w <= 14
        pg.click('[data-act="credits"]'); pg.wait_for_selector('text=Ajisth Sareen'); pg.keyboard.press('Escape')
        pg.click('[data-act="again"]'); pg.wait_for_selector('.try-grid')
        assert pg.evaluate('RTC.G.week') == 1
        ow = pg.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1'); print(tag, 'horizontal overflow:', ow)
        ctx.close()
    b.close()
print('stats', stats)
print('ERRORS:', errors if errors else 'none')
