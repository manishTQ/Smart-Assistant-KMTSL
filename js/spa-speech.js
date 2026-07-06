/**
 * spa-speech.js — Smart Assistant v9
 * Speech-to-text wrapper using the Web Speech API.
 * Exposes window.__SPA_SPEECH for content.js to consume.
 *
 * Usage (in content.js):
 *   const speech = window.__SPA_SPEECH;
 *   if (speech && speech.supported) {
 *     speech.start(onResult, onEnd, onError);
 *     speech.stop();
 *     speech.isListening  // boolean
 *   }
 */
(function () {
  'use strict';

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    window.__SPA_SPEECH = { supported: false };
    console.warn('[SPA-Speech] Web Speech API not supported in this browser.');
    return;
  }

  let _recognition = null;
  let _isListening  = false;

  const spa_speech = {
    supported: true,

    get isListening() { return _isListening; },

    /**
     * Start recording.
     * @param {function(string, boolean)} onResult  – (transcript, isFinal)
     * @param {function}                 onEnd      – called when recording stops
     * @param {function(string)}         onError    – called with error string
     */
    start(onResult, onEnd, onError) {
      if (_isListening) {
        this.stop();
        return;
      }

      const rec = new SpeechRecognition();
      rec.continuous      = false;
      rec.interimResults  = true;
      rec.lang            = 'en-US';
      rec.maxAlternatives = 1;

      rec.onstart = () => { _isListening = true; };

      rec.onresult = (e) => {
        let interimTranscript = '';
        let finalTranscript   = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalTranscript += t;
          else interimTranscript += t;
        }
        const isFinal = finalTranscript.length > 0;
        onResult && onResult(
          isFinal ? finalTranscript : interimTranscript,
          isFinal
        );
      };

      rec.onspeechend = () => { rec.stop(); };

      rec.onend = () => {
        _isListening = false;
        _recognition = null;
        onEnd && onEnd();
      };

      rec.onerror = (e) => {
        _isListening = false;
        _recognition = null;
        // Suppress "no-speech" as it's not really an error worth showing
        if (e.error !== 'no-speech') {
          onError && onError(e.error);
        } else {
          onEnd && onEnd();
        }
      };

      _recognition = rec;
      try {
        rec.start();
      } catch (err) {
        _isListening = false;
        _recognition = null;
        onError && onError(String(err));
      }
    },

    /** Stop recording immediately. */
    stop() {
      if (_recognition) {
        try { _recognition.stop(); } catch (_) {}
        _recognition = null;
      }
      _isListening = false;
    }
  };

  window.__SPA_SPEECH = spa_speech;
  console.log('[SPA-Speech] Web Speech API ready.');
})();
