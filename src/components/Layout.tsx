import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Users, FileText, CalendarCheck, DollarSign, LogOut, Menu, X, History } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session && mounted) {
        navigate('/login', { replace: true });
      } else if (mounted) {
        setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && mounted) {
        navigate('/login', { replace: true });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleLogout = async () => {
    console.log('[Layout] Executando logout da aplicação');
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  const navItems = [
    { name: 'Funcionários', path: '/app/employees', icon: Users },
    { name: 'Motor de Regras', path: '/app/terms', icon: FileText },
    { name: 'Frequência', path: '/app/attendance', icon: CalendarCheck },
    { name: 'Fechamento Financeiro', path: '/app/financial', icon: DollarSign },
    { name: 'Auditoria e Logs', path: '/app/audit', icon: History },
  ];

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50 overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between bg-white border-b border-gray-200 p-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-blue-600">Iteq Pagamentos</h1>
          <p className="text-xs text-gray-500">Gestão de VR/VT</p>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-md">
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`${menuOpen ? 'flex absolute inset-0 top-[73px] z-50 shadow-xl' : 'hidden'} md:flex md:static w-full md:w-64 bg-white border-r border-gray-200 flex-col transition-all`}>
        <div className="hidden md:block p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold tracking-tight text-blue-600">Iteq Pagamentos</h1>
          <p className="text-xs text-gray-500 mt-1">Gestão de VR/VT</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-md text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors"
          >
            <LogOut className="w-5 h-5 text-gray-400 group-hover:text-red-700" />
            Sair do Sistema
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
