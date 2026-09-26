import sys, os
from playwright.sync_api import sync_playwright
URL = 'file:///home/claude/rtc/dist/road-to-the-championship-offline.html'
OUT = '/home/claude/rtc/tests/shots'; os.makedirs(OUT, exist_ok=True)
errors = []
def shot(pg, name): pg.screenshot(path=f'{OUT}/{name}.png', full_page=True)
def play_week(pg, tag=None, snap=False):
    # practice
    pg.click('[data-act="preset"][data-k="balanced"]')
    if snap: shot(pg, f'{tag}-practice')
    pg.click('[data-act="run-practice"]')
    if snap: shot(pg, f'{tag}-practice-done')
    pg.click('[data-act="to-event"]')
    if snap: shot(pg, f'{tag}-event')
    pg.keyboard.press('1')
    pg.wait_for_selector('.outcome')
    pg.click('[data-act="to-prep"]')
    if snap: shot(pg, f'{tag}-prep')
    pg.click('[data-act="tipoff"]')
    pg.wait_for_selector('#court')
    if snap:
        pg.wait_for_timeout(2600); shot(pg, f'{tag}-game-live')
    # skip quarters
    for _ in range(12):
        if pg.query_selector('#to-recap'): break
        if pg.query_selector('[data-act="skipq"]'): pg.click('[data-act="skipq"]')
        if pg.query_selector('[data-act="talk"]'):
            if snap: shot(pg, f'{tag}-halftime')
            pg.click('[data-act="talk"][data-t="calm"]')
        if pg.query_selector('#resume-q'): pg.click('#resume-q')
        pg.wait_for_timeout(50)
    pg.wait_for_selector('#to-recap')
    if snap: shot(pg, f'{tag}-final')
    pg.click('#to-recap')
    if snap: shot(pg, f'{tag}-recap')
    pg.click('[data-act="end-week"]')

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    for vp, tag in [({'width': 1366, 'height': 900}, 'desk'), ({'width': 390, 'height': 844}, 'mob')]:
        ctx = b.new_context(viewport=vp); pg = ctx.new_page()
        pg.on('pageerror', lambda e: errors.append(f'{tag} pageerror: {e}'))
        pg.on('console', lambda m: errors.append(f'{tag} console.{m.type}: {m.text}') if m.type == 'error' and 'fonts.g' not in m.text and 'ERR_' not in m.text else None)
        pg.goto(URL); pg.wait_for_load_state('load'); pg.wait_for_timeout(300)
        shot(pg, f'{tag}-01-title')
        pg.click('[data-act="new"]'); shot(pg, f'{tag}-02-setup')
        pg.fill('#f-name', 'Oak Grove'); pg.check('input[name="pal"][value="royal"]', force=True); pg.check('input[name="mascot"][value="bolts"]', force=True)
        pg.click('details summary'); pg.fill('#f-seed', 'DEMO2027')
        pg.click('[data-act="setup-go"]'); pg.wait_for_selector('.try-grid')
        shot(pg, f'{tag}-03-tryouts')
        pg.click('[data-act="scout"] >> nth=0'); pg.click('[data-act="auto-sign"]')
        pg.click('[data-act="finalize"]'); pg.wait_for_selector('.stepper')
        shot(pg, f'{tag}-04-hub')
        play_week(pg, f'{tag}-w1', snap=True)
        if tag == 'desk':
            for t in ['roster', 'standings', 'office', 'log']:
                pg.click(f'#tab-{t}'); shot(pg, f'{tag}-tab-{t}')
            pg.click('#tab-week')
            pg.keyboard.press('?'); pg.wait_for_selector('.modal'); shot(pg, f'{tag}-rules'); pg.keyboard.press('Escape')
            pg.click('[data-act="settings"]'); shot(pg, f'{tag}-settings')
            pg.check('input[name="theme"][value="dark"]', force=True); pg.keyboard.press('Escape'); shot(pg, f'{tag}-dark-hub')
            pg.click('[data-act="settings"]'); pg.check('input[name="theme"][value="contrast"]', force=True); pg.keyboard.press('Escape'); shot(pg, f'{tag}-contrast-hub')
            pg.click('[data-act="settings"]'); pg.check('input[name="theme"][value="auto"]', force=True); pg.keyboard.press('Escape')
        # play out the rest of the season through the UI
        weeks = 1
        while not pg.query_selector('.grade') and weeks < 20:
            if pg.query_selector('text=You’re in!') and tag=='desk': shot(pg, f'{tag}-playoffs-in')
            play_week(pg, f'{tag}-w{weeks+1}', snap=False); weeks += 1
        pg.wait_for_selector('.grade'); shot(pg, f'{tag}-99-ending')
        print(tag, 'weeks played:', weeks, '| ending:', pg.inner_text('.ending-hero h1') if pg.query_selector('.ending-hero h1') else pg.inner_text('.title-hero h1'))
        # horizontal overflow check on a few screens
        ow = pg.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1')
        print(tag, 'horizontal overflow on ending:', ow)
        ctx.close()
    b.close()
print('ERRORS:', errors if errors else 'none')
