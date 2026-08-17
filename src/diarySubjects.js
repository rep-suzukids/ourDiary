const PARENT_SUBJECTS = [
  { value: 'father', subjectType: 'father', childId: null, name: 'お父さん', mark: '父', tone: 'father' },
  { value: 'mother', subjectType: 'mother', childId: null, name: 'ママ', mark: '母', tone: 'mother' },
]

export function buildDiarySubjects(children) {
  return [
    ...children.map((child) => ({
      value: `child:${child.id}`,
      subjectType: 'child',
      childId: child.id,
      name: child.name,
      mark: child.name === 'ともちゃん' ? '智' : '結',
      tone: child.name === 'ともちゃん' ? 'tomo' : 'yuu',
    })),
    ...PARENT_SUBJECTS,
  ]
}

export function diarySubjectInput(value) {
  if (value === 'father' || value === 'mother') {
    return { subjectType: value, childId: null }
  }
  if (value.startsWith('child:')) {
    return { subjectType: 'child', childId: value.slice('child:'.length) }
  }
  return null
}

export function diaryEntrySubjectValue(entry) {
  const subjectType = entry.subjectType ?? 'child'
  return subjectType === 'child' ? `child:${entry.childId}` : subjectType
}

export function diaryEntryTone(entry) {
  if (entry.subjectType === 'father' || entry.subjectType === 'mother') return entry.subjectType
  return (entry.subjectName ?? entry.childName) === 'ともちゃん' ? 'tomo' : 'yuu'
}

export function diaryEntryMark(entry) {
  if (entry.subjectType === 'father') return '父'
  if (entry.subjectType === 'mother') return '母'
  return (entry.subjectName ?? entry.childName) === 'ともちゃん' ? '智' : '結'
}

export function diaryEntryLabel(entry) {
  const subjectType = entry.subjectType ?? 'child'
  return subjectType === 'child' ? `${diaryEntryMark(entry)}ちゃん` : entry.subjectName
}
