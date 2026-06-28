import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/axios';

type MediaTab = 'receipts' | 'completion' | 'incidents';

export default function MediaDashboard() {
  const [tab, setTab] = useState<MediaTab>('receipts');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['media', tab, date],
    queryFn: () =>
      api.get('/media/jobs', { params: { date, type: tab } })
        .then(r => r.data)
        .catch(() => []),
    refetchInterval: 2 * 60 * 1000, // 2 minutes
  });

  const TABS: { value: MediaTab; label: string }[] = [
    { value: 'receipts', label: 'Comprovantes de transporte' },
    { value: 'completion', label: 'Fotos de conclusão' },
    { value: 'incidents', label: 'Ocorrências' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Mídias & Comprovantes</h1>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5563]"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === t.value ? 'bg-white text-[#0B5563] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && <div className="text-gray-400 text-center py-12">Carregando...</div>}

      {/* Media grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {(items as any[]).map((item: any, i: number) => (
          <div key={item.id ?? i} className="bg-white rounded-xl shadow-sm overflow-hidden">
            {item.url ? (
              <img src={item.url} alt="mídia" className="w-full aspect-square object-cover" />
            ) : (
              <div className="w-full aspect-square bg-gray-100 flex items-center justify-center text-gray-400 text-2xl">
                📄
              </div>
            )}
            <div className="p-2">
              <p className="text-xs text-gray-600 truncate">{item.description ?? item.type ?? '—'}</p>
              {item.amount && (
                <p className="text-xs font-bold text-gray-800">R$ {Number(item.amount).toFixed(2)}</p>
              )}
            </div>
          </div>
        ))}
        {!isLoading && items.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400">
            Nenhuma mídia encontrada para {date}
          </div>
        )}
      </div>
    </div>
  );
}
