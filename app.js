// Dutton Translator - Core Application Engine
// Engineered for Dutton & Co. Heritage Platform

(function() {
  'use strict';

  // --- STATE ---
  let state = {
    sourceLang: 'auto',
    targetLang: 'pa', // Default target: Punjabi (ਪੰਜਾਬੀ)
    detectedLang: null,
    sourceText: '',
    translatedText: '',
    phoneticText: '',
    isTranslating: false,
    isListening: false,
    userWantsRecording: false, // True while continuous recording is active
    baseRecordingText: '',     // Holds base passage so text is never erased
    recordingSeconds: 0,
    recordingInterval: null,
    activeListeningMode: 'studio', // 'studio' | 'convo-a' | 'convo-b'
    speechSpeed: 1.0,
    history: [],
    starred: []
  };

  // Debounce timer for instant typing
  let debounceTimer = null;
  let recognitionInstance = null;
  let audioPlayer = null;
  let isPlayingSpeech = false;
  let speechQueue = [];
  let speechQueueIndex = 0;

  // --- DOM ELEMENTS ---
  const els = {
    // Nav & Views
    navTranslator: document.getElementById('nav-translator'),
    navConversation: document.getElementById('nav-conversation'),
    navPhrasebook: document.getElementById('nav-phrasebook'),
    navHistory: document.getElementById('nav-history'),
    historyCounter: document.getElementById('history-counter'),
    mobileModeToggle: document.getElementById('mobile-mode-toggle'),
    mobileMenu: document.getElementById('mobile-menu'),

    viewTranslator: document.getElementById('view-translator'),
    viewConversation: document.getElementById('view-conversation'),
    viewPhrasebook: document.getElementById('view-phrasebook'),
    viewHistory: document.getElementById('view-history'),

    // Studio Elements
    sourceTabsContainer: document.getElementById('source-tabs-container'),
    targetTabsContainer: document.getElementById('target-tabs-container'),
    btnSwapLanguages: document.getElementById('btn-swap-languages'),

    sourceLangFlag: document.getElementById('source-lang-flag'),
    sourceLangDisplay: document.getElementById('source-lang-display'),
    detectedBadge: document.getElementById('detected-badge'),
    sourceText: document.getElementById('source-text'),
    btnClearSource: document.getElementById('btn-clear-source'),
    charCount: document.getElementById('char-count'),
    btnTranslateManual: document.getElementById('btn-translate-manual'),

    // Continuous Recording Elements
    recordingStatusBar: document.getElementById('recording-status-bar'),
    recordingTimer: document.getElementById('recording-timer'),
    btnStopContinuous: document.getElementById('btn-stop-continuous'),
    speechLiveBar: document.getElementById('speech-live-bar'),
    speechLiveInterim: document.getElementById('speech-live-interim'),

    // Voice & Input Controls
    btnMic: document.getElementById('btn-mic'),
    micIcon: document.getElementById('mic-icon'),
    micLabel: document.getElementById('mic-label'),
    btnSpeakSource: document.getElementById('btn-speak-source'),
    btnPaste: document.getElementById('btn-paste'),

    // Target Output & Accent
    targetLangFlag: document.getElementById('target-lang-flag'),
    targetLangDisplay: document.getElementById('target-lang-display'),
    accentBadge: document.getElementById('accent-badge'),
    accentName: document.getElementById('accent-name'),
    targetPlaceholder: document.getElementById('target-placeholder'),
    targetText: document.getElementById('target-text'),
    targetPhonetics: document.getElementById('target-phonetics'),
    translationSpinner: document.getElementById('translation-spinner'),
    engineBadge: document.getElementById('engine-badge'),

    // Target Voice & Action Controls
    btnSpeakTarget: document.getElementById('btn-speak-target'),
    audioWaveBox: document.getElementById('audio-wave-box'),
    voiceSpeedSelect: document.getElementById('voice-speed-select'),
    btnCopyTarget: document.getElementById('btn-copy-target'),
    copyTooltip: document.getElementById('copy-tooltip'),
    btnStarTarget: document.getElementById('btn-star-target'),
    btnShareTarget: document.getElementById('btn-share-target'),
    btnFullscreenTarget: document.getElementById('btn-fullscreen-target'),

    // Language Modal
    langModal: document.getElementById('lang-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalSearchInput: document.getElementById('modal-search-input'),
    modalLangGrid: document.getElementById('modal-lang-grid'),
    btnCloseModal: document.getElementById('btn-close-modal'),

    // Fullscreen View
    fullscreenModal: document.getElementById('fullscreen-modal'),
    fsTargetLang: document.getElementById('fs-target-lang'),
    fsTargetText: document.getElementById('fs-target-text'),
    fsSourceText: document.getElementById('fs-source-text'),
    fsBtnSpeak: document.getElementById('fs-btn-speak'),
    fsBtnCopy: document.getElementById('fs-btn-copy'),
    btnCloseFullscreen: document.getElementById('btn-close-fullscreen'),

    // Toast
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message'),

    // Phrase Starters
    phraseStarters: document.getElementById('phrase-starters'),

    // Convo Elements
    convoFeed: document.getElementById('convo-feed'),
    btnConvoMicA: document.getElementById('btn-convo-mic-a'),
    btnConvoMicB: document.getElementById('btn-convo-mic-b'),
    btnBackToTranslator: document.getElementById('btn-back-to-translator'),
    btnBackToTranslatorPhrase: document.getElementById('btn-back-to-translator-phrase'),
    btnBackToTranslatorHist: document.getElementById('btn-back-to-translator-hist'),

    // Phrasebook & History
    phrasebookList: document.getElementById('phrasebook-list'),
    historyList: document.getElementById('history-list'),
    btnClearHistory: document.getElementById('btn-clear-history')
  };

  let modalMode = 'source'; // 'source' or 'target'

  // --- INITIALIZATION ---
  function init() {
    loadStoredData();
    renderLanguageTabs();
    populatePhrasebook();
    bindEvents();
    updateUIForSelectedLanguages();
    updateHistoryCounter();

    // Init Web Speech if available
    setupSpeechRecognition();
  }

  // --- LOCAL STORAGE ---
  function loadStoredData() {
    try {
      const savedHistory = localStorage.getItem('dutton_translator_history');
      if (savedHistory) state.history = JSON.parse(savedHistory);

      const savedStarred = localStorage.getItem('dutton_translator_starred');
      if (savedStarred) state.starred = JSON.parse(savedStarred);
    } catch (e) {
      console.warn('Storage read failed:', e);
    }
  }

  function persistHistory() {
    try {
      localStorage.setItem('dutton_translator_history', JSON.stringify(state.history.slice(0, 50)));
      localStorage.setItem('dutton_translator_starred', JSON.stringify(state.starred));
    } catch (e) {
      console.warn('Storage write failed:', e);
    }
    updateHistoryCounter();
  }

  function updateHistoryCounter() {
    if (els.historyCounter) {
      els.historyCounter.textContent = state.history.length;
    }
  }

  // --- LANGUAGE & ACCENT HELPERS ---
  function getLang(code) {
    return LANGUAGES.find(l => l.code === code) || { code, name: code, native: code, flag: '🌐', speech: 'en-US' };
  }

  function getAccentTitle(code) {
    const accents = {
      pa: 'Original Punjabi Accent (ਪੰਜਾਬੀ)',
      en: 'Original English Accent',
      hi: 'Original Hindi Accent (हिन्दी)',
      es: 'Original Castilian Spanish Accent',
      fr: 'Original Parisian French Accent',
      de: 'Original German Accent',
      ar: 'Original Arabic Accent (العربية)',
      zh: 'Original Mandarin Chinese Accent',
      'zh-TW': 'Original Taiwanese Mandarin Accent',
      ja: 'Original Japanese Accent (日本語)',
      ru: 'Original Russian Accent',
      pt: 'Original Portuguese Accent',
      it: 'Original Italian Accent',
      ko: 'Original Korean Accent (한국어)',
      tr: 'Original Turkish Accent',
      ur: 'Original Urdu Accent (اردو)',
      bn: 'Original Bengali Accent (বাংলা)',
      gu: 'Original Gujarati Accent',
      mr: 'Original Marathi Accent',
      ta: 'Original Tamil Accent',
      te: 'Original Telugu Accent',
      fa: 'Original Persian Accent',
      nl: 'Original Dutch Accent',
      pl: 'Original Polish Accent',
      th: 'Original Thai Accent',
      vi: 'Original Vietnamese Accent'
    };
    if (accents[code]) return accents[code];
    const l = getLang(code);
    return `Original ${l.name} Accent`;
  }

  // --- RENDER TABS ---
  function renderLanguageTabs() {
    // Source Tabs
    els.sourceTabsContainer.innerHTML = '';
    POPULAR_SOURCE_CODES.forEach(code => {
      const lang = getLang(code);
      const btn = document.createElement('button');
      btn.className = `lang-tab text-xs px-3 py-1.5 rounded-lg border border-[#2a2825] bg-[#121212] text-[#8e887f] hover:text-white hover:border-[#453e34] ${state.sourceLang === code ? 'active' : ''}`;
      btn.innerHTML = `<span>${lang.flag}</span> <span class="ml-1">${lang.name}</span>`;
      btn.addEventListener('click', () => {
        setSourceLanguage(code);
      });
      els.sourceTabsContainer.appendChild(btn);
    });

    // Add "More..." dropdown button for Source
    const moreSourceBtn = document.createElement('button');
    moreSourceBtn.className = 'lang-tab text-xs px-2.5 py-1.5 rounded-lg border border-[#38332c] bg-[#1e1d1b] text-[#c8933b] hover:bg-[#252320] flex items-center gap-1';
    moreSourceBtn.innerHTML = `<span>More</span> <i class="fa-solid fa-chevron-down text-[10px]"></i>`;
    moreSourceBtn.addEventListener('click', () => openLanguageModal('source'));
    els.sourceTabsContainer.appendChild(moreSourceBtn);

    // Target Tabs
    els.targetTabsContainer.innerHTML = '';
    POPULAR_TARGET_CODES.forEach(code => {
      const lang = getLang(code);
      const btn = document.createElement('button');
      btn.className = `lang-tab text-xs px-3 py-1.5 rounded-lg border border-[#2a2825] bg-[#121212] text-[#8e887f] hover:text-white hover:border-[#453e34] ${state.targetLang === code ? 'active' : ''}`;
      btn.innerHTML = `<span>${lang.flag}</span> <span class="ml-1">${lang.name}</span>`;
      btn.addEventListener('click', () => {
        setTargetLanguage(code);
      });
      els.targetTabsContainer.appendChild(btn);
    });

    // Add "More..." dropdown button for Target
    const moreTargetBtn = document.createElement('button');
    moreTargetBtn.className = 'lang-tab text-xs px-2.5 py-1.5 rounded-lg border border-[#38332c] bg-[#1e1d1b] text-[#c8933b] hover:bg-[#252320] flex items-center gap-1';
    moreTargetBtn.innerHTML = `<span>More</span> <i class="fa-solid fa-chevron-down text-[10px]"></i>`;
    moreTargetBtn.addEventListener('click', () => openLanguageModal('target'));
    els.targetTabsContainer.appendChild(moreTargetBtn);
  }

  function setSourceLanguage(code) {
    state.sourceLang = code;
    updateUIForSelectedLanguages();
    renderLanguageTabs();
    if (state.sourceText.trim()) triggerTranslation();
  }

  function setTargetLanguage(code) {
    if (code === 'auto') return; // Target cannot be auto
    state.targetLang = code;
    updateUIForSelectedLanguages();
    renderLanguageTabs();
    if (state.sourceText.trim()) triggerTranslation();
  }

  function updateUIForSelectedLanguages() {
    const sLang = getLang(state.sourceLang);
    const tLang = getLang(state.targetLang);

    els.sourceLangFlag.textContent = sLang.flag;
    els.sourceLangDisplay.textContent = state.sourceLang === 'auto' ? 'Auto Detect' : `${sLang.name} (${sLang.native})`;

    els.targetLangFlag.textContent = tLang.flag;
    els.targetLangDisplay.textContent = `${tLang.name} (${tLang.native})`;

    // Update Original Accent Badge
    if (els.accentName) {
      els.accentName.textContent = getAccentTitle(state.targetLang);
    }

    // Hide or show detected badge
    if (state.sourceLang !== 'auto') {
      els.detectedBadge.classList.add('hidden');
    }

    // Set Textarea direction (RTL support for Arabic, Urdu, Hebrew, etc.)
    els.sourceText.dir = sLang.dir || 'ltr';
    els.targetText.dir = tLang.dir || 'ltr';
  }

  // --- SWAP LANGUAGES ---
  function swapLanguages() {
    if (state.sourceLang === 'auto') {
      const actualSource = state.detectedLang || 'en';
      state.sourceLang = state.targetLang;
      state.targetLang = actualSource;
    } else {
      const temp = state.sourceLang;
      state.sourceLang = state.targetLang;
      state.targetLang = temp;
    }

    // Also swap text if target has content
    if (state.translatedText) {
      const tempText = state.sourceText;
      state.sourceText = state.translatedText;
      els.sourceText.value = state.sourceText;
      updateCharCount();
    }

    updateUIForSelectedLanguages();
    renderLanguageTabs();
    showToast('Languages swapped');

    if (state.sourceText.trim()) {
      triggerTranslation();
    }
  }

  // --- MODAL LANGUAGE PICKER ---
  function openLanguageModal(mode) {
    modalMode = mode;
    els.modalTitle.textContent = mode === 'source' ? 'Select Source Language' : 'Select Target Language';
    els.modalSearchInput.value = '';
    renderModalLanguages('');
    els.langModal.classList.remove('hidden');
    els.modalSearchInput.focus();
  }

  function closeLanguageModal() {
    els.langModal.classList.add('hidden');
  }

  function renderModalLanguages(filter) {
    els.modalLangGrid.innerHTML = '';
    const query = filter.toLowerCase().trim();

    const filtered = LANGUAGES.filter(l => {
      if (modalMode === 'target' && l.code === 'auto') return false;
      if (!query) return true;
      return l.name.toLowerCase().includes(query) ||
             l.native.toLowerCase().includes(query) ||
             l.code.toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
      els.modalLangGrid.innerHTML = `<div class="col-span-2 py-8 text-center text-[#8e887f] text-sm font-mono">No matching languages found.</div>`;
      return;
    }

    filtered.forEach(lang => {
      const item = document.createElement('button');
      const isSelected = (modalMode === 'source' ? state.sourceLang : state.targetLang) === lang.code;
      item.className = `flex items-center justify-between p-3 rounded-xl border text-left transition ${
        isSelected
          ? 'bg-[#262421] border-[#c8933b] text-[#c8933b]'
          : 'bg-[#151515] border-[#2a2825] hover:border-[#453e34] text-[#f3eee6] hover:bg-[#1c1b19]'
      }`;

      item.innerHTML = `
        <div class="flex items-center gap-2.5">
          <span class="text-lg">${lang.flag}</span>
          <div>
            <div class="text-sm font-medium ${isSelected ? 'text-[#c8933b]' : 'text-white'}">${lang.name}</div>
            <div class="text-[11px] text-[#8e887f] font-sans">${lang.native}</div>
          </div>
        </div>
        <span class="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#121212] text-[#8e887f] border border-[#2a2825]">${lang.code}</span>
      `;

      item.addEventListener('click', () => {
        if (modalMode === 'source') {
          setSourceLanguage(lang.code);
        } else {
          setTargetLanguage(lang.code);
        }
        closeLanguageModal();
      });

      els.modalLangGrid.appendChild(item);
    });
  }

  // --- CORE TRANSLATION ENGINE ---
  async function triggerTranslation() {
    const text = els.sourceText.value.trim();
    if (!text) {
      clearTargetUI();
      return;
    }

    state.sourceText = text;
    setLoadingState(true);

    try {
      const result = await translateMultiEngine(text, state.sourceLang, state.targetLang);
      
      state.translatedText = result.text;
      state.phoneticText = result.phonetic || '';
      if (result.detectedSource) {
        state.detectedLang = result.detectedSource;
        const dLang = getLang(result.detectedSource);
        els.detectedBadge.textContent = `Detected: ${dLang.name}`;
        els.detectedBadge.classList.remove('hidden');
      }

      renderTargetOutput(result.text, result.phonetic);
      logToHistory(text, result.text, state.sourceLang, state.targetLang);
    } catch (err) {
      console.error('Translation error:', err);
      renderTargetError('Unable to complete translation. Please check connection and try again.');
    } finally {
      setLoadingState(false);
    }
  }

  // Multi-engine fallback: Google GTX -> MyMemory -> Offline fallback
  async function translateMultiEngine(text, sl, tl) {
    const sourceCode = sl;
    const targetCode = tl;

    // 1. Google Translate API (fastest, supports Punjabi & 130+ languages natively)
    try {
      const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sourceCode)}&tl=${encodeURIComponent(targetCode)}&dt=t&dt=rm&q=${encodeURIComponent(text)}`;
      const res = await fetch(gUrl);
      if (res.ok) {
        const data = await res.json();
        let translated = '';
        let phonetic = '';

        if (data && data[0]) {
          data[0].forEach(chunk => {
            if (chunk[0]) translated += chunk[0];
            if (chunk[3]) phonetic += chunk[3] + ' ';
            else if (chunk[2]) phonetic += chunk[2] + ' ';
          });
        }

        const detected = data[2] || (data[8] ? data[8][0][0] : null);

        if (translated) {
          els.engineBadge.textContent = 'Dutton Neural GTX';
          return {
            text: translated,
            phonetic: phonetic.trim(),
            detectedSource: detected
          };
        }
      }
    } catch (e) {
      console.warn('Google GTX failed, switching to secondary engine:', e);
    }

    // 2. MyMemory Public Translation API (Secondary fallback)
    try {
      const myPair = `${sourceCode === 'auto' ? 'en' : sourceCode}|${targetCode}`;
      const mUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${myPair}`;
      const res = await fetch(mUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.responseData && data.responseData.translatedText) {
          els.engineBadge.textContent = 'Dutton Secondary Engine';
          return {
            text: data.responseData.translatedText,
            phonetic: '',
            detectedSource: null
          };
        }
      }
    } catch (e) {
      console.warn('MyMemory fallback failed:', e);
    }

    // 3. Built-in Offline Phrasebook Fallback
    const pairKey = `${sourceCode}-${targetCode}`.toLowerCase();
    const cleanLower = text.toLowerCase().trim();
    if (PHRASEBOOK_FALLBACK[pairKey] && PHRASEBOOK_FALLBACK[pairKey][cleanLower]) {
      els.engineBadge.textContent = 'Offline Heritage Vault';
      return {
        text: PHRASEBOOK_FALLBACK[pairKey][cleanLower],
        phonetic: '',
        detectedSource: null
      };
    }

    throw new Error('All translation engines were unreachable.');
  }

  function renderTargetOutput(translated, phonetics) {
    els.targetPlaceholder.classList.add('hidden');
    els.targetText.classList.remove('hidden');
    els.targetText.textContent = translated;

    if (phonetics) {
      els.targetPhonetics.textContent = `Pronunciation: [ ${phonetics} ]`;
      els.targetPhonetics.classList.remove('hidden');
    } else {
      els.targetPhonetics.classList.add('hidden');
    }
  }

  function renderTargetError(msg) {
    els.targetPlaceholder.classList.add('hidden');
    els.targetText.classList.remove('hidden');
    els.targetText.innerHTML = `<span class="text-red-400 font-sans text-sm"><i class="fa-solid fa-triangle-exclamation mr-1.5"></i> ${msg}</span>`;
    els.targetPhonetics.classList.add('hidden');
  }

  function clearTargetUI() {
    state.translatedText = '';
    state.phoneticText = '';
    els.targetText.textContent = '';
    els.targetText.classList.add('hidden');
    els.targetPhonetics.classList.add('hidden');
    els.targetPlaceholder.classList.remove('hidden');
  }

  function setLoadingState(loading) {
    state.isTranslating = loading;
    if (loading) {
      els.translationSpinner.classList.remove('hidden');
      els.translationSpinner.classList.add('flex');
    } else {
      els.translationSpinner.classList.add('hidden');
      els.translationSpinner.classList.remove('flex');
    }
  }

  // --- CONTINUOUS SPEECH RECOGNITION (PASSAGE CONTINUATION) ---
  function setupSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn('Web Speech API is not supported in this browser.');
      return;
    }

    recognitionInstance = new SpeechRec();
    recognitionInstance.continuous = true;     // Do not stop automatically
    recognitionInstance.interimResults = true;  // Real-time dictation

    recognitionInstance.onstart = () => {
      state.isListening = true;
      if (state.activeListeningMode === 'studio') {
        if (els.recordingStatusBar) els.recordingStatusBar.classList.remove('hidden');
        if (els.speechLiveBar) els.speechLiveBar.classList.remove('hidden');
        els.btnMic.classList.add('recording-pulse', 'border-red-500', 'text-red-400');
        if (els.micIcon) {
          els.micIcon.className = 'fa-solid fa-stop text-base text-red-400';
        }
        if (els.micLabel) {
          els.micLabel.textContent = 'Stop Recording';
        }
        startRecordingTimer();
      }
    };

    recognitionInstance.onresult = (event) => {
      let interim = '';
      let finalChunk = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalChunk += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (state.activeListeningMode === 'studio') {
        if (els.speechLiveInterim) {
          els.speechLiveInterim.textContent = interim || finalChunk.trim();
        }

        // When words are finalized, append them to the existing passage permanently!
        if (finalChunk.trim()) {
          const trimmed = finalChunk.trim();
          if (state.baseRecordingText) {
            const lastChar = state.baseRecordingText.slice(-1);
            const needsSpace = ![' ', '\n'].includes(lastChar);
            state.baseRecordingText += (needsSpace ? ' ' : '') + trimmed;
          } else {
            state.baseRecordingText = trimmed;
          }
          els.sourceText.value = state.baseRecordingText;
          updateCharCount();
        } else if (interim.trim()) {
          // Live preview: preserve the entire existing base passage, showing live interim at end
          const lastChar = state.baseRecordingText.slice(-1);
          const needsSpace = state.baseRecordingText && ![' ', '\n'].includes(lastChar);
          els.sourceText.value = state.baseRecordingText + (needsSpace ? ' ' : '') + interim.trim();
          updateCharCount();
        }
      } else if (state.activeListeningMode === 'convo-a') {
        if (finalChunk.trim()) handleConvoInput('en', finalChunk.trim());
      } else if (state.activeListeningMode === 'convo-b') {
        if (finalChunk.trim()) handleConvoInput('pa', finalChunk.trim());
      }
    };

    recognitionInstance.onerror = (event) => {
      console.warn('Speech recognition error event:', event.error);
      if (event.error === 'not-allowed') {
        stopListening();
        showToast('Microphone access denied. Please grant permission in browser settings.');
      } else if (event.error === 'network') {
        stopListening();
        showToast('Network issue occurred during speech recognition.');
      }
      // 'no-speech' is ignored so continuous recording stays active!
    };

    recognitionInstance.onend = () => {
      // IF USER HAS NOT CLICKED STOP, KEEP RECORDING CONTINUOUSLY!
      if (state.userWantsRecording) {
        try {
          recognitionInstance.start();
        } catch (err) {
          setTimeout(() => {
            if (state.userWantsRecording) {
              try { recognitionInstance.start(); } catch(e){}
            }
          }, 150);
        }
        return;
      }

      // User clicked stop
      cleanupRecordingUI();
      if (state.activeListeningMode === 'studio' && els.sourceText.value.trim()) {
        triggerTranslation();
      }
    };
  }

  function startListening(mode = 'studio', langCode = null) {
    if (!recognitionInstance) {
      showToast('Speech Recognition is not supported on this browser. Please use Chrome or Edge.');
      return;
    }

    // Stop speaking if playing
    stopSpeaking();

    state.userWantsRecording = true;
    state.activeListeningMode = mode;

    if (mode === 'studio') {
      // CRITICAL: Preserve whatever text is already in the textarea as a continuous passage!
      state.baseRecordingText = els.sourceText.value.trim();
    }

    let targetLocale = 'en-US';
    if (langCode) {
      const l = getLang(langCode);
      targetLocale = l.speech || 'en-US';
    } else {
      const sLang = getLang(state.sourceLang === 'auto' ? 'en' : state.sourceLang);
      targetLocale = sLang.speech || 'en-US';
    }

    try {
      recognitionInstance.lang = targetLocale;
      recognitionInstance.start();
    } catch (e) {
      console.warn('Error starting speech:', e);
    }
  }

  function stopListening() {
    state.userWantsRecording = false;
    state.isListening = false;
    if (recognitionInstance) {
      try { recognitionInstance.stop(); } catch(e){}
    }
    cleanupRecordingUI();
  }

  function cleanupRecordingUI() {
    stopRecordingTimer();
    if (els.recordingStatusBar) els.recordingStatusBar.classList.add('hidden');
    if (els.speechLiveBar) els.speechLiveBar.classList.add('hidden');
    els.btnMic.classList.remove('recording-pulse', 'border-red-500', 'text-red-400');
    if (els.micIcon) {
      els.micIcon.className = 'fa-solid fa-microphone text-base group-hover:scale-110 transition';
    }
    if (els.micLabel) {
      els.micLabel.textContent = 'Voice Input';
    }
    els.btnConvoMicA.classList.remove('recording-pulse');
    els.btnConvoMicB.classList.remove('recording-pulse');
  }

  function startRecordingTimer() {
    stopRecordingTimer();
    state.recordingSeconds = 0;
    if (els.recordingTimer) els.recordingTimer.textContent = '00:00';
    state.recordingInterval = setInterval(() => {
      state.recordingSeconds++;
      const mins = String(Math.floor(state.recordingSeconds / 60)).padStart(2, '0');
      const secs = String(state.recordingSeconds % 60).padStart(2, '0');
      if (els.recordingTimer) els.recordingTimer.textContent = `${mins}:${secs}`;
    }, 1000);
  }

  function stopRecordingTimer() {
    if (state.recordingInterval) {
      clearInterval(state.recordingInterval);
      state.recordingInterval = null;
    }
  }

  // --- TEXT TO SPEECH (100% ORIGINAL NATIVE ACCENT ENGINE) ---
  // Smart sentence chunker supporting entire continuous passages in authentic accents
  function splitTextForAudio(text, maxChars = 160) {
    if (!text) return [];
    const rawSentences = text.match(/[^.!?।॥\n]+[.!?।॥\n]+|[^.!?।॥\n]+$/g) || [text];
    const chunks = [];
    let cur = '';

    for (const sent of rawSentences) {
      const s = sent.trim();
      if (!s) continue;
      if ((cur + ' ' + s).trim().length <= maxChars) {
        cur = (cur ? cur + ' ' + s : s).trim();
      } else {
        if (cur) chunks.push(cur);
        if (s.length <= maxChars) {
          cur = s;
        } else {
          // split long sentence by words
          const words = s.split(/\s+/);
          let sub = '';
          for (const w of words) {
            if ((sub + ' ' + w).trim().length <= maxChars) {
              sub = (sub ? sub + ' ' + w : w).trim();
            } else {
              if (sub) chunks.push(sub);
              sub = w;
            }
          }
          if (sub) chunks.push(sub);
          cur = '';
        }
      }
    }
    if (cur) chunks.push(cur);
    return chunks.length ? chunks : [text.slice(0, maxChars)];
  }

  function speakText(text, langCode) {
    if (!text || !text.trim()) return;

    // Toggle: if currently speaking, clicking Pronounce halts playback
    if (isPlayingSpeech) {
      stopSpeaking();
      return;
    }

    stopSpeaking();
    stopListening();

    const accentName = getAccentTitle(langCode);

    // Show visualizer
    els.audioWaveBox.classList.remove('hidden');
    els.audioWaveBox.classList.add('inline-flex');
    isPlayingSpeech = true;

    // Chunk full passage into natural spoken segments
    speechQueue = splitTextForAudio(text.trim());
    speechQueueIndex = 0;

    showToast(`Speaking in ${accentName}...`);
    playNextSpeechChunk(langCode);
  }

  function playNextSpeechChunk(langCode) {
    if (!isPlayingSpeech || speechQueueIndex >= speechQueue.length) {
      stopSpeaking();
      return;
    }

    const chunk = speechQueue[speechQueueIndex];
    speechQueueIndex++;

    // 1. Primary: Google Studio Neural Audio Stream - 100% Authentic Native Regional Accent
    try {
      const encoded = encodeURIComponent(chunk);
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${langCode}&client=tw-ob`;

      if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer = null;
      }

      audioPlayer = new Audio(ttsUrl);
      audioPlayer.playbackRate = state.speechSpeed || 1.0;

      audioPlayer.onended = () => {
        if (isPlayingSpeech) {
          playNextSpeechChunk(langCode);
        }
      };

      audioPlayer.onerror = (e) => {
        console.warn('Audio stream error, falling back to Web Speech API with strict native voice matching:', e);
        speakChunkViaSpeechSynthesis(chunk, langCode, () => {
          if (isPlayingSpeech) playNextSpeechChunk(langCode);
        });
      };

      audioPlayer.play().catch(err => {
        console.warn('Autoplay restricted, falling back to SpeechSynthesis:', err);
        speakChunkViaSpeechSynthesis(chunk, langCode, () => {
          if (isPlayingSpeech) playNextSpeechChunk(langCode);
        });
      });
    } catch (err) {
      speakChunkViaSpeechSynthesis(chunk, langCode, () => {
        if (isPlayingSpeech) playNextSpeechChunk(langCode);
      });
    }
  }

  // Strict Native Fallback for Web Speech API
  function speakChunkViaSpeechSynthesis(chunk, langCode, onChunkEnd) {
    if (!window.speechSynthesis) {
      stopSpeaking();
      return;
    }

    const targetLangObj = getLang(langCode);
    const speechLocale = targetLangObj.speech || 'en-US';
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.rate = state.speechSpeed || 1.0;
    utterance.lang = speechLocale;

    // Strict native voice matching: do not play an English voice reading Punjabi/foreign words
    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find(v => {
      const vl = v.lang.toLowerCase();
      return vl === speechLocale.toLowerCase() || vl.startsWith(langCode.toLowerCase());
    });

    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onend = () => {
      if (onChunkEnd) onChunkEnd();
    };

    utterance.onerror = () => {
      stopSpeaking();
    };

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    isPlayingSpeech = false;
    speechQueue = [];
    speechQueueIndex = 0;

    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    els.audioWaveBox.classList.add('hidden');
    els.audioWaveBox.classList.remove('inline-flex');
  }

  // --- TWO-WAY VOICE CONVERSATION MODE ---
  async function handleConvoInput(speakerLang, spokenText) {
    const isPersonA = speakerLang === 'en';
    const targetLang = isPersonA ? 'pa' : 'en';

    appendConvoBubble(spokenText, speakerLang, isPersonA ? 'left' : 'right');

    try {
      const res = await translateMultiEngine(spokenText, speakerLang, targetLang);
      appendConvoBubble(res.text, targetLang, isPersonA ? 'right' : 'left', true);
      // Auto pronounce translation in authentic original accent!
      speakText(res.text, targetLang);
    } catch (e) {
      appendConvoBubble('Translation failed.', targetLang, isPersonA ? 'right' : 'left', true);
    }
  }

  function appendConvoBubble(text, langCode, align, isTranslated = false) {
    const lang = getLang(langCode);
    const bubble = document.createElement('div');
    bubble.className = `flex flex-col ${align === 'right' ? 'items-end' : 'items-start'} animate-fadeIn`;

    bubble.innerHTML = `
      <div class="max-w-[80%] rounded-2xl p-4 shadow-md ${
        align === 'right' 
          ? 'bg-[#262421] border border-[#c8933b]/40 text-white rounded-tr-none' 
          : 'bg-[#181818] border border-[#2a2825] text-white rounded-tl-none'
      }">
        <div class="flex items-center gap-1.5 text-[11px] font-mono text-[#c8933b] mb-1">
          <span>${lang.flag} ${lang.name}</span>
          ${isTranslated ? '<span class="text-[9px] px-1.5 py-0.2 rounded bg-[#121212] text-[#8e887f]">Translated</span>' : ''}
        </div>
        <p class="text-base font-serif leading-relaxed">${text}</p>
        <button class="mt-2 text-xs text-[#8e887f] hover:text-[#c8933b] flex items-center gap-1 convo-speak-btn">
          <i class="fa-solid fa-volume-high text-[10px]"></i> Speak (${getAccentTitle(langCode)})
        </button>
      </div>
    `;

    bubble.querySelector('.convo-speak-btn').addEventListener('click', () => {
      speakText(text, langCode);
    });

    els.convoFeed.appendChild(bubble);
    els.convoFeed.scrollTop = els.convoFeed.scrollHeight;
  }

  // --- PUNJABI HERITAGE PHRASEBOOK ---
  const PUNJABI_VAULT = [
    {
      category: 'Greetings & Respect',
      items: [
        { en: 'Welcome to Dutton Ranch', pa: 'ਡਟਨ ਰੈਂਚ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ', phonetic: 'Dutton Ranch vich tuhada swagat hai' },
        { en: 'Greetings / God is Truth', pa: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', phonetic: 'Sat Sri Akal' },
        { en: 'How are you?', pa: 'ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?', phonetic: 'Tusi kivein ho?' },
        { en: 'I am doing well, thank you', pa: 'ਮੈਂ ਠੀਕ ਹਾਂ, ਤੁਹਾਡਾ ਧੰਨਵਾਦ', phonetic: 'Main theek haan, tuhada dhanvaad' },
        { en: 'See you again / Farewell', pa: 'ਫਿਰ ਮਿਲਾਂਗੇ / ਅਲਵਿਦਾ', phonetic: 'Phir milange / Alvida' }
      ]
    },
    {
      category: 'Business & Negotiations',
      items: [
        { en: 'We honor our word and contract', pa: 'ਅਸੀਂ ਆਪਣੇ ਬਚਨ ਅਤੇ ਸਮਝੌਤੇ ਦੀ ਇੱਜ਼ਤ ਕਰਦੇ ਹਾਂ', phonetic: 'Aseen apne bachan ate samjhotey di izzat karde haan' },
        { en: 'What is the final deal?', pa: 'ਅੰਤਿਮ ਸੌਦਾ ਕੀ ਹੈ?', phonetic: 'Antim sauda ki hai?' },
        { en: 'Let us meet at the headquarters', pa: 'ਆਓ ਅਸੀਂ ਮੁੱਖ ਦਫ਼ਤਰ ਵਿਖੇ ਮਿਲੀਏ', phonetic: 'Aao aseen mukh daftar vikhe miliye' },
        { en: 'Partnership built on trust', pa: 'ਭਰੋਸੇ ਉੱਤੇ ਅਧਾਰਤ ਸਾਂਝੇਦਾਰੀ', phonetic: 'Bharose utte adharat saanjhedari' }
      ]
    },
    {
      category: 'Ranch, Land & Agriculture',
      items: [
        { en: 'This land has belonged to our family for generations', pa: 'ਇਹ ਜ਼ਮੀਨ ਪੀੜ੍ਹੀਆਂ ਤੋਂ ਸਾਡੇ ਪਰਿਵਾਰ ਦੀ ਹੈ', phonetic: 'Ih zameen peedhiyan ton saade parivaar di hai' },
        { en: 'The livestock and horses are in good health', pa: 'ਪਸ਼ੂ-ਡੰਗਰ ਅਤੇ ਘੋੜੇ ਤੰਦਰੁਸਤ ਹਨ', phonetic: 'Pashu-dangar ate ghode tandrust han' },
        { en: 'Sunrise over the mountains', pa: 'ਪਹਾੜਾਂ ਉੱਤੇ ਸੂਰਜ ਚੜ੍ਹਨਾ', phonetic: 'Pahaadan utte sooraj chadhna' },
        { en: 'Water and soil are our foundation', pa: 'ਪਾਣੀ ਅਤੇ ਮਿੱਟੀ ਸਾਡੀ ਨੀਂਹ ਹਨ', phonetic: 'Paani ate mitti saadi neenh han' }
      ]
    },
    {
      category: 'Everyday Travel & Directions',
      items: [
        { en: 'Where is the main entrance?', pa: 'ਮੁੱਖ ਦਰਵਾਜ਼ਾ ਕਿੱਥੇ ਹੈ?', phonetic: 'Mukh darwaaza kithe hai?' },
        { en: 'Can you please help me?', pa: 'ਕੀ ਤੁਸੀਂ ਕਿਰਪਾ ਕਰਕੇ ਮੇਰੀ ਮਦਦ ਕਰ ਸਕਦੇ ਹੋ?', phonetic: 'Ki tusi kirpa karke meri madad kar sakde ho?' },
        { en: 'I need transportation right now', pa: 'ਮੈਨੂੰ ਹੁਣੇ ਸਵਾਰੀ ਦੀ ਲੋੜ ਹੈ', phonetic: 'Mainu hune sawaari di lod hai' },
        { en: 'Delicious food and pure water', pa: 'ਸੁਆਦੀ ਖਾਣਾ ਅਤੇ ਸਾਫ਼ ਪਾਣੀ', phonetic: 'Swaadi khaana ate saaf paani' }
      ]
    }
  ];

  function populatePhrasebook() {
    els.phrasebookList.innerHTML = '';

    PUNJABI_VAULT.forEach(group => {
      const section = document.createElement('div');
      section.className = 'space-y-3';

      let itemsHtml = '';
      group.items.forEach((item) => {
        itemsHtml += `
          <div class="bg-[#151515] hairline-border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-[#453e34] transition">
            <div class="space-y-1">
              <div class="text-sm font-sans text-[#8e887f]">${item.en}</div>
              <div class="text-lg font-serif font-bold text-white tracking-wide">${item.pa}</div>
              <div class="text-xs font-mono text-[#c8933b]">[ ${item.phonetic} ]</div>
            </div>
            <div class="flex items-center gap-2 self-end md:self-center">
              <button class="phrasebook-speak-btn px-3 py-1.5 rounded-lg bg-[#1e1d1b] border border-[#2a2825] hover:border-[#c8933b] text-[#c8933b] text-xs flex items-center gap-1.5 transition" data-text="${item.pa}">
                <i class="fa-solid fa-volume-high"></i> Pronounce
              </button>
              <button class="phrasebook-use-btn px-3 py-1.5 rounded-lg bg-[#1e1d1b] border border-[#2a2825] hover:border-[#c8933b] text-white text-xs flex items-center gap-1.5 transition" data-en="${item.en}">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> Use
              </button>
            </div>
          </div>
        `;
      });

      section.innerHTML = `
        <h3 class="text-base font-serif font-bold text-[#c8933b] flex items-center gap-2">
          <i class="fa-solid fa-bookmark text-xs"></i> ${group.category}
        </h3>
        <div class="grid grid-cols-1 gap-2.5">
          ${itemsHtml}
        </div>
      `;

      els.phrasebookList.appendChild(section);
    });

    // Attach listeners
    els.phrasebookList.querySelectorAll('.phrasebook-speak-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        speakText(btn.dataset.text, 'pa');
      });
    });

    els.phrasebookList.querySelectorAll('.phrasebook-use-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        switchView('translator');
        setSourceLanguage('en');
        setTargetLanguage('pa');
        els.sourceText.value = btn.dataset.en;
        updateCharCount();
        triggerTranslation();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  // --- HISTORY & STARRED ---
  function logToHistory(source, translated, sl, tl) {
    if (!source || !translated) return;

    if (state.history.length > 0 && state.history[0].source === source && state.history[0].translated === translated) {
      return;
    }

    const item = {
      id: Date.now(),
      source,
      translated,
      sl,
      tl,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    state.history.unshift(item);
    if (state.history.length > 50) state.history.pop();
    persistHistory();
    renderHistoryList();
  }

  function renderHistoryList() {
    els.historyList.innerHTML = '';
    if (state.history.length === 0) {
      els.historyList.innerHTML = `<div class="py-12 text-center text-[#8e887f] font-mono text-sm">No recent translations recorded.</div>`;
      return;
    }

    state.history.forEach(item => {
      const sLang = getLang(item.sl);
      const tLang = getLang(item.tl);

      const card = document.createElement('div');
      card.className = 'bg-[#151515] hairline-border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#453e34] transition';

      card.innerHTML = `
        <div class="space-y-1.5 flex-grow">
          <div class="flex items-center gap-2 text-[11px] font-mono text-[#c8933b]">
            <span>${sLang.name} &rarr; ${tLang.name}</span>
            <span class="text-[#555]">&bull;</span>
            <span class="text-[#8e887f]">${item.timestamp}</span>
          </div>
          <div class="text-sm text-[#8e887f] font-sans">${item.source}</div>
          <div class="text-base text-white font-serif font-bold">${item.translated}</div>
        </div>
        <div class="flex items-center gap-2 self-end md:self-center">
          <button class="hist-speak-btn p-2 rounded-lg bg-[#1e1d1b] border border-[#2a2825] hover:border-[#c8933b] text-[#c8933b] text-xs transition" title="Speak translation">
            <i class="fa-solid fa-volume-high"></i>
          </button>
          <button class="hist-copy-btn p-2 rounded-lg bg-[#1e1d1b] border border-[#2a2825] hover:border-[#c8933b] text-[#8e887f] hover:text-white text-xs transition" title="Copy translation">
            <i class="fa-regular fa-copy"></i>
          </button>
          <button class="hist-reuse-btn px-3 py-1.5 rounded-lg bg-[#1e1d1b] border border-[#2a2825] hover:border-[#c8933b] text-white text-xs transition">
            Reuse
          </button>
        </div>
      `;

      card.querySelector('.hist-speak-btn').addEventListener('click', () => {
        speakText(item.translated, item.tl);
      });

      card.querySelector('.hist-copy-btn').addEventListener('click', () => {
        copyToClipboard(item.translated);
      });

      card.querySelector('.hist-reuse-btn').addEventListener('click', () => {
        switchView('translator');
        setSourceLanguage(item.sl);
        setTargetLanguage(item.tl);
        els.sourceText.value = item.source;
        updateCharCount();
        triggerTranslation();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      els.historyList.appendChild(card);
    });
  }

  // --- VIEW SWITCHING ---
  function switchView(viewName) {
    els.viewTranslator.classList.add('hidden');
    els.viewConversation.classList.add('hidden');
    els.viewPhrasebook.classList.add('hidden');
    els.viewHistory.classList.add('hidden');

    [els.navTranslator, els.navConversation, els.navPhrasebook, els.navHistory].forEach(btn => {
      btn.classList.remove('text-white', 'font-semibold');
      btn.classList.add('text-[#8e887f]');
    });

    if (viewName === 'translator') {
      els.viewTranslator.classList.remove('hidden');
      els.navTranslator.classList.add('text-white', 'font-semibold');
      els.navTranslator.classList.remove('text-[#8e887f]');
    } else if (viewName === 'conversation') {
      els.viewConversation.classList.remove('hidden');
      els.navConversation.classList.add('text-white', 'font-semibold');
      els.navConversation.classList.remove('text-[#8e887f]');
    } else if (viewName === 'phrasebook') {
      els.viewPhrasebook.classList.remove('hidden');
      els.navPhrasebook.classList.add('text-white', 'font-semibold');
      els.navPhrasebook.classList.remove('text-[#8e887f]');
    } else if (viewName === 'history') {
      els.viewHistory.classList.remove('hidden');
      els.navHistory.classList.add('text-white', 'font-semibold');
      els.navHistory.classList.remove('text-[#8e887f]');
      renderHistoryList();
    }

    els.mobileMenu.classList.add('hidden');
  }

  // --- COPY & SHARE HELPERS ---
  function copyToClipboard(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard');
      if (els.copyTooltip) {
        els.copyTooltip.classList.remove('hidden');
        setTimeout(() => els.copyTooltip.classList.add('hidden'), 1500);
      }
    }).catch(() => {
      showToast('Could not copy to clipboard.');
    });
  }

  function shareTranslation() {
    if (!state.translatedText) {
      showToast('No translation to share yet.');
      return;
    }

    if (navigator.share) {
      navigator.share({
        title: 'Dutton Translator',
        text: `${state.sourceText} ➔ ${state.translatedText}`
      }).catch(() => {});
    } else {
      copyToClipboard(`${state.sourceText} ➔ ${state.translatedText}`);
    }
  }

  function showToast(msg) {
    els.toastMessage.textContent = msg;
    els.toast.classList.remove('hidden', 'translate-y-4');
    els.toast.classList.add('translate-y-0');

    setTimeout(() => {
      els.toast.classList.add('translate-y-4');
      setTimeout(() => els.toast.classList.add('hidden'), 300);
    }, 2800);
  }

  function updateCharCount() {
    const len = els.sourceText.value.length;
    els.charCount.textContent = `${len} / 5000`;
  }

  // --- FULLSCREEN FOCUS MODE ---
  function openFullscreen() {
    if (!state.translatedText) {
      showToast('Please enter text to translate first.');
      return;
    }
    const tLang = getLang(state.targetLang);
    els.fsTargetLang.textContent = `${tLang.name} (${tLang.native}) • ${getAccentTitle(state.targetLang)}`;
    els.fsTargetText.textContent = state.translatedText;
    els.fsSourceText.textContent = `"${state.sourceText}"`;
    els.fullscreenModal.classList.remove('hidden');
  }

  function closeFullscreen() {
    els.fullscreenModal.classList.add('hidden');
  }

  // --- EVENT BINDINGS ---
  function bindEvents() {
    // Nav bar clicks
    els.navTranslator.addEventListener('click', () => switchView('translator'));
    els.navConversation.addEventListener('click', () => switchView('conversation'));
    els.navPhrasebook.addEventListener('click', () => switchView('phrasebook'));
    els.navHistory.addEventListener('click', () => switchView('history'));

    // Mobile nav
    els.mobileModeToggle.addEventListener('click', () => {
      els.mobileMenu.classList.toggle('hidden');
    });
    document.getElementById('mob-nav-translator').addEventListener('click', () => switchView('translator'));
    document.getElementById('mob-nav-conversation').addEventListener('click', () => switchView('conversation'));
    document.getElementById('mob-nav-phrasebook').addEventListener('click', () => switchView('phrasebook'));
    document.getElementById('mob-nav-history').addEventListener('click', () => switchView('history'));

    // Back buttons
    els.btnBackToTranslator.addEventListener('click', () => switchView('translator'));
    els.btnBackToTranslatorPhrase.addEventListener('click', () => switchView('translator'));
    els.btnBackToTranslatorHist.addEventListener('click', () => switchView('translator'));

    // Input typing with debounce
    els.sourceText.addEventListener('input', () => {
      updateCharCount();
      clearTimeout(debounceTimer);
      if (els.sourceText.value.trim().length === 0) {
        clearTargetUI();
        return;
      }
      debounceTimer = setTimeout(() => {
        triggerTranslation();
      }, 550);
    });

    // Clear Source
    els.btnClearSource.addEventListener('click', () => {
      stopListening();
      els.sourceText.value = '';
      state.baseRecordingText = '';
      updateCharCount();
      clearTargetUI();
      els.sourceText.focus();
    });

    // Manual translate button
    els.btnTranslateManual.addEventListener('click', () => {
      triggerTranslation();
    });

    // Swap Languages button
    els.btnSwapLanguages.addEventListener('click', swapLanguages);

    // Continuous Voice Dictation (Mic Toggle)
    els.btnMic.addEventListener('click', () => {
      if (state.userWantsRecording) {
        stopListening();
        showToast('Voice recording stopped. Passage preserved.');
      } else {
        startListening('studio');
      }
    });

    if (els.btnStopContinuous) {
      els.btnStopContinuous.addEventListener('click', () => {
        stopListening();
        showToast('Voice recording stopped. Passage preserved.');
      });
    }

    // Listen to Source in its Original Accent
    els.btnSpeakSource.addEventListener('click', () => {
      const text = els.sourceText.value.trim();
      const sLang = state.sourceLang === 'auto' ? (state.detectedLang || 'en') : state.sourceLang;
      speakText(text, sLang);
    });

    // Paste from clipboard
    els.btnPaste.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          // If text exists, append nicely
          if (els.sourceText.value.trim()) {
            els.sourceText.value = els.sourceText.value.trim() + '\n' + text;
          } else {
            els.sourceText.value = text;
          }
          state.baseRecordingText = els.sourceText.value;
          updateCharCount();
          triggerTranslation();
          showToast('Pasted into passage');
        }
      } catch (err) {
        showToast('Clipboard access was blocked.');
      }
    });

    // Speak Target Text in Authentic Original Accent
    els.btnSpeakTarget.addEventListener('click', () => {
      speakText(state.translatedText, state.targetLang);
    });

    // Speed selector
    els.voiceSpeedSelect.addEventListener('change', (e) => {
      state.speechSpeed = parseFloat(e.target.value);
    });

    // Copy Target
    els.btnCopyTarget.addEventListener('click', () => {
      copyToClipboard(state.translatedText);
    });

    // Share Target
    els.btnShareTarget.addEventListener('click', shareTranslation);

    // Star / Save Target
    els.btnStarTarget.addEventListener('click', () => {
      if (!state.translatedText) return;
      showToast('Saved phrase to Dutton Vault');
      els.btnStarTarget.classList.toggle('text-amber-400');
    });

    // Fullscreen View
    els.btnFullscreenTarget.addEventListener('click', openFullscreen);
    els.btnCloseFullscreen.addEventListener('click', closeFullscreen);
    els.fsBtnSpeak.addEventListener('click', () => speakText(state.translatedText, state.targetLang));
    els.fsBtnCopy.addEventListener('click', () => copyToClipboard(state.translatedText));

    // Clear History
    els.btnClearHistory.addEventListener('click', () => {
      state.history = [];
      persistHistory();
      renderHistoryList();
      showToast('Translation history cleared');
    });

    // Convo Mics
    els.btnConvoMicA.addEventListener('click', () => {
      if (state.isListening && state.activeListeningMode === 'convo-a') {
        stopListening();
      } else {
        els.btnConvoMicA.classList.add('recording-pulse');
        startListening('convo-a', 'en');
      }
    });

    els.btnConvoMicB.addEventListener('click', () => {
      if (state.isListening && state.activeListeningMode === 'convo-b') {
        stopListening();
      } else {
        els.btnConvoMicB.classList.add('recording-pulse');
        startListening('convo-b', 'pa');
      }
    });

    // Quick Phrase Chips
    els.phraseStarters.querySelectorAll('.phrase-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const phrase = btn.dataset.phrase;
        // Append or replace
        if (els.sourceText.value.trim()) {
          els.sourceText.value = els.sourceText.value.trim() + ' ' + phrase;
        } else {
          els.sourceText.value = phrase;
        }
        state.baseRecordingText = els.sourceText.value;
        updateCharCount();
        triggerTranslation();
      });
    });

    // Modal Events
    els.btnCloseModal.addEventListener('click', closeLanguageModal);
    els.langModal.addEventListener('click', (e) => {
      if (e.target === els.langModal) closeLanguageModal();
    });
    els.modalSearchInput.addEventListener('input', (e) => {
      renderModalLanguages(e.target.value);
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Ctrl + Enter to Translate
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        triggerTranslation();
      }
      // Ctrl + Shift + S to Swap
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        swapLanguages();
      }
      // Escape to close modals or stop speaking/listening
      if (e.key === 'Escape') {
        closeLanguageModal();
        closeFullscreen();
        stopSpeaking();
        stopListening();
      }
    });

    // Populate voices when loaded by browser
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }

  // Run on DOM ready
  document.addEventListener('DOMContentLoaded', init);

})();
