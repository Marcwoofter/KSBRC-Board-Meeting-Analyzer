// KSBRC contextual topic classifier overlay.
// Keeps the V31 interface and work-type classifier intact while making topic
// classification depend more on meaningful phrases/context than isolated words.
(function () {
  if (typeof window.classifyKSBRC !== 'function') return;

  const originalClassify = window.classifyKSBRC;

  const RULES = {
    "Student Achievement": {
      strong: ["student achievement","student learning","test scores","state assessment","science assessment","reading assessment","math assessment","assessment results","assessment data","academic achievement","academic performance","academic growth","reading instruction","math instruction","literacy instruction","curriculum review","curriculum adoption","curriculum implementation","instructional practice","instructional strategies","student proficiency","achievement data","benchmark assessment","graduation rate","kap scores","ela scores"],
      support: ["assessment","reading","literacy","math","mathematics","curriculum","instruction","instructional","intervention","kap","graduation","academic","benchmark","proficiency","growth","ela"],
      context: ["student","students","score","scores","data","results","learning","grade","grades","classroom","teacher","teachers","achievement","performance"]
    },
    "Student Services": {
      strong: ["special education","student services","student support","mental health","school nurse","mckinney vento","student attendance","student discipline","behavior support","counseling services","iep meeting","504 plan"],
      support: ["sped","iep","504","counseling","attendance","discipline","behavior","homeless"],
      context: ["student","students","support","services","counselor","nurse","intervention","plan"]
    },
    "Activities / Athletics": {
      strong: ["student activities","athletic program","athletic director","sports program","extracurricular activities","kshsaa","football program","basketball program","activity program"],
      support: ["athletics","athletic","football","basketball","sports","activities","coach","extracurricular","band","cheer"],
      context: ["student","students","team","teams","season","program","competition","coach","coaches"]
    },
    "Budget / Finance": {
      strong: ["budget hearing","budget development","financial report","mill levy","fund balance","capital outlay","accounts payable","bond issue","bond payment","insurance costs","budget authority","revenue neutral rate","cash balance","audit report","district budget","budget proposal"],
      support: ["budget","finance","financial","levy","audit","bond","expenditure","expense","revenue","tax","rnr","treasurer","insurance"],
      context: ["dollar","dollars","cost","costs","fund","funds","cash","payment","payments","mill","mills","purchase","purchasing"]
    },
    "Personnel": {
      strong: ["personnel report","personnel action","staffing levels","employment contract","teacher contract","administrator contract","superintendent evaluation","negotiated agreement","salary schedule","staff vacancy","teacher vacancy","employee benefits","staff recruitment","staffing recommendation"],
      support: ["personnel","hire","hiring","resignation","resign","employee","contract","salary","compensation","vacancy","recruitment"],
      context: ["teacher","teachers","staff","employee","employees","position","positions","employment","administrator","administrators"]
    },
    "Facilities": {
      strong: ["facility project","facilities project","building project","capital improvement","parking lot","classroom addition","roof replacement","hvac system","construction project","facility maintenance","building maintenance","facility renovation","building renovation"],
      support: ["facilities","facility","roof","hvac","construction","renovation","maintenance","architect"],
      context: ["building","buildings","site","project","projects","repair","repairs","classroom","classrooms","grounds"]
    },
    "Transportation": {
      strong: ["student transportation","school bus","bus route","bus routes","bus purchase","bus driver","transportation route","transportation services","bus fleet","fleet maintenance"],
      support: ["transportation","buses","fleet"],
      context: ["bus","route","routes","vehicle","vehicles","driver","drivers","student","students"]
    },
    "Technology": {
      strong: ["technology plan","technology infrastructure","student devices","staff devices","data system","software system","network security","cybersecurity","computer network","technology purchase"],
      support: ["technology","chromebook","software","network","cybersecurity","cyber","internet","wifi"],
      context: ["computer","computers","device","devices","system","systems","data","network"]
    },
    "Policy / Governance": {
      strong: ["board policy","policy update","policy revision","policy adoption","board governance","board role","board roles","governance expectation","strategic governance","board goals"],
      support: ["governance","bylaw"],
      context: ["policy","policies","board","role","roles","goals"]
    },
    "Legislative / Advocacy": {
      strong: ["legislative update","house bill","senate bill","proposed legislation","legislative session","advocacy priorities","contact legislators","state legislature","federal legislation"],
      support: ["legislature","legislative","advocacy","lawmakers","legislation"],
      context: ["bill","bills","statute","state","federal","ksde","law","laws"]
    },
    "Community / Communications": {
      strong: ["community engagement","community partnership","public relations","communication plan","district communications","parent communication","public information","social media","district website","community survey"],
      support: ["communications","newsletter","website"],
      context: ["community","parent","parents","survey","public","media","communication","communications"]
    },
    "Legal / Compliance": {
      strong: ["legal counsel","legal update","regulatory compliance","statutory requirement","legal requirement","due process","title ix","open records","kora","koma","pending litigation"],
      support: ["legal","attorney","compliance","lawsuit","litigation","regulation"],
      context: ["law","laws","requirement","requirements","statute","statutory","court","counsel"]
    },
    "Recognition / Ceremonial": {
      strong: ["student of the month","retirement recognition","staff recognition","student recognition","recognition award","present an award","special recognition"],
      support: ["recognition","recognize","award","honor","certificate","celebrate"],
      context: ["student","students","staff","teacher","employee","team","achievement"]
    },
    "Meeting Administration": {
      strong: ["call to order","called to order","roll call","approval of agenda","approval of the agenda","approval of minutes","consent agenda","pledge of allegiance","motion to adjourn","meeting adjourned"],
      support: ["adjourn"],
      context: ["agenda","minutes","meeting","motion"]
    }
  };

  function norm(v) {
    return String(v || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9'?.-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function hasPhrase(t, phrase) {
    const p = norm(phrase);
    return p && (` ${t} `).includes(` ${p} `);
  }

  function scoreTopics(text) {
    const t = norm(text);
    const rows = [];
    Object.entries(RULES).forEach(([label, r]) => {
      let score = 0, strongHits = 0, supportHits = 0, contextHits = 0;
      r.strong.forEach(p => { if (hasPhrase(t,p)) { score += 7; strongHits++; } });
      r.support.forEach(p => { if (hasPhrase(t,p)) supportHits++; });
      r.context.forEach(p => { if (hasPhrase(t,p)) contextHits++; });

      // Single terms are corroborating evidence, not stand-alone classifiers.
      if (supportHits >= 1 && contextHits >= 1) score += Math.min(6, 2 + supportHits + contextHits);
      if (supportHits >= 2) score += 2;
      if (contextHits >= 2 && supportHits >= 1) score += 2;

      if (score > 0) rows.push({label,score,strongHits,supportHits,contextHits});
    });
    rows.sort((a,b) => b.score-a.score);
    if (!rows.length) return {label:'Other',confidence:'Low',score:0,margin:0};
    const best = rows[0], second = rows[1]?.score || 0, margin = best.score-second;

    // Require either a meaningful phrase or corroborating contextual evidence.
    if (best.strongHits === 0 && !(best.supportHits >= 1 && best.contextHits >= 1))
      return {label:'Other',confidence:'Low',score:0,margin:0};

    let confidence='Low';
    if (best.strongHits >= 1 && best.score >= 7 && margin >= 3) confidence='High';
    else if (best.score >= 6 && margin >= 2) confidence='Medium';
    else if (best.score >= 5 && margin >= 1) confidence='Medium';
    return {label:best.label,confidence,score:best.score,margin};
  }

  window.classifyKSBRC = function (text) {
    const prior = originalClassify(text);
    const topic = scoreTopics(text);
    return {
      ...prior,
      topic: topic.label,
      confidence: topic.confidence === 'Low' ? (prior.workType === 'Executive Session' ? prior.confidence : 'Low') :
                  (prior.confidence === 'Low' ? topic.confidence : prior.confidence),
      topicScore: topic.score,
      topicMargin: topic.margin
    };
  };
})();
