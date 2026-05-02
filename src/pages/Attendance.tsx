import React, { useState, useEffect, memo, useCallback } from 'react';
import { Funcionario, Termo } from '../types';
import { supabase } from '../lib/supabase';
import { getDaysInMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AttendanceRow = memo(({ funcionario, daysArray, gridDataFunc, termos, onCellChange }: any) => {
  return (
    <tr className="hover:bg-blue-50 group">
      <td className="px-4 py-3 sticky left-0 z-10 bg-white group-hover:bg-blue-50 border-r border-gray-200">
        <div className="font-semibold text-gray-900">{funcionario.nome}</div>
        <div className="text-xs text-gray-500 overflow-hidden text-ellipsis">{funcionario.empresa} - {funcionario.setor}</div>
      </td>
      
      {daysArray.map((day: number) => {
        const currentTermoId = gridDataFunc?.[day.toString()] || '';
        return (
          <td key={day} className="px-1 py-1 border-r border-gray-200 p-0 text-center relative">
            <select
              value={currentTermoId}
              onChange={(e) => onCellChange(funcionario.id, day, e.target.value)}
              className={`w-full h-10 text-center font-bold appearance-none cursor-pointer border-transparent hover:border-blue-400 focus:border-blue-500 rounded focus:ring-0 ${
                currentTermoId ? 'bg-blue-100 text-blue-900' : 'bg-transparent text-gray-400'
              }`}
              title={`Dia ${day} - ${funcionario.nome}`}
            >
              <option value="">-</option>
              {termos.map((t: any) => (
                <option key={t.id} value={t.id}>{t.sigla}</option>
              ))}
            </select>
          </td>
        );
      })}
    </tr>
  );
});

export default function Attendance() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [termos, setTermos] = useState<Termo[]>([]);
  
  // Controle de filtro mes/ano e quinzena
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM'));
  const [quinzena, setQuinzena] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(true);
  
  // State complexo da grid: funcionario_id -> (dia -> termo_id)
  const [gridData, setGridData] = useState<Record<string, Record<string, string>>>({});

  const [yearStr, monthStr] = selectedDate.split('-');
  const currentYear = parseInt(yearStr, 10);
  const currentMonth = parseInt(monthStr, 10) - 1;

  const daysInMonth = getDaysInMonth(new Date(currentYear, currentMonth));
  const startDay = quinzena === 1 ? 1 : 16;
  const endDay = quinzena === 1 ? 15 : daysInMonth;
  const daysArray = Array.from({ length: endDay - startDay + 1 }, (_, i) => startDay + i);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      console.log(`[Attendance Grid] Carregando dados para ${selectedDate}`);
      
      const [{ data: funcs }, { data: terms }] = await Promise.all([
        supabase.from('funcionarios').select('*').order('nome'),
        supabase.from('termos').select('*').order('sigla')
      ]);

      if (funcs) setFuncionarios(funcs);
      if (terms) setTermos(terms);

      const startDate = `${selectedDate}-01`;
      const endDate = `${selectedDate}-${daysInMonth}`;

      const { data: freqData, error: freqError } = await supabase
        .from('frequencia')
        .select('*')
        .gte('data', startDate)
        .lte('data', endDate);

      if (freqError) {
        console.error('Erro ao buscar frequências:', freqError);
      }

      const newGrid: Record<string, Record<string, string>> = {};
      if (freqData) {
        freqData.forEach(f => {
          // Extrair apenas o dia da data no formato YYYY-MM-DD
          const dayStr = parseInt(f.data.split('-')[2], 10).toString();
          if (!newGrid[f.funcionario_id]) newGrid[f.funcionario_id] = {};
          newGrid[f.funcionario_id][dayStr] = f.termo_id;
        });
      }
      
      setGridData(newGrid);
      setLoading(false);
    };

    fetchData();
  }, [selectedDate, daysInMonth]);

  const handleCellChange = useCallback(async (funcId: string, day: number, termoId: string) => {
    console.log(`[Attendance Grid] Atualizando celula - Func: ${funcId}, Dia: ${day}, Termo: ${termoId}`);
    
    // Atualização otimista na tela
    setGridData(prev => {
      const nextFuncData = { ...(prev[funcId] || {}) };
      if (termoId) {
        nextFuncData[day.toString()] = termoId;
      } else {
        delete nextFuncData[day.toString()];
      }
      return { ...prev, [funcId]: nextFuncData };
    });

    // Formatar data YYYY-MM-DD
    const dataDate = `${selectedDate}-${day.toString().padStart(2, '0')}`;

    try {
      if (termoId) {
        // Inserir ou atualizar na base
        const { error } = await supabase.from('frequencia').upsert({
          funcionario_id: funcId,
          data: dataDate,
          termo_id: termoId
        }, { onConflict: 'funcionario_id, data' });
        
        if (error) throw error;
      } else {
        // Excluir se selecionou vazio (-)
        const { error } = await supabase.from('frequencia')
          .delete()
          .match({ funcionario_id: funcId, data: dataDate });
          
        if (error) throw error;
      }
    } catch (e) {
      console.error('Erro ao salvar frequência no banco:', e);
      // Aqui idealmente reverteriamos o estado se falhasse
    }
  }, [selectedDate]);

  return (
    <div className="p-4 md:p-8 max-w-full mx-auto space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900">Registro de Frequência</h2>
          <p className="text-sm text-gray-500 mt-1">Selecione o mês/ano e preencha a grade utilizando os termos configurados.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="sr-only">Mês/Ano</label>
            <input 
              type="month" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
          </div>
          <div className="flex bg-gray-100 p-1 rounded-md border border-gray-200">
            <button
              onClick={() => setQuinzena(1)}
              className={`px-3 py-1.5 text-sm font-medium rounded ${quinzena === 1 ? 'bg-white text-blue-700 shadow-sm transition' : 'text-gray-600 hover:text-gray-900 transition'}`}
            >
              1ª Quinzena (1-15)
            </button>
            <button
              onClick={() => setQuinzena(2)}
              className={`px-3 py-1.5 text-sm font-medium rounded ${quinzena === 2 ? 'bg-white text-blue-700 shadow-sm transition' : 'text-gray-600 hover:text-gray-900 transition'}`}
            >
              2ª Quinzena (16-Fim)
            </button>
          </div>
          <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-md font-semibold hidden md:block">
            {format(new Date(currentYear, currentMonth), 'MMMM / yyyy', { locale: ptBR }).toUpperCase()}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-gray-800 text-white">
              <tr>
                <th className="px-4 py-3 font-medium sticky left-0 z-10 bg-gray-900 border-r border-gray-700 min-w-64">
                  Colaborador
                </th>
                {daysArray.map(day => (
                  <th key={day} className="px-2 py-3 text-center border-r border-gray-700 min-w-16">
                    <div className="text-xs text-gray-400">{format(new Date(currentYear, currentMonth, day), 'EEEE', { locale: ptBR }).charAt(0).toUpperCase()}</div>
                    <div>{day}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {funcionarios.map(f => (
                <AttendanceRow 
                  key={f.id} 
                  funcionario={f} 
                  daysArray={daysArray} 
                  gridDataFunc={gridData[f.id]} 
                  termos={termos} 
                  onCellChange={handleCellChange} 
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="text-sm text-gray-500 italic">
        * Células vazias ('-') não geram descontos nem acréscimos. Serão contabilizadas como dias trabalhados padrão pelo sistema se for dia útil, conforme layout da empresa.
      </div>
    </div>
  );
}
