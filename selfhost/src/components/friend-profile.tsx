"use client";

import { useCallback, useEffect, useState } from "react";
import { CharacterAvatar } from "@/components/avatar-editor";
import { CutleryIcon, DumbbellIcon, FlameIcon, ShoeIcon } from "@/components/icons";
import { normalizeAvatar, type AvatarConfig } from "@/lib/avatar";
import { BG } from "@/lib/avatar-render";

type Relationship = "self" | "friends" | "incoming" | "outgoing" | "none";
type Tab = "today" | "history" | "sport";
type HistoryDay = { date:string; calories:number; goal:number; steps:number|null };

export type FriendProfile = {
  id:string; name:string; username:string|null; bio:string;
  avatarConfig?:Partial<AvatarConfig>|null; joinedAt:string; relationship:Relationship;
  shares:{ streak:boolean; goalHits:boolean; workouts:boolean; weight:boolean; calories:boolean; steps:boolean; food:boolean };
  streak:number|null;
  daysLogged:number|null;
  goalHits:{ hits:number; tracked:number }|null;
  weight:{ current:number; change:number|null; points:{date:string;weightKg:number}[] }|null;
  today:{ calories:number|null; goal:number|null; steps:number|null; food:{ title:string; calories:number|null }[]|null };
  workoutMinutes:number|null;
  workouts:{ date:string; title:string; minutes:number }[]|null;
  history:HistoryDay[]|null;
};

async function api<T>(url:string, init?:RequestInit):Promise<T> {
  const response=await fetch(url,{...init,headers:{"Content-Type":"application/json",...(init?.headers??{})}});
  if(!response.ok) throw new Error("request_failed");
  return response.json();
}

function plural(count:number, one:string, few:string, many:string) {
  const tens=count%100, units=count%10;
  if(tens>10&&tens<20) return many;
  if(units===1) return one;
  if(units>=2&&units<=4) return few;
  return many;
}

/** 8 315 вместо 8315 — так число читается с одного взгляда. */
function spaced(value:number) { return value.toLocaleString("ru-RU").replace(/ /g," "); }

function dayLabel(date:string) {
  const text=new Date(`${date}T00:00`).toLocaleDateString("ru",{weekday:"short",day:"numeric",month:"long"});
  return text[0].toUpperCase()+text.slice(1);
}

function Locked({label}:{label:string}) {
  return <div className="peek-locked"><span aria-hidden>🔒</span><small>{label}</small></div>;
}

/** Карточка друга: модальный лист с вкладками поверх экрана друзей. */
export function FriendProfileSheet({userId,onClose,onChanged}:{userId:string;onClose:()=>void;onChanged?:()=>void}) {
  const [profile,setProfile]=useState<FriendProfile|null>(null);
  const [failed,setFailed]=useState(false);
  const [tab,setTab]=useState<Tab>("today");
  const [busy,setBusy]=useState(false);
  const [note,setNote]=useState("");

  const load=useCallback(()=>{
    void api<FriendProfile>(`/api/users/${encodeURIComponent(userId)}`).then(setProfile).catch(()=>setFailed(true));
  },[userId]);
  useEffect(()=>{load();},[load]);

  useEffect(()=>{
    const close=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose();};
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    window.addEventListener("keydown",close);
    return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",close);};
  },[onClose]);

  async function act(run:()=>Promise<unknown>,message:string) {
    if(busy)return;
    setBusy(true); setNote("");
    try{ await run(); setNote(message); load(); onChanged?.(); }
    catch{ setNote("Не получилось — попробуй ещё раз"); }
    setBusy(false);
    setTimeout(()=>setNote(""),2200);
  }

  const avatar=profile?normalizeAvatar(profile.avatarConfig):null;
  const shares=profile?.shares;
  const goalShare=profile?.goalHits&&profile.goalHits.tracked>0
    ? Math.round((profile.goalHits.hits/profile.goalHits.tracked)*100) : null;
  const isFriend=profile?.relationship==="friends"||profile?.relationship==="self";

  const tracked=profile?.history?.filter(day=>day.calories>0)??[];
  const average=tracked.length?Math.round(tracked.reduce((sum,day)=>sum+day.calories,0)/tracked.length):0;
  const week=profile?.history?.slice(0,7).reverse()??[];
  const peak=Math.max(...week.map(day=>Math.max(day.calories,1)),1);

  return <div className="peek-backdrop" role="dialog" aria-modal="true" aria-label="Профиль" onClick={onClose}>
    <div className="peek-sheet" onClick={event=>event.stopPropagation()}>
      {!profile
        ? <div className="peek-body"><div className="peek-empty">{failed?<p>Профиль не открылся. Возможно, человека больше нет.</p>:<p>Загружаем…</p>}</div></div>
        : <>
        <div className="peek-cover" style={{background:BG[avatar!.background]}}>
          <button className="peek-close" onClick={onClose} aria-label="Закрыть">✕</button>
          <CharacterAvatar value={profile.avatarConfig} size="large" label={`Персонаж ${profile.name}`}/>
        </div>

        <div className="peek-body">
          <div className="peek-title">
            <h2>{profile.name}</h2>
            <p>@{profile.username??"без-ника"}</p>
          </div>

          <div className="peek-chips">
            {profile.streak!==null&&<span className="chip chip-streak"><FlameIcon size={19}/>{profile.streak} {plural(profile.streak,"день","дня","дней")} подряд</span>}
            <span className="chip chip-plain">С {new Date(`${profile.joinedAt}T00:00`).toLocaleDateString("ru",{month:"long",year:"numeric"})}</span>
          </div>

          <div className="tiles four">
            {shares!.streak
              ? <div className="tile four-line"><b>{profile.daysLogged??0}</b><small>{plural(profile.daysLogged??0,"день","дня","дней")}<br/>в месяц</small></div>
              : <div className="tile four-line locked"><b>—</b><small>серия<br/>скрыта</small></div>}
            {shares!.goalHits
              ? <div className="tile four-line good"><b>{goalShare===null?"—":`${goalShare}%`}</b><small>в своей<br/>норме</small></div>
              : <div className="tile four-line locked"><b>—</b><small>цели<br/>скрыты</small></div>}
            {shares!.workouts
              ? <div className="tile four-line"><b>{profile.workoutMinutes??0}</b><small>{plural(profile.workoutMinutes??0,"минута","минуты","минут")}<br/>за неделю</small></div>
              : <div className="tile four-line locked"><b>—</b><small>спорт<br/>скрыт</small></div>}
            {shares!.weight
              ? <div className="tile four-line"><b>{profile.weight?profile.weight.current.toFixed(1).replace(".",","):"—"}</b><small>кг<br/>сегодня</small></div>
              : <div className="tile four-line locked"><b>—</b><small>вес<br/>{isFriend?"скрыт":"для друзей"}</small></div>}
          </div>

          <div className="segmented" role="tablist">
            {([["today","Сегодня"],["history","История"],["sport","Спорт"]] as [Tab,string][]).map(([key,label])=>
              <button key={key} role="tab" aria-selected={tab===key} className={tab===key?"active":""} onClick={()=>setTab(key)}>{label}</button>)}
          </div>

          <div className="peek-scroll">
            {tab==="today"&&<>
              {shares!.calories
                ? <div className="peek-metric">
                    <CutleryIcon/>
                    <div>
                      <div className="peek-metric-head">
                        <b>{spaced(profile.today.calories??0)}</b>
                        <small>из {spaced(profile.today.goal??0)} ккал</small>
                      </div>
                      <div className="peek-bar"><i className={(profile.today.calories??0)>(profile.today.goal??0)?"over":""}
                        style={{width:`${Math.min(100,Math.round(((profile.today.calories??0)/(profile.today.goal||2000))*100))}%`}}/></div>
                    </div>
                  </div>
                : <Locked label={isFriend?"Калории скрыты":"Калории видят только друзья"}/>}

              {shares!.steps&&<div className="peek-metric">
                <ShoeIcon/>
                <div className="peek-metric-head" style={{marginBottom:0}}>
                  <b>{profile.today.steps!==null?spaced(profile.today.steps):"—"}</b><small>шагов</small>
                </div>
              </div>}

              {shares!.food&&<div className="peek-food">
                <h3>Что ел сегодня</h3>
                {profile.today.food?.length
                  ? <div className="peek-food-list">{profile.today.food.map((item,index)=>
                      <span key={`${item.title}-${index}`}><b>{item.title}</b>{item.calories!==null&&<small>{item.calories}</small>}</span>)}</div>
                  : <p className="muted small">Пока ничего не записал</p>}
              </div>}
            </>}

            {tab==="history"&&(shares!.calories
              ? <>
                <div className="hero-dark" style={{borderRadius:"var(--r-card)",padding:"16px 18px"}}>
                  <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:12}}>
                    <div>
                      <p className="eyebrow" style={{fontSize:11}}>СРЕДНЕЕ ЗА НЕДЕЛЮ</p>
                      <b style={{fontSize:24,fontWeight:900,letterSpacing:"-0.03em"}}>{average?`${spaced(average)} ккал`:"нет данных"}</b>
                    </div>
                    <small style={{color:"var(--dark-body)",fontSize:12,fontWeight:800}}>норма {spaced(profile.today.goal??0)}</small>
                  </div>
                  <div className="bars-dark" style={{height:96}}>
                    {week.map(day=><div key={day.date}>
                      <i className={day.calories===0?"none":day.calories>day.goal?"over":""}
                         style={{height:`${Math.max(day.calories/peak*100,6)}%`}}/>
                      <small>{new Date(`${day.date}T00:00`).toLocaleDateString("ru",{weekday:"short"})}</small>
                    </div>)}
                  </div>
                </div>
                <div className="day-list">
                  {profile.history?.map(day=>{
                    const over=day.calories>day.goal, none=day.calories===0;
                    return <div className="day-item" key={day.date}>
                      <i className={none?"none":over?"over":""}/>
                      <b>{dayLabel(day.date)}
                        <small className={over?"over":""}>
                          {none?"записей нет":over?`превысил норму на ${spaced(day.calories-day.goal)}`
                            :`в норме${day.steps?` · ${spaced(day.steps)} ${plural(day.steps,"шаг","шага","шагов")}`:""}`}
                        </small></b>
                      <em className={none?"none":over?"over":""}>{none?"—":spaced(day.calories)}</em>
                    </div>;
                  })}
                </div>
              </>
              : <Locked label={isFriend?"Калории скрыты":"История видна только друзьям"}/>)}

            {tab==="sport"&&(shares!.workouts
              ? (profile.workouts?.length
                  ? <div className="day-list">{profile.workouts.map((item,index)=>
                      <div className="day-item" key={`${item.date}-${index}`}>
                        <i/><b>{item.title}<small>{dayLabel(item.date)}</small></b><em>{item.minutes} мин</em>
                      </div>)}</div>
                  : <div className="peek-empty"><DumbbellIcon size={34}/><p>Пока нет записанных тренировок</p></div>)
              : <Locked label="Тренировки скрыты"/>)}
          </div>

          {profile.relationship==="none"&&<button className="btn-primary" disabled={busy}
            onClick={()=>void act(()=>api("/api/friends",{method:"POST",body:JSON.stringify({userId:profile.id})}),"Заявка отправлена ✓")}>
            Добавить в друзья</button>}
          {profile.relationship==="outgoing"&&<p className="peek-state">Заявка отправлена — ждём ответа</p>}
          {profile.relationship==="incoming"&&<div className="peek-actions">
            <button className="btn-primary" disabled={busy}
              onClick={()=>void act(()=>api(`/api/friends/${profile.id}`,{method:"PATCH",body:JSON.stringify({action:"accept"})}),"Теперь вы друзья ✓")}>Принять заявку</button>
            <button className="btn-secondary" disabled={busy}
              onClick={()=>void act(()=>api(`/api/friends/${profile.id}`,{method:"PATCH",body:JSON.stringify({action:"reject"})}),"Заявка отклонена")}>Нет</button>
          </div>}
          {profile.relationship==="friends"&&<button className="btn-destructive" disabled={busy}
            onClick={()=>{if(window.confirm(`Убрать ${profile.name} из друзей?`))void act(()=>api(`/api/friends/${profile.id}`,{method:"DELETE"}),"Больше не друзья");}}>
            Удалить из друзей</button>}
          {note&&<small className="health-status" style={{textAlign:"center",paddingBottom:12}}>{note}</small>}
        </div>
      </>}
    </div>
  </div>;
}
