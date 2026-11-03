
const beginScreen = document.getElementById('beginScreen');
const beginButton = document.getElementById('beginButton');
const captionEl = document.getElementById('caption');
const classroomBackground = document.getElementById('classroomBackground');
const examHotspot = document.getElementById('examHotspot');
const examPaper = document.getElementById('examPaper');
const teacher = document.getElementById('teacher');

const roomSound = new Audio('audio/ExamHallAmbience.mp3');
const deepBreathSound = new Audio('audio/DeepBreath.mp3');
const finalAnswerSound = new Audio('audio/FinalAnswer.mp3');
const submissionSound = new Audio('audio/PaperSubmission.mp3');

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

beginButton.addEventListener('click', startExam);

function startExam() {
  if (examStarted) return;
  examStarted = true;

  beginScreen.classList.add('is-gone');

  classroomBackground.src = 'media/classroom1.png';

  roomSound.volume = 0.6;
  roomSound.currentTime = 0;
  roomSound.play().catch(function () { });

  showCaption("Okay, let's finish this", true);

  deepBreathSound.addEventListener('ended', function () {
    examHotspot.classList.add('is-active');
  }, { once: true });

  playEffect(deepBreathSound, 1);
}
