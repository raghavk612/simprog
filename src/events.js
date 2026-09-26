/* =========================================================================
   CHALLENGES: unexpected situations with trade-offs and delayed effects.
   Each choice returns { text, chips } where chips describe exactly what changed.
   ========================================================================= */
'use strict';

const RES_LABEL = { budget: 'Budget', fans: 'Fans', rep: 'Reputation', chem: 'Chemistry', morale: 'Morale', energy: 'Energy' };
function fx(o) {
  const chips = [];
  const s = G.res; const sev = DIFF[G.diff].sev;
  const scale = (v) => v < 0 ? Math.round(v * sev) : v;
  if (o.budget) { const v = o.budget < 0 ? Math.round(o.budget * sev) : o.budget; s.budget += v; chips.push(['Budget', (v > 0 ? '+' : '−') + '$' + Math.abs(v), v > 0]); }
  for (const k of ['fans', 'rep', 'chem']) if (o[k]) { const v = scale(o[k]); s[k] = U.clamp(s[k] + v, 0, 100); chips.push([RES_LABEL[k], U.signed(v), v > 0]); }
  if (o.morale) { const v = scale(o.morale); allMorale(v); chips.push(['Team morale', U.signed(v), v > 0]); }
  if (o.energy) { const v = scale(o.energy); G.roster.forEach(p => p.energy = U.clamp(p.energy + v, 0, 100)); chips.push(['Team energy', U.signed(v), v > 0]); }
  if (o.p) for (const [pl, k, v0] of o.p) {
    const v = v0 < 0 ? scale(v0) : v0;
    if (k === 'morale') { moraleChange(pl, v); chips.push([`${pl.last} morale`, U.signed(v), v > 0]); }
    else if (k === 'gpa') { pl.gpa = U.clamp(+(pl.gpa + v).toFixed(2), 1.2, 4); chips.push([`${pl.last} GPA`, U.signed(v, 2), v > 0]); }
    else if (k === 'inj') { pl.inj = v; if (v > 0) G.injuriesTotal++; chips.push([`${pl.last}`, v ? `out ${v} wk` : 'healthy', !v]); }
    else if (k === 'energy') { pl.energy = U.clamp(pl.energy + v, 0, 100); chips.push([`${pl.last} energy`, U.signed(v), v > 0]); }
    else if (k === 'susp') { pl.suspendWeeks = v - 1; pl.suspended = true; chips.push([`${pl.last}`, `suspended ${v} game${v > 1 ? 's' : ''}`, false]); }
    else if (k === 'pot') { pl.pot = U.clamp(pl.pot + v, 30, 99); chips.push([`${pl.last} potential`, U.signed(v), true]); }
    else if (ATTR.includes(k)) { pl.r[k] = U.clamp(pl.r[k] + v, 20, 99); chips.push([`${pl.last} ${ATTR_NAME[k]}`, U.signed(v), v > 0]); }
  }
  if (o.flag) { Object.assign(G.flags, o.flag); }
  return chips;
}
function best(filter) { return G.roster.filter(p => !p.inj && (!filter || filter(p))).sort((a, b) => ovr(b) - ovr(a))[0]; }
function starters() { return G.lineup.map(id => G.roster.find(p => p.id === id)).filter(Boolean); }

const EVENTS = [
  { id: 'ankle', title: 'Rolled Ankle', icon: 'medical', cond: () => !!best(),
    ctx: () => ({ p: best() }),
    text: c => `${c.p.first} ${c.p.last}, your best player, rolled an ankle at the end of Tuesday's practice. The trainer thinks two weeks of rest. ${c.p.first} swears it's fine and begs to play Friday.`,
    choices: [
      { t: 'Rest him the full two weeks', tags: [['Star', 'out 2 wk'], ['Reputation', '+4']], go: c => ({ text: `You put ${c.p.first}'s long-term health first. Parents notice.`, chips: fx({ rep: 4, p: [[c.p, 'inj', 2], [c.p, 'morale', -4]] }) }) },
      { t: 'Tape it up and play him', tags: [['Star', 'plays'], ['Re-injury', 'risk ↑']], go: c => { G.flags.rushed = c.p.id; return { text: `${c.p.first} will play with a brace. He's thrilled, but a second injury is much more likely.`, chips: fx({ p: [[c.p, 'morale', 6], [c.p, 'energy', -15]], rep: -3 }) }; } },
      { t: 'Pay for a sports specialist', tags: [['Budget', '−$450'], ['Star', 'out 1 wk']], go: c => ({ text: `The specialist speeds up recovery. ${c.p.first} misses just this week.`, chips: fx({ budget: -450, p: [[c.p, 'inj', 1]] }) }) },
    ] },
  { id: 'grades', title: 'Report Card Day', icon: 'book', cond: () => G.roster.some(p => p.gpa < 2.3 && !p.inj),
    ctx: () => ({ p: G.roster.filter(p => !p.inj).sort((a, b) => a.gpa - b.gpa)[0] }),
    text: c => { c.p.gpa = Math.min(c.p.gpa, 1.9); return `Progress reports are out. ${c.p.first} ${c.p.last} is at a ${c.p.gpa.toFixed(2)} GPA, below the 2.0 needed to be eligible. His chemistry teacher says a retake could help.`; },
    choices: [
      { t: 'Mandatory study hall with you', tags: [['GPA', '+0.35'], ['His morale', '−4']], go: c => ({ text: `${c.p.first} grumbles, but the grades come up.`, chips: fx({ p: [[c.p, 'gpa', .35], [c.p, 'morale', -4]], rep: 2 }) }) },
      { t: 'Hire a tutor', tags: [['Budget', '−$250'], ['GPA', '+0.45']], go: c => ({ text: `A tutor works with ${c.p.first} three nights a week.`, chips: fx({ budget: -250, p: [[c.p, 'gpa', .45]] }) }) },
      { t: 'Ask the teacher for a favor', tags: [['Risky', 'ethics'], ['Reputation', '?']], go: c => {
          if (chance(.45)) return { text: `The principal found out. ${c.p.first} is suspended two games and your reputation takes a big hit.`, chips: fx({ rep: -22, p: [[c.p, 'susp', 2], [c.p, 'gpa', .1]] }) };
          return { text: `The teacher bumps the grade. Nobody notices... this time. It still didn't sit right with the staff.`, chips: fx({ rep: -8, p: [[c.p, 'gpa', .3]] }) }; } },
    ] },
  { id: 'sponsor', title: 'Local Sponsor Offer', icon: 'money', cond: () => !!best(),
    ctx: () => ({ p: best() }),
    text: c => `Tony's Brick Oven Pizza wants to sponsor the team for $1,000. The catch: they want ${c.p.first} ${c.p.last} on the ad banner and "playing big minutes every game."`,
    choices: [
      { t: 'Take the deal', tags: [['Budget', '+$1,000'], ['Star fatigue', '↑']], go: c => { G.flags.heavy = c.p.id; return { text: `The check clears. ${c.p.first} will be leaned on hard this week.`, chips: fx({ budget: 1000, fans: 4, p: [[c.p, 'energy', -10]] }) }; } },
      { t: 'Negotiate: no playing-time strings', tags: [['Budget', '+$600 or $0'], ['Chance', '55%']], go: c => chance(.55) ? { text: `Tony agrees to $600 with no strings. Smart business.`, chips: fx({ budget: 600, rep: 3 }) } : { text: `Tony walks away from the table.`, chips: fx({ rep: 1 }) } },
      { t: 'Politely decline', tags: [['Reputation', '+3']], go: () => ({ text: `You keep coaching decisions separate from sponsors. The community respects it.`, chips: fx({ rep: 3 }) }) },
    ] },
  { id: 'trash', title: 'Rival Trash Talk', icon: 'megaphone', cond: () => true,
    ctx: () => ({ o: currentOpp() }),
    text: c => `A ${c.o.name} player posted a video mocking your team: "Easy win Friday." It has 4,000 views and your players have all seen it.`,
    choices: [
      { t: 'Use it as bulletin-board motivation', tags: [['Morale', '+6'], ['Shooting', 'boost this game']], go: () => ({ text: `The clip is taped inside every locker. Your team is locked in.`, chips: fx({ morale: 6, flag: { motivated: true } }) }) },
      { t: 'Tell the team to ignore it', tags: [['Chemistry', '+4']], go: () => ({ text: `"We play our game." The team tightens up.`, chips: fx({ chem: 4 }) }) },
      { t: 'Clap back on the team account', tags: [['Fans', '+9'], ['Reputation', '−7']], go: () => ({ text: `Your reply goes viral locally. Students love it. The principal does not.`, chips: fx({ fans: 9, rep: -7 }) }) },
    ] },
  { id: 'flu', title: 'Flu Going Around', icon: 'medical', cond: () => true, ctx: () => ({}),
    text: () => `Three players came to practice with fevers. The school nurse says a flu bug is spreading through the building.`,
    choices: [
      { t: 'Send sick players home, disinfect', tags: [['Budget', '−$200'], ['Energy', '+5']], go: () => ({ text: `Supplies bought and the gym wiped down. The bug is contained.`, chips: fx({ budget: -200, energy: 5 }) }) },
      { t: 'Practice anyway', tags: [['Chance', '50% spread'], ['Energy', '?']], go: () => chance(.5) ? { text: `The flu spread through the roster. Everyone is dragging.`, chips: fx({ energy: -25, morale: -4 }) } : { text: `Lucky break. Nobody else got sick.`, chips: fx({ chem: 1 }) } },
      { t: 'Cancel a practice, everyone rests', tags: [['Energy', '+15'], ['Chemistry', '−3']], go: () => ({ text: `A day off helps everyone recover, but you lose a day of team reps.`, chips: fx({ energy: 15, chem: -3 }) }) },
    ] },
  { id: 'parent', title: 'Playing Time Complaint', icon: 'mail',
    cond: () => G.roster.filter(p => !G.lineup.includes(p.id) && !p.inj).length > 0,
    ctx: () => ({ p: G.roster.filter(p => !G.lineup.includes(p.id) && !p.inj).sort((a, b) => a.morale - b.morale)[0] }),
    text: c => `The parent of ${c.p.first} ${c.p.last} emailed the Athletic Director, upset that his son "barely plays." The AD asked you to handle it.`,
    choices: [
      { t: 'Meet the family and explain his role', tags: [['Reputation', '+4'], ['His morale', '+6']], go: c => ({ text: `A calm, honest meeting. ${c.p.first} knows exactly what to work on.`, chips: fx({ rep: 4, p: [[c.p, 'morale', 6]] }) }) },
      { t: 'Promise him more minutes', tags: [['His morale', '+14'], ['Chemistry', '−4']], go: c => ({ text: `${c.p.first} is happy. Some teammates think minutes can be bought with emails.`, chips: fx({ chem: -4, p: [[c.p, 'morale', 14]] }) }) },
      { t: 'Ignore the email', tags: [['Reputation', '−6'], ['His morale', '−8']], go: c => ({ text: `The parent goes to the school board meeting. Not a good look.`, chips: fx({ rep: -6, p: [[c.p, 'morale', -8]] }) }) },
    ] },
  { id: 'friction', title: 'Locker Room Friction', icon: 'alert', cond: () => starters().length >= 2,
    ctx: () => { const s = shuffle(starters().slice()); return { a: s[0], b: s[1] }; },
    text: c => `${c.a.first} ${c.a.last} and ${c.b.first} ${c.b.last} got into a shouting match over who takes the last shot. The team is picking sides.`,
    choices: [
      { t: 'Hold a team meeting', tags: [['Chemistry', '+8'], ['Energy', '−4']], go: () => ({ text: `A long, honest meeting clears the air.`, chips: fx({ chem: 8, energy: -4 }) }) },
      { t: 'Bench both for the first quarter', tags: [['Reputation', '+3'], ['Their morale', '−8']], go: c => ({ text: `Accountability sends a message to the whole roster.`, chips: fx({ rep: 3, chem: 4, p: [[c.a, 'morale', -8], [c.b, 'morale', -8]] }) }) },
      { t: 'Let them work it out', tags: [['Chance', '50/50'], ['Chemistry', '?']], go: () => chance(.5) ? { text: `They squashed it themselves. Maybe even closer now.`, chips: fx({ chem: 3 }) } : { text: `It festered. The locker room is split.`, chips: fx({ chem: -11, morale: -3 }) } },
    ] },
  { id: 'phenom', title: 'Freshman Wants Minutes', icon: 'star', cond: () => G.roster.some(p => p.year <= 10 && p.pot - ovr(p) >= 10 && !p.inj),
    ctx: () => ({ p: G.roster.filter(p => p.year <= 10 && !p.inj).sort((a, b) => (b.pot - ovr(b)) - (a.pot - ovr(a)))[0] }),
    text: c => `${c.p.first} ${c.p.last} (${YEAR[c.p.year]}, potential ${c.p.pot}) asked why he isn't starting. He's raw, but the talent is obvious.`,
    choices: [
      { t: 'Pair him with a senior mentor', tags: [['Potential', '+4'], ['Chemistry', '+3']], go: c => ({ text: `The senior takes him under his wing.`, chips: fx({ chem: 3, p: [[c.p, 'pot', 4], [c.p, 'morale', 4]] }) }) },
      { t: 'Give him extra 1-on-1 skill work', tags: [['His skills', '+'], ['Energy', '−8 him']], go: c => ({ text: `Early mornings in the gym pay off.`, chips: fx({ p: [[c.p, 'sho', 2], [c.p, 'ins', 2], [c.p, 'energy', -8], [c.p, 'morale', 5]] }) }) },
      { t: 'Tell him to wait his turn', tags: [['His morale', '−8'], ['Seniors', 'happy']], go: c => ({ text: `The upperclassmen appreciate it. ${c.p.first} sulks.`, chips: fx({ morale: 2, p: [[c.p, 'morale', -8]] }) }) },
    ] },
  { id: 'gala', title: 'Booster Club Gala', icon: 'money', cond: () => true, ctx: () => ({}),
    text: () => `The booster club president offers to co-host a fundraising dinner. You'd need to front $300 for the venue and have players help serve.`,
    choices: [
      { t: 'Host the gala', tags: [['Budget', '−$300 then ?'], ['Depends on', 'fans']], go: () => { const gain = Math.round(300 + G.res.fans * 14 + R() * 250); return { text: `Turnout was ${G.res.fans > 60 ? 'huge' : G.res.fans > 40 ? 'solid' : 'thin'}. You netted ${U.money(gain - 300)}.`, chips: fx({ budget: gain - 300, fans: 3, energy: -4 }) }; } },
      { t: 'Players volunteer at a food bank instead', tags: [['Reputation', '+6'], ['Chemistry', '+3']], go: () => ({ text: `No money raised, but the community sees who your players are.`, chips: fx({ rep: 6, chem: 3, energy: -3 }) }) },
      { t: 'Skip it', tags: [['No change', '']], go: () => ({ text: `You keep the focus on basketball.`, chips: [] }) },
    ] },
  { id: 'gym', title: 'Gym Double-Booked', icon: 'calendar', cond: () => true, ctx: () => ({}),
    text: () => `The volleyball team's tournament got moved. They need the main gym Thursday, your walkthrough day before the game.`,
    choices: [
      { t: 'Rent the rec center', tags: [['Budget', '−$150']], go: () => ({ text: `Practice goes on as planned across town.`, chips: fx({ budget: -150 }) }) },
      { t: '6 a.m. practice before school', tags: [['Energy', '−10'], ['Morale', '−4']], go: () => ({ text: `Nobody likes a 5:30 alarm, but you got the work in.`, chips: fx({ energy: -10, morale: -4, chem: 2 }) }) },
      { t: 'Cancel and do a film session', tags: [['Energy', '+6'], ['Scouting', 'revealed']], go: () => { G.flags.filmThisWeek = true; return { text: `A classroom film session. Rested legs and a scouting report.`, chips: fx({ energy: 6 }) }; } },
    ] },
  { id: 'transfer', title: 'Transfer Student', icon: 'user', cond: () => G.roster.length < 13 && G.phase !== 'playoffs',
    ctx: () => { const pos = pick(POS); const p = genPlayer(myRating() + 1 + gauss() * 2, pos, ri(10, 11), usedNums(G.roster)); p.start = ovr(p); return { p }; },
    text: c => `${c.p.first} ${c.p.last}, a ${POS_NAME[c.p.pos].toLowerCase()} rated ${ovr(c.p)}, just moved into the district. His eligibility paperwork costs $150, and adding him may ruffle players at his position.`,
    choices: [
      { t: 'Add him to the roster', tags: [['Budget', '−$150'], ['Chemistry', '−5']], go: c => { G.roster.push(c.p); return { text: `Welcome aboard, #${c.p.num}. Some teammates are wary of the new guy.`, chips: fx({ budget: -150, chem: -5 }).concat([['Roster', `+${c.p.last}`, true]]) }; } },
      { t: 'Pass: trust your guys', tags: [['Morale', '+3']], go: () => ({ text: `The team appreciates your loyalty.`, chips: fx({ morale: 3 }) }) },
    ] },
  { id: 'media', title: 'Local News Interview', icon: 'mic', cond: () => true, ctx: () => ({}),
    text: () => `Channel 7 Sports wants a quick sideline interview before the game. The reporter asks: "What are your goals for this team?"`,
    choices: [
      { t: '"We\'re winning State."', tags: [['Fans', '+10'], ['Pressure', 'lose → morale ↓']], go: () => ({ text: `Bold. The town is buzzing, and your players now feel the pressure.`, chips: fx({ fans: 10, flag: { media: true } }) }) },
      { t: 'Praise your players\' work ethic', tags: [['Morale', '+6']], go: () => ({ text: `Your players watch the clip in the locker room, grinning.`, chips: fx({ morale: 6 }) }) },
      { t: '"One game at a time."', tags: [['Reputation', '+2']], go: () => ({ text: `Classic coach-speak. Nobody can argue with it.`, chips: fx({ rep: 2 }) }) },
    ] },
  { id: 'cut', title: 'District Budget Cut', icon: 'money', cond: () => true, ctx: () => ({}),
    text: () => `The district announced mid-year budget cuts. Athletics loses $600 unless programs can justify their spending.`,
    choices: [
      { t: 'Accept the cut', tags: [['Budget', '−$600']], go: () => ({ text: `You tighten the belt.`, chips: fx({ budget: -600 }) }) },
      { t: 'Present to the school board', tags: [['Needs', 'Reputation 55+'], ['Budget', 'keep or −$700']], go: () => G.res.rep >= 55 ? { text: `Your presentation on attendance, grades and community service wins them over. Funding kept.`, chips: fx({ rep: 3 }) } : { text: `The board isn't convinced. They cut even deeper.`, chips: fx({ budget: -700, rep: -2 }) } },
      { t: 'Team car wash to cover half', tags: [['Budget', '−$300'], ['Energy', '−8']], go: () => ({ text: `A long Saturday with soapy buckets covers half the gap.`, chips: fx({ budget: -300, energy: -8, fans: 4 }) }) },
    ] },
  { id: 'captain', title: 'Choose a Captain', icon: 'star', cond: () => G.week <= 6 && G.phase !== 'playoffs' && !G.flags.captain, ctx: () => ({ best: best(), lead: G.roster.filter(p => p.year === 12).sort((a, b) => b.morale - a.morale)[0] || best() }),
    text: c => `The team needs a captain. The candidates: ${c.lead.first} ${c.lead.last}, a respected senior, or ${c.best.first} ${c.best.last}, your best player.`,
    choices: [
      { t: c => `Name ${c.lead.first} ${c.lead.last} captain`, tags: [['Chemistry', '+7']], go: c => { G.flags.captain = c.lead.id; return { text: `${c.lead.first} steps up as the voice of the locker room.`, chips: fx({ chem: 7, p: [[c.lead, 'morale', 6]] }) }; } },
      { t: c => `Name ${c.best.first} ${c.best.last} captain`, tags: [['Star morale', '+10'], ['Morale', '+2']], go: c => { G.flags.captain = c.best.id; return { text: `${c.best.first} embraces the role.`, chips: fx({ morale: 2, p: [[c.best, 'morale', 10]] }) }; } },
      { t: 'Let the players vote', tags: [['Chemistry', '+4'], ['Morale', '+4']], go: () => { G.flags.captain = 'vote'; return { text: `The team feels heard. Co-captains are elected.`, chips: fx({ chem: 4, morale: 4 }) }; } },
    ] },
  { id: 'bus', title: 'Bus Breakdown', icon: 'bus', cond: () => { const i = currentGameInfo(); return !i.home; }, ctx: () => ({}),
    text: () => `The team bus broke down the morning of your road game. Transportation says no replacement until 5 p.m.`,
    choices: [
      { t: 'Charter a coach bus', tags: [['Budget', '−$350']], go: () => ({ text: `You arrive in style and on time.`, chips: fx({ budget: -350 }) }) },
      { t: 'Parents carpool', tags: [['Reputation', '−4'], ['Chemistry', '+2']], go: () => ({ text: `It works, but the AD reminds you about liability rules.`, chips: fx({ rep: -4, chem: 2 }) }) },
      { t: 'Wait for the late bus', tags: [['Energy', '−14']], go: () => ({ text: `You arrive with 20 minutes to warm up. Legs are stiff.`, chips: fx({ energy: -14 }) }) },
    ] },
  { id: 'shoes', title: 'Shoe Company Deal', icon: 'money', cond: () => !G.flags.shoes, ctx: () => ({}),
    text: () => `A regional shoe company offers new team shoes at a discount: $500 for the whole roster. Old shoes are worn out and slippery.`,
    choices: [
      { t: 'Buy the shoes', tags: [['Budget', '−$500'], ['Energy', '+8'], ['Morale', '+4']], go: () => { G.flags.shoes = true; return { text: `Fresh kicks. Players feel faster already.`, chips: fx({ budget: -500, energy: 8, morale: 4 }) }; } },
      { t: 'Hold a shoe drive fundraiser', tags: [['Budget', '−$150'], ['Fans', '+5']], go: () => { G.flags.shoes = true; return { text: `Community donations cover most of the cost.`, chips: fx({ budget: -150, fans: 5, morale: 2 }) }; } },
      { t: 'Make do with old shoes', tags: [['Morale', '−3']], go: () => ({ text: `Duct tape and determination.`, chips: fx({ morale: -3 }) }) },
    ] },
  { id: 'viral', title: 'Highlight Goes Viral', icon: 'megaphone', cond: () => G.games.some(g => g.win), ctx: () => ({ p: best() }),
    text: c => `A student's video of ${c.p.first} ${c.p.last}'s dunk last game hit 200,000 views. Reporters are calling.`,
    choices: [
      { t: 'Share it proudly', tags: [['Fans', '+12'], ['Chemistry', '−3']], go: c => ({ text: `The whole town is talking. A few teammates feel overlooked.`, chips: fx({ fans: 12, chem: -3, p: [[c.p, 'morale', 6]] }) }) },
      { t: 'Credit the whole team', tags: [['Chemistry', '+5'], ['Fans', '+5']], go: () => ({ text: `"That dunk started with a great pass and a stop on D." The team loves it.`, chips: fx({ chem: 5, fans: 5 }) }) },
    ] },
  { id: 'quit', title: 'Players Talking About Quitting', icon: 'alert', cond: () => teamMorale() < 42, forced: () => teamMorale() < 32,
    ctx: () => ({ p: G.roster.slice().sort((a, b) => a.morale - b.morale)[0] }),
    text: c => `Morale is low. ${c.p.first} ${c.p.last} and a couple of others told the managers they're thinking about quitting.`,
    choices: [
      { t: 'Team dinner and a day off', tags: [['Budget', '−$250'], ['Morale', '+14']], go: () => ({ text: `Pizza, laughs, and no basketball talk. Exactly what they needed.`, chips: fx({ budget: -250, morale: 14, energy: 6 }) }) },
      { t: 'Hard, honest talk', tags: [['Chance', '55%'], ['Morale', '±10']], go: () => chance(.55) ? { text: `The talk hits home. The team recommits.`, chips: fx({ morale: 10, chem: 4 }) } : { text: `It came across as a lecture. Things got worse.`, chips: fx({ morale: -8 }) } },
      { t: 'Let unhappy players leave', tags: [['Roster', '−1'], ['Chemistry', '+4']], go: c => { c.p.quit = true; G.roster = G.roster.filter(p => p !== c.p); G.lineup = G.lineup.filter(id => id !== c.p.id); return { text: `${c.p.first} turns in his jersey. Those who stay are all-in.`, chips: fx({ chem: 4 }).concat([['Roster', `−${c.p.last}`, false]]) }; } },
    ] },
  { id: 'honor', title: 'Academic Honor Roll', icon: 'book', cond: () => U.avg(G.roster.map(p => p.gpa)) >= 3.0, ctx: () => ({}),
    text: () => `Your team's average GPA is above 3.0. The principal wants to recognize the team at a school assembly on game day.`,
    choices: [
      { t: 'Accept the recognition', tags: [['Reputation', '+7'], ['Energy', '−3']], go: () => ({ text: `Standing ovation from the student body.`, chips: fx({ rep: 7, fans: 3, energy: -3 }) }) },
      { t: 'Ask to move it after the season', tags: [['Reputation', '+3']], go: () => ({ text: `Focus stays on the game. The principal understands.`, chips: fx({ rep: 3 }) }) },
    ] },
  // Playoff-specific
  { id: 'tickets', title: 'Sold-Out Playoff Crowd', icon: 'money', playoff: true, cond: () => true, ctx: () => ({}),
    text: () => `Playoff tickets are in huge demand. The AD asks how you want to price the student section for this round.`,
    choices: [
      { t: 'Raise prices', tags: [['Budget', '+$500'], ['Fans', '−5']], go: () => ({ text: `The money comes in; a few students grumble.`, chips: fx({ budget: 500, fans: -5 }) }) },
      { t: 'Free student section', tags: [['Fans', '+10'], ['Budget', '−$150']], go: () => ({ text: `The student section is deafening.`, chips: fx({ fans: 10, budget: -150, morale: 3 }) }) },
      { t: 'Keep prices the same', tags: [['Reputation', '+2']], go: () => ({ text: `Fair and simple.`, chips: fx({ rep: 2 }) }) },
    ] },
  { id: 'scout', title: 'College Scout in the Stands', icon: 'user', playoff: true, cond: () => !!best(), ctx: () => ({ p: best() }),
    text: c => `A college scout is coming to watch ${c.p.first} ${c.p.last}. He wants you to "feature him" so he can show off.`,
    choices: [
      { t: 'Run the offense through him', tags: [['Star usage', '↑'], ['Turnovers', '↑']], go: c => { G.flags.hero = true; return { text: `${c.p.first} gets the green light.`, chips: fx({ chem: -2, p: [[c.p, 'morale', 10]] }) }; } },
      { t: 'Stick to the system', tags: [['Chemistry', '+4']], go: c => ({ text: `"Winning gets everyone noticed." ${c.p.first} agrees.`, chips: fx({ chem: 4, p: [[c.p, 'morale', -2]] }) }) },
    ] },
  { id: 'nerves', title: 'Big-Game Nerves', icon: 'alert', playoff: true, cond: () => true, ctx: () => ({}),
    text: () => `Your players have never played on a stage this big. At walkthrough you can see it: short breaths, dropped passes.`,
    choices: [
      { t: 'Run a loose, fun practice', tags: [['Morale', '+7'], ['Energy', '+5']], go: () => ({ text: `Half-court shots and laughter. The tension breaks.`, chips: fx({ morale: 7, energy: 5 }) }) },
      { t: 'Visualization and film session', tags: [['Scouting', 'revealed'], ['Chemistry', '+3']], go: () => { G.flags.filmThisWeek = true; return { text: `They know every set the opponent runs.`, chips: fx({ chem: 3 }) }; } },
      { t: 'Invite alumni to speak', tags: [['Chemistry', '+6'], ['Reputation', '+2']], go: () => ({ text: `The 1998 team tells stories. The players are inspired.`, chips: fx({ chem: 6, rep: 2 }) }) },
    ] },
];

function drawEvent() {
  const playoff = G.phase === 'playoffs';
  const forced = EVENTS.find(e => e.forced && e.forced() && !G.usedEvents.includes(e.id));
  let pool = EVENTS.filter(e => !G.usedEvents.includes(e.id) && (!!e.playoff === playoff || (!e.playoff && playoff && ['trash', 'media', 'gym', 'flu', 'quit', 'friction'].includes(e.id))) && e.cond());
  if (!pool.length) pool = EVENTS.filter(e => (!!e.playoff === playoff) && e.cond());
  const ev = forced || pick(pool);
  G.usedEvents.push(ev.id);
  const ctx = ev.ctx();
  const text = ev.text(ctx);
  G.event = { id: ev.id, text, ctxIds: Object.fromEntries(Object.entries(ctx).map(([k, v]) => [k, v && v.id ? v.id : null])) };
  G._ctx = ctx; // live context (non-serialized objects are fine; transfer players are regenerated on reload)
  return G.event;
}
function eventCtx() {
  if (G._ctx) return G._ctx;
  const ev = EVENTS.find(e => e.id === G.event.id); const ctx = {};
  for (const [k, id] of Object.entries(G.event.ctxIds || {})) ctx[k] = G.roster.find(p => p.id === id) || null;
  if (ev.id === 'transfer' && !ctx.p) Object.assign(ctx, ev.ctx());
  if (ev.id === 'trash') ctx.o = currentOpp();
  G._ctx = ctx; return ctx;
}
function resolveEvent(i) {
  const ev = EVENTS.find(e => e.id === G.event.id); const ch = ev.choices[i]; const ctx = eventCtx();
  const out = ch.go(ctx);
  G.eventDone = { choice: i, label: typeof ch.t === 'function' ? ch.t(ctx) : ch.t, text: out.text, chips: out.chips };
  G.log.push({ w: G.phase === 'playoffs' ? 'P' : G.week, t: `${ev.title}: ${G.eventDone.label}. ${out.text}` });
  delete G._ctx;
  validateLineup();
  return out;
}
