export const REACTION_CATALOG = [
  { key: 'reaction-01', label: 'うんうん' },
  { key: 'reaction-02', label: 'good' },
  { key: 'reaction-03', label: 'うーん' },
  { key: 'reaction-04', label: 'はて？' },
  { key: 'reaction-05', label: 'にっこり' },
  { key: 'reaction-06', label: 'ありがとう' },
  { key: 'reaction-07', label: 'ぺこり' },
  { key: 'reaction-08', label: '笑' },
  { key: 'reaction-09', label: 'よろしく（お願い）' },
  { key: 'reaction-10', label: '可愛い' },
  { key: 'reaction-11', label: 'しょぼーん' },
  { key: 'reaction-12', label: '嬉し泣き' },
  { key: 'reaction-13', label: '歓喜' },
  { key: 'reaction-14', label: '泣き' },
  { key: 'reaction-15', label: 'ガーン' },
  { key: 'reaction-16', label: '踊る' },
  { key: 'reaction-17', label: 'げっそり' },
  { key: 'reaction-18', label: 'お疲れ様' },
  { key: 'reaction-19', label: 'よろしく（挨拶）' },
  { key: 'reaction-20', label: '了解' },
].map((reaction) => ({
  ...reaction,
  imageUrl: `/reactions/${reaction.key}.png`,
}))

export function reactionByKey(key) {
  return REACTION_CATALOG.find((reaction) => reaction.key === key)
}
