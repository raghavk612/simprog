from pathlib import Path
from playwright.sync_api import sync_playwright
URL=(Path(__file__).resolve().parents[1] / 'dist' / 'road-to-the-championship-offline.html').as_uri()
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(headless=True); pg=b.new_page(viewport={'width':1280,'height':850})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("localStorage.setItem('rtc-onboarding-seen-v1','1')")
    pg.goto(URL); pg.wait_for_load_state('load')
    # Keyboard-only: Tab to Quick Start and press Enter
    for _ in range(14):
        pg.keyboard.press('Tab')
        if pg.evaluate("document.activeElement.dataset.act") == 'quick': break
    pg.keyboard.press('Enter'); pg.wait_for_selector('.stepper')
    # pick drills with keyboard: Tab until a drill, press Enter 4 times on different drills
    order=['shooting','defense','scrimmage','film']
    for k in order:
        pg.focus(f'[data-act="drill"][data-k="{k}"]'); pg.keyboard.press('Enter')
    pg.keyboard.press('Enter')  # focus moved to Run practice button
    pg.wait_for_selector('text=Practice complete')
    pg.focus('[data-act="to-event"]'); pg.keyboard.press('Enter'); pg.wait_for_selector('#ev-title')
    pg.keyboard.press('2'); pg.wait_for_selector('.outcome')
    # help modal via ? and Escape, focus trap
    pg.keyboard.press('?'); assert pg.query_selector('.modal'); 
    for _ in range(25): pg.keyboard.press('Tab')
    inside = pg.evaluate("!!document.activeElement.closest('.modal')"); pg.keyboard.press('Escape')
    assert not pg.query_selector('.modal')
    pg.focus('[data-act="to-prep"]'); pg.keyboard.press('Enter'); pg.wait_for_selector('.scout')
    pg.focus('[data-act="tipoff"]'); pg.keyboard.press('Enter'); pg.wait_for_selector('#court')
    pg.wait_for_timeout(1500); pg.keyboard.press('s'); pg.wait_for_selector('#resume-q')
    focused = pg.evaluate("document.activeElement.id")
    pg.screenshot(path='shots/kb-timeout.png', full_page=True)
    # live region check
    live = pg.inner_text('#live')
    print('focus trapped in modal:', inside, '| focus after quarter:', focused, '| live region:', live[:80])
    b.close()
print('errors:', errs or 'none')
