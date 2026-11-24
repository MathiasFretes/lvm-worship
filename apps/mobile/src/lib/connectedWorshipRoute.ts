import { worshipScope, type WorshipScope } from '@lavozmisionera/core/setlists/worshipExchange'

const mainBranch = '00000000-0000-4000-8000-000000000000'
type Params = { churchId?: string | string[]; serviceId?: string | string[]; branchId?: string | string[] }

export function connectedWorshipRoute(userId: string, params: Params): WorshipScope | null {
  if (params.churchId === undefined && params.serviceId === undefined && params.branchId === undefined) return null
  if (typeof params.churchId !== 'string' || typeof params.serviceId !== 'string' ||
    (params.branchId !== undefined && typeof params.branchId !== 'string')) throw new Error('Invalid connected Service link')
  return worshipScope({ userId, churchId: params.churchId, serviceId: params.serviceId, branchId: params.branchId ?? mainBranch })
}
