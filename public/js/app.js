import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db, CONTENT_COLLECTION, CONTENT_DOC } from "./firebase-services.js";
import { defaultContent } from "./default-content.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function placeholderSvg(label) {
  const safeLabel = encodeURIComponent(label || "Simtolite Lighting");
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'%3E%3Cdefs%3E%3CradialGradient id='g' cx='50%25' cy='32%25' r='62%25'%3E%3Cstop stop-color='%23ffd166' stop-opacity='0.95'/%3E%3Cstop offset='0.45' stop-color='%23ff9f1c' stop-opacity='0.28'/%3E%3Cstop offset='1' stop-color='%23070a12'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='800' height='600' fill='url(%23g)'/%3E%3Ccircle cx='400' cy='160' r='58' fill='%23fff3bf'/%3E%3Cpath d='M280 210h240l120 260H160z' fill='%23ffffff' opacity='0.14'/%3E%3Ctext x='400' y='520' fill='%23ffffff' font-family='Inter,Arial' font-size='42' font-weight='800' text-anchor='middle'%3E${safeLabel}%3C/text%3E%3C/svg%3E`;
}

function mergeContent(remote) {
  return {
    ...defaultContent,
    ...remote,
    hero: { ...defaultContent.hero, ...(remote?.hero || {}) },
    contact: { ...defaultContent.contact, ...(remote?.contact || {}) },
    categories: remote?.categories?.length ? remote.categories : defaultContent.categories,
    products: remote?.products?.length ? remote.products : defaultContent.products,
    gallery: remote?.gallery?.length ? remote.gallery : defaultContent.gallery,
    why: remote?.why?.length ? remote.why : defaultContent.why,
    reviews: remote?.reviews?.length ? remote.reviews : defaultContent.reviews,
    social: remote?.social?.length ? remote.social : defaultContent.social
  };
}

async function loadContent() {
  try {
    const snap = await getDoc(doc(db, CONTENT_COLLECTION, CONTENT_DOC));
    return mergeContent(snap.exists() ? snap.data() : null);
  } catch (error) {
    console.warn("Using default content because Firestore content could not be loaded.", error);
    return defaultContent;
  }
}

function render(content) {
  $$('[data-site-name]').forEach((el) => (el.textContent = content.siteName || defaultContent.siteName));
  $('[data-site-name-footer]').textContent = content.siteName || defaultContent.siteName;
  $('[data-footer-info]').textContent = content.tagline || defaultContent.tagline;
  $('[data-hero-title]').textContent = content.hero.title;
  $('[data-hero-tagline]').textContent = content.hero.tagline;
  const primary = $('[data-primary-button]');
  primary.textContent = content.hero.primaryButtonText;
  primary.href = content.hero.primaryButtonUrl || '#products';
  const secondary = $('[data-secondary-button]');
  secondary.textContent = content.hero.secondaryButtonText;
  secondary.href = content.hero.secondaryButtonUrl || '#contact';

  $('[data-categories]').innerHTML = content.categories.map((category) => `
    <article class="card">
      <div class="card-icon">${escapeHtml(category.icon || '💡')}</div>
      <h3>${escapeHtml(category.name)}</h3>
      <p>${escapeHtml(category.description)}</p>
    </article>`).join('');

  $('[data-products]').innerHTML = content.products.map((product) => `
    <article class="product-card">
      <div class="product-image"><img src="${escapeHtml(product.image || placeholderSvg(product.name))}" alt="${escapeHtml(product.name)}" loading="lazy" /></div>
      <div class="product-body">
        <h3>${escapeHtml(product.name)}</h3>
        <span class="price">${escapeHtml(product.price)}</span>
        <p>${escapeHtml(product.description)}</p>
        <a class="btn btn-secondary" href="https://wa.me/${escapeHtml(content.contact.whatsapp)}?text=${encodeURIComponent(`I'm interested in ${product.name}`)}" target="_blank" rel="noopener">Inquiry</a>
      </div>
    </article>`).join('');

  $('[data-gallery]').innerHTML = content.gallery.map((item) => `
    <figure class="gallery-item">
      <img src="${escapeHtml(item.image || placeholderSvg(item.title))}" alt="${escapeHtml(item.title)}" loading="lazy" />
      <figcaption class="gallery-caption">${escapeHtml(item.title)}</figcaption>
    </figure>`).join('');

  $('[data-why]').innerHTML = content.why.map((item) => `
    <article class="why-card">
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.description)}</p>
    </article>`).join('');

  $('[data-reviews]').innerHTML = content.reviews.map((review) => `
    <article class="review-card">
      <div class="stars">${'★'.repeat(Number(review.rating || 5)).slice(0, 5)}</div>
      <p>“${escapeHtml(review.text)}”</p>
      <strong>${escapeHtml(review.name)}</strong>
    </article>`).join('');

  $('[data-contact-intro]').textContent = content.contact.intro;
  const phone = $('[data-contact-phone]');
  phone.textContent = content.contact.phone;
  phone.href = `tel:${content.contact.phone}`;
  const phoneButton = $('[data-phone-link]');
  phoneButton.href = `tel:${content.contact.phone}`;
  const email = $('[data-contact-email]');
  email.textContent = content.contact.email;
  email.href = `mailto:${content.contact.email}`;
  $('[data-contact-address]').textContent = content.contact.address;
  const whatsapp = $('[data-whatsapp-link]');
  whatsapp.href = `https://wa.me/${content.contact.whatsapp}`;
  const map = $('[data-map-placeholder]');
  if (content.contact.mapEmbedUrl) {
    map.innerHTML = `<iframe src="${escapeHtml(content.contact.mapEmbedUrl)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="${escapeHtml(content.siteName)} map"></iframe>`;
  }
  $('[data-social-links]').innerHTML = content.social.map((link) => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener">${escapeHtml(link.label)}</a>`).join('');
}

function bindNavigation() {
  const toggle = $('.menu-toggle');
  const nav = $('.main-nav');
  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
  nav.addEventListener('click', () => nav.classList.remove('open'));
}

function revealOnScroll() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.12 });
  $$('.reveal').forEach((el) => observer.observe(el));
}

bindNavigation();
revealOnScroll();
render(await loadContent());
