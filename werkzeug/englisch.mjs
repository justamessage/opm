/**
 * Erzeugt en/opm.html aus opm.html (DGs Datei) und der Tabelle
 * werkzeug/uebersetzung.json (Auftrag DG 10.10.2026: zweisprachiges Geruest,
 * Fliesstexte als englischer Entwurf).
 *
 *   npm run englisch            schreibt en/opm.html und docs/en-texte.md neu
 *   npm run englisch -- --pruefen   Exit 1, wenn en/opm.html nicht dem Ergebnis entspricht
 *
 * Jede Zeile der Tabelle: [deutsch, englisch] oder [deutsch, englisch, anzahl].
 * Der deutsche Text muss GENAU so oft in opm.html stehen (Vorgabe 1). Aendert DG
 * seine Datei, faellt jede Stelle auf, die nicht mehr passt - nichts bleibt
 * still deutsch stehen. Danach sucht das Werkzeug nach deutschen Resten im
 * sichtbaren Text und in den Texten des Skripts.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const datei = (p) => new URL(`../${p}`, import.meta.url);

/** Woerter und Zeichen, die in einem englischen Text nicht vorkommen. */
export const DEUTSCH = /[äöüßÄÖÜ„]|\b(der|die|das|und|nicht|ist|du|dich|dir|ein|eine|mit|für|auf|zu|wer|was|wie|noch|nur|auch|schon|kein|keine)\b/;

/** Sichtbarer Text und Zeichenketten im Skript - ohne CSS, ohne Markennamen. */
export function texte(html) {
  const ohneStil = html.replace(/<style[\s\S]*?<\/style>/g, '');
  const skript = (ohneStil.match(/<script>([\s\S]*?)<\/script>/) || ['', ''])[1];
  const sichtbar = ohneStil.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '\n').split('\n').map((t) => t.trim()).filter(Boolean);
  const zeichen = [...skript.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]).filter((t) => /\s/.test(t));
  const attribute = [...ohneStil.matchAll(/\b(?:content|placeholder|aria-label|title|alt)="([^"]+)"/g)].map((m) => m[1]).filter((t) => /\s/.test(t));
  return [...sichtbar, ...zeichen, ...attribute];
}

export function englisch(quelle, tabelle) {
  let html = quelle;
  const fehler = [];
  for (const [de, en, anzahl = 1] of tabelle) {
    const n = html.split(de).length - 1;
    if (n !== anzahl) { fehler.push(`${n}x statt ${anzahl}x: ${de.slice(0, 80)}`); continue; }
    html = html.split(de).join(en);
  }
  if (fehler.length) throw new Error(`werkzeug/uebersetzung.json passt nicht mehr zu opm.html:\n  - ${fehler.join('\n  - ')}`);
  const reste = texte(html).filter((t) => DEUTSCH.test(t));
  if (reste.length) throw new Error(`en/opm.html: noch deutsch:\n  - ${reste.join('\n  - ')}`);
  return html;
}

/** Sichtbarer Text einer Tabellenzelle: Markup weg, Zeilen zusammen, | maskiert. */
const zelle = (w) => w
  .replace(/<br>/g, ' / ').replace(/<[^>]+>/g, '').replace(/^[\w\s="-]*">/, '').replace(/^hidden>|^type="button">/, '')
  .replace(/^\s*\{?\s*(t|name|desc|price|note|cta|content|placeholder):?=?\s*/, '')
  .replace(/"\s*,\s*world:\s*"/, ' / ').replace(/" aria-label="/, ' / ')
  .replace(/^"|"$/g, '').replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');

/** docs/en-texte.md aus derselben Tabelle - Deutsch | Englisch, zum Gegenlesen. */
export function doku(tabelle) {
  return [
    '# Englische Texte von oneproject.me zum Gegenlesen',
    '',
    'Erzeugt von `werkzeug/englisch.mjs` aus `werkzeug/uebersetzung.json` - nicht von Hand ändern.',
    'Dieselbe Tabelle erzeugt `en/opm.html`: was hier steht, steht auf `/en/`.',
    '',
    '**Entwurf** (DG 10.10.2026): Die deutsche Seite wird noch überarbeitet. Die Oberfläche (Titel,',
    'Beschreibung, Knöpfe, Fuß, Umschalter) ist fertig; die Fließtexte werden nach der',
    'Überarbeitung neu gezogen. Ändert sich `opm.html`, meldet das Werkzeug jede Stelle, die',
    'nicht mehr passt, und jeden deutschen Rest.',
    '',
    'Was der Bau zusätzlich je Sprache einsetzt (Umschalter, Hinweis zu den Rechtstexten,',
    '„Die Warteliste öffnet in Kürze.“), steht in `bau.mjs`, `SPRACHEN`.',
    '',
    '| Deutsch | Englisch |',
    '|---|---|',
    // Zeilen ohne sichtbaren Text (z. B. <html lang>) gehoeren nicht zum Gegenlesen.
    ...tabelle.filter(([de]) => zelle(de)).map(([de, en]) => `| ${zelle(de)} | ${zelle(en)} |`),
    '',
  ].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const neu = englisch(readFileSync(datei('opm.html'), 'utf8'), JSON.parse(readFileSync(datei('werkzeug/uebersetzung.json'), 'utf8')));
    const texte = doku(JSON.parse(readFileSync(datei('werkzeug/uebersetzung.json'), 'utf8')));
    if (process.argv.includes('--pruefen')) {
      if (readFileSync(datei('en/opm.html'), 'utf8') !== neu) { console.error('en/opm.html ist veraltet - npm run englisch'); process.exit(1); }
      if (readFileSync(datei('docs/en-texte.md'), 'utf8') !== texte) { console.error('docs/en-texte.md ist veraltet - npm run englisch'); process.exit(1); }
      console.log('en/opm.html und docs/en-texte.md sind aktuell');
    } else {
      writeFileSync(datei('en/opm.html'), neu);
      writeFileSync(datei('docs/en-texte.md'), texte);
      console.log('en/opm.html und docs/en-texte.md geschrieben');
    }
  } catch (f) {
    console.error(f.message);
    process.exit(1);
  }
}
