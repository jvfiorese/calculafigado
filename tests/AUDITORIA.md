# Auditoria das calculadoras (07/10/2026)

## Como foi feita

1. Cada fórmula foi levantada na publicação original ou na regra oficial (tabela abaixo).
2. Uma segunda implementação foi escrita do zero a partir dessas fontes, em `tests/referencia.js`, sem copiar código do app.
3. `tests/rodar.js` compara o app com a referência em 5.000 casos sorteados por escore, com peso extra exatamente nos pontos de corte (e 0,01 acima e abaixo deles). Também confere a faixa de risco mostrada, não só o número.
4. O leitor de exames foi conferido com 18 linhas reais coladas no projeto (valor a valor, incluindo o que não pode ser lido, como "PT" de proteínas, "TAP" em %, "Na urinário" e gasometria) e com 1.500 linhas em formatos sorteados.

A validação anterior (06/10) não pegou os erros abaixo porque a referência dela tinha sido escrita junto com o app e repetia os mesmos enganos. Desta vez a referência foi escrita separada, a partir das fontes.

## O que estava errado e foi corrigido

| Escore | Erro | Efeito |
|---|---|---|
| MELD e MELD-Na | O app arredondava duas vezes (primeiro na casa decimal, depois ao inteiro). A OPTN arredonda uma vez só, e o MELD-Na usa esse MELD inteiro. | MELD 1 ponto acima em cerca de 1 a cada 20 casos (ex.: BT 4,0, INR 1,5, Cr 4,0: certo 29, app dava 30). MELD-Na 1 ponto diferente em cerca de 1 a cada 6 casos. |
| PAGE-B | Plaquetas entre 100 e 199 mil valiam 5 pontos. O certo é 6. | Escore 1 ponto abaixo, o que podia baixar a faixa de risco (ex.: homem de 50 anos, plaquetas 150: certo 18, alto risco; app dava 17, intermediário). |
| Hepatite autoimune | O −5 da histologia só entrava se nada estivesse marcado. Pelo escore original, ele vale sempre que faltam interface, infiltrado linfoplasmocitário e rosetas, mesmo com alterações biliares. "Outros autoanticorpos" (+2) só pode contar em quem é negativo para FAN, AML e anti-LKM1. | Escore alto demais em 5 pontos (biópsia só com alteração biliar) ou em 2 pontos (outros autoanticorpos com FAN positivo). |
| Maddrey e Lille | Se a colagem tinha "TAP (Tempo)", o TP digitado no cartão era ignorado sem aviso. | Agora o valor digitado vale e aparece como "digitado" na tabela de valores lidos. |

Child-Pugh, MELD 3.0, FIB-4, fator R, Maddrey, Lille, Glasgow-Blatchford, Rockall e AIMS65 bateram com a referência em todos os casos. O leitor de exames leu todos os valores certos.

## Fontes

| Escore | Fonte | Detalhes conferidos |
|---|---|---|
| Child-Pugh | Pugh et al., Br J Surg 1973 | BT < 2 / 2–3 / > 3 (CBP/CEP: < 4 / 4–10 / > 10); Alb > 3,5 / 2,8–3,5 / < 2,8; INR < 1,7 / 1,7–2,3 / > 2,3; A 5–6, B 7–9, C 10–15 |
| MELD | OPTN Policy 9 | 0,957 ln Cr + 0,378 ln BT + 1,120 ln INR + 0,643; arredonda na 1ª casa e × 10; valores < 1 viram 1; Cr máx. 4; diálise → 4; teto 40 |
| MELD-Na | OPTN Policy 9 (2016) | Se MELD > 11: MELD + 1,32 (137 − Na) − 0,033 × MELD × (137 − Na); Na 125–137 |
| MELD 3.0 | Kim et al., Gastroenterology 2021; OPTN 2023 | Coeficientes do artigo; BT, INR, Cr ≥ 1; Cr ≤ 3 (diálise → 3); Na 125–137; Alb 1,5–3,5; teto 40 |
| FIB-4 | Sterling et al., Hepatology 2006 | idade × AST / (plaquetas × √ALT); cortes 1,30 (2,0 se ≥ 65 anos) e 2,67 |
| PAGE-B | Papatheodoridis et al., J Hepatol 2016 | Idade 0/2/4/6/8/10; homem 6; plaquetas ≥ 200: 0, 100–199: 6, < 100: 9; ≤ 9 / 10–17 / ≥ 18 |
| Fator R | Danan 1993 (CIOMS/RUCAM) | (ALT/LSN) / (FA/LSN); ≥ 5 hepatocelular, ≤ 2 colestático |
| Hepatite autoimune | Alvarez et al., J Hepatol 1999 | Tabela completa, incluindo −5 por ausência dos três achados típicos e outros autoanticorpos só em soronegativos; > 15 definitiva, 10–15 provável (pós-tratamento > 17 e 12–17) |
| Maddrey | Maddrey 1978; Carithers 1989 | 4,6 × (TP − controle) + BT; ≥ 32 grave |
| Lille | Louvet et al., Hepatology 2007 | 3,19 − 0,101 idade + 0,147 Alb (g/L) + 0,0165 ΔBT (µmol/L) − 0,206 IR (Cr > 1,3) − 0,0065 BT d0 (µmol/L) − 0,0096 TP; ≥ 0,45 não respondedor |
| Glasgow-Blatchford | Blatchford et al., Lancet 2000 | Ureia em mmol/L (mg/dL ÷ 6,006); cortes de Hb por sexo; PAS; FC; melena, síncope, hepatopatia, ICC |
| Rockall | Rockall et al., Gut 1996 | Idade, choque, comorbidade, diagnóstico, estigmas; pré-endoscópico sem os dois últimos |
| AIMS65 | Saltzman et al., Gastrointest Endosc 2011 | Alb < 3,0; INR > 1,5; consciência alterada; PAS ≤ 90; idade ≥ 65 |

## Autoanticorpos e IgG lidos dos exames (08/10/2026)

O leitor agora reconhece FAN (ou ANA), anti-músculo liso (AML), anti-LKM1, anti-mitocôndria (AMA, anti-M2), anti-SLA/LP, anti-LC1, p-ANCA e IgG, e preenche os itens do escore de hepatite autoimune. Cada item tem a opção "Dos exames colados" (padrão) e as opções de antes, que valem por cima.

| Item | Regra (Alvarez et al., J Hepatol 1999, tabela 2, adultos) | Como o app lê |
|---|---|---|
| FAN, AML ou anti-LKM1 | > 1/80 +3; 1/80 +2; 1/40 +1; < 1/40 0. Vale o maior dos três. | "Não reagente", "NR", "negativo", "< 1/40" contam 0. Título fora da tabela (ex.: 1/60), "reagente" sem título, mais de um título, ou FAN com padrão citoplasmático ou mitótico: não pontua e mostra aviso, salvo se outro dos três já dá > 1/80. |
| AMA | Positivo −4 | "Reagente"/"positivo" (qualquer título) ou título ≥ 1/40: −4. Negativo: 0. |
| Outros autoanticorpos definidos | +2, só em quem tem FAN, AML e anti-LKM1 < 1/40 | Anti-SLA/LP, anti-LC1 ou p-ANCA positivo. ANCA sem dizer "p" ou perinuclear não conta. |
| Globulinas, gamaglobulina ou IgG | × LSN: > 2,0 +3; 1,5 a 2,0 +2; 1,0 a 1,5 +1; < 1,0 0 | Só IgG, em mg/dL (g/L × 100; "1.890" = 1890). LSN padrão 1.600 mg/dL, editável no cartão. Exatamente 1,5 e 2,0 caem em +2; 1,0 cai em +1 (a tabela não define a fronteira). IgG de sorologia (anti-HBc IgG, CMV IgG, UI/mL) é ignorada. |

Escolha nossa, não do artigo: FAN "não reagente" conta como < 1/40 (0), que é o uso habitual, embora a triagem em HEp-2 comece em 1/80 e 1/40 não seja testado. O cartão avisa quando usa essa regra.

Testes (`tests/rodar.js`): referência escrita da tabela do artigo (`haiTitulo`, `haiGlobulinas` em `tests/referencia.js`); 3.000 laudos sorteados em vários formatos de escrita (nomes, separadores, títulos 1/20 a 1/2560, títulos fora da tabela, negativos com e sem limite, IgG em mg/dL e g/L, sorologias IgG no meio); 31 laudos escritos à mão, incluindo os casos ambíguos e armadilhas ("Asma", "Ana Maria", "VDRL 1/16", "IgG4"); e o escore inteiro conferido com a referência quando os itens vêm dos exames.

## Limites desta auditoria

- A referência foi escrita pela mesma ferramenta que escreveu o app, só que separada e a partir das fontes. Um erro de leitura da fonte repetido nos dois passaria despercebido. Por isso vale conferir à mão, uma vez, alguns casos de cada escore no MDCalc ou na planilha do serviço.
- Valores padrão que o app assume e que devem ser os do seu laboratório: TP controle 12 s (Maddrey), LSN de TGP 32 e de FA 300 (fator R e hepatite autoimune), os do laboratório do serviço; dá para mudar no cartão.
