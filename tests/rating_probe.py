from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(); pg.goto('file:///home/claude/rtc/dist/road-to-the-championship-offline.html')
    for diff in ['varsity','legend']:
      for pol in ['smart','naive']:
        r=pg.evaluate("""([diff,pol])=>{ const a=[[],[],[],[]]; for(let i=0;i<30;i++){ const c=RTC.autoCareer({diff,policy:pol,seed:'pr'+i}); c.seasons.forEach((s,j)=>a[j].push(s)); }
          return a.map(x=>{ const av=k=>(x.reduce((t,s)=>t+s[k],0)/x.length).toFixed(1); return `start ${av('startR')} end ${av('rating')} dist ${av('dist')} boss ${av('boss')}`; }); }""",[diff,pol])
        print(diff,pol); [print('  S%d'%(j+1),x) for j,x in enumerate(r)]
    b.close()
