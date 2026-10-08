// Confere o app (index.html) contra a implementação de referência e contra
// linhas de exames reais. Uso: node tests/rodar.js
'use strict';
const fs = require('fs');
const path = require('path');
const ref = require('./referencia');

// carrega o <script> do index.html sem navegador
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const code = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
const mod = { exports: {} };
new Function('module', code)(mod);
const app = mod.exports;
const S = id => app.SCORES.find(s => s.id === id);

let falhas = 0, total = 0;
const porEscore = {};
function check(nome, ok, detalhe) {
  total++;
  porEscore[nome] = porEscore[nome] || { n: 0, f: 0 };
  porEscore[nome].n++;
  if (!ok) {
    falhas++; porEscore[nome].f++;
    if (porEscore[nome].f <= 5) console.log(`FALHA ${nome}: ${detalhe}`);
  }
}
const num = s => +String(s).replace(',', '.');
// o app mostra d casas; aceita só a diferença do arredondamento de exibição
const perto = (mostrado, x, d) => Math.abs(num(mostrado) - x) <= 0.5 * 10 ** -d + 1e-9;

// sorteio com peso extra nos pontos de corte
let seed = 20261007;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const uni = (lo, hi, d) => +(lo + rnd() * (hi - lo)).toFixed(d);
const pick = a => a[Math.floor(rnd() * a.length)];
function val(lo, hi, d, cortes) {
  if (cortes && rnd() < 0.35) {
    const c = pick(cortes), e = 10 ** -d;
    return +(c + pick([-e, 0, e])).toFixed(d);
  }
  return uni(lo, hi, d);
}

const N = 5000;
for (let i = 0; i < N; i++) {
  const p = {
    bt: val(0.1, 40, 2, [1, 2, 3, 4, 10]), alb: val(1.0, 5.5, 2, [1.5, 2.8, 3, 3.5]), inr: val(0.8, 6, 2, [1, 1.5, 1.7, 2.3]),
    cr: val(0.2, 12, 2, [1, 1.3, 3, 4]), na: val(110, 155, i % 2 ? 1 : 0, [125, 137]),
    plt: val(5, 700, 0, [100, 200]), ast: val(5, 3000, 0), alt: val(3, 3000, 0), fa: val(20, 4000, 0),
    ur: val(5, 400, 0, [39, 48, 60, 150]), hb: val(3, 19, 1, [10, 12, 13]), tp: val(9, 60, 1), ctl: val(10, 14, 1),
  };
  const c = {
    idade: val(16, 95, 0, [30, 40, 50, 60, 65, 70, 80]), sexo: rnd() < 0.5 ? 'F' : 'M',
    ascite: pick(['1', '2', '3']), ence: pick(['1', '2', '3']), colest: rnd() < 0.2, dialise: rnd() < 0.15,
    pas: val(60, 180, 0, [90, 100, 110]), fc: val(40, 160, 0, [100]),
    melena: rnd() < 0.5, sincope: rnd() < 0.3, hepat: rnd() < 0.3, icc: rnd() < 0.2, mental: rnd() < 0.3,
    comorb: pick(['0', '2', '3']), diag: pick(['', '0', '1', '2']), srh: pick(['0', '2']),
    altUln: pick([32, 40, 41, 56]), faUln: pick([300, 120, 104]), tpCtl: p.ctl,
  };
  const mulher = c.sexo === 'F', homem = !mulher;
  const v = { bt: p.bt, alb: p.alb, inr: p.inr, cr: p.cr, na: p.na, plt: p.plt, ast: p.ast, alt: p.alt, fa: p.fa, ur: p.ur, hb: p.hb, tp: p.tp };
  const caso = `#${i} ${JSON.stringify({ ...p, idade: c.idade, sexo: c.sexo, dial: c.dialise })}`;

  // Child-Pugh
  const cp = ref.childPugh({ bt: p.bt, alb: p.alb, inr: p.inr, ascite: +c.ascite, ence: +c.ence, colest: c.colest });
  const cpA = S('child').calc(v, c);
  check('Child-Pugh', cpA.value === `${cp.classe} (${cp.total})`, `${caso} app ${cpA.value} ref ${cp.classe} (${cp.total})`);

  // MELD, MELD-Na, MELD 3.0
  const m = S('meld').calc(v, c).multi;
  const mp = { bt: p.bt, inr: p.inr, cr: p.cr, na: p.na, alb: p.alb, mulher, dialise: c.dialise };
  check('MELD', m[0][1] === ref.meld(mp), `${caso} app ${m[0][1]} ref ${ref.meld(mp)}`);
  check('MELD-Na', m[1][1] === ref.meldNa(mp), `${caso} app ${m[1][1]} ref ${ref.meldNa(mp)}`);
  check('MELD 3.0', m[2][1] === ref.meld3(mp), `${caso} app ${m[2][1]} ref ${ref.meld3(mp)}`);

  // FIB-4 (valor e faixa)
  const f = ref.fib4({ idade: c.idade, ast: p.ast, alt: p.alt, plt: p.plt });
  const fA = S('fib4').calc(v, c);
  const fFaixa = f < (c.idade >= 65 ? 2.0 : 1.3) ? 'Baixo risco' : f > 2.67 ? 'Alto risco' : 'Indeterminado';
  check('FIB-4', perto(fA.value, f, 2) && fA.pill === fFaixa, `${caso} app ${fA.value} ${fA.pill} ref ${f.toFixed(4)} ${fFaixa}`);

  // PAGE-B
  const pb = ref.pageB({ idade: c.idade, homem, plt: p.plt });
  const pbA = S('pageb').calc(v, c);
  const pbFaixa = pb <= 9 ? 'Baixo risco' : pb <= 17 ? 'Risco intermediário' : 'Alto risco';
  check('PAGE-B', pbA.value === pb && pbA.pill === pbFaixa, `${caso} app ${pbA.value} ref ${pb}`);

  // Fator R
  const r = ref.fatorR({ alt: p.alt, fa: p.fa, altUln: c.altUln, faUln: c.faUln });
  const rA = S('rfactor').calc(v, c);
  const rFaixa = r >= 5 ? 'Hepatocelular' : r <= 2 ? 'Colestático' : 'Misto';
  check('Fator R', perto(rA.value, r, 1) && rA.pill === rFaixa, `${caso} app ${rA.value} ${rA.pill} ref ${r} ${rFaixa}`);

  // Maddrey
  const md = ref.maddrey({ tp: p.tp, ctl: p.ctl, bt: p.bt });
  const mdA = S('maddrey').calc(v, c);
  check('Maddrey', perto(mdA.value, md, 1) && (md >= 32) === mdA.pill.startsWith('Grave'), `${caso} app ${mdA.value} ref ${md}`);

  // Lille: dia 0 com bt0/alb0/cr0/tp, dia 7 com bt
  const l0 = { bt: val(1, 35, 2), alb: val(1.5, 4.5, 2), cr: val(0.4, 4, 2, [1.3]), tp: val(10, 40, 1) };
  const blocks = [{ values: { bt: { v: p.bt } } }, { values: { bt: { v: l0.bt }, alb: { v: l0.alb }, cr: { v: l0.cr }, tp: { v: l0.tp } } }];
  const ll = ref.lille({ idade: c.idade, alb0: l0.alb, bt0: l0.bt, bt7: p.bt, cr0: l0.cr, tp: l0.tp });
  const llA = app.lilleCalc(blocks, 0, 1, { idade: c.idade });
  check('Lille', perto(llA.value, ll, 2) && (ll >= 0.45) === (llA.pill === 'Não respondedor'), `${caso} app ${llA.value} ref ${ll}`);

  // Glasgow-Blatchford
  const g = ref.glasgowBlatchford({ urMgdl: p.ur, hb: p.hb, homem, pas: c.pas, fc: c.fc, melena: c.melena, sincope: c.sincope, hepat: c.hepat, icc: c.icc });
  const gA = S('gbs').calc(v, c);
  check('Glasgow-Blatchford', gA.value === g, `${caso} app ${gA.value} ref ${g}`);

  // Rockall
  const ro = ref.rockall({ idade: c.idade, pas: c.pas, fc: c.fc, comorb: +c.comorb, diag: c.diag === '' ? null : +c.diag, srh: +c.srh });
  const roA = S('rockall').calc(v, c);
  check('Rockall', roA.value === ro, `${caso} app ${roA.value} ref ${ro}`);

  // AIMS65
  const ai = ref.aims65({ alb: p.alb, inr: p.inr, mental: c.mental, pas: c.pas, idade: c.idade });
  check('AIMS65', S('aims65').calc(v, c).value === ai, `${caso} app ${S('aims65').calc(v, c).value} ref ${ai}`);

  // Hepatite autoimune (todos os itens preenchidos)
  const h = {
    glob: pick([0, 1, 2, 3]), auto: pick([0, 1, 2, 3]), amaPos: rnd() < 0.3, viralPos: rnd() < 0.3, drogaPos: rnd() < 0.3,
    alcool: pick([2, 0, -2]), outraAutoimune: rnd() < 0.5, outrosAc: rnd() < 0.5, hla: rnd() < 0.5,
    interface: rnd() < 0.5, linfoplasm: rnd() < 0.5, rosetas: rnd() < 0.5, biliares: rnd() < 0.3, outrasAlt: rnd() < 0.3, resposta: pick([0, 2, 3]),
  };
  const ratio = (p.fa / c.faUln) / (p.alt / c.altUln);
  const hr = ref.haiRevisado({ ...h, mulher, faAltRatio: ratio });
  const hc = { ...c, haiFaAlt: 'auto', haiGlob: String(h.glob), haiAuto: String(h.auto), haiAma: h.amaPos ? '-4' : '0', haiViral: h.viralPos ? '-3' : '3',
    haiDrug: h.drogaPos ? '-4' : '1', haiAlc: String(h.alcool), haiAid: h.outraAutoimune, haiOther: h.outrosAc ? '2' : '0', haiHla: h.hla, haiBx: true,
    haiInt: h.interface, haiLpl: h.linfoplasm, haiRos: h.rosetas, haiBil: h.biliares, haiAlt: h.outrasAlt, haiTx: h.resposta ? String(h.resposta) : '' };
  const hA = S('hai').calc(v, hc);
  const [def, prob] = h.resposta ? [17, 12] : [15, 10];
  const hFaixa = hr > def ? 'definitiva' : hr >= prob ? 'provável' : 'improvável';
  check('Hepatite autoimune', hA.value === hr && hA.pill === `HAI ${hFaixa}`, `${caso} ${JSON.stringify(h)} app ${hA.value} ref ${hr}`);
}

/* ===== Leitor de exames: linhas reais coladas pelo João ===== */
const REAIS = [
  ['- (30/09/2026): HB 11,30***, HT 32,80***, Leuco 5,8, Seg 44,00, Eos 2,40***, Baso 0,70***, Linf 39,50***, Mono 13,40***, PQT 156 | TGO 32, TGP 30, FA 275, GGT 191***, BT 1,16***, BD 0,38***, BI 0,78, INR 1,20 | PT 6,94, ALB 4,20 | Ur 27, Cr 0,94 | Na 138,0, K 4,5 | GLI 97 | CT 149 | Vit D 20,3 | ferro 130, ferritina 247,00, B12 468',
    { hb: 11.3, leuco: 5.8, plt: 156, ast: 32, alt: 30, fa: 275, ggt: 191, bt: 1.16, bd: 0.38, inr: 1.2, alb: 4.2, ur: 27, cr: 0.94, na: 138, k: 4.5 }],
  ['- 31/03/26:  BT 1.74 BD 0.72 BI 1.02  FAL 234 GGT 144 Hb 12.7 Ht 39.3% Leuco 4500 plaq 56.000 PCr 0.26 Na 139  INR 1.23 Alb 3.73 Creat 0.72 Ur 38 K 4.2 ',
    { bt: 1.74, bd: 0.72, fa: 234, ggt: 144, hb: 12.7, leuco: 4.5, plt: 56, pcr: 0.26, na: 139, inr: 1.23, alb: 3.73, cr: 0.72, ur: 38, k: 4.2 }],
  ['13/03/26: Hb 12.8 Ht 36.9% Leuco 3600 plaq 54.000 PCR 0.242 Na 133 TGP 89 TGP 55 Ca 3.53 Creat 0.95 Ur 29 K 5.1  BT 1.52 BD 0.58 BI 0.94Ca 9.7 CPK 132 FAL 322 P 3.9 ',
    { hb: 12.8, leuco: 3.6, plt: 54, pcr: 0.242, na: 133, alt: 89, cr: 0.95, ur: 29, k: 5.1, bt: 1.52, bd: 0.58, fa: 322 }, 1],
  ['- 30/04/25: bt 1,97 // bd 0,69 // bi 1,28 // fe 160 // alfa feto 3,31 // ist 42 // ferritina 112 // mg 1,44 // ca 10,9 // hdl 60 // ldl 36 // ct 118 // tgd 111 // gj 171 // hb1ac 8,7 // rni 1,16 // tap 13,4 // ggt 192 // tgp 38 // tgo 55 // tibic 223 // alb 4,23 // ptn 7,29 // k 4,6 // na 131,7 // cr 0,88 // ur 36 // hb 13,8 // leuco 5,7 // plaq 72',
    { bt: 1.97, bd: 0.69, inr: 1.16, ggt: 192, alt: 38, ast: 55, alb: 4.23, k: 4.6, na: 131.7, cr: 0.88, ur: 36, hb: 13.8, leuco: 5.7, plt: 72 }],
  ['- LAB (16/05/24): Hb 9,5* | Leuco 5500 | Plaq 109mil* | Alb 4,19 | Amilase 109 | BT 0,48 | CPK 104 | FAL 156 | TGP 39* | Cr 0,75 | Ur 55 | K 5,4  ---> EM EMERGENCIA',
    { hb: 9.5, leuco: 5.5, plt: 109, alb: 4.19, bt: 0.48, fa: 156, alt: 39, cr: 0.75, ur: 55, k: 5.4 }],
  ['- Lab (04/12/23): K 5,1 | Alb 4,11 | CT 101 | Na 140 | HbA1c 11,7* | BT 1,1 | INR 1,26 | Cr 0,9',
    { k: 5.1, alb: 4.11, na: 140, bt: 1.1, inr: 1.26, cr: 0.9 }],
  ['- ex lab (19/08/24): k: 5.1vit D: 33.3afp 2.56bbtot 0.73fe: 19, satt 5%, ferritina 8.36, fa: 239 ggt 105 glic 128hb glic 9% hb 9.5 *** ht 305 vcm 72 leuco 4700 segm 59% linf 24% plaq: 94000 cotot 82 hdl 45 ldl 18 vldl 19 trig 94na 137 inr 1.2tgo 40 tgp 32 b12 847protot 7.0 alb 4.4 glob 2.61cr 0.74 ur 45',
    { k: 5.1, bt: 0.73, fa: 239, ggt: 105, hb: 9.5, leuco: 4.7, plt: 94, na: 137, inr: 1.2, ast: 40, alt: 32, alb: 4.4, cr: 0.74, ur: 45 }],
  ['- Lab (31/10/24): Ferro: 76 Ferritina: 29,2 IST: 16% Hb: 11,8 Ht: 35,9 Leuco: 3700 Plaq: 62000',
    { hb: 11.8, leuco: 3.7, plt: 62 }],
  ['(03/10/26): HB 15,2, HT 45,1, Leuco 12,1*** (seg 88%, eos 0,4%, bas 0,2%, linf 5%, mono 6,4%), PQT 76*** | PCR 12,75*** | TGO 124***, TGP 40, FA 210, GGT 69***, BT 2,59***, BD 1,19***, BI 1,40***, INR 1,26*** | Ur 248***, Cr 5,29***, TFG 10,9*** | Na 136, K 4,3, Ca 10,9***, P 4,87, Mg 3,22*** | Gasometria venosa (pH 7,187***, PO2 90,7, PCO2 36,9, cHCO3 14,1, BE -12,70, SO2 92,0, AG 18,0, Lac 7,6***, Glu 212***, Na 133,8***, K 3,95, Cl 101,7, Ca 1,220, Hct 49,0, tHb 15,7)',
    { hb: 15.2, leuco: 12.1, plt: 76, pcr: 12.75, ast: 124, alt: 40, fa: 210, ggt: 69, bt: 2.59, bd: 1.19, inr: 1.26, ur: 248, cr: 5.29, na: 136, k: 4.3 }],
  ['(02/10/26): HB 15,5, HT 46,3, Leuco 12,9*** (Neu 88,4% / 11,4***, Eos 0,5% / 0,06, Bas 0,4% / 0,05***, Linf 4,0% / 0,51***, Mon 6,7% / 0,86***), PQT 63*** | PCR 12,920*** | BT 2,34***, BD 1,20***, BI 1,14*** | Ur 182***, Cr 3,75***, TFG 16,5*** | Na 135,0, K 4,0, Cl 96,1, Ca 10,6***, P 3,98, Mg 2,84*** | Gasometria venosa (02/10/26) - Ph 7,269, po2 51,8, pco2 38,3, chco3 17,2***, be -9,02, so2 88,1, ag 20,4, lac 5,1, glu 212, o2hb 86,3, bili <3,0, na 131,6, k 3,83, cl 97,9, ca 1,164, hct 55,1, thb 15,5, methb 0,5',
    { hb: 15.5, leuco: 12.9, plt: 63, pcr: 12.92, bt: 2.34, bd: 1.2, ur: 182, cr: 3.75, na: 135, k: 4.0 }],
  ['(01/10/26): HB 14,2, HT 43,5, Leuco 12,800*** (87,2% seg, 3,9% linf, 8,4% mono, 0,4% eos, 0,1% baso), PQT 66.000*** | PCR 13,77*** | BT 1,84*** (BD 1,02***, BI 0,82) | ALB 3,84 | Ur 167***, Cr 3,03***, TFG 21,4*** | Na 135, K 4,0, Cl 95,6, Ca 10,2, P 3,74, Mg 2,64***',
    { hb: 14.2, leuco: 12.8, plt: 66, pcr: 13.77, bt: 1.84, bd: 1.02, alb: 3.84, ur: 167, cr: 3.03, na: 135, k: 4.0 }],
  ['- Lab 30/09/2026 11:59: BT 1,72 | BD 0,87 | BI 0,85 | Ca 10,8 | FA 211 | P 3,83 | GGT 62 |  Hb 14,6 | HT 42,7 | Leuco 17,4 | PQ 80 | PCR 13,45 | TAP 47,2 | INR 1,44 | TGO 442 | TGP 65 | PT 6,79 | Alb 3,98 | Glob 2,81 | A/G 1,41 | Cr 2,82 | TFG 23,3 | Ur 142 | Mg 2,71. | GasoV: pH 7,168 | pCO2 64,7 | HCO3 23,7 | BE -5,70 | Lac 8,5 | Gli 149 | Na 138,2 | K 4,10 | Cl 101,4 | Cai 1,340',
    { bt: 1.72, bd: 0.87, fa: 211, ggt: 62, hb: 14.6, leuco: 17.4, plt: 80, pcr: 13.45, inr: 1.44, ast: 442, alt: 65, alb: 3.98, cr: 2.82, ur: 142, na: 138.2, k: 4.1 }],
  ['- Lab (28/09/26); BT= 1,82 ; BD= 0,7 ; BI= 1,12 ; FA= 219 ; GGT= 61 ; hb= 13,9 ; leuco= 9600 ; plaq= 110.000 ; pcr= 9,1 ; Na= 134 ; inr= 1,34 ; tgo= 96 ; tgp= 26 ; proteinas totais= 6,7 ; albumina= 3,81 ; Cr= 1,77 (TFG= 40,9) ; Ur= 122 ; Na urinário amostra isolada= 6,00 ; K= 3,6',
    { bt: 1.82, bd: 0.7, fa: 219, ggt: 61, hb: 13.9, leuco: 9.6, plt: 110, pcr: 9.1, na: 134, inr: 1.34, ast: 96, alt: 26, alb: 3.81, cr: 1.77, ur: 122, k: 3.6 }],
  ['(23/09/2026) Hb 14,6 / Ht (não informado) / Leuco 7.300 / Plaq 153.000 / Na 136 / K 3,7 / Ur 111 / Cr 1,36 / TGO 51 / TGP 17',
    { hb: 14.6, leuco: 7.3, plt: 153, na: 136, k: 3.7, ur: 111, cr: 1.36, ast: 51, alt: 17 }],
  ['(30/09/26): HB 8,10***, HT 23,70***, Leuco 12800*** (71,2% segmentados, 0,3% eosinófilos, 0,9% basófilos, 17,0% linfócitos, 10,6% monócitos), PQT 303000 | PCR 3,880*** | TGO 57***, TGP 8***, FA 2802***, GGT 343***, BT 0,37, BD 0,05, BI 0,32, INR 1,34*** | Ur 61*** | Na 133,0***, K 3,8, Ca 7,6***, Mg 2,07 | Fibrinogênio 169,88***, Amilase 29 | Vanco 45',
    { hb: 8.1, leuco: 12.8, plt: 303, pcr: 3.88, ast: 57, alt: 8, fa: 2802, ggt: 343, bt: 0.37, bd: 0.05, inr: 1.34, ur: 61, na: 133, k: 3.8 }],
  ['(02/10/26): HB 9,90***, HT 31,00***, Leuco 17,5*** (Neutrófilos: 74,20%, Bastões/Maturação: 3,30%, Eosinófilos: 0,40%, Basófilos: 0,60%, Monócitos: 7,60%, Linfócitos: 17,20%), PQT 319 | PCR 2,890*** | TGO 36***, TGP 11***, FA 3005***, GGT 356***, BT 0,49, BD 0,23, BI 0,26, INR 1,65*** | Ur 78***, Cr | Na 134,0***, K 4,0, Ca 7,4***, Mg 2,29 | Amilase 26',
    { hb: 9.9, leuco: 17.5, plt: 319, pcr: 2.89, ast: 36, alt: 11, fa: 3005, ggt: 356, bt: 0.49, bd: 0.23, inr: 1.65, ur: 78, na: 134, k: 4.0 }],
  ['(03/10/2026): VHS 8, CPK 51,00, Ca 7,9, FA 2797, GGT 339, Na 135,0, K 4,1, Mg 2,23, TGO 43, Hb 10,30, Ht 32,90, Leuco 15,6, PQ 274, PCR 3,220, Ur 62, TGP 16, BT 0,55, BD 0,24, BI 0,31, TAP (Tempo) 17,40, TAP 43,30, RNI 1,55',
    { fa: 2797, ggt: 339, na: 135, k: 4.1, ast: 43, hb: 10.3, leuco: 15.6, plt: 274, pcr: 3.22, ur: 62, alt: 16, bt: 0.55, bd: 0.24, tp: 17.4, inr: 1.55 }],
  ['(21/09/26): HB 7,10***, HT 21,30%, Leuco 21,0 (seg 74,70%, eos 0,60%, bas 0,60%, linf 12,20%, mono 11,90%), PQT 412*** | PCR 11,240*** | TGO 29, TGP 2***, FA 3117***, GGT 577***, BT 0,35, BD 0,19, BI 0,16 | Alb 2,50*** | Ur 95***, Cr 9,10***, TFG 5,3*** | Na 131,0***, K 3,2, Ca 6,5***, P 3,06, Mg 1,88 | Vit D 11,9***, PTH 476*** | ferro 12***, ferritina 774,00***, TIBC 103***, IST 12%, Amilase 48, Capacidade livre de combinação do ferro 91\n\nGasometria venosa (21/09/26) - Fio2 0,21, ph 7,195, po2 15,7, pco2 54,3, chco3 20,6, be -7,39, so2 44,5, ag 13,7, lac 6,7, glu 124, o2hb 43,6, bili inf a 3,0, na 129,7, k 2,74, cl 98,1, ca 0,710, hct 34,0, thb 9,0, methb 0,8.',
    { hb: 7.1, leuco: 21, plt: 412, pcr: 11.24, ast: 29, alt: 2, fa: 3117, ggt: 577, bt: 0.35, bd: 0.19, alb: 2.5, ur: 95, cr: 9.1, na: 131, k: 3.2 }],
];
REAIS.forEach(([txt, esperado, avisos], i) => {
  const bl = app.parseLabs(txt);
  const datas = bl.filter(b => b.date).length;
  check('Leitor (linhas reais)', datas === 1, `linha ${i + 1}: ${datas} datas`);
  const lido = Object.fromEntries(Object.entries(bl[0].values).map(([k, x]) => [k, x.v]));
  const chaves = new Set([...Object.keys(lido), ...Object.keys(esperado)]);
  for (const k of chaves) check('Leitor (linhas reais)', lido[k] === esperado[k], `linha ${i + 1}, ${k}: lido ${lido[k]} esperado ${esperado[k]}`);
  check('Leitor (linhas reais)', bl[0].warnings.length === (avisos || 0), `linha ${i + 1}: avisos ${JSON.stringify(bl[0].warnings)}`);
});

/* ===== Leitor: completar com exames de até N dias antes ===== */
{
  const txt = '(10/10/26): BT 2,1 INR 1,5\n(05/10/26): Cr 1,4 Na 130\n(01/10/26): Alb 3,0';
  const bl = app.parseLabs(txt);
  const r7 = app.resolveValues(bl, 0, 7), r3 = app.resolveValues(bl, 0, 3), r0 = app.resolveValues(bl, 0, 0);
  check('Leitor (datas)', bl.length === 3 && bl[0].date.getDate() === 10, 'ordem das datas');
  check('Leitor (datas)', r7.cr && r7.cr.v === 1.4 && r7.cr.carried && !r7.alb, '7 dias: Cr de 05/10 entra, Alb de 01/10 (9 dias) não');
  check('Leitor (datas)', !r3.cr && !r0.cr, '3 dias e 0 dias: nada emprestado');
  check('Leitor (datas)', r7.bt.v === 2.1 && !r7.bt.carried, 'valor da própria data');
}

/* ===== Leitor: formatos sorteados ===== */
const FORMATOS = {
  bt: ['BT', 'bt', 'Bilirrubina total', 'bbtot', 'BTot'], inr: ['INR', 'RNI', 'rni', 'inr'], cr: ['Cr', 'Creat', 'Creatinina', 'cr'],
  na: ['Na', 'Sódio', 'na'], alb: ['Alb', 'ALB', 'Albumina'], plt: ['Plaq', 'PQT', 'plaquetas', 'PQ', 'plt'], ast: ['TGO', 'AST'], alt: ['TGP', 'ALT'],
  fa: ['FA', 'FAL', 'Fosfatase alcalina'], ur: ['Ur', 'Ureia', 'Uréia'], hb: ['Hb', 'HB', 'Hemoglobina'], leuco: ['Leuco', 'Leucócitos'],
};
const casas = { bt: 2, inr: 2, cr: 2, na: 0, alb: 2, ast: 0, alt: 0, fa: 0, ur: 0, hb: 1 };
for (let i = 0; i < 1500; i++) {
  const esperado = {};
  const partes = [];
  for (const k of Object.keys(FORMATOS)) {
    if (rnd() < 0.15) continue;
    const nome = pick(FORMATOS[k]);
    let txt, v;
    if (k === 'plt') {
      v = Math.round(uni(5, 900, 0));
      txt = pick([`${v}`, `${v}.000`, `${v * 1000}`, `${v}mil`, `${v} mil`]);
    } else if (k === 'leuco') {
      v = uni(0.8, 40, 1);
      const cel = Math.round(v * 1000);
      txt = pick([String(v).replace('.', ','), String(v), `${cel}`, `${Math.floor(cel / 1000)}.${String(cel % 1000).padStart(3, '0')}`]);
    } else {
      const lim = { bt: [0.1, 40], inr: [0.8, 8], cr: [0.2, 14], na: [110, 160], alb: [1, 5.5], ast: [5, 5000], alt: [3, 5000], fa: [20, 4000], ur: [5, 400], hb: [3, 20] }[k];
      v = uni(lim[0], lim[1], casas[k]);
      txt = pick([true, false]) ? String(v).replace('.', ',') : String(v);
    }
    esperado[k] = v;
    partes.push(`${nome}${pick([' ', ': ', '= ', ' = ', ':'])}${txt}${pick(['', '***', '*', ''])}`);
  }
  for (let j = partes.length - 1; j > 0; j--) { const t = Math.floor(rnd() * (j + 1)); [partes[j], partes[t]] = [partes[t], partes[j]]; }
  const linha = `(${String(1 + (i % 28)).padStart(2, '0')}/0${1 + (i % 9)}/26): ` + partes.join(pick([' | ', ', ', ' // ', ' ; ', ' / ', ' ']));
  const bl = app.parseLabs(linha);
  const lido = bl[0] ? Object.fromEntries(Object.entries(bl[0].values).map(([k, x]) => [k, x.v])) : {};
  for (const k of Object.keys(FORMATOS)) {
    const ok = esperado[k] == null ? lido[k] == null : Math.abs(lido[k] - esperado[k]) < 1e-9;
    check('Leitor (formatos sorteados)', ok, `${linha} → ${k}: lido ${lido[k]} esperado ${esperado[k]}`);
  }
}

/* ===== Hepatite autoimune: autoanticorpos e IgG lidos dos exames ===== */
// Esperado calculado pela referência (tabela do artigo), nunca pelo app.
function esperadoHai(ab, iggMgdl, uln) {
  // por anticorpo: pontos ou null (fora da tabela / sem título: preencher à mão)
  const tit = r => r.st === 'neg' ? 0 : r.st === 'pos' ? ref.haiTitulo(r.t) : null;
  const pres = ['fan', 'aml', 'lkm'].filter(k => ab[k]);
  const pts = pres.map(k => tit(ab[k]));
  const auto = !pres.length ? null : pts.includes(3) ? 3 : pts.includes(null) ? null : Math.max(...pts);
  const ama = !ab.ama ? null : ab.ama.st === 'neg' ? 0 : -4;
  const outs = ['sla', 'panca'].filter(k => ab[k]);
  const other = outs.some(k => ab[k].st !== 'neg') ? 2 : 0;
  const glob = iggMgdl == null ? null : ref.haiGlobulinas(iggMgdl / uln);
  const ambiguos = Object.keys(ab).filter(k => ['fan', 'aml', 'lkm'].includes(k) && tit(ab[k]) == null);
  return { auto, ama, other, glob, ambiguos };
}
const NOMES = {
  fan: ['FAN', 'Fan', 'FAN (HEp-2)', 'Fator antinúcleo', 'Fator antinúcleo (FAN)', 'ANA', 'fan', 'Anticorpo antinúcleo'],
  aml: ['AML', 'Anti-músculo liso', 'anti musculo liso', 'SMA', 'Anticorpo antimúsculo liso', 'aml'],
  lkm: ['Anti-LKM1', 'anti-LKM-1', 'LKM1', 'Anti LKM 1', 'Anti-LKM'],
  ama: ['AMA', 'Anti-mitocôndria', 'anti mitocondria', 'AMA-M2', 'Anticorpo antimitocôndria', 'ama'],
  sla: ['Anti-SLA/LP', 'anti-SLA'], panca: ['p-ANCA', 'pANCA'],
};
const NEGS = ['não reagente', 'Não Reagente', 'NR', 'negativo', 'Negativo', 'nao reagente', '< 1/40', 'inferior a 1/80', 'não reagente (triagem 1/80)', 'Não detectado'];
const TITS = [20, 40, 80, 100, 160, 320, 640, 1280, 2560, 60];
for (let i = 0; i < 3000; i++) {
  const ab = {}, partes = [];
  for (const k of Object.keys(NOMES)) {
    if (rnd() < 0.3) continue;
    const tipoTit = ['fan', 'aml', 'lkm'].includes(k);
    const u = rnd();
    let r, txt;
    if (u < 0.45) { r = { st: 'neg' }; txt = pick(NEGS); }
    else if (tipoTit && u < 0.9) {
      const t = pick(TITS);
      r = { st: 'pos', t };
      txt = pick([`reagente 1/${t}`, `Reagente, título 1:${t}`, `1/${t}`, `positivo 1/${t}`, `reagente até 1/${t}`]);
      if (k === 'fan' && rnd() < 0.5) txt += pick([', padrão nuclear homogêneo', ' nuclear pontilhado fino', ' - padrão nuclear pontilhado grosso']);
    } else { r = tipoTit ? { st: 'semtit' } : { st: 'pos' }; txt = pick(['reagente', 'positivo', 'Reagente', 'POSITIVO']); }
    ab[k] = r;
    partes.push(`${pick(NOMES[k])}${pick([' ', ': ', ' = ', ':'])}${txt}`);
  }
  let igg = null;
  const uln = pick([1600, 1500, 1700, 1650]);
  if (rnd() < 0.6) {
    igg = rnd() < 0.3 ? pick([uln, uln * 1.5, uln * 2, uln * 1.5 - 1, uln * 2 + 1, uln - 1]) : Math.round(uni(400, 5000, 0));
    const fmtIgg = pick([`IgG ${igg}`, `IgG: ${igg} mg/dL`, `IgG ${(igg / 1000).toFixed(3)}`]);
    if (igg % 10 === 0 && rnd() < 0.3) partes.push(`IgG ${String(igg / 100).replace('.', ',')} g/L`); else partes.push(fmtIgg);
  }
  partes.push(`TGO ${Math.round(uni(10, 900, 0))}`, `TGP ${Math.round(uni(10, 900, 0))}`, 'Anti-HBc IgG não reagente', 'CMV IgG 250 UA/mL');
  for (let j = partes.length - 1; j > 0; j--) { const t = Math.floor(rnd() * (j + 1)); [partes[j], partes[t]] = [partes[t], partes[j]]; }
  const linha = `(${String(1 + (i % 28)).padStart(2, '0')}/0${1 + (i % 9)}/26): ` + partes.join(pick([' | ', ' // ', '\n', '; ', ', ']));
  const bl = app.parseLabs(linha);
  const v = Object.fromEntries(Object.entries(bl[0].values).map(([k, x]) => [k, x.v]));
  const L = app.haiLabs(v, { iggUln: uln });
  const e = esperadoHai(ab, igg, uln);
  const det = `${JSON.stringify(linha)} lido ${JSON.stringify(v)}`;
  check('HAI: FAN/AML/LKM1 dos exames', L.auto.pts === e.auto, `${det} app ${L.auto.pts} ref ${e.auto}`);
  check('HAI: AMA dos exames', L.ama.pts === e.ama, `${det} app ${L.ama.pts} ref ${e.ama}`);
  check('HAI: outros autoanticorpos', L.other.pts === e.other, `${det} app ${L.other.pts} ref ${e.other}`);
  check('HAI: IgG dos exames', L.glob.pts === e.glob && (igg == null || v.igg === igg), `${det} app ${L.glob.pts} ref ${e.glob}`);
  const avisos = bl[0].warnings.join(' ');
  for (const k of ['fan', 'aml', 'lkm']) {
    const nome = { fan: 'FAN', aml: 'Anti-músculo liso', lkm: 'Anti-LKM1' }[k];
    check('HAI: aviso quando ambíguo', e.ambiguos.includes(k) === avisos.includes(nome + (k === 'fan' ? ':' : '')), `${det} avisos ${avisos}`);
  }
  // escore inteiro pela referência, com os itens que vêm dos exames
  if (e.auto != null && e.ama != null && e.glob != null) {
    const sexo = rnd() < 0.5 ? 'F' : 'M';
    const c = { sexo, iggUln: uln, faUln: 300, altUln: 32, haiFaAlt: '0', haiGlob: 'auto', haiAuto: 'auto', haiAma: 'auto', haiOther: 'auto',
      haiViral: '3', haiDrug: '1', haiAlc: '2', haiBx: true, haiInt: true, haiTx: '' };
    const hr = ref.haiRevisado({ mulher: sexo === 'F', faAltRatio: 2, glob: e.glob, auto: e.auto, amaPos: e.ama === -4, viralPos: false, drogaPos: false,
      alcool: 2, outrosAc: e.other === 2, interface: true, resposta: 0 });
    const hA = S('hai').calc(v, c);
    check('HAI: escore com itens dos exames', hA.value === hr && hA.pill.startsWith('HAI '), `${det} app ${hA.value} ${hA.pill} ref ${hr}`);
  }
}

// Laudos escritos à mão, com o resultado esperado lido da tabela do artigo
const LAUDOS = [
  ['(15/09/26): FAN reagente 1/160 padrão nuclear pontilhado fino | AML não reagente | AMA não reagente | Anti-LKM1 não reagente', { auto: 3, ama: 0 }],
  ['FAN: Não reagente; Anti-músculo liso: Reagente 1/80; Anti-mitocôndria: Negativo', { auto: 2, ama: 0 }],
  ['FAN NR, AML NR, AMA reagente 1/320, anti-LKM1 NR', { auto: 0, ama: -4 }],
  ['FAN < 1/40 AML 1/40', { auto: 1 }],
  ['Fator antinúcleo (FAN) HEp-2: reagente até 1/640, nuclear homogêneo', { auto: 3 }],
  ['FAN: Reagente\nTítulo: 1/320\nPadrão: nuclear homogêneo\nTGO 300', { auto: 3, ast: 300 }],
  ['ANA 1:160', { auto: 3 }],
  ['AMA-M2 positivo', { ama: -4 }],
  ['anticorpo anti-mitocondria: nao reagente', { ama: 0 }],
  ['anti-SLA/LP reagente, FAN NR, AML NR, anti-LKM1 NR', { auto: 0, other: 2 }],
  ['FAN reagente 1/640 | p-ANCA positivo', { auto: 3, other: 2 }],
  ['FAN reagente', { auto: null, aviso: true }],
  ['FAN 1/160 citoplasmático reticular', { auto: null, aviso: true }],
  ['FAN: reagente 1/80 e 1/320', { auto: null, aviso: true }],
  ['AML reagente 1/60', { auto: null, aviso: true }],
  ['FAN reagente 1/160 | AML reagente', { auto: 3, aviso: true }],
  ['FAN reagente, VDRL 1/16', { auto: null, aviso: true }],
  ['FAN reagente VDRL 1/16', { auto: null, aviso: true }],
  ['FAN Nuclear: 1/160 Citoplasmático: 1/80', { auto: null, aviso: true }],
  ['FAN: nuclear 1/160; citoplasmático 1/1280', { auto: null, aviso: true }],
  ['FAN 1:80 ou 1:160', { auto: null, aviso: true }],
  ['FAN: reagente, padrão nuclear pontilhado fino, título 1/320; TGO 40', { auto: 3, ast: 40 }],
  ['AMA NR, Anti-HBc IgG não reagente, IgG 2000', { ama: 0, igg: 2000, glob: 1 }],
  ['FAN reagente 1/80 | AML reagente', { auto: null, aviso: true }],
  ['IgG 2400', { glob: 2, igg: 2400 }],
  ['IgG 2.350', { glob: 1, igg: 2350 }],
  ['IgG 23,5 g/L', { glob: 1, igg: 2350 }],
  ['IgG: 1.890 mg/dL', { glob: 1, igg: 1890 }],
  ['Imunoglobulinas: IgG 3300, IgA 300', { glob: 3, igg: 3300 }],
  ['Anti-HBc IgG reagente 12,3 | CMV IgG 250 UA/mL | Toxoplasmose: IgG 300 UI/mL | IgG4 150', { glob: null, igg: undefined }],
  ['Asma: não. Ana Maria, TGO 30', { auto: null, ama: null, ast: 30 }],
];
LAUDOS.forEach(([txt, e], i) => {
  const b = app.parseLabs(txt)[0] || { values: {}, warnings: [] };
  const v = Object.fromEntries(Object.entries(b.values).map(([k, x]) => [k, x.v]));
  const L = app.haiLabs(v, { iggUln: 1600 });
  const ok = ('auto' in e ? L.auto.pts === e.auto : true) && ('ama' in e ? L.ama.pts === e.ama : true) && ('other' in e ? L.other.pts === e.other : true)
    && ('glob' in e ? L.glob.pts === e.glob : true) && ('igg' in e ? v.igg === e.igg : true) && ('ast' in e ? v.ast === e.ast : true)
    && (b.warnings.length > 0) === !!e.aviso;
  check('HAI: laudos escritos', ok, `laudo ${i + 1} ${JSON.stringify(txt)}: lido ${JSON.stringify(v)} auto ${L.auto.pts} ama ${L.ama.pts} outros ${L.other.pts} glob ${L.glob.pts} avisos ${JSON.stringify(b.warnings)}`);
});
// Itens à mão continuam valendo por cima dos exames
{
  const v = Object.fromEntries(Object.entries(app.parseLabs('FAN reagente 1/160 | AMA NR')[0].values).map(([k, x]) => [k, x.v]));
  const c = { sexo: 'M', haiFaAlt: '0', haiGlob: '0', haiAuto: '1', haiAma: '-4', haiOther: '0', haiViral: '3', haiDrug: '1', haiAlc: '2', haiBx: true, haiInt: true, haiTx: '' };
  const hA = S('hai').calc(v, c);
  const hr = ref.haiRevisado({ mulher: false, faAltRatio: 2, glob: 0, auto: 1, amaPos: true, viralPos: false, drogaPos: false, alcool: 2, interface: true, resposta: 0 });
  check('HAI: laudos escritos', hA.value === hr, `escolha à mão ignorada: app ${hA.value} ref ${hr}`);
}

/* ===== Resumo ===== */
console.log('\nEscore / verificação          casos   falhas');
for (const [k, x] of Object.entries(porEscore)) console.log(`${k.padEnd(30)}${String(x.n).padStart(6)}${String(x.f).padStart(9)}`);
console.log(`\n${total} verificações, ${falhas} falhas.`);
process.exit(falhas ? 1 : 0);
