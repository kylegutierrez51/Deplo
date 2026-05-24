const stageSidebar = document.querySelector('.stage-sidebar');
const openBtn = document.getElementById('stageSidebarToggle');
const exitBtn = stageSidebar.querySelector('.exit-btn');

openBtn.addEventListener('click', function () {
  stageSidebar.classList.toggle('open');
});

exitBtn.addEventListener('click', function () {
  stageSidebar.classList.remove('open');
});
