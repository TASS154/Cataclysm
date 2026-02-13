# Documentação do Sistema de Fichas de RPG

## Índice

1. [Visão Geral](#visão-geral)
2. [Estrutura do Projeto](#estrutura-do-projeto)
3. [Features Implementadas](#features-implementadas)
4. [Firebase Integration](#firebase-integration)
5. [Componentes Principais](#componentes-principais)
6. [Guia de Uso](#guia-de-uso)

## Visão Geral

Este é um sistema completo de gerenciamento de fichas de RPG desenvolvido em React com Firebase como backend. O sistema permite criar, editar e gerenciar múltiplas fichas de personagens com recursos avançados como rolagem de dados, habilidades, inventário, e muito mais.

## Estrutura do Projeto

```
src/
├── components/          # Componentes React reutilizáveis
│   ├── AbilityCard.jsx      # Card de habilidade com dropdown e modal
│   ├── CharacterSheet.jsx   # Componente principal da ficha
│   ├── DiceRoller.jsx       # Sistema de rolagem de dados
│   ├── Inventory.jsx        # Gerenciamento de inventário
│   ├── Tabs.jsx             # Sistema de abas
│   └── ThemeToggle.jsx      # Toggle de tema claro/escuro
├── config/
│   └── firebase.js          # Configuração do Firebase
├── hooks/
│   └── useTheme.js          # Hook para gerenciar tema
├── services/
│   └── rollHistoryService.js # Serviço de histórico de rolagens
├── styles/
│   └── themes.css           # Variáveis CSS para temas
├── utils/
│   └── dice.js              # Utilitários para rolagem de dados
├── App.jsx                  # Componente principal
└── RPGPlayerEditor.css      # Estilos principais
```

## Features Implementadas

### 1. Sistema de Soma de Rolagens

O sistema identifica automaticamente a última rolagem e calcula o total somando todos os resultados individuais, incluindo modificadores de atributos e bônus manuais.

**Funcionamento:**
- Ao rolar dados, o sistema calcula automaticamente o total
- Exibe o total em destaque próximo aos resultados
- Persiste no Firebase para recuperação em sessões futuras
- Histórico de rolagens disponível por usuário

**Localização:** `src/components/DiceRoller.jsx`

### 2. Atributos e Habilidades

#### 2.1. Dropdown Individual por Habilidade

Cada habilidade possui:
- Botão de expansão para mostrar/ocultar detalhes
- Modal com informações completas
- Edição inline de nome, descrição, custo, tipo
- Persistência automática via Firebase

#### 2.2. Sistema de Favoritos

- Botão de estrela (☆/★) para marcar favoritos
- Favoritas aparecem no topo da lista
- Persistência via localStorage (sincronização entre sessões)

**Localização:** `src/components/AbilityCard.jsx`

### 3. Inventário

#### 3.1. Moedas (Ouro e Prata)

- Campos editáveis no canto superior do modal
- Ícones visuais para identificação
- Persistência via Firebase

#### 3.2. Sistema de Tags

- Tags predefinidas: "consumível", "equipamento", "material"
- Criação de tags personalizadas
- Filtro por tags na lista de itens
- Associação múltipla de tags por item

#### 3.3. Edição de Itens

- Edição completa: nome, quantidade, descrição, tags
- Interface inline dentro do modal
- Salvar alterações via Firebase

**Localização:** `src/components/Inventory.jsx`

### 4. Sistema de Abas

Organização da ficha em seções:
- **Atributos**: Barras e estatísticas
- **Habilidades**: Lista de habilidades por tipo
- **Inventário**: Itens e moedas
- **Status**: Traços e efeitos temporários
- **Anotações**: Campo de texto livre

**Localização:** `src/components/Tabs.jsx` e `src/components/CharacterSheet.jsx`

### 5. Modo Claro/Escuro

- Toggle fixo no topo da tela
- Aplicação global em todos os componentes
- Persistência via Firebase para sincronização entre dispositivos
- Transições suaves entre temas

**Localização:** `src/components/ThemeToggle.jsx` e `src/hooks/useTheme.js`

### 6. Animações

- Fade-in/slide em pop-ups
- Transições suaves em mudanças de tema
- Animações em rolagens de dados
- Efeitos visuais em eventos críticos (1/20 no d20)

### 7. HP Máximo

- Campo separado para HP máximo
- Edição independente do HP atual
- Persistência via Firebase
- Visualização na barra de HP

### 8. Responsividade

- Layouts flexíveis para diferentes tamanhos de tela
- Media queries para mobile (< 600px)
- Menus colapsáveis em telas menores
- Tabs simplificadas em mobile

## Firebase Integration

### Estrutura de Dados

```
users/
  {username}/
    characters/
      {characterId}/
        - name
        - level
        - bars (inata, ether, vigor, hp, maxHp)
        - stats
        - abilities[]
        - inventory[]
        - coins (gold, silver)
        - traits[]
        - effects[]
        - notes
        - isMain
        - createdAt
        - owner
    preferences/
      theme/
        - value: "dark" | "light"
    rollHistory/
      {rollId}/
        - diceString
        - results[]
        - modifier
        - total
        - attribute
        - manualMod
        - timestamp
```

### Chaves e Coleções

- **users**: Coleção de usuários
- **characters**: Subcoleção de personagens por usuário
- **preferences**: Subcoleção de preferências (tema)
- **rollHistory**: Subcoleção de histórico de rolagens

### Persistência

Todos os dados são salvos automaticamente no Firebase quando:
- Campos são editados e perdem o foco (onBlur)
- Botão "Salvar" é clicado
- Itens são adicionados/removidos
- Habilidades são atualizadas

**Localização:** `src/config/firebase.js` e `src/App.jsx`

## Componentes Principais

### App.jsx

Componente raiz que gerencia:
- Autenticação de usuário
- Lista de personagens
- Seleção de personagem ativo
- Estado global da aplicação

### CharacterSheet.jsx

Componente principal da ficha que:
- Gerencia abas e navegação
- Renderiza diferentes seções
- Integra todos os subsistemas

### DiceRoller.jsx

Sistema de rolagem que:
- Suporta diferentes tipos de dados (d4-d20)
- Aplica modificadores de atributos
- Calcula totais automaticamente
- Persiste histórico

### Inventory.jsx

Gerenciamento de inventário com:
- Lista de itens
- Sistema de moedas
- Tags e filtros
- Edição completa

### AbilityCard.jsx

Card de habilidade com:
- Dropdown expansível
- Modal de detalhes
- Sistema de favoritos
- Edição inline

## Guia de Uso

### Criar uma Ficha

1. Faça login com seu usuário e senha
2. Clique em "+ Criar ficha"
3. Preencha os dados básicos (nome, nível, imagem)
4. Configure atributos e barras

### Adicionar Habilidades

1. Vá para a aba "Habilidades"
2. Selecione o tipo (Inata/Magia/Arte Divina)
3. Clique em "+ Habilidade"
4. Edite o nome e descrição
5. Use o botão ⓘ para abrir detalhes completos
6. Marque favoritas com a estrela ⭐

### Gerenciar Inventário

1. Vá para a aba "Inventário"
2. Clique em "Abrir Inventário"
3. Configure moedas (ouro/prata) no topo
4. Adicione itens com nome e quantidade
5. Edite itens para adicionar tags e descrições
6. Filtre por tags usando o dropdown

### Rolagem de Dados

1. Use o painel lateral direito
2. Selecione tipo de dado e quantidade
3. Escolha modificador de atributo (ou "Puro")
4. Adicione modificador manual se necessário
5. Clique em "Rolar"
6. Veja o total destacado acima dos resultados

### Alternar Tema

- Clique no botão de sol/lua no canto superior direito
- O tema é salvo automaticamente no Firebase
- Sincroniza entre todos os seus dispositivos

## Próximos Passos

Veja `improvements.md` para sugestões de melhorias futuras.

