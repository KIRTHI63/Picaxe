'use client';
import React from 'react';
import { MatchHighlight } from './MatchHighlight';
import { Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MediaItem {
  id: string;
  url: string;
  isMatch: boolean;
  type: 'photo' | 'certificate';
}

interface PhotoGridProps {
  items: MediaItem[];
  title?: string;
  meta?: string;
  className?: string;
}

export function PhotoGrid({ items, title, meta, className }: PhotoGridProps) {
  const hasMatches = items.some(item => item.isMatch);

  return (
    <div className={cn('w-full flex flex-col gap-5', className)}>
      {(title || meta) && (
        <div className="border-b border-surface-border pb-4 flex justify-between items-end">
          {title && <h2 className="font-sans font-semibold text-xl text-bone tracking-tight">{title}</h2>}
          {meta && <span className="font-mono text-[10px] text-ash uppercase tracking-widest">{meta}</span>}
        </div>
      )}
      <div className={cn('grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4', hasMatches && 'group/grid')}>
        {items.map((item, idx) => (
          <div
            key={item.id}
            className={cn('aspect-[4/3] w-full', !item.isMatch && hasMatches && 'group-hover/grid:opacity-40 transition-opacity duration-300')}
          >
            <MatchHighlight isMatched={item.isMatch} delay={idx * 40} className="w-full h-full">
              {item.url ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="block w-full h-full bg-basalt">
                  <img
                    src={item.url}
                    alt={item.isMatch ? `Matched ${item.type}` : item.type}
                    className="w-full h-full object-cover"
                  />
                </a>
              ) : (
                <div
                  className="w-full h-full bg-basalt flex items-center justify-center"
                  role="img"
                  aria-label={item.isMatch ? `Matched ${item.type}` : item.type}
                >
                  <ImageIcon className="w-5 h-5 text-ash/20" aria-hidden="true" />
                </div>
              )}
            </MatchHighlight>
          </div>
        ))}
      </div>
    </div>
  );
}
