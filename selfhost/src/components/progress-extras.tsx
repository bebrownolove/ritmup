"use client";

import { useCallback, useEffect, useState } from "react";

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

const MILESTONES=[3,7,14,30,60,100,200,365];

/** Ближайшая веха серии — чтобы было видно, ради чего не бросать. */
export function Milestone({streak}:{streak:number}) {
  const next=MILESTONES.find(value=>value>streak);
  const previous=[...MILESTONES].reverse().find(value=>value<=streak)??0;
  if(!next) return <div className="milestone done"><span>🏆</span><p>Год без пропусков. Дальше только рекорды.</p></div>;
  const span=next-previous;
  const share=Math.round(((streak-previous)/span)*100);
  return <div className="milestone">
    <div className="milestone-head"><span>🎯</span>
      <p>{streak===0?"Отметь сегодняшний день — серия начнётся заново."
        :`Ещё ${next-streak} ${plural(next-streak,"день","дня","дней")} до вехи в ${next}.`}</p></div>
    <div className="milestone-bar"><i style={{width:`${Math.max(share,3)}%`}}/></div>
  </div>;
}

type RepairState={cost:number;coins:number;missed:string[]};

export function CoinsCard({coins,onChanged}:{coins:number;onChanged:()=>void}) {
  const [state,setState]=useState<RepairState|null>(null);
  const [open,setOpen]=useState(false);
  const [note,setNote]=useState("");
  const load=useCallback(()=>{void api<RepairState>("/api/streak-repair").then(setState).catch(()=>{});},[]);
  useEffect(()=>{load();},[load,coins]);

  async function repair(date:string) {
    setNote("");
    try{
      await api("/api/streak-repair",{method:"POST",body:JSON.stringify({date})});
      setNote("День восстановлен ✓"); onChanged(); load();
    }catch(error){
      const status=(error as {status?:number}).status;
      setNote(status===402?"Не хватает монет":"Не получилось восстановить день");
    }
    setTimeout(()=>setNote(""),2200);
  }

  return <div className="coins-card">
    <div className="coins-head">
      <div><span>🪙</span><b>{coins}</b><small>{plural(coins,"монета","монеты","монет")}</small></div>
      <p>По 10 за каждый отмеченный день. Пропустил день — можно выкупить за {state?.cost??50}.</p>
    </div>
    {state&&state.missed.length>0&&<>
      <button className="link-row" onClick={()=>setOpen(value=>!value)}>
        {open?"Свернуть":`Пропущено дней: ${state.missed.length}`}</button>
      {open&&<div className="missed-days">
        {state.missed.map(date=>
          <button key={date} disabled={coins<state.cost} onClick={()=>void repair(date)}>
            {new Date(`${date}T00:00`).toLocaleDateString("ru",{day:"numeric",month:"short"})}
            <em>{state.cost} 🪙</em>
          </button>)}
      </div>}
    </>}
    {note&&<small className="health-status">{note}</small>}
  </div>;
}

type Player={id:string;name:string;username:string|null;isSelf:boolean;streak:number|null;workoutMinutes:number|null};

export function Leaderboard() {
  const [rows,setRows]=useState<Player[]>([]);
  useEffect(()=>{void api<Player[]>("/api/leaderboard").then(setRows).catch(()=>{});},[]);
  if(rows.length<=1) return <div className="list-card"><h3>Рейтинг</h3>
    <div className="empty"><span>🏅</span><p>Добавь друзей — появится таблица по сериям</p></div></div>;
  return <div className="list-card">
    <h3>Рейтинг по сериям</h3>
    {rows.map((player,index)=>
      <div className={`rank-row${player.isSelf?" me":""}`} key={player.id}>
        <span className="place">{index===0?"🥇":index===1?"🥈":index===2?"🥉":index+1}</span>
        <div><b>{player.name}</b><small>@{player.username??"без-ника"}</small></div>
        <em>{player.streak===null?"скрыто":`${player.streak} ${plural(player.streak,"день","дня","дней")}`}</em>
        <i>{player.workoutMinutes?`${player.workoutMinutes} мин`:""}</i>
      </div>)}
    <p className="muted small">Считаются только те, кто разрешил показывать серию. Тренировки — за последние 7 дней.</p>
  </div>;
}
