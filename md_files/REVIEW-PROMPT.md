REVIEW-PROMPT:

You are a senior software architect and code reviewer.
Your task is to perform a deep, professional audit of the entire project repository.

Analyze all code, architecture, configuration, dependencies, and infrastructure. Assume this project will run in production 'Chrome Extension Web Store' at scale, so the review must be strict and thorough.

Objectives

Create a PROJECT_REVIEW.md file that contains a complete technical review and an actionable improvement plan.

What to Analyze

Architecture

Project structure and separation of concerns

Frontend / Backend boundaries

Modularity and maintainability

Design patterns and anti-patterns

Code Quality

Code readability and consistency

Duplicated code across modules/apps

Dead code and unused dependencies

Naming conventions

Error handling

Performance

Potential bottlenecks

Expensive operations

Inefficient queries or loops

Client/server performance risks

Memory & Resource Usage

Possible memory leaks

Large in-memory objects

Inefficient caching

Resource cleanup

Database

Schema design

Indexing

Query efficiency

Data integrity

Migration safety

API Design

REST/endpoint structure

Validation and error handling

Rate limiting strategy

Security best practices

Security

Authentication & authorization

Secrets management

Injection risks

Data exposure

Dependency vulnerabilities

Infrastructure & Deployment

Hosting configuration

Environment variables

CI/CD readiness

Logging and monitoring

Scalability

How the system behaves with many users

Database scaling concerns

Serverless limits

Background jobs / queues

Reliability

Failure handling

Retry strategies

Timeouts

Idempotency

Testing

Unit tests

Integration tests

Coverage gaps

Suggested test improvements

DX (Developer Experience)

Documentation quality

Setup complexity

Developer tooling

Output Requirements

Create a PROJECT_REVIEW.md file with the following structure:

# Project Technical Review

## Executive Summary
High-level overview of project health.

## Critical Issues (Fix Immediately)
- [ ] Issue description
- Impact
- Recommended fix

## Major Improvements
- [ ] Improvement task
- Why it matters
- Suggested implementation

## Performance Risks
- [ ] Issue
- Impact
- Optimization strategy

## Security Risks
- [ ] Issue
- Recommended mitigation

## Architecture Improvements
- [ ] Refactor suggestion

## Code Quality Improvements
- [ ] Refactor tasks

## Scalability Improvements
- [ ] Recommended change

## Testing Improvements
- [ ] Missing tests to add

## Quick Wins
Small fixes with high impact.

## Long-Term Improvements
Future architectural enhancements.
Important Rules

Be strict and critical, not polite.

Prefer clear actionable tasks instead of vague advice.

Focus on real engineering improvements, not cosmetic changes.

Assume the project must support production scale.

Highlight technical debt and architectural risks.

Your goal is to produce a clear engineering task list that a team could immediately start implementing.