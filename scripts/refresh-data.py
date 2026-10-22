"""Fetch public Kangs facts, preserving last verified snapshot on failure.
No private student records. Reported-game PPG is NOT a season average.

Season selection: the newest season page is used once it has a complete
published schedule (at least 30 final games); until then the previous season
stays. FinalScoreTV serves the previous season's page at a not-yet-published
season's URL, so a season only counts if its game dates belong to it.

Creator roster additions (CUSTOM_PLAYERS) are applied after every refresh so
the daily updater never removes them. They are labeled in the data and in-game.
"""
from pathlib import Path
from html import unescape
import re, json, subprocess, datetime, concurrent.futures

TEAM = 'https://thefinalscore.tv/wa/team/{season}/11097/kangaroos'
MIN_GAMES = 30  # the season model and save format use exactly 30 published matchups
MIN_PLAYERS, MAX_PLAYERS = 8, 15

# Game creators added to the playable roster. `replaces` names the sourced entry
# whose roster spot they take; if that player is not on the roster, the addition
# takes the spot of the player with the fewest reported games.
CUSTOM_PLAYERS = [
    dict(number=7, name='Malhar Pawar', position='Guard', height='Not listed', year='Game creator',
         replaces='Mason Mazandarany'),
]
CUSTOM_NOTE = 'Added by the game creators; not part of the published FinalScoreTV roster.'


def fetch(url):
    return subprocess.check_output(['curl', '--fail', '--location', '--silent', '--show-error', '--max-time', '30', url], text=True)


def clean(s):
    return ' '.join(unescape(re.sub('<[^>]+>', ' ', s)).split())


def rows(html):
    return [[clean(c) for c in re.findall(r'<td\b[^>]*>(.*?)</td>', r, re.S)] for r in re.findall(r'<tr\b[^>]*>(.*?)</tr>', html, re.S)]


def season_label(slug):  # '2025-2026' -> '2025–26'
    a, b = slug.split('-')
    return f'{a}–{b[2:]}'


def candidate_seasons(today=None):
    """Newest plausible season first, then the one before it."""
    today = today or datetime.date.today()
    start = today.year if today.month >= 8 else today.year - 1
    return [f'{y}-{y + 1}' for y in (start, start - 1)]


def parse_team(html):
    players, games = [], []
    for row in re.findall(r'<tr\b[^>]*>(.*?)</tr>', html, re.S):
        cells = [clean(c) for c in re.findall(r'<td\b[^>]*>(.*?)</td>', row, re.S)]
        if len(cells) == 5 and cells[0].isdigit() and cells[2] in ['Guard', 'Forward', 'Center']:
            url = re.search(r'href="([^"]+/player/[^"]+)"', row).group(1)
            players.append(dict(number=int(cells[0]), name=cells[1], position=cells[2], height=cells[3], year=cells[4], source=url))
        if 'data-game-id' in row and len(cells) >= 5:
            scores = re.findall(r'(.+?) (\d+)(?:,|$)', cells[1])
            if len(scores) != 2:
                continue  # not final yet (scheduled game without a score)
            own = next((int(n) for team, n in scores if team.strip() == 'Lake Washington'), None)
            opp = next(((team.strip(), int(n)) for team, n in scores if team.strip() != 'Lake Washington'), None)
            if own is None or opp is None:
                raise ValueError('Missing score')
            games.append(dict(date=cells[0], opponent=opp[0], points=own, against=opp[1], venue=cells[3], time=cells[4]))
    return players, games


def belongs_to(games, slug):
    """True when the game dates fall inside the season (Aug of year 1 to Jul of year 2)."""
    a, b = map(int, slug.split('-'))
    def ok(d):
        m, _, y = map(int, d.split('/'))
        return (y == a and m >= 8) or (y == b and m <= 7)
    return bool(games) and all(ok(g['date']) for g in games)


def stats(p):
    matches = []
    for c in rows(fetch(p['source'])):
        if len(c) == 10 and re.fullmatch(r'\d{2}/\d{2}/\d{4}', c[0]) and c[-1].isdigit():
            matches.append(dict(date=c[0], opponent=c[1], points=int(c[-1])))
    p['reportedGames'] = matches
    p['reportedPPG'] = int(sum(g['points'] for g in matches) / len(matches) * 10 + .5) / 10 if matches else None
    return p


def apply_custom(players):
    """Insert creator additions in place of a sourced entry (keeps roster order and size stable).
    Safe to run more than once: an existing creator entry keeps its spot."""
    players = list(players)
    for c in CUSTOM_PLAYERS:
        entry = dict(number=c['number'], name=c['name'], position=c['position'], height=c['height'], year=c['year'],
                     source=None, custom=True, note=CUSTOM_NOTE, reportedGames=[], reportedPPG=None)
        idx = next((i for i, p in enumerate(players) if p.get('custom') and p['name'] == c['name']), None)
        if idx is not None:
            entry['replaced'] = players[idx].get('replaced')
        else:
            idx = next((i for i, p in enumerate(players) if not p.get('custom') and p['name'] == c['replaces']), None)
            if idx is None and len(players) >= MAX_PLAYERS:
                idx = min((i for i, p in enumerate(players) if not p.get('custom')), key=lambda i: (len(players[i].get('reportedGames', [])), -i))
            if idx is not None:
                entry['replaced'] = players[idx]['name']
        if idx is None:
            players.append(entry)
        else:
            players[idx] = entry
        if sum(p['number'] == entry['number'] for p in players) > 1:
            raise ValueError(f"Jersey #{entry['number']} for {entry['name']} is already taken")
    return players


def refresh():
    for slug in candidate_seasons():
        url = TEAM.format(season=slug)
        try:
            players, games = parse_team(fetch(url))
        except Exception as e:  # network or markup problem: try the next season
            print(f'{slug}: unavailable ({e})')
            continue
        if not belongs_to(games, slug):
            print(f'{slug}: not published yet (page shows another season)')
            continue
        if len(games) < MIN_GAMES or not MIN_PLAYERS <= len(players) <= MAX_PLAYERS:
            print(f'{slug}: incomplete ({len(players)} players, {len(games)} final games); need {MIN_GAMES}+ games')
            continue
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            players = list(pool.map(stats, players))
        return dict(season=season_label(slug), checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), source=url,
                    players=apply_custom(players), games=games[:MIN_GAMES],
                    notes='Published historical snapshot, refreshed daily. Player PPG covers only games with reported points on the source, not a complete season average. Simulation attributes are fictional. Entries marked custom were added by the game creators.')
    raise ValueError('Source validation failed; previous snapshot kept')


if __name__ == '__main__':
    path = Path(__file__).resolve().parents[1] / 'public/data/kangs.json'
    data = refresh()
    path.write_text(json.dumps(data, indent=2) + '\n')
    print(f"Verified {data['season']}: {len(data['players'])} players and {len(data['games'])} games; saved {path}")
