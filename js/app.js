// Configure these with the Project URL and publishable (anon) key from your Supabase project.
const SUPABASE_URL = 'https://eqsqbjqemjxsaixmffqf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_I7A_OzeOZq-LRAbdB0U2EA_ok3rK2eO';
// Safe to publish; replace with the PUBLIC key generated in docs/PUSH_REMINDERS_SETUP.md.
const VITALIS_PUSH_PUBLIC_KEY = 'PASTE_PUBLIC_VAPID_KEY_HERE';
const supabaseClient = window.supabase && !SUPABASE_URL.includes('YOUR_PROJECT_ID') && !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE')
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
const defaultState={ user:null, profile:null, ageStyle:'adults', units:'metric', lang:'en', theme:'light', hydration:{ consumed:0, goal:2300, glasses:[false,false,false,false,false,false,false,false], scheduleDone:{} }, reduceMotion:false, reminders:false, servings:2, prepStyle:'standard', mealPlanVersion:0, mealPlanOverrides:{}, workoutLogs:[], streakMap:{}, dailyRecords:{}, dailyPlanDate:null, workoutFeedback:{}, workoutAttendance:{}, workoutTrackingStartDate:null, profilePic:null, profilePicTemp:null };
function freshState(user=null){ return {...defaultState,user,hydration:{...defaultState.hydration,glasses:[...defaultState.hydration.glasses],scheduleDone:{}},workoutLogs:[],streakMap:{},dailyRecords:{},dailyPlanDate:null,workoutFeedback:{},workoutAttendance:{},mealPlanOverrides:{},workoutTrackingStartDate:null}; }
let state=freshState();
let currentUserId=null, loadingAccountId=null, loadingAccountPromise=null, cloudSaveTimer=null, cloudSaveQueue=Promise.resolve();
let passwordRecoveryActive=false;
let authMode='signin', currentStep=1, currentMealDay=(new Date().getDay()+6)%7, mealData=[], mealPlanBuiltForWeek=null, mealPlanLastSeenDate=todayStr(), activeMealSwapType=null, mealSwapCandidates=[], chartInstance=null, burnChartInstance=null, timerInterval=null, timerSeconds=1200, timerRunning=false, currentRecipe=null, currentAudio=null, currentTrackIdx=-1, musicProgressInt=null;

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
  state={...freshState({id:user.id,email:user.email}),...saved,user:{id:user.id,email:user.email},hydration:{...defaultState.hydration,...(saved.hydration||{}),scheduleDone:{...(saved.hydration?.scheduleDone||{})}},workoutLogs:Array.isArray(saved.workoutLogs)?saved.workoutLogs:[],streakMap:saved.streakMap||{},dailyRecords:saved.dailyRecords||{},dailyPlanDate:saved.dailyPlanDate||null,workoutFeedback:saved.workoutFeedback||{},workoutAttendance:saved.workoutAttendance||{},mealPlanVersion:Number(saved.mealPlanVersion)||0,mealPlanOverrides:saved.mealPlanOverrides||{},workoutTrackingStartDate:saved.workoutTrackingStartDate||null};
  currentUserId=user.id; loadingAccountId=null; loadingAccountPromise=null;
  syncDailyPlan();
  applyAgeStyle(state.ageStyle); applyTheme(false); setUnits(state.units,false); generateMeals(); renderAll(); applyLang();
  if(state.profile) showApp(true); else showProfileSetup();
  if(state.reminders && state.profile) syncExistingHydrationPush();
  if(!data) save();
 })();
 return loadingAccountPromise;
}
async function signOut(){ if(!supabaseClient){showAuthStatus('Connect this website to Supabase before signing in.',true);return;} try{await flushCloudSave();const {error}=await supabaseClient.auth.signOut();if(error)throw error;showSignedOut();showToast('You have been signed out.');}catch(error){console.error(error);showToast('Could not sign out. Please try again.');} }
function todayStr(offset=0){ const d=new Date(); d.setDate(d.getDate()+offset); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); }
function shiftDateKey(dateKey,offset){ const [y,m,d]=dateKey.split('-').map(Number); const value=new Date(y,m-1,d+offset,12); return [value.getFullYear(),String(value.getMonth()+1).padStart(2,'0'),String(value.getDate()).padStart(2,'0')].join('-'); }
function syncDailyPlan(){
 const today=todayStr(); state.dailyRecords=state.dailyRecords||{}; state.streakMap=state.streakMap||{}; state.workoutFeedback=state.workoutFeedback||{}; state.workoutAttendance=state.workoutAttendance||{};
 const previous=state.dailyPlanDate; let changed=false;
 if(!state.workoutTrackingStartDate){state.workoutTrackingStartDate=today;changed=true;}
 if(previous&&previous<today){
  for(let day=previous;day<today;day=shiftDateKey(day,1)){
   if(!state.dailyRecords[day]){
    const logs=(state.workoutLogs||[]).filter(log=>log.date===day);
    state.dailyRecords[day]={waterMl:day===previous?Number(state.hydration.consumed)||0:0,waterGoal:Number(state.hydration.goal)||2300,workoutCount:Math.max(logs.length,getCompletedWorkoutAttendanceCount(day))};
   }
   const record=state.dailyRecords[day];
   state.streakMap[day]=Number(record.waterMl)>=Number(state.hydration.goal)||Number(record.workoutCount)>0;
  }
  state.hydration={...state.hydration,consumed:0,glasses:Array.from({length:Math.max(1,Math.ceil(state.hydration.goal/250))},()=>false),scheduleDone:{}};
  state.dailyPlanDate=today; changed=true;
 }else if(previous!==today){state.dailyPlanDate=today;changed=true;}
 if(changed) save();
}
function getStreakDayData(dateKey){
 const record=state.dailyRecords?.[dateKey]||{};
 const logs=(state.workoutLogs||[]).filter(log=>log.date===dateKey);
 const waterMl=dateKey===todayStr()?Number(state.hydration.consumed)||0:Number(record.waterMl)||0;
 const waterGoal=Number(dateKey===todayStr()?state.hydration.goal:record.waterGoal)||Number(state.hydration.goal)||2300;
 const workoutCount=dateKey===todayStr()?Math.max(logs.length,getCompletedWorkoutAttendanceCount(dateKey)):Math.max(Number(record.workoutCount??logs.length)||0,getCompletedWorkoutAttendanceCount(dateKey));
 const legacyOnly=!state.dailyRecords?.[dateKey]&&dateKey<todayStr()&&state.streakMap?.[dateKey]===true;
 const waterDone=waterMl>=waterGoal||legacyOnly, workoutDone=workoutCount>0;
 const completed=legacyOnly?1:Number(waterDone)+Number(workoutDone);
 const total=legacyOnly?1:2;
 const status=legacyOnly?'complete':completed===2?'complete':completed>0?'partial':dateKey>=todayStr()?'pending':'missed';
 return {dateKey,waterMl,waterGoal,waterDone,workoutCount,workoutDone,completed,total,status,logs,legacyOnly};
}
function showStreakDay(dateKey){
 const panel=document.getElementById('streakDayDetails'); if(!panel) return;
 const data=getStreakDayData(dateKey);
 const date=new Date(dateKey+'T12:00:00').toLocaleDateString(state.lang==='hi'?'hi-IN':'en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
 const statusLabel={complete:'All targets completed',partial:'Some targets completed',missed:'No targets completed',pending:'Day in progress'}[data.status];
 const waterLine=data.waterDone?'Water goal completed':'Water goal not completed';
 const workoutLine=data.workoutDone?'Workout completed':'Workout not completed';
 const logLines=data.logs.map(log=>'<li>'+log.name+' • '+log.mins+' min • ~'+log.cal+' kcal</li>').join('');
 panel.classList.remove('hidden');
 panel.innerHTML='<div class="flex items-start justify-between gap-3"><div><p class="text-sm font-bold">'+date+'</p><p class="text-xs text-slate-500 mt-1">'+statusLabel+' • '+data.completed+'/'+data.total+' targets</p></div><button type="button" onclick="document.getElementById(\'streakDayDetails\').classList.add(\'hidden\')" class="text-xs text-slate-500 underline">Close</button></div><div class="grid sm:grid-cols-2 gap-2 mt-3"><div class="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm"><p class="font-bold">💧 Hydration</p><p class="text-slate-600 mt-1">'+data.waterMl.toLocaleString()+' / '+data.waterGoal.toLocaleString()+' ml</p><p class="text-xs mt-1 '+(data.waterDone?'text-emerald-700':'text-rose-600')+'">'+waterLine+'</p></div><div class="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm"><p class="font-bold">🏃 Workout</p><p class="text-slate-600 mt-1">'+data.workoutCount+' workout'+(data.workoutCount===1?'':'s')+' logged</p><p class="text-xs mt-1 '+(data.workoutDone?'text-emerald-700':'text-rose-600')+'">'+workoutLine+'</p>'+(logLines?'<ul class="text-xs text-slate-500 mt-2 space-y-1">'+logLines+'</ul>':'')+'</div></div>';
}

document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushCloudSave();});
document.addEventListener('DOMContentLoaded', async()=>{
 lucide.createIcons(); applyAgeStyle(state.ageStyle); applyTheme(false); setUnits(state.units,false);
 document.getElementById('customMl').addEventListener('input', e=>{ document.getElementById('customMlLabel').textContent=e.target.value+' ml'; });
 document.getElementById('waterTargetRange').addEventListener('input', e=>{ document.getElementById('waterTargetLabel').textContent=e.target.value+' ml'; state.hydration.goal=parseInt(e.target.value); save(); renderHydration(); renderDashboard(); });
 document.getElementById('bmiToolH').addEventListener('input', updateBmiTool); document.getElementById('bmiToolW').addEventListener('input', updateBmiTool);
 document.getElementById('reduceMotion').checked=state.reduceMotion||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 document.getElementById('waterTargetRange').value=state.hydration.goal; generateMeals(); renderAll(); updateAutoAvatarLive(); applyLang();
 if(!supabaseClient){ showAuthStatus('Account sign-in is not configured yet. Add your Supabase Project URL and publishable key, then run docs/SUPABASE_SETUP.md.',true); return; }
 setInterval(()=>{if(state.dailyPlanDate!==todayStr()){syncDailyPlan();generateMeals();renderAll();}},60000);
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
const mealIngredientAliases={
 peanut:['peanut','peanuts'],dairy:['dairy','milk','curd','yogurt','yoghurt','cheese','paneer','ghee','butter'],
 gluten:['gluten','wheat','atta','bread','roti','semolina','suji','rava'],soy:['soy','soya','tofu'],
 egg:['egg','eggs'],fish:['fish'],shellfish:['shellfish','prawn','shrimp','crab'],
 chicken:['chicken'],potato:['potato','potatoes'],rice:['rice'],garlic:['garlic'],onion:['onion']
};
function normalizeFoodTerm(value){ return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/s\b/,''); }
function mealSearchText(meal){ return [meal.name,...(meal.ingredients||[]).map(item=>item.item),...(meal.tags||[])].join(' ').toLowerCase(); }
function mealContainsTerm(meal,term){
 const normalized=normalizeFoodTerm(term);
 if(!normalized) return false;
 const text=mealSearchText(meal);
 const aliasGroup=Object.values(mealIngredientAliases).find(list=>list.some(item=>normalizeFoodTerm(item)===normalized));
 const terms=aliasGroup||[normalized];
 return terms.some(item=>new RegExp('(^|[^a-z0-9])'+item.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'([^a-z0-9]|$)','i').test(text));
}
function mealFitsBudget(meal,p){
 const order={low:0,medium:1,high:2};
 const chosen=order[p?.budget]??1,required=order[meal?.budget]??1;
 return required<=chosen;
}
function mealOk(meal, p){
 if(!meal||!Array.isArray(meal.diet)||!Array.isArray(meal.tags)) return false;
 let dietOk=false;
 if(p.diet==='vegan') dietOk=meal.diet.includes('vegan');
 else if(p.diet==='vegetarian') dietOk=meal.diet.includes('vegetarian')||meal.diet.includes('vegan');
 else if(p.diet==='pescatarian') dietOk=meal.diet.includes('pescatarian')||meal.diet.includes('vegetarian')||meal.diet.includes('vegan');
 else if(p.diet==='nonveg') dietOk=meal.diet.includes('nonveg')||meal.diet.includes('omnivore')||meal.diet.includes('vegetarian')||meal.diet.includes('vegan');
 else if(p.diet==='omnivore') dietOk=true;
 else if(p.diet==='jain') dietOk=(meal.diet.includes('vegetarian')||meal.diet.includes('vegan'))&&!/onion|garlic|potato|radish|carrot|beet/i.test(mealSearchText(meal));
 else dietOk=meal.diet.includes('vegetarian')||meal.diet.includes('vegan');
 if(!dietOk||!mealFitsBudget(meal,p)) return false;
 return !(p.allergies||[]).some(allergy=>meal.tags.includes(allergy)||mealContainsTerm(meal,allergy));
}
function mealProteinHint(meal){
 return /dal|lentil|rajma|beans|chana|sprout|tofu|egg|chicken|fish|paneer|curd|yogurt|peanut|peanuts|keema/i.test(mealSearchText(meal));
}
function mealCarbHint(meal){
 return /poha|oats|rice|roti|paratha|millet|bread|potato|wheat|fruit|banana/i.test(mealSearchText(meal));
}
function mealPlanScore(meal,type,p,workout){
 const strength=/strength/i.test(workout.focus),active=/cardio|sport|play|movement/i.test(workout.focus);
 let score=0;
 if(strength&&mealProteinHint(meal)) score+=4;
 if(active&&mealCarbHint(meal)) score+=3;
 if(p.goal==='muscle'&&p.age>=18&&mealProteinHint(meal)) score+=2;
 if(p.age<18&&['breakfast','snack'].includes(type)&&mealProteinHint(meal)) score+=1;
 if(p.age>=65&&mealProteinHint(meal)) score+=1;
 return score;
}
function mealHash(value){ let hash=2166136261; for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);} return hash>>>0; }
function chooseMealForDay(type,p,workout,dateKey,used){
 const eligible=(mealPool[type]||[]).filter(meal=>mealOk(meal,p));
 if(!eligible.length) return null;
 const ranked=eligible.map(meal=>({meal,score:mealPlanScore(meal,type,p,workout)-(used.has(meal.name)?3:0)})).sort((a,b)=>b.score-a.score);
 const top=ranked.filter(row=>row.score>=ranked[0].score-1);
 const seed=[p.id||p.name,p.age,p.sex,p.activity,p.diet,dateKey,type,state.mealPlanVersion||0].join('|');
 const overrideName=state.mealPlanOverrides?.[dateKey]?.[type];
 const override=overrideName&&eligible.find(meal=>meal.name===overrideName);
 return override||top[mealHash(seed)%top.length].meal;
}
function getAdultEnergyReference(p){
 const age=Number(p.age),height=Number(p.height),weight=Number(p.weight),sex=String(p.sex||'').toLowerCase();
 if(age<19||!Number.isFinite(height)||!Number.isFinite(weight)||!['female','male'].includes(sex)) return null;
 const activity=String(p.activity||'light').toLowerCase();
 const level=activity==='sedentary'?'inactive':activity==='light'?'low':activity==='active'?'very':'active';
 const factors=sex==='male'?{inactive:[753.07,-10.83,6.50,14.10],low:[581.47,-10.83,8.30,14.94],active:[1004.82,-10.83,6.52,15.91],very:[-517.88,-10.83,15.61,19.11]}:{inactive:[584.90,-7.01,5.72,11.71],low:[575.77,-7.01,6.60,12.14],active:[710.25,-7.01,6.54,12.34],very:[511.83,-7.01,9.07,12.56]};
 const [base,ageFactor,heightFactor,weightFactor]=factors[level];
 const estimate=base+ageFactor*age+heightFactor*height+weightFactor*weight;
 return Number.isFinite(estimate)&&estimate>0?Math.round(estimate/50)*50:null;
}
function renderMealPlanContext(profile,dateKey){
 const target=document.getElementById('mealPersonalizationText');
 if(!target) return;
 const plan=getWorkoutPlan(profile,dateKey),focus=plan.focus.toLowerCase();
 const dateLabel=new Date(dateKey+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'});
 const profileText='Meals for '+dateLabel+' use your age, profile sex, activity, goal, food preference, allergies and '+plan.totalMin+'-minute '+focus+' workout as planning context.';
 if(profile.age<19){
  target.textContent=profileText+' This is a growth-first menu: no adult calorie estimate or weight-loss restriction is applied. Check labels and ingredient handling for allergy safety.';
  return;
 }
 const energy=getAdultEnergyReference(profile);
 target.textContent=profileText+(energy?' A broad adult maintenance-energy reference is about '+energy.toLocaleString()+' kcal/day; it is not a meal cap or medical prescription.':' No calorie target is shown because the profile is missing inputs for an adult estimate.')+' This general estimate is not for pregnancy, breastfeeding or medical diets. Check labels and ingredient handling for allergy safety.';
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
 syncDailyPlan();
 const now=new Date(),y=now.getFullYear(),m=now.getMonth(),today=todayStr();
 document.getElementById('streakMonthLabel').textContent=now.toLocaleDateString(state.lang==='hi'?'hi-IN':'en-US',{month:'long',year:'numeric'})+' • Green = all targets, blue = partial, red = missed';
 const first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate();
 let html='',monthDone=0,monthTotal=0;
 for(let i=0;i<first;i++) html+='<div></div>';
 for(let d=1;d<=days;d++){
  const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const data=getStreakDayData(ds),isToday=ds===today;
  let cls='bg-slate-50 border-slate-100 text-slate-400',icon='';
  if(data.status==='complete'){cls='bg-emerald-500 text-white border-emerald-600 shadow';icon='✓';monthDone++;monthTotal++;}
  else if(data.status==='partial'){cls='bg-sky-500 text-white border-sky-600 shadow-sm';icon=data.completed+'/'+data.total;monthTotal++;}
  else if(data.status==='missed'){cls='bg-rose-100 text-rose-600 border-rose-200';icon='✕';monthTotal++;}
  else if(ds>today){cls='bg-slate-50/50 border-slate-100 text-slate-300';}
  if(isToday) cls+=' ring-2 ring-teal ring-offset-1';
  html+=`<button type="button" class="cal-cell ${cls} ${isToday?'font-black':''}" aria-label="Show performance for ${ds}" onclick="showStreakDay('${ds}')">${d}<span class="text-[9px] leading-none">${isToday?'TODAY':icon}</span></button>`;
 }
 grid.innerHTML=html;
 let current=0;
 for(let i=0;i<366;i++){const data=getStreakDayData(shiftDateKey(today,-i));if(data.status==='complete')current++;else break;}
 document.getElementById('streakCurrent').textContent=current;
 document.getElementById('dashStreakChip').textContent=current+'-day gentle streak';
 let best=0,run=0;
 const known=Object.keys(state.dailyRecords||{}).concat(Object.keys(state.streakMap||{}),[today]).sort();
 const firstKnownDate=known[0]||today;
 for(let ds=firstKnownDate;ds<=today;ds=shiftDateKey(ds,1)){if(getStreakDayData(ds).status==='complete'){run++;best=Math.max(best,run);}else run=0;}
 document.getElementById('streakBest').textContent=Math.max(best,current);
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
function vitalisBase64UrlToBytes(value){
 const padded=value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4);
 return Uint8Array.from(atob(padded),c=>c.charCodeAt(0));
}
function currentHydrationTimeZone(){ return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'; }
async function saveHydrationPushSubscription(subscription){
 const userId=currentUserId;
 if(!userId||!supabaseClient) throw new Error('Sign in before enabling reminders.');
 const subscriptionJson=subscription.toJSON();
 if(!subscriptionJson.keys?.p256dh||!subscriptionJson.keys?.auth) throw new Error('This browser returned an incomplete push subscription.');
 const {error}=await supabaseClient.from('push_subscriptions').upsert({
  user_id:userId,
  endpoint:subscription.endpoint,
  subscription_json:subscriptionJson,
  time_zone:currentHydrationTimeZone(),
 },{onConflict:'user_id,endpoint'});
 if(error) throw error;
}
async function syncExistingHydrationPush(){
 if(!state.reminders||!currentUserId||!supabaseClient||typeof Notification==='undefined'||Notification.permission!=='granted'||!('serviceWorker' in navigator)||!('PushManager' in window)||!VITALIS_PUSH_PUBLIC_KEY||VITALIS_PUSH_PUBLIC_KEY.includes('PASTE_')) return;
 try{
  const registration=await navigator.serviceWorker.register('/service-worker.js');
  const subscription=await registration.pushManager.getSubscription();
  if(subscription) await saveHydrationPushSubscription(subscription);
 }catch(error){ console.warn('Could not refresh VITALIS push reminder registration:',error); }
}
async function toggleReminders(enabled){
 const toggle=document.getElementById('reminderToggle');
 if(!enabled){
  state.reminders=false; save();
  try{
   await flushCloudSave();
   if(currentUserId&&supabaseClient&&'serviceWorker' in navigator){
    const registration=await navigator.serviceWorker.getRegistration('/');
    const subscription=await registration?.pushManager.getSubscription();
    if(subscription){
     const {error}=await supabaseClient.from('push_subscriptions').delete().eq('user_id',currentUserId).eq('endpoint',subscription.endpoint);
     if(error) throw error;
     await subscription.unsubscribe();
    }
   }
   showToast('Hydration reminders turned off.');
  }catch(error){
   console.error('Could not fully remove this device from hydration reminders:',error);
   showToast('Reminders are off in VITALIS. This device could not be unregistered.');
  }
  if(toggle) toggle.checked=false;
  return;
 }
 try{
  if(!currentUserId||!supabaseClient) throw new Error('Sign in to your VITALIS account first.');
  if(!window.isSecureContext) throw new Error('Notifications need the secure HTTPS website address.');
  if(typeof Notification==='undefined'||!('serviceWorker' in navigator)||!('PushManager' in window)) throw new Error('This browser does not support web push notifications.');
  if(!VITALIS_PUSH_PUBLIC_KEY||VITALIS_PUSH_PUBLIC_KEY.includes('PASTE_')) throw new Error('Push reminders need one-time setup. See docs/PUSH_REMINDERS_SETUP.md.');
  const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
  if(permission!=='granted') throw new Error('Allow notifications in your browser to receive hydration reminders.');
  const registration=await navigator.serviceWorker.register('/service-worker.js');
  let subscription=await registration.pushManager.getSubscription();
  if(!subscription) subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vitalisBase64UrlToBytes(VITALIS_PUSH_PUBLIC_KEY)});
  await saveHydrationPushSubscription(subscription);
  state.reminders=true; save(); await flushCloudSave();
  if(toggle) toggle.checked=true;
  showToast('Hydration reminders are on for this device.');
 }catch(error){
  state.reminders=false; save(); if(toggle) toggle.checked=false;
  console.error('Could not enable VITALIS hydration reminders:',error);
  showToast(error?.message||'Could not enable reminders. Check your notification settings and setup.');
 }
}
function celebrate(){ if(state.reduceMotion) return; if(state.ageStyle==='kids'){ for(let i=0;i<24;i++){ const c=document.createElement('div'); c.className='confetti'; c.style.left=Math.random()*100+'vw'; c.style.background=['#FF6B5A','#FFD93D','#6BCB77','#4D96FF','#B983FF'][i%5]; c.style.borderRadius=Math.random()>0.5?'50%':'4px'; document.body.appendChild(c); setTimeout(()=>c.remove(),1500); } } }

/* MEALS */
function generateMeals(){
 const p=state.profile||demoProfiles.adults,dates=weekDateKeys(todayStr()),usedByType={breakfast:new Set(),lunch:new Set(),dinner:new Set(),snack:new Set()};
 mealData=dates.map(dateKey=>{
  const workout=getWorkoutPlan(p,dateKey),day={};
  for(const type of Object.keys(usedByType)){
   const meal=chooseMealForDay(type,p,workout,dateKey,usedByType[type]);
   day[type]=meal;
   if(meal) usedByType[type].add(meal.name);
  }
  return day;
 });
 currentMealDay=(new Date().getDay()+6)%7;
 mealPlanBuiltForWeek=dates[0]; mealPlanLastSeenDate=todayStr();
 renderMeals();
}
function shuffleMeals(){ state.mealPlanVersion=(Number(state.mealPlanVersion)||0)+1; state.mealPlanOverrides={}; save(); generateMeals(); showToast('Your week’s meals have been reshuffled.'); }
function renderMeals(){
const p=state.profile||demoProfiles.adults;
const dates=weekDateKeys(todayStr()),today=todayStr(),todayIndex=(new Date().getDay()+6)%7;
if(mealData.length!==7||mealPlanBuiltForWeek!==dates[0]){ generateMeals(); return; }
if(mealPlanLastSeenDate!==today){currentMealDay=todayIndex;mealPlanLastSeenDate=today;}
const dietLabel={omnivore:'Omnivore • Everything',nonveg:'Non-vegetarian • Veg + Chicken/Egg/Fish',vegetarian:'Vegetarian • Balanced',vegan:'Vegan • Plant-based',pescatarian:'Pescatarian • Fish + Veg',jain:'Jain adaptable • Veg'}[p.diet]||p.diet;
document.getElementById('mealDietChip').textContent=dietLabel;
document.getElementById('mealBudgetLabel').textContent=(p.budget||'medium')[0].toUpperCase()+(p.budget||'medium').slice(1);
renderMealPlanContext(p,dates[currentMealDay]);
const tabs=document.getElementById('dayTabs'); tabs.innerHTML='';
['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach((d,i)=>{ const b=document.createElement('button'); b.onclick=()=>{ currentMealDay=i; renderMeals(); }; b.className=`shrink-0 px-4 py-2 rounded-full text-sm font-bold border ${i===currentMealDay?'bg-teal text-white border-teal':'bg-white border-slate-200'}`; const dayDate=new Date(dates[i]+'T12:00:00').getDate(); b.textContent=(i===todayIndex?'Today • ':'')+d+' '+dayDate; tabs.appendChild(b); });
const day=mealData[currentMealDay]||{},grid=document.getElementById('mealGrid'); grid.innerHTML='';
[['breakfast','Breakfast','🌅'],['lunch','Lunch','☀️'],['dinner','Dinner','🌙'],['snack','Snack','🍎']].forEach(([k,label,emoji])=>{
 const m=day[k],card=document.createElement('div');
 if(!m){card.className='meal-card bg-white border p-4 text-sm text-slate-500';card.textContent='No menu option currently matches this meal slot, budget and saved food restrictions. Review the profile filters to see options.';grid.appendChild(card);return;}
 card.className='meal-card bg-white border p-4 cursor-pointer card-hover'; card.onclick=()=>openRecipe(m,k);
 const isNonveg=m.tags.includes('nonveg')||m.diet.includes('nonveg')||/chicken|egg|fish/i.test(m.name);
 card.innerHTML=`<div class="flex items-start gap-3"><div class="w-11 h-11 rounded-2xl bg-slate-50 flex items-center justify-center text-2xl shrink-0">${m.icon}</div><div class="flex-1 min-w-0"><p class="text-[10px] font-bold tracking-widest text-slate-400">${emoji} ${label.toUpperCase()} • ${m.time} MIN • ${m.diff.toUpperCase()}</p><p class="font-bold text-sm leading-snug mt-0.5">${m.name}</p><div class="flex flex-wrap gap-1 mt-2">${isNonveg?'<span class="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 font-bold">🍗 Non-veg</span>':''}${m.tags.includes('peanut')?'<span class="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 border">🥜</span>':''}${m.tags.includes('dairy')?'<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border">🥛</span>':''}${m.tags.includes('gluten')?'<span class="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border">🌾</span>':''}<span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 border font-bold">${m.cal} kcal</span></div></div></div><div class="mt-3 flex items-center justify-between"><span class="text-xs font-bold text-teal">View recipe →</span><button type="button" class="mealSwapBtn text-xs font-bold px-3 py-1.5 rounded-full bg-teal-50 text-teal border border-teal/20">↻ Swap dish</button><span class="text-[11px] text-slate-400">Serves 2 • Scales</span></div>`;
 card.querySelector('.mealSwapBtn').addEventListener('click',event=>{event.stopPropagation();openMealSwap(k);});
 grid.appendChild(card);
});
lucide.createIcons();
}

function openMealSwap(type){
 const meal=mealData[currentMealDay]?.[type];
 if(!meal){showToast('There is no current dish to swap.');return;}
 activeMealSwapType=type; mealSwapCandidates=[];
 document.getElementById('mealSwapCurrent').textContent='Current '+type+': '+meal.name;
 document.getElementById('missingIngredientsInput').value='';
 document.getElementById('mealSwapResults').innerHTML='';
 document.getElementById('mealSwapPanel').classList.remove('hidden');
 document.getElementById('mealSwapPanel').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function closeMealSwap(){
 const panel=document.getElementById('mealSwapPanel'); if(panel) panel.classList.add('hidden');
 activeMealSwapType=null; mealSwapCandidates=[];
}
function findMealSwaps(){
 if(!activeMealSwapType) return;
 const p=state.profile||demoProfiles.adults,dateKey=weekDateKeys(todayStr())[currentMealDay];
 const current=mealData[currentMealDay]?.[activeMealSwapType],plan=getWorkoutPlan(p,dateKey);
 const missing=(document.getElementById('missingIngredientsInput').value||'').split(/[,;\n]+/).map(value=>value.trim()).filter(Boolean);
 const options=(mealPool[activeMealSwapType]||[]).filter(meal=>mealOk(meal,p)&&meal.name!==current?.name&&!missing.some(term=>mealContainsTerm(meal,term)))
  .map(meal=>({meal,score:mealPlanScore(meal,activeMealSwapType,p,plan)})).sort((a,b)=>b.score-a.score);
 mealSwapCandidates=options.slice(0,5).map(row=>row.meal);
 const results=document.getElementById('mealSwapResults'); results.innerHTML='';
 if(!mealSwapCandidates.length){
  const note=document.createElement('p');note.className='text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded-xl p-3';note.textContent='No other dish in this meal slot matches the saved diet, allergy and budget filters plus the unavailable ingredients. Try fewer missing ingredients or review the profile restrictions.';results.appendChild(note);return;
 }
 mealSwapCandidates.forEach((meal,index)=>{
  const button=document.createElement('button');button.type='button';button.className='w-full text-left bg-white border border-slate-200 rounded-xl p-3 hover:border-teal flex items-center gap-3';
  const icon=document.createElement('span');icon.className='text-xl';icon.textContent=meal.icon;
  const details=document.createElement('span');details.className='flex-1';
  const title=document.createElement('b');title.className='block text-sm';title.textContent=meal.name;
  const meta=document.createElement('span');meta.className='block text-xs text-slate-500 mt-1';meta.textContent=meal.cal+' kcal • '+meal.time+' min • '+meal.diff+' • fits today’s plan';
  details.append(title,meta);const choose=document.createElement('span');choose.className='text-xs font-bold text-teal';choose.textContent='Use dish';
  button.append(icon,details,choose);button.addEventListener('click',()=>applyMealSwap(index));results.appendChild(button);
 });
}
function applyMealSwap(index){
 const meal=mealSwapCandidates[index],type=activeMealSwapType;
 if(!meal||!type||!mealOk(meal,state.profile||demoProfiles.adults)) return;
 const dateKey=weekDateKeys(todayStr())[currentMealDay];
 mealData[currentMealDay][type]=meal;
 state.mealPlanOverrides=state.mealPlanOverrides||{};
 state.mealPlanOverrides[dateKey]={...(state.mealPlanOverrides[dateKey]||{}),[type]:meal.name};
 save();closeMealSwap();renderMeals();showToast('Dish swapped for '+dateKey+'; your other daily meals stay the same.');
}

function generateShoppingList(){ const day=mealData[currentMealDay]||{}; let items=[]; Object.values(day).filter(Boolean).forEach(m=>m.ingredients.forEach(ing=>items.push(`${ing.item} — ${ing.qty*state.servings/2}${ing.unit}`))); document.getElementById('shoppingList').classList.remove('hidden'); document.getElementById('shoppingItems').innerHTML=items.map(i=>`<li>${i}</li>`).join(''); showToast('Shopping list ready 🧺'); document.getElementById('shoppingList').scrollIntoView({behavior:'smooth'}); }

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
function getCompletedWorkoutAttendanceCount(dateKey){
 return Object.values(state.workoutAttendance?.[dateKey]||{}).filter(Boolean).length;
}
function hasWorkoutOnDate(dateKey){
 return (state.workoutLogs||[]).some(log=>log.date===dateKey)||getCompletedWorkoutAttendanceCount(dateKey)>0;
}
function isWorkoutExerciseComplete(dateKey,name){
 const checks=state.workoutAttendance?.[dateKey]||{};
 if(Object.prototype.hasOwnProperty.call(checks,name)) return Boolean(checks[name]);
 return (state.workoutLogs||[]).some(log=>log.date===dateKey&&log.name===name);
}
function weekDateKeys(dateKey=todayStr()){
 const mondayOffset=(new Date(dateKey+'T12:00:00').getDay()+6)%7;
 return Array.from({length:7},(_,i)=>shiftDateKey(dateKey,i-mondayOffset));
}
function getWorkoutAdaptation(asOfDate=todayStr()){
 const today=asOfDate,start=state.workoutTrackingStartDate||today;
 let missedDays=0;
 const profile=state.profile||demoProfiles.adults;
 const group=profile.age<=12?'kids':profile.age<=17?'teens':profile.age>=60?'seniors':'adults';
 for(let offset=1;offset<=14&&missedDays<7;offset++){
  const date=shiftDateKey(today,-offset);
  if(date<start) break;
  if(weeklyWorkoutFocus(group,date)==='Recovery') continue;
  if(hasWorkoutOnDate(date)) break;
  missedDays++;
 }
 const feedbackDates=Object.keys(state.workoutFeedback||{}).filter(date=>date<today&&date>=shiftDateKey(today,-3)).sort();
 const lastFeedback=feedbackDates.length?state.workoutFeedback[feedbackDates[feedbackDates.length-1]]:null;
 let mode='steady';
 if(missedDays>=3||lastFeedback==='hard') mode='gentle';
 else if(missedDays>0) mode='restart';
 else if(lastFeedback==='easy'&&profile.age>=20&&profile.age<60) mode='progress';
 return {missedDays,lastFeedback,mode};
}
function toggleWeeklyWorkoutAttendance(dateKey,index){
 if(dateKey>todayStr()) return;
 const profile=state.profile||demoProfiles.adults;
 const plan=getWorkoutPlan(profile,dateKey);
 const exercise=plan.exercises[index];
 if(!exercise) return;
 state.workoutAttendance=state.workoutAttendance||{};
 state.workoutAttendance[dateKey]=state.workoutAttendance[dateKey]||{};
 const checks=state.workoutAttendance[dateKey];
 const complete=isWorkoutExerciseComplete(dateKey,exercise.name);
 checks[exercise.name]=!complete;
 const logs=(state.workoutLogs||[]).filter(log=>log.date===dateKey);
 const workoutCount=Math.max(logs.length,getCompletedWorkoutAttendanceCount(dateKey));
 if(dateKey<todayStr()){
  state.dailyRecords=state.dailyRecords||{};
  const record=state.dailyRecords[dateKey]||{};
  state.dailyRecords[dateKey]={...record,workoutCount};
  const waterDone=Number(record.waterMl)>=Number(record.waterGoal||state.hydration.goal);
  state.streakMap[dateKey]=Boolean(waterDone||workoutCount>0);
 }else if(workoutCount>0){
  state.streakMap[dateKey]=true;
 }
 save();
 renderWeeklyWorkoutPlan(profile);
 renderStreakCalendar();
 showToast(checks[exercise.name]?'Exercise marked attended.':'Exercise unmarked.');
}
function renderWeeklyWorkoutPlan(profile=state.profile||demoProfiles.adults){
 const grid=document.getElementById('weeklyWorkoutGrid');
 if(!grid) return;
 const today=todayStr(),dates=weekDateKeys(today);
 grid.innerHTML=dates.map(dateKey=>{
  const plan=getWorkoutPlan(profile,dateKey);
  const doneCount=plan.exercises.filter(ex=>isWorkoutExerciseComplete(dateKey,ex.name)).length;
  const future=dateKey>today,isToday=dateKey===today;
  const dateLabel=new Date(dateKey+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
  const items=plan.exercises.map((ex,index)=>{
   const checked=isWorkoutExerciseComplete(dateKey,ex.name);
   return '<label class="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs '+(checked?'text-teal-dark':'text-slate-600')+'"><input type="checkbox" class="mt-0.5 accent-teal" '+(checked?'checked ':'')+(future?'disabled ':'')+'aria-label="Mark '+ex.name+' attended" onchange="toggleWeeklyWorkoutAttendance(\''+dateKey+'\','+index+')"><span class="flex-1"><b>'+ex.name+'</b><span class="block text-[11px] text-slate-500">'+ex.sets+' • '+ex.reps+' • '+ex.mins+' min</span></span></label>';
  }).join('');
  return '<details class="rounded-xl border border-slate-200 bg-white overflow-hidden" '+(isToday?'open':'')+'><summary class="cursor-pointer list-none flex flex-wrap items-center gap-2 p-3 hover:bg-slate-50"><span class="font-bold text-sm">'+dateLabel+(isToday?' • Today':'')+'</span><span class="text-xs text-teal font-semibold">'+plan.focus+'</span><span class="ml-auto text-[11px] text-slate-500">'+doneCount+'/'+plan.exercises.length+' attended</span></summary><div class="px-3 pb-3 grid sm:grid-cols-2 gap-2">'+items+'</div></details>';
 }).join('');
}
function weeklyWorkoutFocus(group,dateKey=todayStr()){
 const day=new Date(dateKey+'T12:00:00').getDay();
 const schedules={
  adults:['Recovery','Strength A','Cardio','Mobility','Strength B','Cardio','Enjoyable movement'],
  teens:['Recovery','Strength A','Cardio','Mobility','Strength B','Cardio','Sport or active play'],
  seniors:['Recovery','Strength + balance','Cardio','Balance + mobility','Strength + balance','Cardio','Gentle movement']
 };
 return (schedules[group]||[])[day]||'Active play';
}
function movementSession(focus,group){
 if(group==='kids'&&/Mobility|Recovery|Gentle movement/.test(focus)) return [
  {name:'Easy dance and freeze game',icon:'💃',sets:'2 songs',reps:'Move at your own pace',mins:6,met:3,desc:'Keep it playful and pause whenever you like; adult supervision is recommended.'},
  {name:'Superhero stretch',icon:'🦸',sets:'1 round',reps:'Gentle stretches',mins:4,met:2,desc:'Reach and breathe gently; never force a stretch.'}
 ];
 if(/Cardio/.test(focus)) return [
  {name:'Easy warm-up walk',icon:'🚶',sets:'1 round',reps:'Easy pace',mins:5,met:3,desc:'Start gently and let breathing settle into a comfortable rhythm.'},
  {name:'Steady walk or cycle',icon:'🚴',sets:'1 round',reps:'Talkable pace',mins:18,met:4,desc:'Choose a pace where conversation is still possible; slow down whenever needed.'},
  {name:'Cool-down + gentle stretch',icon:'🧘',sets:'1 round',reps:'Easy flow',mins:5,met:2.5,desc:'Ease the pace, then gently stretch without forcing a range of motion.'}
 ];
 if(/Mobility|Recovery|Gentle movement/.test(focus)) return [
  {name:'Comfortable walk or march',icon:'🚶',sets:'1 round',reps:'Easy pace',mins:6,met:2.8,desc:'Keep the effort light; this is a recovery session, not a catch-up workout.'},
  {name:'Shoulder and ankle mobility',icon:'🔄',sets:'2 rounds',reps:'6 each side',mins:4,met:2,desc:'Move slowly through a comfortable range; skip anything that causes pain.'},
  {name:'Gentle stretch and breathing',icon:'🌿',sets:'1 round',reps:'Slow breaths',mins:5,met:2,desc:'Relax your shoulders and breathe comfortably. No bouncing or forced stretches.'}
 ];
 if(/Balance/.test(focus)) return [
  {name:'Supported march in place',icon:'🪑',sets:'2 rounds',reps:'30 sec',mins:4,met:2.8,desc:'Stand near a stable chair or counter and hold support as needed.'},
  {name:'Chair sit-to-stand',icon:'🪑',sets:'2 sets',reps:'6-8 reps',mins:4,met:3,desc:'Use a sturdy chair and hands for support if needed; move at a controlled pace.'},
  {name:'Ankle circles + heel raises',icon:'🔄',sets:'2 sets',reps:'8 each',mins:4,met:2.5,desc:'Hold stable support, keep the movements small and comfortable.'},
  {name:'Slow walk + breathing',icon:'🌿',sets:'1 round',reps:'Easy pace',mins:5,met:2.5,desc:'Finish with a relaxed walk; stop if you feel unsteady or unwell.'}
 ];
 if(group==='teens') return [
  {name:'Choose a sport or active game',icon:'⚽',sets:'1 round',reps:'Enjoyable pace',mins:20,met:5,desc:'Pick an activity you enjoy; keep it social and take breaks when needed.'},
  {name:'Easy warm-up',icon:'🤸',sets:'1 round',reps:'5 min',mins:5,met:3,desc:'Begin with easy movement before increasing pace.'},
  {name:'Cool-down walk',icon:'🚶',sets:'1 round',reps:'Easy pace',mins:5,met:2.5,desc:'Gradually slow down and recover.'}
 ];
 if(group==='kids') return [
  {name:'Dance and freeze game',icon:'💃',sets:'3 songs',reps:'Move at your own pace',mins:8,met:4,desc:'Make it playful. Pause whenever you need and keep an adult nearby.'},
  {name:'Animal walks',icon:'🐻',sets:'2 rounds',reps:'10 easy steps',mins:5,met:3.5,desc:'Choose fun, comfortable movements; no racing or pushing through pain.'},
  {name:'Superhero stretch',icon:'🦸',sets:'1 round',reps:'Gentle stretches',mins:3,met:2,desc:'Reach and breathe gently with adult supervision.'}
 ];
 return [
  {name:'Easy walk',icon:'🚶',sets:'1 round',reps:'Comfortable pace',mins:10,met:2.8,desc:'A short reset at an easy, talkable pace.'},
  {name:'Gentle mobility',icon:'🔄',sets:'1 round',reps:'5 min',mins:5,met:2,desc:'Move joints gently in a comfortable range; stop if anything hurts.'},
  {name:'Relaxed cool-down',icon:'🌿',sets:'1 round',reps:'Slow breathing',mins:3,met:2,desc:'Take a few comfortable breaths and finish without rushing.'}
 ];
}
function saveWorkoutFeedback(value){
 state.workoutFeedback=state.workoutFeedback||{}; state.workoutFeedback[todayStr()]=value; save(); renderWorkout();
 showToast('Thanks — your next plan will adapt to that feedback.');
}
function getWorkoutPlan(p,dateKey=todayStr()){
const age=p.age;
let group='adults'; if(age<=12) group='kids'; else if(age<=17) group='teens'; else if(age>=60) group='seniors';
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

if(p.goal==='muscle'&&group!=='kids'&&group!=='seniors'){ ex.forEach(e=>{ if(/push|squat|lunge/i.test(e.name)) e.sets='4 sets'; }); }

const focus=weeklyWorkoutFocus(group,dateKey);
if(!['kids'].includes(group)&&focus!=='Strength A'&&focus!=='Strength B'&&focus!=='Strength + balance'&&focus!=='Sport or active play') ex=movementSession(focus,group);
else if(group==='teens'&&focus==='Sport or active play') ex=movementSession(focus,group);
if(group==='teens'&&(focus==='Strength A'||focus==='Strength B')) ex=[
 {name:'Easy warm-up walk',icon:'🚶',sets:'1 round',reps:'4 min',mins:4,met:3,desc:'Start easy and increase pace only if it feels comfortable.'},
 {name:'Incline push-ups',icon:'💪',sets:'2 sets',reps:'8-10 reps',mins:4,met:4,desc:'Use a sturdy counter or wall; stop before form breaks.'},
 {name:'Bodyweight squats',icon:'🦵',sets:'2 sets',reps:'8-10 reps',mins:4,met:4,desc:'Move smoothly within a comfortable range.'},
 {name:'Glute bridges',icon:'🌉',sets:'2 sets',reps:'10 reps',mins:4,met:3,desc:'Keep the movement controlled; skip if uncomfortable.'},
 {name:'Dead bug',icon:'🧘',sets:'2 sets',reps:'6 each side',mins:4,met:3,desc:'Move slowly and breathe steadily.'},
 {name:'Cool-down stretch',icon:'🌿',sets:'1 round',reps:'4 min',mins:4,met:2,desc:'Gentle stretches only; no bouncing or forcing.'}
 ];
if(p.activity==='sedentary') ex=ex.map(e=>({...e,mins:Math.max(2,Math.round(e.mins*.8)),sets:e.sets.replace(/(\\d+) sets?/,(_,n)=>Math.max(1,Math.floor(Number(n)*.8))+' sets')}));
const adaptation=dateKey>todayStr()?{missedDays:0,lastFeedback:null,mode:'steady'}:getWorkoutAdaptation(dateKey);
if(adaptation.mode==='gentle') ex=movementSession('Recovery',group);
else if(adaptation.mode==='restart') ex=ex.map(e=>({...e,mins:Math.max(2,Math.round(e.mins*.75)),sets:e.sets.replace(/(\d+) sets?/,(_,n)=>Math.max(1,Math.floor(Number(n)*.75))+' sets')}));
else if(adaptation.mode==='progress'&&group==='adults') ex=ex.map((e,i)=>({...e,mins:i===0?e.mins+2:e.mins}));
let totalCal=Math.round(ex.reduce((s,e)=>s+e.met*p.weight*(e.mins/60),0));
let totalMin=ex.reduce((s,e)=>s+e.mins,0);
return {group,focus,adaptation,exercises:ex,totalCal,totalMin,level:group==='kids'?'Playful • No equipment':group==='seniors'?'Gentle • Chair support':p.activity==='sedentary'?'Beginner-friendly':'Balanced • Progressive'};
}
function renderWorkoutPreviewChip(){ const p=state.profile||demoProfiles.adults; const plan=getWorkoutPlan(p); const el=document.getElementById('dashWorkoutPreview'); if(el) el.textContent=`${plan.level.split('•')[0]} • ~${plan.totalMin} min • ~${plan.totalCal} kcal`; }
function renderWorkout(){
const p=state.profile||demoProfiles.adults; const plan=getWorkoutPlan(p);
renderWeeklyWorkoutPlan(p);
const coach=document.getElementById('workoutCoachCard');
if(coach){
 const miss=plan.adaptation.missedDays;
 const feedback=state.workoutFeedback?.[todayStr()];
 const note=plan.adaptation.mode==='gentle'
  ?'After a tougher session or several missed sessions, today is a short, low-impact reset. No catch-up workouts.'
  :plan.adaptation.mode==='restart'
   ?'You missed '+miss+' planned session'+(miss===1?'':'s')+'. Today is scaled down so you can restart comfortably.'
   :plan.adaptation.mode==='progress'
    ?'Your recent session felt easy, so today adds a small amount of time. Progress stays gradual.'
    :'Your recent activity supports the regular plan for today.';
 coach.innerHTML='<div class="flex flex-col sm:flex-row sm:items-center gap-3"><div class="flex-1"><p class="font-bold text-sm">🧭 Adaptive coach • '+plan.focus+'</p><p class="text-xs text-slate-600 mt-1">'+note+'</p><p class="text-[11px] text-slate-500 mt-1">Built from logged workouts and your effort feedback. Rest days do not count as missed sessions.</p></div><div class="flex flex-wrap gap-2" aria-label="How did your last workout feel?"><button onclick="saveWorkoutFeedback(\'easy\')" class="px-3 py-2 rounded-full border text-xs font-bold '+(feedback==='easy'?'bg-teal text-white border-teal':'bg-white border-slate-200')+'">Too easy</button><button onclick="saveWorkoutFeedback(\'right\')" class="px-3 py-2 rounded-full border text-xs font-bold '+(feedback==='right'?'bg-teal text-white border-teal':'bg-white border-slate-200')+'">About right</button><button onclick="saveWorkoutFeedback(\'hard\')" class="px-3 py-2 rounded-full border text-xs font-bold '+(feedback==='hard'?'bg-teal text-white border-teal':'bg-white border-slate-200')+'">Too hard</button></div></div>';
}
document.getElementById('workoutEyebrow').textContent=`SUGGESTED FOR ${p.name.toUpperCase()} • ${p.activity.toUpperCase()} • ${p.goal.toUpperCase()}`;
const titles={kids:'Playful power • Fun & bouncy 🌈',teens:'Fresh & fierce • HIIT energy ⚡',adults:'Balanced full-body • Gentle & steady 💪',seniors:'Steady & safe • Chair-friendly ☀️'};
document.getElementById('workoutTitle').textContent=(titles[plan.group]||titles.adults)+' • '+plan.focus;
document.getElementById('workoutDesc').textContent=`A ${plan.focus.toLowerCase()} session shaped by your age group, activity level, goal and recent check-ins. ${plan.group==='seniors'?'Use stable support for balance work and stop if unsteady.':plan.group==='kids'||plan.group==='teens'?'Add active play or sport through the day; this plan is only one part of daily movement.':'Choose a comfortable pace and stop if you feel pain or unwell.'}`;
document.getElementById('workoutChips').innerHTML=`<span class="px-3 py-1.5 rounded-full bg-white/15 border border-white/20 text-xs font-semibold">⏱ ${plan.totalMin} min</span><span class="px-3 py-1.5 rounded-full bg-white/15 border border-white/20 text-xs font-semibold">🔥 ~${plan.totalCal} kcal</span><span class="px-3 py-1.5 rounded-full bg-white text-teal text-xs font-bold">${plan.level}</span><span class="px-3 py-1.5 rounded-full bg-white/15 border border-white/20 text-xs font-semibold">${plan.focus}</span><span class="px-3 py-1.5 rounded-full bg-white/15 border border-white/20 text-xs font-semibold">🎵 ${musicByAge[plan.group].label}</span>`;
document.getElementById('workoutTotalCal').textContent='~'+plan.totalCal;
document.getElementById('workoutTotalTime').textContent=`~${plan.totalMin} min • ${plan.exercises.length} exercises`;
const inten=plan.adaptation.mode==='gentle'?25:plan.adaptation.mode==='restart'?35:plan.group==='teens'?60:plan.group==='kids'?55:plan.group==='seniors'?30:45;
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
<div class="flex gap-2 bg-teal-50 border border-teal/15 rounded-xl p-2.5"><span>🏃</span><p class="text-xs"><b>Starting point:</b> ${p.activity==='sedentary'?'shorter sessions ease you in; build gradually.':'a varied mix balances movement and recovery.'} Choose comfortable options and skip any movement that causes pain.</p></div>
<div class="flex gap-2 bg-violet-50 border border-violet-200 rounded-xl p-2.5"><span>🎯</span><p class="text-xs"><b>Goal “${p.goal}”:</b> ${p.goal==='muscle'?'extra sets on push/squat for strength.':p.goal==='light'?'lighter cardio + core for mindful lightness.':p.goal==='energy'?'morning cardio bias for all-day energy.':'even mix of cardio + strength.'}</p></div>
<div class="flex gap-2 bg-amber-50 border border-amber-200 rounded-xl p-2.5"><span>🌤️</span><p class="text-xs"><b>Climate ${p.climate} + activity ${p.activity}:</b> ${p.climate==='hot'?'hydrate 250ml before/after, prefer morning/evening.':'steady pace; warm-up 2 min extra if cold.'} Water target ${(state.hydration.goal/1000).toFixed(1)}L supports this plan.</p></div>`;
document.getElementById('workoutSleepTip').textContent=`With ${p.sleep}h sleep, ${p.sleep<7?'keep workouts light & finish 3h before bed for better rest.':'keep intense sessions before evening for better rest.'} ${plan.group==='seniors'?'Chair nearby, non-slip footwear.':''}`;
const sel=document.getElementById('logExercise'); sel.innerHTML=plan.exercises.map((e,i)=>`<option value="${i}">${e.name} (~${Math.round(e.met*p.weight*(e.mins/60))} kcal)</option>`).join('');
renderBurn();
}
function exCal(e){ const p=state.profile||demoProfiles.adults; return Math.round(e.met*p.weight*(e.mins/60)); }
function logExerciseIdx(i){ const p=state.profile||demoProfiles.adults; const plan=getWorkoutPlan(p); const e=plan.exercises[i]; const cal=exCal(e); state.workoutLogs.push({date:todayStr(), name:e.name, mins:e.mins, cal}); markTodayStreak(true); save(); renderBurn(); renderStreakCalendar(); renderWorkout(); showToast(`Logged ${e.name} • ~${cal} kcal 🔥`); celebrate(); }
function logFullPlan(){ const p=state.profile||demoProfiles.adults; const plan=getWorkoutPlan(p); plan.exercises.forEach(e=>state.workoutLogs.push({date:todayStr(), name:e.name, mins:e.mins, cal:exCal(e)})); markTodayStreak(true); save(); renderBurn(); renderStreakCalendar(); renderWorkout(); showToast(`Full plan logged • ~${plan.totalCal} kcal 🎉`); celebrate(); }
function logCustomWorkout(){ const p=state.profile||demoProfiles.adults; const plan=getWorkoutPlan(p); const idx=parseInt(document.getElementById('logExercise').value)||0; const mins=parseInt(document.getElementById('logMins').value)||15; const e=plan.exercises[idx]; const cal=Math.round(e.met*p.weight*(mins/60)); state.workoutLogs.push({date:todayStr(), name:e.name, mins, cal}); save(); renderBurn(); renderStreakCalendar(); renderWorkout(); showToast(`+${cal} kcal logged`); }
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
