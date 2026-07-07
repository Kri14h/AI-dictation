/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, FormEvent } from 'react';
import {
  Settings as SettingsIcon,
  Volume2,
  Play,
  Square,
  Check,
  X,
  RefreshCw,
  Maximize2,
  Minimize2,
  Eye,
  BookOpen,
  Sparkles,
  History,
  HelpCircle,
  Award,
  Sliders,
  Database,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Clock,
  VolumeX,
  SlidersHorizontal,
  ChevronRight,
  Sparkle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getOfflineWordsBatch } from './offlineWords';

// Word data interface returned from Gemini
interface GeminiWordResponse {
  word: string;
  definition: string;
  sentence: string;
  phonetic: string;
}

// Word history entry interface
interface HistoryEntry {
  word: string;
  definition: string;
  sentence: string;
  phonetic: string;
  result: 'correct' | 'incorrect' | 'given-up';
  attempts: number;
  difficulty: number;
  timestamp: number;
}

export default function App() {
  // --- STATE DECLARATIONS ---
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('GEMINI_API_KEY') || '');
  const [tempApiKey, setTempApiKey] = useState<string>('');
  const [difficulty, setDifficulty] = useState<number>(() => {
    const saved = localStorage.getItem('GEMINI_DIFFICULTY');
    return saved ? parseInt(saved, 10) : 5;
  });
  const [selectedModel, setSelectedModel] = useState<string>(() => localStorage.getItem('GEMINI_MODEL') || 'gemini-2.5-flash');
  
  // App UI State
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'challenge' | 'history' | 'stats'>('challenge');
  const [isTestingKey, setIsTestingKey] = useState<boolean>(false);
  const [keyTestStatus, setKeyTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [keyTestError, setKeyTestError] = useState<string>('');

  // Audio / Speech State
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>(() => localStorage.getItem('SPEECH_VOICE_URI') || '');
  const [speechRate, setSpeechRate] = useState<number>(() => {
    const saved = localStorage.getItem('SPEECH_RATE');
    return saved ? parseFloat(saved) : 1.0;
  });
  const [speechPitch, setSpeechPitch] = useState<number>(() => {
    const saved = localStorage.getItem('SPEECH_PITCH');
    return saved ? parseFloat(saved) : 1.0;
  });
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isSlowPlayback, setIsSlowPlayback] = useState<boolean>(false);

  // Challenge Game Logic State
  const [currentChallenge, setCurrentChallenge] = useState<GeminiWordResponse | null>(null);
  const [isLoadingChallenge, setIsLoadingChallenge] = useState<boolean>(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [isFallbackActive, setIsFallbackActive] = useState<boolean>(false);
  const [userInput, setUserInput] = useState<string>('');
  const [attempts, setAttempts] = useState<number>(0);
  const [challengeStatus, setChallengeStatus] = useState<'unstarted' | 'active' | 'correct' | 'incorrect' | 'given_up'>('unstarted');
  
  // --- PACKAGE & SECTION ENGINE STATE ---
  const [packageSize, setPackageSize] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('DICT_PACKAGE_SIZE');
      return saved ? parseInt(saved, 10) : 5;
    } catch {
      return 5;
    }
  });

  const [currentPackageWords, setCurrentPackageWords] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('DICT_PACKAGE_WORDS');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [currentPackageIndex, setCurrentPackageIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('DICT_PACKAGE_INDEX');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [packageResults, setPackageResults] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('DICT_PACKAGE_RESULTS');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync package states to localStorage
  useEffect(() => {
    localStorage.setItem('DICT_PACKAGE_SIZE', packageSize.toString());
  }, [packageSize]);

  useEffect(() => {
    localStorage.setItem('DICT_PACKAGE_WORDS', JSON.stringify(currentPackageWords));
  }, [currentPackageWords]);

  useEffect(() => {
    localStorage.setItem('DICT_PACKAGE_INDEX', currentPackageIndex.toString());
  }, [currentPackageIndex]);

  useEffect(() => {
    localStorage.setItem('DICT_PACKAGE_RESULTS', JSON.stringify(packageResults));
  }, [packageResults]);

  // Running array of historically used words for memory anti-repetition
  const [usedWords, setUsedWords] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('DICT_USED_WORDS');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save usedWords to LocalStorage
  useEffect(() => {
    localStorage.setItem('DICT_USED_WORDS', JSON.stringify(usedWords));
  }, [usedWords]);
  
  // Hint reveal states
  const [hintsUnlocked, setHintsUnlocked] = useState<{
    definition: boolean;
    sentence: boolean;
    phonetic: boolean;
  }>({
    definition: false,
    sentence: false,
    phonetic: false
  });

  // History and Statistics
  const [wordHistory, setWordHistory] = useState<HistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem('DICT_WORD_HISTORY');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [stats, setStats] = useState<{
    streak: number;
    maxStreak: number;
    totalPlayed: number;
    correctCount: number;
    gaveUpCount: number;
  }>(() => {
    try {
      const saved = localStorage.getItem('DICT_STATS');
      if (saved) return JSON.parse(saved);
    } catch {}
    
    // Fallback recalculation from word history
    return {
      streak: 0,
      maxStreak: 0,
      totalPlayed: 0,
      correctCount: 0,
      gaveUpCount: 0
    };
  });

  // Animation triggers
  const [shakeInput, setShakeInput] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fallbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const userInteractedRef = useRef<boolean>(false);

  // Track user interaction with the document
  useEffect(() => {
    const markInteracted = () => {
      userInteractedRef.current = true;
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('click', markInteracted, { capture: true, passive: true, once: true });
      window.addEventListener('keydown', markInteracted, { capture: true, passive: true, once: true });
      window.addEventListener('touchstart', markInteracted, { capture: true, passive: true, once: true });
    }
  }, []);

  // --- INITIALIZATION ---
  useEffect(() => {
    // Populate Speech Synthesis Voices
    const updateVoices = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices);
        
        // Pick a default English voice if none is selected
        const savedURI = localStorage.getItem('SPEECH_VOICE_URI');
        if (!savedURI && availableVoices.length > 0) {
          const defaultVoice = 
            availableVoices.find(v => v.lang === 'en-US' && v.name.includes('Natural')) ||
            availableVoices.find(v => v.lang.startsWith('en-US')) ||
            availableVoices.find(v => v.lang.startsWith('en')) ||
            availableVoices[0];
            
          if (defaultVoice) {
            setSelectedVoiceURI(defaultVoice.voiceURI);
            localStorage.setItem('SPEECH_VOICE_URI', defaultVoice.voiceURI);
          }
        }
      }
    };

    updateVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    // Sync fullscreen state
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Save Configs to LocalStorage on changes
  useEffect(() => {
    localStorage.setItem('GEMINI_DIFFICULTY', difficulty.toString());
  }, [difficulty]);

  useEffect(() => {
    localStorage.setItem('GEMINI_MODEL', selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    localStorage.setItem('SPEECH_RATE', speechRate.toString());
  }, [speechRate]);

  useEffect(() => {
    localStorage.setItem('SPEECH_PITCH', speechPitch.toString());
  }, [speechPitch]);

  useEffect(() => {
    if (selectedVoiceURI) {
      localStorage.setItem('SPEECH_VOICE_URI', selectedVoiceURI);
    }
  }, [selectedVoiceURI]);

  // Sync Stats to LocalStorage
  useEffect(() => {
    localStorage.setItem('DICT_STATS', JSON.stringify(stats));
  }, [stats]);

  // Sync Word History to LocalStorage
  useEffect(() => {
    localStorage.setItem('DICT_WORD_HISTORY', JSON.stringify(wordHistory));
  }, [wordHistory]);

  // Focus input helper when challenge state shifts
  useEffect(() => {
    if (challengeStatus === 'active' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [challengeStatus, currentChallenge]);

  // Full-screen toggle action
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error entering fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // --- AUDIO SYNTHESIS BRAIN ---
  const speakWord = (textToSpeak: string, slowOverride: boolean = false) => {
    if (typeof window === 'undefined') return;

    // Stop any currently playing fallback Audio element
    if (fallbackAudioRef.current) {
      try {
        fallbackAudioRef.current.pause();
      } catch (err) {
        console.warn("Error pausing fallback audio:", err);
      }
      fallbackAudioRef.current = null;
    }

    const playFallbackTTS = () => {
      try {
        console.log("Playing fallback TTS for:", textToSpeak);
        setIsSpeaking(true);
        // Use Google Translate free TTS API for robust fallback
        const speedParam = slowOverride ? "&ttsspeed=0.7" : "";
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(textToSpeak)}${speedParam}`;
        const audio = new Audio(url);
        fallbackAudioRef.current = audio;

        audio.onended = () => {
          setIsSpeaking(false);
          fallbackAudioRef.current = null;
        };

        audio.onerror = (err) => {
          console.info("Fallback TTS Audio stream had a loading/playback restriction or was interrupted:", err);
          setIsSpeaking(false);
          fallbackAudioRef.current = null;
        };

        audio.play().catch((playErr) => {
          if (playErr.name === 'NotAllowedError') {
            console.info("Playback of audio was blocked by browser autoplay policy. User interaction required.");
          } else {
            console.info("Fallback TTS Audio play was interrupted or restricted by browser:", playErr.message || playErr);
          }
          setIsSpeaking(false);
          fallbackAudioRef.current = null;
        });
      } catch (fallbackErr) {
        console.info("Error initializing fallback TTS:", fallbackErr);
        setIsSpeaking(false);
      }
    };

    // If browser doesn't support Web Speech API, use the fallback directly
    if (!('speechSynthesis' in window)) {
      playFallbackTTS();
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Stop any pending speak jobs

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      
      // Apply voice
      if (selectedVoiceURI) {
        const activeVoice = voices.find(v => v.voiceURI === selectedVoiceURI);
        if (activeVoice) {
          utterance.voice = activeVoice;
        }
      }

      // Apply rates and pitches
      const effectiveRate = slowOverride ? speechRate * 0.7 : speechRate;
      utterance.rate = Math.max(0.1, Math.min(10, effectiveRate));
      utterance.pitch = speechPitch;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (e) => {
        // Speech synthesis threw error (highly common in sandboxed iframes or on headless browsers)
        console.info("Web Speech synthesis errored (possibly due to sandbox/autoplay restriction), playing fallback TTS:", e);
        setIsSpeaking(false);
        playFallbackTTS();
      };

      window.speechSynthesis.speak(utterance);
    } catch (synthesisErr) {
      console.info("speechSynthesis.speak threw an exception, playing fallback TTS:", synthesisErr);
      playFallbackTTS();
    }
  };

  // --- GEMINI BATCH WORD GENERATION ---
  const generateNewWord = async (keyToUse = apiKey) => {
    setIsLoadingChallenge(true);
    setChallengeError(null);
    setChallengeStatus('unstarted');
    setCurrentChallenge(null);
    setUserInput('');
    setAttempts(0);
    setHintsUnlocked({ definition: false, sentence: false, phonetic: false });

    // Retrieve the exact list of historically used words from localStorage
    const savedUsedStr = localStorage.getItem('DICT_USED_WORDS') || '[]';
    let historicallyUsedWordsList: string[] = [];
    try {
      historicallyUsedWordsList = JSON.parse(savedUsedStr);
    } catch {
      historicallyUsedWordsList = wordHistory.map(entry => entry.word.toLowerCase());
    }

    // Keep it synchronized with DICT_USED_WORDS
    if (!localStorage.getItem('DICT_USED_WORDS')) {
      localStorage.setItem('DICT_USED_WORDS', JSON.stringify(historicallyUsedWordsList));
    }

    // If API Key is missing, fall back to offline words immediately
    if (!keyToUse) {
      console.info("API Key not found, using high-quality local offline dictionary package.");
      try {
        const fallbackWords = getOfflineWordsBatch(difficulty, packageSize, historicallyUsedWordsList);
        if (fallbackWords && fallbackWords.length > 0) {
          setCurrentPackageWords(fallbackWords);
          setCurrentPackageIndex(0);
          setPackageResults(new Array(fallbackWords.length).fill('pending'));

          const firstWord = fallbackWords[0];
          
          // Add to running array
          if (!historicallyUsedWordsList.includes(firstWord)) {
            const newList = [...historicallyUsedWordsList, firstWord];
            setUsedWords(newList);
            localStorage.setItem('DICT_USED_WORDS', JSON.stringify(newList));
          }

          setCurrentChallenge({ word: firstWord, definition: '', sentence: '', phonetic: '' });
          setChallengeStatus('active');
          setIsFallbackActive(true);
          setIsLoadingChallenge(false);

          setTimeout(() => {
            if (userInteractedRef.current) {
              speakWord(firstWord);
            }
          }, 500);
          return;
        }
      } catch (fallbackErr) {
        console.error("Local fallback failed:", fallbackErr);
      }
      setIsLoadingChallenge(false);
      setChallengeError("Please configure your Gemini API Key in Settings to generate a word.");
      return;
    }

    const prompt = `You are a dictionary API. Generate exactly ${packageSize} random English words based on the difficulty level. 
Current Difficulty: ${difficulty}. 
Rules:
- Levels 1-3 (A1/A2): 3-5 letters, highly common in daily speech.
- Levels 4-7 (B1/B2): 6-9 letters, used in professional/academic contexts.
- Levels 8-10 (C1/C2): 10+ letters, highly obscure, complex, or archaic (e.g., GRE/GMAT vocabulary).
Do NOT generate any of these previously used words: [${historicallyUsedWordsList.join(', ')}].
Return ONLY a raw JSON object in this exact format: {"words": ["word_1", "word_2", ..., "word_N"]}. Do not include markdown formatting, backticks, or any other text.`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${keyToUse}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 1.0,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const remoteMessage = errorData.error?.message || response.statusText;
        throw new Error(`Gemini API Error: ${remoteMessage} (Status ${response.status})`);
      }

      const resJson = await response.json();
      const textResponse = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!textResponse) {
        throw new Error("Empty response received from Gemini model.");
      }

      // Parse JSON
      let parsedPayload: { words: string[] };
      try {
        parsedPayload = JSON.parse(textResponse.trim());
      } catch (jsonErr) {
        console.error("JSON parsing error on response:", textResponse);
        throw new Error("Failed to parse words array from Gemini response. Please try again.");
      }

      // Basic validation of response fields
      if (!parsedPayload.words || !Array.isArray(parsedPayload.words) || parsedPayload.words.length === 0) {
        throw new Error("Gemini returned an incomplete payload or did not output a valid list of words.");
      }

      // Clean the words
      const cleanWords = parsedPayload.words
        .map(w => w.trim().toLowerCase().replace(/[^a-z]/g, ''))
        .filter(w => w.length > 0);

      if (cleanWords.length === 0) {
        throw new Error("Failed to clean and extract valid words. Please try again.");
      }

      setCurrentPackageWords(cleanWords);
      setCurrentPackageIndex(0);
      setPackageResults(new Array(cleanWords.length).fill('pending'));

      const firstWord = cleanWords[0];

      // Add first word to running array
      if (!historicallyUsedWordsList.includes(firstWord)) {
        const newList = [...historicallyUsedWordsList, firstWord];
        setUsedWords(newList);
        localStorage.setItem('DICT_USED_WORDS', JSON.stringify(newList));
      }

      setCurrentChallenge({ word: firstWord, definition: '', sentence: '', phonetic: '' });
      setChallengeStatus('active');
      setIsFallbackActive(false);

      // Auto-speak the first word once loaded
      setTimeout(() => {
        if (userInteractedRef.current) {
          speakWord(firstWord);
        } else {
          console.info("Skipping auto-speak: User has not interacted with the document yet (browser policy).");
        }
      }, 500);

    } catch (err: any) {
      console.warn("Gemini API call failed, falling back to local offline vocabulary generator:", err);
      try {
        const fallbackWords = getOfflineWordsBatch(difficulty, packageSize, historicallyUsedWordsList);
        if (fallbackWords && fallbackWords.length > 0) {
          setCurrentPackageWords(fallbackWords);
          setCurrentPackageIndex(0);
          setPackageResults(new Array(fallbackWords.length).fill('pending'));

          const firstWord = fallbackWords[0];
          
          // Add first word to running array
          if (!historicallyUsedWordsList.includes(firstWord)) {
            const newList = [...historicallyUsedWordsList, firstWord];
            setUsedWords(newList);
            localStorage.setItem('DICT_USED_WORDS', JSON.stringify(newList));
          }

          setCurrentChallenge({ word: firstWord, definition: '', sentence: '', phonetic: '' });
          setChallengeStatus('active');
          setIsFallbackActive(true);
          setChallengeError(null); // Clear error since we recovered perfectly

          setTimeout(() => {
            if (userInteractedRef.current) {
              speakWord(firstWord);
            }
          }, 500);
          return;
        }
      } catch (fallbackErr) {
        console.error("Local fallback failed as well:", fallbackErr);
      }
      setChallengeError(err.message || "An unexpected error occurred while fetching the challenge.");
    } finally {
      setIsLoadingChallenge(false);
    }
  };

  // --- API KEY VALIDATOR ---
  const handleTestApiKey = async () => {
    if (!tempApiKey.trim()) {
      setKeyTestStatus('error');
      setKeyTestError('Please enter an API Key to test.');
      return;
    }

    setIsTestingKey(true);
    setKeyTestStatus('idle');
    setKeyTestError('');

    const prompt = "Reply with exactly 'OK' in a JSON object: {\"status\": \"OK\"}";
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${tempApiKey.trim()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "Invalid API key response.");
      }

      setApiKey(tempApiKey.trim());
      localStorage.setItem('GEMINI_API_KEY', tempApiKey.trim());
      setKeyTestStatus('success');
      
      // If we don't have a challenge active, let's trigger one
      if (challengeStatus === 'unstarted' && !currentChallenge) {
        setTimeout(() => {
          generateNewWord(tempApiKey.trim());
        }, 1000);
      }
    } catch (err: any) {
      setKeyTestStatus('error');
      setKeyTestError(err.message || "Failed to validate Gemini API Key. Make sure it is active.");
    } finally {
      setIsTestingKey(false);
    }
  };

  // --- GAME PLAY ACTIONS ---
  const handleSubmitSpelling = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!currentChallenge || challengeStatus !== 'active') return;

    const sanitizedInput = userInput.trim().toLowerCase();
    if (!sanitizedInput) return;

    const currentWord = currentChallenge.word.trim().toLowerCase();
    
    if (sanitizedInput === currentWord) {
      // CORRECT GUESS!
      setChallengeStatus('correct');
      speakWord(`Excellent! That is correct. ${currentWord}.`);
      
      // Update active package result status
      setPackageResults(prev => {
        const updated = [...prev];
        if (updated.length > currentPackageIndex) {
          updated[currentPackageIndex] = 'correct';
        }
        return updated;
      });

      // Update statistics & history
      const newEntry: HistoryEntry = {
        ...currentChallenge,
        result: 'correct',
        attempts: attempts + 1,
        difficulty,
        timestamp: Date.now()
      };

      setWordHistory(prev => [newEntry, ...prev]);

      setStats(prev => {
        const newStreak = prev.streak + 1;
        const newMaxStreak = Math.max(prev.maxStreak, newStreak);
        return {
          streak: newStreak,
          maxStreak: newMaxStreak,
          totalPlayed: prev.totalPlayed + 1,
          correctCount: prev.correctCount + 1,
          gaveUpCount: prev.gaveUpCount
        };
      });

    } else {
      // INCORRECT GUESS!
      setAttempts(prev => prev + 1);
      setShakeInput(true);
      setTimeout(() => setShakeInput(false), 500);
      
      // Speak encouraging audio or dictate correction
      speakWord("Incorrect spelling. Try listening closely or unlock a hint.");
      
      // Shake input and leave status active so they can try again or give up
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  const handleGiveUp = () => {
    if (!currentChallenge || challengeStatus !== 'active') return;

    setChallengeStatus('given_up');
    speakWord(`The word is spelled: ${currentChallenge.word}.`);

    // Update active package result status
    setPackageResults(prev => {
      const updated = [...prev];
      if (updated.length > currentPackageIndex) {
        updated[currentPackageIndex] = 'given_up';
      }
      return updated;
    });

    // Add to history
    const newEntry: HistoryEntry = {
      ...currentChallenge,
      result: 'given-up',
      attempts: attempts,
      difficulty,
      timestamp: Date.now()
    };
    setWordHistory(prev => [newEntry, ...prev]);

    // Update stats
    setStats(prev => ({
      streak: 0, // Reset streak on give up
      maxStreak: prev.maxStreak,
      totalPlayed: prev.totalPlayed + 1,
      correctCount: prev.correctCount,
      gaveUpCount: prev.gaveUpCount + 1
    }));
  };

  const handleNextWord = () => {
    const nextIndex = currentPackageIndex + 1;
    if (nextIndex < currentPackageWords.length) {
      setCurrentPackageIndex(nextIndex);
      const nextWord = currentPackageWords[nextIndex];
      
      setUserInput('');
      setAttempts(0);
      setChallengeStatus('active');
      setHintsUnlocked({ definition: false, sentence: false, phonetic: false });
      
      // Update running array of used words for anti-repetition memory
      const savedUsedStr = localStorage.getItem('DICT_USED_WORDS') || '[]';
      let historicallyUsedWordsList: string[] = [];
      try {
        historicallyUsedWordsList = JSON.parse(savedUsedStr);
      } catch {
        historicallyUsedWordsList = usedWords;
      }
      
      if (!historicallyUsedWordsList.includes(nextWord)) {
        const newList = [...historicallyUsedWordsList, nextWord];
        setUsedWords(newList);
        localStorage.setItem('DICT_USED_WORDS', JSON.stringify(newList));
      }
      
      setCurrentChallenge({ word: nextWord, definition: '', sentence: '', phonetic: '' });
      
      setTimeout(() => {
        if (userInteractedRef.current) {
          speakWord(nextWord);
        }
      }, 500);
    } else {
      generateNewWord();
    }
  };

  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to delete all spelling challenge logs and history stats? This cannot be undone.")) {
      setWordHistory([]);
      setStats({
        streak: 0,
        maxStreak: 0,
        totalPlayed: 0,
        correctCount: 0,
        gaveUpCount: 0
      });
      localStorage.removeItem('DICT_WORD_HISTORY');
      localStorage.removeItem('DICT_STATS');
    }
  };

  // Run initial word generator if key is present but no word is loaded
  useEffect(() => {
    if (apiKey && challengeStatus === 'unstarted' && !currentChallenge && !isLoadingChallenge) {
      generateNewWord();
    }
  }, [apiKey]);

  // Sync temp key input if settings opens
  useEffect(() => {
    if (isSettingsOpen) {
      setTempApiKey(apiKey);
      setKeyTestStatus('idle');
    }
  }, [isSettingsOpen, apiKey]);

  // Calculate stats values
  const accuracyRate = stats.totalPlayed > 0 ? Math.round((stats.correctCount / stats.totalPlayed) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] flex flex-col font-mono overflow-x-hidden relative dot-grid selection:bg-[#00ff41]/20 selection:text-[#00ff41]">
      
      {/* Decorative Background Backdrop Element */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.015] pointer-events-none select-none overflow-hidden">
        <h1 className="text-[18rem] md:text-[30rem] font-black leading-none uppercase tracking-tighter">DICT</h1>
      </div>

      {/* --- BOLD TYPOGRAPHY HEADER --- */}
      <header className="flex justify-between items-center px-6 md:px-10 pt-6 md:pt-8 pb-4 relative z-30 border-b border-white/5 bg-[#050505]/40 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-[#00ff41] animate-pulse shadow-[0_0_8px_#00ff41]"></div>
          <span className="text-xs uppercase tracking-widest font-bold opacity-60">System.Active // Challenge_DICT</span>
        </div>
        
        <div className="flex gap-3 md:gap-6">
          <button 
            onClick={toggleFullscreen}
            className="flex items-center gap-2 px-3 py-1.5 border border-white/10 hover:border-[#00ff41]/50 transition-all bg-white/5 text-[10px] uppercase tracking-wider font-bold cursor-pointer"
            id="fullscreen-toggle-btn"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Scale</span>
          </button>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 border border-white/10 hover:border-[#00ff41]/50 transition-all bg-white/5 text-[10px] uppercase tracking-wider font-bold cursor-pointer"
            id="settings-toggle-btn"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            <span>Setup</span>
          </button>
        </div>
      </header>

      {/* --- MAIN PLAY CONTAINER --- */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        
        {/* LEFT COLUMN: ACTIVE CHALLENGE FRAMEWORK */}
        <section className="lg:col-span-8 flex flex-col gap-6" id="gameplay-stage">
          
          {/* SKELETON / ONBOARDING IF NO API KEY CONFIGURED */}
          {!apiKey ? (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 min-h-[450px] bg-black/40 border border-white/5 rounded-none p-6 md:p-10 flex flex-col justify-center items-center text-center relative overflow-hidden backdrop-blur-xl"
            >
              <div className="absolute top-4 left-4 font-mono text-[10px] text-zinc-600 uppercase tracking-widest">System.Status // Key_Pending</div>
              <div className="w-16 h-16 rounded-none bg-black border border-white/10 flex items-center justify-center mb-6 text-[#00ff41] shadow-[0_0_20px_rgba(0,255,65,0.05)]">
                <Database className="w-8 h-8 animate-pulse" />
              </div>

              <h2 className="text-xl md:text-2xl font-mono font-bold tracking-widest uppercase text-[#e0e0e0] mb-2">Connect Google Gemini API</h2>
              <p className="text-zinc-500 max-w-md text-xs md:text-sm mb-8 tracking-wide">
                TO LAUNCH THE DICTATION BOT CHALLENGE, PROVIDE YOUR GOOGLE GEMINI API KEY below. IT STORES LOCALLY IN YOUR WEB BROWSER ONLY.
              </p>

              <div className="w-full max-w-md bg-black/80 border border-white/10 rounded-none p-5 text-left flex flex-col gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Google Gemini API Key</label>
                  <div className="relative">
                    <input 
                      type="password"
                      value={tempApiKey}
                      onChange={(e) => setTempApiKey(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full bg-black/60 text-[#e0e0e0] border border-white/10 rounded-none py-2.5 pl-3 pr-32 text-xs font-mono focus:outline-none focus:border-[#00ff41]"
                    />
                    <div className="absolute inset-y-0 right-1.5 flex items-center">
                      <button
                        onClick={handleTestApiKey}
                        disabled={isTestingKey}
                        className="px-3 py-1 bg-[#00ff41] hover:brightness-110 text-black text-[10px] font-mono font-bold rounded-none disabled:bg-zinc-800 disabled:text-zinc-500 transition-colors cursor-pointer uppercase tracking-wider"
                      >
                        {isTestingKey ? "Testing..." : "Test_Connect"}
                      </button>
                    </div>
                  </div>
                </div>

                {keyTestStatus === 'success' && (
                  <div className="text-xs text-[#00ff41] flex items-center gap-1.5 font-mono bg-[#00ff41]/5 border border-[#00ff41]/20 rounded-none p-2.5">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>API CONNECTION ESTABLISHED. SPAWNING DICTATION...</span>
                  </div>
                )}

                {keyTestStatus === 'error' && (
                  <div className="text-xs text-red-500 flex items-center gap-1.5 font-mono bg-red-950/20 border border-red-500/20 rounded-none p-2.5">
                    <X className="w-3.5 h-3.5 shrink-0" />
                    <span>{keyTestError}</span>
                  </div>
                )}

                <div className="border-t border-white/5 pt-3 flex justify-between items-center text-[10px] font-mono text-zinc-500">
                  <span>NO KEY? REQUEST ONE FREE:</span>
                  <a 
                    href="https://aistudio.google.com/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[#00ff41] hover:underline flex items-center gap-0.5 tracking-wider font-bold"
                  >
                    AI STUDIO <ChevronRight className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </motion.div>
          ) : (
            
            // GENERAL PLAY STAGE
            <div className="flex flex-col gap-6">
              
              {/* PRIMARY SPEECH DISPATCHER PANEL */}
              <div className="bg-black/40 border border-white/5 rounded-none p-6 md:p-10 flex flex-col items-center justify-center relative overflow-hidden min-h-[350px] backdrop-blur-xl">
                
                {/* Background design elements */}
                <div className="absolute top-4 left-4 font-mono text-[10px] text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${isLoadingChallenge ? 'bg-amber-500 animate-pulse' : 'bg-[#00ff41]'}`} />
                  <span>DIFFICULTY.LEVEL_{difficulty}</span>
                </div>

                <div className="absolute top-4 right-4 text-[10px] font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                  <span>ATTEMPTS_{attempts}</span>
                </div>

                <AnimatePresence mode="wait">
                  {isLoadingChallenge ? (
                    <motion.div 
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center text-center max-w-md py-10"
                    >
                      <div className="w-12 h-12 rounded-none border border-white/10 border-t-[#00ff41] animate-spin mb-6" />
                      <div className="font-mono text-xs text-zinc-400 tracking-widest mb-2 uppercase font-bold">CONNECTING_TO_GEMINI...</div>
                      <div className="font-mono text-[9px] text-[#00ff41] animate-pulse bg-black px-3 py-1 rounded-none border border-white/10 uppercase tracking-widest">
                        {difficulty <= 3 
                          ? "SELECTING_SEED_DICTIONARY_WORDS..." 
                          : difficulty <= 7 
                          ? "DRAFTING_PHONETICS_SCHEMAS..." 
                          : "CONSTRUCTING_HIGHLY_OBSCURE_CHALLENGES..."}
                      </div>
                    </motion.div>
                  ) : challengeError ? (
                    <motion.div 
                      key="error"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center text-center max-w-md py-10"
                    >
                      <AlertTriangle className="w-10 h-10 text-red-500 mb-4" />
                      <h3 className="font-mono font-bold text-[#e0e0e0] uppercase tracking-widest mb-2">Failed_to_load_Challenge</h3>
                      <p className="text-[10px] text-zinc-500 font-mono mb-6 max-w-sm uppercase">{challengeError}</p>
                      <button
                        onClick={() => generateNewWord()}
                        className="px-6 py-2 border border-white/10 hover:border-red-500/50 hover:text-red-400 text-zinc-400 bg-white/5 text-[10px] font-mono font-bold transition-all cursor-pointer uppercase tracking-widest"
                      >
                        Retry_Generator
                      </button>
                    </motion.div>
                  ) : currentChallenge ? (
                    <motion.div 
                      key="active-dict"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="w-full flex flex-col items-center gap-8"
                    >
                      {isFallbackActive && (
                        <div className="w-full max-w-md text-[10px] text-amber-400 font-mono bg-amber-400/5 border border-amber-400/20 px-4 py-2.5 uppercase tracking-widest text-center animate-pulse rounded-none">
                          ⚠️ Local Fallback active (Gemini rate-limited)
                        </div>
                      )}

                      {/* PACKAGE PROGRESS SEGMENTS BAR */}
                      {currentPackageWords.length > 0 && (
                        <div className="w-full max-w-xl flex items-center justify-between gap-2 px-2 py-1 bg-black/25 border border-white/5 rounded-none" id="package-progress-bar">
                          {currentPackageWords.map((word, idx) => {
                            const isCurrent = idx === currentPackageIndex;
                            const result = packageResults[idx];
                            
                            let barColor = 'bg-white/10';
                            let textColor = 'text-zinc-600';
                            
                            if (result === 'correct') {
                              barColor = 'bg-[#00ff41] shadow-[0_0_8px_#00ff41]';
                              textColor = 'text-[#00ff41] font-bold';
                            } else if (result === 'given_up') {
                              barColor = 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
                              textColor = 'text-red-500 font-bold';
                            } else if (isCurrent) {
                              barColor = 'bg-white animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.4)]';
                              textColor = 'text-white font-black';
                            }
                            
                            return (
                              <div key={idx} className="flex-1 flex flex-col gap-1.5">
                                <div className={`h-1.5 transition-all duration-300 ${barColor}`} />
                                <span className={`text-[8px] font-mono tracking-widest text-center uppercase ${textColor}`}>
                                  S_0{idx+1}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* GIANT PLAY SPEECH TRIGGERS (Bold Typography Center Piece) */}
                      <div className="flex flex-col items-center justify-center gap-10 relative mt-4">
                        
                        {/* Audio pulsing rings */}
                        {isSpeaking && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-48 h-48 rounded-full bg-[#00ff41]/5 border border-[#00ff41]/10 absolute pulse-ring" />
                            <div className="w-56 h-56 rounded-full bg-[#00ff41]/2 border border-[#00ff41]/5 absolute pulse-ring [animation-delay:0.5s]" />
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
                          {/* Main Play Button (Center Piece) */}
                          <button
                            onClick={() => speakWord(currentChallenge.word)}
                            className={`group relative w-44 h-44 rounded-full border-2 flex flex-col items-center justify-center transition-all bg-black/40 backdrop-blur-xl cursor-pointer ${
                              isSpeaking 
                                ? 'border-[#00ff41] shadow-[0_0_15px_#00ff41]' 
                                : 'border-white/5 hover:border-[#00ff41]'
                            }`}
                            title="Play Native Voice Dictation"
                            id="dictation-play-btn"
                          >
                            <div className="absolute inset-0 rounded-full border border-white/0 group-hover:scale-110 group-hover:border-[#00ff41]/30 transition-transform duration-500"></div>
                            <svg className={`w-14 h-14 transition-colors ${isSpeaking ? 'text-[#00ff41]' : 'text-white group-hover:text-[#00ff41]'}`} fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                            <span className="absolute -bottom-8 text-[9px] uppercase tracking-[0.3em] text-zinc-400 group-hover:text-white transition-colors">Listen.Wav</span>
                          </button>

                          {/* Slow Play button */}
                          <button
                            onClick={() => speakWord(currentChallenge.word, true)}
                            className={`px-4 py-2 border text-[9px] uppercase tracking-widest font-bold transition-all cursor-pointer bg-white/5 ${
                              isSpeaking
                                ? 'border-white/5 text-zinc-600 cursor-not-allowed'
                                : 'border-white/10 text-zinc-400 hover:border-amber-500 hover:text-amber-400'
                            }`}
                            title="Play Slow Dictation (70% Speed)"
                            id="dictation-slow-play-btn"
                            disabled={isSpeaking}
                          >
                            Slow_Playback
                          </button>
                        </div>
                      </div>

                      {/* SPELLING FEEDBACK REVEALS */}
                      {(challengeStatus === 'correct' || challengeStatus === 'given_up') && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`w-full max-w-md rounded-none p-5 border text-center font-mono ${
                            challengeStatus === 'correct' 
                              ? 'bg-black/60 border-[#00ff41]/50 text-[#00ff41] shadow-[0_0_15px_rgba(0,255,65,0.1)]' 
                              : 'bg-black/60 border-red-500/30 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
                          }`}
                        >
                          <div className="text-[9px] uppercase tracking-widest text-zinc-500 mb-2">
                            {challengeStatus === 'correct' ? "Challenge.Solved.Successfully" : "Challenge.Revealed"}
                          </div>
                          <div className="text-3xl font-black uppercase tracking-widest mb-1">
                            {currentChallenge.word}
                          </div>
                          <div className="text-xs text-zinc-400 tracking-wider">
                            {currentChallenge.phonetic}
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  ) : (
                    <div className="py-10 text-center">
                      <button
                        onClick={() => generateNewWord()}
                        className="px-10 py-4 bg-[#00ff41] hover:brightness-110 text-black text-xs font-mono font-bold uppercase tracking-widest transition-all cursor-pointer"
                      >
                        Launch_Dictation_Challenge
                      </button>
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {/* INPUT FORM AND CONTROL ACTIONS */}
              {currentChallenge && !isLoadingChallenge && (
                <div className="bg-black/40 border border-white/5 rounded-none p-6 md:p-8 flex flex-col gap-6 backdrop-blur-xl">
                  <form onSubmit={handleSubmitSpelling} className="flex flex-col gap-6">
                    <div className="flex flex-col gap-3 text-center">
                      <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Typing_Required_</label>
                      
                      <div className={`relative ${shakeInput ? 'animate-shake' : ''} group`}>
                        <input
                          ref={inputRef}
                          type="text"
                          value={userInput}
                          onChange={(e) => setUserInput(e.target.value.replace(/[^a-zA-Z]/g, ''))} // only letters
                          placeholder="ENTER_SPELLING..."
                          disabled={challengeStatus === 'correct' || challengeStatus === 'given_up'}
                          className={`w-full bg-transparent border-b-2 py-4 text-2xl sm:text-4xl text-center focus:outline-none transition-all uppercase tracking-widest font-light ${
                            challengeStatus === 'correct'
                              ? 'border-[#00ff41] text-[#00ff41]'
                              : challengeStatus === 'given_up'
                              ? 'border-red-500 text-red-500'
                              : 'border-white/10 text-[#e0e0e0] focus:border-[#00ff41]'
                          }`}
                          autoComplete="off"
                          autoCapitalize="off"
                          spellCheck="false"
                          id="spelling-input"
                        />
                        <div className={`absolute left-0 bottom-0 h-[2px] bg-[#00ff41] transition-all duration-700 ${challengeStatus === 'correct' ? 'w-full' : challengeStatus === 'given_up' ? 'w-full bg-red-500' : 'w-0 group-focus-within:w-full'}`}></div>

                        {challengeStatus === 'correct' && (
                          <div className="absolute right-4 inset-y-0 flex items-center text-[#00ff41]">
                            <Check className="w-6 h-6" />
                          </div>
                        )}
                        {challengeStatus === 'given_up' && (
                          <div className="absolute right-4 inset-y-0 flex items-center text-red-500">
                            <X className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* CONTROL TOGGLES (Bold Typography Squared Buttons) */}
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-4">
                        {challengeStatus === 'active' ? (
                          <>
                            <button
                              type="button"
                              onClick={handleGiveUp}
                              className="px-8 py-3.5 border border-white/20 text-white/40 font-bold uppercase tracking-widest text-xs hover:border-red-500 hover:text-red-500 active:scale-95 transition-all cursor-pointer"
                              id="give-up-btn"
                            >
                              Give_Up
                            </button>
                            <button
                              type="submit"
                              disabled={!userInput.trim()}
                              className="px-8 py-3.5 bg-[#00ff41] text-black font-bold uppercase tracking-widest text-xs hover:brightness-110 active:scale-95 transition-all disabled:bg-white/5 disabled:text-white/20 disabled:cursor-not-allowed cursor-pointer"
                              id="submit-spelling-btn"
                            >
                              Submit_Input
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={handleNextWord}
                            className="px-8 py-3.5 bg-[#00ff41] text-black font-bold uppercase tracking-widest text-xs hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                            id="next-word-btn"
                          >
                            <span>{currentPackageIndex + 1 < currentPackageWords.length ? "Next_Challenge" : "Finish_Package"}</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* QUICK VOICE DICTATION TRIGGERS */}
                      {challengeStatus === 'active' && (
                        <button
                          type="button"
                          onClick={() => speakWord(userInput || "spell")}
                          disabled={!userInput.trim()}
                          className="px-4 py-2 border border-white/10 hover:border-white/30 text-white/40 hover:text-white bg-white/5 text-[9px] uppercase tracking-widest font-mono transition-all disabled:opacity-40 cursor-pointer"
                          title="Speak what you currently have typed"
                        >
                          Hear_Attempt
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}

              {/* ANTI-REPETITION ENGINE STATUS MONITOR */}
              {currentChallenge && !isLoadingChallenge && (
                <div className="bg-black/40 border border-white/5 rounded-none p-5 md:p-6 flex flex-col gap-4 backdrop-blur-xl" id="batch-engine-monitor">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-[#00ff41]" />
                      <span className="font-mono text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Anti_Repetition_Engine_V3</span>
                    </div>
                    {isFallbackActive ? (
                      <span className="text-[9px] font-mono text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 uppercase tracking-wider animate-pulse">
                        Offline Fallback Active
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono text-[#00ff41] bg-[#00ff41]/10 border border-[#00ff41]/20 px-2 py-0.5 uppercase tracking-wider">
                        AI Memory Active
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* MEMORY BUFFER */}
                    <div className="bg-black border border-white/5 rounded-none p-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Memory Size</span>
                        <Sparkles className="w-3.5 h-3.5 text-[#00ff41]" />
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-[#00ff41]">{usedWords.length}</span>
                        <span className="text-[10px] text-zinc-500 uppercase">Words Remembered</span>
                      </div>
                      <p className="text-[8px] text-zinc-600 uppercase tracking-wider mt-2 leading-relaxed">
                        The engine actively tracks and blocks these words to avoid any spelling repetition during play.
                      </p>
                    </div>

                    {/* ENGINE CONTROLS */}
                    <div className="bg-black border border-white/5 rounded-none p-4 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest block mb-2">Memory Actions</span>
                        <p className="text-[9px] text-zinc-400 uppercase tracking-wider leading-relaxed">
                          Reset the anti-repetition memory array if you want to allow words to be repeated again.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          if (window.confirm("Clear all remembered words?")) {
                            setUsedWords([]);
                            localStorage.removeItem('DICT_USED_WORDS');
                          }
                        }}
                        className="w-full mt-4 py-2 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-500 text-[9px] font-mono font-bold uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Reset_Memory_Array</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* RIGHT COLUMN: STATISTICS & WORD HISTORY PANEL */}
        <section className="lg:col-span-4 flex flex-col gap-6" id="stats-history-sidebar">
          
          {/* MULTI-TAB WORKSPACE CARD */}
          <div className="bg-black/40 border border-white/5 rounded-none flex flex-col overflow-hidden h-full min-h-[500px] backdrop-blur-xl">
            
            {/* TAB CONTROLLERS */}
            <div className="flex border-b border-white/5 bg-black p-1">
              <button
                onClick={() => setActiveTab('challenge')}
                className={`flex-1 py-3 rounded-none text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'challenge' ? 'bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/20' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Stats_Monitor</span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-3 rounded-none text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'history' ? 'bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/20' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Word_Log ({wordHistory.length})</span>
              </button>
            </div>

            {/* TAB CONTAINER BODY */}
            <div className="flex-1 p-5 overflow-y-auto">
              
              {/* TAB 1: ACCURACY & PERFORMANCE STATISTICS */}
              {activeTab === 'challenge' && (
                <div className="flex flex-col gap-6 font-mono">
                  <div>
                    <h3 className="text-[10px] uppercase text-zinc-500 tracking-widest font-bold mb-3">Spelling_Performance</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-black border border-white/5 rounded-none p-4">
                        <span className="text-[9px] text-zinc-500 block uppercase tracking-widest">Accuracy</span>
                        <span className="text-2xl font-black text-[#00ff41]">{accuracyRate}%</span>
                      </div>
                      <div className="bg-black border border-white/5 rounded-none p-4">
                        <span className="text-[9px] text-zinc-500 block uppercase tracking-widest">Total Words</span>
                        <span className="text-2xl font-black text-[#e0e0e0]">{stats.totalPlayed}</span>
                      </div>
                      <div className="bg-black border border-white/5 rounded-none p-4">
                        <span className="text-[9px] text-zinc-500 block uppercase tracking-widest">Correct</span>
                        <span className="text-2xl font-black text-zinc-300">{stats.correctCount}</span>
                      </div>
                      <div className="bg-black border border-white/5 rounded-none p-4">
                        <span className="text-[9px] text-zinc-500 block uppercase tracking-widest">Given Up</span>
                        <span className="text-2xl font-black text-zinc-300">{stats.gaveUpCount}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[10px] uppercase text-zinc-500 tracking-widest font-bold mb-3">Streak_Tracker</h3>
                    <div className="bg-black border border-white/5 rounded-none p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-none bg-orange-950/20 border border-orange-500/20 flex items-center justify-center text-orange-400">
                          <Flame className="w-6 h-6 fill-orange-500/10" />
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-500 block uppercase tracking-widest">Current Streak</span>
                          <span className="text-sm font-bold text-orange-400 uppercase tracking-widest">{stats.streak} consecutive</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[8px] text-zinc-500 block uppercase tracking-widest">Max</span>
                        <span className="text-xs font-bold text-zinc-300 uppercase">{stats.maxStreak} active</span>
                      </div>
                    </div>
                  </div>

                  {/* MINI GAME EXPLAINERS */}
                  <div className="bg-black border border-white/5 rounded-none p-4 text-[10px] text-zinc-500 leading-relaxed font-mono uppercase">
                    <div className="font-mono text-zinc-400 text-xs font-bold mb-2 uppercase tracking-widest flex items-center gap-1">
                      <Sparkle className="w-3.5 h-3.5 text-[#00ff41]" />
                      <span>Dictation_Rules</span>
                    </div>
                    <p className="mb-2 text-zinc-500">
                      1. Words are loaded dynamically using Google Gemini based on your set difficulty (1 to 10).
                    </p>
                    <p className="mb-2 text-zinc-500">
                      2. Read-aloud is powered by native web speech synthesis. Make sure your device volume is turned up!
                    </p>
                    <p className="text-zinc-500">
                      3. If you submit a spelling and fail, the system shakes. Try again or unlock hints if stuck.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 2: SPELLING HISTORY LOG */}
              {activeTab === 'history' && (
                <div className="flex flex-col gap-4 font-mono">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Chronological_Log</span>
                    {wordHistory.length > 0 && (
                      <button
                        onClick={handleClearHistory}
                        className="text-[9px] font-mono text-zinc-500 hover:text-red-400 flex items-center gap-1 cursor-pointer uppercase tracking-wider font-bold"
                        title="Delete history logs"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear_All</span>
                      </button>
                    )}
                  </div>

                  {wordHistory.length === 0 ? (
                    <div className="text-center py-12">
                      <History className="w-8 h-8 text-zinc-800 mx-auto mb-2" />
                      <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">No spelling challenges recorded yet.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {wordHistory.map((entry, index) => (
                        <div 
                          key={index}
                          className="bg-black border border-white/5 rounded-none p-4 flex flex-col gap-2 group hover:border-[#00ff41]/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs tracking-widest uppercase text-zinc-200 group-hover:text-[#00ff41] transition-colors">
                              {entry.word}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] font-mono bg-white/5 border border-white/10 rounded-none px-1.5 py-0.5 text-zinc-400 uppercase tracking-wider">
                                Lvl_{entry.difficulty}
                              </span>
                              {entry.result === 'correct' ? (
                                <span className="text-[8px] font-mono text-[#00ff41] bg-[#00ff41]/5 border border-[#00ff41]/20 rounded-none px-1.5 py-0.5 uppercase tracking-wider font-bold">
                                  Solved
                                </span>
                              ) : (
                                <span className="text-[8px] font-mono text-red-400 bg-red-950/20 border border-red-500/20 rounded-none px-1.5 py-0.5 uppercase tracking-wider font-bold">
                                  Skipped
                                </span>
                              )}
                            </div>
                          </div>

                          {entry.sentence && (
                            <p className="text-[10px] text-zinc-500 leading-snug line-clamp-2 uppercase font-mono border-l border-white/10 pl-2">
                              "{entry.sentence}"
                            </p>
                          )}

                          <div className="flex items-center justify-between pt-1 border-t border-white/5 mt-1">
                            <span className="text-[8px] font-mono text-zinc-600">
                              {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button
                              onClick={() => speakWord(entry.word)}
                              className="text-[9px] font-mono text-[#00ff41] hover:underline flex items-center gap-1 cursor-pointer uppercase tracking-widest font-bold"
                              title="Re-play word dictation"
                            >
                              <Volume2 className="w-3 h-3" />
                              <span>Replay</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </section>

      </main>

      {/* --- SETTINGS & CONFIG MODAL OVERLAY --- */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay backdrop */}
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => setIsSettingsOpen(false)}
          />

          {/* Modal Container */}
          <div className="relative bg-[#050505] border border-white/10 rounded-none w-full max-w-lg overflow-hidden shadow-2xl relative z-10">
            
            {/* Header */}
            <div className="border-b border-white/10 bg-black px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#00ff41]" />
                <h3 className="font-mono text-xs font-bold text-zinc-200 uppercase tracking-widest">Dictation_Engine_Config</h3>
              </div>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="p-5 flex flex-col gap-5 overflow-y-auto max-h-[75vh]">
              
              {/* Gemini API Key */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest flex items-center justify-between">
                  <span>Gemini API Key</span>
                  <a 
                    href="https://aistudio.google.com/" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[9px] text-[#00ff41] hover:underline uppercase tracking-wider"
                  >
                    Fetch_Token_Access
                  </a>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    placeholder="ENTER_API_KEY..."
                    className="w-full bg-black text-zinc-200 border border-white/10 rounded-none py-3 pl-3 pr-24 text-[10px] font-mono uppercase focus:outline-none focus:border-[#00ff41]"
                  />
                  <div className="absolute inset-y-0 right-1.5 flex items-center">
                    <button
                      type="button"
                      onClick={handleTestApiKey}
                      disabled={isTestingKey}
                      className="px-3 py-1.5 bg-[#00ff41] hover:brightness-110 text-black text-[9px] font-mono font-bold rounded-none disabled:bg-zinc-800 disabled:text-zinc-500 transition-all cursor-pointer uppercase tracking-wider"
                    >
                      {isTestingKey ? "Testing..." : "Test_&_Save"}
                    </button>
                  </div>
                </div>
                {keyTestStatus === 'success' && (
                  <p className="text-[9px] font-mono text-[#00ff41] uppercase tracking-wider">Authentication successful. Session validated.</p>
                )}
                {keyTestStatus === 'error' && (
                  <p className="text-[9px] font-mono text-red-500 uppercase tracking-wider">{keyTestError}</p>
                )}
              </div>

              {/* Model selection */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Model_Selection</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-black text-zinc-300 border border-white/10 rounded-none p-3 text-xs font-mono uppercase focus:outline-none focus:border-[#00ff41] cursor-pointer"
                >
                  <option value="gemini-2.5-flash">gemini-2.5-flash (Fast & Recommended)</option>
                  <option value="gemini-2.5-pro">gemini-2.5-pro (High intelligence)</option>
                </select>
                <p className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider">
                  Pro models generate richer definition/context formatting but have slightly higher latency.
                </p>
              </div>

              {/* Difficulty 1-10 Slider */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                  <span>Difficulty scaling</span>
                  <span className="text-[#00ff41] font-bold">Level {difficulty} of 10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={difficulty}
                  onChange={(e) => setDifficulty(parseInt(e.target.value, 10))}
                  className="w-full accent-[#00ff41] h-1 bg-black rounded-none cursor-pointer"
                />
                
                {/* Visual Difficulty Descriptions */}
                <div className="bg-black p-3 border border-white/5 rounded-none text-[8px] font-mono uppercase tracking-wider">
                  {difficulty <= 3 ? (
                    <span className="text-[#00ff41]">
                      🟢 EASY (Lvl 1-3): Focuses on short, basic spelling, perfect for warming up.
                    </span>
                  ) : difficulty <= 7 ? (
                    <span className="text-amber-400">
                      🟡 MEDIUM (Lvl 4-7): High-frequency academic terms, science vocabularies, and spelling tricks.
                    </span>
                  ) : (
                    <span className="text-red-400">
                      🔴 ADVANCED (Lvl 8-10): Extreme, obscure vocabulary, foreign words, complex phonetic conversions.
                    </span>
                  )}
                </div>
              </div>

              {/* Words per Package Slider */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                  <span>Words per Package</span>
                  <span className="text-[#00ff41] font-bold">{packageSize} Words</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={packageSize}
                  onChange={(e) => setPackageSize(parseInt(e.target.value, 10))}
                  className="w-full accent-[#00ff41] h-1 bg-black rounded-none cursor-pointer"
                />
                <p className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider">
                  Determines the number of spelling challenges pre-loaded in a single batch session to minimize API requests and prevent rate-limiting.
                </p>
              </div>

              <div className="border-t border-white/5 my-1" />

              {/* Speech Voice parameters */}
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest flex items-center gap-1 font-bold">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Speech voice synthesizer config</span>
                </span>

                {/* Voice selection */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider">Synthesis Voice Selection</label>
                  <select
                    value={selectedVoiceURI}
                    onChange={(e) => setSelectedVoiceURI(e.target.value)}
                    className="w-full bg-black text-zinc-300 border border-white/10 rounded-none p-3 text-xs font-mono uppercase focus:outline-none focus:border-[#00ff41] cursor-pointer"
                  >
                    {voices.map((voice, idx) => (
                      <option key={`${voice.voiceURI || 'voice'}-${idx}`} value={voice.voiceURI}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                    {voices.length === 0 && (
                      <option value="">Default OS Synthesis Voice</option>
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Speech rate slider */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[8px] font-mono text-zinc-500 uppercase tracking-widest">
                      <span>Speaking Speed</span>
                      <span>{speechRate}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="1.5"
                      step="0.1"
                      value={speechRate}
                      onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                      className="w-full accent-[#00ff41] h-1 bg-black rounded-none cursor-pointer"
                    />
                  </div>

                  {/* Speech Pitch slider */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[8px] font-mono text-zinc-500 uppercase tracking-widest">
                      <span>Vocal Pitch</span>
                      <span>{speechPitch}</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="1.5"
                      step="0.1"
                      value={speechPitch}
                      onChange={(e) => setSpeechPitch(parseFloat(e.target.value))}
                      className="w-full accent-[#00ff41] h-1 bg-black rounded-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Actions Footer */}
            <div className="border-t border-white/10 bg-black px-5 py-4 flex items-center justify-between">
              <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Offline_Storage_Ready</p>
              <button
                onClick={() => {
                  setIsSettingsOpen(false);
                  // Trigger word refresh if settings changed and we have a key
                  if (apiKey) generateNewWord();
                }}
                className="px-6 py-2.5 bg-[#00ff41] text-black rounded-none text-[10px] font-mono font-bold uppercase tracking-widest transition-all hover:brightness-110 active:scale-95 cursor-pointer"
              >
                Commit_Config
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- SIMPLE FOOTER BAR --- */}
      <footer className="border-t border-white/5 bg-black py-6 px-6 text-center text-zinc-500 text-[10px] font-mono flex items-center justify-between flex-wrap gap-4 uppercase tracking-wider">
        <span>DICTATION.ENGINE_V1.0 © 2026. SECURE_SANDBOX.</span>
        <div className="flex gap-4">
          <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="hover:text-[#00ff41] transition-colors">Gemini_API</a>
          <span>•</span>
          <span className="text-[#00ff41] font-bold">System_Connection_Online</span>
        </div>
      </footer>

    </div>
  );
}
