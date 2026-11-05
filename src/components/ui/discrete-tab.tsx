"use client";

import { useId, type ComponentType, type SVGProps } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export interface DiscreteTabItem {
  id: string;
  title: string;
  icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
}

interface DiscreteTabsProps {
  items: DiscreteTabItem[];
  active: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
}

export function DiscreteTabs({
  items,
  active,
  onChange,
  ariaLabel = "Content sections",
}: DiscreteTabsProps) {
  const groupId = useId();
  const reduceMotion = useReducedMotion();

  return (
    <div className="discrete-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((tab) => {
        const isActive = active === tab.id;
        const ButtonIcon = tab.icon;

        return (
          <motion.button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-pressed={isActive}
            title={tab.title}
            onClick={() => onChange(tab.id)}
            className={cn("discrete-tab", isActive && "active")}
            layout
            transition={{
              layout: reduceMotion
                ? { duration: 0 }
                : { type: "spring", damping: 24, stiffness: 260, mass: 1 },
            }}
          >
            <motion.span
              layoutId={`${groupId}-icon-${tab.id}`}
              className="discrete-tab-icon"
              aria-hidden="true"
            >
              <ButtonIcon size={19} />
            </motion.span>
            <AnimatePresence initial={false} mode="popLayout">
              {isActive && (
                <motion.span
                  key="label"
                  className="discrete-tab-label"
                  initial={reduceMotion ? false : { opacity: 0, x: -4, filter: "blur(4px)" }}
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  exit={reduceMotion ? { opacity: 1 } : { opacity: 0, x: -3, filter: "blur(3px)" }}
                  transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.2, 0, 0, 1] }}
                >
                  {tab.title}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        );
      })}
    </div>
  );
}

export default DiscreteTabs;
