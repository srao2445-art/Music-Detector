import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  deleteDoc, query, orderBy, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export const defaults = {
  settings: {
    logo: "✦", title: "The Creator Studio", seoTitle: "The Creator Studio | Futuristic Portfolio",
    metaDescription: "A premium creator studio portfolio powered by Firebase.",
    twitter: "#", instagram: "#", github: "#", version: "v1.0.0", maintenance: false
  },
  homepage: {
    eyebrow: "Future-ready creative systems", headline: "Designing digital worlds for creators, brands, and bold ideas.",
    intro: "The Creator Studio showcases immersive projects, stories, experiments, and launch-ready ideas with a sleek Firebase CMS.",
    primaryCta: "Explore Projects", secondaryCta: "Read Articles"
  }
};

export async function getSettings() {
  const snap = await getDoc(doc(db, "settings", "site"));
  return { ...defaults.settings, ...(snap.exists() ? snap.data() : {}) };
}
export async function saveSettings(data) { return setDoc(doc(db, "settings", "site"), data, { merge: true }); }
export async function getHomepage() {
  const snap = await getDoc(doc(db, "homepage", "main"));
  return { ...defaults.homepage, ...(snap.exists() ? snap.data() : {}) };
}
export async function saveHomepage(data) { return setDoc(doc(db, "homepage", "main"), data, { merge: true }); }
export async function listProjects() { const s = await getDocs(query(collection(db, "projects"), orderBy("createdAt", "desc"))); return s.docs.map(d => ({ id: d.id, ...d.data() })); }
export async function getProject(id) { const s = await getDoc(doc(db, "projects", id)); return s.exists() ? { id: s.id, ...s.data() } : null; }
export async function saveProject(id, data) { data.updatedAt = serverTimestamp(); return id ? updateDoc(doc(db, "projects", id), data) : addDoc(collection(db, "projects"), { ...data, createdAt: serverTimestamp() }); }
export async function deleteProject(id) { return deleteDoc(doc(db, "projects", id)); }
export async function listArticles(includeDrafts = false) { const q = includeDrafts ? query(collection(db, "articles"), orderBy("createdAt", "desc")) : query(collection(db, "articles"), where("published", "==", true), orderBy("createdAt", "desc")); const s = await getDocs(q); return s.docs.map(d => ({ id: d.id, ...d.data() })); }
export async function getArticle(id) { const s = await getDoc(doc(db, "articles", id)); return s.exists() ? { id: s.id, ...s.data() } : null; }
export async function saveArticle(id, data) { data.updatedAt = serverTimestamp(); return id ? updateDoc(doc(db, "articles", id), data) : addDoc(collection(db, "articles"), { ...data, createdAt: serverTimestamp() }); }
export async function deleteArticle(id) { return deleteDoc(doc(db, "articles", id)); }
export { signInWithEmailAndPassword, signOut, onAuthStateChanged };
