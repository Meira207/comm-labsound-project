// All layers use the team's recordings; see SCENE2.md for sources and cue levels.
const RECORDINGS = {
  room: 'audio/Real_room_ambience.WAV',
  piano: 'audio/Piano_playing.m4a',
  paper: 'audio/Removing_papet_from_calendar.WAV',
  writing: 'audio/Writing.WAV',
  slowTyping: 'audio/Slow_typing.WAV',
  fastWriting: 'audio/Fast_writing.WAV',
  fastTyping: 'audio/Fast_typing.WAV',
  flipping: 'audio/Fast_page_flipping.WAV',
  pressure: 'audio/Pressure_builds_up.WAV',
  notification: 'audio/Notification.WAV'
};
const $ = (id) => document.getElementById(id);
const buffers = new Map();
const playing = new Set();
const layers = new Map();
const timers = new Set();
let context;
let master;
let loading;
let day = 2;
let started = false;
let tearing = false;
let muted = false;
let generation = 0;

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
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  context = context || new AudioContextClass();
  if (!master) {
    // Leave headroom when multiple recorded layers overlap.
    master = context.createGain();
    master.gain.value = muted ? 0 : .7;
    master.connect(context.destination);
  }
  await context.resume();
  loading = loading || Promise.allSettled(Object.entries(RECORDINGS).map(async ([name, path]) => {
    if (buffers.has(name)) return;
    const response = await fetch(path);
    if (!response.ok) throw new Error(name);
    const buffer = await context.decodeAudioData(await response.arrayBuffer());
    buffers.set(name, buffer);
  }));
  const results = await loading;
  if (results.some((result) => result.status === 'rejected')) {
    loading = null; // A replay retries missing assets, retaining successful buffers.
    audioProblem();
  }
}

function play(name, volume, loop = false, fadeSeconds = 0) {
  if (!context || !buffers.has(name)) return;
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
  layer.gain.gain.cancelAndHoldAtTime(context.currentTime);
  layer.gain.gain.linearRampToValueAtTime(volume, context.currentTime + seconds);
  if (stop) layer.source.stop(context.currentTime + seconds + .05);
}

function setMuted(value) {
  muted = value;
  if (master) master.gain.setTargetAtTime(muted ? 0 : .7, context.currentTime, .03);
  $('muteButton').textContent = muted ? 'Unmute sound' : 'Mute sound';
  $('muteButton').setAttribute('aria-pressed', String(muted));
}

async function startExperience() {
  if (started) return;
  started = true;
  const currentGeneration = ++generation;
  $('beginButton').disabled = true;
  $('beginButton').textContent = 'Loading sounds…';
  $('audioStatus').textContent = '';
  try { await prepareSound(); }
  catch { audioProblem('Sound is unavailable in this browser. The calendar and captions still work.'); }
  if (currentGeneration !== generation) return;
  if (context && document.hidden) await context.suspend();
  $('beginScreen').classList.add('is-gone');
  $('beginScreen').inert = true;
  $('calendarHotspot').disabled = $('tearButton').disabled = false;
  $('muteButton').disabled = $('replayButton').disabled = false;
  play('room', .28, true, 2);
  play('piano', .10, true, 3);
  play('writing', .30, true, 2);
  play('slowTyping', .10, true, 4);
  $('caption').textContent = 'Two days. One chapter at a time. I can do this.';
  $('soundCaption').textContent = '[Quiet room, soft piano, steady writing and slow typing]';
  $('tearButton').focus({ preventScroll: true });
}

function stressCue() {
  if (!started || day !== 1) return;
  // Avoid piling up repeated one-shots when the visitor switches tabs.
  if (!document.hidden) play('flipping', .24);
  later(() => {
    if (!document.hidden) play('notification', .18);
  }, 4500);
  later(stressCue, 16000);
}

function tearCalendar() {
  if (!started || tearing || day !== 2) return;
  tearing = true;
  $('calendarHotspot').disabled = $('tearButton').disabled = true;
  $('calendarHotspot').classList.add('is-tearing');
  play('paper', .75);
  $('soundCaption').textContent = '[A calendar page tears away]';
  later(() => {
    day = 1;
    document.body.dataset.day = '1';
    $('calendarHotspot').setAttribute('aria-label', 'D-1. One day left until the exam');
    $('dayLabel').textContent = 'D-1 / RUNNING OUT OF TIME';
    $('screenThought').textContent = 'Read. Reread. Why can’t I remember?';
    $('caption').textContent = 'One day? But I’ve barely started.';
    $('soundCaption').textContent = '[Writing and typing quicken. Pages rustle. Pressure builds.]';
    fadeLayer('piano', 0, 5, true);
    fadeLayer('writing', 0, 3, true);
    fadeLayer('slowTyping', 0, 3, true);
    fadeLayer('room', .18, 8);
    play('fastWriting', .38, true, 4);
    play('fastTyping', .24, true, 9);
    play('pressure', .32, true, 18);
    later(stressCue, 6500);
    $('tearButton').hidden = true;
    $('continueLink').hidden = false;
    $('continueLink').focus({ preventScroll: true });
    later(() => { $('caption').textContent = 'I keep reading the same sentence. Nothing is staying in.'; }, 8000);
    later(() => { $('caption').textContent = 'The exam is tomorrow. There’s still so much left.'; }, 18000);
  }, 1100);
}

function stopSound() {
  ++generation;
  timers.forEach(clearTimeout);
  timers.clear();
  playing.forEach(({ source }) => source.stop());
  playing.clear();
  layers.clear();
  if (context) context.suspend().catch(() => {});
}

function replay() {
  stopSound();
  started = tearing = false;
  day = 2;
  document.body.dataset.day = '2';
  $('calendarHotspot').classList.remove('is-tearing');
  $('calendarHotspot').setAttribute('aria-label', 'D-2. Tear off the calendar page to reveal D-1');
  $('dayLabel').textContent = 'D-2 / THERE’S STILL TIME';
  $('screenThought').textContent = 'Read. Understand. Remember.';
  $('calendarHotspot').disabled = $('tearButton').disabled = true;
  $('replayButton').disabled = true;
  $('tearButton').hidden = false;
  $('continueLink').hidden = true;
  startExperience();
}

$('beginButton').addEventListener('click', startExperience);
$('calendarHotspot').addEventListener('click', tearCalendar);
$('tearButton').addEventListener('click', tearCalendar);
$('muteButton').addEventListener('click', () => setMuted(!muted));
$('replayButton').addEventListener('click', replay);
document.addEventListener('visibilitychange', () => {
  if (!started || !context) return;
  (document.hidden ? context.suspend() : context.resume()).catch(() => audioProblem());
});
window.addEventListener('pagehide', stopSound);
window.addEventListener('pageshow', (event) => {
  if (event.persisted && started) replay();
});
