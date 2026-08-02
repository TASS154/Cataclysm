# Firestore backups

Snapshots do projeto Firebase `num-sei-57bbb` antes de migrações Rampage / sessão integrada.

## Conteúdo de cada pasta `firestore-YYYY-MM-DDTHH-MM-SS/`

| Arquivo | Conteúdo |
| --- | --- |
| `meta.json` | Projeto, data, notas |
| `users.json` | Docs `users/*` + subcoleções `characters`, `rollHistory`, `notes`, `gmLibrary` |
| `sessions.json` | Docs `sessions/*` + `tokens` e `areas` |

URLs de Storage são referências; blobs de mídia não são baixados neste dump.

## Como restaurar (manual)

1. Use o Firebase Console ou um script Admin SDK.
2. Leia `users.json` / `sessions.json` e grave docs/subcoleções correspondentes.
3. Timestamps serializados como `{ "__timestamp": "ISO..." }` devem ser convertidos de volta para `Timestamp`.

Dump gerado via Firebase client SDK (mesma config do app).
