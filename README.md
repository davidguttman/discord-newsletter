# Start Light Express 🌟

A lightweight, illuminating Express.js starter template that guides you toward production-ready Node.js applications.

## Features ✨

- **Express Server**: Fast and minimalist web framework
- **MongoDB Integration**: With Mongoose ORM and in-memory testing
- **Authentication**: Built-in auth middleware with test environment support
- **Testing**: Comprehensive test setup with tape and supertest
- **Error Handling**: Automatic error catching and formatting
- **Health Checks**: Built-in monitoring endpoint
- **Environment Config**: Easy configuration with dotenv
- **API Example**: Complete CRUD endpoints (Widgets API)

## Quick Start 🚀

1. Clone and install:
```bash
git clone https://github.com/davidguttman/start-light-express.git
cd start-light-express
npm install
```

2. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

3. Configure your environment variables:
```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/
MONGO_DB_NAME=example
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json
AUTHENTIC_SERVER=your-authentic-server
WHITELIST=email1@example.com,email2@example.com
```

4. Start developing:
```bash
npm run dev
```

## Development 💻

The development server will restart on file changes:
```bash
npm run dev
```

## Testing 🧪

Run the test suite:
```bash
npm test
```

Features:
- Tape for lightweight testing
- Supertest for HTTP assertions
- In-memory MongoDB for database tests
- Predictable test authentication

## Production 🌎

1. Set your production environment variables
2. Start the server:
```bash
npm start
```

## Project Structure 📁

```
.
├── api/              # API routes
├── config/           # Configuration
├── lib/             # Shared libraries
├── middleware/      # Express middleware
├── models/          # Mongoose models
├── test/            # Test files
├── .env.example     # Example environment variables
├── package.json     # Project configuration
└── server.js        # Application entry point
```

## API Endpoints 🛣️

- `GET /health` - Health check
- `GET /widgets` - List widgets
- `POST /widgets` - Create widget
- `GET /widgets/:id` - Get widget
- `PUT /widgets/:id` - Update widget
- `DELETE /widgets/:id` - Delete widget

## Code Style 📝

This project follows standard.js style:
- No semicolons
- 2 spaces
- Single quotes
- No var
- Arrow functions
- Object shorthand
- No classes

## Contributing 🤝

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License 📄

MIT © [David Guttman](http://davidguttman.com/) 