import * as React from 'react'
import * as Primitive from '@radix-ui/react-separator'
import {cn} from '@/lib/utils'
export const Separator=React.forwardRef<React.ElementRef<typeof Primitive.Root>,React.ComponentPropsWithoutRef<typeof Primitive.Root>>(({className,...props},ref)=><Primitive.Root ref={ref} className={cn('rte-separator',className)} {...props}/>);Separator.displayName='Separator'
