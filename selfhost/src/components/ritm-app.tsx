"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { StatsScreen } from "@/components/stats";
import { BodyCard } from "@/components/body-card";
import { CoinsChip, Leaderboard, Milestone, RepairCard } from "@/components/progress-extras";
import { Onboarding } from "@/components/onboarding";
import { basalRate, goalCalories, maintenance } from "@/lib/body";

type Tab = "today" | "stats" | "friends" | "profile";
type Person = { id:string; name:string; username?:string|null; image?:string|null; relationship?:string; status?:string; sentByMe?:boolean };
type FeedEvent = { id:number; type:string; payload:{days?:number;minutes?:number}; createdAt:string; name:string; username?:string };
type Entry = { id:string; title:string; calories:number };
type WeightPoint = { date:string; weightKg:number };
type Workout = { id:string; title:string; minutes:number; calories:number|null; date:string };
type AppUser = { id:string; name:string; email:string; username?:string|null };
type HealthSnapshot = { calorieGoal?:number; activeCalories:number; steps?:number|null; exerciseMinutes?:number|null; weightKg:number|null; healthSyncedAt?:string|null };
type HealthToken = { token:string; lastUsedAt:string|null };
type HealthKitDetail = { date?:string; activeCalories?:number; steps?:number; exerciseMinutes?:number; weightKg?:number|null; error?:string };
type Theme = "system"|"light"|"dark";
type InstallPromptEvent = Event&{
  prompt:()=>Promise<void>;
  userChoice:Promise<{outcome:"accepted"|"dismissed"}>;
};

declare global {
  interface Window {
    ritmHealthKitAvailable?:boolean;
    webkit?:{messageHandlers?:{ritmHealth?:{postMessage:(message:{action:string})=>void}}};
  }
}

/** 1 день, 2 дня, 5 дней — иначе на экране висит «1 дней». */
function plural(count:number, one:string, few:string, many:string) {
  const tens=count%100, units=count%10;
  if(tens>10&&tens<20) return many;
  if(units===1) return one;
  if(units>=2&&units<=4) return few;
  return many;
}

function todayKey(date=new Date()) {
  const year=date.getFullYear();
  const month=String(date.getMonth()+1).padStart(2,"0");
  const day=String(date.getDate()).padStart(2,"0");
  return `${year}-${month}-${day}`;
}

async function jsonFetch<T>(url:string, init?:RequestInit):Promise<T> {
  const response=await fetch(url,{...init,headers:{"Content-Type":"application/json",...(init?.headers??{})}});
  if(!response.ok) throw new Error((await response.json().catch(()=>({}))).error??"request_failed");
  return response.json();
}

/** На iPhone браузер не даёт запустить установку кодом, поэтому показываем
 * короткую инструкцию. В браузерах с системным окном установки кнопка вызывает его. */
function InstallAppOffer() {
  const [open,setOpen]=useState(false);
  const [installed,setInstalled]=useState(false);
  const [promptEvent,setPromptEvent]=useState<InstallPromptEvent|null>(null);
  const [note,setNote]=useState("");
  useEffect(()=>{
    const standalone=window.matchMedia("(display-mode: standalone)").matches
      ||(window.navigator as Navigator&{standalone?:boolean}).standalone===true;
    queueMicrotask(()=>setInstalled(standalone));
    const capture=(event:Event)=>{event.preventDefault();setPromptEvent(event as InstallPromptEvent);};
    window.addEventListener("beforeinstallprompt",capture);
    return()=>window.removeEventListener("beforeinstallprompt",capture);
  },[]);
  function toggleGuide(){setNote("");setOpen(current=>!current);}
  async function runInstall(){
    if(!promptEvent)return;
    await promptEvent.prompt();
    const choice=await promptEvent.userChoice;
    if(choice.outcome==="accepted"){setInstalled(true);setNote("Готово — Ритм появится на домашнем экране ✓");}
    else setNote("Можно установить позже этой же кнопкой.");
    setPromptEvent(null);
  }
  return <div className={`auth-install ${installed?"installed":""}`}>
    <button type="button" className="auth-install-button" onClick={toggleGuide} aria-expanded={open}>
      <span aria-hidden>{installed?"✓":"📲"}</span><span><b>{installed?"Ритм уже установлен":"Установить на iPhone"}</b><small>{installed?"Открыто как отдельное приложение":"Будет на экране Домой, как обычное приложение"}</small></span><i>{open?"⌃":"›"}</i>
    </button>
    {open&&<div className="auth-install-guide pop-in">
      {note?<p className="install-result">{note}</p>:installed
        ? <p><b>Всё работает.</b> Если захочешь поставить Ритм на другой iPhone, открой <b>ritmup.ru</b> в Safari и повтори шаги ниже.</p>
        : <p><b>На iPhone это занимает несколько секунд:</b></p>}
      <ol><li>Открой <b>ritmup.ru</b> именно в Safari.</li><li>Нажми <b>Поделиться</b> <span aria-hidden>□↑</span>.</li><li>Выбери <b>«На экран „Домой“»</b> → <b>«Добавить»</b>.</li></ol>
      {promptEvent&&!installed&&<button type="button" className="primary install-now" onClick={()=>void runInstall()}>Установить прямо сейчас</button>}
      {!installed&&<small>После этого Ритм откроется без адресной строки. Обновления будут приходить автоматически.</small>}
    </div>}
  </div>;
}

function AuthScreen() {
  const googleEnabled=process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED==="true";
  const [mode,setMode]=useState<"signin"|"signup">("signup");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data=new FormData(event.currentTarget);
    const password=String(data.get("password"));
    if(mode==="signup") {
      const result=await authClient.signUp.email({email:String(data.get("email")),password,
        name:String(data.get("name")),username:String(data.get("username"))});
      if(result.error) setError(result.error.message??"Не получилось создать аккаунт");
    } else {
      // Поле одно на оба случая: с «собакой» считаем почтой, без неё — ником.
      const login=String(data.get("login")).trim();
      const result=login.includes("@")
        ? await authClient.signIn.email({email:login,password})
        : await authClient.signIn.username({username:login,password});
      if(result.error) setError(result.error.message??"Неверный ник, почта или пароль");
    }
    setBusy(false);
  }
  return <main className="auth-shell">
    <section className="auth-card pop-in">
      <div className="mascot" aria-hidden>🔥</div>
      <p className="eyebrow">РИТМ</p><h1>Маленькие шаги.<br/>Каждый день.</h1>
      <p className="muted">Питание, движение и серия дней — просто и без рекламы.</p>
      <InstallAppOffer/>
      <div className="segmented"><button className={mode==="signup"?"active":""} onClick={()=>setMode("signup")}>Регистрация</button><button className={mode==="signin"?"active":""} onClick={()=>setMode("signin")}>Войти</button></div>
      <form onSubmit={submit} className="auth-form">
        {mode==="signup"
          ? <><label>Как тебя зовут<input name="name" required maxLength={60} autoComplete="name" placeholder="Лиза"/></label>
              <label>Уникальный ник<input name="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_.]+" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="liza.moves"/></label>
              <label>Почта<input name="email" type="email" required autoComplete="email" placeholder="you@example.com"/></label></>
          : <label>Ник или почта<input name="login" required autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="liza.moves"/></label>}
        <label>Пароль<input name="password" type="password" required minLength={8} autoComplete={mode==="signup"?"new-password":"current-password"} placeholder="Минимум 8 символов"/></label>
        {error&&<p className="error">{error}</p>}
        <button className="primary" disabled={busy}>{busy?"Секунду…":mode==="signup"?"Создать аккаунт":"Войти"}</button>
      </form>
      {googleEnabled&&<button className="google" onClick={()=>authClient.signIn.social({provider:"google",callbackURL:"/"})}>G&nbsp;&nbsp; Продолжить с Google</button>}
      <p className="fineprint">{googleEnabled?"Можно войти через Google или по почте.":"Входить можно по нику или по почте. Google подключим позже."}</p>
    </section>
  </main>;
}

function Sparkline({points}:{points:WeightPoint[]}) {
  if(points.length<2) return null;
  const values=points.map(p=>p.weightKg);
  const min=Math.min(...values), max=Math.max(...values), span=max-min||1;
  const step=100/(points.length-1);
  const path=values.map((v,i)=>`${i?"L":"M"}${(i*step).toFixed(2)},${(28-((v-min)/span)*24).toFixed(2)}`).join(" ");
  return <svg className="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden>
    <path d={path} fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
  </svg>;
}

function WeightCard({date}:{date:string}) {
  const [history,setHistory]=useState<WeightPoint[]>([]);
  const [value,setValue]=useState(""); const [busy,setBusy]=useState(false); const [note,setNote]=useState("");
  const load=()=>jsonFetch<WeightPoint[]>("/api/weight").then(setHistory).catch(()=>{});
  useEffect(()=>{void load();},[date]);
  const today=history.find(point=>point.date===date);
  const earlier=history.filter(point=>point.date!==date);
  const previous=earlier.length?earlier[earlier.length-1]:undefined;
  const shown=today??previous;
  const delta=today&&previous?today.weightKg-previous.weightKg:null;
  async function save(event:FormEvent){
    event.preventDefault();
    const kilograms=Number(value.replace(",","."));
    if(!kilograms||kilograms<20||kilograms>400){setNote("Вес должен быть от 20 до 400 кг");return;}
    setBusy(true);
    try{ await jsonFetch("/api/daily-log",{method:"POST",body:JSON.stringify({date,weightKg:kilograms})});
      setValue(""); setNote(today?"Вес обновлён ✓":"Записано ✓"); await load();
    }catch{setNote("Не удалось сохранить");}
    setBusy(false); setTimeout(()=>setNote(""),1800);
  }
  return <div className="weight-card">
    <div className="weight-head">
      <div><p className="eyebrow">ВЕС</p><b>{shown?`${shown.weightKg.toFixed(1)} кг`:"—"}</b>
        {delta!==null&&<em className={delta<0?"down":delta>0?"up":""}>{delta>0?"+":""}{delta.toFixed(1)} кг с прошлого раза</em>}
        {!today&&<em className="hint">Сегодня ещё не записан</em>}
      </div>
      <Sparkline points={history.slice(-14)}/>
    </div>
    <form className="weight-row" onSubmit={save}>
      <input value={value} onChange={event=>setValue(event.target.value)} type="number" inputMode="decimal" step="0.1" min="20" max="400" placeholder={today?"Исправить":"Утренний вес, кг"}/>
      <button className="primary" disabled={busy||!value}>{busy?"…":today?"Обновить":"Записать"}</button>
    </form>
    {note&&<small className="health-status">{note}</small>}
    {earlier.length>0&&<div className="weight-history">{history.slice(-7).reverse().map(point=>
      <div key={point.date}><span>{new Date(`${point.date}T00:00`).toLocaleDateString("ru",{day:"numeric",month:"short"})}</span><b>{point.weightKg.toFixed(1)}</b></div>)}</div>}
  </div>;
}

function WorkoutsCard({date}:{date:string}) {
  const [items,setItems]=useState<Workout[]>([]);
  const [title,setTitle]=useState(""); const [minutes,setMinutes]=useState(""); const [busy,setBusy]=useState(false);
  useEffect(()=>{void jsonFetch<Workout[]>(`/api/workouts?date=${date}`).then(setItems).catch(()=>{});},[date]);
  async function add(event:FormEvent){
    event.preventDefault();
    const length=Number(minutes);
    if(!title.trim()||!length||busy)return;
    setBusy(true);
    try{ const saved=await jsonFetch<Workout>("/api/workouts",{method:"POST",body:JSON.stringify({date,title:title.trim(),minutes:length})});
      setItems(current=>[...current,saved]); setTitle(""); setMinutes("");
    }catch{}
    setBusy(false);
  }
  async function remove(id:string){
    setItems(current=>current.filter(item=>item.id!==id));
    await jsonFetch(`/api/workouts?id=${encodeURIComponent(id)}`,{method:"DELETE"}).catch(()=>{});
  }
  const total=items.reduce((sum,item)=>sum+item.minutes,0);
  return <div className="list-card">
    <h3>Тренировки{total>0&&<small> · {total} мин</small>}</h3>
    <form className="workout-add" onSubmit={add}>
      <input value={title} onChange={event=>setTitle(event.target.value)} maxLength={80} placeholder="Что делал? Например, зал — ноги"/>
      <input value={minutes} onChange={event=>setMinutes(event.target.value)} type="number" min="1" max="1440" placeholder="мин"/>
      <button className="primary" disabled={busy}>{busy?"…":"Добавить"}</button>
    </form>
    {items.length===0
      ? <div className="empty"><span>🏋️</span><p>Запиши тренировку, когда она случится</p></div>
      : items.map(item=><div className="entry" key={item.id}><span>🏋️</span><b>{item.title}</b><em>{item.minutes} мин</em><button onClick={()=>void remove(item.id)}>×</button></div>)}
  </div>;
}

function Today() {
  const date=todayKey();
  const [section,setSection]=useState<"food"|"movement"|"weight">("food");
  const [entries,setEntries]=useState<Entry[]>([]); const [title,setTitle]=useState(""); const [calories,setCalories]=useState("");
  const [busy,setBusy]=useState(false);
  const [health,setHealth]=useState<HealthSnapshot>({activeCalories:0,steps:null,weightKg:null});
  const [healthAvailable,setHealthAvailable]=useState(false); const [healthStatus,setHealthStatus]=useState(""); const [healthBusy,setHealthBusy]=useState(false);
  const [streak,setStreak]=useState(0); const [coins,setCoins]=useState(0);
  const goal=health.calorieGoal??2000;
  const total=entries.reduce((sum,item)=>sum+item.calories,0);
  const ratio=total/goal;
  const percent=Math.min(100,Math.round(ratio*100));
  // Цель здесь — предел, а не достижение: перебор не должен выглядеть победой.
  const ringState=ratio>1?"over":ratio>=0.9?"close":"ok";
  const healthFreshness=health.healthSyncedAt
    ? `Обновлено в ${new Date(health.healthSyncedAt).toLocaleTimeString("ru",{hour:"2-digit",minute:"2-digit"})} ✓`
    : "Пока не подключено";
  const caloriesLeft=Math.max(0,goal-total);
  const dayMessage=total===0
    ? {title:"Начни с первой записи",text:"Добавь то, что уже съел. Не обязательно заполнять всё сразу."}
    : ringState==="over"
      ? {title:"Сегодня выше ориентира",text:"Ничего страшного. Один день ничего не решает — завтра просто продолжим."}
      : ringState==="close"
        ? {title:"Почти готово",text:`До твоего ориентира осталось ${caloriesLeft} ккал.`}
        : percent<50
          ? {title:"Хорошее начало",text:`На сегодня осталось примерно ${caloriesLeft} ккал.`}
          : {title:"Всё идёт по плану",text:`На сегодня осталось примерно ${caloriesLeft} ккал.`};
  // Записи живут на сервере. В localStorage их держать нельзя: при уходе со вкладки
  // компонент размонтируется, и сохранение пустого списка затирало данные.
  useEffect(()=>{void jsonFetch<Entry[]>(`/api/food-entries?date=${date}`).then(setEntries).catch(()=>{});},[date]);
  const refreshDay=useCallback(()=>{
    void jsonFetch<HealthSnapshot>(`/api/daily-log?date=${date}`).then(setHealth).catch(()=>{});
    void jsonFetch<{days:number;coins:number}>("/api/streak").then(result=>{setStreak(result.days);setCoins(result.coins);}).catch(()=>{});
  },[date]);
  useEffect(()=>{refreshDay();},[refreshDay]);
  useEffect(()=>{
    const detect=()=>setHealthAvailable(Boolean(window.ritmHealthKitAvailable&&window.webkit?.messageHandlers?.ritmHealth));
    const receive=(event:Event)=>{void (async()=>{
      const detail=(event as CustomEvent<HealthKitDetail>).detail;
      if(detail.error){setHealthStatus(detail.error);setHealthBusy(false);return;}
      const hasMetric=[detail.activeCalories,detail.steps,detail.exerciseMinutes,detail.weightKg].some(value=>typeof value==="number");
      if(!hasMetric){setHealthStatus("Apple Health не вернул данные");setHealthBusy(false);return;}
      try{
        const saved=await jsonFetch<HealthSnapshot&{ok:true}>("/api/health-sync",{method:"POST",body:JSON.stringify({date:detail.date??date,activeCalories:detail.activeCalories,steps:detail.steps,exerciseMinutes:detail.exerciseMinutes,weightKg:detail.weightKg??null})});
        setHealth(saved);setHealthStatus("Синхронизировано ✓");
      }catch{setHealthStatus("Не удалось сохранить данные");}finally{setHealthBusy(false);}
    })();};
    detect();window.addEventListener("ritm-healthkit-ready",detect);window.addEventListener("ritm-health-data",receive);
    return()=>{window.removeEventListener("ritm-healthkit-ready",detect);window.removeEventListener("ritm-health-data",receive);};
  },[date]);
  function syncHealth(){const bridge=window.webkit?.messageHandlers?.ritmHealth;if(!bridge)return;setHealthBusy(true);setHealthStatus("Читаем Apple Health…");bridge.postMessage({action:"syncToday"});}
  async function add(event:FormEvent){
    event.preventDefault();
    const value=Number(calories); if(!title.trim()||!value||busy)return;
    setBusy(true);
    try{
      const saved=await jsonFetch<Entry>("/api/food-entries",{method:"POST",body:JSON.stringify({date,title:title.trim(),calories:value})});
      const next=[...entries,saved];
      setEntries(next); setTitle(""); setCalories("");
      refreshDay();
    }catch{}
    setBusy(false);
  }
  async function remove(id:string){
    const next=entries.filter(item=>item.id!==id);
    setEntries(next);
    await jsonFetch(`/api/food-entries?id=${encodeURIComponent(id)}`,{method:"DELETE"}).catch(()=>{});
    refreshDay();
  }
  return <section className="screen slide-up">
    <div className="hero-row"><div><p className="eyebrow">СЕГОДНЯ</p><h2>Держим ритм</h2><p className="muted">День завершится сам в полночь.</p></div><div className="streak"><span>🔥</span><b>{streak}</b><small>{plural(streak,"день","дня","дней")}</small></div></div>
    <div className="progress-card"><div className={`ring ${ringState}`} style={{"--progress":`${percent*3.6}deg`} as React.CSSProperties}><div><b>{total}</b><small>из {goal} ккал</small></div></div><div><h3>{dayMessage.title}</h3><p>{dayMessage.text}</p></div></div>
    <Milestone streak={streak}/>
    <div className="day-switch" role="tablist" aria-label="Раздел дневника">
      <button role="tab" className={section==="food"?"active":""} aria-selected={section==="food"} onClick={()=>setSection("food")}><span>🍽️</span>Питание</button>
      <button role="tab" className={section==="movement"?"active":""} aria-selected={section==="movement"} onClick={()=>setSection("movement")}><span>🏃</span>Движение</button>
      <button role="tab" className={section==="weight"?"active":""} aria-selected={section==="weight"} onClick={()=>setSection("weight")}><span>⚖️</span>Вес</button>
    </div>
    {section==="food"&&<div className="day-panel slide-up">
      <form className="quick-add" onSubmit={add}><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Что съел? Например, клубника"/><input value={calories} onChange={e=>setCalories(e.target.value)} type="number" min="1" max="10000" placeholder="ккал"/><button className="primary" disabled={busy}>{busy?"…":"Добавить"}</button></form>
      <div className="list-card"><h3>Сегодня</h3>{entries.length===0?<div className="empty"><span>🍓</span><p>Запиши первый приём пищи — дальше будет проще</p></div>:entries.map((item,index)=><div className="entry" key={item.id} style={{animationDelay:`${index*60}ms`}}><span>🍽️</span><b>{item.title}</b><em>{item.calories} ккал</em><button onClick={()=>void remove(item.id)}>×</button></div>)}</div>
      <RepairCard coins={coins} onChanged={refreshDay}/>
    </div>}
    {section==="movement"&&<div className="day-panel slide-up">
      <div className="health-card">
        <div className="health-title"><span aria-hidden>❤️</span><div><h3>Apple Health</h3><p className={health.healthSyncedAt?"health-fresh":""}>{healthFreshness}</p></div></div>
        <div className="health-values"><div><b>{health.activeCalories||"—"}</b><small>активных ккал</small></div><div><b>{health.steps??"—"}</b><small>шагов</small></div><div><b>{health.exerciseMinutes??"—"}</b><small>минут</small></div></div>
        {healthAvailable&&<button className="health-sync" onClick={syncHealth} disabled={healthBusy}>{healthBusy?"Синхронизация…":"Обновить из Apple Health"}</button>}
        {!healthAvailable&&!health.healthSyncedAt&&<p className="health-hint">Подключение находится в профиле → Apple Health. Настрой несколько обновлений в течение дня.</p>}
        {!healthAvailable&&health.healthSyncedAt&&<p className="health-hint">Для новых чисел запусти команду «Ритм» или дождись ближайшей автоматизации.</p>}
        {healthStatus&&<small className="health-status">{healthStatus}</small>}
      </div>
      <WorkoutsCard date={date}/>
    </div>}
    {section==="weight"&&<div className="day-panel slide-up"><WeightCard date={date}/></div>}
  </section>;
}

function Friends() {
  const [query,setQuery]=useState(""); const [results,setResults]=useState<Person[]>([]); const [people,setPeople]=useState<Person[]>([]); const [feed,setFeed]=useState<FeedEvent[]>([]); const [notice,setNotice]=useState("");
  async function refresh(){const [friends,events]=await Promise.all([jsonFetch<Person[]>("/api/friends"),jsonFetch<FeedEvent[]>("/api/feed")]);setPeople(friends);setFeed(events);}
  useEffect(()=>{void Promise.resolve().then(refresh);},[]);
  useEffect(()=>{const timer=setTimeout(()=>{if(query.trim().length>=2)jsonFetch<Person[]>(`/api/users/search?q=${encodeURIComponent(query)}`).then(setResults);else setResults([]);},250);return()=>clearTimeout(timer);},[query]);
  async function request(userId:string){try{await jsonFetch("/api/friends",{method:"POST",body:JSON.stringify({userId})});setNotice("Заявка отправлена");await refresh();}catch{setNotice("Заявка уже существует");}}
  async function act(userId:string,action:"accept"|"reject"){await jsonFetch(`/api/friends/${userId}`,{method:"PATCH",body:JSON.stringify({action})});await refresh();}
  const incoming=people.filter(p=>p.status==="pending"&&!p.sentByMe); const accepted=people.filter(p=>p.status==="accepted");
  return <section className="screen slide-up"><div className="hero-row"><div><p className="eyebrow">ВМЕСТЕ ВЕСЕЛЕЕ</p><h2>Друзья</h2></div><div className="buddy-bubbles"><span>🐼</span><span>🦊</span><span>🐸</span></div></div>
    <div className="search-card"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Найти по нику или имени"/>{notice&&<small>{notice}</small>}{results.map(person=><PersonRow key={person.id} person={person} action={person.relationship==="none"?<button onClick={()=>request(person.id)}>Добавить</button>:<span className="status">{person.relationship==="friends"?"Уже друзья":"Заявка отправлена"}</span>}/>)}</div>
    {incoming.length>0&&<div className="list-card"><h3>Заявки</h3>{incoming.map(p=><PersonRow key={p.id} person={p} action={<div className="row-actions"><button onClick={()=>act(p.id,"accept")}>Принять</button><button className="ghost" onClick={()=>act(p.id,"reject")}>Нет</button></div>}/>)}</div>}
    <div className="list-card"><h3>Твои друзья · {accepted.length}</h3>{accepted.length?accepted.map(p=><PersonRow key={p.id} person={p}/>):<div className="empty"><span>👋</span><p>Найди друга по уникальному нику</p></div>}</div>
    <Leaderboard/>
    <div className="list-card"><h3>Активность</h3>{feed.length?feed.map(event=><div className="feed" key={event.id}><span>{event.type==="workout"?"🏋️":"🔥"}</span><p>{event.type==="workout"?<><b>{event.name}</b> добавил тренировку · {event.payload.minutes??0} мин</>:<><b>{event.name}</b> уже {event.payload.days??1} {plural(event.payload.days??1,"день","дня","дней")} подряд</>}</p><time>{new Date(event.createdAt).toLocaleDateString("ru")}</time></div>):<div className="empty"><span>✨</span><p>Здесь появятся успехи друзей</p></div>}</div>
  </section>;
}

function PersonRow({person,action}:{person:Person;action?:React.ReactNode}) {return <div className="person"><div className="avatar">{person.name.slice(0,1).toUpperCase()}</div><div><b>{person.name}</b><small>@{person.username??"без-ника"}</small></div>{action&&<div className="person-action">{action}</div>}</div>}

function InstallHint() {
  const [show,setShow]=useState(false);
  useEffect(()=>{void Promise.resolve().then(()=>{
    const standalone=window.matchMedia("(display-mode: standalone)").matches||(window.navigator as Navigator&{standalone?:boolean}).standalone===true;
    if(standalone||localStorage.getItem("ritm-install-hint")==="off")return;
    setShow(/iPad|iPhone|iPod/.test(navigator.userAgent));
  });},[]);
  function hide(){localStorage.setItem("ritm-install-hint","off");setShow(false);}
  if(!show)return null;
  return <div className="install-hint pop-in"><span aria-hidden>📲</span><p><b>Поставь «Ритм» на домашний экран.</b> Откроется как обычное приложение, без адресной строки: кнопка «Поделиться» внизу Safari → «На экран „Домой“».</p><button onClick={hide} aria-label="Скрыть подсказку">×</button></div>;
}

function TimezoneRow() {
  const [zone,setZone]=useState(""); const [saved,setSaved]=useState(false);
  const zones=useMemo(()=>{
    try {
      const list=(Intl as unknown as {supportedValuesOf?:(key:string)=>string[]}).supportedValuesOf?.("timeZone");
      if(list?.length) return list;
    } catch {}
    // Запасной список для браузеров без supportedValuesOf.
    return ["Europe/Kaliningrad","Europe/Moscow","Asia/Yekaterinburg","Asia/Novosibirsk","Asia/Vladivostok",
      "Europe/London","Europe/Berlin","America/New_York","America/Chicago","America/Denver","America/Los_Angeles","UTC"];
  },[]);
  useEffect(()=>{void jsonFetch<{timezone?:string|null}>("/api/profile")
    .then(profile=>setZone(profile.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone)).catch(()=>{});},[]);
  async function change(next:string){
    setZone(next);
    await jsonFetch("/api/profile",{method:"PATCH",body:JSON.stringify({timezone:next})}).catch(()=>{});
    setSaved(true); setTimeout(()=>setSaved(false),1500);
  }
  let localTime="";
  try { if(zone) localTime=new Intl.DateTimeFormat("ru",{timeZone:zone,day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date()); } catch {}
  const options=zone&&!zones.includes(zone)?[zone,...zones]:zones;
  return <div className="tz-row">
    <label><small>Часовой пояс</small>
      <select value={zone} onChange={event=>void change(event.target.value)}>
        {options.map(item=><option key={item} value={item}>{item}</option>)}
      </select>
    </label>
    <span className="tz-now">{localTime&&`Местное время: ${localTime}`}{saved&&" · сохранено ✓"}</span>
  </div>;
}

type GoalDirection = "lose"|"keep"|"gain";
const goalDirections:{key:GoalDirection;icon:string;title:string;text:string}[] = [
  {key:"lose",icon:"🌱",title:"Снизить вес",text:"Мягкий дефицит калорий"},
  {key:"keep",icon:"⚖️",title:"Держать вес",text:"Баланс еды и движения"},
  {key:"gain",icon:"💪",title:"Набрать вес",text:"Небольшой запас энергии"},
];

function GoalRow() {
  const [goal,setGoal]=useState(""); const [direction,setDirection]=useState<GoalDirection>("keep");
  const [profile,setProfile]=useState<{heightCm?:number|null;sex?:"male"|"female"|null;birthYear?:number|null;activityLevel?:string}>({});
  const [weight,setWeight]=useState<number|null>(null); const [saved,setSaved]=useState(false); const [choosing,setChoosing]=useState(false); const [note,setNote]=useState("");
  useEffect(()=>{void Promise.all([
    jsonFetch<{calorieGoal?:number;goalDirection?:GoalDirection;heightCm?:number|null;sex?:"male"|"female"|null;birthYear?:number|null;activityLevel?:string}>("/api/profile"),
    jsonFetch<{weightKg:number}[]>("/api/weight"),
  ]).then(([current,history])=>{setGoal(String(current.calorieGoal??2000));setDirection(current.goalDirection??"keep");setProfile(current);setWeight(history.at(-1)?.weightKg??null);}).catch(()=>{});},[]);
  async function choose(next:GoalDirection){
    if(choosing||next===direction)return;
    const previous=direction;
    setDirection(next); setNote("");
    setChoosing(true);
    const age=profile.birthYear?new Date().getFullYear()-profile.birthYear:null;
    let nextGoal:number|null=null;
    if(weight&&profile.heightCm&&profile.sex&&age){
      const basal=basalRate({weightKg:weight,heightCm:profile.heightCm,age,sex:profile.sex});
      nextGoal=goalCalories(maintenance(basal,profile.activityLevel??"light"),next);
    }
    try {
      await jsonFetch("/api/profile",{method:"PATCH",body:JSON.stringify({goalDirection:next,...(nextGoal?{calorieGoal:nextGoal}:{})})});
      if(nextGoal)setGoal(String(nextGoal));
      setNote(nextGoal?`Новая норма — ${nextGoal} ккал ✓`:"Цель сохранена. Заполни данные тела для пересчёта.");
    } catch { setDirection(previous); setNote("Не удалось сохранить цель"); }
    finally { setChoosing(false); }
  }
  async function save(event:FormEvent){
    event.preventDefault();
    const value=Number(goal);
    if(!value||value<500||value>10000)return;
    await jsonFetch("/api/profile",{method:"PATCH",body:JSON.stringify({calorieGoal:value})}).catch(()=>{});
    setSaved(true); setTimeout(()=>setSaved(false),1600);
  }
  return <div className="goal-settings">
    <div className="goal-choices compact">{goalDirections.map(item=><button type="button" key={item.key} disabled={choosing} className={direction===item.key?"active":""} onClick={()=>void choose(item.key)}><span>{item.icon}</span><div><b>{item.title}</b><small>{item.text}</small></div><i>✓</i></button>)}</div>
    {note&&<p className="goal-note">{note}</p>}
    <form className="goal-row" onSubmit={save}>
      <label>Дневная норма калорий<input value={goal} onChange={event=>setGoal(event.target.value)} type="number" min="500" max="10000" step="50"/></label>
      <button disabled={!goal}>{saved?"Сохранено ✓":"Сохранить"}</button>
    </form>
    <p className="muted small">Можно выбрать направление или задать свою норму вручную.</p>
  </div>;
}

function HealthSetup({embedded=false}:{embedded?:boolean}) {
  const shortcutUrl=process.env.NEXT_PUBLIC_HEALTH_SHORTCUT_URL;
  const [token,setToken]=useState<HealthToken|null>(null); const [open,setOpen]=useState(false); const [note,setNote]=useState("");
  useEffect(()=>{jsonFetch<HealthToken>("/api/health-token").then(setToken).catch(()=>{});},[]);
  const endpoint=`${typeof window==="undefined"?"":window.location.origin}/api/health-sync`;
  async function copy(text:string,label:string){try{await navigator.clipboard.writeText(text);setNote(`${label} скопирован`);}catch{setNote("Не вышло скопировать — выдели и скопируй вручную");}setTimeout(()=>setNote(""),1600);}
  async function rotate(){if(!window.confirm("Старый ключ сразу перестанет работать, команду на iPhone придётся поправить. Перевыпустить?"))return;setToken(await jsonFetch<HealthToken>("/api/health-token",{method:"POST"}));setNote("Новый ключ готов");setTimeout(()=>setNote(""),1600);}
  return <div className={`${embedded?"health-setup embedded":"list-card health-setup"}`}>
    {!embedded&&<h3>Apple Health {token?.lastUsedAt&&<small>Работает ✓</small>}</h3>}
    <div className={`health-connect-state ${token?.lastUsedAt?"connected":""}`}><span>{token?.lastUsedAt?"✓":"1"}</span><div><b>{token?.lastUsedAt?"Связь работает":"Подключение займёт пару минут"}</b><small>{token?.lastUsedAt?`Последняя отправка ${new Date(token.lastUsedAt).toLocaleDateString("ru",{day:"numeric",month:"short"})}`:"Нужна бесплатная команда на iPhone"}</small></div></div>
    <TimezoneRow/>
    <p className="muted health-explain">Ритм — PWA, поэтому данные передаёт команда на iPhone. После настройки она работает сама несколько раз в день.</p>
    {shortcutUrl
      ? <><a className="shortcut-cta" href={shortcutUrl} target="_blank" rel="noreferrer"><span>↗</span> Добавить команду на iPhone</a>
          <div className="setup-flow">
            <div><span>1</span><p><b>Добавь команду</b><small>Открой кнопку выше на iPhone</small></p></div>
            <div><span>2</span><p><b>Вставь личный ключ</b><small>В поле Authorization целиком с Bearer</small></p></div>
            <div><span>3</span><p><b>Запусти один раз</b><small>Разреши доступ к Здоровью и отправку данных</small></p></div>
          </div>
          <div className="schedule-card"><span>⏱️</span><div><b>Обновления в течение дня</b><p>Для каждого времени создай «Время суток», выбери команду и «Немедленный запуск».</p><div className="time-chips"><i>08:00</i><i>12:00</i><i>16:00</i><i>20:00</i><i>23:50</i></div></div></div></>
      : null}
    <button className="link-row" onClick={()=>setOpen(v=>!v)}>{open?"Свернуть":shortcutUrl?"Собрать команду вручную":"Показать инструкцию"}</button>
    {open&&<><p className="setup-warn">Действия ищи в строке <b>«Поиск действий»</b> внизу экрана. Названия зависят от языка iPhone: русские приведены первыми, английские — в скобках.</p>
    <ol className="setup-steps">
      <li>В «Быстрых командах» нажми <b>+</b>. В поиске набери <b>здоров</b> и добавь <b>«Найти данные Здоровья, где»</b> (Find Health Samples).</li>
      <li>Настрой её: <b>Тип</b> — «Энергия активности» (Active Energy), <b>Начало</b> — <b>сегодня</b>, <b>Единица группирования</b> — <b>День</b>, переключатель <b>«Заполнить отсутствующие» выключи</b>. Без группирования вернётся список замеров вместо одного числа.</li>
      <li>Добавь <b>вторую такую же</b> через поиск действий, с типом <b>Steps</b> («Шаги»). <b>Не дублируй первую</b>: копия встаёт следом, подхватывает её результат себе на вход и превращается в «Отфильтровать» — тогда она ищет шаги среди калорий и возвращает пустоту. Если такое случилось, нажми на синюю плашку сразу после слова «Отфильтровать» и выбери <b>«Очистить»</b>.</li>
      <li>Добавь <b>«Получить содержимое URL»</b> (Get Contents of URL). Вставь адрес из поля ниже, разверни <b>«Показать больше»</b>, поставь <b>Метод POST</b>, добавь заголовок <b>Authorization</b> со своим ключом и выбери <b>Тело запроса — JSON</b>.</li>
      <li>Добавь два поля типа <b>Число</b>: <code>activeCalories</code> и <code>steps</code>. В значение каждого подставь переменную через <b>«Выбрать переменную»</b> — там будет два пункта «Данные Здоровья», первый от карточки с энергией, второй от карточки с шагами. Стоящий в поле <b>ноль сначала сотри</b>, иначе он приклеится к числу.</li>
      <li>Нажми <b>▶</b>. Сервер должен ответить <code>{"{"}&quot;ok&quot;:true{"}"}</code> с твоими числами. Затем создай автоматизации на <b>08:00, 12:00, 16:00, 20:00 и 23:50</b> с немедленным запуском.</li>
    </ol></>}
    <p className="setup-note">Шаги считает сам iPhone. Активную энергию точнее всего заполняют Apple Watch.</p>
    <div className="health-credentials"><div className="token-row"><div><small>АДРЕС</small><code>{endpoint}</code></div><button onClick={()=>copy(endpoint,"Адрес")}>Копировать</button></div>
    <div className="token-row"><div><small>ЛИЧНЫЙ КЛЮЧ</small><code>{token?`Bearer ${token.token}`:"…"}</code></div><button disabled={!token} onClick={()=>token&&copy(`Bearer ${token.token}`,"Ключ")}>Копировать</button></div></div>
    <details className="health-security"><summary>Безопасность ключа</summary><p>Ключ разрешает только отправлять твои дневные числа. Не пересылай его другим.</p><button className="danger" onClick={rotate}>Перевыпустить ключ</button></details>
    {note&&<small className="health-status">{note}</small>}
  </div>;
}

function Profile({user,onOpenOnboarding}:{user:{name:string;email:string;username?:string|null};onOpenOnboarding:()=>void}) {
  const [settings,setSettings]=useState({isDiscoverable:true,shareStreak:true,shareGoalHits:true,shareWorkouts:true}); const [saved,setSaved]=useState(false);
  useEffect(()=>{jsonFetch<typeof settings>("/api/profile").then(v=>setSettings(s=>({...s,...v})));},[]);
  async function toggle(key:keyof typeof settings){const next={...settings,[key]:!settings[key]};setSettings(next);await jsonFetch("/api/profile",{method:"PATCH",body:JSON.stringify(next)});setSaved(true);setTimeout(()=>setSaved(false),1200);}
  return <section className="screen slide-up"><p className="eyebrow">ПРОФИЛЬ</p><div className="profile-head"><div className="big-avatar">{user.name.slice(0,1).toUpperCase()}</div><div><h2>{user.name}</h2><p>@{user.username??"ник"} · {user.email}</p></div></div>
    <div className="profile-menu">
      <details className="profile-group" name="profile-settings"><summary><span>🎯</span><div><b>Цель и дневная норма</b><small>Снизить, держать или набрать вес</small></div><i>›</i></summary><div className="profile-group-content"><GoalRow/><button className="recalculate" onClick={onOpenOnboarding}>Пройти полный расчёт заново</button></div></details>
      <details className="profile-group" name="profile-settings"><summary><span>📐</span><div><b>Тело и расчёты</b><small>ИМТ, цель и расход энергии</small></div><i>›</i></summary><div className="profile-group-content"><BodyCard embedded/></div></details>
      <details className="profile-group" name="profile-settings"><summary><span>🎨</span><div><b>Оформление</b><small>Светлая или тёмная тема</small></div><i>›</i></summary><div className="profile-group-content"><ThemeControl/></div></details>
      <details className="profile-group" name="profile-settings"><summary><span>🔒</span><div><b>Приватность</b><small>{saved?"Сохранено ✓":"Что видят друзья"}</small></div><i>›</i></summary><div className="profile-group-content settings"><Toggle label="Меня можно найти по нику" value={settings.isDiscoverable} onClick={()=>toggle("isDiscoverable")}/><Toggle label="Показывать серию друзьям" value={settings.shareStreak} onClick={()=>toggle("shareStreak")}/><Toggle label="Показывать выполнение цели" value={settings.shareGoalHits} onClick={()=>toggle("shareGoalHits")}/><Toggle label="Показывать тренировки" value={settings.shareWorkouts} onClick={()=>toggle("shareWorkouts")}/><p className="privacy-note">Вес и точное количество калорий друзьям не показываются.</p></div></details>
      <details className="profile-group" name="profile-settings"><summary><span>❤️</span><div><b>Apple Health</b><small>Автоматизация через iPhone</small></div><i>›</i></summary><div className="profile-group-content"><HealthSetup embedded/></div></details>
    </div>
    <button className="danger" onClick={()=>authClient.signOut()}>Выйти из аккаунта</button>
  </section>;
}

function ThemeControl() {
  const [theme,setTheme]=useState<Theme>("system");
  useEffect(()=>{
    const saved=localStorage.getItem("ritm-theme") as Theme|null;
    if(saved==="light"||saved==="dark"||saved==="system")queueMicrotask(()=>setTheme(saved));
  },[]);
  function change(next:Theme) {
    setTheme(next); localStorage.setItem("ritm-theme",next);
    if(next==="system")document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme",next);
    const metas=document.querySelectorAll('meta[name="theme-color"]');
    metas.forEach((meta,index)=>meta.setAttribute("content",next==="system"?(index===0?"#ffffff":"#121713"):next==="dark"?"#121713":"#ffffff"));
  }
  const options:[Theme,string,string][]=[["system","◐","Как на iPhone"],["light","☀️","Светлая"],["dark","🌙","Тёмная"]];
  return <div className="theme-picker" role="radiogroup" aria-label="Тема оформления">{options.map(([key,icon,label])=><button key={key} role="radio" aria-checked={theme===key} className={theme===key?"active":""} onClick={()=>change(key)}><span>{icon}</span><b>{label}</b><i>✓</i></button>)}</div>;
}
function Toggle({label,value,onClick}:{label:string;value:boolean;onClick:()=>void}){return <button className="toggle-row" onClick={onClick}><span>{label}</span><i className={value?"on":""}><u/></i></button>}

export function RitmApp() {
  const session=authClient.useSession(); const [tab,setTab]=useState<Tab>("today"); const [headerCoins,setHeaderCoins]=useState(0);
  const [onboarding,setOnboarding]=useState<"loading"|"show"|"done">("loading");
  const [onboardingUser,setOnboardingUser]=useState<string|null>(null);
  const user=useMemo(()=>session.data?.user as AppUser|undefined,[session.data]);
  const userId=user?.id;
  useEffect(()=>{
    if(!userId) return;
    // Определяем пояс браузером один раз. Если человек выбрал его руками, не трогаем.
    void jsonFetch<{timezone?:string|null;onboardingCompleted?:boolean}>("/api/profile").then(profile=>{
      setOnboarding(profile.onboardingCompleted?"done":"show");
      setOnboardingUser(userId);
      if(profile.timezone) return;
      const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
      return jsonFetch("/api/profile",{method:"PATCH",body:JSON.stringify({timezone})});
    }).catch(()=>{setOnboarding("done");setOnboardingUser(userId);});
  },[userId]);
  useEffect(()=>{
    if(!userId) return;
    void jsonFetch<{coins:number}>("/api/streak").then(result=>setHeaderCoins(result.coins)).catch(()=>{});
  },[userId,tab]);
  if(session.isPending)return <main className="loading"><div className="pulse">🔥</div></main>;
  if(!user)return <AuthScreen/>;
  if(onboarding==="loading"||onboardingUser!==userId)return <main className="loading"><div className="pulse">🔥</div></main>;
  if(onboarding==="show")return <Onboarding onComplete={()=>{
    setOnboarding("done");
    setTab("today");
    void jsonFetch<{coins:number}>("/api/streak").then(result=>setHeaderCoins(result.coins)).catch(()=>{});
  }}/>;
  return <main className="app-shell"><header><div className="brand"><span>🔥</span>Ритм</div><div className="mini-user"><CoinsChip coins={headerCoins}/><span>{user.name.slice(0,1).toUpperCase()}</span><div><b>{user.name}</b><small>@{user.username??"ник"}</small></div></div></header><div className="content"><InstallHint/>{tab==="today"&&<Today/>} {tab==="stats"&&<StatsScreen/>} {tab==="friends"&&<Friends/>} {tab==="profile"&&<Profile user={user} onOpenOnboarding={()=>setOnboarding("show")}/>}</div><nav><button className={tab==="today"?"active":""} onClick={()=>setTab("today")}><span>◉</span>Сегодня</button><button className={tab==="stats"?"active":""} onClick={()=>setTab("stats")}><span>▤</span>Статистика</button><button className={tab==="friends"?"active":""} onClick={()=>setTab("friends")}><span>♣</span>Друзья</button><button className={tab==="profile"?"active":""} onClick={()=>setTab("profile")}><span>●</span>Профиль</button></nav></main>;
}
