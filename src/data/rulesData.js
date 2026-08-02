/**
 * Documento de regras do sistema Rampage — Livro de Regras (Edição Definitiva).
 *
 * Para adicionar conteúdo:
 * - Novas seções: adicione um objeto em rulesSections com id, title e content (array de parágrafos).
 * - Novos destaques: adicione em highlightPatterns um objeto { pattern: "texto ou regex", type: "term" | "rule" | "important" }.
 */

export const highlightPatterns = [
  { pattern: "FIS|DES|MEN|CAR", type: "term" },
  { pattern: "PE|Éter|Vigor|PV", type: "term" },
  { pattern: "Inata|Arte Divina|Magia", type: "term" },
  { pattern: "d20|d4|d6|d8|d10|d12", type: "term" },
  { pattern: "CD|CA|CAE", type: "term" },
  { pattern: "Ação Completa|Ação Bônus|Ações Livres|Reação", type: "rule" },
  { pattern: "Air Break|Close Quarters|Postura Preparada|Interceptação", type: "rule" },
  { pattern: "Esquiva|Aguentar|Dano Agravado", type: "rule" },
  { pattern: "Falha Crítica|Falha Leve|Acerto Crítico", type: "rule" },
  { pattern: "Votos Vinculativos|Inibidor|Subjulgado|Momentâneo|Permanente", type: "rule" },
  { pattern: "Overheat|Overheat Forçado|Overuse|Euforia|Pico", type: "rule" },
  { pattern: "Ferimento Leve|Ferimento Grave|Ferimento Crítico|Crítico Aprimorado", type: "rule" },
  { pattern: "Descanso Curto|Descanso Longo|Salva-Guarda", type: "rule" },
  { pattern: "Inspiração|Certeza|Maestria", type: "rule" },
  { pattern: "Velocidade Relativa|Força Relativa|Efetividade de Atributo", type: "rule" },
  { pattern: "resultado 1|resultado 2|resultado 19|resultado 20", type: "important" },
  { pattern: "múltiplo de 7", type: "important" },
  { pattern: "50% das barras atuais|50% do PV", type: "important" },
  { pattern: "nível 25", type: "important" },
];

export const rulesSections = [
  {
    id: "filosofia",
    title: "Filosofia do Sistema",
    content: [
      "Rampage é um RPG de combate cinematográfico, estratégia tática e escalada de poder. Os números importam, mas vencer exige alterar as condições do combate — posicionamento, Votos Vinculativos, itens, Orbes, habilidades e trabalho em equipe — não apenas acumular bônus.",
      "Quando narrativa e regras conflitam, o Mestre decide, com inclinação padrão a favor da narrativa, desde que não invalide compromissos mecânicos (Votos Vinculativos, resultados de rolagens). O sistema é modular: é possível remover Éter e Artes Divinas sem quebrar o restante.",
      "Dez princípios orientam interpretações não previstas: regras criam espetáculo; criatividade supera repetição; todo poder tem preço; narrativa nasce das mecânicas; o Mestre arbitra sem reescrever; o cenário também luta; toda escolha tem consequências; vitória é construída; consistência acima da conveniência; o limite é a imaginação, não a ficha.",
    ],
  },
  {
    id: "conceitos-gerais",
    title: "Parte I — Conceitos Gerais",
    content: [
      "Testes (fora de ataques): 1d20 + atributo relevante. Não há perícias fixas — qualquer atributo pode ser usado com justificativa narrativa; o Mestre ajusta a CD. CDs não seguem tabela fixa: uma CD 20 é enorme no nível 3 e média no nível 10.",
      "Arredondamentos: sempre para baixo, sem exceções. Distâncias em metros (1 quadrado de mapa = 1 m). Alcances: desarmado 1 m, corpo a corpo 2 m, movimento por Ação Bônus 4 m, por Ação Completa 5 m, máximo 9 m por rodada.",
      "Quatro tipos de dano: Físico, Elemental, Mágico e Violento. Resistências são narrativas, mas os efeitos mecânicos são fixos: Resistente (metade), Vulnerável (1,5×), Frágil (dobro), Imune (zero). Não existe dano verdadeiro.",
      "Ordem de resolução do dano: Ataque → Crítico → Air Break → Modificador → Resistência → Ferimento → Estado. Buffs/debuffs de fontes diferentes acumulam; efeitos idênticos da mesma fonte apenas se atualizam.",
    ],
  },
  {
    id: "criacao",
    title: "Parte II — Criação de Personagem",
    content: [
      "Atributos gerais: FIS (força e resistência), DES (velocidade e precisão), MEN (intelecto e percepção), CAR (presença e liderança). Especiais: Inata, Arte Divina e Mágica — usados apenas em suas categorias. Referência legada: FIS = (FOR+CON)÷2 e MEN = (INT+SAB)÷2, arredondado para cima.",
      "Distribuição: todos começam em -1 (penalidade normal, sem piso em 0). Nível mínimo inicial: 3. Escolha um Atributo Inicial (começa em 1). Pacote de criação: 12 pontos livres. A cada nível: +3 pontos livres e +1 no Atributo Inicial. Sem teto de atributo.",
      "PV = 3d12 + 1d12 por ponto de FIS. Sem limite de cura por turno. Inatas são exclusivas na mesa (uma por jogador), com três habilidades básicas iniciais. Artes Divinas vêm de pactos com um dos nove espíritos. Magias manipulam a alma; na criação, rola-se 1d6 para o campo dominante (Manipulação, Invocação, Conjuração, Transmutação, Abjuração ou Metamagia).",
      "Toda técnica exige: Custo, Tipo, Alcance, Tempo de conjuração, Duração e Manutenção. Qualquer técnica pode receber Votos Vinculativos.",
    ],
  },
  {
    id: "recursos",
    title: "Parte III — Recursos e Descansos",
    content: [
      "Quatro barras: PV (3d12 + 1d12/FIS por nível), PE (+200/nível, Inatas), Éter (+100/nível, Artes Divinas), Vigor (+50/nível, Magias). Éter cresce além do padrão seguindo moral do espírito; Vigor cresce com estudo, introspecção e estados emocionais positivos.",
      "Recuperação automática por turno: PE = 10 × Nível (~5% da barra); Éter = 5 × Nível + recuperação narrativa do Mestre; Vigor só recupera narrativamente (confiança, fúria, vitórias, proteger aliados). Recuperação narrativa sugerida: 5% (momento favorável), 10–20% (grande vantagem), 25–50% (virada), total (evento extraordinário).",
      "Descanso Curto: recupera 50% das barras atuais (não do máximo). Descanso Longo: restaura PV, PE, Éter e Vigor por completo e remove estados negativos (salvo exceções na habilidade/condição). Se totalmente saudável no Descanso Longo, ganha 1 Inspiração (máx. 3).",
      "Inspiração concede vantagem em uma ação (até 3 acumuladas). 3 Inspirações podem virar 1 Certeza (sucesso automático), mas a conversão exige aceite do jogador — nunca é obrigatória.",
    ],
  },
  {
    id: "combate-turno",
    title: "Parte IV — Estrutura do Combate",
    content: [
      "Cada turno: Ação Completa, Ação Bônus, Ações Livres e Reação. Não existe atrasar ou segurar iniciativa. Iniciativa: 1d20 sem modificadores; empate favorece quem rolou primeiro. Críticos na iniciativa: 20 = age duas vezes na 1ª rodada; 1 = perde o primeiro turno.",
      "Não há ataque de oportunidade automático, mas criaturas a 1 m (ou alcance da ficha) podem rolar ataque contra quem passa. Ataques: 1d20 + atributo + bônus. Dano é declarado por arma/habilidade — sem fórmula genérica. Um ataque por Ação Completa, salvo habilidade que permita mais.",
      "Fluxo: Rolagem de Acerto → Defesa (Esquiva, Aguentar, CA passiva ou resistência) → Resistências narrativas → Dano → Redução de PV → Ferimentos.",
    ],
  },
  {
    id: "ca-defesa",
    title: "Parte IV — CA e Defesa",
    content: [
      "CA = (1,5 × Nível) + (FIS ÷ 4) + (DES ÷ 4), arredondado para baixo. Cobertura aumenta CA efetiva narrativamente. Exemplo: nível 10, FIS 20, DES 16 → CA 24.",
      "Esquiva (gasta Reação): 1d20 + DES vs. ataque. Sucesso evita totalmente; falha causa Dano Agravado. Só contra ataques percebidos e direcionados — não contra área instantânea.",
      "Aguentar (não gasta Reação): 1d20 + FIS vs. ataque. Sucesso reduz dano pela metade; falha causa Dano Agravado. Não pode usar Esquiva e Aguentar no mesmo ataque, mas pode alternar entre turnos.",
      "Dano Agravado: +1 dado de dano (+2 dados se a defesa rolar 1 ou 2). Interceptação (Reação): aliado a até 5 m — você vira o alvo; interrompe Close Quarters. Postura Preparada (Ação Completa): declara gatilho e ação; imóvel, sem Ações Completas; -10 na CD quando disparar.",
    ],
  },
  {
    id: "combate-avancado",
    title: "Parte IV — Close Quarters, Conjuntos e Localizados",
    content: [
      "Close Quarters: trocas contínuas de golpes; cada rolagem é ataque e defesa simultâneos. Quem vence defende e contra-ataca; quem perde sofre dano e continua pressionando. Magias quebram temporariamente; Air Break funciona normalmente. Termina com recuo, distância rompida, Interceptação ou incapacitação.",
      "Ataques Conjuntos: CD = CA + 5 por participante extra. Líder rola normalmente; soma metade (arred. para cima) das rolagens dos demais. Todos causam dano individual; críticos acumulam.",
      "Ataques Localizados (CD extra): Torso +0, Perna +5, Braço +7, Cabeça +10, Órgão/pontos pequenos +15. Acertar não garante incapacitação — o dano deve justificar o efeito.",
      "Conversão de estilo: DES→FIS (+5 acerto, +1 dado dano); FIS→DES (-5 acerto, -1 dado dano). A técnica passa a usar o novo atributo em Efetividade e Força/Velocidade Relativa.",
    ],
  },
  {
    id: "criticos-airbreak",
    title: "Parte IV — Críticos, Falhas e Air Break",
    content: [
      "Resultado 1: Falha Crítica — consequência grave. Resultado 2: Falha Leve — consequência narrativa. Resultado 19: dobra dados de dano. Resultado 20: dobra dados de dano + vantagem narrativa significativa. Aplicam-se a qualquer teste, inclusive iniciativa e resistências.",
      "Air Break: quando o valor final de um ataque físico (após modificadores) é múltiplo de 7. Efeito: dano ×2,5 e recuperação de metade das barras atuais (em conjuntos, metade do máximo). Não acumula com crítico 19/20 — prevalece só o crítico. Funciona em Close Quarters e Ataques Localizados.",
    ],
  },
  {
    id: "velocidade-forca",
    title: "Parte V — Velocidade, Força e Efetividade",
    content: [
      "Velocidade Relativa (DES): perspectiva do mais lento. Diferença 5–9: -1/8 CA; 10–14: -1/4 CA; 15–19: metade do dado ao atacar o mais rápido; 20–24: Esquiva ineficiente; 25+: falha automática ao atacar o mais rápido. Não altera iniciativa.",
      "Força Relativa (FIS): 5–9 vantagem em empurrões/agarrões; 10–14 imune a empurrões comuns; 15–19 imune a empurrões e vantagem vs. agarrões; 20+ não pode ser empurrado, arremessado ou agarrado por meios físicos normais.",
      "Efetividade DES vs. FIS alto: diferença FIS−DES reduz dados (até dano mínimo 1/dado em 20+). FIS vs. DES alto: aumenta CA do alvo (+5/+10) ou contra-ataques em defesas 19–20; em 20+ ataques diretos falham — só previsão, armadilhas, área ou Postura Preparada.",
    ],
  },
  {
    id: "ferimentos",
    title: "Parte VI — Ferimentos",
    content: [
      "Um único golpe que cause 25%, 50% ou 75% do PV máximo gera Ferimento Leve, Grave ou Crítico, respectivamente. Leve: doloroso mas não incapacitante. Grave: compromete seriamente o combate. Crítico: potencialmente fatal ou permanentemente incapacitante.",
      "Crítico Aprimorado: Ferimento Crítico causado por Acerto Crítico (Grave + Crítico simultâneos). Escalonamento por crítico: Leve→Grave, Grave→Crítico, Crítico→Crítico Aprimorado.",
      "Ferimentos acumulam livremente; na mesma região, Grave não substitui Leve — coexistem. Toda cura restaura PV; só curas de nível/tipo específico removem Ferimentos.",
    ],
  },
  {
    id: "estados",
    title: "Parte VII — Estados",
    content: [
      "Estados positivos e negativos com duração definida pela fonte. Destaques: Euforia (dois Air Breaks no mesmo combate → vantagem total; termina com dano ≥10% PV máx.); Overheat (barra a 0 → recurso inutilizável até metade ou Descanso Longo); Overheat Forçado (habilidade extrema, sempre anunciado); Overuse (buffs prolongados → Exaustão ao terminar); Pico (momento dramático: dano ×2, Air Break ×5, regeneração, redução de negativos).",
      "Outros comuns: Atordoado, Paralisado, Envenenado (Xd6 fim do turno da vítima), Sangramento (Xd4 fim do turno do agressor), Congelado, Confusão, Anestesiado, Exaustão, Regeneração. Regras de acúmulo variam por estado — consulte a fonte da habilidade.",
    ],
  },
  {
    id: "overheat",
    title: "Parte VIII — Overheat",
    content: [
      "Quando PE, Éter, Vigor ou PV chegam a 0 (para recursos), o recurso fica inutilizável até recuperar pelo menos metade da barra ou realizar Descanso Longo.",
      "Overheat Forçado: habilidades extremas podem causar Overheat sem zerar a barra — sempre descrito na habilidade ou avisado pelo Mestre. Duração típica: 1–2 turnos ou a cena inteira. Pode ser custo de Voto Vinculativo.",
    ],
  },
  {
    id: "votos",
    title: "Parte IX — Votos Vinculativos",
    content: [
      "Compromissos que alteram custos, alvos, duração, poder e restrições de habilidades. Quanto maior o sacrifício, maior o benefício. Sem limite de votos simultâneos; qualquer técnica pode recebê-los.",
      "Momentâneo: afeta uma única ativação. Permanente — Restritivo (Inibidor): habilidade só funciona se a condição for cumprida. Permanente — Punitivo (Subjulgado): funciona sempre, mas punição se a condição for quebrada (gravidade variável).",
    ],
  },
  {
    id: "cenario",
    title: "Parte X — Cenário e Objetos",
    content: [
      "Dano em área instantânea surge no alvo (espinhos, terremoto) — cobertura não protege, não esquiva. Área direcionada tem origem e trajetória (cone de fogo, raio) — cobertura pode bloquear.",
      "Objetos usam CAE (Classe de Armadura Estrutural), não PV. Dano <50% CAE: irrelevante; 50–99%: CAE reduz pelo valor do ataque; ≥ CAE: colapso. Objetos não recuperam CAE naturalmente.",
    ],
  },
  {
    id: "morte",
    title: "Parte XI — Morte e Salva-Guarda",
    content: [
      "A 0 PV: inconsciente. Salva-Guarda no início de cada turno (1d20 sem modificadores): 1–2 +2 Morte; 3–9 +1 Morte; 10–18 +1 Reviver; 19–20 +2 Reviver. Três Pontos de Morte = morte; três Pontos de Reviver = desperta com 1 PV.",
      "Inconsciente: cura desperta imediatamente; Inspiração dá vantagem na próxima Salva-Guarda; dano = +1 Ponto de Morte. Morte de PJ: alma reaparece aleatoriamente; um NPC emocionalmente ligado morre no lugar (escolha do Mestre). Retorno com 1 PV e Cicatriz Permanente. Expurgo (alma destruída) impede retorno.",
    ],
  },
  {
    id: "progressao",
    title: "Parte XII — Progressão e Maestria",
    content: [
      "Sem nível máximo: +3 pontos de atributo e ganhos de recurso por nível indefinidamente. Level up por conquistas narrativas, não XP fixo.",
      "Maestria (a partir do nível 25): após questline específica, domínio absoluto em uma área (Inata, Arte Divina, Magia, atributo etc.) — bônus fixos, redução de custo, liberdade de improviso. Uma Maestria por personagem, escolha definitiva.",
      "Escala de poder: campanhas longas (80–160 sessões); teto definido pelo Mestre, mas o sistema comporta poder comparável a figuras shonen de alto escalão.",
    ],
  },
  {
    id: "oponentes",
    title: "Parte XIII — Tipos de Oponentes",
    content: [
      "Humanos: Magos (Vigor, grupo, versatilidade); Hospedeiros (Éter, alto dano individual, brutais).",
      "Demônios: Bestiais (grupo, caóticos); Entidades (inteligentes, podem parecer humanas — nem todos veem, quase todos sentem).",
    ],
  },
  {
    id: "mestre",
    title: "Parte XIV — O Mestre",
    content: [
      "Arbitragem: liberdade para CDs, custos e consequências, mas nunca reescrever regras no meio do conflito. Estratégia validada pelas regras também vale na narrativa.",
      "Se uma estratégia inteligente “quebra” um encontro, a filosofia oficial é: se as regras permitiram, aconteceu. Desafios melhores vêm na preparação dos próximos encontros, não na negação arbitrária mid-fight.",
      "Identidade: cinematográfico + estratégia + criatividade sobre números — as três ideias juntas definem Rampage.",
    ],
  },
  {
    id: "formulas",
    title: "Apêndice — Fórmulas Essenciais",
    content: [
      "Ataque: 1d20 + atributo + bônus. Teste geral: 1d20 + atributo. Iniciativa: 1d20. CA: (1,5 × Nível) + FIS/4 + DES/4 ↓. PV: 3d12 + 1d12/FIS. Esquiva: 1d20 + DES vs. ataque. Aguentar: 1d20 + FIS vs. ataque. Conjunto: CA + 5/participante extra. Air Break: final múltiplo de 7 → dano ×2,5.",
      "Gatilhos: crítico/falha 1, 2, 19, 20; Ferimentos em 25/50/75% PV máx.; Overheat em barra 0; Maestria nível 25+.",
    ],
  },
  {
    id: "referencia",
    title: "Apêndice — Referência Rápida",
    content: [
      "Movimento: desarmado 1 m, corpo a corpo 2 m, bônus 4 m, completa 5 m, máx. 9 m/rodada. Resistências: Resistente ½, Vulnerável 1,5×, Frágil 2×, Imune 0.",
      "Recuperação por turno: PE 10×Nível, Éter 5×Nível (+ narrativa), Vigor só narrativa. Descanso Curto: 50% atuais. Descanso Longo: total + remove estados (salvo exceções).",
    ],
  },
];
