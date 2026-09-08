import { useEffect, useMemo, useState } from 'react'
import { childDisplayName, childTone, localDateString } from '../careEventUtils.js'
import { MedicationIcon } from './CareEventIcons.jsx'
import {
  getMedicationDay,
  MEDICATION_STATUS_CHANGED_EVENT,
} from '../services/medicationApi.js'

const CLOCK_UPDATE_INTERVAL_MS = 60 * 1000
const CHILD_ORDER = Object.freeze({ tomo: 0, yuu: 1 })

function MedicationReminder({ session, refreshKey, onNavigate }) {
  const activeFamily = session.families[0]
  const [now, setNow] = useState(() => new Date())
  const [outstanding, setOutstanding] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [refreshRevision, setRefreshRevision] = useState(0)
  const today = localDateString(now)

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), CLOCK_UPDATE_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const refreshStatus = () => setRefreshRevision((current) => current + 1)
    window.addEventListener('focus', refreshStatus)
    window.addEventListener(MEDICATION_STATUS_CHANGED_EVENT, refreshStatus)
    return () => {
      window.removeEventListener('focus', refreshStatus)
      window.removeEventListener(MEDICATION_STATUS_CHANGED_EVENT, refreshStatus)
    }
  }, [])

  useEffect(() => {
    let isActive = true
    getMedicationDay(activeFamily.id, today, 'status')
      .then((result) => {
        if (!isActive) return
        setOutstanding(result.outstanding ?? [])
        setLoaded(true)
      })
      .catch((error) => {
        console.error('Failed to check today\'s medication status', error)
        if (isActive) {
          setOutstanding([])
          setLoaded(false)
        }
      })
    return () => { isActive = false }
  }, [activeFamily.id, refreshKey, refreshRevision, today])

  const missingChildren = useMemo(() => {
    const byId = new Map()
    outstanding.forEach((item) => byId.set(item.childId, item))
    return [...byId.values()]
      .sort((left, right) => CHILD_ORDER[childTone(left.childName)] - CHILD_ORDER[childTone(right.childName)])
  }, [outstanding])

  if (!loaded || missingChildren.length === 0) return null

  const childNames = missingChildren.map((item) => childDisplayName(item.childName)).join('・')
  const message = `今日は${childNames}のおくすりの日です`
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
  const query = new URLSearchParams({ date: today, returnTo })
  if (missingChildren.length === 1) query.set('child', childTone(missingChildren[0].childName))
  if (outstanding.length === 1) query.set('schedule', outstanding[0].scheduleId)
  const destination = `/medication/new?${query}`

  return (
    <aside className="temperature-reminder temperature-reminder--embedded medication-reminder" role="alert" aria-live="polite">
      <a className="temperature-reminder__link" href={destination} onClick={(event) => {
        event.preventDefault()
        onNavigate(destination)
      }}>
        <MedicationIcon />
        <span>{message}</span>
      </a>
    </aside>
  )
}

export default MedicationReminder
