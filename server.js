const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5555;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/static')));

app.get('/api/manhattan-geojson', (req, res) => {
  try {
    const geojsonPath = path.join(__dirname, 'data/manhattan.geojson');
    
    if (!fs.existsSync(geojsonPath)) {
      return res.status(404).json({ error: 'manhattan.geojson file not found' });
    }

    const geojsonData = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
    
    res.json({ 
      success: true, 
      data: geojsonData,
      message: 'Manhattan GeoJSON loaded successfully' 
    });
  } catch (error) {
    console.error('Error loading GeoJSON:', error);
    res.status(500).json({ error: 'Failed to load manhattan.geojson file' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Looking for manhattan.geojson in: ${path.join(__dirname, 'manhattan.geojson')}`);
});