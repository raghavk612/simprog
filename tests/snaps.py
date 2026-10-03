from playwright.sync_api import sync_playwright
URL='file:///home/claude/rtc/dist/road-to-the-championship-offline.html'; errs=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    for vp,tag in [({'width':1366,'height':900},'d'),({'width':390,'height':844},'m')]:
        pg=b.new_page(viewport=vp); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL); pg.wait_for_timeout(300); pg.screenshot(path=f'shots/n-{tag}-title.png', full_page=True)
        pg.click('[data-act="quick"]'); pg.wait_for_selector('.stepper')
        pg.click('[data-act="preset"][data-k="balanced"]'); pg.click('[data-act="run-practice"]'); pg.click('[data-act="to-event"]'); pg.keyboard.press('1'); pg.click('[data-act="to-prep"]'); pg.click('[data-act="tipoff"]')
        pg.wait_for_timeout(3200); pg.screenshot(path=f'shots/n-{tag}-game.png')
        pg.click('[data-act="timeout"][data-k="short"]'); pg.wait_for_selector('#resume-play'); pg.locator('#break').screenshot(path=f'shots/n-{tag}-timeout.png')
        pg.close()
    b.close()
print('errors', errs or 'none')
