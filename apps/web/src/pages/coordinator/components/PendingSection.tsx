import { useState } from 'react';

interface PendingJob {
  id: string;
  status: string;
  urgencyLevel: string;
  property: { unitNumber: string; condominium: { name: string } };
  assignments: { cleaner: { name: string } }[];
}

interface Props {
  jobs: PendingJob[];
  onResolve: (job: PendingJob) => void;
}

const REASON_BADGE: Record<string, string> = {
  STAND_BY: 'Hóspede presente',
  PARTIAL: 'Não finalizou',
};

export default function PendingSection({ jobs, onResolve }: Props) {
  const [open, setOpen] = useState(true);

  if (jobs.length === 0) return null;

  return (
    <div className="rounded-xl overflow-hidden border border-amber-200">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 hover:bg-amber-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>⚠️</span>
          <span className="font-semibold text-amber-800 text-sm">Pendências não resolvidas</span>
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {jobs.length}
          </span>
        </div>
        <span className="text-amber-600 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {/* Content */}
      {open && (
        <div className="bg-white divide-y divide-gray-100">
          {jobs.map(job => (
            <div key={job.id} className="flex items-center gap-3 px-4 py-3">
              <span className="text-lg">⏸️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">
                  Apt {job.property.unitNumber} · {job.property.condominium.name}
                </p>
                <p className="text-xs text-gray-500">
                  {job.assignments[0]?.cleaner?.name ?? 'Sem empregada'}
                </p>
              </div>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-semibold flex-shrink-0">
                {REASON_BADGE[job.status] ?? job.status}
              </span>
              <button
                onClick={() => onResolve(job)}
                className="text-xs bg-[#0D7377] text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-[#0B5563] transition-colors flex-shrink-0"
              >
                Resolver
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
