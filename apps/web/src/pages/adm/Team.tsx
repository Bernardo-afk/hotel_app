import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/axios';

type TeamFilter = 'ALL' | 'COORDINATOR' | 'CLEANER' | 'INACTIVE';

interface TeamUser {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
  avatarUrl: string | null;
  phone: string;
  email: string | null;
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  COORDINATOR: { label: 'Coordinadora', cls: 'bg-blue-100 text-blue-700' },
  CLEANER: { label: 'Empregada', cls: 'bg-green-100 text-green-700' },
};

export default function Team() {
  const [filter, setFilter] = useState<TeamFilter>('ALL');
  const qc = useQueryClient();

  const { data: users = [], isLoading } = useQuery<TeamUser[]>({
    queryKey: ['team', filter],
    queryFn: () => {
      const params: Record<string, string | boolean> = {};
      if (filter === 'COORDINATOR') params.role = 'COORDINATOR';
      if (filter === 'CLEANER') params.role = 'CLEANER';
      if (filter === 'INACTIVE') params.isActive = false;
      else if (filter !== 'ALL') params.isActive = true;
      return api.get('/users', { params }).then(r => r.data).catch(() => []);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/deactivate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/reactivate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  });

  const CHIP_FILTERS: { value: TeamFilter; label: string }[] = [
    { value: 'ALL', label: 'Todos' },
    { value: 'COORDINATOR', label: 'Coordinadoras' },
    { value: 'CLEANER', label: 'Empregadas' },
    { value: 'INACTIVE', label: 'Inativos' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Equipe</h1>
        <button className="text-sm bg-[#0B5563] text-white px-4 py-2 rounded-lg hover:bg-[#0D7377] transition-colors">
          + Novo usuário
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {CHIP_FILTERS.map(c => (
          <button
            key={c.value}
            onClick={() => setFilter(c.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filter === c.value ? 'bg-[#0B5563] text-white border-transparent' : 'bg-white border-gray-200 text-gray-600'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {isLoading && <div className="text-gray-400 text-center py-12">Carregando...</div>}

      <div className="space-y-2">
        {users.map(u => {
          const badge = ROLE_BADGE[u.role] ?? { label: u.role, cls: 'bg-gray-100 text-gray-500' };
          return (
            <div
              key={u.id}
              className={`bg-white rounded-xl shadow-sm p-4 flex items-center gap-4 ${!u.isActive ? 'opacity-60' : ''}`}
            >
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                {initials(u.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800">{u.name}</p>
                <p className="text-xs text-gray-500">{u.phone}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-semibold flex-shrink-0 ${badge.cls}`}>
                {badge.label}
              </span>
              <div className="flex-shrink-0">
                {u.isActive ? (
                  <button
                    onClick={() => deactivateMutation.mutate(u.id)}
                    disabled={deactivateMutation.isPending}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  >
                    Desativar
                  </button>
                ) : (
                  <button
                    onClick={() => reactivateMutation.mutate(u.id)}
                    disabled={reactivateMutation.isPending}
                    className="text-xs text-green-600 hover:underline disabled:opacity-50"
                  >
                    Reativar
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!isLoading && users.length === 0 && (
          <p className="text-gray-400 text-center py-8">Nenhum usuário encontrado</p>
        )}
      </div>
    </div>
  );
}
