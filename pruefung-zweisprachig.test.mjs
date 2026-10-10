/**
 * oneproject.me zweisprachig - das Geruest (Auftrag DG, 10.10.2026).
 *
 *   "1. Struktur: /en/ als eigene Seite, hreflang (de, en, x-default → de),
 *    <html lang> korrekt.
 *    3. Umschalter DE/EN im OPM-Design (Violett auf Schwarz #0a0a0a).
 *    4. Englische Oberfläche jetzt schon: Navigation, Buttons, Umschalter,
 *    Footer, Seitentitel/Meta-Description. Fließtexte auf /en/ vorerst als
 *    englischer Entwurf, gesammelt in docs/en-texte.md (Deutsch | Englisch).
 *    5. Gleichlauf-Test DE/EN für Links und Abschnitte.
 *    7. Rechtstexte: Impressum/Datenschutz bleiben deutsch, /en/ verweist
 *    darauf [...]. Falls die Datenschutzerklärung bisher „keine Cookies" sagt:
 *    anpassen um den Abschnitt zum Sprach-Cookie."
 *
 * Abweichung, festgehalten: der Umschalter ist kein <nav>. Die Seite hat
 * keine Navigation (DG 19.09.2026, pruefung.test.mjs) - das hier ist nur die
 * Wahl der Sprache, als Gruppe ausgezeichnet.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bauen, hreflang, BASIS, SPRACHEN } from './bau.mjs';
import { englisch, doku, texte, DEUTSCH } from './werkzeug/englisch.mjs';
import { ZIELE } from './netlify/edge-functions/sprache.js';

const lies = (p) => readFileSync(new URL(`./${p}`, import.meta.url), 'utf8');
const QUELLE = lies('opm.html');
const QUELLE_EN = lies('en/opm.html');
const TABELLE = JSON.parse(lies('werkzeug/uebersetzung.json'));
const DE = bauen(QUELLE, { entwurf: false });
const EN = bauen(QUELLE_EN, { entwurf: false, sprache: 'en' });
const sichtbar = (html) => html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** Das Geruest einer Seite: jedes Element mit Tag, id, class, href - ohne Text. */
const geruest = (html) => [...html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '')
  .matchAll(/<([a-z0-9]+)\b([^>]*)>/g)]
  .map(([, tag, attr]) => [tag, ...['id', 'class', 'href', 'src', 'action', 'type'].map((a) => (attr.match(new RegExp(`\\b${a}="([^"]*)"`)) || [])[1] || '')].join('|'));

test('/en/ ist eine eigene Seite aus en/opm.html - erzeugt aus opm.html, nichts von Hand', () => {
  assert.equal(englisch(QUELLE, TABELLE), QUELLE_EN, 'en/opm.html ist veraltet - npm run englisch');
  assert.equal(doku(TABELLE), lies('docs/en-texte.md'), 'docs/en-texte.md ist veraltet - npm run englisch');
});

test('<html lang>, Titel und Beschreibung je Sprache', () => {
  assert.match(DE, /<html lang="de">/);
  assert.match(EN, /<html lang="en">/);
  assert.match(EN, /<title>Project of your life<\/title>/);
  assert.match(EN, /<meta name="description" content="OPM — personal development that is not the same for everyone\.">/);
  assert.match(DE, /<title>Projekt deines Lebens<\/title>/);
});

test('hreflang: de, en, x-default -> deutsch; Rechtsseiten nur de und x-default', () => {
  const alt = (h) => [...h.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map((m) => `${m[1]} ${m[2]}`);
  const soll = [`de ${BASIS}/`, `en ${BASIS}/en/`, `x-default ${BASIS}/`];
  assert.deepEqual(alt(DE), soll);
  assert.deepEqual(alt(EN), soll);
  assert.equal(hreflang('/impressum', null), `<link rel="alternate" hreflang="de" href="${BASIS}/impressum">\n<link rel="alternate" hreflang="x-default" href="${BASIS}/impressum">`);
});

test('Umschalter DE / EN: normale Links auf /sprache, aktive Sprache markiert, Violett auf Schwarz, kein <nav>', () => {
  for (const [html, aktiv, label] of [[DE, 'de', 'Sprache'], [EN, 'en', 'Language']]) {
    const w = html.match(/<div class="sprachwahl"[\s\S]*?<\/div>/)[0];
    assert.match(w, new RegExp(`role="group" aria-label="${label}"`));
    assert.match(w, new RegExp(`<a href="/sprache\\?zu=/" lang="de" hreflang="de"${aktiv === 'de' ? ' aria-current="page"' : ''}>DE</a>`));
    assert.match(w, new RegExp(`<a href="/sprache\\?zu=/en/" lang="en" hreflang="en"${aktiv === 'en' ? ' aria-current="page"' : ''}>EN</a>`));
    assert.doesNotMatch(html, /<nav\b/);
    assert.match(html, /\.sprachwahl\{[^}]*background:#0a0a0a/);
    assert.match(html, /\.sprachwahl a\[aria-current\]\{color:var\(--haus\);\}/);
  }
  // Jedes Ziel des Umschalters kennt die Edge Function.
  for (const s of Object.values(SPRACHEN)) assert.ok(s.pfad in ZIELE, s.pfad);
});

test('Oberfläche englisch: Knöpfe, Fuß, Warteliste-Zeile - kein deutscher Rest im sichtbaren Text und in den Skripttexten', () => {
  const t = sichtbar(EN);
  for (const w of ['Read on', 'Answer again', 'Legal notice', 'Privacy policy', 'The waiting list opens soon.', 'Question 01 of 09']) assert.ok(t.includes(w), w);
  const reste = texte(EN).filter((x) => DEUTSCH.test(x) && !/Gebaut|Arbeitsnotiz/.test(x));
  assert.deepEqual(reste, []);
  // Gegenprobe: die deutsche Seite schlaegt an.
  assert.ok(texte(DE).some((x) => DEUTSCH.test(x)));
});

test('Gleichlauf DE/EN: dasselbe Gerüst - Abschnitte, Klassen, Links; nur der Link auf dennisgoldhammer.me zeigt auf /en/', () => {
  const de = geruest(DE);
  // Gewollte Unterschiede: der Deep Link auf dennisgoldhammer.me/en/ und die
  // Zeile zu den deutschen Rechtstexten (nur englisch).
  const en = geruest(EN).map((z) => z.replace('https://dennisgoldhammer.me/en/', 'https://dennisgoldhammer.me'))
    .filter((z) => !z.startsWith('p||recht-hinweis'));
  assert.ok(de.length > 200, `Positivkontrolle: ${de.length} Elemente`);
  assert.deepEqual(en, de);
  const abschnitte = (h) => [...h.matchAll(/<section id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(abschnitte(EN), abschnitte(DE));
  assert.ok(abschnitte(DE).length >= 10);
  assert.match(EN, /<a class="wer-link" href="https:\/\/dennisgoldhammer\.me\/en\/" rel="noopener">/, 'Deep Link in die englische Fassung');
});

test('Rechtstexte bleiben deutsch - /en/ verlinkt sie mit Hinweis', () => {
  const fuss = EN.slice(EN.indexOf('<footer>'), EN.indexOf('</footer>'));
  assert.match(fuss, /<a href="\/impressum">Legal notice<\/a>/);
  assert.match(fuss, /<a href="\/datenschutz">Privacy policy<\/a>/);
  assert.match(fuss, /<p class="recht-hinweis">Legal notice and privacy policy are provided in German \(legally binding version\)\.<\/p>/);
  assert.doesNotMatch(DE, /recht-hinweis">/);
});

test('Datenschutz: Abschnitt "Sprache" zum Cookie opm_lang - der Satz "keine Cookies" ist weg', () => {
  const t = sichtbar(lies('recht/datenschutz.html'));
  assert.doesNotMatch(t, /setzt keine Cookies/);
  assert.match(t, /Sie setzt nur dann ein Cookie, wenn du selbst die Sprache umschaltest/);
  assert.match(t, /ein Cookie namens „opm_lang“\. Es enthält nur „de“ oder „en“, gilt ein Jahr/);
  assert.match(t, /§ 25 Abs\. 2 Nr\. 2 TDDDG/);
  assert.match(t, /hat kein Formular/, 'der Riegel zum Formular gilt weiter');
});

test('Warteliste: deutsch und englisch gemeinsam - heute beide nur die Zeile, kein Formular', () => {
  assert.match(DE, /<p class="bald">Die Warteliste öffnet in Kürze\.<\/p>/);
  assert.match(EN, /<p class="bald">The waiting list opens soon\.<\/p>/);
  for (const h of [DE, EN]) assert.doesNotMatch(h, /<form\b/);
});
