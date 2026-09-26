import { useEffect, useMemo, useState } from 'react'
import { childDisplayName, childTone, localDateString } from '../careEventUtils.js'
import {
  BOWEL_STATUS_CHANGED_EVENT,
  getBowelReminderStatus,
} from '../services/bowelEventApi.js'
import { DiaperIcon } from './CareEventIcons.jsx'

const CLOCK_UPDATE_INTERVAL_MS = 60 * 1000
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000
const PERIOD_TIMES = Object.freeze({
  late_night: '02:00',
  early_morning: '05:30',
  morning: '09:00',
  noon: '13:00',
  evening: '17:00',
  night: '21:30',
})

function eventDateTime(event) {
  let time = '12:00'
  if (event.timeType === 'exact' && event.time) time = event.time
  if (event.timeType === 'period') time = PERIOD_TIMES[event.timePeriod] ?? '12:00'
  const value = new Date(`${event.date}T${time}:00+09:00`)
  return Number.isNaN(value.getTime()) ? null : value
}

function BowelReminder({ session, refreshKey, onNavigate }) {
  const activeFamily = session.families[0]
  const [now, setNow] = useState(() => new Date())
  const [status, setStatus] = useState(null)
  const [refreshRevision, setRefreshRevision] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), CLOCK_UPDATE_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const refreshStatus = () => setRefreshRevision((current) => current + 1)
    window.addEventListener('focus', refreshStatus)
    window.addEventListener(BOWEL_STATUS_CHANGED_EVENT, refreshStatus)
    return () => {
      window.removeEventListener('focus', refreshStatus)
      window.removeEventListener(BOWEL_STATUS_CHANGED_EVENT, refreshStatus)
    }
  }, [])

  useEffect(() => {
    let isActive = true
    getBowelReminderStatus(activeFamily.id)
      .then((result) => {
        if (isActive) setStatus(result)
      })
      .catch((error) => {
        console.error('Failed to check bowel record status', error)
        if (isActive) setStatus(null)
      })
    return () => { isActive = false }
  }, [activeFamily.id, refreshKey, refreshRevision])

  const overdueChildren = useMemo(() => {
    if (!status) return []
    const latestByChild = new Map((status.latestBowelEvents ?? []).map((event) => [event.childId, event]))
    return (status.children ?? []).flatMap((child) => {
      const latest = latestByChild.get(child.id)
      if (!latest) return []
      const recordedAt = eventDateTime(latest)
      if (!recordedAt) return []
      const fullDays = Math.floor((now.getTime() - recordedAt.getTime()) / DAY_MILLISECONDS)
      return fullDays >= 1 ? [{ child, fullDays }] : []
    })
  }, [now, status])

  if (overdueChildren.length === 0 || ['/poop/new', '/poop/edit'].includes(window.location.pathname)) return null

  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
  return overdueChildren.map(({ child, fullDays }) => {
    const query = new URLSearchParams({
      date: localDateString(now),
      child: childTone(child.name),
      returnTo,
    })
    const destination = `/poop/new?${query}`
    return (
      <aside className="temperature-reminder temperature-reminder--embedded bowel-reminder" role="alert" aria-live="polite" key={child.id}>
        <a className="temperature-reminder__link" href={destination} onClick={(event) => {
          event.preventDefault()
          onNavigate(destination)
        }}>
          <DiaperIcon />
          <span>{childDisplayName(child.name)}のうんちが丸{fullDays}日記録されていません</span>
        </a>
      </aside>
    )
  })
}

export default BowelReminder
