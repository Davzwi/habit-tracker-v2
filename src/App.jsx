import React, { useEffect, useMemo, useState } from "react";

/* ====== Helpers ====== */
const ICONS = ["⏰","💪","🧘","📚","🧹","💧","🍎","💼","🧠","🛒","🚿","🛌","✍️","📖","🚶","🏃","💻","📱"];
const COLORS = ["#FF7E7E","#FFD34F","#69DB7C","#7EB3FF","#B197FC","#FFA94D","#63E6BE","#FF8787","#FAB005"];
const STORAGE = "planner_tasks_v1";

const monthLabels = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
const wdShort = new Intl.DateTimeFormat("de-DE",{weekday:"short"});

const daysInMonth = (y,m)=> new Date(y, m+1, 0).getDate();
const iso = (d)=> d.toISOString().slice(0,10);
const addMin = (hm, mins) => {
  const [h,m]=hm.split(":").map(Number);
  const d=new Date(0,0,0,h,m+mins);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
};
const sameYMD=(a,b)=> a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();

/* ====== App ====== */
export default function App(){
  /* Status / Tabs */
  const [timeStr, setTimeStr] = useState(() => {
    const n = new Date(); return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;
  });
  useEffect(()=>{ const t=setInterval(()=> {
    const n=new Date(); setTimeStr(`${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`);
  }, 1000); return ()=>clearInterval(t); },[]);

  const [tab, setTab] = useState("planner");

  /* Kalender/Datum */
  const [current, setCurrent] = useState(new Date());   // Cursor (Monat/Jahr)
  const [selected, setSelected] = useState(new Date()); // ausgewählter Tag

  /* Tasks/Habits */
  const [tasks, setTasks] = useState(()=>{
    try { return JSON.parse(localStorage.getItem(STORAGE) || "[]"); } catch { return []; }
  });
  useEffect(()=> localStorage.setItem(STORAGE, JSON.stringify(tasks)), [tasks]);

  /* Modal */
  const [editing, setEditing] = useState(null); // taskId | null
  const [modalOpen, setModalOpen] = useState(false);

  /* Filter für gewählten Tag */
  const selectedISO = iso(selected);
  const itemsForDay = useMemo(()=>{
    const showForDate = (t, isoStr)=>{
      if(t.date===isoStr) return true;
      if(t.repeat==="daily") return true;
      if(t.repeat==="weekdays"){ const wd=(new Date(isoStr)).getDay(); return wd>=1&&wd<=5; }
      if(t.repeat==="custom" && Array.isArray(t.days)){ const wd=(new Date(isoStr)).getDay(); return t.days.includes(wd); }
      return false;
    };
    return [...tasks.filter(t=>showForDate(t, selectedISO))]
      .sort((a,b)=> a.start.localeCompare(b.start));
  }, [tasks, selectedISO]);

  /* UI helpers */
  const now = new Date();
  const nowISO = iso(now);
  const nowHM = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  const labelRepeat = (t)=>{
    if(t.repeat==="daily") return "täglich";
    if(t.repeat==="weekdays") return "Mo–Fr";
    if(t.repeat==="custom"){ const map=["So","Mo","Di","Mi","Do","Fr","Sa"]; return (t.days||[]).map(i=>map[i]).join(","); }
    return "";
  };

  /* Kalenderleisten */
  const onYear = (dir)=>{ const d=new Date(current); d.setFullYear(d.getFullYear()+dir); setCurrent(d); const sel=new Date(selected); sel.setFullYear(d.getFullYear()); setSelected(sel); };
  const onMonth = (m)=>{ const d=new Date(current); d.setMonth(m); setCurrent(d); const sel=new Date(selected); sel.setMonth(m); sel.setDate(Math.min(sel.getDate(), daysInMonth(sel.getFullYear(), m))); setSelected(sel); };
  const onDay = (d)=>{ const sel=new Date(selected); sel.setDate(d); setSelected(sel); };

  /* Actions */
  const toggleDone = (id, dayISO)=>{
    setTasks(t=> t.map(x=>{
      if(x.id!==id) return x;
      const s=new Set(x.doneDates||[]);
      s.has(dayISO) ? s.delete(dayISO) : s.add(dayISO);
      return {...x, doneDates:[...s]};
    }));
  };

  const openNew = ()=>{ setEditing(null); setModalOpen(true); };
  const openEdit = (id)=>{ setEditing(id); setModalOpen(true); };
  const saveTask = (payload)=>{
    if(editing){
      setTasks(ts => ts.map(t => t.id===editing ? { ...t, ...payload } : t));
    } else {
      setTasks(ts => ts.concat([{ id: crypto.randomUUID(), date: selectedISO, doneDates: [], ...payload }]));
    }
    setModalOpen(false);
  };

  /* Seed (einmalig) */
  useEffect(()=>{
    if(tasks.length) return;
    setTasks([{
      id: crypto.randomUUID(), title:"Aufwachen", start:"07:00", duration:15,
      date: iso(new Date()), repeat:"daily", days:[], type:"habit", icon:"⏰", color:"#FF7E7E", reminder:false, doneDates:[]
    }]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  return (
    <div className="app safe">
      {/* Status */}
      <div className="status">
        <div className="chip">{timeStr}</div>
        <div className="chip">5G</div>
        <div className="chip">83%</div>
      </div>

      {/* Views */}
      <main className="container">
        {tab==="inbox" && <InboxView/>}

        {tab==="planner" && (
          <section id="view-planner" className="view active">
            <CalendarHeader
              current={current}
              selected={selected}
              onYearPrev={()=>onYear(-1)}
              onYearNext={()=>onYear(+1)}
              onMonth={onMonth}
              onDay={onDay}
            />

            <div className="timeline">
              {itemsForDay.length===0 && <div className="empty">Keine Einträge für diesen Tag.</div>}

              {itemsForDay.map(t=>{
                const running = (selectedISO===nowISO && nowHM>=t.start && nowHM<addMin(t.start,t.duration));
                const bg = { bg: (t.color||COLORS[0])+"22", border:(t.color||COLORS[0])+"66" };
                return (
                  <div key={t.id} className="tl-item" onDoubleClick={()=>openEdit(t.id)}>
                    {running && <div className="now"><div className="dot"></div>Jetzt</div>}
                    <div className="time">{t.start}</div>
                    <div className="row">
                      <div className="icon" style={{background:bg.bg, borderColor:bg.border}}>{t.icon || "⏰"}</div>
                      <div>
                        <div className="title">{t.title}</div>
                        <div className="meta">
                          <span>{t.duration} Min.</span>
                          {t.repeat!=="none" && <span>↻ {labelRepeat(t)}</span>}
                        </div>
                      </div>
                    </div>
                    <button
                      className={`check ${t.doneDates?.includes(selectedISO) ? "done" : ""}`}
                      onClick={()=>toggleDone(t.id, selectedISO)}
                    >✓</button>
                  </div>
                );
              })}
            </div>

            <button className="fab" onClick={openNew}>+</button>
          </section>
        )}

        {tab==="challenges" && <ChallengesView/>}
        {tab==="settings" && <SettingsView/>}
      </main>

      {/* Tabs */}
      <div className="tabs safe">
        <div className="tabbar">
          <a className={`tab ${tab==="inbox"?"active":""}`} onClick={()=>setTab("inbox")}><div className="i">📥</div>Inbox</a>
          <a className={`tab ${tab==="planner"?"active":""}`} onClick={()=>setTab("planner")}><div className="i">🧭</div>Planer</a>
          <a className={`tab ${tab==="challenges"?"active":""}`} onClick={()=>setTab("challenges")}><div className="i">🔥</div>Challenges</a>
          <a className={`tab ${tab==="settings"?"active":""}`} onClick={()=>setTab("settings")}><div className="i">⚙️</div>Einstellun...</a>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <Modal
          initial={editing ? tasks.find(t=>t.id===editing) : null}
          onClose={()=>setModalOpen(false)}
          onSave={saveTask}
        />
      )}
    </div>
  );
}

/* ====== Calendar Header ====== */
function CalendarHeader({ current, selected, onYearPrev, onYearNext, onMonth, onDay }){
  const y = current.getFullYear();
  const m = current.getMonth();
  const days = daysInMonth(y, m);
  return (
    <div className="calendar">
      <div className="yearbar">
        <button className="navbtn" onClick={onYearPrev}>‹</button>
        <div className="year">{y}</div>
        <button className="navbtn" onClick={onYearNext}>›</button>
      </div>

      <div className="months">
        {monthLabels.map((lbl, idx)=>(
          <div
            key={lbl}
            className={`mon ${idx===m ? "active":""}`}
            onClick={()=>onMonth(idx)}
          >{lbl}</div>
        ))}
      </div>

      <div className="days">
        {Array.from({length:days},(_,i)=>i+1).map(d=>{
          const dt=new Date(y,m,d);
          return (
            <div
              key={d}
              className={`day ${sameYMD(dt, selected)? "active":""}`}
              onClick={()=>onDay(d)}
            >
              <div className="dow">{wdShort.format(dt)}</div>
              <div className="d">{d}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ====== Modal (Add/Edit) ====== */
function Modal({ initial, onClose, onSave }){
  const [title, setTitle] = useState(initial?.title || "");
  const [start, setStart] = useState(initial?.start || "07:00");
  const [duration, setDuration] = useState(initial?.duration || 30);
  const [repeat, setRepeat] = useState(initial?.repeat || "none");
  const [type, setType] = useState(initial?.type || "task");
  const [reminder, setReminder] = useState(!!initial?.reminder);

  const [selIcon, setSelIcon] = useState(initial?.icon || ICONS[0]);
  const [selColor, setSelColor] = useState(initial?.color || COLORS[0]);
  const [days, setDays] = useState(initial?.repeat==="custom" ? (initial?.days||[]) : []);

  const toggleDay = (idx)=> setDays(d => d.includes(idx) ? d.filter(x=>x!==idx) : d.concat(idx));

  return (
    <div className="modal open" onClick={(e)=>{ if(e.target.classList.contains("modal")) onClose(); }}>
      <div className="sheet">
        <h3>{initial ? "Aufgabe/Habit bearbeiten":"Aufgabe/Habit hinzufügen"}</h3>

        <div className="group">
          <label className="tiny">Titel</label>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="z.B. Aufwachen"/>
        </div>

        <div className="row2">
          <div className="group">
            <label className="tiny">Start</label>
            <input type="time" value={start} onChange={e=>setStart(e.target.value)} />
          </div>
          <div className="group">
            <label className="tiny">Dauer (Min.)</label>
            <input type="number" min={5} step={5} value={duration} onChange={e=>setDuration(Number(e.target.value||30))}/>
          </div>
        </div>

        <div className="row2">
          <div className="group">
            <label className="tiny">Wiederholung</label>
            <select value={repeat} onChange={e=>setRepeat(e.target.value)}>
              <option value="none">Keine</option>
              <option value="daily">Täglich</option>
              <option value="weekdays">Mo–Fr</option>
              <option value="custom">Bestimmte Tage…</option>
            </select>
          </div>
          <div className="group">
            <label className="tiny">Kategorie</label>
            <select value={type} onChange={e=>setType(e.target.value)}>
              <option value="task">Aufgabe</option>
              <option value="habit">Habit</option>
            </select>
          </div>
        </div>

        {repeat==="custom" && (
          <div className="group">
            <label className="tiny">Wochentage</label>
            <div className="icon-row">
              {["So","Mo","Di","Mi","Do","Fr","Sa"].map((w,i)=>(
                <div key={w}
                  className={`icon-dot ${days.includes(i)?"active":""}`}
                  onClick={()=>toggleDay(i)}
                >{w}</div>
              ))}
            </div>
          </div>
        )}

        <div className="group">
          <label className="tiny">Icon & Farbe</label>
          <div className="icon-row">
            {ICONS.map(ic=>(
              <div key={ic}
                className={`icon-dot ${selIcon===ic?"active":""}`}
                onClick={()=>setSelIcon(ic)}
              >{ic}</div>
            ))}
          </div>
          <div className="color-row" style={{marginTop:8}}>
            {COLORS.map(c=>(
              <div key={c}
                className={`color-dot ${selColor===c?"active":""}`}
                style={{background:c}}
                onClick={()=>setSelColor(c)}
              />
            ))}
          </div>
        </div>

        <label className="switch">
          <input type="checkbox" checked={reminder} onChange={e=>setReminder(e.target.checked)}/>
          <div className="knob"></div>
          <span className="tiny">Erinnerung (Demo)</span>
        </label>

        <div className="actions">
          <button className="btn ghost" onClick={onClose}>Abbrechen</button>
          <button className="btn primary" onClick={()=>{
            onSave({
              title: title.trim() || "Neue Aufgabe",
              start, duration, repeat, days, type,
              icon: selIcon, color: selColor, reminder
            });
          }}>Speichern</button>
        </div>
      </div>
    </div>
  );
}

/* ====== Simple placeholder views ====== */
function InboxView(){
  return (
    <section id="view-inbox" className="view active">
      <div className="sheet cardlike">
        <h3>Inbox</h3>
        <div className="tiny">Kurze Notizen sammeln und später in Aufgaben umwandeln.</div>
      </div>
    </section>
  );
}
function ChallengesView(){
  return (
    <section id="view-challenges" className="view active">
      <div className="sheet cardlike">
        <h3>Challenges</h3>
        <div className="tiny">Platzhalter – kann mit Streaks & Ringen erweitert werden.</div>
      </div>
    </section>
  );
}
function SettingsView(){
  return (
    <section id="view-settings" className="view active">
      <div className="sheet cardlike">
        <h3>Einstellungen</h3>
        <div className="tiny">Daten werden lokal (localStorage) gespeichert.</div>
      </div>
    </section>
  );
}