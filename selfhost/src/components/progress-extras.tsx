"use client";

import { useCallback, useEffect, useState } from "react";
import { CharacterAvatar } from "@/components/avatar-editor";
import type { AvatarConfig } from "@/lib/avatar";

async function api<T>(url:string, init?:RequestInit):Promise<T> {
  const response=await fetch(url,{...init,headers:{"Content-Type":"application/json",...(init?.headers??{})}});
  if(!response.ok) throw Object.assign(new Error("request_failed"),{status:response.status});
  return response.json();
}

function plural(count:number, one:string, few:string, many:string) {
  const tens=count%100, units=count%10;
  if(tens>10&&tens<20) return many;
  if(units===1) return one;
  if(units>=2&&units<=4) return few;
  return many;
}

const GOALS=[
  {days:3,label:"3 дня подряд",icon:"🌱"},
  {days:7,label:"неделя подряд",icon:"🔥"},
  {days:14,label:"2 недели подряд",icon:"💪"},
  {days:30,label:"месяц подряд",icon:"⭐"},
  {days:60,label:"60 дней подряд",icon:"🚀"},
  {days:100,label:"100 дней подряд",icon:"💎"},
  {days:200,label:"200 дней подряд",icon:"🏅"},
  {days:365,label:"год подряд",icon:"🏆"},
];

/** Ближайшая понятная цель серии — без канцелярита и давления. */
export function Milestone({streak}:{streak:number}) {
  const next=GOALS.find(goal=>goal.days>streak);
  const previous=[...GOALS].reverse().find(goal=>goal.days<=streak);
  if(!next) return <div className="milestone done"><span>🏆</span><p><b>Целый год подряд!</b><small>Это уже твоя привычка. Просто продолжай.</small></p></div>;
  const share=Math.round((streak/next.days)*100);
  const remaining=next.days-streak;
  const justReached=Boolean(previous&&previous.days===streak);
  const title=streak===0?"Начни с одного дня"
    :justReached?`${previous!.label[0].toUpperCase()}${previous!.label.slice(1)} — готово!`
    :`До цели — ${remaining} ${plural(remaining,"день","дня","дней")}`;
  const text=streak===0?"Запиши сегодня еду, вес или тренировку — этого достаточно."
    :justReached?`Теперь можно попробовать: ${next.label}.`
    :`${streak} ${plural(streak,"день","дня","дней")} подряд. Следующая цель — ${next.label}.`;
  return <div className={`milestone${justReached?" reached":""}`}>
    <div className="milestone-head"><span>{justReached?previous!.icon:next.icon}</span>
      <p><b>{title}</b><small>{text}</small></p></div>
    <div className="milestone-bar"><i style={{width:`${Math.max(share,3)}%`}}/></div>
  </div>;
}

type RepairState={cost:number;coins:number;missed:string[]};

export function RepairCard({coins,onChanged}:{coins:number;onChanged:()=>void}) {
  const [state,setState]=useState<RepairState|null>(null);
  const [open,setOpen]=useState(false);
  const [note,setNote]=useState("");
  const load=useCallback(()=>{void api<RepairState>("/api/streak-repair").then(setState).catch(()=>{});},[]);
  useEffect(()=>{load();},[load,coins]);

  async function repair(date:string) {
    setNote("");
    try{
      await api("/api/streak-repair",{method:"POST",body:JSON.stringify({date})});
      setNote("День снова в серии ✓"); onChanged(); load();
    }catch(error){
      const status=(error as {status?:number}).status;
      setNote(status===402?"Пока не хватает очков":"Не получилось восстановить день");
    }
    setTimeout(()=>setNote(""),2200);
  }

  // Карточка появляется, только когда есть что восстанавливать.
  if(!state||state.missed.length===0) return null;
  return <div className="coins-card">
    <div className="coins-head">
      <p><b>Хочешь продолжить прошлую серию?</b> Можно восстановить {state.missed.length} {plural(state.missed.length,"день","дня","дней")} — по {state.cost} очков.</p>
    </div>
    <>
      <button className="link-row" onClick={()=>setOpen(value=>!value)}>
        {open?"Скрыть":"Выбрать день"}</button>
      {open&&<div className="missed-days">
        {state.missed.map(date=>
          <button key={date} disabled={coins<state.cost} onClick={()=>void repair(date)}>
            {new Date(`${date}T00:00`).toLocaleDateString("ru",{day:"numeric",month:"short"})}
            <em>{state.cost} 🪙</em>
          </button>)}
      </div>}
    </>
    {note&&<small className="health-status">{note}</small>}
  </div>;
}

type Player={id:string;name:string;username:string|null;avatarConfig?:Partial<AvatarConfig>|null;isSelf:boolean;streak:number|null;workoutMinutes:number|null};

export function Leaderboard({onOpen}:{onOpen?:(userId:string)=>void}) {
  const [rows,setRows]=useState<Player[]>([]);
  useEffect(()=>{void api<Player[]>("/api/leaderboard").then(setRows).catch(()=>{});},[]);
  const myPlace=rows.findIndex(player=>player.isSelf)+1;
  if(rows.length===0) return <div className="card"><div className="card-head"><h3>Общий рейтинг</h3></div>
    <div className="empty"><span>🏅</span><p>Пока в рейтинге никого нет</p></div></div>;
  return <>
    <div className="hero-dark" style={{textAlign:"center"}}>
      <p className="eyebrow">ОБЩИЙ РЕЙТИНГ · {rows.length} {plural(rows.length,"участник","участника","участников")}</p>
      <h2>{myPlace?`Ты на ${myPlace} месте`:"Ты вне рейтинга"}</h2>
      <p>Место считается по длине серии, дальше — по минутам тренировок.</p>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {rows.map((player,index)=>
        <button type="button"
          className={`rank${player.isSelf?" me":""}${index===0?" gold":""}${index>=5&&!player.isSelf?" out":""}`}
          key={player.id} onClick={()=>onOpen?.(player.id)} disabled={!onOpen}>
          <b>{index+1}</b>
          <CharacterAvatar value={player.avatarConfig} size="small" label={`Персонаж ${player.name}`}/>
          <span className="rank-name">
            <b>{player.isSelf?"Ты":player.name}</b>
            <small>{player.workoutMinutes===null?"тренировки скрыты":`${player.workoutMinutes} мин за неделю`}</small>
          </span>
          <em>{player.streak===null?"скрыто":`${player.streak} ${plural(player.streak,"день","дня","дней")}`}</em>
        </button>)}
    </div>
  </>;
}
