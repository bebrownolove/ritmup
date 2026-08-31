"use client";

import { useState } from "react";
import { AvatarConfig, DEFAULT_AVATAR, normalizeAvatar } from "@/lib/avatar";

type Category = keyof AvatarConfig;
const categories:{key:Category;icon:string;label:string}[]=[
  {key:"skin",icon:"🎨",label:"Кожа"},{key:"head",icon:"🙂",label:"Голова"},{key:"hair",icon:"💇",label:"Волосы"},
  {key:"hairColor",icon:"🖌️",label:"Цвет волос"},{key:"eyes",icon:"👀",label:"Глаза"},{key:"mouth",icon:"👄",label:"Рот"},
  {key:"outfit",icon:"👕",label:"Одежда"},{key:"headwear",icon:"🧢",label:"На голову"},{key:"glasses",icon:"👓",label:"Очки"},
  {key:"piercing",icon:"💎",label:"Пирсинг"},{key:"tattoo",icon:"⚡",label:"Тату"},{key:"accessory",icon:"🎧",label:"Аксессуар"},
  {key:"background",icon:"🌈",label:"Фон"},
];

const choices:Record<Category,{key:string;label:string;icon?:string;color?:string}[]>={
  skin:[{key:"porcelain",label:"Фарфор",color:"#ffe8dc"},{key:"fair",label:"Светлая",color:"#f7cfb2"},{key:"warm",label:"Тёплая",color:"#e8ae7d"},{key:"tan",label:"Загар",color:"#c98252"},{key:"brown",label:"Смуглая",color:"#975e3d"},{key:"deep",label:"Тёмная",color:"#593827"},{key:"rose",label:"Розовая",color:"#e89aa5"},{key:"fantasy",label:"Мятная",color:"#8bd8c7"}],
  head:[{key:"round",label:"Круглая",icon:"●"},{key:"oval",label:"Овальная",icon:"⬮"},{key:"soft",label:"Мягкая",icon:"▢"},{key:"square",label:"Квадратная",icon:"■"}],
  hair:[{key:"short",label:"Короткие",icon:"✂️"},{key:"fringe",label:"Чёлка",icon:"〰"},{key:"bob",label:"Каре",icon:"◒"},{key:"long",label:"Длинные",icon:"⬇"},{key:"curls",label:"Кудри",icon:"➰"},{key:"buns",label:"Пучки",icon:"●●"},{key:"mohawk",label:"Ирокез",icon:"▲"},{key:"waves",label:"Волны",icon:"≈"},{key:"shaved",label:"Ёжик",icon:"•••"},{key:"messy",label:"Растрёпанные",icon:"✦"}],
  hairColor:[{key:"espresso",label:"Кофе",color:"#3a251f"},{key:"black",label:"Чёрный",color:"#17191d"},{key:"chestnut",label:"Каштан",color:"#70402e"},{key:"honey",label:"Мёд",color:"#dcae4c"},{key:"copper",label:"Медь",color:"#b9512f"},{key:"pink",label:"Розовый",color:"#e36f9f"},{key:"blue",label:"Синий",color:"#5175dc"},{key:"mint",label:"Мятный",color:"#4ebda5"},{key:"silver",label:"Серебро",color:"#b9bec9"}],
  eyes:[{key:"dot",label:"Точки",icon:"• •"},{key:"bright",label:"Живые",icon:"◕ ◕"},{key:"happy",label:"Весёлые",icon:"⌃ ⌃"},{key:"sleepy",label:"Сонные",icon:"— —"},{key:"star",label:"Звёзды",icon:"★ ★"},{key:"wide",label:"Большие",icon:"◉ ◉"},{key:"wink",label:"Подмигивание",icon:"• —"},{key:"lashes",label:"Ресницы",icon:"˄ ˄"}],
  mouth:[{key:"smile",label:"Улыбка",icon:"⌣"},{key:"grin",label:"До ушей",icon:"▽"},{key:"soft",label:"Мягкая",icon:"ᴗ"},{key:"open",label:"Открытый",icon:"○"},{key:"kiss",label:"Поцелуй",icon:"з"},{key:"calm",label:"Спокойный",icon:"—"},{key:"surprised",label:"Ого",icon:"o"}],
  outfit:[{key:"tee",label:"Футболка",icon:"👕"},{key:"hoodie",label:"Худи",icon:"🧥"},{key:"sweater",label:"Свитер",icon:"🧶"},{key:"jacket",label:"Куртка",icon:"🧥"},{key:"sport",label:"Спортивная",icon:"🏃"},{key:"dress",label:"Платье",icon:"👗"},{key:"shirt",label:"Рубашка",icon:"👔"},{key:"overalls",label:"Комбинезон",icon:"🩱"},{key:"punk",label:"Панк",icon:"🤘"},{key:"varsity",label:"Бомбер",icon:"🏅"},{key:"armor",label:"Доспех",icon:"🛡️"},{key:"space",label:"Космос",icon:"🚀"}],
  headwear:[{key:"none",label:"Без",icon:"×"},{key:"cap",label:"Кепка",icon:"🧢"},{key:"beanie",label:"Шапка",icon:"🧶"},{key:"crown",label:"Корона",icon:"👑"},{key:"bandana",label:"Бандана",icon:"🔻"},{key:"cowboy",label:"Ковбойская",icon:"🤠"},{key:"halo",label:"Нимб",icon:"✨"},{key:"flowers",label:"Цветы",icon:"🌸"}],
  glasses:[{key:"none",label:"Без",icon:"×"},{key:"round",label:"Круглые",icon:"◉—◉"},{key:"square",label:"Квадратные",icon:"□—□"},{key:"sun",label:"Тёмные",icon:"🕶️"},{key:"heart",label:"Сердца",icon:"♥ ♥"},{key:"sport",label:"Спорт",icon:"🥽"},{key:"mono",label:"Монокль",icon:"◉"}],
  piercing:[{key:"none",label:"Без",icon:"×"},{key:"stud",label:"Гвоздик",icon:"•"},{key:"double",label:"Двойной",icon:"••"},{key:"hoop",label:"Кольцо",icon:"○"},{key:"nose",label:"В носу",icon:"✦"},{key:"brow",label:"В брови",icon:"••"},{key:"septum",label:"Септум",icon:"∪"}],
  tattoo:[{key:"none",label:"Без",icon:"×"},{key:"star",label:"Звезда",icon:"★"},{key:"heart",label:"Сердце",icon:"♥"},{key:"bolt",label:"Молния",icon:"ϟ"},{key:"moon",label:"Луна",icon:"☾"},{key:"flower",label:"Цветок",icon:"✿"},{key:"wave",label:"Волна",icon:"≈"}],
  accessory:[{key:"none",label:"Без",icon:"×"},{key:"chain",label:"Цепь",icon:"⛓"},{key:"scarf",label:"Шарф",icon:"🧣"},{key:"headphones",label:"Наушники",icon:"🎧"},{key:"earbuds",label:"Вкладыши",icon:"🎵"},{key:"bow",label:"Бант",icon:"🎀"},{key:"badge",label:"Значок",icon:"⭐"},{key:"necklace",label:"Кулон",icon:"💠"}],
  background:[{key:"mint",label:"Мята",color:"#cdeecb"},{key:"sky",label:"Небо",color:"#cbe8fa"},{key:"peach",label:"Персик",color:"#ffd7bd"},{key:"lemon",label:"Лимон",color:"#f8ed9f"},{key:"lavender",label:"Лаванда",color:"#ded2f7"},{key:"rose",label:"Роза",color:"#f7cedb"},{key:"ocean",label:"Океан",color:"#70c6cf"},{key:"night",label:"Ночь",color:"#26334f"},{key:"lime",label:"Лайм",color:"#bce56d"},{key:"coral",label:"Коралл",color:"#f3907f"},{key:"sand",label:"Песок",color:"#e8d2a7"},{key:"graphite",label:"Графит",color:"#697079"}],
};

const eyeText:Record<string,string>={dot:"•  •",bright:"◕  ◕",happy:"⌃  ⌃",sleepy:"—  —",star:"★  ★",wide:"◉  ◉",wink:"•  —",lashes:"˄  ˄"};
const mouthText:Record<string,string>={smile:"⌣",grin:"▽",soft:"ᴗ",open:"○",kiss:"з",calm:"—",surprised:"o"};
const hatText:Record<string,string>={none:"",cap:"🧢",beanie:"●",crown:"♛",bandana:"▰",cowboy:"⌒",halo:"◯",flowers:"✿ ✿"};
const glassesText:Record<string,string>={none:"",round:"○—○",square:"□—□",sun:"▰ ▰",heart:"♥ ♥",sport:"▱",mono:"○"};
const tattooText:Record<string,string>={none:"",star:"★",heart:"♥",bolt:"ϟ",moon:"☾",flower:"✿",wave:"≈"};
const accessoryText:Record<string,string>={none:"",chain:"◡◡",scarf:"▰",headphones:"◖ ◗",earbuds:"• ♪",bow:"⋈",badge:"★",necklace:"◇"};

export function CharacterAvatar({value,size="medium",label="Персонаж"}:{value?:Partial<AvatarConfig>|null;size?:"small"|"medium"|"large";label?:string}){
  const avatar=normalizeAvatar(value);
  return <div className={`character-avatar avatar-${size} bg-${avatar.background}`} role="img" aria-label={label}>
    <div className={`avatar-body outfit-${avatar.outfit}`}><i/></div>
    <div className={`avatar-neck skin-${avatar.skin}`}/>
    <div className={`avatar-head head-${avatar.head} skin-${avatar.skin}`}>
      <i className="avatar-ear left"/><i className="avatar-ear right"/>
      <div className={`avatar-hair hair-${avatar.hair} haircolor-${avatar.hairColor}`}/>
      <span className="avatar-eyes">{eyeText[avatar.eyes]}</span><span className="avatar-mouth">{mouthText[avatar.mouth]}</span>
      <span className={`avatar-piercing piercing-${avatar.piercing}`}>{avatar.piercing==="none"?"":"•"}</span>
      <span className="avatar-tattoo">{tattooText[avatar.tattoo]}</span>
      <span className={`avatar-glasses glasses-${avatar.glasses}`}>{glassesText[avatar.glasses]}</span>
    </div>
    <span className={`avatar-hat hat-${avatar.headwear}`}>{hatText[avatar.headwear]}</span>
    <span className={`avatar-accessory accessory-${avatar.accessory}`}>{accessoryText[avatar.accessory]}</span>
  </div>;
}

async function saveAvatar(value:AvatarConfig){
  const response=await fetch("/api/profile",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({avatarConfig:value})});
  if(!response.ok)throw new Error("save_failed");
}

export function AvatarEditor({initial,onSaved}:{initial?:Partial<AvatarConfig>|null;onSaved?:(value:AvatarConfig)=>void}){
  const [value,setValue]=useState<AvatarConfig>(()=>normalizeAvatar(initial??DEFAULT_AVATAR));
  const [category,setCategory]=useState<Category>("skin"); const [state,setState]=useState<"idle"|"saving"|"saved"|"error">("idle");
  const current=categories.find(item=>item.key===category)!;
  function choose(key:string){setValue(previous=>({...previous,[category]:key}));setState("idle");}
  async function save(){setState("saving");try{await saveAvatar(value);setState("saved");onSaved?.(value);setTimeout(()=>setState("idle"),1800);}catch{setState("error");}}
  return <div className="avatar-editor">
    <div className="avatar-editor-preview"><CharacterAvatar value={value} size="large"/><div><b>Твой персонаж</b><small>Будет виден тебе и друзьям</small></div></div>
    <div className="avatar-categories" role="tablist" aria-label="Части персонажа">{categories.map(item=><button type="button" role="tab" aria-selected={category===item.key} className={category===item.key?"active":""} key={item.key} onClick={()=>setCategory(item.key)}><span>{item.icon}</span>{item.label}</button>)}</div>
    <div className="avatar-choice-head"><b>{current.icon} {current.label}</b><small>{choices[category].length} вариантов</small></div>
    <div className="avatar-options">{choices[category].map(option=><button type="button" className={value[category]===option.key?"active":""} aria-pressed={value[category]===option.key} key={option.key} onClick={()=>choose(option.key)}><i style={option.color?{background:option.color}:undefined}>{option.icon}</i><span>{option.label}</span></button>)}</div>
    <button className="primary avatar-save" disabled={state==="saving"} onClick={()=>void save()}>{state==="saving"?"Сохраняю…":state==="saved"?"Персонаж сохранён ✓":state==="error"?"Попробовать ещё раз":"Сохранить персонажа"}</button>
  </div>;
}
