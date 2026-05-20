const sidebar = document.querySelector('.sidebar');
const popup = document.querySelector('.profile-options');

document.getElementById('sidebarToggle').addEventListener('click', function () {
  sidebar.classList.toggle('closed');
  if (sidebar.classList.contains('closed')) {
    popup.classList.remove('visible');
  }
});

