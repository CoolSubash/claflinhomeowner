# AI Architecture

The AI layer explains and discusses a user's HomeReady results. It is not
the source of truth for anything: the deterministic scoring engine
(`docs/scoring-methodology.md`) and rule-based recommendation engine
(`docs/recommendations.md`) own the score and the recommendations; the AI
only ever explains them.

```
User -> Next.js chat UI -> FastAPI -> authentication -> authorization
     -> chat session/assessment ownership -> authorized context
     -> AIService -> LLM provider -> response -> store chat message
```

## AIService abstraction

`app/services/ai/base.py` defines the interface the rest of the app
depends on:

```python
class AIService(ABC):
    def generate_response(self, *, system_prompt: str, history: list[ChatTurn], question: str) -> str: ...
```

`app/services/chat.py` imports only `AIService`/`AIServiceError`/`ChatTurn`
from this module - never a provider SDK. Swapping or adding a provider
means adding a class under `app/services/ai/` and updating
`app/api/deps.py::get_ai_service`; nothing else in the app changes.

## Providers

Two implementations exist today, both wrapping the same underlying
Claude model family via the `anthropic` Python SDK's two client classes:

| Provider | Class | Auth |
|---|---|---|
| `bedrock` (default) | `app/services/ai/bedrock_provider.py::BedrockAIService` | AWS SigV4 via boto3's own credential chain - no API key |
| `anthropic` | `app/services/ai/anthropic_provider.py::AnthropicAIService` | `AI_API_KEY`, sent directly to the Anthropic API |

Response validation (`extract_text` - shape/emptiness/length checks) is
shared between them in `app/services/ai/anthropic_common.py`, since both
return the identical Anthropic Messages API response type.

```
AI_PROVIDER=bedrock
AWS_REGION=                                          # required for bedrock
AI_MODEL=anthropic.claude-3-5-sonnet-20241022-v2:0   # Bedrock model id

# or:
AI_PROVIDER=anthropic
AI_API_KEY=                                          # required for anthropic
AI_MODEL=claude-3-5-sonnet-latest                    # direct-API model alias
```

Read via `app/core/config.py::Settings` (the existing pydantic-settings
config, not a new mechanism). Neither an Anthropic API key nor an AWS
credential is ever sent to, or readable by, the frontend - both provider
classes are backend-only, and no route ever returns either.

### Why Bedrock never sees an AWS credential in this codebase

`BedrockAIService` constructs `AnthropicBedrock(aws_region=...)` and
nothing else - no access key, secret key, or session token is ever
passed in, read from `Settings`, or stored on the class. Authentication
is AWS SigV4 request signing, and the signing step (inside the
`anthropic` SDK, via `boto3`) resolves credentials from the standard AWS
chain: environment variables, a shared credentials file, or - in
production - an IAM role attached to the compute the backend runs on.
This means there is no AWS secret anywhere in this application's own
config, logs, or code for a leak to expose in the first place.

### Unconfigured behavior

`get_ai_service()` (`app/api/deps.py`) checks whichever provider is
selected has what it needs - `AWS_REGION` for `bedrock`, `AI_API_KEY` for
`anthropic` - and falls back to a small `_UnconfiguredAIService` if not,
whose `generate_response` raises `AIProviderNotConfigured`. The chat
route turns that into `503 The AI assistant isn't configured on this
server yet` rather than crashing - the whole application, including its
test suite, runs correctly with nothing configured at all.

## Context construction / data minimization

`app/services/chat.py::_build_context` builds exactly this fixed set of
fields, and nothing else, from the session's linked assessment (if any):

- `assessment`: income, monthly_debt, credit_score, savings, down_payment,
  target_home_price, employment_years, location
- `result`: overall_score, readiness_level, scoring_version
- `breakdowns`: category, score, weight, explanation (per category)
- `recommendations`: category, priority, title, description

Never included, by construction (these fields are never read off the row
in the first place, not merely filtered out afterward): password hash,
tokens/JWTs, IP address/user agent, audit logs, roles/permissions, other
users' data, other assessments, other chat sessions. A session with no
linked assessment gets no context object at all - general Q&A mode.

`app/services/ai/system_prompt.py::build_system_prompt` serializes this
context into a clearly delimited "Authorized context" block appended to
the fixed base system prompt - never into a chat message, and never
built from anything the user typed.

## Score / recommendation source of truth

The base system prompt (`system_prompt.py::BASE_SYSTEM_PROMPT`)
explicitly instructs the model that it cannot change, recalculate, or
override the score, and cannot claim to modify a stored recommendation
(it may only explain one). Nothing in `app/services/chat.py` writes to
`readiness_results`, `score_breakdowns`, or `recommendations` - the chat
service only reads them via the same functions the results/recommendations
endpoints use (`readiness_results.get_result_for_assessment`,
`recommendations.get_or_create_recommendations`).

## Authorization / ownership

Every chat endpoint enforces, in order: authentication
(`get_current_user`) -> permission (`require_permission("chat:create")` /
`"chat:read:own"`) -> session ownership (`get_owned_chat_session`) ->
assessment ownership, only if the session is linked to one
(`get_owned_assessment`, checked both at session creation and again when
building context for each message). The AIService is never the
authorization boundary - the model is only ever handed context the
backend already verified the caller owns.

## Prompt injection defenses

Chat message content is untrusted input end to end:

- It is only ever passed as the final `question` turn to the model, never
  concatenated into the system prompt.
- The base system prompt explicitly instructs the model that text inside
  a user message is data, never a new instruction, no matter what it
  claims to be, and to decline requests to ignore its instructions or
  reveal another user's data.
- Backend authorization happens entirely before any context is built or
  the model is called - even a successful injection could only ever see
  what this endpoint already authorized for this user (see "Context
  construction" above). `test_prompt_injection_in_message_does_not_change_authorized_context`
  and `test_ai_context_excludes_other_users_data` in `tests/test_chat.py`
  exercise this.

## Chat persistence and history

`chat_sessions` / `chat_messages` (`docs/database.md`). A session belongs
to exactly one user and optionally one assessment
(`ON DELETE SET NULL`); the client can never set `user_id`, and the
`ChatMessageCreate` schema has no `role` field at all, so a client can
never post as `ASSISTANT` or `SYSTEM` - the backend always decides the
role at insert time.

Only the last `CHAT_HISTORY_LIMIT` (10) prior `USER`/`ASSISTANT` messages
are sent to the model as history, alongside the new question - a simple
bounded-context strategy, not the full lifetime conversation and not a
vector store/RAG system.

`app/services/chat.py::send_message` calls the AIService **before**
persisting either message, then persists both together only on success.
An alternative ordering - store the user's message, then call the AI,
then store the assistant's reply - would read more naturally, but is
equivalent under this app's transaction model: `get_db` commits the whole
request's
transaction only on success and rolls it all back on any exception
(`app/db/connection.py::get_connection`), so a mid-flight AI failure
would roll back an already-inserted user message regardless of ordering.
Calling the AI first simply avoids ever having a persisted user message
with no reply.

## Failure handling

`AnthropicAIService` catches `anthropic.APIError` (covers timeout, rate
limit, invalid key, provider 5xx, and network failure) and re-raises as
`AIServiceError`, logging the real cause server-side and never returning
it to the client. The chat route maps `AIServiceError` to
`503 Sorry, I couldn't generate a response right now. Please try again.`
and `AIProviderNotConfigured` to its own more specific 503. Provider
output is validated before use (`_extract_text`): unexpected shape, no
text blocks, or an empty response are all treated as failures rather than
passed through.

## Rate limiting

`app/services/rate_limit.py::SlidingWindowRateLimiter` - an in-process,
per-user sliding window (20 requests/hour by default), checked before
calling the AI provider on every `POST .../messages`. Deliberately not
distributed: correct for a single backend process (the current
deployment target, `docs/deployment.md`); moving to multiple backend
instances would need a shared store (e.g. Redis) instead of the in-memory
dict this uses today.

## Audit logging

`CHAT_SESSION_CREATED`, `CHAT_SESSION_VIEWED`, `CHAT_MESSAGE_SENT`,
`CHAT_MESSAGE_GENERATED`. Never logs message content, the system prompt,
or any financial figure - only user/session/message ids.

## Testing strategy

`app/services/ai/fake.py::FakeAIService` implements `AIService` with a
configurable canned response or simulated failure, and records every call
(`system_prompt`, `history`, `question`) for assertions. Tests override
the real provider via
`app.dependency_overrides[get_ai_service] = lambda: fake_ai`
(`tests/test_chat.py`) - no real API key or network call is ever required
to run the suite. Coverage includes auth, permission, session/assessment
ownership (including a two-user IDOR sweep), cross-user context
isolation, a prompt-injection attempt, AI failure handling, the
"not configured" path, and rate limiting.

## Not implemented here

No S3/document upload, no OCR, no realtor matching or connection
workflow, no admin dashboard, no vector database/RAG. See
`docs/results.md` and `docs/recommendations.md` for the deterministic
layers this AI layer only ever explains, never modifies.
