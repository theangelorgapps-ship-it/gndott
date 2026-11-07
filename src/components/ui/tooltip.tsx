import * as React from 'react'
import * as Primitive from '@radix-ui/react-tooltip'
import {cn} from '@/lib/utils'
export const Tooltip=Primitive.Root,TooltipTrigger=Primitive.Trigger,TooltipProvider=Primitive.Provider
export const TooltipContent=React.forwardRef<React.ElementRef<typeof Primitive.Content>,React.ComponentPropsWithoutRef<typeof Primitive.Content>>(({className,sideOffset=6,...props},ref)=><Primitive.Portal container={typeof document==='undefined'?undefined:document.fullscreenElement||document.querySelector('dialog[open]')||undefined}><Primitive.Content ref={ref} sideOffset={sideOffset} className={cn('rte-tooltip',className)} {...props}/></Primitive.Portal>);TooltipContent.displayName='TooltipContent'
