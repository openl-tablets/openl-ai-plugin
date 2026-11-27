# Worked examples

Two full examples, one per mode. The patterns apply in any domain; the names here exist only inside each example.

## Example 1 — build the input model of a new claims project

*Request:* "Build the input model." The inventory: claim number, date of loss, benefit type (Disability or Accident), claimant age, and per claim line (one billed service on the claim, like a line on an invoice): line number, service code, billed amount, number of units. The consumer sends the claimant as its own object, and names the line identifier `lineNumber`.

*Understand and decide.* The project has no model and no AGENTS.md: build mode. With no convention to follow, the skill proposes the default naming of Non-negotiable 1, the Model and Vocabulary sheets of Non-negotiable 7, and the optional description and example columns, each with a suggested value from the inventory. The user confirms the naming and the sheets, and keeps only the type and name columns. Every value in the inventory is something the calculation needs and no rule produces, so all of them are inputs.

*Clarification list sent to the BA* (nothing is written yet):

1. `Claimant.age` — completed years at the date of loss, or does the consumer send a date of birth? Decides the field and who computes the age.
2. `ClaimLine.serviceCode` — a closed list (vocabulary) or an open code set?
3. `ClaimLine.units` — required, or a default when absent?
4. `ClaimLine.billedAmount` — one currency, and what precision?
5. `Claim.lossDate` — do the rules vary by date of loss? If so, it feeds the runtime context, and the rules that vary go to the versioning skill.
6. `Claim.claimant` — one claimant per claim, or several (an array)? The inventory names a claimant age but not how many claimants a claim can have.

*BA answers:* (1) the consumer sends the age in completed years at the date of loss; (2) an open code set; (3) required, no default; (4) one currency, 2 decimals; (5) not versioned for now; (6) one claimant per claim.

*Written on the work branch.* Model sheet, parent first:

```text
Datatype Claim
String          | claimNumber
Date            | lossDate
BenefitType     | benefitType
Claimant        | claimant
ClaimLine[]     | claimLines

Datatype Claimant
Integer         | age

Datatype ClaimLine
String          | lineNumber
String          | serviceCode
Double          | billedAmount
Integer         | units
```

Vocabulary sheet:

```text
Datatype BenefitType <String>
Disability
Accident
```

*Verify, summarise, stop.* The project compiles. The summary lists the request fields and the answered clarifications; nothing reads the model yet, so there are no hand-offs. The whole model is a new contract, so the consuming team verifies the request before the project is saved.

## Example 2 — rename a field that rules, tests and a UI config read

*Request:* "Rename occupationClass to riskClass, the policy system renamed it." The project's model has `Datatype Employee` with `OccupationClass | occupationClass`, where `OccupationClass` is a vocabulary. The entry point is `DeterminePolicyPremium (Policy policy)`, and the request carries the employees.

*Change list.* `Employee.occupationClass` → `Employee.riskClass`, type unchanged. It is a rename on the exposed request, so it is breaking. The user confirms that the vocabulary type keeps its name `OccupationClass`.

*Dependency check* (search of the project, its dependents and the UI config for `occupationClass`; test tables and API schema read):

- This project: the spreadsheet `DetermineEmployeeRate`, step `OccupationFactor = OccupationFactor (occupationClass)` → spreadsheet skill.
- Test data: the `occupationClass` column of the data table `EmployeesData`, used by the test tables `DetermineEmployeeRateTest` and `DeterminePolicyPremiumTest` → testing skill.
- UI config: the employee section reads `occupationClass` → its owner.
- Dependent projects: none.
- Exposed service and consumer: `employees[].occupationClass` in the `DeterminePolicyPremium` request, sent by the policy system → integration mapping skill, for the mapping document and the policy system team.

*Path.* The user chooses a coordinated switch with the policy system's release rather than adding `riskClass` next to `occupationClass`.

*Write and verify on the work branch.* The field is renamed in `Employee`; the step, the data column and the UI config are changed through their hand-offs, so the project compiles. A new search finds `occupationClass` nowhere (the type `OccupationClass` remains, as agreed). All tests pass with the same results; the response is unchanged in content and size.

*Business summary and stop.* "The request field for the employee's occupation class is now called riskClass. The policy system must send the new name from the same release; nothing else in the request or response changes. Changed with it: one rule step, the test data, and the screen that displays the field. The mapping document needs updating." The change waits for the policy system team's confirmation and the user's approval.
