import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/axios';

type ReimburseFilter = 'ALL' | 'OPEN' | 'CLOSED';

interface ReimbursementPeriod {
  id: string;
  month: string;
  status: string;
  totalAmount: number;
  cleaner: { id: string; name: string; avatarUrl: string | null };
  _count?: { transportRecords: number };
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

export default function Reimbursements() {
  const [filter, setFilter] = useState<ReimburseFilter>('ALL');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [detailId, setDetailId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: periods = [], isLoading } = useQuery<ReimbursementPeriod[]>({
    queryKey: ['reimbursements', selectedMonth, filter],
    queryFn: () => {
      const params: Record<string, string> = { month: selectedMonth };
      if (filter !== 'ALL') params.status = filter;
      return api.get('/transport/reimbursements', { params }).then(r => r.data).catch(() => []);
    },
  });

  const payMutation = useMutation({
    mutationFn: (id: string) => api.post(`/transport/reimbursements/${id}/pay`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reimbursements'] }),
  });

  const totalGeral = periods.reduce((sum, p) => sum + (p.totalAmount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Reembolsos</h1>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5563]"
          />
          <button className="text-sm text-[#0B5563] border border-[#0B5563] px-3 py-1.5 rounded-lg hover:bg-[#0B5563] hover:text-white transition-colors">
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Chip filters */}
      <div className="flex gap-2">
        {(['ALL', 'OPEN', 'CLOSED'] as ReimburseFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filter === f ? 'bg-[#0B5563] text-white border-transparent' : 'bg-white border-gray-200 text-gray-600'
            }`}
          >
            {f === 'ALL' ? 'Todos' : f === 'OPEN' ? 'Pendente' : 'Pago'}
          </button>
        ))}
      </div>

      {isLoading && <div className="text-gray-400 text-center py-12">Carregando...</div>}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Empregada</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Corridas</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Total R$</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Status</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {periods.map(p => (
              <tr key={p.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {initials(p.cleaner.name)}
                    </div>
                    <span className="font-medium text-gray-800">{p.cleaner.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-gray-600">{p._count?.transportRecords ?? '—'}</td>
                <td className="px-4 py-3 text-right font-bold text-gray-800">
                  R$ {(p.totalAmount ?? 0).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                    p.status === 'CLOSED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {p.status === 'CLOSED' ? 'Pago' : 'Pendente'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => setDetailId(p.id)}
                      className="text-xs text-[#0B5563] hover:underline"
                    >
                      Ver
                    </button>
                    {p.status !== 'CLOSED' && (
                      <button
                        onClick={() => payMutation.mutate(p.id)}
                        disabled={payMutation.isPending}
                        className="text-xs bg-green-600 text-white px-2 py-1 rounded font-semibold hover:bg-green-700 disabled:opacity-50"
                      >
                        Pagar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && periods.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">Nenhum reembolso encontrado</td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-gray-50 border-t">
            <tr>
              <td className="px-4 py-3 font-semibold text-gray-700" colSpan={2}>Total</td>
              <td className="px-4 py-3 text-right font-bold text-gray-800">R$ {totalGeral.toFixed(2)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Detail modal */}
      {detailId && (
        <ReimbursementDetailModal periodId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}

function ReimbursementDetailModal({ periodId, onClose }: { periodId: string; onClose: () => void }) {
  const { data: records = [], isLoading } = useQuery({
    queryKey: ['reimbursement-records', periodId],
    queryFn: () => api.get(`/transport/reimbursements/${periodId}/records`).then(r => r.data).catch(() => []),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Detalhes das corridas</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && <p className="text-gray-400 text-center py-8">Carregando...</p>}
          {records.length === 0 && !isLoading && <p className="text-gray-400 text-center py-8">Nenhuma corrida encontrada</p>}
          <div className="space-y-2">
            {records.map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{r.transportType}</p>
                  <p className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
                <span className="font-bold text-gray-800 text-sm">
                  {r.amount ? `R$ ${Number(r.amount).toFixed(2)}` : '—'}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  r.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {r.status === 'APPROVED' ? 'OK' : 'Pendente'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
