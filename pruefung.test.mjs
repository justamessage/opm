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
import { bauen, entwurfAus, PLATZHALTER, VERBOTEN_RECHT, pruefeRechtsseite } from './bau.mjs';

const QUELLE = readFileSync(new URL('./opm.html', import.meta.url), 'utf8');
const sichtbar = (html) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const LIVE = bauen(QUELLE, { entwurf: false });
const VORSCHAU = bauen(QUELLE, { entwurf: true });

// DG 19.09.2026, zweite Fassung (opm-2.html): <link rel="icon"> als eingebettetes SVG.
// Einzige Aenderung daran, von DG angeordnet: "/agb: Es gibt aktuell keinen Vertrag und keinen
// Verkauf. Bitte den AGB-Link vorerst aus dem Fuß entfernen [...] Er kommt zurück, wenn die
// Mitgliedschaft kostenpflichtig wird."
test('Quelle ist DGs opm.html (Fassung mit Favicon), nur der AGB-Link ist raus', () => {
  const fussStelle = '<span>/</span><a href="/datenschutz">Datenschutz</a></p>'; // im Fuß, nicht im Kasten
  assert.equal(QUELLE.split(fussStelle).length, 2, 'genau eine Fuß-Stelle');
  const ohneAgb = QUELLE.replace(fussStelle, '<span>/</span><a href="/datenschutz">Datenschutz</a><span>/</span><a href="/agb">AGB</a></p>');
  assert.equal(createHash('sha256').update(ohneAgb).digest('hex').slice(0, 20), 'aa442100ba46587bb8e3');
  assert.doesNotMatch(QUELLE, /href="\/agb"/);
});

test('Favicon: eingebettetes SVG, nur Mitternacht und OPM-Violett, kein externer Verweis', () => {
  const icon = LIVE.match(/<link rel="icon" href="data:image\/svg\+xml,([^"]+)">/);
  assert.ok(icon, 'Favicon im <head>');
  const svg = decodeURIComponent(icon[1]);
  assert.deepEqual([...new Set(svg.match(/#[0-9a-f]{6}/gi))].sort(), ['#0b0f16', '#9d4eff']);
  assert.doesNotMatch(svg, /href=|src=|url\(/);
});

test('Formular mit Platzhalter geht nie live: Kasten wird zur Zeile "Liste öffnet in Kürze"', () => {
  assert.ok(QUELLE.includes(`action="${PLATZHALTER}"`), 'Positivkontrolle: die Quelle hat noch den Platzhalter');
  for (const html of [LIVE, VORSCHAU]) {
    assert.doesNotMatch(html, /<form\b|<input\b|type="email"|__WARTELISTE_ENDPUNKT__/);
    assert.doesNotMatch(html, /class="liste-kasten/);
    assert.match(html, /<p class="bald auf d3">Die Warteliste öffnet in Kürze\.<\/p>/);
  }
  // Nichts, was eine Anmeldung verspricht, die es nicht gibt.
  assert.doesNotMatch(sichtbar(LIVE), /Trag dich auf die Liste|Auf die Liste|Abmelden jederzeit/);
});

test('Ein Formular mit Platzhalter-Adresse bricht den Bau ab, falls es doch durchrutscht', () => {
  const kaputt = QUELLE.replace(/<div class="liste-kasten[\s\S]*?<\/form>/, '<form action="__WARTELISTE_ENDPUNKT__">');
  assert.throws(() => bauen(kaputt, { entwurf: false }), /Platzhalter/);
});

test('"Hier fehlt dein Teil" (LOoNATIC-Zahlen) nur im Deploy-Preview, nie in der Produktion', () => {
  assert.match(QUELLE, /<div class="offen">/, 'Positivkontrolle: die Quelle hat die Notiz');
  assert.doesNotMatch(LIVE, /class="offen"|Hier fehlt dein Teil|33 Tage/);
  assert.match(VORSCHAU, /Hier fehlt dein Teil/);
  for (const env of [{}, { CONTEXT: 'production' }, { CONTEXT: 'dev' }]) assert.equal(entwurfAus(env), false, JSON.stringify(env));
  for (const env of [{ CONTEXT: 'deploy-preview' }, { CONTEXT: 'branch-deploy' }]) assert.equal(entwurfAus(env), true, JSON.stringify(env));
  assert.match(readFileSync(new URL('./bau.mjs', import.meta.url), 'utf8'), /entwurf: entwurfAus\(process\.env\)/);
});

test('Kein Programmkatalog, kein Quiz, keine Navigation "Programme"/"Test", kein LEGACY, kein ©', () => {
  const t = sichtbar(LIVE);
  assert.doesNotMatch(t, /LEGACY|©|Programme\b|\bTest\b|Quiz|AMFEEL|CNC/);
  assert.doesNotMatch(LIVE, /<nav\b|<script\b/);
  assert.match(t, /LOoNATIC ist die Challenge in OPM/);
});

test('Fuß: nur Impressum / Datenschutz - kein AGB-Link, kein HIGHERPlan, kein Claim', () => {
  const fuss = LIVE.slice(LIVE.indexOf('<div class="fuss">'));
  assert.equal(sichtbar(fuss.replace(/<span>\/<\/span>/g, ' / ')), 'Impressum / Datenschutz');
  for (const p of ['/impressum', '/datenschutz']) assert.match(fuss, new RegExp(`href="${p}"`));
  assert.doesNotMatch(LIVE, /href="\/agb"/, 'AGB-Link vorerst raus (kein Vertrag, kein Verkauf)');
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
  assert.doesNotMatch(t, /Warteliste|Newsletter|Checkbox|Double-Opt-In|Brevo|Sendinblue|Cloudflare|Google Workspace|Quiz|YouTube|Einwilligung/i);
  // Was sie ueber die Seite sagt, muss stimmen.
  assert.match(t, /keine Cookies, hat kein Formular, führt kein Skript aus/);
  assert.doesNotMatch(LIVE, /<script\b|<form\b|document\.cookie|<a [^>]*href="https?:/i, 'Startseite: kein Skript, kein Formular, keine externen Links');
  assert.doesNotMatch(LIVE, /@font-face|url\(/, 'Startseite lädt keine Schriften');
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
