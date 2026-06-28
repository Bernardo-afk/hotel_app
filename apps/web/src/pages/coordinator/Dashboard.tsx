import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/axios';
import AptCard from './components/AptCard';
import CleanerRowComp from './components/CleanerRow';
import AssignmentModal from './components/AssignmentModal';
import AlertModal from './components/AlertModal';
import PendingSection from './components/PendingSection';
import CleanerQueue from './components/CleanerQueue';

// --- Types ---
interface JobCard {
  id: string;
  status: string;
  urgencyLevel: 'RED' | 'YELLOW' | 'GREEN';
  scheduledDate: string;
  property: {
    id: string;
    unitNumber: string;
    status: string;
    condominium: { id: string; name: string };
  };
  reservation: { checkIn: string; checkOut: string; guestName: string | null } | null;
  assignments: { id: string; cleanerId: string; status: string; cleaner: { id: string; name: string } }[];
}

interface CleanerRowData {
  id: string;
  name: string;
  avatarUrl: string | null;
  isActive: boolean;
  currentAssignment: {
    assignmentId: string;
    assignmentStatus: string;
    job: { id: string; urgencyLevel: string; property: { unitNumber: string; condominium: { name: string } } };
  } | null;
}

interface DashboardData {
  metrics: { urgent: number; attention: number; completed: number; pending: number };
  jobs_by_urgency: { RED: JobCard[]; YELLOW: JobCard[]; GREEN: JobCard[] };
  team_live: CleanerRowData[];
  pending_count: number;
}

// --- API hook ---
function useCoordinatorDashboard() {
  return useQuery<DashboardData>({
    queryKey: ['coordinator-dashboard'],
    queryFn: () => api.get('/dashboard/coordinator').then(r => r.data),
    refetchInterval: 30_000,
  });
}

// --- Chip config ---
type FilterChip = 'ALL' | 'RED' | 'YELLOW' | 'IN_PROGRESS' | 'DONE' | 'PENDING' | 'UNASSIGNED';

const CHIPS: { value: FilterChip; label: string; activeClass: string }[] = [
  { value: 'ALL', label: 'Todos', activeClass: 'bg-[#0D7377] border-[#0D7377] text-white' },
  { value: 'RED', label: '🔴 Urgente', activeClass: 'bg-red-500 border-red-500 text-white' },
  { value: 'YELLOW', label: '🟡 Atenção', activeClass: 'bg-yellow-400 border-yellow-400 text-white' },
  { value: 'IN_PROGRESS', label: '🔵 Em andamento', activeClass: 'bg-blue-500 border-blue-500 text-white' },
  { value: 'DONE', label: '🟢 Concluído', activeClass: 'bg-green-500 border-green-500 text-white' },
  { value: 'PENDING', label: '🟠 Pendente', activeClass: 'bg-orange-400 border-orange-400 text-white' },
  { value: 'UNASSIGNED', label: 'Sem empregada', activeClass: 'bg-gray-500 border-gray-500 text-white' },
];

// --- Helper components ---
function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function JobSection({
  title,
  jobs,
  onJobClick,
}: {
  title: string;
  jobs: JobCard[];
  onJobClick: (j: JobCard) => void;
  urgency: 'RED' | 'YELLOW' | 'GREEN';
}) {
  if (jobs.length === 0) return null;
  return (
    <div>
      <h2 className="text-xs font-bold uppercase text-gray-400 mb-2 tracking-wide">{title}</h2>
      <div className="space-y-2">
        {jobs.map(j => (
          <AptCard key={j.id} job={j} onClick={() => onJobClick(j)} />
        ))}
      </div>
    </div>
  );
}

// --- Main component ---
export default function CoordinatorDashboard() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterChip>('ALL');
  const [selectedJob, setSelectedJob] = useState<JobCard | null>(null);
  const [alertJob, setAlertJob] = useState<{
    id: string;
    status: string;
    urgencyLevel: string;
    property: { unitNumber: string; condominium: { name: string } };
    assignments: { cleaner: { name: string } }[];
  } | null>(null);
  const [selectedCleaner, setSelectedCleaner] = useState<CleanerRowData | null>(null);

  const { data, isLoading } = useCoordinatorDashboard();

  const filteredJobs = useMemo(() => {
    if (!data) return { RED: [] as JobCard[], YELLOW: [] as JobCard[], GREEN: [] as JobCard[] };
    const allJobs = [
      ...data.jobs_by_urgency.RED,
      ...data.jobs_by_urgency.YELLOW,
      ...data.jobs_by_urgency.GREEN,
    ];
    const searched = search
      ? allJobs.filter(
          j =>
            j.property.unitNumber.toLowerCase().includes(search.toLowerCase()) ||
            j.property.condominium.name.toLowerCase().includes(search.toLowerCase()),
        )
      : allJobs;
    const chipped = (() => {
      if (filter === 'ALL') return searched;
      if (filter === 'RED') return searched.filter(j => j.urgencyLevel === 'RED');
      if (filter === 'YELLOW') return searched.filter(j => j.urgencyLevel === 'YELLOW');
      if (filter === 'IN_PROGRESS') return searched.filter(j => j.status === 'IN_PROGRESS');
      if (filter === 'DONE') return searched.filter(j => j.status === 'DONE');
      if (filter === 'PENDING') return searched.filter(j => ['STAND_BY', 'PARTIAL'].includes(j.status));
      if (filter === 'UNASSIGNED') return searched.filter(j => j.assignments.length === 0);
      return searched;
    })();
    return {
      RED: chipped.filter(j => j.urgencyLevel === 'RED'),
      YELLOW: chipped.filter(j => j.urgencyLevel === 'YELLOW'),
      GREEN: chipped.filter(j => j.urgencyLevel === 'GREEN'),
    };
  }, [data, search, filter]);

  const filteredCleaners = useMemo(() => {
    if (!data) return [];
    return search
      ? data.team_live.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
      : data.team_live;
  }, [data, search]);

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-screen text-gray-400">Carregando...</div>
    );

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Topbar */}
      <header className="bg-[#0D7377] text-white px-6 py-3 flex items-center justify-between flex-shrink-0">
        <span className="font-bold text-lg">STAY</span>
        <span className="text-sm">
          Painel da Coordinator · {new Date().toLocaleDateString('pt-BR')}
        </span>
        <div className="flex gap-2">
          {data && data.metrics.urgent > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
              {data.metrics.urgent} urgentes
            </span>
          )}
          {data && data.metrics.pending > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
              {data.metrics.pending} pendências
            </span>
          )}
        </div>
      </header>

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-4 px-6 py-4 flex-shrink-0">
        <MetricCard label="Urgentes" value={data?.metrics.urgent ?? 0} color="text-red-500" />
        <MetricCard label="Atenção" value={data?.metrics.attention ?? 0} color="text-yellow-500" />
        <MetricCard label="Concluídos" value={data?.metrics.completed ?? 0} color="text-green-500" />
        <MetricCard label="Pendentes" value={data?.metrics.pending ?? 0} color="text-orange-500" />
      </div>

      {/* Filter bar J2 */}
      <div className="px-6 pb-3 flex-shrink-0">
        <input
          type="text"
          placeholder="Buscar apt, condomínio ou empregada..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-[#0D7377] text-sm"
        />
        <div className="flex gap-2 flex-wrap">
          {CHIPS.map(c => (
            <button
              key={c.value}
              onClick={() => setFilter(c.value)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                filter === c.value ? c.activeClass : 'bg-white border-gray-300 text-gray-600'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body — 2 columns */}
      <div className="flex flex-1 overflow-hidden px-6 pb-6 gap-4">
        {/* Left column */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          <JobSection
            title="Urgentes"
            jobs={filteredJobs.RED}
            onJobClick={setSelectedJob}
            urgency="RED"
          />
          {data && (
            <PendingSection
              jobs={[
                ...data.jobs_by_urgency.RED,
                ...data.jobs_by_urgency.YELLOW,
                ...data.jobs_by_urgency.GREEN,
              ].filter(j => ['STAND_BY', 'PARTIAL'].includes(j.status))}
              onResolve={job => setAlertJob(job)}
            />
          )}
          <JobSection
            title="Atenção"
            jobs={filteredJobs.YELLOW}
            onJobClick={setSelectedJob}
            urgency="YELLOW"
          />
          <JobSection
            title="Tranquilo"
            jobs={filteredJobs.GREEN}
            onJobClick={setSelectedJob}
            urgency="GREEN"
          />
        </div>

        {/* Right column — team live */}
        <div className="w-80 flex-shrink-0 overflow-y-auto">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">EQUIPE AO VIVO</h2>
          <div className="space-y-2">
            {filteredCleaners.map(c => (
              <CleanerRowComp key={c.id} cleaner={c} onClick={() => setSelectedCleaner(c)} />
            ))}
            {filteredCleaners.length === 0 && (
              <p className="text-sm text-gray-400">Nenhuma empregada encontrada</p>
            )}
          </div>
        </div>
      </div>

      {selectedJob && (
        <AssignmentModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onAssigned={() => setSelectedJob(null)}
        />
      )}
      {alertJob && (
        <AlertModal
          job={alertJob}
          situation={
            alertJob.status === 'STAND_BY'
              ? 'Hóspede presente — aguardando saída'
              : 'Empregada não finalizou a limpeza'
          }
          elapsedMinutes={30}
          onClose={() => setAlertJob(null)}
        />
      )}
      {selectedCleaner && (
        <CleanerQueue
          cleaner={{ id: selectedCleaner.id, name: selectedCleaner.name }}
          jobs={[]}
          onClose={() => setSelectedCleaner(null)}
        />
      )}
    </div>
  );
}
