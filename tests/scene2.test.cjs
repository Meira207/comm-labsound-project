const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const project = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(project, 'soundproject/js/page2.js'), 'utf8');

function scene(protocol = 'file:', failFetch = false) {
  let now = 0;
  let next = 0;
  const pending = new Map();
  const nodes = new Map();
  const schedule = (fn, delay, interval = 0) => {
    const id = ++next;
    pending.set(id, { fn, at: now + delay, interval });
    return id;
  };
  function advance(ms) {
    const end = now + ms;
    for (;;) {
      const due = [...pending].filter(([, item]) => item.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      const [id, item] = due;
      now = item.at;
      if (item.interval) item.at += item.interval;
      else pending.delete(id);
      item.fn();
    }
    now = end;
  }
  const classList = () => ({
    values: new Set(),
    add(...names) { names.forEach((name) => this.values.add(name)); },
    remove(...names) { names.forEach((name) => this.values.delete(name)); },
    toggle(name, enabled) { enabled ? this.values.add(name) : this.values.delete(name); }
  });
  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, {
      disabled: true, dataset: {}, attrs: {}, textContent: '', handlers: {}, classList: classList(),
      addEventListener(event, handler) { this.handlers[event] = handler; },
      setAttribute(name, value) { this.attrs[name] = value; },
      focus() {}
    });
    return nodes.get(id);
  };
  class Audio {
    constructor(url) { this.url = url; this.volume = 1; this.paused = true; this.playCalls = 0; }
    play() { this.playCalls++; this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  const param = () => ({
    value: 0,
    setValueAtTime(value) { this.value = value; },
    linearRampToValueAtTime(value) { this.value = value; },
    setTargetAtTime(value) { this.value = value; },
    cancelAndHoldAtTime() {}
  });
  class AudioContext {
    constructor() { this.destination = {}; }
    get currentTime() { return now / 1000; }
    resume() { return Promise.resolve(); }
    suspend() { return Promise.resolve(); }
    decodeAudioData() { return Promise.resolve({}); }
    createGain() { return { gain: param(), connect() {}, disconnect() {} }; }
    createDynamicsCompressor() {
      return { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), connect() {} };
    }
    createBufferSource() {
      let stopTimer;
      return {
        connect() {}, disconnect() {}, start() {},
        stop(at = now / 1000) {
          pending.delete(stopTimer);
          stopTimer = schedule(() => this.onended?.(), Math.max(0, at * 1000 - now));
        }
      };
    }
  }
  const body = { dataset: { day: '2' }, classList: classList() };
  const location = { protocol, href: '' };
  const context = vm.createContext({
    Audio,
    window: { location, AudioContext, addEventListener() {} },
    document: { body, hidden: false, getElementById: get, addEventListener() {} },
    performance: { now: () => now },
    trimCalendarLeadIn: (buffer) => buffer,
    fetch: async (url) => {
      if (failFetch) throw new Error('Fetch blocked');
      assert.ok(fs.existsSync(path.join(project, 'soundproject', url)), url);
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(1) };
    },
    setTimeout: (fn, delay) => schedule(fn, delay), clearTimeout: (id) => pending.delete(id),
    setInterval: (fn, delay) => schedule(fn, delay, delay), clearInterval: (id) => pending.delete(id)
  });
  vm.runInContext(script, context);
  return {
    get, body, location, advance,
    read: (code) => vm.runInContext(code, context),
    click(id) { if (!get(id).disabled) get(id).handlers.click(); },
    layers: () => [...vm.runInContext('layers.keys()', context)]
  };
}

for (const [name, protocol, failed] of [
  ['direct-file native audio', 'file:', false],
  ['decoded HTTP audio', 'http:', false],
  ['HTTP audio fallback', 'http:', true]
]) {
  test(`ordered sound stacking and calendar transition with ${name}`, async () => {
    const s = scene(protocol, failed);
    await s.read('startExperience()');
    assert.deepEqual(s.layers(), ['room', 'piano']);
    assert.equal(s.get('pencilHotspot').disabled, false);
    assert.equal(s.get('laptopHotspot').disabled, true);
    s.read('onCalendarClick(); addStudySound(1)');
    assert.equal(s.body.dataset.day, '2');
    assert.deepEqual(s.layers(), ['room', 'piano']);
    s.click('pencilHotspot');
    assert.deepEqual(s.layers(), ['room', 'piano', 'writing']);
    s.read('addStudySound(0)');
    assert.equal(s.read('studyStep'), 1);
    s.click('bookHotspot');
    assert.deepEqual(s.layers(), ['room', 'piano', 'writing', 'book']);
    s.click('laptopHotspot');
    assert.deepEqual(s.layers(), ['room', 'piano', 'writing', 'book', 'slowTyping']);
    assert.equal(s.get('calendarHotspot').disabled, false);
    s.click('calendarHotspot');
    assert.equal(s.body.dataset.day, '1');
    assert.equal(s.get('bookHotspot').disabled, true);
    assert.equal(s.get('calendarHotspot').disabled, true);
    assert.ok(s.layers().includes('fastTyping'));
    s.advance(1100);
    assert.equal(s.get('calendarHotspot').disabled, false);
    s.advance(4900);
    assert.ok(s.layers().includes('fastestWriting'));
    s.click('calendarHotspot');
    assert.ok(s.body.classList.values.has('scene-exiting'));
    assert.equal(s.get('calendarHotspot').disabled, true);
    s.read('goToExamDay()'); // A second activation must not restart the timeline.
    s.advance(1999);
    assert.equal(s.body.classList.values.has('scene-fading'), false);
    assert.equal(s.location.href, '');
    s.advance(1);
    assert.ok(s.body.classList.values.has('scene-fading'));
    s.advance(1599);
    assert.equal(s.location.href, '');
    s.advance(1);
    assert.equal(s.location.href, 'page3.html');
    assert.equal(s.read('playing.size'), 0);
  });
}

test('replay resets the interaction order and cancels a pending exam transition', async () => {
  const s = scene();
  await s.read('startExperience()');
  for (const id of ['pencilHotspot', 'bookHotspot', 'laptopHotspot', 'calendarHotspot']) s.click(id);
  s.advance(1100);
  s.click('calendarHotspot');
  s.read('replay()');
  for (let i = 0; i < 30; i++) await Promise.resolve();
  s.advance(10000);
  assert.equal(s.location.href, '');
  assert.equal(s.body.dataset.day, '2');
  assert.equal(s.body.classList.values.has('scene-exiting'), false);
  assert.equal(s.body.classList.values.has('scene-fading'), false);
  assert.equal(s.get('pencilHotspot').disabled, false);
  assert.equal(s.get('calendarHotspot').disabled, true);
  assert.deepEqual(s.layers(), ['room', 'piano']);
  s.read('stopSound()');
});

test('native writing audio is never started before the pencil is clicked', async () => {
  const s = scene();
  await s.read('startExperience()');
  for (const name of ['book', 'writing', 'slowTyping', 'fastWriting', 'fastestWriting', 'flipping']) {
    assert.equal(s.read(`mediaTracks.get('${name}').playCalls`), 0, `${name} must not be primed`);
  }
  s.click('bookHotspot');
  assert.equal(s.read('mediaTracks.get("writing").playCalls'), 0);
  s.click('laptopHotspot');
  assert.equal(s.read('mediaTracks.get("writing").playCalls'), 0);
  s.read('play("writing", 1, true)');
  assert.equal(s.read('mediaTracks.get("writing").playCalls'), 0, 'Unactivated writing is blocked at the audio layer');
  s.click('pencilHotspot');
  assert.equal(s.read('mediaTracks.get("writing").playCalls'), 1);
  s.read('replay()');
  for (let i = 0; i < 30; i++) await Promise.resolve();
  assert.equal(s.read('mediaTracks.get("writing").playCalls'), 1, 'Replay must not restart writing');
  assert.equal(s.read('mediaTracks.get("writing").paused'), true);
  s.read('stopSound()');
});

test('D-2 thoughts are removed from rendering rather than slowly fading away', () => {
  const css = fs.readFileSync(path.join(project, 'soundproject/css/page2.css'), 'utf8');
  assert.match(css, /\.study-page\[data-day="2"\] \.thought\s*\{[^}]*display:\s*none;[^}]*transition:\s*none;/);
});

test('D-1 thoughts accumulate gradually and reset completely on replay', async () => {
  const s = scene();
  const visible = () => Array.from({ length: 18 }, (_, i) => s.get(`thought${i + 1}`))
    .filter((node) => node.classList.values.has('is-visible')).length;
  await s.read('startExperience()');
  s.advance(20000);
  assert.equal(visible(), 0);
  for (const id of ['pencilHotspot', 'bookHotspot', 'laptopHotspot', 'calendarHotspot']) s.click(id);
  assert.equal(visible(), 0, 'No thoughts appear at the date change itself');
  s.advance(800);
  assert.equal(visible(), 1);
  s.advance(1800);
  assert.equal(visible(), 2);
  s.advance(13000);
  assert.equal(visible(), 18);
  s.read('replay()');
  for (let i = 0; i < 30; i++) await Promise.resolve();
  assert.equal(visible(), 0);
  s.advance(20000);
  assert.equal(visible(), 0, 'Old D-1 thoughts cannot leak into D-2');
  s.read('stopSound()');
});
