import { Funcionario, Termo, Frequencia } from '../types';

export const dummyFuncionarios: Funcionario[] = [
  { id: '1', nome: 'João Pedro Silva', cpf: '111.111.111-11', empresa: 'Tech Corp S.A.', setor: 'TI', vr_diario: 35.0, vt_diario: 12.5 },
  { id: '2', nome: 'Maria Oliveira', cpf: '222.222.222-22', empresa: 'Tech Corp S.A.', setor: 'Administrativo', vr_diario: 35.0, vt_diario: 10.0 },
  { id: '3', nome: 'Carlos Souza', cpf: '333.333.333-33', empresa: 'Global Solutions', setor: 'Operações', vr_diario: 40.0, vt_diario: 15.0 }
];

export const dummyTermos: Termo[] = [
  { id: 't1', sigla: 'T', descricao: 'Trabalhou Regular', acao_vr: 'PAGA', acao_vt: 'PAGA' },
  { id: 't2', sigla: 'F', descricao: 'Falta Injustificada', acao_vr: 'DESCONTA', acao_vt: 'DESCONTA' },
  { id: 't3', sigla: 'FM', descricao: 'Falta Médica (Atestado)', acao_vr: 'PAGA', acao_vt: 'NEUTRO' },
  { id: 't4', sigla: 'P', descricao: 'Plantão Extra', acao_vr: 'EXTRA', acao_vt: 'EXTRA' }
];

// Gerar uma matriz de frequência simples
export const dummyFrequencias: Frequencia[] = [
  { id: 'f1', funcionario_id: '1', data: '2023-10-01', termo_id: 't1' },
];
