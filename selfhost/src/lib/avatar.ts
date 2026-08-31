export const AVATAR_VALUES = {
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
  skin:"warm",head:"round",hair:"fringe",hairColor:"espresso",eyes:"bright",mouth:"smile",
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
