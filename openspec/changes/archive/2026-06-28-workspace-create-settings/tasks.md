## 1. Shared contracts (`mods/common`)

- [x] 1.1 Add `currency` + `timezone` to `createWorkspaceSchema`

## 2. API (`mods/apiserver`)

- [x] 2.1 `workspaces.create` writes the new workspace's `WorkspaceSettings` row (currency + timezone) after Identity creates the workspace

## 3. Webapp (`mods/webapp`)

- [x] 3.1 Create-workspace form: add Moneda (USD/DOP) + Zona horaria (curated IANA) selects, passed to `workspaces.create`

## 4. Pencil

- [x] 4.1 "Crear espacio · Modal": add Moneda + Zona horaria selects

## 5. Tests

- [x] 5.1 Unit: `workspaces.create` persists the settings row from the provided currency + timezone
- [x] 5.2 lint + typecheck + unit suite green
