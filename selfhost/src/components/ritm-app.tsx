"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { authClient } from "@/lib/auth-client";

type Tab = "today" | "friends" | "profile";
type Person = { id:string; name:string; username?:string|null; image?:string|null; relationship?:string; status?:string; sentByMe?:boolean };
type FeedEvent = { id:number; type:string; payload:{days?:number}; createdAt:string; name:string; username?:string };
type Entry = { id:string; title:string; calories:number };
type AppUser = { id:string; name:string; email:string; username?:string|null };

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
    const email=String(data.get("email")); const password=String(data.get("password"));
    if(mode==="signup") {
      const result=await authClient.signUp.email({email,password,name:String(data.get("name")),username:String(data.get("username"))});
      if(result.error) setError(result.error.message??"Не получилось создать аккаунт");
    } else {
      const result=await authClient.signIn.email({email,password});
      if(result.error) setError(result.error.message??"Неверная почта или пароль");
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
        {mode==="signup"&&<><label>Как тебя зовут<input name="name" required maxLength={60} placeholder="Лиза"/></label><label>Уникальный ник<input name="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_.]+" placeholder="liza.moves"/></label></>}
        <label>Почта<input name="email" type="email" required placeholder="you@example.com"/></label>
        <label>Пароль<input name="password" type="password" required minLength={8} placeholder="Минимум 8 символов"/></label>
        {error&&<p className="error">{error}</p>}
        <button className="primary" disabled={busy}>{busy?"Секунду…":mode==="signup"?"Создать аккаунт":"Войти"}</button>
      </form>
      {googleEnabled&&<button className="google" onClick={()=>authClient.signIn.social({provider:"google",callbackURL:"/"})}>G&nbsp;&nbsp; Продолжить с Google</button>}
      <p className="fineprint">{googleEnabled?"Можно войти через Google или по почте.":"Google подключим после покупки домена. Email и пароль уже готовы."}</p>
    </section>
  </main>;
}

function Today({userId}:{userId:string}) {
  const key=`ritm-entries-${userId}-${new Date().toISOString().slice(0,10)}`;
  const [entries,setEntries]=useState<Entry[]>([]); const [title,setTitle]=useState(""); const [calories,setCalories]=useState("");
  const goal=2000; const total=entries.reduce((sum,item)=>sum+item.calories,0); const percent=Math.min(100,Math.round(total/goal*100));
  useEffect(()=>{void Promise.resolve().then(()=>{try{setEntries(JSON.parse(localStorage.getItem(key)??"[]"));}catch{}});},[key]);
  useEffect(()=>{localStorage.setItem(key,JSON.stringify(entries)); if(entries.length) void jsonFetch("/api/daily-log",{method:"POST",body:JSON.stringify({date:new Date().toISOString().slice(0,10),caloriesEaten:total,activeCalories:0,calorieGoal:goal,streak:1})}).catch(()=>{});},[entries,key,total]);
  function add(event:FormEvent){event.preventDefault(); const value=Number(calories); if(!title.trim()||!value)return; setEntries(v=>[...v,{id:crypto.randomUUID(),title:title.trim(),calories:value}]);setTitle("");setCalories("");}
  return <section className="screen slide-up">
    <div className="hero-row"><div><p className="eyebrow">СЕГОДНЯ</p><h2>Держим ритм</h2><p className="muted">День завершится сам в полночь.</p></div><div className="streak"><span>🔥</span><b>{entries.length?1:0}</b><small>дней</small></div></div>
    <div className="progress-card"><div className="ring" style={{"--progress":`${percent*3.6}deg`} as React.CSSProperties}><div><b>{total}</b><small>из {goal} ккал</small></div></div><div><h3>{percent<50?"Отличное начало":percent<90?"Уже близко":"Цель дня рядом!"}</h3><p>Добавляй еду по мере дня. Ничего подтверждать вечером не нужно.</p></div></div>
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

function Profile({user}:{user:{name:string;email:string;username?:string|null}}) {
  const [settings,setSettings]=useState({isDiscoverable:true,shareStreak:true,shareGoalHits:true,shareWorkouts:true}); const [saved,setSaved]=useState(false);
  useEffect(()=>{jsonFetch<typeof settings>("/api/profile").then(v=>setSettings(s=>({...s,...v})));},[]);
  async function toggle(key:keyof typeof settings){const next={...settings,[key]:!settings[key]};setSettings(next);await jsonFetch("/api/profile",{method:"PATCH",body:JSON.stringify(next)});setSaved(true);setTimeout(()=>setSaved(false),1200);}
  return <section className="screen slide-up"><p className="eyebrow">ПРОФИЛЬ</p><div className="profile-head"><div className="big-avatar">{user.name.slice(0,1).toUpperCase()}</div><div><h2>{user.name}</h2><p>@{user.username??"ник"} · {user.email}</p></div></div>
    <div className="list-card settings"><h3>Приватность активности {saved&&<small>Сохранено ✓</small>}</h3><Toggle label="Меня можно найти по нику" value={settings.isDiscoverable} onClick={()=>toggle("isDiscoverable")}/><Toggle label="Показывать серию друзьям" value={settings.shareStreak} onClick={()=>toggle("shareStreak")}/><Toggle label="Показывать выполнение цели" value={settings.shareGoalHits} onClick={()=>toggle("shareGoalHits")}/><Toggle label="Показывать тренировки" value={settings.shareWorkouts} onClick={()=>toggle("shareWorkouts")}/><p className="privacy-note">Вес и точное количество калорий друзьям не показываются.</p></div>
    <button className="danger" onClick={()=>authClient.signOut()}>Выйти из аккаунта</button>
  </section>;
}
function Toggle({label,value,onClick}:{label:string;value:boolean;onClick:()=>void}){return <button className="toggle-row" onClick={onClick}><span>{label}</span><i className={value?"on":""}><u/></i></button>}

export function RitmApp() {
  const session=authClient.useSession(); const [tab,setTab]=useState<Tab>("today");
  const user=useMemo(()=>session.data?.user as AppUser|undefined,[session.data]);
  if(session.isPending)return <main className="loading"><div className="pulse">🔥</div></main>;
  if(!user)return <AuthScreen/>;
  return <main className="app-shell"><header><div className="brand"><span>🔥</span>Ритм</div><div className="mini-user"><span>{user.name.slice(0,1).toUpperCase()}</span><div><b>{user.name}</b><small>@{user.username??"ник"}</small></div></div></header><div className="content">{tab==="today"&&<Today userId={user.id}/>} {tab==="friends"&&<Friends/>} {tab==="profile"&&<Profile user={user}/>}</div><nav><button className={tab==="today"?"active":""} onClick={()=>setTab("today")}><span>◉</span>Сегодня</button><button className={tab==="friends"?"active":""} onClick={()=>setTab("friends")}><span>♣</span>Друзья</button><button className={tab==="profile"?"active":""} onClick={()=>setTab("profile")}><span>●</span>Профиль</button></nav></main>;
}
