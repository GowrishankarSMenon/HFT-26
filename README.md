# 🗺️ Kerala EV Map Analyzer

![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen) ![Next.js](https://img.shields.io/badge/Next.js-14+-black) ![License](https://img.shields.io/badge/license-UNLICENSED-red)

An interactive web application designed to analyze Electric Vehicle (EV) infrastructure readiness and demographic data across Kerala, India. Users can draw custom polygons on a map to define analysis areas, upload CSV data, and visualize key indicators such as population density, income levels, and proximity to charging/petrol stations, facilitating data-driven decision-making for EV deployment.

## ✨ Features

-   📍 **Interactive Map Visualization**: Utilizes [Leaflet.js] to display geographic data of Kerala.
-   ✍️ **Polygon Drawing & Area Analysis**: Allows users to draw custom polygons on the map to define specific regions for detailed analysis.
-   📊 **Real-time Statistics Panel**: Displays computed statistics for the selected polygon, including area, EV infrastructure, vehicle distribution, demographics, and average income.
-   ⚡ **EV Charging Station Overlay**: Toggles visibility of existing EV charging stations within the analyzed polygon.
-   ⛽ **Petrol Station Overlay**: Toggles visibility of petrol stations for comparative analysis of existing infrastructure.
-   🕸️ **Grid-based Analysis**: Visualizes the analyzed area as a grid, applying cost penalties for EV adoption likelihood based on configurable parameters.
-   🌡️ **Heat Map Visualization**: Generates a heat map based on calculated EV adoption likelihood scores within the grid cells.
-   🧍 **Population Density Layer**: Overlays population density data to assess its impact on EV infrastructure planning.
-   ⬆️ **CSV Data Upload**: Enables users to upload custom CSV files for EV data and parameter definitions, integrating external datasets into the analysis.
-   ⬇️ **Data Export**: Provides functionality to export analyzed area statistics in JSON format.
-   🔄 **Client-Side Data Management**: Stores uploaded EV map data in local storage for a seamless user experience.

## 🛠️ Tech Stack

| Category        | Technologies                                        |
|-----------------|-----------------------------------------------------|
| Frontend        | [React], [Next.js] (App Router), [Leaflet.js]       |
| Styling         | [Tailwind CSS], PostCSS                             |
| Utilities       | [JavaScript], PapaParse, `lucide-react`             |
| Development     | [Node.js], [ESLint]                                 |

## 🚀 Quick Start

### Prerequisites

Ensure you have the following installed:

-   Node.js `>= 18.0.0`
-   npm `>= 9.0.0` or yarn `>= 1.22.0` or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/HFT-26/hft.git

# Navigate to project directory
cd hft

# Install dependencies
npm install
# or
yarn install
# or
pnpm install
```

### Running the Application

```bash
# Start the development server
npm run dev

# Create an optimized production build
npm run build

# Start the production server
npm start
```

## 💻 Development

### Available Scripts

The following scripts are available in `package.json`:

| Script          | Description                                    |
|-----------------|------------------------------------------------|
| `npm run dev`   | Starts the Next.js development server.         |
| `npm run build` | Creates an optimized production build of the application. |
| `npm run start` | Starts the Next.js production server.          |
| `npm run lint`  | Runs [ESLint] to check code quality and style. |

### Project Structure

```
.
├── cleaning/           # Scripts and data for initial data preparation
├── public/             # Static assets
├── src/
│   ├── app/            # Next.js App Router pages (e.g., homepage, upload forms)
│   ├── components/     # Reusable React components (UI elements, map view, stats)
│   ├── utils/          # Utility functions and helper modules (map calculations, data processing)
│   └── globals.css     # Global CSS styles
└── package.json        # Project metadata and dependencies
```

## 📡 API Reference

The application interacts with Next.js API Routes for data submission:

| Method | Endpoint               | Description                               | Auth Required |
|--------|------------------------|-------------------------------------------|---------------|
| POST   | `/api/ev-data`         | Uploads and processes EV CSV data for map analysis. | No            |
| POST   | `/api/user-params-csv` | Uploads custom parameter definitions for influencing analysis. | No            |

> [!NOTE]
> The `/api` endpoints are implemented as Next.js API Routes, which handle the backend logic for data processing and storage based on user uploads.

## 🚢 Deployment

This Next.js application can be deployed to platforms like [Vercel] with minimal configuration.

### Deploy to Vercel

1.  Push your code to a Git repository (e.g., GitHub).
2.  Import the project into your [Vercel] dashboard.
3.  [Vercel] automatically detects Next.js projects and configures the build process.
4.  Configure any necessary environment variables directly in the Vercel project settings.
5.  Deploy the application.

## 📄 License

This project is currently unlicensed. Please refer to the repository owner for licensing information.

---

[react]: https://react.dev
[nextjs]: https://nextjs.org
[leaflet.js]: https://leafletjs.com
[tailwind css]: https://tailwindcss.com
[javascript]: https://developer.mozilla.org/en-US/docs/Web/JavaScript
[nodejs]: https://nodejs.org
[eslint]: https://eslint.org
[papaparse]: https://www.papaparse.com
[lucide-react]: https://lucide.dev/
[vercel]: https://vercel.com
