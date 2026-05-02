import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, Search, ArrowRight } from 'lucide-react';

export default function Audit() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Dicionários para traduzir IDs feios em Nomes bonitos
  const [funcionariosMap, setFuncionariosMap] = useState<Record<string, string>>({});
  const [termosMap, setTermosMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    
    const [
      { data: logsData },
      { data: funcData },
      { data: termData }
    ] = await Promise.all([
      supabase.from('audit_logs').select('*').order('criado_em', { ascending: false }).limit(100),
      supabase.from('funcionarios').select('id, nome'),
      supabase.from('termos').select('id, sigla')
    ]);

    if (funcData) {
      const fMap: Record<string, string> = {};
      funcData.forEach(f => fMap[f.id] = f.nome);
      setFuncionariosMap(fMap);
    }
    
    if (termData) {
      const tMap: Record<string, string> = {};
      termData.forEach(t => tMap[t.id] = t.sigla);
      setTermosMap(tMap);
    }

    setLogs(logsData || []);
    setLoading(false);
  };

  const filteredLogs = logs.filter(log => 
    (log.usuario_email || '').toLowerCase().includes(search.toLowerCase()) ||
    (log.tabela || '').toLowerCase().includes(search.toLowerCase()) ||
    (log.operacao || '').toLowerCase().includes(search.toLowerCase())
  );

  const translateKey = (key: string) => {
    const dict: Record<string, string> = {
      'funcionario_id': 'Colaborador',
      'termo_id': 'Motivo/Termo',
      'data': 'Dia da Frequência',
      'vr_pago': 'Valor VR Editado',
      'vt_pago': 'Valor VT Editado',
      'quinzena': 'Quinzena',
      'mes': 'Mês',
      'ano': 'Ano',
      'nome': 'Nome do Funcionário',
      'vr_diario': 'Custo Diário VR',
      'vt_diario': 'Custo Diário VT',
      'sigla': 'Sigla',
      'acao_vr': 'Ação no VR',
      'acao_vt': 'Ação no VT'
    };
    return dict[key] || key;
  };

  const formatValue = (key: string, value: any) => {
    if (value === null || value === undefined) return 'Vazio';
    if (key === 'funcionario_id') return funcionariosMap[value] || value;
    if (key === 'termo_id') return termosMap[value] || value;
    
    // Tratamento para datas
    if (key === 'data' && typeof value === 'string') {
      try {
        // Ignora timezones quebrando a data
        const [y, m, d] = value.split('-');
        if (y && m && d) return `${d}/${m}/${y}`;
      } catch (e) {}
    }
    
    // Tratamento para moeda
    if (key.includes('vr_') || key.includes('vt_')) {
      if (typeof value === 'number') return `R$ ${value.toFixed(2).replace('.', ',')}`;
    }
    
    return String(value);
  };

  const renderChanges = (log: any) => {
    const oldData = log.dados_antigos;
    const newData = log.dados_novos;
    
    const keys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
    ['id', 'created_at', 'updated_at'].forEach(k => keys.delete(k));

    const changes = Array.from(keys).map(key => {
      const oldVal = oldData?.[key];
      const newVal = newData?.[key];
      
      // Se for UPDATE e não mudou nada nesse campo, ignora.
      if (log.operacao === 'UPDATE' && oldVal === newVal) return null;

      // Ignora campos que eram null e continuaram vazios no front
      if (oldVal === null && newVal === undefined) return null;
      if (oldVal === undefined && newVal === null) return null;

      return (
        <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-2 text-[13px]">
          <span className="font-semibold text-gray-600 min-w-[140px] uppercase text-[10px] tracking-wider">{translateKey(key)}:</span>
          
          <div className="flex items-center gap-2 flex-wrap">
            {oldData && (
               <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded line-through border border-red-100 decoration-red-300">
                 {formatValue(key, oldVal)}
               </span>
            )}
            
            {oldData && newData && <ArrowRight className="w-3 h-3 text-gray-400" />}
            
            {newData && (
               <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded font-medium border border-green-200 shadow-sm">
                 {formatValue(key, newVal)}
               </span>
            )}
          </div>
        </div>
      );
    });

    return <div className="py-2">{changes}</div>;
  };

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <History className="w-6 h-6 text-blue-600" />
            Rastreabilidade (Logs)
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Histórico das últimas 100 alterações no sistema. Saiba quem alterou o quê.
          </p>
        </div>
        
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por e-mail ou tabela..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 w-full md:w-64"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-700 uppercase border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 font-semibold w-48">Data e Usuário</th>
                <th className="px-4 py-3 font-semibold w-32">Ação</th>
                <th className="px-4 py-3 font-semibold w-40">Módulo</th>
                <th className="px-4 py-3 font-semibold">Detalhes da Alteração</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLogs.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    Nenhum log encontrado. O sistema começou a rastrear agora.
                  </td>
                </tr>
              )}
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-4 py-4 align-top">
                    <div className="font-medium text-gray-900">
                      {format(new Date(log.criado_em), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                    <div className="text-xs text-gray-500 mb-1">
                      {format(new Date(log.criado_em), "HH:mm:ss", { locale: ptBR })}
                    </div>
                    <div className="text-xs font-semibold text-blue-700 bg-blue-50 inline-block px-2 py-0.5 rounded mt-1">
                      {log.usuario_email || 'Sistema / API'}
                    </div>
                  </td>
                  
                  <td className="px-4 py-4 align-top">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold shadow-sm border ${
                      log.operacao === 'INSERT' ? 'bg-green-100 text-green-700 border-green-200' :
                      log.operacao === 'UPDATE' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                      'bg-red-100 text-red-700 border-red-200'
                    }`}>
                      {log.operacao === 'INSERT' ? 'CRIADO' : 
                       log.operacao === 'UPDATE' ? 'EDITADO' : 'APAGADO'}
                    </span>
                  </td>
                  
                  <td className="px-4 py-4 align-top">
                    <div className="font-semibold text-gray-700">
                      {log.tabela === 'frequencia' ? 'Frequência' :
                       log.tabela === 'pagamentos_realizados' ? 'Fechamento' :
                       log.tabela === 'funcionarios' ? 'Colaboradores' :
                       log.tabela === 'termos' ? 'Regras' : log.tabela}
                    </div>
                  </td>
                  
                  <td className="px-4 py-2 align-top">
                    <div className="bg-white rounded border border-gray-100 p-2 shadow-sm">
                      {renderChanges(log)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
