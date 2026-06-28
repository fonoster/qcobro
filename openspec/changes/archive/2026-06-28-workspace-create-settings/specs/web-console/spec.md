## ADDED Requirements

### Requirement: Workspace creation collects currency and timezone

The create-workspace form SHALL collect the new workspace's **currency** (`USD` | `DOP`) and
**timezone** (IANA zone) in addition to its name, and SHALL submit them so the workspace's
settings are configured at creation. All labels go through the i18n layer.

#### Scenario: Operator sets currency and timezone when creating a workspace

- **WHEN** an operator fills the create-workspace form with a name, currency, and timezone and submits
- **THEN** the workspace is created with those settings
- **AND** money and campaign wall-clock interpretation use them immediately, without a separate visit to Configuración del espacio
