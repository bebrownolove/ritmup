'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Food = { id: string; name: string; calories: number; meal: string };
type Day = { weight: number | null; activity: number; foods: Food[]; closed: boolean };
type Store = { name: string; goal: number; streak: number; days: Record<string, Day> };
type Modal = 'food' | 'weight' | 'activity' | 'finish' | null;

const STORAGE_KEY = 'ritm-v1';
const todayKey = () => new Date().toLocaleDateString('sv-SE');
const blankDay = (): Day => ({ weight: null, activity: 0, foods: [], closed: false });
const initialStore = (): Store => ({ name: 'Лиза', goal: 1700, streak: 0, days: { [todayKey()]: blankDay() } });
const meals = ['Завтрак', 'Обед', 'Ужин', 'Перекус'];

function safeNumber(value: FormDataEntryValue | null) {
  return Number(String(value ?? '').replace(',', '.'));
}

export default function Home() {
  const [store, setStore] = useState<Store>(initialStore);
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [tab, setTab] = useState<'today' | 'history' | 'profile'>('today');
  const key = todayKey();
  const day = store.days[key] ?? blankDay();
  const eaten = day.foods.reduce((sum, food) => sum + food.calories, 0);
  const remaining = store.goal - eaten;
  const progress = Math.min(100, Math.max(0, (eaten / Math.max(store.goal, 1)) * 100));

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const next: Store = saved ? JSON.parse(saved) : initialStore();
      const imported = new URLSearchParams(location.hash.replace(/^#/, '')).get('activity');
      if (imported && Number(imported) >= 0) {
        const current = next.days[todayKey()] ?? blankDay();
        next.days[todayKey()] = { ...current, activity: Math.round(Number(imported)) };
        history.replaceState(null, '', location.pathname + location.search);
      }
      setStore(next);
    } catch { setStore(initialStore()); }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store, ready]);

  const updateDay = (patch: Partial<Day>) => {
    setStore((current) => ({ ...current, days: { ...current.days, [key]: { ...(current.days[key] ?? blankDay()), ...patch } } }));
  };

  const addFood = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const calories = Math.round(safeNumber(data.get('calories')));
    if (!calories || calories < 1) return;
    updateDay({ foods: [...day.foods, { id: crypto.randomUUID(), name: String(data.get('name') || 'Еда'), calories, meal: String(data.get('meal') || 'Перекус') }] });
    setModal(null);
  };

  const saveNumber = (field: 'weight' | 'activity') => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = safeNumber(new FormData(event.currentTarget).get('value'));
    if (!Number.isFinite(value) || value < 0) return;
    updateDay({ [field]: field === 'activity' ? Math.round(value) : Math.round(value * 10) / 10 });
    setModal(null);
  };

  const finishDay = () => {
    updateDay({ closed: true });
    if (!day.closed) setStore((current) => ({ ...current, streak: current.streak + 1, days: { ...current.days, [key]: { ...(current.days[key] ?? blankDay()), closed: true } } }));
    setModal(null);
  };

  const dateLabel = useMemo(() => new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()).toUpperCase(), []);
  const greeting = new Date().getHours() < 12 ? 'Доброе утро' : new Date().getHours() < 18 ? 'Добрый день' : 'Добрый вечер';

  return (
    <main className="app-shell">
      <section className="phone-frame">
        {tab === 'today' && <>
          <header className="topbar"><div><p className="eyebrow">{dateLabel}</p><h1>{greeting}, {store.name}</h1></div><div className="streak" aria-label={`Серия: ${store.streak} дней`}><span>🔥</span><strong>{store.streak}</strong></div></header>
          <section className="balance-card">
            <div className="balance-ring" style={{ '--progress': `${progress}%` } as React.CSSProperties} aria-label={`Съедено ${eaten} из ${store.goal} килокалорий`}><div className="ring-center"><span>{remaining >= 0 ? 'осталось' : 'сверх цели'}</span><strong>{Math.abs(remaining)}</strong><small>ккал</small></div></div>
            <div className="balance-copy"><span className="status-pill">{eaten === 0 ? 'Начнём спокойно' : remaining >= 0 ? 'Ты в своём ритме' : 'Без чувства вины'}</span><h2>Твой баланс</h2><div className="metric-row"><span>Съедено</span><b>{eaten.toLocaleString('ru-RU')}</b></div><div className="metric-row"><span>Активность</span><b className="positive">− {day.activity}</b></div></div>
          </section>
          <button className="primary-action" type="button" onClick={() => setModal('food')}><span className="plus">+</span><span><strong>Добавить еду</strong><small>Займёт пару секунд</small></span><span className="arrow">›</span></button>
          {day.foods.length > 0 && <section className="food-list"><div className="section-heading"><h2>Еда</h2><span>{day.foods.length} {day.foods.length === 1 ? 'запись' : 'записи'}</span></div>{day.foods.slice(-3).reverse().map((food) => <article key={food.id} className="food-row"><span className="food-dot">{food.meal === 'Завтрак' ? '☀️' : food.meal === 'Ужин' ? '🌙' : '🍽️'}</span><div><strong>{food.name}</strong><small>{food.meal}</small></div><b>{food.calories} ккал</b><button aria-label={`Удалить ${food.name}`} onClick={() => updateDay({ foods: day.foods.filter((item) => item.id !== food.id) })}>×</button></article>)}</section>}
          <div className="section-heading today-heading"><h2>Сегодня</h2><span>{[day.weight !== null, day.activity > 0, day.closed].filter(Boolean).length} из 3 готово</span></div>
          <section className="task-grid">
            <button className={`task-card ${day.weight !== null ? 'done' : ''}`} onClick={() => setModal('weight')}><span className="task-icon">⚖️</span>{day.weight !== null && <span className="check">✓</span>}<small>Утренний вес</small><strong>{day.weight !== null ? `${day.weight.toLocaleString('ru-RU')} кг` : 'Записать'}</strong></button>
            <button className={`task-card ${day.activity > 0 ? 'done' : ''}`} onClick={() => setModal('activity')}><span className="task-icon">⚡️</span>{day.activity > 0 && <span className="check">✓</span>}<small>Активность</small><strong>{day.activity ? `${day.activity} ккал` : 'Добавить'}</strong></button>
            <button className={`task-card wide ${day.closed ? 'done' : ''}`} onClick={() => setModal('finish')}><span className="task-icon">{day.closed ? '✨' : '🌙'}</span><div><small>{day.closed ? 'День завершён' : 'Завершить день'}</small><strong>{day.closed ? 'Серия продолжается' : 'Вечером подведём итог'}</strong></div><span className="arrow">›</span></button>
          </section>
        </>}

        {tab === 'history' && <History store={store} />}
        {tab === 'profile' && <Profile store={store} setStore={setStore} />}

        <nav className="tabbar" aria-label="Основная навигация"><button className={tab === 'today' ? 'active' : ''} onClick={() => setTab('today')}><span>●</span>Сегодня</button><button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><span>▥</span>История</button><button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}><span>○</span>Профиль</button></nav>
      </section>
      {modal && <ModalShell title={modal === 'food' ? 'Добавить еду' : modal === 'weight' ? 'Утренний вес' : modal === 'activity' ? 'Активность' : 'Завершить день'} onClose={() => setModal(null)}>
        {modal === 'food' && <form onSubmit={addFood} className="entry-form"><label>Что съела?<input name="name" placeholder="Например, клубника" autoFocus /></label><label>Калории<input name="calories" type="number" min="1" inputMode="numeric" placeholder="150" required /></label><label>Приём пищи<select name="meal">{meals.map((meal) => <option key={meal}>{meal}</option>)}</select></label><button className="submit-button">Добавить</button></form>}
        {modal === 'weight' && <form onSubmit={saveNumber('weight')} className="entry-form"><label>Вес утром, кг<input name="value" type="number" min="20" max="400" step="0.1" inputMode="decimal" defaultValue={day.weight ?? ''} placeholder="64,8" autoFocus required /></label><p className="form-hint">Лучше взвешиваться утром до завтрака.</p><button className="submit-button">Сохранить вес</button></form>}
        {modal === 'activity' && <form onSubmit={saveNumber('activity')} className="entry-form"><label>Активные калории<input name="value" type="number" min="0" inputMode="numeric" defaultValue={day.activity || ''} placeholder="380" autoFocus required /></label><p className="form-hint">Пока можно переписать число из приложения «Фитнес».</p><button className="submit-button">Сохранить</button></form>}
        {modal === 'finish' && <div className="finish-sheet"><div className="finish-emoji">🔥</div><p>Сегодня записано <strong>{eaten} ккал</strong>, активность — <strong>{day.activity} ккал</strong>.</p><button className="submit-button" onClick={finishDay} disabled={day.closed}>{day.closed ? 'Уже готово' : 'Завершить и продолжить серию'}</button></div>}
      </ModalShell>}
    </main>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="sheet" role="dialog" aria-modal="true" aria-label={title}><div className="sheet-handle" /><header><h2>{title}</h2><button onClick={onClose} aria-label="Закрыть">×</button></header>{children}</section></div>;
}

function History({ store }: { store: Store }) {
  const entries = Object.entries(store.days).sort(([a], [b]) => b.localeCompare(a));
  return <section className="inner-page"><p className="eyebrow">ТВОЙ ПРОГРЕСС</p><h1>История</h1><div className="history-hero"><span>🔥</span><div><strong>{store.streak}</strong><small>дней подряд</small></div></div><div className="history-list">{entries.map(([date, day]) => { const total = day.foods.reduce((sum, food) => sum + food.calories, 0); return <article key={date}><time>{new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(`${date}T12:00:00`))}</time><div><strong>{total} ккал</strong><small>{day.weight ? `${day.weight} кг · ` : ''}{day.activity} активных</small></div><span>{day.closed ? '✓' : '•'}</span></article>; })}</div>{entries.length === 0 && <p className="empty-state">Первый день появится здесь после записи.</p>}</section>;
}

function Profile({ store, setStore }: { store: Store; setStore: React.Dispatch<React.SetStateAction<Store>> }) {
  return <section className="inner-page"><p className="eyebrow">НАСТРОЙКИ</p><h1>Твой ритм</h1><div className="profile-avatar">{store.name.slice(0, 1).toUpperCase()}</div><form className="entry-form profile-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); setStore((current) => ({ ...current, name: String(data.get('name') || 'Лиза'), goal: Math.max(1, Math.round(safeNumber(data.get('goal')))) })); }}><label>Имя<input name="name" defaultValue={store.name} /></label><label>Дневная цель, ккал<input name="goal" type="number" min="1" defaultValue={store.goal} /></label><button className="submit-button">Сохранить</button></form><div className="privacy-note"><strong>Данные остаются у тебя</strong><p>Записи хранятся только в этом браузере на этом iPhone.</p></div></section>;
}
