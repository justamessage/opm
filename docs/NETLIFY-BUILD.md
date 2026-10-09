# Netlify: kein Produktions-Build bei reinen Doku-Änderungen

Seit 09.10.2026 steht in `netlify.toml` unter `[build]` eine `ignore`-Regel. Ein **Produktions-Deploy wird übersprungen**, wenn sich seit dem letzten gebauten Stand nur Doku geändert hat:

- `docs/**`
- `**/*.md`
- `**/*.mdx`

Jeder Produktions-Deploy kostet 15 Netlify-Credits, übersprungene kosten nichts.

**Immer gebaut wird bei:**
- Deploy-Previews und Branch-Deploys (gratis)
- erneutem Build desselben Commits: Env-Änderung, „Clear cache and deploy“, Build per API
- fehlgeschlagenem Vergleich, etwa wenn der letzte gebaute Commit fehlt

**Wichtig:** Keine .md-Datei gehört zur ausgelieferten Seite. Kommt einmal Markdown-Inhalt dazu, der auf die Seite soll (Blog, Buchtext und Ähnliches), muss sein Pfad in der Regel ausgenommen werden. Sonst geht eine Änderung daran nicht live.

Eine Doku-Änderung trotzdem sofort live bringen: Netlify → Deploys → „Trigger deploy“ → „Deploy site“. Ein erneuter Build desselben Commits wird nie übersprungen.
