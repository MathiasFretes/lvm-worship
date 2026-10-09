export function normalizeTitleForSort(title = ''){
  const trimmed = String(title || '').trim()
  const firstAlphaNumeric = trimmed.search(/[A-Za-z0-9]/)
  return firstAlphaNumeric < 0 ? trimmed : trimmed.slice(firstAlphaNumeric)
}

export function compareSongsByTitle(a, b){
  const left = normalizeTitleForSort(a?.title)
  const right = normalizeTitleForSort(b?.title)
  const numericOrder = Number(/^[0-9]/.test(right)) - Number(/^[0-9]/.test(left))
  return numericOrder || left.localeCompare(right, undefined, { sensitivity: 'base' })
}

