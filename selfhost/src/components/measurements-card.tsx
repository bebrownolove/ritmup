"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Entry = {
  date:string; waistCm:number|null; bellyCm:number|null; hipsCm:number|null;
  thighCm:number|null; armCm:number|null; chestCm:number|null;
};
type Field = "waistCm"|"bellyCm"|"hipsCm"|"thighCm"|"armCm"|"chestCm";
const FIELDS:{key:Field;label:string;placeholder:string}[] = [
  {key:"waistCm",label:"Талия",placeholder:"самое узкое место живота"},
  {key:"bellyCm",label:"Живот",placeholder:"на уровне пупка"},
  {key:"hipsCm",label:"Бёдра",placeholder:"самая широкая часть ягодиц"},
  {key:"thighCm",label:"Бедро",placeholder:"самое широкое место ноги"},
  {key:"armCm",label:"Рука",placeholder:"самая широкая часть бицепса"},
  {key:"chestCm",label:"Грудь",placeholder:"по выступающей части"},
];

function todayKey(date=new Date()) {
  const year=date.getFullYear();
  const month=String(date.getMonth()+1).padStart(2,"0");
  const day=String(date.getDate()).padStart(2,"0");
  return `${year}-${month}-${day}`;
}
function daysSince(date:string) {
  const then=new Date(`${date}T00:00`).getTime();
  return Math.floor((Date.now()-then)/86_400_000);
}
function shortDate(date:string) {
  return new Date(`${date}T00:00`).toLocaleDateString("ru",{day:"numeric",month:"short"});
}
function fmt(value:number|null) {
  return value===null?null:value.toFixed(1).replace(/\.0$/,"").replace(".",",");
}

async function api<T>(url:string, init?:RequestInit):Promise<T> {
  const response=await fetch(url,{...init,headers:{"Content-Type":"application/json",...(init?.headers??{})}});
  if(!response.ok) throw new Error("request_failed");
  return response.json();
}

export function MeasurementsCard() {
  const [history,setHistory]=useState<Entry[]>([]);
  const [draft,setDraft]=useState<Record<Field,string>>({waistCm:"",bellyCm:"",hipsCm:"",thighCm:"",armCm:"",chestCm:""});
  const [busy,setBusy]=useState(false);
  const [note,setNote]=useState("");
  const [showWhy,setShowWhy]=useState(false);

  const load=()=>void api<Entry[]>("/api/measurements").then(setHistory).catch(()=>{});
  useEffect(()=>{load();},[]);

  const latest=history.length?history[history.length-1]:null;
  const previous=history.length>1?history[history.length-2]:null;
  // Раз в 1-2 недели — этого достаточно; каждый день мерить не нужно,
  // разница будет просто из-за воды. Подсказка появляется через две недели.
  const dueDays=latest?daysSince(latest.date):null;
  const due=dueDays===null||dueDays>=14;

  async function save(event:FormEvent) {
    event.preventDefault();
    const values=Object.fromEntries(
      FIELDS.map(field=>[field.key, draft[field.key].trim()?Number(draft[field.key].replace(",",".")):null]),
    ) as Record<Field,number|null>;
    if(Object.values(values).every(value=>value===null)){setNote("Заполни хотя бы одну мерку.");setTimeout(()=>setNote(""),2000);return;}
    setBusy(true);
    try{
      await api("/api/measurements",{method:"POST",body:JSON.stringify({date:todayKey(),...values})});
      setDraft({waistCm:"",bellyCm:"",hipsCm:"",thighCm:"",armCm:"",chestCm:""});
      setNote("Записано ✓");
      load();
    }catch{setNote("Не удалось сохранить");}
    setBusy(false);
    setTimeout(()=>setNote(""),2000);
  }

  const rows=useMemo(()=>[...history].reverse().slice(0,12),[history]);

  return <div className="measure-card">
    {due&&<p className="setup-warn">
      {latest&&dueDays!==null?`Последний замер ${dueDays} ${dueDays===1?"день":dueDays<5?"дня":"дней"} назад.`:"Замеров ещё нет."} {" "}
      Раз в 1–2 недели достаточно — лучше утром, натощак, в одинаковых условиях.
    </p>}

    {latest&&<div className="calc-box measure-latest">
      {FIELDS.map(field=>{
        const value=latest[field.key];
        if(value===null)return null;
        const before=previous?.[field.key]??null;
        const delta=before!==null?value-before:null;
        return <div className="calc-row" key={field.key}>
          <span>{field.label}</span>
          <b>{fmt(value)} см{delta!==null&&Math.abs(delta)>=0.1&&
            <small className={delta<0?"down":"up"}> {delta>0?"+":""}{fmt(delta)}</small>}</b>
        </div>;
      })}
    </div>}

    <form className="body-form" onSubmit={save}>
      {FIELDS.map(field=><label key={field.key}>{field.label}, см
        <input value={draft[field.key]} onChange={event=>setDraft(current=>({...current,[field.key]:event.target.value}))}
          type="number" inputMode="decimal" step="0.1" min="10" max="250" placeholder={field.placeholder}/>
      </label>)}
      <button className="primary wide" disabled={busy}>{busy?"Сохраняю…":"Записать замеры"}</button>
    </form>
    {note&&<small className="save-note">{note}</small>}

    {rows.length>0&&<div className="measure-history">
      {rows.map(entry=><div className="measure-row" key={entry.date}>
        <span>{shortDate(entry.date)}</span>
        <div>{FIELDS.map(field=>entry[field.key]!==null&&
          <em key={field.key}>{field.label.slice(0,3)} {fmt(entry[field.key])}</em>)}</div>
      </div>)}
    </div>}

    <button type="button" className="link-row" onClick={()=>setShowWhy(value=>!value)}>
      {showWhy?"Свернуть":"Зачем нужны мерки, а не только вес"}
    </button>
    {showWhy&&<p className="setup-note">
      Вес прыгает из-за воды, соли и цикла, а сантиметры часто честнее показывают прогресс.
      Основные точки: талия — самое узкое место живота; живот — на уровне пупка; бёдра — самая
      широкая часть ягодиц; бедро и рука — самое широкое место ноги и бицепса; грудь — по
      выступающей части. Мерить лучше утром, после туалета и до еды, в одной и той же позе.
    </p>}
  </div>;
}
