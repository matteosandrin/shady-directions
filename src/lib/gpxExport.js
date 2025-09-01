export const exportRouteAsGPX = (routeData, routeStats) => {
  if (!routeData || !routeData.coordinates || routeData.coordinates.length === 0) {
    throw new Error('No route data available for export');
  }

  const now = new Date().toISOString();
  const routeName = `Shade Route ${new Date().toLocaleDateString()}`;
  
  let gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Shade Map" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${routeName}</name>
    <desc>Walking route optimized for shade</desc>
    <time>${now}</time>`;

  if (routeStats) {
    gpxContent += `
    <keywords>shade,walking,${routeStats.shadedPercentage}% shaded</keywords>`;
  }

  gpxContent += `
  </metadata>
  <trk>
    <name>${routeName}</name>`;

  if (routeStats) {
    gpxContent += `
    <desc>Distance: ${(routeData.distance / 1000).toFixed(2)} km, Duration: ${Math.round(routeData.duration / 60)} min, Shaded: ${routeStats.shadedPercentage}%, Sunny: ${routeStats.sunnyPercentage}%</desc>`;
  }

  gpxContent += `
    <trkseg>`;

  // Add each coordinate as a track point
  routeData.coordinates.forEach((coord, index) => {
    const [lng, lat] = coord;
    gpxContent += `
      <trkpt lat="${lat}" lon="${lng}">
        <time>${new Date(Date.now() + index * 1000).toISOString()}</time>
      </trkpt>`;
  });

  gpxContent += `
    </trkseg>
  </trk>
</gpx>`;

  // Create and trigger download
  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shade-route-${new Date().toISOString().split('T')[0]}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};