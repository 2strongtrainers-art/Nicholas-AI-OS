# Terrain Environmental GIS

A free, browser-based field and environmental GIS workspace designed to reduce the handoff friction between Avenza Maps, Google Earth Pro, ArcGIS, and QGIS.

## MVP capabilities

- Mobile-first interactive mapping for iPhone and desktop
- Presets for Placer County and Plymouth / Amador County, while supporting any location
- Import GeoJSON, KML, KMZ, GPX, CSV point data, and zipped Shapefiles
- Draw/edit/delete points, lines, polygons, and rectangles
- Automatic polygon acreage and line-mile calculations
- OpenStreetMap and USGS topo/imagery basemaps
- USGS point elevation query
- CAL FIRE public environmental/fire overlays with graceful failure handling
- Feature name/description editor
- Browser-local autosave (no account or database required)
- Export GeoJSON, KML, GPX and a project summary

## Cost model

The MVP is intentionally static and client-side. It requires no paid API key, database, server, or subscription. Hosting can be done with GitHub Pages from a public repository on GitHub Free.

## Privacy and professional-use note

Project files are processed locally in the browser in this MVP. Public basemap, elevation and agency layer requests are made to third-party public services. Users should verify source metadata, coordinate systems, legal boundaries, environmental constraints, and official agency determinations before relying on the app for regulatory, engineering, legal, emergency-response, or permitting decisions.
