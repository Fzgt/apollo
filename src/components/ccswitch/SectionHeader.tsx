import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  align?: 'center' | 'left';
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  children?: ReactNode;
}

const alignClass = {
  center: 'text-center',
  left: 'text-left',
} as const;

export function SectionHeader({
  title,
  subtitle,
  align = 'center',
  className,
  titleClassName,
  subtitleClassName,
  children,
}: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.6 }}
      className={cn(alignClass[align], 'mb-12 md:mb-16', className)}
    >
      <h2
        className={cn(
          'text-display-md text-foreground mb-4 md:mb-6',
          titleClassName,
        )}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={cn(
            'text-base sm:text-lg md:text-xl text-muted-foreground',
            subtitleClassName,
          )}
        >
          {subtitle}
        </p>
      )}
      {children}
    </motion.div>
  );
}
