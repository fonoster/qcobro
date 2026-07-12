# billing-accounts Specification (delta)

## ADDED Requirements

### Requirement: Free-standing billing account as payer

The system SHALL model the payer as a `BillingAccount` — a free-standing entity holding the
Stripe customer id, billing anchor, and dunning state — created lazily when an owner first
puts a workspace on a paid plan. Workspaces SHALL reference their billing account; the
account SHALL NOT be keyed by user identity so payership can later move without migration.
Engine and console accounting SHALL remain workspace-scoped; the payer participates only in
checkout, invoicing, and dunning.

#### Scenario: Lazy creation on first paid plan

- **WHEN** an owner with no billing account subscribes their first workspace to a paid plan
- **THEN** one `BillingAccount` and one Stripe customer are created, and the workspace
  references that account

#### Scenario: Second workspace reuses the payer

- **WHEN** the same owner puts a second workspace on a paid plan
- **THEN** no new Stripe customer is created and no new card entry is required

### Requirement: Stripe topology — one subscription, item per workspace

Each billing account SHALL hold exactly one Stripe subscription; each paid workspace SHALL be
one subscription item whose metadata carries the `workspaceRef`. Adding a paid workspace
mid-cycle SHALL add an item with proration and grant a prorated allowance. The subscription's
billing-cycle anchor SHALL align all of a payer's workspaces to a single charge date.

#### Scenario: One invoice for three workspaces

- **WHEN** a billing account has three paid workspaces at cycle end
- **THEN** Stripe produces a single invoice/charge whose line items map to the three
  workspaces via item metadata

#### Scenario: Mid-cycle workspace addition prorates

- **WHEN** a workspace is added to a paid plan halfway through the payer's cycle
- **THEN** Stripe charges a prorated amount and the workspace's opening grant is the
  correspondingly prorated allowance

### Requirement: Plan upgrade and downgrade

An upgrade SHALL swap the workspace's subscription item to the higher plan's price with
proration and immediately grant the new plan's allowance (prorated to the remaining cycle),
replacing the remaining prior allowance. A downgrade SHALL be scheduled to take effect at
period end via a subscription schedule; the current plan's allowance and rates remain in
effect until then.

#### Scenario: Upgrade replenishes immediately

- **WHEN** a workspace on `starter` with an exhausted allowance upgrades to `growth` mid-cycle
- **THEN** the item price is swapped with proration and a prorated `growth` allowance is
  granted immediately, allowing collections to resume

#### Scenario: Downgrade defers to period end

- **WHEN** an owner downgrades a workspace mid-cycle
- **THEN** the current allowance and rates continue until period end, and the next cycle
  opens on the lower plan

### Requirement: Invoice webhook drives cycle turnover

The Stripe `invoice.paid` webhook SHALL be the billing-cycle boundary: for each subscription
item on the invoice, the system SHALL close the workspace's previous cycle and open the new
one (per usage-ledger cycle semantics). Webhook handling SHALL verify the Stripe signature
and be idempotent under replay.

#### Scenario: Paid invoice opens new cycles

- **WHEN** an `invoice.paid` event arrives for a subscription with two workspace items
- **THEN** both workspaces void their unused remainder and receive their new plan allowance

### Requirement: Payment failure is distinct from exhaustion

A failed charge SHALL put the billing account into a dunning state that suspends dispatching
for all its workspaces, reported distinctly from credit exhaustion so the console can direct
the owner to fix payment rather than upgrade. Recovery (successful retry) SHALL lift the
suspension and complete the pending cycle turnover.

#### Scenario: Failed charge suspends the payer's workspaces

- **WHEN** the cycle charge for a billing account fails
- **THEN** all its workspaces stop dispatching with a payment-failure (not
  credits-exhausted) status

### Requirement: Enterprise collection

The system SHALL support Stripe `send_invoice` collection for enterprise billing accounts
as an alternative to card charges, with the same subscription-item topology and cycle
semantics.

#### Scenario: Enterprise pays by invoice

- **WHEN** a billing account is configured for `send_invoice`
- **THEN** cycles turn over on invoice payment exactly as with card collection, with no card
  on file required
