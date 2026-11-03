/**
 * PAINEL EMBASA — backend (Google Apps Script) ligado à planilha "Painel EMBASA".
 * Cole este arquivo INTEIRO no Codigo.gs (apague o que estiver lá antes) e faça uma nova implantação.
 * Ações desta versão: login, listar, gravarVarias, gravar, trocarSenha, pedirNovaSenha,
 * responderSS, marcarEncerrada, concluirServicoUrgente, salvarFoto.
 * As outras ações do painel (níveis, medição, EPI, acessos, RILC, ocorrências, Agersa) entram depois.
 */

const EMAIL_GERENCIA = "deysedayana23@gmail.com";
const GERENCIA_USUARIOS = ["deyse"];
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
      MailApp.sendEmail(EMAIL_GERENCIA, "Painel EMBASA: pedido de nova senha",
        "O usuário \"" + usuario + "\" pediu uma nova senha. Defina com a função resetarSenha no Apps Script.");
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
        const destino = aba(req.aba);
        linhas.forEach(l => destino.appendRow(l));
        if (req.aba === "RILC" || req.aba === "Conserto" || req.aba === "PedidoMaterial") {
          const texto = linhas.map(l => l.join(" | ")).join("\n");
          MailApp.sendEmail(EMAIL_GERENCIA, "Painel EMBASA: novo pedido " + req.aba + " de " + quem.usuario,
            "Pedido " + req.aba + " enviado por " + quem.usuario + ":\n" + texto);
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
        registrarHistorico(quem.usuario, "respondeu SS " + req.numero, "linha " + linha);
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
