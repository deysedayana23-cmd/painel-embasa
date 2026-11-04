/**
 * PAINEL EMBASA — backend (Google Apps Script) ligado à planilha "Painel EMBASA".
 * Cole este arquivo INTEIRO no Codigo.gs (apague o que estiver lá antes) e faça uma nova implantação.
 * Ações desta versão: login, listar, gravarVarias, gravar, trocarSenha, pedirNovaSenha,
 * responderSS, marcarEncerrada, concluirServicoUrgente, salvarFoto,
 * responderOcorrencia, finalizarOcorrencia, encerrarOcorrencia, editarOcorrencia, editarNivel, atualizarEpi.
 * EPI: pedidos vão só para a gerência (sem e-mail automático); destino Consórcio ou EMBASA conforme o funcionário.
 * As outras ações do painel (níveis, medição, EPI, acessos, RILC, ocorrências, Agersa) entram depois.
 */

const EMAIL_GERENCIA = "deysedayana23@gmail.com";
const GERENCIA_USUARIOS = ["deyse"];
const EMAIL_TIAGO = ""; // preencher com o e-mail do Thiago para receber os pedidos de senha
const PASTA_FOTOS = "Fotos Painel EMBASA";

// Quem pode retirar ou adicionar em cada almoxarifado (mesma regra do painel)
const PERMISSAO_ALMOX = {
  "ETA Angico": ["Ramon", "Renato"],
  "ETA São Desidério": ["Igor", "Oseias", "Acácio", "Jânio Lima", "Eduardo", "Luzenildo", "Joaquim", "Carlito", "Francisco", "Thiago", "Tiago"],
  "Escritório São Desidério": ["Luzenildo", "Joaquim", "Carlito", "Francisco", "Igor", "Oseias", "Acácio", "Jânio Lima", "Eduardo", "Thiago", "Tiago"],
  "Escritório Catolândia": ["Isaque", "Isaac"],
  "Escritório Baianópolis": ["Ivo Carlos", "Jânio Gualberto"],
  "ETA Mozondó": ["Genildo", "Alan", "Juvenson", "Valdesandro", "Valdesandro Goncalves De Souza"]
};

// ---------- utilidades ----------
function resposta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function normalizarTexto(t) {
  return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
function gerarHash(senha) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, senha + "", Utilities.Charset.UTF_8);
  return Utilities.base64Encode(bytes);
}
function aba(nome) {
  const a = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  if (!a) throw new Error("Falta a aba " + nome + " na planilha");
  return a;
}
function limparValor(v) {
  return v instanceof Date ? v.toISOString() : v;
}
function registrarHistorico(usuario, acao, detalhe) {
  aba("Historico").appendRow([new Date(), usuario, acao, detalhe || ""]);
}
function conferirLogin(usuario, senha) {
  const dados = aba("Usuarios").getDataRange().getValues();
  const hash = gerarHash(senha);
  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][0]).toLowerCase() === String(usuario).toLowerCase() && dados[i][1] === hash) {
      return { usuario: dados[i][0], nome: dados[i][2], perfil: dados[i][3], localidades: dados[i][4] };
    }
  }
  return null;
}
function podeMovimentarAlmox(quem, local) {
  const eu = normalizarTexto(quem.nome) + " " + normalizarTexto(quem.usuario);
  if (GERENCIA_USUARIOS.some(g => eu.includes(g))) return true;
  return (PERMISSAO_ALMOX[local] || []).some(n => normalizarTexto(n) && eu.includes(normalizarTexto(n)));
}
// Próprios da EMBASA recebem EPI pela EMBASA; os demais, pelo consórcio
const EPI_PROPRIOS = ["acacio", "eduardo", "janiogualberto", "janiolima", "ivo"];
function destinoEpi(usuario) {
  return EPI_PROPRIOS.indexOf(normalizarTexto(usuario)) >= 0 ? "EMBASA" : "Consórcio";
}
function obterPastaFotos() {
  const it = DriveApp.getFoldersByName(PASTA_FOTOS);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PASTA_FOTOS);
}

// ---------- entrada do painel ----------
function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);

    // Pedido de nova senha (não exige senha): avisa a gerência por e-mail
    if (req.acao === "pedirNovaSenha") {
      const usuario = String(req.usuario || "").trim();
      registrarHistorico(usuario, "pediu nova senha", "");
      const destinos = [EMAIL_GERENCIA, EMAIL_TIAGO].filter(e => e);
      destinos.forEach(e => MailApp.sendEmail(e, "Painel EMBASA: pedido de nova senha",
        "Pediram uma nova senha para: " + usuario + ". Resete no painel e informe a senha nova ao funcionário pelo app."));
      return resposta({ ok: true, mensagem: "Pedido enviado para a gerência." });
    }

    const quem = conferirLogin(req.usuario, req.senha);
    if (!quem) return resposta({ erro: "Usuário ou senha inválidos" });

    switch (req.acao) {
      case "login":
        return resposta({ ok: true, usuario: quem });

      case "listar": {
        const dados = aba(req.aba).getDataRange().getValues().map(l => l.map(limparValor));
        return resposta({ dados: dados });
      }

      case "gravar":
      case "gravarVarias": {
        const linhas = req.linhas || (req.linha ? [req.linha] : []);
        if (req.aba === "Almoxarifado") {
          const bloqueada = linhas.some(l => !podeMovimentarAlmox(quem, l[2]));
          if (bloqueada) return resposta({ erro: "Você não pode retirar ou adicionar neste almoxarifado. Só a equipe do local (ou a gerência)." });
        }
        if (req.aba === "EPI") {
          linhas.forEach(l => { l[5] = "pendente"; l[9] = destinoEpi(quem.usuario); });
        }
        const destino = aba(req.aba);
        linhas.forEach(l => destino.appendRow(l));
        if (req.aba === "RILC" || req.aba === "Conserto" || req.aba === "PedidoMaterial") {
          const texto = linhas.map(l => l.join(" | ")).join("\n");
          MailApp.sendEmail(EMAIL_GERENCIA, "Painel EMBASA: novo pedido " + req.aba + " de " + quem.usuario,
            "Pedido " + req.aba + " enviado por " + quem.usuario + ":\n" + texto);
        }
        if (req.aba === "Ocorrencia") {
          linhas.forEach(function (l) {
            MailApp.sendEmail(EMAIL_GERENCIA, "Painel EMBASA: pedido de ocorrência operacional – " + l[4] + " – " + l[2],
              "Pedido enviado por " + quem.usuario + "\n\nLocalidade: " + l[2] + "\n" + l[3] + "\nTipo: " + l[4] + "\n\n" + l[5] +
              "\n\nAbra no SCI e devolva o número em Pedidos de ocorrência operacional no painel.");
          });
        }
        registrarHistorico(quem.usuario, "gravou " + linhas.length + " linha(s) em " + req.aba, "");
        return resposta({ ok: true });
      }

      case "trocarSenha": {
        if (!req.novaSenha || req.novaSenha.length < 6) return resposta({ erro: "A nova senha precisa ter pelo menos 6 caracteres" });
        const usuarios = aba("Usuarios");
        const dados = usuarios.getDataRange().getValues();
        for (let i = 1; i < dados.length; i++) {
          if (String(dados[i][0]).toLowerCase() === String(quem.usuario).toLowerCase()) {
            usuarios.getRange(i + 1, 2).setValue(gerarHash(req.novaSenha));
            registrarHistorico(quem.usuario, "trocou a senha", "");
            return resposta({ ok: true });
          }
        }
        return resposta({ erro: "Usuário não encontrado" });
      }

      // PedidoSS: situacao(11) ss_numero(12) respondido_por(13) data_resposta(14) digiteam_para(15) fotos(16)
      case "responderSS": {
        const pedidos = aba("PedidoSS");
        const linha = Number(req.linha);
        if (!linha || linha < 2) return resposta({ erro: "Pedido não encontrado" });
        pedidos.getRange(linha, 11).setValue(req.concluida === "Sim" ? "concluida" : "respondida");
        pedidos.getRange(linha, 12).setValue("'" + String(req.numero || ""));
        pedidos.getRange(linha, 13).setValue(quem.usuario);
        pedidos.getRange(linha, 14).setValue(new Date());
        pedidos.getRange(linha, 15).setValue(req.digiteam || "");
        if (req.foto) {
          const atual = pedidos.getRange(linha, 16).getValue() || "";
          pedidos.getRange(linha, 16).setValue((atual + " " + req.foto).trim());
        }
        // Colunas 17 (concluída em) e 18 (foto anexada no sistema): aparecem em "Meus pedidos" do funcionário
        if (req.concluida === "Sim") pedidos.getRange(linha, 17).setValue(Utilities.formatDate(new Date(), "America/Bahia", "dd/MM/yyyy HH:mm"));
        if (req.fotoAnexada === "Sim") pedidos.getRange(linha, 18).setValue(Utilities.formatDate(new Date(), "America/Bahia", "dd/MM/yyyy HH:mm"));
        registrarHistorico(quem.usuario, "respondeu SS " + req.numero, "linha " + linha);
        return resposta({ ok: true });
      }

      // Agersa: só a gerência cancela uma demanda lançada errado (situacao(6) = "cancelada"; a linha não é apagada)
      case "cancelarAgersa": {
        if (quem.perfil !== "gerente") return resposta({ erro: "Só a gerência pode cancelar demanda Agersa" });
        const ag = aba("Agersa");
        const linha = Number(req.linha);
        if (!linha || linha < 2 || linha > ag.getLastRow()) return resposta({ erro: "Demanda não encontrada" });
        if (String(ag.getRange(linha, 4).getValue()) !== String(req.demanda || "")) return resposta({ erro: "A demanda dessa linha mudou; recarregue a lista" });
        ag.getRange(linha, 6).setValue("cancelada");
        registrarHistorico(quem.usuario, "cancelou demanda Agersa", "linha " + linha);
        return resposta({ ok: true });
      }

      // EncerrarSS: situacao(7) encerrada_por(8) data_encerramento(9)
      case "marcarEncerrada": {
        const lista = aba("EncerrarSS");
        const linha = Number(req.linha);
        if (!linha || linha < 2) return resposta({ erro: "Registro não encontrado" });
        lista.getRange(linha, 7).setValue("encerrada");
        lista.getRange(linha, 8).setValue(quem.usuario);
        lista.getRange(linha, 9).setValue(new Date());
        registrarHistorico(quem.usuario, "marcou SS como encerrada", "linha " + linha);
        return resposta({ ok: true });
      }

      // ServicosUrgentes: situacao(5) feito_por(6) data_feito(7)
      case "concluirServicoUrgente": {
        const urg = aba("ServicosUrgentes");
        const linha = Number(req.linha);
        if (!linha || linha < 2) return resposta({ erro: "Serviço não encontrado" });
        urg.getRange(linha, 5).setValue("feito");
        urg.getRange(linha, 6).setValue(quem.usuario);
        urg.getRange(linha, 7).setValue(new Date());
        registrarHistorico(quem.usuario, "marcou serviço urgente como feito", "linha " + linha);
        return resposta({ ok: true });
      }

      // Ocorrencia: situacao(7) numero(8) aberta_por(9) termino(10) obs_termino(11) encerrada_por(12) data_encerramento(13) alteracoes(14)
      case "responderOcorrencia": {
        const oc = aba("Ocorrencia");
        const linha = Number(req.linha);
        if (!linha || linha < 2) return resposta({ erro: "Ocorrência não encontrada" });
        oc.getRange(linha, 7).setValue("aberta");
        oc.getRange(linha, 8).setValue("'" + String(req.numero || ""));
        oc.getRange(linha, 9).setValue(quem.usuario);
        registrarHistorico(quem.usuario, "abriu ocorrência " + req.numero, "linha " + linha);
        return resposta({ ok: true });
      }
      case "finalizarOcorrencia": {
        const oc = aba("Ocorrencia");
        const linha = Number(req.linha);
        if (!linha || linha < 2) return resposta({ erro: "Ocorrência não encontrada" });
        oc.getRange(linha, 7).setValue("finalizada");
        oc.getRange(linha, 10).setValue("'" + String(req.termino || Utilities.formatDate(new Date(), "America/Bahia", "dd/MM/yyyy HH:mm")));
        oc.getRange(linha, 11).setValue(req.obs || "");
        const d = oc.getRange(linha, 1, 1, 8).getValues()[0];
        MailApp.sendEmail(EMAIL_GERENCIA, "Painel EMBASA: encerrar ocorrência nº " + d[7],
          quem.usuario + " informou o término do serviço.\n\nOcorrência nº " + d[7] + " – " + d[4] + " – " + d[2] +
          "\nTérmino: " + req.termino + "\nObservação: " + req.obs + "\n\nEncerre no SCI e marque como encerrada no painel.");
        registrarHistorico(quem.usuario, "informou término da ocorrência", "linha " + linha);
        return resposta({ ok: true });
      }
      case "encerrarOcorrencia": {
        const oc = aba("Ocorrencia");
        const linha = Number(req.linha);
        if (!linha || linha < 2) return resposta({ erro: "Ocorrência não encontrada" });
        oc.getRange(linha, 7).setValue("encerrada");
        oc.getRange(linha, 12).setValue(quem.usuario);
        oc.getRange(linha, 13).setValue(new Date());
        registrarHistorico(quem.usuario, "encerrou ocorrência no SCI", "linha " + linha);
        return resposta({ ok: true });
      }
      case "editarOcorrencia": {
        if (!req.obs) return resposta({ erro: "A observação é obrigatória" });
        const oc = aba("Ocorrencia");
        const linha = Number(req.linha);
        if (!linha || linha < 2) return resposta({ erro: "Ocorrência não encontrada" });
        const atual = String(oc.getRange(linha, 14).getValue() || "");
        const quando = Utilities.formatDate(new Date(), "America/Bahia", "dd/MM/yyyy HH:mm");
        const nova = quando + " – " + quem.usuario + ": novo término " + req.novoFim + ". " + req.obs;
        oc.getRange(linha, 14).setValue(atual ? atual + "\n" + nova : nova);
        registrarHistorico(quem.usuario, "editou ocorrência", "linha " + linha);
        return resposta({ ok: true });
      }

      // Niveis: data_hora | usuario | reservatorio | hora | nivel_mca — só quem lançou ou a gerência edita
      case "editarNivel": {
        const niv = aba("Niveis");
        const linha = Number(req.linha);
        if (!linha || linha < 2) return resposta({ erro: "Leitura não encontrada" });
        const dono = String(niv.getRange(linha, 2).getValue()).toLowerCase();
        const gerencia = GERENCIA_USUARIOS.indexOf(String(quem.usuario).toLowerCase()) >= 0;
        if (dono !== String(quem.usuario).toLowerCase() && !gerencia) return resposta({ erro: "Só quem lançou pode editar este nível" });
        const antes = niv.getRange(linha, 5).getValue();
        niv.getRange(linha, 5).setValue(Number(req.valor));
        registrarHistorico(quem.usuario, "editou nível", "linha " + linha + ": " + antes + " → " + req.valor);
        return resposta({ ok: true });
      }

      // EPI: situacao(6) enviado_por(7) data_envio(8) data_assinatura(9) destino(10) encerrado_por(11) data_encerramento(12)
      // Um pedido = todas as linhas com o mesmo usuário e data_hora. Etapas: enviado (gerência), assinado (funcionário), encerrado (gerência)
      case "atualizarEpi": {
        const epi = aba("EPI");
        const linha = Number(req.linha);
        const dados = epi.getDataRange().getValues();
        if (!linha || linha < 2 || !dados[linha - 1]) return resposta({ erro: "Pedido não encontrado" });
        const alvo = dados[linha - 1];
        const dono = String(alvo[1]).toLowerCase();
        const gerencia = GERENCIA_USUARIOS.indexOf(String(quem.usuario).toLowerCase()) >= 0;
        const grupo = [];
        for (let i = 1; i < dados.length; i++) {
          if (String(dados[i][1]).toLowerCase() === dono && String(dados[i][0]) === String(alvo[0])) grupo.push(i + 1);
        }
        const agora = new Date();
        if (req.etapa === "enviado") {
          if (!gerencia) return resposta({ erro: "Só a gerência marca o envio do EPI" });
          grupo.forEach(r => { epi.getRange(r, 6).setValue("enviado"); epi.getRange(r, 7).setValue(quem.usuario); epi.getRange(r, 8).setValue(agora); });
        } else if (req.etapa === "assinado") {
          if (String(quem.usuario).toLowerCase() !== dono) return resposta({ erro: "Só quem recebeu confirma a assinatura da ficha" });
          grupo.forEach(r => { epi.getRange(r, 6).setValue("assinado"); epi.getRange(r, 9).setValue(agora); });
        } else if (req.etapa === "encerrado") {
          if (!gerencia) return resposta({ erro: "Só a gerência encerra o chamado" });
          grupo.forEach(r => { epi.getRange(r, 6).setValue("encerrado"); epi.getRange(r, 11).setValue(quem.usuario); epi.getRange(r, 12).setValue(agora); });
        } else {
          return resposta({ erro: "Etapa inválida" });
        }
        registrarHistorico(quem.usuario, "EPI " + req.etapa + " (" + dono + ")", "linhas " + grupo.join(","));
        return resposta({ ok: true });
      }

      case "salvarFoto": {
        const pasta = obterPastaFotos();
        const blob = Utilities.newBlob(Utilities.base64Decode(req.base64), req.tipo || "image/jpeg", req.nome || "foto.jpg");
        const arquivo = pasta.createFile(blob);
        arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        return resposta({ ok: true, url: arquivo.getUrl() });
      }

      default:
        return resposta({ erro: "Ação ainda não disponível no servidor: " + req.acao });
    }
  } catch (err) {
    return resposta({ erro: "Erro no servidor: " + err.message });
  }
}

// ---------- funções para rodar pelo editor (uma vez por pessoa) ----------
// Exemplo: criarUsuario("genildo", "senha-inicial", "Genildo", "operador_mozondo", "Mozondó")
function criarUsuario(usuario, senhaInicial, nome, perfil, localidades) {
  aba("Usuarios").appendRow([usuario, gerarHash(senhaInicial), nome, perfil, localidades]);
}
