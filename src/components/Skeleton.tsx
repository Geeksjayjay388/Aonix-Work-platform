import React from 'react';

interface SkeletonProps {
  className?: string;
  count?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`skeleton ${className}`} />
      ))}
    </>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 3, cols = 4 }) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="p-10">
              <Skeleton className="h-6 rounded-2xl w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="glass-card p-6 space-y-4">
      <Skeleton className="h-6 w-1/3 rounded" />
      <Skeleton className="h-4 w-full rounded" />
      <Skeleton className="h-4 w-2/3 rounded" />
    </div>
  );
};

export default Skeleton;
