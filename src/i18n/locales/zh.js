// 简体中文。键和 {{占位符}} 与 en.js 完全一致。
export default {
 meta:{title:'KANGS • 通往冠军之路',description:'一支球队，一个赛季，由你决策。在 3D 篮球管理模拟中执教 Lake Washington Kangs 队。'},
 lang:{en:'英语',es:'西班牙语',zh:'中文',fr:'法语',ja:'日语',it:'意大利语',hi:'印地语'},
 a11y:{
  skip:'跳到主要内容',closeDialog:'关闭对话框',stage:'可交互的 3D Kangs 球馆',pageOpened:'已打开页面：{{page}}',newTab:'在新标签页中打开',
  score:'比分：Kangs {{home}}，客队 {{away}}。',soundOn:'音效已开启',soundOff:'音效已关闭',motionOn:'动态效果已开启',motionOff:'动态效果已关闭',
  camera:'镜头视角：{{view}}',speed:'观看速度 {{speed}}',languageChanged:'语言已切换为{{language}}'
 },
 keys:{shortcut:'快捷键：{{key}}'},
 nav:{home:'项目总部',roster:'阵容与轮换',practice:'训练计划',recruit:'选拔试训',staff:'教练办公室',game:'比赛日',locker:'更衣室',season:'赛季日志',data:'Kangs 真实数据'},
 top:{brand:'通往冠军之路',soundOn:'声音已开',soundOff:'声音已关',motionOn:'动态已开',motionOff:'动态已关',settings:'设置',export:'保存 / 导出',help:'帮助',title:'标题页'},
 side:{sub:'篮球运营',badge:'冠军计划',nav:'项目导航',rules:'规则手册与操作',credits:'致谢与资料来源',coach:'{{name}} 教练',difficulty:'{{level}}难度',footer:'一支球队，一个赛季，由你决策。',footerNote:'本地自动保存 · 虚构模拟 / 有来源的公开名单'},
 stage:{venue:'Kangs 球馆',hint:'拖动可环绕 · 滚动可缩放',place:'华盛顿州柯克兰',tagline:'我们的主场，你的球队。',camera:'镜头视角',wide:'全景',court:'场边',follow:'跟随'},
 metrics:{record:'战绩',tokens:'项目代币',chemistry:'默契',fans:'球迷'},
 header:{complete:'赛季已结束',game:'第 {{n}} 场 / 共 {{total}} 场'},
 level:{rookie:'新手',standard:'标准',elite:'精英'},
 difficulty:{rookie:'新手 · 有更多学习空间',standard:'校队 · 每个决定都很重要',elite:'精英 · 容错极小'},
 landing:{
  school:'Lake Washington',program:'篮球项目',badge:'执教模拟游戏',tagline:'一支球队，一个赛季。',titleA:'通往',titleB:'冠军之路。',
  intro:'接过 Kangs 的帅印。培养你的球员，做出艰难的决定，为一个真实的赛季写下不同的结局。',
  name:'教练，请输入你的名字',namePlaceholder:'输入你的名字',challenge:'选择你的挑战',start:'执掌 Kangs',continue:'继续已保存的赛季 →',howTo:'玩法说明',import:'导入赛季',
  ticketSeason:'2025—26 / 重新演绎',ticketA:'冠军之路',ticketB:'从这里开始。',ticketBody:'14 名真实球员 · 30 场已公布的比赛\n你的决策，你的结果。',
  footer:'通往冠军之路',footerNote:'独立学生项目 · 未获学校认可'
 },
 home:{
  kicker:'球队项目',welcome:'欢迎回来，{{name}} 教练。',intro:'冠军，早在跳球之前就已开始铸就。',doneIntro:'你的赛季已有结局。每个决定都参与了书写。',
  quickRosterA:'确定首发五人',quickRosterB:'安排你的轮换',quickPracticeA:'投入训练',quickPracticeB:'还剩 {{n}} 个备战时段',quickStaffA:'以人为先',quickStaffB:'和球队聊一聊',
  sidebar:'下一场比赛与最近结果',finalChapter:'最终章',nextOnSchedule:'赛程中的下一场',champions:'州冠军。',seasonEnds:'赛季结束。',
  finalRecord:'{{w}} 胜 {{l}} 负。这是你一手打造的球队。',viewStory:'查看赛季故事',prepare:'为跳球做好准备 →',bracketNote:'州淘汰赛 · 不胜即淘汰',seasonNote:'一个赛季，一个冠军。',
  rippleKicker:'连锁效应',rippleTitle:'每个选择都会产生影响。',rippleDefault:'训练、谈话和恢复会改变赛场上发生的一切。你的决策记录从这里开始。'
 },
 roster:{
  kicker:'球衣背后的人',intro:'选出五名首发，并分配 160 个球员分钟。健康、体能和学业资格都会影响出战情况。',
  spots:'阵容名额 {{n}} / 15',minutes:'{{n}} / 160 分钟',auto:'生成符合资格的轮换',
  notice:'姓名和球衣号码是公开的球队信息。下方的技能、绩点、健康、士气以及所有比赛结果都是虚构的模拟数值。',
  start:'首发',player:'球员',skill:'技能',energy:'体能',morale:'士气',gpa:'模拟绩点',status:'状态',minutesCol:'分钟',actions:'操作',
  startAria:'首发：{{name}}',minutesAria:'{{name}} 的上场分钟数',profile:'资料',profileAria:'打开 {{name}} 的资料'
 },
 status:{injured:'受伤',ineligible:'无资格',exhausted:'体力耗尽',ready:'状态良好'},
 pos:{guard:'后卫',forward:'前锋'},
 year:{senior:'高三',junior:'高二',sophomore:'高一',prospect:'虚构新秀',tryout:'试训'},
 practice:{
  kicker:'培养全面的运动员',intro:'每场比赛前有三个备战时段。在短期状态与长期成长之间取舍。',group:'训练对象',wholeTeam:'全队',
  slots:'可用时段 {{n}} / 3',cost:'{{cost}} 项目代币 · 1 个时段',effects:'训练效果',fxSkill:'技能 {{n}}',fxEnergy:'体能 {{n}}',fxMorale:'士气 {{n}}',fxGpa:'绩点 {{n}}',
  schedule:'安排训练 →',planKicker:'有目的地规划',planTitle:'接下来会发生什么？',
  planP1:'疲劳的球员投篮命中更少。团结的球队能创造更好的出手机会。自习室能让你的阵容保持参赛资格。',planP2:'每次训练都会记录在你的决策记录和赛后分析中。'
 },
 plan:{
  shooting:{name:'投篮训练',desc:'反复练习能把空位机会变成得分。提升技能，但会消耗体能。'},
  defense:{name:'防守轮转',desc:'协同移动。打磨基本功，增进球队默契。'},
  recovery:{name:'恢复与灵活性',desc:'帮助模拟伤病恢复，并为比赛日恢复体能。'},
  study:{name:'自习室',desc:'守住参赛资格。学业准备是健康项目的一部分。'},
  bond:{name:'球队聚餐',desc:'一起吃饭能建立信任、提升士气、增进感情。'}
 },
 staff:{
  development:{name:'成长培养专家',detail:'技能训练 +1 技能'},
  recovery:{name:'运动恢复教练',detail:'恢复时 +8 体能；降低受伤风险'},
  culture:{name:'球队文化建设者',detail:'球队聚餐时 +3 士气和默契'}
 },
 recruit:{
  kicker:'发现下一个改变局面的人',intro:'虚构的候选人会加入你的真实名单模拟。招募只使用项目代币，绝不涉及真钱。',tokens:'可用代币 {{n}}',
  tryout:'虚构试训 · {{pos}}',sign:'签约 · {{cost}} 代币',signAria:'以 {{cost}} 代币签下 {{name}}',none:'所有试训候选人都已签约。'
 },
 office:{
  kicker:'领导球队项目',intro:'你的教练组和谈话会在记分牌之外塑造这支球队。',weekly:'每周球队沟通',title:'为你的人留出时间。',
  body:'替补席希望被倾听。球队需要资源。功课越堆越多。请选择把一个备战时段用在哪里。',
  listen:'倾听替补席',listenFx:'+7 士气 · +5 默契',fundraise:'举办社区训练营',fundraiseFx:'+180 代币 · +40 球迷 · −5 体能',academics:'学业谈话',academicsFx:'+0.18 模拟绩点',
  assistantKicker:'一个助理教练名额',buildStaff:'组建你的教练团队。',assistantBody:'助理教练的角色是虚构的游戏选项。他们的加成适用于你的备战训练。',
  hired:'已聘用',cost:'{{cost}} 代币',hireAria:'以 {{cost}} 代币聘请{{name}}',dismiss:'解雇助理教练'
 },
 game:{
  speed:'观看速度',kangs:'Kangs',visitors:'客队',liveKicker:'球馆直播',prepKicker:'准备，应变，执行。',liveTitle:'比赛日，由你指挥。',vs:'Kangs 对阵 {{opp}}',
  alternateBracket:'备选州淘汰赛',published:'已公布的对阵 / 模拟结果',overtime:'加时赛',quarter:'第{{n}}节',possessions:'{{n}} 个回合',
  choosePlay:'选择一个战术，观看这个回合如何展开。',playByPlay:'逐回合解说',crowdReady:'观众已就绪。请安排第一个回合。',
  scouting:'球探报告',reference:'参考结果：Lake Washington {{a}}–{{b}}。你的结果尚未写下。',strength:'对手游戏强度',style:'风格',unscouted:'未侦察',
  advice:{perimeter:'封堵射手。推荐用联防应对。',paint:'保护内线。施压可以打乱他们的传球入内。',transition:'掌控节奏。平衡的防守能让球队保持组织。'},
  adviceNote:'这份球探档案属于模拟的一部分。',scout:'观看对手录像 · 50 代币 / 1 个时段',boxScore:'技术统计',controls:'比赛控制',sideline:'场边',startingFive:'你的首发五人',
  callPlay:'指挥战术',system:'体系',tempo:'节奏',resumeFinal:'继续最后一次进攻',pauseFinal:'暂停最后一次进攻',pause:'暂停比赛',resume:'继续比赛',watch:'▶ 直播观看',next:'下一回合 →',
  timeout:'暂停 · 剩余 {{n}} 次',ready:'准备好跳球了吗？',minShort:'{{n}} 分钟',assigned:'已分配 {{n}} / 160 分钟',adjust:'调整轮换',tipOff:'跳球 →',
  look:'{{player}} · {{phase}} · {{contest}}'
 },
 tactic:{balanced:'均衡',zone:'联防 / 补防',pressure:'压迫防守',perimeter:'拉开空间 / 投三分'},
 pace:{steady:'稳健',fast:'快攻'},
 style:{perimeter:'外线',paint:'内线',transition:'转换'},
 shot:{catch:'接球三分',pullup:'运球急停跳投',stepback:'后撤步三分',drive:'变向上篮',floater:'行进间抛投',hook:'低位勾手',dunk:'快攻扣篮',roll:'挡拆后终结'},
 phase:{pass:'传球与跑位',attack:'进攻与运球',gather:'起跳准备与封盖',blocked:'投篮被盖帽',turnover:'失误',flight:'球在空中',basket:'得分',rebound:'篮板'},
 contest:{open:'空位出手',tight:'贴身防守下出手',contested:'有人防守下出手'},
 outcome:{made:'命中',miss:'未中',block:'盖帽',steal:'抢断'},
 impact:{skill:'技能',energy:'体能',morale:'士气',chemistry:'默契',shotType:'投篮类型',space:'空间',tactics:'战术'},
 stats:{assists:'助攻',blocks:'盖帽',steals:'抢断',rebounds:'篮板'},
 replay:{kicker:'录像室',title:'观看这次进攻如何展开。',intro:'已记录的动作与结果。回放不会改变你的赛季。',recorded:'已记录的进攻',again:'再次回放',pause:'暂停回放',resume:'继续回放',back:'返回赛季日志'},
 locker:{
  kicker:'穿上属于你的身份',intro:'选择球员在 3D 球馆里穿的球衣。可在球员资料中修改球员姓名。',issue:'Kangs 球队队服',title:'让它属于你。',kits:'球衣款式',
  home:'主场紫',away:'客场白',alternate:'午夜备选',trim:'球衣号码颜色',note:'原创球衣设计，灵感来自学校的紫白配色。未使用任何官方标志或真实运动员的肖像。'
 },
 journal:{
  kicker:'你的赛季故事',intro:'你的模拟战绩、决策、积分榜和决定性时刻。',path:'赛季阶段',regular:'常规赛',district:'学区赛阶段',state:'州锦标赛',
  bannerYours:'冠军旗帜属于你',teaches:'每个赛季都会教会你一些东西',whistle:'终场哨响。',
  summary:'{{coach}} 教练以 {{w}}–{{l}} 完成赛季，球迷增长到 {{fans}} 人，并打造出默契值为 {{chem}} 的球队。',newSeason:'开始新赛季',export:'导出本赛季',
  results:'你的比赛结果',scoreboard:'记分牌只讲述了一部分。',replay:'回放 ↗',noGames:'打完你的首场比赛，开启你的故事。',standings:'项目积分榜',table:'赛季积分表',
  tableNote:'虚构的赛季积分榜：其他对手每轮都会进行模拟的背景比赛。这不是 KingCo 的官方积分榜。',trail:'决策记录',gameN:'第 {{n}} 场',trailEmpty:'你的决策会显示在这里。'
 },
 ending:{
  kicker:'终场哨响',won:'你把冠军带回了家。',over:'你的赛季已经结束。',bannerTitle:'一面赢来的冠军旗帜，一支亲手打造的球队。',lossTitle:'不同的结局，始于不同的决定。',
  record:'最终战绩：{{w}}–{{l}}。',championBody:'在你的备选赛季中，Kangs 夺得了冠军。',lossBody:'州赛之旅已经结束。回顾你的决策记录，制定下一个策略。',story:'观看你的赛季故事'
 },
 data:{
  kicker:'真实的球队，透明的来源。',title:'真实的 Kangs',intro:'已公布的 2025–26 赛季男子校队资料，与你的模拟分开保存。',badge:'带日期的公开快照',school:'Lake Washington · 华盛顿州柯克兰',
  checked:'数据源最近一次成功检查：{{date}}。定时更新程序每天检查一次；这个历史赛季不是实时比分源。',
  record:'球队战绩：{{w}}–{{l}}。球队场均得分：{{avg}}（基于 {{n}} 场已公布比赛）。',refresh:'检查是否有更新的快照',
  notice:'下方的个人平均数据只统计数据源提供得分的比赛。缺失的比赛不会被当作 0 分。它们不是整个赛季的平均值。刷新数据源绝不会在赛季中途改变你已保存的模拟。',
  rosterTable:'真实名单',realRoster:'真实名单',position:'位置',height:'身高',year:'年级',reportedGames:'有数据的比赛',ppg:'场均得分（仅有数据的比赛）',notReported:'无数据',
  scheduleTitle:'已公布赛程与真实结果',date:'日期',opponent:'对手',score:'LW 实际比分',venue:'场地',source:'来源：{{link}}',sourceLink:'FinalScoreTV 公布的名单、赛程与球员技术统计'
 },
 tutorial:{
  label:'新手教练引导',kicker:'新手教练 · {{n}}/4',next:'下一步 →',finish:'开始执教！',skip:'跳过引导',
  step1:{title:'欢迎来到你的球队项目。',body:'先选出五名首发，并分配 160 分钟。'},
  step2:{title:'培养全面的运动员。',body:'用三个备战时段进行技能训练、恢复、学习或增进球队感情。'},
  step3:{title:'你的决定会一路相随。',body:'聘请一名助理教练，并和球队谈话。士气与默契会影响发挥。'},
  step4:{title:'让比赛由你主导。',body:'侦察对手、开始比赛，并在场上实时调整战术。在这一个赛季里拿下州淘汰赛。'}
 },
 timeout:{kicker:'暂停',title:'都过来。',body:'每场比赛有三次暂停。两种方式都会提升接下来的八个回合。',calm:'让球队冷静 · +4 体能',belief:'展现信任 · +3 士气',feedPrefix:'暂停',feed:{calm:'深呼吸，稳住，执行。体能 +4。',belief:'彼此信任。士气 +3。'}},
 credits:{
  kicker:'为热爱篮球而作',creators:'创作者',assets:'素材、软件与资料',
  kenney:'{{link}} — CC0。已导入 GLB 格式的长椅、椅子、桌子、柜子和植物。该素材包还包含兼容 Unity 的 FBX 文件。本场景已加载的模型：{{loaded}}/5。',
  three:'{{link}} — MIT。WebGL 渲染、OrbitControls 与 GLTFLoader。',
  fonts:'{{barlow}}（Jeremy Tribby）与 {{dm}}（Colophon Foundry）— SIL Open Font License，已本地打包。',
  vite:'{{link}} — MIT。构建工具。',
  finalscore:'{{link}} — 公开的 2025–26 名单、赛程、结果和可用的球员得分数据。各球员的链接显示在“Kangs 真实数据”中。',
  kangs:'{{link}} — 学校球队项目的标识与背景。',
  nfhs:'{{link}} — 规则入门参考；游戏中对详细裁判规则做了简化。',
  fbla:'{{event}}以及 {{guidelines}} 的指南与评分标准 — “通往冠军之路”主题。',
  ecoquest:'设置、合成音效和语言切换的思路改编自 {{link}}。',
  generated:'球场、篮球、风格化角色、球衣、界面和合成音效均由代码生成。角色并非真实学生的肖像。在 AI 编程助手（OpenAI Codex）的协助下开发。未获学校官方认可。',
  render:'Three.js 负责渲染 3D 游戏；无障碍的 HTML 层负责表单和教练操作。Unity 预制件不会在浏览器中运行：获得许可的跨引擎模型以 GLB 格式导入。'
 },
 rules:{
  kicker:'教练手册',title:'一个赛季，一个目标。',
  steps:[
   '输入你的教练名字并选择难度。每次决策后，赛季都会保存在此浏览器中。',
   '选出恰好五名首发。总共分配 160 分钟，单个球员不超过 32 分钟。球员需要体能 ≥15、没有未痊愈的模拟伤病，且模拟绩点 ≥2.0。',
   '每场比赛前最多可使用三个备战时段。训练、恢复、学习、增进感情、侦察和谈话都会消耗一个时段；招募球员和你唯一的助理教练则消耗代币。',
   '先打 20 场常规赛，再打六场学区赛阶段的比赛。第 26 场之后累计至少 12 胜，才能晋级四场的州淘汰赛。每一场州赛都是淘汰制。这个简化的备选对阵表使用已公布的对手顺序，并包含一场备选的决赛；它不是真正的 WIAA 对阵表。',
   '逐回合指挥，或直接观看直播。更换体系、管理疲劳，并最多叫三次暂停。平局进入加时赛。每场比赛奖励 160 代币，获胜再加 70。',
   '训练会消耗体能；比赛会降低体能和学业准备度。体能过低会降低出手质量，并提高模拟伤病风险。恢复能补充体能并缩短伤病时间。长期不上场的替补球员可能会损失士气。',
   '阵容上限为 15 人。试训球员和助理教练角色都是虚构的。解约球员不会退款。比赛进行中不能更改轮换或进行训练。'
  ],
  conduct:'篮球与行为准则',
  conductP1:'投篮命中得两分，远投得三分。这个执教模型会为突破、跳投、传球、抢断、盖帽和防守篮板制作动画，但对个人犯规、罚球和换人做了简化；它不是完整的裁判模拟器。32 分钟的比赛和 160 个球员分钟的预算决定了你的轮换。',
  conductP2:'尊重队友、对手和裁判。学业上不具备资格的球员不能参加本游戏。2.0 的门槛是游戏规则，并不代表学校的实际政策。招募代币是抽象的项目资源，不是支付给真实运动员的报酬。伤病与恢复都是虚构的机制。',
  guideTitle:'场上规则指南',
  guide:[
   '保持合法的运球和中枢脚。走步或在结束运球后再次运球，可能让对手获得球权。',
   '保持球在界内。触碰边线或界外地面会使球员出界；由最后触球者决定随后的掷界外球。',
   '防守时避免非法接触。个人犯规可能导致掷界外球或罚球，具体取决于该次进攻和球队犯规情况。',
   '不要干扰篮筐或受保护的投篮。干扰球和goaltending（干扰得分）会影响比分；违反体育道德的行为还可能被判技术犯规。',
   '尊重裁判和对手。技术犯规或恶意犯规可能导致罚球、球权处罚或被罚出场，取决于裁决。'
  ],
  guideNote:'这只是入门指南。完整的裁判细节请查阅{{link}}以及适用的州规则。本游戏对这些场上违例做了简化；它们对管理造成的直接后果已在上文列出。',
  controls:'操作与无障碍',
  controlsP1:'鼠标/触屏：拖动可环绕球馆，滚动可缩放。使用镜头按钮切换预设视角。所有教练操作都支持键盘。声音默认关闭。关闭动态效果后，会用静态动作姿势代替动画。观看速度（1×/2×/4×）只改变呈现方式，绝不会改变结果。使用“保存 / 导出”获得便携的 JSON 存档，并在标题页使用“导入赛季”来恢复。',
  shortcuts:'键盘快捷键',
  controlsP2:'打开“设置”可以重新设置这些按键、调整声音、文字大小、颜色、动态效果和播放速度，或切换语言。设置会保存在此浏览器中。',
  dataNote:'真实数据是带日期的来源快照，由每日发布任务检查。你自己的比赛数据会在每个回合更新。缺失的真实统计数据会保持缺失，而不会被编造。'
 },
 profile:{
  kicker:'球员资料 · #{{n}}',ppg:'模拟场均得分',risk:'受伤风险',elevated:'较高',low:'较低',injured:'模拟伤病：还需 {{n}} 个恢复步骤。',
  healthy:'此处显示的健康状态是虚构的；未使用任何运动员的私人信息。',rename:'球员显示名称',save:'保存名称',
  original:'数据源中的原始名称：{{name}}。重命名只会改变你的模拟。',release:'从名单中解约'
 },
 result:{
  kicker:'录像室 · {{outcome}}',win:'胜',loss:'负',before:'你在跳球前做了什么',noPrep:'这场比赛没有记录任何备战训练。',defining:'决定性回合',
  shotQuality:'出手质量：{{n}}%。',why:'为什么会这样 · 决策分析',
  whyBody:'最近一个回合：对基础投篮概率的改变量，以百分点计。这些是模型的贡献，并不代表现实中本会发生的事。',
  scoring:'模拟得分',former:'前名单球员',pts:'{{n}} 分'
 },
 notify:{
  storage:'浏览器存储不可用。请导出你的赛季以保留进度。',checked:'已检查快照：{{date}}。',snapshotFailed:'数据源快照不可用。继续使用最近一次验证过的数据。',
  finishFirst:'请先结束比赛。',minutes:'请输入 0 到 32 之间的整数分钟。',exported:'赛季已导出。',tooLarge:'存档文件太大',badSave:'这不是兼容的 Kangs 赛季文件。',saved:'已保存。'
 },
 confirm:{replace:'要替换此浏览器中已保存的赛季吗？如果想保留它，请先导出。',import:'要用这个存档替换当前的本地赛季吗？',release:'要把这名球员从你的模拟名单中解约吗？'},
 // Play-by-play commentary templates: one sentence per template, filled from the play.
 cm:{join:'',side:{right:'右',left:'左'},lead:{catch:['{{helper}}把球传给{{side}}侧翼的{{name}}。','{{name}}无球跑位；{{helper}}找到了空档。'],pullup:['{{name}}在罚球线肘区急停。','{{name}}用一个迟疑运球，从中距离起跳。'],stepback:['{{name}}变向运球后，向后撤步退到三分线外。','{{name}}假装突破，用后撤步创造出空间。'],drive:['{{name}}换手，摆脱了{{def}}。','{{name}}用变向运球攻击空档。'],floater:['{{name}}钻进禁区，轻巧地抛出一记抛投。','{{name}}用一记高弧度抛投避开了协防球员。'],hook:['{{name}}背身在低位要位，越过肩膀转身。','{{name}}在低位把防守者卡死。'],dunk:['{{name}}冲在回防的防线前面。','{{helper}}在转换进攻中把球传给{{name}}。'],roll:['{{helper}}做挡拆；{{name}}绕过掩护。','{{name}}借着{{helper}}的掩护，强力切向篮筐。']},steal:['{{def}}抓准时机，从{{name}}手中断下了球。失误。','{{def}}把球从{{name}}手里打掉，抢到了球权。'],block:['{{def}}在出手瞬间封盖——盖帽！','{{def}}补位过来，把球拍飞。'],loose:'{{rebounder}}拿到了这个无人控制的球。',finish:{three:['三分——空心入网。','三分球命中。','远距离命中。'],dunk:['双手举过篮筐——扣篮！','用一记扣篮完成进攻。'],two:['手感柔和，拿下两分。','球应声入网。','球终于进了。'],miss:['打在篮筐上。','这球就是不进。','球在篮筐上滚了出来。']},assist:'助攻：{{helper}}。',rebound:'{{rebounder}}拿下篮板。'},
 // Decision-trail and result lines written by the simulation.
 log:{wholeTeam:'全队',train:'{{plan}}：{{who}} · 技能 {{skill}}，体能 {{energy}}，绩点 {{gpa}}',recruit:'{{name}} 通过试训加入，花费 {{cost}} 代币。',release:'{{name}} 已从现役名单中解约。',hire:'已聘用{{staff}}。',dismiss:'助理教练已被解雇。不予退款。',talkListen:'你倾听了替补席：士气 +7，默契 +5。',talkFundraise:'社区训练营：+180 代币，+40 球迷，−5 体能。',talkAcademics:'学业谈话：所有人的模拟绩点 +0.18。',scout:'录像研究揭示了对手偏好的风格。战术判断得到提升。',tipoff:'与 {{opp}} 的比赛开始跳球。',injury:'{{name}}：模拟脚踝扭伤。需要恢复或休息。',win:'胜',loss:'负',result:'{{outcome}} {{home}}–{{away}} 对阵 {{opp}}。{{reason}}',reason:'球队默契 {{chem}}；平均体能 {{energy}}。',reasonWithScouting:'侦察为你的防守判断做好了准备。球队默契 {{chem}}；平均体能 {{energy}}。',runEnds:'本赛季的冠军之路到此结束。回顾你的决策，再试一次。',champions:'州冠军。一个赛季，你的球队。',seasonComplete:'赛季结束。'},
 error:{title:'无法加载球队项目。',body:'网络恢复后请重新加载。',reload:'重新加载'},
 errors:{
  'This season is complete. Start a new season to play again.':'本赛季已结束。开始新赛季即可再次游玩。',
  'Finish the current game first.':'请先结束当前比赛。',
  'Not enough program tokens.':'项目代币不足。',
  'Your three preparation slots are used. Play the next game.':'你的三个备战时段已用完。请进行下一场比赛。',
  'Unknown practice':'未知的训练',
  'Choose a player':'请选择一名球员',
  'Prospect unavailable':'该候选人不可用',
  'Roster full: release a player before signing.':'名单已满：请先解约一名球员再签约。',
  'Keep at least five players.':'至少保留五名球员。',
  'Player unavailable':'该球员不可用',
  'One assistant allowed. Dismiss your assistant first.':'只能有一名助理教练。请先解雇现有的助理教练。',
  'Coach unavailable':'该教练不可用',
  'This week’s team conversation is complete.':'本周的球队谈话已经完成。',
  'Opponent already scouted.':'已经侦察过这个对手。',
  'Select exactly five starters.':'请选出恰好五名首发。',
  'Each starter needs playing time.':'每名首发都需要上场时间。',
  'An assigned player is injured, exhausted, or below the game’s 2.0 GPA threshold.':'被安排上场的球员受伤、体力耗尽，或低于游戏规定的 2.0 绩点门槛。',
  'Minutes must be whole numbers from 0 to 32.':'分钟数必须是 0 到 32 的整数。',
  'Allocate exactly 160 player-minutes (five players × 32 minutes).':'请恰好分配 160 个球员分钟（五名球员 × 32 分钟）。',
  'No timeouts remaining.':'已没有剩余暂停。',
  'No game in progress':'当前没有进行中的比赛'
 },
 settings:{
  title:'设置',eyebrow:'偏好',done:'完成',activeCount:'有 {{n}} 项无障碍选项与默认值不同',
  tabs:{controls:'操作',sound:'声音',accessibility:'无障碍',language:'语言'},
  controls:{
   intro:'先选择一个按钮，再按下你想使用的按键。没有打开对话框时，快捷键可在游戏界面使用。按 Esc 取消。',
   actions:{playPause:'直播观看 / 暂停',nextPlay:'下一回合',timeout:'暂停',camWide:'镜头：全景',camCourt:'镜头：场边',camFollow:'镜头：跟随',speed:'切换观看速度',sound:'开启或关闭声音',settings:'打开设置'},
   pressKey:'请按一个键……',rebind:'更改“{{action}}”的按键，当前为 {{key}}',keyUsed:'{{key}} 已用于“{{action}}”。',reserved:'{{key}} 为保留键，无法分配。',
   bound:'“{{action}}”现在是 {{key}}',resetDefaults:'重置按键',resetToast:'已恢复默认按键。'
  },
  sound:{
   title:'音效',masterVolume:'总音量',masterVolumeDesc:'控制所有音效的音量',quiet:'小声',loud:'大声',sfxEnabled:'音效',sfxEnabledDesc:'开启或关闭所有游戏和界面声音。默认关闭。',
   testSound:'试听音效',testSoundDesc:'即使音效已关闭也会播放一段示例',play:'播放',individual:'单项音效',individualDesc:'选择你想听到哪些声音。',
   resetAll:'重置声音设置',resetToast:'已恢复默认声音设置。',
   items:{
    swish:{name:'投篮命中',desc:'两分球命中时的入网声'},
    three:{name:'三分球',desc:'三分球命中时带有清脆提示音的入网声'},
    rim:{name:'投篮不中',desc:'球砸在篮筐上的声音'},
    block:{name:'盖帽',desc:'投篮被盖掉时的闷响'},
    steal:{name:'抢断',desc:'球被抢走时的快速擦过声'},
    whistle:{name:'哨声',desc:'跳球和开始新赛季时的裁判哨声'},
    timeout:{name:'暂停',desc:'暂停时的钟声'},
    confirm:{name:'决定已确认',desc:'训练、谈话、侦察和保存'},
    select:{name:'选择',desc:'更改选项时轻轻的一声'},
    error:{name:'无法操作',desc:'操作被拒绝时的低沉嗡嗡声'},
    signing:{name:'签约',desc:'球员或助理教练加入时的闪烁声'},
    victory:{name:'胜利',desc:'获胜后的号角声'},
    defeat:{name:'失利',desc:'失利后轻柔下行的乐句'},
    uiClick:{name:'界面点击声',desc:'使用按钮和菜单时的点击声'}
   }
  },
  accessibility:{
   visual:'视觉',motorInput:'操作与输入',cognitive:'认知',
   colorBlindMode:'色觉校正',colorBlindModeDesc:'调整颜色，让有色觉缺陷的人更容易区分',
   colorBlindOptions:{none:'关闭',deuteranopia:'绿色盲（绿）',protanopia:'红色盲（红）',tritanopia:'蓝色盲（蓝）'},
   highContrast:'高对比度',highContrastDesc:'黑色背景、白色边框和文字、更粗的焦点轮廓',
   reducedMotion:'减少动态效果',reducedMotionDesc:'用静态动作姿势代替动作，并取消界面动画',
   screenShake:'屏幕震动',screenShakeDesc:'扣篮和盖帽时镜头短暂震动。开启“减少动态效果”时将被忽略。',
   reduceFlashes:'减少闪烁和脉动',reduceFlashesDesc:'关闭闪烁和脉动效果，以及悬停时的亮度变化',
   fontFamily:'字体样式',fontFamilyDesc:'选择界面使用的字体',fontPreview:'天地玄黄 宇宙洪荒 The quick brown fox',fontOptions:{default:'默认',modern:'现代',readable:'易读'},
   textSize:'文字大小',textSizeDesc:'调小或调大所有界面文字',textSizeSmall:'小',textSizeLarge:'大',
   playbackSpeed:'播放速度',playbackSpeedDesc:'放慢每个回合，让你有更多时间看清动作。结果绝不会改变。',
   playbackSpeedOptions:{'0_5':'50%（轻松）','0_75':'75%（容易）','1':'100%（正常）'},
   timingAssist:'节奏辅助',timingAssistDesc:'在“直播观看”中为回合之间增加停顿，并让消息在屏幕上停留更久',
   simplifiedUI:'简化界面',simplifiedUIDesc:'隐藏装饰性标签、徽章和附加说明，只保留必要内容',
   resetAll:'重置无障碍设置',resetToast:'已恢复默认无障碍设置。',
   statement:'无障碍说明：Kangs 的设计目标是可通过键盘和屏幕阅读器使用。由于 3D 场景是视觉内容，每个回合也都会以文字写出。可用选项包括色觉校正、高对比度、减少动态效果、可调节的文字和字体、更慢的播放速度以及简化界面。我们尽可能遵循 WCAG 2.1 的做法，但本游戏尚未经过正式的无障碍审核。'
  },
  language:{title:'语言',desc:'更改界面语言。球员和球队的名称保持原样。'}
 }
};
