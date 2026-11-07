import * as React from 'react'
import * as Primitive from '@radix-ui/react-toggle'
import {cn} from '@/lib/utils'
export const Toggle=React.forwardRef<React.ElementRef<typeof Primitive.Root>,React.ComponentPropsWithoutRef<typeof Primitive.Root>&{size?:string;variant?:string}>(({className,size,variant,...props},ref)=><Primitive.Root ref={ref} className={cn('rte-toggle',className)} {...props}/>);Toggle.displayName='Toggle'
