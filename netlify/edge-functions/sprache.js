/**
 * Spracherkennung und Umschalter fuer oneproject.me (Auftrag DG 10.10.2026).
 * Uebernommen von dennisgoldhammer.me (HIGHERPlan/dennisgoldhammer,
 * docs/zweisprachig-muster.md) - eigener Cookie-Name je Domain: opm_lang.
 *
 * "/"        Startseite. Wer kein Cookie opm_lang hat, kein Bot ist und dessen
 *            bevorzugte Sprache nicht mit "de" beginnt, bekommt ein 302 auf
 *            /en/. Alles andere bleibt auf der deutschen Seite. Mit Cookie
 *            gilt nur noch das Cookie: de bleibt, en fuehrt auf /en/.
 * "/sprache" Der Umschalter DE / EN. Setzt opm_lang (ein Jahr) und leitet auf
 *            die Seite in der gewaehlten Sprache weiter. Danach wird nie mehr
 *            automatisch umgeleitet - die manuelle Wahl gewinnt immer.
 *
 * Nur diese beiden Adressen. Unterseiten und Deep Links laufen nie hier durch
 * (config.path unten) und werden nie umgeleitet.
 *
 * Caching: jede Antwort dieser Funktion haengt an Accept-Language und Cookie.
 * Sie traegt deshalb "Vary: Accept-Language, Cookie" und wird nicht
 * zwischengespeichert (no-store). Sonst koennte ein Cache die Sprache des
 * einen Besuchers dem naechsten ausliefern.
 *
 * Nur Web-Standard (Request, Response, URL) - laeuft in Netlify (Deno) und in
 * den Tests unter node (pruefung-sprache.test.mjs).
 */

export const COOKIE = 'opm_lang';
const EIN_JAHR = 60 * 60 * 24 * 365;

/** Wohin der Umschalter fuehren darf - die Seiten aus bau.mjs (SPRACHEN) und die Rechtsseiten. */
export const ZIELE = {
  '/': 'de',
  '/impressum': 'de',
  '/datenschutz': 'de',
  '/en/': 'en',
};

/**
 * Bots und Vorschau-Abrufe werden nie umgeleitet: Suchmaschinen sollen / und
 * /en/ getrennt sehen (hreflang erledigt den Rest), Link-Vorschauen die Seite,
 * die verlinkt wurde. Bewusst NICHT dabei: curl, wget, HeadlessChrome - damit
 * laesst sich die Umleitung pruefen.
 */
export const BOT = /bot\b|bot\/|crawl|spider|slurp|mediapartners|facebookexternalhit|facebookcatalog|embedly|quora link preview|outbrain|pinterest|vkshare|w3c_validator|whatsapp|telegram|skypeuripreview|bingpreview|lighthouse|pagespeed|chrome-lighthouse|google-inspectiontool|petalbot|yandex|baiduspider|duckduckgo|applebot|ia_archiver|archive\.org/i;

/** Liest ein Cookie aus dem Cookie-Kopf. */
export function cookieWert(kopf, name = COOKIE) {
  for (const teil of String(kopf || '').split(';')) {
    const [k, ...v] = teil.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

/**
 * Die bevorzugte Sprache aus Accept-Language: der Eintrag mit dem hoechsten
 * q-Wert, bei Gleichstand der erste. Fehlt der Kopf (oder steht nur "*" da),
 * gibt es keine Vorliebe - dann bleibt es beim Standard Deutsch.
 */
export function bevorzugt(kopf) {
  const eintraege = String(kopf || '').split(',').map((roh, i) => {
    const [tag, ...params] = roh.trim().split(';');
    const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
    const wert = q ? Number(q.slice(2)) : 1;
    return { tag: tag.trim().toLowerCase(), q: Number.isFinite(wert) ? wert : 0, i };
  }).filter((e) => e.tag && e.tag !== '*' && e.q > 0);
  if (!eintraege.length) return null;
  eintraege.sort((a, b) => b.q - a.q || a.i - b.i);
  return eintraege[0].tag;
}

const KOPF = { 'cache-control': 'private, no-store', vary: 'Accept-Language, Cookie' };

function weiter(ziel, url, extra = {}) {
  return new Response(null, { status: 302, headers: { location: new URL(ziel, url).href, ...KOPF, ...extra } });
}

/** Die Entscheidung fuer "/" - ohne Netlify, damit sie sich pruefen laesst. */
export function entscheide(request) {
  const url = new URL(request.url);

  if (url.pathname === '/sprache') {
    const zu = url.searchParams.get('zu');
    // Nur bekannte Seiten - sonst waere /sprache eine offene Weiterleitung.
    const sprache = Object.hasOwn(ZIELE, zu) ? ZIELE[zu] : null;
    if (!sprache) return weiter('/', url);
    return weiter(zu, url, {
      'set-cookie': `${COOKIE}=${sprache}; Path=/; Max-Age=${EIN_JAHR}; SameSite=Lax; Secure; HttpOnly`,
    });
  }

  if (url.pathname !== '/') return null;
  const wahl = cookieWert(request.headers.get('cookie'));
  // Die manuelle Wahl gewinnt immer: mit Cookie wird nie mehr nach
  // Accept-Language entschieden. "de" bleibt hier, "en" fuehrt auf die Seite,
  // die der Mensch selbst gewaehlt hat.
  if (wahl === 'de') return null;
  if (wahl === 'en') return weiter('/en/', url);
  if (BOT.test(request.headers.get('user-agent') || '')) return null;
  const sprache = bevorzugt(request.headers.get('accept-language'));
  if (sprache === null || sprache === 'de' || sprache.startsWith('de-')) return null;
  return weiter('/en/', url);
}

export default async function sprache(request, context) {
  const antwort = entscheide(request);
  if (antwort) return antwort;
  // Die deutsche Startseite selbst haengt ebenfalls an beiden Koepfen.
  const seite = await context.next();
  const neu = new Response(seite.body, seite);
  neu.headers.set('vary', 'Accept-Language, Cookie');
  neu.headers.set('cache-control', 'private, no-cache');
  return neu;
}

export const config = { path: ['/', '/sprache'] };
