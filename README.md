# Apterra Trading App - Enterprise ML System

A sophisticated, enterprise-grade machine learning trading system with real-time data ingestion, advanced feature engineering, multi-stage ensemble models, and production-ready MLOps infrastructure.

## 🚀 Enterprise ML Architecture

### Core Components

1. **Real-Time Data Ingestion Layer**
   - WebSocket connections for tick-level market data
   - REST polling fallback with circuit breakers
   - Redis TimeSeries for high-frequency data buffering
   - Multi-resolution data storage and compression

2. **Advanced Feature Engineering**
   - Streaming feature factory with 100+ predictive features
   - Learned statistical moments (LSM) embeddings
   - Graph neural network (GNN) cross-asset embeddings
   - Real-time technical indicators and volatility features

3. **Multi-Stage Ensemble ML System**
   - Meta-learning (MAML) for quick adaptation
   - Deep sequence models (Bi-LSTM, TCN, Attention)
   - Transformer modules for medium-term forecasts
   - Causal inference layers for counterfactual analysis
   - Graph neural networks for cross-asset dependencies
   - Multi-agent reinforcement learning overlay

4. **Real-Time Inference Pipeline**
   - Sub-200ms latency prediction endpoints
   - Circuit breakers and fallback mechanisms
   - Caching and performance monitoring
   - ONNX/TensorRT optimizations

5. **Production MLOps Infrastructure**
   - Continuous learning with drift detection
   - Automated backtesting and shadow deploys
   - Explainability tools (SHAP, integrated gradients)
   - Risk controls and position sizing
   - Monitoring dashboards and alerting

## 🛠️ Installation

### Prerequisites
- Node.js 18+
- MongoDB
- Redis (for TimeSeries data)
- API keys for market data providers

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd apterra-trading-app
   ```

2. **Install dependencies**
   ```bash
   # Backend dependencies
   cd backend
   npm install
   
   # Frontend dependencies
   cd ../src
   npm install
   ```

3. **Environment Configuration**
   Create `.env` file in the backend directory:
   ```env
   MONGO_URI=your_mongodb_connection_string
   REDIS_URL=redis://localhost:6379
   ALPHA_VANTAGE_KEY=your_alpha_vantage_key
   TWELVE_DATA_KEY=your_twelve_data_key
   JWT_SECRET=your_jwt_secret
   NODE_ENV=development
   ```

4. **Start Redis**
   ```bash
   # Install Redis if not already installed
   # macOS: brew install redis
   # Ubuntu: sudo apt-get install redis-server
   
   # Start Redis server
   redis-server
   ```

5. **Start the application**
   ```bash
   # Start backend
   cd backend
   npm start
   
   # Start frontend (in another terminal)
   cd src
   npm start
   ```

## 📊 API Endpoints

### Enterprise ML System
- `GET /api/enterprise-ml/status` - System health and status
- `GET /api/enterprise-ml/analytics` - Performance analytics
- `GET /api/health` - Overall system health

### Trading Data
- `GET /api/market/data` - Market data
- `GET /api/portfolio` - Portfolio information
- `GET /api/signals` - Trading signals

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Market Data   │    │   Sentiment     │    │   Order Book    │
│   Providers     │    │   APIs          │    │   Data          │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │   Real-Time Data          │
                    │   Ingestion Layer         │
                    │   (WebSocket + REST)      │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   Redis TimeSeries        │
                    │   (Multi-resolution)      │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   Streaming Feature       │
                    │   Factory (100+ features) │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   Multi-Stage Ensemble    │
                    │   ML System               │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   Real-Time Inference     │
                    │   Service (<200ms)        │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   Signal Generation       │
                    │   & Risk Management       │
                    └───────────────────────────┘
```

## 🔧 Configuration

### Redis Configuration
The system uses Redis TimeSeries for high-frequency data storage:
- Multi-resolution data retention
- Automatic compression
- Correlation calculations
- Data cleanup policies

### ML Model Configuration
- Feature window sizes
- Model ensemble weights
- Confidence thresholds
- Risk management parameters

## 📈 Performance Metrics

- **Latency**: <200ms inference time
- **Throughput**: 1000+ predictions/second
- **Accuracy**: Continuous monitoring and drift detection
- **Uptime**: 99.9% with circuit breakers and fallbacks

## 🔒 Security & Risk Management

- JWT authentication
- Rate limiting
- Input validation
- Risk controls and position sizing
- Circuit breakers for model failures

## 🚀 Deployment

### Production Deployment
1. Set up MongoDB Atlas cluster
2. Configure Redis Cloud or self-hosted Redis
3. Set environment variables for production
4. Use PM2 or Docker for process management
5. Set up monitoring and alerting

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d
```

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📞 Support

For support and questions, please contact the development team or create an issue in the repository.

# Supabase & Upstash Redis Integration

## 1. Install Packages

### Backend (Node.js)
```
npm install @supabase/supabase-js @upstash/redis
```

### Frontend (React)
```
npm install @supabase/supabase-js
```

## 2. Environment Variables

Add these to your `.env` files:

### Backend `.env`
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
UPSTASH_REDIS_REST_URL=https://your-upstash-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

### Frontend `.env`
```
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

## 3. Supabase Table Setup

Create a `signals` table in Supabase:
```sql
create table public.signals (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  type text not null,
  confidence float,
  entry_price float,
  target_price float,
  stop_loss float,
  created_at timestamp with time zone default now()
);
```

## 4. Usage
- Backend publishes signals to Supabase and Redis.
- Redis subscriber broadcasts signals to WebSocket clients.
- Frontend listens for real-time updates from Supabase.

See `backend/services/` and `src/components/signals/SupabaseSignalListener.tsx` for code examples.
