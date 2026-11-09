import {useEffect,useRef,useState} from 'react'
import {Camera} from 'lucide-react'
import {useRouter} from '@tanstack/react-router'
import {getViewerState} from '@/lib/viewer'
import {uploadProfilePhoto} from '@/lib/imageUpload'
export function ProfilePhoto(){
 const [avatar,setAvatar]=useState(''),[name,setName]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[ready,setReady]=useState(false),[preview,setPreview]=useState('');const input=useRef<HTMLInputElement>(null);const router=useRouter()
 useEffect(()=>{let live=true;getViewerState().then(data=>{if(!live)return;const profile=data?.profiles.find(p=>p.id===data.viewer.profileId);setAvatar(profile?.avatar||'');setName(profile?.name||'');setReady(!!profile)}).catch(()=>setStatus('Could not load your profile.'));return()=>{live=false}},[])
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview])
 async function upload(file?:File){if(!file||busy)return;if(file.size>8*1024*1024){setStatus('Choose an image smaller than 8 MB.');return}setBusy(true);setStatus('Saving your photo…');setPreview(URL.createObjectURL(file));try{const data=new FormData();data.set('image',file);const result=await uploadProfilePhoto({data});setAvatar(result.url);setPreview('');setStatus('Profile photo updated.');window.dispatchEvent(new Event('halobox-profile-updated'));await router.invalidate()}catch(e){setPreview('');setStatus(e instanceof Error?e.message:'Could not upload this photo. Try again.')}finally{setBusy(false);if(input.current)input.current.value=''}}
 return <section className="avatar-editor" aria-label="Profile photo">{preview||avatar?<img src={preview||avatar} alt={`${name||'Your'} profile`}/>:<span className="avatar-editor-placeholder">{name.slice(0,1)||'?'}</span>}<div><input ref={input} id="profile-photo-upload" type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden disabled={busy||!ready} onChange={e=>upload(e.target.files?.[0])}/><button type="button" className="library-action" disabled={busy||!ready} onClick={()=>input.current?.click()}><Camera size={17}/> {busy?'Saving…':'Change photo'}</button><p>JPG, PNG, WebP or AVIF · up to 8 MB</p><p role="status">{status||(!ready?'Choose a profile to update its photo.':'Your photo is saved to this profile.')}</p></div></section>
}
