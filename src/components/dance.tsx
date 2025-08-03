import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  VolumeX,
  Volume2,
} from "lucide-react";
import "./dance.css"; // Importa il file CSS per gli stili personalizzati

type Direction = "up" | "down" | "left" | "right";

interface Note {
  id: number;
  direction: Direction;
  position: number;
  hit: boolean;
}

const DIRECTIONS: Direction[] = ["up", "down", "left", "right"];
const GAME_HEIGHT =
  typeof window !== "undefined" ? window.innerHeight - 96 : 600;
const HIT_ZONE = (GAME_HEIGHT / 100) * 88;
const HIT_TOLERANCE = 50;
const BPM = 120;
const BEAT_INTERVAL = (60 / BPM) * 1000;
const NOTE_SPEED = 1.5;

// Pattern musicali con note più interessanti - DEBUG VERSION
const SONG_PATTERNS = [
  [1, 0, 2, 0, 3, 0, 4, 0, 1, 2, 0, 3, 4, 0, 1, 0], // Tutte le direzioni
  [1, 2, 3, 4, 1, 0, 2, 0, 3, 0, 4, 0, 1, 2, 3, 4], // Sequenza completa
  [4, 3, 2, 1, 0, 4, 3, 2, 1, 0, 4, 3, 2, 1, 0, 0], // Reverse
  [1, 0, 1, 2, 0, 3, 0, 4, 1, 3, 0, 2, 4, 0, 1, 0], // Mix
];

const COLORS = {
  up: "bg-red-500 hover:bg-red-600",
  down: "bg-blue-500 hover:bg-blue-600",
  left: "bg-green-500 hover:bg-green-600",
  right: "bg-yellow-500 hover:bg-yellow-600",
};

// Frequenze musicali per ogni direzione (accordo di Do maggiore)
const MUSICAL_FREQUENCIES = {
  up: 261.63, // C4 - Do
  down: 329.63, // E4 - Mi
  left: 392.0, // G4 - Sol
  right: 523.25, // C5 - Do ottava
};

// Classe per gestire l'audio con Web Audio API
class AudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bassOscillator: OscillatorNode | null = null;
  private bassGain: GainNode | null = null;
  private drumBuffer: AudioBuffer | null = null;
  private isPlaying = false;

  async initialize() {
    try {
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.value = 0.7;

      // Crea un buffer per il suono della batteria (rumore bianco)
      this.createDrumBuffer();
    } catch (error) {
      console.warn("Web Audio API non supportata:", error);
    }
  }

  private createDrumBuffer() {
    if (!this.audioContext) return;

    const bufferSize = this.audioContext.sampleRate * 0.1; // 100ms di rumore
    this.drumBuffer = this.audioContext.createBuffer(
      1,
      bufferSize,
      this.audioContext.sampleRate
    );
    const data = this.drumBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
    }
  }

  playNote(frequency: number, duration: number = 0.2, volume: number = 0.3) {
    if (!this.audioContext || !this.masterGain) return;

    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    oscillator.frequency.value = frequency;
    oscillator.type = "triangle";

    filter.type = "lowpass";
    filter.frequency.value = frequency * 2;

    const now = this.audioContext.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  playDrum(volume: number = 0.2) {
    if (!this.audioContext || !this.masterGain || !this.drumBuffer) return;

    const source = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    source.buffer = this.drumBuffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    filter.type = "highpass";
    filter.frequency.value = 100;

    gain.gain.value = volume;

    source.start();
  }

  startBackgroundMusic() {
    if (!this.audioContext || !this.masterGain || this.isPlaying) return;

    this.isPlaying = true;

    // Bass line pattern
    const bassNotes = [130.81, 130.81, 174.61, 196.0]; // C3, C3, F3, G3
    let bassIndex = 0;

    const playBass = () => {
      if (!this.isPlaying) return;

      const frequency = bassNotes[bassIndex % bassNotes.length];
      this.playNote(frequency, 0.4, 0.15);
      bassIndex++;

      setTimeout(playBass, BEAT_INTERVAL);
    };

    // Drum pattern
    let drumBeat = 0;
    const playDrums = () => {
      if (!this.isPlaying) return;

      if (drumBeat % 4 === 0 || drumBeat % 4 === 2) {
        this.playDrum(0.3); // Kick
      } else if (drumBeat % 4 === 1 || drumBeat % 4 === 3) {
        this.playDrum(0.15); // Snare
      }

      drumBeat++;
      setTimeout(playDrums, BEAT_INTERVAL);
    };

    // Inizia i pattern
    setTimeout(playBass, 0);
    setTimeout(playDrums, 0);
  }

  stopBackgroundMusic() {
    this.isPlaying = false;
  }

  setVolume(volume: number) {
    if (this.masterGain) {
      this.masterGain.gain.value = volume;
    }
  }

  suspend() {
    if (this.audioContext) {
      this.audioContext.suspend();
    }
  }

  resume() {
    if (this.audioContext) {
      this.audioContext.resume();
    }
  }
}

export default function DanceHeroWithMusic() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [musicStarted, setMusicStarted] = useState(false);
  const [nextNoteId, setNextNoteId] = useState(1);
  const [pressedKeys, setPressedKeys] = useState<Set<Direction>>(new Set());
  const [currentPatternIndex, setCurrentPatternIndex] = useState(0);
  const [currentBeatIndex, setCurrentBeatIndex] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [muted, setMuted] = useState(false);
  const [currentSong, setCurrentSong] = useState(0);

  // Refs per audio engine e game state
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const notesRef = useRef<Note[]>([]);
  const comboRef = useRef(0);
  const isProcessingHit = useRef(false);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const beatGeneratorRef = useRef<NodeJS.Timeout | null>(null);
  const nextNoteIdRef = useRef(1); // Usa ref invece di state per evitare stale closures
  const currentPatternIndexRef = useRef(0);
  const currentBeatIndexRef = useRef(0);

  // Aggiorna i ref quando gli stati cambiano
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    comboRef.current = combo;
  }, [combo]);

  // Inizializza l'audio engine
  useEffect(() => {
    const initAudio = async () => {
      audioEngineRef.current = new AudioEngine();
      await audioEngineRef.current.initialize();
    };

    initAudio();

    return () => {
      if (audioEngineRef.current) {
        audioEngineRef.current.stopBackgroundMusic();
      }
    };
  }, []);

  // Controlla il volume
  useEffect(() => {
    if (audioEngineRef.current) {
      const actualVolume = muted ? 0 : volume;
      audioEngineRef.current.setVolume(actualVolume);

      if (muted) {
        audioEngineRef.current.suspend();
      } else {
        audioEngineRef.current.resume();
      }
    }
  }, [volume, muted]);

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

  const playNoteSound = (direction: Direction, hit: boolean = false) => {
    if (!audioEngineRef.current || muted) return;

    const frequency = MUSICAL_FREQUENCIES[direction];
    const duration = hit ? 0.3 : 0.15;
    const volumeLevel = hit ? 0.4 : 0.25;

    audioEngineRef.current.playNote(frequency, duration, volumeLevel);
  };

  const generateNote = useCallback((direction: Direction) => {
    const noteId = nextNoteIdRef.current;
    nextNoteIdRef.current += 1;

    const newNote: Note = {
      id: noteId,
      direction,
      position: -50,
      hit: false,
    };

    setNotes((prev) => [...prev, newNote]);

    // Suona l'anteprima della nota
    playNoteSound(direction);
  }, []);

  const generateNoteFromPattern = useCallback(() => {
    const currentPattern = SONG_PATTERNS[currentPatternIndexRef.current];
    const beatValue = currentPattern[currentBeatIndexRef.current];

    console.log(
      `Pattern ${currentPatternIndexRef.current}, Beat ${currentBeatIndexRef.current}, Value: ${beatValue}`
    );

    if (beatValue > 0) {
      const direction = DIRECTIONS[beatValue - 1];
      console.log(`Generating note: ${direction} (index ${beatValue - 1})`);
      generateNote(direction);
    }

    const nextBeatIndex =
      (currentBeatIndexRef.current + 1) % currentPattern.length;
    currentBeatIndexRef.current = nextBeatIndex;
    setCurrentBeatIndex(nextBeatIndex);

    if (nextBeatIndex === 0) {
      currentPatternIndexRef.current =
        (currentPatternIndexRef.current + 1) % SONG_PATTERNS.length;
      setCurrentPatternIndex(currentPatternIndexRef.current);
    }
  }, [generateNote]);

  const checkHit = useCallback((direction: Direction) => {
    if (isProcessingHit.current) return;
    isProcessingHit.current = true;

    setNotes((currentNotes) => {
      const notesInHitZone = currentNotes.filter((note) => {
        return (
          note.direction === direction &&
          !note.hit &&
          Math.abs(note.position - HIT_ZONE) < HIT_TOLERANCE
        );
      });

      if (notesInHitZone.length > 0) {
        const hitNote = notesInHitZone.reduce((closest, current) => {
          const closestDistance = Math.abs(closest.position - HIT_ZONE);
          const currentDistance = Math.abs(current.position - HIT_ZONE);
          return currentDistance < closestDistance ? current : closest;
        });

        const accuracy = Math.abs(hitNote.position - HIT_ZONE);
        let points = 100;

        if (accuracy < 20) points = 300;
        else if (accuracy < 35) points = 200;
        else if (accuracy < 50) points = 150;

        // Suona il suono di hit
        playNoteSound(direction, true);

        setScore((prevScore) => prevScore + points * (comboRef.current + 1));
        setCombo((prevCombo) => prevCombo + 1);
        setMaxCombo((prevMax) => Math.max(prevMax, comboRef.current + 1));

        setTimeout(() => {
          isProcessingHit.current = false;
        }, 50);

        return currentNotes.map((note) =>
          note.id === hitNote.id ? { ...note, hit: true } : note
        );
      } else {
        setCombo(0);
        setTimeout(() => {
          isProcessingHit.current = false;
        }, 50);

        return currentNotes;
      }
    });
  }, []);

  const handleKeyPress = useCallback(
    (direction: Direction) => {
      if (!gameStarted) return;

      setPressedKeys((prev) => new Set([...Array.from(prev), direction]));
      checkHit(direction);

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

  const startMusic = () => {
    if (audioEngineRef.current && !muted) {
      audioEngineRef.current.startBackgroundMusic();
      setMusicStarted(true);
    }
  };

  const stopMusic = () => {
    if (audioEngineRef.current) {
      audioEngineRef.current.stopBackgroundMusic();
      setMusicStarted(false);
    }
  };

  const startGame = async () => {
    setGameStarted(true);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setNotes([]);
    setNextNoteId(1);
    nextNoteIdRef.current = 1; // Reset anche il ref
    setCurrentPatternIndex(0);
    setCurrentBeatIndex(0);
    currentPatternIndexRef.current = 0;
    currentBeatIndexRef.current = 0;
    isProcessingHit.current = false;

    // Avvia la musica
    startMusic();

    // Game loop
    gameLoopRef.current = setInterval(() => {
      setNotes((prev) => {
        const updatedNotes = prev
          .map((note) => ({ ...note, position: note.position + NOTE_SPEED }))
          .filter((note) => note.position < 1000);
        return updatedNotes;
      });
    }, 16);

    // Beat generator
    beatGeneratorRef.current = setInterval(() => {
      generateNoteFromPattern();
    }, BEAT_INTERVAL);
  };

  const resetGame = () => {
    setGameStarted(false);
    setNotes([]);
    isProcessingHit.current = false;

    // Ferma la musica
    stopMusic();

    // Pulisci gli intervalli
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    if (beatGeneratorRef.current) {
      clearInterval(beatGeneratorRef.current);
      beatGeneratorRef.current = null;
    }
  };

  const toggleMute = () => {
    setMuted(!muted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  // Gestione eventi keyboard per desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameStarted) return;

      let direction: Direction | null = null;

      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          direction = "up";
          break;
        case "ArrowDown":
        case "s":
        case "S":
          direction = "down";
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          direction = "left";
          break;
        case "ArrowRight":
        case "d":
        case "D":
          direction = "right";
          break;
      }

      if (direction) {
        e.preventDefault();
        handleKeyPress(direction);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameStarted, handleKeyPress]);

  if (!gameStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-purple-900 text-white p-4">
        <div className="text-center max-w-lg">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-pink-300 to-purple-300 bg-clip-text text-transparent animate-pulse">
            💃 Dance Hero 💃
          </h1>
          <div className="text-lg mb-6 text-purple-200 leading-relaxed">
            <p className="text-2xl mb-4">🎉 Buon compleanno Giada! 🎉</p>
            <p>Premi le frecce a tempo di musica!</p>
            <div className="mt-4 p-4 bg-black/20 rounded-lg">
              <div className="text-yellow-400 font-bold animate-bounce mb-2">
                ♪ BPM: {BPM} ♪
              </div>
              <div className="text-sm text-purple-200 mb-2">
                🎵 Con traccia musicale sincronizzata!
              </div>
              <div className="text-xs text-purple-300">
                💻 Usa le frecce della tastiera o WASD
                <br />
                📱 Tocca i pulsanti sullo schermo
              </div>
            </div>
          </div>

          {/* Controlli audio pre-gioco */}
          <div className="mb-6 p-4 bg-black/20 rounded-lg">
            <div className="flex items-center justify-center gap-4 mb-4">
              <button
                onClick={toggleMute}
                className="p-3 bg-gray-600 hover:bg-gray-500 rounded-full transition-colors transform hover:scale-110"
              >
                {muted ? <VolumeX size={24} /> : <Volume2 size={24} />}
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Volume:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={muted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-24 accent-pink-500"
                  disabled={muted}
                />
                <span className="text-xs text-purple-300 min-w-[3ch]">
                  {Math.round((muted ? 0 : volume) * 100)}%
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={startGame}
            className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 px-8 py-4 rounded-full text-xl font-bold transition-all transform hover:scale-105 shadow-lg animate-pulse hover:animate-none"
          >
            🎵 Inizia a Ballare! 🎵
          </button>

          <div className="mt-6 text-sm text-purple-300">
            <p>🏆 Fai combo per moltiplicare i punti!</p>
            <p>🎯 Colpisci le note nella zona luminosa</p>
          </div>
        </div>
      </div>
    );
  }

  if (score >= 300) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
        <div className="bg-gradient-to-br from-purple-800 via-pink-700 to-purple-800 p-8 rounded-3xl shadow-2xl max-w-md mx-4 text-center border-4 border-yellow-400">
          <div className="mb-6">
            <div className="text-6xl mb-4 animate-spin">🏆</div>
            <h2 className="text-3xl font-bold text-yellow-300 mb-4 animate-pulse">
              VITTORIA!
            </h2>
            <div className="text-lg text-white whitespace-pre-line leading-relaxed">
              Complimenti Amore mio ecco il tuo{" "}
              <a
                href="https://suno.com/s/m0n22KS8YwOy0ToP"
                style={{ textDecoration: "underline" }}
              >
                Regalo
              </a>
            </div>
          </div>

          <div className="mb-6 p-4 bg-black/30 rounded-xl">
            <div className="text-yellow-400 font-bold text-xl mb-2">
              🎯 Punteggio Finale: {score.toLocaleString()}
            </div>
            <div className="text-pink-300 font-bold text-lg">
              🔥 Max Combo: {maxCombo}
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={() => {
                setScore(0);
                startGame();
              }}
              className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 px-6 py-3 rounded-full text-white font-bold transition-all transform hover:scale-105 shadow-lg"
            >
              🎵 Gioca Ancora
            </button>
            <button
              onClick={() => {
                setScore(0);
                resetGame();
              }}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 px-6 py-3 rounded-full text-white font-bold transition-all transform hover:scale-105 shadow-lg"
            >
              🎂 Menu Principale
            </button>
          </div>

          <div className="mt-6 text-sm text-purple-200">
            <div className="animate-pulse">
              🎈 Tanti auguri per i tuoi 16 anni! 🎈
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gameArea flex flex-col min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-purple-900 text-white">
      {/* Header */}
      <div
        className="danceHeader flex justify-between items-center p-4 bg-black/20 backdrop-blur-sm"
        style={{ zIndex: 10, height: "68px" }}
      >
        <div className="text-base md:text-lg font-bold">
          Score:{" "}
          <span className="text-yellow-300 animate-pulse">
            {score.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-base md:text-lg font-bold">
            Combo:{" "}
            <span
              className={`${
                combo > 10 ? "text-pink-300 animate-bounce" : "text-pink-300"
              }`}
            >
              {combo}
            </span>
          </div>
          {/* Controlli audio */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="p-1 hover:bg-white/10 rounded transition-colors"
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={muted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 h-2 accent-pink-500"
              disabled={muted}
            />
          </div>
        </div>
        <button
          onClick={resetGame}
          className="bg-red-500 hover:bg-red-600 px-3 md:px-4 py-2 rounded transition-colors text-sm md:text-base transform hover:scale-105"
        >
          Reset
        </button>
      </div>

      {/* Game Area */}
      <div
        className="notesArea relative bg-black/10 flex-1"
        style={{ height: GAME_HEIGHT }}
      >
        {/* Track lines */}
        <div className="absolute inset-0 flex">
          {DIRECTIONS.map((direction, index) => (
            <div
              key={direction}
              className="flex-1 border-r border-white/20 relative"
            >
              {/* Hit zone indicator */}
              <div
                className={`clickArea absolute w-full h-12 border-2 border-white/50 bg-white/10 rounded-lg transition-all duration-300 ${
                  pressedKeys.has(direction)
                    ? "bg-white/30 border-white/80 scale-105"
                    : ""
                }`}
                style={{ top: "80%" }}
              />
              {/* Track number */}
              <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-xs text-white/50 font-bold">
                {index + 1}
              </div>
            </div>
          ))}
        </div>

        {/* Notes */}
        {notes.map((note) => (
          <div
            key={note.id}
            className={`absolute w-16 h-16 rounded-full flex items-center justify-center text-white font-bold shadow-xl transition-all duration-300 ${
              note.hit
                ? "opacity-0 scale-150 rotate-180"
                : "opacity-100 scale-100 hover:scale-110"
            } ${COLORS[note.direction]} border-2 border-white/30`}
            style={{
              left: `${DIRECTIONS.indexOf(note.direction) * 25}%`,
              marginLeft: "calc(12.5% - 32px)",
              top: note.position,
              zIndex: 5,
            }}
          >
            {getDirectionIcon(note.direction)}
          </div>
        ))}

        {/* Status musicale e info pattern */}
        <div className="absolute top-4 left-4 bg-black/60 rounded-lg p-3 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm mb-2">
            {musicStarted ? (
              <>
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>Musica ON</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                <span>Musica OFF</span>
              </>
            )}
          </div>
          <div className="text-xs text-purple-200">
            Pattern: {currentPatternIndex + 1}/{SONG_PATTERNS.length}
          </div>
          <div className="text-xs text-purple-200">
            Beat: {currentBeatIndex + 1}/
            {SONG_PATTERNS[currentPatternIndex].length}
          </div>
        </div>

        {/* Indicatore di accuratezza */}
        {combo > 5 && (
          <div className="absolute top-4 right-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg p-3 backdrop-blur-sm animate-pulse">
            <div className="text-sm font-bold">🔥 ON FIRE! 🔥</div>
            <div className="text-xs">Combo x{combo}</div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div
        className="controls p-4 bg-black/30 backdrop-blur-sm"
        style={{ height: "96px" }}
      >
        <div className="grid grid-cols-4 gap-3 md:gap-4 max-w-md mx-auto">
          {DIRECTIONS.map((direction, index) => (
            <button
              key={direction}
              onTouchStart={(e) => {
                e.preventDefault();
                handleKeyPress(direction);
              }}
              onClick={() => handleKeyPress(direction)}
              className={`h-16 md:h-20 rounded-xl flex items-center justify-center text-white font-bold text-xl md:text-2xl transition-all transform shadow-lg select-none border-2 border-white/20 ${
                pressedKeys.has(direction)
                  ? `${COLORS[direction]} scale-95 shadow-inner border-white/50 rotate-3`
                  : `${COLORS[direction]} hover:scale-105 shadow-xl active:scale-95 hover:border-white/40`
              }`}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <div className="flex flex-col items-center">
                {getDirectionIcon(direction)}
                <div className="text-xs mt-1 opacity-70">
                  {["↑/W", "↓/S", "←/A", "→/D"][index]}
                </div>
              </div>
            </button>
          ))}
        </div>

        {maxCombo > 0 && (
          <div className="text-center mt-2 text-purple-200">
            Max Combo:{" "}
            <span className="text-yellow-300 font-bold animate-pulse">
              {maxCombo}
            </span>
            {maxCombo > 20 && <span className="ml-2">🏆</span>}
            {maxCombo > 50 && <span className="ml-1">👑</span>}
          </div>
        )}
      </div>
      <div className="controls"></div>
    </div>
  );
}
