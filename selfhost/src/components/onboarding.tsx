"use client";

import { useMemo, useState } from "react";
import { ACTIVITY, basalRate, goalCalories, maintenance } from "@/lib/body";

type Direction = "lose" | "keep" | "gain";
type Props = { onComplete:()=>void };

const goals:{key:Direction;icon:string;title:string;text:string}[] = [
  {key:"lose",icon:"🌱",title:"Снизить вес",text:"Мягкий дефицит без гонки"},
  {key:"keep",icon:"⚖️",title:"Держать вес",text:"Баланс еды и движения"},
  {key:"gain",icon:"💪",title:"Набрать вес",text:"Небольшой запас энергии"},
];

function localDate() {
  const now=new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
}

async function api(url:string, body:unknown, method="POST") {
  const response=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  if(!response.ok) throw new Error("request_failed");
  return response.json();
}

export function Onboarding({onComplete}:Props) {
  const [step,setStep]=useState(0);
  const [direction,setDirection]=useState<Direction>("lose");
  const [height,setHeight]=useState("");
  const [weight,setWeight]=useState("");
  const [birthYear,setBirthYear]=useState("");
  const [sex,setSex]=useState<"male"|"female">("female");
  const [activity,setActivity]=useState("light");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  const result=useMemo(()=>{
    const heightCm=Number(height), weightKg=Number(weight.replace(",",".")), year=Number(birthYear);
    const age=new Date().getFullYear()-year;
    if(heightCm<100||heightCm>250||weightKg<20||weightKg>400||age<14||age>100)return null;
    const basal=basalRate({heightCm,weightKg,age,sex});
    const keep=maintenance(basal,activity);
    return {heightCm,weightKg,year,basal:Math.round(basal),keep:Math.round(keep),goal:goalCalories(keep,direction)};
  },[activity,birthYear,direction,height,sex,weight]);

  async function finish() {
    if(!result||busy)return;
    setBusy(true);setError("");
    try {
      await Promise.all([
        api("/api/profile",{heightCm:result.heightCm,sex,birthYear:result.year,activityLevel:activity,calorieGoal:result.goal,onboardingCompleted:true},"PATCH"),
        api("/api/daily-log",{date:localDate(),weightKg:result.weightKg}),
      ]);
      onComplete();
    } catch { setError("Не удалось сохранить. Проверь интернет и попробуй ещё раз."); }
    setBusy(false);
  }

  async function skip() {
    setBusy(true);setError("");
    try { await api("/api/profile",{onboardingCompleted:true},"PATCH"); onComplete(); }
    catch { setError("Не удалось продолжить. Попробуй ещё раз."); setBusy(false); }
  }

  return <main className="onboarding-shell">
    <section className="onboarding-card pop-in">
      <div className="onboarding-top">
        <div className="onboarding-mascot" aria-hidden>{step===3?"🎉":"🔥"}</div>
        <div className="onboarding-progress" aria-label={`Шаг ${step+1} из 4`}><i style={{width:`${(step+1)*25}%`}}/></div>
      </div>

      {step===0&&<div className="onboarding-step" key="goal">
        <p className="eyebrow">ШАГ 1 ИЗ 4</p><h1>К чему идём?</h1><p className="muted">Подберём ориентир по калориям. Его всегда можно изменить.</p>
        <div className="goal-choices">{goals.map(item=><button key={item.key} className={direction===item.key?"active":""} onClick={()=>setDirection(item.key)}><span>{item.icon}</span><div><b>{item.title}</b><small>{item.text}</small></div><i>✓</i></button>)}</div>
        <button className="primary onboarding-next" onClick={()=>setStep(1)}>Продолжить</button>
      </div>}

      {step===1&&<div className="onboarding-step" key="body">
        <p className="eyebrow">ШАГ 2 ИЗ 4</p><h1>Пара слов о тебе</h1><p className="muted">Это нужно только для примерного расчёта расхода энергии.</p>
        <div className="onboarding-form">
          <label>Рост, см<input value={height} onChange={e=>setHeight(e.target.value)} type="number" min="100" max="250" placeholder="170" inputMode="numeric"/></label>
          <label>Вес сейчас, кг<input value={weight} onChange={e=>setWeight(e.target.value)} type="number" min="20" max="400" step="0.1" placeholder="65" inputMode="decimal"/></label>
          <label>Год рождения<input value={birthYear} onChange={e=>setBirthYear(e.target.value)} type="number" min="1900" max={new Date().getFullYear()-14} placeholder="2000" inputMode="numeric"/></label>
          <label>Пол<select value={sex} onChange={e=>setSex(e.target.value as "male"|"female")}><option value="female">Женский</option><option value="male">Мужской</option></select></label>
        </div>
        {!result&&height&&weight&&birthYear&&<p className="onboarding-error">Проверь введённые значения.</p>}
        <div className="onboarding-actions"><button className="ghost" onClick={()=>setStep(0)}>Назад</button><button className="primary" disabled={!result} onClick={()=>setStep(2)}>Продолжить</button></div>
      </div>}

      {step===2&&<div className="onboarding-step" key="activity">
        <p className="eyebrow">ШАГ 3 ИЗ 4</p><h1>Сколько двигаешься?</h1><p className="muted">Выбери вариант, который больше похож на обычную неделю.</p>
        <div className="goal-choices activity-choices">{Object.entries(ACTIVITY).map(([key,item],index)=><button key={key} className={activity===key?"active":""} onClick={()=>setActivity(key)}><span>{["🪑","🚶","🏃","⚡","🏅"][index]}</span><div><b>{item.label}</b></div><i>✓</i></button>)}</div>
        <div className="onboarding-actions"><button className="ghost" onClick={()=>setStep(1)}>Назад</button><button className="primary" onClick={()=>setStep(3)}>Посчитать</button></div>
      </div>}

      {step===3&&result&&<div className="onboarding-step result-step" key="result">
        <p className="eyebrow">ТВОЙ ОРИЕНТИР</p><h1>{result.goal} <small>ккал в день</small></h1>
        <div className="result-orbit" aria-hidden><span>🍓</span><b>🔥</b><span>🏃</span></div>
        <div className="result-lines"><div><span>Базовый обмен</span><b>{result.basal} ккал</b></div><div><span>Поддержание веса</span><b>{result.keep} ккал</b></div></div>
        <p className="muted">Это стартовая оценка по формуле Миффлина — Сан Жеора, а не медицинское назначение. Смотри на самочувствие и динамику веса.</p>
        {error&&<p className="onboarding-error">{error}</p>}
        <button className="primary onboarding-next" disabled={busy} onClick={()=>void finish()}>{busy?"Сохраняю…":"Начать держать ритм"}</button>
        <button className="link-row" onClick={()=>setStep(1)}>Изменить ответы</button>
      </div>}

      {step<3&&<button className="onboarding-skip" disabled={busy} onClick={()=>void skip()}>Настроить позже</button>}
      {error&&step<3&&<p className="onboarding-error">{error}</p>}
    </section>
  </main>;
}
