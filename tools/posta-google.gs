/* © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md. */
// The postman of Casellino: it gets address, subject and text from the account server and sends the e-mail from this
// Gmail account. It is the free way without a domain (as in the family recipe book); Gmail allows 100 e-mails a day.
// Paste it in https://script.google.com (Nuovo progetto) and publish it as a web app:
//   Esegui il deployment -> Nuovo deployment -> tipo "App web" -> Esegui come: Me -> Chi può accedere: Chiunque.
// The address Google gives at the end goes in dati/posta-indirizzo.txt, then on Cloudflare as POSTA_INDIRIZZO.
// SEGRETO must be equal to POSTA_SEGRETO on Cloudflare: without it nobody else can use it to send e-mails.
// The copy with the secret already written is dati/posta-google.gs, which never goes on GitHub.
const SEGRETO = 'INCOLLA_QUI_POSTA_SEGRETO';

function doPost(e) {
  let dati;
  try {
    dati = JSON.parse(e.postData.contents);
  } catch (errore) {
    return risposta({ ok: false });
  }
  if (dati.segreto !== SEGRETO || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(dati.a || '')) return risposta({ ok: false });
  MailApp.sendEmail({
    to: dati.a,
    subject: String(dati.oggetto).slice(0, 150),
    body: String(dati.testo).slice(0, 2000),
    name: 'Casellino',
  });
  return risposta({ ok: true });
}

function risposta(dati) {
  return ContentService.createTextOutput(JSON.stringify(dati)).setMimeType(ContentService.MimeType.JSON);
}
