import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/axios';

interface Property {
  id: string;
  unitNumber: string;
  status: 'ACTIVE' | 'BLOCKED' | 'MAINTENANCE';
  icalUrl: string | null;
  lastSyncAt: string | null;
  condominium: { id: string; name: string };
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Ativo', cls: 'bg-green-100 text-green-700' },
  BLOCKED: { label: 'Bloqueado', cls: 'bg-purple-100 text-purple-700' },
  MAINTENANCE: { label: 'Manutenção', cls: 'bg-amber-100 text-amber-700' },
};

export default function Properties() {
  const [blockModal, setBlockModal] = useState<Property | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const qc = useQueryClient();

  const { data: properties = [], isLoading } = useQuery<Property[]>({
    queryKey: ['properties'],
    queryFn: () => api.get('/properties').then(r => r.data).catch(() => []),
  });

  const blockMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/properties/${id}/block`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); setBlockModal(null); setBlockReason(''); },
  });

  const unblockMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/properties/${id}/unblock`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });

  const condominiums = [...new Set(properties.map(p => p.condominium.name))];
  const [condoFilter, setCondoFilter] = useState('ALL');
  const filtered = condoFilter === 'ALL' ? properties : properties.filter(p => p.condominium.name === condoFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Propriedades</h1>
        <button className="text-sm bg-[#0B5563] text-white px-4 py-2 rounded-lg hover:bg-[#0D7377] transition-colors">
          + Novo apt
        </button>
      </div>

      {/* Condominium chips */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setCondoFilter('ALL')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            condoFilter === 'ALL' ? 'bg-[#0B5563] text-white border-transparent' : 'bg-white border-gray-200 text-gray-600'
          }`}
        >
          Todos
        </button>
        {condominiums.map(c => (
          <button
            key={c}
            onClick={() => setCondoFilter(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              condoFilter === c ? 'bg-[#0B5563] text-white border-transparent' : 'bg-white border-gray-200 text-gray-600'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {isLoading && <div className="text-gray-400 text-center py-12">Carregando...</div>}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Condomínio</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Apt</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">iCal</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Status</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(p => {
              const badge = STATUS_BADGE[p.status] ?? { label: p.status, cls: 'bg-gray-100 text-gray-500' };
              const hasICal = !!p.icalUrl;
              return (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-gray-700">{p.condominium.name}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{p.unitNumber}</td>
                  <td className="px-4 py-3 text-center">
                    {hasICal ? (
                      <span className="text-green-600 text-xs font-semibold">✓ Conectado</span>
                    ) : (
                      <span className="text-red-500 text-xs font-semibold">✗ Sem iCal</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${badge.cls}`}>{badge.label}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {p.status === 'BLOCKED' ? (
                        <button
                          onClick={() => unblockMutation.mutate(p.id)}
                          disabled={unblockMutation.isPending}
                          className="text-xs text-green-600 hover:underline disabled:opacity-50"
                        >
                          Desbloquear
                        </button>
                      ) : (
                        <button
                          onClick={() => setBlockModal(p)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Bloquear
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Nenhuma propriedade</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Block modal */}
      {blockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setBlockModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-gray-800 mb-1">Bloquear apt {blockModal.unitNumber}</h2>
            <p className="text-sm text-gray-500 mb-4">{blockModal.condominium.name}</p>
            <textarea
              value={blockReason}
              onChange={e => setBlockReason(e.target.value)}
              placeholder="Motivo do bloqueio..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#0B5563] resize-none"
              rows={3}
            />
            <div className="flex gap-2">
              <button onClick={() => setBlockModal(null)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600">Cancelar</button>
              <button
                onClick={() => blockMutation.mutate({ id: blockModal.id, reason: blockReason })}
                disabled={!blockReason.trim() || blockMutation.isPending}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                Bloquear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
