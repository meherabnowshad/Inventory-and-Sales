# QA Test-Case Template

# QA Test-Case Template
Version 1.0 · 9 Nov 2026 · Author: Radouan Ahmed (QA 1) · Reviewed by: Rejwana Tabassum (QA 2) · Task: IMS-61.2
## 1\. Layout and columns
Use one workbook per ClickUp task or module. This layout comes from QA 2's IMS-06 workbook, so every case in the project reads the same way.
Workbook layout. Row 1 holds the project name, the requirement coverage and the author. Row 2 holds the module name and task ID. Row 3 holds the test types used. Row 4 holds the column headings, and cases start in row 5. Keep one sheet per area of the module, and add a final sheet named BA Questions.

| Column | What to write | Rule |
| ---| ---| --- |
| TC ID | Unique case ID | TC-<code>-NNN, numbered in order and never reused. Use the SRS module code for new workbooks (AUTH, USR, CAT, PRD, SUP, CUS, PO, INV, SAL, RET, DSH, RPT, AUD); existing IDs (TC-L, TC-T, TC-N, TC-O, TC-U, TC-D, TC-DB) stay as they are |
| Requirement | The FR, NFR and BR IDs the case proves | Exact SRS IDs, comma separated; this column feeds the traceability sheet |
| Test Scenario | One short line saying what is checked | Starts with the thing under test, for example "Wrong password shows one generic error" |
| Preconditions | State needed before step 1 | Role logged in, data present, build and environment |
| Test Steps | Numbered actions | One action per line; no expected results in steps |
| Test Data | The exact values to use | Real usernames, SKUs, amounts; "(from dev)" for secrets, never a real password |
| Expected Result | What the tester must see | Observable and exact: message text, status code, stock figure. Never "works correctly" |
| Type | Kind of case | Functional, Negative, or Boundary & Edge Case |
| Priority | Importance | Must or Should, copied from the requirement (Could becomes Should) |
| Status | Result of the latest run | Not run, Pass, Fail, Blocked, TBC |

Writing rules
*   One case checks one thing. If a step has two expected results, split it into two cases.
*   Every Must requirement has a positive case, and every business rule has at least one negative case.
*   Use boundary values: 0, 1, the maximum, one past the maximum, empty, spaces only.
*   Quote messages exactly as the SRS or spec gives them (for example "Invalid username or password").
*   If the SRS is silent, write the expected result as "TBC with BA", add a question to the BA Questions sheet, and cite it as "(See Questions: BAQ-xx-nn)".
*   Money cases state the amount to 2 decimals in BDT; stock cases state stock before and after.
## 2\. Blank row and worked example
Copy the blank row for each new case.

| TC ID | Requirement | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Type | Priority | Status |
| ---| ---| ---| ---| ---| ---| ---| ---| ---| --- |
| TC-XXX-001 | FR-XXX-00 |  |  | 1\.<br>2\. |  |  | Functional | Must | Not run |

Worked example, taken from the IMS-06 workbook:

| TC ID | Module | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Type | Priority | Status |
| ---| ---| ---| ---| ---| ---| ---| ---| ---| --- |
| TC-L-007 | FR-AUTH-01 | Wrong password shows one generic error | Login page open. | 1\. Enter username rafi and a wrong password.<br>2\. Click Login. | Username: rafi; Password: WrongPass#1 | Stays on the login page. One message: "Invalid username or password". It names no field and gives no hint that the username exists. | Negative | Must | Not run |

## 3\. BA Questions sheet
One row per open question, so expected results are never guessed.

| ID | Question | Why it matters | Affects | Ask | Answer | Status |
| ---| ---| ---| ---| ---| ---| --- |
| BAQ-06-01 | Is the username case-insensitive at login? | The database indexes lower(username); the SRS is silent | TC-L-006 | BA |  | Open |

Question IDs use `BAQ-<task or area>-NN` so they never clash with the SRS decisions Q1 to Q21. Status is Open, Answered or Closed; when answered, update the cases that cite the question and change "TBC with BA" to the final expected result.
## 4\. Test-case review checklist
The other QA reviews each workbook before it is used (the Reviewed by field in the IMS-61 tasks). A workbook passes when every box is ticked.
*   ☐ Header names the project, the requirement coverage, the author and the module.
*   ☐ Every TC ID is unique and follows the ID rule.
*   ☐ Every case names at least one FR, NFR or BR ID that exists in the SRS or spec v0.3.
*   ☐ Each case checks one thing, and steps are numbered with one action each.
*   ☐ Test data is exact; no real password appears.
*   ☐ Expected results are observable and exact, with message text, status code or stock figure.
*   ☐ Positive, negative and boundary cases exist for every Must requirement in the module.
*   ☐ Every business rule the module touches has a negative case.
*   ☐ Unclear expected results say "TBC with BA" and cite a question on the BA Questions sheet.
*   ☐ Type and Priority use only the allowed values.
*   ☐ The traceability sheet has been updated with the new case IDs.