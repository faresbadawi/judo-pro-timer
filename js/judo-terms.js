// Judo-Wörterbuch: erkennt getippte Begriffe ("uchikomi", "Uchi komi", "UCHI-KOMI") und liefert
// die übliche Schreibweise, Vorschläge beim Tippen und – wo vorhanden – die gesprochene Ansage des Namens.
// kind: 'randori' = Kampfform (rot), sonst Übung (gold). word: nur als ganzes Wort erkennen (kurze Begriffe).
// clip: Datei in audio/voice/names/<clip>.mp3, wird vor dem Hajime angesagt.
const TERMS = [
  { name: 'Randori', kind: 'randori', keys: ['randori'] },
  { name: 'Shiai', kind: 'randori', keys: ['shiai'], word: true },
  { name: 'Golden Score', kind: 'randori', keys: ['goldenscore'] },
  { name: 'Open Change', kind: 'randori', keys: ['openchange'] },
  { name: 'Kakari-geiko', kind: 'randori', keys: ['kakarigeiko', 'kakarikeiko'] },
  { name: 'Yakusoku-geiko', keys: ['yakusokugeiko', 'yakusokukeiko'] },
  { name: 'Uchi-komi', keys: ['uchikomi', 'utikomi', 'ushikomi'], clip: 'uchikomi' },
  { name: 'Nage-komi', keys: ['nagekomi'] },
  { name: 'Kumi-kata', keys: ['kumikata'] },
  { name: 'Butsukari', keys: ['butsukari'] },
  { name: 'Tandoku-renshu', keys: ['tandokurenshu', 'tandoku'] },
  { name: 'Sotai-renshu', keys: ['sotairenshu'] },
  { name: 'Ne-waza', keys: ['newaza'] },
  { name: 'Tachi-waza', keys: ['tachiwaza'] },
  { name: 'Nage-waza', keys: ['nagewaza'] },
  { name: 'Katame-waza', keys: ['katamewaza'] },
  { name: 'Osae-komi', keys: ['osaekomi'] },
  { name: 'Shime-waza', keys: ['shimewaza'] },
  { name: 'Kansetsu-waza', keys: ['kansetsuwaza'] },
  { name: 'Ashi-waza', keys: ['ashiwaza'] },
  { name: 'Koshi-waza', keys: ['koshiwaza'] },
  { name: 'Te-waza', keys: ['tewaza'] },
  { name: 'Sutemi-waza', keys: ['sutemiwaza', 'sutemi'] },
  { name: 'Renraku-waza', keys: ['renrakuwaza', 'renraku'] },
  { name: 'Kaeshi-waza', keys: ['kaeshiwaza', 'kaeshi'] },
  { name: 'Tokui-waza', keys: ['tokuiwaza'] },
  { name: 'Ukemi', keys: ['ukemi'], word: true },
  { name: 'Kata', keys: ['kata'], word: true },
  { name: 'Taiso', keys: ['taiso'], word: true },
  { name: 'Mokuso', keys: ['mokuso'], word: true },
  { name: 'Belastung', keys: ['belastung'], clip: 'belastung' }
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

// Ansage zum Namen eines Blocks: Dateiname des ersten erkannten Begriffs mit Clip, sonst null
export const CLIPS = TERMS.filter((x) => x.clip).map((x) => x.clip);
export function clipOf(text) {
  return findTerms(text).find((x) => x.clip)?.clip || null;
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
const COMMON = ['Randori', 'Uchi-komi', 'Nage-komi', 'Kumi-kata', 'Belastung', 'Ne-waza'];
export function suggest(text, max = 6) {
  const { s } = squash(text);
  if (!s) return COMMON.slice(0, max);
  const starts = TERMS.filter((x) => x.keys.some((k) => k.startsWith(s) && k !== s));
  const inside = TERMS.filter((x) => !starts.includes(x) && s.length >= 3 && x.keys.some((k) => k.includes(s) && k !== s));
  return [...starts, ...inside].map((x) => x.name).slice(0, max);
}
