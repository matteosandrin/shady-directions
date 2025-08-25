# Shade Map

A React and Node.js application that provides real-time building shadow visualization and shade-aware walking directions for Manhattan. Combining 3D building visualization with sophisticated solar calculations and routing algorithms.

## Quick Start

### Prerequisites
- Node.js (v14+)
- Mapbox account for map tiles
- OpenRouteService account (optional, has local routing fallback)

### Installation

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd shade-map
   npm run install-all
   ```

2. **Set up environment variables**:
   Create a `.env` file in the root directory:
   ```bash
   REACT_APP_MAPBOX_ACCESS_TOKEN=your_mapbox_token_here
   OPENROUTESERVICE_ACCESS_TOKEN=your_openrouteservice_token_here  # Optional
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

   The application will be available at http://localhost:3000

## Architecture

### Backend (Node.js/Express)
- **Express Server**: RESTful API on port 5555
- **Routing Engine**: Custom A* pathfinding with OpenStreetMap data
- **Fallback Routing**: Local routing using `manhattan_ways.json` when OpenRouteService is unavailable
- **Static Serving**: Serves GeoJSON data and production React build

### Frontend (React)
- **React 18**: Modern functional components with hooks
- **Mapbox GL JS**: 3D building rendering and map interactions  
- **WebGL Shaders**: Custom shadow rendering system
- **Spatial Analysis**: Turf.js and polygon-clipping for geometric operations
- **Solar Calculations**: SunCalc library for accurate sun positioning

### Available Scripts
```bash
npm run install-all    # Install dependencies for both server and client
npm run dev            # Start both server and client in development
npm run server         # Start only the Express server with nodemon  
npm run client         # Start only the React development server
npm run build          # Build React client for production
npm start              # Start production server
```

## API Endpoints

- `GET /data/manhattan.geojson` - Building footprint data
- `POST /directions` - Walking route calculation
  - Body: `{ start: {lat, lng}, end: {lat, lng} }`
  - Returns: Route with distance, duration, and coordinates