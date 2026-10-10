# opm — oneproject.me

Die Startseite ist **`opm.html`** (DGs Datei, unverändert). Netlify baut daraus
`dist/index.html` (`node bau.mjs`, siehe `netlify.toml`).

- **Warteliste:** Solange das Formular als Adresse den Platzhalter
  `__WARTELISTE_ENDPUNKT__` trägt, ersetzt der Bau den Kasten durch die Zeile
  „Die Warteliste öffnet in Kürze.“ Ein Formular mit Platzhalter-Adresse bricht
  den Bau ab. Anbindung an hp-anmeldung (Mandant `opm`) ist ein eigener Schritt.
- **„Hier fehlt dein Teil“** (Klasse `offen`) erscheint nur in Deploy-Previews,
  nie in der Produktion.
- **Kopffilm:** `medien/` wandert unverändert nach `dist/medien/`. Der Bau bricht
  ab, wenn die Seite eine Datei unter `/medien/` anfordert, die dort nicht liegt.
  Der Film läuft tonlos, in Schleife, ohne Bedienelemente; `medien/kopf.jpg` ist
  das Standbild und trägt allein, wenn der Besucher Bewegung abgeschaltet hat.
  Breit steht das Zeichen rechts neben der Zeile, schmal (unter 900px) bekommt es
  eigenen Raum unter dem Text — es berührt die Schlagzeile auf keiner Breite.
  Alles liegt im eigenen `dist/` — die Datenschutzerklärung sagt zu, dass keine
  Inhalte von fremden Servern nachgeladen werden.
- Prüfung: `npm test`.

## Offen: der Einwilligungstext im Formular

Das Formular der Vorlage trägt einen Einwilligungstext, der zu **keiner** der
beiden `opm`-Einwilligungen in `hp-anmeldung` passt — es ist der Text von
`dennisgoldhammer.me`:

```
Formular  : "Ja, ich möchte den Newsletter von Dennis Goldhammer erhalten. …"
opm[warteliste] : "Ja, trag mich auf die Warteliste für OPM — One Project Me. …"
opm[newsletter] : "Ja, ich will zusätzlich den Newsletter von Dennis Goldhammer. …"
```

Ginge das Formular so live, bekäme **jede** Anmeldung 409 und nichts würde
gespeichert. Es geht nicht live: der Kasten wird ausgeschnitten, solange
`__WARTELISTE_ENDPUNKT__` dasteht — im Bau 0 `<form>`, 0 `<input>`.

**Nicht durch `opm[warteliste]` ersetzt.** Vorher ist zu entscheiden, welcher
Zweck auf dieser Seite überhaupt gilt: Warteliste, Newsletter oder beide mit je
eigener Checkbox. Das entscheidet DG, zusammen mit dem Postfach
`opm@oneproject.me` (Stand 20.09.2026: existiert nicht, RCPT 550).

## Englisch unter /en/ (Gerüst seit 10.10.2026)

- `/en/` ist eine eigene Seite: `en/opm.html`, **erzeugt** aus `opm.html` und
  der Tabelle `werkzeug/uebersetzung.json` (`npm run englisch`). Dasselbe
  Werkzeug schreibt `docs/en-texte.md` (Deutsch | Englisch zum Gegenlesen).
  Ändert sich `opm.html`, meldet `npm run englisch` jede Stelle, die nicht mehr
  passt, und jeden deutschen Rest – nichts bleibt still deutsch.
- **Fließtexte sind Entwurf.** Die deutsche Seite wird noch überarbeitet; danach
  werden die englischen Texte neu gezogen. Oberfläche (Titel, Beschreibung,
  Knöpfe, Fuß, Umschalter) ist fertig.
- Der Bau setzt je Sprache ein (`bau.mjs`, `SPRACHEN`): hreflang, Umschalter
  DE / EN (Violett auf Schwarz, kein `<nav>`), auf Englisch den Hinweis, dass
  Impressum und Datenschutz deutsch sind. Ein Test hält das Gerüst beider
  Sprachen gleich (Abschnitte, Klassen, Links).
- **Spracherkennung:** `netlify/edge-functions/sprache.js`, nur auf `/`: ohne
  Cookie, kein Bot, Browser bevorzugt nicht Deutsch → 302 auf `/en/`. Der
  Umschalter `/sprache?zu=…` setzt `opm_lang` (1 Jahr), danach gilt nur das
  Cookie. Prüfen nur über den Deploy-Permalink.
- Muster und Begründungen: `HIGHERPlan/dennisgoldhammer`, `docs/zweisprachig-muster.md`.

### Für später: die Warteliste

Geht die OPM-Warteliste auf, läuft sie über **hp-anmeldung** (Mandant `opm`)
mit dem Feld `sprache` (`de`/`en`): das Formular auf `/en/` schickt
`sprache=en`, der Mandant bekommt `sprachen.en` mit eigenem englischen
Einwilligungstext und eigener Version. So wird sichtbar, wie viele englische
Interessenten es gibt (Brevo-Attribut `SPRACHE`). Formular und Erklärung gehen
in beiden Sprachen gemeinsam live – der Bau bricht sonst ab.
