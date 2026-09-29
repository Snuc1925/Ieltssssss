// Doc writing_task2.md (moi dong = 1 de bai) -> server/data/writing-task2/questions.json
// va tu phan loai topic + question type bang luat tu khoa.
// id = so dong (bat dau tu 1): chi THEM de moi vao CUOI file .md de id cu khong bi lech.
// Chay: node server/scripts/build-questions.js
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'writing_task2.md');
const OUT_DIR = path.join(ROOT, 'server', 'data', 'writing-task2');
const OUT = path.join(OUT_DIR, 'questions.json');

// Thu tu = thu tu uu tien khi hoa diem.
const TOPIC_RULES = [
  ['Education', 3, /\b(school|schools|schooling|education|educational|student|students|teach|teaching|teacher|teachers|classroom|classrooms|classes|curriculum|university|universities|college|homework|exam|exams|examination|examinations|tuition|homeschooling|homeschool|tutor|tutors|literacy|degrees|learning|learn|studying|studies|study|apprenticeships?|vocational|lifelong|multilingual|bilingual|libraries|library|reading)\b/gi],
  ['Health & Sport', 3, /\b(health|healthcare|healthy|hospital|hospitals|medical|medicine|obesity|diet|diets|vegetarian|fast-food|fast food|eating|exercise|sport|sports|athlete|athletes|fitness|mental|wellbeing|smoking|illness|disease|nutrition|telemedicine|weight-loss|life expectancy|patient|sanitation|drinking water|therapy|substance)\b/gi],
  ['Environment & Energy', 3, /\b(environment|environmental|pollution|climate|recycling|recycle|plastic|plastics|renewable|energy|nuclear|fossil|carbon|wildlife|conservation|conserving|biofuels?|waste|wasteful|littering|green|sustainability|sustainable|ocean|ecosystems?|e-waste|insulation|packaging|single-use|agriculture|agricultural|farming|crops|pesticide|organic|food origin|fast fashion|water|gardens)\b/gi],
  ['Technology & Science', 2, /\b(technology|technological|technologies|artificial intelligence|ai|robots?|automation|drones?|virtual reality|blockchain|nanotechnology|quantum|3d printing|gene editing|genetic|genetically|space|science|scientific|research|digital|smartphones?|mobile|apps|wearable|driverless|autonomous|computing|coding|cyber\w*|online|internet|biometric|surveillance|electric)\b/gi],
  ['Work & Careers', 3, /\b(work|working|workplace|employ\w*|jobs?|unemployment|career|careers|remote|freelanc\w*|workers?|office|offices|retire|retirement|workweek|internships?|unionize|union|gig|productivity|telecommuting|shifts|entrepreneurs?|start-ups|corporations?|corporate)\b/gi],
  ['Economy & Business', 3, /\b(economic|economy|economies|tax|taxes|taxation|trade|business|businesses|consumer|consumers|companies|finance|financial|banking|cashless|payments|currency|currencies|wage|microfinance|retail|shopping|brand|manufacturing|subscription|prices|money|mergers|poverty|privatiz\w*|delivery|aid|shops|supermarkets|marketing|buying|purchases?|revenue|stimulates)\b/gi],
  ['Crime & Law', 3, /\b(crime|crimes|criminal|criminals|police|policing|penalty|penalties|punishment|prison|gun|law|laws|illegal|enforcement|theft|violence|legal|corruption|wrongdoing|deters|death)\b/gi],
  ['Government & Politics', 3, /\b(vote|voting|voter|election|elections|democracy|protests?|political|politics|legislation|citizens?|national|military|immigration|migration|censorship|speech|activism|civic|unity|policy|host country)\b/gi],
  ['Media & Advertising', 3, /\b(media|advertising|advert|adverts|advertisements?|news|newspapers?|television|tv|streaming|films?|movies|documentar\w*|social networks?|forums|influencers?|influencer|celebrity|celebrities|podcasting|podcast|radio|broadcasting|journalism|misinformation|reviews|photos|posts|reality tv|endorsements)\b/gi],
  ['Arts & Culture', 3, /\b(art|arts|museum|museums|music|culture|cultural|heritage|festival|festivals|traditions?|traditional|crafts|fashion|theatre|monuments?|historic|history|religion|religious|language|books|fiction|galleries|celebrations|preservation|artifacts|documentary)\b/gi],
  ['Transport, Housing & Cities', 3, /\b(transport|traffic|road|roads|car|cars|driver|drivers|driving|drive|license|licenses|cycling|cyclists|bicycle|commute|commuting|congestion|train|urban|urbanisation|city|cities|housing|homeless|homelessness|rent|renting|ownership|homeowners|apartments|houses|zoning|neighborhoods?|neighbourhoods?|gated|parks|rural|scooters|infrastructure|livability)\b/gi],
  ['Travel & Tourism', 3, /\b(tourism|tourist|tourists|travel|solo|holiday|holidays|abroad)\b/gi],
  ['Family & Society', 3, /\b(family|families|parent|parents|parenting|child|children|childhood|childcare|grandparents|elderly|elder|birth|marriage|dating|relationships|gender|equality|inequality|social|community|communities|volunteering|volunteers?|youth|young|generation|generations|pets|ethics|charity|identity|privacy)\b/gi],
];
const FALLBACK_TOPIC = 'Family & Society';

function pickTopic(text) {
  // Bo phan dau "Some people..." khong anh huong; chi tinh diem theo tu khoa.
  let best = FALLBACK_TOPIC;
  let bestScore = 0;
  for (const [name, weight, re] of TOPIC_RULES) {
    const hits = (text.match(re) || []).length;
    const score = Math.min(hits, 2) * weight + (hits > 0 ? 1 : 0);
    if (score > bestScore) { best = name; bestScore = score; }
  }
  return best;
}

function pickType(text) {
  if (/both views/i.test(text)) return 'Discuss both views';
  if (/agree or disagree/i.test(text)) return 'Agree / Disagree';
  if (/to what extent|how far/i.test(text)) return 'Extent';
  if (/do you agree/i.test(text)) return 'Agree / Disagree';
  if (/outweigh|advantages and disadvantages|what are the benefits/i.test(text)) return 'Advantages / Disadvantages';
  if (/causes|solutions|practical measures/i.test(text)) return 'Causes / Solutions';
  if (/discuss and give your opinion|society\/government|or should society/i.test(text)) return 'Discuss both views';
  return 'Opinion';
}

// Sua tay nhung de luat tu khoa xep chua hop ly (key = id de bai).
const OVERRIDES = {
  3: 'Environment & Energy', 7: 'Technology & Science', 16: 'Transport, Housing & Cities', 19: 'Economy & Business',
  30: 'Travel & Tourism', 65: 'Technology & Science', 121: 'Arts & Culture', 172: 'Technology & Science',
  190: 'Travel & Tourism', 202: 'Economy & Business', 206: 'Health & Sport', 228: 'Education',
  231: 'Government & Politics', 234: 'Technology & Science', 246: 'Education', 260: 'Health & Sport',
  261: 'Health & Sport', 286: 'Arts & Culture', 306: 'Health & Sport', 310: 'Travel & Tourism',
  338: 'Transport, Housing & Cities', 353: 'Government & Politics', 385: 'Health & Sport', 389: 'Transport, Housing & Cities',
  390: 'Economy & Business', 409: 'Arts & Culture', 416: 'Government & Politics', 425: 'Travel & Tourism',
  429: 'Environment & Energy', 439: 'Government & Politics', 461: 'Travel & Tourism', 470: 'Technology & Science',
  480: 'Economy & Business', 485: 'Economy & Business', 493: 'Health & Sport', 495: 'Government & Politics',
  15: 'Transport, Housing & Cities', 128: 'Travel & Tourism', 144: 'Media & Advertising', 156: 'Economy & Business',
  212: 'Technology & Science', 240: 'Environment & Energy', 452: 'Environment & Energy', 331: 'Government & Politics',
  344: 'Education', 418: 'Economy & Business', 473: 'Arts & Culture', 453: 'Technology & Science',
  444: 'Economy & Business',
};

const raw = await fs.readFile(SRC, 'utf-8');
const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const questions = lines.map((text, i) => ({
  id: i + 1,
  text,
  topic: OVERRIDES[i + 1] || pickTopic(text),
  qtype: pickType(text),
}));

await fs.mkdir(OUT_DIR, { recursive: true });
await fs.writeFile(OUT, JSON.stringify(questions, null, 1), 'utf-8');

const count = (key) => questions.reduce((m, q) => ((m[q[key]] = (m[q[key]] || 0) + 1), m), {});
console.log(`Da ghi ${questions.length} de vao ${path.relative(ROOT, OUT)}`);
console.log('Topic:', count('topic'));
console.log('Type:', count('qtype'));
