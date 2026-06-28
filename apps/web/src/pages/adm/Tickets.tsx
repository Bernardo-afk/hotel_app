import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/axios';

type TicketFilter = 'ALL' | 'URGENT' | 'MEDIUM' | 'OPEN' | 'BLOCKED' | 'WONT_FIX';
type TicketStatus = 'OPEN' | 'PENDING_UNTIL' | 'INDETERMINATE' | 'WONT_FIX' | 'RESOLVED';

interface Ticket {
  id: string;
  description: string;
  status: TicketStatus;
  createdAt: string;
  property: { id: string; unitNumber: string; condominium: { name: string } };
}

const CHIP_FILTERS: { value: TicketFilter; label: string; cls: string }[] = [
  { value: 'ALL', label: 'Todos', cls: 'bg-gray-100 text-gray-700' },
  { value: 'URGENT', label: 'Urgente', cls: 'bg-red-100 text-red-700' },
  { value: 'MEDIUM', label: 'Médio', cls: 'bg-amber-100 text-amber-700' },
  { value: 'OPEN', label: 'Aberto', cls: 'bg-blue-100 text-blue-700' },
  { value: 'WONT_FIX', label: 'Não resolve', cls: 'bg-red-100 text-red-700' },
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  OPEN: { label: 'Aberto', cls: 'bg-blue-100 text-blue-700' },
  PENDING_UNTIL: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700' },
  INDETERMINATE: { label: 'Indeterminado', cls: 'bg-purple-100 text-purple-700' },
  WONT_FIX: { label: 'Não resolve', cls: 'bg-red-100 text-red-700' },
  RESOLVED: { label: 'Resolvido', cls: 'bg-green-100 text-green-700' },
};

export default function Tickets() {
  const [filter, setFilter] = useState<TicketFilter>('ALL');
  const [decideTicket, setDecideTicket] = useState<Ticket | null>(null);
  const qc = useQueryClient();

  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ['tickets', filter],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (filter === 'OPEN') params.status = 'OPEN';
      if (filter === 'WONT_FIX') params.status = 'WONT_FIX';
      return api.get('/maintenance-tickets', { params }).then(r => r.data);
    },
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: string }) =>
      api.patch(`/maintenance-tickets/${id}/decide`, { decision }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      setDecideTicket(null);
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-800">Chamados de Manutenção</h1>

      {/* Chip filters */}
      <div className="flex gap-2 flex-wrap">
        {CHIP_FILTERS.map(c => (
          <button
            key={c.value}
            onClick={() => setFilter(c.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
              filter === c.value ? `${c.cls} border-transparent` : 'bg-white border-gray-200 text-gray-600'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {isLoading && <div className="text-gray-400 text-center py-12">Carregando...</div>}

      {/* Ticket cards */}
      <div className="space-y-3">
        {tickets.map(ticket => {
          const badge = STATUS_BADGE[ticket.status] ?? { label: ticket.status, cls: 'bg-gray-100 text-gray-500' };
          return (
            <div key={ticket.id} className="bg-white rounded-xl shadow-sm p-4 flex items-start gap-4">
              <span className="text-2xl mt-1">🔧</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800">{ticket.description}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Apt {ticket.property.unitNumber} · {ticket.property.condominium.name}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(ticket.createdAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${badge.cls}`}>
                  {badge.label}
                </span>
                <button
                  onClick={() => setDecideTicket(ticket)}
                  className="text-xs bg-[#0B5563] text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-[#0D7377] transition-colors"
                >
                  Decidir
                </button>
              </div>
            </div>
          );
        })}
        {!isLoading && tickets.length === 0 && (
          <p className="text-gray-400 text-center py-8">Nenhum chamado encontrado</p>
        )}
      </div>

      {/* Decision modal */}
      {decideTicket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDecideTicket(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-gray-800 mb-1">Decisão do chamado</h2>
            <p className="text-sm text-gray-500 mb-4">{decideTicket.description}</p>
            <div className="space-y-2">
              {[
                { decision: 'RESOLVED', icon: '✅', label: 'Marcar como resolvido' },
                { decision: 'PENDING_UNTIL', icon: '📅', label: 'Pendente até data (resolução automática)' },
                { decision: 'INDETERMINATE', icon: '∞', label: 'Tempo indeterminado' },
                { decision: 'WONT_FIX', icon: '🚫', label: 'Não será resolvido', destructive: true },
              ].map(opt => (
                <button
                  key={opt.decision}
                  onClick={() => decideMutation.mutate({ id: decideTicket.id, decision: opt.decision })}
                  disabled={decideMutation.isPending}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left text-sm font-medium transition-colors ${
                    (opt as any).destructive
                      ? 'border-red-200 text-red-600 hover:bg-red-50'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-lg">{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setDecideTicket(null)} className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
