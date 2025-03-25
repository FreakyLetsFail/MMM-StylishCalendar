# MMM-StylishCalendar - Installationsanleitung

Dieses Modul ist ein stilvolles, minimalistisches Kalendermodul für MagicMirror² mit integrierter Apple Calendar-Unterstützung. Es erlaubt dir, verschiedene Kalender mit benutzerdefinierten Kategorien (wie Arbeit, Familie etc.) zu importieren und anzuzeigen.

## Installation

1. Navigiere zum Modulordner deines MagicMirror:
   ```bash
   cd ~/MagicMirror/modules
   ```

2. Klone das Repository:
   ```bash
   git clone https://github.com/yourusername/MMM-StylishCalendar.git
   ```

3. Installiere die Abhängigkeiten:
   ```bash
   cd MMM-StylishCalendar
   npm install
   ```

4. Füge das Modul zu deiner `config.js` Datei hinzu:
   ```javascript
   {
       module: "MMM-StylishCalendar",
       position: "top_right",
       config: {
           // Optional: Passe Konfigurationsoptionen an
           themeColor: "#ca5010",
           mode: "upcoming",
           dayLimit: 7
       }
   }
   ```

5. Starte MagicMirror neu:
   ```bash
   pm2 restart MagicMirror
   ```

## Einrichtung deiner Kalender

Sobald das Modul installiert ist und dein MagicMirror läuft:

1. Öffne einen Browser und gehe zu `http://DEINE-MIRROR-IP:8080/MMM-StylishCalendar/setup`
   (Wenn dein Mirror lokal läuft, kannst du auch `http://localhost:8080/MMM-StylishCalendar/setup` verwenden)

2. Alternativ kannst du im Modulverzeichnis folgenden Befehl ausführen, der dir den Link anzeigt:
   ```bash
   npm run setup
   ```

3. Im Setup-Assistenten kannst du:
   - Einen Namen für deinen Kalender eingeben
   - Eine Kategorie auswählen (Arbeit, Familie, Persönlich, usw.)
   - Ein Symbol/Icon für den Kalender wählen
   - Eine Farbe für den Kalender festlegen
   - Die iCal/WebCal URL deines Kalenders eingeben (unterstützt nun auch webcal://-URLs)
   - Optional Authentifizierungsdaten hinzufügen, falls dein Kalender passwortgeschützt ist

4. Klicke auf "Kalender hinzufügen". Der Kalender wird automatisch zu deinem MagicMirror hinzugefügt.

5. Im Tab "Kalender verwalten" kannst du:
   - Die hinzugefügten Kalender anzeigen
   - Die kompletten Kalender-URLs sehen
   - Kalender bearbeiten oder löschen

6. Im Tab "Einstellungen" kannst du:
   - Die maximale Anzahl der anzuzeigenden Einträge festlegen (anstatt der Anzahl Tage)

7. Wiederhole den Vorgang für alle Kalender, die du hinzufügen möchtest.

## Wie du die iCal/WebCal URL deines Apple Kalenders findest:

### Auf macOS:
1. Öffne die Kalender-App
2. Rechtsklick auf den Kalender, den du hinzufügen möchtest
3. Wähle "Teilen" → "Kalendershare-Link"
4. Die URL wird kopiert und kann im Setup-Assistenten eingefügt werden

### Auf iCloud.com:
1. Melde dich bei iCloud.com an
2. Öffne Kalender
3. Klicke auf das Zahnrad-Icon neben dem gewünschten Kalender
4. Wähle "Öffentlicher Kalender"
5. Kopiere die angezeigte URL und füge sie im Setup-Assistenten ein

## Anpassungsmöglichkeiten

Du kannst das Modul über folgende Konfigurationsoptionen in der `config.js` anpassen:

```javascript
{
    module: "MMM-StylishCalendar",
    position: "top_right",
    config: {
        // Hauptkonfiguration
        maximumEntries: 10,               // Maximale Anzahl anzuzeigender Termine
        mode: "upcoming",                 // Anzeigemodus: "upcoming", "month", "week", "day"
        dayLimit: 7,                      // Maximale Anzahl anzuzeigender Tage 
        allowWebcal: true,                // Unterstützung für webcal:// URLs
        
        // Visuelle Anpassungen
        themeColor: "#ca5010",            // Hauptakzentfarbe
        colorizeEvents: true,             // Farben für Ereignisse basierend auf Kalender anwenden
        roundedCorners: true,             // Abgerundete Ecken für UI-Elemente 
        showHeader: true,                 // Kalender-Header anzeigen
        
        // Ereignis-Details
        showLocation: true,               // Veranstaltungsort anzeigen
        showDescription: false,           // Ereignisbeschreibungen anzeigen
        showEventDuration: true,          // Zeigt an, wie lange Ereignisse dauern
        
        // Animationen
        animateIn: true,                  // Animation beim Anzeigen von Ereignissen
        fadeAnimations: true,             // Fade-Animationen
        textAnimations: true,             // Text-Animationen
        
        // Weitere Optionen
        language: config.language,        // Modulsprache (Standardmäßig Systemsprache)
        timeFormat: config.timeFormat,    // 12/24-Stunden-Format
        dateFormat: "MMM Do",             // Format für Datumsanzeige
        calendarServerPort: 8200,         // Port für den Setup-Server
    }
}
```

## Dateien und Struktur

Hier ist die Struktur des Moduls:

```
MMM-StylishCalendar/
├── MMM-StylishCalendar.js       # Hauptmodulskript
├── node_helper.js               # Node.js-Helfer für Backend-Operationen
├── package.json                 # Paketinformationen und Abhängigkeiten
├── README.md                    # Dokumentation
├── css/
│   └── MMM-StylishCalendar.css  # Stylesheet für das Modul
├── public/
│   └── setup.html               # Setup-Assistent
├── translations/
│   ├── de.json                  # Deutsche Übersetzungen
│   └── en.json                  # Englische Übersetzungen
└── utils/
    └── CalendarBuilder.js       # Helper für DOM-Erstellung
```

## Fehlerbehebung

Falls Probleme auftreten:

1. **Kalender wird nicht angezeigt:**
   - Überprüfe, ob die iCal/WebCal URL korrekt ist
   - Stelle sicher, dass der Kalender öffentlich geteilt ist oder die richtigen Anmeldedaten eingegeben wurden
   - Schaue in die MagicMirror Logs, um nach Fehlern zu suchen: `pm2 logs MagicMirror`

2. **Setup-Assistent ist nicht erreichbar:**
   - Stelle sicher, dass der Port 8200 nicht durch eine Firewall blockiert wird
   - Überprüfe, ob MagicMirror mit ausreichenden Rechten läuft

3. **Änderungen im Kalender werden nicht angezeigt:**
   - Das Modul aktualisiert sich standardmäßig alle 60 Sekunden
   - Kalenderänderungen bei Apple können bis zu 15 Minuten brauchen, bis sie verfügbar sind

## Unterstützte Icon-Typen

Bei der Kalendereinrichtung kannst du aus folgenden Icons wählen:
- calendar (Kalender)
- work (Arbeit)
- family (Familie)
- event (Veranstaltung)
- birthday (Geburtstag)
- holiday (Urlaub)
- travel (Reise)
- meeting (Besprechung)

## Unterstützte Kategorien

Vordefinierte Kategorien:
- Default
- Work (Arbeit)
- Family (Familie)
- Personal (Persönlich)
- Holiday (Urlaub)
- Birthday (Geburtstag)
- Travel (Reise)
- Meeting (Besprechung)

Du kannst auch eigene benutzerdefinierte Kategorien erstellen!