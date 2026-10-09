import { useEffect, useState } from 'react'
import { loadDashboardSongs } from './dashboardRepository'

export function useWorshipDashboardData() {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ status: 'loading', total: 0, songs: [] })

  useEffect(() => {
    let active = true
    loadDashboardSongs().then(snapshot => {
      if (active) setState({ status: 'ready', ...snapshot })
    }).catch(() => {
      if (active) setState({ status: 'error', total: 0, songs: [] })
    })
    return () => { active = false }
  }, [attempt])

  function retry() {
    setState({ status: 'loading', total: 0, songs: [] })
    setAttempt(value => value + 1)
  }

  return { ...state, retry }
}
