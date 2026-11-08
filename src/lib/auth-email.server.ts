// Cloudflare Email Service Workers binding. No SMTP/REST credentials reach the client.
type EmailBinding = { send(message: { from: string; to: string; subject: string; text: string }): Promise<unknown> }
export function cloudflareOTPSender(binding?: EmailBinding, from?: string, enabled = false) {
  if (!enabled || !binding || !from || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(from)) return undefined
  return async ({ email, otp, type }: { email: string; otp: string; type: string }) => {
    const purpose = type === 'sign-in' ? 'sign-in' : type === 'forget-password' ? 'password reset' : type === 'email-verification' ? 'email verification' : null
    if (!purpose || !/^\d{6}$/.test(otp) || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new Error('Invalid authentication message.')
    await binding.send({ from, to: email, subject: `Your Halobox ${purpose} code`, text: `Your Halobox ${purpose} code is ${otp}. It expires in 5 minutes. Never share this code. If you did not request it, ignore this email.` })
  }
}
