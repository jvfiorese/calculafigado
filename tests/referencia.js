// Implementação de referência, escrita a partir das publicações originais e
// das regras da OPTN, sem reaproveitar código do app. Cada função cita a fonte.
'use strict';
const ln = Math.log;
const lim = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// Child-Pugh (Pugh 1973; cortes de CBP/CEP: bilirrubina < 4, 4 a 10, > 10 mg/dL)
// Bilirrubina < 2 / 2–3 / > 3; albumina > 3,5 / 2,8–3,5 / < 2,8; INR < 1,7 / 1,7–2,3 / > 2,3
function childPugh({ bt, alb, inr, ascite, ence, colest }) {
  let pb;
  if (colest) pb = bt < 4 ? 1 : (bt <= 10 ? 2 : 3);
  else pb = bt < 2 ? 1 : (bt <= 3 ? 2 : 3);
  let pa;
  if (alb > 3.5) pa = 1; else if (alb >= 2.8) pa = 2; else pa = 3;
  let pi;
  if (inr < 1.7) pi = 1; else if (inr <= 2.3) pi = 2; else pi = 3;
  const total = pb + pa + pi + ascite + ence;
  const classe = total >= 10 ? 'C' : total >= 7 ? 'B' : 'A';
  return { total, classe };
}

// MELD e MELD-Na, OPTN Policy 9 (2016–2023):
// MELD(i) = 0,957 ln(Cr) + 0,378 ln(BT) + 1,120 ln(INR) + 0,643; arredonda na 1ª casa e × 10.
// Valores < 1 viram 1; Cr máx. 4; diálise ≥ 2× na semana ou CVVHD ≥ 24 h → Cr 4.
// Se MELD(i) > 11: MELD = MELD(i) + 1,32 (137 − Na) − 0,033 MELD(i) (137 − Na); Na entre 125 e 137. Teto 40.
function meldIRef({ bt, inr, cr, dialise }) {
  const C = dialise ? 4 : lim(cr, 1, 4);
  const B = Math.max(bt, 1), I = Math.max(inr, 1);
  const x = 0.957 * ln(C) + 0.378 * ln(B) + 1.120 * ln(I) + 0.643;
  const tenth = Math.round(x * 10) / 10;           // "round to the tenth decimal place"
  return Math.round(tenth * 10);                    // "and multiply by 10"
}
function meld(p) { return Math.min(40, meldIRef(p)); }
function meldNa(p) {
  const mi = meldIRef(p);
  const na = lim(p.na, 125, 137);
  const s = mi > 11 ? mi + 1.32 * (137 - na) - 0.033 * mi * (137 - na) : mi;
  return Math.min(40, Math.round(s));
}

// MELD 3.0 (Kim et al., Gastroenterology 2021; limites da OPTN 2023)
// 1,33 (mulher) + 4,56 ln(BT) + 0,82 (137 − Na) − 0,24 (137 − Na) ln(BT) + 9,09 ln(INR) + 11,14 ln(Cr)
// + 1,85 (3,5 − Alb) − 1,83 (3,5 − Alb) ln(Cr) + 6. BT, INR, Cr ≥ 1; Cr ≤ 3 (diálise → 3);
// Na 125–137; Alb 1,5–3,5. Arredonda ao inteiro, teto 40.
function meld3({ bt, inr, cr, na, alb, mulher, dialise }) {
  const B = Math.max(bt, 1), I = Math.max(inr, 1);
  const C = dialise ? 3 : lim(cr, 1, 3);
  const N = lim(na, 125, 137), A = lim(alb, 1.5, 3.5);
  const s = 1.33 * (mulher ? 1 : 0) + 4.56 * ln(B) + 0.82 * (137 - N) - 0.24 * (137 - N) * ln(B)
    + 9.09 * ln(I) + 11.14 * ln(C) + 1.85 * (3.5 - A) - 1.83 * (3.5 - A) * ln(C) + 6;
  return Math.min(40, Math.round(s));
}

// FIB-4 (Sterling et al., Hepatology 2006): idade × AST / (plaquetas [10⁹/L] × √ALT)
function fib4({ idade, ast, alt, plt }) { return (idade * ast) / (plt * Math.sqrt(alt)); }

// PAGE-B (Papatheodoridis et al., J Hepatol 2016)
// Idade 16–29: 0, 30–39: 2, 40–49: 4, 50–59: 6, 60–69: 8, ≥ 70: 10; homem 6; plaquetas ≥ 200: 0, 100–199: 6, < 100: 9
function pageB({ idade, homem, plt }) {
  const faixas = [[70, 10], [60, 8], [50, 6], [40, 4], [30, 2]];
  let pa = 0;
  for (const [corte, pts] of faixas) if (idade >= corte) { pa = pts; break; }
  const pp = plt < 100 ? 9 : plt < 200 ? 6 : 0;
  return pa + (homem ? 6 : 0) + pp;
}

// Fator R (DILI, consenso CIOMS / Danan 1993): (ALT/LSN) / (FA/LSN)
function fatorR({ alt, fa, altUln, faUln }) { return (alt / altUln) / (fa / faUln); }

// Escore revisado do IAIHG (Alvarez et al., J Hepatol 1999)
function haiRevisado(h) {
  let s = h.mulher ? 2 : 0;
  const r = h.faAltRatio;                            // (FA/LSN)/(ALT/LSN)
  s += r < 1.5 ? 2 : r > 3 ? -2 : 0;
  s += h.glob;                                       // >2: 3, 1,5–2: 2, 1–1,5: 1, <1: 0
  s += h.auto;                                       // >1/80: 3, 1/80: 2, 1/40: 1, <1/40: 0
  s += h.amaPos ? -4 : 0;
  s += h.viralPos ? -3 : 3;
  s += h.drogaPos ? -4 : 1;
  s += h.alcool;                                     // <25: 2, >60: −2
  if (h.outraAutoimune) s += 2;
  // opcionais: outros autoanticorpos só em quem é negativo para FAN, AML e LKM1
  if (h.outrosAc && h.auto === 0) s += 2;
  if (h.hla) s += 1;
  const tipicos = (h.interface ? 3 : 0) + (h.linfoplasm ? 1 : 0) + (h.rosetas ? 1 : 0);
  s += tipicos === 0 ? -5 : tipicos;                 // "ausência de todos: interface, infiltrado, rosetas" −5
  if (h.biliares) s -= 3;
  if (h.outrasAlt) s -= 3;
  s += h.resposta;                                   // completa 2, recidiva 3
  return s;
}

// Maddrey (Maddrey 1978; Carithers 1989): 4,6 × (TP − controle) + BT
function maddrey({ tp, ctl, bt }) { return 4.6 * (tp - ctl) + bt; }

// Lille (Louvet et al., Hepatology 2007)
// R = 3,19 − 0,101 idade + 0,147 Alb d0 (g/L) + 0,0165 (BT d0 − BT d7) (µmol/L)
//     − 0,206 IR (Cr > 1,3 mg/dL) − 0,0065 BT d0 (µmol/L) − 0,0096 TP (s); Lille = e^−R / (1 + e^−R)
function lille({ idade, alb0, bt0, bt7, cr0, tp }) {
  const umol = 17.1;
  const R = 3.19 - 0.101 * idade + 0.147 * (alb0 * 10) + 0.0165 * (bt0 * umol - bt7 * umol)
    - 0.206 * (cr0 > 1.3 ? 1 : 0) - 0.0065 * (bt0 * umol) - 0.0096 * tp;
  return 1 / (1 + Math.exp(R));
}

// Glasgow-Blatchford (Blatchford et al., Lancet 2000). Ureia em mmol/L = mg/dL ÷ 6,006 (massa molar 60,06)
function glasgowBlatchford({ urMgdl, hb, homem, pas, fc, melena, sincope, hepat, icc }) {
  const u = urMgdl / 6.006;
  let s = 0;
  if (u >= 25) s += 6; else if (u >= 10) s += 4; else if (u >= 8) s += 3; else if (u >= 6.5) s += 2;
  if (homem) { if (hb < 10) s += 6; else if (hb < 12) s += 3; else if (hb < 13) s += 1; }
  else { if (hb < 10) s += 6; else if (hb < 12) s += 1; }
  if (pas < 90) s += 3; else if (pas < 100) s += 2; else if (pas < 110) s += 1;
  if (fc >= 100) s += 1;
  if (melena) s += 1;
  if (sincope) s += 2;
  if (hepat) s += 2;
  if (icc) s += 2;
  return s;
}

// Rockall (Rockall et al., Gut 1996). diag null = pré-endoscópico
function rockall({ idade, pas, fc, comorb, diag, srh }) {
  let s = idade >= 80 ? 2 : idade >= 60 ? 1 : 0;
  if (pas < 100) s += 2; else if (fc >= 100) s += 1;
  s += comorb;
  if (diag == null) return s;
  return s + diag + srh;
}

// AIMS65 (Saltzman et al., Gastrointest Endosc 2011)
function aims65({ alb, inr, mental, pas, idade }) {
  return [alb < 3.0, inr > 1.5, !!mental, pas <= 90, idade >= 65].filter(Boolean).length;
}

module.exports = { childPugh, meld, meldNa, meld3, fib4, pageB, fatorR, haiRevisado, maddrey, lille, glasgowBlatchford, rockall, aims65 };
