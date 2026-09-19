/**
 * Baut die Startseite von oneproject.me aus opm.html (DGs Datei) nach dist/index.html.
 * Netlify ruft das bei jedem Push auf (netlify.toml). Keine Abhaengigkeiten.
 *
 * Rechtsseiten: recht/impressum.html, recht/datenschutz.html -> dist/ (ohne "Entwurf",
 * "AUSFUELLEN", "Platzhalter", "wird ergaenzt" - sonst bricht der Bau ab).
 *
 * Zwei Regeln fuer die Startseite (DG 19.09.2026):
 *  - Formular: Solange die Adresse der Platzhalter ist, geht kein Formular live -
 *    der Kasten wird durch eine Zeile ersetzt, dass die Liste in Kuerze oeffnet.
 *    "Ein Feld, das Adressen annimmt und verliert, deployen wir nicht."
 *  - Arbeitsnotizen ("Hier fehlt dein Teil", Klasse "offen") nur in Deploy-Previews
 *    und Branch-Deploys, nie in der Produktion.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';

/** Rechtsseiten und was auf ihnen nie stehen darf (DG 19.09.2026, harte Regel fuer beide Repos). */
export const RECHTSSEITEN = ['impressum.html', 'datenschutz.html'];
export const VERBOTEN_RECHT = /entwurf|ausfuellen|ausfüllen|platzhalter|wird ergänzt|werden ergänzt|wird ergaenzt|werden ergaenzt/i;

export function pruefeRechtsseite(name, html) {
  const m = html.match(VERBOTEN_RECHT);
  if (m) throw new Error(`${name}: enthält "${m[0]}" - eine Rechtsseite geht so nicht live`);
  return html;
}
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
    html = html.replace('  /* Warteliste */\n', `  /* Warteliste: noch kein Formular - eine Zeile statt des Kastens */\n${BALD_CSS}  /* Warteliste */\n`);
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
    for (const d of RECHTSSEITEN) {
      writeFileSync(new URL(`./dist/${d}`, import.meta.url), pruefeRechtsseite(d, readFileSync(new URL(`./recht/${d}`, import.meta.url), 'utf8')));
    }
    console.log(`Gebaut: dist/index.html (CONTEXT=${process.env.CONTEXT || '-'}, ${entwurfAus(process.env) ? 'mit' : 'ohne'} Arbeitsnotizen)`);
  } catch (f) {
    console.error(f.message);
    process.exit(1);
  }
}
