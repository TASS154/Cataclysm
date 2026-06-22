# Changelog - Melhorias do Sistema de Fichas de RPG

## Versão 2.2.0 - Biblioteca do Mestre, Rodadas e Correções

### 🐛 Correções
- Modificador em rolagens múltiplas: soma dos dados + modificador **uma vez** (não mais em cada dado).
- Vantagem/desvantagem passa a usar o modificador definido nos campos acima do botão.

### ✨ Novidades — Mestre
- **Biblioteca do Mestre** (`/biblioteca`): imagens e sons por URL ou upload.
- **Assistente de sessão**: escolher mídia e sequência de mapas ao criar.
- **Criar sessão rápida** mantida como atalho.
- **Painel Mesa** no mapa: rodadas, turnos, lembretes (privados ou públicos).
- Handouts de imagem e sons sincronizados para todos os jogadores.
- Troca entre cenas da sequência (tokens separados por mapa).

### ✨ Novidades — Geral
- Ícone 📋 na tela de login com badge **!** até abrir as novidades.
- Modal de changelog com histórico de versões.

## Versão 2.1.0 - Notas de Perfil + Import/Export

### ✨ Novas Features

#### Notas de Perfil (independentes da ficha)
- ✅ Subcoleção `users/{username}/notes` no Firestore
- ✅ Rota dedicada `/notas` (lista lateral + editor estilo Apple Notes)
- ✅ Atalho no sidebar e dentro da sessão de mapa
- ✅ Editor com Markdown e preview (suporte a GFM: tabelas, listas de tarefas)
- ✅ Tags por nota + filtro por tag + busca por título/corpo/tags
- ✅ Fixar no topo (pin)
- ✅ Auto-save com debounce e indicador visual

#### Importar / Exportar fichas em JSON
- ✅ Modal único com abas Exportar / Importar
- ✅ Export por grupos: Mecânica, Narrativa, Personalização
- ✅ Sempre inclui campos básicos (nome, nível, imagem, info)
- ✅ Cabeçalho `_meta` (app, versão, exportedAt, grupos)
- ✅ Validação de payload com warnings
- ✅ Detecção de conflitos por ID ou por nome
- ✅ Resolução por nota: substituir / criar nova / pular

#### Comunicação ao usuário
- ✅ Aba renomeada: "Anotações" → "Anotações do Personagem"
- ✅ Tooltip explicativo na aba (suporte a `title` em `Tabs.jsx`)
- ✅ Banner de primeira abertura na aba (descartável, persistido em localStorage)
- ✅ Banner de primeira abertura no painel de Notas de Perfil

### 🛠️ Internas
- Novo serviço `src/services/notesService.js` (CRUD + subscribe).
- Novos utilitários `src/utils/sheetIO.js` (export/import).
- Novos componentes `NotesPanel.jsx` e `ImportExportModal.jsx`.
- Nova página `pages/NotesPage.jsx`.
- Dependências adicionadas: `react-markdown`, `remark-gfm`.

## Versão 2.0.0 - Refatoração Completa

### ✨ Novas Features

#### Sistema de Rolagens
- ✅ Soma automática de resultados de rolagens
- ✅ Exibição destacada do total
- ✅ Persistência de histórico de rolagens no Firebase
- ✅ Cálculo automático incluindo modificadores de atributos

#### Atributos e Habilidades
- ✅ Dropdown individual por habilidade (expandir/recolher)
- ✅ Modal de detalhes com edição completa
- ✅ Sistema de favoritos com estrela (⭐)
- ✅ Favoritas aparecem no topo da lista
- ✅ Persistência de favoritos via localStorage

#### Inventário
- ✅ Campos de moedas (Ouro e Prata) no modal
- ✅ Sistema de tags (predefinidas + personalizadas)
- ✅ Filtro por tags
- ✅ Edição completa de itens (nome, quantidade, descrição, tags)
- ✅ Interface inline de edição

#### Organização
- ✅ Sistema de abas para seções: Atributos, Habilidades, Inventário, Status, Anotações
- ✅ Navegação suave entre abas
- ✅ Persistência de aba ativa via localStorage

#### Modo Claro/Escuro
- ✅ Toggle fixo no topo da tela
- ✅ Aplicação global em todos os componentes
- ✅ Persistência via Firebase (sincronização entre dispositivos)
- ✅ Transições suaves entre temas

#### HP Máximo
- ✅ Campo separado para HP Máximo
- ✅ Edição independente do HP atual
- ✅ Persistência via Firebase
- ✅ Visualização na barra de HP

### 🎨 Melhorias de UI/UX

- ✅ Animações suaves em pop-ups (fade-in, slide)
- ✅ Animações em transições de abas
- ✅ Efeitos visuais melhorados em rolagens críticas
- ✅ Backdrop blur em modais
- ✅ Responsividade total (mobile-first)
- ✅ Layouts compactos em telas menores
- ✅ Tabs simplificadas em mobile

### 🏗️ Refatoração de Código

#### Estrutura Modular
- ✅ Separação de componentes em arquivos individuais
- ✅ Utilitários isolados (`utils/`)
- ✅ Hooks customizados (`hooks/`)
- ✅ Serviços separados (`services/`)
- ✅ Configuração centralizada (`config/`)

#### Componentes Criados
- `AbilityCard.jsx` - Card de habilidade com dropdown e modal
- `CharacterSheet.jsx` - Componente principal da ficha
- `DiceRoller.jsx` - Sistema de rolagem completo
- `Inventory.jsx` - Gerenciamento de inventário
- `Tabs.jsx` - Sistema de abas reutilizável
- `ThemeToggle.jsx` - Toggle de tema

#### Estilização
- ✅ CSS centralizado em módulos reutilizáveis
- ✅ Variáveis CSS para temas
- ✅ Media queries para responsividade
- ✅ Animações otimizadas

### 📚 Documentação

- ✅ Documentação completa em `/docs/`
- ✅ README.md principal atualizado
- ✅ Documentação detalhada de features
- ✅ Guia de configuração do Firebase
- ✅ Arquivo `improvements.md` com sugestões futuras

### 🔧 Configuração

- ✅ Arquivo `vercel.json` para deploy automático
- ✅ Estrutura preparada para CI/CD
- ✅ Configuração de temas via CSS variables

### 📱 Responsividade

- ✅ Layout adaptativo para mobile (< 600px)
- ✅ Menus colapsáveis
- ✅ Tabs simplificadas em telas pequenas
- ✅ Grid responsivo
- ✅ Fontes e espaçamentos ajustados

### 🔥 Firebase Integration

- ✅ Estrutura de dados melhorada
- ✅ Persistência de preferências
- ✅ Histórico de rolagens
- ✅ Sincronização entre dispositivos
- ✅ Otimização de queries

### 🐛 Correções

- ✅ Correção de imports
- ✅ Melhoria na estrutura de dados
- ✅ Validação de campos
- ✅ Tratamento de erros melhorado

## Próximos Passos

Veja `improvements.md` para sugestões de melhorias futuras.

## Notas de Migração

### Para usuários existentes:

1. As fichas existentes serão migradas automaticamente
2. Novos campos (coins, maxHp) serão inicializados com valores padrão
3. Favoritos serão criados conforme uso
4. Histórico de rolagens começará a ser registrado

### Estrutura de dados atualizada:

- `bars.maxHp` - Novo campo para HP máximo
- `coins` - Novo objeto para moedas (gold, silver)
- `inventory[]` - Agora suporta objetos completos com tags
- `abilities[]` - Agora inclui campo `cost`

