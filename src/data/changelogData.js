/** Versão exibida no badge de novidades (login). Incremente a cada release. */
export const APP_CHANGELOG_VERSION = "2.2.2";

export const CHANGELOG_ENTRIES = [
  {
    version: "2.2.2",
    date: "2026-06-22",
    title: "Correção crítica — Sessão rápida",
    sections: [
      {
        heading: "Correções",
        items: [
          "Sessão rápida quebrava o app (erro ao fechar o assistente) — tela ficava só com o fundo.",
          "Assistente de sessão agora desmonta de verdade ao criar ou ao mudar de rota.",
          "Overlays do mapa fecham com Esc ou clique fora; áreas sem células não quebram mais o mapa.",
          "Mapa embutido com altura mínima visível; erros exibem mensagem em vez de tela vazia.",
        ],
      },
    ],
  },
  {
    version: "2.2.1",
    date: "2026-06-22",
    title: "Correções de Sessão e Mapa",
    sections: [
      {
        heading: "Correções — Sessão e mapa",
        items: [
          "Tela em branco ao criar sessão (assistente ou rápida): overlay do assistente fechava tarde demais e cobria a interface.",
          "Overlays do mapa (adicionar token, configurações) agora ficam contidos na área do mapa, sem cobrir a tela inteira.",
          "Ao entrar numa sessão, a aba Mapa abre automaticamente.",
          "Botão voltar do navegador volta ao estado normal (fecha modais e restaura a aba Ficha).",
          "Tokens sem nome não quebram mais a renderização do mapa.",
          "Mensagem de erro clara quando a sessão não carrega ou foi encerrada.",
        ],
      },
      {
        heading: "Novidades — Sessão",
        items: [
          "Botão «Terminar sessão» para o mestre (remove a sessão; «Sair da sessão» apenas sai sem apagar).",
        ],
      },
    ],
  },
  {
    version: "2.2.0",
    date: "2026-06-02",
    title: "Biblioteca do Mestre, Rodadas e Correções",
    sections: [
      {
        heading: "Correções — Rolagem de dados",
        items: [
          "Modificador agora é somado uma única vez ao final (soma dos dados + mod), não em cada dado.",
          "Vantagem e desvantagem usam o modificador definido nos campos acima do botão.",
        ],
      },
      {
        heading: "Novidades — Mestre",
        items: [
          "Biblioteca de imagens e sons (URLs ou upload) atrelada ao perfil.",
          "Assistente ao criar sessão: escolher mídia e sequência de mapas.",
          "Contador de rodadas/turnos e lembretes (privados ou públicos).",
          "Handouts de imagem e sons sincronizados na mesa.",
          "Troca de mapas na sequência (tokens separados por cena).",
        ],
      },
      {
        heading: "Novidades — Geral",
        items: [
          "Ícone de novidades na tela de login com badge (!) até você abrir.",
        ],
      },
    ],
  },
  {
    version: "2.1.0",
    date: "2026-06-01",
    title: "Notas de Perfil + Import/Export",
    sections: [
      {
        heading: "Notas de Perfil",
        items: [
          "Notas pessoais com Markdown, tags, busca e fixar.",
          "Rota /notas, sidebar e botão dentro da sessão.",
        ],
      },
      {
        heading: "Import/Export",
        items: [
          "Exportar ficha em JSON por grupos (Mecânica, Narrativa, Personalização).",
          "Importar com resolução de conflitos.",
        ],
      },
    ],
  },
];

export function getLatestChangelogEntry() {
  return CHANGELOG_ENTRIES[0] || null;
}

export function hasUnreadChangelog() {
  if (typeof window === "undefined") return false;
  try {
    const seen = localStorage.getItem(`cataclysm-changelog-seen-${APP_CHANGELOG_VERSION}`);
    return !seen;
  } catch {
    return false;
  }
}

export function markChangelogSeen() {
  try {
    localStorage.setItem(`cataclysm-changelog-seen-${APP_CHANGELOG_VERSION}`, "1");
  } catch {
    // ignore
  }
}
