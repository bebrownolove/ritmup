"use client";

import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(()=>{
    if(!("serviceWorker" in navigator)) return;
    if(location.protocol!=="https:"&&location.hostname!=="localhost") return;
    const register=()=>{void navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"}).catch(()=>{});};
    if(document.readyState==="complete") register(); else window.addEventListener("load",register,{once:true});
  },[]);
  return null;
}
