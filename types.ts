
export interface Macchina {
  id_macchina: string;
  macchina: string;
}

export interface FaseLavorazione {
  id_fase: string;
  fase_di_lavorazione: string;
}

export interface Cliente {
  id_cliente: string;
  cliente: string;
}

export interface StatoLavorazione {
  id_stato: string;
  stato_lavorazione: string;
}

export interface Lavorazione {
  id_lavorazione: string; // timestamp with time zone (primary key)
  id_macchina: string;
  id_fase: string;
  id_stato: string;
  scheda: number;
  mcoil: string;
  mcoil_kg: number;
  spessore: number;
  mcoil_larghezza: number;
  mcoil_lega: string;
  mcoil_stato_fisico: string;
  conferma_voce: string;
  id_cliente: string;
  ordine_kg_lavorato: number | null;
  ordine_kg_richiesto: number | null;
  misura: number;
  inizio_lavorazione: string | null;
  fine_lavorazione: string | null;
  attesa_lavorazione: string | null;
  
  // Joined fields
  macchina?: string;
  fase_desc?: string;
  stato_desc?: string;
  cliente_desc?: string;
}

export enum StatoId {
  ATT = 'ATT', // IN ATTESA
  PRO = 'PRO', // IN PRODUZIONE
  EXT = 'EXT', // IN USCITA
  TER = 'TER'  // TERMINATA
}

export enum FaseId {
  MLT = 'MLT',
  MAM = 'MAM',
  MST = 'MST',
  AVV = 'AVV',
  ROT = 'ROT',
  TDI = 'TDI',
  TSB = 'TSB',
  TST = 'TST'
}
