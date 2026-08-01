# InsightSnap

*[English version](README.md)*

Chrome/Edge-Erweiterung, die YouTube-Videos zusammenfasst: Transkript ziehen, an ein
LLM deiner Wahl schicken, Ergebnis direkt auf der Videoseite anzeigen.

Auf jeder YouTube-Watch-Seite erscheint neben „Teilen"/„Speichern" ein Button
**✨ InsightSnap**. Klick darauf → Dialog mit der Analyse.

Die Oberfläche der Erweiterung ist englisch.

<!-- Screenshot unter docs/screenshot.png ablegen und die nächste Zeile einkommentieren.
![InsightSnap-Dialog auf einer YouTube-Watch-Seite](docs/screenshot.png)
-->

## Installation (ohne Bauen)

1. ZIP der aktuellen Version herunterladen: [Releases](../../releases) →
   `insightsnap-<version>.zip`
2. ZIP entpacken (Ordner an einen dauerhaften Ort legen — Chrome lädt die Extension
   bei jedem Start von dort).
3. `chrome://extensions` öffnen (Edge: `edge://extensions`).
4. Oben rechts **Entwicklermodus** einschalten.
5. **Entpackte Erweiterung laden** → den entpackten Ordner auswählen.

Zum Aktualisieren: neues ZIP entpacken, alten Ordner ersetzen, in
`chrome://extensions` auf **⟳ Neu laden** klicken. Offene YouTube-Tabs danach mit
F5 neu laden.

## Einrichten

Auf das Extension-Icon klicken (oder im Dialog auf ⚙) → Optionsseite.

| Feld | Bedeutung |
|------|-----------|
| **Provider** | Anthropic Claude, OpenAI, Google Gemini oder OpenAI-kompatibel |
| **Model** | Dropdown, das die verfügbaren Modelle beim Provider abfragt, sobald ein API-Key eingetragen ist. Lädt der Provider keine Liste, wird daraus ein Freitextfeld. |
| **API key** | Wird nur lokal in `chrome.storage.local` gespeichert |
| **Base URL** | Nur bei „OpenAI-compatible", z.B. `https://api.example.com/v1` |
| **Prompt** | Systemprompt für die Analyse, per Button auf den Default zurücksetzbar |

**Save** nicht vergessen.

API-Keys gibt es bei
[Anthropic](https://console.anthropic.com/settings/keys),
[OpenAI](https://platform.openai.com/api-keys) und
[Google AI Studio](https://aistudio.google.com/apikey).

### Eigene Endpoints

Die Erweiterung bringt Host-Berechtigungen nur für die drei eingebauten Provider mit.
Zeigst du sie auf einen eigenen OpenAI-kompatiblen Endpoint — einen Proxy oder eine
lokale Runtime wie Ollama oder LM Studio — erscheint auf der Optionsseite ein Button
**Grant access to `<host>`**. Ein Klick, Chrome fragt nach Bestätigung für genau diesen
Host. Reines `http://` funktioniert für `localhost` und `127.0.0.1`, alles andere muss
`https://` sein.

## Benutzen

1. Beliebiges YouTube-Video öffnen.
2. **✨ InsightSnap** klicken.
3. Die Extension holt das Transkript (Untertitel-Track, ersatzweise das
   Transkript-Panel), schickt es mit deinem Prompt an den Provider und rendert die
   Antwort als Markdown.
4. **Re-analyze** im Fuß des Dialogs wiederholt den Durchlauf, z.B. nach einer
   Prompt-Änderung.

Die Fußzeile zeigt an, woher das Transkript kam, in welcher Sprache und wie lang es war.

Transkripte werden vor dem Senden bei 400.000 Zeichen gekappt — ein Runaway-Schutz für
mehrstündige Streams. Greift das, steht es explizit in der Fußzeile.

## Datenschutz

- API-Key und Prompt liegen ausschließlich lokal im Browserprofil.
- Transkript und Videotitel gehen an den von dir konfigurierten Provider — sonst nirgendwohin.
- Das Transkript wird über YouTubes InnerTube-API mit deinen Session-Cookies geholt
  (`credentials: 'include'`), genau wie die Seite selbst es tut. Es verlässt den Browser
  nur als Teil der Anfrage an deinen gewählten Provider.
- Kein Tracking, kein eigenes Backend.

## Wenn etwas nicht geht

**„No transcript available"** — Das Video hat keine Untertitel. InsightSnap
transkribiert nicht selbst, ohne Untertitel geht nichts.

**„The extension was reloaded. Please refresh the page (F5)."** — Genau das:
nach einem Update der Extension sind offene Tabs abgekoppelt.

**Button erscheint nicht** — Nach einem Update in `chrome://extensions` auf ⟳
klicken, dann den Tab neu laden.

**HTTP 401/403 vom Provider** — API-Key falsch, abgelaufen oder ohne Guthaben.

**HTTP 400 mit `max_tokens`** — InsightSnap fordert bis zu 8192 Output-Tokens an.
Legacy-Modelle mit 4096er-Deckel (z.B. `claude-3-haiku`) lehnen das ab; ein aktuelles
Modell wählen.

## Selbst bauen

Node 20+ vorausgesetzt.

```bash
npm install
npm run build      # Ausgabe in dist/ — dieser Ordner wird als Extension geladen
npm run dev        # Dev-Server mit Hot-Reload, dist/ wird laufend aktualisiert
npm test           # Tests der Transkript-Parser (node --test, ohne Extra-Dependency)
npm run typecheck
npm run icons      # PNGs aus assets/icon.svg neu erzeugen (macOS, nutzt sips)
npm run release    # baut und packt dist/ zu insightsnap-<version>.zip
```

Stack: Vite + CRXJS, React 19, TypeScript, Manifest V3.

```
src/
  background/   Service Worker — führt die LLM-Aufrufe aus
  content/      YouTube-Content-Script + Dialog (Shadow DOM)
  options/      Optionsseite
  shared/       Provider-Anbindung, Transkript-Extraktion, Settings, Typen
test/           Parser-Tests
assets/         Icon-Quelle (SVG)
```

## Lizenz

[MIT](LICENSE)
