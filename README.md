# Fortune Teller Backend API

Backend API for the Fortune Teller application built with Node.js, Express, TypeScript, PostgreSQL, and Redis.

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **Authentication**: JWT
- **Validation**: Zod
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest + Supertest

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Redis 7+
- npm or yarn

## Installation

```bash
# Install dependencies
npm install

# Link shared package (for local development)
cd ../fortune-teller-shared && npm link
cd ../fortune-teller-backend && npm link @fortune-teller/shared

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# (Optional) Seed database with demo data
npm run db:seed
```

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Run in development mode (alternative)
npm run start:dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run type-check
```

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm test:watch

# Run tests with coverage
npm test:coverage
```

## Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema changes to database (development)
npm run db:push

# Create a new migration
npm run db:migrate

# Deploy migrations (production)
npm run db:migrate:prod

# Open Prisma Studio (database GUI)
npm run db:studio

# Seed database
npm run db:seed
```

## API Documentation

Once the server is running, access the Swagger documentation at:

```
http://localhost:3000/api-docs
```

## Project Structure

```
src/
├── config/           # Configuration files
│   ├── env.ts       # Environment variables
│   ├── database.ts  # Prisma client setup
│   └── redis.ts     # Redis client and cache service
├── middleware/       # Express middleware
│   ├── auth.middleware.ts
│   ├── error.middleware.ts
│   └── validation.middleware.ts
├── routes/          # API routes
│   ├── auth.routes.ts
│   ├── user.routes.ts
│   ├── fortune.routes.ts
│   └── index.ts
├── services/        # Business logic
│   ├── auth.service.ts
│   ├── user.service.ts
│   └── fortune.service.ts
├── utils/           # Utility functions
│   ├── logger.ts
│   ├── jwt.ts
│   └── response.ts
├── types/           # TypeScript type definitions
├── app.ts           # Express app setup
└── index.ts         # Server entry point

prisma/
├── schema.prisma    # Database schema
└── seed.ts          # Database seeding script

tests/               # Test files
```

## API Endpoints

### Authentication

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout user

### Users

- `GET /api/v1/users/me` - Get current user profile
- `PATCH /api/v1/users/me` - Update user profile
- `DELETE /api/v1/users/me` - Delete user account

### Fortunes

- `POST /api/v1/fortunes` - Create fortune reading
- `GET /api/v1/fortunes` - Get fortune history
- `GET /api/v1/fortunes/:id` - Get fortune by ID
- `DELETE /api/v1/fortunes/:id` - Delete fortune

### Health Check

- `GET /api/v1/health` - Server health check

## Environment Variables

See `.env.example` for all available environment variables.

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT access tokens
- `JWT_REFRESH_SECRET` - Secret key for JWT refresh tokens
- `REDIS_HOST` - Redis server host
- `CORS_ORIGIN` - Allowed CORS origin

## Security Features

- Helmet.js for HTTP headers security
- CORS protection
- Rate limiting
- JWT authentication
- Password hashing with bcryptjs
- Input validation with Zod
- SQL injection prevention with Prisma

## Production Deployment

1. Set `NODE_ENV=production`
2. Configure production database URL
3. Run migrations: `npm run db:migrate:prod`
4. Build the application: `npm run build`
5. Start the server: `npm start`

## Contributing

1. Follow the TypeScript and ESLint configurations
2. Write tests for new features
3. Update API documentation
4. Follow the existing code structure

## License

MIT
