"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { StatsScreen } from "@/components/stats";
import { BodyCard } from "@/components/body-card";
import { Leaderboard, Milestone, RepairCard } from "@/components/progress-extras";
import { Onboarding } from "@/components/onboarding";
import { FriendProfileSheet } from "@/components/friend-profile";
import { BarsIcon, CoinIcon, FlameIcon, FriendsIcon, HomeIcon, PersonIcon } from "@/components/icons";
import { basalRate, goalCalories, maintenance } from "@/lib/body";
import { AvatarEditor, CharacterAvatar } from "@/components/avatar-editor";
import type { AvatarConfig } from "@/lib/avatar";

type Tab = "today" | "stats" | "friends" | "profile";
type Person = { id:string; name:string; username?:string|null; image?:string|null; avatarConfig?:Partial<AvatarConfig>|null; relationship?:string; status?:string; sentByMe?:boolean; sharedWeightKg?:number|null;sharedCalories?:number|null;sharedSteps?:number|null;sharedFood?:string[];sharesWeight?:boolean;sharesCalories?:boolean;sharesSteps?:boolean;sharesFood?:boolean };
type FeedEvent = { id:number; type:string; payload:{days?:number;minutes?:number}; createdAt:string; name:string; username?:string };
type Entry = { id:string; title:string; calories:number; proteinG?:number|null; fatG?:number|null; carbsG?:number|null };
type FoodAnalysis = {
  title:string; calories:number; rangeMin:number; rangeMax:number;
  proteinG:number; fatG:number; carbsG:number;
  confidence:"low"|"medium"|"high"; explanation:string; assumptions:string[];
  remaining:number;
};
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

/** 1 380 вместо 1380 — крупные числа на экране читаются с одного взгляда. */
function spaced(value:number) { return value.toLocaleString("ru-RU").replace(/\u00a0/g,"\u202f"); }

async function jsonFetch<T>(url:string, init?:RequestInit):Promise<T> {
  const response=await fetch(url,{...init,headers:{"Content-Type":"application/json",...(init?.headers??{})}});
  if(!response.ok) throw new Error((await response.json().catch(()=>({}))).error??"request_failed");
  return response.json();
}

async function resizeFoodPhoto(file:File) {
  const url=URL.createObjectURL(file);
  try {
    const image=await new Promise<HTMLImageElement>((resolve,reject)=>{
      const element=new Image();
      element.onload=()=>resolve(element); element.onerror=()=>reject(new Error("invalid_photo")); element.src=url;
    });
    const longest=Math.max(image.naturalWidth,image.naturalHeight);
    const scale=Math.min(1,1024/longest);
    const width=Math.max(1,Math.round(image.naturalWidth*scale));
    const height=Math.max(1,Math.round(image.naturalHeight*scale));
    const canvas=document.createElement("canvas"); canvas.width=width; canvas.height=height;
    const context=canvas.getContext("2d");
    if(!context)throw new Error("invalid_photo");
    context.drawImage(image,0,0,width,height);
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",.72));
    if(!blob)throw new Error("invalid_photo");
    return new File([blob],"food.jpg",{type:"image/jpeg"});
  } finally { URL.revokeObjectURL(url); }
}

type Macros = { proteinG:number|null; fatG:number|null; carbsG:number|null };

/** «12.4» → «12,4», а целое — без хвоста: 12 г белка читается лучше, чем 12,0 г. */
function grams(value:number|null|undefined) {
  if(value===null||value===undefined) return "—";
  return (Math.round(value*10)/10).toLocaleString("ru-RU",{maximumFractionDigits:1});
}

function FoodAiEstimator({onAdd,onClose}:{onAdd:(title:string,calories:number,macros:Macros)=>Promise<boolean>;onClose:()=>void}) {
  const [description,setDescription]=useState(""); const [photo,setPhoto]=useState<File|null>(null);
  const [preview,setPreview]=useState(""); const [result,setResult]=useState<FoodAnalysis|null>(null);
  const [title,setTitle]=useState(""); const [calories,setCalories]=useState("");
  const [protein,setProtein]=useState(""); const [fat,setFat]=useState(""); const [carbs,setCarbs]=useState("");
  const [busy,setBusy]=useState(false); const [saving,setSaving]=useState(false); const [error,setError]=useState("");
  const previewRef=useRef("");
  useEffect(()=>()=>{if(previewRef.current)URL.revokeObjectURL(previewRef.current);},[]);
  function choosePhoto(next:File|null){
    if(previewRef.current)URL.revokeObjectURL(previewRef.current);
    const url=next?URL.createObjectURL(next):"";previewRef.current=url;setPreview(url);setPhoto(next);
  }
  const confidence={low:"низкая",medium:"средняя",high:"высокая"};
  const errors:Record<string,string>={
    ai_not_configured:"Анализ пока не подключён на сервере.",daily_limit:"На сегодня использованы все 100 анализов.",
    ai_busy:"Gemini сейчас перегружен — попробуй чуть позже.",analysis_timeout:"Gemini отвечает слишком долго — попробуй ещё раз.",
    invalid_photo:"Не удалось прочитать фото. Попробуй сделать его ещё раз.",invalid_description:"Опиши порцию чуть подробнее.",
    invalid_ai_response:"Gemini не смог уверенно разобрать блюдо. Добавь деталей в описание.",analysis_failed:"Не удалось проанализировать еду.",
  };
  async function analyze(event:FormEvent){
    event.preventDefault();if(!photo||description.trim().length<10||busy)return;
    setBusy(true);setError("");setResult(null);
    try{
      const prepared=await resizeFoodPhoto(photo);
      const form=new FormData();form.set("description",description.trim());form.set("photo",prepared);
      const response=await fetch("/api/food-analyze",{method:"POST",body:form});
      const payload=await response.json().catch(()=>({error:"analysis_failed"})) as FoodAnalysis&{error?:string};
      if(!response.ok)throw new Error(payload.error??"analysis_failed");
      setResult(payload);setTitle(payload.title);setCalories(String(payload.calories));
      setProtein(String(payload.proteinG));setFat(String(payload.fatG));setCarbs(String(payload.carbsG));
    }catch(reason){const code=reason instanceof Error?reason.message:"analysis_failed";setError(errors[code]??errors.analysis_failed);}
    finally{setBusy(false);}
  }
  async function save(event:FormEvent){
    event.preventDefault();const value=Number(calories);if(!title.trim()||!value||saving)return;
    setSaving(true);setError("");
    const number=(text:string)=>{const parsed=Number(text.replace(",","."));return Number.isFinite(parsed)&&parsed>=0?parsed:null;};
    const ok=await onAdd(title.trim(),value,{proteinG:number(protein),fatG:number(fat),carbsG:number(carbs)});
    if(ok)onClose();else setError("Не удалось добавить запись в дневник.");
    setSaving(false);
  }
  if(result)return <div className="ai-estimator ai-result">
    <div className="ai-result-head"><span>✨</span><div><b>Оценка готова</b><small>Уверенность: {confidence[result.confidence]}</small></div></div>
    <div className="ai-range"><b>≈ {spaced(result.calories)} ккал</b><small>вероятный диапазон {spaced(result.rangeMin)}–{spaced(result.rangeMax)} ккал</small></div>
    <div className="macros">
      <div><b>{grams(result.proteinG)}</b><small>белки, г</small></div>
      <div><b>{grams(result.fatG)}</b><small>жиры, г</small></div>
      <div><b>{grams(result.carbsG)}</b><small>углеводы, г</small></div>
    </div>
    <p>{result.explanation}</p>
    {result.assumptions.length>0&&<details><summary>Что Gemini предположил</summary><ul>{result.assumptions.map(item=><li key={item}>{item}</li>)}</ul></details>}
    <form className="ai-confirm" onSubmit={save}>
      <label>Название<input value={title} onChange={event=>setTitle(event.target.value)} maxLength={120} required/></label>
      <label>Калории<input value={calories} onChange={event=>setCalories(event.target.value)} type="number" min="1" max="10000" required/></label>
      <div className="ai-macro-fields">
        <label>Белки, г<input value={protein} onChange={event=>setProtein(event.target.value)} type="number" min="0" max="2000" step="0.1" inputMode="decimal"/></label>
        <label>Жиры, г<input value={fat} onChange={event=>setFat(event.target.value)} type="number" min="0" max="2000" step="0.1" inputMode="decimal"/></label>
        <label>Углеводы, г<input value={carbs} onChange={event=>setCarbs(event.target.value)} type="number" min="0" max="2000" step="0.1" inputMode="decimal"/></label>
      </div>
      <button className="btn-primary" disabled={saving}>{saving?"Добавляю…":"Добавить в дневник"}</button>
    </form>
    <small className="ai-disclaimer">Это приблизительная оценка, а не медицинское измерение. Проверь цифры перед добавлением. Осталось анализов: {result.remaining}.</small>
    {error&&<p className="ai-error" role="alert">{error}</p>}
    <button className="ai-back" type="button" onClick={()=>setResult(null)}>Изменить фото или описание</button>
  </div>;
  return <form className="ai-estimator" onSubmit={analyze}>
    <div className="ai-heading"><div><span>✨</span><h4>Оценить с Gemini</h4></div><button type="button" onClick={onClose} aria-label="Закрыть">×</button></div>
    <label className="ai-field"><b>1. Опиши порцию честно</b><textarea value={description} onChange={event=>setDescription(event.target.value)} minLength={10} maxLength={800} required rows={4} placeholder="Например: около 250 г домашнего плова с курицей, масла примерно столовая ложка. На фото вся порция."/><small>Укажи примерный вес или объём, состав, масло и соусы. Для упаковки — бренд и размер.</small></label>
    <label className={`ai-photo${preview?" has-photo":""}`}>
      <input type="file" accept="image/*" capture="environment" required onChange={event=>choosePhoto(event.target.files?.[0]??null)}/>
      {/* blob: — одноразовый локальный предпросмотр, оптимизация Next Image здесь неприменима. */}
      {preview?<img src={preview} alt="Выбранная еда"/>:<span>📷</span> /* eslint-disable-line @next/next/no-img-element */}
      <b>{preview?"Сменить фотографию":"2. Сделать или выбрать фото"}</b>
    </label>
    <p className="ai-privacy">Фото отправится Google Gemini для анализа и не сохранится в Ритме. На бесплатном тарифе Google может использовать данные для улучшения своих продуктов.</p>
    {error&&<p className="ai-error" role="alert">{error}</p>}
    <button className="btn-primary" disabled={busy||!photo||description.trim().length<10}>{busy?"Gemini считает порцию…":"Оценить калории"}</button>
  </form>;
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

/** «ЧЕТВЕРГ, 12 ИЮНЯ» — надзаголовок тёмной карточки. */
function weekdayLine(now=new Date()) {
  return now.toLocaleDateString("ru",{weekday:"long",day:"numeric",month:"long"}).toUpperCase();
}

/** Стикер по названию блюда: чуть живее, чем одна вилка на всё. */
function mealSticker(title:string) {
  const text=title.toLowerCase();
  if(/кофе|латте|чай|капучино|americano|американо/.test(text)) return "☕";
  if(/суп|борщ|бульон|лапш|рамен|похлёб/.test(text)) return "🍜";
  if(/салат|овощ|огур|помидор|капуст/.test(text)) return "🥗";
  if(/каша|овсян|гранол|мюсли|йогурт|творог/.test(text)) return "🥣";
  if(/яблок|банан|ягод|фрукт|груш|апельсин|клубник/.test(text)) return "🍓";
  if(/мясо|курин|курица|котлет|стейк|говядин|свинин/.test(text)) return "🍗";
  if(/хлеб|булк|бутер|сэндвич|тост|горбушк/.test(text)) return "🥪";
  if(/торт|шоколад|конфет|печен|пирож|десерт|мороже/.test(text)) return "🍰";
  if(/паст|макарон|спагетт|рис|греч|картош/.test(text)) return "🍝";
  return "🍽️";
}

type WeekCell = { date:string; label:string; state:"ok"|"over"|"today"|"future"|"empty" };

function Today({onStreak,avatar,userName}:{onStreak?:(days:number,coins:number)=>void;avatar?:Partial<AvatarConfig>|null;userName:string}) {
  const date=todayKey();
  const [adding,setAdding]=useState(()=>
    typeof window!=="undefined"&&new URLSearchParams(window.location.search).get("add")==="food");
  const [aiAdding,setAiAdding]=useState(false);
  const [week,setWeek]=useState<WeekCell[]>([]);
  const firstName=userName.split(" ")[0]||userName;
  const [section,setSection]=useState<"food"|"movement"|"weight">("food");
  const [entries,setEntries]=useState<Entry[]>([]); const [title,setTitle]=useState(""); const [calories,setCalories]=useState("");
  const [busy,setBusy]=useState(false);
  const [health,setHealth]=useState<HealthSnapshot>({activeCalories:0,steps:null,weightKg:null});
  const [healthAvailable,setHealthAvailable]=useState(false); const [healthStatus,setHealthStatus]=useState(""); const [healthBusy,setHealthBusy]=useState(false);
  const [streak,setStreak]=useState(0); const [coins,setCoins]=useState(0);
  const goal=health.calorieGoal??2000;
  const total=entries.reduce((sum,item)=>sum+item.calories,0);
  // БЖУ есть только у записей от Gemini, поэтому сводку показываем,
  // лишь когда хотя бы одна запись их принесла.
  const macroTotals=entries.reduce((sum,item)=>({
    protein:sum.protein+(item.proteinG??0),
    fat:sum.fat+(item.fatG??0),
    carbs:sum.carbs+(item.carbsG??0),
    known:sum.known||item.proteinG!=null||item.fatG!=null||item.carbsG!=null,
  }),{protein:0,fat:0,carbs:0,known:false});
  const ratio=total/goal;
  const percent=Math.min(100,Math.round(ratio*100));
  // Цель здесь — предел, а не достижение: перебор не должен выглядеть победой.
  const ringState=ratio>1?"over":ratio>=0.9?"close":"ok";
  const healthFreshness=health.healthSyncedAt
    ? `Обновлено в ${new Date(health.healthSyncedAt).toLocaleTimeString("ru",{hour:"2-digit",minute:"2-digit"})} ✓`
    : "Пока не подключено";
  // Формула макета: осталось = норма − съедено + сожжено на тренировках.
  const burned=health.activeCalories||0;
  const left=goal-total+burned;
  const streakLine=streak===0
    ? "Отметь сегодняшний день — и серия начнётся."
    : `${streak===1?"Первый день":`${streak}-й день`} подряд. Так держать.`;
  // Записи живут на сервере. В localStorage их держать нельзя: при уходе со вкладки
  // компонент размонтируется, и сохранение пустого списка затирало данные.
  useEffect(()=>{void jsonFetch<Entry[]>(`/api/food-entries?date=${date}`).then(setEntries).catch(()=>{});},[date]);
  const refreshDay=useCallback(()=>{
    void jsonFetch<HealthSnapshot>(`/api/daily-log?date=${date}`).then(setHealth).catch(()=>{});
    void jsonFetch<{days:number;coins:number}>("/api/streak").then(result=>{setStreak(result.days);setCoins(result.coins);onStreak?.(result.days,result.coins);}).catch(()=>{});
  },[date,onStreak]);
  useEffect(()=>{refreshDay();},[refreshDay]);
  // Полоса недели: последние 5 дней из истории, статус считается от нормы дня.
  useEffect(()=>{
    void jsonFetch<{date:string;caloriesEaten:number;calorieGoal:number}[]>("/api/history?days=7").then(days=>{
      setWeek(days.slice(-5).map(day=>({
        date:day.date,
        label:new Date(`${day.date}T00:00`).toLocaleDateString("ru",{weekday:"short"}),
        state:day.date===date?"today"
          :day.caloriesEaten===0?"empty"
          :day.caloriesEaten>day.calorieGoal?"over":"ok",
      })));
    }).catch(()=>{});
  },[date,entries.length]);
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
  async function createEntry(nextTitle:string,value:number,macros?:Macros){
    if(!nextTitle.trim()||!value||busy)return false;
    setBusy(true);
    try{
      const saved=await jsonFetch<Entry>("/api/food-entries",{method:"POST",
        body:JSON.stringify({date,title:nextTitle.trim(),calories:value,...macros})});
      const next=[...entries,saved];
      setEntries(next);
      refreshDay();
      setBusy(false);return true;
    }catch{setBusy(false);return false;}
  }
  async function add(event:FormEvent){
    event.preventDefault();
    const value=Number(calories); if(!title.trim()||!value||busy)return;
    if(await createEntry(title,value)){setTitle("");setCalories("");setAdding(false);}
  }
  function cancelAdding(){
    setTitle("");
    setCalories("");
    setAdding(false);
  }
  async function remove(id:string){
    const next=entries.filter(item=>item.id!==id);
    setEntries(next);
    await jsonFetch(`/api/food-entries?id=${encodeURIComponent(id)}`,{method:"DELETE"}).catch(()=>{});
    refreshDay();
  }
  return <section className="screen">
    <div className="hero-dark today-hero">
      <CharacterAvatar value={avatar} size="large" label="Твой персонаж"/>
      <div>
        <p className="eyebrow">{weekdayLine()}</p>
        <h2>Привет, {firstName}</h2>
        <p>{streakLine}</p>
      </div>
    </div>

    <div className="week-strip">{week.map(day=>
      <span key={day.date} className={`week-day ${day.state}`}>{day.label}<i/></span>)}</div>

    <div className={`calorie-card${ringState==="over"?" over":""}`}>
      <div className="calorie-ring" style={{"--progress":`${percent*3.6}deg`,"--ring-color":ringState==="over"?"var(--red)":"var(--green)"} as React.CSSProperties}>
        <b>{percent}%</b>
      </div>
      <div>
        <p className="eyebrow">{left>0?"ОСТАЛОСЬ СЕГОДНЯ":"НОРМА ИСЧЕРПАНА"}</p>
        <b className="calorie-left">{spaced(Math.abs(left))} ккал</b>
        <div className="calorie-formula">
          <small>норма {spaced(goal)}</small>
          <small className="eaten">− {spaced(total)} еда</small>
          {burned>0&&<small className="burned">+ {spaced(burned)} спорт</small>}
        </div>
      </div>
    </div>

    <div className="segmented" role="tablist" aria-label="Раздел дневника">
      <button role="tab" className={section==="food"?"active":""} aria-selected={section==="food"} onClick={()=>setSection("food")}>Питание</button>
      <button role="tab" className={section==="movement"?"active":""} aria-selected={section==="movement"} onClick={()=>setSection("movement")}>Движение</button>
      <button role="tab" className={section==="weight"?"active":""} aria-selected={section==="weight"} onClick={()=>setSection("weight")}>Вес</button>
    </div>
    {section==="food"&&<div className="day-panel slide-up">
      <div className="card">
        <div className="card-head"><h3>Сегодня</h3><small>{entries.length} {plural(entries.length,"запись","записи","записей")} · {spaced(total)} ккал</small></div>
        {macroTotals.known&&<div className="macros day-macros">
          <div><b>{grams(macroTotals.protein)}</b><small>белки, г</small></div>
          <div><b>{grams(macroTotals.fat)}</b><small>жиры, г</small></div>
          <div><b>{grams(macroTotals.carbs)}</b><small>углеводы, г</small></div>
        </div>}
        {entries.length===0
          ? <div className="empty"><span>🍓</span><p>Запиши первый приём пищи — дальше будет проще</p></div>
          : entries.map(item=><div className="entry-row" key={item.id}>
              <span aria-hidden>{mealSticker(item.title)}</span>
              <span className="entry-name"><b>{item.title}</b></span>
              <em>{item.calories}</em>
              <button className="remove" onClick={()=>void remove(item.id)} aria-label="Удалить">×</button>
            </div>)}
        {aiAdding
          ? <FoodAiEstimator onAdd={createEntry} onClose={()=>setAiAdding(false)}/>
          : adding
          ? <form className="quick-add" onSubmit={add} style={{marginTop:12}}>
              <input value={title} onChange={e=>setTitle(e.target.value)} autoFocus placeholder="Что съел? Например, клубника"/>
              <input value={calories} onChange={e=>setCalories(e.target.value)} type="number" min="1" max="10000" placeholder="ккал"/>
              <button className="btn-primary" disabled={busy}>{busy?"…":"Добавить"}</button>
              <button type="button" className="quick-cancel" disabled={busy} onClick={cancelAdding}>Отмена</button>
            </form>
          : <div className="food-add-actions">
              <button className="btn-primary" onClick={()=>setAiAdding(true)}><span aria-hidden>✨</span> Оценить по фото</button>
              <button className="btn-secondary" onClick={()=>setAdding(true)}>Ввести вручную</button>
            </div>}
      </div>
      <Milestone streak={streak}/>
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
  const [peek,setPeek]=useState<string|null>(null);
  const refresh=useCallback(async()=>{const [friends,events]=await Promise.all([jsonFetch<Person[]>("/api/friends"),jsonFetch<FeedEvent[]>("/api/feed")]);setPeople(friends);setFeed(events);},[]);
  useEffect(()=>{void Promise.resolve().then(refresh);},[refresh]);
  useEffect(()=>{const timer=setTimeout(()=>{if(query.trim().length>=2)jsonFetch<Person[]>(`/api/users/search?q=${encodeURIComponent(query)}`).then(setResults);else setResults([]);},250);return()=>clearTimeout(timer);},[query]);
  async function request(userId:string){try{await jsonFetch("/api/friends",{method:"POST",body:JSON.stringify({userId})});setNotice("Заявка отправлена");await refresh();}catch{setNotice("Заявка уже существует");}}
  async function act(userId:string,action:"accept"|"reject"){await jsonFetch(`/api/friends/${userId}`,{method:"PATCH",body:JSON.stringify({action})});await refresh();}
  const incoming=people.filter(p=>p.status==="pending"&&!p.sentByMe); const accepted=people.filter(p=>p.status==="accepted");
  const [invited,setInvited]=useState("");
  /** Делимся ссылкой на приложение: системный лист, а где его нет — буфер обмена. */
  async function invite(){
    const url=window.location.origin;
    const text="Веду дневник питания в Ритме — присоединяйся";
    try{
      if(navigator.share){await navigator.share({title:"Ритм",text,url});return;}
      await navigator.clipboard.writeText(`${text}: ${url}`);
      setInvited("Ссылка скопирована ✓");
    }catch{setInvited("");}
    setTimeout(()=>setInvited(""),2200);
  }
  return <section className="screen" style={{paddingBottom:78}}>
    <Leaderboard onOpen={setPeek}/>
    <div className="card">
      <div className="card-head"><h3>Найти человека</h3></div>
      <input className="search-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ник или имя"/>
      {notice&&<small className="health-status">{notice}</small>}
      {results.map(person=><PersonRow key={person.id} person={person} onOpen={()=>setPeek(person.id)} action={person.relationship==="none"?<button onClick={()=>request(person.id)}>Добавить</button>:<span className="status">{person.relationship==="friends"?"Уже друзья":"Заявка отправлена"}</span>}/>)}
    </div>
    {incoming.length>0&&<div className="card"><div className="card-head"><h3>Заявки</h3></div>{incoming.map(p=><PersonRow key={p.id} person={p} onOpen={()=>setPeek(p.id)} action={<div className="row-actions"><button onClick={()=>act(p.id,"accept")}>Принять</button><button className="ghost" onClick={()=>act(p.id,"reject")}>Нет</button></div>}/>)}</div>}
    <div className="card"><div className="card-head"><h3>Твои друзья</h3><small>{accepted.length}</small></div>{accepted.length?accepted.map(p=><PersonRow key={p.id} person={p} onOpen={()=>setPeek(p.id)}/>):<div className="empty"><span>👋</span><p>Найди друга по уникальному нику</p></div>}</div>
    <div className="card"><div className="card-head"><h3>Активность</h3></div>{feed.length?feed.map(event=><div className="feed" key={event.id}><span>{event.type==="workout"?"🏋️":"🔥"}</span><p>{event.type==="workout"?<><b>{event.name}</b> добавил тренировку · {event.payload.minutes??0} мин</>:<><b>{event.name}</b> уже {event.payload.days??1} {plural(event.payload.days??1,"день","дня","дней")} подряд</>}</p><time>{new Date(event.createdAt).toLocaleDateString("ru")}</time></div>):<div className="empty"><span>✨</span><p>Здесь появятся успехи друзей</p></div>}</div>
    <div className="floating"><button className="btn-primary lg" onClick={()=>void invite()}>{invited||"Позвать друга"}</button></div>
    {peek&&<FriendProfileSheet userId={peek} onClose={()=>setPeek(null)} onChanged={()=>void refresh()}/>}
  </section>;
}

function PersonRow({person,action,onOpen}:{person:Person;action?:React.ReactNode;onOpen?:()=>void}) {const hasShared=person.status==="accepted"&&(person.sharesWeight||person.sharesCalories||person.sharesSteps||person.sharesFood);return <div className={`person${hasShared?" with-metrics":""}`}><CharacterAvatar value={person.avatarConfig} size="small" label={`Персонаж ${person.name}`}/><button type="button" className="person-name" onClick={onOpen} disabled={!onOpen}><b>{person.name}</b><small>@{person.username??"без-ника"}</small></button>{action&&<div className="person-action">{action}</div>}{hasShared&&<div className="friend-metrics">{person.sharesWeight&&<span>⚖️ <b>{person.sharedWeightKg??"—"}</b> кг</span>}{person.sharesCalories&&<span>🍽️ <b>{person.sharedCalories??"—"}</b> ккал</span>}{person.sharesSteps&&<span>👟 <b>{person.sharedSteps??"—"}</b> шагов</span>}{person.sharesFood&&<div className="friend-food"><b>Что ел сегодня</b>{person.sharedFood?.length?<p>{person.sharedFood.join(" · ")}</p>:<p>Пока ничего не записал</p>}</div>}</div>}</div>}

/**
 * Предложение установить приложение. На Android и в десктопном Chrome браузер
 * сам отдаёт beforeinstallprompt — там показываем кнопку, которая вызывает
 * системное окно. Safari такого события не даёт, поэтому для iPhone остаётся
 * короткая инструкция.
 */
type InstallWay = { key:string; title:string; steps:React.ReactNode };

/**
 * Как поставить приложение в конкретном браузере.
 *
 * Системное окно установки умеет вызывать только Chromium: он присылает
 * beforeinstallprompt, и тогда достаточно одной кнопки. Firefox и Safari
 * такого события не дают — там установка живёт в меню браузера, поэтому
 * остаётся показать, куда нажимать.
 */
function installWay():InstallWay|null {
  const agent=navigator.userAgent;
  const firefox=/Firefox\/|FxiOS/.test(agent);
  const ios=/iPad|iPhone|iPod/.test(agent)
    ||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  const android=/Android/.test(agent);

  if(ios) return {key:"ios",title:"Поставь «Ритм» на домашний экран",
    steps:<>Кнопка <b>Поделиться</b> внизу Safari → <b>«На экран „Домой“»</b> → <b>«Добавить»</b>.</>};
  if(firefox&&android) return {key:"firefox-android",title:"Поставь «Ритм» на домашний экран",
    steps:<>Меню <b>⋮</b> справа от адресной строки → <b>«Установить»</b> (в старых версиях — <b>«Добавить на главный экран»</b>).</>};
  if(android) return {key:"android",title:"Поставь «Ритм» на домашний экран",
    steps:<>Меню <b>⋮</b> браузера → <b>«Установить приложение»</b> или <b>«Добавить на главный экран»</b>.</>};
  if(firefox) return {key:"firefox-desktop",title:"Firefox не умеет устанавливать сайты",
    steps:<>На компьютере приложение ставится из <b>Chrome</b>, <b>Edge</b> или <b>Opera</b>: значок установки в адресной строке. В Firefox Ритм работает как обычная вкладка — можно просто добавить в закладки.</>};
  return {key:"desktop",title:"Поставь «Ритм» отдельным приложением",
    steps:<>Значок установки в правой части адресной строки, либо меню браузера → <b>«Установить приложение»</b>.</>};
}


/**
 * Раздел «Установить приложение» в профиле. В отличие от подсказки сверху,
 * он не прячется навсегда: если системного окна браузер не даёт, показываем
 * инструкцию под его меню.
 */
function InstallSection() {
  const [installed,setInstalled]=useState(false);
  const [way,setWay]=useState<InstallWay|null>(null);
  const [promptEvent,setPromptEvent]=useState<InstallPromptEvent|null>(null);
  const [note,setNote]=useState("");
  useEffect(()=>{
    const standalone=window.matchMedia("(display-mode: standalone)").matches
      ||window.matchMedia("(display-mode: minimal-ui)").matches
      ||(window.navigator as Navigator&{standalone?:boolean}).standalone===true;
    queueMicrotask(()=>{setInstalled(standalone);setWay(installWay());});
    const capture=(event:Event)=>{event.preventDefault();setPromptEvent(event as InstallPromptEvent);};
    const done=()=>{setInstalled(true);setPromptEvent(null);};
    window.addEventListener("beforeinstallprompt",capture);
    window.addEventListener("appinstalled",done);
    return()=>{window.removeEventListener("beforeinstallprompt",capture);window.removeEventListener("appinstalled",done);};
  },[]);
  async function install(){
    if(!promptEvent)return;
    await promptEvent.prompt();
    const choice=await promptEvent.userChoice;
    setPromptEvent(null);
    setNote(choice.outcome==="accepted"?"Готово — ярлык на главном экране ✓":"Установку отменили.");
    setTimeout(()=>setNote(""),2600);
  }
  if(installed) return <p className="install-note">Ритм уже установлен и открыт как приложение.</p>;
  return <div className="install-section">
    {promptEvent
      ? <><p className="install-note">Браузер поставит Ритм одним нажатием: ярлык на главном экране, запуск без адресной строки.</p>
          <button className="btn-primary" onClick={()=>void install()}>Установить приложение</button></>
      : way&&<><p className="install-note"><b>{way.title}.</b> {way.steps}</p></>}
    {note&&<small className="health-status">{note}</small>}
  </div>;
}

function InstallHint() {
  const [mode,setMode]=useState<"off"|"prompt"|"manual">("off");
  const [way,setWay]=useState<InstallWay|null>(null);
  const [promptEvent,setPromptEvent]=useState<InstallPromptEvent|null>(null);
  const [note,setNote]=useState("");
  useEffect(()=>{
    const standalone=window.matchMedia("(display-mode: standalone)").matches
      ||window.matchMedia("(display-mode: minimal-ui)").matches
      ||(window.navigator as Navigator&{standalone?:boolean}).standalone===true;
    if(standalone||localStorage.getItem("ritm-install-hint")==="off")return;
    const capture=(event:Event)=>{
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setMode("prompt");
    };
    window.addEventListener("beforeinstallprompt",capture);
    // Установили — подсказка больше не нужна ни в этой вкладке, ни в следующей.
    const installed=()=>{localStorage.setItem("ritm-install-hint","off");setMode("off");};
    window.addEventListener("appinstalled",installed);
    // Chromium присылает событие не мгновенно. Ждём его, и только если оно
    // так и не пришло, показываем ручную инструкцию — иначе подсказка
    // успела бы моргнуть текстом про меню и смениться на кнопку.
    const fallback=window.setTimeout(()=>{
      setMode(current=>{
        if(current!=="off")return current;
        setWay(installWay());
        return "manual";
      });
    },1400);
    return()=>{
      window.clearTimeout(fallback);
      window.removeEventListener("beforeinstallprompt",capture);
      window.removeEventListener("appinstalled",installed);
    };
  },[]);
  function hide(){localStorage.setItem("ritm-install-hint","off");setMode("off");}
  async function install(){
    if(!promptEvent)return;
    await promptEvent.prompt();
    const choice=await promptEvent.userChoice;
    setPromptEvent(null);
    if(choice.outcome==="accepted"){hide();return;}
    setNote("Можно установить позже этой же кнопкой.");
  }
  if(mode==="off")return null;
  if(mode==="prompt")return <div className="install-hint pop-in">
    <span aria-hidden>📲</span>
    <p><b>Установить «Ритм»?</b> Появится на главном экране и будет открываться без адресной строки.{note&&<> {note}</>}</p>
    <button className="install-go" onClick={()=>void install()}>Установить</button>
    <button onClick={hide} aria-label="Скрыть подсказку">×</button>
  </div>;
  if(!way)return null;
  return <div className="install-hint pop-in">
    <span aria-hidden>📲</span>
    <p><b>{way.title}.</b> {way.steps}</p>
    <button onClick={hide} aria-label="Скрыть подсказку">×</button>
  </div>;
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
  const [profile,setProfile]=useState<{heightCm?:number|null;sex?:"male"|"female"|null;birthYear?:number|null;activityLevel?:string;targetWeightKg?:number|null;goalDirection?:GoalDirection|null}>({});
  const [weight,setWeight]=useState<number|null>(null); const [saved,setSaved]=useState(false); const [choosing,setChoosing]=useState(false); const [note,setNote]=useState("");
  useEffect(()=>{void Promise.all([
    jsonFetch<{calorieGoal?:number;goalDirection?:GoalDirection|null;heightCm?:number|null;sex?:"male"|"female"|null;birthYear?:number|null;activityLevel?:string;targetWeightKg?:number|null}>("/api/profile"),
    jsonFetch<{weightKg:number}[]>("/api/weight"),
  ]).then(([current,history])=>{const latest=history.at(-1)?.weightKg??null;const inferred=!current.targetWeightKg||!latest?"keep":current.targetWeightKg<latest-0.3?"lose":current.targetWeightKg>latest+0.3?"gain":"keep";setGoal(String(current.calorieGoal??2000));setDirection(current.goalDirection??inferred);setProfile(current);setWeight(latest);}).catch(()=>{});},[]);
  async function choose(next:GoalDirection){
    if(choosing||(next===direction&&profile.goalDirection===next))return;
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
      setProfile(current=>({...current,goalDirection:next}));
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

function Profile({user,avatar,streak,onOpenMaker,onOpenOnboarding}:{user:{name:string;email:string;username?:string|null};avatar?:Partial<AvatarConfig>|null;streak:number;onOpenMaker:()=>void;onOpenOnboarding:()=>void}) {
  const [settings,setSettings]=useState({isDiscoverable:true,shareStreak:true,shareGoalHits:true,shareWorkouts:true,shareWeight:false,shareCalories:false,shareSteps:false,shareFood:false}); const [saved,setSaved]=useState(false);
  const [privacyError,setPrivacyError]=useState(false);
  const [weightChange,setWeightChange]=useState<number|null>(null);
  const [joined,setJoined]=useState("");
  const [totals,setTotals]=useState({loggedDays:0,goalDays:0,workoutMinutes:0});
  useEffect(()=>{jsonFetch<typeof settings>("/api/profile").then(v=>setSettings(s=>({...s,...v})));},[]);
  // Достижения считаем из истории — отдельной таблицы под них заводить не нужно.
  useEffect(()=>{
    void jsonFetch<{date:string;caloriesEaten:number;calorieGoal:number;weightKg:number|null;workoutMinutes:number}[]>("/api/history?days=30")
      .then(days=>{
        const weighed=days.filter(day=>day.weightKg!==null);
        setWeightChange(weighed.length>1?weighed[weighed.length-1].weightKg!-weighed[0].weightKg!:null);
        setJoined(days.length?new Date(`${days[0].date}T00:00`).toLocaleDateString("ru",{month:"long"}):"");
        setTotals({
          loggedDays:days.filter(day=>day.caloriesEaten>0).length,
          goalDays:days.filter(day=>day.caloriesEaten>0&&day.caloriesEaten<=day.calorieGoal).length,
          workoutMinutes:days.reduce((sum,day)=>sum+day.workoutMinutes,0),
        });
      }).catch(()=>{});
  },[]);
  const badges=[
    {key:"streak",icon:"🏅",tone:"warm",title:"Неделя подряд",earned:streak>=7},
    {key:"goal",icon:"🥗",tone:"",title:"10 дней в своей норме",earned:totals.goalDays>=10},
    {key:"sport",icon:"🏃",tone:"cool",title:"100 минут тренировок за месяц",earned:totals.workoutMinutes>=100},
    {key:"log",icon:"📖",tone:"warm",title:"20 дней с записями",earned:totals.loggedDays>=20},
  ];
  async function toggle(key:keyof typeof settings){
    const value=!settings[key];
    setPrivacyError(false);setSettings(current=>({...current,[key]:value}));
    try{
      // Отправляем только изменённое поле: быстрые нажатия больше не могут
      // перезаписать соседние переключатели устаревшим состоянием.
      await jsonFetch("/api/profile",{method:"PATCH",body:JSON.stringify({[key]:value})});
      setSaved(true);setTimeout(()=>setSaved(false),1200);
    }catch{setSettings(current=>({...current,[key]:!value}));setPrivacyError(true);}
  }
  return <section className="screen">
    <div className="hero-dark profile-hero">
      <CharacterAvatar value={avatar} size="large" label="Твой персонаж"/>
      <div>
        <h2>{user.name}</h2>
        <p>@{user.username??"ник"}{joined&&` · в Ритме с ${joined}`}</p>
      </div>
      <button className="btn-edit" onClick={onOpenMaker}>Изменить персонажа</button>
    </div>

    <div className="tiles">
      <div className="tile"><b>{streak}</b><small>{plural(streak,"день","дня","дней")} подряд</small></div>
      <div className="tile"><b>{weightChange===null?"—":`${weightChange>0?"+":"−"}${Math.abs(weightChange).toFixed(1).replace(".",",")}`}</b><small>кг за месяц</small></div>
    </div>

    <div className="card">
      <div className="card-head"><h3>Достижения</h3><small>{badges.filter(b=>b.earned).length} из {badges.length}</small></div>
      <div className="badges">{badges.map(badge=>
        <span key={badge.key} className={`badge ${badge.earned?badge.tone:"off"}`} title={badge.title} aria-label={badge.title}>{badge.earned?badge.icon:"🔒"}</span>)}</div>
    </div>

    <div className="profile-menu">
      <button className="profile-group profile-link" onClick={onOpenMaker}><span>🧑‍🎨</span><div><b>Мой персонаж</b><small>Внешность, одежда и аксессуары</small></div><i>›</i></button>
      <details className="profile-group" name="profile-settings"><summary><span>🎯</span><div><b>Цель и дневная норма</b><small>Снизить, держать или набрать вес</small></div><i>›</i></summary><div className="profile-group-content"><GoalRow/><button className="recalculate" onClick={onOpenOnboarding}>Пройти полный расчёт заново</button></div></details>
      <details className="profile-group" name="profile-settings"><summary><span>📐</span><div><b>Тело и расчёты</b><small>ИМТ, цель и расход энергии</small></div><i>›</i></summary><div className="profile-group-content"><BodyCard embedded/></div></details>
      <details className="profile-group" name="profile-settings"><summary><span>🎨</span><div><b>Оформление</b><small>Светлая или тёмная тема</small></div><i>›</i></summary><div className="profile-group-content"><ThemeControl/></div></details>
      <details className="profile-group" name="profile-settings"><summary><span>📲</span><div><b>Установить приложение</b><small>Ярлык на главном экране, запуск без адресной строки</small></div><i>›</i></summary><div className="profile-group-content"><InstallSection/></div></details>
      <details className="profile-group" name="profile-settings"><summary><span>🔒</span><div><b>Приватность</b><small>{privacyError?"Не сохранилось":saved?"Сохранено ✓":"Что видят другие люди"}</small></div><i>›</i></summary><div className="profile-group-content settings"><h4 className="privacy-section-title">Для друзей</h4><Toggle label="Показывать мой вес" value={settings.shareWeight} onClick={()=>toggle("shareWeight")}/><Toggle label="Показывать съеденные калории за день" value={settings.shareCalories} onClick={()=>toggle("shareCalories")}/><Toggle label="Показывать, что я ем" value={settings.shareFood} onClick={()=>toggle("shareFood")}/><Toggle label="Показывать шаги за день" value={settings.shareSteps} onClick={()=>toggle("shareSteps")}/><Toggle label="Показывать тренировки" value={settings.shareWorkouts} onClick={()=>toggle("shareWorkouts")}/><h4 className="privacy-section-title public">Для всех в общем рейтинге</h4><Toggle label="Показывать серию дней" value={settings.shareStreak} onClick={()=>toggle("shareStreak")}/><Toggle label="Показывать выполнение цели" value={settings.shareGoalHits} onClick={()=>toggle("shareGoalHits")}/><Toggle label="Меня можно найти по нику" value={settings.isDiscoverable} onClick={()=>toggle("isDiscoverable")}/><p className="privacy-note">Вес, калории, еду и шаги видят только подтверждённые друзья — и только те данные, которые ты включишь.</p></div></details>
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
    // Те же цвета, что в layout.tsx: строка состояния должна совпадать с фоном.
    const light="#f5f1e7", dark="#101411";
    metas.forEach((meta,index)=>meta.setAttribute("content",
      next==="system"?(index===0?light:dark):next==="dark"?dark:light));
  }
  const options:[Theme,string,string][]=[["system","◐","Как на iPhone"],["light","☀️","Светлая"],["dark","🌙","Тёмная"]];
  return <div className="theme-picker" role="radiogroup" aria-label="Тема оформления">{options.map(([key,icon,label])=><button key={key} role="radio" aria-checked={theme===key} className={theme===key?"active":""} onClick={()=>change(key)}><span>{icon}</span><b>{label}</b><i>✓</i></button>)}</div>;
}
function Toggle({label,value,onClick}:{label:string;value:boolean;onClick:()=>void}){return <button className="toggle-row" onClick={onClick}><span>{label}</span><i className={value?"on":""}><u/></i></button>}

export function RitmApp() {
  const session=authClient.useSession();
  // Ярлыки с домашнего экрана Android приходят как /?tab=stats и т.п.
  const [tab,setTab]=useState<Tab>(()=>{
    if(typeof window==="undefined") return "today";
    const wanted=new URLSearchParams(window.location.search).get("tab");
    return wanted==="stats"||wanted==="friends"||wanted==="profile"?wanted:"today";
  }); const [headerCoins,setHeaderCoins]=useState(0); const [headerStreak,setHeaderStreak]=useState(0);
  const [avatar,setAvatar]=useState<Partial<AvatarConfig>|null>(null);
  const [unlocked,setUnlocked]=useState<string[]>([]);
  const [maker,setMaker]=useState(false);
  const updateHeader=useCallback((days:number,coins:number)=>{setHeaderStreak(days);setHeaderCoins(coins);},[]);
  const [onboarding,setOnboarding]=useState<"loading"|"show"|"done">("loading");
  const [onboardingUser,setOnboardingUser]=useState<string|null>(null);
  const user=useMemo(()=>session.data?.user as AppUser|undefined,[session.data]);
  const userId=user?.id;
  useEffect(()=>{
    if(!userId) return;
    // Определяем пояс браузером один раз. Если человек выбрал его руками, не трогаем.
    void jsonFetch<{timezone?:string|null;onboardingCompleted?:boolean;avatarConfig?:Partial<AvatarConfig>|null;avatarUnlocked?:string[]|null}>("/api/profile").then(profile=>{
      setOnboarding(profile.onboardingCompleted?"done":"show");
      setOnboardingUser(userId);
      setAvatar(profile.avatarConfig??null);
      setUnlocked(profile.avatarUnlocked??[]);
      if(profile.timezone) return;
      const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
      return jsonFetch("/api/profile",{method:"PATCH",body:JSON.stringify({timezone})});
    }).catch(()=>{setOnboarding("done");setOnboardingUser(userId);});
  },[userId]);
  useEffect(()=>{
    if(!userId) return;
    void jsonFetch<{days:number;coins:number}>("/api/streak").then(result=>{setHeaderStreak(result.days);setHeaderCoins(result.coins);}).catch(()=>{});
  },[userId,tab]);
  if(session.isPending)return <main className="loading"><div className="pulse">🔥</div></main>;
  if(!user)return <AuthScreen/>;
  if(onboarding==="loading"||onboardingUser!==userId)return <main className="loading"><div className="pulse">🔥</div></main>;
  if(onboarding==="show")return <Onboarding onComplete={value=>{
    setOnboarding("done");
    setAvatar(value);
    setTab("today");
    void jsonFetch<{days:number;coins:number}>("/api/streak").then(result=>{setHeaderStreak(result.days);setHeaderCoins(result.coins);}).catch(()=>{});
  }}/>;
  if(maker)return <AvatarEditor initial={avatar} coins={headerCoins} unlocked={unlocked}
    onSaved={value=>{setAvatar(value);setMaker(false);}} onCoins={setHeaderCoins} onClose={()=>setMaker(false)}/>;
  const navItems:[Tab,React.ReactNode,string][]=[
    ["today",<HomeIcon key="h"/>,"Сегодня"],
    ["stats",<BarsIcon key="b"/>,"История"],
    ["friends",<FriendsIcon key="f"/>,"Друзья"],
    ["profile",<PersonIcon key="p"/>,"Профиль"],
  ];
  return <main className="app-shell">
    <header>
      {tab==="today"
        ? <div className="brand"><span className="brand-mark" aria-hidden>Р</span>Ритм</div>
        : <b className="screen-title">{tab==="stats"?"История":tab==="friends"?"Друзья":"Профиль"}</b>}
      <div className="header-status">
        <span className="chip chip-streak" title={`${headerStreak} ${plural(headerStreak,"день","дня","дней")} подряд`}><FlameIcon/>{headerStreak}</span>
        <span className="chip chip-coins" title={`${headerCoins} ${plural(headerCoins,"монета","монеты","монет")}`}><CoinIcon/>{headerCoins}</span>
      </div>
    </header>
    <div className="content">
      <InstallHint/>
      {tab==="today"&&<Today onStreak={updateHeader} avatar={avatar} userName={user.name}/>}
      {tab==="stats"&&<StatsScreen/>}
      {tab==="friends"&&<Friends/>}
      {tab==="profile"&&<Profile user={user} avatar={avatar} streak={headerStreak} onOpenMaker={()=>setMaker(true)} onOpenOnboarding={()=>setOnboarding("show")}/>}
    </div>
    <nav>{navItems.map(([key,icon,label])=>
      <button key={key} className={tab===key?"active":""} aria-current={tab===key?"page":undefined} onClick={()=>setTab(key)}>{icon}{label}</button>)}</nav>
  </main>;
}
