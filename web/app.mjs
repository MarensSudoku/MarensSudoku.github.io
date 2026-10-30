import { createEffects } from './game/effects.mjs';
import { createScreenWakeLock } from './screen.mjs';
import { setupReefEditor } from './reef-editor.mjs';
import { conflicts, isSolved, PEERS } from './sudoku/engine.mjs';
import { createGame, restartGame, enter, undo, fullUnits, complete, emptyProgress, emptyScores, progressValue, ACHIEVEMENTS, validGame } from './sudoku/model.mjs';
import { load, save, STORAGE_KEY } from './storage.mjs';
import { setupMusic } from './music.mjs';

const $ = id => document.getElementById(id);
const text = {
  de: {
    numberDone:'alle gesetzt', noted:'notiert', helpTour:'Tutorial starten', updateCopy:'Eine neue Version von MarensSudoku ist bereit. Dein Spielstand bleibt erhalten.', updateNow:'Jetzt aktualisieren',
    welcomeEyebrow:'WILLKOMMEN IM RIFF', welcomeTitle:'Schön, dass du da bist.', welcomeCopy:'Mach es dir gemütlich. Das Tutorial erklärt Sudoku, alle Schaltflächen und wie du dein eigenes Riff gestaltest.', welcomeStart:'Los geht’s', welcomeTour:'Tutorial',
    welcomeTutorialHint:'Bitte mach zuerst das Tutorial. Es erklärt dir die Farben im Sudoku und alle Funktionen deines Riff-Editors.',
    tourFocusTitle:'Türkis und helle Felder', tourFocus:'Türkis mit dunklem Rand ist dein ausgewähltes Feld. Die hellere Zeile, Spalte und der Block gehören dazu: Ihre Zahlen musst du beim Eintragen beachten.',
    tourMatchingTitle:'Gelb: dieselbe Zahl', tourMatching:'Wenn du eine gesetzte Zahl auswählst, erscheinen alle gleichen Zahlen gelb. So findest du sie im ganzen Spielfeld wieder. Gelb ist kein Fehlerhinweis.',
    tourErrorsTitle:'Rot: doppelte Zahlen', tourErrors:'Rot zeigt doppelte Zahlen in einer Zeile, Spalte oder einem Block, wenn die Konfliktanzeige aktiv ist. Hier siehst du ein Beispiel; dein Rätsel bleibt unverändert.',
    tourPadColorsTitle:'Farben bei den Zahlentasten', tourPadColors:'Türkis markiert die ausgewählte Zahl, Gelb eine Notiz im aktuellen Feld. Blasse Tasten bedeuten: Diese Zahl steht schon neunmal im Rätsel. Kurzes grünes Leuchten feiert eine vollständige Zeile, Spalte oder einen Block.',
    tourEditorIntroTitle:'Dein Riff-Editor', tourEditorIntro:'Der Editor ist jetzt geöffnet. Wir zeigen dir die Funktionen an einem Beispielriff. Dein gespeichertes Riff bleibt erhalten; dein Sudoku pausiert.',
    tourEditorSelectTitle:'Ein Objekt auswählen', tourEditorSelect:'Touch: Finger auflegen und ohne Abheben über die Objekte fahren. Das Ziel wird golden eingefärbt. Loslassen öffnet die Bearbeitung. Mit Maus: anklicken. Unser Beispielfisch ist schon ausgewählt.',
    tourEditorMoveTitle:'Über den Boden verschieben', tourEditorMove:'Der Knopf mit vier Pfeilen verschiebt das gewählte Objekt über den Boden: links, rechts, näher und weiter weg. Ziehe irgendwo auf der freien Riff-Fläche. Auch die Pfeiltasten funktionieren.',
    tourEditorHeightTitle:'Höhe verändern', tourEditorHeight:'Mit dem senkrechten Doppelpfeil ziehst du nach oben oder unten, um das Objekt anzuheben oder abzusenken. Auf der Tastatur nutzt du Pfeil hoch und runter.',
    tourEditorRotateTitle:'Um drei Achsen drehen', tourEditorRotate:'Die Drehknöpfe tragen X, Y und Z: X kippt vor und zurück, Y dreht links und rechts, Z neigt seitlich. Wähle eine Achse und ziehe waagerecht; auch Pfeil links und rechts funktionieren.',
    tourEditorScaleTitle:'Größe ändern', tourEditorScale:'Der diagonale Doppelpfeil ändert die Größe. Nach oben ziehen vergrößert, nach unten verkleinert. Mit der Tastatur geht das über die Pfeiltasten.',
    tourEditorObjectsTitle:'Duplizieren und entfernen', tourEditorObjects:'Die zwei Quadrate erzeugen eine Kopie des gewählten Objekts. Der rote Papierkorb entfernt es aus dem Entwurf. Rückgängig oben kann beides zurücknehmen.',
    tourEditorColorTitle:'Die Objektfarbe', tourEditorColor:'Der Reglerknopf öffnet die Farbeinstellungen. Ganz links am Farbregler steht die Originalfarbe. Während das Fenster offen ist, pausiert die goldene Einfärbung, damit du die echte Farbe siehst.',
    tourEditorFishTitle:'So schwimmen deine Fische', tourEditorFish:'Fischverhalten aufklappen: Am Platz, Runden, Hin und her, Acht oder Schwarm wählen. Tempo regelt die Geschwindigkeit, Radius die Strecke. Fische derselben Art teilen im Schwarm Position, Drehung, Tempo und Radius.',
    tourEditorDoneTitle:'Auswahl lösen', tourEditorDone:'Das grüne Häkchen im Ringmenü löst die Auswahl. Danach kannst du ein anderes Objekt auswählen, neue hinzufügen oder die Objektliste öffnen. Dieses Häkchen speichert noch nicht.',
    tourEditorAddTitle:'Neue Objekte hinzufügen', tourEditorAdd:'Der Plusknopf mit Vorschaubild öffnet den Katalog für Fische, Pflanzen und Korallen. Solange ein Objekt ausgewählt ist, sind Hinzufügen, Objektliste und Standardriff gesperrt.',
    tourEditorCatalogTitle:'Dein Objektkatalog', tourEditorCatalog:'Wähle ein Vorschaubild: Das Objekt wird sofort hinzugefügt und zum Bearbeiten ausgewählt. Das × schließt den Katalog. Dein Riff bietet Platz für bis zu 200 Objekte.',
    tourEditorListTitle:'Alle Objekte im Blick', tourEditorList:'Die Liste zeigt jedes Objekt, auch entfernte Riffteile. Häkchen markieren einzelne oder alle Objekte. Bearbeiten öffnet genau ein markiertes Objekt; Auswahl löschen entfernt alle markierten Objekte zusammen.',
    tourEditorUndoTitle:'Änderungen zurücknehmen', tourEditorUndo:'Der Rückwärtspfeil nimmt einen ganzen Zug zurück: Ziehen, Farbregler, Hinzufügen, Löschen oder Zurücksetzen. Bis zu 50 Schritte bleiben während dieses Editorbesuchs verfügbar.',
    tourEditorResetTitle:'Das Standardriff', tourEditorReset:'Der Kreis-Pfeil stellt nach Bestätigung das Standardriff her. Es ersetzt zuerst nur deinen Entwurf. Rückgängig holt den vorigen Entwurf zurück; dauerhaft wird es erst beim Speichern.',
    tourEditorHintsTitle:'Hinweise ausblenden', tourEditorHints:'Mit dem × blendest du das Hinweisfeld für diesen Editorbesuch aus. Beim nächsten Öffnen erscheint es wieder. Wichtige Fehlermeldungen bleiben sichtbar.',
    tourEditorSaveTitle:'Speichern oder verwerfen', tourEditorSave:'Das Häkchen ganz oben speichert dein Riff lokal im Browser. Das × daneben verwirft den Entwurf. Sudoku und Punkte bleiben erhalten. Unser Tutorial-Beispiel wird beim Weitergehen verworfen.',
    tourStep:'Schritt {n} von {total}', tourNext:'Weiter', tourDone:'Fertig', tourSkip:'Überspringen',
    tourIntroTitle:'Was ist Sudoku?', tourIntro:'Das Spielfeld hat 81 Felder: 9 Zeilen, 9 Spalten und 9 Blöcke aus je 3×3 Feldern. Dein Ziel: Fülle alle leeren Felder mit den Zahlen 1 bis 9.',
    tourRowTitle:'Regel 1: die Zeile', tourRow:'In jeder waagerechten Zeile kommt jede Zahl von 1 bis 9 genau einmal vor.',
    tourColumnTitle:'Regel 2: die Spalte', tourColumn:'Auch in jeder senkrechten Spalte steht jede Zahl genau einmal.',
    tourBoxTitle:'Regel 3: der Block', tourBox:'Und in jedem 3×3-Block ebenfalls jede Zahl genau einmal. Mehr Regeln gibt es nicht!',
    tourGivenTitle:'Vorgegebene Zahlen', tourGiven:'Diese Zahlen sind fest vorgegeben. Du füllst nur die leeren Felder aus. Jedes Rätsel hat genau eine Lösung, raten musst du nie.',
    tourSolveTitle:'So findest du eine Zahl', tourSolve:'Nimm dir ein leeres Feld vor und streiche gedanklich alle Zahlen, die schon in seiner Zeile, Spalte oder seinem Block stehen.', tourSolveOne:'In diesem Feld bleibt nur die {n} übrig. Trag sie nach dem Tutorial gleich ein!', tourSolveMany:'In diesem Feld bleiben {list} übrig. Dann lohnt sich ein anderes Feld oder eine Notiz.',
    tourPadTitle:'Zahlen eintragen', tourPad:'Tippe eine Zahl, um sie ins ausgewählte Feld zu setzen. Auf der Tastatur: 1–9 eintragen, Entf löscht, Pfeiltasten bewegen.',
    tourNotesTitle:'Notizen', tourNotes:'Passen in ein Feld noch mehrere Zahlen, notiere sie im Notizmodus klein im Feld. Notizen zählen nie als Fehler.',
    tourToolsTitle:'Deine Werkzeuge', tourTools:'Zurück nimmt deinen letzten Zug zurück, Löschen leert das ausgewählte Feld. Neustart beginnt dasselbe Rätsel von vorn, Neues Sudoku bringt ein frisches.',
    tourStatsTitle:'Zeit und Punkte', tourStats:'Die Zeit läuft nur, während du spielst, und pausiert in Menüs. Für gelöste Rätsel bekommst du Punkte.',
    tourReefTitle:'Dein Riff', tourReef:'Der Fisch zeigt dein Riff. Gestalte es über „Mein Riff einrichten“ links daneben. Tippe erneut auf den Fisch, um zum Sudoku zurückzukehren.',
    tourAchievementsTitle:'Dein Perlenschatz', tourAchievements:'Hier sammelst du Erfolge, Punkte und deine Bestleistung.',
    tourSettingsTitle:'Einstellungen', tourSettings:'Musik, Sounds, Darstellung, Schwierigkeit und dein eigenes Riff.',
    tourHelpTitle:'Hilfe & Infos', tourHelp:'Regeln und Tipps zum Nachlesen, wann immer du willst. Viel Spaß beim Abtauchen!',
    reefView:'Riff ansehen', reefReturn:'Sudoku einblenden', reefSaveShort:'Speichern', reefObjectSettings:'Objekt & Verhalten', reefMoveMode:'Verschieben', reefHeightMode:'Hoch / runter bewegen', reefRotateMode:'Um Y drehen', reefRotateXMode:'Um X drehen', reefRotateZMode:'Um Z drehen', reefRotateXHint:'X-Achse: Ziehe irgendwo nach links oder rechts, um das Objekt zu kippen.', reefRotateZHint:'Z-Achse: Ziehe irgendwo nach links oder rechts, um das Objekt seitlich zu neigen.', reefScaleMode:'Skalieren', reefMoveHint:'Verschieben: Ziehe irgendwo, um das Objekt über den Boden zu bewegen. Das grüne Häkchen im Ringmenü löst die Auswahl.', reefHeightHint:'Höhe: Ziehe irgendwo nach oben oder unten. Das grüne Häkchen im Ringmenü löst die Auswahl.', reefRotateHint:'Rotieren: Ziehe irgendwo nach links oder rechts. Das grüne Häkchen im Ringmenü löst die Auswahl.', reefScaleHint:'Skalieren: Ziehe irgendwo nach oben zum Vergrößern, nach unten zum Verkleinern. Das grüne Häkchen im Ringmenü löst die Auswahl.',
    brandSub:'DEINE KLEINE RIFFPAUSE', achievements:'Erfolge', settings:'Deine Einstellungen',
    eyebrow:'EIN KLEINER MOMENT FÜR DICH', heroFirst:'Tauch kurz ab.', heroSecond:'Blüh wieder auf.',
    heroCopy:'Kristallklares Wasser. Bunte Gedanken. Und immer ein neues Sudoku, das auf dich wartet.',
    fishCaption:'Eine Perle nach der anderen.', treasureTitle:'Dein kleiner Perlenschatz', treasureCopy:'Entdecke deine Erfolge im Riff.',
    gameOverline:'DEIN MOMENT. DEIN TEMPO.', autosave:'Automatisch gespeichert', gameTitle:'Eine kleine Riffpause', puzzleDescription:'81 Felder. Meer Möglichkeiten.',
    difficulty:'Schwierigkeit', difficultyHelp:'Beim Wechsel beginnt ein neues Rätsel.', easy:'Leicht', medium:'Mittel', hard:'Schwer', loading:'Dein nächstes Rätsel taucht auf …', cancel:'Abbrechen', confirm:'Bestätigen',
    undo:'Zurück', notes:'Notizen', erase:'Löschen', newGame:'Neues Sudoku', keyboardHint:'Mit Pfeiltasten navigieren · Zahlen 1–9 · N für Notizen',
    footer:'Ein kleines Meer voller Möglichkeiten.', help:'Hilfe & Infos', update:'Update verfügbar', language:'Sprache',
    legalTitle:'Rechtliches & Lizenzen', legalImprint:'Impressum', legalPrivacy:'Datenschutz', legalCode:'Projektlizenz · MIT', legalNotices:'Fremdlizenzen · Babylon.js', legalMusic:'Musiklizenz', legalSounds:'Soundeffektlizenz', legalCommons:'CC BY 4.0 · vollständiger Originaltext', legalSource:'Originalquelle · Englisch',
    reefEdit:'Mein Riff einrichten', reefEditHelp:'Platziere Fische, Pflanzen und Korallen in deinem eigenen Aquarium.', reefLoading:'Das Riff wird vorbereitet.', reefUnavailable:'Das Einrichten benötigt die 3D-Ansicht.', reefAddType:'Objekt hinzufügen', reefAdd:'Hinzufügen', reefSelection:'Meine Objekte', reefSelectAll:'Alle auswählen', reefEditSelected:'Bearbeiten', reefDeleteSelected:'Auswahl löschen', reefNoObjects:'Keine Objekte im Riff.', reefSelect:'Objekt auswählen', reefPositionX:'Links / rechts', reefPositionZ:'Vorne / hinten', reefHeight:'Höhe', reefSize:'Größe', reefRotation:'Drehung', reefMotion:'Schwimmverhalten', reefCircle:'Runden schwimmen', reefPatrol:'Hin und her', reefEight:'Eine Acht schwimmen', reefStill:'Am Platz bleiben', reefSchool:'Im Schwarm', reefSchoolHint:'Fische derselben Art bilden einen Schwarm. Position, Drehung, Tempo und Radius gelten für die ganze Gruppe.', reefSpeed:'Schwimmtempo', reefRadius:'Schwimmradius', reefColor:'Farbe', reefOriginalColor:'Original', reefColorHelp:'Ganz links: Originalfarbe.', reefUndo:'Rückgängig', reefDone:'Fertig', reefDuplicate:'Duplizieren', reefRemove:'Entfernen', reefReset:'Standardriff', reefSave:'Speichern', reefCancel:'Verwerfen', reefHideHints:'Hinweise ausblenden', reefHint:'Objekt anklicken oder per Touch: Finger auflegen und ohne Abheben über die Objekte fahren. Loslassen öffnet die Bearbeitung. Das grüne Häkchen im Ringmenü löst die Auswahl.', reefFull:'Dein Riff ist voll. Entferne zuerst ein Objekt.', reefSaveFailed:'Dein Riff konnte nicht gespeichert werden. Deine Änderungen bleiben hier geöffnet.', reefInvalid:'Dein gespeichertes Riff konnte nicht geladen werden. Speichern ersetzt es durch die hier gezeigte Einrichtung.', reefResetTitle:'Standardriff wiederherstellen?', reefResetCopy:'Die Einrichtung wird durch das Standardriff ersetzt. Erst „Speichern“ übernimmt sie dauerhaft. Dein Sudoku und deine Punkte bleiben erhalten.',
    darkTheme:'Abend im Riff', darkThemeHelp:'Dunkle Farben für eine ruhige Abendrunde.', reduceMotion:'Bewegung reduzieren',
    musicTitle:'Riffmusik', musicTrack:'Titel', musicVolume:'Lautstärke', musicStart:'Musik starten', musicPause:'Musik pausieren', musicPlaying:'Es spielt',
    musicHelp:'Zufällige Riffmusik ohne direkte Wiederholung. Pause gilt bis zum Neuladen; die Lautstärke bleibt gespeichert.', musicAwaiting:'Musik ist aktiv. Tippe ins Spiel, damit dein Browser die Wiedergabe startet.', musicError:'Die Musik konnte nicht gestartet werden. Bitte erneut versuchen oder einen anderen Titel wählen.',
    sfxTitle:'Riffklänge', sfxEnabled:'Soundeffekte', sfxHelp:'Sanfte Klänge für Eingaben und kleine Erfolge.', testSound:'Klang testen',
    reduceMotionHelp:'Ruhige Markierungen statt bewegter Effekte.', showConflicts:'Konflikte markieren', showConflictsHelp:'Zeigt doppelte Zahlen in Reihe, Spalte oder Block.',
    collection:'DEINE SAMMLUNG', achievementsCopy:'Jedes Rätsel ist ein kleiner Tauchgang. Sammle deine schönsten Entdeckungen.',
    trackAchievements:'Erfolge auf diesem Gerät speichern', trackingHelp:'Erfolge und Abzeichen werden standardmäßig gespeichert. Du kannst dies jederzeit ausschalten. Punkte, Bestwert und die Zahl gelöster Rätsel werden unabhängig davon lokal gespeichert.',
    restart:'Neustart', restartTitle:'Dieses Rätsel neu beginnen?', restartCopy:'Eingaben, Notizen und Rundenzeit werden zurückgesetzt. Das Rätsel und bereits gesammelte Punkte bleiben erhalten.', restartDone:'Aktuelles Rätsel zurückgesetzt.', replayScore:'Dieses Rätsel wurde bereits gewertet. Erneutes Lösen bringt keine zusätzlichen Gesamtpunkte.',
    points:'Punkte', totalPoints:'Gesamtpunkte', roundPoints:'Rundenpunkte', bestRound:'Bestes Rätsel', solvedPuzzles:'Gelöste Rätsel', activeTime:'Aktive Spielzeit', playTime:'Spielzeit', scoreHow:'Wie entstehen die Punkte?',
    scoreBase:'Grundpunkte', scoreTime:'Zeitbonus', scoreClean:'Ohne falsche Zahl', scoreDirect:'Ohne Rückgängig', scoreMilestone:'Jedes fünfte Rätsel',
    scoreRules:'Leicht: 1.000, Mittel: 2.000, Schwer: 3.000 Grundpunkte. Dazu bis zu 50 % Zeitbonus, der über 10 / 20 / 40 aktive Minuten auf null sinkt. Ohne falsche Zahl +20 %, ohne Rückgängig +10 %. Jedes fünfte gelöste Rätsel bringt weitere 500 Punkte. Notizen zählen nicht als Fehler. Punkte gibt es einmalig beim Lösen; Grundpunkte bleiben auch bei langen Runden erhalten. Zeit pausiert in Menüs und im Hintergrund. Punkte, Bestwert und die Zahl gelöster Rätsel werden immer lokal gespeichert. Für bereits begonnene Rätsel startet die Zeitmessung mit diesem Update.',
    deleteProgress:'Sammlung und Punkte löschen', winEyebrow:'EINE KLEINE MEISTERLEISTUNG', winTitle:'Strahlend gelöst!',
    winCopy:'Alle Zahlen haben ihren Platz gefunden. Deine nächste Riffpause wartet schon.', winNext:'Weiter durchs Riff',
    resetStorage:'Speicher zurücksetzen', storageInvalid:'Dein gespeicherter Stand konnte nicht sicher geladen werden. Er bleibt erhalten. Dieses Spiel wird vorerst nicht gespeichert.',
    storageFailed:'Dein Browser kann gerade nicht speichern. Du kannst weiterspielen; sichere deinen Fortschritt durch Offenlassen dieses Fensters.',
    unsaved:'Nicht gespeichert', readOnly:'Schon in einem anderen Fenster geöffnet. Dieses Fenster zeigt den Stand schreibgeschützt. Für die Bearbeitung danach neu laden.',
    offlineReady:'Offline bereit', offlinePreparing:'Offline-Dateien werden vorbereitet', generationFailed:'Dieses Rätsel konnte nicht erstellt werden. Bitte noch einmal versuchen.',
    replaceTitle:'Ein neuer Tauchgang?', replaceCopy:'Dein aktuelles Sudoku wird durch ein neues ersetzt. Dein bisheriger Erfolgsfortschritt bleibt erhalten.',
    deleteTitle:'Perlenschatz zurücksetzen?', deleteCopy:'Gesamtpunkte, Bestwert, Erfolgszähler und Abzeichen werden auf diesem Gerät gelöscht. Dein Sudoku bleibt erhalten.',
    stopTrackingTitle:'Erfolgsspeicherung ausschalten?', stopTrackingCopy:'Erfolgszähler und Abzeichen werden gelöscht. Deine Punkte, dein Bestwert und dein Sudoku bleiben erhalten.',
    resetTitle:'Gespeicherten Stand ersetzen?', resetCopy:'Der bisher nicht lesbare lokale Spielstand wird durch das hier angezeigte Spiel ersetzt.',
    unlocked:'Freigeschaltet', trackingOff:'Speicherung aus', filled:'Felder gefüllt', remaining:'Felder warten noch auf dich', completed:'Alle 81 Felder gelöst. Gut gemacht!',
    firstCondition:'Eine Runde lösen', flowCondition:'10 Runden lösen', magicCondition:'50 Runden lösen', starsCondition:'100 Runden lösen', varietyCondition:'Jede Schwierigkeit einmal lösen', crownCondition:'5 schwere Runden lösen', directCondition:'Eine Runde ohne Rückgängig lösen',
    close:'Schließen', cell:'Reihe', column:'Spalte', given:'Vorgegeben', empty:'Leer', conflict:'Regelkonflikt', newAchievement:'Neuer Erfolg',
    helpContent:'<h3>So tauchst du ein</h3><p>Fülle jede Reihe, jede Spalte und jeden 3×3-Block mit den Zahlen 1–9. Jede Zahl kommt darin genau einmal vor. Die vorgegebenen Zahlen bleiben unverändert.</p><p>Tippe auf ein Feld und dann auf eine Zahl. Im Notizmodus sammelst du mögliche Zahlen. Zurück nimmt deinen letzten Zug einschließlich seiner Notizen zurück. Neustart leert nach Bestätigung deine Eingaben und Notizen im selben Rätsel; bereits gesammelte Punkte bleiben erhalten. Doppelte Zahlen werden auf Wunsch markiert.</p><h3>Dein eigenes Aquarium</h3><p>Mit dem Fischknopf oben blendest du das Sudoku aus und genießt dein Riff. Ein erneuter Tipp auf den Fischknopf bringt dich zurück. Die Rätselzeit pausiert; Fische und Musik laufen weiter, sofern Bewegung und Musik eingeschaltet sind.</p><p>Unter Einstellungen → Mein Riff einrichten kannst du Fische, Pflanzen und Korallen platzieren, verschieben, drehen und vergrößern. Per Touch legst du den Finger auf die Riff-Fläche und fährst ohne Abheben über die Objekte. Das anvisierte Objekt wird vollständig golden markiert. Erst beim Loslassen öffnet sich seine Bearbeitung. Danach ziehst du zum Bearbeiten. Das grüne Häkchen im Ringmenü löst die Auswahl. Für Fische wählst du Schwimmverhalten, Tempo und Radius. Die Auswahl und Regler funktionieren auch ohne Ziehen. Speichern merkt sich dein Riff lokal; Verwerfen kehrt zur bisherigen Einrichtung zurück. Dein Sudoku pausiert währenddessen.</p><h3>Ungestört spielen</h3><p>Auf der Spielfläche werden versehentliche Textmarkierungen, Ziehen von Bildern und Browsermenüs unterdrückt. Infotexte kannst du weiterhin kopieren. Beim aktiven Rätseln bleibt der Bildschirm wach, soweit Browser und Energiespareinstellungen das erlauben. In Menüs und im Hintergrund wird das Wachhalten pausiert.</p><h3>Dein Spiel bleibt bei dir</h3><p>Spielstand, Gesamtpunkte und Einstellungen werden lokal in diesem Browser gespeichert. Erfolge werden erst nach Aktivierung gespeichert. Beim Löschen der Websitedaten, auf einem anderen Gerät oder unter einer anderen Adresse steht dieser Fortschritt nicht zur Verfügung.</p><p>Die App lädt ihre Offline-Dateien im Hintergrund. Nach vollständigem Download kannst du dieselbe Adresse ohne Internet öffnen und neue Rätsel erzeugen. Updates werden erst nach deiner Bestätigung aktiviert.</p><h3>Offenes Projekt</h3><p>MarensSudoku · Babylon.js 9.32.1. Eigener Code und Dokumentation unter MIT. Generierte Grafiken werden weitergegeben, soweit die Rechte dafür bestehen; eine exklusive Schutzfähigkeit wird nicht zugesichert.</p><p><a href="https://github.com/MarensSudoku/MarensSudoku.github.io" target="_blank" rel="noopener noreferrer">Quellcode auf GitHub</a></p>',
  },
  en: {
    numberDone:'all placed', noted:'noted', helpTour:'Start tutorial', updateCopy:'A new version of MarensSudoku is ready. Your game stays saved.', updateNow:'Update now',
    welcomeEyebrow:'WELCOME TO THE REEF', welcomeTitle:'Lovely to see you.', welcomeCopy:'Make yourself comfortable. The tutorial explains Sudoku, every button and how to arrange your own reef.', welcomeStart:'Let’s dive in', welcomeTour:'Tutorial',
    welcomeTutorialHint:'Please start with the tutorial. It explains Sudoku colours and every feature of your reef editor.',
    tourFocusTitle:'Turquoise and pale cells', tourFocus:'Turquoise with a dark border marks your selected cell. Its paler row, column and box are related cells: Check their numbers before entering your own.',
    tourMatchingTitle:'Yellow: the same number', tourMatching:'Select a filled cell to highlight every matching number in yellow. This helps you find them across the board. Yellow does not indicate a mistake.',
    tourErrorsTitle:'Red: duplicate numbers', tourErrors:'Red marks duplicate numbers in a row, column or box when conflict highlighting is enabled. This is only an example; your puzzle stays unchanged.',
    tourPadColorsTitle:'Number button colours', tourPadColors:'Turquoise marks the selected number; yellow marks a note in the current cell. Faded buttons mean that number appears nine times already. A brief green shimmer celebrates a completed row, column or box.',
    tourEditorIntroTitle:'Your reef editor', tourEditorIntro:'The editor is now open. We will explain its controls using an example reef. Your saved reef stays intact, and your Sudoku pauses.',
    tourEditorSelectTitle:'Select an object', tourEditorSelect:'Touch and slide over objects without lifting your finger. The target turns gold. Release to open its editing controls. With a mouse, click an object. Our example fish is already selected.',
    tourEditorMoveTitle:'Move along the ground', tourEditorMove:'The four-arrow button moves the selected object along the ground: left, right, nearer and farther. Drag anywhere on the free reef surface. Arrow keys work too.',
    tourEditorHeightTitle:'Change the height', tourEditorHeight:'Choose the vertical double arrow, then drag up or down to raise or lower the object. On a keyboard, use the up and down arrows.',
    tourEditorRotateTitle:'Rotate on three axes', tourEditorRotate:'The rotation buttons show X, Y and Z: X tilts forward and back, Y turns left and right, Z rolls sideways. Choose an axis and drag horizontally, or use the left and right arrow keys.',
    tourEditorScaleTitle:'Change the size', tourEditorScale:'The diagonal double arrow changes the size. Drag up to enlarge or down to shrink. Arrow keys also change the size.',
    tourEditorObjectsTitle:'Duplicate and remove', tourEditorObjects:'The two squares create a copy of the selected object. The red bin removes it from the draft. Undo at the top can reverse either action.',
    tourEditorColorTitle:'Object colour', tourEditorColor:'The sliders button opens colour settings. The far-left end of the colour slider restores the original colour. The gold fill pauses while this panel is open so you can see the actual colour.',
    tourEditorFishTitle:'How your fish swim', tourEditorFish:'Expand fish behaviour: Stay, Circles, Back and forth, Figure of eight or School. Speed controls pace; radius controls the route size. School fish of the same species share position, rotation, speed and radius.',
    tourEditorDoneTitle:'Release the selection', tourEditorDone:'The green checkmark in the ring menu releases the selection. You can then choose another object, add one or open the object list. This checkmark does not save yet.',
    tourEditorAddTitle:'Add new objects', tourEditorAdd:'The plus button with a preview opens the fish, plant and coral catalogue. Adding, the object list and Default reef are disabled while an object is selected.',
    tourEditorCatalogTitle:'Your object catalogue', tourEditorCatalog:'Choose a preview to immediately add and select that object. The × closes the catalogue. Your reef has room for up to 200 objects.',
    tourEditorListTitle:'See every object', tourEditorList:'The list includes every object, even distant reef pieces. Check individual objects or Select all. Edit opens exactly one checked object; Delete selected removes the checked objects together.',
    tourEditorUndoTitle:'Undo your changes', tourEditorUndo:'The backward arrow reverses a whole action: dragging, a colour slider gesture, adding, deleting or resetting. Up to 50 steps remain available during this editor visit.',
    tourEditorResetTitle:'The default reef', tourEditorReset:'The circular arrow restores the default reef after confirmation. This changes only your draft until you save. Undo brings your previous draft back.',
    tourEditorHintsTitle:'Hide the hints', tourEditorHints:'Use the × to hide the hint panel for this editor visit. It returns the next time you open the editor. Important error messages remain visible.',
    tourEditorSaveTitle:'Save or discard', tourEditorSave:'The checkmark at the very top saves your reef locally in this browser. The × beside it discards your draft. Sudoku and points stay intact. Our tutorial example is discarded when you continue.',
    tourStep:'Step {n} of {total}', tourNext:'Next', tourDone:'Done', tourSkip:'Skip',
    tourIntroTitle:'What is Sudoku?', tourIntro:'The board has 81 squares: 9 rows, 9 columns and 9 boxes of 3×3 squares. Your goal: fill every empty square with the numbers 1 to 9.',
    tourRowTitle:'Rule 1: the row', tourRow:'Each number from 1 to 9 appears exactly once in every horizontal row.',
    tourColumnTitle:'Rule 2: the column', tourColumn:'Each number also appears exactly once in every vertical column.',
    tourBoxTitle:'Rule 3: the box', tourBox:'And exactly once in every 3×3 box. That is all there is to it!',
    tourGivenTitle:'Given numbers', tourGiven:'These numbers are fixed. You only fill the empty squares. Every puzzle has exactly one solution, so you never need to guess.',
    tourSolveTitle:'How to find a number', tourSolve:'Pick an empty square and rule out every number already in its row, column or box.', tourSolveOne:'Only {n} is left for this square. Enter it right after the tutorial!', tourSolveMany:'{list} are still possible here. Try another square or make a note.',
    tourPadTitle:'Enter numbers', tourPad:'Tap a number to place it in the selected square. On a keyboard, type 1–9, Delete clears and the arrow keys move.',
    tourNotesTitle:'Notes', tourNotes:'If several numbers still fit a square, note them in small print using note mode. Notes never count as mistakes.',
    tourToolsTitle:'Your tools', tourTools:'Undo takes back your last move, Erase clears the selected square. Restart begins the same puzzle again, New Sudoku brings a fresh one.',
    tourStatsTitle:'Time and points', tourStats:'Time only runs while you play and pauses in menus. Solved puzzles earn points.',
    tourReefTitle:'Your reef', tourReef:'The fish shows your reef. Use “Arrange my reef” to its left to design it. Tap the fish again to return to Sudoku.',
    tourAchievementsTitle:'Your pearl treasure', tourAchievements:'Here you collect achievements, points and your personal best.',
    tourSettingsTitle:'Settings', tourSettings:'Music, sounds, appearance, difficulty and your own reef arrangement.',
    tourHelpTitle:'Help & info', tourHelp:'Rules and tips to read again whenever you like. Enjoy your dive!',
    reefView:'Watch my reef', reefReturn:'Show Sudoku', reefSaveShort:'Save', reefObjectSettings:'Object & behaviour', reefMoveMode:'Move', reefHeightMode:'Move up / down', reefRotateMode:'Rotate Y', reefRotateXMode:'Rotate X', reefRotateZMode:'Rotate Z', reefRotateXHint:'X axis: Drag anywhere left or right to tilt the object.', reefRotateZHint:'Z axis: Drag anywhere left or right to roll the object.', reefScaleMode:'Scale', reefMoveHint:'Move: Drag anywhere to move the object along the ground. The green checkmark in the ring menu releases the selection.', reefHeightHint:'Height: Drag anywhere up or down. The green checkmark in the ring menu releases the selection.', reefRotateHint:'Rotate: Drag anywhere left or right. The green checkmark in the ring menu releases the selection.', reefScaleHint:'Scale: Drag anywhere up to enlarge, down to shrink. The green checkmark in the ring menu releases the selection.',
    brandSub:'YOUR LITTLE REEF BREAK', achievements:'Achievements', settings:'Your preferences',
    eyebrow:'A LITTLE MOMENT FOR YOU', heroFirst:'Dive into calm.', heroSecond:'Come up smiling.', heroCopy:'Crystal-clear water. Colourful thoughts. And a new Sudoku whenever you fancy one.',
    fishCaption:'One little pearl at a time.', treasureTitle:'Your little pearl collection', treasureCopy:'Discover your achievements in the reef.',
    gameOverline:'YOUR MOMENT. YOUR PACE.', autosave:'Saved automatically', gameTitle:'A little reef break', puzzleDescription:'81 squares. An ocean of possibilities.',
    difficulty:'Difficulty', difficultyHelp:'Changing this starts a new puzzle.', easy:'Easy', medium:'Medium', hard:'Hard', loading:'Your next puzzle is surfacing …', cancel:'Cancel', confirm:'Confirm',
    undo:'Undo', notes:'Notes', erase:'Erase', newGame:'New Sudoku', keyboardHint:'Arrow keys to move · Numbers 1–9 · N for notes', footer:'A little ocean of possibilities.',
    help:'Help & info', update:'Update available', language:'Language', darkTheme:'Evening at the reef', darkThemeHelp:'Dark colours for a quiet evening puzzle.',
    legalTitle:'Legal & licences', legalImprint:'Legal notice', legalPrivacy:'Privacy', legalCode:'Project licence · MIT', legalNotices:'Third-party licences · Babylon.js', legalMusic:'Music licence', legalSounds:'Sound-effect licence', legalCommons:'CC BY 4.0 · full original text', legalSource:'Original source · English',
    reefEdit:'Arrange my reef', reefEditHelp:'Place fish, plants and corals in your own aquarium.', reefLoading:'The reef is getting ready.', reefUnavailable:'Arranging your reef requires the 3D view.', reefAddType:'Add an object', reefAdd:'Add', reefSelection:'My objects', reefSelectAll:'Select all', reefEditSelected:'Edit', reefDeleteSelected:'Delete selected', reefNoObjects:'No objects in the reef.', reefSelect:'Select an object', reefPositionX:'Left / right', reefPositionZ:'Near / far', reefHeight:'Height', reefSize:'Size', reefRotation:'Rotation', reefMotion:'Swimming behaviour', reefCircle:'Swim in circles', reefPatrol:'Back and forth', reefEight:'Figure of eight', reefStill:'Stay in place', reefSchool:'Swim in a school', reefSchoolHint:'Fish of the same species form a school. Position, rotation, speed and radius apply to the whole group.', reefSpeed:'Swimming speed', reefRadius:'Swimming radius', reefColor:'Colour', reefOriginalColor:'Original', reefColorHelp:'Far left: original colour.', reefUndo:'Undo', reefDone:'Done', reefDuplicate:'Duplicate', reefRemove:'Remove', reefReset:'Default reef', reefSave:'Save', reefCancel:'Discard', reefHideHints:'Hide hints', reefHint:'Click an object, or touch and slide over objects without lifting your finger. Release to start editing. The green checkmark in the ring menu releases the selection.', reefFull:'Your reef is full. Remove an object first.', reefSaveFailed:'Your reef could not be saved. Your changes remain open here.', reefInvalid:'Your saved reef could not be loaded. Saving replaces it with the arrangement shown here.', reefResetTitle:'Restore the default reef?', reefResetCopy:'This replaces the arrangement with the default reef. It is only kept permanently after “Save”. Your Sudoku and points stay intact.',
    reduceMotion:'Reduce motion', reduceMotionHelp:'Quiet highlights instead of moving effects.', showConflicts:'Highlight conflicts', showConflictsHelp:'Marks duplicate numbers in rows, columns or boxes.',
    musicTitle:'Reef music', musicTrack:'Track', musicVolume:'Volume', musicStart:'Start music', musicPause:'Pause music', musicPlaying:'Now playing',
    musicHelp:'Random reef music without consecutive repeats. Pause lasts until reload; your volume is saved.', musicAwaiting:'Music is enabled. Tap the game to let your browser start playback.', musicError:'Music could not start. Please try again or choose another track.',
    sfxTitle:'Reef sounds', sfxEnabled:'Sound effects', sfxHelp:'Gentle sounds for moves and little achievements.', testSound:'Test sound',
    collection:'YOUR COLLECTION', achievementsCopy:'Every puzzle is a little dive. Collect your favourite discoveries.', trackAchievements:'Save achievements on this device',
    trackingHelp:'Achievement saving is enabled by default and can be switched off. Points, personal best and solved-puzzle totals are saved locally independently.', deleteProgress:'Delete collection and points',
    restart:'Restart', restartTitle:'Restart this puzzle?', restartCopy:'Entries, notes and round time will reset. The puzzle and points already collected will stay.', restartDone:'Current puzzle reset.', replayScore:'This puzzle has already been scored. Solving it again adds no further total points.',
    points:'points', totalPoints:'Total points', roundPoints:'Round points', bestRound:'Personal best', solvedPuzzles:'Solved puzzles', activeTime:'Active play time', playTime:'Play time', scoreHow:'How do points work?',
    scoreBase:'Base points', scoreTime:'Time bonus', scoreClean:'No wrong entries', scoreDirect:'No undo', scoreMilestone:'Every fifth puzzle',
    scoreRules:'Easy: 1,000, Medium: 2,000, Hard: 3,000 base points. Earn up to 50% time bonus, decreasing to zero over 10 / 20 / 40 active minutes. No wrong entries adds 20%, no undo adds 10%. Every fifth solved puzzle earns another 500 points. Notes do not count as mistakes. Points are awarded once on completion; base points remain even for long rounds. Time pauses in menus and in the background. Points, personal best and solved-puzzle totals are always saved locally. Existing puzzles start timing from this update.',
    winEyebrow:'A LITTLE MOMENT OF BRILLIANCE', winTitle:'Beautifully solved!', winCopy:'Every number has found its place. Your next reef break is waiting.', winNext:'Explore another puzzle',
    resetStorage:'Reset storage', storageInvalid:'Your saved game could not be safely loaded. It remains untouched. This game will not be saved for now.',
    storageFailed:'Your browser cannot save right now. You can keep playing; keep this window open to retain your current progress.', unsaved:'Not saved',
    readOnly:'Already open in another window. This window is read-only. Reload after closing the other window to edit.', offlineReady:'Ready offline', offlinePreparing:'Preparing offline files',
    generationFailed:'This puzzle could not be created. Please try again.', replaceTitle:'Ready for another dive?', replaceCopy:'A new Sudoku will replace your current puzzle. Your achievement progress will stay.',
    deleteTitle:'Reset your pearl collection?', deleteCopy:'Total points, personal best, achievement counts and badges will be deleted on this device. Your Sudoku will stay.',
    stopTrackingTitle:'Turn off achievement saving?', stopTrackingCopy:'Achievement counts and badges will be deleted. Your points, personal best and Sudoku will stay.',
    resetTitle:'Replace the saved game?', resetCopy:'The unreadable local save will be replaced by the game currently shown here.', unlocked:'Unlocked', trackingOff:'Saving off',
    filled:'squares filled', remaining:'squares left to discover', completed:'All 81 squares solved. Beautiful work!',
    firstCondition:'Solve one round', flowCondition:'Solve 10 rounds', magicCondition:'Solve 50 rounds', starsCondition:'Solve 100 rounds', varietyCondition:'Solve every difficulty once', crownCondition:'Solve 5 hard rounds', directCondition:'Solve a round without undo',
    close:'Close', cell:'Row', column:'column', given:'Given', empty:'Empty', conflict:'Rule conflict', newAchievement:'New achievement',
    helpContent:'<h3>Take a little dive</h3><p>Fill each row, column and 3×3 box with the numbers 1–9, using each number exactly once. Given numbers cannot be changed.</p><p>Select a square and then a number. Use notes to collect candidates. Undo restores your previous move and its notes. Restart clears entries and notes after confirmation, keeping the same puzzle and points already collected. Duplicate numbers can be highlighted.</p><h3>Your own aquarium</h3><p>The fish button in the header hides Sudoku so you can enjoy your reef. Tap the fish button again to return. Puzzle time pauses; fish and music continue when motion and music are enabled.</p><p>Open Settings → Arrange my reef to place, move, rotate and resize fish, plants and corals. With touch, place your finger on the reef and slide over objects without lifting it. The current target is tinted gold across its whole surface. Release to open its editing controls. Then drag to edit. The green checkmark in the ring menu releases the selection. Choose swimming behaviour, speed and radius for fish. Selection and sliders also work without dragging. Save keeps your reef locally; Discard restores your previous arrangement. Your Sudoku pauses while you edit.</p><h3>Play without distractions</h3><p>Accidental text selection, image dragging and browser menus are suppressed on the game surface. Info text remains copyable. During active play, the screen stays awake where the browser and power settings allow it. This pauses in menus and in the background.</p><h3>Your game stays with you</h3><p>Your game, banked points and preferences are saved locally in this browser. Achievement saving is optional. Clearing site data, changing devices or changing the address can remove access to your progress.</p><p>The app downloads its offline files in the background. After the complete download, reopen the same address without internet and generate new puzzles. Updates are activated only after your confirmation.</p><h3>Open project</h3><p>MarensSudoku · Babylon.js 9.32.1. Original code and documentation are MIT licensed. Generated graphics are shared to the extent the necessary rights exist; exclusive copyright protection is not guaranteed.</p><p><a href="https://github.com/MarensSudoku/MarensSudoku.github.io" target="_blank" rel="noopener noreferrer">Source on GitHub</a></p>',
  },
};
const state = load();
let game = state.game, progress = state.progress, scores = state.scores, settings = state.settings;
let storageBlocked = state.problem, readOnly = false, busy = false, noteMode = false;
let selection = game ? Math.max(0, game.values.findIndex(v => !v)) : 0;
let workerJob = null, generation = 0, waitingRegistration = null;
let clockAt = performance.now(), clockGame = null, clockActive = false, clockTicks = 0;
const screenWake = createScreenWakeLock();
const media = matchMedia('(prefers-reduced-motion: reduce)');
const t = key => text[settings.language][key] || text.de[key] || key;
const reduced = () => settings.reducedMotion || media.matches;
let aquarium, aquariumReady, reefEditor, reefEditing = false, reefViewing = false, screenActive = false;
function updateBackground() {
  aquarium?.updateOptions({ reduced:reduced(), dark:settings.theme === 'dark' });
}
const music = setupMusic(settings, t, persist);
const scene = createEffects('board-effects');
scene.onReady = renderBoard;

const cells = [];
for (let row = 0; row < 9; row++) {
  const line = document.createElement('div'); line.className = 'board-row'; line.setAttribute('role', 'row');
  for (let col = 0; col < 9; col++) {
    const index = row * 9 + col, cell = document.createElement('button');
    cell.type = 'button'; cell.className = 'cell'; cell.dataset.index = index; cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-colindex', col + 1); cell.setAttribute('aria-rowindex', row + 1);
    cell.addEventListener('click', () => { selection = index; renderBoard(); });
    line.append(cell); cells.push(cell);
  }
  $('board').append(line);
}
for (let n = 1; n <= 9; n++) {
  const button = document.createElement('button'); button.type = 'button'; button.textContent = n; button.dataset.number = n;
  button.addEventListener('click', () => input(n)); $('number-pad').append(button);
}

function announce(message) { $('announcement').textContent = message; }
function showNotice(key) { $('notice').hidden = false; $('notice-text').textContent = t(key); }
function renderRoundStats() {
  const seconds = Math.floor((game?.elapsedMs || 0) / 1000), minutes = Math.floor(seconds / 60);
  $('round-time').textContent = `${String(minutes).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
  $('round-time').setAttribute('datetime', `PT${seconds}S`); $('round-time').title = t('activeTime');
  $('round-points').textContent = scores.points.toLocaleString(settings.language);
  $('round-points').title = t('totalPoints');
}
function syncClock() {
  const now = performance.now();
  if (clockActive && clockGame === game && !game.completionRecorded) game.elapsedMs = Math.min(Number.MAX_SAFE_INTEGER, game.elapsedMs + Math.round(now - clockAt));
  clockAt = now; clockGame = game;
  const available=!busy&&!readOnly&&!document.hidden&&!document.querySelector('dialog[open]');
  clockActive=Boolean(game&&!game.completionRecorded&&available&&!reefEditing&&!reefViewing);
  const awake=available&&(clockActive||reefEditing||reefViewing);
  if(awake!==screenActive){screenActive=awake;screenWake.update(awake);}
  renderRoundStats();
}
function persist() {
  syncClock();
  if (storageBlocked || readOnly) return;
  const ok = save(game, settings, progress, scores);
  if (!ok) showNotice('storageFailed');
}
function renderText() {
  document.documentElement.lang = settings.language;
  document.querySelectorAll('[data-t]').forEach(node => { node.textContent = t(node.dataset.t); });
  document.querySelectorAll('.dialog-close').forEach(node => { node.setAttribute('aria-label', t('close')); });
  $('settings-open').setAttribute('aria-label', t('settings'));
  $('settings-open').title = t('settings');
  $('help-open').setAttribute('aria-label', waitingRegistration ? `${t('help')} · ${t('update')}` : t('help'));
  $('help-open').title = t('help');
  $('reef-view-toggle').title=t(reefViewing?'reefReturn':'reefView');
  $('reef-view-toggle').setAttribute('aria-label',$('reef-view-toggle').title);
  $('achievements-nav').setAttribute('aria-label', t('achievements'));
  $('achievements-nav').title = t('achievements');
  $('number-pad').setAttribute('aria-label', settings.language === 'de' ? 'Zahlen' : 'Numbers');
  $('language').value = settings.language; $('dark-theme').checked = settings.theme === 'dark';
  $('reduced-motion').checked = settings.reducedMotion; $('show-conflicts').checked = settings.showConflicts; $('tracking').checked = settings.tracking;
  $('sfx-enabled').checked = settings.sfxEnabled; $('sfx-volume').value = Math.round(settings.sfxVolume * 100); $('sfx-volume-value').textContent = `${$('sfx-volume').value} %`;
  document.body.dataset.theme = settings.theme; document.body.dataset.reduced = reduced();
  updateBackground();
  $('help-content').className = 'help-copy'; $('help-content').innerHTML = t('helpContent');
  reefEditor?.renderText();
  $('reef-editor-status').textContent=reefEditor?'':t(['unavailable','awaiting-models'].includes($('reef-aquarium').dataset.status)?'reefUnavailable':'reefLoading');
  if (storageBlocked) { showNotice('storageInvalid'); $('storage-reset').hidden = false; }
  if (readOnly) showNotice('readOnly');
  if (game) $('difficulty').value = game.difficulty;
  renderBoard(); renderAchievements(); music.render();
}
function renderBoard() {
  syncClock();
  $('undo').disabled = !game || !game.history.length || busy || readOnly;
  $('notes').disabled = !game || busy || readOnly; $('erase').disabled = !game || busy || readOnly;
  $('notes').setAttribute('aria-pressed', String(noteMode));
  $('new-game').disabled = busy || readOnly; $('restart-game').disabled = !game || busy || readOnly; $('difficulty').disabled = busy || readOnly;
  $('generation-cancel').disabled = !game;
  document.querySelectorAll('#number-pad button').forEach(button => {
    const n = Number(button.dataset.number), done = Boolean(game && game.values.filter(value => value === n).length >= 9);
    const noted = Boolean(game && !game.values[selection] && game.notes[selection] & (1 << n));
    button.disabled = !game || busy || readOnly;
    button.classList.toggle('is-selected', Boolean(game && game.values[selection] === n));
    button.classList.toggle('is-noted', noted); button.classList.toggle('is-complete', done);
    button.setAttribute('aria-label', [n, done && t('numberDone'), noted && t('noted')].filter(Boolean).join(', '));
  });
  if (!game) return;
  $('board-shell').classList.add('ready');
  const errors = settings.showConflicts ? conflicts(game.values) : new Set();
  cells.forEach((cell, i) => {
    const notes = Array.from({ length: 9 }, (_, n) => n + 1).filter(n => game.notes[i] & (1 << n));
    cell.classList.toggle('is-peer', PEERS[selection].includes(i));
    cell.classList.toggle('is-matching', Boolean(game.values[selection] && game.values[i] === game.values[selection]));
    cell.replaceChildren(); cell.classList.toggle('is-given', Boolean(game.puzzle[i]));
    if (game.values[i]) {
      const value = document.createElement('span'); value.className = 'cell-value'; value.textContent = game.values[i]; value.setAttribute('aria-hidden','true'); cell.append(value);
    } else if (notes.length) {
      const candidates = document.createElement('span'); candidates.className = 'cell-notes'; candidates.setAttribute('aria-hidden','true');
      for (let n = 1; n <= 9; n++) { const value = document.createElement('span'); value.textContent = notes.includes(n) ? n : ''; candidates.append(value); }
      cell.append(candidates);
    }
    cell.tabIndex = i === selection ? 0 : -1;
    cell.setAttribute('aria-selected', String(i === selection)); cell.setAttribute('aria-readonly', String(Boolean(game.puzzle[i] || readOnly)));
    cell.setAttribute('aria-invalid', String(errors.has(i)));
    cell.setAttribute('aria-label', `${t('cell')} ${Math.floor(i / 9) + 1}, ${t('column')} ${i % 9 + 1}, ${game.values[i] || t('empty')}${game.puzzle[i] ? ', ' + t('given') : ''}${notes.length ? ', ' + t('notes') + ' ' + notes.join(', ') : ''}${errors.has(i) ? ', ' + t('conflict') : ''}`);
  });
  const count = game.values.filter(Boolean).length;
  $('remaining').textContent = isSolved(game.values) ? t('completed') : `${81 - count} ${t('remaining')}`;
  scene.updateOptions({ reduced: reduced(), sfxEnabled:settings.sfxEnabled, sfxVolume:settings.sfxVolume });
}
function renderAchievements() {
  for (const [id,value] of [['collection-points',scores.points],['collection-best',scores.best],['collection-solved',scores.solved]]) $(id).textContent = value.toLocaleString(settings.language);
  $('achievement-count').textContent = progress.unlocked.length;
  if (settings.tracking) $('treasure-caption').textContent = `${progress.unlocked.length} / ${ACHIEVEMENTS.length} ${t('achievements')}`;
  else $('treasure-caption').textContent = t('treasureCopy');
  $('progress-delete').disabled = readOnly || (!scores.solved && !progress.total); $('tracking').disabled = readOnly || storageBlocked;
  $('achievement-grid').replaceChildren();
  for (const a of ACHIEVEMENTS) {
    const value = Math.min(a.target, progressValue(progress, a)), unlocked = progress.unlocked.includes(a.id);
    const article = document.createElement('article'); article.className = 'achievement' + (unlocked ? ' unlocked' : '');
    const icon = document.createElement('span'); icon.className = 'achievement-icon'; icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = `<svg><use href="#i-${a.icon}"/></svg>`;
    const title = document.createElement('h3'); title.textContent = settings.language === 'de' ? a.name : a.en;
    const description = document.createElement('p'); description.textContent = t(a.id + 'Condition');
    const meter = document.createElement('progress'); meter.max = a.target; meter.value = value; meter.setAttribute('aria-label', title.textContent);
    const label = document.createElement('small'); label.textContent = !settings.tracking ? t('trackingOff') : unlocked ? t('unlocked') : `${value} / ${a.target}`;
    article.append(icon, title, description, meter, label); $('achievement-grid').append(article);
  }
}
function input(number) {
  if (!game || busy || readOnly) return;
  syncClock();
  const before = fullUnits(game);
  if (!enter(game, selection, number, noteMode && number !== 0)) return;
  const solved = isSolved(game.values), firstWin = solved && !game.completionRecorded;
  const replayed = firstWin && game.credited;
  const fresh = firstWin ? complete(game, progress, settings.tracking, scores) : [];
  persist(); renderBoard(); renderAchievements();
  if (!reduced()) cells[selection].querySelector('.cell-value')?.classList.add('value-pop');
  if (firstWin) {
    $('win-score-status').hidden = !replayed; $('win-score-status').textContent = t('replayScore');
    $('win-points').textContent = game.score.total.toLocaleString(settings.language);
    $('score-breakdown').replaceChildren();
    for (const [key,label] of [['base','scoreBase'],['time','scoreTime'],['clean','scoreClean'],['direct','scoreDirect'],['milestone','scoreMilestone']]) {
      const name = document.createElement('dt'), value = document.createElement('dd');
      name.textContent = t(label); value.textContent = `+${game.score[key].toLocaleString(settings.language)}`;
      $('score-breakdown').append(name,value);
    }
    $('new-achievements').replaceChildren();
    for (const a of fresh) { const item = document.createElement('div'); item.className = 'new-badge'; item.textContent = `${t('newAchievement')}: ${settings.language === 'de' ? a.name : a.en}`; $('new-achievements').append(item); }
    scene.playSfx('win'); scene.celebrate(); $('win-dialog').classList.toggle('motion-celebrate', !reduced()); $('win-dialog').showModal(); announce(t('completed'));
  } else {
    const added = fullUnits(game).filter(n => !before.includes(n));
    scene.shimmer(added); scene.playSfx(added.length ? 'unit' : noteMode && number ? 'note' : number ? 'entry' : 'erase');
  }
}
function confirmation(title, copy) {
  return new Promise(resolve => {
    const dialog = $('confirm-dialog');
    if (dialog.open) { resolve(false); return; }
    $('confirm-title').textContent = t(title); $('confirm-copy').textContent = t(copy);
    const finish = value => { dialog.close(); $('confirm-yes').onclick = null; $('confirm-no').onclick = null; dialog.oncancel = null; resolve(value); };
    $('confirm-yes').onclick = () => finish(true); $('confirm-no').onclick = () => finish(false);
    dialog.oncancel = event => { event.preventDefault(); finish(false); }; dialog.showModal(); $('confirm-no').focus();
  });
}
async function newPuzzle(difficulty = $('difficulty').value, ask = true) {
  if (readOnly || busy) return;
  if (ask && game && !isSolved(game.values)) {
    if (!await confirmation('replaceTitle', 'replaceCopy')) { $('difficulty').value = game.difficulty; return; }
  }
  $('settings-dialog').close();
  const hadGame = Boolean(game), token = ++generation; busy = true; renderBoard(); $('loading').hidden = false;
  scene.stopEffects();
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const result = await new Promise(resolve => {
    const worker = new Worker(new URL('./sudoku/worker.mjs', import.meta.url), { type: 'module' });
    const finish = data => { clearTimeout(timer); worker.terminate(); if (workerJob?.worker === worker) workerJob = null; resolve(data); };
    const timer = setTimeout(() => finish(null), 12000); workerJob = { worker, finish };
    worker.onmessage = ({ data }) => finish(data.puzzle || null); worker.onerror = () => finish(null);
    worker.postMessage({ difficulty, seed });
  }).catch(() => null);
  if (token !== generation) return;
  busy = false; $('loading').hidden = true;
  if (result && validGame(createGame(result))) {
    game = createGame(result); selection = Math.max(0, game.values.findIndex(v => !v)); noteMode = false;
    $('difficulty').value = difficulty; persist(); announce(t('gameTitle'));
  } else { showNotice('generationFailed'); if (game) $('difficulty').value = game.difficulty; }
  renderBoard();
  if (result && hadGame) scene.playSfx('new');
}
$('generation-cancel').addEventListener('click', () => {
  generation++; workerJob?.finish(null); busy = false; $('loading').hidden = true; if (game) $('difficulty').value = game.difficulty; renderBoard();
});
$('new-game').addEventListener('click', () => newPuzzle());
$('restart-game').addEventListener('click', async () => {
  if (!game || busy || readOnly || !await confirmation('restartTitle','restartCopy')) return;
  game = restartGame(game); selection = Math.max(0, game.values.findIndex(v => !v)); noteMode = false;
  scene.stopEffects(); persist(); renderBoard(); renderAchievements(); scene.playSfx('new'); announce(t('restartDone'));
});
$('difficulty').addEventListener('change', () => newPuzzle());
$('win-next').addEventListener('click', () => { $('win-dialog').close(); newPuzzle(game.difficulty, false); });
$('undo').addEventListener('click', () => { if (game && !busy && !readOnly && undo(game)) { persist(); renderBoard(); scene.playSfx('erase'); } });
$('notes').addEventListener('click', () => { noteMode = !noteMode; renderBoard(); });
$('erase').addEventListener('click', () => input(0));
$('board').addEventListener('keydown', event => {
  if (!game || busy) return;
  const row = Math.floor(selection / 9), col = selection % 9;
  const next = { ArrowLeft: row * 9 + Math.max(0, col - 1), ArrowRight: row * 9 + Math.min(8, col + 1), ArrowUp: Math.max(0, row - 1) * 9 + col, ArrowDown: Math.min(8, row + 1) * 9 + col }[event.key];
  if (next !== undefined) { event.preventDefault(); selection = next; renderBoard(); cells[selection].focus(); }
});
document.addEventListener('keydown', event => {
  if (reefEditing || reefViewing || document.querySelector('dialog[open]') || /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return;
  if (/^[1-9]$/.test(event.key)) { event.preventDefault(); input(Number(event.key)); }
  else if (['Delete','Backspace'].includes(event.key)) { event.preventDefault(); input(0); }
  else if (event.key.toLowerCase() === 'n' && !readOnly && !busy) { noteMode = !noteMode; renderBoard(); }
});
for (const type of ['contextmenu', 'selectstart', 'dragstart']) {
  document.body.addEventListener(type, event => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (target && !target.closest('input, textarea, select, [contenteditable], #help-dialog .dialog-body')) event.preventDefault();
  });
}
for (const type of ['pointerdown', 'keydown']) document.addEventListener(type, () => screenWake.update(screenActive), { passive:true });
document.querySelectorAll('.dialog-close').forEach(button => button.addEventListener('click', () => {
  const dialog = button.closest('dialog');
  if (dialog.id === 'confirm-dialog') $('confirm-no').click(); else dialog.close();
}));
for (const id of ['achievements-nav','treasure-open']) $(id).addEventListener('click', () => { renderAchievements(); $('achievements-dialog').showModal(); });
$('settings-open').addEventListener('click', () => $('settings-dialog').showModal());
function setReefView(active) {
  syncClock();reefViewing=active;document.body.dataset.reefView=String(active);
  $('reef-view-toggle').setAttribute('aria-pressed',String(active));
  $('reef-view-toggle').title=t(active?'reefReturn':'reefView');
  $('reef-view-toggle').setAttribute('aria-label',$('reef-view-toggle').title);
  $('reef-view-actions').hidden=!active;syncClock();
  if(active){scene.stopEffects();$('reef-view-toggle').focus();}else cells[selection].focus();
}
$('reef-view-toggle').addEventListener('click',()=>setReefView(!reefViewing));
$('help-open').addEventListener('click', () => $('help-dialog').showModal());
// The welcome click is the user gesture that lets the reef music start.
// The rule steps point at the row, column and box of one empty square that the tour also solves.
const boxOf = i => Math.floor(i / 27) * 3 + Math.floor(i % 9 / 3);
const fits = i => [1,2,3,4,5,6,7,8,9].filter(n => !PEERS[i].some(peer => game.values[peer] === n));
const TOUR = [
  ['tourIntro', () => [$('board-shell')]],
  ['tourRow', () => cells.filter((_, i) => Math.floor(i / 9) === Math.floor(selection / 9))],
  ['tourColumn', () => cells.filter((_, i) => i % 9 === selection % 9)],
  ['tourBox', () => cells.filter((_, i) => boxOf(i) === boxOf(selection))],
  ['tourGiven', () => game ? cells.filter((_, i) => game.puzzle[i]) : []],
  ['tourSolve', () => game && !game.values[selection] ? [cells[selection]] : []],
  ['tourPad', () => [$('number-pad')]], ['tourNotes', () => [$('notes')]], ['tourTools', () => [document.querySelector('.game-tools')]],
  ['tourFocus', () => [cells[selection]], () => {document.body.dataset.tourColors='true';}],
  ['tourMatching', () => cells.filter(cell=>cell.classList.contains('is-matching')), () => {
    selection=Math.max(0,game.values.findIndex(Boolean));renderBoard();document.body.dataset.tourColors='true';
  }],
  ['tourErrors', () => [cells[tourError]], () => {
    const given=game.values.findIndex(Boolean);tourError=PEERS[given].find(i=>!game.values[i]&&i!==selection)??selection;
    const cell=cells[tourError],value=document.createElement('span');value.className='cell-value';value.textContent=game.values[given];
    cell.replaceChildren(value);cell.setAttribute('aria-selected','false');cell.setAttribute('aria-invalid','true');cell.setAttribute('aria-label',t('tourErrorsTitle')+': '+value.textContent);
    document.body.dataset.tourColors='true';
  }],
  ['tourPadColors', () => [$('number-pad')], () => {
    const buttons=[...$('number-pad').children];buttons.forEach(button=>button.classList.remove('is-selected','is-noted','is-complete'));
    buttons[0].classList.add('is-selected');buttons[1].classList.add('is-noted');buttons[2].classList.add('is-complete');
  }],
  ['tourStats', () => [document.querySelector('.round-stats')]], ['tourReef', () => [$('reef-view-toggle')]],
  ['tourEditorIntro', () => [document.querySelector('.reef-editor-top')]],
  ['tourEditorSelect', () => [$('reef-object-tools')], () => aquarium.select(tourFish)],
  ['tourEditorMove', () => [document.querySelector('[data-reef-mode="move"]')], () => reefEditor.setMode('move')],
  ['tourEditorHeight', () => [document.querySelector('[data-reef-mode="height"]')], () => reefEditor.setMode('height')],
  ['tourEditorRotate', () => [...document.querySelectorAll('[data-reef-mode^="rotate"]')], () => reefEditor.setMode('rotate')],
  ['tourEditorScale', () => [document.querySelector('[data-reef-mode="scale"]')], () => reefEditor.setMode('scale')],
  ['tourEditorObjects', () => [$('reef-duplicate'),$('reef-remove')]],
  ['tourEditorColor', () => [$('reef-properties-dialog')], () => $('reef-properties-open').click()],
  ['tourEditorFish', () => [$('reef-properties-dialog')], () => {$('reef-fish-settings').open=true;}],
  ['tourEditorDone', () => [$('reef-deselect')]],
  ['tourEditorAdd', () => [$('reef-add-type')], () => aquarium.select(null)],
  ['tourEditorCatalog', () => [$('reef-picker-dialog')], () => reefEditor.showPicker(false)],
  ['tourEditorList', () => [$('reef-list-actions')], () => {
    reefEditor.showPicker(true);const check=$('reef-picker').querySelector('input');check.checked=true;check.dispatchEvent(new Event('change',{bubbles:true}));
  }],
  ['tourEditorUndo', () => [$('reef-undo')]], ['tourEditorReset', () => [$('reef-reset')]],
  ['tourEditorHints', () => [$('reef-hint-close')], () => {$('reef-hint').style.display='flex';}],
  ['tourEditorSave', () => [$('reef-finish'),$('reef-cancel')]],
  ['tourAchievements', () => [$('achievements-nav')]], ['tourSettings', () => [$('settings-open')]], ['tourHelp', () => [$('help-open')]],
];
let tour = [], tourStep = 0, tourTargets = [], tourSelection=selection, tourError=0, tourFish=null, tourEditorActive=false;
async function startTour() {
  const dialog=$('tour-dialog');dialog.showModal();$('tour-next').disabled=true;
  $('tour-title').textContent=t('tourIntroTitle');$('tour-copy').textContent=t('reefLoading');$('tour-step').textContent='';
  await aquariumReady;
  if(!dialog.open)return;
  if (game) {
    const open = game.values.flatMap((value, i) => value ? [] : [i]);
    if (open.length) selection = open.reduce((best, i) => fits(i).length < fits(best).length ? i : best);
    renderBoard();
  }
  tourSelection=selection;
  tour = TOUR.filter(([key, targets, prepare]) => key.startsWith('tourEditor') ? reefEditor&&!readOnly : prepare ? Boolean(game) : targets().some(node => node?.getClientRects().length));
  tourStep = 0;$('tour-next').disabled=false;showTourStep();
}
function placeTour() {
  if (!$('tour-dialog').open || !tourTargets.length) return;
  const bubble = $('tour-bubble'), rects = tourTargets.map(node => node.getBoundingClientRect()), pad = 6, gap = 16, edge = 12;
  const target = { top:Math.min(...rects.map(r => r.top)), bottom:Math.max(...rects.map(r => r.bottom)), left:Math.min(...rects.map(r => r.left)), right:Math.max(...rects.map(r => r.right)) };
  const room=Math.max(target.top-pad-gap-edge,innerHeight-target.bottom-pad-gap-edge);
  bubble.style.maxHeight=(room>=180?Math.min(innerHeight-edge*2,room):innerHeight-edge*2)+'px';
  const box=bubble.getBoundingClientRect();
  Object.assign($('tour-spotlight').style, { top:target.top-pad+'px', left:target.left-pad+'px', width:target.right-target.left+pad*2+'px', height:target.bottom-target.top+pad*2+'px' });
  const wanted = innerHeight - target.bottom >= target.top ? target.bottom + pad + gap : target.top - pad - gap - box.height;
  const top = Math.min(innerHeight - box.height - edge, Math.max(edge, wanted));
  const left = Math.min(innerWidth - box.width - edge, Math.max(edge, (target.left + target.right) / 2 - box.width / 2));
  bubble.style.top = top+'px'; bubble.style.left = left+'px';
  bubble.dataset.arrow = top >= target.bottom + pad ? 'up' : top + box.height <= target.top - pad ? 'down' : '';
  bubble.style.setProperty('--arrow-x', Math.min(box.width-26,Math.max(26,(target.left+target.right)/2-left))+'px');
}
function showTourStep() {
  for (const node of tourTargets) node.classList.remove('tour-target');
  delete document.body.dataset.tourColors;$('reef-hint').style.removeProperty('display');
  selection=tourSelection;renderBoard();
  const dialog = $('tour-dialog'), step = tour[tourStep],editor=step?.[0].startsWith('tourEditor');
  if(!editor&&tourEditorActive){reefEditor.finish(false);tourEditorActive=false;tourFish=null;}
  if (!step) { tourTargets = [];dialog.close();cells[selection].focus();return; }
  if(editor){
    if(!tourEditorActive){
      reefEditor.start();aquarium.setLayout(aquarium.defaultLayout);
      tourFish=aquarium.addObject('clownfish',{x:0,y:2.8,z:-6,scale:1.2,motion:'still'});aquarium.select(null);tourEditorActive=true;
    }
    dialog.close();
    if(!['tourEditorColor','tourEditorFish'].includes(step[0]))$('reef-properties-dialog').close();
    if(!['tourEditorCatalog','tourEditorList'].includes(step[0]))$('reef-picker-dialog').close();
  }
  step[2]?.();
  tourTargets=step[1]().filter(node=>node?.getClientRects().length);
  if(!tourTargets.length)tourTargets=[editor?$('reef-editor'):$('board-shell')];
  for (const node of tourTargets) node.classList.add('tour-target');
  let copy = t(step[0]);
  if (step[0] === 'tourSolve') { const left = fits(selection); copy += ' ' + (left.length === 1 ? t('tourSolveOne').replace('{n}', left[0]) : t('tourSolveMany').replace('{list}', left.join(', '))); }
  dialog.dataset.step=step[0];
  $('tour-step').textContent = t('tourStep').replace('{n}', tourStep + 1).replace('{total}', tour.length);
  $('tour-title').textContent = t(step[0] + 'Title'); $('tour-copy').textContent = copy;
  $('tour-next').textContent = t(tourStep === tour.length - 1 ? 'tourDone' : 'tourNext');
  if (!dialog.open) dialog.showModal();
  placeTour();requestAnimationFrame(placeTour);$('tour-next').focus();
}
$('welcome-start').addEventListener('click', () => { $('welcome-dialog').close(); cells[selection].focus(); });
$('welcome-tour').addEventListener('click', () => { $('welcome-dialog').close(); startTour(); });
$('help-tour').addEventListener('click', () => { $('help-dialog').close(); if (reefViewing) setReefView(false); startTour(); });
$('tour-next').addEventListener('click', () => { tourStep++; showTourStep(); });
$('tour-skip').addEventListener('click', () => { tourStep = tour.length; showTourStep(); });
$('tour-dialog').addEventListener('cancel', event => { event.preventDefault(); $('tour-skip').click(); });
window.addEventListener('resize', placeTour);
$('help-dialog').addEventListener('click', event => {
  const link = event.target.closest('a[href]');
  if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const section = [...$('help-dialog').querySelectorAll('details[data-document]')].find(details => new URL(details.dataset.document, location.href).href === link.href);
  if (!section) return;
  event.preventDefault(); section.open = true; section.querySelector('summary').focus();
});
function changeSettings() {
  if (readOnly) { renderText(); return; }
  settings.language = $('language').value; settings.theme = $('dark-theme').checked ? 'dark' : 'light';
  settings.reducedMotion = $('reduced-motion').checked; settings.showConflicts = $('show-conflicts').checked;
  renderText(); persist();
}
for (const id of ['language','dark-theme','reduced-motion','show-conflicts']) $(id).addEventListener('change', changeSettings);
$('sfx-enabled').addEventListener('change', () => { settings.sfxEnabled = $('sfx-enabled').checked; renderBoard(); persist(); });
$('sfx-volume').addEventListener('input', () => { settings.sfxVolume = Number($('sfx-volume').value) / 100; $('sfx-volume-value').textContent = `${$('sfx-volume').value} %`; renderBoard(); persist(); });
$('test-sound').addEventListener('click', () => scene.playSfx('achievement'));
document.addEventListener('click', event => { if (event.target.closest('button') && !event.target.closest('.cell, #number-pad, #undo, #erase, #test-sound, #new-game, #win-next')) scene.playSfx('menu'); });
$('tracking').addEventListener('change', async () => {
  if (readOnly || storageBlocked) return;
  if (!$('tracking').checked && progress.total > 0 && !await confirmation('stopTrackingTitle', 'stopTrackingCopy')) { $('tracking').checked = true; return; }
  settings.tracking = $('tracking').checked;
  if (!settings.tracking) progress = emptyProgress();
  persist(); renderBoard(); renderAchievements();
});
$('progress-delete').addEventListener('click', async () => {
  if (!readOnly && await confirmation('deleteTitle', 'deleteCopy')) { progress = emptyProgress(); scores = emptyScores(); persist(); renderBoard(); renderAchievements(); }
});
$('storage-reset').addEventListener('click', async () => {
  if (!readOnly && await confirmation('resetTitle', 'resetCopy')) { storageBlocked = false; $('notice').hidden = true; $('storage-reset').hidden = true; persist(); renderAchievements(); }
});
media.addEventListener('change', () => { document.body.dataset.reduced = reduced(); updateBackground(); renderBoard(); });
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY) return;
  if (readOnly) { const fresh = load(); if (fresh.game) { game = fresh.game; progress = fresh.progress; scores = fresh.scores; renderBoard(); renderAchievements(); } }
});
window.addEventListener('pagehide', () => { syncClock(); persist(); screenWake.update(false); workerJob?.worker.terminate(); });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
document.addEventListener('visibilitychange', () => { syncClock(); if (document.hidden) { persist(); scene.stopEffects(); } });
const dialogClock = new MutationObserver(syncClock);
document.querySelectorAll('dialog').forEach(dialog => dialogClock.observe(dialog, { attributes:true, attributeFilter:['open'] }));
setInterval(() => { syncClock(); if (clockActive && ++clockTicks % 5 === 0) persist(); }, 1000);
async function acquireWriter() {
  if (!navigator.locks) return;
  readOnly = !await new Promise(resolve => {
    navigator.locks.request('marenssudoku:writer', { ifAvailable: true }, async lock => {
      resolve(Boolean(lock));
      if (lock) await new Promise(release => window.addEventListener('pagehide', release, { once: true }));
    }).catch(() => resolve(false));
  });
  if (readOnly) showNotice('readOnly');
}
async function offlineSetup() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('./sw.js');
    const offer = () => { if (registration.waiting && navigator.serviceWorker.controller) { waitingRegistration = registration; $('update-notice').hidden = false; $('update-badge').hidden = false; renderText(); } };
    offer(); registration.addEventListener('updatefound', () => { registration.installing?.addEventListener('statechange', offer); });
  } catch {}
}
$('update').addEventListener('click', () => {
  if (busy || readOnly || storageBlocked || !save(game, settings, progress, scores)) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  waitingRegistration?.waiting?.postMessage('ACTIVATE');
});
renderText();
const firstVisit=!state.game&&!state.problem;
$('welcome-dialog').classList.toggle('first-visit',firstVisit);$('welcome-tutorial-hint').hidden=!firstVisit;
if(firstVisit)$('welcome-tour').setAttribute('aria-describedby','welcome-tutorial-hint');
await acquireWriter();
$('welcome-dialog').showModal();
renderBoard();
if (game) { $('loading').hidden = true; persist(); }
else if (!readOnly) newPuzzle('easy', false);
else $('loading').hidden = true;
offlineSetup();
aquariumReady=import('./game/aquarium.mjs').then(module => module.createAquarium($('reef-aquarium'))).then(result => {
  aquarium=result;updateBackground();
  if(!result){$('reef-editor-status').textContent=t('reefUnavailable');return;}
  reefEditor=setupReefEditor(result,{t,language:()=>settings.language,readOnly,
    confirmReset:()=>confirmation('reefResetTitle','reefResetCopy'),
    onModeChange(active){syncClock();reefEditing=active;syncClock();if(active)scene.stopEffects();else if(reefViewing)$('reef-view-toggle').focus();else cells[selection].focus();},
  });
}).catch(() => { $('reef-aquarium').dataset.status = 'unavailable'; $('reef-editor-status').textContent=t('reefUnavailable'); });
