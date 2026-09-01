export const AVATAR_VALUES = {
  // Определяет силуэт тела и причёску по умолчанию — не путать с profiles.sex
  // (биологический пол для расчёта нормы калорий в теле профиля).
  sex:["girl","boy"],
  skin:["porcelain","fair","warm","tan","brown","deep","rose","fantasy"],
  head:["round","oval","soft","square"],
  hair:["short","fringe","bob","long","curls","buns","mohawk","waves","shaved","messy"],
  hairColor:["espresso","black","chestnut","honey","copper","pink","blue","mint","silver"],
  eyes:["dot","bright","happy","sleepy","star","wide","wink","lashes"],
  mouth:["smile","grin","soft","open","kiss","calm","surprised"],
  outfit:["tee","hoodie","sweater","jacket","sport","dress","shirt","overalls","punk","varsity","armor","space"],
  headwear:["none","cap","beanie","crown","bandana","cowboy","halo","flowers"],
  glasses:["none","round","square","sun","heart","sport","mono"],
  piercing:["none","stud","double","hoop","nose","brow","septum"],
  tattoo:["none","star","heart","bolt","moon","flower","wave"],
  accessory:["none","chain","scarf","headphones","earbuds","bow","badge","necklace"],
  background:["mint","sky","peach","lemon","lavender","rose","ocean","night","lime","coral","sand","graphite"],
} as const;

export type AvatarConfig = {[K in keyof typeof AVATAR_VALUES]:(typeof AVATAR_VALUES)[K][number]};

export const DEFAULT_AVATAR:AvatarConfig = {
  sex:"girl",skin:"warm",head:"round",hair:"fringe",hairColor:"espresso",eyes:"bright",mouth:"smile",
  outfit:"hoodie",headwear:"none",glasses:"none",piercing:"stud",tattoo:"none",accessory:"none",background:"mint",
};

export function normalizeAvatar(value:unknown):AvatarConfig {
  const source=value&&typeof value==="object"?value as Record<string,unknown>:{};
  const result={...DEFAULT_AVATAR} as Record<string,string>;
  for(const key of Object.keys(AVATAR_VALUES) as (keyof typeof AVATAR_VALUES)[]){
    const candidate=source[key];
    if(typeof candidate==="string"&&(AVATAR_VALUES[key] as readonly string[]).includes(candidate)) result[key]=candidate;
  }
  return result as AvatarConfig;
}

/**
 * Часть внешности стоит монет при первом выборе — дальше она открыта навсегда
 * (покупка хранится в profiles.avatar_unlocked). Цены совпадают с макетом
 * дизайнера: мятная кожа, доспех/космос, корона/нимб, сердечки, ночь/графит.
 */
export const AVATAR_LOCKS:Partial<{[K in keyof AvatarConfig]:Partial<Record<string,number>>}> = {
  skin:{fantasy:120},
  outfit:{armor:220,space:300},
  headwear:{crown:200,halo:150},
  glasses:{heart:60},
  background:{night:80,graphite:80},
};

export function lockCost(category:keyof AvatarConfig, key:string):number|undefined {
  return AVATAR_LOCKS[category]?.[key];
}

export function unlockId(category:keyof AvatarConfig, key:string) {
  return `${category}:${key}`;
}

export function isUnlocked(category:keyof AvatarConfig, key:string, unlocked:readonly string[]):boolean {
  const cost = lockCost(category, key);
  return !cost || unlocked.includes(unlockId(category, key));
}

/** Категории, где выбранный вариант всё ещё требует покупки — сохранять такое нельзя. */
export function lockedSelections(config:AvatarConfig, unlocked:readonly string[]) {
  return (Object.keys(AVATAR_VALUES) as (keyof AvatarConfig)[])
    .filter(category => !isUnlocked(category, config[category], unlocked));
}

export const GIRL_HAIR = ["long","bob","buns","waves","curls","messy"] as const;
export const BOY_HAIR = ["short","fringe","mohawk","shaved"] as const;

/** При смене пола персонажа причёску тоже подстраиваем, если текущая ей не подходит. */
export function applySex(config:AvatarConfig, sex:AvatarConfig["sex"]):AvatarConfig {
  const pool:readonly string[] = sex==="girl" ? GIRL_HAIR : BOY_HAIR;
  const hair = pool.includes(config.hair) ? config.hair : (pool[0] as AvatarConfig["hair"]);
  return {...config, sex, hair};
}
