import React, { useState, useEffect } from 'react';
import { Funcionario } from '../types';
import { supabase } from '../lib/supabase';
import { Plus, Building, CreditCard, Bus, Pencil } from 'lucide-react';

export default function Employees() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  // Form state
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [setor, setSetor] = useState('');
  const [vr, setVr] = useState<string>('');
  const [vt, setVt] = useState<string>('');
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    const fetchFuncionarios = async () => {
      console.log('[Employees] Buscando funcionários do banco...');
      const { data, error } = await supabase.from('funcionarios').select('*').order('nome', { ascending: true });
      if (data) setFuncionarios(data);
      if (error) console.error('Erro ao buscar funcionários:', error);
    };
    fetchFuncionarios();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const funcData = {
      nome,
      cpf,
      empresa,
      setor,
      vr_diario: parseFloat(vr),
      vt_diario: parseFloat(vt)
    };
    
    if (editId) {
      console.log('[Employees] Atualizando funcionário:', funcData);
      const { data, error } = await supabase.from('funcionarios').update(funcData).eq('id', editId).select();
      
      if (error) {
        alert('Erro ao atualizar funcionário. ' + error.message);
        return;
      }
      if (data) {
        setFuncionarios(funcionarios.map(f => f.id === editId ? data[0] as Funcionario : f));
        closeForm();
      }
    } else {
      console.log('[Employees] Salvando novo funcionário:', funcData);
      const { data, error } = await supabase.from('funcionarios').insert([funcData]).select();
      
      if (error) {
        alert('Erro ao salvar funcionário. ' + error.message);
        return;
      }
      if (data) {
        setFuncionarios([...funcionarios, data[0] as Funcionario]);
        closeForm();
      }
    }
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditId(null);
    setNome(''); setCpf(''); setEmpresa(''); setSetor(''); setVr(''); setVt('');
  };

  const openEdit = (f: Funcionario) => {
    setEditId(f.id);
    setNome(f.nome);
    setCpf(f.cpf);
    setEmpresa(f.empresa);
    setSetor(f.setor);
    setVr(f.vr_diario.toString());
    setVt(f.vt_diario.toString());
    setIsFormOpen(true);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Colaboradores</h2>
          <p className="text-sm text-gray-500 mt-1">Gerencie a equipe e valores padrão de benefícios.</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Novo Colaborador
        </button>
      </div>

      {isFormOpen && (
        <form onSubmit={handleSave} className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 border-b pb-4 mb-2">
            <h3 className="font-semibold text-gray-800">{editId ? 'Editar Colaborador' : 'Cadastrar Colaborador'}</h3>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
            <input required type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full border p-2 rounded-md focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
            <input required type="text" value={cpf} onChange={e => setCpf(e.target.value)} className="w-full border p-2 rounded-md focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Building className="w-4 h-4 text-gray-400"/> Empresa Vinculada</label>
            <input required type="text" value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Ex: Tech Corp S.A." className="w-full border p-2 rounded-md focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Setor</label>
            <input required type="text" value={setor} onChange={e => setSetor(e.target.value)} placeholder="Ex: Financeiro" className="w-full border p-2 rounded-md focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><CreditCard className="w-4 h-4 text-gray-400"/> VR Diário Padrão (R$)</label>
            <input required type="number" step="0.01" value={vr} onChange={e => setVr(e.target.value)} className="w-full border p-2 rounded-md focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Bus className="w-4 h-4 text-gray-400"/> VT Diário Padrão (R$)</label>
            <input required type="number" step="0.01" value={vt} onChange={e => setVt(e.target.value)} className="w-full border p-2 rounded-md focus:ring-1 focus:ring-blue-500" />
          </div>
          <div className="md:col-span-2 flex justify-end gap-3 mt-4">
            <button type="button" onClick={closeForm} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 rounded-md text-white hover:bg-blue-700">{editId ? 'Salvar Alterações' : 'Salvar'}</button>
          </div>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 font-medium">Nome</th>
              <th className="px-6 py-3 font-medium">Empresa / Setor</th>
              <th className="px-6 py-3 font-medium">VR / Dia</th>
              <th className="px-6 py-3 font-medium">VT / Dia</th>
              <th className="px-6 py-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {funcionarios.map(f => (
              <tr key={f.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{f.nome}</div>
                  <div className="text-gray-500 text-xs">{f.cpf}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1 items-start">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                      <Building className="w-3 h-3" />
                      {f.empresa}
                    </div>
                    <span className="text-xs text-gray-500">{f.setor}</span>
                  </div>
                </td>
                <td className="px-6 py-4 font-medium text-green-600">
                  R$ {f.vr_diario.toFixed(2)}
                </td>
                <td className="px-6 py-4 font-medium text-blue-600">
                  R$ {f.vt_diario.toFixed(2)}
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => openEdit(f)} className="p-2 text-gray-400 hover:text-blue-600 transition" title="Editar Colaborador">
                    <Pencil className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {funcionarios.length === 0 && (
          <div className="p-8 text-center text-gray-500">Nenhum colaborador encontrado.</div>
        )}
      </div>
    </div>
  );
}
