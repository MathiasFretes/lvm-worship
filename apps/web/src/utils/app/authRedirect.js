export function authRedirectPath(target, origin) {
  try {
    if (typeof target !== 'string' || !target.startsWith('/')) return '/app'
    const url=new URL(target,origin)
    if(url.origin!==origin)return '/app'
    return `${url.pathname}${url.search}${url.hash}`
  }catch{return '/app'}
}

export function completeAuthRedirect(target,navigate){
  const path=authRedirectPath(target,window.location.origin)
  if(path==='/' || /^\/service(?:\/|\?|#|$)/.test(path)) window.location.replace(path)
  else navigate(path,{replace:true})
}
