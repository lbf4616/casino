const LEGACY_KEY = 'heyuan.muted';
const SFX_KEY = 'heyuan.sfx';
const BGM_KEY = 'heyuan.bgm';

function readToggle(key, fallback) {
  const stored = localStorage.getItem(key);
  if (stored === null) return fallback;
  return stored !== '0';
}

const TILE_KEYS = [];
for (const suit of ['wan', 'tong', 'tiao']) {
  for (let rank = 1; rank <= 9; rank += 1) TILE_KEYS.push(`${suit}-${rank}`);
}
const ACTION_VOICE_KEYS = ['peng', 'gang', 'zimo', 'cheng', 'huihui'];
const ACTION_VOICE = {
  peng: 'peng',
  gang: 'gang',
  hu: 'zimo',
  chengdiao: 'cheng',
  huihui: 'huihui',
};

const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
const BGM_MELODY = [
  0, 2, 4, 3, 2, 0, -1, 2,
  3, 5, 4, 3, 2, -1, 1, 0,
  2, 4, 6, 5, 4, 2, -1, 3,
  4, 5, 7, 6, 5, 3, 2, -1,
];
const BGM_BASS = [130.81, 110.0, 174.61, 196.0, 130.81, 110.0, 174.61, 196.0];
const BGM_STEP_SECONDS = 0.55;

class TableAudio {
  constructor() {
    const legacyMuted = localStorage.getItem(LEGACY_KEY) === '1';
    const hasPreferences = localStorage.getItem(SFX_KEY) !== null || localStorage.getItem(BGM_KEY) !== null;
    this.sfxEnabled = hasPreferences ? readToggle(SFX_KEY, true) : !legacyMuted;
    this.bgmEnabled = hasPreferences ? readToggle(BGM_KEY, true) : !legacyMuted;
    this.context = null;
    this.master = null;
    this.voiceBus = null;
    this.bgmBus = null;
    this.bgmDelay = null;
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.nextNoteAt = 0;
    this.voiceBuffers = new Map();
    this.voiceSource = null;
    this.voicesWarmed = false;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stopBgm();
      else this.syncBgm();
    });
  }

  get muted() {
    return !this.sfxEnabled && !this.bgmEnabled;
  }

  get anyEnabled() {
    return this.sfxEnabled || this.bgmEnabled;
  }

  ensureContext() {
    if (this.context) return true;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return false;
    this.context = new Context();
    this.master = this.context.createGain();
    this.master.gain.value = 0.22;
    this.master.connect(this.context.destination);

    this.voiceBus = this.context.createGain();
    this.voiceBus.gain.value = 0.72;
    this.voiceBus.connect(this.context.destination);

    this.bgmBus = this.context.createGain();
    this.bgmBus.gain.value = 0.0001;
    this.bgmBus.connect(this.context.destination);

    this.bgmDelay = this.context.createDelay(1);
    this.bgmDelay.delayTime.value = 0.3;
    const feedback = this.context.createGain();
    feedback.gain.value = 0.18;
    const wet = this.context.createGain();
    wet.gain.value = 0.18;
    this.bgmDelay.connect(feedback);
    feedback.connect(this.bgmDelay);
    this.bgmDelay.connect(wet);
    wet.connect(this.bgmBus);

    this.warmVoices();
    return true;
  }

  unlock() {
    if (!this.anyEnabled) return;
    if (!this.ensureContext()) return;
    const sync = () => this.syncBgm();
    if (this.context.state === 'suspended') {
      this.context.resume().then(sync).catch(() => {});
    } else {
      sync();
    }
  }

  setSfxEnabled(value) {
    this.sfxEnabled = Boolean(value);
    localStorage.setItem(SFX_KEY, this.sfxEnabled ? '1' : '0');
    if (!this.sfxEnabled) this.stopVoice();
    else this.unlock();
    if (!this.anyEnabled) this.stopBgm();
  }

  setBgmEnabled(value) {
    this.bgmEnabled = Boolean(value);
    localStorage.setItem(BGM_KEY, this.bgmEnabled ? '1' : '0');
    if (this.bgmEnabled) this.unlock();
    else this.stopBgm(true);
  }

  toggleSfx() {
    this.setSfxEnabled(!this.sfxEnabled);
    return this.sfxEnabled;
  }

  toggleBgm() {
    this.setBgmEnabled(!this.bgmEnabled);
    return this.bgmEnabled;
  }

  toggleAll() {
    const enable = !this.anyEnabled;
    this.sfxEnabled = enable;
    this.bgmEnabled = enable;
    localStorage.setItem(SFX_KEY, enable ? '1' : '0');
    localStorage.setItem(BGM_KEY, enable ? '1' : '0');
    if (enable) this.unlock();
    else {
      this.stopVoice();
      this.stopBgm(true);
    }
    return enable;
  }

  syncBgm() {
    if (this.bgmEnabled && this.context && this.context.state === 'running') this.startBgm();
    else this.stopBgm();
  }

  startBgm() {
    if (this.bgmTimer || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    this.bgmBus.gain.cancelScheduledValues(now);
    this.bgmBus.gain.setTargetAtTime(0.62, now, 0.9);
    this.bgmStep = 0;
    this.nextNoteAt = now + 0.3;
    this.bgmTimer = setInterval(() => this.scheduleBgm(), 250);
    this.scheduleBgm();
  }

  stopBgm(immediate = false) {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    if (!this.context) return;
    const now = this.context.currentTime;
    this.bgmBus.gain.cancelScheduledValues(now);
    this.bgmBus.gain.setTargetAtTime(0.0001, now, immediate ? 0.08 : 0.5);
  }

  scheduleBgm() {
    if (!this.context || !this.bgmTimer) return;
    const now = this.context.currentTime;
    if (this.nextNoteAt < now - 0.25) this.nextNoteAt = now + 0.1;
    const horizon = now + 1.1;
    while (this.nextNoteAt < horizon) {
      this.playBgmStep(this.bgmStep, this.nextNoteAt);
      this.bgmStep = (this.bgmStep + 1) % BGM_MELODY.length;
      this.nextNoteAt += BGM_STEP_SECONDS;
    }
  }

  playBgmStep(step, when) {
    const index = BGM_MELODY[step];
    if (index >= 0) {
      const accent = step % 8 === 0;
      this.pluck(PENTATONIC[index], when, accent ? 0.05 : 0.034);
      if (step % 16 === 8) this.pluck(PENTATONIC[index] * 2, when + BGM_STEP_SECONDS * 0.5, 0.014);
    }
    if (step % 4 === 0) this.pluck(BGM_BASS[(step / 4) % BGM_BASS.length], when, 0.045, 2.4);
  }

  pluck(frequency, when, volume, duration = 1.9) {
    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, when);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2600, when);
    filter.frequency.exponentialRampToValueAtTime(760, when + duration * 0.7);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(volume, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmBus);
    gain.connect(this.bgmDelay);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.05);
  }

  voiceURL(key) {
    return `/assets/voice/${key}.mp3?v=20261018-17`;
  }

  loadVoice(key) {
    if (!this.context) return Promise.resolve(null);
    if (!this.voiceBuffers.has(key)) {
      const promise = fetch(this.voiceURL(key))
        .then((response) => {
          if (!response.ok) throw new Error(`voice ${response.status}`);
          return response.arrayBuffer();
        })
        .then((data) => new Promise((resolve) => {
          this.context.decodeAudioData(data, resolve, () => resolve(null));
        }))
        .catch(() => {
          this.voiceBuffers.delete(key);
          return null;
        });
      this.voiceBuffers.set(key, promise);
    }
    return this.voiceBuffers.get(key);
  }

  warmVoices() {
    if (this.voicesWarmed) return;
    this.voicesWarmed = true;
    const loadAll = () => [...TILE_KEYS, ...ACTION_VOICE_KEYS].forEach((key) => this.loadVoice(key));
    if (window.requestIdleCallback) window.requestIdleCallback(loadAll, { timeout: 2500 });
    else setTimeout(loadAll, 800);
  }

  announceDiscard(tile, character) {
    if (!tile || !this.sfxEnabled || !this.ensureContext()) return;
    this.play('discard');
    this.speak(`${tile.suit}-${tile.rank}`, character);
  }

  announceWin(soft, character) {
    this.speak('zimo', character, () => this.announceVoice(soft ? '软滴' : '合滴'));
  }

  announceVoice(text) {
    if (!this.sfxEnabled || !this.ensureContext()) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.95;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  }

  announceAction(kind, character) {
    const key = ACTION_VOICE[kind];
    if (!key) return;
    this.speak(key, character);
  }

  speak(key, character, onEnded) {
    if (!this.sfxEnabled || !this.ensureContext()) return;
    if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    const rate = character?.voiceRate || (character?.gender === 'male' ? 0.8 : 1);
    this.loadVoice(key).then((buffer) => {
      if (!this.sfxEnabled || !this.context) return;
      if (!buffer) {
        if (key === 'zimo') this.announceVoice('自摸');
        if (onEnded) setTimeout(onEnded, 1000);
        return;
      }
      const now = this.context.currentTime;
      this.stopVoice(now);
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      gain.gain.value = 0.92;
      source.connect(gain);
      gain.connect(this.voiceBus);
      this.voiceSource = source;
      source.onended = () => {
        if (this.voiceSource === source) {
          this.voiceSource = null;
          onEnded?.();
        }
      };
      source.start(now + 0.1);
    }).catch(() => {});
  }

  stopVoice(when) {
    if (!this.voiceSource) return;
    try {
      this.voiceSource.stop(when);
    } catch (error) {
      // The source may have already ended.
    }
    this.voiceSource = null;
  }

  tone(frequency, duration, options = {}) {
    if (!this.context || !this.sfxEnabled) return;
    const now = this.context.currentTime + (options.delay || 0);
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = options.type || 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    if (options.slide) {
      oscillator.frequency.exponentialRampToValueAtTime(options.slide, now + duration);
    }
    const volume = options.volume ?? 0.18;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  clickNoise(duration = 0.08, volume = 0.12) {
    if (!this.context || !this.sfxEnabled) return;
    const length = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    filter.Q.value = 0.8;
    const gain = this.context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  play(kind) {
    if (!this.context || !this.sfxEnabled) return;
    switch (kind) {
      case 'select':
        this.tone(620, 0.05, { type: 'triangle', volume: 0.08 });
        break;
      case 'discard':
        this.clickNoise(0.05, 0.26);
        this.tone(340, 0.06, { type: 'sine', volume: 0.13, slide: 180 });
        this.tone(200, 0.09, { type: 'triangle', volume: 0.15, slide: 130 });
        this.tone(960, 0.03, { type: 'sine', volume: 0.035, delay: 0.012 });
        break;
      case 'draw':
        this.tone(420, 0.045, { type: 'sine', volume: 0.05 });
        break;
      case 'dice':
        this.clickNoise(0.05, 0.1);
        [0.07, 0.14, 0.21, 0.28].forEach((delay, index) => {
          this.clickNoise(0.035, 0.07);
          this.tone(260 + index * 40, 0.045, {
            type: 'triangle',
            volume: 0.05,
            delay,
          });
        });
        this.tone(540, 0.14, { type: 'triangle', volume: 0.09, delay: 0.36 });
        this.tone(360, 0.1, { type: 'sine', volume: 0.06, delay: 0.4 });
        break;
      case 'peng':
        this.clickNoise(0.045, 0.13);
        this.tone(392, 0.12, { type: 'triangle', volume: 0.15 });
        this.tone(523, 0.14, { type: 'triangle', volume: 0.1, delay: 0.08 });
        break;
      case 'gang':
        this.tone(130, 0.4, { type: 'sine', volume: 0.2, slide: 100 });
        this.tone(196, 0.32, { type: 'triangle', volume: 0.12, delay: 0.02 });
        this.clickNoise(0.08, 0.12);
        break;
      case 'hu':
        [523, 659, 784, 1046].forEach((frequency, index) => {
          this.tone(frequency, 0.34, {
            type: 'triangle',
            volume: 0.12,
            delay: index * 0.09,
          });
        });
        break;
      case 'start':
        [392, 523, 659].forEach((frequency, index) => {
          this.tone(frequency, 0.25, { type: 'sine', volume: 0.1, delay: index * 0.08 });
        });
        break;
      case 'error':
        this.tone(240, 0.16, { type: 'triangle', volume: 0.1, slide: 170 });
        break;
      case 'join':
        this.tone(440, 0.12, { type: 'sine', volume: 0.07 });
        break;
      default:
        break;
    }
  }
}

export const audio = new TableAudio();
