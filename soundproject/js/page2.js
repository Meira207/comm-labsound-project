

const beginScreen = document.getElementById('beginScreen');
const beginButton = document.getElementById('beginButton');
const captionEl = document.getElementById('caption');

beginButton.addEventListener('click', function () {
  beginScreen.classList.add('is-gone');
  captionEl.textContent = '[Page 2 — add your sounds here]';
  captionEl.classList.add('is-story');

});
