interface AlertItem {
  type: string;
  severity: 'CRITICAL' | 'WARNING';
  message: string;
}

interface Props {
  alerts: AlertItem[];
}

export default function AlertStrip({ alerts }: Props) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-1 mb-4">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium ${
            alert.severity === 'CRITICAL'
              ? 'bg-red-500 text-white'
              : 'bg-yellow-400 text-yellow-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{alert.severity === 'CRITICAL' ? '🚨' : '⚠️'}</span>
            <span>{alert.message}</span>
          </div>
          <button className="text-xs underline opacity-80 hover:opacity-100 flex-shrink-0 ml-4">
            Resolver
          </button>
        </div>
      ))}
    </div>
  );
}
