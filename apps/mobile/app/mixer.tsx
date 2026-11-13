import { useLocalSearchParams } from 'expo-router'
import MixerScreen from '../src/screens/MixerScreen'

export default function MixerRoute() {
  const { song, title } = useLocalSearchParams<{ song?: string; title?: string }>()
  const songId = typeof song === 'string' && song ? song : undefined
  return <MixerScreen key={songId ? `song:${songId}` : 'draft'} songId={songId} songTitle={typeof title === 'string' ? title : undefined} />
}
