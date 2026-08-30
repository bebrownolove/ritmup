"use client";

import { FormEvent, useEffect, useState } from "react";
import { ACTIVITY, basalRate, bmi, bmiCategory, goalCalories, maintenance, weeksToTarget } from "@/lib/body";

type Profile = {
  heightCm?:number|null; sex?:"male"|"female"|null; birthYear?:number|null;
  activityLevel?:string; targetWeightKg?:number|null; calorieGoal?:number;
};

async function api<T>(url:string, init?:RequestInit):Promise<T> {
  const response=await fetch(url,{...init,headers:{"Content-Type":"application/json",...(init?.headers??{})}});
  if(!response.ok) throw new Error("request_failed");
  return response.json();
}

export function BodyCard() {
  const [profile,setProfile]=useState<Profile>({});
  const [weightKg,setWeightKg]=useState<number|null>(null);
  const [note,setNote]=useState("");
  const load=async()=>{
    const [saved,history]=await Promise.all([
      api<Profile>("/api/profile"),
      api<{date:string;weightKg:number}[]>("/api/weight"),
    ]);
    setProfile(saved);
    setWeightKg(history.length?history[history.length-1].weightKg:null);
  };
  useEffect(()=>{void Promise.resolve().then(()=>load()).catch(()=>{});},[]);

  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data=new FormData(event.currentTarget);
    const patch={
      heightCm:Number(data.get("heightCm"))||null,
      sex:(String(data.get("sex"))||null) as "male"|"female"|null,
      birthYear:Number(data.get("birthYear"))||null,
      activityLevel:String(data.get("activityLevel")),
      targetWeightKg:Number(String(data.get("targetWeightKg")).replace(",","."))||null,
    };
    await api("/api/profile",{method:"PATCH",body:JSON.stringify(patch)}).catch(()=>{});
    setNote("Сохранено ✓"); setTimeout(()=>setNote(""),1600);
    await load().catch(()=>{});
  }

  async function applyGoal(value:number) {
    await api("/api/profile",{method:"PATCH",body:JSON.stringify({calorieGoal:value})}).catch(()=>{});
    setProfile(current=>({...current,calorieGoal:value}));
    setNote(`Норма ${value} ккал ✓`); setTimeout(()=>setNote(""),1800);
  }

  const age=profile.birthYear?new Date().getFullYear()-profile.birthYear:null;
  const ready=Boolean(weightKg&&profile.heightCm&&profile.sex&&age);
  const index=weightKg&&profile.heightCm?bmi(weightKg,profile.heightCm):null;
  const category=index?bmiCategory(index):null;
  const basal=ready?basalRate({weightKg:weightKg!,heightCm:profile.heightCm!,age:age!,sex:profile.sex!}):null;
  const maintain=basal?maintenance(basal,profile.activityLevel??"light"):null;
  const target=profile.targetWeightKg??null;
  const direction:"lose"|"keep"|"gain"=!target||!weightKg?"keep":target<weightKg-0.3?"lose":target>weightKg+0.3?"gain":"keep";
  const suggested=maintain?goalCalories(maintain,direction):null;
  const weeks=maintain&&target&&weightKg&&suggested?weeksToTarget(weightKg,target,Math.abs(maintain-suggested)):null;

  return <div className="list-card settings body-card">
    <h3>Тело и расчёты {note&&<small>{note}</small>}</h3>

    {index&&category&&<div className={`bmi-box ${category.key}`}>
      <div><b>{index.toFixed(1)}</b><small>ИМТ</small></div>
      <div><b>{category.label}</b><small>при весе {weightKg!.toFixed(1)} кг и росте {profile.heightCm} см</small></div>
    </div>}

    <form className="body-form" onSubmit={save}>
      <label>Рост, см<input name="heightCm" type="number" min="100" max="250" defaultValue={profile.heightCm??""} placeholder="180"/></label>
      <label>Пол<select name="sex" defaultValue={profile.sex??""}><option value="">—</option><option value="male">Мужской</option><option value="female">Женский</option></select></label>
      <label>Год рождения<input name="birthYear" type="number" min="1900" max="2100" defaultValue={profile.birthYear??""} placeholder="1995"/></label>
      <label>Целевой вес, кг<input name="targetWeightKg" type="number" step="0.1" min="20" max="400" defaultValue={profile.targetWeightKg??""} placeholder="72"/></label>
      <label className="wide">Активность<select name="activityLevel" defaultValue={profile.activityLevel??"light"}>
        {Object.entries(ACTIVITY).map(([key,item])=><option key={key} value={key}>{item.label}</option>)}</select></label>
      <button className="primary wide">Сохранить</button>
    </form>

    {!ready&&<p className="muted small">Заполни рост, пол и год рождения, а на экране «Сегодня» запиши вес — тогда посчитаю норму калорий.</p>}

    {ready&&maintain&&suggested&&<div className="calc-box">
      <div className="calc-row"><span>Базовый обмен</span><b>{Math.round(basal!)} ккал</b></div>
      <div className="calc-row"><span>Поддержание веса</span><b>{Math.round(maintain)} ккал</b></div>
      <div className="calc-row highlight"><span>{direction==="lose"?"Чтобы худеть":direction==="gain"?"Чтобы набирать":"Чтобы держать вес"}</span><b>{suggested} ккал</b></div>
      {weeks&&<p className="muted small">При такой норме до {target} кг — примерно {weeks} нед. Оценка грубая: вес зависит не только от калорий.</p>}
      {profile.calorieGoal!==suggested&&<button className="primary" onClick={()=>void applyGoal(suggested)}>Сделать это моей нормой</button>}
      <p className="muted small">Расчёт по формуле Миффлина — Сан Жеора. Это ориентир, а не назначение врача: при болезнях, беременности или больших изменениях веса стоит советоваться со специалистом.</p>
    </div>}
  </div>;
}
