"""Fetch public Kangs facts, preserving last verified snapshot on failure.
No private student records. Reported-game PPG is NOT a season average.
"""
from pathlib import Path
from html import unescape
import re,json,subprocess,datetime,concurrent.futures
BASE='https://thefinalscore.tv/wa/team/2025-2026/11097/kangaroos'
def fetch(url):
 return subprocess.check_output(['curl','--fail','--location','--silent','--show-error','--max-time','30',url],text=True)
def clean(s): return ' '.join(unescape(re.sub('<[^>]+>',' ',s)).split())
def rows(html):
 return [[clean(c) for c in re.findall(r'<td\b[^>]*>(.*?)</td>',r,re.S)] for r in re.findall(r'<tr\b[^>]*>(.*?)</tr>',html,re.S)]
html=fetch(BASE)
players=[]; games=[]
for row in re.findall(r'<tr\b[^>]*>(.*?)</tr>',html,re.S):
 cells=[clean(c) for c in re.findall(r'<td\b[^>]*>(.*?)</td>',row,re.S)]
 if len(cells)==5 and cells[0].isdigit() and cells[2] in ['Guard','Forward']:
  url=re.search(r'href="([^"]+/player/[^"]+)"',row).group(1)
  players.append(dict(number=int(cells[0]),name=cells[1],position=cells[2],height=cells[3],year=cells[4],source=url))
 if 'data-game-id' in row and len(cells)>=5:
  scores=re.findall(r'(.+?) (\d+)(?:,|$)',cells[1])
  if len(scores)!=2: raise ValueError('Unexpected score markup')
  own=next((int(n) for team,n in scores if team.strip()=='Lake Washington'),None)
  opp=next(((team.strip(),int(n)) for team,n in scores if team.strip()!='Lake Washington'),None)
  if own is None or opp is None: raise ValueError('Missing score')
  games.append(dict(date=cells[0],opponent=opp[0],points=own,against=opp[1],venue=cells[3],time=cells[4]))
def stats(p):
 matches=[]
 for c in rows(fetch(p['source'])):
  if len(c)==10 and re.fullmatch(r'\d{2}/\d{2}/\d{4}',c[0]) and c[-1].isdigit():
   matches.append(dict(date=c[0],opponent=c[1],points=int(c[-1])))
 p['reportedGames']=matches
 p['reportedPPG']=int(sum(g['points'] for g in matches)/len(matches)*10+.5)/10 if matches else None
 return p
if len(players)!=14 or len(games)<20: raise ValueError('Source validation failed; previous snapshot kept')
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool: players=list(pool.map(stats,players))
data=dict(season='2025–26',checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),source=BASE,players=players,games=games,notes='Published historical snapshot, refreshed daily. Player PPG covers only games with reported points on the source, not a complete season average. Simulation attributes are fictional.')
path=Path(__file__).resolve().parents[1]/'public/data/kangs.json'
path.write_text(json.dumps(data,indent=2)+'\n')
print(f'Verified {len(players)} players and {len(games)} games; saved {path}')
