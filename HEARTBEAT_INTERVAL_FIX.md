# Environment-Based Heartbeat Interval Configuration

**Date:** October 17, 2025  
**Issue:** Heartbeat interval hardcoded to 30 minutes, not using environment variable  
**Resolution:** Centralized configuration using environment variables

---

## 🎯 Problem Statement

The heartbeat interval was hardcoded to 30 minutes (1800000ms) throughout the application:
- Dashboard countdown showed "30 minutes"
- App.js calculated next heartbeat using hardcoded value
- HeartbeatService used hardcoded interval
- User instructions mentioned "30 minutes"

**Impact:** 
- Setting `REACT_APP_HEARTBEAT_INTERVAL=600000` (10 minutes) in .env had no effect
- Application ignored environment configuration
- Required code changes to adjust interval

---

## ✅ Solution Implemented

### 1. Created Centralized Configuration File

**File:** `src/config/constants.js`

```javascript
// Get heartbeat interval from environment variable (in milliseconds)
// Default to 30 minutes (1800000ms) if not set
export const HEARTBEAT_INTERVAL_MS = parseInt(
  process.env.REACT_APP_HEARTBEAT_INTERVAL || '1800000',
  10
);

// Convert to seconds for display
export const HEARTBEAT_INTERVAL_SECONDS = Math.floor(HEARTBEAT_INTERVAL_MS / 1000);

// Convert to minutes for display
export const HEARTBEAT_INTERVAL_MINUTES = Math.floor(HEARTBEAT_INTERVAL_MS / 60000);
```

**Features:**
- ✅ Reads from `REACT_APP_HEARTBEAT_INTERVAL` environment variable
- ✅ Provides fallback default (30 minutes) if not set
- ✅ Exports in multiple formats (ms, seconds, minutes)
- ✅ Single source of truth for heartbeat timing

---

### 2. Updated Dashboard Component

**File:** `src/components/Dashboard.js`

**Changes:**
1. **Import constant:**
   ```javascript
   import { HEARTBEAT_INTERVAL_SECONDS } from '../config/constants';
   ```

2. **Initial state:**
   ```javascript
   const [nextHeartbeat, setNextHeartbeat] = useState(HEARTBEAT_INTERVAL_SECONDS);
   ```

3. **Reset countdown:**
   ```javascript
   setNextHeartbeat(HEARTBEAT_INTERVAL_SECONDS); // Instead of 30 * 60
   ```

4. **Dynamic text in instructions:**
   ```javascript
   <p>The system sends a heartbeat every {Math.floor(HEARTBEAT_INTERVAL_SECONDS / 60)} minutes...</p>
   ```

5. **Dynamic text in stat card:**
   ```javascript
   <div className="stat-sub">Every {Math.floor(HEARTBEAT_INTERVAL_SECONDS / 60)} minutes</div>
   ```

---

### 3. Updated App Component

**File:** `src/App.js`

**Changes:**
1. **Import constant:**
   ```javascript
   import { HEARTBEAT_INTERVAL_MS } from './config/constants';
   ```

2. **Session restoration (with server sync):**
   ```javascript
   const remainingMs = HEARTBEAT_INTERVAL_MS - sessionData.session.timeSinceLastHeartbeatMs;
   const nextHeartbeat = new Date(Date.now() + remainingMs);
   ```

3. **Fallback without server data:**
   ```javascript
   const nextHeartbeat = new Date(Date.now() + HEARTBEAT_INTERVAL_MS);
   ```

4. **Initial login heartbeat:**
   ```javascript
   const nextHeartbeat = new Date(Date.now() + HEARTBEAT_INTERVAL_MS);
   ```

---

### 4. Updated Heartbeat Service

**File:** `src/services/HeartbeatService.js`

**Changes:**
1. **Import constant:**
   ```javascript
   import { HEARTBEAT_INTERVAL_MS } from '../config/constants';
   ```

2. **Service interval:**
   ```javascript
   this.interval = HEARTBEAT_INTERVAL_MS; // Instead of hardcoded 1800000
   ```

---

## 📊 Configuration Options

### Environment Variable

**Variable Name:** `REACT_APP_HEARTBEAT_INTERVAL`

**Format:** Milliseconds (integer)

**Examples:**

| Setting | Value | Result |
|---------|-------|--------|
| 5 minutes | `300000` | Heartbeat every 5 minutes |
| 10 minutes | `600000` | Heartbeat every 10 minutes |
| 15 minutes | `900000` | Heartbeat every 15 minutes |
| 30 minutes | `1800000` | Heartbeat every 30 minutes (default) |
| 60 minutes | `3600000` | Heartbeat every 1 hour |

### Setting the Variable

**In .env file:**
```bash
# Heartbeat Configuration
REACT_APP_HEARTBEAT_INTERVAL=600000  # 10 minutes
```

**In .env.development:**
```bash
REACT_APP_HEARTBEAT_INTERVAL=600000  # Shorter for testing
```

**In .env.production:**
```bash
REACT_APP_HEARTBEAT_INTERVAL=1800000  # Standard 30 minutes
```

---

## 🔄 How It Works

### 1. Application Startup

```
Environment Variable → constants.js → Components
       ↓
REACT_APP_HEARTBEAT_INTERVAL=600000
       ↓
HEARTBEAT_INTERVAL_MS = 600000
HEARTBEAT_INTERVAL_SECONDS = 600
HEARTBEAT_INTERVAL_MINUTES = 10
```

### 2. Dashboard Display

```javascript
// Countdown timer shows: "10:00" instead of "30:00"
setNextHeartbeat(HEARTBEAT_INTERVAL_SECONDS); // 600 seconds

// Instructions show: "every 10 minutes" instead of "every 30 minutes"
{Math.floor(HEARTBEAT_INTERVAL_SECONDS / 60)} minutes
```

### 3. Heartbeat Service

```javascript
// Sends heartbeat every 10 minutes instead of 30
setInterval(() => {
  this.sendHeartbeat();
}, HEARTBEAT_INTERVAL_MS); // 600000ms
```

### 4. Server Synchronization

```javascript
// Syncs with server's last heartbeat time
const remainingMs = HEARTBEAT_INTERVAL_MS - timeSinceLastHeartbeatMs;
// If server says last heartbeat was 2 minutes ago (120000ms)
// Remaining = 600000 - 120000 = 480000ms (8 minutes)
```

---

## ✅ Testing Results

### Before Fix
```
.env: REACT_APP_HEARTBEAT_INTERVAL=600000
Dashboard: "Next heartbeat 29:45" ❌
Instructions: "every 30 minutes" ❌
Stat Card: "Every 30 minutes" ❌
Actual interval: 30 minutes ❌
```

### After Fix
```
.env: REACT_APP_HEARTBEAT_INTERVAL=600000
Dashboard: "Next heartbeat 09:45" ✅
Instructions: "every 10 minutes" ✅
Stat Card: "Every 10 minutes" ✅
Actual interval: 10 minutes ✅
```

---

## 📁 Files Modified

1. **NEW:** `src/config/constants.js` - Centralized configuration
2. `src/components/Dashboard.js` - Uses `HEARTBEAT_INTERVAL_SECONDS`
3. `src/App.js` - Uses `HEARTBEAT_INTERVAL_MS`
4. `src/services/HeartbeatService.js` - Uses `HEARTBEAT_INTERVAL_MS`

**Total Changes:**
- 1 new file created
- 3 existing files modified
- 0 breaking changes

---

## 🚀 Benefits

### 1. Configuration Flexibility
- Change interval via environment variable
- No code changes needed
- Different intervals for dev/prod

### 2. Consistency
- Single source of truth
- All components use same value
- No drift between UI and service

### 3. Maintainability
- Centralized configuration
- Easy to understand
- Type-safe with JSDoc

### 4. Testing
- Easy to test with short intervals
- Production can use longer intervals
- No code duplication

---

## 🔮 Future Enhancements

### Dynamic Interval Updates
- Add API endpoint to change interval
- Update without restart
- Per-user or per-role intervals

### Adaptive Intervals
- Shorter intervals during active hours
- Longer intervals during idle periods
- Battery-aware intervals (mobile)

### Configuration UI
- Admin panel to set interval
- Real-time preview
- Validation and limits

---

## 📝 Usage Examples

### Development (Faster Testing)
```bash
# .env.development
REACT_APP_HEARTBEAT_INTERVAL=300000  # 5 minutes
```

### Staging (Medium Testing)
```bash
# .env.staging
REACT_APP_HEARTBEAT_INTERVAL=900000  # 15 minutes
```

### Production (Standard)
```bash
# .env.production
REACT_APP_HEARTBEAT_INTERVAL=1800000  # 30 minutes
```

### High-Security Environment (Frequent)
```bash
# .env.production.secure
REACT_APP_HEARTBEAT_INTERVAL=600000  # 10 minutes
```

---

## ⚠️ Important Notes

### 1. Restart Required
After changing `.env` file, **restart the development server**:
```bash
# Stop current server (Ctrl+C)
npm start
```

### 2. Build Time Configuration
Environment variables are embedded at **build time**, not runtime:
```bash
# Build creates static files with configured values
npm run build
```

### 3. Minimum Interval
Consider setting a minimum interval to prevent server overload:
```javascript
// In constants.js
const MIN_INTERVAL = 60000; // 1 minute minimum
export const HEARTBEAT_INTERVAL_MS = Math.max(
  MIN_INTERVAL,
  parseInt(process.env.REACT_APP_HEARTBEAT_INTERVAL || '1800000', 10)
);
```

### 4. Server Coordination
Ensure backend expects the same interval:
```javascript
// Backend should use same interval for session validation
const SESSION_TIMEOUT = HEARTBEAT_INTERVAL * 2; // Grace period
```

---

## 🐛 Troubleshooting

### Issue: UI still shows 30 minutes

**Solution:**
1. Check `.env` file exists in project root
2. Restart development server completely
3. Clear browser cache (Ctrl+Shift+R)
4. Verify variable name: `REACT_APP_HEARTBEAT_INTERVAL` (exact)

### Issue: Countdown resets incorrectly

**Solution:**
- Ensure server sends `timeSinceLastHeartbeatMs` field
- Check console logs for sync messages
- Verify calculation: `interval - timeSinceLast`

### Issue: Different interval in production

**Solution:**
- Check which `.env` file is used for build
- Verify `REACT_APP_` prefix exists
- Rebuild application: `npm run build`

---

## ✅ Verification Checklist

- [x] Created `src/config/constants.js`
- [x] Updated Dashboard.js imports and usage
- [x] Updated App.js imports and usage
- [x] Updated HeartbeatService.js imports and usage
- [x] Updated instruction text to be dynamic
- [x] Updated stat card text to be dynamic
- [x] Tested with REACT_APP_HEARTBEAT_INTERVAL=600000
- [x] Verified countdown shows correct time
- [x] Verified text shows correct interval
- [x] No console errors
- [x] Compilation successful

---

## 📞 Support

**Configuration Issues:**
- Check `.env` file syntax
- Ensure no spaces around `=`
- Use milliseconds, not seconds

**Technical Support:**
- Email: support@bhishmasolutions.com
- Documentation: README.md

---

**Status:** ✅ **COMPLETE**

The heartbeat interval is now fully configurable via the `REACT_APP_HEARTBEAT_INTERVAL` environment variable. All UI elements and service intervals update automatically based on this configuration.

---

**Last Updated:** October 17, 2025  
**Version:** 2.1.0
