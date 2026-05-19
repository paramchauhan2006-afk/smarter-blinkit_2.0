# Smarter Blinkit

Smarter Blinkit is a next-generation "Smart Marketplace" connecting buyers and local sellers using AI-driven context and semantic intelligence.

## 🏗 Architecture

### 1. Frontend (`/frontend`)
- **Tech Stack**: React.js, Tailwind CSS
- **Purpose**: Responsive client application with dynamic routing, global state, and custom UI components.

### 2. Backend (`/backend`)
- **Tech Stack**: Node.js, Express.js
- **Purpose**: Core business logic, authentication, ordering system, and data management.
- **Databases**: 
  - MongoDB (Primary Datastore for Users, Orders, Inventory)
  - Neo4j (Graph Database for Product Relationships & Recommendations)

### 3. AI Services (`/ai-services`)
- **Tech Stack**: Python, OpenCV, Hugging Face (Transformers)
- **Purpose**: Microservice for Face ID authentication, semantic search embeddings, and computer vision tasks.

## 🚀 Roadmap

### Stage 1: The Foundation
- Dual-Login with Face ID
- Intent-based Semantic Search
- Geo-location checking
- Barcode inventory updates
- Dummy checkout using Razorpay Test flow

### Stage 2: The Automator
- AI "Recipe" Agent for automated multi-item cart filling
- Similar Items/Bought-With Graph recommendations (Neo4j)

### Stage 3: The Orchestrator
- Smart Cart Splitting across multiple local shops
- Real-time Live Storeboard for fast-selling products

### Bonus Stage: God Mode
- "Money Map" geospatial visualization
- Market Basket Analysis model (Hugging Face) for Smart Product Pairing

## 🛠 Getting Started

Ensure you have Node.js, Python, MongoDB, and Neo4j installed.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/paramchauhan2006-afk/smarter-blinkit_2.0.git
   ```
2. **Install Backend Dependencies:**
   ```bash
   cd backend
   npm install
   ```
3. **Install Frontend Dependencies:**
   ```bash
   cd frontend
   npm install
   ```
4. **Install AI Services Dependencies:**
   ```bash
   cd ai-services
   pip install -r requirements.txt
   ```
5. **Environment Setup:**
   Copy the `.env` file to each service or use the global `.env` provided and fill in the required credentials.
