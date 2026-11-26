// 가톨릭대학교 의과대학 외과학교실 회원 게시판 (Firebase)
// 회원: 교실이 배정한 아이디·비밀번호로 로그인, 열람만 가능
// 관리자: 교실 관리자 구글 계정으로 로그인, 글쓰기와 회원 관리
// 실제 보안은 Firestore 보안 규칙(관리자만 쓰기, 승인 회원만 읽기)이 맡는다.
import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';

const CFG = { apiKey: 'AIzaSyBwEvUiRXIYwGKFIbh2t85wByFVBsdsbng', authDomain: 'cmcsurgery-members.firebaseapp.com', projectId: 'cmcsurgery-members', storageBucket: 'cmcsurgery-members.firebasestorage.app', messagingSenderId: '715752124064', appId: '1:715752124064:web:882b1db39d8df3162223c5' };
const ID_DOMAIN = 'member.cmcsurgery.github.io';
const ADMIN_EMAIL = 'comaguitar@gmail.com';
const CONSOLE_USERS = 'https://console.firebase.google.com/project/cmcsurgery-members/authentication/users';

const app = initializeApp(CFG);
const auth = getAuth(app);
const db = getFirestore(app);
const root = document.getElementById('mb-app');
const MODE = root.dataset.mode || 'board';
const ADMIN_URL = root.dataset.admin || '';
const BOARD_URL = root.dataset.board || '';

// ---------- 공통 도구 ----------
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) { if (kid == null || kid === false) continue; el.append(kid.nodeType ? kid : document.createTextNode(String(kid))); }
  return el;
}
const ID_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const idToEmail = id => String(id).trim().toLowerCase() + '@' + ID_DOMAIN;
const emailToId = em => String(em || '').endsWith('@' + ID_DOMAIN) ? String(em).slice(0, -(ID_DOMAIN.length + 1)) : String(em || '');
const isAdminUser = u => !!u && u.email === ADMIN_EMAIL && u.emailVerified && u.providerData.some(p => p.providerId === 'google.com');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function fmtDate(ts) { if (!ts) return ''; const d = ts.toDate ? ts.toDate() : new Date(ts); return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일'; }
function renderBody(text) {
  return String(text || '').replace(/\r\n/g, '\n').split(/\n{2,}/).filter(p => p.trim()).map(p => '<p>' + esc(p).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>') + '</p>').join('');
}
function errMsg(e) {
  const c = (e && e.code) || '';
  if (/invalid-credential|wrong-password|user-not-found|invalid-email|invalid-login/.test(c)) return '아이디 또는 비밀번호가 맞지 않습니다.';
  if (/too-many-requests/.test(c)) return '로그인 시도가 많아 잠시 막혔습니다. 잠시 뒤에 다시 해 주세요.';
  if (/network/.test(c)) return '인터넷 연결을 확인해 주세요.';
  if (/permission-denied/.test(c)) return '권한이 없습니다.';
  if (/email-already-in-use/.test(c)) return '이미 있는 아이디입니다.';
  if (/weak-password/.test(c)) return '비밀번호는 8자 이상으로 정해 주세요.';
  if (/popup-closed|cancelled-popup/.test(c)) return '로그인 창이 닫혔습니다. 다시 눌러 주세요.';
  if (/popup-blocked/.test(c)) return '브라우저가 로그인 창을 막았습니다. 팝업을 허용해 주세요.';
  if (/requires-recent-login/.test(c)) return '보안을 위해 로그아웃했다가 다시 로그인한 뒤 바꿔 주세요.';
  return '문제가 생겼습니다. (' + (c || (e && e.message) || '알 수 없음') + ')';
}
function randomPw(n = 10) { const cs = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const a = new Uint32Array(n); crypto.getRandomValues(a); return Array.from(a, x => cs[x % cs.length]).join(''); }
function scrollToApp() { const y = root.getBoundingClientRect().top + window.scrollY - 110; if (window.scrollY > y) window.scrollTo(0, y); }
function privacyNote() {
  return h('details', { class: 'mb-privacy' }, h('summary', {}, '개인정보 안내'),
    h('p', {}, '회원 게시판은 교실에서 정한 아이디와 계정을 만든 날짜, 최근 로그인 시각만 저장합니다. 이름이나 연락처 같은 다른 개인정보는 받지 않습니다. 비밀번호는 암호화되어 Google Firebase에 저장되며 관리자도 볼 수 없습니다. 계정을 없애고 싶으시면 교실로 알려 주세요.'),
    h('p', {}, '관리: 가톨릭대학교 의과대학 외과학교실'));
}

// ---------- 회원 게시판 ----------
let POSTS = [];
let LOADED = false;
async function memberStatus(user) {
  if (isAdminUser(user)) return 'admin';
  try { const s = await getDoc(doc(db, 'members', user.uid)); return s.exists() && s.data().approved === true ? 'member' : 'pending'; } catch (e) { return 'pending'; }
}
function viewLogin(msg) {
  const idIn = h('input', { type: 'text', id: 'mb-id', name: 'username', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', required: true });
  const pwIn = h('input', { type: 'password', id: 'mb-pw', name: 'password', autocomplete: 'current-password', required: true });
  const out = h('p', { class: 'mb-msg', role: 'alert' }, msg || '');
  const btn = h('button', { type: 'submit', class: 'mb-btn' }, '로그인');
  const form = h('form', { class: 'mb-login', onsubmit: async ev => {
    ev.preventDefault(); out.textContent = ''; btn.disabled = true;
    try { await signInWithEmailAndPassword(auth, idToEmail(idIn.value), pwIn.value); }
    catch (e) { out.textContent = errMsg(e); btn.disabled = false; }
  } }, h('label', { for: 'mb-id' }, '아이디'), idIn, h('label', { for: 'mb-pw' }, '비밀번호'), pwIn, btn, out);
  root.replaceChildren(h('div', { class: 'mb-box' }, h('h2', {}, '회원 로그인'),
    h('p', { class: 'mb-help' }, '외과학교실 교실원 전용 게시판입니다. 아이디와 비밀번호는 교실에서 한 분씩 따로 드립니다.'),
    form,
    h('p', { class: 'mb-note' }, '비밀번호를 잊으셨으면 교실로 문의해 주세요. 공용 컴퓨터에서는 다 보신 뒤 꼭 로그아웃해 주세요.'),
    privacyNote()));
}
function viewPending(user) {
  const google = user.providerData.some(p => p.providerId === 'google.com');
  root.replaceChildren(h('div', { class: 'mb-box' }, h('h2', {}, '열람 권한이 없습니다'),
    h('p', {}, google ? '이 구글 계정으로는 회원 게시판을 볼 수 없습니다. 교실에서 받은 아이디로 로그인해 주세요.' : '이 계정은 지금 열람 권한이 없습니다. 교실로 문의해 주세요.'),
    h('button', { type: 'button', class: 'mb-btn', onclick: () => signOut(auth) }, '로그아웃')));
}
async function viewBoard(user, status) {
  const bar = h('div', { class: 'mb-bar' },
    h('span', { class: 'mb-who' }, status === 'admin' ? '관리자로 로그인' : emailToId(user.email) + ' 님'),
    status === 'admin' && ADMIN_URL ? h('a', { href: ADMIN_URL }, '글·회원 관리') : null,
    status === 'member' ? h('button', { type: 'button', class: 'mb-link', onclick: () => viewChangePw(user) }, '비밀번호 바꾸기') : null,
    h('button', { type: 'button', class: 'mb-link', onclick: () => signOut(auth) }, '로그아웃'));
  const listEl = h('div', { class: 'mb-list' }, h('p', { class: 'mb-loading' }, '글을 불러오는 중입니다…'));
  root.replaceChildren(bar, listEl);
  try {
    const snap = await getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc')));
    POSTS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    POSTS.sort((a, b) => (b.pinned === true) - (a.pinned === true));
    LOADED = true; route();
  } catch (e) { listEl.replaceChildren(h('p', { class: 'mb-msg' }, errMsg(e))); }
}
function route() { if (!LOADED) return; const m = location.hash.match(/^#p=([\w-]+)/); if (m) showPost(m[1]); else showList(); }
window.addEventListener('hashchange', route);
function showList() {
  const listEl = root.querySelector('.mb-list'); if (!listEl) return;
  if (!POSTS.length) { listEl.replaceChildren(h('p', { class: 'mb-empty' }, '아직 올라온 글이 없습니다.')); return; }
  listEl.replaceChildren(h('ul', { class: 'mb-posts' }, POSTS.map(p => h('li', { class: p.pinned ? 'is-pinned' : null },
    h('a', { href: '#p=' + p.id }, p.pinned ? h('span', { class: 'mb-pin' }, '공지') : null, h('span', { class: 'mb-title' }, p.title || '(제목 없음)'), h('time', {}, fmtDate(p.createdAt)))))));
}
async function showPost(id) {
  const listEl = root.querySelector('.mb-list'); if (!listEl) return;
  const p = POSTS.find(x => x.id === id); if (!p) { showList(); return; }
  const imgsEl = h('div', { class: 'mb-imgs' });
  const edited = p.updatedAt && p.createdAt && (p.updatedAt.seconds - p.createdAt.seconds > 3600);
  listEl.replaceChildren(h('article', { class: 'mb-post' }, h('h2', {}, p.title || '(제목 없음)'),
    h('p', { class: 'mb-date' }, fmtDate(p.createdAt) + (edited ? ' (고침 ' + fmtDate(p.updatedAt) + ')' : '')),
    h('div', { class: 'mb-body', html: renderBody(p.body) }), imgsEl,
    h('p', { class: 'mb-back' }, h('a', { href: '#', class: 'more', onclick: ev => { ev.preventDefault(); location.hash = ''; } }, '목록으로'))));
  scrollToApp();
  for (const imgId of (p.images || [])) {
    try { const s = await getDoc(doc(db, 'images', imgId)); if (!s.exists()) continue; const d = s.data();
      imgsEl.append(h('figure', {}, h('a', { href: '#', onclick: ev => { ev.preventDefault(); openLightbox(d.data); } }, h('img', { src: d.data, alt: p.title || '사진', width: d.w, height: d.h, loading: 'lazy' }))));
    } catch (e) { }
  }
}
function openLightbox(src) {
  const ov = h('div', { class: 'mb-lightbox', role: 'dialog', 'aria-label': '사진 크게 보기', onclick: () => ov.remove() }, h('img', { src, alt: '' }), h('button', { type: 'button', class: 'mb-lb-close', 'aria-label': '닫기' }, '×'));
  document.body.append(ov);
}
function viewChangePw(user) {
  const cur = h('input', { type: 'password', id: 'mb-cur', autocomplete: 'current-password', required: true });
  const n1 = h('input', { type: 'password', id: 'mb-n1', autocomplete: 'new-password', required: true });
  const n2 = h('input', { type: 'password', id: 'mb-n2', autocomplete: 'new-password', required: true });
  const out = h('p', { class: 'mb-msg', role: 'alert' });
  const form = h('form', { class: 'mb-login', onsubmit: async ev => {
    ev.preventDefault(); out.className = 'mb-msg'; out.textContent = '';
    if (n1.value.length < 8) { out.textContent = '새 비밀번호는 8자 이상으로 정해 주세요.'; return; }
    if (n1.value !== n2.value) { out.textContent = '새 비밀번호 두 칸이 서로 다릅니다.'; return; }
    try { await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, cur.value)); await updatePassword(user, n1.value); out.className = 'mb-msg ok'; out.textContent = '비밀번호를 바꿨습니다.'; form.reset(); }
    catch (e) { out.textContent = errMsg(e); }
  } }, h('label', { for: 'mb-cur' }, '지금 비밀번호'), cur, h('label', { for: 'mb-n1' }, '새 비밀번호 (8자 이상)'), n1, h('label', { for: 'mb-n2' }, '새 비밀번호 한 번 더'), n2, h('button', { type: 'submit', class: 'mb-btn' }, '바꾸기'), out);
  root.replaceChildren(h('div', { class: 'mb-box' }, h('h2', {}, '비밀번호 바꾸기'), form,
    h('p', { class: 'mb-back' }, h('a', { href: '#', class: 'more', onclick: ev => { ev.preventDefault(); start(auth.currentUser); } }, '게시판으로 돌아가기'))));
}

// ---------- 관리 화면 ----------
function viewAdminLogin(msg) {
  const out = h('p', { class: 'mb-msg', role: 'alert' }, msg || '');
  root.replaceChildren(h('div', { class: 'mb-box' }, h('h2', {}, '관리자 로그인'),
    h('p', { class: 'mb-help' }, '회원 게시판 관리는 교실 관리자 구글 계정으로 로그인해서 합니다.'),
    h('button', { type: 'button', class: 'mb-btn', onclick: async () => { out.textContent = ''; try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { out.textContent = errMsg(e); } } }, '구글 계정으로 로그인'), out));
}
let EDIT = null;
async function shrinkImage(file) {
  const bm = await createImageBitmap(file);
  let maxSide = 1600, q = 0.82, data = '', w = 0, ht = 0;
  for (let i = 0; i < 8; i++) {
    const s = Math.min(1, maxSide / Math.max(bm.width, bm.height)); w = Math.round(bm.width * s); ht = Math.round(bm.height * s);
    const c = document.createElement('canvas'); c.width = w; c.height = ht; c.getContext('2d').drawImage(bm, 0, 0, w, ht);
    data = c.toDataURL('image/jpeg', q);
    if (data.length <= 950000) break;
    if (q > 0.62) q -= 0.1; else maxSide = Math.round(maxSide * 0.8);
  }
  if (bm.close) bm.close();
  return { data, w, h: ht };
}
async function adminMain(user) {
  if (!user) return viewAdminLogin();
  if (!isAdminUser(user)) {
    root.replaceChildren(h('div', { class: 'mb-box' }, h('h2', {}, '관리자 계정이 아닙니다'), h('p', {}, '관리 화면은 교실 관리자 구글 계정으로만 쓸 수 있습니다.'), h('button', { type: 'button', class: 'mb-btn', onclick: () => signOut(auth) }, '로그아웃')));
    return;
  }
  const area = h('div', { class: 'ad-area' });
  const tabPosts = h('button', { type: 'button', role: 'tab', 'aria-selected': 'true', onclick: () => select('posts') }, '글 쓰기·목록');
  const tabMembers = h('button', { type: 'button', role: 'tab', 'aria-selected': 'false', onclick: () => select('members') }, '회원 관리');
  function select(which) { tabPosts.setAttribute('aria-selected', String(which === 'posts')); tabMembers.setAttribute('aria-selected', String(which === 'members')); if (which === 'posts') adminPosts(area); else adminMembers(area); }
  root.replaceChildren(
    h('div', { class: 'mb-bar' }, h('span', { class: 'mb-who' }, '관리자 ' + user.email), BOARD_URL ? h('a', { href: BOARD_URL }, '회원 게시판 보기') : null, h('button', { type: 'button', class: 'mb-link', onclick: () => signOut(auth) }, '로그아웃')),
    h('div', { class: 'ad-tabs', role: 'tablist' }, tabPosts, tabMembers), area);
  select('posts');
}
async function adminPosts(area) {
  area.replaceChildren(h('p', { class: 'mb-loading' }, '불러오는 중입니다…'));
  let posts = [];
  try { const snap = await getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'))); posts = snap.docs.map(d => ({ id: d.id, ...d.data() })); }
  catch (e) { area.replaceChildren(h('p', { class: 'mb-msg' }, errMsg(e))); return; }
  const titleIn = h('input', { type: 'text', id: 'ad-title', required: true, maxlength: '200' });
  const bodyIn = h('textarea', { id: 'ad-body', rows: '12' });
  const pinIn = h('input', { type: 'checkbox', id: 'ad-pin' });
  const fileIn = h('input', { type: 'file', id: 'ad-files', accept: 'image/*', multiple: true });
  const keepWrap = h('div', { class: 'ad-imgs' });
  const removeSet = new Set();
  const out = h('p', { class: 'mb-msg', role: 'alert' });
  const submit = h('button', { type: 'submit', class: 'mb-btn' }, EDIT ? '고친 내용 저장' : '게시');
  if (EDIT) {
    titleIn.value = EDIT.title || ''; bodyIn.value = EDIT.body || ''; pinIn.checked = !!EDIT.pinned;
    for (const imgId of (EDIT.images || [])) {
      getDoc(doc(db, 'images', imgId)).then(s => { if (!s.exists()) return; const cb = h('input', { type: 'checkbox', onchange: ev => { if (ev.target.checked) removeSet.add(imgId); else removeSet.delete(imgId); } });
        keepWrap.append(h('figure', {}, h('img', { src: s.data().data, alt: '' }), h('label', {}, cb, ' 이 사진 빼기'))); });
    }
  }
  const form = h('form', { class: 'ad-form', onsubmit: async ev => {
    ev.preventDefault(); out.className = 'mb-msg'; out.textContent = '올리는 중입니다…'; submit.disabled = true;
    try {
      const newIds = [];
      for (const f of Array.from(fileIn.files)) { const img = await shrinkImage(f); const ref = await addDoc(collection(db, 'images'), { data: img.data, w: img.w, h: img.h, name: f.name, createdAt: serverTimestamp() }); newIds.push(ref.id); }
      const data = { title: titleIn.value.trim(), body: bodyIn.value, pinned: pinIn.checked };
      if (EDIT) {
        const keep = (EDIT.images || []).filter(id => !removeSet.has(id));
        await updateDoc(doc(db, 'posts', EDIT.id), { ...data, images: keep.concat(newIds), updatedAt: serverTimestamp() });
        for (const id of removeSet) await deleteDoc(doc(db, 'images', id)).catch(() => {});
      } else {
        await addDoc(collection(db, 'posts'), { ...data, images: newIds, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
      EDIT = null; adminPosts(area);
    } catch (e) { out.textContent = errMsg(e); submit.disabled = false; }
  } },
    h('h2', {}, EDIT ? '글 고치기' : '새 글 쓰기'),
    h('label', { for: 'ad-title' }, '제목'), titleIn,
    h('label', { for: 'ad-body' }, '본문'), bodyIn,
    h('p', { class: 'ad-help' }, '빈 줄로 문단을 나눕니다. 인터넷 주소(https://...)는 자동으로 링크가 됩니다.'),
    h('label', { class: 'ad-row' }, pinIn, ' 공지로 맨 위에 두기'),
    EDIT && (EDIT.images || []).length ? [h('p', { class: 'ad-help' }, '지금 붙어 있는 사진 (뺄 사진에 표시)'), keepWrap] : null,
    h('label', { for: 'ad-files' }, '사진 붙이기 (여러 장 가능)'), fileIn,
    h('p', { class: 'ad-help' }, '사진은 긴 쪽 1600픽셀 이하로 줄여서 저장합니다. PDF나 한글 파일은 아직 붙일 수 없습니다.'),
    h('div', { class: 'ad-row' }, submit, EDIT ? h('button', { type: 'button', class: 'mb-link', onclick: () => { EDIT = null; adminPosts(area); } }, '고치기 취소') : null), out);
  const table = posts.length ? h('table', { class: 'ad-table' }, h('thead', {}, h('tr', {}, h('th', {}, '올린 날'), h('th', {}, '제목'), h('th', {}, '사진'), h('th', {}, ''))),
    h('tbody', {}, posts.map(p => h('tr', {}, h('td', {}, fmtDate(p.createdAt)), h('td', {}, p.pinned ? '[공지] ' : '', p.title || '(제목 없음)'), h('td', {}, String((p.images || []).length)),
      h('td', { class: 'ad-actions' }, h('button', { type: 'button', class: 'mb-link', onclick: () => { EDIT = p; adminPosts(area); scrollToApp(); } }, '고치기'), ' ',
        h('button', { type: 'button', class: 'mb-link danger', onclick: async () => { if (!confirm('"' + (p.title || '') + '" 글을 지울까요? 되돌릴 수 없습니다.')) return; try { for (const id of (p.images || [])) await deleteDoc(doc(db, 'images', id)).catch(() => {}); await deleteDoc(doc(db, 'posts', p.id)); if (EDIT && EDIT.id === p.id) EDIT = null; adminPosts(area); } catch (e) { alert(errMsg(e)); } } }, '지우기'))))))
    : h('p', { class: 'mb-empty' }, '아직 올린 글이 없습니다.');
  area.replaceChildren(form, h('h2', {}, '올린 글'), table);
}
async function adminMembers(area, notice) {
  area.replaceChildren(h('p', { class: 'mb-loading' }, '불러오는 중입니다…'));
  let rows = [];
  try { const snap = await getDocs(collection(db, 'members')); rows = snap.docs.map(d => ({ uid: d.id, ...d.data() })).sort((a, b) => String(a.loginId).localeCompare(String(b.loginId))); }
  catch (e) { area.replaceChildren(h('p', { class: 'mb-msg' }, errMsg(e))); return; }
  const idIn = h('input', { type: 'text', id: 'am-id', required: true, autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', placeholder: '예: hong01' });
  const pwIn = h('input', { type: 'text', id: 'am-pw', required: true, autocomplete: 'off', spellcheck: 'false' });
  const memoIn = h('input', { type: 'text', id: 'am-memo', maxlength: '100', placeholder: '예: 서울성모 위장관외과 홍길동' });
  const out = h('p', { class: 'mb-msg' + (notice ? ' ok' : ''), role: 'alert' }, notice || '');
  const createBtn = h('button', { type: 'submit', class: 'mb-btn' }, '계정 만들기');
  const form = h('form', { class: 'ad-form', onsubmit: async ev => {
    ev.preventDefault(); out.className = 'mb-msg'; out.textContent = '';
    const id = idIn.value.trim().toLowerCase();
    if (!ID_RE.test(id)) { out.textContent = '아이디는 영문 소문자나 숫자로 시작하는 3–30자로 정해 주세요. 마침표(.), 밑줄(_), 붙임표(-)를 쓸 수 있습니다.'; return; }
    if (pwIn.value.length < 8) { out.textContent = '비밀번호는 8자 이상으로 정해 주세요.'; return; }
    createBtn.disabled = true; let sec = null;
    try {
      sec = initializeApp(CFG, 'admin-create-' + Date.now());
      const sa = getAuth(sec);
      const cred = await createUserWithEmailAndPassword(sa, idToEmail(id), pwIn.value);
      await setDoc(doc(db, 'members', cred.user.uid), { loginId: id, memo: memoIn.value.trim(), approved: true, createdAt: serverTimestamp() });
      for (const r of rows) if (r.loginId === id && r.uid !== cred.user.uid) await deleteDoc(doc(db, 'members', r.uid)).catch(() => {});
      await signOut(sa);
      await adminMembers(area, '계정을 만들었습니다. 아이디 ' + id + ', 비밀번호 ' + pwIn.value + ' 를 본인에게 전해 주세요. 이 비밀번호는 지금만 보입니다.');
    } catch (e) { out.textContent = errMsg(e); createBtn.disabled = false; }
    finally { if (sec) deleteApp(sec).catch(() => {}); }
  } },
    h('h2', {}, '회원 계정 만들기'),
    h('label', { for: 'am-id' }, '아이디'), idIn,
    h('label', { for: 'am-pw' }, '첫 비밀번호 (8자 이상)'), h('div', { class: 'ad-row' }, pwIn, h('button', { type: 'button', class: 'mb-link', onclick: () => { pwIn.value = randomPw(); } }, '자동으로 만들기')),
    h('label', { for: 'am-memo' }, '메모 (교수님만 보는 칸, 선택)'), memoIn,
    createBtn, out,
    h('p', { class: 'ad-help' }, '만든 계정은 바로 열람할 수 있습니다. 회원은 로그인한 뒤 자기 비밀번호로 바꿀 수 있습니다.'));
  const table = rows.length ? h('table', { class: 'ad-table' }, h('thead', {}, h('tr', {}, h('th', {}, '아이디'), h('th', {}, '메모'), h('th', {}, '상태'), h('th', {}, '만든 날'), h('th', {}, ''))),
    h('tbody', {}, rows.map(r => h('tr', { class: r.approved ? null : 'is-off' }, h('td', {}, r.loginId), h('td', {}, r.memo || ''), h('td', {}, r.approved ? '열람 가능' : '중지'), h('td', {}, fmtDate(r.createdAt)),
      h('td', { class: 'ad-actions' },
        h('button', { type: 'button', class: 'mb-link' + (r.approved ? ' danger' : ''), onclick: async () => { try { await updateDoc(doc(db, 'members', r.uid), { approved: !r.approved }); adminMembers(area); } catch (e) { alert(errMsg(e)); } } }, r.approved ? '중지' : '다시 허용'), ' ',
        h('button', { type: 'button', class: 'mb-link', onclick: async () => { const m = prompt('메모를 고쳐 주세요.', r.memo || ''); if (m == null) return; try { await updateDoc(doc(db, 'members', r.uid), { memo: m.trim() }); adminMembers(area); } catch (e) { alert(errMsg(e)); } } }, '메모'), ' ',
        h('button', { type: 'button', class: 'mb-link danger', onclick: async () => { if (!confirm(r.loginId + ' 계정을 회원 목록에서 지울까요? 지우면 바로 글을 볼 수 없습니다. 로그인 계정은 Firebase 콘솔 사용자 목록에서 따로 지워 주세요.')) return; try { await deleteDoc(doc(db, 'members', r.uid)); adminMembers(area); } catch (e) { alert(errMsg(e)); } } }, '지우기'))))))
    : h('p', { class: 'mb-empty' }, '아직 만든 회원 계정이 없습니다.');
  area.replaceChildren(form, h('h2', {}, '회원 목록 (' + rows.length + '명)'), table,
    h('p', { class: 'ad-help' }, '비밀번호를 잊은 회원은 ', h('a', { href: CONSOLE_USERS, target: '_blank', rel: 'noopener' }, 'Firebase 콘솔의 사용자 목록'), '에서 그 아이디(아이디@' + ID_DOMAIN + ')를 지운 뒤, 여기서 같은 아이디로 다시 만들면 됩니다. 중지하면 그 계정은 바로 글을 볼 수 없습니다. 계정을 아주 없앨 때는 여기서 지우고 Firebase 콘솔 사용자 목록에서도 지워 주세요.'));
}

// ---------- 시작 ----------
async function start(user) {
  if (MODE === 'admin') return adminMain(user);
  if (!user) { LOADED = false; return viewLogin(); }
  const st = await memberStatus(user);
  if (st === 'pending') return viewPending(user);
  return viewBoard(user, st);
}
onAuthStateChanged(auth, user => { start(user); });
