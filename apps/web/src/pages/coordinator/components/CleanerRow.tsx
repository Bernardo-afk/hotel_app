interface Props {
  cleaner: {
    id: string;
    name: string;
    avatarUrl: string | null;
    isActive: boolean;
    currentAssignment: {
      assignmentStatus: string;
      job: { urgencyLevel: string; property: { unitNumber: string; condominium: { name: string } } };
    } | null;
  };
  onClick: () => void;
}

const ASSIGNMENT_STATUS_BADGE: Record<string, string> = {
  NOTIFIED: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-blue-500 text-white',
  DONE: 'bg-green-600 text-white',
};

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

export default function CleanerRow({ cleaner, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl shadow-sm p-3 flex items-center gap-3 hover:shadow-md transition-shadow text-left"
    >
      <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
        {cleaner.avatarUrl
          ? <img src={cleaner.avatarUrl} className="w-full h-full rounded-full object-cover" alt={cleaner.name} />
          : initials(cleaner.name)
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 truncate text-sm">{cleaner.name}</p>
        {cleaner.currentAssignment ? (
          <p className="text-xs text-gray-500 truncate">
            Apt {cleaner.currentAssignment.job.property.unitNumber} · {cleaner.currentAssignment.job.property.condominium.name}
          </p>
        ) : (
          <p className="text-xs text-gray-400">Livre</p>
        )}
      </div>
      {cleaner.currentAssignment ? (
        <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${
          ASSIGNMENT_STATUS_BADGE[cleaner.currentAssignment.assignmentStatus] ?? 'bg-gray-100 text-gray-500'
        }`}>
          {cleaner.currentAssignment.assignmentStatus === 'IN_PROGRESS' ? 'Limpando' :
           cleaner.currentAssignment.assignmentStatus === 'NOTIFIED' ? 'A caminho' : 'Concluído'}
        </span>
      ) : (
        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-500">Livre</span>
      )}
    </button>
  );
}
