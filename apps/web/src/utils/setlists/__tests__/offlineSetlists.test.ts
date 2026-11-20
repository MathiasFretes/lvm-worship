import {describe,it,expect,vi} from 'vitest'
import {createOfflineSetlists,prepareOfflineSetlist,type OfflineSetlist,type RehearsalSong} from '@lavozmisionera/core/setlists/offlineSetlists'

const song:RehearsalSong={id:'song-1',slug:'song',title:'Song',artist:null,default_key:'D',tempo:72,time_signature:'4/4',chordpro_content:'[D]Cantamos'}
function set(id='set-1'):OfflineSetlist{return {id,name:'Sunday',serviceDate:null,updatedAt:null,savedAt:'2026-11-20T12:00:00Z',items:[{entryKey:'first',songId:song.id,toKey:'E',notes:'Quiet intro',song:{...song},verseLines:null}]}}
function memory(){
  const values=new Map<string,string>()
  const storage={read:vi.fn(async(owner:string)=>values.get(owner)??null),write:vi.fn(async(owner:string,raw:string)=>{values.set(owner,raw)})}
  return {values,storage,cache:createOfflineSetlists(storage)}
}
describe('downloaded rehearsal setlists',()=>{
  it('uses the storage transaction instead of a separate read and write',async()=>{
    let raw:string|null=null
    const read=vi.fn(async()=>raw)
    const write=vi.fn(async()=>{})
    const update=vi.fn(async(_owner:string,change:(value:string|null)=>string)=>{raw=change(raw)})
    const cache=createOfflineSetlists({read,write,update})
    await cache.save('owner',set('one'))
    await cache.save('owner',set('two'))
    expect(read).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledTimes(2)
    expect((await cache.read('owner')).map(row=>row.id)).toEqual(['two','one'])
    raw='damaged download'
    await expect(cache.remove('owner','one')).rejects.toThrow()
    expect(raw).toBe('damaged download')
  })
  it('serializes simultaneous saves without losing either set and freezes submitted data',async()=>{
    const {cache}=memory()
    const first=set('one')
    const writes=[cache.save('owner',first),cache.save('owner',set('two'))]
    first.items[0].song.chordpro_content='mutated after save'
    await Promise.all(writes)
    const sets=await cache.read('owner')
    expect(sets.map(row=>row.id)).toEqual(['two','one'])
    expect(sets[1].items[0].song.chordpro_content).toBe('[D]Cantamos')
  })
  it('keeps accounts separate and rejects a cache returned for another account',async()=>{
    const {cache,values,storage}=memory()
    await cache.save('first',set())
    expect(await cache.read('second')).toEqual([])
    values.set('second',values.get('first')!)
    await expect(cache.read('second')).rejects.toThrow('Invalid offline setlist storage')
    storage.write.mockClear()
    await expect(cache.save('second',set('new'))).rejects.toThrow()
    expect(storage.write).not.toHaveBeenCalled()
  })
  it('preserves the existing bytes when reading fails or persisted data is damaged',async()=>{
    const {cache,values,storage}=memory()
    await cache.save('owner',set())
    const previous=values.get('owner')
    storage.read.mockRejectedValueOnce(new Error('Storage unavailable'))
    await expect(cache.save('owner',set('new'))).rejects.toThrow('Storage unavailable')
    expect(values.get('owner')).toBe(previous)
    values.set('owner','broken JSON')
    storage.write.mockClear()
    await expect(cache.remove('owner','set-1')).rejects.toThrow()
    expect(values.get('owner')).toBe('broken JSON')
    expect(storage.write).not.toHaveBeenCalled()
  })
  it('continues processing a later save after a failed write',async()=>{
    const {cache,storage}=memory()
    storage.write.mockRejectedValueOnce(new Error('Quota'))
    await expect(cache.save('owner',set('failed'))).rejects.toThrow('Quota')
    await cache.save('owner',set('ok'))
    expect((await cache.read('owner')).map(row=>row.id)).toEqual(['ok'])
  })
  it('downloads repeated songs once and retains the order, keys, notes and reading text',async()=>{
    const fetchSong=vi.fn(async()=>({...song}))
    const input={id:'service',name:'Sunday',serviceDate:null,updatedAt:null,items:[
      {entryKey:'intro',songId:song.id,toKey:'E',notes:'Quiet',sectionOrderText:'1,2,1',song},
      {entryKey:'reading',songId:'v:rvr1960|John 3:16',toKey:null,notes:'Read slowly',song:{...song,id:'verse',slug:'',title:'John 3:16'}},
      {entryKey:'return',songId:song.id,toKey:'F',notes:'Repeat chorus',song},
    ]}
    const progress=vi.fn()
    const result=await prepareOfflineSetlist(input,{fetchSong,fetchReading:async()=>[{verse:true,chapter:3,number:16,text:'Porque de tal manera amó Dios',showChapter:true}],onProgress:progress})
    expect(fetchSong).toHaveBeenCalledTimes(1)
    expect(result.items.map(row=>[row.entryKey,row.toKey,row.notes])).toEqual([['intro','E','Quiet'],['reading',null,'Read slowly'],['return','F','Repeat chorus']])
    expect(result.items[1].verseLines?.[0].text).toContain('amó Dios')
    expect(result.items[0].sectionOrderText).toBe('1,2,1')
    expect(progress).toHaveBeenLastCalledWith(3,3)
  })
  it('fails the entire preparation when a required chart is missing',async()=>{
    const input=set()
    await expect(prepareOfflineSetlist(input,{fetchSong:async()=>null,fetchReading:async()=>[]})).rejects.toThrow('Missing offline song')
  })
  it('does not persist arbitrary metadata carried by a fetched song',async()=>{
    const {cache,values}=memory()
    const input=set()
    Object.assign(input.items[0].song,{access_token:'must not be cached'})
    await cache.save('owner',input)
    expect(values.get('owner')).not.toContain('access_token')
  })
  it('enforces the byte budget for Unicode lyrics before writing any download',async()=>{
    const {cache,storage}=memory()
    const input=set()
    input.items=Array.from({length:45},(_,index)=>({...input.items[0],entryKey:`entry-${index}`,song:{...song,chordpro_content:'🎶'.repeat(100000)}}))
    await expect(cache.save('owner',input)).rejects.toThrow('storage budget')
    expect(storage.write).not.toHaveBeenCalled()
  })
})
