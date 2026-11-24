import {useEffect} from 'react'
export default function ServiceAdminRedirect(){
  useEffect(()=>{window.location.replace('/service/admin')},[])
  return null
}
