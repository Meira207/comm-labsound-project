
const beginScreen = document.getElementById('beginScreen');
const beginButton = document.getElementById('beginButton');
const beginTitle = document.querySelector('.begin-title');
const beginSubtitle = document.querySelector('.begin-sub');
const captionEl = document.getElementById('caption');
const classroomBackground = document.getElementById('classroomBackground');
const examHotspot = document.getElementById('examHotspot');
const examPaper = document.getElementById('examPaper');
const teacher = document.getElementById('teacher');
const stage = document.getElementById('stage');

const roomSound = new Audio('audio/ExamHallAmbience.mp3');
const deepBreathSound = new Audio('audio/DeepBreath.mp3');
const finalAnswerSound = new Audio('audio/FinalAnswer.mp3');
const submissionSound = new Audio('audio/PaperSubmission.mp3');
const examDoneSound = new Audio('audio/ExamDone.mp3');

roomSound.loop = true;

let examStarted = false;
let paperSubmitted = false;

function showCaption(text, isStoryLine) {
  captionEl.textContent = text;
  captionEl.classList.toggle('is-story', Boolean(isStoryLine));
}

function clearCaption() {
  captionEl.textContent = '';
  captionEl.classList.remove('is-story');
}

function playEffect(audio, volume) {
  audio.volume = volume;
  audio.currentTime = 0;
  audio.play().catch(function () { });
}

function changeBackground(image) {
  classroomBackground.src = image;
  classroomBackground.style.opacity = 1;
}

beginButton.addEventListener('click', startExam);

function startExam() {
  if (examStarted) return;
  examStarted = true;
  paperSubmitted = false;

  beginScreen.classList.add('is-gone');
  stage.style.opacity = 1;

  beginTitle.textContent = 'Exam Day';
  beginSubtitle.textContent = "Only seconds away from relief... It'll all be over soon";
  beginButton.textContent = 'Finish Exam';

  classroomBackground.src = 'media/classroom1.png';

  examPaper.classList.remove('is-visible');
  examPaper.style.transform = 'translate(0, 0)';
  teacher.classList.remove('is-visible');

  examHotspot.disabled = false;
  examHotspot.classList.remove('is-active');

  roomSound.volume = 0.7;
  roomSound.currentTime = 0;
  roomSound.play().catch(function () { });

  showCaption("Last question, here it goes...", true);

  deepBreathSound.addEventListener('ended', function () {
    examHotspot.classList.add('is-active');
  }, { once: true });

  setTimeout(function () {
    playEffect(deepBreathSound, 0.7);
  }, 1000);
}

examHotspot.addEventListener('click', finishExam);

function finishExam() {
  if (!examStarted || examHotspot.disabled) return;

  examHotspot.classList.remove('is-active');
  examHotspot.disabled = true;

  showCaption('[Writing the final answer]', true);

  finalAnswerSound.addEventListener('ended', function () {
    setTimeout(showSubmissionScene, 1500);
  }, { once: true });

  playEffect(finalAnswerSound, 1);
}

function showSubmissionScene() {
  changeBackground('media/classroom2.png');

  teacher.classList.add('is-visible');
  examPaper.classList.add('is-visible');

  showCaption("Let's hand it in!", true);
}


// Drag the exam paper to the teacher
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

examPaper.addEventListener('pointerdown', function (event) {
  if (!examPaper.classList.contains('is-visible') || paperSubmitted) return;

  event.preventDefault();

  isDragging = true;
  dragStartX = event.clientX;
  dragStartY = event.clientY;

  examPaper.setPointerCapture(event.pointerId);
  examPaper.style.cursor = 'grabbing';
});

examPaper.addEventListener('pointermove', function (event) {
  if (!isDragging) return;

  const moveX = event.clientX - dragStartX;
  const moveY = event.clientY - dragStartY;

  examPaper.style.transform = `translate(${moveX}px, ${moveY}px)`;
});

examPaper.addEventListener('pointerup', function (event) {
  if (!isDragging) return;

  isDragging = false;
  examPaper.style.cursor = 'grab';

  const paperRect = examPaper.getBoundingClientRect();
  const teacherRect = teacher.getBoundingClientRect();

  const droppedOnTeacher =
    paperRect.right > teacherRect.left &&
    paperRect.left < teacherRect.right &&
    paperRect.bottom > teacherRect.top &&
    paperRect.top < teacherRect.bottom;

  if (droppedOnTeacher) {
    submitPaper();
  } else {
    examPaper.style.transform = 'translate(0, 0)';
  }
});

examPaper.addEventListener('pointercancel', function () {
  isDragging = false;
  examPaper.style.transform = 'translate(0, 0)';
  examPaper.style.cursor = 'grab';
});

function submitPaper() {
  if (paperSubmitted) return;
  paperSubmitted = true;

  examPaper.classList.remove('is-visible');
  showCaption('', false);

  submissionSound.addEventListener('ended', function () {
    setTimeout(showFinalScene, 1000);
  }, { once: true });

  playEffect(submissionSound, 1);
}

function showFinalScene() {
  changeBackground('media/classroom3.png');

  showCaption('', false);

  playEffect(examDoneSound, 0.7);

  setTimeout(showEndingScreen, 4000);
}

function showEndingScreen() {
  roomSound.pause();
  roomSound.currentTime = 0;

  stage.style.opacity = 0;

  setTimeout(function () {
    beginTitle.textContent = "Time's Up!";
    beginSubtitle.textContent = 'The stress is finally over, until the next exam...';
    beginButton.textContent = 'Experience Again';

    beginScreen.classList.remove('is-gone');
  }, 800);

  beginButton.onclick = function () {
    window.location.href = 'index.html';
  };
}