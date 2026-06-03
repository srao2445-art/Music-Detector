import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db, CONTENT_COLLECTION, CONTENT_DOC } from "./firebase-services.js";
import { defaultContent } from "./default-content.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const validViews = new Set(["home", "products", "categories", "gallery", "reviews", "about", "contact"]);

let currentContent = normalizeContent(defaultContent);
let currentView = "home";
let activeCategory = "all";
let searchTerm = "";

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function normalizePhone(value = "") {
  return String(value).replace(/[^\d+]/g, "");
}

function placeholderSvg(label = "Simtolite Lighting") {
  const safe = encodeURIComponent(label);
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 900 650'%3E%3Cdefs%3E%3ClinearGradient id='b' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%23f7fbff'/%3E%3Cstop offset='1' stop-color='%23dff3ff'/%3E%3C/linearGradient%3E%3CradialGradient id='g' cx='50%25' cy='32%25' r='54%25'%3E%3Cstop stop-color='%230078d4' stop-opacity='.72'/%3E%3Cstop offset='.35' stop-color='%2300a8e8' stop-opacity='.2'/%3E%3Cstop offset='1' stop-color='%23ffffff' stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='900' height='650' rx='36' fill='url(%23b)'/%3E%3Ccircle cx='450' cy='235' r='230' fill='url(%23g)'/%3E%3Cpath d='M450 70v105' stroke='%230078d4' stroke-opacity='.35' stroke-width='8'/%3E%3Cellipse cx='450' cy='198' rx='115' ry='44' fill='%23ffffff' stroke='%230078d4' stroke-opacity='.28' stroke-width='5'/%3E%3Cpath d='M335 220h230l95 245H240z' fill='%230078d4' opacity='.08'/%3E%3Ctext x='450' y='560' fill='%23223344' font-family='Inter,Arial' font-size='40' font-weight='800' text-anchor='middle'%3E${safe}%3C/text%3E%3C/svg%3E`;
}

function mergeArray(remote, fallback) {
  return Array.isArray(remote) && remote.length ? remote.filter(Boolean) : fallback;
}

function normalizeContent(remote = {}) {
  const content = {
    ...defaultContent,
    ...remote,
    homepage: { ...defaultContent.homepage, ...(remote.homepage || {}) },
    about: { ...defaultContent.about, ...(remote.about || {}) },
    hero: { ...defaultContent.hero, ...(remote.hero || {}) },
    contact: { ...defaultContent.contact, ...(remote.contact || {}) },
    categories: mergeArray(remote.categories, defaultContent.categories),
    products: mergeArray(remote.products, defaultContent.products),
    gallery: mergeArray(remote.gallery, defaultContent.gallery),
    why: mergeArray(remote.why, defaultContent.why),
    reviews: mergeArray(remote.reviews, defaultContent.reviews),
    social: mergeArray(remote.social, defaultContent.social)
  };
  return content;
}

async function loadRemoteContent() {
  try {
    const snapshot = await getDoc(doc(db, CONTENT_COLLECTION, CONTENT_DOC));
    return normalizeContent(snapshot.exists() ? snapshot.data() : {});
  } catch (error) {
    console.warn("Could not load Firestore content. Default content remains visible.", error);
    return currentContent;
  }
}

function stars(value = 5) {
  const rating = Math.max(1, Math.min(5, Number(value) || 5));
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

function categoryNames(content) {
  return [...new Set([
    ...content.categories.map((item) => item.name).filter(Boolean),
    ...content.products.map((item) => item.category).filter(Boolean)
  ])];
}

function whatsappUrl(content, message = "") {
  const number = normalizePhone(content.contact.whatsapp || content.contact.phone || "");
  return number ? `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ""}` : "#contact";
}

function productList(content) {
  return content.products.filter((product) => {
    const categoryMatch = activeCategory === "all" || product.category === activeCategory;
    const haystack = `${product.name || ""} ${product.category || ""} ${product.description || ""}`.toLowerCase();
    return categoryMatch && (!searchTerm || haystack.includes(searchTerm.toLowerCase()));
  });
}

function productCard(product, content, index) {
  const name = product.name || "Lighting product";
  const price = product.price || "Contact for price";
  return `
    <article class="product-card">
      <div class="product-image"><img src="${escapeHtml(product.image || placeholderSvg(name))}" alt="${escapeHtml(name)}" loading="lazy" /></div>
      <div class="product-body">
        <div class="product-meta"><span>${escapeHtml(product.category || "Lighting")}</span><span>${stars(product.rating)}</span></div>
        <h3>${escapeHtml(name)}</h3>
        <p>${escapeHtml(product.description || "Premium lighting product from Simtolite Lighting.")}</p>
        <div class="price-row"><strong>${escapeHtml(price)}</strong>${product.oldPrice ? `<del>${escapeHtml(product.oldPrice)}</del>` : ""}${product.badge ? `<em>${escapeHtml(product.badge)}</em>` : ""}</div>
        <div class="card-actions">
          <button type="button" class="btn secondary small" data-quick-product="${index}">Quick View</button>
          <a class="btn primary small" href="${escapeHtml(whatsappUrl(content, `I'm interested in ${name}`))}" target="_blank" rel="noopener">Enquire Now</a>
        </div>
      </div>
    </article>`;
}

function categoryCard(category) {
  return `
    <article class="category-card" data-category-filter="${escapeHtml(category.name || "")}" tabindex="0" role="button">
      <div class="category-icon">${escapeHtml(category.icon || "✦")}</div>
      <h3>${escapeHtml(category.name || "Lighting")}</h3>
      <p>${escapeHtml(category.description || "Explore this lighting category.")}</p>
    </article>`;
}

function galleryCard(item) {
  return `<figure class="gallery-card"><img src="${escapeHtml(item.image || placeholderSvg(item.title || "Gallery"))}" alt="${escapeHtml(item.title || "Lighting gallery")}" loading="lazy" /><figcaption>${escapeHtml(item.title || "Lighting installation")}</figcaption></figure>`;
}

function reviewCard(review) {
  return `<article class="review-card"><div class="stars">${stars(review.rating)}</div><p>“${escapeHtml(review.text || "Great lighting and helpful service.")}”</p><strong>${escapeHtml(review.name || "Customer")}</strong></article>`;
}

function whyCard(item) {
  return `<article class="why-card"><h3>${escapeHtml(item.title || "Quality Products")}</h3><p>${escapeHtml(item.description || "Helpful lighting solutions for modern spaces.")}</p></article>`;
}

function setHomeVisibility(content) {
  const mapping = {
    hero: content.homepage.showHero,
    categories: content.homepage.showCategories,
    featuredProducts: content.homepage.showFeaturedProducts,
    bestsellers: content.homepage.showBestsellers,
    galleryPreview: content.homepage.showGalleryPreview,
    reviewsPreview: content.homepage.showReviewsPreview,
    contactCta: content.homepage.showContactCta
  };
  Object.entries(mapping).forEach(([key, visible]) => {
    const section = $(`[data-home-section="${key}"]`);
    if (section) section.hidden = visible === false;
  });
}

function renderShell(content) {
  $$('[data-site-name]').forEach((el) => (el.textContent = content.siteName || defaultContent.siteName));
  $('[data-site-name-footer]').textContent = content.siteName || defaultContent.siteName;
  $('[data-footer-info]').textContent = content.tagline || defaultContent.tagline;
  $('[data-offer-text]').textContent = `Light Up Sale | ${content.tagline || defaultContent.tagline}`;
  $('[data-hero-title]').textContent = content.hero.title;
  $('[data-hero-tagline]').textContent = content.hero.tagline;
  const primary = $('[data-primary-button]');
  const secondary = $('[data-secondary-button]');
  primary.textContent = content.hero.primaryButtonText || "Explore Products";
  primary.href = content.hero.primaryButtonUrl || "#products";
  primary.dataset.viewLink = (content.hero.primaryButtonUrl || "#products").replace('#', '') || 'products';
  secondary.textContent = content.hero.secondaryButtonText || "Contact Us";
  secondary.href = content.hero.secondaryButtonUrl || "#contact";
  secondary.dataset.viewLink = (content.hero.secondaryButtonUrl || "#contact").replace('#', '') || 'contact';
  $('[data-about-title]').textContent = content.about.title || `About ${content.siteName}`;
  $('[data-about-copy]').textContent = content.about.copy || defaultContent.about.copy;
}

function renderHome(content) {
  const featured = content.products.filter((item) => item.featured).slice(0, 4);
  const bestsellers = content.products.filter((item) => item.bestseller).slice(0, 4);
  $('[data-home-categories]').innerHTML = content.categories.slice(0, 6).map(categoryCard).join("");
  $('[data-home-featured]').innerHTML = (featured.length ? featured : content.products.slice(0, 4)).map((item) => productCard(item, content, content.products.indexOf(item))).join("");
  $('[data-home-bestsellers]').innerHTML = (bestsellers.length ? bestsellers : content.products.slice(0, 4)).map((item) => productCard(item, content, content.products.indexOf(item))).join("");
  $('[data-home-gallery]').innerHTML = content.gallery.slice(0, 3).map(galleryCard).join("");
  $('[data-home-reviews]').innerHTML = content.reviews.slice(0, 3).map(reviewCard).join("");
  $('[data-contact-intro-home]').textContent = content.contact.intro;
  setHomeVisibility(content);
}

function renderProducts(content) {
  const filters = ['all', ...categoryNames(content)];
  $('[data-product-category-filters]').innerHTML = filters.map((name) => `<button type="button" class="chip ${activeCategory === name ? "active" : ""}" data-category-filter="${escapeHtml(name)}">${escapeHtml(name === 'all' ? 'All products' : name)}</button>`).join("");
  const products = productList(content);
  $('[data-results-label]').textContent = `${products.length} product${products.length === 1 ? "" : "s"} shown`;
  $('[data-products]').innerHTML = products.length ? products.map((item) => productCard(item, content, content.products.indexOf(item))).join("") : `<div class="empty-state">No products found. Try another search or category.</div>`;
}

function renderFullViews(content) {
  $('[data-categories]').innerHTML = content.categories.map(categoryCard).join("");
  $('[data-gallery]').innerHTML = content.gallery.map(galleryCard).join("");
  $('[data-reviews]').innerHTML = content.reviews.map(reviewCard).join("");
  $('[data-why]').innerHTML = content.why.map(whyCard).join("");
}

function renderContact(content) {
  $('[data-contact-intro]').textContent = content.contact.intro;
  const phone = $('[data-contact-phone]');
  phone.textContent = content.contact.phone;
  phone.href = `tel:${normalizePhone(content.contact.phone)}`;
  $('[data-phone-link]').href = `tel:${normalizePhone(content.contact.phone)}`;
  const email = $('[data-contact-email]');
  email.textContent = content.contact.email;
  email.href = `mailto:${content.contact.email}`;
  $('[data-contact-address]').textContent = content.contact.address;
  $$('[data-whatsapp-link]').forEach((link) => (link.href = whatsappUrl(content, "Hi Simtolite Lighting, I need lighting help.")));
  const socialHtml = content.social.map((link) => `<a href="${escapeHtml(link.url || "#")}" target="_blank" rel="noopener">${escapeHtml(link.label || "Social")}</a>`).join("");
  $('[data-social-links]').innerHTML = socialHtml;
  $('[data-social-links-contact]').innerHTML = socialHtml;
  $('[data-footer-contact]').innerHTML = `${escapeHtml(content.contact.phone)}<br>${escapeHtml(content.contact.email)}<br>${escapeHtml(content.contact.address)}`;
  $('[data-footer-categories]').innerHTML = categoryNames(content).slice(0, 7).map((name) => `<a href="#products" data-view-link="products" data-category-filter="${escapeHtml(name)}">${escapeHtml(name)}</a>`).join("");
  const map = $('[data-map-placeholder]');
  map.innerHTML = content.contact.mapEmbedUrl ? `<iframe src="${escapeHtml(content.contact.mapEmbedUrl)}" title="Map" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : `<span>Map placeholder</span>`;
}

function render(content) {
  currentContent = normalizeContent(content);
  renderShell(currentContent);
  renderHome(currentContent);
  renderProducts(currentContent);
  renderFullViews(currentContent);
  renderContact(currentContent);
}

function showView(view) {
  currentView = validViews.has(view) ? view : "home";
  $$('.view').forEach((section) => section.classList.toggle('is-active', section.dataset.view === currentView));
  $$('[data-view-link]').forEach((link) => link.classList.toggle('active', link.dataset.viewLink === currentView));
  closeDrawer();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openDrawer() {
  $('[data-public-drawer]').classList.add('open');
  $('[data-drawer-backdrop]').classList.add('open');
  $('[data-open-drawer]').setAttribute('aria-expanded', 'true');
}

function closeDrawer() {
  $('[data-public-drawer]').classList.remove('open');
  $('[data-drawer-backdrop]').classList.remove('open');
  $('[data-open-drawer]').setAttribute('aria-expanded', 'false');
}

function openQuickView(index) {
  const product = currentContent.products[index];
  if (!product) return;
  $('[data-quick-view-content]').innerHTML = `<div class="quick-view-content"><img src="${escapeHtml(product.image || placeholderSvg(product.name))}" alt="${escapeHtml(product.name || "Product")}" /><div><p class="kicker">${escapeHtml(product.category || "Lighting")}</p><h2>${escapeHtml(product.name || "Lighting product")}</h2><p>${escapeHtml(product.description || "Premium lighting product.")}</p><div class="price-row"><strong>${escapeHtml(product.price || "Contact for price")}</strong>${product.oldPrice ? `<del>${escapeHtml(product.oldPrice)}</del>` : ""}</div><a class="btn primary" target="_blank" rel="noopener" href="${escapeHtml(whatsappUrl(currentContent, `I'm interested in ${product.name || "this product"}`))}">Enquire Now</a></div></div>`;
  const modal = $('[data-quick-view]');
  if (typeof modal.showModal === 'function') modal.showModal();
}

function bindEvents() {
  $('[data-open-drawer]').addEventListener('click', openDrawer);
  $('[data-close-drawer]').addEventListener('click', closeDrawer);
  $('[data-drawer-backdrop]').addEventListener('click', closeDrawer);
  $('[data-search-input]').addEventListener('input', (event) => {
    searchTerm = event.target.value.trim();
    showView('products');
    renderProducts(currentContent);
  });
  document.addEventListener('click', (event) => {
    const viewLink = event.target.closest('[data-view-link]');
    if (viewLink) {
      event.preventDefault();
      if (viewLink.dataset.categoryFilter) activeCategory = viewLink.dataset.categoryFilter;
      history.pushState(null, '', `#${viewLink.dataset.viewLink}`);
      showView(viewLink.dataset.viewLink);
    }
    const category = event.target.closest('[data-category-filter]');
    if (category) {
      activeCategory = category.dataset.categoryFilter || 'all';
      renderProducts(currentContent);
      showView('products');
      history.pushState(null, '', '#products');
    }
    const quick = event.target.closest('[data-quick-product]');
    if (quick) openQuickView(Number(quick.dataset.quickProduct));
  });
  document.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-category-filter]')) {
      event.preventDefault();
      event.target.click();
    }
  });
  $('[data-close-modal]').addEventListener('click', () => $('[data-quick-view]').close());
  window.addEventListener('popstate', () => showView(location.hash.replace('#', '') || 'home'));
}

bindEvents();
render(defaultContent);
showView(location.hash.replace('#', '') || 'home');
render(await loadRemoteContent());
showView(location.hash.replace('#', '') || currentView);
