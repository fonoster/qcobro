# Design notes

All surfaces are designed in `pencil.pen` (the active design file).

- **User menu** (`Comp/User Menu`): opens from the sidebar profile. Exactly four actions — Mi perfil, Configuración del espacio, Miembros, Cerrar sesión — with an identity header. Workspace switching is no longer a menu item; returning to the workspace list is done via the logo.
- **Workspace Configuration** is a **page** (not a modal): in-app chrome (sidebar + page header) with a single "General" card containing the name field and a save action. A modal was prototyped and rejected — a page reads more naturally for settings and leaves room to grow.
- **Workspace Card**: on-brand (Inter + emerald, 280×200). The "active" badge was removed (there is no "active" concept — the current workspace is just the one in context). A **gear sits bottom-right** on each card as a direct link to that workspace's configuration; selecting the card body enters the workspace.
- **Workspace list**: at most three workspace cards plus the "New workspace" card.

Pencil authoring note: build new screen content by **copying an existing screen/modal and overriding** text/visibility (and instancing components) rather than hand-building raw frames, which rendered blank in this document.
