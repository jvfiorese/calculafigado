# CalculaFígado

Cole a linha de exames do paciente e calcule os escores de hepatologia e hemorragia digestiva de uma vez.

- Abas: Cirrose (Child-Pugh, MELD, MELD-Na, MELD 3.0), Hepato (FIB-4, PAGE-B, fator R, hepatite autoimune), Alcoólica (Maddrey, Lille) e HDA (Glasgow-Blatchford, Rockall, AIMS65).
- Página única em HTML, sem servidor e sem instalação.
- Os dados ficam no navegador e não são enviados para lugar nenhum.
- Ferramenta de apoio: confira os valores lidos antes de usar o resultado.

## Testes

`node tests/rodar.js` confere cada calculadora contra uma implementação de referência independente (`tests/referencia.js`, escrita a partir das publicações originais) em 5.000 casos sorteados com peso nos pontos de corte, e confere o leitor de exames com linhas reais e 1.500 linhas em formatos sorteados. Roda sozinho no GitHub a cada mudança. As fontes de cada fórmula estão em [tests/AUDITORIA.md](tests/AUDITORIA.md).
