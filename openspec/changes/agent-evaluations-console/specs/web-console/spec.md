## ADDED Requirements

### Requirement: Feature screens nest under the entity detail page they belong to

The console SHALL present a feature whose screens exist to inspect or act on one
already-modeled entity (e.g. scenarios and evaluation runs belong to one agent template) as
tabs on that entity's existing detail page rather than as a separate top-level navigation
section, unless the feature has its own cross-entity list that a user needs to reach
independently of any single entity's detail page.

#### Scenario: A per-entity feature is reached from the entity's detail page

- **WHEN** an operator wants to view or manage a feature that is scoped to one entity (such as
  an agent template's scenarios and evaluation runs)
- **THEN** that feature is reachable as a tab on the entity's detail page
- **AND** no separate top-level navigation item is added for it
