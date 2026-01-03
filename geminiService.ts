
import { GoogleGenAI, Type } from "@google/genai";

// Inizializzazione corretta tramite variabile d'ambiente
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function processProductionSheet(base64Image: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{
      parts: [
        {
          inlineData: {
            mimeType: 'image/png',
            data: base64Image,
          },
        },
        {
          text: `Analizza questa scheda tecnica KME e restituisci un JSON. 
          IMPORTANTE: Tutti i campi devono essere presenti. Se un valore non è leggibile, usa i valori di default indicati.
          
          Campi richiesti:
          - scheda: numero (default 0)
          - mcoil: stringa (codice coil)
          - mcoil_kg: numero (peso coil)
          - spessore: numero (es. 0.3)
          - mcoil_larghezza: numero (es. 300)
          - mcoil_lega: stringa (es. "Rame", "Ottone")
          - mcoil_stato_fisico: stringa (es. "Crudo", "Ricotto". Default: "N/D")
          - conferma_voce: stringa (es. "SI", "NO". Default: "DA CONFERMARE")
          - id_cliente: stringa (cerca un codice cliente breve, es. "C001", "ACME". Se non lo trovi usa "GENERICO")
          - cliente_nome: stringa (nome leggibile del cliente)
          - ordine_kg_richiesto: numero
          - ordine_kg_lavorato: numero (uguale a richiesto se non specificato)
          - misura: numero (es. spessore o larghezza finale)`
        }
      ]
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          scheda: { type: Type.NUMBER },
          mcoil: { type: Type.STRING },
          mcoil_kg: { type: Type.NUMBER },
          spessore: { type: Type.NUMBER },
          mcoil_larghezza: { type: Type.NUMBER },
          mcoil_lega: { type: Type.STRING },
          mcoil_stato_fisico: { type: Type.STRING },
          conferma_voce: { type: Type.STRING },
          id_cliente: { type: Type.STRING },
          cliente_nome: { type: Type.STRING },
          ordine_kg_richiesto: { type: Type.NUMBER },
          ordine_kg_lavorato: { type: Type.NUMBER },
          misura: { type: Type.NUMBER }
        },
        required: ["scheda", "mcoil", "mcoil_kg", "spessore", "mcoil_larghezza", "id_cliente", "mcoil_stato_fisico", "conferma_voce", "misura"]
      }
    }
  });

  try {
    const text = response.text;
    if (!text) throw new Error("L'IA non ha restituito dati.");
    return JSON.parse(text);
  } catch (error) {
    console.error("Errore parsing Gemini:", error);
    throw new Error("Impossibile leggere i dati della scheda. Assicurati che la foto sia nitida.");
  }
}
