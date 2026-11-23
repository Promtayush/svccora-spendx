# 🚀 SVCORA_SpendX Folder Structure Guide

Welcome to the SVCORA_SpendX codebase! This guide helps contributors understand the folder structure and where to place different parts of the code to keep the project clean, modular, and scalable.

---

## 🧾 About SVCORA_SpendX

**SVCORA_SpendX** is a full-stack web application designed to simplify and streamline financial claim submissions and processing. Built with **React** (frontend), **Express** (backend), and **Prisma** (ORM), the system is modular, scalable, and developer-friendly.

---

## 📑 Table of Contents

- [Project Structure Overview](#project-structure-overview)
- [Frontend - client](#frontend---client)
- [Backend - server](#backend---server)
- [Prisma ORM - prisma](#prisma-orm---prisma)
- [Documentation - docs](#documentation---docs)
- [Naming Conventions](#naming-conventions)
- [Tips for Contributors](#tips-for-contributors)
- [Feature Integration Flow Example](#feature-integration-flow-example)

---

## Project Structure Overview

SVCORA_SpendX/  
├── client/                 # React Frontend  
├── server/                 # Express Backend  
├── docs/                   # Architecture diagrams, DB schema, API specs  
├── prisma/                 # Prisma ORM setup  
├── README.md  
└── STRUCTURE_GUIDE.md

---

### 📁 Folder Overview

| Folder     | Description                        |
| ---------- | ---------------------------------- |
| `client/`  | React frontend code                |
| `server/`  | Express backend code               |
| `prisma/`  | ORM schema and seed files          |
| `docs/`    | Diagrams, UI screenshots, API docs |
| `uploads/` | Uploaded files (e.g., receipts)    |

---

## Frontend - client/

client/  
├── public/                 # Static assets  
├── src/  
│ ├── assets/               # Images, logos, icons  
│ ├── components/           # Reusable UI components  
│ ├── context/              # Global state (e.g., AuthContext)  
│ ├── hooks/                # Custom hooks (e.g., useForm, useAuth)  
│ ├── layouts/              # Page layouts (e.g., DashboardLayout)  
│ ├── pages/                # Route-based pages (e.g., Login.jsx)  
│ ├── routes/               # React Router routes  
│ ├── services/             # API call logic (Axios)  
│ ├── utils/                # Utility functions (e.g., formatDate)  
│ ├── App.jsx               # App entry point  
│ └── main.jsx              # ReactDOM render logic

---

### 🗂️ Where to Place Things:

- 📄 **New page?** ➤ `pages/`
- ♻️ **Reusable UI block?** ➤ `components/`
- 🧠 **Global state?** ➤ `context/`
- 🌐 **API call logic?** ➤ `services/`
- 🎨 **Styling?** ➤ Use **Tailwind** classes inline

---

## Backend - server/

server/  
├── config/                 # Environment configs (DB, JWT, etc.)  
├── controllers/            # Logic for routes (e.g., claimController.js)  
├── middlewares/            # Auth, error handling, role checking  
├── models/                 # ORM models (e.g., user, claim)  
├── routes/                 # Express routers (e.g., /api/claims.js)  
├── utils/                  # Helpers (e.g., mailer.js)  
├── uploads/                # Uploaded receipts  
└── index.js                # App entry point

---

### 🗂️ Where to Place Things:

- 🧠 **Business logic?** ➤ `controllers/`
- 🛣️ **New API endpoint?** ➤ `routes/`
- 🔐 **JWT/Auth check?** ➤ `middlewares/`
- 📁 **File upload handler?** ➤ `utils/` or `middlewares/`

---

## Prisma ORM - prisma/

prisma/  
├── schema.prisma             # Database schema  
└── seed.js                   # Seed data (roles, users, etc.)

> Run `npx prisma migrate dev` to sync schema changes  
> Run `node prisma/seed.js` to populate initial data

---

## Documentation - docs/

docs/  
├── architecture.png           # App architecture  
├── db-schema.png              # ER diagram / schema  
└── api-spec.md                # Full API spec

---

### 📝 Recommended Additions:

- ✅ ER diagrams
- ✅ API specifications
- ✅ UI screenshots
- ✅ Flowcharts (contribution, request lifecycle)

---

## Naming Conventions

| Type       | Format        | Example            |
| ---------- | ------------- | ------------------ |
| Components | `PascalCase`  | `LoginForm.jsx`    |
| Functions  | `camelCase`   | `handleSubmit()`   |
| Files      | `kebab-case`  | `user-routes.js`   |
| Variables  | `camelCase`   | `userEmail`        |
| Constants  | `UPPER_SNAKE` | `MAX_CLAIM_AMOUNT` |

> 🔁 Consistency = Clean Code

---

## Tips for Contributors

✅ Keep features modular  
✅ Keep routes clean, move logic to controllers  
✅ Use `context/` and `hooks/` for global state  
✅ Validate input on both client and server  
✅ Write meaningful commit messages  
✅ Ask questions via Issues/Discussions if unsure

---

## Feature Integration Flow Example

Let’s say you're adding a **"Travel Reimbursement"** feature.

### 1. Backend

- ➕ Create a new route: `server/routes/travelRoutes.js`
- 🧠 Add controller: `server/controllers/travelController.js`
- 🧩 Update model if needed: `server/models/claim.js`

### 2. Frontend

- 🖼️ Create page: `client/pages/TravelForm.jsx`
- 🔗 Add API logic: `client/services/travelService.js`
- 📐 Use layout: `client/layouts/DashboardLayout.jsx`
- ♻️ Use reusable inputs: `client/components/InputField.jsx`

---

## 📎 Related Files

- [README.md](./README.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## 🏁 Happy Contributing! 🚀

---

![React](https://img.shields.io/badge/frontend-react-blue)
![Express](https://img.shields.io/badge/backend-express-green)
![Prisma](https://img.shields.io/badge/ORM-prisma-blueviolet)
![Node.js](https://img.shields.io/badge/runtime-node.js-brightgreen)
