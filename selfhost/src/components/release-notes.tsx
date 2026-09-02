"use client";

import { useEffect, useState } from "react";

/**
 * Ключ текущего объявления. Показываем окно, пока в профиле лежит другое
 * значение, и записываем это при закрытии — поэтому оно всплывает ровно
 * один раз на аккаунт, а не на каждом устройстве заново.
 * Для следующего объявления заводим новый ключ, а не правим этот.
 */
export const RELEASE_KEY = "2026-09-redesign";

const CHANGES:{icon:string;title:string;text:string}[] = [
  {icon:"📷",title:"Калории по фото",text:"Сфотографируй еду или просто опиши её — Gemini посчитает калории и БЖУ. Хватит чего-то одного."},
  {icon:"🎨",title:"Новый вид",text:"Экраны собраны заново: день на виду, полоса недели, крупные цифры."},
  {icon:"🧑‍🎨",title:"Персонаж",text:"Отдельный экран сборки, новые причёски и одежда. Часть вещей открывается за монеты."},
  {icon:"👋",title:"Карточки друзей",text:"Загляни к другу и посмотри то, что он открыл: питание, движение, вес и историю."},
];

export function ReleaseNotes({onClose}:{onClose:()=>void}) {
  const [closing,setClosing]=useState(false);
  useEffect(()=>{
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")finish();};
    window.addEventListener("keydown",escape);
    return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",escape);};
  // finish стабилен на всё время жизни окна: оно закрывается один раз.
  },[]);// eslint-disable-line react-hooks/exhaustive-deps

  function finish(){
    if(closing)return;
    setClosing(true);
    onClose();
  }

  return <div className="release-backdrop" role="dialog" aria-modal="true" aria-labelledby="release-title">
    <div className="release-card">
      <div className="release-top" aria-hidden>✨</div>
      <h2 id="release-title">Ритм обновился</h2>
      <p className="release-lead">Вот что появилось, пока тебя не было.</p>
      <div className="release-list">
        {CHANGES.map(item=><div className="release-item" key={item.title}>
          <span aria-hidden>{item.icon}</span>
          <div><b>{item.title}</b><small>{item.text}</small></div>
        </div>)}
      </div>
      <button className="btn-primary" onClick={finish} disabled={closing}>Понятно</button>
    </div>
  </div>;
}
