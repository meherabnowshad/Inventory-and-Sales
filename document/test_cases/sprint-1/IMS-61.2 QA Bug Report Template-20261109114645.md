# QA Bug Report Template

# QA Bug Report Template
Version 1.0 · 9 Nov 2026 · Author: Radouan Ahmed (QA 1) · Reviewed by: Rejwana Tabassum (QA 2) · Task: IMS-61.2
## 1\. How to log a bug
Every bug is one ClickUp task in the QA space. Name it `BUG-<module> | <short title>`, for example `BUG-AUTH | Login error names the username field`. Paste the block below into the task description and fill every line.

```yaml
Summary: one sentence saying what is wrong
Requirement: FR / NFR / BR ID
Test case: TC ID that failed
Found in: sprint number, branch and commit
Environment: Local / Staging, browser and version, device width
Role and data: user (sadia, rafi or mitu), product, document number
Steps to reproduce:
1.
2.
3.
Expected result:
Actual result:
Evidence: screenshot, or request and response from DevTools
```

ClickUp custom fields (create once and reuse for every bug)

| Field | Type | Values |
| ---| ---| --- |
| Severity | Dropdown | Critical, High, Medium, Low |
| Priority | Dropdown | Urgent, High, Normal, Low (set at refinement) |
| Requirement ID | Text | FR-AUTH-01 |
| Test case ID | Text | TC-L-007 |
| Found in sprint | Number | 1 to 12 |
| Environment | Dropdown | Local, Staging, Production |
| Module | Dropdown | The 13 SRS module codes |

Status flow. New, Assigned, In progress, Fixed (pull request linked), Retest, Closed. Reopen with a comment if the retest fails. Severity meanings are in the master test plan, section 13.
## 2\. Example and pre-logging checklist
Example only: it shows how a filled report reads and is not a real defect.

```yaml
Title: BUG-AUTH | Login error names the username field
Summary: A wrong password shows "Password is incorrect" instead of the generic message
Requirement: FR-AUTH-01
Test case: TC-L-007
Found in: Sprint 2, branch Sprint-2, commit 3f9a1c2
Environment: Local, Chrome 130, 1366 x 768
Role and data: user rafi
Steps to reproduce:
1. Open the login page.
2. Enter username rafi and password WrongPass#1.
3. Click Login.
Expected result: One message "Invalid username or password" that names no field.
Actual result: The message "Password is incorrect" appears under the password field, which confirms the username exists.
Evidence: Screenshot login-error.png; response body of POST /auth/login

Severity: High (a Must requirement fails, and the message leaks account information)
```

Before you log a bug
*   ☐ You reproduced it twice, or noted that it happened once.
*   ☐ You searched ClickUp for the same bug.
*   ☐ You checked the SRS or spec so the expected result is not a guess; if it is, ask the BA first.
*   ☐ The title says what is wrong, not just where.
*   ☐ The report has steps, expected result, actual result and evidence.
*   ☐ The bug links the failing test case, and the case's Status is set to Fail.