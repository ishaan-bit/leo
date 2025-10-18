# Returning Scan Flow

## Scenario
User scans the same pig QR code again after initial naming.

## Flow
```
[QR Scan]
    ↓
[Recognition] (check local storage / DB)
    ↓
[Personalized Greeting] "Welcome back, [Name]!"
    ↓
[New Micro-Ritual] (daily/weekly rotation)
    ↓
[Memory Reference] (if applicable)
    ↓
[Exit]
```

## Personalization Logic
- **Same day**: "Still here? Let's [ritual]"
- **Next day**: "A new day, [Name]. Try this..."
- **Week+**: "It's been a while! Remember when..."

## Data Strategy
- Store: `{pigId, userName, firstScanDate, scanCount}`
- Privacy: Local-first, optional cloud sync
- Expiry: 90 days inactive → soft reset
