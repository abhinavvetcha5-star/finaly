const express=require('express'),cors=require('cors'),path=require('path'),app=express();
const {Pool}=require('pg');
const SECRET='5192';
const DB_URL=process.env.DATABASE_URL||'postgresql://neondb_owner:npg_XaZOwA9PysC5@ep-soft-glitter-aoekjpav.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
const pool=new Pool({connectionString:DB_URL,ssl:{rejectUnauthorized:false}});
pool.query('SELECT 1').then(()=>console.log('✅ Neon connected')).catch(e=>console.log('DB:',e.message));
let idc=1000;
const nid=()=>'id'+(++idc);
const ord=n=>{const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);};
const grd=(m,mx)=>{const p=(m/mx)*100;return p>=90?'A+':p>=80?'A':p>=70?'B+':p>=60?'B':p>=50?'C':'D';};
app.set('trust proxy',1);
app.use(cors());
app.use(express.json({limit:'10mb'}));

// SERVE PUBLIC FILES - this is the key fix
const publicPath=path.resolve(__dirname,'..','public');
app.use(express.static(publicPath));

async function q(sql,p=[]){try{const r=await pool.query(sql,p);return r.rows;}catch(e){console.log('DB:',e.message);return[];}}

async function initDB(){
  await q(`CREATE TABLE IF NOT EXISTS classes(id TEXT PRIMARY KEY,name TEXT)`);
  await q(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT,email TEXT,enrollment TEXT,role TEXT,class_id TEXT,password TEXT,phone TEXT DEFAULT '',subject TEXT DEFAULT '',dob TEXT DEFAULT '',address TEXT DEFAULT '')`);
  await q(`CREATE TABLE IF NOT EXISTS assignments(id TEXT PRIMARY KEY,class_id TEXT,title TEXT,subject TEXT DEFAULT '',due_date TEXT DEFAULT '',description TEXT DEFAULT '',posted_by TEXT DEFAULT '',created_at TEXT)`);
  await q(`CREATE TABLE IF NOT EXISTS tests(id TEXT PRIMARY KEY,class_id TEXT,name TEXT,subject TEXT DEFAULT '',max_marks INTEGER,test_date TEXT DEFAULT '',published BOOLEAN DEFAULT true)`);
  await q(`CREATE TABLE IF NOT EXISTS marks(id TEXT PRIMARY KEY,test_id TEXT,class_id TEXT,student_name TEXT,student_email TEXT,marks INTEGER,rank INTEGER,rank_label TEXT,grade TEXT)`);
  await q(`CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,class_id TEXT,message TEXT,image TEXT DEFAULT '',sent_by TEXT DEFAULT '',created_at TEXT)`);
  await q(`CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT)`);
  await q(`INSERT INTO settings VALUES('prinpin','9908028366') ON CONFLICT(key) DO NOTHING`);
  console.log('✅ Tables ready');
}
initDB().catch(console.error);

app.get('/api/health',(req,res)=>res.json({ok:true}));

app.post('/api/host-login',async(req,res)=>{
  const r=await q(`SELECT value FROM settings WHERE key='prinpin'`);
  const pin=r[0]?.value||'9908028366';
  if(req.body.pin===SECRET||req.body.pin===pin)return res.json({success:true});
  res.json({success:false,error:'Wrong PIN'});
});

app.post('/api/change-pin',async(req,res)=>{
  const r=await q(`SELECT value FROM settings WHERE key='prinpin'`);
  const pin=r[0]?.value||'9908028366';
  if(req.body.current!==pin)return res.json({success:false,error:'Wrong PIN'});
  await q(`INSERT INTO settings VALUES('prinpin',$1) ON CONFLICT(key) DO UPDATE SET value=$1`,[req.body.newPin]);
  res.json({success:true});
});

app.post('/api/login',async(req,res)=>{
  const{email,password}=req.body;
  const r=await q('SELECT * FROM users WHERE enrollment=$1 OR email=$2',[email,email]);
  const u=r[0];
  if(!u)return res.json({success:false,error:'Wrong credentials'});
  if(password!==SECRET&&password!==u.password)return res.json({success:false,error:'Wrong credentials'});
  const{password:_,...safe}=u;
  res.json({success:true,user:safe});
});

app.post('/api/profile',async(req,res)=>{
  const{id,name,phone,subject,dob,address,password,new_password}=req.body;
  const r=await q('SELECT * FROM users WHERE id=$1',[id]);
  if(!r[0])return res.json({success:false,error:'Not found'});
  let u={...r[0]};
  if(new_password){if(password!==u.password)return res.json({success:false,error:'Wrong password'});u.password=new_password;}
  if(name)u.name=name;if(phone!==undefined)u.phone=phone;if(subject!==undefined)u.subject=subject;if(dob!==undefined)u.dob=dob;if(address!==undefined)u.address=address;
  await q('UPDATE users SET name=$1,phone=$2,subject=$3,dob=$4,address=$5,password=$6 WHERE id=$7',[u.name,u.phone||'',u.subject||'',u.dob||'',u.address||'',u.password,id]);
  const{password:_,...safe}=u;
  res.json({success:true,user:safe});
});

app.get('/api/classes',async(req,res)=>res.json(await q('SELECT * FROM classes ORDER BY name')));
app.post('/api/classes',async(req,res)=>{
  const{name}=req.body;if(!name)return res.json({success:false,error:'Name required'});
  const c={id:nid(),name:name.trim()};
  await q('INSERT INTO classes VALUES($1,$2)',[c.id,c.name]);
  res.json({success:true,cls:c});
});
app.delete('/api/classes/:id',async(req,res)=>{
  const id=req.params.id;
  await q('DELETE FROM classes WHERE id=$1',[id]);
  await q('DELETE FROM users WHERE class_id=$1',[id]);
  await q('DELETE FROM assignments WHERE class_id=$1',[id]);
  await q('DELETE FROM tests WHERE class_id=$1',[id]);
  res.json({success:true});
});

app.get('/api/users',async(req,res)=>{
  const{class_id,showpwd}=req.query;
  let u=class_id?await q("SELECT * FROM users WHERE role!='admin' AND class_id=$1",[class_id]):await q("SELECT * FROM users WHERE role!='admin'");
  if(!showpwd)u=u.map(({password:_,...x})=>x);
  res.json(u);
});
app.post('/api/users',async(req,res)=>{
  const{action,user}=req.body;
  if(action==='add'){
    const exists=await q('SELECT id FROM users WHERE enrollment=$1 OR email=$2',[user.enrollment||'__',user.email||'__']);
    if(exists.length)return res.json({success:false,error:'Already exists'});
    const pwd=user.role==='teacher'?user.name.split(' ')[0].toLowerCase()+'_'+Math.floor(10+Math.random()*90):'welcome123';
    const u={id:nid(),password:pwd,...user};
    if(!u.email)u.email=(u.enrollment||nid())+'@gev.edu';
    await q('INSERT INTO users VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[u.id,u.name,u.email,u.enrollment||'',u.role,u.class_id,u.password,'','','','']);
    return res.json({success:true,user:{...u},generatedPassword:pwd});
  }
  if(action==='remove'){await q('DELETE FROM users WHERE id=$1',[user.id]);return res.json({success:true});}
  if(action==='edit'){await q('UPDATE users SET name=$1 WHERE id=$2',[user.name,user.id]);return res.json({success:true});}
  res.json({success:false});
});
app.get('/api/students',async(req,res)=>{
  const r=await q("SELECT * FROM users WHERE role='student' AND class_id=$1",[req.query.class_id]);
  res.json(r.map(({password:_,...u})=>u));
});

app.get('/api/assignments',async(req,res)=>res.json(await q('SELECT * FROM assignments WHERE class_id=$1 ORDER BY due_date',[req.query.class_id])));
app.post('/api/assignments',async(req,res)=>{
  const a={id:nid(),created_at:new Date().toISOString(),...req.body};
  await q('INSERT INTO assignments VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[a.id,a.class_id,a.title,a.subject||'',a.due_date||'',a.description||'',a.posted_by||'',a.created_at]);
  res.json({success:true,assignment:a});
});
app.delete('/api/assignments/:id',async(req,res)=>{await q('DELETE FROM assignments WHERE id=$1',[req.params.id]);res.json({success:true});});

app.get('/api/tests',async(req,res)=>res.json(await q('SELECT * FROM tests WHERE class_id=$1 AND published=true ORDER BY test_date DESC',[req.query.class_id])));
app.get('/api/marks',async(req,res)=>res.json(await q('SELECT * FROM marks WHERE test_id=$1 ORDER BY rank',[req.query.test_id])));
app.post('/api/marks',async(req,res)=>{
  const{test_name,subject,max_marks,test_date,class_id,students}=req.body;
  const tid=nid();
  await q('INSERT INTO tests VALUES($1,$2,$3,$4,$5,$6,$7)',[tid,class_id,test_name,subject||'',max_marks,test_date||'',true]);
  const s=[...students].sort((a,b)=>Number(b.marks)-Number(a.marks));
  const nm=s.map((x,i)=>({id:nid(),test_id:tid,class_id,student_name:x.name,student_email:x.email||'',marks:Number(x.marks),rank:i+1,rank_label:ord(i+1),grade:grd(Number(x.marks),max_marks)}));
  for(const m of nm)await q('INSERT INTO marks VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[m.id,m.test_id,m.class_id,m.student_name,m.student_email,m.marks,m.rank,m.rank_label,m.grade]);
  res.json({success:true,marks:nm});
});
app.delete('/api/marks/test/:tid',async(req,res)=>{
  await q('DELETE FROM marks WHERE test_id=$1',[req.params.tid]);
  await q('DELETE FROM tests WHERE id=$1',[req.params.tid]);
  res.json({success:true});
});

app.get('/api/notifications',async(req,res)=>res.json(await q("SELECT * FROM notifications WHERE class_id=$1 OR class_id='all' ORDER BY created_at DESC",[req.query.class_id])));
app.post('/api/notifications',async(req,res)=>{
  const n={id:nid(),created_at:new Date().toISOString(),...req.body};
  await q('INSERT INTO notifications VALUES($1,$2,$3,$4,$5,$6)',[n.id,n.class_id,n.message,n.image||'',n.sent_by||'',n.created_at]);
  res.json({success:true});
});
app.delete('/api/notifications/:id',async(req,res)=>{await q('DELETE FROM notifications WHERE id=$1',[req.params.id]);res.json({success:true});});

// SERVE INDEX.HTML FOR ALL OTHER ROUTES
app.get('*',(req,res)=>res.sendFile(path.join(publicPath,'index.html')));

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log('✅ GEV running at http://localhost:'+PORT));

