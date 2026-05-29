# 🌱 SIHIYAN — AI Operations Employee for SIHI Seeds

> An AI-powered operations management platform built to automate inventory management, dispatch operations, reporting, analytics, and business workflows for agricultural enterprises.

---

## 🚀 Overview

SIHIYAN is an intelligent internal operations platform developed for **SIHI Seeds**.

Rather than being a traditional inventory management system, SIHIYAN functions as an **AI Operations Employee** — combining AI assistance, voice commands, inventory management, dispatch tracking, OCR automation, analytics, and automated reporting into a single operational ecosystem.

**The goal is simple:**
> Transform operational management from manual work into AI-driven execution.

---

## 🎯 Problem Statement

Managing inventory and dispatch operations manually becomes difficult as a business grows. SIHIYAN was created to automate and streamline workflows previously handled by employees — including:

- Stock Monitoring & Reporting
- Dispatch Coordination
- Distributor Tracking
- Daily Operational Summaries
- Inventory Reporting

---

## ✨ Key Features

### 📦 Inventory Management
- Add, update, delete stock
- Branch-wise inventory tracking
- Stock movement history
- Low stock alerts
- Real-time inventory visibility

### 🚚 Dispatch Management
- Create and track dispatch orders
- Distributor & dealer tracking
- Branch transfer management
- Automatic inventory deduction on dispatch
- Dispatch history and status monitoring

### 🎙️ Voice Assistant
AI-powered voice operations in **3 languages** — English, Kannada & Malayalam.

**Example voice commands:**
```
"Add 500 cotton seed packets to Bengaluru branch"
"Dispatch 50 bags to Telangana"
"Show low inventory"
"Generate today's report"
"Delete tomato seed inventory"
```

**Capabilities:**
- Speech Recognition & Intent Detection
- Action Execution & Database Operations
- Real-time Confirmation & Activity Logging

### 🤖 AI Operations Assistant
An intelligent assistant that understands real business queries:
```
"How much stock is left?"
"Show low inventory products"
"What was dispatched today?"
"Which products move fastest?"
"Generate dispatch report"
```

### 📄 OCR Bill Scanner
- Upload bills and invoices (PNG, JPG, WebP)
- AI-powered text extraction via Gemini Vision API
- Auto-detect product names and quantities
- Auto-fill inventory records — zero manual entry

### 📊 Analytics Dashboard
- Total stock & inventory health overview
- Dispatch analytics & branch performance
- Activity feed & operational KPIs
- Low stock alerts & AI-generated insights

### 📨 Slack Integration
- Automatic daily reports at 8:00 AM IST
- Inventory status & dispatch summaries
- Low stock warnings & branch activity logs
- Business recommendations via AI

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Recharts |
| Backend | Next.js API Routes, Server Actions |
| Database | PostgreSQL, Supabase, Prisma ORM |
| Auth | Clerk Authentication |
| AI | Google Gemini API, Groq API |
| OCR | Tesseract.js, Gemini Vision API |
| Voice | Browser Web Speech API |
| Automation | node-cron, Slack Webhooks |
| Deployment | Vercel |

---

## 🧠 AI Architecture

```
Voice Command
     │
     ▼
Speech Recognition
     │
     ▼
Intent Detection
     │
     ▼
Action Engine
     │
     ▼
Database Operations
     │
     ▼
Activity Logging
     │
     ▼
Dashboard Updates
     │
     ▼
Slack Reports
```

---

## 🏢 Business Structure Supported

```
Head Office (Bengaluru)
│
├── Branch 1
├── Branch 2
├── Branch N
│
├── Distributors
├── Dealers
└── Sales Network
```

---

## 📁 Project Structure

```
SIHIYAN/
│
├── app/
│   ├── dashboard/
│   ├── inventory/
│   ├── dispatch/
│   ├── ai-assistant/
│   ├── reports/
│   ├── settings/
│   └── api/
│
├── components/
│   ├── ui/
│   ├── dashboard/
│   ├── inventory/
│   ├── dispatch/
│   ├── reports/
│   └── voice/
│
├── lib/
│   ├── ai/
│   ├── db/
│   ├── slack/
│   ├── ocr/
│   └── voice/
│
├── prisma/
│   └── schema.prisma
│
├── hooks/
├── utils/
├── public/
└── docs/
```

---

## 🔒 Security Features

- Clerk Authentication & Role-Based Access Control
- Protected API Routes & Server Actions
- Audit Trails & Activity Logs
- Database Validation & Secure Webhook Integration

---

## 📸 Screenshots

> _Add screenshots here — Dashboard, Stock Management, AI Assistant, OCR Scanner, AI Reports, Settings_
> Drag and drop images into this section while editing on GitHub

---

## 📈 Future Roadmap

### Phase 2
- [ ] WhatsApp Integration
- [ ] Distributor Portal
- [ ] Mobile Application
- [ ] Warehouse QR Tracking
- [ ] Predictive Demand Forecasting
- [ ] AI Sales & Procurement Assistant

### Phase 3
- [ ] Autonomous Operations Agent
- [ ] Multi-company Support
- [ ] ERP Integration
- [ ] Supply Chain Optimization
- [ ] AI Decision Engine

---

## 🌍 Vision

SIHIYAN is being developed with a long-term vision of becoming an **AI-powered operational workforce** — enabling businesses to manage inventory, dispatches, analytics, and reporting through natural conversations and intelligent automation.

---

## 👨‍💻 Developed By

**Mohith S** 

Building AI-powered solutions for real-world businesses.


---

## 📄 License

This project is licensed under the MIT License.

---

⭐ **If this project impressed you — drop a star! It means a lot.**
