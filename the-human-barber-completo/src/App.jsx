import { useEffect, useState, useCallback } from 'react'
import { supabase, todayLisbon, fmtDate, fmtTime } from './supabase'

const params = new URLSearchParams(location.search)
const MONTHS = d => d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

export default function App() {
  const token = params.get('cancelar')
  return (
    <div className="wrap">
      <h1>THE HUMAN BARBER</h1>
      {token ? <Cancel token={token} /> : params.has('admin') ? <Admin /> : <Book />}
    </div>
  )
}

function Book() {
  const [slots, setSlots] = useState([])
  const [month, setMonth] = useState(() => { const t = new Date(todayLisbon() + 'T12:00:00'); return new Date(t.getFullYear(), t.getMonth(), 1, 12) })
  const [sel, setSel] = useState(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('get_availability')
    setSlots(data || [])
  }, [])
  useEffect(() => {
    load()
    const i = setInterval(load, 8000)
    window.addEventListener('focus', load)
    return () => { clearInterval(i); window.removeEventListener('focus', load) }
  }, [load])

  const byDate = Object.fromEntries(slots.map(s => [s.slot_date, s]))
  const y = month.getFullYear(), m = month.getMonth()
  const lead = (new Date(y, m, 1).getDay() + 6) % 7
  const days = new Date(y, m + 1, 0).getDate()
  const iso = n => `${y}-${String(m + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`
  const slot = sel && byDate[sel]

  async function confirm() {
    if (!name.trim()) return setErr('Escribe tu nombre.')
    setBusy(true); setErr('')
    const { data, error } = await supabase.rpc('book_slot', { p_slot: slot.id, p_name: name })
    setBusy(false)
    if (error) {
      setErr(error.message.includes('taken') ? 'Ese día acaba de ser reservado por otra persona. Elige otro.' :
        error.message.includes('not_available') ? 'Este día ya no está disponible.' : 'Ha ocurrido un error. Inténtalo de nuevo.')
      setSel(null); load(); return
    }
    setDone(data[0]); load()
  }

  if (done) {
    const link = `${location.origin}/?cancelar=${done.o_token}`
    return (
      <>
        <div className="card">
          <h2 style={{ textTransform: 'none' }}>¡Reserva confirmada!</h2>
          <p>Te esperamos el {fmtDate(done.o_date)} a las {fmtTime(done.o_time)}.</p>
          <p style={{ color: '#777', fontSize: 14 }}>Nombre: {done.o_name}</p>
        </div>
        <div className="card">
          <b>Enlace para cancelar</b>
          <p style={{ fontSize: 13, color: '#777' }}>Guárdalo: es la única forma de cancelar tu cita.</p>
          <div className="link">{link}</div>
          <button className="btn ghost" onClick={() => navigator.clipboard.writeText(link)}>Copiar enlace</button>
        </div>
      </>
    )
  }

  return (
    <>
      <p className="sub">Reserva tu próximo corte.</p>
      <div className="head">
        <button className="nav" onClick={() => setMonth(new Date(y, m - 1, 1, 12))}>‹</button>
        <b>{MONTHS(month)}</b>
        <button className="nav" onClick={() => setMonth(new Date(y, m + 1, 1, 12))}>›</button>
      </div>
      <div className="grid">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => <div className="dow" key={d}>{d}</div>)}
        {Array.from({ length: lead }).map((_, i) => <div key={'e' + i} />)}
        {Array.from({ length: days }, (_, i) => i + 1).map(n => {
          const s = byDate[iso(n)]
          const cls = !s ? '' : s.booked ? 'taken' : 'free'
          return <button key={n} disabled={!s || s.booked} className={`day ${cls} ${sel === iso(n) ? 'sel' : ''}`}
            onClick={() => { setSel(iso(n)); setErr('') }}>{n}</button>
        })}
      </div>
      <div className="legend"><span>⬛ Disponible</span><span>▫️ Ocupado / sin cita</span></div>
      {err && <div className="msg err">{err}</div>}
      {slot && (
        <div className="card">
          <h2>{fmtDate(sel)}</h2>
          <p style={{ margin: '0 0 8px' }}>Hora de la cita: <b>{fmtTime(slot.slot_time)}</b></p>
          <input placeholder="Tu nombre" value={name} maxLength={80} onChange={e => setName(e.target.value)} />
          <button className="btn" disabled={busy} onClick={confirm}>{busy ? 'Reservando…' : 'Confirmar reserva'}</button>
        </div>
      )}
    </>
  )
}

function Cancel({ token }) {
  const [b, setB] = useState(undefined)
  const [msg, setMsg] = useState('')
  const load = () => supabase.rpc('get_booking', { p_token: token }).then(({ data }) => setB(data?.[0] || null))
  useEffect(() => { load() }, [])
  if (b === undefined) return <p className="sub">Cargando…</p>
  if (!b) return <div className="msg err">Enlace no válido.</div>
  async function cancel() {
    if (!confirm('¿Seguro que quieres cancelar tu cita?')) return
    const { error } = await supabase.rpc('cancel_booking', { p_token: token })
    setMsg(error ? 'No se pudo cancelar. Inténtalo de nuevo.' : 'Tu cita se ha cancelado correctamente.')
    load()
  }
  return (
    <div className="card">
      <h2>{b.o_name}</h2>
      <p>{fmtDate(b.o_date)} a las {fmtTime(b.o_time)}</p>
      {b.o_status === 'cancelled' ? <div className="msg">Esta reserva está cancelada.</div>
        : <button className="btn danger" onClick={cancel}>Cancelar reserva</button>}
      {msg && <div className="msg">{msg}</div>}
      <p style={{ marginTop: 16 }}><a href="/">Volver al calendario</a></p>
    </div>
  )
}

function Admin() {
  const [session, setSession] = useState(undefined)
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState('')
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (session === undefined) return null
  if (!session) return (
    <div className="card">
      <h2>Acceso administrador</h2>
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" placeholder="Contraseña" value={pw} onChange={e => setPw(e.target.value)} />
      <button className="btn" onClick={async () => {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw })
        setErr(error ? 'Credenciales incorrectas.' : '')
      }}>Entrar</button>
      {err && <div className="msg err">{err}</div>}
    </div>
  )
  return <Panel />
}

function Panel() {
  const [slots, setSlots] = useState([]), [date, setDate] = useState(''), [time, setTime] = useState('17:00'), [msg, setMsg] = useState('')
  const load = useCallback(async () => {
    const { data } = await supabase.from('slots')
      .select('id,slot_date,slot_time,is_blocked,bookings(id,student_name,status)')
      .gte('slot_date', todayLisbon()).order('slot_date')
    setSlots(data || [])
  }, [])
  useEffect(() => { load() }, [load])
  const act = async (p, ok) => { const { error } = await p; setMsg(error ? 'Error: ' + error.message : ok); load() }
  const active = s => s.bookings.find(b => b.status === 'confirmed')

  return (
    <>
      <div className="card">
        <b>Añadir / modificar día</b>
        <div className="two"><input type="date" min={todayLisbon()} value={date} onChange={e => setDate(e.target.value)} />
          <input type="time" value={time} onChange={e => setTime(e.target.value)} /></div>
        <button className="btn" disabled={!date} onClick={() =>
          act(supabase.from('slots').upsert({ slot_date: date, slot_time: time }, { onConflict: 'slot_date' }), 'Día guardado.')}>Guardar día</button>
      </div>
      {msg && <div className="msg">{msg}</div>}
      <div className="card">
        <b>Próximas citas y días</b>
        {slots.length === 0 && <p style={{ color: '#888' }}>No hay días creados.</p>}
        {slots.map(s => {
          const b = active(s)
          return (
            <div className="row" key={s.id}>
              <div style={{ textTransform: 'capitalize' }}>{fmtDate(s.slot_date)} · {fmtTime(s.slot_time)}
                <small>{b ? `Reservado: ${b.student_name}` : s.is_blocked ? 'Bloqueado' : 'Libre'}</small></div>
              <div>
                {b ? <button className="btn danger" onClick={() => confirm(`¿Cancelar la cita de ${b.student_name}?`) &&
                    act(supabase.from('bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', b.id), 'Reserva cancelada.')}>Cancelar</button>
                  : <button className="btn ghost" onClick={() => act(supabase.from('slots').update({ is_blocked: !s.is_blocked }).eq('id', s.id), 'Actualizado.')}>
                    {s.is_blocked ? 'Desbloquear' : 'Bloquear'}</button>}
              </div>
            </div>
          )
        })}
      </div>
      <button className="btn ghost" style={{ marginTop: 16 }} onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
    </>
  )
}
