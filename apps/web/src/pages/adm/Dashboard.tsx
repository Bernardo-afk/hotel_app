import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/axios';
import Sidebar from './components/Sidebar';
import AlertStrip from './components/AlertStrip';
import CoordinatorRow from './components/CoordinatorRow';
import Tickets from './Tickets';
import Reimbursements from './Reimbursements';
import Properties from './Properties';
import Team from './Team';
import MediaDashboard from './MediaDashboard';

interface AdmMetrics {
  total_apts_today: number;
  completed: number;
  urgent: number;
  open_tickets: number;
  active_cleaners: number;
}

interface CoordinatorRowData {
  id: string;
  name: string;
  avatarUrl: string | null;
  isActive: boolean;
  stats: {
    cleaners: number;
    apts: number;
    cleaned: number;
    pending: number;
    open_tickets: number;
    has_alerts: boolean;
  };
}

interface AlertItem {
  type: string;
  severity: 'CRITICAL' | 'WARNING';
  message: string;
}

interface AdmDashboardData {
  metrics: AdmMetrics;
  coordinators: CoordinatorRowData[];
  alert_strip: AlertItem[];
}

function useAdmDashboard() {
  return useQuery<AdmDashboardData>({
    queryKey: ['adm-dashboard'],
    queryFn: () => api.get('/dashboard/adm').then(r => r.data),
    refetchInterval: 60_000,
  });
}

// Tab content placeholder (W5 fills these)
function ComingSoon({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="text-center">
        <p className="text-4xl mb-2">🚧</p>
        <p>{name} em construção</p>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-center gap-2 mb-1">
        <span>{icon}</span>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function AdmDashboard() {
  const [activePage, setActivePage] = useState('dashboard');
  const [drillCoordinatorId, setDrillCoordinatorId] = useState<string | null>(null);
  const { data, isLoading } = useAdmDashboard();

  function renderContent() {
    if (activePage === 'dashboard') {
      if (isLoading) {
        return <div className="text-gray-400 text-center py-20">Carregando...</div>;
      }
      return (
        <div className="space-y-6">
          {/* Alert strip */}
          {data?.alert_strip && <AlertStrip alerts={data.alert_strip} />}

          {/* Metric cards */}
          <div className="grid grid-cols-5 gap-4">
            <MetricCard label="Total de Apts" value={data?.metrics.total_apts_today ?? 0} color="text-[#0D7377]" icon="🏠" />
            <MetricCard label="Concluídos" value={data?.metrics.completed ?? 0} color="text-green-600" icon="✅" />
            <MetricCard label="Urgentes" value={data?.metrics.urgent ?? 0} color="text-red-600" icon="🔴" />
            <MetricCard label="Chamados" value={data?.metrics.open_tickets ?? 0} color="text-amber-600" icon="🔧" />
            <MetricCard label="Empregadas" value={data?.metrics.active_cleaners ?? 0} color="text-blue-600" icon="👥" />
          </div>

          {/* Coordinator drill-down breadcrumb */}
          {drillCoordinatorId && (
            <button
              onClick={() => setDrillCoordinatorId(null)}
              className="text-sm text-[#0D7377] hover:underline"
            >
              ← Voltar ao painel ADM
            </button>
          )}

          {/* Coordinator list or drill-down */}
          {drillCoordinatorId ? (
            <CoordinatorDrillDown coordinatorId={drillCoordinatorId} />
          ) : (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
                Coordinadoras — ao vivo
              </h2>
              <div className="space-y-2">
                {data?.coordinators.map(c => (
                  <CoordinatorRow
                    key={c.id}
                    coordinator={c}
                    onClick={() => setDrillCoordinatorId(c.id)}
                  />
                ))}
                {(!data?.coordinators || data.coordinators.length === 0) && (
                  <p className="text-gray-400 text-sm">Nenhuma coordinadora encontrada</p>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Feature tabs
    if (activePage === 'tickets') return <Tickets />;
    if (activePage === 'reimbursements') return <Reimbursements />;
    if (activePage === 'properties') return <Properties />;
    if (activePage === 'team') return <Team />;
    if (activePage === 'media') return <MediaDashboard />;
    return <ComingSoon name={activePage} />;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      {/* Main content */}
      <div className="flex-1 flex flex-col ml-56 min-h-screen overflow-hidden">
        {/* Topbar */}
        <header className="bg-[#0B5563] text-white px-6 py-3 flex items-center justify-between flex-shrink-0">
          <span className="font-bold">STAY — Painel ADM</span>
          <span className="text-sm opacity-80">{new Date().toLocaleDateString('pt-BR')}</span>
          <div className="flex gap-2">
            {data && data.metrics.urgent > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                {data.metrics.urgent} urgentes
              </span>
            )}
            {data && data.metrics.open_tickets > 0 && (
              <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                {data.metrics.open_tickets} chamados
              </span>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

// Coordinator drill-down (reads coordinator panel)
function CoordinatorDrillDown({ coordinatorId }: { coordinatorId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['adm-coordinator', coordinatorId],
    queryFn: () => api.get(`/dashboard/adm/coordinator/${coordinatorId}`).then(r => r.data),
  });

  if (isLoading) return <div className="text-gray-400 text-center py-12">Carregando painel da coordinadora...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Painel da Coordinadora (somente leitura)</h2>
      {data && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Urgentes</p>
            <p className="text-2xl font-bold text-red-500">{data.metrics?.urgent ?? 0}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Atenção</p>
            <p className="text-2xl font-bold text-yellow-500">{data.metrics?.attention ?? 0}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Concluídos</p>
            <p className="text-2xl font-bold text-green-500">{data.metrics?.completed ?? 0}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Pendentes</p>
            <p className="text-2xl font-bold text-orange-500">{data.metrics?.pending ?? 0}</p>
          </div>
        </div>
      )}
    </div>
  );
}
