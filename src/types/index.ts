export type AcaoBeneficio = 'PAGA' | 'DESCONTA' | 'EXTRA' | 'NEUTRO' | 'PLANTAO';

export interface Funcionario {
  id: string;
  nome: string;
  cpf: string;
  empresa: string;
  setor: string;
  vr_diario: number;
  vt_diario: number;
}

export interface Termo {
  id: string;
  sigla: string;
  descricao: string;
  acao_vr: AcaoBeneficio;
  acao_vt: AcaoBeneficio;
}

export interface Frequencia {
  id: string;
  funcionario_id: string;
  data: string; // YYYY-MM-DD
  termo_id: string;
}

export interface AuthSession {
  user: { id: string; email: string } | null;
}
