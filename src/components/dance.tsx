import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import "./dance.css";

type Direction = "up" | "down" | "left" | "right";

interface Note {
  id: number;
  direction: Direction;
  position: number;
  hit: boolean;
}

const DIRECTIONS: Direction[] = ["up", "down", "left", "right"];
const GAME_HEIGHT = window.innerHeight;
const HIT_ZONE = (GAME_HEIGHT / 100) * 88; // 80% dell'altezza del gioco
const HIT_TOLERANCE = 50; // Aumentato per rendere più facile colpire le note lente
const BPM = 120; // Battiti per minuto
const BEAT_INTERVAL = (60 / BPM) * 1000; // Millisecondi tra ogni beat
const NOTE_SPEED = 1.5; // Velocità fissa più lenta per evitare sparizioni
console.log("HIT_ZONE", GAME_HEIGHT, HIT_ZONE);
// Pattern musicali predefiniti (ogni numero rappresenta un beat, 0 = pausa)
const SONG_PATTERNS = [
  // Pattern 1 - Semplice
  [1, 0, 1, 0, 2, 0, 1, 0, 3, 0, 2, 0, 4, 0, 1, 0],
  // Pattern 2 - Medio
  [1, 2, 0, 3, 1, 0, 4, 2, 0, 1, 3, 0, 2, 4, 0, 1],
  // Pattern 3 - Complesso
  [1, 2, 3, 0, 4, 1, 0, 2, 3, 4, 0, 1, 2, 0, 3, 4],
];

const COLORS = {
  up: "bg-red-500 hover:bg-red-600",
  down: "bg-blue-500 hover:bg-blue-600",
  left: "bg-green-500 hover:bg-green-600",
  right: "bg-yellow-500 hover:bg-yellow-600",
};

export default function DanceHero() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [nextNoteId, setNextNoteId] = useState(1);
  const [pressedKeys, setPressedKeys] = useState<Set<Direction>>(new Set());
  const [currentPatternIndex, setCurrentPatternIndex] = useState(0);
  const [currentBeatIndex, setCurrentBeatIndex] = useState(0);
  const [lastBeatTime, setLastBeatTime] = useState(0);

  const getDirectionIcon = (direction: Direction) => {
    switch (direction) {
      case "up":
        return <ChevronUp size={32} />;
      case "down":
        return <ChevronDown size={32} />;
      case "left":
        return <ChevronLeft size={32} />;
      case "right":
        return <ChevronRight size={32} />;
    }
  };

  const generateNote = useCallback(
    (direction: Direction) => {
      const newNote: Note = {
        id: nextNoteId,
        direction,
        position: -50,
        hit: false,
      };
      setNotes((prev) => [...prev, newNote]);
      setNextNoteId((prev) => prev + 1);
    },
    [nextNoteId]
  );

  const generateNoteFromPattern = useCallback(() => {
    const currentPattern = SONG_PATTERNS[currentPatternIndex];
    const beatValue = currentPattern[currentBeatIndex];

    if (beatValue > 0) {
      // beatValue 1-4 corrispondono agli indici 0-3 delle direzioni
      const direction = DIRECTIONS[beatValue - 1];
      generateNote(direction);
    }

    // Avanza al prossimo beat
    const nextBeatIndex = (currentBeatIndex + 1) % currentPattern.length;
    setCurrentBeatIndex(nextBeatIndex);

    // Se abbiamo finito il pattern, passa al successivo
    if (nextBeatIndex === 0) {
      setCurrentPatternIndex((prev) => (prev + 1) % SONG_PATTERNS.length);
    }
  }, [currentPatternIndex, currentBeatIndex, generateNote]);

  const checkHit = useCallback(
    (direction: Direction) => {
      setNotes((prev) => {
        const notesInHitZone = prev.filter((note) => {
          console.log("NOTE POSITION:", note.position);
          return (
            note.direction === direction &&
            !note.hit &&
            Math.abs(note.position - HIT_ZONE) < HIT_TOLERANCE
          );
        });

        if (notesInHitZone.length > 0) {
          const hitNote = notesInHitZone[0];
          const accuracy = Math.abs(hitNote.position - HIT_ZONE);
          let points = 100;

          // Debug per vedere quando viene colpita una nota
          console.log(
            `Hit! Note position: ${hitNote.position}, Hit zone: ${HIT_ZONE}, Accuracy: ${accuracy}`
          );

          if (accuracy < 20) points = 300; // Perfect - zona più ampia
          else if (accuracy < 35) points = 200; // Great - zona più ampia
          else if (accuracy < 50) points = 150; // Good - zona più ampia

          setScore((s) => s + points * (combo + 1));
          setCombo((c) => c + 1);
          setMaxCombo((mc) => Math.max(mc, combo + 1));

          return prev.map((note) =>
            note.id === hitNote.id ? { ...note, hit: true } : note
          );
        } else {
          // Debug per vedere quando si manca
          const nearbyNotes = prev
            .filter((note) => note.direction === direction && !note.hit)
            .map((note) => ({
              id: note.id,
              position: note.position,
              distance: Math.abs(note.position - HIT_ZONE),
            }));

          console.log(
            `Miss! Direction: ${direction}, Nearby notes:`,
            nearbyNotes
          );

          // Miss - reset combo
          setCombo(0);
          return prev;
        }
      });
    },
    [combo]
  );

  const handleKeyPress = useCallback(
    (direction: Direction) => {
      if (!gameStarted) return;

      setPressedKeys((prev) => new Set([...Array.from(prev), direction]));
      checkHit(direction);

      // Remove the pressed state after a short delay
      setTimeout(() => {
        setPressedKeys((prev) => {
          const newSet = new Set(prev);
          newSet.delete(direction);
          return newSet;
        });
      }, 150);
    },
    [gameStarted, checkHit]
  );

  // Game loop - movimento delle note
  useEffect(() => {
    if (!gameStarted) return;

    const gameLoop = setInterval(() => {
      // Move notes down
      setNotes((prev) => {
        const updatedNotes = prev
          .map((note) => ({ ...note, position: note.position + NOTE_SPEED }))
          .filter((note) => {
            // Rimuovi le note solo quando sono MOLTO oltre la fine dell'area di gioco
            // Con NOTE_SPEED = 1.5, ci vogliono molti secondi per raggiungere 1000px
            return note.position < 1000;
          });

        return updatedNotes;
      });
    }, 16); // Ripristino 60 FPS per movimento fluido

    return () => clearInterval(gameLoop);
  }, [gameStarted]);

  // Beat generator - genera note a tempo di musica
  useEffect(() => {
    if (!gameStarted) return;

    const currentTime = Date.now();
    setLastBeatTime(currentTime);

    const beatGenerator = setInterval(() => {
      generateNoteFromPattern();
    }, BEAT_INTERVAL);

    return () => clearInterval(beatGenerator);
  }, [gameStarted, generateNoteFromPattern]);

  const startGame = () => {
    setGameStarted(true);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setNotes([]);
    setNextNoteId(1);
    setCurrentPatternIndex(0);
    setCurrentBeatIndex(0);
    setLastBeatTime(Date.now());
  };

  const resetGame = () => {
    setGameStarted(false);
    setNotes([]);
  };

  if (!gameStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-purple-900 text-white p-4">
        <div className="text-center max-w-md">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-pink-300 to-purple-300 bg-clip-text text-transparent">
            💃 Dance Hero 💃
          </h1>
          <div className="text-lg mb-6 text-purple-200 leading-relaxed">
            <p>Buon compleanno! 🎉</p>
            <p>Premi le frecce a tempo di musica!</p>
            <div className="mt-2 text-yellow-400 font-bold animate-pulse">
              ♪ BPM: {BPM} ♪
            </div>
          </div>
          <button
            onClick={startGame}
            className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 px-8 py-3 rounded-full text-xl font-bold transition-all transform hover:scale-105 shadow-lg"
          >
            Inizia a Ballare! 🎵
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-purple-900 text-white gameArea">
      {/* Header */}
      <div
        className="flex justify-between items-center p-4 bg-black/20 danceHeader"
        style={{ zIndex: 10 }}
      >
        <div className="text-base md:text-lg font-bold">
          Score:{" "}
          <span className="text-yellow-300">{score.toLocaleString()}</span>
        </div>
        <div className="text-base md:text-lg font-bold">
          Combo: <span className="text-pink-300">{combo}</span>
        </div>
        <button
          onClick={resetGame}
          className="bg-red-500 hover:bg-red-600 px-3 md:px-4 py-2 rounded transition-colors text-sm md:text-base"
        >
          Reset
        </button>
      </div>

      {/* Game Area */}
      <div className="relative bg-black/10 notesArea">
        {/* Track lines */}
        <div className="absolute inset-0 flex">
          {DIRECTIONS.map((direction, index) => (
            <div
              key={direction}
              className="flex-1 border-r border-white/20 relative"
            >
              {/* Hit zone indicator */}
              <div className="absolute w-full h-12 border-2 border-white/50 bg-white/10 rounded clickArea" />
            </div>
          ))}
        </div>

        {/* Notes */}
        {notes.map((note) => (
          <div
            key={note.id}
            className={`absolute w-16 h-16 rounded-full flex items-center justify-center text-white font-bold shadow-lg transition-all duration-300 ${
              note.hit ? "opacity-0 scale-150" : "opacity-100 scale-100"
            } ${COLORS[note.direction]}`}
            style={{
              left: `${DIRECTIONS.indexOf(note.direction) * 25}%`,
              marginLeft: "calc(12.5% - 32px)",
              top: note.position,
            }}
          >
            {getDirectionIcon(note.direction)}
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="p-4 bg-black/30 controls">
        <div className="grid grid-cols-4 gap-3 md:gap-4 max-w-md mx-auto">
          {DIRECTIONS.map((direction) => (
            <button
              key={direction}
              onTouchStart={(e) => {
                e.preventDefault();
                handleKeyPress(direction);
              }}
              onClick={() => handleKeyPress(direction)}
              className={`h-16 md:h-20 rounded-lg flex items-center justify-center text-white font-bold text-xl md:text-2xl transition-all transform shadow-lg select-none ${
                pressedKeys.has(direction)
                  ? `${COLORS[direction]} scale-95 shadow-inner`
                  : `${COLORS[direction]} hover:scale-105 shadow-xl active:scale-95`
              }`}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {getDirectionIcon(direction)}
            </button>
          ))}
        </div>

        {maxCombo > 0 && (
          <div className="text-center mt-4 text-purple-200">
            Max Combo:{" "}
            <span className="text-yellow-300 font-bold">{maxCombo}</span>
          </div>
        )}
      </div>
      <div className="controls"></div>
    </div>
  );
}
