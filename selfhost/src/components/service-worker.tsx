"use client";

import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(()=>{
    if(!("serviceWorker" in navigator)) return;
    if(location.protocol!=="https:"&&location.hostname!=="localhost") return;
    let registration:ServiceWorkerRegistration|undefined;
    let reloading=false;
    const hadController=Boolean(navigator.serviceWorker.controller);
    const controllerChanged=()=>{
      if(!hadController||reloading)return;
      reloading=true; location.reload();
    };
    const check=()=>{if(document.visibilityState==="visible")void registration?.update().catch(()=>{});};
    const register=()=>{void navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"}).then(value=>{
      registration=value;
      void value.update();
      value.waiting?.postMessage({type:"SKIP_WAITING"});
      value.addEventListener("updatefound",()=>value.installing?.addEventListener("statechange",()=>{
        if(value.installing?.state==="installed"&&navigator.serviceWorker.controller)value.installing.postMessage({type:"SKIP_WAITING"});
      }));
    }).catch(()=>{});};
    navigator.serviceWorker.addEventListener("controllerchange",controllerChanged);
    document.addEventListener("visibilitychange",check);
    if(document.readyState==="complete") register(); else window.addEventListener("load",register,{once:true});
    return()=>{navigator.serviceWorker.removeEventListener("controllerchange",controllerChanged);document.removeEventListener("visibilitychange",check);};
  },[]);
  return null;
}
