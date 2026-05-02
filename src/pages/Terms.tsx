import React, { useState, useEffect } from 'react';
import { Termo, AcaoBeneficio } from '../types';
import { supabase } from '../lib/supabase';
import { Settings2, Plus, Info, Pencil } from 'lucide-react';

export default function Terms() {
  const [termos, setTermos] = useState<Termo[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form
  const [sigla, setSigla] = useState('');
  const [descricao, setDescricao] = useState('');
  const [acaoVr, setAcaoVr] = useState<AcaoBeneficio>('PAGA');
  const [acaoVt, setAcaoVt] = useState<AcaoBeneficio>('PAGA');
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    const fetchTermos = async () => {
      console.log('[Terms] Buscando termos do banco...');
      const { data, error } = await supabase.from('termos').select('*').order('sigla', { ascending: true });
      if (data) setTermos(data);
      if (error) console.error('Erro ao buscar termos:', error);
    };
    fetchTermos();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const termoData = {
      sigla: sigla.toUpperCase(),
      descricao,
      acao_vr: acaoVr,
      acao_vt: acaoVt
    };
    
    if (editId) {
      console.log('[Terms] Atualizando regra:', termoData);
      const { data, error } = await supabase.from('termos').update(termoData).eq('id', editId).select();
      
      if (error) {
        alert('Erro ao atualizar termo. ' + error.message);
        return;
      }
      if (data) {
        setTermos(termos.map(t => t.id === editId ? data[0] as Termo : t));
        closeForm();
      }
    } else {
      console.log('[Terms] Criando regra:', termoData);
      const { data, error } = await supabase.from('termos').insert([termoData]).select();
      
      if (error) {
        alert('Erro ao salvar termo. ' + error.message);
        return;
      }
      if (data) {
        setTermos([...termos, data[0] as Termo]);
        closeForm();
      }
    }
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditId(null);
    setSigla(''); setDescricao(''); setAcaoVr('PAGA'); setAcaoVt('PAGA');
  };

  const openEdit = (t: Termo) => {
    setEditId(t.id);
    setSigla(t.sigla);
    setDescricao(t.descricao);
    setAcaoVr(t.acao_vr);
    setAcaoVt(t.acao_vt);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getBadgeStyle = (acao: AcaoBeneficio) => {
    switch(acao) {
      case 'PAGA': return 'bg-green-100 text-green-800 border-green-200';
      case 'DESCONTA': return 'bg-red-100 text-red-800 border-red-200';
      case 'EXTRA': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'NEUTRO': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'PLANTAO': return 'bg-purple-100 text-purple-800 border-purple-200';
    }
  };

  const options: { value: AcaoBeneficio, label: string }[] = [
    { value: 'PAGA', label: 'Paga (Padrão)' },
    { value: 'DESCONTA', label: 'Desconta' },
    { value: 'EXTRA', label: 'Adiciona Extra' },
    { value: 'NEUTRO', label: 'Neutro (Nada Acontece)' },
    { value: 'PLANTAO', label: 'Plantão (Só VT)' }
  ];

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900">Motor de Regras</h2>
          <p className="text-sm text-gray-500 mt-1">Configure as políticas de desconto e acréscimo de benefícios.</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Novo Termo
        </button>
      </div>

      {isFormOpen && (
        <form onSubmit={handleSave} className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2 border-b pb-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-blue-600" />
              {editId ? 'Editar Regra (Termo)' : 'Configurar Regra (Termo)'}
            </h3>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sigla (1 a 4 letras)</label>
            <input required type="text" maxLength={4} value={sigla} onChange={e => setSigla(e.target.value)} placeholder="Ex: M6, F, TRAB" className="w-full border p-2 rounded-md focus:ring-1 focus:ring-blue-500 uppercase" />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <input required type="text" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Falta Injustificada" className="w-full border p-2 rounded-md focus:ring-1 focus:ring-blue-500" />
          </div>

          <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
            <label className="block text-sm font-medium text-gray-900 mb-3 flex items-center justify-between">
              Regra de Vale Refeição (VR)
            </label>
            <div className="flex flex-col gap-2">
              {options.map(opt => (
                <label key={`vr-${opt.value}`} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={acaoVr === opt.value} onChange={() => setAcaoVr(opt.value)} className="text-blue-600 focus:ring-blue-500" />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
            <label className="block text-sm font-medium text-gray-900 mb-3 flex items-center justify-between">
              Regra de Vale Transporte (VT)
            </label>
            <div className="flex flex-col gap-2">
              {options.map(opt => (
                <label key={`vt-${opt.value}`} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={acaoVt === opt.value} onChange={() => setAcaoVt(opt.value)} className="text-blue-600 focus:ring-blue-500" />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end gap-3 mt-2 border-t pt-4">
            <button type="button" onClick={closeForm} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 rounded-md text-white hover:bg-blue-700">{editId ? 'Salvar Alterações' : 'Adicionar à Matriz de Regras'}</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {termos.map(t => (
          <div key={t.id} className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md transition">
            <div className="flex justify-between items-start mb-4">
              <div className="flex gap-2 items-center">
                <div className="bg-gray-900 text-white font-bold text-lg px-3 py-1 rounded">
                  {t.sigla}
                </div>
                <button onClick={() => openEdit(t)} className="text-gray-400 hover:text-blue-600 p-1 transition" title="Editar Regra">
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
              <div className="text-gray-500 text-xs text-right">
                ID: {t.id}
              </div>
            </div>
            
            <h4 className="font-semibold text-gray-800 mb-4 pb-4 border-b border-gray-100">{t.descricao}</h4>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 font-medium">Impacto no VR:</span>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${getBadgeStyle(t.acao_vr)}`}>
                  {t.acao_vr}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 font-medium">Impacto no VT:</span>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${getBadgeStyle(t.acao_vt)}`}>
                  {t.acao_vt}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
