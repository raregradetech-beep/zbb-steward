const firebaseConfig = {
  apiKey: "AIzaSyB_CNU1TqTM4LsbtyZWWPh5kCbnvITXG1o",
  authDomain: "zbb-steward-backend.firebaseapp.com",
  projectId: "zbb-steward-backend",
  storageBucket: "zbb-steward-backend.firebasestorage.app",
  messagingSenderId: "977691782950",
  appId: "1:977691782950:web:c4284750efdd5e98479be7"
};
// =================================================================
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let uid, monthKey;
const month = new Date().toISOString().slice(0,7);

// ----------  AUTH  ----------
auth.onAuthStateChanged(u=>{
  if(u){ uid=u.uid; showDash(); }
  else { location.reload(); }
});
authForm.onsubmit=async e=>{
  e.preventDefault();
  const email=authForm.email.value, pass=authForm.pass.value;
  try{ await auth.signInWithEmailAndPassword(email,pass); }
  catch{ await auth.createUserWithEmailAndPassword(email,pass); }
};
logout.onclick=()=>auth.signOut();

// ----------  SHOW DASH  ----------
function showDash(){
  authSec.hidden=true; dash.hidden=false; logout.hidden=false;
  monthKey=`budgets/${uid}/months/${month}`;
  loadIncomes(); loadCats(); loadVerse();
}

// ----------  INCOME  ----------
const incTable = document.querySelector('#incTable tbody');
const totalIncLabel = document.getElementById('totalInc');

async function loadIncomes(){
  const snap = await db.collection(`${monthKey}/incomes`).get();
  incTable.innerHTML='';
  let tot=0;
  snap.forEach(d=>{
    const {name,amount}=d.data();
    tot+=amount;
    const tr=incTable.insertRow();
    tr.innerHTML=`
      <td>${name}</td>
      <td><input type="number" value="${amount}" min="0" step="0.01"
                 data-id="${d.id}" class="incAmt"></td>
      <td><button data-id="${d.id}" class="delInc">🗑</button></td>`;
  });
  totalIncLabel.textContent=tot.toFixed(2);
  calcTBB(tot,null);
}
// add income
addInc.onclick=async()=>{
  const name=prompt('Income name (e.g. Salary)?');
  if(!name) return;
  await db.collection(`${monthKey}/incomes`).add({name,amount:0});
  loadIncomes();
};
// real-time update amount
incTable.addEventListener('input',async e=>{
  if(!e.target.classList.contains('incAmt')) return;
  const id=e.target.dataset.id, val=parseFloat(e.target.value)||0;
  await db.doc(`${monthKey}/incomes/${id}`).update({amount:val});
  loadIncomes();          // re-calc total
});
// delete income
incTable.addEventListener('click',async e=>{
  if(!e.target.classList.contains('delInc')) return;
  if(!confirm('Delete income?')) return;
  await db.doc(`${monthKey}/incomes/${e.target.dataset.id}`).delete();
  loadIncomes();
});

// ----------  CATEGORIES  ----------
const catTable = document.querySelector('#catTable tbody');
const tbbLabel = document.querySelector('#tbb strong');

async function loadCats(){
  const snap = await db.collection(`${monthKey}/categories`).get();
  catTable.innerHTML='';
  let budgeted=0;
  snap.forEach(d=>{
    const c=d.data();
    budgeted+=c.planned;
    const tr=catTable.insertRow();
    tr.innerHTML=`
      <td>${c.emoji} ${c.name}</td>
      <td><input type="number" value="${c.planned}" min="0" step="0.01"
                 data-id="${d.id}" class="catPlanned"></td>
      <td>R ${c.spent.toFixed(2)}</td>
      <td><button data-id="${d.id}" class="delCat">🗑</button></td>`;
  });
  calcTBB(null,budgeted);
}
// add category
addCat.onclick=async()=>{
  const name=prompt('Category name?');
  if(!name) return;
  await db.collection(`${monthKey}/categories`).add({name,planned:0,spent:0,emoji:'💰',type:'essential'});
  loadCats();
};
// real-time update planned
catTable.addEventListener('input',async e=>{
  if(!e.target.classList.contains('catPlanned')) return;
  const id=e.target.dataset.id, val=parseFloat(e.target.value)||0;
  await db.doc(`${monthKey}/categories/${id}`).update({planned:val});
  loadCats();
});
// delete category
catTable.addEventListener('click',async e=>{
  if(!e.target.classList.contains('delCat')) return;
  if(!confirm('Delete category?')) return;
  await db.doc(`${monthKey}/categories/${id}`).delete();
  loadCats();
});

// ----------  MATH  ----------
function calcTBB(totalIncome,budgetedCategories){
  // if one is null we fetch from screen
  const inc = totalIncome || parseFloat(totalIncLabel.textContent);
  const bud = budgetedCategories || Array.from(catTable.rows).reduce((s,r)=>s+parseFloat(r.cells[1].querySelector('input')?.value||0),0);
  const tbb = inc - bud;
  tbbLabel.textContent = tbb.toFixed(2);
  // colour code
  tbbLabel.style.color = (tbb<0)?'red':(tbb===0)?'green':'orange';
}

// ----------  SCRIPTURE  ----------
async function loadVerse(){
  const v=await db.collection('scriptures').limit(1).get();
  if(!v.empty) verse.textContent=v.docs[0].data().text;
}
