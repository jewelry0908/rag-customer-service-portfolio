# RAG Customer Service Demo

A portfolio project demonstrating the product design and implementation of a retrieval-augmented customer service experience.

## Overview

The project uses simulated, public-safe course-service content to explore a complete RAG workflow: knowledge-base preparation, retrieval, response generation, evaluation, and deployment.

It is designed as a transparent demonstration rather than a production customer-service system. It does not process real orders, payments, or personal information.

## Current Status

The static chat experience and API foundation are in place. The retrieval pipeline is being developed with a vector database and Qwen models.

## Planned Architecture

```text
GitHub Pages -> Cloudflare Worker -> Qwen API + Supabase pgvector
```

## Project Scope

- RAG-based answers for simulated course and learning-service questions
- Evidence-driven evaluation of answer quality and retrieval results
- A portfolio-ready web experience that can be embedded in a personal site

## Repository Structure

```text
frontend/   Static chat interface
worker/     Backend API foundation
knowledge/  Public-safe simulated knowledge-base materials
```

## Security and Documentation

No credentials, real user data, or production business information are stored in this repository. Detailed implementation notes, evaluation records, and learning reflections are maintained separately.
