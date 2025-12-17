const html = document.documentElement;
const toggle = document.getElementById('darkToggle');

if (localStorage.theme === 'dark') {
  html.classList.add('dark');
}

toggle.addEventListener('click', () => {
  html.classList.toggle('dark');
  localStorage.theme = html.classList.contains('dark') ? 'dark' : 'light';
});
