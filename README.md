# Judo Pro Timer

Trainer-Timer für den Judo-Alltag als Web-App (PWA): läuft im Browser, lässt sich auf Android und iPhone/iPad installieren und funktioniert **komplett offline**.

## Was die App kann

**1. Judo-Programme** – frei zusammenstellbare Abläufe aus Schritten:
- Jeder Schritt hat einen **Namen**, eine **Dauer** und eine **Pause danach** (z. B. 5:00 Randori, 1:00 Uchi-komi, 0:30 Pause oder 3:00 / 3:00 / 2:00).
- **Open**-Schritte ohne Zeitlimit: die Uhr zählt aufwärts, der Trainer schaltet per Tipp weiter.
- Das ganze Programm kann mehrfach wiederholt werden (mit eigener Pause dazwischen), dazu optional Aufwärmen und Abwärmen.
- Die **Gesamtdauer** wird beim Bearbeiten live berechnet.

**2. HIIT-Timer** – Übungen mit Arbeit und Pause, Runden, Wiederholungen, Sets, Set-Pause, Zusatzpause nach jeder Runde, Aufwärmen, Abwärmen.

**Lauf-Bildschirm** (beide Modi): riesige Uhr, Abschnittsname, Schritt/Runde/Set, vier Zeiten – *Gesamt verbleibend*, *aktive Zeit*, *pausiert* und *geplant* –, Pause/Weiter, Vor/Zurück, ±10 s, +30 s Pause einfügen, Vollbild, Querformat-Layout für die Matte. Antippen der Uhr pausiert. Der Timer läuft weiter, wenn man zur Übersicht wechselt.

**Töne:** Tempelglocke, Gong oder Summer; Countdown-Pieptöne (10, 5, 3, 2, 1 s einstellbar); Ansagen als natürliche Stimme: japanische Judo-Kommandos (*Hajime, Mate, Yasume, Sore-made*) oder die Sprache der App (Deutsch, Englisch, Arabisch). Reihenfolge von Glocke und Ansage am Ende eines Abschnitts einstellbar.

**Sonst:** Verlauf (geplante und tatsächliche Zeit), Sicherung/Import aller Programme, Hell/Dunkel, Rot oder Gold als Akzent, Sprachen Deutsch · English · العربية (Arabisch von rechts nach links), Bildschirm bleibt an (Wake Lock).

## Starten

```bash
npm test                 # Tests der Zeitlogik
python3 -m http.server 8000   # dann http://localhost:8000 öffnen
```

Kein Build-Schritt nötig (reines HTML/CSS/JavaScript mit ES-Modulen).

## Installieren

- **Android (Chrome):** Seite öffnen → Menü ⋮ → „App installieren“.
- **iPhone/iPad (Safari):** Teilen → „Zum Home-Bildschirm“.
- Einmal mit Internet öffnen, danach läuft alles offline. Nach Änderungen vor dem Veröffentlichen `node tools/update-sw.mjs` ausführen (aktualisiert den Offline-Cache).

## Veröffentlichen (GitHub Pages)

Alle Pfade sind relativ. Repository auf GitHub anlegen, Code hochladen, unter *Settings → Pages* den Branch `main` (Ordner `/`) wählen. Die App läuft dann unter `https://<name>.github.io/<repo>/`.

## Zuverlässigkeit der Zeit und Töne

- Die Uhr rechnet mit einer **monotonen Zeitquelle** (`performance.now`) und Zeitdifferenzen, nicht mit „eine Sekunde abziehen“. Verpasste Ticks (z. B. im Hintergrund) werden korrekt nachgeholt; Pausen halten die Zeit exakt an.
- Zeitgesteuerte Töne werden **vorab auf der Audio-Zeitleiste eingeplant** (90 s voraus, alle 20 s erneuert) statt per Timer ausgelöst. Dadurch bleiben sie auch bei gedrosselter Seite pünktlich.
- **Grenzen des Betriebssystems:** Ein Webseiten-Timer darf im Hintergrund oder bei gesperrtem Bildschirm vom System gedrosselt oder angehalten werden, besonders auf dem iPhone. Deshalb hält die App den Bildschirm wach, solange der Timer läuft. Für den Einsatz in der Halle: Bildschirm anlassen, Ton an, App im Vordergrund lassen. Auf einem iPhone muss außerdem der Stumm-Schalter auf „laut“ stehen.
- Die Lautstärke der Töne hängt vom Gerät ab; vor dem Training einmal „Glocke testen“ drücken.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `js/engine/clock.js` | monotone Stoppuhr, Zeitformate |
| `js/engine/program.js` | Judo-Programme → Phasen, Summen |
| `js/engine/interval.js` | HIIT-Phasen und der Läufer (Pause, Weiter, Zurück, Anpassen, Ton-Plan) |
| `js/audio.js`, `js/session.js` | Töne und Ablauf (Timer-Schleife, Wake Lock, Verlauf) |
| `js/views.js`, `js/ui.js`, `css/style.css` | Oberflächen und Design |
| `js/lang/*.js`, `js/i18n.js` | Übersetzungen (de, en, ar) |
| `js/store.js` | Speicherung (localStorage) |
| `audio/voice/<jp,de,en,ar>/` | Sprachclips |
| `tests/` | Tests (`npm test`) |

## Stimmen und Quellen

- **Deutsch / Englisch:** mit dem Programm Piper erzeugt, Stimmen „Thorsten“ und „Joe“ (beide CC0).
- **Japanisch / Arabisch:** mit ElevenLabs erzeugt (Modell `eleven_v4`; japanisch „AI NOBORu“, arabisch „Rawi – Calm & Clear Fusha Narrator“). Die kostenlose Stufe verlangt die Nennung der Quelle (steht in den Optionen) und gilt nicht für kommerzielle Nutzung.
- Neue Clips: Dateien `start`, `stop`, `rest`, `ready`, `switch`, `finish` (mp3) in `audio/voice/<ordner>/` ablegen, dann `node tools/update-sw.mjs`.

## Später als native App

Als Web-App läuft alles auf Android, iPhone und Tablet. Wer die App in den Play Store oder App Store bringen will, kann sie später mit Capacitor oder (Android) als Trusted Web Activity verpacken; ein natives Paket würde außerdem zuverlässigere Töne bei gesperrtem Bildschirm erlauben.
