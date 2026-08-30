# Skynova Project Labs

**Innovation • Research • Experimentation • Product Development**

A production-ready full-stack digital platform for Skynova Project Labs — the innovation, R&D, experimentation, prototyping, and product development division of Skynova.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Database](#database)
- [Testing](#testing)
- [Architecture](#architecture)
- [Development Workflow](#development-workflow)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Skynova Project Labs is not a simple portfolio website — it is the complete digital operating platform for a technology innovation company. The platform supports:

- **Public Company Presence** — CMS-driven public website with dynamic content
- **Lead Generation** — Progressive quote forms and project initiation flows
- **CRM & Client Management** — Full customer lifecycle tracking
- **Sales & Quotations** — Professional quotation generation with PDF export
- **Project Management** — Milestones, tasks, and team collaboration
- **R&D Operations** — Research library, experiments, and build logs
- **Product Development** — Product roadmaps, releases, and versioning
- **Inventory Management** — Component tracking, stock movements, and supplier management
- **Financial Operations** — Invoicing, payments, and basic finance tracking
- **Customer Support** — Ticket system and knowledge base
- **Business Automation** — Email, WhatsApp, and workflow automation
- **Analytics & Reporting** — Real-time dashboards and insights

---

## Tech Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| React 18 | UI library |
| TypeScript | Type safety |
| Vite | Build tool & dev server |
| React Router v7 | Client-side routing |
| Tailwind CSS | Utility-first styling |
| Framer Motion | Animations |
| TanStack Query | Server state management |
| React Hook Form | Form handling |
| Zod | Schema validation |
| Lucide React | Icons |

### Backend

| Technology | Purpose |
|------------|---------|
| Python 3.12+ | Runtime |
| FastAPI | Web framework |
| SQLAlchemy 2.x | ORM |
| Alembic | Database migrations |
| PostgreSQL 16+ | Database |
| Pydantic | Data validation |
| JWT | Authentication |
| Passlib + bcrypt | Password hashing |

---

## Project Structure

```
skylabs/
├── frontend/                    # React frontend application
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── layouts/            # Page layouts (Public, Admin)
│   │   ├── pages/              # Route components
│   │   │   ├── admin/          # Admin panel pages
│   │   │   └── *.tsx           # Public pages
│   │   ├── services/           # API service layer
│   │   ├── store/              # State management
│   │   ├── utils/              # Utility functions
│   │   ├── App.tsx             # Router configuration
│   │   └── main.tsx            # Application entry point
│   ├── public/                 # Static assets
│   ├── dist/                   # Production build output
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── backend/                     # FastAPI backend application
│   ├── app/
│   │   ├── api/v1/             # API route handlers
│   │   ├── core/               # Configuration & settings
│   │   ├── models/             # SQLAlchemy models
│   │   ├── schemas/            # Pydantic schemas
│   │   ├── security/           # Auth & RBAC
│   │   ├── services/           # Business logic
│   │   └── main.py             # FastAPI application
│   ├── alembic/                # Database migrations
│   ├── tests/                  # Test suite
│   ├── seed.py                 # Database seeding
│   ├── pyproject.toml          # Python dependencies
│   └── .env.example            # Environment template
│
├── MASTER_PROMPT.txt           # Master build specification
├── phase_prompt.txt            # Phase implementation guide
└── README.md                   # This file
```

---

## Features

### Public Website

- **Home** — Hero section, focus areas, featured projects, innovation pipeline
- **Projects** — Public project showcase with filtering and search
- **Solutions** — Services, technologies, and industries
- **Labs** — Research, experiments, build logs, innovation pipeline
- **Products** — Product catalog with detailed pages
- **Journal** — Blog and thought leadership content
- **About** — Company information, team, partners
- **Collaboration** — Partnership and collaboration forms
- **Get a Quote** — Progressive multi-step quote request form

### Admin Platform

- **Dashboard** — Real-time analytics and key metrics
- **CRM** — Leads, contacts, and pipeline management
- **Projects** — Project lifecycle management with milestones and tasks
- **Quotations** — Create, send, and track quotations
- **Contracts** — Contract management and tracking
- **Research** — Research library and administration
- **Experiments** — Experiment tracking and documentation
- **Products** — Product management with roadmaps and releases
- **Inventory** — Component and stock management
- **Finance** — Invoicing and payment tracking
- **Support** — Ticket system and knowledge base
- **CMS** — Content management for public website
- **Settings** — System configuration and feature flags

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18.x
- **Python** ≥ 3.12
- **PostgreSQL** ≥ 16
- **npm** or **yarn**

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create and activate virtual environment**
   ```bash
   python -m venv .venv
   # Windows
   .venv\Scripts\activate
   # macOS/Linux
   source .venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt.txt
   ```

4. **Configure environment**
   ```bash
   copy .env.example .env
   # Edit .env with your database credentials and settings
   ```

5. **Initialize database**
   ```bash
   alembic upgrade head
   ```

6. **Seed reference data**
   ```bash
   python seed.py
   ```

7. **Start the server**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

   The API will be available at `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

   The frontend will be available at `http://localhost:3000`

---

## Environment Variables

### Backend (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_NAME` | Application name | Project Labs |
| `APP_VERSION` | Application version | 2.0.0 |
| `DEBUG` | Debug mode | true |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `SECRET_KEY` | JWT signing key | - |
| `JWT_REFRESH_SECRET` | Refresh token signing key | - |
| `ALGORITHM` | JWT algorithm | HS256 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token TTL | 30 |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token TTL | 7 |
| `CORS_ORIGINS` | Allowed CORS origins | - |
| `SMTP_HOST` | Email server host | - |
| `STORAGE_TYPE` | File storage type (local/s3) | local |
| `STORAGE_PATH` | Local storage path | ./storage |

See `.env.example` for complete configuration options.

---

## API Documentation

Once the backend is running, access the interactive API documentation:

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

### API Endpoints Overview

| Area | Prefix | Description |
|------|--------|-------------|
| Auth | `/auth` | Authentication & token management |
| Users | `/users` | User administration |
| Leads | `/leads` | CRM lead management |
| Clients | `/clients` | Client records |
| Quotes | `/quote-requests` | Public quote submissions |
| Quotations | `/quotations` | Quotation management |
| Contracts | `/contracts` | Contract management |
| Projects | `/projects` | Project management |
| Research | `/research` | Research library |
| Experiments | `/experiments` | Experiment tracking |
| Products | `/products` | Product management |
| Inventory | `/inventory` | Stock & component management |
| Invoices | `/invoices` | Invoice generation |
| Payments | `/payments` | Payment tracking |
| Support | `/support` | Ticket system |
| CMS | `/cms` | Content management |
| Analytics | `/analytics` | Reporting & insights |

---

## Database

### Schema Management

- **Migrations**: Alembic manages schema changes in `alembic/`
- **Models**: SQLAlchemy models in `app/models/`
- **Current Tables**: 31+ tables across all domains

### Key Entities

- Users, Roles, Permissions
- Leads, Clients, Contacts
- Projects, Milestones, Tasks
- Research, Experiments
- Products, Releases, Roadmaps
- Components, Inventory, Suppliers
- Quotations, Contracts, Invoices
- Knowledge Base, Support Tickets

### Safety Rules

- Never drop the database
- Never delete completed migrations
- Always create new revisions for schema changes
- Verify migrations before applying

---

## Testing

### Backend Tests

```bash
cd backend

# Run all tests
pytest

# Run specific test suite
pytest tests/test_auth.py
pytest tests/test_full_suite.py
pytest tests/test_workflow_pipeline.py
```

### Frontend Tests

```bash
cd frontend

# Type checking
npx tsc --noEmit

# Production build
npm run build
```

### Verification Scripts

```bash
cd backend

# Verify models
python verify_models.py

# Verify migrations
python verify_migration.py

# Verify Phase 1
python verify_phase1.py

# Verify Phase 4
python verify_phase4.py
```

---

## Architecture

### Design Principles

1. **Public/Private Separation** — Strict data boundaries between public and internal APIs
2. **API-First** — Backend owns contracts, frontend consumes them
3. **RBAC** — Role-based access control enforced server-side
4. **Audit Logging** — Immutable audit trail for all critical operations
5. **Feature Flags** — Runtime feature toggling without deployment

### Security

- JWT access tokens with configurable expiry
- Secure refresh token rotation
- Password hashing with bcrypt
- Role-based access control (RBAC)
- Rate limiting on public forms
- CORS protection
- Input validation with Pydantic

### Business Workflows

**Client Lifecycle:**
```
Lead → Requirement → Discovery → Quote → Contract → Project → Delivery → Support
```

**Innovation Lifecycle:**
```
Idea → Research → Experiment → Prototype → MVP → Product → Launch
```

---

## Development Workflow

### Branch Strategy

- `main` — Production-ready code
- `develop` — Integration branch
- `feature/*` — Feature development
- `fix/*` — Bug fixes

### Code Standards

- **Frontend**: ESLint + TypeScript strict mode
- **Backend**: PEP 8 + type hints
- **Commits**: Conventional commits format

### Phase Implementation

The project follows a phased approach:

1. **Phase 1** — Company Foundation (Auth, CRM, Projects, CMS)
2. **Phase 2** — Lab Operations (Research, Experiments, Inventory)
3. **Phase 3** — Business Operations (Contracts, Finance, Support)
4. **Phase 4** — Product Company (Products, Portal, Analytics)

Current Status: **Phase 4 Complete**

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Review Checklist

- [ ] TypeScript/Python types are correct
- [ ] API contracts match frontend expectations
- [ ] Loading/error/empty states handled
- [ ] Responsive design verified
- [ ] Security boundaries respected
- [ ] Tests pass

---

## License

Proprietary - Skynova. All rights reserved.

---

**Built with care by the Skynova Team**
