import { distance } from '@turf/distance';

export class ShadowSampler {
  constructor(shadeData) {
    this.bounds = shadeData.bounds;
    this.width = shadeData.image.width;
    this.height = shadeData.image.height;
    this.pixels = shadeData.image.pixels; // Direct pixel data (Uint8ClampedArray)
    this.history = []
    
    console.log('Pixel data loaded directly');
    console.log('Pixel data length:', this.pixels.length);
    console.log('Width:', this.width, 'Height:', this.height);
    console.log('Expected length:', this.width * this.height * 4); // RGBA = 4 bytes per pixel
  }

  sampleAt(lat, lon) {
    // Convert lat/lon to normalized coordinates within bounds
    const normalizedX = (lon - this.bounds.west) / (this.bounds.east - this.bounds.west);
    const normalizedY = (this.bounds.north - lat) / (this.bounds.north - this.bounds.south);
    
    // Convert to pixel coordinates
    const pixelX = Math.floor(normalizedX * this.width);
    const pixelY = Math.floor(normalizedY * this.height);
    
    // Check bounds
    if (pixelX < 0 || pixelX >= this.width || pixelY < 0 || pixelY >= this.height) {
      return false; // Out of bounds
    }

    
    // Get pixel index (RGBA = 4 bytes per pixel)
    const pixelIndex = (pixelY * this.width + pixelX) * 4;
    this.history.push(pixelIndex);
    
    // Sample the alpha channel to determine shade (alpha > 128 means shaded)
    const color = this.pixels[pixelIndex];     // Red
    const green = this.pixels[pixelIndex + 1]; // Green
    const blue = this.pixels[pixelIndex + 2];  // Blue
    const value = (color + green + blue) / 3;
    return value < 128;
  }

  sampleAlongLine(latA, lonA, latB, lonB, sampleIntervalMeters = 5) {
    // Calculate distance using Turf.js
    const from = [lonA, latA];
    const to = [lonB, latB];
    const dist = distance(from, to, { units: 'meters' });
    
    // Calculate number of samples for even spacing (every 10 meters)
    const samples = Math.max(1, Math.ceil(dist / sampleIntervalMeters));
    
    let shadeSum = 0;
    let validSamples = 0;

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const lat = latA + t * (latB - latA);
      const lon = lonA + t * (lonB - lonA);
      const isShaded = this.sampleAt(lat, lon);
      if (isShaded !== null) {
        shadeSum += isShaded ? 1 : 0;
        validSamples++;
      }
    }

    if (validSamples > 0) {
      const shadeFraction = shadeSum / validSamples; // 0 = no shade, 1 = full shade
      return shadeFraction;
    } else {
      return 0.0; // No valid samples, assume no shade
    }
  }

  debugConvertToPng() {
    // Create a canvas to draw the pixel data
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d');

    for (const pixelIndex of this.history) {
      this.pixels[pixelIndex] = 255;     // Red
      this.pixels[pixelIndex + 1] = 0;   // Green
      this.pixels[pixelIndex + 2] = 0;   // Blue
      this.pixels[pixelIndex + 3] = 255; // Alpha
    }

    // Ensure pixels is a Uint8ClampedArray for ImageData constructor
    const pixelArray = this.pixels instanceof Uint8ClampedArray 
      ? this.pixels 
      : new Uint8ClampedArray(this.pixels);

    // Create ImageData from pixel array
    const imageData = new ImageData(pixelArray, this.width, this.height);
    ctx.putImageData(imageData, 0, 0);

    // Convert canvas to PNG data URL
    return canvas.toDataURL('image/png');
  }
}