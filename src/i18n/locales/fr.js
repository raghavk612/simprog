// Français. Mêmes clés et {{marqueurs}} que en.js.
export default {
 meta:{title:'KANGS • La route vers le championnat',description:'Une équipe. Une saison. Vos décisions. Entraînez les Lake Washington Kangs dans une simulation 3D de gestion de basket-ball.'},
 lang:{en:'Anglais',es:'Espagnol',zh:'Chinois',fr:'Français',ja:'Japonais',it:'Italien',hi:'Hindi'},
 a11y:{
  skip:'Aller au contenu principal',closeDialog:'Fermer la boîte de dialogue',stage:'Gymnase 3D interactif des Kangs',pageOpened:'Page ouverte : {{page}}',newTab:'s’ouvre dans un nouvel onglet',
  score:'Score : Kangs {{home}}, visiteurs {{away}}.',soundOn:'Effets sonores activés',soundOff:'Effets sonores désactivés',motionOn:'Mouvement activé',motionOff:'Mouvement désactivé',
  camera:'Vue de la caméra : {{view}}',speed:'Vitesse de visionnage {{speed}}',languageChanged:'Langue changée : {{language}}'
 },
 keys:{shortcut:'Raccourci : {{key}}'},
 nav:{home:'QG du programme',roster:'Effectif et rotation',practice:'Plan d’entraînement',recruit:'Détections',staff:'Bureau de l’entraîneur',game:'Jour de match',locker:'Vestiaire',season:'Journal de la saison',data:'Données réelles des Kangs'},
 top:{brand:'La route vers le championnat',soundOn:'Son activé',soundOff:'Son désactivé',motionOn:'Mouvement activé',motionOff:'Mouvement désactivé',settings:'Réglages',export:'Sauvegarder / exporter',help:'Aide',title:'Accueil'},
 side:{sub:'Opérations de basket-ball',badge:'Le projet du championnat',nav:'Navigation du programme',rules:'Règlement et commandes',credits:'Crédits et sources',coach:'Entraîneur {{name}}',difficulty:'difficulté {{level}}',footer:'Une équipe. Une saison. Vos décisions.',footerNote:'Sauvegarde locale automatique · Simulation fictive / effectif public sourcé'},
 stage:{venue:'Salle des Kangs',hint:'Faites glisser pour tourner · faites défiler pour zoomer',place:'Kirkland, Washington',tagline:'Notre maison. Votre programme.',camera:'Vue de la caméra',wide:'Large',court:'Bord de terrain',follow:'Suivre'},
 metrics:{record:'Bilan',tokens:'Jetons du programme',chemistry:'Cohésion',fans:'Supporters'},
 header:{complete:'Saison terminée',game:'Match {{n}} / {{total}}'},
 level:{rookie:'Débutant',standard:'Standard',elite:'Élite'},
 difficulty:{rookie:'Débutant · plus de marge pour apprendre',standard:'Varsity · chaque décision compte',elite:'Élite · des marges minuscules'},
 landing:{
  school:'Lake Washington',program:'Programme de basket-ball',badge:'Une simulation d’entraîneur',tagline:'Une équipe. Une saison.',titleA:'La route vers le',titleB:'Championnat.',
  intro:'Prenez les commandes des Kangs. Faites progresser vos joueurs, prenez les décisions difficiles et écrivez une autre fin pour une saison réelle.',
  name:'Votre nom, coach',namePlaceholder:'Saisissez votre nom',challenge:'Choisissez votre défi',start:'Prendre la tête des Kangs',continue:'Reprendre la saison sauvegardée →',howTo:'Comment jouer',import:'Importer une saison',
  ticketSeason:'2025—26 / Revisitée',ticketA:'La route',ticketB:'commence ici.',ticketBody:'14 joueurs réels · 30 matchs publiés\nVos décisions. Vos résultats.',
  footer:'La route vers le championnat',footerNote:'Projet étudiant indépendant · Non approuvé par l’école'
 },
 home:{
  kicker:'Le programme',welcome:'Bon retour, coach {{name}}.',intro:'Un championnat se construit bien avant l’entre-deux.',doneIntro:'Votre saison a trouvé sa fin. Chaque décision a aidé à l’écrire.',
  quickRosterA:'Composez le cinq',quickRosterB:'Construisez votre rotation',quickPracticeA:'Mettez-vous au travail',quickPracticeB:'Il reste {{n}} créneaux de préparation',quickStaffA:'Les personnes d’abord',quickStaffB:'Prenez des nouvelles de votre équipe',
  sidebar:'Prochain match et dernier résultat',finalChapter:'Dernier chapitre',nextOnSchedule:'Prochain au calendrier',champions:'Champions de l’État.',seasonEnds:'La saison se termine.',
  finalRecord:'{{w}} victoires. {{l}} défaites. Un programme que vous avez construit.',viewStory:'Voir l’histoire de la saison',prepare:'Préparez l’entre-deux →',bracketNote:'Tableau final de l’État · gagner ou rentrer',seasonNote:'Une saison. Un championnat.',
  rippleKicker:'L’effet domino',rippleTitle:'Chaque choix a des conséquences.',rippleDefault:'Les entraînements, les discussions et la récupération changent ce qui se passe sur le terrain. Votre journal de décisions commence ici.'
 },
 roster:{
  kicker:'Les personnes derrière le maillot',intro:'Choisissez cinq titulaires et répartissez 160 minutes-joueur. La santé, l’énergie et l’éligibilité scolaire influencent la disponibilité.',
  spots:'{{n}} / 15 places dans l’effectif',minutes:'{{n}} / 160 minutes',auto:'Créer une rotation éligible',
  notice:'Les noms et les numéros de maillot sont des informations publiques sur l’équipe. Les compétences, la moyenne (GPA), la santé, le moral et tous les résultats de match ci-dessous sont des valeurs fictives de simulation.',
  start:'Titulaire',player:'Joueur',skill:'Compétence',energy:'Énergie',morale:'Moral',gpa:'GPA sim.',status:'État',minutesCol:'Minutes',actions:'Actions',
  startAria:'Titulaire : {{name}}',minutesAria:'Minutes de {{name}}',profile:'Profil',profileAria:'Ouvrir le profil de {{name}}'
 },
 status:{injured:'Blessé',ineligible:'Non éligible',exhausted:'Épuisé',ready:'Prêt'},
 pos:{guard:'Meneur',forward:'Ailier'},
 year:{senior:'Terminale',junior:'Première',sophomore:'Seconde',prospect:'Joueur fictif à l’essai',tryout:'Détection'},
 practice:{
  kicker:'Développez l’athlète complet',intro:'Trois créneaux de préparation avant chaque match. Arbitrez entre la forme immédiate et le développement à long terme.',group:'Groupe d’entraînement',wholeTeam:'Toute l’équipe',
  slots:'{{n}} / 3 créneaux disponibles',cost:'{{cost}} jetons du programme · 1 créneau',effects:'Effets de l’entraînement',fxSkill:'Compétence {{n}}',fxEnergy:'Énergie {{n}}',fxMorale:'Moral {{n}}',fxGpa:'GPA {{n}}',
  schedule:'Programmer la séance →',planKicker:'Planifiez avec intention',planTitle:'Que se passe-t-il ensuite ?',
  planP1:'Des joueurs fatigués réussissent moins de tirs. Une équipe soudée crée de meilleures occasions. La salle d’étude garde votre cinq éligible.',planP2:'Chaque séance est enregistrée dans votre journal de décisions et dans le bilan d’après-match.'
 },
 plan:{
  shooting:{name:'Atelier de tir',desc:'La répétition transforme les tirs ouverts en points. Développe la compétence mais coûte de l’énergie.'},
  defense:{name:'Rotations défensives',desc:'Bougez ensemble. Affûtez les fondamentaux et renforcez la cohésion de l’équipe.'},
  recovery:{name:'Récupération et mobilité',desc:'Aide à se remettre d’une blessure simulée et restaure l’énergie pour le jour du match.'},
  study:{name:'Salle d’étude',desc:'Protégez l’éligibilité. La préparation scolaire fait partie d’un programme sain.'},
  bond:{name:'Dîner d’équipe',desc:'Un repas partagé crée de la confiance, du moral et des liens.'}
 },
 staff:{
  development:{name:'Spécialiste du développement',detail:'+1 de compétence aux entraînements de compétence'},
  recovery:{name:'Entraîneur de récupération sportive',detail:'+8 d’énergie à la récupération ; risque de blessure réduit'},
  culture:{name:'Responsable de la culture d’équipe',detail:'+3 de moral et de cohésion lors des dîners d’équipe'}
 },
 recruit:{
  kicker:'Trouvez le prochain joueur décisif',intro:'Des candidats fictifs rejoignent votre simulation avec l’effectif réel. Le recrutement utilise des jetons du programme, jamais de l’argent réel.',tokens:'{{n}} jetons disponibles',
  tryout:'Détection fictive · {{pos}}',sign:'Recruter · {{cost}} jetons',signAria:'Recruter {{name}} pour {{cost}} jetons',none:'Tous les candidats des détections ont été recrutés.'
 },
 office:{
  kicker:'Dirigez le programme',intro:'Votre staff et vos discussions façonnent l’équipe au-delà du tableau d’affichage.',weekly:'Point hebdomadaire avec l’équipe',title:'Prenez du temps pour vos joueurs.',
  body:'Le banc veut être écouté. L’équipe a besoin de moyens. Les devoirs s’accumulent. Choisissez à quoi consacrer un créneau de préparation.',
  listen:'Écouter le banc',listenFx:'+7 de moral · +5 de cohésion',fundraise:'Organiser un stage communautaire',fundraiseFx:'+180 jetons · +40 supporters · −5 d’énergie',academics:'Point sur les études',academicsFx:'+0,18 de GPA simulé',
  assistantKicker:'Un poste d’adjoint',buildStaff:'Constituez votre staff.',assistantBody:'Les postes d’adjoint sont des choix de jeu fictifs. Leurs bonus s’appliquent à vos séances de préparation.',
  hired:'Embauché',cost:'{{cost}} jetons',hireAria:'Embaucher {{name}} pour {{cost}} jetons',dismiss:'Renvoyer l’adjoint'
 },
 game:{
  speed:'Vitesse de visionnage',kangs:'Kangs',visitors:'Visiteurs',liveKicker:'En direct de la salle',prepKicker:'Préparez. Adaptez-vous. Exécutez.',liveTitle:'Jour de match. À vous de jouer.',vs:'Kangs contre {{opp}}',
  alternateBracket:'Tableau final alternatif de l’État',published:'Match publié / résultat simulé',overtime:'Prolongation',quarter:'QT{{n}}',possessions:'{{n}} possessions',
  choosePlay:'Choisissez une action et regardez la possession se dérouler.',playByPlay:'Commentaire action par action',crowdReady:'Le public est prêt. Lancez la première possession.',
  scouting:'Rapport de scouting',reference:'Résultat de référence : Lake Washington {{a}}–{{b}}. Votre résultat n’est pas encore écrit.',strength:'Force de l’adversaire dans le jeu',style:'Style',unscouted:'Non analysé',
  advice:{perimeter:'Sortez sur les tireurs. La zone est la réponse défensive recommandée.',paint:'Protégez la raquette. La pression peut perturber leurs passes vers l’intérieur.',transition:'Contrôlez le rythme. Une défense équilibrée garde votre équipe organisée.'},
  adviceNote:'Ce profil d’analyse fait partie de la simulation.',scout:'Regarder la vidéo de l’adversaire · 50 jetons / 1 créneau',boxScore:'Feuille de match',controls:'Commandes du match',sideline:'Le banc',startingFive:'Votre cinq de départ',
  callPlay:'Appelez l’action',system:'Système',tempo:'Tempo',resumeFinal:'Reprendre la dernière action',pauseFinal:'Mettre en pause la dernière action',pause:'Mettre le match en pause',resume:'Reprendre le match',watch:'▶ Regarder en direct',next:'Action suivante →',
  timeout:'Temps mort · {{n}} restants',ready:'Prêt pour l’entre-deux ?',minShort:'{{n}} min',assigned:'{{n}} / 160 minutes attribuées',adjust:'Ajuster la rotation',tipOff:'Entre-deux →',
  look:'{{player}} · {{phase}} · {{contest}}'
 },
 tactic:{balanced:'Équilibré',zone:'Zone / sorties sur les tireurs',pressure:'Défense de pression',perimeter:'Écarter le jeu / tirs à trois points'},
 pace:{steady:'Régulier',fast:'Contre-attaque'},
 style:{perimeter:'Périmètre',paint:'Raquette',transition:'Transition'},
 shot:{catch:'Tir à trois points sur réception',pullup:'Tir en suspension après dribble',stepback:'Tir à trois points en pas de retrait',drive:'Lay-up après changement de main',floater:'Flotteur en course',hook:'Crochet au poste',dunk:'Dunk en contre-attaque',roll:'Finition après écran et passe'},
 phase:{pass:'Passe et démarquage',attack:'Attaque et dribble',gather:'Préparation et défense',blocked:'Tir contré',turnover:'Perte de balle',flight:'Tir en l’air',basket:'Panier',rebound:'Rebond'},
 contest:{open:'tir ouvert',tight:'tir très défendu',contested:'tir défendu'},
 outcome:{made:'réussi',miss:'raté',block:'contre',steal:'interception'},
 impact:{skill:'Compétence',energy:'Énergie',morale:'Moral',chemistry:'Cohésion',shotType:'Type de tir',space:'Espace',tactics:'Tactique'},
 stats:{assists:'passes décisives',blocks:'contres',steals:'interceptions',rebounds:'rebonds'},
 replay:{kicker:'La salle vidéo',title:'Regardez l’action se développer.',intro:'Actions et résultats enregistrés. Revoir une action ne change jamais votre saison.',recorded:'Action enregistrée',again:'Revoir l’action',pause:'Mettre la rediffusion en pause',resume:'Reprendre la rediffusion',back:'Retour au journal de la saison'},
 locker:{
  kicker:'Affichez votre identité',intro:'Choisissez la tenue que portent vos joueurs dans le gymnase 3D. Renommez les joueurs depuis leur profil dans l’effectif.',issue:'Tenue de l’équipe Kangs',title:'Faites-la vôtre.',kits:'Tenues',
  home:'Violet domicile',away:'Blanc extérieur',alternate:'Alternative minuit',trim:'Couleur du numéro du maillot',note:'Maillots originaux inspirés de l’identité violette et blanche de l’école. Aucun logo officiel ni portrait d’athlète n’est utilisé.'
 },
 journal:{
  kicker:'L’histoire de votre saison',intro:'Votre bilan simulé, vos décisions, le classement et les moments marquants.',path:'Étapes de la saison',regular:'Saison régulière',district:'Phase de district',state:'Championnat de l’État',
  bannerYours:'La bannière est à vous',teaches:'Chaque saison vous apprend quelque chose',whistle:'Le coup de sifflet final.',
  summary:'Le coach {{coach}} a terminé {{w}}–{{l}}, a fait grandir sa base de supporters jusqu’à {{fans}} et a bâti une équipe avec une cohésion de {{chem}}.',newSeason:'Commencer une nouvelle saison',export:'Exporter cette saison',
  results:'Vos résultats',scoreboard:'Le tableau d’affichage ne dit qu’une partie.',replay:'Revoir ↗',noGames:'Jouez votre premier match pour commencer votre histoire.',standings:'Classement du programme',table:'Le tableau de la campagne',
  tableNote:'Classement fictif de la campagne : les autres adversaires jouent des matchs simulés en arrière-plan à chaque tour. Ce ne sont pas les classements officiels de KingCo.',trail:'Journal de décisions',gameN:'Match {{n}}',trailEmpty:'Vos décisions apparaîtront ici.'
 },
 ending:{
  kicker:'Le coup de sifflet final',won:'Vous l’avez ramené à la maison.',over:'Votre saison est terminée.',bannerTitle:'Une bannière méritée. Un programme construit.',lossTitle:'Une autre fin commence par une autre décision.',
  record:'Bilan final : {{w}}–{{l}}.',championBody:'Les Kangs sont champions dans votre saison alternative.',lossBody:'Le parcours de l’État est terminé. Relisez votre journal de décisions et préparez votre prochaine stratégie.',story:'Voir l’histoire de votre saison'
 },
 data:{
  kicker:'Programme réel. Sources transparentes.',title:'Les vrais Kangs',intro:'Données publiées de l’équipe masculine varsity 2025–26, séparées de votre simulation.',badge:'Instantané public daté',school:'Lake Washington · Kirkland, WA',
  checked:'Dernière vérification réussie de la source : {{date}}. Le programme de mise à jour vérifie chaque jour ; cette saison historique n’est pas un flux de scores en direct.',
  record:'Bilan de l’équipe : {{w}}–{{l}}. Moyenne de points de l’équipe : {{avg}} sur {{n}} matchs publiés.',refresh:'Rechercher un instantané à jour',
  notice:'Les moyennes individuelles ci-dessous ne comptent que les matchs pour lesquels la source indique les points. Les matchs manquants ne sont pas comptés comme zéro. Ce ne sont pas des moyennes de saison complète. Actualiser les sources ne modifie jamais votre simulation sauvegardée en cours de saison.',
  rosterTable:'Effectif réel',realRoster:'Effectif réel',position:'Poste',height:'Taille',year:'Année',reportedGames:'Matchs renseignés',ppg:'Points par match (matchs renseignés)',notReported:'Non renseigné',
  scheduleTitle:'Calendrier publié et résultats réels',date:'Date',opponent:'Adversaire',score:'Score réel de LW',venue:'Lieu',source:'Source : {{link}}',sourceLink:'Effectif, calendrier et statistiques des joueurs publiés par FinalScoreTV'
 },
 tutorial:{
  label:'Visite guidée pour entraîneur débutant',kicker:'Entraîneur débutant · {{n}}/4',next:'Suivant →',finish:'À l’entraînement !',skip:'Passer la visite',
  step1:{title:'Bienvenue dans votre programme.',body:'Commencez par choisir vos cinq titulaires et attribuer 160 minutes.'},
  step2:{title:'Façonnez l’athlète complet.',body:'Utilisez les trois créneaux de préparation pour la compétence, la récupération, les études ou la cohésion.'},
  step3:{title:'Vos décisions vous suivent.',body:'Embauchez un adjoint et parlez avec votre équipe. Le moral et la cohésion changent les performances.'},
  step4:{title:'Faites le jeu vôtre.',body:'Analysez l’adversaire, lancez le match et changez de tactique en direct. Remportez le tableau de l’État en cette unique saison.'}
 },
 timeout:{kicker:'Temps mort',title:'Rassemblement.',body:'Trois temps morts par match. Les deux approches améliorent les huit prochaines possessions.',calm:'Calmer l’équipe · +4 d’énergie',belief:'Montrer sa confiance · +3 de moral',feedPrefix:'Temps mort',feed:{calm:'Respirez. Posez-vous. Exécutez. Énergie +4.',belief:'Faites-vous confiance. Moral +3.'}},
 credits:{
  kicker:'Créé par amour du jeu',creators:'Créateurs',assets:'Ressources, logiciels et recherche',
  kenney:'{{link}} — CC0. Un banc, une chaise, une table, une armoire et une plante importés en GLB. Le pack inclut aussi des fichiers FBX compatibles avec Unity. Modèles chargés dans cette scène : {{loaded}}/5.',
  three:'{{link}} — MIT. Rendu WebGL, OrbitControls et GLTFLoader.',
  fonts:'{{barlow}} (Jeremy Tribby) et {{dm}} (Colophon Foundry) — SIL Open Font License, intégrées localement.',
  vite:'{{link}} — MIT. Outils de compilation.',
  finalscore:'{{link}} — effectif, calendrier, résultats et statistiques de points des joueurs publics de 2025–26. Les liens vers chaque joueur figurent dans Données réelles des Kangs.',
  kangs:'{{link}} — identité et contexte du programme de l’école.',
  nfhs:'{{link}} — référence d’introduction au règlement ; l’arbitrage détaillé est simplifié dans le jeu.',
  fbla:'{{event}} et les consignes et la grille de {{guidelines}} — thème « La route vers le championnat ».',
  ecoquest:'L’approche des réglages, du son synthétisé et du changement de langue est adaptée de {{link}}.',
  generated:'Le terrain, le ballon, les personnages stylisés, les maillots, l’interface et les sons synthétisés sont générés par du code. Les personnages ne sont pas des portraits d’élèves réels. Développé avec l’aide d’un assistant de programmation IA (OpenAI Codex). Sans l’aval officiel de l’école.',
  render:'Three.js affiche le jeu 3D ; des surcouches HTML accessibles gèrent les formulaires et les commandes de l’entraîneur. Les préfabriqués Unity ne s’exécutent pas dans le navigateur : les modèles sous licence inter-moteurs sont importés en GLB.'
 },
 rules:{
  kicker:'Le manuel de l’entraîneur',title:'Une saison. Un objectif.',
  steps:[
   'Saisissez votre nom d’entraîneur et choisissez une difficulté. Votre saison est sauvegardée dans ce navigateur après chaque décision.',
   'Choisissez exactement cinq titulaires. Répartissez 160 minutes au total, sans dépasser 32 pour un joueur. Un joueur doit avoir une énergie ≥15, aucune blessure simulée active et un GPA simulé ≥2,0.',
   'Utilisez jusqu’à trois créneaux de préparation avant chaque match. Les entraînements, la récupération, les études, la cohésion, le scouting et les discussions coûtent un créneau ; les recrutements et votre unique adjoint coûtent des jetons.',
   'Jouez 20 matchs de saison régulière, puis six matchs de la phase de district. Au moins 12 victoires au total après le match 26 vous qualifient pour le parcours de l’État en quatre matchs. Chaque match de l’État est éliminatoire. Ce tableau alternatif simplifié suit la séquence d’adversaires publiée, avec une finale alternative ; ce n’est pas le véritable tableau de la WIAA.',
   'Appelez chaque possession ou regardez en direct. Changez de système, gérez la fatigue et demandez jusqu’à trois temps morts. Les égalités vont en prolongation. Chaque match rapporte 160 jetons, plus 70 en cas de victoire.',
   'L’entraînement coûte de l’énergie ; les matchs réduisent l’énergie et la préparation scolaire. Une énergie faible diminue la qualité des tirs et augmente le risque de blessure simulée. La récupération restaure l’énergie et raccourcit les blessures. Les remplaçants qui ne jouent pas peuvent perdre en moral.',
   'L’effectif est limité à 15. Les joueurs à l’essai et les postes d’adjoint sont fictifs. Libérer un joueur ne donne aucun remboursement. Vous ne pouvez ni modifier la rotation ni vous entraîner pendant un match.'
  ],
  conduct:'Basket-ball et comportement',
  conductP1:'Deux points pour un panier normal, trois pour un tir lointain. Ce modèle d’entraîneur anime les pénétrations, les tirs, les passes, les interceptions, les contres et les rebonds défensifs, mais simplifie les fautes individuelles, les lancers francs et les remplacements ; ce n’est pas un simulateur complet d’arbitrage. Le match de 32 minutes et le budget de 160 minutes-joueur encadrent votre rotation.',
  conductP2:'Respectez vos coéquipiers, vos adversaires et les arbitres. L’inéligibilité scolaire empêche de participer à ce jeu. Le seuil de 2,0 est une règle du jeu, pas une déclaration de la politique réelle de l’école. Les jetons de recrutement sont une ressource abstraite du programme, pas des paiements à de vrais athlètes. Les blessures et la récupération sont des mécanismes fictifs.',
  guideTitle:'Guide des règles sur le terrain',
  guide:[
   'Gardez un dribble et un pivot réguliers. Marcher ou reprendre un dribble terminé peut donner la balle à l’adversaire.',
   'Gardez le ballon dans les limites. Toucher une ligne ou le sol en dehors met le joueur hors limites ; le dernier joueur à avoir touché le ballon détermine la remise en jeu.',
   'Défendez sans contact illégal. Les fautes personnelles peuvent donner une remise en jeu ou des lancers francs selon l’action et le nombre de fautes d’équipe.',
   'N’interférez pas avec le panier ni avec un tir protégé. L’interférence et le goaltending ont des conséquences sur le score ; les comportements antisportifs peuvent aussi entraîner des fautes techniques.',
   'Respectez les arbitres et les adversaires. Un comportement technique ou flagrant peut entraîner des lancers francs, des sanctions de possession ou une exclusion, selon la décision.'
  ],
  guideNote:'Ceci est un guide d’introduction. Consultez {{link}} et les règles de votre État pour tous les détails de l’arbitrage. Ce jeu simplifie ces fautes sur le terrain ; leurs conséquences directes sur la gestion sont indiquées ci-dessus.',
  controls:'Commandes et accessibilité',
  controlsP1:'Souris/écran tactile : faites glisser pour tourner autour du gymnase, faites défiler pour zoomer. Utilisez les boutons de caméra pour les vues prédéfinies. Toutes les commandes de l’entraîneur fonctionnent au clavier. Le son est désactivé au départ. Avec le mouvement désactivé, des poses d’action statiques remplacent les déplacements. La vitesse de visionnage (1×/2×/4×) ne change que la présentation ; elle ne modifie jamais les résultats. Utilisez Sauvegarder / exporter pour obtenir une sauvegarde JSON portable, et Importer une saison depuis l’écran d’accueil pour la restaurer.',
  shortcuts:'Raccourcis clavier',
  controlsP2:'Ouvrez les Réglages pour réaffecter ces touches, régler le son, la taille du texte, les couleurs, le mouvement et la vitesse de lecture, ou changer de langue. Les réglages sont enregistrés dans ce navigateur.',
  dataNote:'Les données réelles sont un instantané daté vérifié par la tâche de publication quotidienne. Vos propres statistiques de jeu sont mises à jour à chaque possession. Les statistiques réelles manquantes restent indisponibles au lieu d’être inventées.'
 },
 profile:{
  kicker:'Profil du joueur · n° {{n}}',ppg:'PPM sim.',risk:'Risque de blessure',elevated:'Élevé',low:'Faible',injured:'Blessure simulée : {{n}} étapes de récupération restantes.',
  healthy:'L’état de santé indiqué est fictif ; aucune information privée sur un athlète n’est utilisée.',rename:'Nom d’affichage du joueur',save:'Enregistrer le nom',
  original:'Nom d’origine dans la source : {{name}}. Renommer ne modifie que votre simulation.',release:'Libérer de l’effectif'
 },
 result:{
  kicker:'La salle vidéo · {{outcome}}',win:'Victoire',loss:'Défaite',before:'Ce que vous avez fait avant l’entre-deux',noPrep:'Aucune séance de préparation n’a été enregistrée pour ce match.',defining:'Possessions décisives',
  shotQuality:'Qualité du tir : {{n}} %.',why:'Pourquoi c’est arrivé · analyse des décisions',
  whyBody:'Dernière possession : variations de la probabilité de base du tir, en points de pourcentage. Ce sont des contributions du modèle, pas des affirmations sur ce qui se serait passé dans la vraie vie.',
  scoring:'Points marqués (simulation)',former:'Ancien joueur de l’effectif',pts:'{{n}} PTS'
 },
 notify:{
  storage:'Le stockage du navigateur est indisponible. Exportez votre saison pour conserver votre progression.',checked:'Instantané vérifié : {{date}}.',snapshotFailed:'Instantané de la source indisponible. Les dernières données vérifiées sont conservées.',
  finishFirst:'Terminez d’abord le match.',minutes:'Saisissez des minutes entières entre 0 et 32.',exported:'Saison exportée.',tooLarge:'Fichier de sauvegarde trop volumineux',badSave:'Ce n’est pas un fichier de saison Kangs compatible.',saved:'Enregistré.'
 },
 confirm:{replace:'Remplacer la saison sauvegardée dans ce navigateur ? Exportez-la d’abord si vous voulez la conserver.',import:'Remplacer la saison locale actuelle par cette sauvegarde ?',release:'Libérer ce joueur de votre effectif de simulation ?'},
 // Play-by-play commentary templates: one sentence per template, filled from the play.
 cm:{join:' ',side:{right:'droite',left:'gauche'},lead:{catch:['{{helper}} la passe à {{name}} sur l’aile {{side}}.','{{name}} se démarque sans le ballon ; {{helper}} trouve la fenêtre.'],pullup:['{{name}} s’arrête net au coude de la raquette.','{{name}} feinte d’un dribble et s’élève à mi-distance.'],stepback:['{{name}} change de main, puis recule d’un pas derrière l’arc.','{{name}} vend la pénétration et se crée de l’espace avec un pas de retrait.'],drive:['{{name}} change de main et dépasse {{def}}.','{{name}} attaque l’intervalle avec un crossover.'],floater:['{{name}} se faufile dans la raquette et lance un flotteur.','{{name}} évite l’aide défensive avec un tir en cloche.'],hook:['{{name}} s’appuie dos au panier au poste et pivote par-dessus l’épaule.','{{name}} scelle le défenseur sur le poste bas.'],dunk:['{{name}} file devant la défense qui se replie.','{{helper}} lance la relance vers {{name}} en transition.'],roll:['{{helper}} pose l’écran ; {{name}} tourne le coin.','{{name}} utilise l’écran de {{helper}} et coupe fort vers le cercle.']},steal:['{{def}} anticipe le geste et arrache le ballon à {{name}}. Balle perdue.','{{def}} fait sauter le ballon des mains de {{name}} et prend la possession.'],block:['{{def}} rencontre le tir au moment du lâcher… contré !','{{def}} tourne en couverture et le repousse.'],loose:'{{rebounder}} ramasse le ballon libre.',finish:{three:['Trois points… rien que du filet.','Le tir à trois points rentre.','Il l’enfonce de loin.'],dunk:['Les deux mains au-dessus du cercle… dunk !','Il termine par un dunk.'],two:['Toucher de balle délicat, deux points.','Ça passe dans le filet.','Il arrive à le faire rentrer.'],miss:['Sur le cercle.','Le tir ne veut pas rentrer.','Le ballon tourne et ressort.']},assist:'Passe décisive : {{helper}}.',rebound:'{{rebounder}} prend le rebond.'},
 // Decision-trail and result lines written by the simulation.
 log:{wholeTeam:'toute l’équipe',train:'{{plan}} : {{who}} · compétence {{skill}}, énergie {{energy}}, GPA {{gpa}}',recruit:'{{name}} a rejoint l’équipe via les détections pour {{cost}} jetons.',release:'{{name}} a été libéré de l’effectif actif.',hire:'{{staff}} embauché.',dismiss:'Adjoint renvoyé. Aucun remboursement.',talkListen:'Vous avez écouté le banc : moral +7, cohésion +5.',talkFundraise:'Stage communautaire : +180 jetons, +40 supporters, −5 d’énergie.',talkAcademics:'Point sur les études : GPA simulé de chacun +0,18.',scout:'L’étude vidéo a révélé le style préféré de l’adversaire. Vos lectures tactiques se sont améliorées.',tipoff:'Entre-deux contre {{opp}}.',injury:'{{name}} : entorse de cheville simulée. Récupération ou repos nécessaires.',win:'victoire',loss:'défaite',result:'{{outcome}} {{home}}–{{away}} contre {{opp}}. {{reason}}',reason:'Cohésion d’équipe {{chem}} ; énergie moyenne {{energy}}.',reasonWithScouting:'Le scouting a préparé vos lectures défensives. Cohésion d’équipe {{chem}} ; énergie moyenne {{energy}}.',runEnds:'Le parcours vers le championnat s’arrête cette saison. Réexaminez vos décisions et réessayez.',champions:'CHAMPIONS DE L’ÉTAT. Une saison. Votre programme.',seasonComplete:'Saison terminée.'},
 error:{title:'Le programme n’a pas pu se charger.',body:'Rechargez la page quand votre connexion sera revenue.',reload:'Recharger'},
 errors:{
  'This season is complete. Start a new season to play again.':'Cette saison est terminée. Commencez une nouvelle saison pour rejouer.',
  'Finish the current game first.':'Terminez d’abord le match en cours.',
  'Not enough program tokens.':'Pas assez de jetons du programme.',
  'Your three preparation slots are used. Play the next game.':'Vos trois créneaux de préparation sont utilisés. Jouez le prochain match.',
  'Unknown practice':'Entraînement inconnu',
  'Choose a player':'Choisissez un joueur',
  'Prospect unavailable':'Candidat indisponible',
  'Roster full: release a player before signing.':'Effectif complet : libérez un joueur avant de recruter.',
  'Keep at least five players.':'Gardez au moins cinq joueurs.',
  'Player unavailable':'Joueur indisponible',
  'One assistant allowed. Dismiss your assistant first.':'Un seul adjoint est autorisé. Renvoyez d’abord votre adjoint.',
  'Coach unavailable':'Entraîneur indisponible',
  'This week’s team conversation is complete.':'La discussion d’équipe de cette semaine a déjà eu lieu.',
  'Opponent already scouted.':'L’adversaire a déjà été analysé.',
  'Select exactly five starters.':'Choisissez exactement cinq titulaires.',
  'Each starter needs playing time.':'Chaque titulaire a besoin de temps de jeu.',
  'An assigned player is injured, exhausted, or below the game’s 2.0 GPA threshold.':'Un joueur assigné est blessé, épuisé ou en dessous du seuil de GPA de 2,0 du jeu.',
  'Minutes must be whole numbers from 0 to 32.':'Les minutes doivent être des nombres entiers de 0 à 32.',
  'Allocate exactly 160 player-minutes (five players × 32 minutes).':'Répartissez exactement 160 minutes-joueur (cinq joueurs × 32 minutes).',
  'No timeouts remaining.':'Il ne reste aucun temps mort.',
  'No game in progress':'Aucun match en cours'
 },
 settings:{
  title:'Réglages',eyebrow:'Préférences',done:'Terminé',activeCount:'{{n}} options d’accessibilité modifiées par rapport aux valeurs par défaut',
  tabs:{controls:'Commandes',sound:'Son',accessibility:'Accessibilité',language:'Langue'},
  controls:{
   intro:'Choisissez un bouton, puis appuyez sur la touche à utiliser. Les raccourcis fonctionnent sur les écrans du jeu quand aucune boîte de dialogue n’est ouverte. Échap annule.',
   actions:{playPause:'Regarder en direct / pause',nextPlay:'Action suivante',timeout:'Temps mort',camWide:'Caméra : large',camCourt:'Caméra : bord de terrain',camFollow:'Caméra : suivre',speed:'Changer la vitesse de visionnage',sound:'Activer ou désactiver le son',settings:'Ouvrir les réglages'},
   pressKey:'Appuyez sur une touche…',rebind:'Changer la touche de « {{action}} », actuellement {{key}}',keyUsed:'{{key}} est déjà utilisée pour « {{action}} ».',reserved:'{{key}} est réservée et ne peut pas être attribuée.',
   bound:'« {{action}} » est maintenant {{key}}',resetDefaults:'Réinitialiser les touches',resetToast:'Les touches par défaut ont été rétablies.'
  },
  sound:{
   title:'Effets sonores',masterVolume:'Volume général',masterVolumeDesc:'Règle le volume de tous les effets sonores',quiet:'Faible',loud:'Fort',sfxEnabled:'Effets sonores',sfxEnabledDesc:'Active ou désactive tous les sons du jeu et de l’interface. Ils sont désactivés au départ.',
   testSound:'Tester le son',testSoundDesc:'Joue un échantillon même si les effets sonores sont désactivés',play:'Écouter',individual:'Sons individuels',individualDesc:'Choisissez les sons que vous voulez entendre.',
   resetAll:'Réinitialiser les réglages du son',resetToast:'Les réglages du son par défaut ont été rétablis.',
   items:{
    swish:{name:'Panier réussi',desc:'Un « swish » quand un tir à deux points rentre'},
    three:{name:'Trois points',desc:'Un « swish » avec une note brillante pour les tirs à trois points'},
    rim:{name:'Tir manqué',desc:'Un choc sur le cercle'},
    block:{name:'Contre',desc:'Un choc sourd quand un tir est contré'},
    steal:{name:'Interception',desc:'Un balayage rapide quand le ballon est volé'},
    whistle:{name:'Sifflet',desc:'Le sifflet de l’arbitre à l’entre-deux et au début d’une saison'},
    timeout:{name:'Temps mort',desc:'Des notes de cloche pendant le temps mort'},
    confirm:{name:'Décision confirmée',desc:'Entraînements, discussions, scouting et sauvegarde'},
    select:{name:'Sélection',desc:'Un léger tic quand vous changez un choix'},
    error:{name:'Non autorisé',desc:'Un bourdonnement grave quand une action est refusée'},
    signing:{name:'Recrutement',desc:'Des étincelles quand un joueur ou un adjoint rejoint l’équipe'},
    victory:{name:'Victoire',desc:'Une fanfare après une victoire'},
    defeat:{name:'Défaite',desc:'Une phrase douce et descendante après une défaite'},
    uiClick:{name:'Clics de l’interface',desc:'Des clics quand vous utilisez les boutons et les menus'}
   }
  },
  accessibility:{
   visual:'Visuel',motorInput:'Motricité et saisie',cognitive:'Cognitif',
   colorBlindMode:'Correction de la vision des couleurs',colorBlindModeDesc:'Modifie les couleurs pour mieux les distinguer en cas de déficience de la vision des couleurs',
   colorBlindOptions:{none:'Désactivée',deuteranopia:'Deutéranopie (vert)',protanopia:'Protanopie (rouge)',tritanopia:'Tritanopie (bleu)'},
   highContrast:'Contraste élevé',highContrastDesc:'Fond noir, bordures et texte blancs, contours de focus plus épais',
   reducedMotion:'Mouvement réduit',reducedMotionDesc:'Poses d’action statiques au lieu de mouvements, et aucune animation de l’interface',
   screenShake:'Secousse d’écran',screenShakeDesc:'Une brève secousse de la caméra lors des dunks et des contres. Ignorée quand le mouvement réduit est activé.',
   reduceFlashes:'Réduire les flashs et les pulsations',reduceFlashesDesc:'Désactive les effets clignotants et pulsants et les changements de luminosité au survol',
   fontFamily:'Style de police',fontFamilyDesc:'Choisissez une police pour l’interface',fontPreview:'Portez ce vieux whisky au juge blond qui fume',fontOptions:{default:'Par défaut',modern:'Moderne',readable:'Lisible'},
   textSize:'Taille du texte',textSizeDesc:'Réduit ou agrandit tout le texte de l’interface',textSizeSmall:'Petit',textSizeLarge:'Grand',
   playbackSpeed:'Vitesse de lecture',playbackSpeedDesc:'Ralentit chaque action pour avoir plus de temps de la suivre. Les résultats ne changent jamais.',
   playbackSpeedOptions:{'0_5':'50 % (détendue)','0_75':'75 % (facile)','1':'100 % (normale)'},
   timingAssist:'Aide au rythme',timingAssistDesc:'Ajoute une pause entre les actions dans « Regarder en direct » et garde les messages plus longtemps à l’écran',
   simplifiedUI:'Interface simplifiée',simplifiedUIDesc:'Masque les libellés décoratifs, les badges et les notes supplémentaires pour ne garder que l’essentiel',
   resetAll:'Réinitialiser les réglages d’accessibilité',resetToast:'Les réglages d’accessibilité par défaut ont été rétablis.',
   statement:'Accessibilité : Kangs est conçu pour fonctionner au clavier et avec un lecteur d’écran. Chaque action est aussi écrite en texte, car la scène 3D est visuelle. Les options comprennent la correction de la vision des couleurs, le contraste élevé, le mouvement réduit, un texte et une police réglables, une lecture plus lente et une interface simplifiée. Nous suivons les pratiques WCAG 2.1 autant que possible, mais le jeu n’a pas fait l’objet d’un audit d’accessibilité formel.'
  },
  language:{title:'Langue',desc:'Change la langue de l’interface. Les noms des joueurs et des équipes restent tels que publiés.'}
 }
};
