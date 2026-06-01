const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
async function loadSite() {
  const response = await fetch('/api/content');
  const { content, projects } = await response.json();
  $$('[data-content]').forEach(el => { el.textContent = content[el.dataset.content] || ''; });
  $$('[data-link]').forEach(el => { el.href = content[el.dataset.link] || '#'; el.target = '_blank'; el.rel = 'noreferrer'; });
  $('#email-link').href = `mailto:${content.contactEmail}`;
  $('#projects').innerHTML = projects.map((project, index) => `<a class="project reveal" href="${escapeAttr(project.link || '#')}" ${project.link && project.link !== '#' ? 'target="_blank" rel="noreferrer"' : ''}><div class="project-media"><img src="${escapeAttr(project.image || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=85')}" alt="${escapeAttr(project.title)}"><span class="project-number">${String(index + 1).padStart(2, '0')}</span></div><div class="project-copy"><small>${escapeHtml(project.category)}${project.featured ? ' · Featured' : ''}</small><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.description)}</p></div></a>`).join('');
}
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function escapeAttr(value = '') { return escapeHtml(value); }
loadSite().catch(console.error);

const menuButton = $('.menu');
const mobileNav = $('#mobile-nav');
function setMobileMenu(open) {
  document.body.classList.toggle('menu-open', open);
  mobileNav.classList.toggle('open', open);
  mobileNav.setAttribute('aria-hidden', String(!open));
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}
menuButton.addEventListener('click', () => setMobileMenu(!mobileNav.classList.contains('open')));
$$('#mobile-nav a').forEach(link => link.addEventListener('click', () => setMobileMenu(false)));
window.addEventListener('resize', () => { if (window.innerWidth > 800) setMobileMenu(false); });
window.addEventListener('keydown', event => { if (event.key === 'Escape') setMobileMenu(false); });
