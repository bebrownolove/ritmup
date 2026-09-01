"use client";

import { useCallback, useEffect, useState } from "react";
import { CharacterAvatar } from "@/components/avatar-editor";
import { CutleryIcon, DumbbellIcon, FlameIcon, ShoeIcon } from "@/components/icons";
import { normalizeAvatar, type AvatarConfig } from "@/lib/avatar";
import { BG } from "@/lib/avatar-render";

type Relationship = "self" | "friends" | "incoming" | "outgoing" | "none";
type Tab = "food" | "movement" | "weight" | "history";
type HistoryDay = {
  date:string; calories:number|null; goal:number|null; steps:number|null;
  activeCalories:number|null; weightKg:number|null;
  food:{title:string;calories:number|null}[]|null;
  workouts:{title:string;minutes:number;calories:number|null}[]|null;
};

export type FriendProfile = {
  id:string; name:string; username:string|null; bio:string;
  avatarConfig?:Partial<AvatarConfig>|null; joinedAt:string; relationship:Relationship;
  shares:{ streak:boolean; goalHits:boolean; workouts:boolean; weight:boolean; calories:boolean; steps:boolean; food:boolean };
  streak:number|null;
  daysLogged:number|null;
  goalHits:{ hits:number; tracked:number }|null;
  weight:{ current:number; change:number|null; points:{date:string;weightKg:number}[] }|null;
  today:{ calories:number|null; goal:number|null; steps:number|null; activeCalories:number|null; weightKg:number|null; food:{ title:string; calories:number|null }[]|null };
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
  const [tab,setTab]=useState<Tab>("food");
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
            {([["food","Питание"],["movement","Движение"],["weight","Вес"],["history","История"]] as [Tab,string][]).map(([key,label])=>
              <button key={key} role="tab" aria-selected={tab===key} className={tab===key?"active":""} onClick={()=>setTab(key)}>{label}</button>)}
          </div>

          <div className="peek-scroll">
            {tab==="food"&&<>
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

              {shares!.food?<div className="peek-food">
                <h3>Что ел сегодня</h3>
                {profile.today.food?.length
                  ? <div className="peek-food-list">{profile.today.food.map((item,index)=>
                      <span key={`${item.title}-${index}`}><b>{item.title}</b>{item.calories!==null&&<small>{item.calories} ккал</small>}</span>)}</div>
                  : <p className="muted small">Пока ничего не записал</p>}
              </div>:<Locked label={isFriend?"Список еды скрыт":"Еду видят только друзья"}/>}
            </>}

            {tab==="movement"&&<>
              {shares!.steps?<div className="peek-metric">
                <ShoeIcon/><div className="peek-metric-head" style={{marginBottom:0}}><b>{profile.today.steps!==null?spaced(profile.today.steps):"—"}</b><small>шагов сегодня</small></div>
              </div>:<Locked label={isFriend?"Шаги скрыты":"Шаги видят только друзья"}/>}
              {shares!.workouts?(profile.workouts?.length
                ? <div className="day-list">{profile.workouts.map((item,index)=><div className="day-item" key={`${item.date}-${index}`}><i/><b>{item.title}<small>{dayLabel(item.date)}</small></b><em>{item.minutes} мин</em></div>)}</div>
                : <div className="peek-empty"><DumbbellIcon size={34}/><p>Пока нет записанных тренировок</p></div>)
                :<Locked label="Тренировки скрыты"/>}
            </>}

            {tab==="weight"&&(shares!.weight
              ? <>
                <div className="peek-metric"><span className="peek-emoji" aria-hidden>⚖️</span><div className="peek-metric-head" style={{marginBottom:0}}><b>{profile.weight?`${profile.weight.current.toFixed(1).replace(".",",")} кг`:"—"}</b><small>{profile.weight?.change==null?"последняя запись":`${profile.weight.change>0?"+":"−"}${Math.abs(profile.weight.change).toFixed(1).replace(".",",")} кг за месяц`}</small></div></div>
                {profile.weight?.points.length?<div className="day-list">{[...profile.weight.points].reverse().slice(0,10).map(point=><div className="day-item" key={point.date}><i/><b>{dayLabel(point.date)}</b><em>{point.weightKg.toFixed(1).replace(".",",")} кг</em></div>)}</div>:null}
              </>
              : <Locked label={isFriend?"Вес скрыт":"Вес видят только друзья"}/>) }

            {tab==="history"&&(profile.history
              ? <div className="history-days friend-history">{profile.history.map((day,index)=>{
                  const food=day.food??[], workouts=day.workouts??[];
                  const hasMovement=workouts.length>0||(day.steps??0)>0||(day.activeCalories??0)>0;
                  const hasData=food.length>0||hasMovement||day.weightKg!==null||(day.calories??0)>0;
                  const over=day.calories!==null&&day.goal!==null&&day.calories>day.goal;
                  return <details className="history-day" key={day.date} open={index===0&&hasData}>
                    <summary><span><b>{dayLabel(day.date)}</b><small>{hasData&&day.calories!==null?`${spaced(day.calories)} ккал`:hasData?"Есть записи":"Записей нет"}</small></span><em className={over?"over":""}>{hasData?"Подробнее":"—"}</em><i>›</i></summary>
                    <div className="history-day-body">
                      {(shares!.calories||shares!.food)&&<section><h4>🍽️ Питание</h4>{food.length?<div className="history-rows">{food.map((item,itemIndex)=><p key={`${item.title}-${itemIndex}`}><span>{item.title}</span>{item.calories!==null&&<b>{item.calories} ккал</b>}</p>)}</div>:day.calories!==null?<div className="history-rows"><p><span>Всего за день</span><b>{spaced(day.calories)} ккал</b></p></div>:<small>Еда не записана</small>}</section>}
                      {(shares!.steps||shares!.workouts)&&<section><h4>🏃 Движение</h4>{hasMovement?<div className="history-rows">{day.steps!==null&&<p><span>Шаги</span><b>{spaced(day.steps)}</b></p>}{day.activeCalories!==null&&day.activeCalories>0&&<p><span>Активная энергия</span><b>{spaced(day.activeCalories)} ккал</b></p>}{workouts.map((item,itemIndex)=><p key={`${item.title}-${itemIndex}`}><span>{item.title}</span><b>{item.minutes} мин</b></p>)}</div>:<small>Движение не записано</small>}</section>}
                      {shares!.weight&&<section><h4>⚖️ Вес</h4>{day.weightKg!==null?<b className="history-weight">{day.weightKg.toFixed(1).replace(".",",")} кг</b>:<small>Вес не записан</small>}</section>}
                    </div>
                  </details>;
                })}</div>
              : <Locked label={isFriend?"История скрыта":"История видна только друзьям"}/>)}
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
