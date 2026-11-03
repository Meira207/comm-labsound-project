
const ROOM_VOLUME = 0.6;
const PIANO_VOLUME = 1.0;
const GAME_MUSIC_VOLUME = 0.5;
const PAPER_VOLUME = 1.0;       
const PAPER_RATE = 1.0;
const CALENDAR_PAGE_INTERVAL = 3200;

const STORY_LINE_AT = 7800;
const SHOW_COMPUTER_PROMPT_AT = 11500;
const AUTO_TURN_ON_AT = 62000;
const CALENDAR_UNLOCK_AFTER = 10000; // Time spent with the computer on.
const AUTO_TEAR_AT = 120000;    // Tear automatically 2 min after calendar unlock.

const GAME_MUSIC_AT = 800;      


const beginScreen = document.getElementById('beginScreen');
const beginButton = document.getElementById('beginButton');
const captionEl = document.getElementById('caption');
const promptButton = document.getElementById('promptButton');
const gameVideo = document.getElementById('gameVideo');
const computerHotspot = document.getElementById('computerHotspot');
const calendarHotspot = document.getElementById('calendarHotspot');
const calendarNumber = document.getElementById('calendarNumber');


const roomSound = new Audio('audio/Real_room_ambience.WAV');
// The recording is amplified offline, avoiding a Web Audio routing dependency.
const pianoSound = new Audio('audio/piano_200.mp3');
const gameMusic = new Audio('audio/game_theme.mp3');
const paperTearSound = new Audio('audio/calendar_sound_instant.WAV');
paperTearSound.preload = 'auto';
let calendarAudioContext;
let calendarAudioReady;
let calendarAudioBuffer;

function prepareCalendarAudio() {
  if (calendarAudioReady) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    calendarAudioContext = new AudioContextClass({ latencyHint: 'interactive' });
    calendarAudioContext.resume().catch(function () {});
    calendarAudioReady = fetch('audio/calendar_sound_instant.WAV')
      .then(function (response) {
        if (!response.ok) throw new Error('Calendar audio unavailable');
        return response.arrayBuffer();
      })
      .then(function (bytes) { return calendarAudioContext.decodeAudioData(bytes); })
      .then(function (buffer) { calendarAudioBuffer = trimCalendarLeadIn(buffer, calendarAudioContext); })
      .catch(function () { /* Use the preloaded media element as a fallback. */ });
  } catch {
    calendarAudioReady = Promise.resolve();
  }
}

// Loops until we stop them
roomSound.loop = true;
pianoSound.loop = true;
gameMusic.loop = true;


let computerIsOn = false;
let calendarIsTearing = false;
let calendarIsAvailable = false;

pianoSound.preload = 'auto';
pianoSound.volume = PIANO_VOLUME;
function startPiano() {
  if (computerIsOn || calendarIsTearing) return;
  if (!pianoSound.paused) return;
  // Do not rewind a piano track that already started on page load.
  pianoSound.play().then(function () {
    document.getElementById('pianoRetryButton').hidden = true;
  }).catch(function () {
    // Keep a direct retry available if the browser rejects automatic playback.
    if (!computerIsOn && !calendarIsTearing) {
      document.getElementById('pianoRetryButton').hidden = false;
    }
  });
}

document.getElementById('pianoRetryButton').addEventListener('click', startPiano);

// Attempt audible playback as soon as Scene 1 opens, before Begin is clicked.
startPiano();

// Show a short line of text at the bottom of the screen
function showCaption(text, isStoryLine) {
  captionEl.textContent = text;
  captionEl.classList.toggle('is-story', Boolean(isStoryLine));
}

// Clear the caption
function clearCaption() {
  captionEl.textContent = '';
  captionEl.classList.remove('is-story');
}

function showPrompt(label, onClick) {
  promptButton.hidden = false;
  promptButton.textContent = label;
  promptButton.onclick = function () {
    hidePrompt();
    onClick();
  };
}

function hidePrompt() {
  promptButton.hidden = true;
  promptButton.onclick = null;
}

function fadeVolume(audio, toVolume, seconds, afterDone) {
  const steps = Math.max(1, Math.round(seconds * 20)); 
  const startVolume = audio.volume;
  const change = toVolume - startVolume;
  let step = 0;

  const timer = setInterval(function () {
    step += 1;
    audio.volume = startVolume + (change * step) / steps;
    if (step >= steps) {
      clearInterval(timer);
      audio.volume = toVolume;
      if (afterDone) afterDone();
    }
  }, (seconds * 1000) / steps);
}

function playLoop(audio, targetVolume, fadeSeconds) {
  audio.volume = 0;
  audio.currentTime = 0;
  audio.play().catch(function () {
  });
  fadeVolume(audio, targetVolume, fadeSeconds);
}

function playEffect(audio, volume, rate, onStart) {
  const copy = audio.cloneNode();
  copy.volume = volume;
  if (rate) {
    copy.playbackRate = rate;
  }
  // Resolve the visual cue when playback starts, rather than before loading.
  copy.play().then(function () {
    if (onStart) onStart();
  }).catch(function () {
    // The story can still advance if browser sound playback is blocked.
    if (onStart) onStart();
  });
}

beginButton.addEventListener('click', startExperience);

function startExperience() {
  startPiano();
  prepareCalendarAudio();
  
  beginScreen.classList.add('is-gone');

  calendarHotspot.hidden = true;
  calendarHotspot.disabled = true;
  // Allow the visitor to click immediately; the reminder still appears later.
  computerHotspot.hidden = false;

 
  playLoop(roomSound, ROOM_VOLUME, 5);
  showCaption('[Quiet room ambience and soft piano]');

  setTimeout(function () {
    if (!computerIsOn && !calendarIsTearing) {
      showCaption('Seven days until the exam. Plenty of time.', true);
    }
  }, STORY_LINE_AT);

  setTimeout(function () {
    if (computerIsOn || calendarIsTearing) return;
    computerHotspot.hidden = false;
    showPrompt('Turn the computer on', turnComputerOn);
  }, SHOW_COMPUTER_PROMPT_AT);

  setTimeout(function () {
    if (computerIsOn || calendarIsTearing) return;
    showCaption('Maybe one quick game.', true);
    setTimeout(turnComputerOn, 2800);
  }, AUTO_TURN_ON_AT);

}

function turnComputerOn() {
  if (computerIsOn || calendarIsTearing) return;
  computerIsOn = true;
  document.getElementById('pianoRetryButton').hidden = true;

  if (promptButton.textContent === 'Turn the computer on') {
    hidePrompt();
  }
  computerHotspot.hidden = true;

  document.body.classList.add('computer-on');

  startGameVideo();
  showCaption('[The game is on the screen]');

  fadeVolume(roomSound, ROOM_VOLUME * 0.7, 3);

  // game music on; piano slowly disappears
  setTimeout(function () {
    if (calendarIsTearing) return;
    playLoop(gameMusic, GAME_MUSIC_VOLUME, 3);
    fadeVolume(pianoSound, 0, 10, function () {
      pianoSound.pause();
    });
    showCaption('[Game music]');
  }, GAME_MUSIC_AT);

  setTimeout(function () {
    if (calendarIsTearing) return;
    calendarIsAvailable = true;
    calendarHotspot.hidden = false;
    calendarHotspot.disabled = false;
    showCaption('Just one round. Time slips.', true);
    showPrompt('Tear a calendar page', tearCalendar);

    setTimeout(function () {
      if (calendarIsTearing) return;
      showCaption('Time slips.', true);
      setTimeout(tearCalendar, 2500);
    }, AUTO_TEAR_AT);
  }, CALENDAR_UNLOCK_AFTER);
}

//playing of the looping game footage on the monitor screen
function startGameVideo() {
  gameVideo.currentTime = 0;
  gameVideo.play().catch(function () {});
}

async function tearCalendar() {
  if (!calendarIsAvailable || calendarIsTearing) return;
  calendarIsTearing = true;
  document.getElementById('pianoRetryButton').hidden = true;

  hidePrompt();
  calendarHotspot.hidden = true;
  computerHotspot.hidden = true;
  showCaption('[Paper tearing]');

  // Keep each number on screen longer and serialize actual audio playback.
  for (const newNumber of [6, 5, 4, 3, 2]) {
    const beganAt = performance.now();
    await tearOnePage(newNumber);
    if (newNumber !== 2) {
      const remaining = Math.max(600, CALENDAR_PAGE_INTERVAL - (performance.now() - beganAt));
      await new Promise(function (resolve) { setTimeout(resolve, remaining); });
    }
  }
  await new Promise(function (resolve) { setTimeout(resolve, 1200); });
  showCaption('Two days left. Time to study.', true);
  await new Promise(function (resolve) { setTimeout(resolve, 3000); });
  fadeEverythingOutAndGoToPage2();
}

async function tearOnePage(newNumber) {
  // Decode once at Begin instead of loading a fresh element for each tear.
  await calendarAudioReady;
  if (calendarAudioBuffer) {
    try {
      await calendarAudioContext.resume();
      const source = calendarAudioContext.createBufferSource();
      const gain = calendarAudioContext.createGain();
      source.buffer = calendarAudioBuffer;
      source.playbackRate.value = PAPER_RATE;
      gain.gain.value = PAPER_VOLUME;
      source.connect(gain);
      gain.connect(calendarAudioContext.destination);
      const finished = new Promise(function (resolve) {
        source.onended = function () { source.disconnect(); gain.disconnect(); resolve(); };
      });
      source.start();
      await finished;
      calendarNumber.textContent = String(newNumber);
      return;
    } catch { /* Fall back if Web Audio is unavailable. */ }
  }
  paperTearSound.currentTime = 0;
  paperTearSound.volume = PAPER_VOLUME;
  paperTearSound.playbackRate = PAPER_RATE;
  await new Promise(function (resolve) {
    const finish = function () {
      paperTearSound.onended = null;
      paperTearSound.onerror = null;
      resolve();
    };
    paperTearSound.onended = finish;
    paperTearSound.onerror = finish;
    paperTearSound.play().catch(finish);
  });
  calendarNumber.textContent = String(newNumber);
}

function fadeEverythingOutAndGoToPage2() {
  const tracks = [roomSound, pianoSound, gameMusic];
  tracks.forEach(function (audio) {
    fadeVolume(audio, 0, 3, function () {
      audio.pause();
    });
  });

  // Softly hide the picture while sound fades
  document.getElementById('stage').style.transition = 'opacity 3s ease';
  document.getElementById('stage').style.opacity = '0';

  setTimeout(function () {
    window.location.href = 'page2.html';
  }, 3200);
}

computerHotspot.addEventListener('click', turnComputerOn);

// Calendar becomes clickable after the computer has been on for a while.
calendarHotspot.addEventListener('click', tearCalendar);
