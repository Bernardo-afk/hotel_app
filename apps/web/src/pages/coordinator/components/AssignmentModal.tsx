import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/axios';

interface SuggestedCleaner {
  cleaner: { id: string; name: string; avatarUrl: string | null };
  available: boolean;
  activeJobs: number;
  distanceKm: number;
}

interface Props {
  job: {
    id: string;
    urgencyLevel: string;
    property: { unitNumber: string; condominium: { name: string } };
  };
  onClose: () => void;
  onAssigned: () => void;
}

const URGENCY_BADGE: Record<string, string> = {
  RED: 'bg-red-100 text-red-700',
  YELLOW: 'bg-yellow-100 text-yellow-700',
  GREEN: 'bg-green-100 text-green-700',
};

export default function AssignmentModal({ job, onClose, onAssigned }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: suggestions = [], isLoading } = useQuery<SuggestedCleaner[]>({
    queryKey: ['suggest', job.id],
    queryFn: () => api.get(`/assignments/suggest/${job.id}`).then(r => r.data),
  });

  const assignMutation = useMutation({
    mutationFn: (body: { jobId: string; cleanerId: string; isJoint: boolean }) =>
      api.post('/assignments', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coordinator-dashboard'] });
      onAssigned();
      onClose();
    },
  });

  const suggested = suggestions[0];
  const rest = suggestions.slice(1);
  const chosenId = selectedId ?? suggested?.cleaner.id ?? null;

  function initials(name: string) {
    return name
      .split(' ')
      .slice(0, 2)
      .map(p => p[0])
      .join('')
      .toUpperCase();
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b flex items-start justify-between">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">Atribuir limpeza</h2>
            <p className="text-sm text-gray-500">
              Apt {job.property.unitNumber} · {job.property.condominium.name}
            </p>
          </div>
          <span
            className={`text-xs font-bold px-2 py-1 rounded-full ${
              URGENCY_BADGE[job.urgencyLevel] ?? 'bg-gray-100 text-gray-500'
            }`}
          >
            {job.urgencyLevel === 'RED'
              ? '🔴 Urgente'
              : job.urgencyLevel === 'YELLOW'
              ? '🟡 Atenção'
              : '🟢 Tranquilo'}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {isLoading && (
            <p className="text-sm text-gray-400 text-center py-4">Buscando sugestões...</p>
          )}

          {/* Suggestion banner */}
          {suggested && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700 flex items-center gap-2">
              <span>✨</span>
              <span>
                Sistema sugere <strong>{suggested.cleaner.name}</strong> — mais próxima e
                disponível
              </span>
            </div>
          )}

          {/* Suggested cleaner */}
          {suggested && (
            <button
              onClick={() => setSelectedId(suggested.cleaner.id)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-[#0D7377] bg-green-50 transition-all text-left"
            >
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                {initials(suggested.cleaner.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm">{suggested.cleaner.name}</p>
                <p className="text-xs text-gray-500">
                  {suggested.distanceKm.toFixed(1)}km · ~{Math.round(suggested.distanceKm * 3)}
                  min · {suggested.activeJobs} apts hoje
                </p>
              </div>
              <span className="bg-[#0D7377] text-white text-xs px-2 py-1 rounded-full font-semibold flex-shrink-0">
                Sugerida
              </span>
            </button>
          )}

          {/* Other cleaners */}
          {rest.map(s => (
            <button
              key={s.cleaner.id}
              onClick={() => (s.available ? setSelectedId(s.cleaner.id) : undefined)}
              disabled={!s.available}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                !s.available
                  ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                  : chosenId === s.cleaner.id
                  ? 'border-[#0D7377] bg-teal-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                {initials(s.cleaner.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm">{s.cleaner.name}</p>
                <p className="text-xs text-gray-500">
                  {s.available
                    ? `${s.distanceKm.toFixed(1)}km · ~${Math.round(s.distanceKm * 3)}min · ${s.activeJobs} apts hoje`
                    : 'Indisponível'}
                </p>
              </div>
              {s.available ? (
                <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-5 border-t flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!chosenId) return;
              assignMutation.mutate({ jobId: job.id, cleanerId: chosenId, isJoint: false });
            }}
            disabled={!chosenId || assignMutation.isPending}
            className="flex-[2] py-2 rounded-lg bg-[#0D7377] text-white text-sm font-semibold hover:bg-[#0B5563] disabled:opacity-50 transition-colors"
          >
            {assignMutation.isPending
              ? 'Atribuindo...'
              : `Atribuir ${suggested?.cleaner.name ?? ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
