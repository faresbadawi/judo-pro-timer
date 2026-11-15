// Judo-Wörterbuch: erkennt getippte Begriffe ("uchikomi", "Uchi komi", "UCHI-KOMI") und liefert
// die übliche Schreibweise, die japanischen Zeichen und eine kurze Erklärung in der Sprache der App.
// kind: 'randori' = Kampfform (rot), sonst Übung (gold). word: nur als ganzes Wort erkennen (kurze Begriffe).
const TERMS = [
  { name: 'Randori', jp: '乱取り', kind: 'randori', keys: ['randori'], de: 'freies Kämpfen', en: 'free sparring', ar: 'قتال حر' },
  { name: 'Shiai', jp: '試合', kind: 'randori', keys: ['shiai'], word: true, de: 'Wettkampf', en: 'contest', ar: 'مباراة' },
  { name: 'Golden Score', jp: 'ゴールデンスコア', kind: 'randori', keys: ['goldenscore'], de: 'Verlängerung bis zur ersten Wertung', en: 'overtime until the first score', ar: 'وقت إضافي حتى أول نقطة' },
  { name: 'Open Change', jp: '', kind: 'randori', keys: ['openchange'], de: 'freier Partnerwechsel', en: 'free change of partners', ar: 'تبديل حر للشركاء' },
  { name: 'Kakari-geiko', jp: '掛かり稽古', kind: 'randori', keys: ['kakarigeiko', 'kakarikeiko'], de: 'einer greift ständig an, der andere verteidigt', en: 'one attacks continuously, the other defends', ar: 'لاعب يهاجم باستمرار والآخر يدافع' },
  { name: 'Yakusoku-geiko', jp: '約束稽古', keys: ['yakusokugeiko', 'yakusokukeiko'], de: 'abgesprochenes Üben in Bewegung', en: 'agreed practice on the move', ar: 'تدريب متفق عليه أثناء الحركة' },
  { name: 'Uchi-komi', jp: '打ち込み', keys: ['uchikomi', 'utikomi', 'ushikomi'], de: 'Eingänge wiederholen, ohne zu werfen', en: 'repeated entries without throwing', ar: 'تكرار الدخول دون رمي' },
  { name: 'Nage-komi', jp: '投げ込み', keys: ['nagekomi'], de: 'Würfe durchwerfen', en: 'repeated full throws', ar: 'تكرار الرميات كاملة' },
  { name: 'Kumi-kata', jp: '組み方', keys: ['kumikata'], de: 'Griffkampf', en: 'grip fighting', ar: 'صراع المسكات' },
  { name: 'Butsukari', jp: 'ぶつかり', keys: ['butsukari'], de: 'Eingänge mit vollem Körperkontakt', en: 'entries with full body contact', ar: 'دخول مع احتكاك كامل بالجسم' },
  { name: 'Tandoku-renshu', jp: '単独練習', keys: ['tandokurenshu', 'tandoku'], de: 'Üben ohne Partner', en: 'solo practice', ar: 'تدريب دون شريك' },
  { name: 'Sotai-renshu', jp: '相対練習', keys: ['sotairenshu'], de: 'Üben mit Partner', en: 'partner practice', ar: 'تدريب مع شريك' },
  { name: 'Ne-waza', jp: '寝技', keys: ['newaza'], de: 'Bodentechniken', en: 'ground techniques', ar: 'تقنيات أرضية' },
  { name: 'Tachi-waza', jp: '立ち技', keys: ['tachiwaza'], de: 'Standtechniken', en: 'standing techniques', ar: 'تقنيات من الوقوف' },
  { name: 'Nage-waza', jp: '投げ技', keys: ['nagewaza'], de: 'Wurftechniken', en: 'throwing techniques', ar: 'تقنيات الرمي' },
  { name: 'Katame-waza', jp: '固め技', keys: ['katamewaza'], de: 'Grifftechniken am Boden', en: 'grappling techniques', ar: 'تقنيات التثبيت والسيطرة' },
  { name: 'Osae-komi', jp: '抑え込み', keys: ['osaekomi'], de: 'Haltegriffe', en: 'hold-downs', ar: 'تثبيتات' },
  { name: 'Shime-waza', jp: '絞め技', keys: ['shimewaza'], de: 'Würgetechniken', en: 'strangles', ar: 'تقنيات الخنق' },
  { name: 'Kansetsu-waza', jp: '関節技', keys: ['kansetsuwaza'], de: 'Hebeltechniken', en: 'joint locks', ar: 'تقنيات المفاصل' },
  { name: 'Ashi-waza', jp: '足技', keys: ['ashiwaza'], de: 'Fußtechniken', en: 'foot techniques', ar: 'تقنيات القدم' },
  { name: 'Koshi-waza', jp: '腰技', keys: ['koshiwaza'], de: 'Hüfttechniken', en: 'hip techniques', ar: 'تقنيات الورك' },
  { name: 'Te-waza', jp: '手技', keys: ['tewaza'], de: 'Handtechniken', en: 'hand techniques', ar: 'تقنيات اليد' },
  { name: 'Sutemi-waza', jp: '捨身技', keys: ['sutemiwaza', 'sutemi'], de: 'Opferwürfe', en: 'sacrifice throws', ar: 'رميات التضحية' },
  { name: 'Renraku-waza', jp: '連絡技', keys: ['renrakuwaza', 'renraku'], de: 'Kombinationen', en: 'combinations', ar: 'تركيبات هجومية' },
  { name: 'Kaeshi-waza', jp: '返し技', keys: ['kaeshiwaza', 'kaeshi'], de: 'Konter', en: 'counters', ar: 'هجمات مضادة' },
  { name: 'Tokui-waza', jp: '得意技', keys: ['tokuiwaza'], de: 'Spezialtechnik', en: 'favourite technique', ar: 'التقنية المفضلة' },
  { name: 'Ukemi', jp: '受身', keys: ['ukemi'], word: true, de: 'Fallschule', en: 'breakfalls', ar: 'السقوط الآمن' },
  { name: 'Kata', jp: '形', keys: ['kata'], word: true, de: 'festgelegte Form', en: 'formal exercise', ar: 'كاتا (شكل محدد)' },
  { name: 'Taiso', jp: '体操', keys: ['taiso'], word: true, de: 'Gymnastik', en: 'warm-up exercises', ar: 'تمارين إحماء' },
  { name: 'Mokuso', jp: '黙想', keys: ['mokuso'], word: true, de: 'stille Konzentration', en: 'quiet concentration', ar: 'تأمل صامت' }
];

// Kleinbuchstaben, ohne Akzente/Längenstriche (ō → o); je Zeichen bleibt die Position im Original erhalten
function squash(text) {
  let s = ''; const pos = [];
  [...String(text || '')].forEach((ch, i) => {
    const c = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (/^[a-z0-9]$/.test(c)) { s += c; pos.push(i); }
  });
  return { s, pos };
}
const wordsOf = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

// Alle erkannten Begriffe in der Reihenfolge, in der sie im Text stehen ("Randori Newaza" → Randori, Ne-waza).
// Längere Begriffe gewinnen (Kumi-kata wird nicht zusätzlich als Kata erkannt).
export function findTerms(text) {
  const { s } = squash(text);
  if (!s) return [];
  const words = wordsOf(text);
  const taken = new Array(s.length).fill(false);
  const hits = [];
  const cands = TERMS.flatMap((term) => term.keys.map((key) => ({ term, key }))).sort((a, b) => b.key.length - a.key.length);
  for (const { term, key } of cands) {
    if (hits.some((x) => x.term === term)) continue;
    if (term.word && !words.includes(key)) continue;
    let at = s.indexOf(key);
    while (at >= 0 && taken.slice(at, at + key.length).some(Boolean)) at = s.indexOf(key, at + 1);
    if (at < 0) continue;
    for (let i = at; i < at + key.length; i++) taken[i] = true;
    hits.push({ term, at });
  }
  return hits.sort((a, b) => a.at - b.at).map((x) => x.term);
}

// Erklärung zu einem Namen: { jp: '乱取り 寝技', text: 'freies Kämpfen · Bodentechniken' } oder null
export function explain(text, lang = 'de') {
  const terms = findTerms(text);
  if (!terms.length) return null;
  return { jp: terms.map((x) => x.jp).filter(Boolean).join(' '), text: terms.map((x) => x[lang] || x.de).join(' · ') };
}

// Block-Art aus dem Namen: 'randori', 'exercise' oder null (unbekannter Name → Art bleibt, wie sie ist)
export function kindOf(text) {
  const terms = findTerms(text);
  if (!terms.length) return null;
  return terms.some((x) => x.kind === 'randori') ? 'randori' : 'exercise';
}

// Übliche Schreibweise, wenn der Text genau ein Begriff ist ("uchikomi" → "Uchi-komi"); sonst unverändert
export function tidyName(text) {
  const { s } = squash(text);
  const term = TERMS.find((x) => x.keys.includes(s));
  return term ? term.name : String(text || '').trim();
}

// Vorschläge beim Tippen: ohne Eingabe die häufigsten Begriffe, sonst alles, was zum Getippten passt
const COMMON = ['Randori', 'Uchi-komi', 'Nage-komi', 'Kumi-kata', 'Ne-waza', 'Tachi-waza'];
export function suggest(text, max = 6) {
  const { s } = squash(text);
  if (!s) return COMMON.slice(0, max);
  const starts = TERMS.filter((x) => x.keys.some((k) => k.startsWith(s) && k !== s));
  const inside = TERMS.filter((x) => !starts.includes(x) && s.length >= 3 && x.keys.some((k) => k.includes(s) && k !== s));
  return [...starts, ...inside].map((x) => x.name).slice(0, max);
}
