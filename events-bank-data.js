/** Default odds are decimal multipliers (higher = rarer / bigger payout). */

window.BET_CATEGORIES = [
  { id: "catchphrases", label: "Catchphrases & klich\u00E9er" },
  { id: "dates",        label: "Dates & aktiviteter" },
  { id: "romance",      label: "Romantik & fysisk" },
  { id: "drama",        label: "Drama & konflikt" },
  { id: "emotions",     label: "F\u00F8lelser & personligt" },
  { id: "ceremonies",   label: "Ceremonier & roser" },
  { id: "twists",       label: "G\u00E6ster & twists" },
  { id: "production",   label: "Produktion & redigering" },
];

window.MASTER_BET_EVENTS = [
  /* ── Catchphrases & clichés ── */
  { text: "Nogen siger \u201Crejse\u201D om processen", odds: 1.5, category: "catchphrases" },
  { text: "Nogen n\u00E6vner at v\u00E6re \u201Cs\u00E5rbar\u201D", odds: 1.5, category: "catchphrases", phase: "late-heavy" },
  { text: "Nogen siger \u201Cforbindelse\u201D (uironisk)", odds: 1.5, category: "catchphrases" },
  { text: "Nogen siger \u201Cjeg er virkelig mig selv herinde\u201D", odds: 1.7, category: "catchphrases" },
  { text: "Nogen siger de er \u201Call in\u201D", odds: 2, category: "catchphrases", phase: "late-heavy" },
  { text: "Bacheloretten siger hun er \u201Cforvirret\u201D", odds: 2.1, category: "catchphrases", phase: "mid-peak" },
  { text: "Bacheloretten siger \u201Cjeg er overv\u00E6ldet\u201D", odds: 2, category: "catchphrases" },
  { text: "Overdreven brug af \u201Cbogstaveligt talt\u201D", odds: 2.1, category: "catchphrases" },
  { text: "Nogen siger de er ved at \u201Cfalde\u201D for nogen", odds: 2.2, category: "catchphrases", phase: "late-heavy" },
  { text: "Bacheloretten siger hun har brug for \u201Cklarhed\u201D f\u00F8r roseceremonien", odds: 2.1, category: "catchphrases", phase: "mid-peak" },
  { text: "Mie eller Sofie n\u00E6vner High School Musical, pink, eller Stig Rossen", odds: 3.5, category: "catchphrases" },

  /* ── Dates & activities ── */
  { text: "Gruppedate med fysisk udfordring", odds: 1.9, category: "dates", phase: "early-heavy" },
  { text: "Date der involverer vand (b\u00E5d, strand, pool)", odds: 2, category: "dates" },
  { text: "Madlavning / k\u00F8kkendate", odds: 2, category: "dates" },
  { text: "Der bliver danset p\u00E5 en date", odds: 2.1, category: "dates" },
  { text: "Picnic med t\u00E6ppe og kurv-\u00E6stetik", odds: 2, category: "dates" },
  { text: "Italiensk sprog eller kultur bliver eksplicit tematiseret p\u00E5 en date", odds: 2.2, category: "dates" },
  { text: "Bytur-montage (scooter, cabriolet)", odds: 2.4, category: "dates" },
  { text: "Malings-, keramik- eller kunsttime som date", odds: 2.5, category: "dates" },
  { text: "Spa, massage eller wellness-aktivitet", odds: 2.6, category: "dates", phase: "late-heavy" },
  { text: "Karaoke eller playback-battle", odds: 2.8, category: "dates", phase: "early-heavy" },

  /* ── Romance & physical ── */
  { text: "Stearinlys / lysk\u00E6der / romantisk ops\u00E6tning-kliche", odds: 1.8, category: "romance" },
  { text: "Der bliver kysset", odds: 2, category: "romance", phase: "late-heavy" },
  { text: "Solnedgangs-shot brugt som overgang", odds: 2.2, category: "romance" },
  { text: "B\u00F8rn / hvor mange / familieplaner diskuteres", odds: 2.4, category: "romance", phase: "late-heavy" },
  { text: "Mere end \u00E9n kysse-scene i ugen", odds: 2.6, category: "romance", phase: "late-heavy" },
  { text: "Boblebad, pool eller \u201Cbar overkrop\u201D-klip", odds: 2.7, category: "romance" },
  { text: "F\u00F8rste kys i s\u00E6sonen (tydeligt fremh\u00E6vet)", odds: 3.2, category: "romance", phase: "early-heavy" },
  { text: "En bejler siger \u201Cjeg elsker dig\u201D eller \u201Cjeg er ved at blive forelsket\u201D", odds: 7, category: "romance", phase: "late-heavy" },

  /* ── Drama & conflict ── */
  { text: "Stj\u00E6ler tid til cocktailparty (\u201Cm\u00E5 jeg stj\u00E6le dig?\u201D)", odds: 1.7, category: "drama", phase: "early-heavy" },
  { text: "En bejler afbryder en anden midt i en samtale med Mie eller Sofie", odds: 2, category: "drama", phase: "early-heavy" },
  { text: "To bejlere sk\u00E6ndes \u00E5bent", odds: 2.5, category: "drama", phase: "mid-peak" },
  { text: "En bejler forlader programmet frivilligt", odds: 12, category: "drama" },

  /* ── Emotions & personal ── */
  { text: "Mindst \u00E9n bejler gr\u00E6der p\u00E5 kamera", odds: 1.3, category: "emotions", phase: "late-heavy" },
  { text: "Mindst \u00E9n bejler siger \u201Cjeg er s\u00E5 nerv\u00F8s\u201D", odds: 1.4, category: "emotions", phase: "early-heavy" },
  { text: "En bejler n\u00E6vner sin familie derhjemme", odds: 1.5, category: "emotions" },
  { text: "Nogen gr\u00E6der under en samtale (ikke ITM)", odds: 2.2, category: "emotions", phase: "late-heavy" },
  { text: "Mie n\u00E6vner sit job som sygeplejerske", odds: 2, category: "emotions" },
  { text: "En eksk\u00E6reste n\u00E6vnes", odds: 2.4, category: "emotions" },
  { text: "Tidligere forholds-trauma fort\u00E6lles", odds: 2.1, category: "emotions", phase: "mid-peak" },
  { text: "Nogen bliver set tr\u00E6ne / fitness-optagelser", odds: 2.3, category: "emotions" },
  { text: "En bejler n\u00E6vner et tidligere forhold der s\u00E5rede ham", odds: 2.5, category: "emotions", phase: "mid-peak" },
  { text: "Sofie n\u00E6vner sin hund Lulu", odds: 2.5, category: "emotions" },
  { text: "K\u00E6rlighedssprog diskuteres", odds: 3.1, category: "emotions", phase: "mid-peak" },
  { text: "For\u00E6lder-videobesked eller FaceTime", odds: 3.7, category: "emotions", phase: "late-heavy" },
  { text: "Zodiac / astrologi / Merkur retrograd kommer op", odds: 4.2, category: "emotions" },
  { text: "En bejler har v\u00E6ret gift eller har b\u00F8rn, og det kommer frem", odds: 6, category: "emotions", phase: "early-heavy" },

  /* ── Ceremonies & roses ── */
  { text: "Cocktailparty inden en roseceremoni", odds: 1.8, category: "ceremonies" },
  { text: "Forts\u00E6ttelse f\u00F8lger midt i ceremoni", odds: 3.4, category: "ceremonies" },
  { text: "Intet cocktailparty (annonceret eller sprunget over)", odds: 4.3, category: "ceremonies" },
  { text: "Overraskelses-rose-regel-twist", odds: 4.5, category: "ceremonies" },
  { text: "Ekstra rose eller redning fra v\u00E6rten", odds: 4.6, category: "ceremonies" },
  { text: "En bejler afviser en rose, men ingen andre skal g\u00E5", odds: 8, category: "ceremonies" },

  /* ── Guests & twists ── */
  { text: "Petra tr\u00F8ster en gr\u00E6dende bejler", odds: 3, category: "twists", phase: "late-heavy" },
  { text: "Ven dukker op for at give r\u00E5d midt i s\u00E6sonen", odds: 3.5, category: "twists", phase: "mid-peak" },
  { text: "Overraskelsesg\u00E6st (ven, familie, ekss\u00E6son-alumne)", odds: 4, category: "twists", phase: "late-heavy" },
  { text: "Sp\u00E5kone, tarot eller psykisk-indslag", odds: 4, category: "twists" },
  { text: "Petra annoncerer en \u201Coverraskelse\u201D eller twist", odds: 4, category: "twists" },
  { text: "Petra tager en bejler til side for en privat samtale", odds: 5, category: "twists", phase: "mid-peak" },
  { text: "Petra afbryder en date eller interaktion midtvejs", odds: 8, category: "twists" },
  { text: "En ny bejler kommer ind i programmet midt i s\u00E6sonen", odds: 15, category: "twists", phase: "early-heavy" },

  /* ── Production & editing ── */
  { text: "Nogen medbringer en gave p\u00E5 en date", odds: 2.6, category: "production" },
  { text: "Kostumefest-tema (80er, maskerade, osv.)", odds: 3, category: "production" },

  /* ── Ankomst & episode 1 ── */
  { text: "Nogen b\u00E6rer kostume til deres introduktion", odds: 3, category: "production" },
  { text: "En fyr ankommer i noget andet end et normalt outfit (kostume, tema-outfit)", odds: 1.5, category: "production" },
  { text: "Mindst \u00E9n fyr siger sit navn forkert eller snubler over sine ord", odds: 2, category: "drama" },
  { text: "En fyr synger eller spiller et instrument p\u00E5 den r\u00F8de l\u00F8ber", odds: 2, category: "production" },
  { text: "En fyr n\u00E6vner sin mor, bedstemor eller familie inden for 30 sekunder", odds: 5, category: "emotions" },
  { text: "En deltager ankommer p\u00E5 en form for transport (hest, scooter, bil osv.)", odds: 3, category: "production" },
  { text: "En deltager kysser en bachelorette (p\u00E5 h\u00E5nd eller kind) ved ankomst", odds: 3, category: "romance" },
  { text: "En gave eller rekvisit der kr\u00E6ver montering eller ops\u00E6tningstid", odds: 8, category: "production" },
  { text: "En fyr gr\u00E6der allerede i afsnit 1", odds: 8, category: "emotions" },
  { text: "En fyr glemmer en af bacheloretternes navne", odds: 5, category: "drama", phase: "early-heavy" },
];
