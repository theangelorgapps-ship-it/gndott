import * as React from 'react'
import * as Primitive from '@radix-ui/react-popover'
import {cn} from '@/lib/utils'
export const Popover=Primitive.Root,PopoverTrigger=Primitive.Trigger
export const PopoverContent=React.forwardRef<React.ElementRef<typeof Primitive.Content>,React.ComponentPropsWithoutRef<typeof Primitive.Content>>(({className,sideOffset=6,...props},ref)=><Primitive.Portal container={typeof document==='undefined'?undefined:document.fullscreenElement||document.querySelector('dialog[open]')||undefined}><Primitive.Content ref={ref} sideOffset={sideOffset} className={cn('rte-popover',className)} {...props}/></Primitive.Portal>);PopoverContent.displayName='PopoverContent'
