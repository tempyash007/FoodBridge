# FoodBridge

FoodBridge is a comprehensive food donation and waste reduction platform designed to connect food donors (restaurants, supermarkets, catering businesses) with charities and non-profit organizations. The platform streamlines the process of donating surplus food, ensuring it reaches those in need while minimizing food waste.

## Features

- **Donor Dashboard**: Manage food listings, track donations, and view impact statistics.
- **Charity Dashboard**: Browse available food donations, manage requests, and coordinate pickups.
- **Food Listing Management**: Create detailed listings with photos, descriptions, quantity, and expiration dates.
- **Donation Tracking**: Real-time tracking of donation status from creation to pickup.
- **User Authentication**: Secure login and role-based access for donors and charities.
- **Admin Panel**: Platform management and user oversight.

## Tech Stack

### Backend
- **Node.js**: JavaScript runtime for server-side development.
- **Express.js**: Web framework for building APIs.
- **MongoDB**: NoSQL database for data storage.
- **Mongoose**: ODM for MongoDB and Node.js.
- **JWT (JSON Web Tokens)**: For secure authentication and authorization.
- **Bcrypt.js**: For password hashing.
- **Multer**: Middleware for handling file uploads (food photos).
- **Dotenv**: For environment variable management.

### Frontend
- **React.js**: JavaScript library for building user interfaces.
- **Vite**: Build tool and development server.
- **Axios**: Promise-based HTTP client for API requests.
- **React Router DOM**: For client-side routing.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **Lucide React**: Icon library.
- **React Hot Toast**: For displaying notifications.

## Project Structure

```
backend/
├── config/          # Database configuration and environment setup
├── controllers/     # Request handlers for different routes
├── middlewares/     # Custom middleware (authentication, error handling)
├── models/          # Mongoose schemas for database models
├── routes/          # API route definitions
├── uploads/         # Directory for uploaded food images
├── .env             # Environment variables (not in git)
├── package.json     # Backend dependencies and scripts
└── server.js        # Application entry point

frontend/
├── src/
│   ├── components/  # Reusable React components
│   ├── pages/       # Page-level components
│   ├── services/    # API service functions
│   ├── assets/      # Static assets and images
│   ├── App.jsx      # Main application component
│   └── main.jsx     # Application entry point
├── .env             # Environment variables (not in git)
├── package.json     # Frontend dependencies and scripts
└── vite.config.js   # Vite configuration
```

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm (or yarn)
- MongoDB (local or cloud-based like MongoDB Atlas)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd FoodBridge
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the `backend/` directory with the following variables:
   ```env
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   ```

4. **Start the Backend Server**
   ```bash
   npm start
   ```
   The server will start on `http://localhost:5000`.

5. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install
   ```

6. **Configure Environment Variables**
   Create a `.env` file in the `frontend/` directory with the following variable:
   ```env
   VITE_API_URL=http://localhost:5000
   ```

7. **Start the Frontend Server**
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:5173`.

## Usage

### Roles
- **Donor**: Businesses that want to donate surplus food.
- **Charity**: Organizations that want to receive food donations.
- **Admin**: Platform administrator.

### Common Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start the backend server |
| `npm run dev` | Start the frontend development server |
| `npm run build` | Build the frontend for production |
| `npm run lint` | Lint the frontend code |

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.