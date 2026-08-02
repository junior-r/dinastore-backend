# CLAUDE.md - Backend Development Guidelines

## 1. Backend Project Overview
This project is the backend API and services layer for an advanced e-commerce and print-on-demand platform for a custom clothing brand. It handles product catalogs, secure transactions, real-time messaging, custom image processing, gamification rules, and AI agent integrations.

## 2. Tech Stack & Environment
*   **Framework:** NestJS
*   **Language:** Strict TypeScript
*   **Runtime:** Node.js (latest LTS - v22+)
*   **Package Manager:** pnpm
*   **Database:** PostgreSQL
*   **ORM:** Prisma ORM
*   **Caching & Messaging:** Redis
*   **Real-time:** Socket.io (NestJS WebSockets module)

## 3. Architecture & Design Patterns
*   **Domain-Driven Design (DDD) / Hexagonal Architecture:** The codebase must be strictly organized by business domains (e.g., Catalog, Orders, Users, Customizations). Keep business logic decoupled from HTTP controllers and database adapters.
*   **CQRS (Command Query Responsibility Segregation):** Use the NestJS CQRS module to separate read operations (e.g., high-volume product catalog queries) from complex write operations (e.g., processing an order or handling a design upload).
*   **Repository Pattern:** Abstract all Prisma ORM calls through repositories so the domain layer remains agnostic of the database implementation.
*   **Clean Code:** Enforce strict typing, centralized error handling (exception filters), and strict environment variable validation (using Zod or Joi).

## 4. Core Domains & Features
*   **E-commerce Catalog & Orders:** Manage products, inventory, shopping cart validation, and secure payment processing (integrations for Stripe/MercadoPago).
*   **Customization Engine:** Handle user-uploaded designs, store them securely, and manage the logic for injecting/watermarking the mandatory store logo onto the designs before sending them to fulfillment.
*   **Gamification & Promotions:** Manage quiz states, validate answers, and handle the distribution of promotional codes and access to limited-edition drops.
*   **Real-Time Communications:** Manage WebSockets for live order tracking updates and the real-time customer support chat.
*   **Creative AI Agent Service:** Act as a bridge/proxy connecting the frontend to an AI instance. During development, this will interface with a local AI API (e.g., a local Ollama instance running Qwen) to assist users with design prompts.

## 5. Initial Task & Instructions for Claude
*Act as a Lead Backend Developer and Software Architect.*

Your immediate task is to set up the backend architecture. Do not write the core business logic yet. Provide the following:
1.  **Project Initialization:** The exact CLI commands to bootstrap the NestJS project using `pnpm` and install the necessary core dependencies (Prisma, Redis, CQRS, WebSockets).
2.  **Infrastructure Config:** A `docker-compose.yml` file to spin up PostgreSQL and Redis for local development.
3.  **Folder Structure:** Propose the ideal monorepo or standard NestJS folder structure enforcing DDD and CQRS.
4.  **DDD Example:** Provide a skeleton code example of a single domain (e.g., `Orders` or `Products`), showing the separation of Controllers, Command/Query Handlers, Services, and Repositories.

Wait for my confirmation after delivering this setup plan before proceeding to code the actual endpoints and business logic.
