/**
 * Die Edge Function netlify/edge-functions/sprache.js - gefahren wird die
 * Einsprungstelle selbst (default export mit Request und Kontext), nicht nur
 * die Hilfsfunktionen darunter.
 *
 * Auftrag DG, 10.10.2026 (oneproject.me, wie dennisgoldhammer.me vom 09.10.2026):
 *   "Nur auf "/" (Startseite) aktiv, nicht auf Unterseiten oder Deep Links.
 *    Accept-Language auswerten: beginnt die bevorzugte Sprache mit "de" →
 *    bleibt auf DE. Alles andere → 302 auf /en/.
 *    Klick auf den Umschalter setzt ein Cookie (z. B. opm_lang=de|en, 1 Jahr).
 *    Ist das Cookie gesetzt, wird NIE automatisch umgeleitet – die manuelle
 *    Wahl gewinnt immer.
 *    Bots/Crawler nicht umleiten.
 *    Cache: Vary auf Cookie/Accept-Language beachten."
 *
 * Auslegung (Vorschlag Claude, nicht von DG): Mit Cookie wird nie mehr nach
 * Accept-Language entschieden. Steht es auf "en", fuehrt "/" auf /en/ - das
 * ist die Seite, die der Mensch selbst gewaehlt hat.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sprache, { config, bevorzugt, cookieWert, BOT, ZIELE } from './netlify/edge-functions/sprache.js';

const SEITE = 'https://oneproject.me';
const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/** Ruft die Einsprungstelle wie Netlify: Request + Kontext mit next(). */
async function rufe(pfad, { sprache: al, cookie, ua = CHROME } = {}) {
  const kopf = { 'user-agent': ua };
  if (al !== undefined) kopf['accept-language'] = al;
  if (cookie) kopf.cookie = cookie;
  let weiter = 0;
  const context = {
    next: async () => {
      weiter += 1;
      return new Response('<html lang="de">deutsche Seite</html>', { status: 200, headers: { 'content-type': 'text/html', 'cache-control': 'public, max-age=0, must-revalidate' } });
    },
  };
  const antwort = await sprache(new Request(`${SEITE}${pfad}`, { headers: kopf }), context);
  return { antwort, weiter, ziel: antwort.headers.get('location') };
}

test('Nur "/" und der Umschalter "/sprache" - keine Unterseite, kein Deep Link', () => {
  assert.deepEqual(config.path, ['/', '/sprache']);
});

test('en-US ohne Cookie auf "/" -> 302 auf /en/', async () => {
  const { antwort, ziel, weiter } = await rufe('/', { sprache: 'en-US,en;q=0.9' });
  assert.equal(antwort.status, 302);
  assert.equal(ziel, `${SEITE}/en/`);
  assert.equal(weiter, 0, 'die deutsche Seite wird gar nicht erst geholt');
});

test('de-DE -> bleibt auf Deutsch (die Seite selbst, kein 302)', async () => {
  for (const al of ['de-DE,de;q=0.9,en;q=0.8', 'de', 'de-AT', 'de-CH,en;q=0.5', 'DE-de']) {
    const { antwort, weiter } = await rufe('/', { sprache: al });
    assert.equal(antwort.status, 200, al);
    assert.equal(weiter, 1, al);
    assert.match(await antwort.text(), /deutsche Seite/, al);
  }
});

test('Alles andere -> /en/: Französisch, Englisch zuerst und Deutsch danach, Niederländisch', async () => {
  for (const al of ['fr-FR,fr;q=0.9', 'en-GB,de;q=0.8', 'nl', 'es-ES', 'de;q=0.5,en;q=0.9']) {
    assert.equal((await rufe('/', { sprache: al })).antwort.status, 302, al);
  }
});

test('Ohne Accept-Language (oder nur *) gibt es keine Vorliebe -> Standard Deutsch', async () => {
  assert.equal((await rufe('/')).antwort.status, 200);
  assert.equal((await rufe('/', { sprache: '*' })).antwort.status, 200);
  assert.equal((await rufe('/', { sprache: '' })).antwort.status, 200);
});

test('Umschalter auf DE bei englischem Gerät: Cookie opm_lang=de, 1 Jahr - danach bleibt "/" deutsch', async () => {
  const klick = await rufe('/sprache?zu=/', { sprache: 'en-US' });
  assert.equal(klick.antwort.status, 302);
  assert.equal(klick.ziel, `${SEITE}/`);
  const setzen = klick.antwort.headers.get('set-cookie');
  assert.match(setzen, /^opm_lang=de; /);
  assert.match(setzen, /Max-Age=31536000/);
  assert.match(setzen, /Path=\//);
  assert.match(setzen, /SameSite=Lax/);
  assert.match(setzen, /Secure/);
  assert.match(setzen, /HttpOnly/, 'kein Skript liest es - "Deine Antworten bleiben auf deinem Gerät" bleibt wahr');

  // Erneuter Aufruf mit dem Cookie - Gerät weiter englisch.
  const wieder = await rufe('/', { sprache: 'en-US,en;q=0.9', cookie: 'opm_lang=de' });
  assert.equal(wieder.antwort.status, 200);
  assert.equal(wieder.weiter, 1);
});

test('Umschalter auf EN bei deutschem Gerät: Cookie opm_lang=en - "/" führt danach auf /en/', async () => {
  const klick = await rufe('/sprache?zu=/en/', { sprache: 'de-DE' });
  assert.equal(klick.ziel, `${SEITE}/en/`);
  assert.match(klick.antwort.headers.get('set-cookie'), /^opm_lang=en; /);
  const wieder = await rufe('/', { sprache: 'de-DE', cookie: 'andere=1; opm_lang=en' });
  assert.equal(wieder.antwort.status, 302);
  assert.equal(wieder.ziel, `${SEITE}/en/`);
});

test('Ein unbrauchbares Cookie zählt nicht als Wahl', async () => {
  assert.equal((await rufe('/', { sprache: 'en-US', cookie: 'opm_lang=fr' })).antwort.status, 302);
  assert.equal((await rufe('/', { sprache: 'de-DE', cookie: 'opm_lang=' })).antwort.status, 200);
});

test('Der Umschalter ist keine offene Weiterleitung: nur bekannte Seiten, sonst "/" ohne Cookie', async () => {
  for (const zu of ['https://boese.test/', '//boese.test', '/en/../../x', '/irgendwas', '', null]) {
    const { antwort, ziel } = await rufe(zu === null ? '/sprache' : `/sprache?zu=${encodeURIComponent(zu)}`);
    assert.equal(antwort.status, 302, String(zu));
    assert.equal(ziel, `${SEITE}/`, String(zu));
    assert.equal(antwort.headers.get('set-cookie'), null, String(zu));
  }
  // Gegenprobe: jedes bekannte Ziel geht durch.
  for (const zu of Object.keys(ZIELE)) assert.equal((await rufe(`/sprache?zu=${zu}`)).ziel, `${SEITE}${zu}`, zu);
});

test('Bots und Link-Vorschauen werden nie umgeleitet', async () => {
  const bots = [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'WhatsApp/2.23.20.0',
    'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
    'Twitterbot/1.0',
    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    'Mozilla/5.0 (compatible; YandexBot/3.0)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Applebot/0.1)',
    'DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)',
  ];
  for (const ua of bots) {
    assert.ok(BOT.test(ua), ua);
    assert.equal((await rufe('/', { sprache: 'en-US', ua })).antwort.status, 200, ua);
  }
  // Gegenprobe: Browser und Prüfwerkzeuge sind keine Bots.
  for (const ua of [CHROME, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', 'curl/8.7.1', 'HeadlessChrome/130']) {
    assert.equal(BOT.test(ua), false, ua);
  }
});

test('Cache: jede Antwort sagt Vary Accept-Language, Cookie und wird nicht geteilt zwischengespeichert', async () => {
  const faelle = [
    await rufe('/', { sprache: 'en-US' }),
    await rufe('/', { sprache: 'de-DE' }),
    await rufe('/', { sprache: 'de-DE', cookie: 'opm_lang=en' }),
    await rufe('/sprache?zu=/'),
  ];
  for (const { antwort } of faelle) {
    assert.equal(antwort.headers.get('vary'), 'Accept-Language, Cookie');
    assert.match(antwort.headers.get('cache-control'), /^private, no-(store|cache)$/);
  }
});

test('Accept-Language lesen: höchster q-Wert gewinnt, bei Gleichstand der erste', () => {
  assert.equal(bevorzugt('de-DE,de;q=0.9,en;q=0.8'), 'de-de');
  assert.equal(bevorzugt('en;q=0.5, de;q=0.9'), 'de');
  assert.equal(bevorzugt('fr, de'), 'fr');
  assert.equal(bevorzugt('de;q=0, en'), 'en', 'q=0 heisst: nicht gewollt');
  assert.equal(bevorzugt(''), null);
  assert.equal(bevorzugt(null), null);
  assert.equal(bevorzugt('*'), null);
});

test('Cookie lesen: genau der Name, nicht ein ähnlicher', () => {
  assert.equal(cookieWert('a=1; opm_lang=en; b=2'), 'en');
  assert.equal(cookieWert('xopm_lang=en'), null);
  assert.equal(cookieWert(''), null);
});
