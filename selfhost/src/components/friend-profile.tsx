"use client";

import { useCallback, useEffect, useState } from "react";
import { CharacterAvatar } from "@/components/avatar-editor";
import { normalizeAvatar, type AvatarConfig } from "@/lib/avatar";
import { BG } from "@/lib/avatar-render";

type Relationship = "self" | "friends" | "incoming" | "outgoing" | "none";
type WeightPoint = { date:string; weightKg:number };

export type FriendProfile = {
  id:string; name:string; username:string|null; bio:string;
  avatarConfig?:Partial<AvatarConfig>|null; joinedAt:string; relationship:Relationship;
  shares:{ streak:boolean; goalHits:boolean; workouts:boolean; weight:boolean; calories:boolean; steps:boolean; food:boolean };
  streak:number|null;
  daysLogged:number|null;
  goalHits:{ hits:number; tracked:number }|null;
  weight:{ current:number; change:number|null; points:WeightPoint[] }|null;
  today:{ calories:number|null; goal:number|null; steps:number|null; food:{ title:string; calories:number|null }[]|null };
  workoutMinutes:number|null;
  workouts:{ date:string; title:string; minutes:number }[]|null;
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

function shortDate(date:string) {
  return new Date(`${date}T00:00`).toLocaleDateString("ru",{day:"numeric",month:"short"});
}

/** Место закрытой цифры: замок вместо пустоты, чтобы карточка не выглядела сломанной. */
function Locked({label}:{label:string}) {
  return <div className="peek-locked"><span aria-hidden>🔒</span><small>{label}</small></div>;
}

function WeightTrail({points}:{points:WeightPoint[]}) {
  if(points.length<2) return null;
  const values=points.map(point=>point.weightKg);
  const min=Math.min(...values), max=Math.max(...values), span=max-min||1;
  const step=100/(points.length-1);
  const line=values.map((value,index)=>`${index?"L":"M"}${(index*step).toFixed(2)},${(40-((value-min)/span)*34).toFixed(2)}`).join(" ");
  return <div className="peek-trail">
    <svg viewBox="0 0 100 44" preserveAspectRatio="none" aria-label="График веса">
      <path d={`${line} L100,44 L0,44 Z`} fill="var(--green)" opacity=".13" stroke="none"/>
      <path d={line} fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
    </svg>
    <div className="peek-trail-scale"><span>{max.toFixed(1)}</span><span>{min.toFixed(1)}</span></div>
  </div>;
}

/**
 * Карточка чужого профиля: всё, что человек открыл, на одном экране.
 * Обложка красится в цвет фона его персонажа — так карточки друзей
 * отличаются друг от друга с первого взгляда.
 */
export function FriendProfileSheet({userId,onClose,onChanged}:{userId:string;onClose:()=>void;onChanged?:()=>void}) {
  const [profile,setProfile]=useState<FriendProfile|null>(null);
  const [failed,setFailed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [note,setNote]=useState("");

  const load=useCallback(()=>{
    void api<FriendProfile>(`/api/users/${encodeURIComponent(userId)}`).then(setProfile).catch(()=>setFailed(true));
  },[userId]);
  useEffect(()=>{load();},[load]);

  // Пока карточка открыта, страница под ней не должна прокручиваться.
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
      <button className="peek-close" onClick={onClose} aria-label="Закрыть">×</button>

      {!profile
        ? <div className="peek-loading">{failed?<p className="muted">Профиль не открылся. Возможно, человека больше нет.</p>:<div className="pulse">🔥</div>}</div>
        : <>
        <div className="peek-cover" style={{background:BG[avatar!.background]}}><i/><em/></div>
        <div className="peek-head">
          <CharacterAvatar value={profile.avatarConfig} size="large" label={`Персонаж ${profile.name}`}/>
          <h2>{profile.name}</h2>
          <p className="peek-handle">@{profile.username??"без-ника"}</p>
          {profile.bio&&<p className="peek-bio">{profile.bio}</p>}
          <div className="peek-chips">
            {profile.streak!==null&&<span className="hot"><b>🔥 {profile.streak}</b> {plural(profile.streak,"день","дня","дней")} подряд</span>}
            <span>С Ритмом с {new Date(`${profile.joinedAt}T00:00`).toLocaleDateString("ru",{month:"long",year:"numeric"})}</span>
          </div>
        </div>

        <div className="peek-body">
          <div className="peek-tiles">
            {shares!.streak
              ? <div><b>{profile.daysLogged??0}</b><small>{plural(profile.daysLogged??0,"день","дня","дней")} с записями за месяц</small></div>
              : <Locked label="Регулярность скрыта"/>}
            {shares!.goalHits
              ? <div><b>{goalShare===null?"—":`${goalShare}%`}</b><small>дней в своей норме</small></div>
              : <Locked label="Цели скрыты"/>}
            {shares!.workouts
              ? <div><b>{profile.workoutMinutes??0}</b><small>{plural(profile.workoutMinutes??0,"минута","минуты","минут")} за неделю</small></div>
              : <Locked label="Тренировки скрыты"/>}
            {shares!.weight
              ? <div><b>{profile.weight?`${profile.weight.current.toFixed(1)}`:"—"}</b><small>кг сегодня</small></div>
              : <Locked label={isFriend?"Вес скрыт":"Вес — только друзьям"}/>}
          </div>

          {(shares!.calories||shares!.steps||shares!.food)&&<div className="peek-card">
            <h3>Сегодня</h3>
            <div className="peek-today">
              {shares!.calories&&<div className="peek-metric">
                <span aria-hidden>🍽️</span>
                <div><b>{profile.today.calories??0}</b><small>из {profile.today.goal??"—"} ккал</small></div>
                <i style={{width:`${Math.min(100,Math.round(((profile.today.calories??0)/(profile.today.goal||2000))*100))}%`}}/>
              </div>}
              {shares!.steps&&<div className="peek-metric">
                <span aria-hidden>👟</span>
                <div><b>{profile.today.steps?.toLocaleString("ru")??"—"}</b><small>шагов</small></div>
              </div>}
            </div>
            {shares!.food&&<div className="peek-food">
              <b>Что ел сегодня</b>
              {profile.today.food?.length
                ? <div className="peek-food-list">{profile.today.food.map((item,index)=>
                    <span key={`${item.title}-${index}`}>{item.title}{item.calories!==null&&<em>{item.calories} ккал</em>}</span>)}</div>
                : <p className="muted small">Пока ничего не записал</p>}
            </div>}
          </div>}

          {shares!.weight&&profile.weight&&profile.weight.points.length>1&&<div className="peek-card">
            <h3>Вес{profile.weight.change!==null&&<small> · {profile.weight.change>0?"+":""}{profile.weight.change.toFixed(1)} кг за период</small>}</h3>
            <WeightTrail points={profile.weight.points}/>
          </div>}

          {shares!.workouts&&<div className="peek-card">
            <h3>Тренировки</h3>
            {profile.workouts?.length
              ? profile.workouts.map((item,index)=><div className="peek-workout" key={`${item.date}-${index}`}>
                  <span aria-hidden>🏋️</span><b>{item.title}</b><em>{item.minutes} мин</em><time>{shortDate(item.date)}</time></div>)
              : <div className="empty"><span>🌤️</span><p>Пока нет записанных тренировок</p></div>}
          </div>}

          {!isFriend&&<p className="peek-hint">Вес, калории, еду и шаги видно только подтверждённым друзьям — и только если человек их открыл.</p>}

          {profile.relationship==="none"&&<button className="primary peek-action" disabled={busy}
            onClick={()=>void act(()=>api("/api/friends",{method:"POST",body:JSON.stringify({userId:profile.id})}),"Заявка отправлена ✓")}>
            Добавить в друзья</button>}
          {profile.relationship==="outgoing"&&<p className="peek-state">Заявка отправлена — ждём ответа</p>}
          {profile.relationship==="incoming"&&<div className="peek-actions">
            <button className="primary" disabled={busy}
              onClick={()=>void act(()=>api(`/api/friends/${profile.id}`,{method:"PATCH",body:JSON.stringify({action:"accept"})}),"Теперь вы друзья ✓")}>Принять заявку</button>
            <button className="ghost" disabled={busy}
              onClick={()=>void act(()=>api(`/api/friends/${profile.id}`,{method:"PATCH",body:JSON.stringify({action:"reject"})}),"Заявка отклонена")}>Отклонить</button>
          </div>}
          {profile.relationship==="friends"&&<button className="peek-remove" disabled={busy}
            onClick={()=>{if(window.confirm(`Убрать ${profile.name} из друзей?`))void act(()=>api(`/api/friends/${profile.id}`,{method:"DELETE"}),"Больше не друзья");}}>
            Удалить из друзей</button>}
          {note&&<small className="health-status">{note}</small>}
        </div>
      </>}
    </div>
  </div>;
}
