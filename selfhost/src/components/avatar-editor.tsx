"use client";

import { useMemo, useState } from "react";
import {
  AVATAR_VALUES, AvatarConfig, DEFAULT_AVATAR, applySex, isUnlocked, lockCost, normalizeAvatar, unlockId,
} from "@/lib/avatar";
import { AVATAR_CROPS, AVATAR_CROP_OVERRIDE, BG, HAIRC, SKIN, renderAvatar, shade } from "@/lib/avatar-render";

type Category = keyof AvatarConfig;

const CATEGORY_LABEL:Record<Category,string> = {
  sex:"Кто твой персонаж", skin:"Кожа", head:"Форма головы", hair:"Причёска", hairColor:"Цвет волос",
  eyes:"Глаза", mouth:"Рот", glasses:"Очки", outfit:"Одежда", headwear:"На голову",
  accessory:"Аксессуар", piercing:"Пирсинг", tattoo:"Тату", background:"Фон",
};

const GROUPS:{title:string;cats:Category[]}[] = [
  { title:"КТО ТЫ", cats:["sex"] },
  { title:"ВНЕШНОСТЬ", cats:["skin","head"] },
  { title:"ВОЛОСЫ", cats:["hair","hairColor"] },
  { title:"ЛИЦО", cats:["eyes","mouth","glasses"] },
  { title:"СТИЛЬ", cats:["outfit","headwear","accessory","piercing","tattoo","background"] },
];

const LABELS:Record<Category,Record<string,string>> = {
  sex:{ girl:"Девочка", boy:"Мальчик" },
  skin:{ porcelain:"Фарфор", fair:"Светлая", warm:"Тёплая", tan:"Загар", brown:"Смуглая", deep:"Тёмная", rose:"Розовая", fantasy:"Мятная" },
  head:{ round:"Круглая", oval:"Овальная", soft:"Мягкая", square:"Квадратная" },
  hair:{ short:"Короткие", fringe:"Чёлка", bob:"Каре", long:"Длинные", curls:"Кудри", buns:"Пучки", mohawk:"Ирокез", waves:"Волны", shaved:"Ёжик", messy:"Растрёпанные" },
  hairColor:{ espresso:"Кофе", black:"Чёрный", chestnut:"Каштан", honey:"Мёд", copper:"Медь", pink:"Розовый", blue:"Синий", mint:"Мятный", silver:"Серебро" },
  eyes:{ dot:"Точки", bright:"Живые", happy:"Весёлые", sleepy:"Сонные", star:"Звёзды", wide:"Большие", wink:"Подмигивание", lashes:"Ресницы" },
  mouth:{ smile:"Улыбка", grin:"До ушей", soft:"Мягкая", open:"Открытый", kiss:"Поцелуй", calm:"Спокойный", surprised:"Ого" },
  outfit:{ tee:"Футболка", hoodie:"Худи", sweater:"Свитер", jacket:"Куртка", sport:"Спорт", dress:"Платье", shirt:"Рубашка", overalls:"Комбинезон", punk:"Панк", varsity:"Бомбер", armor:"Доспех", space:"Космос" },
  headwear:{ none:"Без", cap:"Кепка", beanie:"Шапка", crown:"Корона", bandana:"Бандана", cowboy:"Ковбойская", halo:"Нимб", flowers:"Цветы" },
  glasses:{ none:"Без", round:"Круглые", square:"Квадратные", sun:"Тёмные", heart:"Сердца", sport:"Спорт", mono:"Монокль" },
  piercing:{ none:"Без", stud:"Гвоздик", double:"Двойной", hoop:"Кольцо", nose:"В носу", brow:"В брови", septum:"Септум" },
  tattoo:{ none:"Без", star:"Звезда", heart:"Сердце", bolt:"Молния", moon:"Луна", flower:"Цветок", wave:"Волна" },
  accessory:{ none:"Без", chain:"Цепь", scarf:"Шарф", headphones:"Наушники", earbuds:"Вкладыши", bow:"Бант", badge:"Значок", necklace:"Кулон" },
  background:{ mint:"Мята", sky:"Небо", peach:"Персик", lemon:"Лимон", lavender:"Лаванда", rose:"Роза", ocean:"Океан", night:"Ночь", lime:"Лайм", coral:"Коралл", sand:"Песок", graphite:"Графит" },
};

/** Высота превью на плитке подбирается под кроп, иначе деталь теряется. */
const PREVIEW_H:Partial<Record<Category,string>> = {
  sex:"112px", head:"88px", hair:"88px", eyes:"84px", mouth:"84px", glasses:"88px",
  outfit:"64px", accessory:"78px", headwear:"78px", piercing:"70px", tattoo:"70px",
};

/** Категории цвета показывают образец краски, а не миниатюру персонажа. */
function swatchOf(category:Category, key:string) {
  if (category==="skin") return SKIN[key];
  if (category==="hairColor") return HAIRC[key];
  if (category==="background") return BG[key];
  return null;
}

export function CharacterAvatar({value,size="medium",label="Персонаж"}:{value?:Partial<AvatarConfig>|null;size?:"small"|"medium"|"large";label?:string}) {
  const avatar=normalizeAvatar(value);
  return <div className={`character-avatar avatar-${size}`}>{renderAvatar(avatar,{label})}</div>;
}

async function api<T>(url:string, init?:RequestInit):Promise<T> {
  const response=await fetch(url,{...init,headers:{"Content-Type":"application/json",...(init?.headers??{})}});
  if(!response.ok) throw Object.assign(new Error("request_failed"),{status:response.status});
  return response.json();
}

type SaveState = "idle"|"saving"|"saved"|"error";

/**
 * Полноэкранный редактор персонажа. Категории идут вертикальными секциями:
 * горизонтальную полосу из 13 табов на телефоне пролистать до конца невозможно.
 */
export function AvatarEditor({initial,coins:initialCoins,unlocked:initialUnlocked,onSaved,onCoins,onClose}:{
  initial?:Partial<AvatarConfig>|null; coins:number; unlocked?:readonly string[]|null;
  onSaved?:(value:AvatarConfig)=>void; onCoins?:(coins:number)=>void; onClose:()=>void;
}) {
  const saved=useMemo(()=>normalizeAvatar(initial??DEFAULT_AVATAR),[initial]);
  const [value,setValue]=useState<AvatarConfig>(saved);
  const [unlocked,setUnlocked]=useState<string[]>(()=>[...(initialUnlocked??[])]);
  const [coins,setCoins]=useState(initialCoins);
  const [state,setState]=useState<SaveState>("idle");
  const [note,setNote]=useState("");

  const dirty=useMemo(()=>JSON.stringify(value)!==JSON.stringify(saved),[value,saved]);

  function flash(text:string){setNote(text);setTimeout(()=>setNote(""),2200);}

  async function choose(category:Category, key:string) {
    const cost=lockCost(category,key);
    if(cost&&!unlocked.includes(unlockId(category,key))) {
      if(coins<cost){flash(`Не хватает ${cost-coins} 🪙 — копи серией дней`);return;}
      try{
        const result=await api<{coins:number;unlocked?:string[]}>("/api/avatar/unlock",{method:"POST",body:JSON.stringify({category,key})});
        setCoins(result.coins); onCoins?.(result.coins);
        setUnlocked(result.unlocked??[...unlocked,unlockId(category,key)]);
        flash(`Открыто за ${cost} 🪙`);
      }catch(error){
        flash((error as {status?:number}).status===402?"Не хватает монет":"Не получилось купить");
        return;
      }
    }
    setValue(previous=>category==="sex"?applySex(previous,key as AvatarConfig["sex"]):{...previous,[category]:key});
    setState("idle");
  }

  function randomize() {
    setValue(previous=>{
      const next={...previous};
      for(const category of Object.keys(AVATAR_VALUES) as Category[]) {
        if(category==="sex") continue;
        const pool=(AVATAR_VALUES[category] as readonly string[]).filter(key=>isUnlocked(category,key,unlocked));
        next[category]=pool[Math.floor(Math.random()*pool.length)] as never;
      }
      return next;
    });
    setState("idle");
  }

  async function save() {
    setState("saving");
    try{
      await api("/api/profile",{method:"PATCH",body:JSON.stringify({avatarConfig:value})});
      setState("saved"); onSaved?.(value); setTimeout(()=>setState("idle"),2000);
    }catch{setState("error");}
  }

  return <div className="maker">
    <header className="maker-bar">
      <button type="button" className="maker-back" onClick={onClose} aria-label="Назад">‹</button>
      <div><b>Мой персонаж</b><small>Виден в шапке, профиле и у друзей</small></div>
      <div className="maker-coins"><i/><b>{coins}</b></div>
    </header>

    <div className="maker-stage" style={{background:shade(BG[value.background],0.55)}}>
      <div className="maker-hero">{renderAvatar(value,{label:"Твой персонаж"})}</div>
    </div>

    <div className="maker-tools">
      <button type="button" onClick={randomize}>Случайно</button>
      <button type="button" onClick={()=>{setValue(saved);setState("idle");}} disabled={!dirty}>Вернуть</button>
    </div>

    <div className="maker-groups">
      {GROUPS.map(group=><section key={group.title} className="maker-group">
        <div className="maker-group-head"><h2>{group.title}</h2><span/></div>
        {group.cats.map(category=>{
          const options=AVATAR_VALUES[category] as readonly string[];
          return <div className="maker-cat" key={category}>
            <div className="maker-cat-head"><b>{CATEGORY_LABEL[category]}</b><small>{LABELS[category][value[category]]}</small></div>
            <div className="maker-options">
              {options.map(key=>{
                const cost=lockCost(category,key);
                const locked=Boolean(cost)&&!unlocked.includes(unlockId(category,key));
                const swatch=swatchOf(category,key);
                const preview=category==="sex"?applySex(value,key as AvatarConfig["sex"]):{...value,[category]:key};
                const crop=AVATAR_CROP_OVERRIDE[category]?.[key]??AVATAR_CROPS[category]??null;
                return <button type="button" key={key}
                  className={`maker-option${value[category]===key?" active":""}${locked?" locked":""}${locked&&coins<cost!?" poor":""}`}
                  aria-pressed={value[category]===key}
                  onClick={()=>void choose(category,key)}>
                  <span className="maker-preview" style={{height:swatch?"58px":(PREVIEW_H[category]??"84px"),background:swatch??BG[value.background]}}>
                    {swatch?null:renderAvatar(preview as AvatarConfig,{crop,label:LABELS[category][key]})}
                  </span>
                  <span className="maker-option-label">{LABELS[category][key]}</span>
                  {locked&&<span className="maker-price"><i/>{cost}</span>}
                </button>;
              })}
            </div>
          </div>;
        })}
      </section>)}
    </div>

    <div className="maker-foot">
      {note&&<small className="maker-note">{note}</small>}
      <button className={`primary maker-save${state==="saved"?" done":""}`} disabled={state==="saving"||(!dirty&&state!=="error")} onClick={()=>void save()}>
        {state==="saving"?"Сохраняю…":state==="saved"?"Персонаж сохранён ✓":state==="error"?"Попробовать ещё раз":dirty?"Сохранить персонажа":"Изменений нет"}
      </button>
    </div>
  </div>;
}
