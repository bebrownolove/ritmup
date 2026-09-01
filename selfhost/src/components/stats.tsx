"use client";

import { useEffect, useState } from "react";

export type HistoryDay = {
  date:string; caloriesEaten:number; calorieGoal:number;
  weightKg:number|null; steps:number|null; activeCalories:number; workoutMinutes:number;
};

async function fetchJson<T>(url:string):Promise<T> {
  const response=await fetch(url);
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

/** 1 840 вместо 1840 — так число читается с одного взгляда. */
function spaced(value:number) { return value.toLocaleString("ru-RU").replace(/\u00a0/g,"\u202f"); }

function shortDate(date:string) {
  return new Date(`${date}T00:00`).toLocaleDateString("ru",{day:"numeric",month:"short"});
}

function WeightChart({days}:{days:HistoryDay[]}) {
  const points=days.filter(day=>day.weightKg!==null) as (HistoryDay&{weightKg:number})[];
  if(points.length<2) return <p className="muted small">Запиши вес хотя бы дважды — здесь появится график.</p>;
  const values=points.map(point=>point.weightKg);
  const min=Math.min(...values), max=Math.max(...values), span=max-min||1;
  const step=100/(points.length-1);
  const path=values.map((value,index)=>`${index?"L":"M"}${(index*step).toFixed(2)},${(46-((value-min)/span)*40).toFixed(2)}`).join(" ");
  return <div className="weight-chart">
    <svg viewBox="0 0 100 50" preserveAspectRatio="none" aria-label="График веса">
      <path d={path} fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
    </svg>
    <div className="chart-scale"><span>{max.toFixed(1)}</span><span>{min.toFixed(1)}</span></div>
  </div>;
}

export function StatsScreen() {
  const [range,setRange]=useState(30);
  const [days,setDays]=useState<HistoryDay[]>([]);
  useEffect(()=>{void fetchJson<HistoryDay[]>(`/api/history?days=${range}`).then(setDays).catch(()=>{});},[range]);
  if(!days.length) return <section className="screen slide-up"><p className="muted">Загружаем историю…</p></section>;

  const logged=days.filter(day=>day.caloriesEaten>0);
  const averageEaten=logged.length?Math.round(logged.reduce((sum,day)=>sum+day.caloriesEaten,0)/logged.length):0;
  const withinGoal=logged.filter(day=>day.caloriesEaten<=day.calorieGoal).length;
  const minutes=days.reduce((sum,day)=>sum+day.workoutMinutes,0);
  const withSteps=days.filter(day=>(day.steps??0)>0);
  const steps=withSteps.reduce((sum,day)=>sum+(day.steps??0),0);
  const weighed=days.filter(day=>day.weightKg!==null);
  const weightChange=weighed.length>1?weighed[weighed.length-1].weightKg!-weighed[0].weightKg!:null;
  const goal=days[days.length-1]?.calorieGoal??2000;
  // В тёмной карточке показываем последнюю неделю: 90 столбиков туда не влезут.
  const bars=days.slice(-7);
  const peak=Math.max(...bars.map(day=>Math.max(day.caloriesEaten,1)),1);

  return <section className="screen">
    <div className="segmented" role="tablist" aria-label="Период">
      {([[7,"Неделя"],[30,"Месяц"],[90,"Год"]] as [number,string][]).map(([value,label])=>
        <button key={value} role="tab" aria-selected={range===value} className={range===value?"active":""} onClick={()=>setRange(value)}>{label}</button>)}
    </div>

    <div className="hero-dark">
      <p className="eyebrow">СРЕДНЕЕ ЗА {range===7?"НЕДЕЛЮ":range===30?"МЕСЯЦ":"ГОД"}</p>
      <b className="big">{averageEaten?`${spaced(averageEaten)} ккал`:"нет данных"}</b>
      <p>{logged.length
        ? `Цель ${spaced(goal)} — держишься ниже ${withinGoal} ${plural(withinGoal,"день","дня","дней")} из ${logged.length}.`
        : "Начни записывать еду, и здесь появится картина недели."}</p>
      {bars.length>0&&<div className="bars-dark" style={{marginTop:16}}>
        {bars.map(day=><div key={day.date}>
          <i className={day.caloriesEaten===0?"none":day.caloriesEaten>day.calorieGoal?"peak":""}
             style={{height:`${Math.max(day.caloriesEaten/peak*100,6)}%`}}/>
          <small>{new Date(`${day.date}T00:00`).toLocaleDateString("ru",{weekday:"short"})}</small>
        </div>)}
      </div>}
    </div>

    <div className="tiles stats-tiles">
      <div className="tile">
        <p className="eyebrow">ШАГИ В ДЕНЬ</p>
        <b>{withSteps.length?spaced(Math.round(steps/withSteps.length)):"—"}</b>
        <small>{withSteps.length?`за ${withSteps.length} ${plural(withSteps.length,"день","дня","дней")} с данными`:"нет данных"}</small>
      </div>
      <div className="tile">
        <p className="eyebrow">ТРЕНИРОВКИ</p>
        <b>{minutes}</b>
        <small>{plural(minutes,"минута","минуты","минут")} за период</small>
      </div>
      <div className="tile" style={{gridColumn:"1/-1"}}>
        <p className="eyebrow">ВЕС</p>
        <b>{weighed.length?`${weighed[weighed.length-1].weightKg!.toFixed(1).replace(".",",")} кг`:"—"}</b>
        <small className={weightChange!==null&&weightChange<0?"up":""}>
          {weightChange===null?"запиши вес хотя бы дважды"
            :`${weightChange>0?"+":"−"}${Math.abs(weightChange).toFixed(1).replace(".",",")} кг за период`}</small>
        <WeightChart days={days}/>
      </div>
    </div>

    <div className="card">
      <div className="card-head"><h3>Последние дни</h3></div>
      {[...days].reverse().slice(0,14).map(day=>{
        const over=day.caloriesEaten>day.calorieGoal, none=day.caloriesEaten===0;
        return <div className="day-item" key={day.date}>
          <i className={none?"none":over?"over":""}/>
          <b>{shortDate(day.date)}
            <small className={over?"over":""}>
              {none?"записей нет":over?`превысил норму на ${spaced(day.caloriesEaten-day.calorieGoal)}`
                :`в норме${day.workoutMinutes?` · ${day.workoutMinutes} мин спорта`:""}`}
            </small></b>
          <em className={none?"none":over?"over":""}>{none?"—":spaced(day.caloriesEaten)}</em>
        </div>;
      })}
    </div>
  </section>;
}
