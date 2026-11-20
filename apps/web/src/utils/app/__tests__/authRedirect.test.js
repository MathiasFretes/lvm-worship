import {authRedirectPath} from '../authRedirect'

describe('shared suite login redirects',()=>{
  const origin='https://srv2137598.hstgr.cloud'
  test('preserves Service and Worship destinations with query and fragment',()=>{
    expect(authRedirectPath('/service/admin?view=inbox#messages',origin)).toBe('/service/admin?view=inbox#messages')
    expect(authRedirectPath('/setlists/123',origin)).toBe('/setlists/123')
  })
  test('rejects external URLs including protocol-relative and backslash variants',()=>{
    for(const path of ['https://evil.example','//evil.example','/\\evil.example','javascript:alert(1)',null]) expect(authRedirectPath(path,origin)).toBe('/app')
  })
})
