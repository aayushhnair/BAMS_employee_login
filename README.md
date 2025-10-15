# BAMS Employee Desktop Client

A cross-platform desktop application built with React and Electron for the BAMS (Bhishma Attendance Monitoring System) employee client.

## Features

### Core Functionality
- 🔐 **Secure Authentication** - Login with username/password and device verification
- 📍 **Location Tracking** - Real-time GPS location monitoring with high accuracy
- 💓 **Heartbeat Monitoring** - Automatic session maintenance with periodic check-ins
- 🔄 **Auto-logout** - Smart session management with multiple triggers
- 📱 **System Tray** - Minimize to tray with easy access controls

### Device Management
- 🆔 **Unique Device ID** - Automatic generation using system UUID or hostname fallback
- 💾 **Persistent Storage** - Secure local storage for device and session data
- 🔒 **Single Instance** - Prevents multiple application instances

### Location Services
- 🎯 **High Accuracy GPS** - HTML5 Geolocation API with 30-second updates
- 📊 **Location Status** - Real-time accuracy monitoring and status indicators
- 🔄 **Auto-refresh** - Continuous location updates for attendance verification

### Security Features
- 🛡️ **HTTPS Only** - All API communications over secure connections
- 🔐 **Session Management** - Secure session handling with automatic cleanup
- 🚪 **Auto-logout Triggers**:
  - Window close events
  - System suspend/sleep
  - Screen lock detection
  - Network disconnection
  - Heartbeat failures

### User Interface
- 🎨 **BAMS Branding** - Professional Red, Yellow, Blue color scheme
- 📱 **Responsive Design** - Works on various screen sizes
- ⚡ **Fast Performance** - Optimized React components
- 🌓 **System Integration** - Native window controls and notifications

## Technology Stack

- **Frontend**: React 18, CSS3, HTML5
- **Desktop**: Electron 26
- **HTTP Client**: Axios
- **Storage**: Electron Store
- **Logging**: Electron Log
- **Build Tool**: Electron Builder
- **Auto-updater**: Electron Updater

## Installation

### Prerequisites
- Node.js 16 or higher
- npm or yarn package manager
- Windows 10/11 (primary target)

### Development Setup

1. **Clone and Install**
   ```bash
   cd bams_emp
   npm install
   ```

2. **Environment Configuration**
   ```bash
   # Copy environment template
   cp .env .env.local
   
   # Edit .env.local with your server settings
   REACT_APP_API_BASE_URL=http://your-bams-server.com
   ```

3. **Start Development**
   ```bash
   # Start React and Electron in development mode
   npm start
   ```

## Usage

### First Launch
1. Application generates unique device ID automatically
2. Device ID is displayed on login screen
3. Enable location services when prompted
4. Contact admin to register device with your user account

### Login Process
1. Enter username/password
2. Verify device ID is displayed correctly
3. Ensure location coordinates are showing
4. Click "Sign In" to authenticate

### Dashboard Features
- **Live Time Display** - Current IST time with seconds
- **Session Information** - Login time and duration
- **Device Details** - Device ID and platform info
- **Location Status** - GPS coordinates and accuracy
- **Quick Actions** - Minimize, hide, settings, logout

### Auto-logout Triggers
The application will automatically log you out when:
- Closing the application window
- System goes to sleep/hibernate
- Screen is locked
- Network connection is lost
- Heartbeat failures exceed threshold

## Configuration

### config.json
Main application configuration file:
```json
{
  "api": {
    "baseUrl": "http://localhost:3000",
    "timeout": 10000
  },
  "app": {
    "heartbeatInterval": 1800000,
    "locationUpdateInterval": 30000
  }
}
```

### Environment Variables
Key environment variables in `.env`:
- `REACT_APP_API_BASE_URL` - BAMS server URL
- `REACT_APP_LOG_LEVEL` - Logging level (debug, info, warn, error)
- `REACT_APP_HEARTBEAT_INTERVAL` - Heartbeat frequency in milliseconds

## Building for Distribution

### Windows Build
```bash
# Build React app and create Windows installer
npm run build

# Create portable version
npm run dist
```

### Output Files
- `release/BAMS Employee Client Setup.exe` - Windows installer
- `release/BAMS Employee Client.exe` - Portable executable

## API Integration

### Login Endpoint
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "employee@company.com",
  "password": "password",
  "deviceId": "generated_device_id",
  "location": {
    "lat": 12.971599,
    "lon": 77.594566,
    "accuracy": 10,
    "ts": "2025-10-10T14:30:00.000Z"
  }
}
```

### Heartbeat Endpoint
```http
POST /api/heartbeat
Content-Type: application/json

{
  "sessionId": "session_id",
  "deviceId": "device_id",
  "location": {
    "lat": 12.971599,
    "lon": 77.594566,
    "accuracy": 5,
    "ts": "2025-10-10T15:00:00.000Z"
  }
}
```

## Troubleshooting

### Common Issues

**Location Not Available**
- Check browser/system location permissions
- Ensure GPS is enabled on device
- Try refreshing location manually

**Login Failures**
- Verify server URL in configuration
- Check network connectivity
- Ensure device is registered with admin

**Heartbeat Issues**
- Check network stability
- Verify server heartbeat endpoint
- Review logs for error details

### Logging
Application logs are available in:
- Console (development mode)
- Electron store (production mode)
- Export logs via Settings menu

## Security Considerations

- All passwords are transmitted over HTTPS only
- Device IDs are stored locally, sessions in memory
- Automatic session cleanup on various system events
- Certificate validation in production builds

## Support

For technical support:
- Check application logs first
- Contact system administrator
- Review server-side logs for API issues

## License

© 2025 Bhishma Solutions. All rights reserved.

---

**BAMS Employee Desktop Client v1.0.0**  
*Bhishma Attendance Monitoring System*