/**
 * Documento de regras do sistema — modificável.
 *
 * Para adicionar conteúdo:
 * - Novas seções: adicione um objeto em rulesSections com id, title e content (array de parágrafos).
 * - Novos destaques: adicione em highlightPatterns um objeto { pattern: "texto ou regex", type: "term" | "rule" | "important" }.
 *   Os tipos aplicam estilos diferentes (term=roxo, rule=verde, important=vermelho). Você pode criar novos tipos em RulesPage.css (.rules-highlight--SEUTIPO).
 */

export const highlightPatterns = [
  // Termos de jogo (destaque suave)
  { pattern: "PE|Ether|Vigor", type: "term" },
  { pattern: "Inata|Espiritual|Magia", type: "term" },
  { pattern: "d20|d4|d6|d8|d10|d12", type: "term" },
  { pattern: "CD|level up|Level up", type: "term" },
  // Regras / mecânicas (destaque médio)
  { pattern: "Ação Completa|Ação Bônus|Livre|Reação", type: "rule" },
  { pattern: "falha crítica|sucesso com dados dobrados|vantagem forte", type: "rule" },
  { pattern: "Inibidores|Subjulgados|Votos Vinculativos", type: "rule" },
  { pattern: "Euforia|Overheat|Overuse|Pico", type: "rule" },
  // Importante (destaque forte)
  { pattern: "1 →|2 →|19 →|20 →", type: "important" },
  { pattern: "mínimo 1h|1-3 perguntas", type: "important" },
];

export const rulesSections = [
  {
    id: "intro",
    title: "1. Introdução",
    content: [
      "Este sistema é um RPG narrativo que mistura ação intensa com escolhas significativas. Aqui, poderes não são apenas ferramentas: eles refletem quem você é, o que você acredita e até o que está disposto a sacrificar.",
      "Inspirado em Hunter x Hunter e Jujutsu Kaisen, cada jogador poderá criar um personagem único, moldado tanto por suas habilidades quanto pelas consequências de seus votos.",
    ],
  },
  {
    id: "criacao",
    title: "2. Criação de Personagem",
    content: [
      "Escolha sua Habilidade Inata (limitada, cada jogador tem uma única).",
      "Defina atributos (baseados nos do D&D 5e) + 3 atributos extras: Inata (ligada às suas habilidades únicas), Espiritual (ligada a espíritos) e Magia (ligada ao Vigor).",
      "Comece com: 1 habilidade Inata e 3 técnicas básicas dela; PE, Ether e Vigor iniciais (barras); histórico e personalidade.",
    ],
  },
  {
    id: "recursos",
    title: "3. Recursos (PE, Ether, Vigor)",
    content: [
      "PE (Pontos de Energia – Inatas): aumentam apenas com level up.",
      "Ether (Espiritual): aumenta com lvl up e aprofundando laço com o espírito.",
      "Vigor (Magia): aumenta pouco a cada lvl e também com estudo, emoções ou estado do personagem.",
    ],
  },
  {
    id: "atributos",
    title: "4. Atributos em Ação",
    content: [
      "O sistema é flexível: para a mesma ação, o jogador pode usar diferentes atributos dependendo da abordagem.",
      "Ex.: Intimidação pode ser Carisma (palavras, ameaça) ou Força (quebrar uma mesa). Em combate (ao atirar uma flecha): Destreza (tiro preciso, padrão) ou Força (atirar com força, menos precisão, mais dano).",
      "O Mestre define a CD de acordo com a escolha.",
      "Os 3 atributos extras entram em testes específicos ligados às suas respectivas origens (Inata, espiritual, Magia).",
    ],
  },
  {
    id: "habilidades",
    title: "5. Habilidades",
    content: [
      "Inatas: lembradas com o tempo e lvl up, escolhidas no início.",
      "Espirituais: obtidas ao fechar pacto com espíritos, exigem seguir sua filosofia.",
      "Magias: estudadas e praticadas. Cada jogador tem proficiência em um tipo (invocação, conjuração, manipulação etc). Magias fora da proficiência exigem \"troca de marcha\" lenta.",
    ],
  },
  {
    id: "progressao",
    title: "6. Progressão",
    content: [
      "Level up não vem de XP, mas de conquistas, aprendizado, vitórias ou descobertas importantes.",
      "Novas habilidades espirituais surgem ao entender melhor o espírito.",
      "Novas magias vêm de estudo e prática.",
      "Inatas surgem em momentos de lembrança ou despertar.",
    ],
  },
  {
    id: "combate",
    title: "7. Combate",
    content: [
      "Ações: Completa (principal), Bônus (extra), Livre (fora do turno, contra-ataques), Reação (preparada, dispara automaticamente).",
      "Rolagens: d20 sempre. 1 → falha crítica (consequência grave). 2 → falha leve (consequência narrativa). 19 → sucesso com dados dobrados. 20 → sucesso com dados dobrados + vantagem forte.",
      "Ataques conjuntos: aumentam muito a CD, mas multiplicam o dano.",
      "Me pergunto se há algum tipo de critico especial...",
    ],
  },
  {
    id: "votos",
    title: "8. Votos Vinculativos",
    content: [
      "Momentâneos: ajustes de custo/efeito em uma ativação específica. Custos pequenos ou nulos.",
      "Permanentes: restrições definitivas, fortes custos e benefícios. Tem 2 tipos: Inibidores (habilidade só funciona sob certas condições) e Subjulgados (funciona sempre, mas quem quebra sofre punição — rolagem d20 define severidade).",
    ],
  },
  {
    id: "estados",
    title: "9. Estados",
    content: [
      "Padrões: atordoado, envenenado, exausto etc (como D&D).",
      "Especiais: Euforia (vantagem total até sofrer dano significativo); Overheat (barra zerada fica inutilizada até metade recuperar); Overuse (após buffs prolongados, ganha Exaustão); Pico (evento narrativo crítico — regeneração acelerada, ignora estados mentais, buffs multiplicados).",
    ],
  },
  {
    id: "estudo",
    title: "10. Estudo",
    content: [
      "Ao estudar, você pode aprender habilidades novas, pedaços de Lore ou me fazer 1-3 perguntas sobre qualquer coisa, responderei de acordo com o assunto estudado e local (quanto mais tempo estudado, mais informação crítica é extraída, mínimo 1h).",
    ],
  },
];
