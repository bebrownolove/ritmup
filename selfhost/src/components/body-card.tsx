"use client";

import { FormEvent, useEffect, useState } from "react";
import { ACTIVITY, basalRate, bmi, bmiCategory, goalCalories, maintenance, weeksToTarget } from "@/lib/body";

type Profile = {
  heightCm?:number|null; sex?:"male"|"female"|null; birthYear?:number|null;
  activityLevel?:string; targetWeightKg?:number|null; calorieGoal?:number;
};
type Draft = {heightCm:string;sex:""|"male"|"female";birthYear:string;activityLevel:string;targetWeightKg:string};

function toDraft(profile:Profile):Draft {
  return {
    heightCm:profile.heightCm?String(profile.heightCm):"",
    sex:profile.sex??"",
    birthYear:profile.birthYear?String(profile.birthYear):"",
    activityLevel:profile.activityLevel??"light",
    targetWeightKg:profile.targetWeightKg?String(profile.targetWeightKg):"",
  };
}

async function api<T>(url:string, init?:RequestInit):Promise<T> {
  const response=await fetch(url,{...init,headers:{"Content-Type":"application/json",...(init?.headers??{})}});
  if(!response.ok) throw new Error("request_failed");
  return response.json();
}

export function BodyCard({embedded=false}:{embedded?:boolean}) {
  const [profile,setProfile]=useState<Profile>({});
  const [draft,setDraft]=useState<Draft>(()=>toDraft({}));
  const [weightKg,setWeightKg]=useState<number|null>(null);
  const [note,setNote]=useState("");
  const load=async()=>{
    const [saved,history]=await Promise.all([
      api<Profile>("/api/profile"),
      api<{date:string;weightKg:number}[]>("/api/weight"),
    ]);
    setProfile(saved);
    setDraft(toDraft(saved));
    setWeightKg(history.length?history[history.length-1].weightKg:null);
  };
  useEffect(()=>{void Promise.resolve().then(()=>load()).catch(()=>{});},[]);

  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const patch={
      heightCm:Number(draft.heightCm)||null,
      sex:draft.sex||null,
      birthYear:Number(draft.birthYear)||null,
      activityLevel:draft.activityLevel,
      targetWeightKg:Number(draft.targetWeightKg.replace(",","."))||null,
    };
    try {
      await api("/api/profile",{method:"PATCH",body:JSON.stringify(patch)});
      await load();
      setNote("Сохранено ✓");
    } catch { setNote("Не удалось сохранить"); }
    setTimeout(()=>setNote(""),1600);
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
  const bmiPosition=index?Math.min(98,Math.max(2,((index-14)/(40-14))*100)):0;
  const basal=ready?basalRate({weightKg:weightKg!,heightCm:profile.heightCm!,age:age!,sex:profile.sex!}):null;
  const maintain=basal?maintenance(basal,profile.activityLevel??"light"):null;
  const target=profile.targetWeightKg??null;
  const direction:"lose"|"keep"|"gain"=!target||!weightKg?"keep":target<weightKg-0.3?"lose":target>weightKg+0.3?"gain":"keep";
  const suggested=maintain?goalCalories(maintain,direction):null;
  const weeks=maintain&&target&&weightKg&&suggested?weeksToTarget(weightKg,target,Math.abs(maintain-suggested)):null;

  return <div className={`${embedded?"body-card embedded":"list-card settings body-card"}`}>
    {!embedded&&<h3>Тело и расчёты {note&&<small>{note}</small>}</h3>}
    {embedded&&note&&<small className="save-note">{note}</small>}

    {index&&category&&<div className={`bmi-box ${category.key}`}>
      <div className="bmi-summary"><div><b>{index.toFixed(1)}</b><small>Твой ИМТ</small></div><div><b>{category.label}</b><small>при весе {weightKg!.toFixed(1)} кг и росте {profile.heightCm} см</small></div></div>
      <div className="bmi-scale" aria-label={`ИМТ ${index.toFixed(1)} — ${category.label}`}>
        <div className="bmi-marker" style={{left:`${bmiPosition}%`}}><span>{index.toFixed(1)}</span><i/></div>
        <div className="bmi-track"><i className="under"/><i className="normal"/><i className="high"/><i className="obese"/></div>
        <div className="bmi-labels"><span><b>Дефицит</b>&lt; 18,5</span><span><b>Норма</b>18,5–24,9</span><span><b>Выше нормы</b>25–29,9</span><span><b>Ожирение</b>≥ 30</span></div>
      </div>
    </div>}

    <form className="body-form" onSubmit={save}>
      <label>Рост, см<input name="heightCm" type="number" min="100" max="250" value={draft.heightCm} onChange={event=>setDraft(current=>({...current,heightCm:event.target.value}))} placeholder="180"/></label>
      <label>Пол<select name="sex" value={draft.sex} onChange={event=>setDraft(current=>({...current,sex:event.target.value as Draft["sex"]}))}><option value="">—</option><option value="male">Мужской</option><option value="female">Женский</option></select></label>
      <label>Год рождения<input name="birthYear" type="number" min="1900" max="2100" value={draft.birthYear} onChange={event=>setDraft(current=>({...current,birthYear:event.target.value}))} placeholder="1995"/></label>
      <label>Целевой вес, кг<input name="targetWeightKg" type="number" step="0.1" min="20" max="400" value={draft.targetWeightKg} onChange={event=>setDraft(current=>({...current,targetWeightKg:event.target.value}))} placeholder="72"/></label>
      <label className="wide">Активность<select name="activityLevel" value={draft.activityLevel} onChange={event=>setDraft(current=>({...current,activityLevel:event.target.value}))}>
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
