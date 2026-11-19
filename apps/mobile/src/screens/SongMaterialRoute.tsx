import { useLocalSearchParams } from 'expo-router'
import { songMaterialKey } from '@lavozmisionera/core/music/songMaterial'
import ScoreScreen from './ScoreScreen'
import TablatureScreen from './TablatureScreen'

export default function SongMaterialRoute({ kind }: { kind: 'score' | 'tablature' }) {
  const params = useLocalSearchParams<{ song?: string; title?: string }>()
  const songId = typeof params.song === 'string' && params.song ? params.song : undefined
  const songTitle = typeof params.title === 'string' ? params.title : undefined
  const Component = kind === 'score' ? ScoreScreen : TablatureScreen
  return <Component key={songMaterialKey(kind, songId)} songId={songId} songTitle={songTitle} />
}
