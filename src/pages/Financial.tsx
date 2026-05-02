import { useState, useEffect } from 'react';
import { Funcionario, Termo } from '../types';
import { supabase } from '../lib/supabase';
import { getDaysInMonth, isWeekend, format } from 'date-fns';
import { Info, FileText, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type CalculoFinanceiro = {
  funcionario: Funcionario;
  vrAntecipado: number;
  vtAntecipado: number;
  vrDevido: number;
  vtDevido: number;
  vtPlantao: number;
  saldoVr: number;
  saldoVt: number;
  vrProxima: number;
  vtProxima: number;
  vrSugerido: number;
  vtSugerido: number;
  vrMotivos: string[];
  vtMotivos: string[];
};

export default function Financial() {
  const [calculos, setCalculos] = useState<CalculoFinanceiro[]>([]);
  const [quinzena, setQuinzena] = useState<1 | 2>(1);
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM'));
  const [valoresPagos, setValoresPagos] = useState<Record<string, { vr: string, vt: string }>>({});
  const [valoresAntecipados, setValoresAntecipados] = useState<Record<string, { vr: string, vt: string }>>({});
  const [loading, setLoading] = useState(true);

  const handleValorPagoChange = async (id: string, type: 'vr' | 'vt', value: string) => {
    setValoresPagos(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { vr: '', vt: '' }),
        [type]: value
      }
    }));

    const [yearStr, monthStr] = selectedDate.split('-');
    const currentYear = parseInt(yearStr, 10);
    const currentMonth = parseInt(monthStr, 10);

    const otherType = type === 'vr' ? 'vt' : 'vr';
    const otherValue = valoresPagos[id]?.[otherType] || '';
    
    const vrVal = type === 'vr' ? value : otherValue;
    const vtVal = type === 'vt' ? value : otherValue;

    await supabase
      .from('pagamentos_realizados')
      .upsert({
         funcionario_id: id,
         ano: currentYear,
         mes: currentMonth,
         quinzena: quinzena,
         vr_pago: vrVal ? parseFloat(vrVal) : 0,
         vt_pago: vtVal ? parseFloat(vtVal) : 0
      }, { onConflict: 'funcionario_id,ano,mes,quinzena' });
  };

  const handleValorAntecipadoChange = async (id: string, type: 'vr' | 'vt', value: string) => {
    setValoresAntecipados(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { vr: '', vt: '' }),
        [type]: value
      }
    }));

    const [yearStr, monthStr] = selectedDate.split('-');
    let currentYear = parseInt(yearStr, 10);
    let currentMonth = parseInt(monthStr, 10);
    let prevQuinzena = quinzena === 1 ? 2 : 1;
    if (prevQuinzena === 2) {
        currentMonth--;
        if (currentMonth < 1) {
            currentMonth = 12;
            currentYear--;
        }
    }

    const otherType = type === 'vr' ? 'vt' : 'vr';
    const otherValue = valoresAntecipados[id]?.[otherType] || '';
    
    const vrVal = type === 'vr' ? value : otherValue;
    const vtVal = type === 'vt' ? value : otherValue;

    await supabase
      .from('pagamentos_realizados')
      .upsert({
         funcionario_id: id,
         ano: currentYear,
         mes: currentMonth,
         quinzena: prevQuinzena,
         vr_pago: vrVal ? parseFloat(vrVal) : 0,
         vt_pago: vtVal ? parseFloat(vtVal) : 0
      }, { onConflict: 'funcionario_id,ano,mes,quinzena' });
  };

  useEffect(() => {
    const calcularEstatisticas = async () => {
      setLoading(true);
      console.log(`[Financial] Inicializando motor de cálculo de fechamento para ${selectedDate} - ${quinzena}ª quinzena`);
      
      const [{ data: funcs }, { data: terms }] = await Promise.all([
        supabase.from('funcionarios').select('*').order('nome'),
        supabase.from('termos').select('*').order('sigla')
      ]);

      const funcionariosDB: Funcionario[] = funcs || [];
      const termosDB: Termo[] = terms || [];

      const [yearStr, monthStr] = selectedDate.split('-');
      const currentYear = parseInt(yearStr, 10);
      const currentMonth = parseInt(monthStr, 10) - 1;
      const daysInMonth = getDaysInMonth(new Date(currentYear, currentMonth));
      
      const startDay = quinzena === 1 ? 1 : 16;
      const endDay = quinzena === 1 ? 15 : daysInMonth;

      const startDate = `${selectedDate}-01`;
      const endDate = `${selectedDate}-${daysInMonth}`;

      let anoAnterior = currentYear;
      let mesAnterior = parseInt(monthStr, 10);
      let quinzenaAnterior = quinzena === 1 ? 2 : 1;
      
      if (quinzena === 1) {
          mesAnterior--;
          if (mesAnterior === 0) {
              mesAnterior = 12;
              anoAnterior--;
          }
      }

      const [
        { data: freqData },
        { data: pagsAnteriores },
        { data: pagsAtuais }
      ] = await Promise.all([
        supabase
          .from('frequencia')
          .select('*')
          .gte('data', startDate)
          .lte('data', endDate),
        supabase
          .from('pagamentos_realizados')
          .select('*')
          .eq('ano', anoAnterior)
          .eq('mes', mesAnterior)
          .eq('quinzena', quinzenaAnterior),
        supabase
          .from('pagamentos_realizados')
          .select('*')
          .eq('ano', currentYear)
          .eq('mes', parseInt(monthStr, 10))
          .eq('quinzena', quinzena)
      ]);

      const savedGrid: Record<string, Record<string, string>> = {};
      if (freqData) {
        freqData.forEach(f => {
          const dayStr = parseInt(f.data.split('-')[2], 10).toString();
          if (!savedGrid[f.funcionario_id]) savedGrid[f.funcionario_id] = {};
          savedGrid[f.funcionario_id][dayStr] = f.termo_id;
        });
      }

      const pagamentosAntMap: Record<string, any> = {};
      const valoresAntAtuais: Record<string, {vr: string, vt: string}> = {};
      if (pagsAnteriores) {
          pagsAnteriores.forEach(p => {
              pagamentosAntMap[p.funcionario_id] = p;
              valoresAntAtuais[p.funcionario_id] = {
                  vr: p.vr_pago !== null && p.vr_pago !== 0 ? p.vr_pago.toString() : '',
                  vt: p.vt_pago !== null && p.vt_pago !== 0 ? p.vt_pago.toString() : ''
              };
          });
      }
      setValoresAntecipados(valoresAntAtuais);

      const valoresPagosAtuais: Record<string, {vr: string, vt: string}> = {};
      if (pagsAtuais) {
          pagsAtuais.forEach(p => {
              valoresPagosAtuais[p.funcionario_id] = {
                  vr: p.vr_pago !== null && p.vr_pago !== 0 ? p.vr_pago.toString() : '',
                  vt: p.vt_pago !== null && p.vt_pago !== 0 ? p.vt_pago.toString() : ''
              };
          });
      }
      setValoresPagos(valoresPagosAtuais);

      let diasUteisAtual = 0;
      for (let day = startDay; day <= endDay; day++) {
        const date = new Date(currentYear, currentMonth, day);
        if (!isWeekend(date)) diasUteisAtual++;
      }

      // Calcula dias úteis da próxima quinzena
      let nextYear = currentYear;
      let nextMonth = currentMonth;
      let proxQuinzena = quinzena === 1 ? 2 : 1;
      if (proxQuinzena === 1) {
          nextMonth++;
          if (nextMonth > 11) {
              nextMonth = 0;
              nextYear++;
          }
      }
      const daysInNextMonth = getDaysInMonth(new Date(nextYear, nextMonth));
      const nextStartDay = proxQuinzena === 1 ? 1 : 16;
      const nextEndDay = proxQuinzena === 1 ? 15 : daysInNextMonth;

      let diasUteisProxima = 0;
      for (let day = nextStartDay; day <= nextEndDay; day++) {
          const date = new Date(nextYear, nextMonth, day);
          if (!isWeekend(date)) diasUteisProxima++;
      }

      const calculosSimulados = funcionariosDB.map(func => {
        let vrDevidoCalculado = 0;
        let vtDevidoCalculado = 0;
        let vtPlantaoCalculado = 0;
        const vrMotivos: string[] = [];
        const vtMotivos: string[] = [];

        const funcGrid = savedGrid[func.id] || {};

        for (let day = startDay; day <= endDay; day++) {
          const date = new Date(currentYear, currentMonth, day);
          const isFds = isWeekend(date);
          const termoId = funcGrid[day.toString()];
          const termo = termosDB.find(t => t.id === termoId);

          if (!isFds && !termo) {
              vrDevidoCalculado += func.vr_diario;
              vtDevidoCalculado += func.vt_diario;
          } else if (termo) {
             // VR Logic
             if (termo.acao_vr === 'PAGA') vrDevidoCalculado += func.vr_diario;
             else if (termo.acao_vr === 'EXTRA') {
                 vrDevidoCalculado += func.vr_diario;
                 vrMotivos.push(`Dia ${day}: ${termo.descricao} (+R$ ${func.vr_diario.toFixed(2)})`);
             }
             else if (termo.acao_vr === 'DESCONTA') {
                 vrMotivos.push(`Dia ${day}: ${termo.descricao} (-R$ ${func.vr_diario.toFixed(2)})`);
             }
             else if (termo.acao_vr === 'NEUTRO') {
                 vrMotivos.push(`Dia ${day}: ${termo.descricao} (Não Paga)`);
             }
             else if (termo.acao_vr === 'PLANTAO') {
                 vrMotivos.push(`Dia ${day}: ${termo.descricao} (Plantão: Não Paga VR)`);
             }

             // VT Logic
             if (termo.acao_vt === 'PAGA') vtDevidoCalculado += func.vt_diario;
             else if (termo.acao_vt === 'EXTRA') {
                 vtDevidoCalculado += func.vt_diario;
                 vtMotivos.push(`Dia ${day}: ${termo.descricao} (+R$ ${func.vt_diario.toFixed(2)})`);
             }
             else if (termo.acao_vt === 'DESCONTA') {
                 vtMotivos.push(`Dia ${day}: ${termo.descricao} (-R$ ${func.vt_diario.toFixed(2)})`);
             }
             else if (termo.acao_vt === 'NEUTRO') {
                 vtMotivos.push(`Dia ${day}: ${termo.descricao} (Não Paga)`);
             }
             else if (termo.acao_vt === 'PLANTAO') {
                 vtPlantaoCalculado += func.vt_diario;
                 vtMotivos.push(`Dia ${day}: ${termo.descricao} (+R$ ${func.vt_diario.toFixed(2)} - Plantão)`);
             }
          }
        }

        const pagAnt = pagamentosAntMap[func.id];
        let vrAntecipado = pagAnt && pagAnt.vr_pago !== null && pagAnt.vr_pago > 0 ? Number(pagAnt.vr_pago) : func.vr_diario * diasUteisAtual;
        let vtAntecipado = pagAnt && pagAnt.vt_pago !== null && pagAnt.vt_pago > 0 ? Number(pagAnt.vt_pago) : func.vt_diario * diasUteisAtual;

        let saldoVr = vrDevidoCalculado - vrAntecipado;
        let saldoVt = (vtDevidoCalculado + vtPlantaoCalculado) - vtAntecipado;

        const isMayTransition = selectedDate === '2026-05' && quinzena === 1;
        if (isMayTransition) {
            saldoVr = 0;
            saldoVt = 0;
            vrMotivos.length = 0;
            vtMotivos.length = 0;
            vrDevidoCalculado = vrAntecipado;
            vtDevidoCalculado = vtAntecipado;
            vtPlantaoCalculado = 0;
        }

        if (saldoVr < 0 && vrMotivos.length === 0) {
            vrMotivos.push(`Ajuste ref. diferença de valor antecipado`);
        } else if (saldoVr > 0 && vrMotivos.length === 0) {
            vrMotivos.push(`Acréscimo ref. diferença de valor antecipado`);
        }

        if (saldoVt < 0 && vtMotivos.length === 0) {
            vtMotivos.push(`Ajuste ref. diferença de valor antecipado`);
        } else if (saldoVt > 0 && vtMotivos.length === 0) {
            vtMotivos.push(`Acréscimo ref. diferença de valor antecipado`);
        }

        const vrProxima = func.vr_diario * diasUteisProxima;
        const vtProxima = func.vt_diario * diasUteisProxima;
        
        const vrSugerido = vrProxima + saldoVr;
        const vtSugerido = vtProxima + saldoVt;

        return {
          funcionario: func,
          vrAntecipado,
          vtAntecipado,
          vrDevido: vrDevidoCalculado,
          vtDevido: vtDevidoCalculado,
          vtPlantao: vtPlantaoCalculado,
          saldoVr,
          saldoVt,
          vrProxima,
          vtProxima,
          vrSugerido,
          vtSugerido,
          vrMotivos,
          vtMotivos
        };
      });

      console.log('[Financial] Cálculos efetuados com sucesso:', calculosSimulados);
      setCalculos(calculosSimulados);
      setLoading(false);
    };

    calcularEstatisticas();
  }, [quinzena, selectedDate]);

  const renderTooltip = (motivos: string[]) => {
    if (motivos.length === 0) return null;
    return (
      <div className="group relative inline-flex items-center justify-center">
        <Info className="w-4 h-4 text-gray-400 ml-1 cursor-help hover:text-blue-500" />
        <div className="absolute bottom-full right-0 md:left-1/2 md:-translate-x-1/2 mb-2 w-max max-w-[200px] sm:max-w-xs bg-gray-900 text-white text-xs rounded-md py-1.5 px-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
          <ul className="text-left list-disc pl-3">
            {motivos.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
          <div className="absolute top-full right-2 md:left-1/2 md:-translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>
    );
  };

  const exportToExcel = () => {
    const dataToExport = calculos.map(calc => ({
      'Colaborador': calc.funcionario.nome,
      'Empresa': calc.funcionario.empresa,
      'Setor': calc.funcionario.setor,
      'VR Antecipado': calc.vrAntecipado.toFixed(2),
      'VR Realizado': calc.vrDevido.toFixed(2),
      'VR Ajuste': calc.saldoVr.toFixed(2),
      'VR Padrão Próx': calc.vrProxima.toFixed(2),
      'VR A Pagar': calc.vrSugerido.toFixed(2),
      'VR Valor Pago': valoresPagos[calc.funcionario.id]?.vr || '',
      'VT Antecipado': calc.vtAntecipado.toFixed(2),
      'VT Realizado': calc.vtDevido.toFixed(2),
      'VT Plantão': calc.vtPlantao.toFixed(2),
      'VT Ajuste': calc.saldoVt.toFixed(2),
      'VT Padrão Próx': calc.vtProxima.toFixed(2),
      'VT A Pagar': calc.vtSugerido.toFixed(2),
      'VT Valor Pago': valoresPagos[calc.funcionario.id]?.vt || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fechamento");
    XLSX.writeFile(wb, `Fechamento_${selectedDate}_Q${quinzena}.xlsx`);
  };

  const exportReceiptPDF = (calc: CalculoFinanceiro) => {
    const doc = new jsPDF();
    const title = `Recibo de Beneficios`;
    const subtitle = `${calc.funcionario.nome} | ${calc.funcionario.empresa} - ${calc.funcionario.setor}`;
    const period = `Competencia: ${selectedDate} | ${quinzena} Quinzena`;

    doc.setFontSize(16);
    doc.text(title, 14, 20);
    
    doc.setFontSize(12);
    doc.text(subtitle, 14, 30);
    doc.text(period, 14, 38);

    autoTable(doc, {
      startY: 45,
      head: [['Resumo VR', 'Valor (R$)']],
      body: [
        ['Antecipado', calc.vrAntecipado.toFixed(2)],
        ['Realizado', calc.vrDevido.toFixed(2)],
        ['Ajuste (Descontos/Extras)', calc.saldoVr.toFixed(2)],
        ['Padrao Prox. Quinzena', calc.vrProxima.toFixed(2)],
        ['Total Sugerido a Pagar', calc.vrSugerido.toFixed(2)],
      ],
      theme: 'grid',
    });

    let finalY = (doc as any).lastAutoTable.finalY + 10;

    if (calc.vrMotivos.length > 0) {
      doc.setFontSize(10);
      doc.text('Detalhamento de Ajustes VR:', 14, finalY);
      autoTable(doc, {
        startY: finalY + 5,
        body: calc.vrMotivos.map(m => [m]),
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 1 }
      });
      finalY = (doc as any).lastAutoTable.finalY + 10;
    }

    autoTable(doc, {
      startY: finalY,
      head: [['Resumo VT', 'Valor (R$)']],
      body: [
        ['Antecipado', calc.vtAntecipado.toFixed(2)],
        ['Realizado', calc.vtDevido.toFixed(2)],
        ['Plantoes', calc.vtPlantao.toFixed(2)],
        ['Ajuste (Descontos/Extras)', calc.saldoVt.toFixed(2)],
        ['Padrao Prox. Quinzena', calc.vtProxima.toFixed(2)],
        ['Total Sugerido a Pagar', calc.vtSugerido.toFixed(2)],
      ],
      theme: 'grid',
    });

    finalY = (doc as any).lastAutoTable.finalY + 10;

    if (calc.vtMotivos.length > 0) {
      doc.setFontSize(10);
      doc.text('Detalhamento de Ajustes VT:', 14, finalY);
      autoTable(doc, {
        startY: finalY + 5,
        body: calc.vtMotivos.map(m => [m]),
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 1 }
      });
      finalY = (doc as any).lastAutoTable.finalY + 10;
    }

    doc.setFontSize(10);
    doc.text('____________________________________________________', 14, finalY + 30);
    doc.text('Assinatura do Colaborador', 14, finalY + 36);

    doc.save(`Recibo_${calc.funcionario.nome}_${selectedDate}_Q${quinzena}.pdf`);
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8 relative">
      {loading && (
        <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Demonstrativo Financeiro</h2>
          <p className="text-sm text-gray-500 mt-1">Comparativo entre valor padrão antecipado e valor devido para a quinzena.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 mt-4 md:mt-0">
          <div>
            <label className="sr-only">Mês/Ano</label>
            <input 
              type="month" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex bg-gray-100 p-1 rounded-md border border-gray-200">
            <button
              onClick={() => setQuinzena(1)}
              className={`px-3 py-1.5 text-sm font-medium rounded ${quinzena === 1 ? 'bg-white text-blue-700 shadow-sm transition' : 'text-gray-600 hover:text-gray-900 transition'}`}
            >
              1ª Quinzena
            </button>
            <button
              onClick={() => setQuinzena(2)}
              className={`px-3 py-1.5 text-sm font-medium rounded ${quinzena === 2 ? 'bg-white text-blue-700 shadow-sm transition' : 'text-gray-600 hover:text-gray-900 transition'}`}
            >
              2ª Quinzena
            </button>
          </div>
          <button
            onClick={exportToExcel}
            className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-1.5 rounded-md text-sm hover:bg-green-700 transition shadow-sm font-medium"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-sm text-left min-w-[1000px]">
          <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 font-semibold align-middle" rowSpan={2}>Colaborador / Empresa</th>
              <th className="px-4 py-2 font-semibold text-center border-b border-gray-200" colSpan={6}>Vale Refeição (VR)</th>
              <th className="px-4 py-2 font-semibold text-center border-b border-gray-200 border-l" colSpan={7}>Vale Transporte (VT)</th>
              <th className="px-4 py-3 font-semibold text-center border-l align-middle" rowSpan={2}>Ações</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-2 py-2 font-semibold text-right">Antecipado</th>
              <th className="px-2 py-2 font-semibold text-right">Realizado</th>
              <th className="px-2 py-2 font-semibold text-right">Ajuste</th>
              <th className="px-2 py-2 font-semibold text-right text-gray-500">Padrão Próx.</th>
              <th className="px-2 py-2 font-semibold text-right bg-blue-50 text-blue-800">A Pagar</th>
              <th className="px-2 py-2 font-semibold text-center">Valor Pago</th>
              <th className="px-2 py-2 font-semibold text-right border-l">Antecipado</th>
              <th className="px-2 py-2 font-semibold text-right">Realizado</th>
              <th className="px-2 py-2 font-semibold text-right text-purple-700">Plantão</th>
              <th className="px-2 py-2 font-semibold text-right">Ajuste</th>
              <th className="px-2 py-2 font-semibold text-right text-gray-500">Padrão Próx.</th>
              <th className="px-2 py-2 font-semibold text-right bg-blue-50 text-blue-800">A Pagar</th>
              <th className="px-2 py-2 font-semibold text-center">Valor Pago</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {calculos.map(({ funcionario, vrAntecipado, vrDevido, saldoVr, vtAntecipado, vtDevido, vtPlantao, saldoVt, vrProxima, vtProxima, vrSugerido, vtSugerido, vrMotivos, vtMotivos }) => (
              <tr key={funcionario.id} className="hover:bg-gray-50 bg-white">
                <td className="px-4 py-3">
                  <div className="font-bold text-gray-900">{funcionario.nome}</div>
                  <div className="text-xs text-gray-500">{funcionario.empresa} - {funcionario.setor}</div>
                </td>
                
                <td className="px-4 py-3 text-right text-gray-500">
                  {selectedDate === '2026-05' && quinzena === 1 ? (
                    <input
                      type="number"
                      step="0.01"
                      className="w-20 px-2 py-1 text-right border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="0.00"
                      value={valoresAntecipados[funcionario.id]?.vr || ''}
                      onChange={(e) => handleValorAntecipadoChange(funcionario.id, 'vr', e.target.value)}
                    />
                  ) : (
                    <>
                      R$ {vrAntecipado.toFixed(2)}
                      {funcionario.vr_diario > 0 && <div className="text-[10px] text-gray-400 font-normal mt-0.5">{(vrAntecipado / funcionario.vr_diario).toFixed(1).replace('.0', '')} dias</div>}
                    </>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  R$ {vrDevido.toFixed(2)}
                  {funcionario.vr_diario > 0 && <div className="text-[10px] text-gray-400 font-normal mt-0.5">{(vrDevido / funcionario.vr_diario).toFixed(1).replace('.0', '')} dias</div>}
                </td>
                <td className={`px-4 py-3 text-right text-xs font-semibold ${saldoVr > 0 ? 'text-green-600' : saldoVr < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  <div className="flex justify-end items-center">
                    {saldoVr > 0 ? `+ R$ ${saldoVr.toFixed(2)}` : saldoVr < 0 ? `- R$ ${Math.abs(saldoVr).toFixed(2)}` : 'R$ 0.00'}
                    {renderTooltip(vrMotivos)}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  R$ {vrProxima.toFixed(2)}
                  {funcionario.vr_diario > 0 && <div className="text-[10px] text-gray-400 font-normal mt-0.5">{(vrProxima / funcionario.vr_diario).toFixed(1).replace('.0', '')} dias</div>}
                </td>
                <td className={`px-4 py-3 text-right font-bold bg-blue-50/50 ${vrSugerido < 0 ? 'text-red-600' : 'text-blue-700'}`}>
                  R$ {vrSugerido.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center">
                    <span className="text-gray-500 mr-1 text-xs">R$</span>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-24 px-2 py-1 text-right border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                      value={valoresPagos[funcionario.id]?.vr || ''}
                      onChange={(e) => handleValorPagoChange(funcionario.id, 'vr', e.target.value)}
                    />
                  </div>
                </td>
                
                <td className="px-4 py-3 text-right border-l text-gray-500">
                  {selectedDate === '2026-05' && quinzena === 1 ? (
                    <input
                      type="number"
                      step="0.01"
                      className="w-20 px-2 py-1 text-right border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="0.00"
                      value={valoresAntecipados[funcionario.id]?.vt || ''}
                      onChange={(e) => handleValorAntecipadoChange(funcionario.id, 'vt', e.target.value)}
                    />
                  ) : (
                    <>
                      R$ {vtAntecipado.toFixed(2)}
                      {funcionario.vt_diario > 0 && <div className="text-[10px] text-gray-400 font-normal mt-0.5">{(vtAntecipado / funcionario.vt_diario).toFixed(1).replace('.0', '')} dias</div>}
                    </>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  R$ {vtDevido.toFixed(2)}
                  {funcionario.vt_diario > 0 && <div className="text-[10px] text-gray-400 font-normal mt-0.5">{(vtDevido / funcionario.vt_diario).toFixed(1).replace('.0', '')} dias</div>}
                </td>
                <td className="px-4 py-3 text-right font-medium text-purple-700 bg-purple-50/30">
                  R$ {vtPlantao.toFixed(2)}
                  {funcionario.vt_diario > 0 && vtPlantao > 0 && <div className="text-[10px] text-purple-400 font-normal mt-0.5">{(vtPlantao / funcionario.vt_diario).toFixed(1).replace('.0', '')} dias</div>}
                </td>
                <td className={`px-4 py-3 text-right text-xs font-semibold ${saldoVt > 0 ? 'text-green-600' : saldoVt < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  <div className="flex justify-end items-center">
                    {saldoVt > 0 ? `+ R$ ${saldoVt.toFixed(2)}` : saldoVt < 0 ? `- R$ ${Math.abs(saldoVt).toFixed(2)}` : 'R$ 0.00'}
                    {renderTooltip(vtMotivos)}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  R$ {vtProxima.toFixed(2)}
                  {funcionario.vt_diario > 0 && <div className="text-[10px] text-gray-400 font-normal mt-0.5">{(vtProxima / funcionario.vt_diario).toFixed(1).replace('.0', '')} dias</div>}
                </td>
                <td className={`px-4 py-3 text-right font-bold bg-blue-50/50 ${vtSugerido < 0 ? 'text-red-600' : 'text-blue-700'}`}>
                  R$ {vtSugerido.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center">
                    <span className="text-gray-500 mr-1 text-xs">R$</span>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-24 px-2 py-1 text-right border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                      value={valoresPagos[funcionario.id]?.vt || ''}
                      onChange={(e) => handleValorPagoChange(funcionario.id, 'vt', e.target.value)}
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-center border-l">
                  <button
                    onClick={() => exportReceiptPDF({ funcionario, vrAntecipado, vrDevido, saldoVr, vtAntecipado, vtDevido, vtPlantao, saldoVt, vrProxima, vtProxima, vrSugerido, vtSugerido, vrMotivos, vtMotivos })}
                    className={`inline-flex items-center justify-center p-2 rounded text-white transition ${vrMotivos.length > 0 || vtMotivos.length > 0 ? 'bg-orange-500 hover:bg-orange-600' : 'bg-gray-400 hover:bg-gray-500'}`}
                    title="Baixar Recibo (PDF)"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
