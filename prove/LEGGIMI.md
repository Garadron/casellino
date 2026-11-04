# Prove con data

Per ogni versione di Casellino qui ci sono:

- `impronte-v<versione>.txt`: l'impronta SHA-256 di ogni file della versione, con il nome dell'autore e la data;
- `impronte-v<versione>.txt.ots`: la prova **OpenTimestamps** che quel file esisteva in quel giorno. È gratuita e
  si basa su Bitcoin: nessuno può cambiarne la data dopo.

Si controlla su <https://opentimestamps.org> trascinando i due file nella pagina. Nelle prime ore la prova è «in
attesa»; poi si completa con `python tools/prova_con_data.py --aggiorna prove/impronte-v<versione>.txt`.
