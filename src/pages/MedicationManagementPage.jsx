import { useEffect, useState } from 'react'
import { childDisplayName } from '../careEventUtils.js'
import { WEEKDAY_OPTIONS, weekdaySummary } from '../medicationUtils.js'
import {
  createMedication,
  getMedicationManagement,
  setMedicationActive,
  updateMedication,
} from '../services/medicationApi.js'
import '../Medication.css'

const EMPTY_FORM = { id: '', name: '', childIds: [], weekdays: [] }

function MedicationManagementPage({ session, onNavigate }) {
  const activeFamily = session.families[0]
  const [children, setChildren] = useState([])
  const [medications, setMedications] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = () => getMedicationManagement(activeFamily.id).then((result) => {
    setChildren(result.children)
    setMedications(result.medications)
    setStatus('ready')
  })

  useEffect(() => {
    let isActive = true
    getMedicationManagement(activeFamily.id)
      .then((result) => {
        if (!isActive) return
        setChildren(result.children)
        setMedications(result.medications)
        setStatus('ready')
      })
      .catch((requestError) => {
        if (!isActive) return
        setError(requestError.message)
        setStatus('error')
      })
    return () => { isActive = false }
  }, [activeFamily.id])

  const toggleValue = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value],
    }))
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!form.name.trim() || form.childIds.length === 0 || form.weekdays.length === 0) {
      setError('おくすり名・対象児・曜日をすべて設定してください。')
      return
    }
    setStatus('saving')
    setError('')
    setMessage('')
    try {
      const values = { name: form.name, childIds: form.childIds, weekdays: form.weekdays }
      if (form.id) await updateMedication(activeFamily.id, { id: form.id, ...values })
      else await createMedication(activeFamily.id, values)
      await load()
      setForm(EMPTY_FORM)
      setMessage(form.id ? 'おくすり情報を変更しました。' : 'おくすりを登録しました。')
    } catch (requestError) {
      setError(requestError.message)
      setStatus('ready')
    }
  }

  const edit = (medication) => {
    setForm({
      id: medication.id,
      name: medication.name,
      childIds: medication.childIds,
      weekdays: medication.weekdays,
    })
    setMessage('')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleActive = async (medication) => {
    const nextActive = !medication.isActive
    if (!nextActive && !window.confirm(`「${medication.name}」を服用終了にしますか？\n過去の投薬記録は残ります。`)) return
    setStatus('saving')
    setError('')
    try {
      await setMedicationActive(activeFamily.id, medication.id, nextActive)
      await load()
      setMessage(nextActive ? '服用中に戻しました。' : '服用終了にしました。')
    } catch (requestError) {
      setError(requestError.message)
      setStatus('ready')
    }
  }

  return (
    <main className="medication-page medication-management-page">
      <header className="medication-page__header">
        <a href="/" aria-label="TOPへ戻る" onClick={(event) => { event.preventDefault(); onNavigate('/') }}>←</a>
        <div>
          <p>{activeFamily.name}</p>
          <h1>おくすり管理</h1>
        </div>
      </header>

      <section className="medication-editor" aria-labelledby="medication-editor-title">
        <div>
          <p>Medicine settings</p>
          <h2 id="medication-editor-title">{form.id ? 'おくすりを編集' : '新しいおくすりを登録'}</h2>
        </div>
        <form onSubmit={submit}>
          <label className="medication-editor__name">
            <span>おくすり名</span>
            <input
              type="text"
              maxLength="100"
              value={form.name}
              placeholder="例：ビタミンDシロップ"
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </label>
          <fieldset>
            <legend>誰のおくすりですか？</legend>
            <div className="medication-choice-grid">
              {children.map((child) => (
                <label key={child.id} className={form.childIds.includes(child.id) ? 'is-selected' : ''}>
                  <input
                    type="checkbox"
                    checked={form.childIds.includes(child.id)}
                    onChange={() => toggleValue('childIds', child.id)}
                  />
                  {childDisplayName(child.name)}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>飲む曜日</legend>
            <div className="medication-weekdays">
              {WEEKDAY_OPTIONS.map((weekday) => (
                <label key={weekday.value} className={form.weekdays.includes(weekday.value) ? 'is-selected' : ''}>
                  <input
                    type="checkbox"
                    checked={form.weekdays.includes(weekday.value)}
                    onChange={() => toggleValue('weekdays', weekday.value)}
                  />
                  {weekday.label}
                </label>
              ))}
            </div>
            <p>将来「朝・昼・夜」を追加できるスケジュール構造で保存します。</p>
          </fieldset>
          {error && <div className="medication-error" role="alert">{error}</div>}
          <div className="medication-editor__actions">
            {form.id && <button type="button" onClick={() => setForm(EMPTY_FORM)}>キャンセル</button>}
            <button type="submit" disabled={status === 'saving'}>{status === 'saving' ? '保存中…' : form.id ? '変更を保存' : '登録する'}</button>
          </div>
        </form>
      </section>

      {message && <p className="medication-message" role="status">{message}</p>}

      <section className="medication-list" aria-labelledby="medication-list-title">
        <div className="medication-list__heading">
          <div><p>Your medicines</p><h2 id="medication-list-title">登録中のおくすり</h2></div>
          <span>{medications.filter((item) => item.isActive).length}種類を服用中</span>
        </div>
        {status === 'loading' && <p className="medication-empty">読み込んでいます…</p>}
        {status !== 'loading' && medications.length === 0 && <p className="medication-empty">おくすりはまだ登録されていません。</p>}
        <div className="medication-card-grid">
          {medications.map((medication) => (
            <article className={`medication-card${medication.isActive ? '' : ' is-inactive'}`} key={medication.id}>
              <div className="medication-card__title">
                <span aria-hidden="true">●</span>
                <div><strong>{medication.name}</strong><small>{medication.isActive ? '服用中' : '服用終了'}</small></div>
              </div>
              <dl>
                <div><dt>対象</dt><dd>{children.filter((child) => medication.childIds.includes(child.id)).map((child) => childDisplayName(child.name)).join('・')}</dd></div>
                <div><dt>曜日</dt><dd>{weekdaySummary(medication.weekdays)}</dd></div>
              </dl>
              <div className="medication-card__actions">
                <button type="button" onClick={() => edit(medication)}>編集</button>
                <button type="button" onClick={() => toggleActive(medication)}>{medication.isActive ? '服用終了にする' : '服用中に戻す'}</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

export default MedicationManagementPage
