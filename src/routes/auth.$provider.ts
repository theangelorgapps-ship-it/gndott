import {createFileRoute} from '@tanstack/react-router'
import {startSocialSignIn} from '../lib/oauth.server'
export const Route=createFileRoute('/auth/$provider')({server:{handlers:{GET:({request,params})=>startSocialSignIn(request,params.provider)}}})
