# Commonplace

A latticework of powerful ideas. Commonplace is an interactive, audio-narrated, and cross-linked knowledge exploration platform designed to help users learn in layers and retain concepts using spaced repetition.

## Tech Stack

This project is built using a modern React stack:

- **Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Routing & Server**: [TanStack Router](https://tanstack.com/router) & [TanStack Start](https://tanstack.com/start)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **UI Components**: [Radix UI](https://www.radix-ui.com/) & [shadcn/ui](https://ui.shadcn.com/)

## Getting Started

### Prerequisites

Node 22+ is all CI needs (`package-lock.json` is the canonical lockfile).
[Bun](https://bun.sh/) remains supported for fast local development — its
`bun.lock` is a local artifact and is gitignored.

### Installation

Install the dependencies:

```bash
npm ci        # canonical (what CI runs)
# or, for local dev with Bun:
bun install
```

### Development

To start the local development server:

```bash
bun run dev
```

### Building for Production

To build the application for production:

```bash
bun run build
```

## Structure

- `src/components/`: Reusable UI components (shadcn/ui + custom components like LayerReveal, NodeCard).
- `src/routes/`: Tanstack Router page definitions.
- `src/data/`: Contains `nodes.ts`, the static data layer storing all nodes and edges for the lattice.
- `scripts/`: Helper scripts for data generation and testing.
