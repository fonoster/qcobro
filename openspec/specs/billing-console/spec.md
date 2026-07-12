# billing-console Specification

## Purpose

The operator console's billing surfaces: the credit meter, the collections-
paused states, plan management, and the rule that everything payment-shaped
completes on Stripe-hosted pages.

## Requirements

### Requirement: Credit meter visible to admins

The operator console SHALL show workspace admins and owners a credit meter reflecting the
current cycle's remaining balance against the plan allowance, the plan name, the cycle
renewal date, and a projected days-to-exhaustion estimate derived from the current cycle's
burn rate (omitted when there is no usage yet). All billing copy SHALL go through the i18n
layer.

#### Scenario: Admin sees remaining credits

- **WHEN** a workspace admin opens the console for a workspace on a paid plan
- **THEN** they see the remaining balance against the allowance, the plan name, the renewal
  date, and the projected days remaining, in their console language

### Requirement: Paused states distinguish exhaustion from payment failure

When dispatching is suspended, the console SHALL show a prominent paused state that
distinguishes credits exhausted (action: upgrade or wait for cycle) from payment failure
(action: fix the payment method), each with the appropriate call to action for the viewer's
role.

#### Scenario: Exhausted workspace prompts upgrade

- **WHEN** a workspace's balance reaches zero mid-cycle
- **THEN** admins see a "collections paused — credits exhausted" state and owners
  additionally see the upgrade action

#### Scenario: Payment failure prompts fixing the card

- **WHEN** the payer's charge fails
- **THEN** the paused state indicates a payment problem, not exhaustion, and directs the
  owner to update payment

### Requirement: Plan management is owner-only

The console SHALL restrict invoice viewing, payment-method management, and plan changes
(upgrade immediate, downgrade at period end) to the workspace-owner role, reusing the
existing owner-level authorization. Admins who are not owners SHALL see the meter and paused states
but no payment surfaces. The plan management modal SHALL present the ordered upgrade path
with per-plan price, included allowance, and channel rates; it serves as the comparison and
entry point, and the resulting transaction MAY complete on a Stripe-hosted page.

#### Scenario: Owner upgrades from the console

- **WHEN** an owner selects the next plan in the upgrade path and completes the flow
- **THEN** the upgrade is applied per billing-accounts semantics and the meter reflects the
  replenished allowance

#### Scenario: Non-owner admin cannot reach payment surfaces

- **WHEN** an admin without the owner role opens billing
- **THEN** payment method, invoices, and plan-change actions are not available to them

### Requirement: Payment surfaces are Stripe-hosted

The console SHALL NOT collect card data or render invoice contents in-app. Invoice viewing
and payment-method management SHALL open Stripe's hosted customer billing portal as external
links; first-time payment collection (no billing account yet) SHALL use a Stripe-hosted
checkout flow that lazily creates the billing account per billing-accounts semantics.

#### Scenario: Invoices open the Stripe portal

- **WHEN** an owner activates the view-invoices action
- **THEN** Stripe's hosted billing portal opens externally and no invoice data is rendered
  in the console

#### Scenario: First paid plan collects the card on Stripe

- **WHEN** an owner with no billing account starts a paid plan
- **THEN** card collection happens on a Stripe-hosted checkout page, and on completion the
  workspace is subscribed and its allowance granted
