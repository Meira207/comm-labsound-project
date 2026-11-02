
const ROOM_VOLUME = 0.6;
const PIANO_VOLUME = 0.25;
const GAME_MUSIC_VOLUME = 0.5;
const PAPER_VOLUME = 1.0;       
const PAPER_RATE = 0.68;       

const PIANO_STARTS_AT = 2500;
const STORY_LINE_AT = 7800;
const SHOW_COMPUTER_PROMPT_AT = 11500;
const AUTO_TURN_ON_AT = 62000;
const AUTO_TEAR_AT = 120000;    // if no click on calendar: tear 2 min after Begin

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
const pianoSound = new Audio('audio/Piano_playing.m4a');
const gameMusic = new Audio('audio/game_theme.mp3');
const paperTearSound = new Audio('audio/Removing_papet_from_calendar.WAV');

// Loops until we stop them
roomSound.loop = true;
pianoSound.loop = true;
gameMusic.loop = true;


let computerIsOn = false;
let calendarIsTearing = false;

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

function playEffect(audio, volume, rate) {
  const copy = audio.cloneNode();
  copy.volume = volume;
  if (rate) {
    copy.playbackRate = rate;
  }
  copy.play().catch(function () {});
}

beginButton.addEventListener('click', startExperience);

function startExperience() {
  
  beginScreen.classList.add('is-gone');

  calendarHotspot.hidden = false;

 
  playLoop(roomSound, ROOM_VOLUME, 5);
  showCaption('[Room ambience: a quiet room]');

  setTimeout(function () {
    playLoop(pianoSound, PIANO_VOLUME, 8);
  }, PIANO_STARTS_AT);

  setTimeout(function () {
    showCaption('[Soft piano, slow and low]');
  }, PIANO_STARTS_AT + 2100);

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

  setTimeout(function () {
    if (calendarIsTearing) return;
    showCaption('Time slips.', true);
    setTimeout(tearCalendar, 2500);
  }, AUTO_TEAR_AT);
}

function turnComputerOn() {
  if (computerIsOn || calendarIsTearing) return;
  computerIsOn = true;

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
    if (!calendarIsTearing) {
      showCaption('Just one round.', true);
    }
  }, 10000);
}

//playing of the looping game footage on the monitor screen
function startGameVideo() {
  gameVideo.currentTime = 0;
  gameVideo.play().catch(function () {});
}

function tearCalendar() {
  if (calendarIsTearing) return;
  calendarIsTearing = true;

  hidePrompt();
  calendarHotspot.hidden = true;
  computerHotspot.hidden = true;
  showCaption('[Paper tearing — our real recording, slow and clear]');

  // Tear of calendar
  const tears = [
    [0, 6],
    [1800, 5],
    [3800, 4],
    [5800, 3]
  ];

  tears.forEach(function (item) {
    const when = item[0];
    const newNumber = item[1];
    setTimeout(function () {
      tearOnePage(newNumber);
    }, when);
  });

  setTimeout(function () {
    showCaption('Three days left. Still plenty of time.', true);
  }, 7500);

  // Fade everything out, then open page 2
  setTimeout(function () {
    fadeEverythingOutAndGoToPage2();
  }, 10500);
}

function tearOnePage(newNumber) {
  playEffect(paperTearSound, PAPER_VOLUME, PAPER_RATE);
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

// Calendar clickable anytime after Begin 
calendarHotspot.addEventListener('click', tearCalendar);
