var S=null,AC=null,AAC=null,MS=[];
// Unique device ID - stays on this phone/browser forever
var DEVICE_ID=localStorage.getItem('gev_device_id');
if(!DEVICE_ID){DEVICE_ID='dev_'+Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem('gev_device_id',DEVICE_ID);}
var loginRole="student";
window._cls=[];window._vcls=[];window._acls=[];
var _swEditIdx=-1;

function $(id){return document.getElementById(id);}
function cap(s){return s.charAt(0).toUpperCase()+s.slice(1);}
function get(u){return fetch(u).then(r=>r.json());}
function post(u,d){return fetch(u,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)}).then(r=>r.json());}
function showToast(m){var t=$("toast");if(!t){t=document.createElement("div");t.id="toast";t.style.cssText="position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#222;color:#fff;padding:10px 22px;border-radius:999px;font-size:13px;z-index:9999;opacity:0;transition:opacity .3s";document.body.appendChild(t);}t.textContent=m;t.style.opacity="1";setTimeout(()=>{t.style.opacity="0";},2500);}
function openModal(id){$("overlay").classList.remove("hidden");$(id).classList.remove("hidden");}
function closeAll(){$("overlay").classList.add("hidden");document.querySelectorAll(".modal").forEach(m=>m.classList.add("hidden"));}

// ---- Account switcher (localStorage only) ----
function getAccounts(){try{return JSON.parse(localStorage.getItem("gev_sw")||"[]");}catch(e){return[];}}
function saveAccounts(arr){localStorage.setItem("gev_sw",JSON.stringify(arr));}
function addAccount(user,password){
  var accs=getAccounts();
  var entry={id:user.id,name:user.name,role:user.role,class_id:user.class_id||"",class_name:"",enrollment:user.enrollment||"",email:user.email||"",password:password||""};
  var idx=accs.findIndex(a=>a.id===user.id);
  if(idx!==-1)accs[idx]=entry;else accs.push(entry);
  saveAccounts(accs);
}
function updateAccountPassword(id,password){
  var accs=getAccounts(),i=accs.findIndex(a=>a.id===id);
  if(i!==-1){accs[i].password=password;saveAccounts(accs);}
}
function removeAccount(idx){
  var accs=getAccounts();accs.splice(idx,1);saveAccounts(accs);
}

async function showSwitcher(){
  var accs=getAccounts();
  hideAll();
  if(!accs.length){showLogin(false);return;}
  $("pg-switcher").classList.remove("hidden");
  var el=$("sw-accounts");
  el.innerHTML=accs.map((a,i)=>{
    var ini=a.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
    var bg=a.role==="admin"?"background:#5a0a0a;color:#f0c040":a.role==="teacher"?"background:#fdf3d0;color:#5a0a0a":"background:#dbeafe;color:#1d4ed8";
    var roleLabel=a.role==="admin"?"Principal / Host":cap(a.role)+(a.class_name?" · "+a.class_name:"");
    return "<div class='sw-card' onclick='swLogin("+i+",event)'><div class='sw-avatar' style='"+bg+"'>"+ini+"</div><div style='flex:1'><div class='sw-name'>"+a.name+"</div><div class='sw-role'>"+roleLabel+"</div></div><button class='sw-edit' onclick='event.stopPropagation();swEditOpen("+i+")'>Edit</button></div>";
  }).join("");
}

async function swLogin(i,e){
  var accs=getAccounts();
  var a=accs[i];
  if(!a)return;
  if(a.role==="admin"){
    hideAll();
    $("pg-pin-prompt").classList.remove("hidden");
    var ini=a.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
    $("pin-avatar").textContent=ini;
    $("pin-name").textContent=a.name;
    $("pp-pin").value="";$("pp-err").classList.add("hidden");
    $("pp-pin")._acc=a;
    $("pp-pin").focus();
  }else{
    // Verify account still exists on server before auto-login
    var d=await post("/api/login",{email:a.enrollment||a.email,password:a.password});
    if(d.success){
      S=d.user;
      startApp();
    }else{
      // Account deleted or password changed - remove from switcher
      removeAccount(i);
      showSwitcher();
      showToast("Account no longer exists. Please login again.");
    }
  }
}

async function doPinLogin(){
  var pin=$("pp-pin").value.trim(),err=$("pp-err"),a=$("pp-pin")._acc;
  err.classList.add("hidden");
  if(!pin){err.textContent="Enter PIN.";err.classList.remove("hidden");return;}
  var d=await post("/api/host-login",{pin});
  if(!d.success){err.textContent="Wrong PIN.";err.classList.remove("hidden");return;}
  S={id:a.id,name:a.name,email:a.email,enrollment:a.enrollment,role:a.role,class_id:a.class_id};
  startApp();
}

function loginWithAccount(a){
  // Always ask for password - no auto login - avoids stale password issues
  showLogin(true);
  if(a.role==="admin"){
    $("hpin").value="";
    setTimeout(()=>$("hpin").focus(),100);
  }else{
    setRole(a.role==="teacher"?"teacher":"student");
    $("lemail").value=a.enrollment||a.email;
    $("lpass").value="";
    setTimeout(()=>$("lpass").focus(),100);
  }
}

function swEditOpen(i){
  _swEditIdx=i;
  var accs=getAccounts();var a=accs[i];
  $("sw-edit-info").textContent=a.name+" · "+cap(a.role);
  openModal("modal-sw-edit");
}
async function swEditAccount(){
  closeAll();
  var accs=getAccounts();var a=accs[_swEditIdx];
  if(!a)return;
  showLogin(true);
  if(a.role==="admin"){$("hpin").value="";}
  else{setRole(a.role);$("lemail").value=a.enrollment||a.email;$("lpass").value="";}
}
function swEditAccount_byAcc(a){
  showLogin(true);
  setRole(a.role==="admin"?"student":a.role);
  $("lemail").value=a.enrollment||a.email;$("lpass").value="";
}
function swDeleteAccount(){
  closeAll();
  if(_swEditIdx<0)return;
  removeAccount(_swEditIdx);
  showSwitcher();
}

function hideAll(){
  ["pg-switcher","pg-pin-prompt","pg-login","pg-app"].forEach(id=>{var el=$(id);if(el)el.classList.add("hidden");});
}
function showLogin(fromSwitcher){
  hideAll();
  $("pg-login").classList.remove("hidden");
  var bw=$("back-sw-wrap");
  if(bw)bw.classList.toggle("hidden",!fromSwitcher);
}

// On load - show switcher if accounts exist, else login
window.addEventListener("load",()=>{
  var accs=getAccounts();
  if(accs.length){showSwitcher();}
  else{hideAll();$("pg-login").classList.remove("hidden");}
});

// Pull to refresh
(function(){
  var startY=0,pulling=false,sp=$("ptr-spinner");
  document.addEventListener("touchstart",e=>{if(window.scrollY===0)startY=e.touches[0].clientY;},{ passive:true});
  document.addEventListener("touchmove",e=>{
    if(!startY)return;
    var dy=e.touches[0].clientY-startY;
    if(dy>60&&!pulling){pulling=true;sp.classList.add("visible");}
  },{passive:true});
  document.addEventListener("touchend",()=>{
    if(pulling){
      sp.classList.add("spinning");
      setTimeout(()=>{
        sp.classList.remove("visible","spinning");startY=0;pulling=false;
        var inApp=!$("pg-app").classList.contains("hidden");
        if(inApp){var cur=document.querySelector(".tab.active");if(cur)goTab(cur.dataset.tab,cur);}
        else{showSwitcher();}
      },800);
    }else{startY=0;}
  });
})();

function setRole(r){
  loginRole=r;
  var si=$("btn-student"),ti=$("btn-teacher");
  if(r==="student"){si.style.background="#5a0a0a";si.style.color="#f0c040";si.style.borderColor="#5a0a0a";ti.style.background="#fff";ti.style.color="#555";ti.style.borderColor="#ddd";$("login-id-label").textContent="Enrollment Number";$("lemail").placeholder="Enter enrollment number";$("lemail").type="text";}
  else{ti.style.background="#5a0a0a";ti.style.color="#f0c040";ti.style.borderColor="#5a0a0a";si.style.background="#fff";si.style.color="#555";si.style.borderColor="#ddd";$("login-id-label").textContent="Email";$("lemail").placeholder="Enter your email";$("lemail").type="email";}
}
function updateUserModal(role){var lbl=$("um-id-label"),inp=$("umemail");if(!lbl||!inp)return;if(role==="teacher"){lbl.textContent="Email";inp.placeholder="Enter email";inp.type="email";}else{lbl.textContent="Enrollment Number";inp.placeholder="Enter enrollment number";inp.type="text";}}

async function hostLogin(){
  var pin=$("hpin").value.trim(),err=$("herr");err.classList.add("hidden");
  if(!pin){err.textContent="Enter PIN.";err.classList.remove("hidden");return;}
  var d=await post("/api/host-login",{pin});
  if(!d.success){err.textContent="Wrong PIN.";err.classList.remove("hidden");$("hpin").value="";return;}
  S={id:"host",name:"Guna",email:"host@gev.edu",enrollment:"host",role:"admin",class_id:"all"};
  addAccount(S,pin);
  startApp();
}
async function doLogin(){
  var email=$("lemail").value.trim(),pw=$("lpass").value,err=$("lerr");err.classList.add("hidden");
  if(!email||!pw){err.textContent="Enter credentials.";err.classList.remove("hidden");return;}
  var btn=document.querySelector(".btn-login");btn.textContent="Signing in...";btn.disabled=true;
  try{
    var d=await post("/api/login",{email,password:pw});
    if(!d.success){err.textContent=d.error;err.classList.remove("hidden");btn.textContent="Sign in";btn.disabled=false;return;}
    S=d.user;
    addAccount(S,pw);
    startApp();
  }catch(e){err.textContent="Cannot reach server.";err.classList.remove("hidden");btn.textContent="Sign in";btn.disabled=false;}
}
function doLogout(){S=null;AC=null;showSwitcher();}

function openChangePIN(){$("cpin-cur").value="";$("cpin-new").value="";$("cpin-err").classList.add("hidden");openModal("modal-changepin");}
async function saveChangePIN(){
  var cur=$("cpin-cur").value.trim(),np=$("cpin-new").value.trim(),err=$("cpin-err");err.classList.add("hidden");
  if(!cur||!np){err.textContent="Fill both.";err.classList.remove("hidden");return;}
  if(np.length<4){err.textContent="Min 4 digits.";err.classList.remove("hidden");return;}
  var d=await post("/api/change-pin",{current:cur,newPin:np});
  if(!d.success){err.textContent=d.error||"Wrong PIN.";err.classList.remove("hidden");return;}
  closeAll();showToast("PIN changed! New PIN is now active.");
}
function openChangePW(){$("cpw-cur").value="";$("cpw-new").value="";$("cpw-err").classList.add("hidden");openModal("modal-changepw");}
async function saveChangePW(){
  var cur=$("cpw-cur").value.trim(),np=$("cpw-new").value.trim(),err=$("cpw-err");err.classList.add("hidden");
  if(!cur||!np){err.textContent="Fill both fields.";err.classList.remove("hidden");return;}
  if(np.length<4){err.textContent="Min 4 characters.";err.classList.remove("hidden");return;}
  var d=await post("/api/profile",{id:S.id,password:cur,new_password:np});
  if(!d.success){err.textContent=d.error||"Wrong password.";err.classList.remove("hidden");return;}
  S=Object.assign({},S,d.user);
  updateAccountPassword(S.id,np);
  closeAll();showToast("Password changed!");
}

async function startApp(){
  hideAll();$("pg-app").classList.remove("hidden");
  $("sbrole").textContent=cap(S.role);$("sbname").textContent=S.name;$("tbemail").textContent=S.enrollment||S.email;
  var isA=S.role==="admin",isT=S.role==="teacher"||isA;
  if(isA)document.querySelector(".tab-admin").classList.remove("hidden");
  if(isT){$("btn-aa").classList.remove("hidden");$("btn-at").classList.remove("hidden");}
  await buildSB();
  if(AC&&S.role!=="admin"){
    try{await post("/api/switcher",{id:S.id,device_id:DEVICE_ID,name:S.name,role:S.role,class_id:S.class_id,class_name:AC.name,enrollment:S.enrollment||"",email:S.email||""});}catch(e){}
  }
  goTab("home",document.querySelector(".tab[data-tab=home]"));
}
async function buildSB(){
  var cls=await get("/api/classes"),sb=$("sbclasses");
  window._cls=cls;
  if(!cls.length){sb.innerHTML="<div style='font-size:12px;color:rgba(245,230,176,.35);padding:8px 12px'>No classes yet.</div>";$("tbcls").textContent="--";return;}
  var visible=S.role==="admin"?cls:cls.filter(c=>c.id===S.class_id);
  window._vcls=visible;
  if(!AC&&visible.length)AC=visible[0];
  sb.innerHTML=visible.map((c,i)=>"<button class='sbcls"+(AC&&AC.id===c.id?" active":"")+"' onclick='switchClsByIdx("+i+",this)'>"+c.name+"</button>").join("");
  $("tbcls").textContent=AC?AC.name:"--";
}
function switchClsByIdx(i,el){var cls=window._vcls[i];if(!cls)return;AC=cls;document.querySelectorAll(".sbcls").forEach(e=>e.classList.remove("active"));el.classList.add("active");$("tbcls").textContent=cls.name;var cur=document.querySelector(".tab.active");if(cur)goTab(cur.dataset.tab,cur);}
function toggleSB(){$("sidebar").classList.toggle("open");}
document.addEventListener("click",e=>{if(!e.target.closest(".sidebar")&&!e.target.closest(".mbtn"))$("sidebar").classList.remove("open");});

function goTab(name,el){
  document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(p=>{p.classList.remove("active");p.classList.add("hidden");p.style.display="";});
  el.classList.add("active");var p=$("panel-"+name);if(!p)return;
  p.classList.remove("hidden");p.classList.add("active");p.style.display="flex";
  if(name==="home")loadHome();
  if(name==="notif"){$("notif-send-area").classList.toggle("hidden",S.role==="student");loadNotifications();}
  if(name==="assign")loadAssign();if(name==="marks")loadMarks();if(name==="admin")loadAdmin();
}
async function loadHome(){
  var ini=S.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  $("pav").textContent=ini;$("pav").className="pav"+(S.role==="student"?" stu":"");
  $("pstrip").style.background=S.role==="student"?"var(--go)":"var(--gm)";
  $("pname").textContent=S.name;
  $("prole").textContent=S.role==="admin"?"Host Account":S.role==="teacher"?"Teacher - "+(AC?AC.name:"--"):"Student - "+(AC?AC.name:"--");
  $("pgrid").innerHTML=[["Name",S.name],["Role",cap(S.role)]].map(p=>"<div class='ppill'><div class='ppill-l'>"+p[0]+"</div><div class='ppill-v'>"+p[1]+"</div></div>").join("");
  if(S.role==="admin"){$("changepinbtnwrap").classList.remove("hidden");var cb=$("changepwbtnwrap");if(cb)cb.classList.add("hidden");}else{var pb=$("changepinbtnwrap");if(pb)pb.classList.add("hidden");$("changepwbtnwrap").classList.remove("hidden");}
  if(S.role==="admin"){try{var u=await get("/api/users"),cl=await get("/api/classes");$("statrow").innerHTML=[[cl.length,"Classes"],[u.filter(x=>x.role==="teacher").length,"Teachers"],[u.filter(x=>x.role==="student").length,"Students"]].map(s=>"<div class='sbox'><div class='sbox-n'>"+s[0]+"</div><div class='sbox-l'>"+s[1]+"</div></div>").join("");}catch(e){}}
}
function openPM(){$("pmname").value=S.name||"";$("pmphone").value=S.phone||"";$("pmsubj").value=S.subject||"";$("pmdob").value=S.dob||"";$("pmaddr").value=S.address||"";$("pmcur").value="";$("pmnew").value="";$("pmerr").classList.add("hidden");$("pmswrap").style.display=S.role==="teacher"?"block":"none";openModal("modal-profile");}
async function saveProfile(){var name=$("pmname").value.trim(),np=$("pmnew").value,cp=$("pmcur").value,err=$("pmerr");err.classList.add("hidden");if(!name){err.textContent="Name required.";err.classList.remove("hidden");return;}if(np&&!cp){err.textContent="Enter current password.";err.classList.remove("hidden");return;}if(np&&np.length<4){err.textContent="Min 4 chars.";err.classList.remove("hidden");return;}var pl={id:S.id,name,phone:$("pmphone").value.trim(),subject:$("pmsubj").value.trim(),dob:$("pmdob").value,address:$("pmaddr").value.trim()};if(np){pl.password=cp;pl.new_password=np;}var d=await post("/api/profile",pl);if(!d.success){err.textContent=d.error;err.classList.remove("hidden");return;}S=Object.assign({},S,d.user);closeAll();loadHome();$("sbname").textContent=S.name;showToast("Profile updated!");}

async function loadNotifications(){var el=$("notif-feed");if(!el)return;var n=await get("/api/notifications?class_id="+(AC?AC.id:"all"));if(!n.length){el.innerHTML="<div class='empty'>No notifications yet.</div>";return;}var isT=S.role!=="student";el.innerHTML=n.map(x=>"<div style='background:#fff;border:1px solid #e5e5e5;border-radius:10px;padding:14px;margin-bottom:10px;position:relative'>"+(isT?"<button onclick=\"deleteNotif('"+x.id+"')\" style='position:absolute;top:8px;right:8px;background:none;border:none;font-size:18px;cursor:pointer;color:#aaa'>x</button>":"")+(x.image?"<img src='"+x.image+"' style='width:100%;max-height:220px;object-fit:cover;border-radius:8px;margin-bottom:10px'>":"")+"<div style='font-size:14px;color:#111;line-height:1.5'>"+x.message+"</div><div style='font-size:11px;color:#aaa;margin-top:6px'>-- "+(x.sent_by||"School")+" - "+new Date(x.created_at).toLocaleString()+"</div></div>").join("");}
async function deleteNotif(id){if(!confirm("Delete?"))return;await fetch("/api/notifications/"+id,{method:"DELETE"});loadNotifications();}
async function sendNotification(){var msg=$("notif-msg").value.trim(),fi=$("notif-img");if(!msg){alert("Enter a message.");return;}var img=null;if(fi.files[0]){img=await new Promise(r=>{var rd=new FileReader();rd.onload=e=>r(e.target.result);rd.readAsDataURL(fi.files[0]);});}await post("/api/notifications",{class_id:AC?AC.id:"all",message:msg,image:img,sent_by:S.name});$("notif-msg").value="";fi.value="";loadNotifications();showToast("Sent!");}

async function loadAssign(){var list=$("alist");if(!AC){list.innerHTML="<div class='empty'>No class selected.</div>";return;}$("atitle").textContent="📚 Assignments - "+AC.name;var items=await get("/api/assignments?class_id="+AC.id);if(!items.length){list.innerHTML="<div class='empty'>No assignments yet.</div>";return;}var today=new Date().toISOString().split("T")[0],isT=S.role!=="student";list.innerHTML=items.map(a=>{var bc=a.due_date<today?"ab-past":a.due_date===today?"ab-today":"ab-up",bt=a.due_date<today?"Done":a.due_date===today?"Due today":"Due "+a.due_date;return "<div class='acard'><div class='acard-top'><div class='acard-title'>"+a.title+"</div><div style='display:flex;align-items:center;gap:6px'><span class='abadge "+bc+"'>"+bt+"</span>"+(isT?"<button class='delbtn' onclick=\"delAssign('"+a.id+"')\">x</button>":"")+"</div></div><div class='acard-meta'>"+(a.subject?"<span>"+a.subject+"</span>":"")+(a.posted_by?"<span>by "+a.posted_by+"</span>":"")+"</div>"+(a.description?"<div class='acard-desc'>"+a.description+"</div>":"")+"</div>";}).join("");}
function openAM(){$("amtitle").value="";$("amsubj").value="";$("amdue").value="";$("amdesc").value="";openModal("modal-assign");}
async function submitAssign(){var t=$("amtitle").value.trim();if(!t){alert("Enter title.");return;}await post("/api/assignments",{class_id:AC.id,title:t,subject:$("amsubj").value.trim(),due_date:$("amdue").value,description:$("amdesc").value.trim(),posted_by:S.name});closeAll();loadAssign();}
async function delAssign(id){if(!confirm("Delete?"))return;await fetch("/api/assignments/"+id,{method:"DELETE"});loadAssign();}

async function importExcel(){var fi=$("xl-file"),tname=$("tname").value.trim(),tmax=$("tmax").value,tsubj=$("tsubj").value.trim(),tdate=$("tdate").value;if(!fi.files[0]){alert("Select a file.");return;}if(!tname){alert("Enter test name.");return;}if(!tmax){alert("Enter max marks.");return;}if(!tsubj){alert("Enter subject.");return;}if(!AC){alert("Select a class.");return;}var sp=$("xl-spinner"),sc=$("xl-caption"),pr=$("xl-progress"),st=$("xl-status");function ss(msg,pct,state){st.style.display="block";sc.textContent=msg;pr.style.width=pct+"%";if(state==="ok"){sp.style.animation="none";sp.style.borderTopColor="#16a34a";}if(state==="err"){sp.style.animation="none";sp.style.borderTopColor="#dc2626";}}sp.style.animation="spin 0.8s linear infinite";sp.style.borderTopColor="#1d4ed8";ss("Reading file...",10);try{var file=fi.files[0],rows=[];if(file.name.endsWith(".csv")){ss("Parsing CSV...",25);var txt=await file.text();rows=txt.trim().split("\n").map(r=>r.split(",").map(c=>c.trim().replace(/"/g,"")));}else{ss("Loading Excel...",15);if(!window.XLSX){await new Promise((res,rej)=>{var s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";s.onload=res;s.onerror=rej;document.head.appendChild(s);});}ss("Parsing...",30);var ab=await file.arrayBuffer();var wb=window.XLSX.read(ab,{type:"array"});rows=window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:""});}if(!rows.length)throw new Error("File is empty.");ss("Finding columns...",45);var h=rows[0].map(x=>String(x).toLowerCase().trim());var ni=h.findIndex(x=>x.includes("name")),ei=h.findIndex(x=>x.includes("enroll")||x.includes("roll")),mi=h.findIndex(x=>x.includes("mark")||x.includes("score")||x.includes("total"));if(ni===-1)throw new Error("No Name column.");if(mi===-1)throw new Error("No Marks column.");ss("Reading students...",60);var roster=window._sts||[],students=[];for(var i=1;i<rows.length;i++){var row=rows[i],name=String(row[ni]||"").trim(),marks=String(row[mi]||"").trim(),enroll=ei>=0?String(row[ei]||"").trim():"";if(!name||!marks||isNaN(Number(marks)))continue;var found=roster.find(s=>s.enrollment===enroll||s.name===name);students.push({name,email:found?found.email:enroll+"@gev.edu",marks});}if(!students.length)throw new Error("No valid data.");ss("Publishing "+students.length+" students...",80);var d=await post("/api/marks",{test_name:tname,subject:tsubj,max_marks:Number(tmax),test_date:tdate,class_id:AC.id,students});if(!d.success)throw new Error(d.error||"Server error");ss("Done! "+students.length+" uploaded!",100,"ok");setTimeout(()=>{st.style.display="none";sp.style.animation="spin 0.8s linear infinite";sp.style.borderTopColor="#1d4ed8";$("xl-file").value="";$("tname").value="";MS=[];renderSL();loadMarks();showToast("Imported "+students.length+" students!");},2500);}catch(e){ss("Error: "+e.message,0,"err");}}

async function loadMarks(){MS=[];renderSL();mView("results",document.querySelector(".mtab"));if(!AC){$("mresults").innerHTML="<div class='empty'>No class selected.</div>";return;}var tests=await get("/api/tests?class_id="+AC.id);if(!tests.length){$("mresults").innerHTML="<div class='empty'>No results yet.</div>";return;}var isT=S.role!=="student",h="";for(var i=0;i<tests.length;i++){var t=tests[i],marks=await get("/api/marks?test_id="+t.id);var filtered=S.role==="student"?marks.filter(m=>m.student_email===S.email):marks;h+="<div class='tcard'><div class='tcard-hdr' style='display:flex;align-items:center;justify-content:space-between'><div><div class='tcard-name'>"+t.name+(t.subject?" - "+t.subject:"")+"</div><div class='tcard-meta'>"+(t.test_date||"")+" Max: "+t.max_marks+"</div></div>"+(isT?"<div style='display:flex;gap:6px'><button onclick=\"openEditMarks('"+t.id+"','"+t.name+"','"+(t.subject||"")+"',"+t.max_marks+")\" style='font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid #d4a017;background:#fdf3d0;color:#5a0a0a;cursor:pointer'>Edit</button><button onclick=\"deleteTest('"+t.id+"')\" style='font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid #fca5a5;background:#fef2f2;color:#991b1b;cursor:pointer'>Del</button></div>":"")+" </div><table class='mtbl'><thead><tr><th>Rank</th><th>Student</th><th>Marks</th><th>Grade</th></tr></thead><tbody>"+filtered.map(m=>"<tr class='"+(m.rank<=3?"r"+m.rank:"")+"'><td><span class='rlbl'>"+m.rank_label+"</span></td><td>"+m.student_name+"</td><td>"+m.marks+"/"+t.max_marks+"</td><td>"+m.grade+"</td></tr>").join("")+"</tbody></table></div>";}$("mresults").innerHTML=h;}
function mView(v,el){document.querySelectorAll(".mtab").forEach(t=>t.classList.remove("active"));el.classList.add("active");$("mresults").classList.toggle("hidden",v!=="results");$("madd").classList.toggle("hidden",v!=="add");if(v==="add")loadSL();}
async function loadSL(){if(!AC)return;try{window._sts=await get("/api/students?class_id="+AC.id);}catch(e){window._sts=[];}}
function searchByEnroll(){var q=$("st-enroll").value.trim(),dd=$("stdrop");if(!q){dd.classList.add("hidden");$("stsearch").value="";return;}var f=(window._sts||[]).filter(s=>(s.enrollment||"").startsWith(q)&&!MS.find(m=>m.email===s.email));if(!f.length){dd.classList.add("hidden");return;}dd.innerHTML=f.slice(0,8).map(s=>"<div class='acitem' data-name='"+s.name+"' data-email='"+s.email+"' data-enroll='"+(s.enrollment||"")+"' onclick='pickEnroll(this)'>"+s.enrollment+" - "+s.name+"</div>").join("");dd.classList.remove("hidden");}
function pickEnroll(el){$("stsearch").value=el.dataset.name;$("st-enroll").value=el.dataset.enroll;$("stdrop").classList.add("hidden");}
function addFromEnroll(){var name=$("stsearch").value.trim(),enroll=$("st-enroll").value.trim();if(!name){alert("Select a student.");return;}var found=(window._sts||[]).find(s=>s.enrollment===enroll||s.name===name);if(!found){alert("Student not found.");return;}if(MS.find(m=>m.email===found.email)){alert("Already added.");return;}MS.push({name:found.name,email:found.email,marks:""});$("st-enroll").value="";$("stsearch").value="";$("stdrop").classList.add("hidden");renderSL();}
function renderSL(){$("stlist").innerHTML=MS.map((s,i)=>"<div class='strow'><div class='stname'>"+s.name+"</div><input type='number' min='0' placeholder='Marks' value='"+s.marks+"' oninput='MS["+i+"].marks=this.value'><button class='stdel' onclick='MS.splice("+i+",1);renderSL()'>x</button></div>").join("");}
async function submitMarks(){var name=$("tname").value.trim(),max=Number($("tmax").value),filled=MS.filter(s=>s.marks!=="");if(!name){alert("Enter test name.");return;}if(!max){alert("Enter max marks.");return;}if(!filled.length){alert("Add students.");return;}var d=await post("/api/marks",{test_name:name,subject:$("tsubj").value.trim(),max_marks:max,test_date:$("tdate").value,class_id:AC.id,students:filled});if(d.success){alert("Published! Top: "+d.marks[0].student_name);MS=[];renderSL();$("tname").value="";loadMarks();}}
async function deleteTest(tid){if(!confirm("Delete?"))return;await fetch("/api/marks/test/"+tid,{method:"DELETE"});loadMarks();}
async function openEditMarks(tid,name,subj,max){$("em-test-id").value=tid;$("em-name").value=name;$("em-subj").value=subj;$("em-max").value=max;var marks=await get("/api/marks?test_id="+tid);$("em-students-list").innerHTML=marks.map((m,i)=>"<div class='strow'><div class='stname'>"+m.student_name+"</div><input type='number' min='0' value='"+m.marks+"' id='em-mark-"+i+"' data-email='"+m.student_email+"' data-name='"+m.student_name+"'></div>").join("");openModal("modal-editmarks");}
async function submitEditMarks(){var tid=$("em-test-id").value,max=Number($("em-max").value),name=$("em-name").value,subj=$("em-subj").value;var rows=document.querySelectorAll("[id^=em-mark-]");var students=Array.from(rows).map(inp=>({name:inp.dataset.name,email:inp.dataset.email,marks:inp.value}));await fetch("/api/marks/test/"+tid,{method:"DELETE"});var d=await post("/api/marks",{test_name:name,subject:subj,max_marks:max,test_date:"",class_id:AC.id,students});if(d.success){closeAll();loadMarks();showToast("Updated!");}}

function showAchievement(name,role,pwd){var o=document.createElement("div");o.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center";o.innerHTML="<div style='background:linear-gradient(135deg,#3d0606,#5a0a0a);border-radius:16px;padding:40px;max-width:400px;width:90%;text-align:center;border:2px solid #d4a017'><div style='font-size:48px;margin-bottom:10px'>"+(role==="teacher"?"T":"S")+"</div><div style='font-size:12px;color:#d4a017;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px'>Welcome to Golden Eye Vidyapeeth</div><div style='font-size:26px;font-weight:700;color:#f0c040;margin-bottom:6px'>"+name+"</div><div style='font-size:13px;color:rgba(245,230,176,.7);margin-bottom:20px'>"+(role==="teacher"?"Teacher":"Student")+" Account</div><div style='background:rgba(0,0,0,.3);border-radius:10px;padding:16px;margin-bottom:20px'><div style='font-size:11px;color:#d4a017;margin-bottom:6px'>PASSWORD</div><div style='font-size:32px;font-weight:700;color:#fff;letter-spacing:.1em'>"+pwd+"</div></div><button onclick='this.parentElement.parentElement.remove()' style='background:#d4a017;color:#3d0606;border:none;border-radius:999px;padding:10px 32px;font-size:14px;font-weight:700;cursor:pointer'>Got it</button></div>";document.body.appendChild(o);}

async function loadAdmin(){buildAStats();buildCGrid();}
async function buildAStats(){try{var u=await get("/api/users"),cl=await get("/api/classes");$("adstats").innerHTML=[[cl.length,"Classes"],[u.filter(x=>x.role==="teacher").length,"Teachers"],[u.filter(x=>x.role==="student").length,"Students"]].map(s=>"<div class='astat'><div class='astat-n'>"+s[0]+"</div><div class='astat-l'>"+s[1]+"</div></div>").join("");}catch(e){}}
async function buildCGrid(){var cls=await get("/api/classes");window._acls=cls;if(!cls.length){$("clsgrid").innerHTML="<div class='clsgrid'><div class='empty'>No classes yet.</div></div>";return;}if(!AAC)AAC=cls[0];$("clsgrid").innerHTML="<div class='clsgrid'>"+cls.map((c,i)=>"<div class='clsblock"+(AAC&&AAC.id===c.id?" sel":"")+"' onclick='selClsByIdx("+i+",this)'><div><div class='clsname'>"+c.name+"</div><div class='clsmeta' id='cm-"+c.id+"'>...</div></div><button class='clsdel' onclick='event.stopPropagation();delCls(\""+c.id+"\")'>x</button></div>").join("")+"</div>";cls.forEach(async c=>{try{var u=await get("/api/users?class_id="+c.id);var el=$("cm-"+c.id);if(el){var s=u.filter(x=>x.role==="student").length,t=u.find(x=>x.role==="teacher");el.textContent=s+" students"+(t?" - "+t.name.split(" ")[0]:"");}}catch(e){}});loadUTable();}
function selClsByIdx(i,el){var cls=window._acls[i];if(!cls)return;AAC=cls;document.querySelectorAll(".clsblock").forEach(b=>b.classList.remove("sel"));el.classList.add("sel");$("usectitle").textContent="Users - "+cls.name;loadUTable();}
async function delCls(id){if(!confirm("Delete class?"))return;await fetch("/api/classes/"+id,{method:"DELETE"});if(AAC&&AAC.id===id)AAC=null;loadAdmin();buildSB();}
async function loadUTable(){if(!AAC){$("usertbl").innerHTML="<div class='empty'>Select a class.</div>";return;}$("usectitle").textContent="Users - "+AAC.name;var u=await get("/api/users?class_id="+AAC.id+"&showpwd=1");if(!u.length){$("usertbl").innerHTML="<div class='empty'>No users yet.</div>";return;}$("usertbl").innerHTML="<table class='utbl'><thead><tr><th>Name</th><th>Enrollment/Email</th><th>Password</th><th>Role</th><th></th></tr></thead><tbody>"+u.map(u=>"<tr><td style='font-weight:700'>"+u.name+"</td><td style='color:#888;font-size:12px;font-family:monospace'>"+(u.enrollment||u.email)+"</td><td style='font-size:12px;color:#555;font-family:monospace'>"+(u.password||"--")+"</td><td><span class='rpill "+(u.role==="teacher"?"rpt":"rps")+"'>"+u.role+"</span></td><td><button class='tbtn' onclick=\"editU('"+u.id+"','"+u.name+"')\">E</button><button class='tbtn danger' onclick=\"delU('"+u.id+"')\">D</button></td></tr>").join("")+"</tbody></table>";}
function devMode(on){$("adsub").textContent=on?"Dev mode":"Golden Eye Vidyapeeth";}
function openCM(){$("cmname").value="";$("cmerr").classList.add("hidden");openModal("modal-class");}
async function submitClass(){var name=$("cmname").value.trim(),err=$("cmerr");err.classList.add("hidden");if(!name){err.textContent="Enter name.";err.classList.remove("hidden");return;}var d=await post("/api/classes",{name});if(!d.success){err.textContent=d.error;err.classList.remove("hidden");return;}closeAll();loadAdmin();buildSB();}
async function openUM(){$("umname").value="";$("umemail").value="";$("umerr").classList.add("hidden");var cl=await get("/api/classes");$("umclass").innerHTML=cl.length?cl.map(c=>"<option value='"+c.id+"'>"+c.name+"</option>").join(""):"<option value=''>No classes</option>";updateUserModal($("umrole").value);openModal("modal-user");}
async function submitUser(){var name=$("umname").value.trim(),email=$("umemail").value.trim(),role=$("umrole").value,class_id=$("umclass").value,err=$("umerr");err.classList.add("hidden");if(!name||!email){err.textContent="Fill all fields.";err.classList.remove("hidden");return;}if(!class_id){err.textContent="Add a class first.";err.classList.remove("hidden");return;}var userObj=role==="teacher"?{name,email,role,class_id}:{name,enrollment:email,role,class_id};var d=await post("/api/users",{action:"add",user:userObj});if(!d.success){err.textContent=d.error;err.classList.remove("hidden");return;}closeAll();loadAdmin();buildSB();showAchievement(name,role,d.generatedPassword||"welcome123");}
async function delU(id){if(!confirm("Remove?"))return;await post("/api/users",{action:"remove",user:{id}});loadUTable();buildAStats();}
async function editU(id,name){var n=prompt("Edit name:",name);if(!n)return;await post("/api/users",{action:"edit",user:{id,name:n}});loadUTable();}

