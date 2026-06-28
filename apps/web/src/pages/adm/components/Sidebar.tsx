import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';

interface Props {
  activePage: string;
  onNavigate: (page: string) => void;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'tickets', label: 'Chamados', icon: '🔧' },
  { id: 'reimbursements', label: 'Reembolsos', icon: '💰' },
  { id: 'properties', label: 'Propriedades', icon: '🏠' },
  { id: 'team', label: 'Equipe', icon: '👥' },
  { id: 'media', label: 'Mídias', icon: '📸' },
];

export default function Sidebar({ activePage, onNavigate }: Props) {
  const { name, logout } = useAuthStore();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <aside className="w-56 bg-[#0B5563] text-white flex flex-col h-screen fixed left-0 top-0 z-40">
      <div className="px-4 py-5 border-b border-white/10">
        <h1 className="text-xl font-bold">STAY</h1>
        <p className="text-xs text-white/60 mt-1">Painel ADM</p>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activePage === item.id
                ? 'bg-white text-[#0B5563]'
                : 'text-white/80 hover:bg-white/10'
            }`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-sm text-white/80 truncate mb-2">{name}</p>
        <button
          onClick={handleLogout}
          className="text-xs text-white/60 hover:text-white transition-colors"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
