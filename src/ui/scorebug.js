// What the scorebug under the top bar shows, read from the save. No DOM here, so tests import it; shell.js draws it.
import * as E from '../engine.js';
import { opponentLogo } from '../logos.js';

// One segment per scheduled game: 'played', the 'next' one (none once the season is over) and the games 'left'.
// It shows progress only; wins and losses are in the record, never in the track's colours.
export function seasonTrack(s) {
  return s.schedule.map((_, i) => (i < s.week ? 'played' : i === s.week && !s.finished ? 'next' : 'left'));
}
// The next game (opponent, home or away, crest image or null), the record, tokens, prep slots and "GM 2/17".
export function scorebugData(s) {
  const g = s.finished ? null : s.schedule[s.week],
    total = s.schedule.length;
  return {
    next: g ? { name: g.opponent, home: !!g.home, crest: opponentLogo(g.opponent) } : null,
    wins: s.wins,
    losses: s.losses,
    tokens: s.tokens,
    slots: s.actions,
    slotsMax: E.PREP_SLOTS,
    game: g ? { n: Math.min(total, s.week + 1), total } : null,
    track: seasonTrack(s),
  };
}
