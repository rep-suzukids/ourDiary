import { useEffect, useMemo, useState } from 'react'
import { childDisplayName, childTone, localDateString } from '../careEventUtils.js'
import {
  getDailyTemperatureStatus,
  TEMPERATURE_STATUS_CHANGED_EVENT,
} from '../services/temperatureApi.js'
import '../TemperatureReminder.css'

const CLOCK_UPDATE_INTERVAL_MS = 60 * 1000

function japanHour(date) {
  const hour = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).find((part) => part.type === 'hour')?.value
  return Number(hour)
}

function TemperatureReminder({ session, refreshKey, onNavigate, placement = 'floating' }) {
  const activeFamily = session.families[0]
  const [now, setNow] = useState(() => new Date())
  const [dailyStatus, setDailyStatus] = useState(null)
  const [refreshRevision, setRefreshRevision] = useState(0)
  const today = localDateString(now)

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), CLOCK_UPDATE_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const refreshStatus = () => setRefreshRevision((current) => current + 1)
    window.addEventListener('focus', refreshStatus)
    window.addEventListener(TEMPERATURE_STATUS_CHANGED_EVENT, refreshStatus)
    return () => {
      window.removeEventListener('focus', refreshStatus)
      window.removeEventListener(TEMPERATURE_STATUS_CHANGED_EVENT, refreshStatus)
    }
  }, [])

  useEffect(() => {
    let isActive = true
    getDailyTemperatureStatus(activeFamily.id, today)
      .then((result) => {
        if (isActive) setDailyStatus(result)
      })
      .catch((error) => {
        console.error('Failed to check today\'s temperature status', error)
        if (isActive) setDailyStatus(null)
      })
    return () => { isActive = false }
  }, [activeFamily.id, refreshKey, refreshRevision, today])

  const missingChildren = useMemo(() => {
    if (!dailyStatus) return []
    const registeredChildIds = new Set(dailyStatus.registeredChildIds ?? [])
    return (dailyStatus.children ?? []).filter((child) => !registeredChildIds.has(child.id))
  }, [dailyStatus])

  if (!dailyStatus || missingChildren.length === 0) return null

  let message = 'AM7:00になったら検温をしましょう'
  const isAfterSeven = japanHour(now) >= 7
  if (isAfterSeven) {
    message = missingChildren.length >= 2
      ? 'ふたりの検温・登録をしましょう'
      : `${childDisplayName(missingChildren[0].name)}の検温・登録をしましょう`
  }

  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
  const query = new URLSearchParams({ date: today, returnTo })
  if (isAfterSeven && missingChildren.length === 1) {
    query.set('child', childTone(missingChildren[0].name))
  }
  const destination = `/temperature/new?${query}`

  return (
    <aside className={`temperature-reminder temperature-reminder--${placement}`} role="alert" aria-live="polite">
      <a
        className="temperature-reminder__link"
        href={destination}
        onClick={(event) => {
          event.preventDefault()
          onNavigate(destination)
        }}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M14 14.76V5a4 4 0 0 0-8 0v9.76a6 6 0 1 0 8 0ZM10 4a1 1 0 0 1 1 1v11.05a3 3 0 1 1-2 0V5a1 1 0 0 1 1-1Z" />
        </svg>
        <span>{message}</span>
      </a>
    </aside>
  )
}

export default TemperatureReminder
