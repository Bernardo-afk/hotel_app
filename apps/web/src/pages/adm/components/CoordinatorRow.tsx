interface CoordinatorStats {
  cleaners: number;
  apts: number;
  cleaned: number;
  pending: number;
  open_tickets: number;
  has_alerts: boolean;
}

interface Props {
  coordinator: {
    id: string;
    name: string;
    avatarUrl: string | null;
    isActive: boolean;
    stats: CoordinatorStats;
  };
  onClick: () => void;
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

export default function CoordinatorRow({ coordinator, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl shadow-sm p-4 flex items-center gap-4 hover:shadow-md transition-shadow text-left"
    >
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
          {coordinator.avatarUrl
            ? <img src={coordinator.avatarUrl} className="w-full h-full rounded-full object-cover" alt={coordinator.name} />
            : initials(coordinator.name)
          }
        </div>
        {coordinator.stats.has_alerts && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-white text-[8px] font-bold">!</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800">{coordinator.name}</p>
        <p className="text-xs text-gray-500">
          {coordinator.stats.cleaners} empregadas · {coordinator.stats.apts} apts
        </p>
      </div>

      <div className="flex gap-4 text-center flex-shrink-0">
        <div>
          <p className="text-lg font-bold text-green-600">{coordinator.stats.cleaned}</p>
          <p className="text-xs text-gray-400">limpos</p>
        </div>
        <div>
          <p className="text-lg font-bold text-orange-500">{coordinator.stats.pending}</p>
          <p className="text-xs text-gray-400">pend.</p>
        </div>
        <div>
          <p className="text-lg font-bold text-amber-600">{coordinator.stats.open_tickets}</p>
          <p className="text-xs text-gray-400">chamados</p>
        </div>
      </div>

      <span className="text-gray-400 flex-shrink-0">›</span>
    </button>
  );
}
