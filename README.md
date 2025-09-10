# Ultra Cycling Faff Time Analyser

Ultra Cycling faff time Analyser - Find where you spent time stopped instead of riding. A web-based tool for analyzing Garmin FIT files, built with the official Garmin FIT SDK. This application allows you to upload FIT files and analyze activity data including route visualization, slow/stopped periods detection, and detailed activity metrics.

Use the tool live [https://fafftime.com](https://fafftime.com)

> 🤖 This project was generated with the help of [Claude Code](https://claude.ai/code)

## Screenshot

![Fafftime Analyser Screenshot](src/screenshot.png)

## Features

- **FIT File Parsing**: Upload and parse Garmin FIT files using the official SDK
- **Activity Analysis**: View start/end times, duration, distance, and moving time
- **Slow Period Detection**: Identify periods where speed drops below 1 m/s for configurable durations
- **Interactive Maps**: Visualize activity routes using Leaflet.js
- **Mini Maps**: View specific locations of slow periods with detailed maps
- **Customizable Thresholds**: Adjust slow period detection from 5 minutes to over 1 hour

## Getting Started

### Prerequisites

- Node.js (for npm package management)
- Modern web browser with ES6 module support

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```
   
   Or for development with file watching:
   ```bash
   npm run dev
   ```

3. The application will automatically open in your browser at `http://localhost:3000`

### Building for Production

To create a production build:
```bash
npm run build
```

The built files will be in the `dist` directory.

## Usage

1. **Upload FIT File**: Click "Select FIT File" and choose a .fit file from your device
2. **Parse Data**: Click "Parse FIT File" to analyze the activity
3. **View Results**: The application will display:
   - Activity start/end times and duration
   - Total distance (in km and miles)
   - Interactive map showing the complete route
   - Slow/stopped periods with customizable duration thresholds
4. **Adjust Analysis**: Use the dropdown to change slow period detection thresholds
5. **Explore Maps**: 
   - Main map shows the complete activity route
   - Mini maps show specific locations where slow periods occurred
   - All maps support zooming, panning, and interaction

## Technical Details

### Architecture

- **Frontend**: TypeScript with ES6 modules and type safety
- **Build System**: Webpack 5 with TypeScript support and development server
- **FIT Parsing**: Garmin FIT SDK (@garmin/fitsdk)
- **Mapping**: Leaflet.js with OpenStreetMap tiles and TypeScript types
- **File Processing**: HTML5 File API with ArrayBuffer handling
- **Testing**: Vitest with TypeScript integration

### Key Components

- `src/main.ts`: Core application logic and FIT data processing (TypeScript)
- `src/analysis.ts`: Data analysis functions with strong typing
- `src/utils.ts`: Utility functions and DOM helpers
- `src/types.ts`: TypeScript type definitions for FIT data and application state
- `src/index.html`: User interface and module configuration
- `src/styles.css`: Application styling
- `webpack.config.js`: Webpack build configuration with TypeScript support
- `tsconfig.json`: TypeScript configuration
- `package.json`: NPM dependencies and project configuration

### Data Processing

The application processes FIT files to extract:
- Session messages (`sessionMesgs`) for activity metadata
- Record messages (`recordMesgs`) for GPS and speed data
- GPS coordinates converted from semicircles to decimal degrees
- Speed analysis for detecting slow/stopped periods

## Browser Compatibility

This application uses TypeScript compiled to ES6 modules and modern JavaScript features. Webpack handles module bundling and TypeScript compilation for broad compatibility with modern browsers:
- Chrome 88+
- Firefox 78+
- Safari 14+
- Edge 88+

## Dependencies

### Runtime Dependencies
- `@garmin/fitsdk`: Official Garmin FIT SDK for parsing FIT files

### Development Dependencies
- `typescript`: TypeScript compiler and language support
- `ts-loader`: Webpack TypeScript loader
- `@types/leaflet`: TypeScript type definitions for Leaflet
- `webpack`: Module bundler and development server
- `html-webpack-plugin`: HTML template processing
- `copy-webpack-plugin`: Asset copying
- `css-loader` & `style-loader`: CSS processing
- `vitest`: Modern testing framework with TypeScript support
- `jsdom`: DOM environment for testing
- `leaflet`: Interactive mapping library (loaded via CDN)

## License

MIT License

This project uses the Garmin FIT SDK, which is licensed under the Flexible and Interoperable Data Transfer (FIT) Protocol License.
