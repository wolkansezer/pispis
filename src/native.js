// Pışpış yerel köprüsü: Firebase senkronu, aile kodu, yerel bildirimler, ekranı açık tutma, titreşim.
// Uygulama betiği bu dosyayı window.__pispis üzerinden kullanır.
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { initializeApp } from "firebase/app";
import { initializeAuth, indexedDBLocalPersistence, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  initializeFirestore, persistentLocalCache, persistentSingleTabManager,
  doc, collection, query, orderBy, limit, setDoc, updateDoc, deleteDoc, getDoc, getDocs, onSnapshot, arrayUnion
} from "firebase/firestore";
import { firebaseConfig } from "./firebase-config.js";

const native = Capacitor.isNativePlatform();
const HID_KEY = "pispis.hid";
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => ALPHA[b % ALPHA.length]).join("");
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

let fs = null, auth = null, uid = null, hid = null;

/* ---- Firestore'u uygulamanın beklediği sade arayüze sar ---- */
const full = p => (p.startsWith("support") ? p : `households/${hid}/${p}`);
const wrapDocSnap = s => ({ id: s.id, exists: s.exists(), data: () => s.data(), metadata: s.metadata });
function docApi(path) {
  const ref = doc(fs, path);
  return {
    id: ref.id, path,
    get: async () => wrapDocSnap(await getDoc(ref)),
    set: data => setDoc(ref, data),
    update: data => updateDoc(ref, data),
    delete: () => deleteDoc(ref),
    onSnapshot: (next, err) => onSnapshot(ref, s => next(wrapDocSnap(s)), e => err && err({ code: e.code, message: e.message })),
    collection: sub => collApi(path + "/" + sub)
  };
}
function queryApi(path, parts) {
  const build = () => query(collection(fs, path), ...parts);
  return {
    orderBy: (f, d) => queryApi(path, parts.concat(orderBy(f, d || "asc"))),
    limit: n => queryApi(path, parts.concat(limit(n))),
    get: async () => wrapQuery(await getDocs(build())),
    onSnapshot: (next, err) => onSnapshot(build(), s => next(wrapQuery(s)), e => err && err({ code: e.code, message: e.message }))
  };
}
function wrapQuery(s) {
  return {
    docs: s.docs.map(d => ({ id: d.id, exists: true, data: () => d.data() })),
    size: s.size, empty: s.empty, metadata: s.metadata,
    docChanges: () => s.docChanges().map(c => ({ type: c.type, doc: { id: c.doc.id, exists: true, data: () => c.doc.data() } }))
  };
}
function collApi(path) {
  return Object.assign(queryApi(path, []), {
    path,
    doc: id => docApi(path + "/" + (id || Math.random().toString(36).slice(2, 12)))
  });
}
const dbApi = {
  doc: p => docApi(full(p)),
  collection: p => collApi(full(p))
};

/* ---- Aile (hane) ---- */
async function ensureHousehold() {
  hid = lsGet(HID_KEY);
  if (hid) {
    try { const s = await getDoc(doc(fs, "households", hid)); if (s.exists()) return; } catch (e) {}
  }
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    try {
      await setDoc(doc(fs, "households", code), { members: [uid], createdAt: Date.now() });
      hid = code; lsSet(HID_KEY, code); return;
    } catch (e) { /* kod doluysa yeniden dene */ }
  }
  throw new Error("Aile oluşturulamadı");
}
async function copyAll(fromHid, toHid) {
  for (const c of ["events", "stock", "appts", "voices"]) {
    try {
      const snap = await getDocs(collection(fs, `households/${fromHid}/${c}`));
      for (const d of snap.docs) await setDoc(doc(fs, `households/${toHid}/${c}/${d.id}`), d.data());
    } catch (e) {}
  }
}
async function joinHousehold(raw) {
  const code = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 6) throw new Error("Kod 6 karakter olmalı");
  if (code === hid) throw new Error("Zaten bu ailedesin");
  const ref = doc(fs, "households", code);
  try { await updateDoc(ref, { members: arrayUnion(uid) }); }
  catch (e) {
    try { const s = await getDoc(ref); if (!s.exists()) throw 0; }
    catch (x) { throw new Error("Bu kodla bir aile bulunamadı"); }
  }
  const old = hid;
  await copyAll(old, code);
  lsSet(HID_KEY, code);
  location.reload();
}

/* ---- Bildirimler ---- */
let lastPlan = "", permAsked = false;
async function ensurePerm() {
  if (!native) return false;
  const p = await LocalNotifications.checkPermissions();
  if (p.display === "granted") return true;
  if (permAsked) return false;
  permAsked = true;
  const r = await LocalNotifications.requestPermissions();
  return r.display === "granted";
}
// items: [{id, at(ms), title, body}]
async function plan(items) {
  if (!native) return;
  const future = items.filter(n => n.at > Date.now() + 5000).slice(0, 60);
  const key = JSON.stringify(future);
  if (key === lastPlan) return;
  lastPlan = key;
  try {
    if (!(await ensurePerm())) return;
    const pending = await LocalNotifications.getPending();
    const ours = pending.notifications.filter(n => n.id < 900000).map(n => ({ id: n.id }));
    if (ours.length) await LocalNotifications.cancel({ notifications: ours });
    if (future.length) await LocalNotifications.schedule({
      notifications: future.map(n => ({ id: n.id, title: n.title, body: n.body, schedule: { at: new Date(n.at), allowWhileIdle: true }, sound: "default" }))
    });
  } catch (e) {}
}
async function now(title, body) {
  if (!native) return;
  try {
    if (!(await ensurePerm())) return;
    await LocalNotifications.schedule({ notifications: [{ id: 900000 + Math.floor(Math.random() * 90000), title, body, schedule: { at: new Date(Date.now() + 1000) } }] });
  } catch (e) {}
}

/* ---- Ekran ve titreşim ---- */
if (native) {
  try { navigator.vibrate = () => { Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {}); return true; }; } catch (e) {}
}
let awake = false;
async function keepAwake(on) {
  if (!native) throw new Error("yok");
  if (on) await KeepAwake.keepAwake(); else await KeepAwake.allowSleep();
  awake = on; return awake;
}

/* ---- Başlatma ---- */
const configured = !!(firebaseConfig.apiKey && firebaseConfig.projectId);
let readyP = null;
function ready() {
  if (!configured) return Promise.resolve(null);
  if (readyP) return readyP;
  readyP = (async () => {
    const app = initializeApp(firebaseConfig);
    auth = initializeAuth(app, { persistence: indexedDBLocalPersistence });
    fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }) });
    uid = await new Promise((res, rej) => {
      const stop = onAuthStateChanged(auth, async u => {
        if (u) { stop(); res(u.uid); return; }
        try { const c = await signInAnonymously(auth); stop(); res(c.user.uid); } catch (e) { stop(); rej(e); }
      });
    });
    await ensureHousehold();
    return dbApi;
  })().catch(e => { console.error(e); return null; });
  return readyP;
}

window.__pispis = {
  native, configured, ready,
  get uid() { return uid; },
  get household() { return hid; },
  joinHousehold, plan, now, keepAwake,
  get awake() { return awake; }
};
