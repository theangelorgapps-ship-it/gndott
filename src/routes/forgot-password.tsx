import {createFileRoute,Link} from '@tanstack/react-router'
import {AuthShell} from './login'
export const Route=createFileRoute('/forgot-password')({component:ForgotPassword})
function ForgotPassword(){return <AuthShell title="Need help signing in?" description="Use the same email and password as your previous Halobox account. Your profiles and subscriptions remain connected to it."><p className="tv-flow-message">If you cannot remember your password, contact Halobox support for help restoring access. Automatic password reset emails are currently unavailable.</p><a className="btn btn-primary auth-btn" href="mailto:Hello@halobox.tv?subject=Halobox%20account%20access">Contact support</a><p className="auth-alt"><Link to="/login">Back to sign in</Link></p></AuthShell>}
