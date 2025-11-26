const firebaseConfig = {
  apiKey: "AIzaSyB_CNU1TqTM4LsbtyZWWPh5kCbnvITXG1o",
  authDomain: "zbb-steward-backend.firebaseapp.com",
  projectId: "zbb-steward-backend",
  storageBucket: "zbb-steward-backend.firebasestorage.app",
  messagingSenderId: "977691782950",
  appId: "1:977691782950:web:c4284750efdd5e98479be7"
};
// =================================================================
/********************************************************************
 *  ZBB + BIBLICAL STEWARDSHIP  –  SINGLE-FILE LOGIC
 *  Plug into your existing Firebase project (Auth + Firestore)
 *  No external libraries except Firebase SDK (already loaded)
 *******************************************************************/

/* ==========  1. GLOBAL HELPERS  ========== */
const month = new Date().toISOString().slice(0, 7);
let uid, monthKey; // set after login

/* quick rand formatter */
const R = x => 'R' + x.toFixed(2);

/* random Bible verse picker */
const bibleTips = {
  giving:     ["Proverbs 3:9|Honour the Lord with your wealth"],
  debt:       ["Proverbs 22:7|The borrower is slave to the lender"],
  saving:     ["Proverbs 21:20|The wise store up choice food and oil"],
  planning:   ["Luke 14:28|First sit down and count the cost"],
  steward:    ["1 Cor 4:2|Stewards must be found faithful"]
};
function randTip(arr) { const [ref, txt] = arr[Math.floor(Math.random()*arr.length)].split('|'); return `${txt} – ${ref}`; }

/* ==========  2. AUTH WRAPPER  ========== */
auth.onAuthStateChanged(u => u ? (uid=u.uid, startApp()) : showLogin());

document.getElementById('authForm').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('email').value,
        pass  = document.getElementById('pass').value;
  try { await auth.signInWithEmailAndPassword(email, pass); }
  catch { await auth.createUserWithEmailAndPassword(email, pass); }
});
document.getElementById('logout').addEventListener('click', () => auth.signOut());

function showLogin() {
  document.getElementById('authSec').hidden = false;
  document.getElementById('dash').hidden    = true;
}
function startApp() {
  document.getElementById('authSec').hidden = true;
  document.getElementById('dash').hidden    = false;
  monthKey = `budgets/${uid}/months/${month}`;
  initZBBCoach();
  loadIncome();
  loadCategories();
  loadVaults();
  dailyScripture();
  checkMilestones();
}

/* ==========  3. ZBB COACH (zero-based helper)  ========== */
const coachEl = document.getElementById('zbbCoach') || createCoachBox();
function createCoachBox() {
  const el = document.createElement('div'); el.id = 'zbbCoach';
  el.style.cssText = 'background:#eaf7ea;padding:1rem;border-left:5px solid #2e7d32;margin:1rem 0';
  document.getElementById('dash').insertBefore(el, document.getElementById('dash').firstChild);
  return el;
}
function coach(msg, verseKey) {
  const v = verseKey ? randTip(bibleTips[verseKey]) : '';
  coachEl.innerHTML = `<b>ZBB Coach:</b> ${msg}${v ? `<br><small>${v}</small>` : ''}`;
}

/* ==========  4. INCOME EDITOR + AUTO-TOTAL  ========== */
const incBody = document.querySelector('#incTable tbody');
const totalIncLabel = document.getElementById('totalInc');
async function loadIncome() {
  const snap = await db.collection(`${monthKey}/incomes`).get();
  incBody.innerHTML = '';
  let tot = 0;
  snap.forEach(d => {
    const {name, amount} = d.data();
    tot += amount;
    const tr = incBody.insertRow();
    tr.innerHTML = `
      <td>${name}</td>
      <td><input type="number" value="${amount}" min="0" step="0.01"
                 data-id="${d.id}" class="incAmt"></td>
      <td><button data-id="${d.id}" class="delInc">🗑</button></td>`;
  });
  totalIncLabel.textContent = R(tot);
  calcTBB();
}
document.getElementById('addInc').addEventListener('click', async () => {
  const name = prompt('Income name (e.g Salary)?');
  if (!name) return;
  await db.collection(`${monthKey}/incomes`).add({name, amount: 0});
  loadIncome();
});
incBody.addEventListener('input', async e => {
  if (!e.target.classList.contains('incAmt')) return;
  const id = e.target.dataset.id, val = parseFloat(e.target.value) || 0;
  await db.doc(`${monthKey}/incomes/${id}`).update({amount: val});
  loadIncome();
});
incBody.addEventListener('click', async e => {
  if (!e.target.classList.contains('delInc')) return;
  await db.doc(`${monthKey}/incomes/${e.target.dataset.id}`).delete();
  loadIncome();
});

/* ==========  5. CATEGORIES + BUDGETED COLUMN  ========== */
const catBody = document.querySelector('#catTable tbody');
async function loadCategories() {
  const snap = await db.collection(`${monthKey}/categories`).get();
  catBody.innerHTML = '';
  let budgeted = 0;
  snap.forEach(d => {
    const c = d.data();
    budgeted += c.planned;
    const tr = catBody.insertRow();
    tr.innerHTML = `
      <td>${c.emoji} ${c.name}</td>
      <td><input type="number" value="${c.planned}" min="0" step="0.01"
                 data-id="${d.id}" class="catPlanned"></td>
      <td>${R(c.spent)}</td>
      <td><button data-id="${d.id}" class="delCat">🗑</button></td>`;
  });
  calcTBB(budgeted);
  giveZBBWarnings(budgeted);
}
document.getElementById('addCat').addEventListener('click', async () => {
  const name = prompt('Category name?');
  if (!name) return;
  await db.collection(`${monthKey}/categories`).add({
    name, planned: 0, spent: 0, emoji: '💰', type: 'essential'
  });
  loadCategories();
});
catBody.addEventListener('input', async e => {
  if (!e.target.classList.contains('catPlanned')) return;
  const id = e.target.dataset.id, val = parseFloat(e.target.value) || 0;
  await db.doc(`${monthKey}/categories/${id}`).update({planned: val});
  loadCategories();
});
catBody.addEventListener('click', async e => {
  if (!e.target.classList.contains('delCat')) return;
  await db.doc(`${monthKey}/categories/${e.target.dataset.id}`).delete();
  loadCategories();
});

/* ==========  6. LIVE  “TO BE BUDGETED”  ========== */
function calcTBB(budgetedCategories) {
  const inc = parseFloat(totalIncLabel.textContent.replace('R','')) || 0;
  const bud = budgetedCategories || Array.from(catBody.rows).reduce((s,r)=>s+parseFloat(r.cells[1].querySelector('input')?.value||0),0);
  const tbb = inc - bud;
  const el = document.getElementById('tbb');
  el.innerHTML = `To Be Budgeted: <strong style="color:${tbb<0?'red':tbb===0?'green':'orange'}">${R(tbb)}</strong>`;
}
function giveZBBWarnings(budgeted) {
  const inc = parseFloat(totalIncLabel.textContent.replace('R','')) || 0;
  const tbb = inc - budgeted;
  if (tbb > 0) coach(`You still have unassigned income – give every rand a job!`, 'planning');
  else if (tbb < 0) coach(`You over-assigned money – reduce some categories.`, 'planning');
  else coach(`Perfect zero-based budget – every rand has a job!`, 'steward');
}

/* ==========  7. SINKING FUNDS / VAULTS  ========== */
const vaultBody = document.getElementById('vaultTableBody') || createVaultTable();
function createVaultTable() {
  const html = `<h3>Savings Vaults</h3><table id="vaultTable"><thead><tr><th>Name</th><th>Target</th><th>Current</th><th>%</th><th></th></tr></thead><tbody id="vaultTableBody"></tbody></table><button id="addVault">+ Add Vault</button>`;
  document.getElementById('dash').insertAdjacentHTML('beforeend', html);
  return document.getElementById('vaultTableBody');
}
async function loadVaults() {
  const snap = await db.collection(`users/${uid}/vaults`).get();
  vaultBody.innerHTML = '';
  snap.forEach(d => {
    const v = d.data();
    const pct = v.target ? Math.round((v.current / v.target) * 100) : 0;
    const tr = vaultBody.insertRow();
    tr.innerHTML = `
      <td>${v.name}</td>
      <td>${R(v.target)}</td>
      <td><input type="number" value="${v.current}" min="0" step="0.01" data-id="${d.id}" class="vaultCurrent"></td>
      <td><div style="background:#ddd;height:20px"><div style="background:#2e7d32;height:20px;width:${pct}%"></div></div> ${pct}%</td>
      <td><button data-id="${d.id}" class="delVault">🗑</button></td>`;
  });
}
document.getElementById('addVault').addEventListener('click', async () => {
  const name = prompt('Vault name (e.g. Emergency Fund)?');
  if (!name) return;
  await db.collection(`users/${uid}/vaults`).add({name, target: 0, current: 0, verse: randTip(bibleTips.saving)});
  loadVaults();
});
vaultBody.addEventListener('input', async e => {
  if (!e.target.classList.contains('vaultCurrent')) return;
  const id = e.target.dataset.id, val = parseFloat(e.target.value) || 0;
  await db.doc(`users/${uid}/vaults/${id}`).update({current: val});
  loadVaults();
});
vaultBody.addEventListener('click', async e => {
  if (!e.target.classList.contains('delVault')) return;
  await db.doc(`users/${uid}/vaults/${id}`).delete();
  loadVaults();
});

/* ==========  8. MILESTONES / GAMIFICATION  ========== */
const milestone = {
  firstBudget: async () => { await badge('firstBudget','First Budget','You created your first zero-based budget!'); },
  zeroBased:   async () => { await badge('zeroBased','Zero Hero','Every rand has a job this month!'); },
  debtFree:    async () => { await badge('debtFree','Debt Crusher','You paid off a debt!'); },
  giveGoal:    async () => { await badge('giveGoal','Cheerful Giver','You hit your giving target!'); },
  efComplete:  async () => { await badge('efComplete','Emergency Ready','Emergency fund fully funded!'); }
};
async function badge(key,title,msg){
  const snap = await db.doc(`users/${uid}/badges/${key}`).get();
  if (snap.exists) return; // already earned
  await db.doc(`users/${uid}/badges/${key}`).set({title,msg,earnedAt:new Date()});
  alert(`🏆 ${title}\n${msg}`); // simple toast
}
async function checkMilestones(){
  // first budget ever
  const incSnap = await db.collection(`${monthKey}/incomes`).limit(1).get();
  const catSnap = await db.collection(`${monthKey}/categories`).limit(1).get();
  if (!incSnap.empty && !catSnap.empty) milestone.firstBudget();
  // zero-based this month
  const tbb = parseFloat(document.getElementById('tbb').innerText.replace(/[^\d.-]/g,''));
  if (tbb === 0) milestone.zeroBased();
  // giving target hit
  const giving = catSnap.docs.find(d=>d.data().name.toLowerCase().includes('give'));
  if (giving && giving.data().planned >= giving.data().spent) milestone.giveGoal();
  // emergency-fund vault full
  const ef = await db.doc(`users/${uid}/vaults/Emergency Fund`).get();
  if (ef.exists && ef.data().current >= ef.data().target) milestone.efComplete();
}

/* ==========  9. DAILY SCRIPTURE WIDGET  ========== */
async function dailyScripture(){
  const today = new Date().toISOString().slice(0,10);
  const ref = db.doc(`users/${uid}/devotion/${today}`);
  const snap = await ref.get();
  if (!snap.exists) {
    const keys = Object.keys(bibleTips);
    const k = keys[Math.floor(Math.random()*keys.length)];
    await ref.set({date:today,text:randTip(bibleTips[k])});
  }
  const verse = (await ref.get()).data().text;
  document.getElementById('verse').textContent = verse;
}

/* ==========  10. END-OF-MONTH ROLLOVER (Cloud-Function caller)  ========== */
// button inside dashboard
const rolloverBtn = document.getElementById('rolloverBtn') || createRolloverBtn();
function createRolloverBtn(){
  const b = document.createElement('button'); b.id='rolloverBtn'; b.textContent='Close Month (Rollover)';
  b.className='btn-primary'; b.style.marginTop='1rem';
  document.getElementById('dash').appendChild(b);
  return b;
}
rolloverBtn.addEventListener('click', async () => {
  if (!confirm('Close month? Leftovers will move according to your rules.')) return;
  coach('Closing month…', 'steward');
  // call Cloud Function (we deploy this next)
  const closeMonth = firebase.functions().httpsCallable('closeMonth');
  await closeMonth();
  coach('Month closed! New month ready.', 'steward');
  loadCategories(); loadVaults();
});

/* ==========  11. OPTIONAL WHATSAPP / EMAIL ALERTS  ========== */
async function sendAlert(msg, verseKey){
  const pref = (await db.doc(`users/${uid}/prefs`).get()).data() || {};
  if (!pref.alerts) return; // user disabled
  const verse = verseKey ? randTip(bibleTips[verseKey]) : '';
  const body = `${msg}  ${verse}`;
  // queue for Cloud Function
  await db.collection('notifications_queue').add({uid,channel:'whatsapp',body,processed:false});
}

/* ==========  12. AI COACH SUMMARY (simple rule engine)  ========== */
async function aiCoach(){
  const inc = parseFloat(totalIncLabel.textContent.replace(/[^\d.-]/g,''));
  const budgeted = Array.from(catBody.rows).reduce((s,r)=>s+parseFloat(r.cells[1].querySelector('input')?.value||0),0);
  const tbb = inc - budgeted;
  const spent = Array.from(catBody.rows).reduce((s,r)=>s+parseFloat(r.cells[2].textContent.replace(/[^\d.-]/g,'')),0);
  const giving = Array.from(catBody.rows).find(r=>r.cells[0].textContent.toLowerCase().includes('give'));
  const givePct = giving ? parseFloat(giving.cells[1].querySelector('input').value)/inc*100 : 0;

  let advice=[];
  if (tbb>0) advice.push(`You still have ${R(tbb)} unassigned — give every rand a job.`);
  if (tbb<0) advice.push(`You over-assigned by ${R(Math.abs(tbb))} — reduce some categories.`);
  if (givePct<10) advice.push(`Consider increasing giving — Proverbs 3:9.`);
  if (spent>inc*0.95) advice.push(`Spending is very close to income — review discretionary items.`);
  // random pick so user doesn't get 5 messages at once
  if (advice.length) coach(advice[Math.floor(Math.random()*advice.length)], 'steward');
}

/* ==========  13. RUN AFTER EVERY CHANGE  ========== */
// hook into existing load-functions
window.reloadAll = () => { loadIncome(); loadCategories(); loadVaults(); aiCoach(); };
// call once on start
reloadAll();
