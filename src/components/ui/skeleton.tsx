import {cn} from '@/lib/utils'
export function Skeleton({className,...props}:React.ComponentProps<'div'>){return <div className={cn('rte-skeleton animate-pulse',className)} {...props}/>}
