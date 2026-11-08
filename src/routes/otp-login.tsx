import {createFileRoute,Link} from '@tanstack/react-router'
import {AuthShell} from './login'
export const Route=createFileRoute('/otp-login')({component:OtpLogin})
function OtpLogin(){return <AuthShell title="Sign in securely." description="Sign-in codes are currently unavailable. Use your existing email and password to access your account."><Link to="/login" className="btn btn-primary auth-btn">Sign in with email</Link><p className="auth-alt">Need help? <a href="mailto:Hello@halobox.tv">Contact Halobox support</a></p></AuthShell>}
