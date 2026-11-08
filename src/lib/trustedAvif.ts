/** Structural fallback for trusted store AVIF that Cloudflare cannot decode.
 * This validates the static AVIF container and AV1 OBU framing, not decoded pixels.
 * It deliberately supports only self-contained av01 images and av01-tile grids.
 */
export function inspectTrustedAvif(bytes: Uint8Array, maxPixels = 25000000) {
  const fail = (): never => { throw new Error('Invalid or unsupported store AVIF container.') }
  if (bytes.length < 32 || bytes.length > 8 * 1024 * 1024) fail()
  const number = (at: number, length: number, end = bytes.length) => {
    if (!Number.isSafeInteger(at) || at < 0 || length < 0 || length > 8 || at + length > end) fail()
    let value = 0
    for (let i = 0; i < length; i++) value = value * 256 + bytes[at + i]
    if (!Number.isSafeInteger(value)) fail()
    return value
  }
  const text = (at: number, end = bytes.length) => {
    number(at, 4, end)
    return String.fromCharCode(...bytes.subarray(at, at + 4))
  }
  type Box = {type: string; data: number; end: number}
  let boxCount = 0
  const boxes = (start: number, end: number): Box[] => {
    const result: Box[] = []
    for (let p = start; p < end;) {
      if (++boxCount > 2048) fail()
      let size = number(p, 4, end), header = 8
      const type = text(p + 4, end)
      if (size === 1) { size = number(p + 8, 8, end); header = 16 }
      if (size < header || p + size > end) fail()
      result.push({type, data:p + header, end:p + size}); p += size
    }
    return result
  }
  const one = (list: Box[], type: string) => {
    const matches = list.filter(box => box.type === type)
    if (matches.length !== 1) fail()
    return matches[0]
  }
  const optional = (list: Box[], type: string) => list.some(box=>box.type===type) ? one(list,type) : null
  const top = boxes(0, bytes.length), ftyp = one(top,'ftyp'), meta = one(top,'meta')
  if (top[0]!==ftyp || ftyp.end - ftyp.data < 12 || (ftyp.end - ftyp.data) % 4 || top.some(box=>box.type==='moov')) fail()
  const brands = [text(ftyp.data,ftyp.end)]
  for (let p = ftyp.data + 8; p < ftyp.end; p += 4) brands.push(text(p,ftyp.end))
  if (!brands.includes('avif') || brands.includes('avis') || number(meta.data,4,meta.end)!==0) fail()
  const children = boxes(meta.data + 4,meta.end), hdlr=one(children,'hdlr'), pitm=one(children,'pitm')
  if (text(hdlr.data + 8,hdlr.end)!=='pict') fail()
  const primaryVersion=number(pitm.data,1,pitm.end)
  if (primaryVersion>1) fail()
  const primary=number(pitm.data+4,primaryVersion===0?2:4,pitm.end)
  const iinf=one(children,'iinf'), infoVersion=number(iinf.data,1,iinf.end)
  if (infoVersion>1) fail()
  const countBytes=infoVersion===0?2:4, itemCount=number(iinf.data+4,countBytes,iinf.end)
  const infos=boxes(iinf.data+4+countBytes,iinf.end), items=new Map<number,string>()
  if (!itemCount || itemCount>256 || infos.length!==itemCount) fail()
  for (const entry of infos) {
    const version=number(entry.data,1,entry.end), idBytes=version===2?2:4
    if (entry.type!=='infe' || ![2,3].includes(version)) fail()
    const id=number(entry.data+4,idBytes,entry.end)
    if (!id || items.has(id) || number(entry.data+4+idBytes,2,entry.end)!==0) fail()
    const type=text(entry.data+6+idBytes,entry.end)
    if (!['av01','grid','Exif','mime'].includes(type) || !bytes.subarray(entry.data+10+idBytes,entry.end).includes(0)) fail()
    items.set(id,type)
  }
  const iprp=boxes(one(children,'iprp').data,one(children,'iprp').end)
  const ipco=one(iprp,'ipco'), properties=boxes(ipco.data,ipco.end), associations=new Map<number,Box[]>()
  for (const ipma of iprp.filter(box=>box.type==='ipma')) {
    const version=number(ipma.data,1,ipma.end), flags=number(ipma.data+1,3,ipma.end)
    if (version>1 || flags>1) fail()
    let p=ipma.data+4
    const count=number(p,4,ipma.end); p+=4
    if (count>256) fail()
    for (let i=0;i<count;i++) {
      const id=number(p,version===0?2:4,ipma.end); p+=version===0?2:4
      const n=number(p++,1,ipma.end), selected: Box[]=[]
      if (!items.has(id) || associations.has(id)) fail()
      for (let j=0;j<n;j++) {
        const value=number(p,flags?2:1,ipma.end); p+=flags?2:1
        const index=value & (flags?32767:127)
        if (!index || index>properties.length || selected.includes(properties[index-1])) fail()
        selected.push(properties[index-1])
      }
      associations.set(id,selected)
    }
    if (p!==ipma.end) fail()
  }
  const dimensions = (id: number) => {
    const ispe=one(associations.get(id)??[],'ispe')
    if (ispe.end-ispe.data!==12 || number(ispe.data,4,ispe.end)!==0) fail()
    const width=number(ispe.data+4,4,ispe.end),height=number(ispe.data+8,4,ispe.end)
    if (!width || !height || width*height>maxPixels) fail()
    return {width,height}
  }
  const iloc=one(children,'iloc'), version=number(iloc.data,1,iloc.end)
  if (version>2) fail()
  const sizes=number(iloc.data+4,2,iloc.end),offsetSize=sizes>>12,lengthSize=(sizes>>8)&15,baseSize=(sizes>>4)&15,indexSize=version?sizes&15:0
  if (![offsetSize,lengthSize,baseSize,indexSize].every(size=>[0,4,8].includes(size)) || !lengthSize) fail()
  let p=iloc.data+6, extentBytes=0
  const count=number(p,version<2?2:4,iloc.end);p+=version<2?2:4
  if (count!==items.size) fail()
  const idat=optional(children,'idat'),mdats=top.filter(box=>box.type==='mdat'),payloads=new Map<number,Uint8Array>()
  for (let i=0;i<count;i++) {
    const id=number(p,version<2?2:4,iloc.end);p+=version<2?2:4
    const method=version?number(p,2,iloc.end):0;p+=version?2:0
    if (!items.has(id) || payloads.has(id) || method>1 || number(p,2,iloc.end)!==0) fail()
    p+=2
    const base=number(p,baseSize,iloc.end);p+=baseSize
    const n=number(p,2,iloc.end);p+=2
    if (!n || n>64) fail()
    const chunks: Uint8Array[]=[]
    for (let j=0;j<n;j++) {
      if (indexSize) { if(number(p,indexSize,iloc.end)!==0)fail();p+=indexSize }
      const offset=number(p,offsetSize,iloc.end);p+=offsetSize
      const length=number(p,lengthSize,iloc.end);p+=lengthSize
      const start=base+offset+(method===1?(idat?.data??fail()):0),end=start+length
      if (!length || !Number.isSafeInteger(end) || !(method===1?[idat!]:mdats).some(box=>start>=box.data&&end<=box.end)) fail()
      extentBytes+=length
      if (extentBytes>bytes.length) fail() // Bound allocation even when items reuse the same extents.
      chunks.push(bytes.subarray(start,end))
    }
    const payload=new Uint8Array(chunks.reduce((n,chunk)=>n+chunk.length,0));let at=0
    for (const chunk of chunks) {payload.set(chunk,at);at+=chunk.length}
    payloads.set(id,payload)
  }
  if (p!==iloc.end) fail()
  let codedPixels=0,obuCount=0
  for (const [id,type] of items) if (type==='av01') {
    const size=dimensions(id);codedPixels+=size.width*size.height
    if (codedPixels>maxPixels) fail()
    const config=one(associations.get(id)??[],'av1C')
    if (config.end-config.data<4 || bytes[config.data]!==0x81 || bytes[config.data+1]>>5>2) fail()
    const payload=payloads.get(id)!, types: number[]=[];let at=0
    while (at<payload.length) {
      if (++obuCount>8192) fail()
      const header=payload[at++],type=(header>>3)&15
      if (header&129 || !(header&2) || ![1,2,3,4,5,6,7,15].includes(type)) fail()
      if (header&4) {if(at>=payload.length || payload[at++]&7)fail()}
      let length=0,multiplier=1,ended=false
      for (let n=0;n<8&&at<payload.length;n++) {const b=payload[at++];length+=(b&127)*multiplier;if(!(b&128)){ended=true;break}multiplier*=128}
      if (!ended || !Number.isSafeInteger(length) || at+length>payload.length || (!length&&type!==2&&type!==15)) fail()
      types.push(type);at+=length
    }
    if (types.filter(type=>type===1).length!==1 || !(types.includes(6)||types.includes(3)&&types.includes(4))) fail()
  }
  const result=dimensions(primary),primaryType=items.get(primary)
  if (primaryType==='grid') {
    const grid=payloads.get(primary)!,wide=!!(grid[1]&1),size=wide?4:2
    if (grid.length!==4+size*2 || grid[0]!==0 || grid[1]>1) fail()
    const gridNumber=(at:number)=>grid.subarray(at,at+size).reduce((n,b)=>n*256+b,0)
    if (gridNumber(4)!==result.width || gridNumber(4+size)!==result.height) fail()
    const rows=grid[2]+1,columns=grid[3]+1,iref=one(children,'iref'),refVersion=number(iref.data,1,iref.end)
    if (refVersion>1)fail()
    const idBytes=refVersion===0?2:4
    const refs=boxes(iref.data+4,iref.end).filter(box=>box.type==='dimg'&&number(box.data,idBytes,box.end)===primary)
    const ref=one(refs,'dimg'),n=number(ref.data+idBytes,2,ref.end)
    if (n>256 || n!==rows*columns || ref.data+idBytes+2+n*idBytes!==ref.end) fail()
    let tile: {width:number;height:number}|undefined
    for (let i=0;i<n;i++) {
      const id=number(ref.data+idBytes+2+i*idBytes,idBytes,ref.end)
      if (items.get(id)!=='av01')fail()
      const size=dimensions(id)
      if (tile&&(tile.width!==size.width||tile.height!==size.height))fail()
      tile=size
    }
    if (!tile || result.width>columns*tile.width || result.width<=(columns-1)*tile.width || result.height>rows*tile.height || result.height<=(rows-1)*tile.height) fail()
  } else if (primaryType!=='av01') fail()
  return result
}
