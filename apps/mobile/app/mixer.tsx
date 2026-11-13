import { useLocalSearchParams } from 'expo-router'
import { mixerChartSteps } from '@lavozmisionera/core/music/mixerProject'
import MixerScreen from '../src/screens/MixerScreen'

export default function MixerRoute() {
  const { song, title, slug, personal, transpose, flat } = useLocalSearchParams<{ song?: string; title?: string; slug?: string; personal?: string; transpose?: string; flat?: string }>()
  const songId = typeof song === 'string' && song ? song : undefined
  return <MixerScreen key={songId ? `song:${songId}` : 'draft'} songId={songId} songTitle={typeof title === 'string' ? title : undefined}
    songSlug={typeof slug === 'string' ? slug : undefined} personal={personal === '1'} chartSteps={transpose === undefined ? undefined : mixerChartSteps(transpose)} preferFlat={flat === '1'} />
}
