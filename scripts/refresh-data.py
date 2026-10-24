"""Refresh the real Lake Washington boys basketball data from KingCo Athletics.

KingCo's team pages (https://www.kingcoathletics.com/team/?schoolid=66&sportid=3)
embed WPA Network widgets. This script reads the same widget pages for the
Varsity, Junior Varsity and C-Team rosters and schedules.

* The game plays the TARGET_SEASON (2026-27) schedule. Upcoming games are kept with
  points/against = null; final scores are filled in as KingCo publishes them.
* Kangs rosters are PINNED by policy: by default the existing Kangs rosters in
  public/data/kangs.json (rosterSeason 2025-26) are kept even once KingCo publishes a
  2026-27 roster. Pass --update-rosters to replace them with a published roster (8-15
  players); a level with no valid published roster still keeps its existing roster.
  Opponent rosters always refresh: a published roster wins, otherwise the existing one is kept.
* `refPointsPerGame` (the previous season's team scoring, used for estimated player
  stats before any game is played) is carried forward from the existing snapshot.
* On any network or validation failure the existing snapshot is kept.

Usage:
  python3 scripts/refresh-data.py                  # fetch live data; Kangs rosters stay pinned
  python3 scripts/refresh-data.py --update-rosters # also replace Kangs rosters with newly published ones
  python3 scripts/refresh-data.py --from-raw FILE  # rebuild from a saved raw extraction
    FILE is either the compact schedule format (raw-2026-27.json: levels.<lvl>.games rows of
    [date, time, opponent, type, Home|Away, location] plus optional newOpponentRosters2025_26)
    or the older widget extraction format (per level: schedule / roster / opponents).
"""
from pathlib import Path
from html.parser import HTMLParser
import re, json, subprocess, datetime, sys, copy, argparse

SCHOOL_ID, SPORT_ID = 66, 3
WIDGET = 'https://www.wpanetwork.com/widgets/widget-team-{kind}.php?school_year={year}&school_id=66&sport_id=3&level_id={level}&output_mode=plain'
TEAM_PAGE = 'https://www.kingcoathletics.com/team/?schoolid=66&sportid=3&schoolyear={year}&levelid={level}'
# Game difficulty key -> real team level. Keys match the engine's DIFFICULTIES.
LEVELS = {
    'varsity': dict(label='Varsity', level_id=12, difficulty='elite'),
    'jv': dict(label='Junior Varsity', level_id=11, difficulty='standard'),
    'c': dict(label='C-Team', level_id=10, difficulty='rookie'),
}
POSITIONS = {'G': 'Guard', 'F': 'Forward', 'C': 'Center', 'PG': 'Guard', 'SG': 'Guard', 'SF': 'Forward', 'PF': 'Forward'}
GRADES = {'9': 'Freshman', '10': 'Sophomore', '11': 'Junior', '12': 'Senior'}
MONTHS = {m: i for i, m in enumerate(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], 1)}
TARGET_SEASON = '2026-27'
MIN_PLAYERS, MAX_PLAYERS, MIN_GAMES = 8, 15, 10


def fetch(url):
    return subprocess.check_output(['curl', '--fail', '--location', '--silent', '--show-error', '--max-time', '30', '-A', 'Mozilla/5.0', url], text=True)


class Widget(HTMLParser):
    """Collects schedule rows (by div class) and roster rows (td cells of tr.roster_row)."""
    FIELDS = {'event_date': 'date', 'event_time': 'time', 'event_team': 'opponent', 'event_gametype': 'type',
              'event_ha': 'ha', 'event_location': 'venue', 'event_wlt': 'wlt', 'event_score': 'score'}

    def __init__(self):
        super().__init__(); self.games, self.roster = [], []; self.row = None; self.kind = None; self.field = None; self.cell = None

    def handle_starttag(self, tag, attrs):
        cls = dict(attrs).get('class', '') or ''
        if tag == 'tr':
            self.kind = 'roster' if 'roster_row' in cls else 'game'
            self.row = [] if self.kind == 'roster' else {}
        elif self.row is not None and self.kind == 'roster' and tag == 'td':
            self.cell = []
        elif self.row is not None and self.kind == 'game':
            if tag == 'a' and 'event_team' in cls.split():
                m = re.search(r'schoolid=(\d+)', dict(attrs).get('href') or '')
                if m: self.row['school_id'] = m.group(1)
            for c in cls.split():
                if c in self.FIELDS:
                    self.field = self.FIELDS[c]; self.row.setdefault(self.field, '')

    def handle_endtag(self, tag):
        if tag == 'td' and self.cell is not None:
            self.row.append(' '.join(''.join(self.cell).split())); self.cell = None
        elif tag in ('div', 'a') and self.field:
            self.field = None
        elif tag == 'tr' and self.row is not None:
            if self.kind == 'roster' and len(self.row) >= 7:
                c = self.row; self.roster.append(dict(number=c[0], name=c[3], height=c[4], position=c[5], year=c[6]))
            elif self.kind == 'game' and self.row.get('date'):
                self.games.append({k: ' '.join(v.split()) for k, v in self.row.items()})
            self.row = None; self.field = None

    def handle_data(self, data):
        if self.cell is not None: self.cell.append(data)
        elif self.field and self.row is not None: self.row[self.field] += data


def parse(html):
    w = Widget(); w.feed(html); return w


# ---------- normalizing published text ----------
def clean_team(name):
    name = name.replace("\\'", "'").replace("D' Alene", "d'Alene").strip()
    if name.isupper():
        name = ' '.join(w.capitalize() for w in name.split())
    return name


def clean_person(name):
    words = []
    for w in name.split():
        if len(w) > 1 and w.isupper(): w = w.capitalize()          # "WU" -> "Wu"
        if re.fullmatch(r"O'[a-z].*", w): w = "O'" + w[2:].capitalize()  # "O'hare" -> "O'Hare"
        words.append(w)
    return ' '.join(words)


def iso_date(text, year_slug):
    """'Tue Dec 2' -> '12/2/2025' using the season's years (Aug–Dec = first year)."""
    parts = text.split()
    month, day = MONTHS[parts[-2][:3]], int(parts[-1])
    a = int(year_slug[:4])
    return f'{month}/{day}/{a if month >= 8 else a + 1}'


FIRST = ['Aiden', 'Marcus', 'Eli', 'Jalen', 'Owen', 'Mateo', 'Caleb', 'Isaiah', 'Noah', 'Darius', 'Leo', 'Andre', 'Ty', 'Gabe', 'Micah', 'Julian',
         'Xavier', 'Cole', 'Rashad', 'Nico', 'Evan', 'Luis', 'Devin', 'Kai', 'Malik', 'Wes', 'Jonah', 'Dante', 'Theo', 'Bryce', 'Omar', 'Silas']
LAST = ['Carter', 'Brooks', 'Reyes', 'Hayes', 'Okafor', 'Duarte', 'Pryor', 'Castillo', 'Nguyen', 'Bennett', 'Holloway', 'Marsh', 'Delgado', 'Coleman',
        'Vance', 'Mendez', 'Sutton', 'Ramsey', 'Ellis', 'Tran', 'Grant', 'Harlow', 'Ortega', 'Pierce', 'Novak', 'Hale', 'Winslow', 'Barrett', 'Quinn', 'Rhodes']


def fictional_roster(team, n=12):
    """Deterministic invented names for opponents with no published roster (clearly flagged in the data)."""
    h = 0
    for ch in team: h = (h * 31 + ord(ch)) % 2**31
    nums, names, out = [0, 1, 2, 3, 4, 5, 10, 11, 12, 13, 14, 15, 20, 21, 22, 23, 24, 25, 30, 32, 33, 34, 35, 44], set(), []
    while len(out) < n:
        h = (h * 1103515245 + 12345) % 2**31
        name = f"{FIRST[h % len(FIRST)]} {LAST[(h // 97) % len(LAST)]}"
        if name in names: continue
        names.add(name); out.append(dict(number=nums[len(out) * 2 % len(nums)], name=name))
    return out


def build_opponents(raw_opps, games, prev=None):
    """One roster per opponent on this level's schedule: a published roster wins, then the
    existing snapshot's roster (so schools without a new roster keep real names), else fictional."""
    out = {}
    for g in games:
        name = g['opponent']
        if name in out: continue
        src = next((v for k, v in (raw_opps or {}).items() if clean_team(k) == name), None)
        real = [dict(number=int(r['number']) if str(r['number']).isdigit() else None, name=clean_person(r['name'])) for r in (src or {}).get('roster', []) if r.get('name')]
        if len(real) >= 5:
            taken = {r['number'] for r in real if r['number'] is not None}
            spare = iter(n for n in range(0, 60) if n not in taken)
            for r in real:
                if r['number'] is None: r['number'] = next(spare)
            out[name] = dict(real=True, schoolId=int(src['school_id']), players=real)
        elif (prev or {}).get(name):
            out[name] = copy.deepcopy(prev[name])
        else:
            out[name] = dict(real=False, schoolId=int(src['school_id']) if src and src.get('school_id') else None, players=fictional_roster(name))
    return out


def game_row(g, year_slug):
    """One schedule row; unplayed games (no final score yet) keep points/against = None."""
    played = g.get('score') and g.get('wlt') in ('Win', 'Loss', 'Tie')
    own = opp = None
    if played:
        hi, lo = map(int, g['score'].split('-'))
        own, opp = (hi, lo) if g['wlt'] in ('Win', 'Tie') else (lo, hi)
    return dict(date=iso_date(g['date'], year_slug), opponent=clean_team(g['opponent']), points=own, against=opp,
                venue=g.get('venue', ''), time=g.get('time', '').upper(), type=g.get('type') or 'Game', home=g.get('ha') == 'Home')


def ref_ppg(prev_level):
    """Previous-season scoring used to estimate player stats before real scores exist."""
    if prev_level and prev_level.get('refPointsPerGame'):
        return prev_level['refPointsPerGame'], prev_level.get('refPointsNote')
    scored = [g['points'] for g in (prev_level or {}).get('games', []) if isinstance(g.get('points'), int)]
    if scored:
        return round(sum(scored) / len(scored), 1), f"2025–26 team average points per game over {len(scored)} completed games (previous snapshot)."
    return None, None


def build_level(key, raw, year_slug, prev=None, update_rosters=False):
    meta = LEVELS[key]
    games = [game_row(g, year_slug) for g in raw['schedule'] if g.get('date')]
    taken = {int(p['number']) for p in raw['roster'] if p['number'].isdigit()}
    spare = iter(n for n in [3, 5, 10, 11, 12, 13, 14, 15, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 40, 41, 42, 44] if n not in taken)
    players = []
    for p in raw['roster']:
        assigned = not p['number'].isdigit()
        players.append(dict(number=int(p['number']) if not assigned else next(spare), name=clean_person(p['name']),
                            position=POSITIONS.get(p['position'].strip(), 'Not listed'), height=p['height'].strip() or 'Not listed',
                            year=GRADES.get(p['year'].strip(), p['year'].strip() or 'Not listed'),
                            source=TEAM_PAGE.format(year=year_slug, level=meta['level_id']), **({'numberAssigned': True} if assigned else {})))
    roster_season = f"{year_slug[:4]}–{year_slug[-2:]}"
    valid = MIN_PLAYERS <= len(players) <= MAX_PLAYERS
    if not update_rosters and prev and prev.get('players'):
        if valid:
            print(f"warning: {key}: ignoring the published {roster_season} roster ({len(players)} players); Kangs rosters are pinned to "
                  f"{prev.get('rosterSeason', '2025–26')} by policy (pass --update-rosters to adopt it)", file=sys.stderr)
        players, roster_season = copy.deepcopy(prev['players']), prev.get('rosterSeason', '2025–26')
    elif not valid:
        if not prev or not prev.get('players'):
            raise ValueError(f'{key}: {len(players)} players failed validation and no earlier roster is available')
        print(f'warning: {key}: published {roster_season} roster has {len(players)} players (need {MIN_PLAYERS}-{MAX_PLAYERS}); '
              f"keeping the existing {prev.get('rosterSeason', '2025–26')} roster", file=sys.stderr)
        players, roster_season = copy.deepcopy(prev['players']), prev.get('rosterSeason', '2025–26')  # none published yet: keep the roster
    if len(games) < MIN_GAMES:
        raise ValueError(f'{key}: only {len(games)} scheduled games')
    ppg, note = ref_ppg(prev)
    level = dict(label=meta['label'], levelId=meta['level_id'], difficulty=meta['difficulty'],
                 source=TEAM_PAGE.format(year=year_slug, level=meta['level_id']), rosterSeason=roster_season, players=players, games=games)
    if ppg: level.update(refPointsPerGame=ppg, refPointsNote=note)
    level['opponents'] = build_opponents(raw.get('opponents'), games, (prev or {}).get('opponents'))
    return level


def build(raw, year_slug, prev=None, update_rosters=False):
    a, b = year_slug.split('-')
    season = f'{a}–{b[-2:]}'
    levels = {k: build_level(k, raw[k], year_slug, ((prev or {}).get('levels') or {}).get(k), update_rosters) for k in LEVELS}
    kept = sorted({v['rosterSeason'] for v in levels.values()} - {season})
    roster_note = (f"Kangs rosters are the {' / '.join(kept)} KingCo rosters, kept for the {season} schedule by policy. ") if kept else ''
    return dict(season=season, checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                source=f'https://www.kingcoathletics.com/team/?schoolid={SCHOOL_ID}&sportid={SPORT_ID}', levels=levels,
                notes=f"Dated public snapshot of the Lake Washington boys basketball Varsity, Junior Varsity and C-Team {season} schedules from KingCo Athletics (WPA Network). Games without a final score are upcoming and keep points/against as null; final scores are filled in when KingCo publishes them. {roster_note}refPointsPerGame is the previous season's team scoring average, used only to estimate player stats before any score exists. C-Team jersey numbers, heights and positions are not published; the game assigns jersey numbers and marks them numberAssigned. Opponent rosters come from each school's KingCo/WPA team page at the same level (latest published); opponents without one get fictional names (real: false). Skills, energy, morale, GPA and all simulated statistics are fictional.")


def fetch_raw(year_slug):
    raw = {}
    for key, meta in LEVELS.items():
        sched = parse(fetch(WIDGET.format(kind='schedule', year=year_slug, level=meta['level_id']))).games
        roster = parse(fetch(WIDGET.format(kind='roster', year=year_slug, level=meta['level_id']))).roster
        opponents = {}
        for g in sched:
            sid = g.get('school_id')
            if sid and g['opponent'] not in opponents:
                try:
                    opponents[g['opponent']] = dict(school_id=sid, roster=parse(fetch(WIDGET.format(kind='roster', year=year_slug, level=meta['level_id']).replace('school_id=66', f'school_id={sid}'))).roster)
                except Exception:
                    opponents[g['opponent']] = dict(school_id=sid, roster=[])  # keep going; this opponent gets a fictional roster
        raw[key] = dict(schedule=sched, roster=roster, opponents=opponents)
    return raw


def refresh(prev=None, update_rosters=False):
    raw = fetch_raw(TARGET_SEASON)
    for key, lv in raw.items():
        if len(lv['schedule']) < MIN_GAMES:
            raise ValueError(f'{TARGET_SEASON}: {key} schedule not posted yet; previous snapshot kept')
    return build(raw, TARGET_SEASON, prev, update_rosters)


def compact_to_raw(compact, prev):
    """Convert the compact schedule file (raw-2026-27.json) to the widget-style structure.
    Returns (raw, prev); prev gains any bundled opponent rosters (real) for schools it lacks."""
    raw, prev = {}, copy.deepcopy(prev or {})
    for key in LEVELS:
        rows = [dict(date=d, time=t, opponent=opp, type=typ, ha=ha, venue=venue) for d, t, opp, typ, ha, venue in compact['levels'][key]['games']]
        raw[key] = dict(schedule=rows, roster=[], opponents={})
        lvl = prev.setdefault('levels', {}).setdefault(key, {})
        for team, info in (compact.get('newOpponentRosters2025_26') or {}).items():
            ros = [dict(number=int(n), name=clean_person(nm)) for n, nm in info.get(key, [])]
            if len(ros) >= 5: lvl.setdefault('opponents', {}).setdefault(team, dict(real=True, schoolId=info.get('schoolId'), players=ros))
    return raw, prev


if __name__ == '__main__':
    path = Path(__file__).resolve().parents[1] / 'public/data/kangs.json'
    prev = json.loads(path.read_text()) if path.exists() else None
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--from-raw', metavar='FILE', help='rebuild from a saved raw extraction instead of the network')
    ap.add_argument('--update-rosters', action='store_true',
                    help='replace the pinned 2025-26 Kangs rosters with a newly published roster (8-15 players); default keeps them')
    args = ap.parse_args()
    if args.from_raw:
        raw_file = Path(args.from_raw); raw = json.loads(raw_file.read_text()); slug = raw_file.stem.split('raw-')[-1]
        if 'gameFields' in raw:  # compact schedule format
            raw, prev = compact_to_raw(raw, prev)
        else:
            opp_file = raw_file.with_name(f'opp-{slug}.txt')  # optional: level#team#schoolId#num|name;num|name
            if opp_file.exists():
                for line in opp_file.read_text().splitlines():
                    if not line.strip(): continue
                    level, team, sid, rows = (line.split('#', 3) + [''])[:4]
                    roster = [dict(number=r.split('|', 1)[0], name=r.split('|', 1)[1]) for r in rows.split(';') if '|' in r]
                    raw[level].setdefault('opponents', {})[team] = dict(school_id=sid or None, roster=roster)
        data = build(raw, slug, prev, args.update_rosters)
    else:
        data = refresh(prev, args.update_rosters)
    path.write_text(json.dumps(data, indent=2) + '\n')
    counts = ', '.join(f"{v['label']} {len(v['players'])} players ({v['rosterSeason']})/{len(v['games'])} games" for v in data['levels'].values())
    print(f"Saved {data['season']}: {counts} -> {path}")
