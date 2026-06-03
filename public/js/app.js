import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db, CONTENT_COLLECTION, CONTENT_DOC } from "./firebase-services.js";
import { defaultContent } from "./default-content.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

let activeCategory = "all";
let searchTerm = "";
let currentContent = normalizeContent(defaultContent);

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function slugify(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "category";
}

function normalizePhone(value = "") {
  return String(value).replace(/[^\d+]/g, "");
}

function placeholderSvg(label, tone = "gold") {
  const safeLabel = encodeURIComponent(label || "Simtolite Lighting");
  const accent = tone === "cyan" ? "%2363e6d2" : "%23f6c45f";
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 900 680'%3E%3Cdefs%3E%3CradialGradient id='g' cx='50%25' cy='26%25' r='66%25'%3E%3Cstop stop-color='${accent}' stop-opacity='0.95'/%3E%3Cstop offset='0.42' stop-color='%23ff9e2c' stop-opacity='0.3'/%3E%3Cstop offset='1' stop-color='%23080b12'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='900' height='680' fill='url(%23g)'/%3E%3Cpath d='M450 40v145' stroke='%23ffffff' stroke-opacity='0.5' stroke-width='8'/%3E%3Cellipse cx='450' cy='210' rx='110' ry='45' fill='%23101624' stroke='%23ffffff' stroke-opacity='0.18' stroke-width='4'/%3E%3Cellipse cx='450' cy='248' rx='82' ry='14' fill='%23fff2bf'/%3E%3Cpath d='M300 260h300l180 320H120z' fill='%23ffffff' opacity='0.12'/%3E%3Ctext x='450' y='610' fill='%23ffffff' font-family='Inter,Arial' font-size='42' font-weight='800' text-anchor='middle'%3E${safeLabel}%3C/text%3E%3C/svg%3E`;
}

function normalizeContent(remote = {}) {
  const merged = {
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

  return {
    ...merged,
    categories: merged.categories.filter(Boolean),
    products: merged.products.filter(Boolean),
    gallery: merged.gallery.filter(Boolean),
    why: merged.why.filter(Boolean),
    reviews: merged.reviews.filter(Boolean),
    social: merged.social.filter(Boolean)
  };
}

async function loadRemoteContent() {
  try {
    const snap = await getDoc(doc(db, CONTENT_COLLECTION, CONTENT_DOC));
    return normalizeContent(snap.exists() ? snap.data() : {});
  } catch (error) {
    console.warn("Firestore content failed to load. Keeping default Simtolite content.", error);
    return currentContent;
  }
}

function getCategoryNames(content) {
  const categoryNames = content.categories.map((category) => category.name).filter(Boolean);
  const productCategories = content.products.map((product) => product.category).filter(Boolean);
  return [...new Set([...categoryNames, ...productCategories])];
}

function getFilteredProducts(content) {
  return content.products.filter((product) => {
    const matchesCategory = activeCategory === "all" || product.category === activeCategory || product.name === activeCategory;
    const haystack = `${product.name || ""} ${product.category || ""} ${product.description || ""}`.toLowerCase();
    const matchesSearch = !searchTerm || haystack.includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });
}

function stars(value = 5) {
  const rating = Math.max(1, Math.min(5, Number(value) || 5));
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

function whatsappUrl(content, message = "") {
  const number = normalizePhone(content.contact?.whatsapp || content.contact?.phone || "");
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return number ? `https://wa.me/${number}${text}` : "#contact";
}

function productCard(product, content, index = 0) {
  const name = product.name || "Lighting Product";
  const category = product.category || "Premium Lighting";
  const price = product.price || "Contact for price";
  const oldPrice = product.oldPrice || product.mrp || "";
  const badge = product.badge || product.discount || (index < 2 ? "Popular" : "New");
  return `
    <article class="product-card" data-product-index="${index}">
      <span class="product-badge">${escapeHtml(badge)}</span>
      <div class="product-image"><img src="${escapeHtml(product.image || placeholderSvg(name, index % 2 ? "cyan" : "gold"))}" alt="${escapeHtml(name)}" loading="lazy" /></div>
      <div class="product-body">
        <div class="product-meta"><span>${escapeHtml(category)}</span><span class="stars" aria-label="${Number(product.rating || 5)} star rating">${stars(product.rating)}</span></div>
        <h3>${escapeHtml(name)}</h3>
        <div class="price-line"><span class="price">${escapeHtml(price)}</span>${oldPrice ? `<span class="old-price">${escapeHtml(oldPrice)}</span>` : ""}</div>
        <p>${escapeHtml(product.description || "Premium lighting solution from Simtolite Lighting.")}</p>
        <div class="product-actions">
          <button class="btn btn-secondary" type="button" data-quick-product="${index}">Quick View</button>
          <a class="btn btn-primary" href="${escapeHtml(whatsappUrl(content, `I'm interested in ${name}`))}" target="_blank" rel="noopener">${product.price ? "Enquire Now" : "Contact for Price"}</a>
        </div>
      </div>
    </article>`;
}

function renderCategories(content) {
  const container = $('[data-categories]');
  const mega = $('[data-mega-categories]');
  const footer = $('[data-footer-categories]');
  const categoryHtml = content.categories.map((category, index) => {
    const isActive = activeCategory === category.name;
    return `
      <article class="category-card ${isActive ? "active" : ""}" data-category-filter="${escapeHtml(category.name || "")}" tabindex="0" role="button" aria-pressed="${isActive}">
        <div class="category-image"></div>
        <div class="category-card-content">
          <span class="category-card-icon">${escapeHtml(category.icon || "✦")}</span>
          <h3>${escapeHtml(category.name || "Lighting")}</h3>
          <p>${escapeHtml(category.description || "Explore premium lighting for this category.")}</p>
        </div>
      </article>`;
  }).join("");
  container.innerHTML = categoryHtml;

  const categoryNames = getCategoryNames(content);
  mega.innerHTML = categoryNames.slice(0, 16).map((name, index) => `<button type="button" data-category-filter="${escapeHtml(name)}">${escapeHtml(name)}<small>${index < 4 ? "Featured range" : "Shop category"}</small></button>`).join("");
  footer.innerHTML = categoryNames.slice(0, 8).map((name) => `<a href="#products" data-category-filter="${escapeHtml(name)}">${escapeHtml(name)}</a>`).join("");
}

function renderProducts(content) {
  const filteredProducts = getFilteredProducts(content);
  $('[data-product-count]').textContent = `${content.products.length || 0}+`;
  $('[data-filter-label]').textContent = activeCategory === "all"
    ? searchTerm ? `Search results for “${searchTerm}”` : "Showing all products"
    : `Showing ${activeCategory}`;
  $('[data-products]').innerHTML = filteredProducts.length
    ? filteredProducts.map((product, index) => productCard(product, content, content.products.indexOf(product))).join("")
    : `<div class="empty-state"><h3>No matching products found</h3><p>Try another category or contact Simtolite Lighting for custom lighting options.</p></div>`;

  const bestsellerProducts = content.products.filter((product) => product.bestseller || product.featured).slice(0, 4);
  const fallbackBestsellers = bestsellerProducts.length ? bestsellerProducts : content.products.slice(0, 4);
  $('[data-bestsellers]').innerHTML = fallbackBestsellers.map((product) => productCard({ ...product, badge: product.badge || "Bestseller" }, content, content.products.indexOf(product))).join("");
}

function renderGallery(content) {
  $('[data-gallery]').innerHTML = content.gallery.map((item, index) => `
    <figure class="gallery-item">
      <img src="${escapeHtml(item.image || placeholderSvg(item.title || `Gallery ${index + 1}`, index % 2 ? "cyan" : "gold"))}" alt="${escapeHtml(item.title || "Lighting installation")}" loading="lazy" />
      <figcaption class="gallery-caption">${escapeHtml(item.title || "Lighting installation")}</figcaption>
    </figure>`).join("");
}

function renderWhyAndReviews(content) {
  $('[data-why]').innerHTML = content.why.map((item) => `
    <article class="why-card">
      <h3>${escapeHtml(item.title || "Quality Products")}</h3>
      <p>${escapeHtml(item.description || "Premium lighting products with helpful support.")}</p>
    </article>`).join("");

  $('[data-reviews]').innerHTML = content.reviews.map((review) => `
    <article class="review-card">
      <div class="stars">${stars(review.rating)}</div>
      <p>“${escapeHtml(review.text || "Great lighting selection and quick support.")}”</p>
      <strong>${escapeHtml(review.name || "Simtolite Customer")}</strong>
    </article>`).join("");
}

function renderContact(content) {
  $('[data-contact-intro]').textContent = content.contact?.intro || defaultContent.contact.intro;
  const phoneValue = content.contact?.phone || defaultContent.contact.phone;
  const emailValue = content.contact?.email || defaultContent.contact.email;
  const addressValue = content.contact?.address || defaultContent.contact.address;

  const phone = $('[data-contact-phone]');
  phone.textContent = phoneValue;
  phone.href = `tel:${normalizePhone(phoneValue)}`;
  $('[data-phone-link]').href = `tel:${normalizePhone(phoneValue)}`;

  const email = $('[data-contact-email]');
  email.textContent = emailValue;
  email.href = `mailto:${emailValue}`;
  $('[data-contact-address]').textContent = addressValue;

  $$('[data-whatsapp-link], [data-whatsapp-link-header]').forEach((link) => {
    link.href = whatsappUrl(content, "Hi Simtolite Lighting, I need help with lighting products.");
  });

  const map = $('[data-map-placeholder]');
  if (content.contact?.mapEmbedUrl) {
    map.innerHTML = `<iframe src="${escapeHtml(content.contact.mapEmbedUrl)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="${escapeHtml(content.siteName || "Simtolite Lighting")} map"></iframe>`;
  } else {
    map.innerHTML = `<span>Map placeholder</span><p>Embed Google Maps here from the admin contact settings.</p>`;
  }

  $('[data-footer-contact]').innerHTML = `${escapeHtml(phoneValue)}<br>${escapeHtml(emailValue)}<br>${escapeHtml(addressValue)}`;
}

function renderShell(content) {
  $$('[data-site-name]').forEach((el) => (el.textContent = content.siteName || defaultContent.siteName));
  $('[data-site-name-footer]').textContent = content.siteName || defaultContent.siteName;
  $('[data-footer-info]').textContent = content.tagline || defaultContent.tagline;
  $('[data-offer-text]').textContent = `Light Up Sale | ${content.tagline || "Premium lighting solutions for every space"}`;
  $('[data-hero-title]').textContent = content.hero?.title || defaultContent.hero.title;
  $('[data-hero-tagline]').textContent = content.hero?.tagline || defaultContent.hero.tagline;

  const primary = $('[data-primary-button]');
  primary.textContent = content.hero?.primaryButtonText || "Explore Products";
  primary.href = content.hero?.primaryButtonUrl || "#products";
  const secondary = $('[data-secondary-button]');
  secondary.textContent = content.hero?.secondaryButtonText || "Contact Us";
  secondary.href = content.hero?.secondaryButtonUrl || "#contact";

  $('[data-social-links]').innerHTML = content.social.map((link) => `<a href="${escapeHtml(link.url || "#")}" target="_blank" rel="noopener">${escapeHtml(link.label || "Social")}</a>`).join("");
}

function render(content) {
  currentContent = normalizeContent(content);
  renderShell(currentContent);
  renderCategories(currentContent);
  renderProducts(currentContent);
  renderGallery(currentContent);
  renderWhyAndReviews(currentContent);
  renderContact(currentContent);
}

function openQuickView(index) {
  const product = currentContent.products[index];
  if (!product) return;
  const modal = $('[data-quick-view]');
  $('[data-quick-view-content]').innerHTML = `
    <div class="quick-view-content">
      <img src="${escapeHtml(product.image || placeholderSvg(product.name || "Lighting product"))}" alt="${escapeHtml(product.name || "Lighting product")}" />
      <div>
        <p class="eyebrow">${escapeHtml(product.category || "Premium Lighting")}</p>
        <h2>${escapeHtml(product.name || "Lighting Product")}</h2>
        <div class="price-line"><span class="price">${escapeHtml(product.price || "Contact for price")}</span>${product.oldPrice ? `<span class="old-price">${escapeHtml(product.oldPrice)}</span>` : ""}</div>
        <div class="stars">${stars(product.rating)}</div>
        <p>${escapeHtml(product.description || "Premium Simtolite lighting product.")}</p>
        <a class="btn btn-primary" href="${escapeHtml(whatsappUrl(currentContent, `I'm interested in ${product.name || "this product"}`))}" target="_blank" rel="noopener">Enquire on WhatsApp</a>
      </div>
    </div>`;
  if (typeof modal.showModal === "function") modal.showModal();
}

function bindInteractions() {
  const toggle = $('.menu-toggle');
  const nav = $('.main-nav');
  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
  nav.addEventListener('click', (event) => {
    if (event.target.closest('[data-category-filter]')) return;
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', "false");
  });

  document.addEventListener('click', (event) => {
    const categoryTarget = event.target.closest('[data-category-filter]');
    if (categoryTarget) {
      event.preventDefault();
      activeCategory = categoryTarget.dataset.categoryFilter || "all";
      render(currentContent);
      $('#products')?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const quickButton = event.target.closest('[data-quick-product]');
    if (quickButton) openQuickView(Number(quickButton.dataset.quickProduct));
  });

  document.addEventListener('keydown', (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches('[data-category-filter]')) {
      event.preventDefault();
      event.target.click();
    }
  });

  $('[data-clear-filter]').addEventListener('click', () => {
    activeCategory = "all";
    searchTerm = "";
    $('[data-search-input]').value = "";
    render(currentContent);
  });

  $('[data-search-input]').addEventListener('input', (event) => {
    searchTerm = event.target.value.trim();
    render(currentContent);
  });

  $('[data-close-modal]').addEventListener('click', () => $('[data-quick-view]').close());
}

function revealOnScroll() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.12 });
  $$('.reveal').forEach((el) => observer.observe(el));
}

bindInteractions();
revealOnScroll();
render(defaultContent);
render(await loadRemoteContent());
