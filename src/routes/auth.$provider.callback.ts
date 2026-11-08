import {createFileRoute} from '@tanstack/react-router'
// Legacy OAuth challenges cannot mint sessions after the Better Auth cutover.
export const Route=createFileRoute('/auth/$provider/callback')({server:{handlers:{GET:()=>Response.redirect('https://halobox.tv/login',302),POST:()=>Response.redirect('https://halobox.tv/login',303)}}})
