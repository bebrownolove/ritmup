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

function shortDate(date:string) {
  return new Date(`${date}T00:00`).toLocaleDateString("ru",{day:"numeric",month:"short"});
}

/** Столбики съеденного: выше нормы — красный, у нормы — янтарный. */
function CalorieBars({days}:{days:HistoryDay[]}) {
  const peak=Math.max(...days.map(day=>Math.max(day.caloriesEaten,day.calorieGoal)),1);
  const goal=days[days.length-1]?.calorieGoal??2000;
  return <>
    <div className="bars">
      <i className="goal-line" style={{bottom:`${goal/peak*100}%`}}><em>{goal}</em></i>
      {days.map(day=>{
        const share=day.caloriesEaten/peak*100;
        const state=day.caloriesEaten===0?"empty":day.caloriesEaten>day.calorieGoal?"over":day.caloriesEaten>=day.calorieGoal*0.9?"close":"ok";
        return <div key={day.date} className="bar-slot" title={`${shortDate(day.date)}: ${day.caloriesEaten?`${day.caloriesEaten} из ${day.calorieGoal} ккал`:"нет записей"}`}>
          <div className={`bar ${state}`} style={{height:state==="empty"?"4px":`${Math.max(share,3)}%`}}/>
        </div>;
      })}
    </div>
    <div className="bars-axis"><span>{shortDate(days[0].date)}</span><span>{shortDate(days[days.length-1].date)}</span></div>
  </>;
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

  return <section className="screen slide-up">
    <div className="hero-row"><div><p className="eyebrow">СТАТИСТИКА</p><h2>Как идут дела</h2></div>
      <div className="range-switch">{[7,30,90].map(value=>
        <button key={value} className={range===value?"active":""} onClick={()=>setRange(value)}>{value} дней</button>)}</div>
    </div>

    <div className="stat-grid">
      <div><b>{logged.length}</b><small>{plural(logged.length,"день","дня","дней")} с записями</small></div>
      <div><b>{averageEaten||"—"}</b><small>ккал в среднем</small></div>
      <div><b>{logged.length?`${withinGoal}/${logged.length}`:"—"}</b><small>{plural(withinGoal,"день","дня","дней")} в норме</small></div>
      <div><b>{minutes}</b><small>{plural(minutes,"минута","минуты","минут")} тренировок</small></div>
    </div>

    <div className="list-card">
      <h3>Калории по дням</h3>
      <CalorieBars days={days}/>
      <p className="muted small">Пунктир — твой ориентир. Коралловые столбики — дни выше него.</p>
    </div>

    <div className="list-card">
      <h3>Вес{weightChange!==null&&<small> · {weightChange>0?"+":""}{weightChange.toFixed(1)} кг за период</small>}</h3>
      <WeightChart days={days}/>
    </div>

    {steps>0&&<div className="list-card"><h3>Шаги</h3>
      <div className="stat-grid two"><div><b>{steps.toLocaleString("ru")}</b><small>всего</small></div>
        <div><b>{Math.round(steps/withSteps.length).toLocaleString("ru")}</b><small>в среднем за день с данными</small></div></div></div>}

    <div className="list-card">
      <h3>Последние дни</h3>
      {[...days].reverse().slice(0,14).map(day=>
        <div className="day-row" key={day.date}>
          <span>{shortDate(day.date)}</span>
          <em className={day.caloriesEaten===0?"none":day.caloriesEaten>day.calorieGoal?"over":"ok"}>
            {day.caloriesEaten?`${day.caloriesEaten} ккал`:"нет записей"}</em>
          <b>{day.weightKg?`${day.weightKg.toFixed(1)} кг`:""}</b>
          <i>{day.workoutMinutes?`${day.workoutMinutes} мин`:""}</i>
        </div>)}
    </div>
  </section>;
}
