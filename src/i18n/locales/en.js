// English: the source of truth. Other languages must define exactly the same keys and {{placeholders}} (checked by tests/i18n.test.js).
// Strings are stored in normal case; labels drawn in capitals are upper-cased by the code (tu), and \n becomes a line break (tb).
import {COMMENTARY} from '../../basketball.js';
export default {
 meta:{title:'KANGS • Road to the Championship',description:'One team. One season. Your decisions. Coach the Lake Washington Kangs in a 3D basketball management simulation.'},
 lang:{en:'English',es:'Spanish',zh:'Chinese',fr:'French',ja:'Japanese',it:'Italian',hi:'Hindi'},
 a11y:{
  skip:'Skip to main content',closeDialog:'Close dialog',stage:'Interactive 3D Kangs gym',pageOpened:'{{page}} page opened',newTab:'opens in a new tab',
  score:'Score: Kangs {{home}}, visitors {{away}}.',soundOn:'Sound effects on',soundOff:'Sound effects off',motionOn:'Motion on',motionOff:'Motion off',
  camera:'Camera view: {{view}}',speed:'Viewing speed {{speed}}',languageChanged:'Language changed to {{language}}'
 },
 keys:{shortcut:'Shortcut: {{key}}'},
 nav:{home:'Program HQ',roster:'Roster & rotation',practice:'Practice planner',recruit:'Tryouts',staff:'Coach’s office',game:'Game day',locker:'Locker room',season:'Season journal',data:'Real Kangs data'},
 top:{brand:'Road to the Championship',soundOn:'Sound on',soundOff:'Sound off',motionOn:'Motion on',motionOff:'Motion off',settings:'Settings',export:'Save / export',help:'Help',title:'Title'},
 side:{sub:'Basketball operations',badge:'The championship project',nav:'Program navigation',rules:'Rulebook & controls',credits:'Credits & sources',coach:'Coach {{name}}',difficulty:'{{level}} difficulty',footer:'One team. One season. Your decisions.',footerNote:'Auto-saved locally · Fictional simulation / sourced public roster'},
 stage:{venue:'Kangs Fieldhouse',hint:'Drag to orbit · scroll to zoom',place:'Kirkland, Washington',tagline:'Our house. Your program.',camera:'Camera view',wide:'Wide',court:'Courtside',follow:'Follow'},
 metrics:{record:'Record',tokens:'Program tokens',chemistry:'Chemistry',fans:'Fans'},
 header:{complete:'Season complete',game:'Game {{n}} / {{total}}'},
 level:{rookie:'Rookie',standard:'Standard',elite:'Elite'},
 difficulty:{rookie:'Rookie · more room to learn',standard:'Varsity · every decision matters',elite:'Elite · small margins'},
 landing:{
  school:'Lake Washington',program:'Basketball program',badge:'A coaching simulation',tagline:'One team. One season.',titleA:'Road to the',titleB:'Championship.',
  intro:'Take the keys to the Kangs. Develop your players, make the hard calls, and write a different ending to a real season.',
  name:'Your name, coach',namePlaceholder:'Enter your name',challenge:'Choose your challenge',start:'Take over the Kangs',continue:'Continue saved season →',howTo:'How to play',import:'Import season',
  ticketSeason:'2025—26 / Reimagined',ticketA:'The road',ticketB:'starts here.',ticketBody:'14 real players · 30 published matchups\nYour decisions. Your results.',
  footer:'Road to the championship',footerNote:'Independent student project · Not school-endorsed'
 },
 home:{
  kicker:'The program',welcome:'Welcome back, Coach {{name}}.',intro:'A championship is built long before tip-off.',doneIntro:'Your season has its ending. Every decision helped write it.',
  quickRosterA:'Set the five',quickRosterB:'Build your rotation',quickPracticeA:'Put in the work',quickPracticeB:'{{n}} preparation slots left',quickStaffA:'People first',quickStaffB:'Check in with your team',
  sidebar:'Next game and recent result',finalChapter:'Final chapter',nextOnSchedule:'Next on the schedule',champions:'State champions.',seasonEnds:'The season ends.',
  finalRecord:'{{w}} wins. {{l}} losses. A program you built.',viewStory:'View season story',prepare:'Prepare for tip-off →',bracketNote:'State bracket · win or go home',seasonNote:'One season. One championship.',
  rippleKicker:'The ripple effect',rippleTitle:'Every choice travels.',rippleDefault:'Practice, conversations and recovery change what happens on court. Your decision trail starts here.'
 },
 roster:{
  kicker:'The people behind the jersey',intro:'Set five starters and distribute 160 player-minutes. Health, energy and academic eligibility affect availability.',
  spots:'{{n}} / 15 roster spots',minutes:'{{n}} / 160 minutes',auto:'Build eligible rotation',
  notice:'Names and jersey numbers are public team facts. Skills, GPA, health, morale and all game outcomes below are fictional simulation values.',
  start:'Start',player:'Player',skill:'Skill',energy:'Energy',morale:'Morale',gpa:'Sim. GPA',status:'Status',minutesCol:'Minutes',actions:'Actions',
  startAria:'Start {{name}}',minutesAria:'Minutes for {{name}}',profile:'Profile',profileAria:'Open profile for {{name}}'
 },
 status:{injured:'Injured',ineligible:'Ineligible',exhausted:'Exhausted',ready:'Ready'},
 pos:{guard:'Guard',forward:'Forward'},
 year:{senior:'Senior',junior:'Junior',sophomore:'Sophomore',prospect:'Fictional prospect',tryout:'Tryout'},
 practice:{
  kicker:'Develop the whole athlete',intro:'Three preparation slots before every game. Trade short-term readiness against long-term development.',group:'Training group',wholeTeam:'Whole team',
  slots:'{{n}} / 3 slots available',cost:'{{cost}} program tokens · 1 slot',effects:'Training effects',fxSkill:'Skill {{n}}',fxEnergy:'Energy {{n}}',fxMorale:'Morale {{n}}',fxGpa:'GPA {{n}}',
  schedule:'Schedule session →',planKicker:'Plan with intention',planTitle:'What happens next?',
  planP1:'Fatigued players make fewer shots. A connected team creates better looks. Study hall keeps your lineup eligible.',planP2:'Every session is recorded in your decision trail and postgame breakdown.'
 },
 plan:{
  shooting:{name:'Shooting lab',desc:'Repetition turns open looks into points. Builds skill but costs energy.'},
  defense:{name:'Defensive rotations',desc:'Move together. Sharpen fundamentals and build team chemistry.'},
  recovery:{name:'Recovery & mobility',desc:'Help a simulated injury recover and restore energy for game day.'},
  study:{name:'Study hall',desc:'Protect eligibility. Academic preparation is part of a healthy program.'},
  bond:{name:'Team dinner',desc:'A shared meal builds trust, morale and connection.'}
 },
 staff:{
  development:{name:'Development specialist',detail:'+1 skill on skill practices'},
  recovery:{name:'Sports recovery coach',detail:'+8 energy on recovery; lower injury risk'},
  culture:{name:'Culture builder',detail:'+3 morale and chemistry on team dinners'}
 },
 recruit:{
  kicker:'Find the next difference maker',intro:'Fictional candidates join your real-roster simulation. Recruiting uses program tokens, never real money.',tokens:'{{n}} tokens available',
  tryout:'Fictional tryout · {{pos}}',sign:'Sign · {{cost}} tokens',signAria:'Sign {{name}} for {{cost}} tokens',none:'All tryout candidates have been signed.'
 },
 office:{
  kicker:'Lead the program',intro:'Your staff and conversations shape the team beyond the scoreboard.',weekly:'Weekly team check-in',title:'Make time for your people.',
  body:'The bench wants a voice. The team needs resources. Schoolwork is piling up. Choose where you spend one preparation slot.',
  listen:'Listen to the bench',listenFx:'+7 morale · +5 chemistry',fundraise:'Host a community clinic',fundraiseFx:'+180 tokens · +40 fans · −5 energy',academics:'Academic check-in',academicsFx:'+0.18 simulated GPA',
  assistantKicker:'One assistant slot',buildStaff:'Build your coaching staff.',assistantBody:'Assistant roles are fictional game choices. Their bonuses apply to your preparation sessions.',
  hired:'Hired',cost:'{{cost}} tokens',hireAria:'Hire {{name}} for {{cost}} tokens',dismiss:'Dismiss assistant'
 },
 game:{
  speed:'Viewing speed',kangs:'Kangs',visitors:'Visitors',liveKicker:'Live from the fieldhouse',prepKicker:'Prepare. Adapt. Execute.',liveTitle:'Game day. Your call.',vs:'Kangs vs {{opp}}',
  alternateBracket:'Alternate state bracket',published:'Published matchup / simulated outcome',overtime:'Overtime',quarter:'Q{{n}}',possessions:'{{n}} possessions',
  choosePlay:'Choose a play and watch the possession develop.',playByPlay:'Play-by-play',crowdReady:'The crowd is ready. Call the opening possession.',
  scouting:'Scouting report',reference:'Reference result: Lake Washington {{a}}–{{b}}. Your result has not been written.',strength:'Game opponent strength',style:'Style',unscouted:'Unscouted',
  advice:{perimeter:'Close out on shooters. Zone is the recommended defensive response.',paint:'Protect the interior. Pressure can disrupt their entry passes.',transition:'Control the rhythm. Balanced defense keeps your team organized.'},
  adviceNote:'This scout profile is part of the simulation.',scout:'Watch opponent film · 50 tokens / 1 slot',boxScore:'Box score',controls:'Game controls',sideline:'The sideline',startingFive:'Your starting five',
  callPlay:'Call the play',system:'System',tempo:'Tempo',resumeFinal:'Resume final play',pauseFinal:'Pause final play',pause:'Pause game',resume:'Resume game',watch:'▶ Watch live',next:'Next play →',
  timeout:'Timeout huddle · {{n}} left',ready:'Ready for tip-off?',minShort:'{{n}}m',assigned:'{{n}} / 160 minutes assigned',adjust:'Adjust rotation',tipOff:'Tip off →',
  look:'{{player}} · {{phase}} · {{contest}}'
 },
 tactic:{balanced:'Balanced',zone:'Zone / closeouts',pressure:'Pressure defense',perimeter:'Spread / shoot threes'},
 pace:{steady:'Steady',fast:'Fast break'},
 style:{perimeter:'Perimeter',paint:'Paint',transition:'Transition'},
 shot:{catch:'Catch-and-shoot three',pullup:'Pull-up jumper',stepback:'Step-back three',drive:'Crossover layup',floater:'Running floater',hook:'Post hook',dunk:'Fast-break dunk',roll:'Pick-and-roll finish'},
 phase:{pass:'Pass & relocate',attack:'Attack & dribble',gather:'Gather & contest',blocked:'Shot blocked',turnover:'Turnover',flight:'Shot in flight',basket:'Basket',rebound:'Rebound'},
 contest:{open:'open look',tight:'tight look',contested:'contested look'},
 outcome:{made:'made',miss:'miss',block:'block',steal:'steal'},
 impact:{skill:'Skill',energy:'Energy',morale:'Morale',chemistry:'Chemistry',shotType:'Shot type',space:'Space',tactics:'Tactics'},
 stats:{assists:'assists',blocks:'blocks',steals:'steals',rebounds:'rebounds'},
 replay:{kicker:'The film room',title:'Watch the play develop.',intro:'Recorded actions and outcomes. Replaying never changes your season.',recorded:'Recorded play',again:'Replay again',pause:'Pause replay',resume:'Resume replay',back:'Back to season journal'},
 locker:{
  kicker:'Wear your identity',intro:'Choose the kit your players wear in the 3D gym. Rename players through their roster profiles.',issue:'Kangs team issue',title:'Make it yours.',kits:'Jersey kits',
  home:'Home purple',away:'Away white',alternate:'Midnight alternate',trim:'Jersey number color',note:'Original jersey designs inspired by the school’s purple and white identity. No official logo or athlete likeness is used.'
 },
 journal:{
  kicker:'The story of your season',intro:'Your simulated record, decisions, standings and defining moments.',path:'Season stages',regular:'Regular season',district:'District stretch',state:'State championship',
  bannerYours:'The banner is yours',teaches:'Every season teaches you something',whistle:'The final whistle.',
  summary:'Coach {{coach}} finished {{w}}–{{l}}, grew a fanbase of {{fans}}, and developed a team with {{chem}} chemistry.',newSeason:'Start a new season',export:'Export this season',
  results:'Your results',scoreboard:'The scoreboard tells one part.',replay:'Replay ↗',noGames:'Play your opening game to start your story.',standings:'Program standings',table:'The campaign table',
  tableNote:'Fictional campaign standings: other opponents play simulated background fixtures each round. These are not official KingCo standings.',trail:'Decision trail',gameN:'Game {{n}}',trailEmpty:'Your decisions will appear here.'
 },
 ending:{
  kicker:'The final whistle',won:'You brought it home.',over:'Your season is complete.',bannerTitle:'A banner earned. A program built.',lossTitle:'A different ending starts with a different decision.',
  record:'Final record: {{w}}–{{l}}.',championBody:'The Kangs are champions in your alternate season.',lossBody:'The state run has ended. Review your decision trail and build your next strategy.',story:'Watch your season story'
 },
 data:{
  kicker:'Real program. Transparent sources.',title:'The real Kangs',intro:'Published 2025–26 boys varsity facts, kept separate from your simulation.',badge:'Dated public snapshot',school:'Lake Washington · Kirkland, WA',
  checked:'Last successful source check: {{date}}. The scheduled updater checks daily; this historical season is not a live score feed.',
  record:'Team record: {{w}}–{{l}}. Team scoring average: {{avg}} across {{n}} published games.',refresh:'Check for updated snapshot',
  notice:'Individual averages below use only games where the publisher reports points. Missing games are not counted as zero. They are not complete-season averages. Refreshing sources never changes your saved simulation mid-season.',
  rosterTable:'Real roster',realRoster:'Real roster',position:'Position',height:'Height',year:'Year',reportedGames:'Reported games',ppg:'Reported-game PPG',notReported:'Not reported',
  scheduleTitle:'Published schedule & actual results',date:'Date',opponent:'Opponent',score:'Actual LW score',venue:'Venue',source:'Source: {{link}}',sourceLink:'FinalScoreTV published roster, schedule and player box scores'
 },
 tutorial:{
  label:'First-time coach tour',kicker:'First-time coach · {{n}}/4',next:'Next →',finish:'Let’s coach',skip:'Skip tour',
  step1:{title:'Welcome to your program.',body:'Start by choosing your five starters and assigning 160 minutes.'},
  step2:{title:'Build the whole athlete.',body:'Use three preparation slots for skills, recovery, study or team bonding.'},
  step3:{title:'Your decisions follow you.',body:'Hire one assistant and talk with your team. Morale and chemistry change performance.'},
  step4:{title:'Make the game yours.',body:'Scout the opponent, tip off and change tactics live. Win the state bracket in this one season.'}
 },
 timeout:{kicker:'Timeout huddle',title:'Bring it in.',body:'Three timeouts per game. Both approaches boost the next eight possessions.',calm:'Calm the team · +4 energy',belief:'Show belief · +3 morale',feedPrefix:'Timeout',feed:{calm:'Breathe. Settle. Execute. Energy +4.',belief:'Trust each other. Morale +3.'}},
 credits:{
  kicker:'Built for the love of the game',creators:'Creators',assets:'Assets, software & research',
  kenney:'{{link}} — CC0. Imported GLB bench, chair, table, cabinet and plant. The pack also includes Unity-compatible FBX files. Models loaded in this scene: {{loaded}}/5.',
  three:'{{link}} — MIT. WebGL rendering, OrbitControls and GLTFLoader.',
  fonts:'{{barlow}} (Jeremy Tribby) and {{dm}} (Colophon Foundry) — SIL Open Font License, bundled locally.',
  vite:'{{link}} — MIT. Build tooling.',
  finalscore:'{{link}} — public 2025–26 roster, schedule, results and available player scoring facts. Individual player links appear in Real Kangs Data.',
  kangs:'{{link}} — school program identity and context.',
  nfhs:'{{link}} — introductory rulebook reference; detailed officiating is abstracted in the game.',
  fbla:'{{event}} and {{guidelines}} guidelines and rubric — Road to the Championship topic.',
  ecoquest:'The settings, synthesized-sound and language-switching approach is adapted from {{link}}.',
  generated:'Court, basketball, stylized characters, jerseys, interface and synthesized sounds are generated in code. Characters are not likenesses of real students. Developed with AI coding assistance (OpenAI Codex). No official school endorsement.',
  render:'Three.js renders the 3D game; accessible HTML overlays handle forms and coaching controls. Unity prefab files are not run in the browser: licensed cross-engine models are imported as GLB.'
 },
 rules:{
  kicker:'The coach’s handbook',title:'One season. One goal.',
  steps:[
   'Enter your coach name and choose a difficulty. Your season saves on this browser after every decision.',
   'Choose exactly five starters. Allocate 160 minutes total, with no player above 32. A player needs energy ≥15, no active simulated injury, and simulated GPA ≥2.0.',
   'Use up to three preparation slots before each game. Practices, recovery, study, bonding, scouting and conversations spend a slot; recruits and your single assistant spend tokens.',
   'Play 20 regular matchups, then six district-stage matchups. At least 12 total wins after game 26 qualify you for the four-game state run. Every state game is elimination. This simplified alternate bracket uses the published opponent sequence, including an alternate championship final; it is not the actual WIAA bracket.',
   'Call each possession or watch live. Change your system, manage fatigue and call up to three timeouts. Ties go to overtime. Each game awards 160 tokens, plus 70 for a win.',
   'Training costs energy; games reduce energy and academic readiness. Low energy reduces shot quality and raises simulated injury risk. Recovery restores energy and reduces injury time. Unused bench players can lose morale.',
   'The roster cap is 15. Tryout players and assistant roles are fictional. Releasing a player gives no refund. You cannot change the rotation or train during a game.'
  ],
  conduct:'Basketball & conduct',
  conductP1:'Two points for field goals, three for long shots. This coaching model animates drives, jumpers, passes, steals, blocks and defensive rebounds while abstracting individual fouls, free throws and substitutions; it is not a full officiating simulator. The 32-minute game and 160 player-minute budget frame your rotation.',
  conductP2:'Respect teammates, opponents and officials. Academic ineligibility prevents participation in this game. The 2.0 threshold is a game rule, not a statement of the school’s actual policy. Recruit tokens are an abstract program resource, not payments to real athletes. Injury and recovery are fictional mechanics.',
  guideTitle:'On-court rule guide',
  guide:[
   'Keep a legal dribble and pivot. Traveling or restarting an ended dribble can give possession to the opponent.',
   'Keep the ball in bounds. Touching a boundary or the floor outside it makes a player out of bounds; the last-touch ruling determines the ensuing throw-in.',
   'Defend without illegal contact. Personal fouls can lead to a throw-in or free throws depending on the play and team-foul situation.',
   'Do not interfere with the basket or a protected shot. Basket interference and goaltending have scoring consequences; unsporting actions may also result in technical penalties.',
   'Respect officials and opponents. Technical or flagrant misconduct can carry free throws, possession penalties or removal, depending on the ruling.'
  ],
  guideNote:'This is an introductory guide. Consult {{link}} and the applicable state rules for complete officiating details. This game abstracts those on-court violations; its direct management consequences are listed above.',
  controls:'Controls & accessibility',
  controlsP1:'Mouse/touch: drag the gym to orbit, scroll to zoom. Use the camera buttons for preset views. All coaching controls support keyboard navigation. Sound starts off. Motion off replaces movement with static action poses. Viewing speed (1×/2×/4×) changes presentation only; it never changes results. Use Save / export for a portable JSON save, and Import season from the title screen to restore it.',
  shortcuts:'Keyboard shortcuts',
  controlsP2:'Open Settings to rebind these keys, adjust sound, text size, colors, motion and playback speed, or change the language. Settings are saved in this browser.',
  dataNote:'Real data is a dated source snapshot checked by the daily publishing job. Your own game stats update every possession. Missing real-world statistics remain unavailable rather than being invented.'
 },
 profile:{
  kicker:'Player profile · #{{n}}',ppg:'Sim. PPG',risk:'Injury risk',elevated:'Elevated',low:'Low',injured:'Simulated injury: {{n}} recovery steps remaining.',
  healthy:'Available health status is fictional; no private athlete information is used.',rename:'Player display name',save:'Save name',
  original:'Original source name: {{name}}. Renaming only changes your simulation.',release:'Release from roster'
 },
 result:{
  kicker:'The film room · {{outcome}}',win:'Win',loss:'Loss',before:'What you did before tip-off',noPrep:'No preparation sessions were recorded for this matchup.',defining:'Defining possessions',
  shotQuality:'Shot quality: {{n}}%.',why:'Why it happened · decision analysis',
  whyBody:'Latest possession: changes to the base shot probability, in percentage points. These are model contributions, not claims about what would have happened in real life.',
  scoring:'Simulated scoring',former:'Former roster player',pts:'{{n}} PTS'
 },
 notify:{
  storage:'Browser storage is unavailable. Export your season to keep progress.',checked:'Snapshot checked: {{date}}.',snapshotFailed:'Source snapshot unavailable. Keeping the last verified data.',
  finishFirst:'Finish the game first.',minutes:'Enter whole minutes between 0 and 32.',exported:'Season exported.',tooLarge:'Save file too large',badSave:'This is not a compatible Kangs season file.',saved:'Saved.'
 },
 confirm:{replace:'Replace this browser’s saved season? Export it first if you want to keep it.',import:'Replace the current local season with this save?',release:'Release this player from your simulation roster?'},
 // Play-by-play commentary templates live with the engine so the English text has a single source.
 cm:COMMENTARY,
 // Decision-trail and result lines written by the simulation.
 log:{wholeTeam:'whole team',train:'{{plan}}: {{who}} · skill {{skill}}, energy {{energy}}, GPA {{gpa}}',recruit:'{{name}} joined through tryouts for {{cost}} tokens.',release:'{{name}} released from the active roster.',hire:'Hired {{staff}}.',dismiss:'Assistant dismissed. No refund.',talkListen:'You listened to the bench: morale +7, chemistry +5.',talkFundraise:'Community clinic: +180 tokens, +40 fans, −5 energy.',talkAcademics:'Academic check-in: every simulated GPA +0.18.',scout:'Film study revealed the opponent’s preferred style. Tactical reads improved.',tipoff:'Tip-off vs {{opp}}.',injury:'{{name}}: simulated ankle strain. Recovery or rest required.',win:'win',loss:'loss',result:'{{outcome}} {{home}}–{{away}} vs {{opp}}. {{reason}}',reason:'Team chemistry {{chem}}; average energy {{energy}}.',reasonWithScouting:'Scouting prepared your defensive reads. Team chemistry {{chem}}; average energy {{energy}}.',runEnds:'The championship run ends this season. Review your decisions and try again.',champions:'STATE CHAMPIONS. One season. Your program.',seasonComplete:'Season complete.'},
 error:{title:'The program could not load.',body:'Please reload after your connection returns.',reload:'Reload'},
 // Messages thrown by the simulation engine. The English text is the lookup key.
 errors:{
  'This season is complete. Start a new season to play again.':'This season is complete. Start a new season to play again.',
  'Finish the current game first.':'Finish the current game first.',
  'Not enough program tokens.':'Not enough program tokens.',
  'Your three preparation slots are used. Play the next game.':'Your three preparation slots are used. Play the next game.',
  'Unknown practice':'Unknown practice',
  'Choose a player':'Choose a player',
  'Prospect unavailable':'Prospect unavailable',
  'Roster full: release a player before signing.':'Roster full: release a player before signing.',
  'Keep at least five players.':'Keep at least five players.',
  'Player unavailable':'Player unavailable',
  'One assistant allowed. Dismiss your assistant first.':'One assistant allowed. Dismiss your assistant first.',
  'Coach unavailable':'Coach unavailable',
  'This week’s team conversation is complete.':'This week’s team conversation is complete.',
  'Opponent already scouted.':'Opponent already scouted.',
  'Select exactly five starters.':'Select exactly five starters.',
  'Each starter needs playing time.':'Each starter needs playing time.',
  'An assigned player is injured, exhausted, or below the game’s 2.0 GPA threshold.':'An assigned player is injured, exhausted, or below the game’s 2.0 GPA threshold.',
  'Minutes must be whole numbers from 0 to 32.':'Minutes must be whole numbers from 0 to 32.',
  'Allocate exactly 160 player-minutes (five players × 32 minutes).':'Allocate exactly 160 player-minutes (five players × 32 minutes).',
  'No timeouts remaining.':'No timeouts remaining.',
  'No game in progress':'No game in progress'
 },
 settings:{
  title:'Settings',eyebrow:'Preferences',done:'Done',activeCount:'{{n}} accessibility options changed from the defaults',
  tabs:{controls:'Controls',sound:'Sound',accessibility:'Accessibility',language:'Language'},
  controls:{
   intro:'Choose a button, then press the key you want to use. Shortcuts work on the game screens when no dialog is open. Escape cancels.',
   actions:{playPause:'Watch live / pause',nextPlay:'Next play',timeout:'Timeout huddle',camWide:'Camera: wide',camCourt:'Camera: courtside',camFollow:'Camera: follow',speed:'Cycle viewing speed',sound:'Turn sound on or off',settings:'Open settings'},
   pressKey:'Press a key…',rebind:'Change key for {{action}}, currently {{key}}',keyUsed:'{{key}} is already used for “{{action}}”.',reserved:'{{key}} is reserved and cannot be assigned.',
   bound:'{{action}} is now {{key}}',resetDefaults:'Reset key bindings',resetToast:'Key bindings restored to the defaults.'
  },
  sound:{
   title:'Sound effects',masterVolume:'Master volume',masterVolumeDesc:'Controls the volume of all sound effects',quiet:'Quiet',loud:'Loud',sfxEnabled:'Sound effects',sfxEnabledDesc:'Turn all game and interface sounds on or off. They start off.',
   testSound:'Test sound',testSoundDesc:'Plays a sample even while sound effects are off',play:'Play',individual:'Individual sounds',individualDesc:'Choose which sounds you want to hear.',
   resetAll:'Reset sound settings',resetToast:'Sound settings restored to the defaults.',
   items:{
    swish:{name:'Made basket',desc:'A swish when a two-pointer drops'},
    three:{name:'Three-pointer',desc:'A swish with a bright ping for threes'},
    rim:{name:'Missed shot',desc:'A clank off the rim'},
    block:{name:'Block',desc:'A thud when a shot is swatted away'},
    steal:{name:'Steal',desc:'A quick swipe when the ball is taken'},
    whistle:{name:'Whistle',desc:'The referee whistle at tip-off and when a season starts'},
    timeout:{name:'Timeout',desc:'Bell tones in the timeout huddle'},
    confirm:{name:'Decision confirmed',desc:'Training, conversations, scouting and saving'},
    select:{name:'Selection',desc:'A soft tick when you change a choice'},
    error:{name:'Not allowed',desc:'A low buzz when an action is rejected'},
    signing:{name:'Signing',desc:'Sparkle when a player or assistant joins'},
    victory:{name:'Victory',desc:'A fanfare after a win'},
    defeat:{name:'Defeat',desc:'A gentle falling phrase after a loss'},
    uiClick:{name:'Interface clicks',desc:'Clicks when you use buttons and menus'}
   }
  },
  accessibility:{
   visual:'Visual',motorInput:'Motor & input',cognitive:'Cognitive',
   colorBlindMode:'Color-vision correction',colorBlindModeDesc:'Shifts colors so they are easier to tell apart if you have a color-vision deficiency',
   colorBlindOptions:{none:'Off',deuteranopia:'Deuteranopia (green)',protanopia:'Protanopia (red)',tritanopia:'Tritanopia (blue)'},
   highContrast:'High contrast',highContrastDesc:'Black background, white borders and text, thicker focus outlines',
   reducedMotion:'Reduced motion',reducedMotionDesc:'Static action poses instead of movement, and no interface animation',
   screenShake:'Screen shake',screenShakeDesc:'A short camera shake on dunks and blocks. Ignored when reduced motion is on.',
   reduceFlashes:'Reduce flashes and pulsing',reduceFlashesDesc:'Turns off blinking and pulsing effects and hover brightness changes',
   fontFamily:'Font style',fontFamilyDesc:'Choose a typeface for the interface',fontPreview:'The quick brown fox',fontOptions:{default:'Default',modern:'Modern',readable:'Readable'},
   textSize:'Text size',textSizeDesc:'Make all interface text smaller or larger',textSizeSmall:'Small',textSizeLarge:'Large',
   playbackSpeed:'Playback speed',playbackSpeedDesc:'Slows every play so there is more time to follow the action. Results never change.',
   playbackSpeedOptions:{'0_5':'50% (relaxed)','0_75':'75% (easy)','1':'100% (normal)'},
   timingAssist:'Timing assist',timingAssistDesc:'Adds a pause between plays in Watch live and keeps messages on screen longer',
   simplifiedUI:'Simplified interface',simplifiedUIDesc:'Hides decorative labels, badges and extra notes so only the essentials remain',
   resetAll:'Reset accessibility settings',resetToast:'Accessibility settings restored to the defaults.',
   statement:'Accessibility: Kangs is designed to work with a keyboard and a screen reader. Every play is also written out in text, because the 3D scene is visual. Options include color-vision correction, high contrast, reduced motion, adjustable text and fonts, slower playback and a simplified interface. We follow WCAG 2.1 practices where we can, but the game has not had a formal accessibility audit.'
  },
  language:{title:'Language',desc:'Change the language of the interface. Player and team names stay as published.'}
 }
};
