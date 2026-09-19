# opm — oneproject.me

Die Startseite ist **`opm.html`** (DGs Datei, unverändert). Netlify baut daraus
`dist/index.html` (`node bau.mjs`, siehe `netlify.toml`).

- **Warteliste:** Solange das Formular als Adresse den Platzhalter
  `__WARTELISTE_ENDPUNKT__` trägt, ersetzt der Bau den Kasten durch die Zeile
  „Die Warteliste öffnet in Kürze.“ Ein Formular mit Platzhalter-Adresse bricht
  den Bau ab. Anbindung an hp-anmeldung (Mandant `opm`) ist ein eigener Schritt.
- **„Hier fehlt dein Teil“** (Klasse `offen`) erscheint nur in Deploy-Previews,
  nie in der Produktion.
- Prüfung: `npm test`.
