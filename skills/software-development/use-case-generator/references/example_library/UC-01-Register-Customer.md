# USE CASE UC-01-Register New Customer

**Context of use:** Sales agent registers a new customer in the CRM system. This is the first interaction with a new potential client. Does not include the sales process that follows registration.

**Scope:** CRM System — System scope, black box

**Level:** User-goal

**Primary Actor:** Sales Agent

**Stakeholders & Interests:**
- Sales Agent: Wants to quickly register customer information and have it available for follow-up.
- Customer (off-stage): Wants their personal data handled securely and in compliance with privacy regulations.
- Compliance Officer (off-stage): Needs audit trail showing consent was obtained and data handling follows GDPR/local regulations.
- Marketing Department (off-stage): Wants to know if the customer opted in to communications.
- System Owner: Wants clean, deduplicated customer records.

**Precondition:** Sales agent is logged into the CRM system with appropriate permissions.

**Minimal Guarantees:** Customer consent record is created and stored. All personal data fields are validated for format and completeness. If registration fails, no partial or corrupted customer record is created. Audit log entry records who registered the customer and when.

**Success Guarantees:** New customer record exists in CRM with all provided information. Customer ID is assigned and returned to the sales agent. Consent preferences are recorded. Sales agent receives confirmation with customer details.

**Trigger:** Sales agent decides to register a new customer.

## Main Success Scenario

1. Sales Agent: selects "Register New Customer" from the main menu.
2. CRM System: displays the customer registration form with required field indicators.
3. Sales Agent: enters customer's first name, last name, and email address.
4. CRM System: validates that all required fields are present and well-formed.
5. Sales Agent: specifies communication consent preferences (opt-in/opt-out for marketing).
6. CRM System: checks for duplicate records based on email address.
7. CRM System: creates the new customer record with a unique customer ID.
8. CRM System: records the registration event in the audit log with agent identity and timestamp.
9. CRM System: displays confirmation to the sales agent showing the new customer's details and assigned ID.

## Extensions

4a. Required field is missing or malformed:
    - CRM System: highlights the invalid field(s) and displays an error message explaining the required format.
    - Sales Agent: corrects the entry and resubmits.
    - (Returns to step 4)

6a. Duplicate customer record found with matching email:
    - CRM System: displays the existing customer's record and asks the sales agent whether to link the new interaction or register a separate record.
    - Sales Agent: either links to the existing customer (returns to step 8 with existing ID) or provides an alternative email address (returns to step 3).

4b. Email format is invalid:
    - CRM System: rejects the entry and displays a hint about valid email format.
    - Sales Agent: corrects the email and resubmits.
    - (Returns to step 4)

## Technology and Data Variations List

- Step 3: Customer data may be entered manually or imported from a CSV file for bulk registration.
- Step 6: Duplicate detection may use exact email match, fuzzy name matching, or phone number matching depending on system configuration.

## Related Information

- **Priority:** 1 (highest)
- **Channels:** Desktop application, web browser
- **Frequency:** Multiple times per day for active sales teams
- **Open Issues:** Should the system auto-generate a welcome email? Who sends it?