import { env } from 'cloudflare:workers'

type Row = Record<string, any>

function db(): any {
  return (env as any).DB
}

export async function all<T = Row>(sql: string, ...params: any[]): Promise<T[]> {
  const res = await db().prepare(sql).bind(...params).all()
  return (res.results ?? []) as T[]
}

export async function first<T = Row>(sql: string, ...params: any[]): Promise<T | null> {
  const res = await db().prepare(sql).bind(...params).first()
  return (res as T) ?? null
}

export async function run(sql: string, ...params: any[]): Promise<any> {
  return db().prepare(sql).bind(...params).run()
}
