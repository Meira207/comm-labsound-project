// All layers use the team's recordings; see SCENE2.md for sources and cue levels.
const RECORDINGS = {
  room: 'audio/Real_room_ambience.WAV',
  piano: 'audio/Piano_playing.m4a',
  paper: 'audio/calendar_sound.mp3',
  book: 'audio/Real_page_flipping.WAV',
  writing: 'audio/Writing_200.WAV',
  slowTyping: 'audio/Slow_typing_200.WAV',
  fastWriting: 'audio/Fast_writing.WAV',
  fastestWriting: 'audio/Fastest_writing.WAV',
  fastTyping: 'audio/Fast_typing.WAV',
  flipping: 'audio/Fast_page_flipping.WAV',
  pressure: 'audio/Pressure_builds_up.WAV',
  notification: 'audio/Notification.WAV'
};
const INTENSE_RECORDINGS = new Set(['fastWriting', 'fastestWriting', 'fastTyping', 'flipping', 'pressure', 'notification']);
const $ = (id) => document.getElementById(id);
const buffers = new Map();
const playing = new Set();
const layers = new Map();
const timers = new Set();
const mediaTracks = new Map(Object.entries(RECORDINGS).map(([name, path]) => {
  const audio = new Audio(path);
  audio.preload = 'auto';
  return [name, audio];
}));
const mediaPlaying = new Map();
let context;
let master;
let loading;
let day = 2;
let started = false;
let tearing = false;
let muted = false;
let generation = 0;
let studyStep = 0;
let transitioning = false;
const activatedStudySounds = new Set();
const STUDY_STEPS = [
  { id: 'pencilHotspot', sound: 'writing', volume: 1.0 },
  { id: 'bookHotspot', sound: 'book', volume: .25 },
  { id: 'laptopHotspot', sound: 'slowTyping', volume: .28 }
];
// Long pauses at first, then increasingly crowded intrusive thoughts.
const THOUGHT_CUES = [800, 2600, 4400, 6000, 7300, 8500, 9500, 10400, 11200,
  11900, 12500, 13000, 13500, 14000, 14400, 14800, 15200, 15600];

function clearThoughts() {
  THOUGHT_CUES.forEach((_, index) => $(`thought${index + 1}`).classList.remove('is-visible'));
}

function startThoughts() {
  clearThoughts();
  THOUGHT_CUES.forEach((delay, index) => later(() => {
    if (day === 1 && !transitioning) $(`thought${index + 1}`).classList.add('is-visible');
  }, delay));
}

function updateStudyObjects(focusNext = false) {
  STUDY_STEPS.forEach((step, index) => {
    const active = started && day === 2 && !transitioning && index === studyStep;
    $(step.id).disabled = !active;
    $(step.id).dataset.active = String(active);
  });
  if (day !== 2) return;
  $('calendarHotspot').disabled = studyStep !== STUDY_STEPS.length;
  if (studyStep === STUDY_STEPS.length) {
    $('calendarHotspot').setAttribute('aria-label', 'D-2. Tear off the calendar page to reveal D-1');
  }
  if (focusNext) {
    const nextId = STUDY_STEPS[studyStep]?.id || 'calendarHotspot';
    $(nextId).focus({ preventScroll: true });
  }
}

function addStudySound(index) {
  if (!started || day !== 2 || transitioning || index !== studyStep) return;
  const step = STUDY_STEPS[index];
  activatedStudySounds.add(step.sound);
  play(step.sound, step.volume, true, .35);
  studyStep += 1;
  updateStudyObjects(true);
  $('soundCaption').textContent = [
    '[Writing begins. Open the book next.]',
    '[Writing and pages. The laptop is ready to use.]',
    '[Pages, slow typing and writing. The calendar is ready.]'
  ][index];
}

function later(callback, delay) {
  const timer = setTimeout(() => {
    timers.delete(timer);
    callback();
  }, delay);
  timers.add(timer);
}

function audioProblem(message = 'Some audio could not load. Check your connection, then try Start over.') {
  $('audioStatus').textContent = message;
}

async function prepareSound() {
  // fetch(file://...) is blocked by browsers, but native audio can play it.
  if (window.location.protocol === 'file:') return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  context = context || new AudioContextClass({ latencyHint: 'interactive' });
  if (!master) {
    // Leave headroom when multiple recorded layers overlap.
    master = context.createGain();
    master.gain.value = muted ? 0 : .7;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = .003;
    limiter.release.value = .18;
    master.connect(limiter);
    limiter.connect(context.destination);
  }
  await context.resume();
  loading = loading || Promise.allSettled(Object.entries(RECORDINGS).map(async ([name, path]) => {
    if (buffers.has(name)) return;
    const response = await fetch(path);
    if (!response.ok) throw new Error(name);
    const buffer = await context.decodeAudioData(await response.arrayBuffer());
    buffers.set(name, name === 'paper' ? trimCalendarLeadIn(buffer, context) : buffer);
  }));
  const results = await loading;
  if (results.some((result) => result.status === 'rejected')) {
    loading = null; // A replay retries missing assets, retaining successful buffers.
    // Missing decoded buffers use native audio instead of leaving a silent layer.
  }
}

function unlockMedia() {
  // Only ambience may be primed at Begin. Never call play() on a study object
  // before its click: some browsers ignore HTMLMediaElement.volume = 0.
  ['room', 'piano'].forEach((name) => {
    const audio = mediaTracks.get(name);
    if (mediaPlaying.has(name)) return;
    audio.volume = 0;
    audio.muted = true;
    audio.play().then(() => {
      if (!mediaPlaying.has(name)) {
        audio.pause();
        audio.currentTime = 0;
      }
    }).catch(() => {});
  });
}

function fadeMedia(entry, target, seconds, stop = false) {
  clearInterval(entry.fadeTimer);
  const from = entry.volume;
  const start = performance.now();
  entry.fadeTimer = setInterval(() => {
    const progress = Math.min(1, (performance.now() - start) / (seconds * 1000));
    entry.volume = from + (target - from) * progress;
    entry.audio.volume = Math.max(0, Math.min(1, entry.volume * .7));
    if (progress >= 1) {
      clearInterval(entry.fadeTimer);
      if (stop) entry.source.stop();
    }
  }, 25);
}

function playMedia(name, volume, loop, fadeSeconds) {
  const audio = mediaTracks.get(name);
  if (!audio) return;
  if (mediaPlaying.has(name)) mediaPlaying.get(name).source.stop();
  const entry = { audio, volume: fadeSeconds ? 0 : volume };
  const cleanup = () => {
    clearInterval(entry.fadeTimer);
    playing.delete(entry);
    if (layers.get(name) === entry) layers.delete(name);
    if (mediaPlaying.get(name) === entry) mediaPlaying.delete(name);
  };
  entry.source = { stop() { audio.pause(); cleanup(); } };
  playing.add(entry);
  mediaPlaying.set(name, entry);
  if (loop) layers.set(name, entry);
  audio.loop = loop;
  audio.muted = muted;
  audio.volume = entry.volume * .7;
  audio.currentTime = 0;
  audio.onended = cleanup;
  audio.play().then(() => {
    // A replay/navigation may have cancelled this pending playback attempt.
    if (mediaPlaying.get(name) !== entry && !mediaPlaying.has(name)) audio.pause();
  }).catch(() => {
    if (mediaPlaying.get(name) !== entry) return;
    cleanup();
    audioProblem(`Could not play ${name.replace(/([A-Z])/g, ' $1').toLowerCase()}. Check that the audio files are available, then try Start over.`);
  });
  if (fadeSeconds) fadeMedia(entry, volume, fadeSeconds);
}

function play(name, volume, loop = false, fadeSeconds = 0) {
  if (day !== 1 && INTENSE_RECORDINGS.has(name)) return;
  if (day === 2 && STUDY_STEPS.some((step) => step.sound === name) && !activatedStudySounds.has(name)) return;
  if (!context || !master || !buffers.has(name)) {
    playMedia(name, volume, loop, fadeSeconds);
    return;
  }
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffers.get(name);
  source.loop = loop;
  source.connect(gain);
  gain.connect(master);
  gain.gain.setValueAtTime(fadeSeconds ? 0 : volume, context.currentTime);
  if (fadeSeconds) gain.gain.linearRampToValueAtTime(volume, context.currentTime + fadeSeconds);
  const entry = { source, gain };
  playing.add(entry);
  if (loop) layers.set(name, entry);
  source.onended = () => {
    playing.delete(entry);
    if (layers.get(name) === entry) layers.delete(name);
    source.disconnect();
    gain.disconnect();
  };
  source.start();
}

function fadeLayer(name, volume, seconds, stop = false) {
  const layer = layers.get(name);
  if (!layer) return;
  if (layer.audio) {
    fadeMedia(layer, volume, seconds, stop);
    return;
  }
  layer.gain.gain.cancelAndHoldAtTime(context.currentTime);
  layer.gain.gain.linearRampToValueAtTime(volume, context.currentTime + seconds);
  if (stop) layer.source.stop(context.currentTime + seconds + .05);
}

function setMuted(value) {
  muted = value;
  mediaTracks.forEach((audio) => { audio.muted = muted; });
  if (master) master.gain.setTargetAtTime(muted ? 0 : .7, context.currentTime, .03);
  $('muteButton').textContent = muted ? 'Unmute sound' : 'Mute sound';
  $('muteButton').setAttribute('aria-pressed', String(muted));
}

async function startExperience() {
  if (started) return;
  started = true;
  const currentGeneration = ++generation;
  unlockMedia();
  $('beginButton').disabled = true;
  $('beginButton').textContent = 'Loading sounds…';
  $('audioStatus').textContent = '';
  try { await prepareSound(); }
  catch { /* Native audio remains available if Web Audio cannot initialize. */ }
  if (currentGeneration !== generation) return;
  if (context && document.hidden) await context.suspend();
  $('beginScreen').classList.add('is-gone');
  $('beginScreen').inert = true;
  document.body.classList.add('is-studying');
  updateStudyObjects(true);
  $('muteButton').disabled = $('replayButton').disabled = false;
  play('room', .24, true, 2);
  play('piano', .12, true, 3);
  $('caption').textContent = 'Two days. One chapter at a time. I can do this.';
  $('soundCaption').textContent = '[Quiet room and soft piano. Pick up the pen to begin studying.]';
}

function stressCue() {
  if (!started || day !== 1 || transitioning) return;
  // This recording lasts about 17 seconds; leave space between notifications.
  if (!document.hidden) play('notification', .30);
  later(stressCue, 22000);
}

function tearCalendar() {
  if (!started || tearing || transitioning || day !== 2 || studyStep !== STUDY_STEPS.length) return;
  tearing = true;
  $('calendarHotspot').disabled = true;
  $('calendarHotspot').classList.add('is-tearing');
  play('paper', .75);
  $('soundCaption').textContent = '[A calendar page tears away]';
  day = 1;
  document.body.dataset.day = '1';
  startThoughts();
  $('calendarHotspot').setAttribute('aria-label', 'D-1. Click the calendar to move to Exam Day');
  updateStudyObjects();
  $('dayLabel').textContent = 'D-1 / RUNNING OUT OF TIME';
  $('caption').textContent = 'One day? But I’ve barely started.';
  $('soundCaption').textContent = '[Rapid writing, frantic typing, constant page flipping. The pressure swells.]';
  fadeLayer('piano', 0, .8, true);
  fadeLayer('slowTyping', 0, .5, true);
  fadeLayer('book', 0, .5, true);
  fadeLayer('writing', 0, .5, true);
  fadeLayer('room', .10, 2);
  play('fastWriting', .65, true, .4);
  play('fastTyping', .55, true, .6);
  play('flipping', .40, true, 1);
  play('pressure', .70, true, 4);
  later(() => {
    if (day !== 1 || transitioning) return;
    fadeLayer('fastWriting', 0, 2, true);
    play('fastestWriting', .75, true, 2);
    $('soundCaption').textContent = '[Writing becomes frantic. Typing, pages and notifications crowd the room.]';
  }, 6000);
  later(stressCue, 3000);
  later(() => {
    tearing = false;
    $('calendarHotspot').disabled = false;
    $('calendarHotspot').focus({ preventScroll: true });
  }, 1100);
  later(() => { $('caption').textContent = 'I keep reading the same sentence. Nothing is staying in.'; }, 8000);
  later(() => { $('caption').textContent = 'The exam is tomorrow. There’s still so much left.'; }, 18000);

}

function goToExamDay() {
  if (!started || day !== 1 || tearing || transitioning) return;
  transitioning = true;
  timers.forEach(clearTimeout);
  timers.clear();
  $('calendarHotspot').disabled = true;
  $('replayButton').disabled = $('muteButton').disabled = true;
  document.body.classList.add('scene-exiting');
  $('caption').textContent = 'The exam is here.';
  // Center and enlarge the complete calendar first, then fade picture and sound.
  later(() => {
    document.body.classList.add('scene-fading');
    playing.forEach((entry) => {
      if (entry.audio) fadeMedia(entry, 0, 1.4, true);
      else {
        entry.gain.gain.cancelAndHoldAtTime(context.currentTime);
        entry.gain.gain.linearRampToValueAtTime(0, context.currentTime + 1.4);
        entry.source.stop(context.currentTime + 1.45);
      }
    });
    later(() => {
      stopSound();
      window.location.href = 'page3.html';
    }, 1600);
  }, 2000);
}

function onCalendarClick() {
  if (day === 2) tearCalendar();
  else goToExamDay();
}

function stopSound() {
  clearThoughts();
  document.body.classList.remove('is-studying');
  ++generation;
  timers.forEach(clearTimeout);
  timers.clear();
  playing.forEach(({ source }) => source.stop());
  playing.clear();
  layers.clear();
  mediaTracks.forEach((audio) => audio.pause());
  if (context) context.suspend().catch(() => {});
}

function replay() {
  stopSound();
  started = tearing = false;
  transitioning = false;
  studyStep = 0;
  activatedStudySounds.clear();
  document.body.classList.remove('scene-exiting', 'scene-fading');
  day = 2;
  document.body.dataset.day = '2';
  $('calendarHotspot').classList.remove('is-tearing');
  $('calendarHotspot').setAttribute('aria-label', 'D-2. Use the pen, book and laptop to unlock the calendar');
  $('dayLabel').textContent = 'D-2 / THERE’S STILL TIME';
  $('calendarHotspot').disabled = true;
  $('replayButton').disabled = true;
  startExperience();
}

$('beginButton').addEventListener('click', startExperience);
$('calendarHotspot').addEventListener('click', onCalendarClick);
STUDY_STEPS.forEach((step, index) => $(step.id).addEventListener('click', () => addStudySound(index)));
$('muteButton').addEventListener('click', () => setMuted(!muted));
$('replayButton').addEventListener('click', replay);
document.addEventListener('visibilitychange', () => {
  document.body.classList.toggle('motion-paused', document.hidden);
  if (!started) return;
  mediaPlaying.forEach(({ audio }) => {
    if (document.hidden) audio.pause();
    else audio.play().catch(() => audioProblem('Audio could not resume. Try Start over.'));
  });
  if (context) (document.hidden ? context.suspend() : context.resume()).catch(() => audioProblem());
});
window.addEventListener('pagehide', stopSound);
window.addEventListener('pageshow', (event) => {
  if (event.persisted && started) replay();
});
