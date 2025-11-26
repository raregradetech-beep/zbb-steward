// =====  Firebase back-end config  (we fill this in step 5)  =====
const firebaseConfig = {
  apiKey: "REPLACE",
  authDomain: "REPLACE.firebaseapp.com",
  projectId: "REPLACE",
  storageBucket: "REPLACE.appspot.com",
  messagingSenderId: "REPLACE",
  appId: "REPLACE"
};
// =================================================================
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let uid, monthKey;
const month = new Date().toISOString().slice(0,7);

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

function showDash(){
  authSec.hidden=true; dash.hidden=false; logout.hidden=false;
  monthKey=`budgets/${uid}/months/${month}`;
  loadCat(); loadTBB(); loadVerse();
}

async function loadTBB(){
  const snap=await db.doc(monthKey).get();
  const tbb=snap.exists?snap.data().toBeBudgeted:0;
  document.querySelector('#tbb strong').textContent='R'+tbb;
}

async function loadCat(){
  const snap=await db.collection(`${monthKey}/categories`).get();
  catGrid.innerHTML='';
  snap.forEach(d=>{
    const c=d.data();
    catGrid.insertAdjacentHTML('beforeend',`
      <div class="card">
        <b>${c.emoji} ${c.name}</b><br>
        Planned R${c.planned} | Spent R${c.spent}
        <div class="bar" style="width:${Math.min(100,(c.spent/c.planned)*100)}%"></div>
      </div>`);
  });
}

async function loadVerse(){
  const v=await db.collection('scriptures').limit(1).get();
  if(!v.empty) verse.textContent=v.docs[0].data().text;
}

setInc.onclick=async()=>{
  const inc=+incIn.value;
  await db.doc(monthKey).set({incomePlanned:inc,toBeBudgeted:inc},{merge:true});
  loadTBB();
};

addCat.onclick=async()=>{
  const name=prompt('Category name?');
  if(!name)return;
  await db.collection(`${monthKey}/categories`).add({name,planned:0,spent:0,emoji:'💰',type:'essential'});
  loadCat();
};
