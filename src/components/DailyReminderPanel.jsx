import MedicationReminder from './MedicationReminder.jsx'
import TemperatureReminder from './TemperatureReminder.jsx'

function DailyReminderPanel({ session, refreshKey, onNavigate, placement = 'floating' }) {
  return (
    <div className={`daily-reminder-panel daily-reminder-panel--${placement}`}>
      <TemperatureReminder
        session={session}
        refreshKey={refreshKey}
        onNavigate={onNavigate}
        placement="embedded"
      />
      <MedicationReminder session={session} refreshKey={refreshKey} onNavigate={onNavigate} />
    </div>
  )
}

export default DailyReminderPanel
