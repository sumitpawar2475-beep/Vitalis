// Configure these with the Project URL and publishable (anon) key from your Supabase project.
const SUPABASE_URL = 'https://eqsqbjqemjxsaixmffqf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_I7A_OzeOZq-LRAbdB0U2EA_ok3rK2eO';
const supabaseClient = window.supabase && !SUPABASE_URL.includes('YOUR_PROJECT_ID') && !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE')
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
const defaultState={ user:null, profile:null, ageStyle:'adults', units:'metric', lang:'en', theme:'light', hydration:{ consumed:0, goal:2300, glasses:[false,false,false,false,false,false,false,false], scheduleDone:{} }, reduceMotion:false, reminders:false, servings:2, prepStyle:'standard', workoutLogs:[], streakMap:{}, profilePic:null, profilePicTemp:null };
function freshState(user=null){ return {...defaultState,user,hydration:{...defaultState.hydration,glasses:[...defaultState.hydration.glasses],scheduleDone:{}},workoutLogs:[],streakMap:{}}; }
let state=freshState();
let currentUserId=null, loadingAccountId=null, loadingAccountPromise=null, cloudSaveTimer=null, cloudSaveQueue=Promise.resolve();
let passwordRecoveryActive=false;
let authMode='signin', currentStep=1, currentMealDay=0, mealData=[], chartInstance=null, burnChartInstance=null, timerInterval=null, timerSeconds=1200, timerRunning=false, currentRecipe=null, currentAudio=null, currentTrackIdx=-1, musicProgressInt=null;

let demoProfiles={
kids:{name:'Aanya', age:9, sex:'female', height:132, weight:29, activity:'light', climate:'moderate', diet:'vegetarian', allergies:[], budget:'low', cuisine:'indian', sleep:9.5, goal:'balanced', health:'', meds:''},
teens:{name:'Arjun', age:16, sex:'male', height:171, weight:62, activity:'moderate', climate:'hot', diet:'nonveg', allergies:['peanut'], budget:'medium', cuisine:'mixed', sleep:8, goal:'muscle', health:'', meds:''},
adults:{name:'Priya', age:34, sex:'female', height:165, weight:60, activity:'light', climate:'moderate', diet:'vegetarian', allergies:[], budget:'medium', cuisine:'indian', sleep:7.5, goal:'balanced', health:'', meds:''},
seniors:{name:'Ramesh', age:68, sex:'male', height:168, weight:70, activity:'light', climate:'hot', diet:'vegetarian', allergies:['dairy'], budget:'medium', cuisine:'indian', sleep:7, goal:'light', health:'Prefers low salt', meds:''}
};

const i18n={
en:{dashboard:'Dashboard',hydration:'Hydration',meals:'Meal Plan',workout:'Workout',settings:'Settings',hello:'Hello'},
hi:{dashboard:'डैशबोर्ड',hydration:'हाइड्रेशन',meals:'भोजन योजना',workout:'वर्कआउट',settings:'सेटिंग्स',hello:'नमस्ते'}
};

const mealPool={
breakfast:[
{name:'Vegetable poha with peanuts & curd',cal:380,tags:['peanut'],diet:['omnivore','vegetarian','nonveg'],budget:'low',time:15,diff:'Easy',icon:'🍚',ingredients:[{item:'Flattened rice (poha)',qty:80,unit:'g'},{item:'Peanuts',qty:15,unit:'g'},{item:'Onion, potato, peas',qty:100,unit:'g'},{item:'Curd',qty:100,unit:'g'},{item:'Lemon & coriander',qty:1,unit:'tsp'}],steps:['Rinse poha gently, drain 5 min','Sauté onion-potato-peas with turmeric & salt','Toss poha, peanuts, lemon','Serve with curd'],tip:'Skip peanuts if allergic — use roasted chana instead.'},
{name:'Besan chilla (2) + mint chutney',cal:340,tags:[],diet:['vegan','vegetarian','omnivore','nonveg'],budget:'low',time:20,diff:'Easy',icon:'🥞',ingredients:[{item:'Besan (gram flour)',qty:60,unit:'g'},{item:'Onion, tomato, coriander',qty:80,unit:'g'},{item:'Mint chutney',qty:30,unit:'g'},{item:'Oil',qty:10,unit:'ml'}],steps:['Mix besan, water, chopped veg to batter','Spread thin on hot tawa with little oil','Cook both sides till golden','Serve with mint chutney'],tip:'Add ajwain for digestion; keep batter not too thick.'},
{name:'Oats idli (3) + sambar',cal:360,tags:[],diet:['vegan','vegetarian','omnivore','nonveg'],budget:'medium',time:25,diff:'Medium',icon:'🍘',ingredients:[{item:'Oats + semolina',qty:60,unit:'g'},{item:'Curd',qty:50,unit:'g'},{item:'Sambar (dal & veg)',qty:150,unit:'ml'},{item:'Mustard, curry leaves',qty:1,unit:'tsp'}],steps:['Roast oats & semolina lightly','Mix with curd, rest 10 min, steam 12 min','Heat sambar, temper with mustard','Serve idli with sambar'],tip:'Batch-steam idli and freeze — re-steam 3 min.'},
{name:'Eggs (2) bhurji + whole wheat toast',cal:420,tags:['egg','gluten'],diet:['omnivore','nonveg'],budget:'medium',time:15,diff:'Easy',icon:'🍳',ingredients:[{item:'Eggs',qty:2,unit:'pcs'},{item:'Onion, tomato, green chilli',qty:80,unit:'g'},{item:'Whole wheat bread',qty:2,unit:'slices'},{item:'Oil & spices',qty:10,unit:'ml'}],steps:['Sauté onion-tomato till soft','Add whisked eggs, scramble soft','Toast bread lightly','Serve bhurji with toast'],tip:'For seniors/kids, cook eggs fully and lower chilli.'},
{name:'Chicken keema paratha (1) + curd',cal:460,tags:['gluten','dairy'],diet:['omnivore','nonveg'],budget:'medium',time:25,diff:'Medium',icon:'🍗',ingredients:[{item:'Chicken keema',qty:80,unit:'g'},{item:'Whole wheat atta',qty:60,unit:'g'},{item:'Onion, ginger, spices',qty:50,unit:'g'},{item:'Curd',qty:80,unit:'g'}],steps:['Cook keema with onion-masala till dry','Stuff in atta, roll paratha','Roast with little oil both sides','Serve with curd'],tip:'Non-veg protein boost — use lean keema, drain excess oil.'}
],
lunch:[
{name:'Dal, jeera rice, bhindi & curd',cal:540,tags:['dairy'],diet:['vegetarian','omnivore','nonveg'],budget:'low',time:25,diff:'Easy',icon:'🍛',ingredients:[{item:'Toor dal',qty:60,unit:'g'},{item:'Rice',qty:80,unit:'g'},{item:'Bhindi (okra)',qty:100,unit:'g'},{item:'Curd',qty:80,unit:'g'},{item:'Cumin, turmeric, salt',qty:1,unit:'tsp'}],steps:['Cook dal with turmeric till soft, temper with cumin','Cook jeera rice (rice + cumin)','Sauté bhindi with salt till tender','Serve dal-rice-bhindi with curd'],tip:'Soak dal 20 min for quicker cooking. Wipe bhindi dry to avoid stickiness.'},
{name:'Rajma chawal + kachumber',cal:580,tags:[],diet:['vegan','vegetarian','omnivore','nonveg'],budget:'low',time:30,diff:'Medium',icon:'🍲',ingredients:[{item:'Rajma (kidney beans)',qty:60,unit:'g dry'},{item:'Rice',qty:80,unit:'g'},{item:'Onion-tomato gravy',qty:120,unit:'g'},{item:'Cucumber-onion salad',qty:80,unit:'g'}],steps:['Soak rajma 6h, pressure cook 4 whistles','Make onion-tomato gravy, simmer with rajma','Cook rice','Serve with kachumber'],tip:'Cook rajma a day ahead — saves 20 min on weekday.'},
{name:'Grilled fish + millet roti & salad',cal:520,tags:['shellfish'],diet:['pescatarian','omnivore','nonveg'],budget:'high',time:22,diff:'Medium',icon:'🐟',ingredients:[{item:'Fish fillet',qty:120,unit:'g'},{item:'Millet flour (jowar/bajra)',qty:60,unit:'g'},{item:'Lemon, garlic, herbs',qty:1,unit:'tsp'},{item:'Green salad',qty:100,unit:'g'}],steps:['Marinate fish 10 min with lemon-garlic','Grill 4 min each side','Roll & roast millet roti','Serve with salad'],tip:'If no grill, pan-sear with little oil on medium heat.'},
{name:'Chicken curry (home-style) + rice + salad',cal:620,tags:['nonveg'],diet:['omnivore','nonveg'],budget:'medium',time:30,diff:'Medium',icon:'🍗',ingredients:[{item:'Chicken (bone/leg)',qty:120,unit:'g'},{item:'Rice',qty:80,unit:'g'},{item:'Onion-tomato masala',qty:120,unit:'g'},{item:'Salad',qty:80,unit:'g'}],steps:['Marinate chicken with haldi, salt 10 min','Cook onion-tomato masala, add chicken & simmer 15 min','Cook rice','Serve with salad & lemon'],tip:'Non-veg day: keep gravy light, less oil — protein ~32g.'},
{name:'Sambar rice + poriyal',cal:530,tags:[],diet:['vegan','vegetarian','omnivore','nonveg'],budget:'medium',time:28,diff:'Medium',icon:'🥘',ingredients:[{item:'Rice + toor dal',qty:80,unit:'g'},{item:'Sambar powder & tamarind',qty:1,unit:'tsp'},{item:'Mixed veg (beans, carrot)',qty:120,unit:'g'},{item:'Coconut (optional)',qty:15,unit:'g'}],steps:['Cook rice-dal together soft','Add tamarind, sambar powder, veg & simmer','Make poriyal: stir-fry veg with coconut','Mix or serve side by side'],tip:'One-pot sambar rice saves time and utensils.'}
],
dinner:[
{name:'Khichdi + papad & pickle (small)',cal:480,tags:[],diet:['vegan','vegetarian','omnivore','nonveg'],budget:'low',time:20,diff:'Easy',icon:'🍚',ingredients:[{item:'Rice + moong dal (1:1)',qty:80,unit:'g'},{item:'Ghee/oil',qty:10,unit:'ml'},{item:'Papad',qty:1,unit:'pc'},{item:'Pickle',qty:10,unit:'g'}],steps:['Rinse rice-dal, pressure cook 3 whistles with turmeric','Temper with cumin & ghee','Roast papad','Serve khichdi with papad & pickle'],tip:'Soft khichdi is gentle for kids & seniors — add extra water if needed.'},
{name:'2 Roti + dal + mixed veg',cal:500,tags:['gluten'],diet:['vegan','vegetarian','omnivore','nonveg'],budget:'low',time:25,diff:'Easy',icon:'🫓',ingredients:[{item:'Whole wheat atta',qty:60,unit:'g'},{item:'Dal (any)',qty:60,unit:'g'},{item:'Mixed seasonal veg',qty:120,unit:'g'},{item:'Oil',qty:10,unit:'ml'}],steps:['Cook dal, temper','Stir-fry mixed veg','Knead atta, roll & roast roti','Serve together'],tip:'Knead atta 10 min ahead — softer rotis.'},
{name:'Egg curry (2 eggs) + rice',cal:560,tags:['egg','nonveg'],diet:['omnivore','nonveg'],budget:'low',time:22,diff:'Easy',icon:'🍳',ingredients:[{item:'Eggs boiled',qty:2,unit:'pcs'},{item:'Onion-tomato gravy',qty:120,unit:'g'},{item:'Rice',qty:80,unit:'g'},{item:'Coriander',qty:1,unit:'tsp'}],steps:['Boil eggs 9 min, peel & slit','Make light onion-tomato gravy','Simmer eggs 5 min','Serve with rice'],tip:'Budget non-veg protein — keep gravy light for dinner.'},
{name:'Millet khichdi + curd',cal:470,tags:['dairy'],diet:['vegetarian','omnivore','nonveg'],budget:'medium',time:22,diff:'Easy',icon:'🥣',ingredients:[{item:'Millet (ragi/bajra) + dal',qty:80,unit:'g'},{item:'Veg (peas, carrot)',qty:80,unit:'g'},{item:'Curd',qty:80,unit:'g'},{item:'Cumin',qty:1,unit:'tsp'}],steps:['Roast millet lightly','Cook millet-dal with veg 15 min','Temper with cumin','Serve with curd'],tip:'Millets keep you full longer — good for balanced goal.'},
{name:'Stir-fried tofu & veggies + rice',cal:510,tags:['soy'],diet:['vegan','vegetarian','omnivore','nonveg'],budget:'medium',time:18,diff:'Easy',icon:'🍜',ingredients:[{item:'Tofu',qty:100,unit:'g'},{item:'Bell peppers, broccoli',qty:120,unit:'g'},{item:'Soy-ginger sauce',qty:15,unit:'ml'},{item:'Rice',qty:70,unit:'g'}],steps:['Press tofu 5 min, cube & sear golden','Stir-fry veg crisp-tender','Toss with sauce & tofu','Serve over rice'],tip:'Quick mode: use frozen mixed veg — no chopping.'}
],
snack:[
{name:'Roasted chana + fruit',cal:180,tags:[],diet:['vegan','vegetarian','omnivore','nonveg'],budget:'low',time:5,diff:'Easy',icon:'🍎',ingredients:[{item:'Roasted chana',qty:30,unit:'g'},{item:'Seasonal fruit (apple/banana)',qty:120,unit:'g'}],steps:['Portion chana','Wash & cut fruit','Combine — no cooking needed'],tip:'Great lunchbox snack for kids — add small curd cup.'},
{name:'Sprouts chaat',cal:200,tags:[],diet:['vegan','vegetarian','omnivore','nonveg'],budget:'low',time:10,diff:'Easy',icon:'🥗',ingredients:[{item:'Mixed sprouts',qty:80,unit:'g'},{item:'Onion, tomato, lemon',qty:50,unit:'g'},{item:'Chaat masala',qty:1,unit:'tsp'}],steps:['Blanch sprouts 3 min, drain','Mix with onion-tomato, lemon & chaat masala','Top with coriander'],tip:'Sprout at home: soak moong 8h, sprout 12h in colander.'},
{name:'Boiled egg (1) + peanuts (small)',cal:190,tags:['egg','peanut','nonveg'],diet:['omnivore','nonveg'],budget:'low',time:10,diff:'Easy',icon:'🥚',ingredients:[{item:'Egg',qty:1,unit:'pc'},{item:'Roasted peanuts',qty:15,unit:'g'},{item:'Salt & pepper',qty:1,unit:'tsp'}],steps:['Boil egg 9 min, cool & peel','Portion peanuts','Season & serve'],tip:'Non-veg evening snack — high protein, keeps you full.'},
{name:'Yogurt & berries',cal:160,tags:['dairy'],diet:['vegetarian','omnivore','nonveg'],budget:'medium',time:3,diff:'Easy',icon:'🫐',ingredients:[{item:'Curd/yogurt',qty:120,unit:'g'},{item:'Berries / pomegranate',qty:60,unit:'g'},{item:'Honey (optional)',qty:5,unit:'ml'}],steps:['Spoon yogurt into bowl','Top with berries','Drizzle honey if liked'],tip:'Use hung curd for thicker, creamy texture.'}
]
};

const musicByAge={
kids:{label:'Kids • Playful & happy',tracks:[
{title:'Sunshine Dance Party',artist:'Toon Tunes • Kids Pop',dur:'2:45',mood:'Dance / Warm-up',color:'from-amber-400 to-pink-400',audio:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'},
{title:'Jungle Jump Adventure',artist:'Playtime Crew',dur:'2:10',mood:'Jumping jacks',color:'from-emerald-400 to-teal-500',audio:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'},
{title:'Rainbow Run',artist:'Little Athletes',dur:'3:05',mood:'Running game',color:'from-sky-400 to-violet-500',audio:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'},
{title:'Animal Walk Parade',artist:'Giggle Beats',dur:'2:30',mood:'Cool-down fun',color:'from-orange-400 to-rose-400',audio:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3'}]},
teens:{label:'Teens • Bold & energetic',tracks:[
{title:'Neon Rush (HIIT Mix)',artist:'Volt • 140 BPM',dur:'3:12',mood:'HIIT / Skipping',color:'from-violet-600 to-fuchsia-500',audio:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3'},
{title:'Midnight Drive Energy',artist:'Synth Squad',dur:'2:58',mood:'Squats & lunges',color:'from-slate-900 to-violet-700',audio:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3'},
{title:'Baseline Push',artist:'Urban Pulse',dur:'3:20',mood:'Push-ups / Plank',color:'from-coral to-amber-400',audio:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3'},
{title:'Chill Focus Flow',artist:'LoFi Teens',dur:'2:40',mood:'Stretch / Cool-down',color:'from-teal to-sky-500',audio:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3'}]},
adults:{label:'Adults • Focus & steady energy',tracks:[
{title:'Morning Momentum',artist:'Focus Beats • 120 BPM',dur:'3:30',mood:'Brisk walk / Warm-up',color:'from-teal to-emerald-600',audio:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3'},
{title:'Deep Work Cardio',artist:'Aero Mind',dur:'4:05',mood:'Jog / Cycle',color:'from-slate-800 to-teal',audio:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3'},
{title:'Strength & Soul',artist:'Urban Calm',dur:'3:15',mood:'Strength circuit',color:'from-amber-500 to-orange-600',audio:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3'},
{title:'Evening Unwind Acoustic',artist:'Calm Strings',dur:'3:45',mood:'Yoga / Stretch',color:'from-indigo-500 to-teal',audio:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'}]},
seniors:{label:'Seniors • Gentle & uplifting',tracks:[
{title:'Morning Raga Walk',artist:'Classical Calm • Flute',dur:'4:20',mood:'Morning walk',color:'from-amber-400 to-orange-500',audio:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'},
{title:'Golden Oldies Stroll',artist:'Retro Warmth',dur:'3:10',mood:'Chair exercises',color:'from-yellow-500 to-amber-600',audio:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'},
{title:'Bhajan Bliss (Soft)',artist:'Peaceful Morning',dur:'5:00',mood:'Breathing / Yoga',color:'from-orange-400 to-rose-400',audio:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3'},
{title:'Evening Serenity Piano',artist:'Gentle Keys',dur:'3:50',mood:'Cool-down',color:'from-sky-500 to-teal',audio:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3'}]}
};

function save(){
 if(!currentUserId||!supabaseClient) return;
 clearTimeout(cloudSaveTimer); const ownerId=currentUserId; const snapshot=JSON.parse(JSON.stringify(state));
 cloudSaveTimer=setTimeout(()=>{ cloudSaveTimer=null; queueCloudSave(ownerId,snapshot); },650);
}
function queueCloudSave(ownerId,snapshot){
 cloudSaveQueue=cloudSaveQueue.then(async()=>{
  if(currentUserId!==ownerId) return;
  try { const {error}=await supabaseClient.from('user_app_state').upsert({user_id:ownerId,state:snapshot,updated_at:new Date().toISOString()},{onConflict:'user_id'}); if(error) throw error; }
  catch(error){ console.error('VITALIS account sync failed:',error); showToast('Could not sync your latest change. Check your connection and try again.'); }
 });
 return cloudSaveQueue;
}
async function flushCloudSave(){ if(cloudSaveTimer){ clearTimeout(cloudSaveTimer); cloudSaveTimer=null; if(currentUserId) await queueCloudSave(currentUserId,JSON.parse(JSON.stringify(state))); } await cloudSaveQueue; }
function showAuthStatus(message,isError=false){ const el=document.getElementById('authStatus'); if(!el) return; el.textContent=message; el.classList.remove('hidden','bg-teal-50','border-teal/20','text-teal-dark','bg-rose-50','border-rose-200','text-rose-700'); el.classList.add(isError?'bg-rose-50':'bg-teal-50',isError?'border-rose-200':'border-teal/20',isError?'text-rose-700':'text-teal-dark'); }
function showSignedOut(){ clearTimeout(cloudSaveTimer); cloudSaveTimer=null; currentUserId=null; loadingAccountId=null; loadingAccountPromise=null; state=freshState(); document.getElementById('app').classList.add('hidden'); document.getElementById('profileSetup').classList.add('hidden'); document.getElementById('loginScreen').classList.remove('hidden'); const pwd=document.getElementById('authPwd'); if(pwd) pwd.value=''; applyTheme(false); }
async function loadAccount(session){
 const user=session?.user; if(!user||!supabaseClient) return;
 if(currentUserId===user.id) return;
 if(loadingAccountId===user.id&&loadingAccountPromise) return loadingAccountPromise;
 loadingAccountId=user.id;
 loadingAccountPromise=(async()=>{
  const {data,error}=await supabaseClient.from('user_app_state').select('state').eq('user_id',user.id).maybeSingle();
  if(error) throw error; if(loadingAccountId!==user.id) return;
  const saved=data?.state||{};
  state={...freshState({id:user.id,email:user.email}),...saved,user:{id:user.id,email:user.email},hydration:{...defaultState.hydration,...(saved.hydration||{}),scheduleDone:{...(saved.hydration?.scheduleDone||{})}},workoutLogs:Array.isArray(saved.workoutLogs)?saved.workoutLogs:[],streakMap:saved.streakMap||{}};
  currentUserId=user.id; loadingAccountId=null; loadingAccountPromise=null;
  applyAgeStyle(state.ageStyle); applyTheme(false); setUnits(state.units,false); generateMeals(); renderAll(); applyLang();
  if(state.profile) showApp(true); else showProfileSetup();
  if(!data) save();
 })();
 return loadingAccountPromise;
}
async function signOut(){ if(!supabaseClient){showAuthStatus('Connect this website to Supabase before signing in.',true);return;} try{await flushCloudSave();const {error}=await supabaseClient.auth.signOut();if(error)throw error;showSignedOut();showToast('You have been signed out.');}catch(error){console.error(error);showToast('Could not sign out. Please try again.');} }
function todayStr(offset=0){ const d=new Date(); d.setDate(d.getDate()+offset); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); }
function seedStreak(){}

document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushCloudSave();});
document.addEventListener('DOMContentLoaded', async()=>{
 lucide.createIcons(); applyAgeStyle(state.ageStyle); applyTheme(false); setUnits(state.units,false);
 document.getElementById('customMl').addEventListener('input', e=>{ document.getElementById('customMlLabel').textContent=e.target.value+' ml'; });
 document.getElementById('waterTargetRange').addEventListener('input', e=>{ document.getElementById('waterTargetLabel').textContent=e.target.value+' ml'; state.hydration.goal=parseInt(e.target.value); save(); renderHydration(); renderDashboard(); });
 document.getElementById('bmiToolH').addEventListener('input', updateBmiTool); document.getElementById('bmiToolW').addEventListener('input', updateBmiTool);
 document.getElementById('reduceMotion').checked=state.reduceMotion||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 document.getElementById('waterTargetRange').value=state.hydration.goal; generateMeals(); renderAll(); updateAutoAvatarLive(); applyLang();
 if(!supabaseClient){ showAuthStatus('Account sign-in is not configured yet. Add your Supabase Project URL and publishable key, then run docs/SUPABASE_SETUP.md.',true); return; }
 supabaseClient.auth.onAuthStateChange((event,session)=>{ setTimeout(()=>{ if(event==='PASSWORD_RECOVERY'){showPasswordRecovery();return;} if(session) loadAccount(session).catch(error=>{console.error(error);showAuthStatus('Could not load your saved account data. Check the database setup or browser console.',true);}); else if(event==='SIGNED_OUT') showSignedOut(); },0); });
 const {data,error}=await supabaseClient.auth.getSession();
 if(error){ showAuthStatus('Could not connect to authentication. Check your Supabase configuration.',true); return; }
 if(data.session&&!passwordRecoveryActive) await loadAccount(data.session).catch(error=>{console.error(error);showAuthStatus('Could not load your saved account data. Check the database setup or browser console.',true);});
});
/* THEME - FIXED DARK MODE */
function applyTheme(icons=true){
const dark=state.theme==='dark';
document.body.classList.toggle('dark-active', dark);
const btn=document.getElementById('themeBtn');
if(btn) btn.innerHTML= dark ? '<i data-lucide="sun" class="w-4 h-4"></i>' : '<i data-lucide="moon" class="w-4 h-4"></i>';
const lbl=document.getElementById('themeLabel'); if(lbl) lbl.textContent= dark ? 'Dark' : 'Light';
if(icons) lucide.createIcons();
if(chartInstance) drawMacroChart();
if(burnChartInstance) drawBurnChart();
}
function toggleTheme(){ state.theme=state.theme==='light'?'dark':'light'; save(); applyTheme(); showToast(state.theme==='dark'?'🌙 Dark mode ON — fully adapted':'☀️ Light mode ON'); }

/* LANG - EN + HI ONLY, EN DEFAULT */
function setLang(l){ if(l!=='en'&&l!=='hi') l='en'; state.lang=l; save(); const s1=document.getElementById('langSelect'); if(s1) s1.value=l; const s2=document.getElementById('langSelect2'); if(s2) s2.value=l; applyLang(); showToast(l==='hi'?'भाषा: हिन्दी (English default)':'Language: English'); }
function applyLang(){
const d=i18n[state.lang]||i18n.en;
document.querySelectorAll('[data-i18n]').forEach(el=>{ const k=el.getAttribute('data-i18n'); if(d[k]) el.textContent=d[k]; });
renderDashboard();
}

/* AUTH */
function switchAuthTab(m){ authMode=m; document.getElementById('tabSignin').className=m==='signin'?'py-2.5 rounded-full bg-[#0F766E] text-white font-semibold text-sm shadow':'py-2.5 rounded-full text-slate-600 font-semibold text-sm'; document.getElementById('tabCreate').className=m==='create'?'py-2.5 rounded-full bg-[#0F766E] text-white font-semibold text-sm shadow':'py-2.5 rounded-full text-slate-600 font-semibold text-sm'; document.getElementById('authSubmitText').textContent=m==='create'?'Create account':'Sign in'; document.getElementById('authPwd').autocomplete=m==='create'?'new-password':'current-password'; document.getElementById('authStatus').classList.add('hidden'); }
function togglePwd(){ const inp=document.getElementById('authPwd'); const isText=inp.type==='text'; inp.type=isText?'password':'text'; document.getElementById('pwdToggleText').textContent=isText?'Show':'Hide'; }
async function handleAuth(e){
 e.preventDefault(); const email=document.getElementById('authEmail').value.trim(); const password=document.getElementById('authPwd').value;
 document.getElementById('errEmail').classList.add('hidden'); document.getElementById('errPwd').classList.add('hidden');
 if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ document.getElementById('errEmail').textContent='Enter a valid email address.'; document.getElementById('errEmail').classList.remove('hidden'); return; }
 if(!password||(authMode==='create'&&password.length<8)){ document.getElementById('errPwd').textContent=authMode==='create'?'Use a password with at least 8 characters.':'Enter your password.'; document.getElementById('errPwd').classList.remove('hidden'); return; }
 if(!supabaseClient){ showAuthStatus('Account sign-in is not configured. Follow docs/SUPABASE_SETUP.md first.',true); return; }
 const submit=document.getElementById('authSubmit'); submit.disabled=true; submit.classList.add('opacity-60');
 try {
  const result=authMode==='create'
   ? await supabaseClient.auth.signUp({email,password,options:{emailRedirectTo:window.location.href.split(/[?#]/)[0]}})
   : await supabaseClient.auth.signInWithPassword({email,password});
  if(result.error) throw result.error;
  if(authMode==='create'&&!result.data.session) showAuthStatus('Account created. Check your email to verify the address, then sign in.');
  else showAuthStatus(authMode==='create'?'Account created. Complete your profile to get started.':'Signed in. Loading your saved account…');
 } catch(error){ console.error('VITALIS authentication failed:',error); showAuthStatus(error.message||'Sign-in failed. Check your email and password.',true); }
 finally { submit.disabled=false; submit.classList.remove('opacity-60'); }
}
function showPasswordRecovery(){ passwordRecoveryActive=true; document.getElementById('loginScreen').classList.remove('hidden'); document.getElementById('app').classList.add('hidden'); document.getElementById('profileSetup').classList.add('hidden'); document.getElementById('authForm').classList.add('hidden'); document.getElementById('passwordRecovery').classList.remove('hidden'); }
async function completePasswordReset(){ const password=document.getElementById('newPassword').value; const status=document.getElementById('passwordRecoveryStatus'); status.classList.remove('hidden'); if(password.length<8){status.textContent='Use at least eight characters.';status.className='rounded-xl p-3 text-xs bg-rose-50 text-rose-700';return;} try{const {error}=await supabaseClient.auth.updateUser({password});if(error)throw error;document.getElementById('passwordRecovery').classList.add('hidden');document.getElementById('authForm').classList.remove('hidden');passwordRecoveryActive=false;document.getElementById('authPwd').value='';showAuthStatus('Password updated. Sign in with your new password.');await supabaseClient.auth.signOut();}catch(error){console.error(error);status.textContent=error.message||'Could not update the password.';status.className='rounded-xl p-3 text-xs bg-rose-50 text-rose-700';} }async function sendPasswordReset(){
 const email=document.getElementById('authEmail').value.trim(); if(!email){ showAuthStatus('Enter your email address first, then choose Forgot password.',true); return; }
 if(!supabaseClient){ showAuthStatus('Password reset is unavailable until Supabase is configured.',true); return; }
 try { const {error}=await supabaseClient.auth.resetPasswordForEmail(email,{redirectTo:window.location.href}); if(error) throw error; showAuthStatus('If an account exists for that email, password reset instructions have been sent.'); }
 catch(error){ console.error(error); showAuthStatus(error.message||'Could not send password reset email.',true); }
}
/* AVATAR */
function bmiCatForWidth(bmi){ if(bmi<18.5) return 30; if(bmi<25) return 38; if(bmi<30) return 48; return 56; }
function avatarSVG(p, size=80){
const bmi=p&&p.height?p.weight/Math.pow(p.height/100,2):22;
const w=bmiCatForWidth(bmi);
const isFemale=(p?.sex||'female')==='female', isMale=(p?.sex)==='male';
const age=p?.age||30;
let hair='#1F2937'; if(age>=60) hair='#CBD5E1'; else if(age<=12) hair='#111827';
let hairShape='';
if(isFemale){ hairShape=`<ellipse cx="50" cy="30" rx="20" ry="16" fill="${hair}"/><rect x="30" y="28" width="8" height="26" rx="4" fill="${hair}"/><rect x="62" y="28" width="8" height="26" rx="4" fill="${hair}"/>`; }
else if(isMale){ hairShape=`<path d="M32 32 Q50 10 68 32 L68 26 Q50 8 32 26 Z" fill="${hair}"/>`; }
else { hairShape=`<ellipse cx="50" cy="24" rx="18" ry="10" fill="${hair}"/>`; }
const skin= isFemale ? '#FDD5B5' : '#EAB88A';
const shirt= age<=12 ? '#FF6B8A' : age>=60 ? '#0F766E' : age<20 ? '#7C3AED' : '#0F766E';
return `<svg viewBox="0 0 100 110" width="${size}" height="${size}" class="avatar-bob"><circle cx="50" cy="55" r="48" fill="${age<=12?'#FFF7ED':age>=60?'#F0FDFA':'#EFF6FF'}" stroke="#0F766E22" stroke-width="2"/>${hairShape}<circle cx="50" cy="42" r="16" fill="${skin}"/><circle cx="44" cy="42" r="2" fill="#111"/><circle cx="56" cy="42" r="2" fill="#111"/><path d="M43 49 Q50 54 57 49" stroke="#111" stroke-width="1.6" fill="none" stroke-linecap="round"/><rect x="${50-w/2}" y="62" width="${w}" height="30" rx="10" fill="${shirt}"/><text x="50" y="102" text-anchor="middle" font-size="9" font-weight="800" fill="#0F766E">${Math.round(p?.height||165)}cm • ${Math.round(p?.weight||60)}kg</text></svg>`;
}
function currentFormProfile(){
let h=parseFloat(document.getElementById('inpHeight').value)||165;
let w=parseFloat(document.getElementById('inpWeight').value)||60;
if(state.units==='imperial'){ h=h*2.54; w=w*0.453592; }
return {name:document.getElementById('inpName').value||'You', age:parseInt(document.getElementById('inpAge').value)||24, sex:document.querySelector('input[name="sex"]:checked')?.value||'female', height:h, weight:w};
}
function updateAutoAvatarLive(){
const p=currentFormProfile();
const prev=document.getElementById('autoAvatarPreview'); if(prev) prev.innerHTML=avatarSVG(p,72);
const picPrev=document.getElementById('picPreview');
if(!state.profilePicTemp && picPrev && !document.getElementById('inpPic')?.files?.length){ picPrev.innerHTML=avatarSVG(p,64); }
renderHeaderAvatar();
}
function previewProfilePic(e){
const f=e.target.files[0]; if(!f) return; if(f.size>1048576){showToast('Please choose a profile photo under 1 MB.');e.target.value='';return;}
const r=new FileReader(); r.onload=ev=>{ state.profilePicTemp=ev.target.result; document.getElementById('picPreview').innerHTML=`<img src="${state.profilePicTemp}" class="w-full h-full object-cover">`; showToast('Photo selected — will be saved on Finish'); }; r.readAsDataURL(f);
}
function clearProfilePic(){ state.profilePicTemp=null; document.getElementById('inpPic').value=''; updateAutoAvatarLive(); showToast('Switched to auto animated avatar'); }
function renderHeaderAvatar(){
const wrap=document.getElementById('avatarWrap'); if(!wrap) return;
const p=state.profile||demoProfiles.adults;
const pic=state.profilePic||state.profilePicTemp;
if(pic){ wrap.innerHTML=`<img src="${pic}" class="w-full h-full object-cover">`; }
else{ wrap.innerHTML=avatarSVG(p,36); }
const sAv=document.getElementById('settingsAvatar'); if(sAv){ sAv.innerHTML= pic?`<img src="${pic}" class="w-full h-full object-cover">`:avatarSVG(p,56); }
}

/* DEMO */
function prefillProfileForm(p){ document.getElementById('inpName').value=p.name; document.getElementById('inpAge').value=p.age; document.querySelector(`input[name="sex"][value="${p.sex}"]`).checked=true; document.getElementById('inpHeight').value=Math.round(p.height); document.getElementById('inpWeight').value=Math.round(p.weight); document.getElementById('inpActivity').value=p.activity; document.querySelector(`input[name="climate"][value="${p.climate}"]`).checked=true; document.getElementById('inpDiet').value=p.diet; document.getElementById('inpBudget').value=p.budget; document.getElementById('inpCuisine').value=p.cuisine; document.getElementById('inpSleep').value=p.sleep; document.getElementById('inpGoal').value=p.goal; document.getElementById('inpHealth').value=p.health||''; selectAgeStyle(state.ageStyle); updateAutoAvatarLive(); }

/* STEPS */
function showProfileSetup(){ document.getElementById('loginScreen').classList.add('hidden'); document.getElementById('app').classList.add('hidden'); document.getElementById('profileSetup').classList.remove('hidden'); currentStep=1; updateStepUI(); window.scrollTo(0,0); lucide.createIcons(); updateAutoAvatarLive(); }
function showProfileSetupFromApp(){ showProfileSetup(); if(state.profile) prefillProfileForm(state.profile); if(state.profilePic){ document.getElementById('picPreview').innerHTML=`<img src="${state.profilePic}" class="w-full h-full object-cover">`; } }
function clearProfileAndBack(){ if(state.profile){showApp(true);return;} signOut(); }
function updateStepUI(){ for(let i=1;i<=4;i++) document.getElementById('step'+i).classList.toggle('hidden', i!==currentStep); document.getElementById('stepNum').textContent=currentStep; document.getElementById('stepLabel').textContent=`STEP ${currentStep} OF 4 • ${['BASICS','BODY','PREFERENCES','WELLNESS'][currentStep-1]}`; document.getElementById('progressBar').style.width=(currentStep*25)+'%'; document.getElementById('btnPrev').classList.toggle('hidden', currentStep===1); document.getElementById('btnNext').classList.toggle('hidden', currentStep===4); document.getElementById('btnFinish').classList.toggle('hidden', currentStep!==4); document.getElementById('btnSkip').classList.toggle('hidden', currentStep!==4); for(let i=2;i<=4;i++){ const el=document.getElementById('dot'+i); if(el) el.className=i<=currentStep?'px-2 py-1 rounded-full bg-teal text-white font-semibold':'px-2 py-1 rounded-full bg-slate-100 text-slate-500 font-semibold'; } }
function nextStep(){ if(currentStep===1){ const name=document.getElementById('inpName').value.trim(); const age=parseInt(document.getElementById('inpAge').value); if(name.length<2){ document.getElementById('errName').classList.remove('hidden'); return; } else document.getElementById('errName').classList.add('hidden'); if(!age||age<3||age>100){ showToast('Please enter a valid age (3–100)'); return; } } if(currentStep===2){ const h=parseFloat(document.getElementById('inpHeight').value); const w=parseFloat(document.getElementById('inpWeight').value); if(!h||!w){ showToast('Please enter height and weight'); return; } } currentStep=Math.min(4,currentStep+1); updateStepUI(); }
function prevStep(){ currentStep=Math.max(1,currentStep-1); updateStepUI(); }
function skipOptional(){ document.getElementById('inpHealth').value=''; document.getElementById('inpMeds').value=''; finishProfile(); }

/* STYLE */
function selectAgeStyle(style){ state.ageStyle=style; save(); applyAgeStyle(style); document.querySelectorAll('.agePick').forEach(b=>{ if(b.dataset.style===style) b.className='agePick text-left p-3 rounded-2xl border-2 border-teal bg-white shadow'; else b.className='agePick text-left p-3 rounded-2xl border border-slate-200 bg-slate-50'; }); renderWorkout(); renderMusic(); updateBmiTool();}
function applyAgeStyle(style){ document.body.classList.remove('age-kids','age-teens','age-adults','age-seniors'); document.body.classList.add('age-'+style); document.querySelectorAll('.styleNav').forEach(b=>{ if(b.dataset.styleNav===style) b.className='styleNav px-3 py-1.5 rounded-full bg-teal text-white border-teal text-xs font-bold'; else b.className='styleNav px-3 py-1.5 rounded-full border bg-white text-xs font-bold'; }); document.querySelectorAll('.styleNavM').forEach(b=>{ if(b.dataset.styleNavM===style) b.className='styleNavM shrink-0 px-3 py-1.5 rounded-full bg-teal text-white border-teal text-xs font-bold'; else b.className='styleNavM shrink-0 px-3 py-1.5 rounded-full border bg-white text-xs font-bold'; }); const hero=document.getElementById('dashHero'); if(!hero) return; if(style==='kids'){ hero.className='rounded-[24px] p-5 sm:p-6 text-white relative overflow-hidden bg-gradient-to-br from-[#FF8A5B] via-[#FF6B8A] to-[#A78BFA]'; document.getElementById('ageToneTitle').textContent='Storybook & cheerful — Nunito, bouncy motion, confetti & big icons!'; document.getElementById('ageToneDesc').textContent='Kids see playful language, rounded cards, floating animations and extra confetti (toggle off in Settings).'; } else if(style==='teens'){ hero.className='rounded-[24px] p-5 sm:p-6 text-white relative overflow-hidden bg-gradient-to-br from-[#0F766E] via-[#7C3AED] to-[#EC4899]'; document.getElementById('ageToneTitle').textContent='Fresh & expressive — Outfit, bold slide, neon accents.'; document.getElementById('ageToneDesc').textContent='Teens get uppercase headings, gradient cards and energetic slide animations without childish characters.'; } else if(style==='seniors'){ hero.className='rounded-[24px] p-5 sm:p-6 text-white relative overflow-hidden bg-gradient-to-br from-[#0F766E] to-[#115E59]'; document.getElementById('ageToneTitle').textContent='Calm & high-contrast — Lexend, larger text, gentle fade.'; document.getElementById('ageToneDesc').textContent='Seniors get Lexend font, larger controls, high contrast and slow fade motion for comfortable reading.'; } else { hero.className='rounded-[24px] p-5 sm:p-6 text-white relative overflow-hidden bg-gradient-to-br from-[#0F766E] to-[#14B8A6]'; document.getElementById('ageToneTitle').textContent='Calm & clear — Jakarta, precise charts, subtle fade.'; document.getElementById('ageToneDesc').textContent='Adults see a calm, organized dashboard with clear numbers and gentle motion that respects reduced-motion settings.'; } const rh=document.getElementById('recipeHeader'); if(rh){ const grad = style==='kids' ? 'from-[#FF8A5B] via-[#FF6B8A] to-[#A78BFA]' : style==='teens' ? 'from-[#7C3AED] to-[#EC4899]' : style==='seniors' ? 'from-[#0F766E] to-[#115E59]' : 'from-[#0F766E] to-[#14B8A6]'; rh.querySelector('div').className='absolute inset-0 bg-gradient-to-br '+grad; } }

function setUnits(u, doSave=true){ state.units=u; if(doSave) save(); const isMetric=u==='metric'; ['btnMetric','sBtnMetric'].forEach(id=>{ const el=document.getElementById(id); if(el){ el.classList.toggle('bg-teal',isMetric); el.classList.toggle('text-white',isMetric); }}); ['btnImperial','sBtnImperial'].forEach(id=>{ const el=document.getElementById(id); if(el){ el.classList.toggle('bg-teal',!isMetric); el.classList.toggle('text-white',!isMetric); }}); const lh=document.getElementById('labelHeight'); if(lh) lh.textContent=isMetric?'Height (cm) *':'Height (inches) *'; const lw=document.getElementById('labelWeight'); if(lw) lw.textContent=isMetric?'Weight (kg) *':'Weight (lbs) *'; }

function finishProfile(){ if(!currentUserId){showToast('Please sign in before saving your profile.');return;} const name=document.getElementById('inpName').value.trim(); const age=parseInt(document.getElementById('inpAge').value); if(!name||name.length<2||!age){ showToast('Please complete required fields'); return; } let height=parseFloat(document.getElementById('inpHeight').value); let weight=parseFloat(document.getElementById('inpWeight').value); if(state.units==='imperial'){ height=height*2.54; weight=weight*0.453592; } const profile={ name, age, sex:document.querySelector('input[name="sex"]:checked').value, height, weight, activity:document.getElementById('inpActivity').value, climate:document.querySelector('input[name="climate"]:checked').value, diet:document.getElementById('inpDiet').value, allergies:Array.from(document.querySelectorAll('.allergy:checked')).map(c=>c.value), budget:document.getElementById('inpBudget').value, cuisine:document.getElementById('inpCuisine').value, sleep:parseFloat(document.getElementById('inpSleep').value)||7.5, goal:document.getElementById('inpGoal').value, health:document.getElementById('inpHealth').value.trim(), meds:document.getElementById('inpMeds').value.trim() }; state.profile=profile; if(state.profilePicTemp) state.profilePic=state.profilePicTemp; state.profilePicTemp=null; state.hydration.goal=calcWater(profile); state.hydration.consumed=0; state.hydration.glasses=Array.from({length:Math.ceil(state.hydration.goal/250)},()=>false); save(); generateMeals(); showApp(); showToast('Profile saved — welcome, '+name+'! '+(state.profilePic?'Photo saved.':'Auto avatar created ✨')); }
function showApp(silent){ document.getElementById('loginScreen').classList.add('hidden'); document.getElementById('profileSetup').classList.add('hidden'); document.getElementById('app').classList.remove('hidden'); renderAll(); window.scrollTo(0,0); lucide.createIcons(); }
async function clearAllData(){ if(!currentUserId||!confirm('Clear your saved profile and activity from this account? Your account will remain active.')) return; try { await flushCloudSave(); const {error}=await supabaseClient.from('user_app_state').delete().eq('user_id',currentUserId); if(error) throw error; const user=state.user; state=freshState(user); generateMeals(); showProfileSetup(); showToast('Account data cleared. Set up your profile again.'); } catch(error){ console.error(error); showToast('Could not clear account data. Please try again.'); } }

/* CALCS */
function calcBmi(p){ const h=p.height/100; return p.weight/(h*h); }
function bmiCategory(bmi){ if(bmi<18.5) return 'Underweight range'; if(bmi<25) return 'Healthy range'; if(bmi<30) return 'Overweight range'; return 'Obesity range'; }
function calcBmr(p){ const w=p.weight,h=p.height,a=p.age; if(p.sex==='male') return 10*w+6.25*h-5*a+5; if(p.sex==='female') return 10*w+6.25*h-5*a-161; return 10*w+6.25*h-5*a-78; }
function activityFactor(act){ return {sedentary:1.2,light:1.375,moderate:1.55,active:1.725,very:1.9}[act]||1.375; }
function calcWater(p){ let base=p.weight*35; if(p.climate==='hot') base+=500; if(p.climate==='cold') base-=150; if(p.activity==='moderate') base+=300; if(p.activity==='active'||p.activity==='very') base+=500; if(p.age<14) base=Math.min(base,2000); if(p.age>65) base=Math.max(base,1600); return Math.round(Math.min(3500,Math.max(1200,base))/100)*100; }
function macroSplit(g){ if(g==='muscle') return {c:40,p:30,f:30}; if(g==='light') return {c:45,p:30,f:25}; if(g==='energy') return {c:55,p:20,f:25}; return {c:50,p:25,f:25}; }
function dietAllows(mealDiets, userDiet, allergies){
if(userDiet==='nonveg'){ if(!(mealDiets.includes('nonveg')||mealDiets.includes('omnivore')||mealDiets.includes('vegetarian')||mealDiets.includes('vegan'))) return false; }
else if(userDiet==='omnivore'){ }
else if(userDiet==='vegetarian'){ if(!(mealDiets.includes('vegetarian')||mealDiets.includes('vegan'))) return false; }
else if(userDiet==='vegan'){ if(!mealDiets.includes('vegan')) return false; }
else if(userDiet==='pescatarian'){ if(!(mealDiets.includes('pescatarian')||mealDiets.includes('vegetarian')||mealDiets.includes('vegan'))) return false; }
else if(userDiet==='jain'){ if(!(mealDiets.includes('vegetarian')||mealDiets.includes('vegan'))) return false; }
for(let a of allergies){ if(mealDiets && mealTagsContainAllergy(mealDiets,a)){} }
return true;
}
function mealTagsContainAllergy(){ return false; }
function mealOk(meal, p){
let dietOk=false;
if(p.diet==='vegan') dietOk=meal.diet.includes('vegan');
else if(p.diet==='vegetarian') dietOk=meal.diet.includes('vegetarian')||meal.diet.includes('vegan');
else if(p.diet==='pescatarian') dietOk=meal.diet.includes('pescatarian')||meal.diet.includes('vegetarian')||meal.diet.includes('vegan');
else if(p.diet==='nonveg') dietOk=meal.diet.includes('nonveg')||meal.diet.includes('omnivore')||meal.diet.includes('vegetarian')||meal.diet.includes('vegan');
else if(p.diet==='omnivore') dietOk=true;
else dietOk=meal.diet.includes('vegetarian')||meal.diet.includes('vegan')||meal.diet.includes('omnivore')||meal.diet.includes('nonveg');
if(!dietOk) return false;
for(let al of (p.allergies||[])){ if(meal.tags.includes(al)) return false; }
return true;
}

/* RENDER ALL */
function renderAll(){ if(state.profile){ const h=document.getElementById('bmiToolH'), w=document.getElementById('bmiToolW'); if(h&&w){ h.value=Math.min(+h.max,Math.max(+h.min,Math.round(state.profile.height))); w.value=Math.min(+w.max,Math.max(+w.min,Math.round(state.profile.weight))); } } updateBmiTool(true); renderDashboard(); renderHydration(); renderMeals(); renderWorkout(); renderMusic(); renderSettings(); renderHeaderAvatar(); lucide.createIcons(); }

/* DASHBOARD */
function renderDashboard(){
const p=state.profile||demoProfiles.adults;
const hi=state.lang==='hi';
document.getElementById('headerName').textContent=p.name;
document.getElementById('headerSub').textContent=`${p.goal} • ${p.age}y • ${p.diet}`;
const hour=new Date().getHours(); const greet=hour<12?(hi?'सुप्रभात':'Good morning'):hour<17?(hi?'नमस्ते':'Good afternoon'):(hi?'शुभ संध्या':'Good evening');
document.getElementById('dashGreetingEyebrow').textContent=`${greet.toUpperCase()} • ${new Date().toLocaleDateString(state.lang==='hi'?'hi-IN':'en-US',{weekday:'long'}).toUpperCase()}`;
const tone=state.ageStyle==='kids'?'Ready for a splashy, healthy day? 🌈':state.ageStyle==='teens'?'Your vibe, your pace — let’s make it balanced ⚡':state.ageStyle==='seniors'?'Gentle steps for a steady, comfortable day ☀️':'Small steps today? ✨';
document.getElementById('dashTitle').textContent=`${hi?'नमस्ते':'Hello'}, ${p.name} — ${tone}`;
const bmi=calcBmi(p), bmr=calcBmr(p), tdee=bmr*activityFactor(p.activity), water=state.hydration.goal;
document.getElementById('metricBmi').textContent=bmi.toFixed(1);
document.getElementById('metricBmiCat').textContent=hi?({'Underweight range':'कम वजन','Healthy range':'स्वस्थ सीमा','Overweight range':'अधिक वजन','Obesity range':'मोटापा'}[bmiCategory(bmi)]||bmiCategory(bmi)):bmiCategory(bmi);
document.getElementById('metricBmr').textContent=Math.round(bmr).toLocaleString();
document.getElementById('metricTdee').textContent=Math.round(tdee).toLocaleString();
document.getElementById('metricWater').innerHTML=(water/1000).toFixed(1)+'<span class="text-lg">L</span>';
document.getElementById('metricWaterSub').textContent=`~${Math.round(water/250)} glasses / day`;
document.getElementById('dashWaterChip').textContent=`💧 Water target ~${(water/1000).toFixed(1)} L/day (estimate)`;
document.getElementById('dashGoalChip').textContent=`Goal: ${p.goal}`;
document.getElementById('badgeSleep').textContent=p.sleep+'h avg';
const split=macroSplit(p.goal); const cals=Math.round(tdee);
const carbG=Math.round(cals*split.c/100/4), protG=Math.round(cals*split.p/100/4), fatG=Math.round(cals*split.f/100/9);
document.getElementById('macroCarb').textContent=`${split.c}% • ~${carbG}g`;
document.getElementById('macroProt').textContent=`${split.p}% • ~${protG}g`;
document.getElementById('macroFat').textContent=`${split.f}% • ~${fatG}g`;
document.getElementById('barCarb').style.width=split.c+'%'; document.getElementById('barProt').style.width=split.p+'%'; document.getElementById('barFat').style.width=split.f+'%';
document.getElementById('macroCenter').textContent=`${split.c}/${split.p}/${split.f}`;
document.getElementById('macroGoal').textContent=p.goal;
drawMacroChart(split);
const done=state.hydration.glasses.filter(Boolean).length, total=state.hydration.glasses.length;
document.getElementById('focusProgress').style.width=(done/total*100)+'%';
document.getElementById('focusProgressText').textContent=`${done} of ${total} glasses`;
document.getElementById('badgeHydra').textContent=`${done}/${total} today`;
renderStreakCalendar(); updateBmiTool(true); renderWorkoutPreviewChip();
}
function drawMacroChart(split){
const ctx=document.getElementById('macroChart'); if(!ctx) return;
// Theme changes can redraw the chart outside renderDashboard, so restore the current split if omitted.
split=split||macroSplit((state.profile||demoProfiles.adults).goal);
if(chartInstance) chartInstance.destroy();
const dark=state.theme==='dark';
chartInstance=new Chart(ctx,{type:'doughnut',data:{labels:['Carbs','Protein','Fat'],datasets:[{data:[split.c,split.p,split.f],backgroundColor:['#0F766E','#FF6B5A','#FBBF24'],borderWidth:dark?2:0,borderColor:dark?'#13273E':'#fff'}]},options:{cutout:'68%',plugins:{legend:{display:false}}}});
}

/* STREAK CALENDAR */
function renderStreakCalendar(){
const grid=document.getElementById('streakGrid'); if(!grid) return;
const now=new Date(); const y=now.getFullYear(), m=now.getMonth();
document.getElementById('streakMonthLabel').textContent=now.toLocaleDateString(state.lang==='hi'?'hi-IN':'en-US',{month:'long',year:'numeric'})+' • Green = goal met, light = missed';
const first=new Date(y,m,1).getDay(); const days=new Date(y,m+1,0).getDate();
let html='';
for(let i=0;i<first;i++) html+=`<div></div>`;
let monthDone=0, monthTotal=0;
for(let d=1;d<=days;d++){
const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
const isToday=ds===todayStr();
const isFuture=new Date(ds)>new Date(todayStr());
let cls='bg-slate-50 border-slate-100 text-slate-400', icon='';
if(isFuture){ cls='bg-slate-50/50 border-slate-100 text-slate-300'; }
else if(state.streakMap[ds]===true){ cls='bg-emerald-500 text-white border-emerald-600 shadow'; icon='✓'; monthDone++; monthTotal++; }
else if(state.streakMap[ds]===false){ cls='bg-rose-100 text-rose-500 border-rose-200'; icon='✕'; monthTotal++; }
else if(!isFuture){ const past=new Date(ds)<new Date(todayStr()); if(past){ cls='bg-slate-100 text-slate-400 border-slate-200'; icon='·'; } }
if(isToday) cls+=' ring-2 ring-teal ring-offset-1';
html+=`<div class="cal-cell ${cls} ${isToday?'font-black':''}">${d}<span class="text-[9px] leading-none">${isToday?'TODAY':icon}</span></div>`;
}
grid.innerHTML=html;
let cur=0; for(let i=0;i<30;i++){ const ds=todayStr(-i); if(state.streakMap[ds]===true||(i===0&&state.hydration.consumed>=state.hydration.goal)) cur++; else if(i===0&&state.hydration.consumed<state.hydration.goal*0.5&&state.streakMap[ds]!==true){ if(i===0) continue; else break; } else if(state.streakMap[ds]===false) break; else if(i>2) break; }
if(state.hydration.consumed>=state.hydration.goal) cur=Math.max(cur,1);
document.getElementById('streakCurrent').textContent=cur;
document.getElementById('dashStreakChip').textContent=cur+'-day gentle streak';
let best=0, run=0; Object.keys(state.streakMap).sort().forEach(k=>{ if(state.streakMap[k]){ run++; best=Math.max(best,run);} else run=0; });
document.getElementById('streakBest').textContent=Math.max(best,cur);
document.getElementById('streakMonthPct').textContent=(monthTotal?Math.round(monthDone/monthTotal*100):0)+'%';
}
function markTodayStreak(done=true){ state.streakMap[todayStr()]=done; save(); renderStreakCalendar(); }

/* BMI TOOL */
function updateBmiTool(silent){
const hEl=document.getElementById('bmiToolH'), wEl=document.getElementById('bmiToolW'); if(!hEl||!wEl) return;
const h=Number(hEl.value), w=Number(wEl.value), value=document.getElementById('bmiToolValue'), catEl=document.getElementById('bmiToolCat');
document.getElementById('bmiToolHLabel').textContent=h+' cm'; document.getElementById('bmiToolWLabel').textContent=w+' kg';
if(!Number.isFinite(h)||!Number.isFinite(w)||h<100||h>210||w<20||w>130){ value.textContent='—'; catEl.textContent='Adjust values'; return; }
const bmi=w/Math.pow(h/100,2); value.textContent=bmi.toFixed(1);
const age=Number((state.profile||demoProfiles.adults).age);
const cat=age<20?'Age-specific guidance needed':bmi<18.5?'Underweight':bmi<25?'Healthy':bmi<30?'Overweight':'Obesity'; catEl.textContent=cat;
catEl.className='text-center text-[11px] font-bold px-2 py-0.5 rounded-full border inline-block mx-auto '+(age<20?'bg-amber-50 text-amber-800 border-amber-200':bmi<18.5?'bg-sky-50 text-sky-700 border-sky-200':bmi<25?'bg-emerald-50 text-emerald-700 border-emerald-200':bmi<30?'bg-amber-50 text-amber-700 border-amber-200':'bg-rose-50 text-rose-700 border-rose-200');
const angle=Math.min(180,Math.max(0,(bmi-12)/(40-12)*180)); const needle=document.getElementById('bmiNeedle'); if(needle) needle.style.transform=`rotate(${-90+angle}deg)`;
}
function syncBmiToProfile(){ const p=state.profile||demoProfiles.adults; document.getElementById('bmiToolH').value=Math.min(210,Math.max(100,Math.round(p.height))); document.getElementById('bmiToolW').value=Math.min(130,Math.max(20,Math.round(p.weight))); updateBmiTool(); showToast('Loaded profile values into calculator'); }
function saveBmiToProfile(){ if(!state.profile){ showToast('Create profile first'); return; } const h=Number(document.getElementById('bmiToolH').value), w=Number(document.getElementById('bmiToolW').value); if(!Number.isFinite(h)||!Number.isFinite(w)||h<100||h>210||w<20||w>130){ showToast('Choose a valid height and weight'); return; } state.profile.height=h; state.profile.weight=w; state.hydration.goal=calcWater(state.profile); save(); generateMeals(); renderAll(); showToast('Saved to profile — water & workouts updated'); }

/* HYDRATION */
function renderHydration(){
syncHydrationGlasses(); const h=state.hydration; const totalGlass=h.glasses.length; const done=h.glasses.filter(Boolean).length;
document.getElementById('hydrationCountLabel').textContent=`${done} / ${totalGlass}`;
document.getElementById('hydrationLiters').textContent=(h.consumed/1000).toFixed(2)+' L';
document.getElementById('hydrationGoalText').textContent=(h.goal/1000).toFixed(2)+' L';
document.getElementById('waterTargetLabel').textContent=h.goal+' ml';
document.getElementById('waterTargetRange').value=h.goal;
const pct=Math.min(100,Math.round(h.consumed/Math.max(1,h.goal)*100));
document.getElementById('waterFill').style.height=pct+'%';
document.getElementById('waterPercent').textContent=pct+'%';
const grid=document.getElementById('glassGrid'); grid.innerHTML='';
h.glasses.forEach((g,i)=>{ const b=document.createElement('button'); b.onclick=()=>toggleGlass(i); b.className=`py-3 rounded-2xl border-2 font-bold text-lg transition ${g?'bg-teal text-white border-teal':'bg-slate-50 border-slate-200 opacity-60'}`; b.textContent=g?'🥛':'◯'; grid.appendChild(b); });
const p=state.profile||demoProfiles.adults;
document.getElementById('scheduleSleep').textContent=p.sleep;
const times=['7:00 Wake +250ml','9:00 +250ml','11:30 +250ml','13:30 Lunch +250ml','16:00 +250ml','18:30 +250ml','20:00 +250ml','21:30 Light sip'];
const list=document.getElementById('scheduleList'); list.innerHTML='';
times.slice(0,totalGlass).forEach((t,i)=>{ const doneS=h.scheduleDone[i]; const row=document.createElement('button'); row.onclick=()=>{ h.scheduleDone[i]=!h.scheduleDone[i]; save(); renderHydration(); }; row.className=`w-full flex items-center gap-3 p-3 rounded-xl border text-left ${doneS?'bg-teal-50 border-teal/30':'bg-slate-50 border-slate-200'}`; row.innerHTML=`<span class="w-6 h-6 rounded-full ${doneS?'bg-teal text-white':'bg-white border'} flex items-center justify-center text-xs font-bold">${doneS?'✓':i+1}</span><span class="text-sm font-semibold flex-1">${t}</span><span class="text-[11px] text-slate-400">250 ml</span>`; list.appendChild(row); });
document.getElementById('reminderToggle').checked=state.reminders;
}
function syncHydrationGlasses(){ const h=state.hydration; const count=Math.max(1,Math.ceil(h.goal/250)); h.glasses=Array.from({length:count},(_,i)=>i<Math.floor(h.consumed/250)); }
function finishWaterUpdate(){ const h=state.hydration; syncHydrationGlasses(); if(h.consumed>=h.goal) markTodayStreak(true); save(); renderHydration(); renderDashboard(); }
function addGlass(n){ const h=state.hydration; if(n>0){ h.consumed+=250; celebrate(); } else { if(h.consumed<250){ showToast('No full glass to remove'); return; } h.consumed-=250; } finishWaterUpdate(); }
function toggleGlass(i){ const h=state.hydration; const wasFull=!!h.glasses[i]; h.consumed=Math.max(0,h.consumed+(wasFull?-250:250)); if(h.consumed>=h.goal) celebrate(); finishWaterUpdate(); }
function addCustom(){ const ml=Number(document.getElementById('customMl').value); if(!Number.isFinite(ml)||ml<=0){ showToast('Choose a valid amount'); return; } state.hydration.consumed+=ml; if(state.hydration.consumed>=state.hydration.goal) celebrate(); finishWaterUpdate(); showToast(`+${ml} ml logged 💧`); }
function resetHydration(){ state.hydration.consumed=0; state.hydration.glasses=Array.from({length:Math.max(1,Math.ceil(state.hydration.goal/250))},()=>false); state.hydration.scheduleDone={}; save(); renderHydration(); renderDashboard(); }
function toggleReminders(v){ state.reminders=v; save(); showToast(v?'Reminders ON (demo) 🔔':'Reminders OFF'); }
function celebrate(){ if(state.reduceMotion) return; if(state.ageStyle==='kids'){ for(let i=0;i<24;i++){ const c=document.createElement('div'); c.className='confetti'; c.style.left=Math.random()*100+'vw'; c.style.background=['#FF6B5A','#FFD93D','#6BCB77','#4D96FF','#B983FF'][i%5]; c.style.borderRadius=Math.random()>0.5?'50%':'4px'; document.body.appendChild(c); setTimeout(()=>c.remove(),1500); } } }

/* MEALS */
function generateMeals(){ const p=state.profile||demoProfiles.adults; mealData=[]; for(let d=0;d<7;d++){ const pick=(arr)=>{ const ok=arr.filter(m=>mealOk(m,p)); const pool=ok.length?ok:arr; return pool[Math.floor(Math.random()*pool.length)]; }; mealData.push({breakfast:pick(mealPool.breakfast),lunch:pick(mealPool.lunch),dinner:pick(mealPool.dinner),snack:pick(mealPool.snack)}); } renderMeals(); }
function shuffleMeals(){ generateMeals(); showToast('Week shuffled 🔀'); }
function renderMeals(){
const p=state.profile||demoProfiles.adults;
const dietLabel={omnivore:'Omnivore • Everything',nonveg:'Non-vegetarian • Veg + Chicken/Egg/Fish',vegetarian:'Vegetarian • Balanced',vegan:'Vegan • Plant-based',pescatarian:'Pescatarian • Fish + Veg',jain:'Jain adaptable • Veg'}[p.diet]||p.diet;
document.getElementById('mealDietChip').textContent=dietLabel;
document.getElementById('mealBudgetLabel').textContent=p.budget[0].toUpperCase()+p.budget.slice(1);
const tabs=document.getElementById('dayTabs'); tabs.innerHTML='';
['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach((d,i)=>{ const b=document.createElement('button'); b.onclick=()=>{ currentMealDay=i; renderMeals(); }; b.className=`shrink-0 px-4 py-2 rounded-full text-sm font-bold border ${i===currentMealDay?'bg-teal text-white border-teal':'bg-white border-slate-200'}`; b.textContent=(i===new Date().getDay()-1||(new Date().getDay()===0&&i===6)?'● ':'')+d; tabs.appendChild(b); });
const day=mealData[currentMealDay]||mealData[0]; const grid=document.getElementById('mealGrid'); grid.innerHTML='';
[['breakfast','Breakfast','🌅'],['lunch','Lunch','☀️'],['dinner','Dinner','🌙'],['snack','Snack','🍎']].forEach(([k,label,emoji])=>{
const m=day[k]; const card=document.createElement('div'); card.className='meal-card bg-white border p-4 cursor-pointer card-hover'; card.onclick=()=>openRecipe(m,k);
const isNonveg=m.tags.includes('nonveg')||m.diet.includes('nonveg')||/chicken|egg|fish/i.test(m.name);
card.innerHTML=`<div class="flex items-start gap-3"><div class="w-11 h-11 rounded-2xl bg-slate-50 flex items-center justify-center text-2xl shrink-0">${m.icon}</div><div class="flex-1 min-w-0"><p class="text-[10px] font-bold tracking-widest text-slate-400">${emoji} ${label.toUpperCase()} • ${m.time} MIN • ${m.diff.toUpperCase()}</p><p class="font-bold text-sm leading-snug mt-0.5">${m.name}</p><div class="flex flex-wrap gap-1 mt-2">${isNonveg?'<span class="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 font-bold">🍗 Non-veg</span>':''}${m.tags.includes('peanut')?'<span class="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 border">🥜</span>':''}${m.tags.includes('dairy')?'<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border">🥛</span>':''}${m.tags.includes('gluten')?'<span class="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border">🌾</span>':''}<span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 border font-bold">${m.cal} kcal</span></div></div></div><div class="mt-3 flex items-center justify-between"><span class="text-xs font-bold text-teal">View recipe →</span><span class="text-[11px] text-slate-400">Serves 2 • Scales</span></div>`;
grid.appendChild(card);
});
lucide.createIcons();
}
function generateShoppingList(){ const day=mealData[currentMealDay]; let items=[]; Object.values(day).forEach(m=>m.ingredients.forEach(ing=>items.push(`${ing.item} — ${ing.qty*state.servings/2}${ing.unit}`))); document.getElementById('shoppingList').classList.remove('hidden'); document.getElementById('shoppingItems').innerHTML=items.map(i=>`<li>${i}</li>`).join(''); showToast('Shopping list ready 🧺'); document.getElementById('shoppingList').scrollIntoView({behavior:'smooth'}); }

/* RECIPE */
function openRecipe(m,type){ currentRecipe={...m,type}; state.servings=2; document.getElementById('servingsCount').textContent='2'; document.getElementById('recipeIcon').textContent=m.icon; document.getElementById('recipeMealType').textContent=type.toUpperCase(); document.getElementById('recipeTime').textContent='⏱ '+m.time+' min'; document.getElementById('recipeDifficulty').textContent=m.diff; document.getElementById('recipeCal').textContent=m.cal+' kcal'; document.getElementById('recipeTitle').textContent=m.name; document.getElementById('recipeSubtitle').textContent=(m.diet.includes('nonveg')||/chicken|egg|fish/i.test(m.name)?'Non-veg protein plate':'Balanced veg plate')+' • Comforting & familiar'; document.getElementById('recipeTip').textContent='Tip: '+m.tip; timerSeconds=m.time*60; updateTimerUI(); renderRecipeIngredients(); renderRecipeSteps(); document.getElementById('nutCal').textContent=m.cal; document.getElementById('nutProtein').textContent=(m.tags.includes('nonveg')||/chicken/i.test(m.name)?'28g':m.tags.includes('egg')?'16g':'14g'); document.getElementById('nutTime').textContent=m.time+'m'; document.getElementById('recipeModal').classList.remove('hidden'); switchRecipeTab('ingredients'); setPrepStyle('standard'); lucide.createIcons(); }
function closeRecipe(){ document.getElementById('recipeModal').classList.add('hidden'); pauseTimer(); }
function switchRecipeTab(t){ ['ingredients','steps','nutrition'].forEach(k=>{ document.getElementById('recipe'+k[0].toUpperCase()+k.slice(1)).classList.toggle('hidden', k!==t); document.getElementById('tab'+k[0].toUpperCase()+k.slice(1)).classList.toggle('active', k===t); }); }
function renderRecipeIngredients(){ const list=document.getElementById('ingredientsList'); list.innerHTML=''; const scale=state.servings/2; currentRecipe.ingredients.forEach(ing=>{ const d=document.createElement('div'); d.className='flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm'; d.innerHTML=`<span class="w-2 h-2 rounded-full bg-teal shrink-0"></span><span class="flex-1 font-semibold">${ing.item}</span><span class="font-bold">${(ing.qty*scale)}${ing.unit}</span>`; list.appendChild(d); }); const aw=document.getElementById('allergenWarnings'); const map={peanut:'🥜 Peanut',dairy:'🥛 Dairy',gluten:'🌾 Gluten',soy:'🫘 Soy',egg:'🥚 Egg',shellfish:'🦐 Fish/Shell',nonveg:'🍗 Non-veg'}; aw.innerHTML=currentRecipe.tags.map(t=>`<span class="text-xs px-2 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 font-bold">${map[t]||t}</span>`).join('')||'<span class="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">✓ No major allergens flagged</span>'; }
function renderRecipeSteps(){ const ol=document.getElementById('stepsList'); ol.innerHTML=''; currentRecipe.steps.forEach((s,i)=>{ const li=document.createElement('li'); li.className='flex gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-3'; li.innerHTML=`<span class="w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center font-extrabold shrink-0">${i+1}</span><p class="text-sm leading-relaxed flex-1">${s}</p>`; ol.appendChild(li); }); }
function updateServings(d){ state.servings=Math.min(8,Math.max(1,state.servings+d)); document.getElementById('servingsCount').textContent=state.servings; renderRecipeIngredients(); }
function setPrepStyle(s){ state.prepStyle=s; [['prepQuick','quick'],['prepStandard','standard'],['prepBatch','batch']].forEach(([id,k])=>{ const el=document.getElementById(id); el.className=k===s?'px-3 py-1.5 rounded-full bg-teal text-white text-xs font-bold':'px-3 py-1.5 rounded-full bg-slate-100 text-xs font-bold'; }); const labels={quick:['Quick','⚡ 15 min • shortcuts'],standard:['Standard','Balanced time & flavor'],batch:['Batch','Double & refrigerate 2 days']}; document.getElementById('prepModeLabel').textContent=labels[s][0]; document.getElementById('prepModeDesc').textContent=labels[s][1]; document.getElementById('timerLabel').textContent=labels[s][0]+' prep • Tap start to begin countdown'; if(s==='quick') timerSeconds=Math.max(5*60,currentRecipe.time*60-8*60); else timerSeconds=currentRecipe.time*60; updateTimerUI(); }
function updateTimerUI(){ const m=Math.floor(timerSeconds/60), s=timerSeconds%60; document.getElementById('timerDisplay').textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; const total=currentRecipe?currentRecipe.time*60:1200; document.getElementById('timerCircle').style.strokeDashoffset=175.9*(1-timerSeconds/total); }
function startRecipeTimer(){ if(timerRunning) return; timerRunning=true; timerInterval=setInterval(()=>{ if(timerSeconds>0){ timerSeconds--; updateTimerUI(); } else { pauseTimer(); showToast('Timer done! ⏰'); } },1000); }
function pauseTimer(){ timerRunning=false; clearInterval(timerInterval); }
function resetTimer(){ pauseTimer(); timerSeconds=currentRecipe?currentRecipe.time*60:1200; updateTimerUI(); }
function printRecipe(){ window.print(); }
function addToShoppingFromRecipe(){ generateShoppingList(); closeRecipe(); }

/* WORKOUT */
function getWorkoutPlan(p){
const bmi=calcBmi(p); const age=p.age;
let group='adults'; if(age<=12) group='kids'; else if(age<=19) group='teens'; else if(age>=60) group='seniors';
let ex=[];
if(group==='kids') ex=[
{name:'Jumping Jacks Fun',icon:'⭐',sets:'2 rounds',reps:'30 sec',mins:4,met:7,desc:'Bouncy warm-up, arms wide like a star.'},
{name:'Animal Walks',icon:'🐻',sets:'2 rounds',reps:'20 steps',mins:4,met:5,desc:'Bear crawl + frog jumps — play, not pain.'},
{name:'Dance Freeze',icon:'💃',sets:'3 songs',reps:'1 min each',mins:5,met:6,desc:'Dance, freeze when music stops. Giggles guaranteed.'},
{name:'Ball Toss Squats',icon:'⚽',sets:'2 sets',reps:'10 reps',mins:4,met:5,desc:'Squat, toss ball up, catch softly.'},
{name:'Superhero Stretch',icon:'🦸',sets:'1 round',reps:'3 min',mins:3,met:2.5,desc:'Reach sky, touch toes, breathe deep.'}];
else if(group==='teens') ex=[
{name:'Skipping / Jump Rope',icon:'🪢',sets:'3 rounds',reps:'1 min',mins:5,met:10,desc:'High burn, great for stamina. Rest 30s between.'},
{name:'Push-ups',icon:'💪',sets:'3 sets',reps:'10-12 reps',mins:4,met:6,desc:'Chest to ground, core tight. Knees down if needed.'},
{name:'Bodyweight Squats',icon:'🦵',sets:'3 sets',reps:'15 reps',mins:4,met:5.5,desc:'Back straight, knees behind toes.'},
{name:'Plank Hold',icon:'🧱',sets:'3 sets',reps:'30-45 sec',mins:3,met:4,desc:'Straight line head to heels. Breathe!'},
{name:'Mountain Climbers',icon:'⛰️',sets:'3 sets',reps:'30 sec',mins:4,met:9,desc:'Fast knees, pump arms. HIIT finisher.'},
{name:'Cool-down Stretch',icon:'🧘',sets:'1 round',reps:'4 min',mins:4,met:2.5,desc:'Hamstrings, shoulders, deep breaths.'}];
else if(group==='seniors') ex=[
{name:'Gentle March in Place',icon:'🚶',sets:'1 round',reps:'5 min',mins:5,met:3.5,desc:'Hold chair if needed. Easy pace, smile & breathe.'},
{name:'Chair Squats',icon:'🪑',sets:'2 sets',reps:'8-10 reps',mins:4,met:3.5,desc:'Sit-stand slowly using chair support.'},
{name:'Wall Push-ups',icon:'🧱',sets:'2 sets',reps:'10 reps',mins:3,met:3,desc:'Hands on wall, step back, gentle press.'},
{name:'Ankle Circles + Arm Raises',icon:'🔄',sets:'2 sets',reps:'10 each',mins:3,met:2.5,desc:'Joint-friendly mobility for balance.'},
{name:'Slow Walk + Breathing',icon:'🌿',sets:'1 round',reps:'5 min',mins:5,met:3,desc:'Cool-down walk, inhale 4, exhale 6.'}];
else ex=[
{name:'Brisk Walk / Jog',icon:'🏃',sets:'1 round',reps:'6 min',mins:6,met:6,desc:'Warm-up cardio. Talkable pace.'},
{name:'Squats + Lunges',icon:'🦵',sets:'3 sets',reps:'12 reps',mins:5,met:5.5,desc:'Alternate squats & lunges. Rest 30s.'},
{name:'Push-ups / Knee Push-ups',icon:'💪',sets:'3 sets',reps:'10 reps',mins:4,met:5,desc:'Strength for chest & arms.'},
{name:'Plank + Dead Bug',icon:'🧘',sets:'3 sets',reps:'30 sec',mins:4,met:3.5,desc:'Core stability, back-friendly.'},
{name:'Surya Namaskar Light',icon:'☀️',sets:'3 rounds',reps:'Slow flow',mins:5,met:4,desc:'Full-body mobility & breath.'}];
if(bmi>=30){ ex=ex.slice(0,4); ex.push({name:'Low-impact Cool Walk',icon:'🚶',sets:'1 round',reps:'6 min',mins:6,met:3,desc:'Joint-friendly extra — no jumping.'}); }
if(p.goal==='muscle'&&group!=='kids'&&group!=='seniors'){ ex.forEach(e=>{ if(/push|squat|lunge/i.test(e.name)) e.sets='4 sets'; }); }
let totalCal=Math.round(ex.reduce((s,e)=>s+e.met*p.weight*(e.mins/60),0));
let totalMin=ex.reduce((s,e)=>s+e.mins,0);
return {group, exercises:ex, totalCal, totalMin, level: group==='kids'?'Playful • No equipment':group==='seniors'?'Gentle • Chair support':bmi>=30?'Low-impact • Joint-friendly':p.activity==='sedentary'?'Beginner-friendly':'Balanced • Progressive'};
}
function renderWorkoutPreviewChip(){ const p=state.profile||demoProfiles.adults; const plan=getWorkoutPlan(p); const el=document.getElementById('dashWorkoutPreview'); if(el) el.textContent=`${plan.level.split('•')[0]} • ~${plan.totalMin} min • ~${plan.totalCal} kcal`; }
function renderWorkout(){
const p=state.profile||demoProfiles.adults; const plan=getWorkoutPlan(p);
document.getElementById('workoutEyebrow').textContent=`SUGGESTED FOR ${p.name.toUpperCase()} • BMI ${calcBmi(p).toFixed(1)} • ${p.activity.toUpperCase()} • ${p.goal.toUpperCase()}`;
const titles={kids:'Playful power • Fun & bouncy 🌈',teens:'Fresh & fierce • HIIT energy ⚡',adults:'Balanced full-body • Gentle & steady 💪',seniors:'Steady & safe • Chair-friendly ☀️'};
document.getElementById('workoutTitle').textContent=titles[plan.group]||titles.adults;
document.getElementById('workoutDesc').textContent=`Built from your age (${p.age}y), weight (${Math.round(p.weight)}kg), BMI, activity (${p.activity}), goal (${p.goal}), sleep (${p.sleep}h) & climate (${p.climate}). ${plan.group==='seniors'?'Low-impact, balance-safe, stop if dizzy.':plan.group==='kids'?'20 min play-based movement — adult supervision for under 8.':'No equipment, moderate sweat, general fitness only.'}`;
document.getElementById('workoutChips').innerHTML=`<span class="px-3 py-1.5 rounded-full bg-white/15 border border-white/20 text-xs font-semibold">⏱ ${plan.totalMin} min</span><span class="px-3 py-1.5 rounded-full bg-white/15 border border-white/20 text-xs font-semibold">🔥 ~${plan.totalCal} kcal</span><span class="px-3 py-1.5 rounded-full bg-white text-teal text-xs font-bold">${plan.level}</span><span class="px-3 py-1.5 rounded-full bg-white/15 border border-white/20 text-xs font-semibold">🎵 ${musicByAge[plan.group].label}</span>`;
document.getElementById('workoutTotalCal').textContent='~'+plan.totalCal;
document.getElementById('workoutTotalTime').textContent=`~${plan.totalMin} min • ${plan.exercises.length} exercises`;
const inten=plan.group==='teens'?75:plan.group==='kids'?55:plan.group==='seniors'?30:45;
document.getElementById('workoutIntensityBar').style.width=inten+'%';
document.getElementById('workoutIntensityLabel').textContent=`Intensity: ${inten>65?'High':inten>40?'Moderate':'Gentle'} • Great for ${p.goal} goal`;
document.getElementById('workoutLevelBadge').textContent=plan.level;
const grid=document.getElementById('workoutGrid'); grid.innerHTML='';
plan.exercises.forEach((e,i)=>{
const cal=Math.round(e.met*p.weight*(e.mins/60));
const d=document.createElement('div'); d.className='work-card bg-slate-50 border border-slate-200 rounded-2xl p-3 flex gap-3';
d.innerHTML=`<div class="w-11 h-11 rounded-xl bg-white border flex items-center justify-center text-2xl shrink-0">${e.icon}</div><div class="flex-1 min-w-0"><p class="font-bold text-sm">${e.name}</p><p class="text-[11px] text-slate-500">${e.sets} • ${e.reps} • ${e.mins} min • <b class="text-coral">~${cal} kcal</b></p><p class="text-xs text-slate-600 mt-1 leading-relaxed">${e.desc}</p></div><button onclick="logExerciseIdx(${i})" class="w-9 h-9 rounded-full border bg-white flex items-center justify-center shrink-0 hover:bg-teal hover:text-white font-bold" title="Log as done">✓</button>`;
grid.appendChild(d);
});
document.getElementById('workoutWhy').innerHTML=`
<div class="flex gap-2 bg-teal-50 border border-teal/15 rounded-xl p-2.5"><span>⚖️</span><p class="text-xs"><b>BMI ${calcBmi(p).toFixed(1)} (${bmiCategory(p).split(' ')[0]}):</b> ${calcBmi(p)>=25?'low-impact picks protect joints while burning steadily.':'balanced mix maintains healthy range.'}</p></div>
<div class="flex gap-2 bg-violet-50 border border-violet-200 rounded-xl p-2.5"><span>🎯</span><p class="text-xs"><b>Goal “${p.goal}”:</b> ${p.goal==='muscle'?'extra sets on push/squat for strength.':p.goal==='light'?'lighter cardio + core for mindful lightness.':p.goal==='energy'?'morning cardio bias for all-day energy.':'even mix of cardio + strength.'}</p></div>
<div class="flex gap-2 bg-amber-50 border border-amber-200 rounded-xl p-2.5"><span>🌤️</span><p class="text-xs"><b>Climate ${p.climate} + activity ${p.activity}:</b> ${p.climate==='hot'?'hydrate 250ml before/after, prefer morning/evening.':'steady pace; warm-up 2 min extra if cold.'} Water target ${(state.hydration.goal/1000).toFixed(1)}L supports this plan.</p></div>`;
document.getElementById('workoutSleepTip').textContent=`With ${p.sleep}h sleep, ${p.sleep<7?'keep workouts light & finish 3h before bed for better rest.':'keep intense sessions before evening for better rest.'} ${plan.group==='seniors'?'Chair nearby, non-slip footwear.':''}`;
const sel=document.getElementById('logExercise'); sel.innerHTML=plan.exercises.map((e,i)=>`<option value="${i}">${e.name} (~${Math.round(e.met*p.weight*(e.mins/60))} kcal)</option>`).join('');
renderBurn();
}
function exCal(e){ const p=state.profile||demoProfiles.adults; return Math.round(e.met*p.weight*(e.mins/60)); }
function logExerciseIdx(i){ const p=state.profile||demoProfiles.adults; const plan=getWorkoutPlan(p); const e=plan.exercises[i]; const cal=exCal(e); state.workoutLogs.push({date:todayStr(), name:e.name, mins:e.mins, cal}); markTodayStreak(true); save(); renderBurn(); renderStreakCalendar(); showToast(`Logged ${e.name} • ~${cal} kcal 🔥`); celebrate(); }
function logFullPlan(){ const p=state.profile||demoProfiles.adults; const plan=getWorkoutPlan(p); plan.exercises.forEach(e=>state.workoutLogs.push({date:todayStr(), name:e.name, mins:e.mins, cal:exCal(e)})); markTodayStreak(true); save(); renderBurn(); renderStreakCalendar(); showToast(`Full plan logged • ~${plan.totalCal} kcal 🎉`); celebrate(); }
function logCustomWorkout(){ const p=state.profile||demoProfiles.adults; const plan=getWorkoutPlan(p); const idx=parseInt(document.getElementById('logExercise').value)||0; const mins=parseInt(document.getElementById('logMins').value)||15; const e=plan.exercises[idx]; const cal=Math.round(e.met*p.weight*(mins/60)); state.workoutLogs.push({date:todayStr(), name:e.name, mins, cal}); markTodayStreak(true); save(); renderBurn(); renderStreakCalendar(); showToast(`+${cal} kcal logged`); }
function renderBurn(){
const logs=state.workoutLogs||[];
const t=todayStr(); const todayLogs=logs.filter(l=>l.date===t);
document.getElementById('burnToday').textContent=todayLogs.reduce((s,l)=>s+l.cal,0);
let week=0; for(let i=0;i<7;i++){ const ds=todayStr(-i); week+=logs.filter(l=>l.date===ds).reduce((s,l)=>s+l.cal,0); }
document.getElementById('burnWeek').textContent=week;
const list=document.getElementById('burnLogList'); const recent=[...logs].reverse().slice(0,4);
list.innerHTML=recent.length?recent.map(l=>`<div class="flex items-center gap-2 bg-slate-50 border rounded-xl px-3 py-2 text-sm"><span class="w-8 h-8 rounded-full bg-white border flex items-center justify-center">🔥</span><span class="flex-1 font-semibold">${l.name} <span class="text-xs text-slate-500 font-normal">• ${l.mins} min • ${l.date}</span></span><span class="font-extrabold text-coral">~${l.cal}</span></div>`).join(''):'<p class="text-xs text-slate-400 text-center py-2">No workouts logged yet — tap ✓ on any exercise above.</p>';
drawBurnChart();
}
function drawBurnChart(){
const ctx=document.getElementById('burnChart'); if(!ctx) return;
if(burnChartInstance) burnChartInstance.destroy();
const labels=[], data=[]; for(let i=6;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); labels.push(d.toLocaleDateString('en-US',{weekday:'short'})); const ds=d.toISOString().slice(0,10); data.push((state.workoutLogs||[]).filter(l=>l.date===ds).reduce((s,l)=>s+l.cal,0)); }
const dark=state.theme==='dark';
burnChartInstance=new Chart(ctx,{type:'bar',data:{labels,datasets:[{data,backgroundColor:['#0F766E','#14B8A6','#7C3AED','#EC4899','#F59E0B','#10B981','#FF6B5A'],borderRadius:8}]},options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:dark?'#23405E':'#E2E8F0'},ticks:{color:dark?'#8AA0B8':'#64748B'}},x:{grid:{display:false},ticks:{color:dark?'#8AA0B8':'#64748B'}}},maintainAspectRatio:false}});
}

/* MUSIC */
function currentMusicGroup(){ return getWorkoutPlan(state.profile||demoProfiles.adults).group; }
function renderMusic(){
const g=currentMusicGroup(); const data=musicByAge[g];
document.getElementById('musicSubtitle').textContent='Picked for '+(g[0].toUpperCase()+g.slice(1))+'s • '+data.label.split('•')[1];
const q=(document.getElementById('musicSearch')?.value||'').toLowerCase();
const list=document.getElementById('musicList'); list.innerHTML='';
data.tracks.forEach((t,i)=>{
if(q && !(t.title+t.artist+t.mood).toLowerCase().includes(q)) return;
const playing=currentTrackIdx===i && currentAudio && !currentAudio.paused;
const row=document.createElement('div'); row.className=`flex items-center gap-3 p-2.5 rounded-2xl border ${playing?'border-violet-300 bg-violet-50':'border-slate-200 bg-slate-50'}`;
row.innerHTML=`<div class="w-11 h-11 rounded-xl bg-gradient-to-br ${t.color} text-white flex items-center justify-center shrink-0">${playing?'<div class="eq"><span></span><span></span><span></span><span></span></div>':'<span class="text-lg">🎵</span>'}</div><div class="flex-1 min-w-0"><p class="font-bold text-sm truncate">${t.title}</p><p class="text-[11px] text-slate-500 truncate">${t.artist} • ${t.mood} • ${t.dur}</p></div><button onclick="playTrack(${i})" class="w-9 h-9 rounded-full ${playing?'bg-violet-600 text-white':'bg-white border'} flex items-center justify-center shrink-0 font-bold">${playing?'⏸':'▶'}</button>`;
list.appendChild(row);
});
lucide.createIcons();
}
function playTrack(i){
const g=currentMusicGroup(); const t=musicByAge[g].tracks[i];
if(currentAudio){ currentAudio.pause(); clearInterval(musicProgressInt); }
if(currentTrackIdx===i && currentAudio && currentAudio.src===t.audio){ currentTrackIdx=-1; updateNowPlaying(null); renderMusic(); return; }
currentTrackIdx=i; currentAudio=new Audio(t.audio); currentAudio.volume=0.6; currentAudio.play().catch(()=>{});
document.getElementById('globalEq').classList.remove('paused');
updateNowPlaying(t); renderMusic();
document.getElementById('musicPlayBtn').innerHTML='<i data-lucide="pause" class="w-5 h-5"></i>'; lucide.createIcons();
let sec=0; const total=parseInt(t.dur.split(':')[0])*60+parseInt(t.dur.split(':')[1]);
musicProgressInt=setInterval(()=>{ if(!currentAudio||currentAudio.paused) return; sec++; const pct=Math.min(100,sec/total*100); document.getElementById('musicProgress').style.width=pct+'%'; document.getElementById('musicTime').textContent=`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`; if(sec>=total||currentAudio.ended){ clearInterval(musicProgressInt); playTrack((i+1)%musicByAge[g].tracks.length); } },1000);
showToast(`Playing: ${t.title} 🎶`);
}
function toggleMainPlay(){
if(currentTrackIdx===-1){ playTrack(0); return; }
if(currentAudio.paused){ currentAudio.play(); document.getElementById('musicPlayBtn').innerHTML='<i data-lucide="pause" class="w-5 h-5"></i>'; }
else{ currentAudio.pause(); document.getElementById('musicPlayBtn').innerHTML='<i data-lucide="play" class="w-5 h-5"></i>'; }
lucide.createIcons(); renderMusic();
}
function updateNowPlaying(t){
document.getElementById('nowPlayingTitle').textContent=t?t.title:'Select a track to start';
document.getElementById('nowPlayingArtist').textContent=t?(t.artist+' • '+t.mood):'Preview beats • demo audio';
if(!t){ document.getElementById('musicProgress').style.width='0%'; document.getElementById('musicTime').textContent='0:00'; document.getElementById('musicPlayBtn').innerHTML='<i data-lucide="play" class="w-5 h-5"></i>'; lucide.createIcons(); }
}

/* SETTINGS */
function renderSettings(){
const p=state.profile||demoProfiles.adults;
document.getElementById('settingsProfileSummary').innerHTML=`<p class="font-bold">${p.name} • ${p.age}y • ${p.sex}</p><p class="text-xs text-slate-500 mt-1">${Math.round(p.height)}cm • ${Math.round(p.weight)}kg • BMI ${calcBmi(p).toFixed(1)} • ${p.diet} • ${p.activity} • 💤 ${p.sleep}h • 🎯 ${p.goal}</p><p class="text-[11px] text-slate-400 mt-1">Water ${(state.hydration.goal/1000).toFixed(1)}L • Workouts logged: ${(state.workoutLogs||[]).length} • Streak days: ${Object.values(state.streakMap).filter(Boolean).length}</p>`;
renderHeaderAvatar();
}

/* NAV */
function switchView(v){
document.querySelectorAll('.view').forEach(s=>s.classList.remove('active'));
document.getElementById('view-'+v).classList.add('active');
document.querySelectorAll('.navBtn').forEach(b=>{ if(b.dataset.nav===v) b.className='navBtn w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-teal text-white font-semibold text-sm'; else b.className='navBtn w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 font-medium text-sm text-slate-700'; });
document.querySelectorAll('.navBtnM').forEach(b=>{ if(b.dataset.navM===v) b.className='navBtnM flex flex-col items-center gap-1 py-2 rounded-xl bg-teal text-white'; else b.className='navBtnM flex flex-col items-center gap-1 py-2 rounded-xl text-slate-500'; });
window.scrollTo({top:0,behavior:'smooth'}); lucide.createIcons();
if(v==='workout'){ renderWorkout(); renderMusic(); }
if(v==='dashboard'){ renderDashboard(); }
}
function toggleReduceMotion(v){ state.reduceMotion=v; save(); showToast(v?'Celebrations muted':'Celebrations on'); }

/* VITA */
function openVita(){ document.getElementById('vitaPanel').classList.remove('hidden'); }
function closeVita(){ document.getElementById('vitaPanel').classList.add('hidden'); }
function sendVita(){
const inp=document.getElementById('vitaInput'); const q=inp.value.trim(); if(!q) return; inp.value='';
const box=document.getElementById('vitaMessages');
box.innerHTML+=`<div class="ml-auto max-w-[85%] bg-teal text-white rounded-2xl rounded-br-sm p-3 text-sm">${q}</div>`;
const p=state.profile||demoProfiles.adults; const plan=getWorkoutPlan(p);
let a='You can explore Dashboard, Hydration, Meals, Workout (with music + calorie burn) and Settings from the side menu. Your data stays on this device. 💚';
const l=q.toLowerCase();
if(l.includes('water')||l.includes('hydrat')) a=`Your water estimate is ${(state.hydration.goal/1000).toFixed(1)}L/day from weight (${Math.round(p.weight)}kg), climate (${p.climate}) & activity (${p.activity}). You've logged ${(state.hydration.consumed/1000).toFixed(2)}L today. Sip steadily! 💧`;
else if(l.includes('bmi')) a=`BMI tool: your profile BMI is ${calcBmi(p).toFixed(1)} (${bmiCategory(p)}). Try the interactive BMI Calculator on the dashboard — drag height/weight and hit “Save to profile”. General info only. 📏`;
else if(l.includes('workout')||l.includes('exercise')||l.includes('calorie')||l.includes('burn')) a=`Today’s plan: ${plan.exercises.length} exercises, ~${plan.totalMin} min, ~${plan.totalCal} kcal (${plan.level}). Open Workout tab, tap ✓ to log, and watch the burn chart. Music picked for ${plan.group}s! 🔥🎵`;
else if(l.includes('music')||l.includes('song')) a=`Tap the music icon in Workout — playlists change by age: playful for kids, bold for teens, focus for adults, gentle classics for seniors. Hit ▶ for demo previews! 🎶`;
else if(l.includes('streak')||l.includes('calendar')) a=`Streak calendar marks days you meet water goal or log a workout (green) vs missed (light). Current gentle streak is on your dashboard. No punishment — just awareness! 📅`;
else if(l.includes('meal')||l.includes('diet')||l.includes('non')||l.includes('veg')) a=`Meals respect ${p.diet} diet and allergies (${(p.allergies||[]).join(', ')||'none'}). Non-veg option adds chicken/egg/fish with veg alternatives. Tap any card for recipe, servings & timer! 🍛`;
else if(l.includes('photo')||l.includes('avatar')||l.includes('picture')) a=`Profile picture is optional! Skip it and we auto-create an animated avatar from gender, age & height-weight. Edit anytime via Edit profile. 📸`;
else if(l.includes('dark')||l.includes('theme')) a=`Dark mode is fixed! Toggle moon/sun in header or Settings — cards, inputs, charts all adapt. Currently ${state.theme}. 🌙`;
else if(l.includes('hindi')||l.includes('language')) a=`We support English (default) & Hindi. Switch in header. नमस्ते! 🇮🇳`;
setTimeout(()=>{ box.innerHTML+=`<div class="bg-white border border-slate-200 rounded-2xl rounded-bl-sm p-3 text-sm text-slate-600">${a}</div>`; box.scrollTop=box.scrollHeight; },400);
box.scrollTop=box.scrollHeight;
}
