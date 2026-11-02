

const beginScreen = document.getElementById('beginScreen');
const beginButton = document.getElementById('beginButton');
const captionEl = document.getElementById('caption');

beginButton.addEventListener('click', function () {
  beginScreen.classList.add('is-gone');
  captionEl.textContent = '[Page 3 — build panic, then relief / silence]';
  captionEl.classList.add('is-story');
});
