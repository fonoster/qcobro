## ADDED Requirements

### Requirement: Inbound message correlation by canonical phone match

The system SHALL correlate an inbound WhatsApp message to the gestión (contact log entry) it is a
reply to by an exact match between the inbound sender's phone number and the destination phone
number recorded on the dispatch, both compared in canonical E.164 form. The correlation query SHALL
be a direct, indexed/exact lookup scoped to the sender number's workspace — not a bounded scan over
the workspace's recent contact logs. When the inbound sender's number cannot be parsed as a valid
phone number, the system SHALL treat the message as unmatched without querying the datastore.

#### Scenario: Inbound reply matches its dispatch by canonical phone

- **WHEN** a customer replies on WhatsApp to a number the system previously dispatched a WHATSAPP
  template to
- **THEN** the system correlates the reply to that gestión by comparing the inbound sender's E.164
  number against the dispatch's recorded destination E.164 number
- **AND** the match uses a direct query scoped to the sender number's workspace, not a scan of the
  most-recent N contact logs

#### Scenario: Unparseable inbound sender number yields no match

- **WHEN** an inbound WhatsApp message's sender number cannot be parsed as a valid phone number
- **THEN** the system treats the message as unmatched to any gestión
- **AND** does not attempt a datastore lookup for the malformed number
