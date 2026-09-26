import React from 'react';

interface ChartSkeletonProps {
  height?: number;
  className?: string;
}

export const ChartSkeleton: React.FC<ChartSkeletonProps> = ({ height, className = '' }) => (
  <div
    className={`animate-pulse ${className}`}
    style={height !== undefined ? { height } : undefined}
  >
    <div className="flex h-full min-h-[120px] items-end gap-1.5 px-2 pb-2">
      {Array.from({ length: 14 }).map((_, i) => (
        <div
          key={i}
          className="flex-1 rounded-t bg-slate-200 dark:bg-slate-700"
          style={{ height: `${22 + (i % 5) * 12}%` }}
        />
      ))}
    </div>
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number; className?: string }> = ({
  rows = 5,
  className = '',
}) => (
  <div className={`animate-pulse space-y-2 ${className}`}>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-3">
        <div className="h-4 w-6 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 flex-1 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 w-12 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    ))}
  </div>
);
