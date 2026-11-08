import {createFileRoute} from '@tanstack/react-router'
import {finishSocialSignIn} from '../lib/oauth.server'
export const Route=createFileRoute('/auth/$provider/callback')({server:{handlers:{GET:({request,params})=>finishSocialSignIn(request,params.provider),POST:({request,params})=>finishSocialSignIn(request,params.provider)}}})
