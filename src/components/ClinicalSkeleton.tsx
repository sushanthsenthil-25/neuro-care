import React from 'react';

export const ClinicalSkeleton: React.FC = () => {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Patient Header Skeleton */}
      <div className="clinical-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200"></div>
            <div className="space-y-1.5">
              <div className="w-48 h-5 bg-slate-200 rounded"></div>
              <div className="w-64 h-3.5 bg-slate-200 rounded"></div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-20 h-12 bg-slate-200 rounded-lg"></div>
            <div className="w-20 h-12 bg-slate-200 rounded-lg"></div>
          </div>
        </div>
      </div>

      {/* Vital Cards Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="clinical-card p-4 space-y-3">
            <div className="flex justify-between">
              <div className="w-24 h-4 bg-slate-200 rounded"></div>
              <div className="w-10 h-4 bg-slate-200 rounded"></div>
            </div>
            <div className="w-16 h-8 bg-slate-200 rounded"></div>
            <div className="w-full h-12 bg-slate-100 rounded"></div>
          </div>
        ))}
      </div>

      {/* Chart Skeleton */}
      <div className="clinical-card p-5 h-64 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center">
        <span className="text-xs font-mono text-slate-400">Loading Clinical Telemetry Trends...</span>
      </div>
    </div>
  );
};
