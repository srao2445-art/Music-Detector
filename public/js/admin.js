import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getDownloadURL, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";
import { auth, db, storage, CONTENT_COLLECTION, CONTENT_DOC } from "./firebase-services.js";
import { ADMIN_EMAIL } from "./firebase-config.js";
import { defaultContent } from "./default-content.js";

const loginScreen = document.querySelector('#login-screen');
const adminScreen = document.querySelector('#admin-screen');
const loginForm = document.querySelector('#login-form');
const loginStatus = document.querySelector('#login-status');
const saveStatus = document.querySelector('#save-status');
const contentForm = document.querySelector('#content-form');
let state = structuredClone(defaultContent);

const templates = {
  categories: () => ({ icon: '💡', name: '', description: '' }),
  products: () => ({ name: '', price: '', description: '', category: '', image: '' }),
  gallery: () => ({ title: '', image: '' }),
  why: () => ({ title: '', description: '' }),
  reviews: () => ({ name: '', rating: 5, text: '' }),
  social: () => ({ label: '', url: '' })
};

function setStatus(element, message, type = '') {
  element.textContent = message;
  element.className = `status-message ${type}`.trim();
}

function mergeContent(remote) {
  return {
    ...structuredClone(defaultContent),
    ...remote,
    hero: { ...defaultContent.hero, ...(remote?.hero || {}) },
    contact: { ...defaultContent.contact, ...(remote?.contact || {}) },
    categories: remote?.categories?.length ? remote.categories : structuredClone(defaultContent.categories),
    products: remote?.products?.length ? remote.products : structuredClone(defaultContent.products),
    gallery: remote?.gallery?.length ? remote.gallery : structuredClone(defaultContent.gallery),
    why: remote?.why?.length ? remote.why : structuredClone(defaultContent.why),
    reviews: remote?.reviews?.length ? remote.reviews : structuredClone(defaultContent.reviews),
    social: remote?.social?.length ? remote.social : structuredClone(defaultContent.social)
  };
}

function setByPath(target, path, value) {
  const parts = path.split('.');
  const last = parts.pop();
  const parent = parts.reduce((obj, key) => (obj[key] ??= {}), target);
  parent[last] = value;
}

function getByPath(target, path) {
  return path.split('.').reduce((obj, key) => obj?.[key], target) ?? '';
}

function bindBasicFields() {
  contentForm.querySelectorAll('[name]').forEach((field) => {
    field.value = getByPath(state, field.name);
    field.addEventListener('input', () => setByPath(state, field.name, field.value));
  });
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char]));
}

function field(label, key, value = '', type = 'text') {
  const isTextarea = type === 'textarea';
  const safeValue = escapeHtml(value);
  return `<label>${label}${isTextarea ? `<textarea data-key="${key}">${safeValue}</textarea>` : `<input data-key="${key}" type="${type}" value="${safeValue}" />`}</label>`;
}

function imageUploader(item, group, index) {
  return `
    <label>Image URL<input data-key="image" value="${escapeHtml(item.image || '')}" placeholder="Paste image URL or upload below" /></label>
    <label>Upload image<input data-upload="${group}" data-index="${index}" type="file" accept="image/*" /></label>
    ${item.image ? `<a class="btn btn-secondary" href="${escapeHtml(item.image)}" target="_blank" rel="noopener">View Current Image</a>` : ''}
  `;
}

function rowHtml(group, item, index) {
  const removeButton = `<div class="editor-actions"><button class="btn btn-secondary" data-remove="${group}" data-index="${index}" type="button">Remove</button></div>`;
  if (group === 'categories') {
    return field('Icon', 'icon', item.icon) + field('Name', 'name', item.name) + field('Description', 'description', item.description, 'textarea') + removeButton;
  }
  if (group === 'products') {
    return field('Name', 'name', item.name) + field('Price', 'price', item.price) + field('Category', 'category', item.category) + field('Description', 'description', item.description, 'textarea') + imageUploader(item, group, index) + removeButton;
  }
  if (group === 'gallery') {
    return field('Project title', 'title', item.title) + imageUploader(item, group, index) + removeButton;
  }
  if (group === 'why') {
    return field('Title', 'title', item.title) + field('Description', 'description', item.description, 'textarea') + removeButton;
  }
  if (group === 'reviews') {
    return field('Customer name', 'name', item.name) + field('Rating', 'rating', item.rating, 'number') + field('Review text', 'text', item.text, 'textarea') + removeButton;
  }
  return field('Label', 'label', item.label) + field('URL', 'url', item.url, 'url') + removeButton;
}

function renderEditors() {
  Object.keys(templates).forEach((group) => {
    const container = document.querySelector(`[data-editor="${group}"]`);
    container.innerHTML = state[group].map((item, index) => `<div class="editor-row" data-group="${group}" data-index="${index}">${rowHtml(group, item, index)}</div>`).join('');
  });
}

async function uploadImage(file, group, index) {
  const extension = file.name.split('.').pop() || 'jpg';
  const path = `website/${group}/${Date.now()}-${index}.${extension}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

function collectRows() {
  document.querySelectorAll('.editor-row').forEach((row) => {
    const group = row.dataset.group;
    const index = Number(row.dataset.index);
    row.querySelectorAll('[data-key]').forEach((input) => {
      const value = input.type === 'number' ? Number(input.value) : input.value;
      state[group][index][input.dataset.key] = value;
    });
  });
}

async function loadContent() {
  const snapshot = await getDoc(doc(db, CONTENT_COLLECTION, CONTENT_DOC));
  state = mergeContent(snapshot.exists() ? snapshot.data() : null);
  bindBasicFields();
  renderEditors();
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus(loginStatus, 'Logging in...');
  try {
    await signInWithEmailAndPassword(auth, document.querySelector('#login-email').value, document.querySelector('#login-password').value);
  } catch (error) {
    setStatus(loginStatus, error.message, 'error');
  }
});

document.querySelector('#logout-button').addEventListener('click', () => signOut(auth));

document.querySelectorAll('[data-add]').forEach((button) => {
  button.addEventListener('click', () => {
    const group = button.dataset.add;
    collectRows();
    state[group].push(templates[group]());
    renderEditors();
  });
});

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove]');
  if (!button) return;
  collectRows();
  state[button.dataset.remove].splice(Number(button.dataset.index), 1);
  renderEditors();
});

document.addEventListener('change', async (event) => {
  const input = event.target.closest('[data-upload]');
  if (!input?.files?.length) return;
  const group = input.dataset.upload;
  const index = Number(input.dataset.index);
  setStatus(saveStatus, 'Uploading image...');
  try {
    state[group][index].image = await uploadImage(input.files[0], group, index);
    renderEditors();
    setStatus(saveStatus, 'Image uploaded. Remember to save website content.', 'success');
  } catch (error) {
    setStatus(saveStatus, error.message, 'error');
  }
});

contentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus(saveStatus, 'Saving content...');
  try {
    collectRows();
    await setDoc(doc(db, CONTENT_COLLECTION, CONTENT_DOC), {
      ...state,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.email
    }, { merge: true });
    setStatus(saveStatus, 'Website content saved successfully.', 'success');
    document.querySelector('.preview-frame').src = `index.html?updated=${Date.now()}`;
  } catch (error) {
    setStatus(saveStatus, error.message, 'error');
  }
});

document.querySelector('#seed-button').addEventListener('click', () => {
  state = structuredClone(defaultContent);
  bindBasicFields();
  renderEditors();
  setStatus(saveStatus, 'Sample Simtolite content restored in the editor. Click Save to publish it.', 'success');
});

document.querySelector('#refresh-preview').addEventListener('click', () => {
  document.querySelector('.preview-frame').src = `index.html?preview=${Date.now()}`;
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    loginScreen.classList.remove('hidden');
    adminScreen.classList.add('hidden');
    return;
  }
  if (user.email !== ADMIN_EMAIL) {
    await signOut(auth);
    setStatus(loginStatus, `Access denied. Only ${ADMIN_EMAIL} can open this admin panel.`, 'error');
    return;
  }
  loginScreen.classList.add('hidden');
  adminScreen.classList.remove('hidden');
  document.querySelector('#admin-email').textContent = user.email;
  setStatus(saveStatus, 'Loading website content...');
  try {
    await loadContent();
    setStatus(saveStatus, 'Ready to edit.', 'success');
  } catch (error) {
    setStatus(saveStatus, error.message, 'error');
  }
});
