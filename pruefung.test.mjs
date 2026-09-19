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
import { bauen, entwurfAus, PLATZHALTER } from './bau.mjs';

const QUELLE = readFileSync(new URL('./opm.html', import.meta.url), 'utf8');
const sichtbar = (html) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const LIVE = bauen(QUELLE, { entwurf: false });
const VORSCHAU = bauen(QUELLE, { entwurf: true });

test('Quelle ist DGs opm.html, unverändert', () => {
  assert.equal(createHash('sha256').update(readFileSync(new URL('./opm.html', import.meta.url))).digest('hex').slice(0, 20), '79a6eff74d2f48bd2767');
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

test('Fuß: nur Impressum / Datenschutz / AGB - kein HIGHERPlan, kein Claim', () => {
  const fuss = LIVE.slice(LIVE.indexOf('<div class="fuss">'));
  assert.equal(sichtbar(fuss.replace(/<span>\/<\/span>/g, ' / ')), 'Impressum / Datenschutz / AGB');
  for (const p of ['/impressum', '/datenschutz', '/agb']) assert.match(fuss, new RegExp(`href="${p}"`));
  assert.doesNotMatch(LIVE, /HIGHERPlan|höheren Plan|class="claim"/i);
});

test('Keine fremden Ressourcen: keine Schrift, kein Bild, kein Skript von anderen Servern', () => {
  assert.doesNotMatch(LIVE, /<(link|script|img|iframe)\b[^>]*(src|href)="https?:/i);
  assert.doesNotMatch(LIVE, /fonts\.googleapis|fonts\.gstatic|@import/);
});
