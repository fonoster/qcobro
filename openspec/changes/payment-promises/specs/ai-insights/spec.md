## MODIFIED Requirements

### Requirement: Analysis is advisory and never auto-acts

The generated analysis SHALL NOT change the gestión's `outcome` and SHALL NOT create or
modify `PaymentPromise` records; it only fills the AI fields for the operator to read.

#### Scenario: Analysis does not alter outcome or payment promises

- **WHEN** an analysis is generated for a gestión
- **THEN** the gestión's `outcome` is unchanged and no `PaymentPromise` is created or
  modified as a side effect of the analysis
