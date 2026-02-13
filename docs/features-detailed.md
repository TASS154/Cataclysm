# Features Detalhadas

## 1. Sistema de Rolagens

### Identificação de Rolagem

O sistema identifica automaticamente a última rolagem através do estado `lastRollTotal` no componente `DiceRoller`.

### Cálculo Automático

```javascript
const totalSum = results.reduce((sum, r) => sum + r.total, 0);
```

Soma todos os valores finais (resultado + modificadores) de cada dado.

### Persistência

Rolagens são salvas no Firebase na coleção:
```
users/{username}/rollHistory/{rollId}
```

Cada rolagem contém:
- `diceString`: Ex: "5d6"
- `results`: Array de resultados individuais
- `modifier`: Total de modificadores aplicados
- `total`: Soma final
- `timestamp`: Data/hora da rolagem

## 2. Sistema de Favoritos

### Implementação

Favoritos são armazenados no localStorage com a chave:
```
favorites-{username}-{characterId}
```

### Ordenação

Favoritos aparecem primeiro na lista, seguidos pelas demais habilidades:
```javascript
const favoriteAbilitiesList = filteredAbilities.filter(a => favoriteAbilities.includes(a.id));
const otherAbilities = filteredAbilities.filter(a => !favoriteAbilities.includes(a.id));
```

## 3. Tags no Inventário

### Tags Predefinidas

- consumível
- equipamento
- material

### Criação de Tags Personalizadas

O usuário pode criar novas tags através do campo de input no modal de inventário. Tags são armazenadas no estado do componente e persistem enquanto a sessão estiver ativa.

### Filtragem

```javascript
const filteredInventory = filterTag
  ? inventory.filter(item => 
      item.tags && Array.isArray(item.tags) && item.tags.includes(filterTag)
    )
  : inventory;
```

## 4. Estrutura de Dados de Itens

Cada item no inventário possui:
```javascript
{
  name: string,
  quantity: number,
  description: string,
  tags: string[]
}
```

## 5. Sistema de Abas

### Persistência de Aba Ativa

A aba ativa é salva no localStorage:
```javascript
localStorage.setItem(`activeTab-${characterId}`, activeTab);
```

### Animações de Transição

Cada mudança de aba tem uma animação fade-in:
```css
@keyframes fadeInContent {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

## 6. Modo Claro/Escuro

### Implementação

O hook `useTheme` gerencia:
1. Estado local do tema
2. Sincronização com localStorage
3. Persistência no Firebase

### Aplicação Global

O tema é aplicado através do atributo `data-theme` no elemento raiz:
```javascript
document.documentElement.setAttribute("data-theme", theme);
```

CSS variables são definidas por tema:
```css
:root[data-theme="dark"] {
  --bg-0: #0b1220;
  /* ... */
}

:root[data-theme="light"] {
  --bg-0: #f8fafc;
  /* ... */
}
```

## 7. HP Máximo

### Campo Separado

O HP máximo é armazenado em `sheet.bars.maxHp` separadamente de `sheet.bars.hp`.

### Visualização

Na barra de HP, ambos os valores são mostrados:
```jsx
<input value={sheet.bars.hp} /> / <input value={sheet.bars.maxHp} />
```

A barra de preenchimento usa `maxHp` como valor máximo:
```jsx
width: `${Math.min((value / maxHp) * 100, 100)}%`}
```

## 8. Animações

### Modal Fade-in

```css
@keyframes modalFadeIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
```

### Backdrop Blur

Modais usam backdrop-filter para efeito de desfoque:
```css
backdrop-filter: blur(4px);
```

### Transições de Tema

Mudanças de tema têm transição suave:
```css
transition: background-color 0.3s ease, color 0.3s ease;
```

