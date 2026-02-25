# GitHub Copilot Instructions

## Project Overview
This is a full-stack e-commerce management system with:
- **Backend**: Node.js + Express + MongoDB (`backend/`)
- **Frontend**: React 18 + Vite + Tailwind CSS (`frontend/`)

## Task Tracking Rule
**After every task or feature is completed, add an entry to [`TASKS.md`](../TASKS.md) at the project root.**

Each entry should include:
- Date (YYYY-MM-DD) & Time (24 hr format)
- Short description of what was done
- Files changed

## Code Style Guidelines

### Frontend
- Use `glass-modal`, `GlassCard`, `Badge`, `Button`, `Modal`, `DataTable` from `frontend/src/components/ui/index.jsx`
- Tailwind utility classes only — no inline styles
- Keep Tailwind classes ordered: layout → spacing → color → typography → states
- All monetary values prefixed with `₹`
- Use `toast.success` / `toast.error` for user feedback

### Backend
- All controllers follow `asyncHandler(async (req, res) => { ... })` pattern
- Use `ApiResponse` and `ApiError` helpers from `src/utils/`
- Mongoose models live in `src/models/org/` (tenant data) and `src/models/superadmin/` (platform data)
- Multi-tenancy: org DB connection comes from `req.orgDb`
- Use `counterService` for auto-increment SKUs and order numbers

### General
- Never delete data without a `ConfirmDialog`
- Parent products: do NOT show cost price, base price, or stock fields — those belong to variants
- Variant rows in forms must show an image thumbnail as the first column
