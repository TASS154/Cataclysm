# Sistema de Fichas de RPG

Sistema completo e moderno de gerenciamento de fichas de RPG desenvolvido em React + Firebase.

## 🚀 Features Principais

### ✅ Sistema de Rolagens
- Rolagem de dados (d4-d20) com múltiplos dados
- Soma automática de resultados
- Modificadores de atributos e bônus manuais
- Histórico de rolagens persistido no Firebase
- Exibição destacada do total

### ✅ Gerenciamento de Habilidades
- Dropdown individual por habilidade
- Modal de detalhes com edição completa
- Sistema de favoritos (estrelas)
- Organização por tipo (Inata, Magia, Arte Divina)
- Favoritas aparecem no topo

### ✅ Inventário Completo
- Moedas (Ouro e Prata) editáveis
- Sistema de tags (predefinidas + personalizadas)
- Filtro por tags
- Edição completa de itens (nome, quantidade, descrição, tags)
- Interface intuitiva e responsiva

### ✅ Organização por Abas
- Atributos (barras e estatísticas)
- Habilidades (por tipo)
- Inventário (itens e moedas)
- Status (traços e efeitos)
- Anotações (texto livre)

### ✅ Modo Claro/Escuro
- Toggle fixo no topo
- Sincronização entre dispositivos via Firebase
- Transições suaves
- Persistência de preferência

### ✅ Responsividade Total
- Layout adaptativo para mobile
- Menus colapsáveis
- Tabs simplificadas em telas pequenas
- Otimizado para todas as resoluções

### ✅ HP Máximo
- Campo separado para HP máximo
- Edição independente
- Visualização na barra de HP

### ✅ Notas de Perfil
- Notas pessoais do usuário, independentes de qualquer ficha
- Acessíveis pela rota `/notas`, pelo sidebar e dentro de uma sessão de mapa
- Markdown com preview (negrito, listas, links, tabelas via GFM)
- Tags, busca por título/corpo/tags e fixar no topo (pin)
- Persistência em `users/{username}/notes` no Firestore
- Cada participante de uma sessão vê apenas as próprias notas

> **Diferença importante:** a aba **Anotações do Personagem** dentro da
> ficha continua existindo e é específica daquele personagem. As **Notas
> de Perfil** ficam atreladas à conta e servem para qualquer ficha/mesa.

### ✅ Importar/Exportar fichas em JSON
- Exportação por grupos selecionáveis:
  - **Mecânica**: atributos, habilidades, inventário, equipamento, barras, focus
  - **Narrativa**: anotações, lore, documentos, galeria, traços
  - **Personalização**: atalhos de rolagem, modos
- Importação com validação de formato e detecção de conflitos
  (mesmo ID ou nome): você decide caso a caso entre **substituir**,
  **criar nova ficha** ou **pular**.
- Arquivo gerado é JSON legível, com cabeçalho `_meta` para versionamento.

## 🛠️ Tecnologias

- **React 19** - Framework UI
- **Vite** - Build tool
- **Firebase Firestore** - Backend e persistência
- **CSS3** - Estilização com variáveis CSS

## 📦 Instalação

```bash
# Clone o repositório
git clone <seu-repositorio>

# Instale as dependências
npm install

# Configure o Firebase
# Edite src/config/firebase.js com suas credenciais

# Inicie o servidor de desenvolvimento
npm run dev

# Build para produção
npm run build
```

## 🔥 Configuração do Firebase

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/)
2. Ative o Firestore Database
3. Copie as credenciais do projeto
4. Substitua `firebaseConfig` em `src/config/firebase.js`

Veja mais detalhes em [docs/firebase-setup.md](docs/firebase-setup.md)

## 📚 Documentação

A documentação completa está disponível em `/docs/`:

- [README.md](docs/README.md) - Visão geral e guia de uso
- [features-detailed.md](docs/features-detailed.md) - Detalhes técnicos das features
- [firebase-setup.md](docs/firebase-setup.md) - Configuração do Firebase

## 📁 Estrutura do Projeto

```
src/
├── components/          # Componentes React
│   ├── AbilityCard.jsx
│   ├── CharacterSheet.jsx
│   ├── DiceRoller.jsx
│   ├── Inventory.jsx
│   ├── Tabs.jsx
│   └── ThemeToggle.jsx
├── config/
│   └── firebase.js      # Configuração Firebase
├── hooks/
│   └── useTheme.js      # Hook de tema
├── services/
│   └── rollHistoryService.js
├── styles/
│   └── themes.css       # Variáveis CSS
├── utils/
│   └── dice.js          # Utilitários de dados
└── App.jsx              # Componente principal
```

## 🚀 Deploy no Vercel

O projeto está configurado para deploy automático no Vercel:

1. Conecte seu repositório ao Vercel
2. Configure as variáveis de ambiente (se necessário)
3. O deploy será automático a cada push

Veja `vercel.json` para configurações.

## 🎨 Personalização

### Temas

Os temas podem ser personalizados em `src/styles/themes.css`:

```css
:root[data-theme="dark"] {
  --accent-indigo: #6b46c1;
  /* ... */
}
```

### Estilos

CSS modular por componente em `src/components/*.css`

## 📝 Changelog

Veja [CHANGELOG.md](CHANGELOG.md) para histórico de mudanças.

## 🔮 Melhorias Futuras

Veja [improvements.md](improvements.md) para sugestões de melhorias.

## 📄 Licença

Este projeto é privado.

## 👤 Autor

Desenvolvido para gerenciamento de fichas de RPG.

---

**Nota**: Este sistema foi completamente refatorado e melhorado com foco em modularidade, responsividade e experiência do usuário.
