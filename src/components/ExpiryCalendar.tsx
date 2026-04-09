import { useState } from 'react'

interface Props {
  selected: string
  onChange: (date: string) => void
  onClose: () => void
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function toYMD(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isPast(date: Date): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d < today
}

export function ExpiryCalendar({ selected, onChange, onClose }: Props) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1)
  const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0)
  const startPad = firstDayOfMonth.getDay()

  const cells: (Date | null)[] = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= lastDayOfMonth.getDate(); d++) {
    cells.push(new Date(viewYear, viewMonth, d))
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const canGoPrev =
    viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth > today.getMonth())

  function prevMonth() {
    if (!canGoPrev) return
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  return (
    <div style={{
      position: 'absolute',
      top: '110%',
      left: 0,
      background: '#fff',
      border: '1px solid #000',
      padding: '1rem',
      zIndex: 200,
      width: 260,
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
    }}>
      {/* Month navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <button
          onClick={prevMonth}
          disabled={!canGoPrev}
          style={{ border: 'none', background: 'none', cursor: canGoPrev ? 'pointer' : 'default', fontSize: 18, color: canGoPrev ? '#000' : '#ccc', lineHeight: 1 }}
        >
          ‹
        </button>
        <span style={{ fontWeight: 600, fontSize: 13 }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
        >
          ›
        </button>
      </div>

      {/* Day of week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {DAY_LABELS.map(d => (
          <div
            key={d}
            style={{
              textAlign: 'center',
              fontSize: 10,
              fontWeight: d === 'Fr' ? 700 : 400,
              color: d === 'Fr' ? '#000' : '#aaa',
              padding: '2px 0'
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((date, i) => {
          if (!date) return <div key={i} />

          const ymd = toYMD(date)
          const isFriday = date.getDay() === 5
          const past = isPast(date)
          const selectable = isFriday && !past
          const isSelected = ymd === selected

          return (
            <div
              key={i}
              onClick={() => { if (selectable) { onChange(ymd); onClose() } }}
              style={{
                textAlign: 'center',
                padding: '5px 2px',
                fontSize: 12,
                borderRadius: 3,
                cursor: selectable ? 'pointer' : 'default',
                background: isSelected ? '#000' : 'transparent',
                color: isSelected ? '#fff' : selectable ? '#000' : '#ddd',
                fontWeight: selectable ? 600 : 400,
              }}
            >
              {date.getDate()}
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #f0f0f0', fontSize: 10, color: '#aaa' }}>
        Fridays only — standard options expiry
      </div>
    </div>
  )
}
