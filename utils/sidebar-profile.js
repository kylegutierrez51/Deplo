  /* 
  This script allows the .profile-options to lay over other parts of the sidebar (.sidebar-content) when DevTools is up 

  JS-computed position: On click, getBoundingClientRect() measures exactly where the profile card sits in the viewport and sets the .profile-options's (popup) bottom/left/width accordingly to position it properly. It'll always align correctly even when DevTools changes the viewport height.
  */


const profile = document.querySelector('.profile');
const popup = document.querySelector('.profile-options');

function positionPopup() {
  const rect = profile.getBoundingClientRect();
  popup.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
  popup.style.left = rect.left + 'px';
  popup.style.width = rect.width + 'px';
  popup.style.maxHeight = (rect.top - 10) + 'px'; /* 10px is the gap between .profile and .profile-options */
}

profile.addEventListener('click', function () {
  positionPopup();
  popup.classList.toggle('visible');
});

/* recalculates position and maxHeight whenever the viewport changes (by dragging DevTools) so that the popup always stays in bounds */
window.addEventListener('resize', function () {
  if (popup.classList.contains('visible')) positionPopup();
});