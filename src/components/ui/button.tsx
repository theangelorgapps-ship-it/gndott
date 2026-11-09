import * as React from 'react'
import {Slot} from '@radix-ui/react-slot'
import {cn} from '@/lib/utils'
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>{asChild?:boolean;variant?:string;size?:string}
export const Button=React.forwardRef<HTMLButtonElement,ButtonProps>(({asChild,className,variant,size,type='button',...props},ref)=>{const Comp=asChild?Slot:'button';return <Comp ref={ref} type={type} className={cn('rte-button',className)} {...props}/>});Button.displayName='Button'
