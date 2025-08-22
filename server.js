require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5555;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/static')));
app.use('/data', express.static(path.join(__dirname, 'data')));

const calculateWalkingRoute = async (start, end) => {
  try {
    const response = await axios.get('https://api.openrouteservice.org/v2/directions/foot-walking', {
      params: {
        start: `${start.longitude},${start.latitude}`,
        end: `${end.longitude},${end.latitude}`,
        format: 'geojson'
      },
      headers: {
        'Authorization': process.env.OPENROUTESERVICE_ACCESS_TOKEN
      }
    });
    
    if (response.data && response.data.features && response.data.features.length > 0) {
      const route = response.data.features[0];
      return {
        coordinates: route.geometry.coordinates,
        distance: route.properties.segments[0].distance,
        duration: route.properties.segments[0].duration
      };
    }
    
    throw new Error('No route found');
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error('OpenRouteService API key is invalid or expired');
    }
    throw new Error(`Route calculation failed: ${error.message}`);
  }
};

app.post('/directions', async (req, res) => {
  try {
    const { start, end } = req.body;
    
    if (!start || !end || !start.longitude || !start.latitude || !end.longitude || !end.latitude) {
      return res.status(400).json({ error: 'Invalid start or end coordinates' });
    }
    
    const route = await calculateWalkingRoute(start, end);
    
    res.json({
      success: true,
      route: route
    });
  } catch (error) {
    console.error('Route calculation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});