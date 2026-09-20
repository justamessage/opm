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

const BALD_CSS = '.bald{font-size:18px;font-weight:500;color:var(--haus);margin:0;}\n';

/** Die Klasse, deren Kasten weichen muss, solange kein Formular live geht. */
export const KASTEN = 'wl';

/**
 * Schneidet den Wartelisten-Kasten heraus und setzt eine Zeile an seine Stelle.
 *
 * Nicht mit einem Muster ueber verschachtelte <div>: das erste </div> gehoert
 * einem Kind, und man schnitte mitten im Kasten. Gezaehlt wird stattdessen, wie
 * es ein Parser tut.
 */
export function ohneKasten(html) {
  const ab = html.search(new RegExp(`<div class="${KASTEN}"[ >]`));
  if (ab < 0) return html;
  const auf = /<div\b/g;
  const zu = /<\/div>/g;
  let tiefe = 0;
  let i = ab;
  for (;;) {
    auf.lastIndex = i;
    zu.lastIndex = i;
    const a = auf.exec(html);
    const z = zu.exec(html);
    if (!z) return html; // nie geschlossen - dann lieber nichts anfassen
    if (a && a.index < z.index) { tiefe += 1; i = a.index + 1; continue; }
    tiefe -= 1;
    i = z.index + z[0].length;
    if (tiefe === 0) return `${html.slice(0, ab)}<p class="bald">Die Warteliste öffnet in Kürze.</p>${html.slice(i)}`;
  }
}

/**
 * Das Favicon der Vorgaengerfassung (von DG, opm-2.html, 19.09.2026):
 * eingebettetes SVG, keine fremde Anfrage. Die neue Vorlage bringt keines mit -
 * ohne dieses hier haette jede Seite einen 404 in der Konsole.
 */
export const FAVICON = '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 32 32\'%3E%3Crect x=\'2\' y=\'2\' width=\'28\' height=\'28\' fill=\'%230b0f16\'/%3E%3Crect x=\'3.5\' y=\'3.5\' width=\'25\' height=\'25\' fill=\'none\' stroke=\'%239d4eff\' stroke-width=\'2\'/%3E%3Crect x=\'12\' y=\'12\' width=\'8\' height=\'8\' fill=\'%239d4eff\'/%3E%3C/svg%3E">'

/**
 * Zwei Stellen, an denen DGs Vorlage etwas offen laesst und der Bau sie schliesst.
 * Beides meldet sich, wenn es nicht mehr noetig ist: die Funktionen werfen dann.
 */
export function rechtVerlinken(html) {
  let neu = html;
  for (const [wort, ziel] of [['Impressum', '/impressum'], ['Datenschutz', '/datenschutz']]) {
    const vorher = neu;
    neu = neu.replace(new RegExp(`(^|\\n)(\\s*)<span>${wort}</span>`), `$1$2<a href="${ziel}">${wort}</a>`);
    if (neu === vorher) throw new Error(`Fuss: <span>${wort}</span> nicht gefunden - steht der Link schon da, gehoert diese Zeile weg`);
  }
  return neu;
}

/**
 * DG, 19.09.2026: "Der Fuss enthaelt KEINEN Hinweis auf HIGHERPlan und keinen
 * Claim, nur Impressum / Datenschutz. Bitte nicht wiederherstellen."
 * Die Vorlage v2 hat die Regel nicht mitgenommen (DG 20.09.2026: "war in meiner
 * Vorlage nur nicht mitgenommen"), also nimmt der Bau sie wieder heraus.
 */
export function fussOhneHigherplan(html) {
  const vorher = html;
  // Die ganze Zeile, samt Einrueckung und Umbruch - sonst bleibt Leerraum
  // stehen und die naechste Zeile rutscht ein.
  const neu = html.replace(/\n[^\S\n]*<span>HIGHERPlan GmbH<\/span>/, '');
  if (neu === vorher) throw new Error('Fuss: <span>HIGHERPlan GmbH</span> nicht gefunden - ist die Regel schon in der Vorlage, gehoert diese Zeile weg');
  return neu;
}

/**
 * Der Abschnitt zur Warteliste in der Datenschutzerklaerung. Er steht dort NUR,
 * wenn das Formular auch wirklich live ist - sonst beschriebe sie etwas, das es
 * nicht gibt. Wortlaut wie auf dennisgoldhammer.me.
 *
 * ACHTUNG, noch nicht einsetzbar: die Loeschfristen des Mandanten opm stehen in
 * hp-anmeldung auf AUSFUELLEN. Eine Erklaerung, die eine Loeschung zusagt,
 * waehrend der Loeschlauf in diesen Klassen nichts tut, waere ein Versprechen
 * ohne Deckung. Erst entscheiden, dann hier einsetzen.
 */
export const WARTELISTE_DSE = `<h2>Warteliste</h2>
<p>Wenn du dich auf die Warteliste einträgst, verarbeiten wir deine E-Mail-Adresse, um dir die Bestätigungsmail und danach die Nachricht zum Start zu schicken. Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO).</p>
<p>Wir verwenden das Double-Opt-In-Verfahren: Nach der Eingabe bekommst du eine E-Mail mit einem Bestätigungslink. Erst wenn du darauf klickst, stehst du auf der Liste.</p>
<p>Als Nachweis der Einwilligung speichern wir den Zeitpunkt der Eingabe, die IP-Adresse, den Wortlaut und die Version des Einwilligungstextes sowie Zeitpunkt und IP-Adresse deines Bestätigungsklicks.</p>
<p>Die Anmeldung läuft über einen Dienst bei Cloudflare (Cloudflare Germany GmbH, Rosenheimer Str. 116, 81669 München); die Daten liegen in einer Datenbank in Westeuropa. Den Versand übernimmt Brevo (Sendinblue GmbH, Köpenicker Str. 126, 10179 Berlin). Beide verarbeiten die Daten in unserem Auftrag; mit beiden bestehen Verträge nach Art. 28 DSGVO.</p>
<p>Du kannst deine Einwilligung jederzeit widerrufen. In jeder E-Mail steht dafür ein Abmeldelink; darüber kannst du dich auch vollständig löschen lassen.</p>
`;

/**
 * Geht ein Formular live, muss die Erklaerung im selben Bau mitziehen - und der
 * Satz "hat kein Formular" muss weg. Ohne Formular gilt das Umgekehrte.
 */
export function pruefeDseZumFormular(roh, mitFormular) {
  // Ohne Kommentare: dort steht dokumentiert, was NICHT auf der Seite passiert
  // ("gestrichen, was diese Seite nicht tut: Warteliste, Brevo ..."). Das ist
  // das Gegenteil einer falschen Zusage und darf den Riegel nicht ausloesen.
  const html = roh.replace(/<!--[\s\S]*?-->/g, '');
  if (!mitFormular) {
    if (!html.includes('hat kein Formular')) throw new Error('datenschutz.html: ohne Formular muss der Satz "hat kein Formular" dastehen');
    if (/Brevo|Cloudflare|Double-Opt-In/.test(html)) throw new Error('datenschutz.html: beschreibt eine Warteliste, die es nicht gibt');
    return;
  }
  if (html.includes('hat kein Formular')) throw new Error('datenschutz.html: das Formular geht live, der Satz "hat kein Formular" steht aber noch da');
  const fehlt = [['Brevo', /Brevo/], ['Cloudflare', /Cloudflare/], ['Double-Opt-In', /Double-Opt-In/], ['Einwilligung', /Art\. 6 Abs\. 1 lit\. a/]]
    .filter(([, m]) => !m.test(html)).map(([n]) => n);
  if (fehlt.length) throw new Error(`datenschutz.html: das Formular geht live, es fehlen aber: ${fehlt.join(', ')} - kein Bau`);
}

/**
 * Arbeitsnotizen ("Hier fehlt dein Teil") nur im Entwurf. Eigene Funktion,
 * damit sie sich einzeln pruefen laesst - durch bauen() ginge das nicht, weil
 * dort die anderen Korrekturen an einem Schnipsel scheitern wuerden.
 */
export function ohneNotizen(html, entwurf) {
  return entwurf ? html : html.replace(/\s*<div class="offen">[\s\S]*?<\/div>\n?/g, '\n');
}

export function faviconEinsetzen(html) {
  if (html.includes('rel="icon"')) throw new Error('Die Vorlage bringt jetzt ein Favicon mit - diese Zeile gehoert weg');
  return html.replace('</head>', `${FAVICON}\n</head>`);
}

export function bauen(quelle, { entwurf }) {
  let html = fussOhneHigherplan(rechtVerlinken(faviconEinsetzen(quelle)));
  if (html.includes(`action="${PLATZHALTER}"`)) {
    const vorher = html;
    html = ohneKasten(html);
    if (html === vorher) throw new Error('Kasten mit Platzhalter-Formular nicht gefunden - nichts ersetzt, Bau abgebrochen');
    html = html.replace('/* ───────────── Warteliste ───────────── */', `/* Warteliste: noch kein Formular - eine Zeile statt des Kastens */\n${BALD_CSS}/* ───────────── Warteliste ───────────── */`);
  }
  html = ohneNotizen(html, entwurf);
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
    const mitFormular = !html.includes('<p class="bald">');
    for (const d of RECHTSSEITEN) {
      let recht = pruefeRechtsseite(d, readFileSync(new URL(`./recht/${d}`, import.meta.url), 'utf8'));
      if (d === 'datenschutz.html') {
        if (mitFormular) recht = recht.replace('<h2>Hosting bei Netlify</h2>', `${WARTELISTE_DSE}<h2>Hosting bei Netlify</h2>`);
        pruefeDseZumFormular(recht, mitFormular);
      }
      writeFileSync(new URL(`./dist/${d}`, import.meta.url), recht);
    }
    console.log(`Gebaut: dist/index.html (CONTEXT=${process.env.CONTEXT || '-'}, ${entwurfAus(process.env) ? 'mit' : 'ohne'} Arbeitsnotizen)`);
  } catch (f) {
    console.error(f.message);
    process.exit(1);
  }
}
