"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { authClient } from "@/lib/auth-client";

type Tab = "today" | "friends" | "profile";
type Person = { id:string; name:string; username?:string|null; image?:string|null; relationship?:string; status?:string; sentByMe?:boolean };
type FeedEvent = { id:number; type:string; payload:{days?:number}; createdAt:string; name:string; username?:string };
type Entry = { id:string; title:string; calories:number };
type AppUser = { id:string; name:string; email:string; username?:string|null };
type HealthSnapshot = { activeCalories:number; steps?:number|null; exerciseMinutes?:number|null; weightKg:number|null; healthSyncedAt?:string|null };
type HealthToken = { token:string; lastUsedAt:string|null };
type HealthKitDetail = { date?:string; activeCalories?:number; weightKg?:number|null; error?:string };

declare global {
  interface Window {
    ritmHealthKitAvailable?:boolean;
    webkit?:{messageHandlers?:{ritmHealth?:{postMessage:(message:{action:string})=>void}}};
  }
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

function Today({userId}:{userId:string}) {
  const date=todayKey(); const key=`ritm-entries-${userId}-${date}`;
  const [entries,setEntries]=useState<Entry[]>([]); const [title,setTitle]=useState(""); const [calories,setCalories]=useState("");
  const [health,setHealth]=useState<HealthSnapshot>({activeCalories:0,steps:null,weightKg:null});
  const [healthAvailable,setHealthAvailable]=useState(false); const [healthStatus,setHealthStatus]=useState(""); const [healthBusy,setHealthBusy]=useState(false);
  const goal=2000; const total=entries.reduce((sum,item)=>sum+item.calories,0); const percent=Math.min(100,Math.round(total/goal*100));
  useEffect(()=>{void Promise.resolve().then(()=>{try{setEntries(JSON.parse(localStorage.getItem(key)??"[]"));}catch{}});},[key]);
  useEffect(()=>{localStorage.setItem(key,JSON.stringify(entries)); if(entries.length) void jsonFetch("/api/daily-log",{method:"POST",body:JSON.stringify({date,caloriesEaten:total,calorieGoal:goal,streak:1})}).catch(()=>{});},[date,entries,key,total]);
  useEffect(()=>{void jsonFetch<HealthSnapshot>(`/api/daily-log?date=${date}`).then(setHealth).catch(()=>{});},[date]);
  useEffect(()=>{
    const detect=()=>setHealthAvailable(Boolean(window.ritmHealthKitAvailable&&window.webkit?.messageHandlers?.ritmHealth));
    const receive=(event:Event)=>{void (async()=>{
      const detail=(event as CustomEvent<HealthKitDetail>).detail;
      if(detail.error){setHealthStatus(detail.error);setHealthBusy(false);return;}
      if(typeof detail.activeCalories!=="number"){setHealthStatus("Apple Health не вернул данные");setHealthBusy(false);return;}
      try{
        const saved=await jsonFetch<HealthSnapshot&{ok:true}>("/api/health-sync",{method:"POST",body:JSON.stringify({date:detail.date??date,activeCalories:detail.activeCalories,weightKg:detail.weightKg??null})});
        setHealth(saved);setHealthStatus("Синхронизировано ✓");
      }catch{setHealthStatus("Не удалось сохранить данные");}finally{setHealthBusy(false);}
    })();};
    detect();window.addEventListener("ritm-healthkit-ready",detect);window.addEventListener("ritm-health-data",receive);
    return()=>{window.removeEventListener("ritm-healthkit-ready",detect);window.removeEventListener("ritm-health-data",receive);};
  },[date]);
  function syncHealth(){const bridge=window.webkit?.messageHandlers?.ritmHealth;if(!bridge)return;setHealthBusy(true);setHealthStatus("Читаем Apple Health…");bridge.postMessage({action:"syncToday"});}
  function add(event:FormEvent){event.preventDefault(); const value=Number(calories); if(!title.trim()||!value)return; setEntries(v=>[...v,{id:crypto.randomUUID(),title:title.trim(),calories:value}]);setTitle("");setCalories("");}
  return <section className="screen slide-up">
    <div className="hero-row"><div><p className="eyebrow">СЕГОДНЯ</p><h2>Держим ритм</h2><p className="muted">День завершится сам в полночь.</p></div><div className="streak"><span>🔥</span><b>{entries.length?1:0}</b><small>дней</small></div></div>
    <div className="progress-card"><div className="ring" style={{"--progress":`${percent*3.6}deg`} as React.CSSProperties}><div><b>{total}</b><small>из {goal} ккал</small></div></div><div><h3>{percent<50?"Отличное начало":percent<90?"Уже близко":"Цель дня рядом!"}</h3><p>Добавляй еду по мере дня. Ничего подтверждать вечером не нужно.</p></div></div>
    <div className="health-card">
      <div className="health-title"><span aria-hidden>❤️</span><div><h3>Apple Health</h3><p>{health.healthSyncedAt?`Обновлено ${new Date(health.healthSyncedAt).toLocaleTimeString("ru",{hour:"2-digit",minute:"2-digit"})}`:"Пока не подключено"}</p></div></div>
      <div className="health-values"><div><b>{health.activeCalories||"—"}</b><small>активных ккал</small></div><div><b>{health.steps??"—"}</b><small>шагов</small></div><div><b>{health.weightKg?health.weightKg.toFixed(1):"—"}</b><small>вес, кг</small></div></div>
      {healthAvailable&&<button className="health-sync" onClick={syncHealth} disabled={healthBusy}>{healthBusy?"Синхронизация…":"Обновить из Apple Health"}</button>}
      {!healthAvailable&&!health.healthSyncedAt&&<p className="health-hint">Данные с iPhone подключаются за пару минут — в профиле, разделом ниже.</p>}
      {healthStatus&&<small className="health-status">{healthStatus}</small>}
    </div>
    <form className="quick-add" onSubmit={add}><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Что съел? Например, клубника"/><input value={calories} onChange={e=>setCalories(e.target.value)} type="number" min="1" max="10000" placeholder="ккал"/><button className="primary">Добавить</button></form>
    <div className="list-card"><h3>Сегодня</h3>{entries.length===0?<div className="empty"><span>🍓</span><p>Первая запись запустит серию дня</p></div>:entries.map((item,index)=><div className="entry" key={item.id} style={{animationDelay:`${index*60}ms`}}><span>🍽️</span><b>{item.title}</b><em>{item.calories} ккал</em><button onClick={()=>setEntries(v=>v.filter(x=>x.id!==item.id))}>×</button></div>)}</div>
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
    <div className="list-card"><h3>Активность</h3>{feed.length?feed.map(event=><div className="feed" key={event.id}><span>🔥</span><p><b>{event.name}</b> держит серию уже {event.payload.days??1} дн.</p><time>{new Date(event.createdAt).toLocaleDateString("ru")}</time></div>):<div className="empty"><span>✨</span><p>Здесь появятся безопасные достижения друзей</p></div>}</div>
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
    <span className="tz-now">{localTime&&`сейчас ${localTime}`}{saved&&" · сохранено ✓"}</span>
  </div>;
}

function HealthSetup() {
  const [token,setToken]=useState<HealthToken|null>(null); const [open,setOpen]=useState(false); const [note,setNote]=useState("");
  useEffect(()=>{jsonFetch<HealthToken>("/api/health-token").then(setToken).catch(()=>{});},[]);
  const endpoint=`${typeof window==="undefined"?"":window.location.origin}/api/health-sync`;
  async function copy(text:string,label:string){try{await navigator.clipboard.writeText(text);setNote(`${label} скопирован`);}catch{setNote("Не вышло скопировать — выдели и скопируй вручную");}setTimeout(()=>setNote(""),1600);}
  async function rotate(){if(!window.confirm("Старый ключ сразу перестанет работать, команду на iPhone придётся поправить. Перевыпустить?"))return;setToken(await jsonFetch<HealthToken>("/api/health-token",{method:"POST"}));setNote("Новый ключ готов");setTimeout(()=>setNote(""),1600);}
  return <div className="list-card health-setup">
    <h3>Apple Health {token?.lastUsedAt&&<small>Работает ✓</small>}</h3>
    <TimezoneRow/>
    <p className="muted">Сайт сам читать Apple Health не может — это запрещено в iOS. Данные присылает бесплатная команда «Быстрые команды» с твоего iPhone: раз в день, автоматически.</p>
    <button className="link-row" onClick={()=>setOpen(v=>!v)}>{open?"Свернуть инструкцию":"Показать инструкцию"}</button>
    {open&&<><p className="setup-warn">Названия действий в «Быстрых командах» бывают на английском — ниже указаны оба варианта. Искать действия нужно в строке <b>«Поиск действий»</b> внизу экрана.</p>
    <ol className="setup-steps">
      <li>На iPhone открой <b>«Быстрые команды»</b> и нажми <b>+</b>.</li>
      <li>В поиске действий набери <b>find health</b> и выбери <b>«Find Health Samples»</b> (по-русски — «Найти образцы Health»).<br/><b>Не</b> «Search in Health» — это другое действие, оно просто открывает приложение Здоровье.</li>
      <li>В добавленном действии нажми на тип образца и выбери <b>Active Energy</b> («Активная энергия»). Добавь фильтр по дате: <b>Start Date</b> → <b>is today</b>. Если внизу действия есть переключатель статистики — включи <b>Sum</b> («Сумма»); если его нет, добавь отдельное действие <b>«Calculate Statistics»</b> с операцией <b>Sum</b>.</li>
      <li>Добавь действие <b>«Get Contents of URL»</b> («Загрузить содержимое URL»). Вставь адрес из поля ниже, разверни <b>Show More</b>, поставь метод <b>POST</b>, добавь заголовок <b>Authorization</b> со значением ключа ниже, тип тела — <b>JSON</b>, и одно поле: ключ <code>activeCalories</code>, тип <b>Number</b>, значение — результат предыдущего действия.</li>
      <li>Сохрани команду. Затем на вкладке <b>«Автоматизация»</b> создай автоматизацию <b>«Время суток»</b> на <b>23:50</b>, выбери эту команду и включи <b>«Запускать сразу»</b>.</li>
    </ol>
    <p className="setup-note">Дату присылать не нужно — сервер знает твой часовой пояс и сам поймёт, за какой день числа. Шаги и вес добавляются позже такими же действиями с полями <code>steps</code> и <code>weightKg</code>.</p></>}
    <div className="token-row"><div><small>Адрес</small><code>{endpoint}</code></div><button onClick={()=>copy(endpoint,"Адрес")}>Копировать</button></div>
    <div className="token-row"><div><small>Личный ключ</small><code>{token?`Bearer ${token.token}`:"…"}</code></div><button disabled={!token} onClick={()=>token&&copy(`Bearer ${token.token}`,"Ключ")}>Копировать</button></div>
    <p className="privacy-note">Ключ открывает доступ только к отправке твоих дневных чисел. Никому его не пересылай — если утёк, перевыпусти.</p>
    {note&&<small className="health-status">{note}</small>}
    <button className="danger" onClick={rotate}>Перевыпустить ключ</button>
  </div>;
}

function Profile({user}:{user:{name:string;email:string;username?:string|null}}) {
  const [settings,setSettings]=useState({isDiscoverable:true,shareStreak:true,shareGoalHits:true,shareWorkouts:true}); const [saved,setSaved]=useState(false);
  useEffect(()=>{jsonFetch<typeof settings>("/api/profile").then(v=>setSettings(s=>({...s,...v})));},[]);
  async function toggle(key:keyof typeof settings){const next={...settings,[key]:!settings[key]};setSettings(next);await jsonFetch("/api/profile",{method:"PATCH",body:JSON.stringify(next)});setSaved(true);setTimeout(()=>setSaved(false),1200);}
  return <section className="screen slide-up"><p className="eyebrow">ПРОФИЛЬ</p><div className="profile-head"><div className="big-avatar">{user.name.slice(0,1).toUpperCase()}</div><div><h2>{user.name}</h2><p>@{user.username??"ник"} · {user.email}</p></div></div>
    <div className="list-card settings"><h3>Приватность активности {saved&&<small>Сохранено ✓</small>}</h3><Toggle label="Меня можно найти по нику" value={settings.isDiscoverable} onClick={()=>toggle("isDiscoverable")}/><Toggle label="Показывать серию друзьям" value={settings.shareStreak} onClick={()=>toggle("shareStreak")}/><Toggle label="Показывать выполнение цели" value={settings.shareGoalHits} onClick={()=>toggle("shareGoalHits")}/><Toggle label="Показывать тренировки" value={settings.shareWorkouts} onClick={()=>toggle("shareWorkouts")}/><p className="privacy-note">Вес и точное количество калорий друзьям не показываются.</p></div>
    <HealthSetup/>
    <button className="danger" onClick={()=>authClient.signOut()}>Выйти из аккаунта</button>
  </section>;
}
function Toggle({label,value,onClick}:{label:string;value:boolean;onClick:()=>void}){return <button className="toggle-row" onClick={onClick}><span>{label}</span><i className={value?"on":""}><u/></i></button>}

export function RitmApp() {
  const session=authClient.useSession(); const [tab,setTab]=useState<Tab>("today");
  const user=useMemo(()=>session.data?.user as AppUser|undefined,[session.data]);
  const userId=user?.id;
  useEffect(()=>{
    if(!userId) return;
    // Определяем пояс браузером один раз. Если человек выбрал его руками, не трогаем.
    void jsonFetch<{timezone?:string|null}>("/api/profile").then(profile=>{
      if(profile.timezone) return;
      const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
      return jsonFetch("/api/profile",{method:"PATCH",body:JSON.stringify({timezone})});
    }).catch(()=>{});
  },[userId]);
  if(session.isPending)return <main className="loading"><div className="pulse">🔥</div></main>;
  if(!user)return <AuthScreen/>;
  return <main className="app-shell"><header><div className="brand"><span>🔥</span>Ритм</div><div className="mini-user"><span>{user.name.slice(0,1).toUpperCase()}</span><div><b>{user.name}</b><small>@{user.username??"ник"}</small></div></div></header><div className="content"><InstallHint/>{tab==="today"&&<Today userId={user.id}/>} {tab==="friends"&&<Friends/>} {tab==="profile"&&<Profile user={user}/>}</div><nav><button className={tab==="today"?"active":""} onClick={()=>setTab("today")}><span>◉</span>Сегодня</button><button className={tab==="friends"?"active":""} onClick={()=>setTab("friends")}><span>♣</span>Друзья</button><button className={tab==="profile"?"active":""} onClick={()=>setTab("profile")}><span>●</span>Профиль</button></nav></main>;
}
