import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { auth, db, CONTENT_COLLECTION, CONTENT_DOC } from "./firebase-services.js";
import { ADMIN_EMAIL } from "./firebase-config.js";
import { defaultContent } from "./default-content.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const loginScreen = $('#login-screen');
const adminScreen = $('#admin-screen');
const loginStatus = $('#login-status');
const saveStatus = $('#save-status');

let state = structuredClone(defaultContent);
let activeAdminView = 'dashboard';

const templates = {
  products: () => ({ name: '', price: '', oldPrice: '', description: '', image: '', category: '', rating: 5, badge: '', featured: false, bestseller: false }),
  categories: () => ({ icon: '✦', name: '', description: '' }),
  gallery: () => ({ title: '', image: '' }),
  reviews: () => ({ name: '', rating: 5, text: '' }),
  social: () => ({ label: '', url: '' })
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function setStatus(element, message, type = '') {
  element.textContent = message;
  element.className = `status-message ${type}`.trim();
}

function mergeArray(remote, fallback) {
  return Array.isArray(remote) && remote.length ? remote.filter(Boolean) : structuredClone(fallback);
}

function normalizeContent(remote = {}) {
  return {
    ...structuredClone(defaultContent),
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
}

function getByPath(target, path) {
  return path.split('.').reduce((obj, key) => obj?.[key], target);
}

function setByPath(target, path, value) {
  const parts = path.split('.');
  const last = parts.pop();
  const parent = parts.reduce((obj, key) => (obj[key] ??= {}), target);
  parent[last] = value;
}

function field(label, key, value = '', type = 'text') {
  const safe = escapeHtml(value ?? '');
  if (type === 'textarea') return `<label>${label}<textarea data-key="${key}">${safe}</textarea></label>`;
  if (type === 'checkbox') return `<label class="check-row"><input type="checkbox" data-key="${key}" ${value ? 'checked' : ''} /> ${label}</label>`;
  return `<label>${label}<input type="${type}" data-key="${key}" value="${safe}" /></label>`;
}

function rowHtml(group, item, index) {
  const remove = `<div class="editor-row-head"><strong>${group.slice(0, -1) || group} ${index + 1}</strong><button class="btn secondary small" data-remove="${group}" data-index="${index}" type="button">Remove</button></div>`;
  if (group === 'products') {
    return `${remove}<div class="form-grid">${field('Name', 'name', item.name)}${field('Category', 'category', item.category)}${field('Price', 'price', item.price)}${field('Old price', 'oldPrice', item.oldPrice || item.mrp || '')}${field('Badge', 'badge', item.badge || item.discount || '')}${field('Rating', 'rating', item.rating || 5, 'number')}${field('Image URL', 'image', item.image || '', 'url')}${field('Description', 'description', item.description, 'textarea')}${field('Featured product', 'featured', Boolean(item.featured), 'checkbox')}${field('Bestseller product', 'bestseller', Boolean(item.bestseller), 'checkbox')}</div>`;
  }
  if (group === 'categories') return `${remove}<div class="form-grid">${field('Icon', 'icon', item.icon)}${field('Name', 'name', item.name)}${field('Description', 'description', item.description, 'textarea')}</div>`;
  if (group === 'gallery') return `${remove}<div class="form-grid">${field('Title', 'title', item.title)}${field('Image URL', 'image', item.image || '', 'url')}</div>`;
  if (group === 'reviews') return `${remove}<div class="form-grid">${field('Customer name', 'name', item.name)}${field('Rating', 'rating', item.rating || 5, 'number')}${field('Review text', 'text', item.text, 'textarea')}</div>`;
  return `${remove}<div class="form-grid">${field('Label', 'label', item.label)}${field('URL', 'url', item.url || '', 'url')}</div>`;
}

function renderEditors() {
  Object.keys(templates).forEach((group) => {
    const container = $(`[data-editor="${group}"]`);
    if (!container) return;
    container.innerHTML = state[group].map((item, index) => `<div class="editor-row" data-group="${group}" data-index="${index}">${rowHtml(group, item, index)}</div>`).join('');
  });
}

function renderFields() {
  $$('[data-path]').forEach((input) => {
    const value = getByPath(state, input.dataset.path);
    if (input.type === 'checkbox') input.checked = value !== false;
    else input.value = value ?? '';
  });
}

function collectFields() {
  $$('[data-path]').forEach((input) => {
    const value = input.type === 'checkbox' ? input.checked : input.value;
    setByPath(state, input.dataset.path, value);
  });
  $$('.editor-row').forEach((row) => {
    const group = row.dataset.group;
    const index = Number(row.dataset.index);
    row.querySelectorAll('[data-key]').forEach((input) => {
      let value = input.type === 'checkbox' ? input.checked : input.value;
      if (input.type === 'number') value = Number(input.value) || 0;
      state[group][index][input.dataset.key] = value;
    });
  });
}

function renderSummary() {
  const activeSections = Object.values(state.homepage || {}).filter(Boolean).length;
  $('[data-summary]').innerHTML = [
    ['Total products', state.products.length],
    ['Total categories', state.categories.length],
    ['Gallery items', state.gallery.length],
    ['Reviews', state.reviews.length],
    ['Homepage active', activeSections]
  ].map(([label, value]) => `<article class="summary-card"><span>${label}</span><strong>${value}</strong></article>`).join('');
}

function renderAll() {
  renderFields();
  renderEditors();
  renderSummary();
}

function showAdminView(view) {
  activeAdminView = view;
  $$('[data-admin-section]').forEach((section) => section.classList.toggle('active', section.dataset.adminSection === view));
  $$('[data-admin-view]').forEach((button) => button.classList.toggle('active', button.dataset.adminView === view));
  $('[data-admin-sidebar]').classList.remove('open');
}

async function loadContent() {
  const snapshot = await getDoc(doc(db, CONTENT_COLLECTION, CONTENT_DOC));
  state = normalizeContent(snapshot.exists() ? snapshot.data() : {});
  renderAll();
}

async function saveContent() {
  collectFields();
  setStatus(saveStatus, 'Saving...');
  await setDoc(doc(db, CONTENT_COLLECTION, CONTENT_DOC), {
    ...state,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.email
  }, { merge: true });
  renderAll();
  setStatus(saveStatus, 'Website content saved successfully.', 'success');
}

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus(loginStatus, 'Logging in...');
  try {
    await signInWithEmailAndPassword(auth, $('#login-email').value, $('#login-password').value);
  } catch (error) {
    setStatus(loginStatus, error.message, 'error');
  }
});

$$('[data-admin-view]').forEach((button) => button.addEventListener('click', () => showAdminView(button.dataset.adminView)));
$('[data-admin-menu]').addEventListener('click', () => $('[data-admin-sidebar]').classList.toggle('open'));
$('#logout-button').addEventListener('click', () => signOut(auth));
$('#save-button').addEventListener('click', () => saveContent().catch((error) => setStatus(saveStatus, error.message, 'error')));
$('#seed-button').addEventListener('click', () => {
  state = structuredClone(defaultContent);
  renderAll();
  setStatus(saveStatus, 'Sample content restored in the editor. Click Save to publish it.', 'success');
});

document.addEventListener('click', (event) => {
  const add = event.target.closest('[data-add]');
  if (add) {
    collectFields();
    state[add.dataset.add].push(templates[add.dataset.add]());
    renderEditors();
    return;
  }
  const remove = event.target.closest('[data-remove]');
  if (remove) {
    collectFields();
    state[remove.dataset.remove].splice(Number(remove.dataset.index), 1);
    renderEditors();
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    loginScreen.classList.remove('hidden');
    adminScreen.classList.add('hidden');
    return;
  }
  if (user.email !== ADMIN_EMAIL) {
    await signOut(auth);
    setStatus(loginStatus, `Access denied. This account is not approved for admin access.`, 'error');
    return;
  }
  loginScreen.classList.add('hidden');
  adminScreen.classList.remove('hidden');
  $('#admin-email').textContent = user.email;
  $('#account-email').textContent = `Signed in as ${user.email}`;
  showAdminView(activeAdminView);
  try {
    setStatus(saveStatus, 'Loading content...');
    await loadContent();
    setStatus(saveStatus, 'Ready to edit.', 'success');
  } catch (error) {
    state = normalizeContent({});
    renderAll();
    setStatus(saveStatus, error.message, 'error');
  }
});
