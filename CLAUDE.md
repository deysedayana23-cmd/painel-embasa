# Painel EMBASA – instruções para o Claude

Leia este arquivo inteiro antes de qualquer alteração. Ele vale para qualquer conta/sessão do Claude.

## Regra número 1: sincronizar antes e publicar logo depois
Este painel é alterado a partir de MAIS DE UMA conta do Claude. Por isso:
1. **Antes de qualquer alteração**: `git pull origin main` e confira a versão que está no ar
   (`VERSAO_PAINEL` no index.html do repositório ≟ "Versão X" que o site mostra). Nunca edite
   em cima de uma cópia antiga da sessão.
2. **Logo depois de cada alteração aprovada**: commit + `git push origin HEAD:main`. Não deixe
   mudança pronta sem publicar — a outra conta não vê o que não foi enviado.
3. Se o push for rejeitado (non-fast-forward), faça `git pull --rebase` e resolva; nunca use force push.

## O que é
- App dos funcionários de campo/escritório da EMBASA São Desidério (gerente: Deyse).
- Front-end: um único `index.html` (HTML+JS puro), publicado no GitHub Pages
  (https://deysedayana23-cmd.github.io/painel-embasa/). Publicar = push na branch main.
- Back-end: Google Apps Script (`Codigo.gs` é cópia de referência; o script roda na conta da Deyse)
  sobre a planilha Google "Painel EMBASA". Ações da API: `listar`, `gravarVarias`, `salvarFoto`, etc.
  Evite mudar o back-end; prefira "linhas de controle" nas abas existentes (padrão já usado:
  usuário `__controle__`, texto `acao:linha[:dados]`).

## Versão (obrigatório em TODA publicação)
- Trocar `VERSAO_PAINEL = "dd/mm HHhMM"` e o rodapé `>Versão dd/mm HHhMM<` (os dois juntos; hora de
  America/Bahia; o texto precisa ser DIFERENTE do anterior, a checagem compara com `!==`).
- Cuidado ao trocar: use regex exato (`const VERSAO_PAINEL = "\d\d/\d\d \d\dh\d\d";`). Uma troca
  malfeita já quebrou a função `checarVersaoSilenciosa` e o painel parou de abrir.
- Depois de editar, checar sintaxe:
  `node -e "const h=require('fs').readFileSync('index.html','utf8');[...h.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].forEach(m=>new Function(m[1]));console.log('ok')"`
- O site demora ~2 min para atualizar (GitHub Pages). O usuário precisa fechar e reabrir o app.

## Como trabalhar
- Testar cada mudança numa cópia local com dados falsos (fakeApi) antes de publicar; nunca testar
  direto na planilha de produção.
- Combinar as mudanças com a Deyse no chat antes; ela costuma pedir uma por vez ("Publique").
- Se uma mudança puder apagar/perder dados já lançados pelos funcionários, avisar antes de aplicar.
- Nunca colocar senhas, CPF ou dados pessoais no repositório (ele é público). As credenciais da
  telemetria ficam só na aba Telemetria da planilha.

## Estrutura (resumo)
- Planilha: abas SSAbertas (SS dos Excels do SCI), ExecucaoCampo (marcações: assumida/executada/
  digitada/…; também linhas de controle, ex.: "excluida (gerente)"), EncerrarSS (pedidos de
  encerramento do campo), PedidoSS, PedidoInativa, ServicosUrgentes, Ocorrencias, Almoxarifado,
  Quimicos, DebitosCorte, Telemetria, ImportSCIStatus (log das importações por unidade).
- Importação: botão "Excel do SCI para atualização da IA" por unidade (São Desidério, Angico,
  Catolândia, Baianópolis + listas especiais). Cada botão só aceita Excel da própria unidade
  (SCI_LOCS_ESPERADAS); Excel de outra unidade dispara aviso forte, pois remove do painel as SS
  da unidade que não vierem no arquivo.
- Times: São Desidério = Luzenildo/Joaquim (comercial) e Carlito/Francisco (operacional);
  Angico = Ramon/Renato; Catolândia + Buriti Cortado + Mozondó = Isaque;
  Baianópolis + São Marcos + Passagem de Pedra = Ivo Carlos/Jânio Gualberto.
  O destino da SS segue a localidade/setor da própria SS (unidadeDaLoc/grupoDono), não o botão do Excel.
- Telas: digitadores (Deyse, Thiago/Tiago, Igor, Oséias) e agentes de campo usam grade 2×2
  (gradeThiago/ehDigitador4/ehAgenteCampo em mostrarMenu). "SS exclusivas para Thiago encerrar" =
  ligações novas executadas. Telemetria só para São Desidério. Pendências de aprovação e exclusões
  de SS/demandas são só da Deyse (MODO_GERENTE + usuário deyse).
- "Zerar listas": constante SSP_ZERADO_EM + sspAntesDoZero/sspDepoisDoZero (último zero:
  2026-11-10T23:21:00Z). Para zerar de novo, atualize a constante — não apague linhas da planilha.
- Corte: em São Desidério só pelo Digiteam; Baianópolis/Catolândia podem encerrar pelo painel com
  leitura. Corte não pode ser encerrado em lote no SCI.
