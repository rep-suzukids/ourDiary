import { useEffect, useState } from 'react'
import { calculateChildAge } from '../childAge.js'
import { childDisplayName, childTone, localDateString } from '../careEventUtils.js'
import { getChildBirthdays } from '../services/birthdayApi.js'

function ChildAgeSummary({ familyId }) {
  const [children, setChildren] = useState([])

  useEffect(() => {
    let isActive = true
    getChildBirthdays(familyId)
      .then((result) => {
        if (isActive) setChildren((result.children ?? []).filter((child) => child.birthDate))
      })
      .catch(() => {
        if (isActive) setChildren([])
      })
    return () => { isActive = false }
  }, [familyId])

  if (children.length === 0) return null

  const today = localDateString()
  const ageItems = children.map((child) => ({
    ...child,
    age: calculateChildAge(child.birthDate, today),
  })).filter((child) => child.age)
  if (ageItems.length === 0) return null

  return (
    <section className="child-age-summary" aria-label="子どもたちの年齢">
      {ageItems.map((child) => (
        <article className={`child-age-card child-age-card--${childTone(child.name)}`} key={child.id}>
          <span className="child-age-card__mark" aria-hidden="true">
            {childDisplayName(child.name).slice(0, 1)}
          </span>
          <div>
            <p>{childDisplayName(child.name)}</p>
            <strong>{child.age.years}歳{child.age.months}ヶ月</strong>
            <small>生後：{child.age.days.toLocaleString('ja-JP')}日</small>
          </div>
        </article>
      ))}
    </section>
  )
}

export default ChildAgeSummary
