# Configuração do Firebase

## Estrutura de Coleções

O projeto usa a seguinte estrutura no Firestore:

```
users/
  {username}/
    characters/
      {characterId}/
        - name: string
        - level: number
        - isMain: boolean
        - image: string
        - bars: {
            inata: number,
            ether: number,
            vigor: number,
            hp: number,
            maxHp: number
          }
        - stats: {
            for: number,
            des: number,
            sab: number,
            int: number,
            car: number,
            con: number,
            arteDivina: number,
            inata: number,
            magica: number
          }
        - abilities: Array<{
            id: number,
            title: string,
            type: string,
            description: string,
            effect: string,
            damage: string,
            cost: string
          }>
        - inventory: Array<{
            name: string,
            quantity: number,
            description: string,
            tags: string[]
          }>
        - coins: {
            gold: number,
            silver: number
          }
        - traits: Array<{
            id: number,
            name: string,
            effect: string
          }>
        - effects: Array<{
            id: number,
            name: string,
            description: string
          }>
        - notes: string
        - createdAt: timestamp
        - owner: string
    preferences/
      theme/
        - value: "dark" | "light"
    rollHistory/
      {rollId}/
        - diceString: string
        - results: number[]
        - modifier: number
        - total: number
        - attribute: string
        - manualMod: number
        - timestamp: number
```

### Sessões de mapa (multiplayer)

Coleções novas, sem alterar as existentes:

```
sessions/
  {sessionId}/
    - gmUsername: string
    - mapWidth: number
    - mapHeight: number
    - name: string
    - backgroundImageUrl: string (opcional, URL ou data URL da imagem de fundo)
    - createdAt: timestamp
    tokens/
      {tokenId}/
        - ownerUsername: string
        - characterId: string
        - characterName: string
        - x: number
        - y: number
        - color: string (opcional)
    areas/
      {areaId}/
        - name: string
        - type: "circle" | "cone" | "freeform"
        - cells: Array<{ x: number, y: number }>
        - color: string (opcional)
```

## Configuração

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/)
2. Ative o Firestore Database
3. Copie as credenciais do projeto
4. Substitua `firebaseConfig` em `src/config/firebase.js`

## Regras de Segurança

Exemplo de regras básicas para desenvolvimento:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permite que usuários acessem apenas seus próprios dados
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      match /characters/{characterId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      match /preferences/{preferenceId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      match /rollHistory/{rollId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

**Nota**: Este projeto atualmente usa autenticação simples (username/password). Para produção, recomenda-se migrar para Firebase Auth.

### Regras para sessões de mapa

Como o app usa login próprio (não Firebase Auth), as regras abaixo permitem leitura e escrita nas coleções `sessions` e `sessions/{sessionId}/tokens` para qualquer cliente. A restrição de “quem move qual token” é feita na interface (mestre pode mover todos; jogador só o próprio). Para uso em grupo de confiança.

```javascript
    // Sessões de mapa (compartilhadas)
    match /sessions/{sessionId} {
      allow read, write: if true;
      match /tokens/{tokenId} {
        allow read, write: if true;
      }
      match /areas/{areaId} {
        allow read, write: if true;
      }
    }
```

## Índices Recomendados

Crie índices compostos para melhorar a performance:

1. **rollHistory**: 
   - Campo: `timestamp` (Descendente)
   - Coleção: `users/{username}/rollHistory`

2. **characters**:
   - Campo: `isMain` (Ascendente), `createdAt` (Descendente)
   - Coleção: `users/{username}/characters`

## Quotas e Limites

- **Leituras**: 50.000/dia (gratuito)
- **Escritas**: 20.000/dia (gratuito)
- **Tamanho de documento**: 1MB máximo
- **Profundidade de subcoleção**: 100 níveis

## Migração de Dados

Para migrar dados existentes, use scripts Node.js:

```javascript
const admin = require('firebase-admin');
// ... configuração
// Migração de estrutura antiga para nova
```

