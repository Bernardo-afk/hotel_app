interface AlertOption {
  label: string;
  icon: string;
  destructive?: boolean;
  action: () => void;
}

interface Props {
  job: {
    id: string;
    property: { unitNumber: string; condominium: { name: string } };
    urgencyLevel: string;
  };
  situation: string;
  elapsedMinutes: number;
  onClose: () => void;
}

export default function AlertModal({ job, situation, elapsedMinutes, onClose }: Props) {
  const options: AlertOption[] = [
    { icon: '👤', label: 'Atribuir outra empregada', action: onClose },
    { icon: '👥', label: 'Atribuir segunda em paralelo', action: onClose },
    { icon: '⬆️', label: 'Escalar urgência + manter mesma', action: onClose },
    { icon: '⏸️', label: 'Marcar como pendente', action: onClose },
    {
      icon: '🚫',
      label: 'Bloquear apt e cancelar limpeza',
      destructive: true,
      action: onClose,
    },
  ];

  const elapsed =
    elapsedMinutes >= 60
      ? `${Math.floor(elapsedMinutes / 60)}h${
          elapsedMinutes % 60 > 0 ? `${elapsedMinutes % 60}min` : ''
        }`
      : `${elapsedMinutes}min`;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border-2 border-red-500">
        {/* Red header */}
        <div className="bg-red-500 text-white rounded-t-xl px-5 py-4 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-bold text-lg">Ação necessária — situação crítica</p>
            <p className="text-sm text-red-100">Decisão imediata necessária</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="font-bold text-gray-800">
              Apt {job.property.unitNumber} · {job.property.condominium.name}
            </p>
            <p className="text-sm text-gray-600 mt-1">{situation}</p>
            <p className="text-xs text-red-600 mt-2 font-semibold">
              Tempo decorrido: {elapsed}
            </p>
          </div>

          <p className="text-sm font-semibold text-gray-700 mb-3">O que deseja fazer?</p>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <button
                key={i}
                onClick={opt.action}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                  opt.destructive
                    ? 'border-red-300 text-red-600 hover:bg-red-50'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-lg">{opt.icon}</span>
                <span className="text-sm font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
