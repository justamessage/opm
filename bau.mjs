/**
 * Baut die Startseite von oneproject.me aus opm.html (DGs Datei) nach dist/index.html.
 * Netlify ruft das bei jedem Push auf (netlify.toml). Keine Abhaengigkeiten.
 *
 * Zwei Regeln (DG 19.09.2026):
 *  - Formular: Solange die Adresse der Platzhalter ist, geht kein Formular live -
 *    der Kasten wird durch eine Zeile ersetzt, dass die Liste in Kuerze oeffnet.
 *    "Ein Feld, das Adressen annimmt und verliert, deployen wir nicht."
 *  - Arbeitsnotizen ("Hier fehlt dein Teil", Klasse "offen") nur in Deploy-Previews
 *    und Branch-Deploys, nie in der Produktion.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const PLATZHALTER = '__WARTELISTE_ENDPUNKT__';

export const entwurfAus = (env) => ['deploy-preview', 'branch-deploy'].includes(env.CONTEXT);

const BALD_CSS = '  .bald{font-size:1rem;font-weight:500;color:var(--violett-hell);margin:1.6rem 0 0;}\n';

export function bauen(quelle, { entwurf }) {
  let html = quelle;
  if (html.includes(`action="${PLATZHALTER}"`)) {
    const vorher = html;
    html = html.replace(/<div class="liste-kasten auf d3">[\s\S]*?<\/form>[\s\S]*?<\/div>/, '<p class="bald auf d3">Die Warteliste öffnet in Kürze.</p>');
    if (html === vorher) throw new Error('Kasten mit Platzhalter-Formular nicht gefunden - nichts ersetzt, Bau abgebrochen');
    html = html.replace('  /* Warteliste */\n', `  /* Warteliste: noch kein Formular (Platzhalter) - eine Zeile statt des Kastens */\n${BALD_CSS}  /* Warteliste */\n`);
  }
  if (!entwurf) html = html.replace(/\s*<div class="offen">[\s\S]*?<\/div>\n?/g, '\n');
  // Riegel: nie ein Formular mit Platzhalter-Adresse, nie eine Notiz in der Produktion.
  if (html.includes(PLATZHALTER)) throw new Error('Platzhalter-Adresse im Ergebnis - Bau abgebrochen');
  if (!entwurf && /class="offen"|Hier fehlt dein Teil/.test(html)) throw new Error('Arbeitsnotiz im Produktionsbau - Bau abgebrochen');
  return html;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const html = bauen(readFileSync(new URL('./opm.html', import.meta.url), 'utf8'), { entwurf: entwurfAus(process.env) });
    rmSync(new URL('./dist/', import.meta.url), { recursive: true, force: true });
    mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
    writeFileSync(new URL('./dist/index.html', import.meta.url), html);
    console.log(`Gebaut: dist/index.html (CONTEXT=${process.env.CONTEXT || '-'}, ${entwurfAus(process.env) ? 'mit' : 'ohne'} Arbeitsnotizen)`);
  } catch (f) {
    console.error(f.message);
    process.exit(1);
  }
}
