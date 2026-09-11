# HomeReady AI — Claude Code Instructions

## 1. Project Overview

HomeReady AI is a production-oriented AI-powered home-buying readiness application.

The application helps users understand whether they are financially prepared to pursue homeownership.

The system will allow users to:

* Create an account
* Log in securely
* Enter financial and home-buying information
* Create home-readiness assessments
* Receive a deterministic readiness score
* See a detailed score breakdown
* Receive recommendations for improvement
* View historical assessments and scores
* Ask an AI assistant questions about their results
* Upload financial/home-buying documents securely
* Optionally request connection with real-estate professionals
* Manage their own data securely

The application handles sensitive financial information.

Security, privacy, authorization, data ownership, and auditability are first-class requirements.

This is a portfolio-grade application and should be designed as a real production system rather than a toy project.

---

# 2. Core Development Principle

Build the application incrementally.

DO NOT implement the entire application at once.

The project is divided into phases.

Only implement the phase explicitly requested by the developer/user.

Never silently implement functionality belonging to future phases.

If functionality from a later phase appears necessary, explain why and wait for approval unless it is a trivial internal dependency required by the current phase.

After each phase:

1. Implement the requested functionality.
2. Add/update tests.
3. Run the relevant tests.
4. Fix failures.
5. Run linting/type checking where applicable.
6. Review security implications.
7. Explain what changed.
8. Explain how to verify it locally.
9. Stop.

---

# 3. Technology Stack

## Frontend

* Next.js
* TypeScript
* React
* Tailwind CSS

## Backend

* Python
* FastAPI
* Pydantic
* SQLAlchemy 2.x
* Alembic

## Database

* PostgreSQL

## Authentication

* Argon2id password hashing
* Short-lived access tokens
* Rotating refresh tokens
* HttpOnly/Secure/SameSite cookies where appropriate

## AI

Use an abstraction:

```text
AIService
```

The application must not be tightly coupled to one AI provider.

The AI layer is responsible for explanation and conversation.

The AI layer is NOT the source of truth for readiness scores.

## Storage

* AWS S3
* AWS KMS
* Private S3 bucket
* Short-lived presigned URLs

## Deployment

Frontend:

* Vercel

Backend:

* Render initially

Database:

* PostgreSQL

CI/CD:

* GitHub Actions

---

# 4. High-Level Architecture

```text
                        Internet
                           |
                           v
                    +--------------+
                    |   Next.js    |
                    |   Frontend   |
                    +--------------+
                           |
                         HTTPS
                           |
                           v
                    +--------------+
                    |   FastAPI    |
                    |    Backend   |
                    +--------------+
                      /     |      \
                     /      |       \
                    v       v        v
             PostgreSQL    S3       AIService
                 |          |
                 |          v
                 |       KMS
                 |
                 v
             Application
                 Data
```

The frontend must never connect directly to PostgreSQL.

All authorization must happen on the backend.

The frontend is not a security boundary.

---

# 5. Repository Structure

Use this structure unless there is a strong technical reason to change it.

```text
homeready-ai/
│
├── CLAUDE.md
├── README.md
├── .gitignore
├── .env.example
├── docker-compose.yml
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   │
│   │   ├── api/
│   │   │   ├── deps.py
│   │   │   └── routes/
│   │   │
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── logging.py
│   │   │
│   │   ├── db/
│   │   │   ├── session.py
│   │   │   └── base.py
│   │   │
│   │   ├── models/
│   │   │
│   │   ├── schemas/
│   │   │
│   │   ├── services/
│   │   │
│   │   └── security/
│   │
│   ├── tests/
│   │
│   ├── alembic/
│   ├── alembic.ini
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── types/
│   ├── public/
│   └── Dockerfile
│
├── docs/
│   ├── architecture.md
│   ├── database.md
│   ├── authentication.md
│   ├── authorization.md
│   ├── scoring-methodology.md
│   ├── ai-architecture.md
│   ├── security.md
│   ├── deployment.md
│   └── threat-model.md
│
└── .github/
    └── workflows/
```

---

# 6. Database Design

The primary application database is PostgreSQL.

The database contains structured application data.

Large sensitive documents must NOT be stored directly in PostgreSQL.

Documents belong in private S3.

---

# 7. Core Database Entities

## Users

```text
users
-----
id
email
password_hash
first_name
last_name
is_active
email_verified
created_at
updated_at
last_login_at
```

Never store plaintext passwords.

---

# 8. RBAC

The application uses role-based access control.

Initial roles:

```text
USER
ADMIN
SUPPORT
REALTOR
```

Potential future role:

```text
SUPER_ADMIN
```

Do not hardcode authorization logic throughout the application using role names.

Use granular permissions.

Examples:

```text
assessment:create
assessment:read:own
assessment:read:any
assessment:update:own

chat:create
chat:read:own

file:create
file:read:own
file:delete:own

user:read:any

audit:read

scoring:update

partner:manage

connection:create
```

Database entities:

```text
roles
permissions
user_roles
role_permissions
```

---

# 9. Authorization and Ownership

RBAC alone is NOT sufficient.

Every resource operation must also enforce ownership where appropriate.

Example:

```python
resource.user_id == current_user.id
```

A user with:

```text
assessment:read:own
```

must only be able to read their own assessment.

User A must never access User B's:

* assessments
* scores
* chats
* messages
* documents
* recommendations
* financial information

even if User A manually changes the URL or API ID.

Protect against:

* IDOR
* BOLA
* privilege escalation

The backend must perform authorization checks.

Never rely on:

* frontend route protection
* hidden buttons
* frontend role checks
* URL obscurity

---

# 10. Authentication

Use:

```text
Argon2id
```

for password hashing.

Authentication should use:

```text
Short-lived access token
+
Rotating refresh token
```

Refresh tokens should be:

* cryptographically random
* hashed before database storage
* revocable
* rotated
* associated with the appropriate user/session

Never store plaintext refresh tokens.

Never put sensitive financial information in JWT claims.

JWT claims should contain only minimal information required for authentication/authorization.

Prefer secure browser authentication using:

```text
HttpOnly
Secure
SameSite
```

cookies where appropriate.

---

# 11. Assessments

Users create assessments containing information such as:

```text
income
monthly_debt
credit_score
savings
down_payment
target_home_price
employment_years
location
```

Assessment statuses:

```text
DRAFT
SUBMITTED
PROCESSING
COMPLETED
FAILED
```

Users should be able to:

* create
* update
* view
* submit
* list historical assessments

Users can only modify their own assessments.

---

# 12. Readiness Scoring

There is no universal official formula for a "Home Readiness Score."

Therefore, the application uses a transparent, configurable product methodology.

The score must be deterministic.

Initial categories:

```text
Financial Stability       25%
Debt Management           20%
Down Payment              20%
Credit                    15%
Savings                   10%
Employment Stability      10%
```

Total:

```text
100%
```

Example:

```text
Overall Score =
    Financial Stability * 0.25
  + Debt Management     * 0.20
  + Down Payment        * 0.20
  + Credit              * 0.15
  + Savings             * 0.10
  + Employment          * 0.10
```

Each category produces a score between:

```text
0 - 100
```

The final score must also be:

```text
0 - 100
```

Initial statuses:

```text
0-39     NOT_READY
40-59    NEEDS_IMPROVEMENT
60-74    ALMOST_READY
75-89    READY
90-100   HIGHLY_READY
```

These thresholds and weights are product methodology, not universal financial standards.

Do not represent them as official lending or mortgage standards.

Before real-world financial reliance, the methodology should receive appropriate professional/legal/compliance review.

---

# 13. Scoring Versioning

Scoring must be versioned.

Database:

```text
scoring_versions
```

Example:

```text
v1.0
v1.1
v2.0
```

A readiness result must store:

```text
scoring_version_id
```

Historical results must never silently change when the scoring methodology changes.

For example:

```text
Assessment A
Score = 72
Scoring Version = v1.0
```

Later:

```text
Scoring Version = v2.0
```

Assessment A should still show:

```text
72
v1.0
```

unless the user explicitly creates a new assessment/recalculation workflow.

---

# 14. Readiness Result

```text
readiness_results
-----------------
id
assessment_id
scoring_version_id
overall_score
status
created_at
```

Score breakdown:

```text
score_breakdowns
----------------
id
readiness_result_id
category
raw_value
category_score
weight
created_at
```

The exact result used to produce the score should be persisted.

---

# 15. Recommendations

Recommendations should be generated from deterministic score/category results.

Example:

```text
Debt score = 45
```

Possible recommendation:

```text
Priority: HIGH

Focus on reducing monthly debt obligations
before increasing your target home price.
```

Recommendations:

```text
recommendations
----------------
id
readiness_result_id
category
priority
title
description
source
created_at
```

AI should not secretly modify recommendations that affect the deterministic score.

---

# 16. Assessment History

Users must be able to view their historical results.

Example:

```text
September 1
Score: 62
Status: ALMOST_READY

September 20
Score: 68
Status: ALMOST_READY

October 5
Score: 76
Status: READY
```

History is important because users may want to understand progress.

Historical results must preserve:

* original score
* original category scores
* original weights
* original scoring version
* timestamp

---

# 17. AI Architecture

AI is an explanation and conversation layer.

It is NOT the source of truth.

Architecture:

```text
User
 ↓
FastAPI
 ↓
Authentication
 ↓
Authorization
 ↓
Retrieve authorized context
 ↓
AIService
 ↓
LLM
 ↓
Response
```

Do NOT allow the AI provider to directly access PostgreSQL.

The AI service should receive only the minimum relevant information.

Example:

User:

> Why did my score decrease?

Backend retrieves:

```text
previous_score = 72
current_score = 65

previous_debt_score = 75
current_debt_score = 55
```

The AI receives this relevant context.

It does not receive the entire database.

---

# 18. AI Security

Protect against:

* prompt injection
* indirect prompt injection
* sensitive data leakage
* cross-user context leakage
* malicious document instructions
* unauthorized tool usage

Uploaded documents are untrusted input.

Do not allow document content to override system instructions.

Do not expose:

* passwords
* refresh tokens
* API keys
* secrets
* unrelated users' information

The AI must never:

* change a readiness score
* change a user's role
* bypass authorization
* access arbitrary user records
* approve a mortgage
* represent itself as a lender

---

# 19. Chat Database

Chat sessions:

```text
chat_sessions
-------------
id
user_id
title
assessment_id
created_at
updated_at
```

Messages:

```text
chat_messages
-------------
id
session_id
role
content
created_at
```

Roles:

```text
USER
ASSISTANT
SYSTEM
```

Users can only access their own sessions and messages.

---

# 20. Document Storage

Sensitive documents must be stored in:

```text
Private AWS S3
```

PostgreSQL stores metadata only.

```text
files
-----
id
user_id
assessment_id
chat_session_id
original_filename
storage_key
content_type
file_size
processing_status
created_at
```

Extracted data:

```text
file_extractions
----------------
id
file_id
extracted_text
structured_data
processing_status
created_at
```

---

# 21. S3 Security

S3 requirements:

* Block Public Access enabled
* private bucket
* server-side encryption
* AWS KMS where appropriate
* least-privilege IAM
* short-lived presigned URLs
* lifecycle policies
* versioning where appropriate
* encrypted backups where applicable

Never expose AWS credentials to the browser.

Never make financial documents public.

Object keys should be generated by the backend.

Example:

```text
users/{user_id}/assessments/{assessment_id}/files/{file_id}
```

The object key is NOT an authorization mechanism.

Always verify ownership before generating a presigned URL.

---

# 22. File Upload Flow

Preferred flow:

```text
Browser
   |
   | request upload
   v
FastAPI
   |
   | authenticate
   | authorize
   | validate
   v
Generate short-lived presigned URL
   |
   v
Private S3
```

The backend must validate:

* authenticated user
* assessment ownership
* file type
* file size
* allowed extension/content type
* generated object key

Do not trust the client filename.

---

# 23. File Processing

Uploaded documents may eventually be processed for extraction.

Potential flow:

```text
S3
 ↓
Processing worker
 ↓
Text extraction
 ↓
Structured extraction
 ↓
User review
 ↓
Assessment
```

Extracted financial information should NOT automatically affect a readiness score without an appropriate validation/review process.

Prefer:

```text
Document
 ↓
Extraction
 ↓
User reviews
 ↓
User confirms/corrects
 ↓
Assessment uses data
```

---

# 24. Real Estate Connections

Users may eventually request connection with a real-estate professional.

Entities:

```text
real_estate_partners
connection_requests
```

Connection should require explicit user consent.

Do not automatically share sensitive financial information.

Share only the minimum necessary information.

Record consent.

---

# 25. Audit Logging

Sensitive operations should be auditable.

Table:

```text
audit_logs
----------
id
user_id
action
resource_type
resource_id
ip_address
user_agent
metadata
created_at
```

Examples:

```text
USER_LOGIN
USER_LOGOUT

ASSESSMENT_CREATED
ASSESSMENT_VIEWED

FILE_UPLOADED
FILE_DOWNLOADED
FILE_DELETED

CHAT_CREATED

CONNECTION_REQUESTED

ROLE_CHANGED

ADMIN_VIEWED_USER
ADMIN_VIEWED_DOCUMENT

SCORING_VERSION_CHANGED
```

Never log:

* passwords
* JWTs
* refresh tokens
* API keys
* AWS credentials
* complete financial documents
* unnecessary sensitive financial data

---

# 26. Database Security

Use:

* TLS
* encrypted storage
* encrypted backups
* least-privilege database users
* separate development/staging/production databases
* migrations through Alembic

The application must not connect using a PostgreSQL superuser in production.

---

# 27. API Design

Use REST APIs.

Example:

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/auth/me

POST   /api/v1/assessments
GET    /api/v1/assessments
GET    /api/v1/assessments/{id}
PATCH  /api/v1/assessments/{id}
POST   /api/v1/assessments/{id}/submit

GET    /api/v1/assessments/{id}/results

POST   /api/v1/chat/sessions
GET    /api/v1/chat/sessions
POST   /api/v1/chat/sessions/{id}/messages

POST   /api/v1/files/upload-url
POST   /api/v1/files/{id}/complete
GET    /api/v1/files/{id}
DELETE /api/v1/files/{id}
```

Use API versioning:

```text
/api/v1/
```

---

# 28. API Error Handling

Use consistent errors.

Example:

```json
{
  "detail": "Assessment not found"
}
```

Do not leak:

* stack traces
* SQL queries
* internal file paths
* secrets
* authentication implementation details

Use appropriate HTTP status codes.

Examples:

```text
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Validation Error
429 Too Many Requests
500 Internal Server Error
```

---

# 29. Security Threat Model

The system must consider:

## Authentication

* credential theft
* brute force
* session theft
* refresh-token abuse
* account takeover

## Authorization

* IDOR
* BOLA
* privilege escalation
* role manipulation
* unauthorized admin access

## Application

* SQL injection
* XSS
* CSRF
* insecure deserialization
* malicious file upload
* path traversal

## Cloud

* S3 public exposure
* excessive IAM permissions
* leaked AWS credentials
* insecure presigned URLs

## AI

* prompt injection
* indirect prompt injection
* data leakage
* cross-user context leakage
* malicious document instructions

## Logging

* sensitive information in logs
* tok
