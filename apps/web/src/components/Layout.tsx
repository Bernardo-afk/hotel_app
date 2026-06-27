import { useAuthStore } from '../store/authStore';

interface Props {
  children: React.ReactNode;
}

export default function Layout({ children }: Props) {
  const role = useAuthStore((s) => s.role);
  const isAdm = role === 'ADM' || role === 'MANAGER' || role === 'SUPER_ADMIN';

  return (
    <div className="min-h-screen bg-gray-50">
      <header
        className="text-white px-6 py-3 flex items-center"
        style={{ backgroundColor: isAdm ? '#0B5563' : '#0D7377' }}
      >
        <span className="font-bold text-lg">STAY</span>
      </header>
      <main>{children}</main>
    </div>
  );
}
