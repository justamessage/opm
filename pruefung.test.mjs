/**
 * Die Startseite von oneproject.me gegen den Auftrag von DG (19.09.2026).
 *
 *   "Datei: opm.html (schicke ich mit) wird die neue Startseite"
 *   "Der Katalog der vier Programme fällt weg [...] LOoNATIC ist ab jetzt die
 *    Challenge INNERHALB von OPM, LEGACY kommt nicht vor."
 *   "Das Quiz auf oneproject.me fällt komplett weg, samt der Navigation
 *    "Programme" und "Test"." / ""© 2025" fällt weg."
 *   "Der Fuß enthält KEINEN Hinweis auf HIGHERPlan und keinen Claim, nur
 *    Impressum / Datenschutz / AGB. [...] Bitte nicht "wiederherstellen"."
 *   "FORMULAR — harte Bedingung: action="__WARTELISTE_ENDPUNKT__" ist ein
 *    Platzhalter. [...] Wenn das nicht vollständig läuft: Seite OHNE Formular
 *    deployen und den Kasten durch eine Zeile ersetzen, dass die Liste in Kürze
 *    öffnet. Ein Feld, das Adressen annimmt und verliert, deployen wir nicht."
 *   "Der gestrichelte Kasten "Hier fehlt dein Teil" (LOoNATIC-Zahlen) darf nie
 *    in Produktion erscheinen, gleiche Lösung wie auf der anderen Seite."
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { bauen, entwurfAus, PLATZHALTER, VERBOTEN_RECHT, pruefeRechtsseite, ohneKasten, ohneNotizen } from './bau.mjs';

const QUELLE = readFileSync(new URL('./opm.html', import.meta.url), 'utf8');
const sichtbar = (html) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const LIVE = bauen(QUELLE, { entwurf: false });
const VORSCHAU = bauen(QUELLE, { entwurf: true });

// DG 19.09.2026, zweite Fassung (opm-2.html): <link rel="icon"> als eingebettetes SVG.
// Einzige Aenderung daran, von DG angeordnet: "/agb: Es gibt aktuell keinen Vertrag und keinen
// Verkauf. Bitte den AGB-Link vorerst aus dem Fuß entfernen [...] Er kommt zurück, wenn die
// Mitgliedschaft kostenpflichtig wird."

test('Favicon: eingebettetes SVG, nur Mitternacht und OPM-Violett, kein externer Verweis', () => {
  const icon = LIVE.match(/<link rel="icon" href="data:image\/svg\+xml,([^"]+)">/);
  assert.ok(icon, 'Favicon im <head>');
  const svg = decodeURIComponent(icon[1]);
  assert.deepEqual([...new Set(svg.match(/#[0-9a-f]{6}/gi))].sort(), ['#0b0f16', '#9d4eff']);
  assert.doesNotMatch(svg, /href=|src=|url\(/);
});



test('Arbeitsnotizen gehen nie live - die Regel gilt weiter, auch ohne Notiz in der Vorlage', () => {
  // v2 bringt keine "Hier fehlt dein Teil"-Kaesten mehr mit. Die Regel bleibt:
  // waere eine da, duerfte sie nur im Deploy-Preview erscheinen.
  assert.doesNotMatch(QUELLE, /<div class="offen">/, 'die neue Vorlage hat keine');
  assert.doesNotMatch(LIVE, /class="offen"|Hier fehlt dein Teil/);
  for (const env of [{}, { CONTEXT: 'production' }, { CONTEXT: 'dev' }]) assert.equal(entwurfAus(env), false, JSON.stringify(env));
  for (const env of [{ CONTEXT: 'deploy-preview' }, { CONTEXT: 'branch-deploy' }]) assert.equal(entwurfAus(env), true, JSON.stringify(env));
  assert.match(readFileSync(new URL('./bau.mjs', import.meta.url), 'utf8'), /entwurf: entwurfAus\(process\.env\)/);
  // Gegenprobe an der Funktion selbst: mit Notiz greift der Schnitt.
  const probe = '<p>a</p><div class="offen">geheim</div><p>b</p>';
  assert.doesNotMatch(ohneNotizen(probe, false), /geheim/);
  assert.match(ohneNotizen(probe, true), /geheim/);
});

test('Kein LEGACY, kein ©, keine Navigation - die Ansagen vom 19.09.2026 gelten weiter', () => {
  // Was sich geaendert hat: die Seite HAT wieder ein Quiz und ein Skript, beides
  // gewollt (DG 20.09.2026). Der Programmkatalog bleibt weg.
  const t = sichtbar(LIVE);
  assert.doesNotMatch(t, /LEGACY|©/);
  assert.doesNotMatch(LIVE, /<nav\b/);
  assert.doesNotMatch(t, /\bProgramme\b/, 'kein Katalog');
});

test('Fuß: kein HIGHERPlan, kein Claim, kein AGB-Link - Ansage vom 19.09.2026', () => {
  // DG 20.09.2026: "Die Ansage vom 19.09. gilt weiter. Die Regel war in meiner
  // Vorlage nur nicht mitgenommen." Also nimmt der Bau sie wieder heraus.
  assert.match(QUELLE, /<span>HIGHERPlan GmbH<\/span>/, 'Positivkontrolle: die Vorlage hat den Hinweis');
  const fuss = LIVE.slice(LIVE.indexOf('<footer>'), LIVE.indexOf('</footer>') + 9);
  assert.equal(sichtbar(fuss), 'OPM / One Project Me Impressum Datenschutz');
  for (const p of ['/impressum', '/datenschutz']) assert.match(fuss, new RegExp(`href="${p}"`), p);
  assert.doesNotMatch(LIVE, /href="\/agb"/, 'kein Vertrag, kein Verkauf');
  assert.doesNotMatch(LIVE, /HIGHERPlan|höheren Plan|class="claim"/i);
});

test('Keine fremden Ressourcen: keine Schrift, kein Bild, kein Skript von anderen Servern', () => {
  assert.doesNotMatch(LIVE, /<(link|script|img|iframe)\b[^>]*(src|href)="https?:/i);
  assert.doesNotMatch(LIVE, /fonts\.googleapis|fonts\.gstatic|@import/);
});

// ---------------------------------------------------------------------------
// Rechtsseiten, DG 19.09.2026: "Betreiber [...] HIGHERPlan GmbH, für beide Seiten."
// (a) Impressum aus HIGHERPlan/oneproject site/impressum.html, "Die drei Platzhalter mit den
//     Werten füllen, die auf dennisgoldhammer.me live stehen: contact@higherplan.co, kein
//     Telefon. USt-IdNr.: NICHT als leeres Feld ausliefern [...] Zeile raus [...] Sonst nichts ändern."
// (b) Datenschutz "analog dennisgoldhammer.me: Netlify vollständig, inklusive Rechtsgrundlage
//     und Hinweis zur Übermittlung in die USA. Alles streichen, was die Seite nicht tut".
// HARTE REGEL: "Kein Deploy einer Seite, auf der "Entwurf", "AUSFUELLEN", "Platzhalter" oder
// "wird ergänzt" sichtbar oder im Quelltext steht. [...] für alle Rechtsseiten in beiden Repos."
// ---------------------------------------------------------------------------
const lies = (d) => readFileSync(new URL(`./recht/${d}`, import.meta.url), 'utf8');
const inhalt = (html) => sichtbar(html.slice(html.indexOf('<h1>'), html.indexOf('<div class="fuss">')));

test('Rechtsseiten: kein "Entwurf", "AUSFUELLEN", "Platzhalter", "wird ergänzt" - weder sichtbar noch im Quelltext', () => {
  for (const w of ['Entwurf', 'ENTWURF', '[AUSFUELLEN]', 'Platzhalter', 'data-platzhalter', 'wird ergänzt', 'werden ergänzt']) assert.match(w, VERBOTEN_RECHT, `Positivkontrolle: ${w}`);
  for (const d of ['impressum.html', 'datenschutz.html']) assert.doesNotMatch(lies(d), VERBOTEN_RECHT, d);
  assert.doesNotMatch(LIVE, VERBOTEN_RECHT, 'auch die ausgelieferte Startseite, samt Kommentaren');
  assert.throws(() => pruefeRechtsseite('impressum.html', '<p>E-Mail: [AUSFUELLEN]</p>'), /AUSFUELLEN/);
  assert.match(readFileSync(new URL('./bau.mjs', import.meta.url), 'utf8'), /pruefeRechtsseite\(d, readFileSync/, 'der Bau prüft jede Rechtsseite');
});

test('Impressum: HIGHERPlan GmbH, Text aus HIGHERPlan/oneproject - nur E-Mail gefüllt, Telefon und USt-Zeile raus', () => {
  assert.equal(inhalt(lies('impressum.html')), [
    'Impressum', 'Angaben gemäß § 5 DDG', 'HIGHERPlan GmbH Dorfstr. 43 39539 Havelberg',
    'Vertreten durch die Geschäftsführer', 'Dennis Goldhammer, Tarek Zeidan',
    'Kontakt', 'E-Mail: contact@higherplan.co', 'Registereintrag', 'Amtsgericht Stendal, HRB 37179',
  ].join(' '));
  assert.match(lies('impressum.html'), /<a href="mailto:contact@higherplan\.co">contact@higherplan\.co<\/a>/);
  assert.doesNotMatch(lies('impressum.html').replace(/<!--[\s\S]*?-->/g, ''), /Telefon|Umsatzsteuer|USt-Id/);
});

test('Datenschutz: Netlify vollständig wie auf dennisgoldhammer.me, nichts, was diese Seite nicht tut', () => {
  const t = inhalt(lies('datenschutz.html'));
  // woertlich aus dennisgoldhammer.me (vorlage/datenschutz.html, Stand 19.09.2026)
  for (const satz of [
    'Die Seite wird von Netlify, Inc., 101 2nd Street, San Francisco, CA 94105, USA ausgeliefert.',
    'Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes Interesse ist, die Seite sicher und zuverlässig bereitzustellen.',
    'Netlify speichert diese Zugriffsprotokolle nach eigener Angabe 30 Tage und löscht sie danach.',
    'mit Netlify besteht ein Vertrag über die Auftragsverarbeitung nach Art. 28 DSGVO. Die Daten können dabei in die USA übermittelt werden.',
    'Grundlage dafür ist der Angemessenheitsbeschluss der EU-Kommission zum EU-US Data Privacy Framework',
    'Standardvertragsklauseln der EU-Kommission vor (Art. 46 DSGVO)',
  ]) assert.ok(t.includes(satz), satz);
  for (const art of ['15', '16', '17', '18', '20', '21', '77']) assert.match(t, new RegExp(`Art\\. ${art} DSGVO`), art);
  assert.match(t, /Verantwortlicher HIGHERPlan GmbH Dorfstr\. 43 39539 Havelberg E-Mail: contact@higherplan\.co/);
  assert.doesNotMatch(t, /Warteliste|Newsletter|Checkbox|Double-Opt-In|Brevo|Sendinblue|Cloudflare|Google Workspace|YouTube/i);
  // Was sie ueber die Seite sagt, muss stimmen - und die Seite hat sich geaendert:
  // sie fuehrt jetzt ein Skript aus (der Test), hat aber weiter kein Formular.
  assert.match(t, /keine Cookies, hat kein Formular und bindet keine Analyse-/);
  assert.match(t, /Der Test läuft vollständig in deinem Browser/);
  assert.doesNotMatch(t, /führt kein Skript aus/, 'das waere jetzt falsch');
  assert.doesNotMatch(LIVE, /<form\b|document\.cookie|<a [^>]*href="https?:/i, 'kein Formular, kein Cookie, kein externer Link');
  assert.doesNotMatch(LIVE, /@font-face/, 'keine nachgeladene Schrift');
});

test('Fußlinks: Startseite und Rechtsseiten zeigen auf /impressum und /datenschutz, beide ausgeliefert', () => {
  const toml = readFileSync(new URL('./netlify.toml', import.meta.url), 'utf8');
  for (const p of ['impressum', 'datenschutz']) {
    assert.match(toml, new RegExp(`from = "/${p}"\\s*\\n\\s*to = "/${p}\\.html"\\s*\\n\\s*status = 200`), p);
    for (const html of [LIVE, lies('impressum.html'), lies('datenschutz.html')]) assert.match(html, new RegExp(`href="/${p}"`));
  }
  for (const html of [lies('impressum.html'), lies('datenschutz.html')]) {
    assert.doesNotMatch(html, /href="\/agb"|HIGHERPlan GmbH<span>|höheren Plan/);
    assert.match(html, /<link rel="icon" href="data:image\/svg\+xml,/, 'Favicon wie auf der Startseite - keine 404 für /favicon.ico');
  }
});
