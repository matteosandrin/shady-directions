# Shade Map - 3D Building Viewer

A React and Node.js application that displays GeoJSON building data as 3D shapes on an OpenStreetMap-based map.

## Features

- 3D building visualization using Deck.gl and React Map GL
- Reads GeoJSON data from `manhattan.geojson` file
- Extracts building height/elevation data from GeoJSON properties
- Fullscreen interactive map interface
- Hover to see building information

## Setup

1. Install dependencies:
```bash
npm run install-all
```

2. Place your `manhattan.geojson` file in the project root directory

3. Start the development server:
```bash
npm run dev
```

The application will be available at http://localhost:3000

## GeoJSON Format

The application expects a GeoJSON file with building polygons. Building heights can be specified in the properties using any of these field names:
- `height`
- `HEIGHT`
- `elevation`  
- `ELEVATION`

Example GeoJSON structure:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-74.0059, 40.7128],
          [-74.0058, 40.7128],
          [-74.0058, 40.7129],
          [-74.0059, 40.7129],
          [-74.0059, 40.7128]
        ]]
      },
      "properties": {
        "height": 45,
        "name": "Sample Building"
      }
    }
  ]
}
```

## Controls

- Mouse drag: Rotate the map
- Mouse wheel: Zoom in/out
- Shift + mouse drag: Pan the map
- Hover over buildings: Display height information