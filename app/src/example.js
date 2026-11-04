/*
 * © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
 * Example project with invented streets and town, used by the "Esempio" button and by tests.
 * Never put real streets or names here (the repository must not contain work data).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CasellinoExample = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return [
    '# Esempio con vie e comune inventati',
    'ZONA: 9',
    'TITOLARE: Mario Esempio',
    '',
    '== SOTTOZONA 9A ==',
    'COMUNE: Borgo Esempio',
    'MODULI: casello, ala B',
    '-- GIRO --',
    '# Il giro dall\'inizio alla fine: riempie fila 1 del casello, poi fila 1 dell\'ala, poi fila 2...',
    'VIA DEI TIGLI: 1..15, 14..2',
    'VIA DELLE ROSE: 1/3, 5/7, 9, 11 (2), 2..12',
    'PIAZZA DEL POZZO: 1, 2, 3, MUNICIPIO (2)',
    'VICOLO STRETTO: 1-9 dispari',
    'VIA DEI MULINI: 20A..20E, 22/24, 26, 28',
    'CASCINA BELVEDERE (2)',
    'VIA DEI TIGLI: 17..31, 16..30',
    'VIA DEL CANALE: 2/4, 6/8, 10, 1, 3, 5A\\5B, 7, 9..19',
    'FINE STRISCIA',
    '# qui si passa all\'ala, a destra, sempre nella fila 1',
    'VIA DELLE ROSE: 13..21, 14..24',
    'FINE FILA',
    'VIA GARIBALDINI: 1..39',
    'CONTRADA DEL SOLE: 1, 2, 3',
    'VIA GARIBALDINI: 2..40',
    'vuota',
    'LARGO DEL MERCATO: 1/2, 3/4, 5',
    'FINE STRISCIA',
    'CASCINA ALTA',
    'CASCINA BASSA',
    'FINE FILA',
    'VIA DEI PESCATORI: 1-29 dispari, 2-24 pari',
    'FINE FILA',
    'VIA DEL BOSCO: 1..9',
    'CONFINE: 9B',
    'COMUNE: Villa Esempio',
    'VIA DELLA STAZIONE: 1, 2, 3, 4',
    '',
  ].join('\n');
});
