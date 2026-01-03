
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { 
  Macchina, 
  Lavorazione, 
  FaseLavorazione, 
  StatoId, 
  FaseId 
} from './types';
import { 
  Settings, 
  Plus, 
  Calendar, 
  Loader2, 
  CheckCircle2, 
  PlayCircle, 
  Clock, 
  AlertCircle,
  Image as ImageIcon,
  Scan,
  Cpu,
  FileSearch,
  Check,
  XCircle,
  ChevronRight,
  Smartphone,
  X,
  Copy,
  AlertTriangle,
  RefreshCw,
  Link as LinkIcon,
  MousePointer2,
  Weight,
  BarChart3,
  Share2,
  Info,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { processProductionSheet } from './geminiService';

// --- Helper Components ---

const StatusBadge = ({ statusId }: { statusId: string }) => {
  const styles: Record<string, string> = {
    [StatoId.ATT]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    [StatoId.PRO]: 'bg-blue-100 text-blue-800 border-blue-200',
    [StatoId.EXT]: 'bg-slate-100 text-slate-800 border-slate-200',
    [StatoId.TER]: 'bg-green-100 text-green-800 border-green-200',
  };
  const labels: Record<string, string> = {
    [StatoId.ATT]: 'IN ATTESA',
    [StatoId.PRO]: 'IN PRODUZIONE',
    [StatoId.EXT]: 'IN USCITA',
    [StatoId.TER]: 'TERMINATA',
  };
  return (
    <span className={`px-2 py-1 text-[10px] font-black border rounded-lg ${styles[statusId] || 'bg-gray-100'}`}>
      {labels[statusId] || statusId}
    </span>
  );
};

const SmartScannerLoader = () => {
  const [step, setStep] = useState(0);
  const messages = [
    { text: "Acquisizione immagine...", icon: <ImageIcon className="w-5 h-5" /> },
    { text: "Identificazione parametri...", icon: <FileSearch className="w-5 h-5" /> },
    { text: "Analisi IA Master Coil...", icon: <Cpu className="w-5 h-5" /> },
    { text: "Estrazione dati cliente...", icon: <Scan className="w-5 h-5" /> },
    { text: "Sincronizzazione DB...", icon: <Check className="w-5 h-5" /> },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s < messages.length - 1 ? s + 1 : s));
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center py-8 px-4">
      <div className="relative w-40 h-56 bg-slate-50 rounded-[2rem] overflow-hidden border-2 border-slate-200 mb-8 shadow-inner">
        <div className="absolute w-full h-1 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-[scan_2s_ease-in-out_infinite] z-10" />
        <div className="p-4 space-y-3 opacity-10">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-2 bg-slate-400 rounded w-full" style={{ width: `${Math.random()*40 + 60}%` }} />)}
        </div>
      </div>
      <div className="space-y-3 w-full max-w-xs text-left">
        {messages.map((m, i) => (
          <div key={i} className={`flex items-center gap-3 transition-all duration-300 ${i === step ? 'text-blue-600 font-bold' : i < step ? 'text-green-500 opacity-60' : 'text-slate-300 opacity-40'}`}>
            <div className={`p-1.5 rounded-lg ${i === step ? 'bg-blue-100 animate-pulse' : 'bg-slate-50'}`}>
              {i < step ? <CheckCircle2 className="w-4 h-4" /> : m.icon}
            </div>
            <span className="text-[10px] uppercase font-black tracking-widest">{m.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [currentMachine, setCurrentMachine] = useState<Macchina | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [macchine, setMacchine] = useState<Macchina[]>([]);
  const [fasi, setFasi] = useState<FaseLavorazione[]>([]);
  const [lavorazioni, setLavorazioni] = useState<Lavorazione[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [showMachineSelector, setShowMachineSelector] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrUrl, setQrUrl] = useState(window.location.href.startsWith('blob:') ? '' : window.location.href);
  const [processingImage, setProcessingImage] = useState(false);
  const [scannedData, setScannedData] = useState<any>(null);
  const [showPhasePicker, setShowPhasePicker] = useState<{ visible: boolean; orderId?: string; isNew?: boolean }>({ visible: false });
  const [showTerminaModal, setShowTerminaModal] = useState<{ visible: boolean; order?: Lavorazione }>({ visible: false });
  const [workedKg, setWorkedKg] = useState<string>('0');
  const [showNextMachinePicker, setShowNextMachinePicker] = useState<{ visible: boolean; order?: Lavorazione; nextFase?: FaseId }>({ visible: false });
  const [isSaving, setIsSaving] = useState(false);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [mRes, fRes] = await Promise.all([
        supabase.from('macchine').select('*').order('macchina'),
        supabase.from('fasi_di_lavorazione').select('*').order('fase_di_lavorazione')
      ]);
      if (mRes.error) throw mRes.error;
      if (fRes.error) throw fRes.error;
      setMacchine(mRes.data || []);
      setFasi(fRes.data || []);
      const stored = localStorage.getItem('kme_selected_machine');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (mRes.data?.some(m => m.id_macchina === parsed.id_macchina)) {
          setCurrentMachine(parsed);
          setShowMachineSelector(false);
        } else setShowMachineSelector(true);
      } else setShowMachineSelector(true);
    } catch (err: any) {
      setDbError(err.message);
      setShowMachineSelector(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadInitialData(); }, []);

  const fetchLavorazioni = useCallback(async () => {
    if (!currentMachine) return;
    setLoading(true);
    const start = `${selectedDate}T00:00:00.000Z`;
    const end = `${selectedDate}T23:59:59.999Z`;
    try {
      const { data, error } = await supabase
        .from('lavorazioni')
        .select(`*, macchine:id_macchina(macchina), fasi:id_fase(fase_di_lavorazione), stati:id_stato(stato_lavorazione), clienti:id_cliente(cliente)`)
        .eq('id_macchina', currentMachine.id_macchina)
        .gte('id_lavorazione', start)
        .lte('id_lavorazione', end)
        .order('id_lavorazione', { ascending: true });
      if (error) throw error;
      setLavorazioni((data || []).map(d => ({
        ...d,
        macchina: d.macchine?.macchina,
        fase_desc: d.fasi?.fase_di_lavorazione,
        stato_desc: d.stati?.stato_lavorazione,
        cliente_desc: d.clienti?.cliente
      })));
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [currentMachine, selectedDate]);

  useEffect(() => { fetchLavorazioni(); }, [fetchLavorazioni]);

  // Totale lavorato
  const stats = useMemo(() => {
    return lavorazioni.reduce((acc, curr) => {
      acc.lavorati += (curr.ordine_kg_lavorato || 0);
      return acc;
    }, { lavorati: 0 });
  }, [lavorazioni]);

  const ensureClienteExists = async (id: string, nome: string) => {
    if (!id) id = 'GENERICO';
    const { data: existing, error: checkError } = await supabase.from('clienti').select('id_cliente').eq('id_cliente', id).maybeSingle();
    if (!existing) {
      const { error: insertError } = await supabase.from('clienti').insert([{ id_cliente: id, cliente: nome || id }]);
      if (insertError) {
        console.error("Errore creazione cliente:", insertError);
        throw new Error("Impossibile creare il cliente nel database.");
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessingImage(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64 = (event.target?.result as string).split(',')[1];
          const data = await processProductionSheet(base64);
          setScannedData(data);
          setShowScanner(false);
        } catch (err: any) { alert("ERRORE ANALISI: " + err.message); } 
        finally { setProcessingImage(false); }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert("Errore caricamento: " + err.message);
      setProcessingImage(false);
    }
  };

  const startProduction = async (faseId: string) => {
    if (!currentMachine) return;
    setIsSaving(true);
    const now = new Date().toISOString();
    
    try {
      if (showPhasePicker.isNew && scannedData) {
        const cid = scannedData.id_cliente || 'GENERICO';
        const cnome = scannedData.cliente_nome || 'Cliente Generico';
        await ensureClienteExists(cid, cnome);

        const safeInt = (val: any) => {
          const parsed = parseInt(val);
          return isNaN(parsed) ? 0 : parsed;
        };
        const safeFloat = (val: any) => {
          const parsed = parseFloat(val);
          return isNaN(parsed) ? 0 : parsed;
        };

        const insertData = {
          id_macchina: currentMachine.id_macchina,
          id_fase: faseId,
          id_stato: StatoId.PRO,
          scheda: Math.min(safeInt(scannedData.scheda), 32767),
          mcoil: scannedData.mcoil || 'N/D',
          mcoil_kg: Math.min(safeInt(scannedData.mcoil_kg), 32767),
          spessore: safeFloat(scannedData.spessore),
          mcoil_larghezza: safeFloat(scannedData.mcoil_larghezza),
          mcoil_lega: scannedData.mcoil_lega || 'N/D',
          mcoil_stato_fisico: scannedData.mcoil_stato_fisico || 'N/D',
          conferma_voce: scannedData.conferma_voce || 'SI',
          id_cliente: cid,
          ordine_kg_richiesto: Math.min(safeInt(scannedData.ordine_kg_richiesto), 32767),
          ordine_kg_lavorato: Math.min(safeInt(scannedData.ordine_kg_lavorato), 32767),
          misura: safeFloat(scannedData.misura),
          inizio_lavorazione: now
        };

        const { error } = await supabase.from('lavorazioni').insert([insertData]);
        if (error) {
          console.error("DB Error:", error);
          throw new Error(error.message);
        }
        setScannedData(null);
      } else if (showPhasePicker.orderId) {
        const { error } = await supabase
          .from('lavorazioni')
          .update({ id_fase: faseId, id_stato: StatoId.PRO, inizio_lavorazione: now })
          .eq('id_lavorazione', showPhasePicker.orderId);
        if (error) throw error;
      }
      setShowPhasePicker({ visible: false });
      await fetchLavorazioni();
    } catch (err: any) {
      alert("ERRORE DATABASE: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmEndProduction = async () => {
    const order = showTerminaModal.order;
    if (!order) return;
    setIsSaving(true);
    const now = new Date().toISOString();
    const kg = parseInt(workedKg) || order.ordine_kg_lavorato;

    try {
      let nextStatus = StatoId.TER;
      let action: 'none' | 'pick' | 'imb' | 'cas' | 'mlt' = 'none';

      switch (order.id_fase) {
        case FaseId.TDI: case FaseId.AVV: case FaseId.TST: action = 'imb'; break;
        case FaseId.TSB: action = 'pick'; break;
        case FaseId.MLT: action = 'mlt'; break;
        case FaseId.MAM: action = 'pick'; break;
        case FaseId.ROT: action = 'cas'; break;
        case FaseId.MST: nextStatus = StatoId.EXT; action = 'imb'; break;
      }

      const { error: updateError } = await supabase.from('lavorazioni').update({ 
        id_stato: nextStatus, 
        fine_lavorazione: now, 
        ordine_kg_lavorato: kg 
      }).eq('id_lavorazione', order.id_lavorazione);

      if (updateError) throw updateError;

      if (action === 'imb') await createFollowUp(order, 'IMB', StatoId.ATT);
      else if (action === 'cas') await createFollowUp(order, 'CAS', StatoId.ATT);
      else if (action === 'mlt') await createFollowUp(order, order.id_macchina, StatoId.ATT);
      else if (action === 'pick') {
        setShowTerminaModal({ visible: false });
        setShowNextMachinePicker({ visible: true, order, nextFase: order.id_fase as FaseId });
        setIsSaving(false);
        return;
      }

      setShowTerminaModal({ visible: false });
      await fetchLavorazioni();
    } catch (err: any) {
      alert("Errore chiusura: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const createFollowUp = async (orig: Lavorazione, macId: string, statId: string) => {
    const { error } = await supabase.from('lavorazioni').insert([{
      id_macchina: macId,
      id_fase: orig.id_fase,
      id_stato: statId,
      scheda: orig.scheda,
      mcoil: orig.mcoil,
      mcoil_kg: orig.mcoil_kg,
      spessore: orig.spessore,
      mcoil_larghezza: orig.mcoil_larghezza,
      mcoil_lega: orig.mcoil_lega,
      mcoil_stato_fisico: orig.mcoil_stato_fisico,
      conferma_voce: orig.conferma_voce,
      id_cliente: orig.id_cliente,
      ordine_kg_richiesto: orig.ordine_kg_richiesto,
      ordine_kg_lavorato: orig.ordine_kg_lavorato,
      misura: orig.misura,
      attesa_lavorazione: new Date().toISOString()
    }]);
    if (error) console.error("Errore creazione follow-up:", error);
  };

  const handleNextMachineSelect = async (macId: string) => {
    const order = showNextMachinePicker.order;
    if (!order) return;
    setIsSaving(true);
    try {
      await createFollowUp(order, macId, StatoId.ATT);
      setShowNextMachinePicker({ visible: false });
      await fetchLavorazioni();
    } catch (err: any) {
      alert("Errore destinazione: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getOrderColor = (statusId: string) => {
    switch (statusId) {
      case StatoId.PRO: return 'bg-blue-100 border-blue-200';
      case StatoId.ATT: return 'bg-yellow-50 border-yellow-200';
      case StatoId.EXT: return 'bg-slate-100 border-slate-200';
      case StatoId.TER: return 'bg-green-100 border-green-200';
      default: return 'bg-white border-slate-200';
    }
  };

  const isInvalidUrl = !qrUrl || qrUrl.startsWith('blob:') || qrUrl.length < 5;

  if (loading && !lavorazioni.length && !showMachineSelector) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b sticky top-0 z-40 p-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-900 p-2 rounded-xl text-white font-black text-xl shadow-lg shadow-blue-900/20">KME</div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-slate-900 leading-none tracking-tight hidden sm:block">PROD 2026 SPA</h1>
                <button onClick={() => setShowQRModal(true)} className="p-1 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors group relative" title="Connetti Mobile">
                  <Smartphone className="w-4 h-4" />
                </button>
              </div>
              <button onClick={() => setShowMachineSelector(true)} className="flex items-center gap-1 text-[9px] font-black text-blue-600 uppercase mt-1">
                <Settings className="w-2.5 h-2.5" /> {currentMachine?.macchina || 'CAMBIA'}
              </button>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6 px-6 py-1 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner">
             <div className="text-center">
               <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Totale Lavorato</p>
               <div className="flex items-center gap-1.5 justify-center">
                  <Weight className="w-3 h-3 text-blue-500" />
                  <span className="font-black text-blue-600 text-sm leading-none">{stats.lavorati.toLocaleString('it-IT')} <small className="text-[8px] opacity-60 uppercase">Kg</small></span>
               </div>
             </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border">
            <Calendar className="w-4 h-4 ml-1 text-slate-400" />
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent border-none text-[11px] font-black p-1 outline-none" />
          </div>

          <button onClick={() => setShowScanner(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-2xl font-black shadow-lg shadow-blue-100 flex items-center gap-2 text-[10px] uppercase tracking-widest">
            <Plus className="w-4 h-4" /> NUOVA
          </button>
        </div>
      </header>

      {/* Summary Mobile Bar */}
      <div className="md:hidden bg-blue-900 p-4 flex justify-around items-center text-white border-b border-blue-800">
          <div className="text-center w-full">
             <p className="text-[8px] font-black text-blue-300 uppercase tracking-widest mb-1">Totale Lavorato</p>
             <p className="font-black text-lg leading-none text-green-400">{stats.lavorati.toLocaleString('it-IT')} <small className="text-[9px] opacity-60">KG</small></p>
          </div>
      </div>

      <main className="flex-1 p-4 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lavorazioni.map((order) => (
            <div 
              key={order.id_lavorazione}
              onDoubleClick={() => (order.id_stato === StatoId.ATT || order.id_stato === StatoId.EXT) && setShowPhasePicker({ visible: true, orderId: order.id_lavorazione, isNew: false })}
              className={`relative overflow-hidden border-2 rounded-[2rem] p-5 shadow-sm transition-all hover:shadow-lg cursor-pointer flex flex-col ${getOrderColor(order.id_stato)}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Scheda n°</span>
                  <p className="text-xl font-black text-slate-900 leading-none">#{order.scheda}</p>
                </div>
                <StatusBadge statusId={order.id_stato} />
              </div>

              <div className="space-y-2.5 mb-5 flex-1">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-slate-400 uppercase tracking-tighter">Cliente</span>
                  <span className="text-slate-900 truncate max-w-[120px] font-black">{order.cliente_desc || 'GENERICO'}</span>
                </div>
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-slate-400 uppercase tracking-tighter">Materiale</span>
                  <span className="text-slate-900 font-black">{order.mcoil_lega} {order.spessore}x{order.mcoil_larghezza}</span>
                </div>
                {order.fase_desc && (
                  <div className="bg-white/40 p-2.5 rounded-xl border border-black/5 mt-3 shadow-inner">
                    <p className="font-black text-blue-800 text-center uppercase text-[11px] tracking-tight">{order.fase_desc}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-black/5 mt-auto">
                <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400">
                  <Clock className="w-3 h-3" />
                  {order.inizio_lavorazione ? format(new Date(order.inizio_lavorazione), 'HH:mm', { locale: it }) : '--:--'}
                </div>
                <div className="flex gap-2">
                  {order.id_stato === StatoId.PRO ? (
                    <button onClick={(e) => { e.stopPropagation(); setWorkedKg(String(order.ordine_kg_richiesto)); setShowTerminaModal({ visible: true, order }); }} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all">TERMINA</button>
                  ) : (order.id_stato === StatoId.ATT || order.id_stato === StatoId.EXT) && (
                    <button onClick={(e) => { e.stopPropagation(); setShowPhasePicker({ visible: true, orderId: order.id_lavorazione, isNew: false }); }} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all">INIZIA</button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {lavorazioni.length === 0 && !loading && (
            <div className="col-span-full py-24 text-center border-4 border-dashed border-slate-200 rounded-[3rem] bg-white/30">
              <ImageIcon className="w-16 h-16 mx-auto mb-4 text-slate-200" />
              <p className="font-black uppercase text-xs tracking-widest text-slate-300">Nessun ordine trovato per questa postazione</p>
            </div>
          )}
        </div>
      </main>

      {/* MODALS */}
      {showQRModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl relative text-center flex flex-col max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowQRModal(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-600"><X /></button>
            <Smartphone className="w-10 h-10 text-blue-500 mx-auto mb-4" />
            <h2 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tighter">Condivisione Mobile</h2>
            
            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col items-center justify-center mb-6 relative overflow-hidden flex-shrink-0">
              {!isInvalidUrl ? (
                <>
                  <p className="text-[10px] font-black text-green-600 uppercase mb-4 tracking-widest flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3" /> QR CODE PRONTO
                  </p>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrUrl)}`} 
                    alt="QR Code" 
                    className="w-48 h-48 rounded-xl shadow-md border-4 border-white"
                  />
                </>
              ) : (
                <div className="py-12 flex flex-col items-center">
                  <div className="bg-orange-100 p-4 rounded-full mb-4">
                    <AlertTriangle className="w-10 h-10 text-orange-500" />
                  </div>
                  <p className="text-xs font-black text-slate-800 uppercase tracking-tighter">Configurazione Necessaria</p>
                  <p className="text-[9px] text-slate-500 mt-2 px-6">L'indirizzo attuale è protetto. Incolla l'URL del browser sotto.</p>
                </div>
              )}
            </div>

            <div className="text-left space-y-4">
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                <Info className="w-12 h-12 text-amber-600 flex-shrink-0" />
                <div>
                   <p className="text-[10px] font-black text-amber-900 uppercase tracking-tight mb-1">Nota per altri dispositivi:</p>
                   <p className="text-[9px] text-amber-800 font-bold leading-tight">
                     L'indirizzo "aistudio.google.com" è privato. Perché altri (come tuo figlio) possano accedere, l'app deve essere pubblicata (Deploy) su un server pubblico.
                   </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1.5">
                  <LinkIcon className="w-3 h-3" /> Incolla URL Pubblico/Locale:
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={qrUrl}
                    onChange={(e) => setQrUrl(e.target.value)}
                    placeholder="https://..."
                    className={`flex-1 p-4 rounded-xl text-[10px] font-mono border-2 outline-none transition-all shadow-inner ${isInvalidUrl ? 'border-orange-300 bg-orange-50 text-orange-900 placeholder:text-orange-300' : 'border-green-200 bg-white text-green-800'}`}
                  />
                  {qrUrl && (
                    <button onClick={() => setQrUrl('')} className="p-3 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
                      <X className="w-4 h-4 text-slate-400" />
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-slate-100 p-4 rounded-2xl flex items-center justify-between group cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => {
                if (qrUrl) navigator.clipboard.writeText(qrUrl);
              }}>
                <div className="flex items-center gap-2">
                  <Copy className="w-4 h-4 text-slate-400" />
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Copia Link</span>
                </div>
                <div className="text-[10px] text-slate-400 group-active:text-blue-600 group-active:scale-95 transition-all">COPIA</div>
              </div>
            </div>
            
            <p className="mt-6 text-[8px] font-medium text-slate-300 uppercase tracking-[0.2em] mb-4">KME PROD 2026 - Mobile Linker</p>
          </div>
        </div>
      )}

      {showMachineSelector && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-300">
            <h2 className="text-2xl font-black text-slate-900 mb-6 text-center tracking-tighter uppercase">Postazione di Lavoro</h2>
            <div className="grid gap-2 max-h-[50vh] overflow-y-auto pr-1">
              {macchine.map(m => (
                <button key={m.id_macchina} onClick={() => { setCurrentMachine(m); localStorage.setItem('kme_selected_machine', JSON.stringify(m)); setShowMachineSelector(false); }} className="bg-slate-50 hover:bg-blue-600 hover:text-white p-4 rounded-2xl font-black text-xs transition-all border text-slate-700 text-left uppercase flex justify-between items-center group">
                  {m.macchina}
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showScanner && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-center">
          <div className="bg-white rounded-[3rem] p-8 max-w-md w-full shadow-2xl">
            {processingImage ? <SmartScannerLoader /> : (
              <>
                <Scan className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                <h2 className="text-xl font-black mb-2 uppercase tracking-tighter">Nuova Scheda</h2>
                <p className="text-slate-400 mb-8 text-xs font-bold uppercase tracking-widest">Seleziona immagine per analisi IA</p>
                <label className="cursor-pointer block bg-slate-50 border-4 border-dashed rounded-[2rem] p-12 hover:border-blue-400 group transition-all">
                  <Plus className="w-10 h-10 text-slate-300 mx-auto group-hover:text-blue-500 mb-3 group-hover:scale-110 transition-all" />
                  <span className="font-black text-slate-400 text-[10px] uppercase tracking-widest group-hover:text-blue-600">Scegli File Immagine</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
                <button onClick={() => setShowScanner(false)} className="mt-8 text-[9px] font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest">Annulla</button>
              </>
            )}
          </div>
        </div>
      )}

      {scannedData && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl animate-in slide-in-from-bottom-10 duration-500">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-green-100 p-2 rounded-xl border border-green-200 shadow-sm"><Check className="text-green-600 w-6 h-6" /></div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">SCHEDA #{scannedData.scheda}</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {[
                { l: "Coil", v: scannedData.mcoil },
                { l: "Cliente", v: scannedData.cliente_nome },
                { l: "Materiale", v: `${scannedData.mcoil_lega}` },
                { l: "Dimensioni", v: `${scannedData.spessore}x${scannedData.mcoil_larghezza}` },
                { l: "Peso", v: `${scannedData.mcoil_kg} kg` },
                { l: "Kg Ordine", v: scannedData.ordine_kg_richiesto }
              ].map((it, i) => (
                <div key={i} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{it.l}</p>
                  <p className="font-black text-slate-800 truncate text-[13px] tracking-tight">{it.v || 'N/D'}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setScannedData(null)} className="flex-1 py-5 bg-slate-100 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-200 transition-all">Scarta</button>
              <button onClick={() => setShowPhasePicker({ visible: true, isNew: true })} className="flex-[2] py-5 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all">Scegli Fase e Inizia</button>
            </div>
          </div>
        </div>
      )}

      {showPhasePicker.visible && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-black mb-6 text-center uppercase tracking-widest text-slate-400">Tipo di Lavorazione</h2>
            {isSaving ? (
              <div className="py-12 text-center flex flex-col items-center">
                <div className="relative w-16 h-16 mb-4">
                  <Loader2 className="w-16 h-16 text-blue-600 animate-spin absolute" />
                  <div className="absolute inset-0 flex items-center justify-center font-black text-[10px] text-blue-600">DB</div>
                </div>
                <p className="font-black text-[9px] uppercase text-slate-400 tracking-widest animate-pulse">Scrittura record in corso...</p>
              </div>
            ) : (
              <div className="grid gap-2 max-h-[50vh] overflow-y-auto pr-1">
                {fasi.map(f => (
                  <button key={f.id_fase} onClick={() => startProduction(f.id_fase)} className="bg-slate-50 hover:bg-blue-600 hover:text-white p-5 rounded-2xl font-black text-[11px] text-left uppercase flex justify-between items-center group transition-all border border-slate-100 shadow-sm">
                    {f.fase_di_lavorazione}
                    <PlayCircle className="w-5 h-5 opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all" />
                  </button>
                ))}
              </div>
            )}
            {!isSaving && <button onClick={() => setShowPhasePicker({ visible: false })} className="w-full mt-8 text-[9px] font-black uppercase text-slate-400 tracking-widest hover:text-slate-600 transition-all">Chiudi Finestra</button>}
          </div>
        </div>
      )}

      {showTerminaModal.visible && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-10 max-w-md w-full text-center shadow-2xl">
            <h2 className="text-2xl font-black mb-2 uppercase tracking-tighter">Chiusura Lavorazione</h2>
            <p className="text-slate-400 mb-8 font-bold text-[10px] uppercase tracking-widest">Conferma quantità lavorata (KG)</p>
            {isSaving ? (
              <div className="py-12 flex flex-col items-center">
                <Loader2 className="w-12 h-12 text-green-600 animate-spin mb-4" />
                <p className="font-black text-[9px] uppercase text-slate-400 tracking-widest animate-pulse">Aggiornamento Database...</p>
              </div>
            ) : (
              <>
                <div className="mb-10 group">
                  <input 
                    type="number" 
                    value={workedKg} 
                    onChange={(e) => setWorkedKg(e.target.value)} 
                    className="w-full p-8 rounded-[2rem] bg-slate-50 border-4 border-transparent focus:border-green-500 focus:bg-white text-5xl font-black text-slate-900 outline-none transition-all text-center shadow-inner" 
                  />
                  <div className="h-1.5 w-20 bg-slate-200 mx-auto rounded-full mt-4 group-focus-within:bg-green-500 transition-all" />
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setShowTerminaModal({ visible: false })} className="flex-1 py-5 bg-slate-50 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-100 transition-all">Indietro</button>
                  <button onClick={confirmEndProduction} className="flex-[2] py-5 px-8 bg-green-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-green-100 hover:bg-green-700 transition-all active:scale-95">Conferma e Chiudi</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showNextMachinePicker.visible && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-10 max-w-lg w-full shadow-2xl">
            <h2 className="text-2xl font-black mb-4 text-center text-slate-900 uppercase tracking-tighter">Destinazione Scheda</h2>
            <p className="text-slate-400 mb-10 text-center font-bold uppercase text-[10px] tracking-widest">Seleziona la prossima macchina per la scheda #{showNextMachinePicker.order?.scheda}</p>
            {isSaving ? (
              <div className="py-20 flex flex-col items-center">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                <p className="font-black text-[9px] uppercase text-slate-400 tracking-widest">Creazione nuovo record...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto p-1">
                {showNextMachinePicker.nextFase === FaseId.TSB ? (
                  macchine.filter(m => m.id_macchina === 'SBV' || m.id_macchina === 'SBN').map(m => (
                    <button key={m.id_macchina} onClick={() => handleNextMachineSelect(m.id_macchina)} className="bg-blue-50 p-8 rounded-[2rem] font-black text-blue-800 border-2 border-blue-100 hover:bg-blue-600 hover:text-white transition-all text-center uppercase shadow-sm text-xs tracking-tighter">
                      {m.macchina}
                    </button>
                  ))
                ) : (
                  macchine.map(m => (
                    <button key={m.id_macchina} onClick={() => handleNextMachineSelect(m.id_macchina)} className="bg-slate-50 p-5 rounded-2xl font-black text-slate-700 hover:bg-blue-600 hover:text-white transition-all text-[10px] text-center border border-slate-100 uppercase tracking-widest shadow-sm">
                      {m.macchina}
                    </button>
                  ))
                )}
              </div>
            )}
            {!isSaving && <button onClick={() => setShowNextMachinePicker({ visible: false })} className="w-full mt-10 text-[9px] font-black uppercase text-slate-300 hover:text-slate-500 tracking-widest transition-all">Annulla Operazione</button>}
          </div>
        </div>
      )}
    </div>
  );
}
