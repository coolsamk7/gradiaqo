# Gradiqo :D

Gradiqo is a modern learning operating system designed for students, developers, professionals, and lifelong learners to manage structured learning, study consistency, deep work, problem solving, and long-term skill growth.

The platform combines:

* structured learning paths
* Pomodoro-based study sessions
* streak tracking
* analytics
* progress visualization
* workflow orchestration
* event-driven architecture
* future AI-powered learning insights

Gradiqo is being built as a scalable, event-driven platform focused on productivity, consistency, and measurable growth.

---

# Vision

Most productivity and learning platforms focus only on tasks or note-taking.

Gradiqo focuses on:

* learning systems
* habit consistency
* deep work
* measurable progress
* skill mastery
* long-term growth tracking

The goal is to help users:

* stay consistent
* build strong learning habits
* improve focus
* manage learning journeys
* track progress visually
* develop long-term mastery

---

# Core Features

## Learning Paths

Create structured learning journeys with:

* modules
* topics
* problems
* milestones
* progress tracking

Users can organize:

* DSA preparation
* AI/ML learning
* interview preparation
* college subjects
* certifications
* skill roadmaps

---

## Pomodoro Study Sessions

Track focused study sessions using Pomodoro-based workflows.

Features include:

* active study sessions
* session timers
* focus blocks
* study duration tracking
* topic-level sessions
* module-level sessions
* problem-level sessions
* interruption handling

---

## Daily Activity System

Gradiqo aggregates user activity into a daily activity engine.

Tracked metrics include:

* total study time
* completed sessions
* problems solved
* deep work minutes
* focus blocks
* heatmap intensity
* streak qualification

---

## Streak Engine

A flexible streak system designed around real learning activity instead of simple login tracking.

Features:

* study-time based streaks
* configurable streak qualification rules
* longest streak tracking
* streak recovery handling
* consistency analytics
* learning heatmaps

---

## Problem Solving

Users can manage coding and learning problems with:

* difficulty tracking
* solution notes
* approach notes
* external links
* starred problems
* source tracking
* solved history

Supported sources include:

* LeetCode
* Codeforces
* HackerRank
* custom problems

---

## Analytics & Insights

Gradiqo provides detailed learning analytics including:

* study consistency
* time distribution
* learning heatmaps
* focus trends
* streak history
* completion analytics
* productivity insights

---

## Tags System

Users can organize sessions and learning content using tags.

Examples:

* Revision
* Deep Work
* DSA
* React
* Backend
* System Design
* AI
* Interview Prep

---

# Architecture

Gradiqo is designed as a scalable distributed system.

## Current Stack

### Frontend

* React
* TypeScript
* Tailwind CSS
* Radix UI
* React Router

### Backend

* NestJS
* TypeScript
* PostgreSQL
* Redis
* TypeORM

### Event & Workflow System

* Inngest
* Event-driven workflows
* Async orchestration
* Background processing

### Infrastructure

* Docker
* Docker Compose
* Monorepo architecture

---

# System Design

Gradiqo follows an event-driven architecture.

## Services

### API Server

Responsible for:

* authentication
* business APIs
* persistence
* event emission

### Henchman

Background orchestration service responsible for:

* analytics aggregation
* streak processing
* notifications
* workflow execution
* asynchronous processing

### Inngest Workflows

Used for:

* event orchestration
* retries
* cron workflows
* delayed jobs
* distributed processing

---

# Event-Driven Workflow Examples

Gradiqo uses workflows such as:

```text
study-session.completed
streak.updated
problem.solved
notification.send
heatmap.updated
```

These workflows help keep the platform scalable and decoupled.

---

# Monorepo Structure

```bash
apps/
  api/
  henchman/
  web/

packages/
  nestjs-inngest/
  shared/
```

---

# AI Roadmap

Future AI features include:

* personalized learning recommendations
* adaptive learning plans
* AI-generated study summaries
* intelligent revision suggestions
* burnout detection
* productivity analysis
* focus pattern insights
* AI learning assistant

---

# Future Features

Planned features include:

* collaborative study rooms
* realtime study sessions
* gamification
* leaderboards
* mentor dashboards
* mobile applications
* browser extension
* VSCode extension
* AI productivity coach
* spaced repetition engine
* smart reminders

---

# Target Users

Gradiqo is designed for:

* college students
* Class X/XII students
* software engineers
* competitive exam learners
* self-learners
* developers
* professionals
* interview candidates

---

# Why Gradiqo?

Most productivity tools are either:

* too generic
* task-focused only
* not designed for learning systems
* not optimized for deep work

Gradiqo combines:

* productivity
* structured learning
* analytics
* consistency tracking
* deep work systems
* workflow orchestration

into a single platform.

---

# Development Philosophy

Gradiqo focuses on:

* scalability
* modular architecture
* event-driven systems
* developer experience
* clean UI/UX
* long-term extensibility
* observable workflows
* modern distributed architecture

---

# Open Source & Ecosystem

Gradiqo also aims to contribute tooling back to the ecosystem, including:

* NestJS workflow integrations
* orchestration tooling
* developer utilities
* analytics systems

---

# Current Status

Gradiqo is currently under active development.

Core systems being developed:

* learning paths
* study sessions
* streak engine
* analytics engine
* workflow orchestration
* event-driven infrastructure

---

# License

MIT License

---

# Mission

Gradiqo aims to become a powerful operating system for learning, focus, consistency, and long-term personal growth.

