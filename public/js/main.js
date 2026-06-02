const menu = document.querySelector('.main-nav');
const sidebar = document.querySelector('.admin-sidebar');
document.querySelectorAll('.menu-toggle').forEach((button) => {
  button.addEventListener('click', () => {
    if (menu) {
      menu.classList.toggle('open');
      button.setAttribute('aria-expanded', String(menu.classList.contains('open')));
    }
    if (sidebar) sidebar.classList.toggle('open');
  });
});
