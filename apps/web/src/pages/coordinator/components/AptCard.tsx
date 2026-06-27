interface Props {
  job: {
    id: string;
    status: string;
    urgencyLevel: 'RED' | 'YELLOW' | 'GREEN';
    property: { unitNumber: string; condominium: { name: string } };
    reservation: { checkIn: string; checkOut: string } | null;
    assignments: { cleaner: { name: string } }[];
  };
  onClick: () => void;
}

const URGENCY_DOT: Record<string, string> = {
  RED: 'bg-[#E63946]',
  YELLOW: 'bg-[#F4A261]',
  GREEN: 'bg-[#2DC653]',
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Atribuir', className: 'bg-red-100 text-red-700' },
  ASSIGNED: { label: 'Atribuída', className: 'bg-blue-100 text-blue-700' },
  IN_PROGRESS: { label: 'Limpando', className: 'bg-blue-500 text-white' },
  PARTIAL: { label: 'Parcial', className: 'bg-orange-100 text-orange-700' },
  STAND_BY: { label: 'Aguardando', className: 'bg-amber-100 text-amber-700' },
  DONE: { label: 'Concluído', className: 'bg-green-600 text-white' },
  CANCELLED: { label: 'Cancelado', className: 'bg-gray-100 text-gray-500' },
};

export default function AptCard({ job, onClick }: Props) {
  const badge = STATUS_BADGE[job.status] ?? { label: job.status, className: 'bg-gray-100 text-gray-500' };
  const cleanerName = job.assignments[0]?.cleaner?.name;

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-shadow text-left"
    >
      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${URGENCY_DOT[job.urgencyLevel]}`} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 truncate">
          Apt {job.property.unitNumber}
          <span className="font-normal text-gray-500 ml-1">· {job.property.condominium.name}</span>
        </p>
        {job.reservation && (
          <p className="text-xs text-gray-400">
            Checkout: {new Date(job.reservation.checkOut).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
        {cleanerName && <p className="text-xs text-gray-500 truncate">{cleanerName}</p>}
      </div>
      <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${badge.className}`}>
        {badge.label}
      </span>
    </button>
  );
}
