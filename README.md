# InsightSnap

Chrome/Edge-Erweiterung, die YouTube-Videos zusammenfasst: Transkript ziehen, an ein
LLM deiner Wahl schicken, Ergebnis direkt auf der Videoseite anzeigen.

Auf jeder YouTube-Watch-Seite erscheint neben „Teilen“/„Speichern“ ein Button
**✨ InsightSnap**. Klick darauf → Dialog mit der Analyse.

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
| **Provider** | Anthropic Claude, OpenAI, Google Gemini, AWS Bedrock oder OpenAI-kompatibel |
| **Model** | Dropdown, das die verfügbaren Modelle beim Provider abfragt, sobald ein API-Key eingetragen ist. Lädt der Provider keine Liste, wird daraus ein Freitextfeld. |
| **API-Key** | Wird nur lokal in `chrome.storage.local` gespeichert |
| **Region** | Nur bei „AWS Bedrock“, daraus wird `https://bedrock-mantle.{region}.api.aws/v1` |
| **Base-URL** | Nur bei „OpenAI-kompatibel“, z.B. `https://api.example.com/v1` |
| **Zugriff** | Erscheint bei Bedrock und eigenen Endpoints: deren Host steht nicht im Manifest und muss einmalig freigegeben werden |
| **Prompt** | Systemprompt für die Analyse, per Button auf den Default zurücksetzbar |

**Speichern** nicht vergessen.

API-Keys gibt es bei
[Anthropic](https://console.anthropic.com/settings/keys),
[OpenAI](https://platform.openai.com/api-keys),
[Google AI Studio](https://aistudio.google.com/apikey) und
[AWS Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys.html).

Bedrock spricht auf dem `bedrock-mantle`-Endpoint das OpenAI-Chat-Completions-Format
und akzeptiert den Bedrock-API-Key als Bearer-Token — kein SigV4 nötig. Modell-IDs
tragen dort ein Präfix, z.B. `us.anthropic.claude-sonnet-4-6`; die Modell-Liste füllt
das Dropdown automatisch.

## Benutzen

1. Beliebiges YouTube-Video öffnen.
2. **✨ InsightSnap** klicken.
3. Die Extension holt das Transkript (Untertitel-Track, ersatzweise das
   Transkript-Panel), schickt es mit deinem Prompt an den Provider und rendert die
   Antwort als Markdown.
4. **Neu analysieren** im Fuß des Dialogs wiederholt den Durchlauf, z.B. nach einer
   Prompt-Änderung.

Die Fußzeile zeigt an, woher das Transkript kam, in welcher Sprache und wie lang es war.

## Datenschutz

- API-Key und Prompt liegen ausschließlich lokal im Browserprofil.
- Transkript und Videotitel gehen an den von dir konfigurierten Provider — sonst nirgendwohin.
- Kein Tracking, kein eigenes Backend.

## Wenn etwas nicht geht

**„Kein Transkript gefunden“** — Das Video hat keine Untertitel. InsightSnap
transkribiert nicht selbst, ohne Untertitel geht nichts.

**„Extension wurde neu geladen. Bitte die Seite neu laden (F5).“** — Genau das:
nach einem Update der Extension sind offene Tabs abgekoppelt.

**Button erscheint nicht** — Nach einem Update in `chrome://extensions` auf ⟳
klicken, dann den Tab neu laden.

**CORS-Fehler beim Analysieren** (`No 'Access-Control-Allow-Origin' header`) — Chrome
hält die Host-Berechtigung zurück. In `chrome://extensions` → InsightSnap →
**Details** → **Websitezugriff** auf *Auf allen Websites* stellen.

**HTTP 401/403 vom Provider** — API-Key falsch, abgelaufen oder ohne Guthaben.

## Selbst bauen

Node 20+ vorausgesetzt.

```bash
npm install
npm run build      # Ausgabe in dist/ — dieser Ordner wird als Extension geladen
npm run dev        # Dev-Server mit Hot-Reload, dist/ wird laufend aktualisiert
npm run release    # baut und packt dist/ zu insightsnap-<version>.zip
```

Stack: Vite + CRXJS, React 19, TypeScript, Manifest V3.

```
src/
  background/   Service Worker — führt die LLM-Aufrufe aus
  content/      YouTube-Content-Script + Dialog (Shadow DOM)
  options/      Optionsseite
  shared/       Provider-Anbindung, Transkript-Extraktion, Settings, Typen
```
