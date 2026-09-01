/** Авторские иконки из макета. Навигационные красятся через currentColor. */

export function FlameIcon({size=20}:{size?:number}) {
  return <svg viewBox="0 0 24 24" width={size} height={size} className="icon" aria-hidden>
    <path d="M12 2.2c4.1 3.9 6.6 6.7 6.6 10.6A6.6 6.6 0 0 1 12 21.8 6.6 6.6 0 0 1 5.4 12.8c0-2.3 1.2-4.3 2.7-6 .1 1.6.7 2.8 1.8 3.4.1-3 .8-5.9 2.1-8Z" fill="currentColor"/>
  </svg>;
}

export function CoinIcon({size=20}:{size?:number}) {
  return <svg viewBox="0 0 24 24" width={size} height={size} className="icon" aria-hidden>
    <circle cx="12" cy="12" r="9.6" fill="#7a5205"/>
    <circle cx="12" cy="12" r="7.8" fill="#f7c745"/>
    <circle cx="12" cy="12" r="5.4" fill="#ffeaa8"/>
    <path d="M8.6 9.6a4.6 4.6 0 0 1 3.1-1.7" fill="none" stroke="#fffbe9" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M12 9.1l1 2.1 2.2.3-1.6 1.6.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.6 2.2-.3Z" fill="#c08a0a"/>
  </svg>;
}

export function HomeIcon() {
  return <svg viewBox="0 0 24 24" className="nav-icon" aria-hidden>
    <path d="M3.6 11.4 12 4l8.4 7.4a1 1 0 0 1-.7 1.8h-.9v6a1 1 0 0 1-1 1h-3.9v-5.1H10.1V20.2H6.2a1 1 0 0 1-1-1v-6h-.9a1 1 0 0 1-.7-1.8Z" fill="currentColor"/>
  </svg>;
}

export function BarsIcon() {
  return <svg viewBox="0 0 24 24" className="nav-icon" aria-hidden>
    <path d="M5 13.4h2.6a.8.8 0 0 1 .8.8v5.1a.8.8 0 0 1-.8.8H5a.8.8 0 0 1-.8-.8v-5.1a.8.8 0 0 1 .8-.8Zm5.7-5.1h2.6a.8.8 0 0 1 .8.8v10.4a.8.8 0 0 1-.8.8h-2.6a.8.8 0 0 1-.8-.8V9.1a.8.8 0 0 1 .8-.8Zm5.7-4.5H19a.8.8 0 0 1 .8.8v14.9a.8.8 0 0 1-.8.8h-2.6a.8.8 0 0 1-.8-.8V4.6a.8.8 0 0 1 .8-.8Z" fill="currentColor"/>
  </svg>;
}

export function FriendsIcon() {
  return <svg viewBox="0 0 24 24" className="nav-icon" aria-hidden>
    <circle cx="9.2" cy="8.4" r="3.7" fill="currentColor"/>
    <path d="M2.7 19.6c0-3.4 3-5.4 6.5-5.4s6.5 2 6.5 5.4a.9.9 0 0 1-.9.9H3.6a.9.9 0 0 1-.9-.9Z" fill="currentColor"/>
    <circle cx="17.6" cy="9.4" r="2.7" fill="currentColor" opacity="0.5"/>
    <path d="M17.2 14.4c2.6.2 4.3 1.8 4.3 4.2a.9.9 0 0 1-.9.9h-3c.2-.4.3-.9.3-1.4 0-1.5-.6-2.7-1.5-3.7Z" fill="currentColor" opacity="0.5"/>
  </svg>;
}

export function PersonIcon() {
  return <svg viewBox="0 0 24 24" className="nav-icon" aria-hidden>
    <circle cx="12" cy="8.2" r="4.1" fill="currentColor"/>
    <path d="M4.3 20.3c0-4 3.5-6.2 7.7-6.2s7.7 2.2 7.7 6.2a.9.9 0 0 1-.9.9H5.2a.9.9 0 0 1-.9-.9Z" fill="currentColor"/>
  </svg>;
}

export function CutleryIcon({size=24}:{size?:number}) {
  return <svg viewBox="0 0 24 24" width={size} height={size} className="icon" aria-hidden>
    <path d="M6.4 3.2v7.2a2.6 2.6 0 0 0 2.6 2.6v7.8h1.8v-7.8a2.6 2.6 0 0 0 2.6-2.6V3.2h-1.6v6.4h-1.2V3.2H9v6.4H7.8V3.2Zm11.2 0c-1.7 1-2.6 3.1-2.6 5.8 0 2.1.6 3.4 1.8 3.9v7.9h1.8V3.2Z" fill="#58cc72"/>
  </svg>;
}

export function ShoeIcon({size=24}:{size?:number}) {
  return <svg viewBox="0 0 24 24" width={size} height={size} className="icon" aria-hidden>
    <path d="M3 15.6c1.9-.7 3.2-1.6 4.4-2.8l3.4 1.2 7.3 2.2a2.4 2.4 0 0 1 1.7 2.3v.5H3.6a.6.6 0 0 1-.6-.6Z" fill="#4a90d9"/>
    <path d="M7.4 12.8c1-1.1 1.6-2.3 2.2-3.6l3.1 1.5-1.9 3.3Z" fill="#7bb6ea"/>
  </svg>;
}

export function DumbbellIcon({size=32}:{size?:number}) {
  return <svg viewBox="0 0 24 24" width={size} height={size} className="icon" aria-hidden>
    <path d="M3.4 9.6h1.8v4.8H3.4a.8.8 0 0 1-.8-.8v-3.2a.8.8 0 0 1 .8-.8Zm3.2-1.4h2v7.6h-2Zm3.2 2.2h4.4v3.2H9.8Zm5.6-2.2h2v7.6h-2Zm3.4 1.4h1.8a.8.8 0 0 1 .8.8v3.2a.8.8 0 0 1-.8.8h-1.8Z" fill="currentColor"/>
  </svg>;
}
