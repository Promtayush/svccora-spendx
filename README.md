# 🚀 SVCORA_SpendX - Enterprise Finance Platform

**SVCORA_SpendX** is a modern, open-source expense management and approval workflow solution designed for enterprise teams. Built with cutting-edge technologies, it streamlines financial operations with secure workflows, intuitive interfaces, and comprehensive reporting capabilities.

---

## ✨ Key Features

### 💰 **Expense Management**
- **Smart Claim Submission** - Submit expense claims with receipt uploads and auto-categorization
- **Multi-Currency Support** - Handle international expenses with real-time exchange rates
- **Receipt OCR** - Automatic data extraction from receipt images
- **Expense Categories** - Predefined and custom expense categories for better organization

### 🔄 **Approval Workflows**
- **Multi-Level Approvals** - Configurable approval chains based on amount thresholds
- **Role-Based Access** - Employee, Manager, HR, and Finance role permissions
- **Real-Time Notifications** - Email and in-app notifications for status updates
- **Bulk Operations** - Approve or reject multiple claims simultaneously

### 📊 **Analytics & Reporting**
- **Interactive Dashboard** - Real-time insights into spending patterns and trends
- **Advanced Reporting** - Generate detailed reports by department, category, or time period
- **Budget Tracking** - Monitor departmental budgets and spending limits
- **Export Capabilities** - Download reports in PDF, Excel, and CSV formats

### 🔐 **Security & Compliance**
- **JWT Authentication** - Secure token-based authentication system
- **Data Encryption** - End-to-end encryption for sensitive financial data
- **Audit Trail** - Complete audit logs for compliance and tracking
- **GDPR Compliant** - Data protection and privacy compliance

### 🎨 **User Experience**
- **Responsive Design** - Works seamlessly on desktop, tablet, and mobile devices
- **Dark/Light Theme** - Customizable themes for user preference
- **Intuitive Interface** - Clean, modern UI built with Tailwind CSS
- **Fast Performance** - Optimized for speed with React and Vite

### 🎬 **Frontend Animations**
- **Smooth UI Transitions** - The frontend uses [framer-motion](https://www.framer.com/motion/) for professional, animated transitions and effects throughout the app (e.g., authentication forms, tab switches, and more).

---

## 🛠 Tech Stack

### **Frontend**
- **React** - Modern JavaScript library for building user interfaces
- **TypeScript** - Type-safe development for better code quality
- **Tailwind CSS** - Utility-first CSS framework for rapid UI development
- **Vite** - Fast build tool and development server
- **Radix UI** - Accessible, unstyled UI components
- **Chart.js** - Beautiful, responsive charts and graphs
- **Framer Motion** - Production-ready motion library for React

### **Backend**
- **Node.js** - JavaScript runtime for server-side development
- **Express.js** - Fast, unopinionated web framework
- **PostgreSQL** - Robust, open-source relational database
- **Prisma ORM** - Next-generation database toolkit

### **Security & Utilities**
- **JWT** - JSON Web Tokens for secure authentication
- **bcrypt** - Password hashing for enhanced security
- **Multer** - Middleware for handling file uploads
- **Nodemailer** - Email sending functionality

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+ 
- **PostgreSQL** v13+
- **npm** or **bun**

### 1. Clone the Repository
```bash
git clone https://github.com/svcinfosys/SVCORA_SpendX.git
cd SVCORA_SpendX
```


### 2. Install Dependencies
```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd client && npm install && cd ..

# Install backend dependencies
cd server && npm install && cd ..
```


### 3. Environment Setup
```bash
# Copy environment templates
cp server/.env.example server/.env
cp client/.env.example client/.env
```


### 4. Configure Environment Variables
Edit the .env files with your configuration:

**Backend (/server/.env):**
```env
DATABASE_URL="postgresql://username:password@localhost:5432/svcora_spendx"
JWT_SECRET="your-super-secret-jwt-key-here"
EMAIL_HOST="smtp.gmail.com"
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"
```


**Frontend (/client/.env):**
```env
VITE_API_URL="http://localhost:5000/api"
VITE_APP_NAME="SVCORA_SpendX"
```


### 5. Database Setup
```bash
cd server
npx prisma migrate dev
npx prisma generate
npx prisma db seed
cd ..
```


### 6. Start Development Servers
```bash
# Terminal 1 - Backend (runs on http://localhost:5000)
cd server && npm run dev

# Terminal 2 - Frontend (runs on http://localhost:5173)
cd client && npm run dev
```


### 7. Access the Application
Open your browser and navigate to: **http://localhost:5173**

---

## 📁 Project Structure

```
SVCORA_SpendX/
├── client/                 # React Frontend Application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Application pages
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API service layer
│   │   └── utils/          # Utility functions
│   ├── public/             # Static assets
│   └── package.json
├── server/                 # Express Backend API
│   ├── controllers/        # Business logic controllers
│   ├── routes/             # API route definitions
│   ├── middlewares/        # Custom middleware functions
│   ├── models/             # Database models
│   ├── utils/              # Server utilities
│   └── package.json
├── prisma/                 # Database schema and migrations
│   ├── schema.prisma       # Database schema
│   └── seed.js             # Database seeding
├── docs/                   # Documentation and diagrams
└── README.md
```

---

## 🤝 Contributing

We welcome contributions from the community! Please see our [Contributing Guidelines](./CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch (git checkout -b feature/amazing-feature)
3. Commit your changes (git commit -m 'Add amazing feature')
4. Push to the branch (git push origin feature/amazing-feature)
5. Open a Pull Request

### Code Standards
- Follow the existing code style and conventions
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

---

## 📅 Roadmap
Here are some planned features and improvements for upcoming releases:

- [ ] Mobile app integration for expense submissions
- [ ] AI-powered expense categorization
- [ ] Multi-language support
- [ ] Integration with third-party accounting tools (QuickBooks, Xero)
- [ ] Real-time currency conversion API
- [ ] Enhanced role-based permissions

*Have a feature request? Open an [issue](../../issues) or submit a [pull request](../../pulls)!*

---

## 📖 Documentation

- **[Structure Guide](./STRUCTURE_GUIDE.md)** - Detailed project structure and conventions
- **[Contributing Guide](./CONTRIBUTING.md)** - How to contribute to the project
- **[API Documentation](./docs/api-spec.md)** - Backend API specifications

---

## 🌐 API Overview

Here are some key API endpoints exposed by the backend:

| Method | Endpoint             | Description                        |
|--------|----------------------|------------------------------------|
| GET    | `/api/transactions`  | Fetch all transactions             |
| POST   | `/api/transactions`  | Add a new transaction              |
| PUT    | `/api/transactions/:id` | Update a transaction           |
| DELETE | `/api/transactions/:id` | Delete a transaction           |
| GET    | `/api/users`         | Get user data                      |
| POST   | `/api/auth/login`    | Authenticate a user                |

*Full API details available in the [Documentation](#-documentation) section.*

---

## 🐛 Issue Reporting

Found a bug or have a feature request? Please contact us at info@svcinfosys.in with:

- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Screenshots (if applicable)
- Environment details

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) - see the LICENSE file for details.

---

## 🌟 Support

If you find SVCORA_SpendX helpful, please consider:
- ⭐ Starring the repository
- 🐛 Reporting bugs and issues
- 💡 Suggesting new features
- 🤝 Contributing to the codebase

---

## 📞 Contact

- **Organization**: SVC Infosystems
- **Support Email**: info@svcinfosys.in

---

<div align="center">

**Built with ❤️ for the open-source community**

![React](https://img.shields.io/badge/frontend-react-blue)
![TypeScript](https://img.shields.io/badge/language-typescript-blue)
![Express](https://img.shields.io/badge/backend-express-green)
![Prisma](https://img.shields.io/badge/ORM-prisma-blueviolet)
![PostgreSQL](https://img.shields.io/badge/database-postgresql-blue)
![Tailwind](https://img.shields.io/badge/styling-tailwind-cyan)

</div>

