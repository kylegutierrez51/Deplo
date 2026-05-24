const sidebar = document.querySelector('.sidebar');
const popup = document.querySelector('.profile-options');

const MOBILE_BREAKPOINT = 874;

function isMobile() {
  return window.innerWidth <= MOBILE_BREAKPOINT;
}

document.getElementById('sidebarToggle').addEventListener('click', function () {
  if (isMobile()) {
    sidebar.classList.toggle('open');
    if (!sidebar.classList.contains('open')) {
      popup.classList.remove('visible');
    }
  } else {
    sidebar.classList.toggle('closed');
    if (sidebar.classList.contains('closed')) {
      popup.classList.remove('visible');
    }
  }
});

// When resizing across the breakpoint, remove whichever class belongs to the
// other mode so stale state doesn't bleed through.
window.addEventListener('resize', function () {
  if (isMobile()) {
    sidebar.classList.remove('closed');
  } else {
    sidebar.classList.remove('open');
  }
});

