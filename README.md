# ECharts Custom Bar (Multi-Series) for Power BI

Custom Power BI visual using Apache ECharts to render multi-series bar charts.

## Buckets
- Category: 1+ columns (supports multiple; labels concatenated)
- Legend: Optional grouping field
- Series: One or more measures (or columns if numeric); with Legend, produces one series per Legend (× per measure if multiple)

## Commands
- Package visual:

```powershell
pbiviz package -v --no-stats
```

- Optional dev server (may require accepting a self-signed cert):

```powershell
pbiviz start -p 8090
```

> If you see a certificate error on Windows where `pwsh` is not recognized, packaging still works. You can test with Power BI Desktop's Developer Visual by importing the `.pbiviz` from `dist`.

## Notes
- Formatting: basic data labels toggle and data color are supported.
- Supports legend-based grouping and multiple measures in Series.
