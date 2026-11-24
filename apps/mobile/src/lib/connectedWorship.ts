import AsyncStorage from '@react-native-async-storage/async-storage'
import { createWorshipExchangeRepository, type WorshipScope } from '@lavozmisionera/core/setlists/worshipExchange'
import { getCurrentUserSnapshot } from './currentUser'
import { deviceApiRequest, usesVpsBackend } from './supabase'
import { uuidv4 } from './uuid'

/** The connected editor must dispose this repository when changing scope. */
export function openConnectedWorship(scope: WorshipScope) {
  if (!usesVpsBackend) throw new Error('Connected Worship requires the VPS device client')
  return createWorshipExchangeRepository({
    scope,
    storage: AsyncStorage,
    request: deviceApiRequest,
    uuid: uuidv4,
    isActive: () => getCurrentUserSnapshot().user?.id === scope.userId,
  })
}
