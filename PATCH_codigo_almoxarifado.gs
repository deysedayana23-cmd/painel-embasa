/*
 * PATCH para o Codigo.gs (Apps Script ligado à planilha "Painel EMBASA").
 * Faz o servidor conferir se a pessoa pode retirar ou adicionar no almoxarifado do local.
 *
 * COMO APLICAR (uma vez, pelo editor do Apps Script):
 *  1) Cole o bloco "A" (as funções novas) em qualquer lugar do arquivo, por exemplo no fim.
 *  2) Dentro de doPost, troque o bloco "if (req.acao === \"gravarVarias\") { ... }" pelo bloco "B".
 *  3) Salve e faça uma nova implantação: Implantar > Gerenciar implantações > editar > Nova versão > Implantar.
 */

// ===== A) FUNÇÕES NOVAS =====
const PERMISSAO_ALMOX = {
  "ETA Angico": ["Ramon", "Renato"],
  "ETA São Desidério": ["Igor", "Oseias", "Acácio", "Jânio Lima", "Eduardo", "Luzenildo", "Joaquim", "Carlito", "Francisco", "Thiago", "Tiago"],
  "Escritório São Desidério": ["Luzenildo", "Joaquim", "Carlito", "Francisco", "Igor", "Oseias", "Acácio", "Jânio Lima", "Eduardo", "Thiago", "Tiago"],
  "Escritório Catolândia": ["Isaque", "Isaac"],
  "Escritório Baianópolis": ["Ivo Carlos", "Jânio Gualberto"],
  "ETA Mozondó": ["Genildo", "Alan", "Juvenson", "Valdesandro", "Valdesandro Goncalves De Souza"]
};
const GERENCIA_ALMOX = ["deyse"]; // a gerência pode mexer em qualquer almoxarifado

function normalizarTexto(t) {
  return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// Confere se a pessoa logada é da equipe do local (ou da gerência)
function podeMovimentarAlmoxServidor(quem, local) {
  const eu = normalizarTexto(quem.nome) + " " + normalizarTexto(quem.usuario);
  if (GERENCIA_ALMOX.some(g => eu.includes(g))) return true;
  return (PERMISSAO_ALMOX[local] || []).some(n => normalizarTexto(n) && eu.includes(normalizarTexto(n)));
}

// ===== B) SUBSTITUA O BLOCO gravarVarias DENTRO DE doPost POR ESTE =====
/*
  if (req.acao === "gravarVarias") {
    if (req.aba === "Almoxarifado") {
      const bloqueada = (req.linhas || []).some(l => !podeMovimentarAlmoxServidor(quem, l[2]));
      if (bloqueada) return resposta({ erro: "Você não pode retirar ou adicionar neste almoxarifado. Só a equipe do local (ou a gerência)." });
    }
    const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(req.aba);
    (req.linhas || []).forEach(function (l) { aba.appendRow(l); });
    if (req.aba === "RILC" || req.aba === "Conserto" || req.aba === "PedidoMaterial") {
      const texto = (req.linhas || []).map(function (l) { return l.join(" | "); }).join("\n");
      MailApp.sendEmail("deysedayana23@gmail.com", "Painel EMBASA: novo pedido " + req.aba + " de " + quem.usuario,
        "Pedido " + req.aba + " enviado por " + quem.usuario + ":\n" + texto);
    }
    registrarHistorico(quem.usuario, "gravou " + (req.linhas || []).length + " linhas em " + req.aba, "");
    return resposta({ ok: true });
  }
*/
