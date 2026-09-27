export function StackFeedSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <ul className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="px-3 py-3 space-y-2">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-[90%]" />
          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-[70%]" />
          <div className="flex gap-2">
            <div className="h-5 w-14 bg-slate-100 dark:bg-slate-800 rounded-full" />
            <div className="h-5 w-10 bg-slate-100 dark:bg-slate-800 rounded" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function StackDetalheSkeleton() {
  return (
    <div className="flex-1 p-4 space-y-4 animate-pulse min-h-0 overflow-hidden">
      <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
      <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
      <div className="space-y-2 pt-4">
        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded" />
        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded" />
        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-5/6" />
      </div>
    </div>
  );
}
