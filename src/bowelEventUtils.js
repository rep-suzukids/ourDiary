export const BOWEL_AMOUNT_OPTIONS = [
  { value: 'tiny', label: 'ちょこっと' },
  { value: 'small', label: '少なめ' },
  { value: 'normal', label: 'ふつう' },
  { value: 'large', label: '多め' },
]

export const BOWEL_CONSISTENCY_OPTIONS = [
  { value: 'diarrhea', label: '下痢' },
  { value: 'soft', label: 'やわらかめ' },
  { value: 'normal', label: 'ふつう' },
  { value: 'hard', label: 'かため' },
]

export const BOWEL_COLOR_OPTIONS = [
  { value: 'white', label: '白', color: '#fffdf8' },
  { value: 'yellow', label: '黄', color: '#f2d66b' },
  { value: 'orange', label: '橙', color: '#e9a35e' },
  { value: 'brown', label: '茶', color: '#9a674d' },
  { value: 'green', label: '緑', color: '#83a87a' },
  { value: 'red', label: '赤', color: '#d96b72' },
  { value: 'black', label: '黒', color: '#554b50' },
]

export function bowelOptionLabel(options, value) {
  return options.find((option) => option.value === value)?.label ?? value
}
