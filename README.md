# 🍲 FoodBridge

> An automated surplus food management and distribution platform connecting donors, recipient organizations, and volunteers to minimize food waste.

---

## 📌 Overview

**FoodBridge** is a full-stack platform designed to facilitate seamless food donation workflows. It connects food donors (restaurants, caterers, households) with recipient organizations (shelters, NGOs) and logistics volunteers to ensure safe and timely delivery of surplus food.

---

## ✨ Key System Features

* **Multi-Role Portals:**
  * **Donor Dashboard:** Create, update, and manage surplus food listings with quantity, category, and expiry window details.
  * **Recipient Portal:** Search, filter, and claim available food donations in real time based on location and requirements.
  * **Volunteer Dashboard:** Track assigned food delivery tasks, status updates, and pickup/drop-off logistics.
  * **Admin Panel:** Comprehensive system management, user verification, category configuration, and analytics.

* **Security & Authentication:**
  * Role-Based Access Control (RBAC) supporting Donors, Recipients, Volunteers, and Admins.
  * Secure JSON Web Token (JWT) authentication, password hashing (`bcryptjs`), and cookie handling.
  * Input validation using `express-validator` and password recovery workflows via `nodemailer`.

* **Async Notifications & Cache:**
  * Automated email notifications and background event queuing powered by **Redis** (`ioredis`) and **Nodemailer**.

* **Comprehensive Testing & Quality Assurance:**
  * Backend API integration tests using **Jest** and **Supertest**.
  * Frontend component unit tests using **Vitest** and **React Testing Library**.

---

## 🛠 Tech Stack

### **Frontend**
* **Framework:** React 19 (Vite, TypeScript)
* **Routing & UI:** React Router DOM v7, Lucide React icons
* **Testing:** Vitest, React Testing Library, JSDOM

### **Backend**
* **Runtime & Framework:** Node.js, Express 5
* **Database:** PostgreSQL (`pg`)
* **Caching & Queue:** Redis (`ioredis`)
* **Auth & Security:** JWT (`jsonwebtoken`), Bcryptjs, Express Validator
* **Email Service:** Nodemailer
* **Testing:** Jest, Supertest

---

## 📁 Project Structure

```text
FoodBridge/
├── backend/                # Node.js + Express + PostgreSQL API
│   ├── src/
│   │   ├── config/         # Database & Redis configurations
│   │   ├── controllers/    # Handlers for Auth, Donor, Recipient, Admin, Volunteer
│   │   ├── middleware/     # Auth, RBAC, and error handling middleware
│   │   ├── routes/         # Express API route definitions
│   │   └── services/       # Email & notification services
│   └── tests/              # Jest API integration tests
│
└── frontend/               # React 19 + Vite + TypeScript Client
    ├── src/
    │   ├── pages/          # Donor, Recipient, Volunteer, Admin & Auth pages
    │   ├── components/     # Reusable UI components
    │   └── services/       # API call handlers
    └── tests/              # Vitest component tests
