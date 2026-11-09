export type HeroDevice = 'phone' | 'tablet' | 'web' | 'app'
export type HeroFrame = { image?: string; x: number; y: number; fit: 'cover' | 'contain'; align: 'left' | 'center' | 'right' }
export type HeroDesign = { version: 1; devices: Partial<Record<HeroDevice, HeroFrame>> }
export function parseHeroDesign(value: unknown): HeroDesign | undefined {
  try {
    const design = typeof value === 'string' ? JSON.parse(value) : value
    if (!design || design.version !== 1 || !design.devices || typeof design.devices !== 'object' || Array.isArray(design.devices)) return
    const devices: HeroDesign['devices'] = {}
    for (const key of ['phone', 'tablet', 'web', 'app'] as const) {
      const f = design.devices[key]
      if (!f || !Number.isFinite(f.x) || !Number.isFinite(f.y) || f.x < 0 || f.x > 100 || f.y < 0 || f.y > 100 || !['cover', 'contain'].includes(f.fit) || !['left', 'center', 'right'].includes(f.align)) continue
      if (f.image) {
        if (typeof f.image !== 'string' || f.image.length > 2048) continue
        if (f.image.startsWith('/media/')) { if (!/^\/media\/[a-zA-Z0-9_./-]+$/.test(f.image) || f.image.includes('..')) continue }
        else { try { const url = new URL(f.image); if (url.protocol !== 'https:' || url.username || url.password) continue } catch { continue } }
      }
      devices[key] = { image: f.image || '', x: f.x, y: f.y, fit: f.fit, align: f.align }
    }
    return { version: 1, devices }
  } catch { return }
}
