'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ConnectionMode, DTCRecord, PIDDefinition } from '@/types/obd';
import type { OBDTransport } from '@/lib/transports/transport';
import { SimulatorTransport } from '@/lib/transports/simulator';
import { WebBluetoothTransport } from '@/lib/transports/bluetooth';
import { WifiTransport } from '@/lib/transports/wifi';
import { ELM327Driver } from '@/lib/elm327';
import { DiagnosticProtocol } from '@/lib/diagnostic';
import { loadPreference, savePreference } from '@/lib/indexed-db';

type Language = 'en' | 'fa';
type View = 'dashboard' | 'diagnostics' | 'live' | 'garage' | 'settings';
type Theme = 'minimal' | 'professional' | 'sport';
type DashboardMode = 'focus' | 'dual' | 'grid';
const tr = {
  en: { dashboard:'Dashboard', diagnostics:'Diagnostics', live:'Live data', garage:'Garage', settings:'Settings', connected:'Simulator connected', headline:'Your car, at a glance.', sub:'Live vehicle data', updated:'Updated just now · Demo vehicle', add:'Add widget', supported:'Not Supported by Vehicle', health:'Everything looks normal', engineHealth:'Engine health', healthy:'Healthy', fuel:'Fuel system', trim:'Fuel trim', stored:'Stored errors', pending:'Pending errors', read:'Read codes', clear:'Clear errors', noCodes:'No diagnostic codes found', possible:'Possible causes', severity:'Severity', connect:'Connect adapter', disconnect:'Disconnect', readonly:'Safe • Read only', clearTitle:'Clear diagnostic codes?', clearWarning:'Clearing errors does not repair the problem. It only resets stored codes.', cancel:'Cancel', confirm:'Clear codes', appearance:'Appearance', language:'Language', theme:'Dashboard theme', widgetHelp:'Choose the parameters you want to see. Unsupported data is never displayed as zero.', about:'Vehicle capability', capability:'MultiGauge scans the ECU and only polls parameters reported by the vehicle.', search:'Search parameters…', all:'All', install:'Installable PWA · Offline database ready' },
  fa: { dashboard:'داشبورد', diagnostics:'عیب‌یابی', live:'داده زنده', garage:'گاراژ', settings:'تنظیمات', connected:'شبیه‌ساز متصل است', headline:'خودروی شما، در یک نگاه.', sub:'داده‌های زنده خودرو', updated:'همین حالا به‌روزرسانی شد · خودروی آزمایشی', add:'افزودن ویجت', supported:'توسط خودرو پشتیبانی نمی‌شود', health:'همه‌چیز عادی به نظر می‌رسد', engineHealth:'سلامت موتور', healthy:'سالم', fuel:'سیستم سوخت', trim:'اصلاح سوخت', stored:'خطاهای ذخیره‌شده', pending:'خطاهای در انتظار', read:'خواندن خطاها', clear:'پاک کردن خطاها', noCodes:'هیچ کد خطایی پیدا نشد', possible:'علت‌های احتمالی', severity:'شدت', connect:'اتصال آداپتور', disconnect:'قطع اتصال', readonly:'ایمن • فقط خواندنی', clearTitle:'کدهای خطا پاک شوند؟', clearWarning:'پاک کردن خطاها مشکل را تعمیر نمی‌کند؛ فقط کدهای ذخیره‌شده را بازنشانی می‌کند.', cancel:'انصراف', confirm:'پاک کردن کدها', appearance:'ظاهر', language:'زبان', theme:'پوسته داشبورد', widgetHelp:'پارامترهای موردنظر را انتخاب کنید. داده پشتیبانی‌نشده هرگز به‌صورت صفر نمایش داده نمی‌شود.', about:'قابلیت‌های خودرو', capability:'MultiGauge ابتدا ECU را بررسی می‌کند و فقط پارامترهای اعلام‌شده توسط خودرو را می‌خواند.', search:'جستجوی پارامتر…', all:'همه', install:'PWA قابل نصب · پایگاه داده آفلاین آماده' },
};
const tones = ['cyan','blue','orange','violet','pink','green'];

export default function Home() {
  const [language,setLanguage] = useState<Language>('en');
  const [view,setView] = useState<View>('dashboard');
  const [theme,setTheme] = useState<Theme>('professional');
  const [pids,setPids] = useState<PIDDefinition[]>([]);
  const [catalog,setCatalog] = useState<DTCRecord[]>([]);
  const [readings,setReadings] = useState<Record<string,number|null>>({});
  const [visible,setVisible] = useState<string[]>(['rpm','speed','coolant','engineLoad']);
  const [unsupported] = useState<string[]>(['maf']);
  const [codes,setCodes] = useState<DTCRecord[]>([]);
  const [connected,setConnected] = useState(false);
  const [connectionOpen,setConnectionOpen] = useState(false);
  const [widgetOpen,setWidgetOpen] = useState(false);
  const [clearOpen,setClearOpen] = useState(false);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const [search,setSearch] = useState('');
  const protocol = useRef<DiagnosticProtocol | undefined>(undefined);
  const transport = useRef<OBDTransport | undefined>(undefined);
  const text = tr[language];

  useEffect(() => {
    const base = import.meta.env.BASE_URL ?? '/';
    Promise.all([fetch(`${base}database/standard_pid.json`).then((r)=>r.json() as Promise<PIDDefinition[]>),fetch(`${base}database/dtc_codes.json`).then((r)=>r.json() as Promise<DTCRecord[]>),loadPreference<Language>('language','en'),loadPreference<Theme>('theme','professional'),loadPreference<string[]>('visible',['rpm','speed','coolant','engineLoad'])]).then(([pidData,dtcData,savedLanguage,savedTheme,savedVisible])=>{setPids(pidData);setCatalog(dtcData);setLanguage(savedLanguage);setTheme(savedTheme);setVisible(savedVisible);});
    navigator.serviceWorker?.register(`${base}sw.js`,{scope:base}).catch(()=>undefined);
  },[]);

  const connect = useCallback(async (mode:ConnectionMode) => {
    setBusy(true);setMessage('');
    try {
      const next:OBDTransport = mode==='simulator'?new SimulatorTransport():mode==='bluetooth'?new WebBluetoothTransport():new WifiTransport();
      await next.connect(); const driver = new ELM327Driver(next); await driver.initialize();
      transport.current=next;protocol.current=new DiagnosticProtocol(driver);setConnected(true);setConnectionOpen(false);
    } catch(error) { setMessage(error instanceof Error?error.message:'Connection failed'); }
    finally { setBusy(false); }
  },[]);

  useEffect(()=>{ if(pids.length && !connected) void connect('simulator'); },[pids,connected,connect]);
  useEffect(()=>{ if(!connected||!protocol.current||!pids.length)return; let active=true; const poll=async()=>{ const target=pids.filter((pid)=>!unsupported.includes(pid.id)); const results=await Promise.all(target.map(async(pid)=>[pid.id,await protocol.current!.readPID(pid).catch(()=>null)] as const)); if(active)setReadings((old)=>({...old,...Object.fromEntries(results)})); }; void poll(); const timer=window.setInterval(poll,1200);return()=>{active=false;window.clearInterval(timer)}; },[connected,pids,unsupported]);

  const changeLanguage=(next:Language)=>{setLanguage(next);void savePreference('language',next)};
  const changeTheme=(next:Theme)=>{setTheme(next);void savePreference('theme',next)};
  const toggleWidget=(id:string)=>{const next=visible.includes(id)?visible.filter((item)=>item!==id):[...visible,id];setVisible(next);void savePreference('visible',next)};
  const readCodes=async()=>{if(!protocol.current)return;setBusy(true);const [stored,pending]=await Promise.all([protocol.current.readCodes('stored',catalog),protocol.current.readCodes('pending',catalog)]);setCodes([...stored,...pending]);setBusy(false)};
  const clearCodes=async()=>{if(!protocol.current)return;setBusy(true);await protocol.current.clearCodes();setCodes([]);setClearOpen(false);setBusy(false)};
  const nav=(next:View)=>{setView(next);setSearch('')};

  return <main className={`app-shell theme-${theme}`} dir={language==='fa'?'rtl':'ltr'}>
    <header className="topbar"><button className="brand-mark" onClick={()=>nav('dashboard')} aria-label="MultiGauge home"><span>MG</span></button><div className="brand-copy"><strong>MultiGauge</strong><span>OBD UNIVERSAL</span></div><button className={`connection-pill ${connected?'':'offline'}`} onClick={()=>setConnectionOpen(true)}><i/>{connected?text.connected:text.connect}</button><button className="language" onClick={()=>changeLanguage(language==='en'?'fa':'en')}>{language==='en'?'فا':'EN'}</button><button className="avatar" onClick={()=>nav('settings')}>AM</button></header>
    <aside className="sidebar"><Navigation view={view} nav={nav} text={text}/><div className="sidebar-bottom"><button className={`nav-item ${view==='settings'?'active':''}`} onClick={()=>nav('settings')}><span>⚙</span>{text.settings}</button><button className="adapter-card" onClick={()=>setConnectionOpen(true)}><span>ELM327</span><strong>{connected?text.connected:text.connect}</strong><small>{text.readonly}</small></button></div></aside>
    <section className="content">
      {view==='dashboard'&&<Dashboard pids={pids} visible={visible} unsupported={unsupported} readings={readings} text={text} language={language} connected={connected} onAdd={()=>setWidgetOpen(true)} onRemove={toggleWidget}/>} 
      {view==='diagnostics'&&<Diagnostics codes={codes} text={text} language={language} busy={busy} onRead={readCodes} onClear={()=>setClearOpen(true)}/>} 
      {view==='live'&&<LiveData pids={pids} readings={readings} unsupported={unsupported} text={text} language={language} search={search} setSearch={setSearch}/>} 
      {view==='garage'&&<Garage text={text} language={language}/>} 
      {view==='settings'&&<Settings text={text} language={language} theme={theme} changeLanguage={changeLanguage} changeTheme={changeTheme}/>} 
    </section>
    <nav className="mobile-nav"><button className={view==='dashboard'?'active':''} onClick={()=>nav('dashboard')}>⌁<span>{text.dashboard}</span></button><button className={view==='diagnostics'?'active':''} onClick={()=>nav('diagnostics')}>⌕<span>{text.diagnostics}</span></button><button className={view==='live'?'active':''} onClick={()=>nav('live')}>◫<span>{text.live}</span></button><button className={view==='settings'?'active':''} onClick={()=>nav('settings')}>⚙<span>{text.settings}</span></button></nav>
    {connectionOpen&&<Modal title={text.connect} close={()=>setConnectionOpen(false)}><div className="connection-options"><button onClick={()=>connect('bluetooth')} disabled={busy}><b>ᛒ</b><span>Web Bluetooth<small>ELM327 BLE adapters</small></span></button><button onClick={()=>connect('wifi')} disabled={busy}><b>⌁</b><span>WiFi adapter<small>192.168.0.10:35000</small></span></button><button onClick={()=>connect('simulator')} disabled={busy}><b>▶</b><span>Simulator<small>Safe testing, no car required</small></span></button></div>{message&&<p className="error-message">{message}</p>}</Modal>}
    {widgetOpen&&<Modal title={text.add} close={()=>setWidgetOpen(false)}><p className="modal-help">{text.widgetHelp}</p><div className="widget-list">{pids.map((pid)=><label key={pid.id}><input type="checkbox" checked={visible.includes(pid.id)} onChange={()=>toggleWidget(pid.id)}/><span><b>{language==='fa'?pid.persianName:pid.englishName}</b><small>{pid.unit} · PID {pid.pid||'ELM'}</small></span></label>)}</div></Modal>}
    {clearOpen&&<Modal title={text.clearTitle} close={()=>setClearOpen(false)}><div className="warning-box"><b>!</b><p>{text.clearWarning}</p></div><div className="modal-actions"><button onClick={()=>setClearOpen(false)}>{text.cancel}</button><button className="danger" onClick={clearCodes} disabled={busy}>{text.confirm}</button></div></Modal>}
  </main>;
}

function Navigation({view,nav,text}:{view:View;nav:(v:View)=>void;text:typeof tr.en}){return <nav>{([{id:'dashboard',icon:'⌁'},{id:'diagnostics',icon:'⌕'},{id:'live',icon:'◫'},{id:'garage',icon:'▰'}] as {id:View;icon:string}[]).map((item)=><button key={item.id} className={`nav-item ${view===item.id?'active':''}`} onClick={()=>nav(item.id)}><span>{item.icon}</span>{text[item.id]}</button>)}</nav>}

function Dashboard({pids,visible,unsupported,readings,text,language,connected,onAdd,onRemove}:{pids:PIDDefinition[];visible:string[];unsupported:string[];readings:Record<string,number|null>;text:typeof tr.en;language:Language;connected:boolean;onAdd:()=>void;onRemove:(id:string)=>void}) {
  const defaults = ['speed','rpm','coolant','engineLoad','throttle','map','battery','intakeAir','shortFuelTrim'];
  const [mode,setMode] = useState<DashboardMode>('focus');
  const [editing,setEditing] = useState(false);
  const [slots,setSlots] = useState(defaults);
  const [activeSlot,setActiveSlot] = useState<number|null>(null);
  const holdTimer = useRef<number|null>(null);

  useEffect(()=>{loadPreference<DashboardMode>('dashboardMode','focus').then(setMode);loadPreference<string[]>('dashboardSlots',defaults).then((saved)=>setSlots(saved.length>=9?saved:defaults));},[]);
  const changeMode=(next:DashboardMode)=>{setMode(next);void savePreference('dashboardMode',next)};
  const beginHold=(event:React.PointerEvent)=>{if(editing||(event.target as HTMLElement).closest('button'))return;holdTimer.current=window.setTimeout(()=>{setEditing(true);navigator.vibrate?.(35)},560)};
  const cancelHold=()=>{if(holdTimer.current!==null)window.clearTimeout(holdTimer.current);holdTimer.current=null};
  const pidAt=(slot:number)=>pids.find((pid)=>pid.id===slots[slot]);
  const setSlot=(pidId:string)=>{if(activeSlot===null)return;const next=[...slots];next[activeSlot]=pidId;setSlots(next);void savePreference('dashboardSlots',next);setActiveSlot(null)};
  const progress=(slot:number)=>{const pid=pidAt(slot);const value=pid?readings[pid.id]:null;return pid&&value!=null?Math.max(0,Math.min(100,((value-pid.min)/(pid.max-pid.min))*100)):0};
  const slotProps=(slot:number)=>({pid:pidAt(slot),value:pidAt(slot)?readings[pidAt(slot)!.id]:null,language,editing,onEdit:()=>setActiveSlot(slot)});
  const shiftLevel=Math.max(0,Math.min(10,Math.round((readings.rpm??0)/700)));
  return <>
    <div className="dash-compact-head">
      <div><span className={`drive-dot ${connected?'online':''}`}/><b>{connected?text.connected:'Offline'}</b></div>
      <div className="dash-tools">
        <div className="mode-switcher" aria-label={language==='fa'?'انتخاب نما':'Choose dashboard view'}>
          <button className={mode==='focus'?'active':''} onClick={()=>changeMode('focus')} title="Focus">◉</button>
          <button className={mode==='dual'?'active':''} onClick={()=>changeMode('dual')} title="Dual">◐</button>
          <button className={mode==='grid'?'active':''} onClick={()=>changeMode('grid')} title="Grid">▦</button>
        </div>
        <button className={editing?'done-editing':'edit-dash'} onClick={()=>setEditing((value)=>!value)}>{editing?(language==='fa'?'تمام':'Done'):`✦ ${language==='fa'?'ویرایش':'Edit'}`}</button>
      </div>
    </div>
    {editing&&<div className="edit-banner"><span>✦</span><b>{language==='fa'?'حالت ویرایش فعال است':'Edit mode'}</b><small>{language==='fa'?'برای تغییر هر بخش، روی آن بزنید':'Tap any value to replace it'}</small></div>}
    <section className={`drive-surface mode-${mode} ${editing?'is-editing':''}`} aria-label={text.dashboard} onPointerDown={beginHold} onPointerUp={cancelHold} onPointerCancel={cancelHold} onPointerLeave={cancelHold} onContextMenu={(event)=>event.preventDefault()}>
      <div className="cluster-bezel" aria-hidden="true"><i/><i/><i/><i/></div>
      <div className="shift-lights" aria-hidden="true">{Array.from({length:10},(_,index)=><i key={index} className={index<shiftLevel?'lit':''}/>)}</div>
      {mode==='focus'&&<>
        <FocusSecondary {...slotProps(2)} side="left" progress={progress(2)}/>
        <EditableMetric {...slotProps(0)} className="focus-center">
          <ScaleMarks/>
          <span className="focus-label">{metricName(pidAt(0),language)}</span>
          <strong>{formatMetric(pidAt(0),readings)}</strong><small>{pidAt(0)?.unit}</small>
          <i className="focus-needle" style={{transform:`translateX(-50%) rotate(${-125+progress(0)*2.5}deg)`}}/>
          <i className="needle-hub"/>
          <div className="rpm-arc" style={{'--rpm':`${progress(1)*2.8}deg`} as React.CSSProperties}><span>{formatMetric(pidAt(1),readings)} {pidAt(1)?.unit}</span></div>
        </EditableMetric>
        <FocusSecondary {...slotProps(3)} side="right" progress={progress(3)}/>
        <div className="focus-strip">{[4,5,6,7].map((slot)=><CompactMetric key={slot} {...slotProps(slot)}/>)}</div>
      </>}
      {mode==='dual'&&<div className="dual-layout">
        <DualGauge {...slotProps(0)} progress={progress(0)} tone="blue"/>
        <DualGauge {...slotProps(1)} progress={progress(1)} tone="red"/>
        <div className="dual-strip">{[2,3,4,5].map((slot)=><CompactMetric key={slot} {...slotProps(slot)}/>)}</div>
      </div>}
      {mode==='grid'&&<div className="digital-grid">{[0,1,2,3,4,5,6,7,8].map((slot)=><CompactMetric key={slot} {...slotProps(slot)} large/>)}</div>}
      <div className="cluster-signature" aria-hidden="true">MULTIGAUGE <span>OBD II</span></div>
      {!editing&&<div className="touch-hint">{language==='fa'?'برای ویرایش لمس طولانی کنید':'Touch and hold to edit'}</div>}
    </section>
    {activeSlot!==null&&<Modal title={language==='fa'?'انتخاب پارامتر':'Choose a parameter'} close={()=>setActiveSlot(null)}><div className="pid-picker">{pids.filter((pid)=>!unsupported.includes(pid.id)).map((pid)=><button key={pid.id} className={slots[activeSlot]===pid.id?'selected':''} onClick={()=>setSlot(pid.id)}><span><b>{metricName(pid,language)}</b><small>{pid.category}</small></span><strong>{pid.unit}</strong></button>)}</div></Modal>}
  </>
}
function EditableMetric({editing,onEdit,className='',children}:{editing:boolean;onEdit:()=>void;className?:string;children:React.ReactNode}){return <div className={`${className} editable-metric`} role={editing?'button':undefined} tabIndex={editing?0:-1} onClick={()=>editing&&onEdit()} onKeyDown={(event)=>{if(editing&&(event.key==='Enter'||event.key===' '))onEdit()}}>{children}{editing&&<span className="replace-badge">↻</span>}</div>}
function FocusSecondary({pid,value,language,editing,onEdit,side,progress}:{pid?:PIDDefinition;value:number|null|undefined;language:Language;editing:boolean;onEdit:()=>void;side:'left'|'right';progress:number}){return <EditableMetric editing={editing} onEdit={onEdit} className={`focus-secondary ${side}`}><span>{metricName(pid,language)}</span><strong>{format(value,pid?.id==='rpm'?0:1)}<small>{pid?.unit}</small></strong><i><em style={{height:`${Math.max(5,progress)}%`}}/></i></EditableMetric>}
function CompactMetric({pid,value,language,editing,onEdit,large=false}:{pid?:PIDDefinition;value:number|null|undefined;language:Language;editing:boolean;onEdit:()=>void;large?:boolean}){return <EditableMetric editing={editing} onEdit={onEdit} className={`compact-metric ${large?'large':''}`}><span>{metricName(pid,language)}</span><strong>{format(value,pid?.id==='rpm'?0:1)}<small>{pid?.unit}</small></strong></EditableMetric>}
function DualGauge({pid,value,language,editing,onEdit,progress,tone}:{pid?:PIDDefinition;value:number|null|undefined;language:Language;editing:boolean;onEdit:()=>void;progress:number;tone:'blue'|'red'}){return <EditableMetric editing={editing} onEdit={onEdit} className={`dual-gauge ${tone}`}><div className="dual-ring" style={{'--value':`${progress*3.2}deg`} as React.CSSProperties}><ScaleMarks compact/><div><span>{metricName(pid,language)}</span><strong>{format(value,pid?.id==='rpm'?0:1)}</strong><small>{pid?.unit}</small></div><i className="dual-needle" style={{transform:`translateX(-50%) rotate(${-125+progress*2.5}deg)`}}/></div></EditableMetric>}
function ScaleMarks({compact=false}:{compact?:boolean}){return <div className={`scale-marks ${compact?'compact':''}`} aria-hidden="true">{Array.from({length:36},(_,index)=><i key={index} style={{transform:`rotate(${-126+index*7.2}deg)`}}/>)}{[0,1,2,3,4,5,6,7,8].map((value,index)=><b key={value} style={{'--angle':`${-125+index*31.25}deg`} as React.CSSProperties}><span>{value}</span></b>)}</div>}
function metricName(pid:PIDDefinition|undefined,language:Language){if(!pid)return '—';return language==='fa'?pid.persianName:pid.englishName}
function formatMetric(pid:PIDDefinition|undefined,readings:Record<string,number|null>){return pid?format(readings[pid.id],pid.id==='rpm'?0:1):'—'}
function Gauge({pid,value,unsupported,language,tone,onRemove,text}:{pid:PIDDefinition;value:number|null|undefined;unsupported:boolean;language:Language;tone:string;onRemove:()=>void;text:typeof tr.en}){const progress=value==null?0:Math.max(4,Math.min(96,((value-pid.min)/(pid.max-pid.min))*100));return <article className={`gauge-card ${tone} ${unsupported?'unsupported':''}`}><div className="gauge-label"><span>{language==='fa'?pid.persianName:pid.englishName}</span><button onClick={onRemove} aria-label="Remove widget">×</button></div>{unsupported?<div className="not-supported"><b>—</b><span>{text.supported}</span></div>:<div className="dial" style={{'--progress':`${progress*3.6}deg`} as React.CSSProperties}><div><strong>{format(value,pid.id==='rpm'?0:1)}</strong><span>{pid.unit}</span></div></div>}<div className="gauge-foot"><span>{pid.min}</span><b>{pid.name.toUpperCase()}</b><span>{pid.max}</span></div></article>}
const Metric=({label,value,unit}:{label:string;value:string;unit:string})=><div><span>{label}</span><strong>{value}<small>{unit}</small></strong></div>;
const Trim=({label,value}:{label:string;value:number|null|undefined})=><div><span>{label}</span><strong>{value==null?'—':`${value>=0?'+':''}${value.toFixed(1)}%`}</strong><i><em style={{width:`${Math.max(3,Math.min(97,50+(value??0)*3))}%`}}/></i></div>;

function Diagnostics({codes,text,language,busy,onRead,onClear}:{codes:DTCRecord[];text:typeof tr.en;language:Language;busy:boolean;onRead:()=>void;onClear:()=>void}){return <><PageTitle eyebrow="OBD-II" title={text.diagnostics} subtitle={language==='fa'?'کدهای خطا را به زبان ساده بررسی کنید.':'Understand warning lights in plain language.'}/><div className="diagnostic-actions"><button className="primary-action" onClick={onRead} disabled={busy}>⌕ {busy?'…':text.read}</button><button className="danger-outline" onClick={onClear} disabled={!codes.length}>⌫ {text.clear}</button></div><div className="safety-note"><b>i</b><span>{text.clearWarning}</span></div>{!codes.length?<div className="empty-state"><span>✓</span><h2>{text.noCodes}</h2><p>{language==='fa'?'برای بررسی ECU دکمه خواندن خطاها را بزنید.':'Run a scan to check stored and pending ECU codes.'}</p></div>:<div className="dtc-list">{codes.map((code,index)=><article key={`${code.code}-${index}`}><div className="dtc-code"><strong>{code.code}</strong><span className={`severity ${code.severity}`}>{text.severity}: {code.severity}</span><small>{code.status==='pending'?text.pending:text.stored}</small></div><div><h2>{language==='fa'?code.persianDescription:code.englishDescription}</h2><p>{text.possible}</p><ul>{code.possibleCauses.map((cause)=><li key={cause.en}>{language==='fa'?cause.fa:cause.en}</li>)}</ul></div></article>)}</div>}</>}

function LiveData({pids,readings,unsupported,text,language,search,setSearch}:{pids:PIDDefinition[];readings:Record<string,number|null>;unsupported:string[];text:typeof tr.en;language:Language;search:string;setSearch:(v:string)=>void}){const filtered=useMemo(()=>pids.filter((pid)=>`${pid.englishName} ${pid.persianName} ${pid.name}`.toLowerCase().includes(search.toLowerCase())),[pids,search]);return <><PageTitle eyebrow="PID ENGINE" title={text.live} subtitle={text.capability}/><input className="search-box" value={search} onChange={(event)=>setSearch(event.target.value)} placeholder={text.search}/><div className="data-table"><div className="table-head"><span>{language==='fa'?'پارامتر':'Parameter'}</span><span>PID</span><span>{language==='fa'?'مقدار':'Value'}</span></div>{filtered.map((pid)=><div className="table-row" key={pid.id}><span><b>{language==='fa'?pid.persianName:pid.englishName}</b><small>{pid.category}</small></span><code>01 {pid.pid}</code><strong className={unsupported.includes(pid.id)?'not':''}>{unsupported.includes(pid.id)?text.supported:`${format(readings[pid.id],1)} ${pid.unit}`}</strong></div>)}</div></>}
function Garage({text,language}:{text:typeof tr.en;language:Language}){return <><PageTitle eyebrow="VEHICLE PROFILE" title={text.garage} subtitle={text.capability}/><article className="vehicle-card"><div className="vehicle-visual">MG</div><div><span>{language==='fa'?'پروفایل فعال':'ACTIVE PROFILE'}</span><h2>{language==='fa'?'خودروی OBD-II عمومی':'Generic OBD-II vehicle'}</h2><p>{language==='fa'?'تشخیص خودکار پروتکل و قابلیت‌ها':'Automatic protocol and capability detection'}</p></div><dl><div><dt>Protocol</dt><dd>ISO 15765-4 CAN</dd></div><div><dt>Adapter</dt><dd>ELM327 Simulator</dd></div><div><dt>Mode</dt><dd>{text.readonly}</dd></div></dl></article><article className="capability-card"><b>✓</b><div><h2>{text.about}</h2><p>{text.capability}</p></div></article></>}
function Settings({text,language,theme,changeLanguage,changeTheme}:{text:typeof tr.en;language:Language;theme:Theme;changeLanguage:(l:Language)=>void;changeTheme:(t:Theme)=>void}){return <><PageTitle eyebrow="MULTIGAUGE" title={text.settings} subtitle={text.install}/><div className="settings-grid"><section className="settings-card"><h2>{text.language}</h2><div className="segmented"><button className={language==='en'?'selected':''} onClick={()=>changeLanguage('en')}>English</button><button className={language==='fa'?'selected':''} onClick={()=>changeLanguage('fa')}>فارسی</button></div></section><section className="settings-card"><h2>{text.theme}</h2><div className="theme-picker">{(['minimal','professional','sport'] as Theme[]).map((item)=><button key={item} className={theme===item?'selected':''} onClick={()=>changeTheme(item)}><i className={item}/><span>{item}</span></button>)}</div></section><section className="settings-card full"><h2>{language==='fa'?'ایمنی':'Safety'}</h2><p>{language==='fa'?'حالت پیش‌فرض فقط خواندنی است. ارسال خام CAN، کدنویسی ECU و تست عملگرها در این برنامه غیرفعال هستند.':'The default mode is read-only. Raw CAN transmission, ECU coding, and actuator tests are intentionally unavailable.'}</p><span className="safe-badge">✓ {text.readonly}</span></section></div></>}
function PageTitle({eyebrow,title,subtitle}:{eyebrow:string;title:string;subtitle:string}){return <div className="page-heading inner"><div><p>{eyebrow}</p><h1>{title}</h1><span>{subtitle}</span></div></div>}
function Modal({title,close,children}:{title:string;close:()=>void;children:React.ReactNode}){return <div className="modal-backdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true"><header><h2>{title}</h2><button onClick={close} aria-label="Close">×</button></header>{children}</section></div>}
function format(value:number|null|undefined,digits:number){return value==null?'—':value.toFixed(digits)}
