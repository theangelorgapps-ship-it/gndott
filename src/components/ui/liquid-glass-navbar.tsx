'use client'

/** Nimbus UI · Waterline, adapted from the user's supplied component.
 * Original design by guglielmogiannattasio.it. React + WebGL, with a CSS lens
 * fallback. Player controls retain their labels and toggle semantics. */
import * as React from 'react'
import './liquid-glass-navbar.css'

export type NimbusFx = 'plane' | 'drop' | 'spin' | 'glow' | 'wave' | 'pop' | 'none'
export type LiquidNavItem = { label: string; href?: string; icon?: React.ReactNode; fx?: NimbusFx; className?: string; ariaLabel?: string; action?: boolean }
export type LiquidNavbarProps = {
  items: LiquidNavItem[]; active?: number; defaultActive?: number
  onChange?: (index: number, item: LiquidNavItem) => void
  tone?: 'light' | 'dark'; className?: string; style?: React.CSSProperties; label?: string
}
const PAD = 14
const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'
// The supplied Waterline's lens normals, caustics, coloured rim and waves.
const FRAG = `precision highp float;
uniform vec2 uRes;uniform float uDpr;uniform float uTime;uniform vec4 uPill;
uniform vec4 uBlob[6];uniform float uSy[6];uniform vec4 uRip[6];uniform vec3 uMouse;uniform float uDark;uniform float uAmb;
float sdRB(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
float sdCap(vec2 p,vec4 B,float sy){p-=B.xy;p.y/=sy;p.x=max(abs(p.x)-B.z,0.);return(length(p)-B.w)*min(1.,sy);}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float dropD(vec2 p){float d=1e4;for(int i=0;i<6;i++){if(uBlob[i].w>.5){d=smin(d,sdCap(p,uBlob[i],uSy[i]),13.);}}return d;}
float pillD(vec2 p){vec2 h=uPill.zw*.5;return sdRB(p-uPill.xy-h,h,h.y);}
float lens(float d,float w){float t=clamp(-d/w,0.,1.);return sqrt(1.-(1.-t)*(1.-t));}
float waves(vec2 p){float w=0.;
 for(int i=0;i<6;i++){vec4 R=uRip[i];if(R.w>0.){float x=length(p-R.xy)-R.z*240.;w+=R.w*exp(-R.z*1.7)*sin(x*.3)*exp(-x*x/700.);}}
 vec2 m=p-uMouse.xy;w+=uMouse.z*3.6*exp(-dot(m,m)/1000.);
 w+=uAmb*(sin(p.x*.05+uTime*1.2)*.45+sin(p.x*.13-uTime*.85+p.y*.2)*.25);return w;}
float H(vec2 p){float dp=pillD(p);return lens(dp,uPill.w*.36)*2.4+lens(dropD(p),11.)*7.5+waves(p)*smoothstep(0.,7.,-dp);}
float caus(vec2 p,float t){vec2 q=p;float c=0.;for(int i=0;i<3;i++){q+=vec2(sin(q.y*1.1+t),cos(q.x*1.3-t*.7))*.6;c+=1./(1.+16.*abs(sin(q.x)*sin(q.y)));}return c/3.;}
void main(){
 vec2 p=vec2(gl_FragCoord.x,uRes.y*uDpr-gl_FragCoord.y)/uDpr;
 float dp=pillD(p);float dd=dropD(p);
 float h0=H(p);vec3 n=normalize(vec3(h0-H(p+vec2(1.,0.)),h0-H(p+vec2(0.,1.)),1.));
 vec3 V=vec3(0.,0.,1.);
 float spec=pow(max(dot(reflect(-normalize(vec3(-.45,-.8,.85)),n),V),0.),70.);
 float spec2=pow(max(dot(reflect(-normalize(vec3(.6,.75,.7)),n),V),0.),22.)*.3;
 float fres=clamp((1.-n.z)*4.,0.,1.);
 vec3 irid=.5+.5*cos(6.2831*(vec3(0.,.33,.67)+fres*.85+p.x*.0028+uTime*.035));
 float pm=1.-smoothstep(-1.,1.,dp);float dm=(1.-smoothstep(-1.,1.,dd))*(1.-smoothstep(-2.,1.,dp));
 float sh=(1.-smoothstep(-9.,9.,dropD(p-vec2(0.,5.))))*(1.-dm)*pm*(.11+.07*uDark);
 vec3 c=vec3(0.,.14,.36)*sh;float a=sh;
 float pa=clamp(pm*(fres*.5+spec*.9+spec2),0.,1.);
 c=mix(vec3(1.),irid,.5*fres)*pa+c*(1.-pa);a=pa+a*(1.-pa);
 float th=lens(dd,11.);float cs=caus((p+n.xy*th*18.)*.085,uTime*.9);
 vec3 tint=mix(vec3(.80,.95,1.),vec3(.55,.82,1.),uDark);
 float rim=dm*(1.-smoothstep(0.,8.,-dd));
 float cres=dm*smoothstep(.12,.55,dot(n.xy,normalize(vec2(.55,.85))))*smoothstep(0.,3.,-dd);
 float body=.5+.5*clamp(-n.y*3.,-1.,1.);
 float da=dm*(.26+.14*body)*(1.-.35*uDark);vec3 dc=mix(tint,vec3(1.),body*.6);
 float la=rim*.22;vec3 lc=mix(vec3(0.,.42,.78),vec3(.1,.55,.95),uDark);dc=lc*la+dc*da*(1.-la);da=la+da*(1.-la);
 la=clamp(cres*.7+smoothstep(.6,1.,cs)*.28*th*dm,0.,1.);dc=vec3(1.)*la+dc*(1.-la);da=la+da*(1.-la);
 la=clamp(dm*(spec*1.2+spec2*.5),0.,1.);dc=vec3(1.)*la+dc*(1.-la);da=la+da*(1.-la);
 la=dm*smoothstep(-2.,0.,dd)*.4;dc=mix(vec3(1.),irid,.35)*la+dc*(1.-la);da=la+da*(1.-la);
 c=dc+c*(1.-da);a=da+a*(1.-da);gl_FragColor=vec4(c,a);
}`
function renderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false })
  if (!gl) return null
  const resources: WebGLShader[] = []
  const program = gl.createProgram(), buffer = gl.createBuffer()
  const dispose = () => { if (buffer) gl.deleteBuffer(buffer); if (program) gl.deleteProgram(program); resources.forEach(s => gl.deleteShader(s)) }
  const compile = (type: number, text: string) => {
    const shader = gl.createShader(type); if (!shader) throw Error('Shader unavailable')
    resources.push(shader); gl.shaderSource(shader, text); gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error('Shader unavailable')
    return shader
  }
  try {
    if (!program || !buffer) throw Error('Renderer unavailable')
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT)); gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error('Renderer unavailable')
    gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'a'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    const u: Record<string, WebGLUniformLocation | null> = {}
    for (const name of ['uRes','uDpr','uTime','uPill','uBlob','uSy','uRip','uMouse','uDark','uAmb']) u[name] = gl.getUniformLocation(program, name)
    return { gl, u, dispose }
  } catch { dispose(); return null }
}

type Lens = { x: number; tail: number; width: number; target: number; targetWidth: number; cy: number; radius: number; vx: number; vt: number; ready: boolean; selected: boolean }
export function LiquidNavbar({ items, active, defaultActive = -1, onChange, tone = 'dark', className = '', style, label = 'Player information' }: LiquidNavbarProps) {
  const [internal, setInternal] = React.useState(defaultActive)
  const current = active ?? internal
  const id = `waterline-${React.useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const nav = React.useRef<HTMLDivElement>(null), canvas = React.useRef<HTMLCanvasElement>(null), drop = React.useRef<HTMLSpanElement>(null)
  const buttons = React.useRef<(HTMLButtonElement | HTMLAnchorElement | null)[]>([])
  const [hasGL, setHasGL] = React.useState(false)
  const [refract, setRefract] = React.useState(false)
  const [fx, setFx] = React.useState({ index: -1, key: 0 })
  const engine = React.useRef<{ measure(): void; ripple(x: number, y: number): void } | null>(null)
  const live = React.useRef({ current, tone }); live.current = { current, tone }
  React.useEffect(() => {
    const el = nav.current, cv = canvas.current, fallback = drop.current
    if (!el || !cv || !fallback) return
    let drawing = renderer(cv), raf = 0, width = 0, height = 0, last = 0, time = 0, visible = true, disposed = false
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reduce = reduced.matches
    const lens: Lens = { x: 0, tail: 0, width: 0, target: 0, targetWidth: 0, cy: 0, radius: 21, vx: 0, vt: 0, ready: false, selected: false }
    let waves: {x:number;y:number;age:number}[] = []
    setHasGL(!!drawing)
    setRefract(/Chrome\/|Chromium\/|Edg\//.test(navigator.userAgent))
    const paint = () => {
      fallback.style.width = `${lens.width}px`; fallback.style.transform = `translateX(${lens.x - lens.width / 2 - PAD}px)`
      fallback.style.opacity = lens.selected ? '1' : '0'
      if (!drawing || !width || !height) return
      const { gl: g, u } = drawing, dpr = Math.min(window.devicePixelRatio || 1, 2)
      g.viewport(0,0,cv.width,cv.height); g.uniform2f(u.uRes,width+PAD*2,height+PAD*2); g.uniform1f(u.uDpr,dpr)
      g.uniform1f(u.uTime,time);g.uniform4f(u.uPill,PAD,PAD,width,height)
      const blobs = new Float32Array(24), sy = new Float32Array(6).fill(1), ripples = new Float32Array(24)
      if (lens.selected) {
        const q = Math.max(0,lens.width/2-lens.radius), separation = Math.abs(lens.x-lens.tail)
        blobs.set([lens.x,lens.cy,q,lens.radius,lens.tail,lens.cy,q * Math.max(.25,1-separation/200),lens.radius*.84])
        sy[0] = Math.max(.82,1-Math.abs(lens.vx)/7000)
      }
      waves.slice(-6).forEach((r,i)=>ripples.set([r.x,r.y,r.age,1],i*4))
      g.uniform4fv(u.uBlob,blobs);g.uniform1fv(u.uSy,sy);g.uniform4fv(u.uRip,ripples);g.uniform3f(u.uMouse,0,0,0)
      g.uniform1f(u.uDark,live.current.tone==='dark'?1:0);g.uniform1f(u.uAmb,reduce?0:.4)
      g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);g.drawArrays(g.TRIANGLES,0,3)
    }
    const tick = (now: number) => {
      raf = 0
      if (disposed || !visible || document.hidden) return
      const dt = Math.min(last ? (now-last)/1000 : 1/60,1/30);last=now;time+=dt
      if (reduce) { lens.x=lens.tail=lens.target;lens.width=lens.targetWidth;lens.vx=lens.vt=0;waves=[] }
      else {
        lens.vx+=(210*(lens.target-lens.x)-25*lens.vx)*dt;lens.x+=lens.vx*dt
        lens.vt+=(72*(lens.target-lens.tail)-13*lens.vt)*dt;lens.tail+=lens.vt*dt
        lens.width+=(lens.targetWidth-lens.width)*Math.min(1,dt*15)
        waves=waves.map(r=>({...r,age:r.age+dt})).filter(r=>r.age<1.6)
      }
      paint()
      if (!reduce && (Math.abs(lens.x-lens.target)>.1 || Math.abs(lens.tail-lens.target)>.1 || Math.abs(lens.width-lens.targetWidth)>.1 || Math.abs(lens.vx)>1 || Math.abs(lens.vt)>1 || waves.length)) raf=requestAnimationFrame(tick)
      else last=0
    }
    const kick = () => { if(!disposed && !raf && visible && !document.hidden) raf=requestAnimationFrame(tick) }
    const measure = () => {
      width=el.offsetWidth;height=el.offsetHeight
      const item=buttons.current[live.current.current]
      lens.selected=!!item
      if(item){lens.target=PAD+item.offsetLeft+item.offsetWidth/2;lens.targetWidth=item.offsetWidth;lens.radius=item.offsetHeight/2;lens.cy=PAD+item.offsetTop+item.offsetHeight/2}
      if(!lens.ready){lens.x=lens.tail=lens.target;lens.width=lens.targetWidth;lens.ready=true}
      const dpr=Math.min(window.devicePixelRatio||1,2)
      const w=Math.round((width+PAD*2)*dpr),h=Math.round((height+PAD*2)*dpr)
      if(cv.width!==w || cv.height!==h){cv.width=w;cv.height=h;cv.style.width=`${width+PAD*2}px`;cv.style.height=`${height+PAD*2}px`}
      kick()
    }
    engine.current={measure,ripple(x,y){if(!reduce){waves.push({x:x+PAD,y:y+PAD,age:0});waves=waves.slice(-6)}kick()}}
    const ro=new ResizeObserver(measure);ro.observe(el)
    const io=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)kick();else{cancelAnimationFrame(raf);raf=0;last=0}});io.observe(el)
    const visibility=()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0}else kick()}
    const motion=()=>{reduce=reduced.matches;kick()}
    const lost=(e:Event)=>{e.preventDefault();drawing?.dispose();drawing=null;setHasGL(false);kick()}
    const restored=()=>{drawing=renderer(cv);setHasGL(!!drawing);measure()}
    cv.addEventListener('webglcontextlost',lost);cv.addEventListener('webglcontextrestored',restored)
    document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',motion);measure()
    return()=>{disposed=true;engine.current=null;cancelAnimationFrame(raf);ro.disconnect();io.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',motion);cv.removeEventListener('webglcontextlost',lost);cv.removeEventListener('webglcontextrestored',restored);drawing?.dispose()}
  }, [])
  React.useLayoutEffect(()=>engine.current?.measure(),[current,items.length,tone])
  const select=(index:number)=>{const item=items[index];if(!item)return;setFx(f=>({index,key:f.key+1}));if(active===undefined)setInternal(index);onChange?.(index,item)}
  return <div ref={nav} className={`nimbus-nav ${className}`} role="group" aria-label={label} data-tone={tone} data-gl={hasGL?'on':'off'} style={style}
    onPointerDown={e=>{const rect=e.currentTarget.getBoundingClientRect();engine.current?.ripple(e.clientX-rect.left,e.clientY-rect.top)}}
    onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();const at=buttons.current.indexOf(document.activeElement as HTMLButtonElement);const next=e.key==='Home'?0:e.key==='End'?items.length-1:(Math.max(0,at)+(e.key==='ArrowRight'?1:-1)+items.length)%items.length;buttons.current[next]?.focus()}}>
    <svg width="0" height="0" aria-hidden="true" className="nimbus-defs"><defs><filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.006 0.02" numOctaves="2" seed="7" result="noise"/><feGaussianBlur in="noise" stdDeviation="2" result="soft"/><feDisplacementMap in="SourceGraphic" in2="soft" scale="26" xChannelSelector="R" yChannelSelector="G"/></filter></defs></svg>
    <span className="nimbus-glass" aria-hidden="true" style={refract?{backdropFilter:`url(#${id}) blur(2px) saturate(1.2) brightness(1.08)`}:undefined}/>
    <canvas className="nimbus-water" ref={canvas} aria-hidden="true"/><span className="nimbus-drop" ref={drop} aria-hidden="true"/>
    {items.map((item,index)=>{const content=<>{item.icon&&<span className="nv-ico" key={fx.index===index?fx.key:0} data-fx={fx.index===index?item.fx??'pop':undefined}>{item.icon}</span>}<span className="nimbus-label">{item.label}</span></>;const shared={className:`nimbus-item ${item.className??''}`,'aria-label':item.ariaLabel??item.label,onClick:()=>select(index)};return item.href?<a {...shared} key={item.label} ref={el=>{buttons.current[index]=el}} href={item.href} aria-current={current===index?'page':undefined}>{content}</a>:<button {...shared} key={item.label} ref={el=>{buttons.current[index]=el}} type="button" aria-pressed={item.action?undefined:current===index}>{content}</button>})}
  </div>
}
export { LiquidNavbar as Component }
export default LiquidNavbar
