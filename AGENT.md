# AGENT.md - Apterra Trading App

## Commands
- `npm start` - Start React frontend (port 3000)
- `npm run build` - Build frontend for production
- `npm test` - Run all tests with Jest
- `npm test -- --testNamePattern="TestName"` - Run single test
- Backend: `cd backend && npm start` - Start Express server (port 5000)

## Architecture
- **Frontend**: React 18 + TypeScript + Material-UI + Redux Toolkit
- **Backend**: Express.js + MongoDB + WebSocket server
- **State**: Redux slices (auth, signals, portfolio, market, notifications, ui)
- **Database**: MongoDB with Mongoose
- **Real-time**: WebSocket connections for live data
- **Proxy**: Frontend proxies to backend at localhost:5000

## Code Style
- **Types**: Strict TypeScript, centralized types in `src/types/`
- **Imports**: Material-UI components grouped, absolute imports from `src/`
- **State**: Redux Toolkit slices with typed hooks (`useAppSelector`, `useAppDispatch`)
- **Components**: Functional components with React.FC typing
- **Files**: PascalCase for components, camelCase for utilities
- **Constants**: UPPER_SNAKE_CASE for app constants
- **API**: Axios for HTTP requests, async/await pattern
