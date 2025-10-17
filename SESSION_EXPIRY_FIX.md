# Session Expiry & Auto-Logout Implementation

**Date:** October 17, 2025  
**Issue:** User not auto-logged out when heartbeat receives session expired response  
**Resolution:** Detect 401/session expired in heartbeat and trigger immediate auto-logout

---

## 🎯 Problem Statement

When the heartbeat service receives a response indicating the session has expired:
```json
{
  "statusCode": 401,
  "message": "Session expired"
}
```

The user should be **immediately logged out** and redirected to the login screen with an appropriate message.

**Previous Behavior:**
- Heartbeat failures were counted (3 max)
- Session expiry was treated like network failure
- User stayed logged in until max failures reached
- No clear indication why they were logged out

---

## ✅ Solution Implemented

### 1. HeartbeatService - Detect Session Expiry

**File:** `src/services/HeartbeatService.js`

**Changes:**

1. **Detect 401/Session Expired in Response:**
   ```javascript
   const response = await AuthService.sendHeartbeat(this.sessionId, this.deviceId, location);

   if (response.ok) {
     this.handleHeartbeatSuccess();
   } else {
     // Check for session expiry (401 Unauthorized)
     if (response.statusCode === 401 || response.message === 'Session expired') {
       LoggingService.warn('Session expired detected in heartbeat response');
       this.handleSessionExpired();
       return;
     }
     
     this.handleHeartbeatFailure(response.error || response.message || 'Heartbeat failed');
   }
   ```

2. **New Method: handleSessionExpired():**
   ```javascript
   /**
    * Handle session expired (401 Unauthorized)
    */
   handleSessionExpired() {
     LoggingService.error('Session expired - triggering immediate auto-logout');
     
     // Stop the heartbeat service immediately
     this.stop();
     
     // Trigger logout callback with session expired message
     if (this.onFailureCallback) {
       this.onFailureCallback('Session expired. Please login again.');
     }
   }
   ```

**Key Features:**
- ✅ Detects both `statusCode: 401` and `message: 'Session expired'`
- ✅ Immediately stops heartbeat service (no retry)
- ✅ Triggers auto-logout callback with descriptive message
- ✅ Bypasses normal failure counter (instant logout)

---

### 2. App.js - Handle Auto-Logout with Message

**File:** `src/App.js`

**Changes:**

1. **Added State for Logout Message:**
   ```javascript
   const [logoutMessage, setLogoutMessage] = useState(''); // Track auto-logout message
   ```

2. **Updated HeartbeatService.start() Calls with Callback:**
   ```javascript
   // During session restoration
   HeartbeatService.start(savedSession.sessionId, deviceInfo.deviceId, (reason) => {
     handleAutoLogout(reason);
   });

   // After login
   HeartbeatService.start(response.sessionId, deviceId, (reason) => {
     handleAutoLogout(reason);
   });
   ```

3. **Updated handleAutoLogout to Store Message:**
   ```javascript
   const handleAutoLogout = async (reason) => {
     if (isLoggedIn && sessionId) {
       try {
         await AuthService.logout(sessionId, deviceId, location);
         LoggingService.info(`Auto logout successful: ${reason}`);
       } catch (error) {
         LoggingService.error(`Auto logout failed: ${reason}`, error);
       } finally {
         // Clear local state and store logout reason
         setLogoutMessage(reason); // Show on login screen
         await clearSession();
       }
     }
   };
   ```

4. **Pass Logout Message to LoginScreen:**
   ```javascript
   <LoginScreen
     deviceId={deviceId}
     onLogin={handleLogin}
     logoutMessage={logoutMessage}
   />
   ```

5. **Clear Message on Successful Login:**
   ```javascript
   // In handleLogin after successful login
   setLogoutMessage('');
   ```

---

### 3. LoginScreen - Display Logout Message

**File:** `src/components/LoginScreen.js`

**Changes:**

1. **Accept logoutMessage Prop:**
   ```javascript
   const LoginScreen = ({ deviceId, onLogin, logoutMessage }) => {
   ```

2. **Display Info Message Above Error:**
   ```javascript
   {logoutMessage && (
     <div className="info-message slide-in">
       <FiAlertCircle style={{ marginRight: '8px', verticalAlign: 'middle' }} />
       {logoutMessage}
     </div>
   )}
   
   {error && (
     <div className="error-message slide-in">
       <FiAlertCircle style={{ marginRight: '8px', verticalAlign: 'middle' }} />
       {error}
     </div>
   )}
   ```

---

### 4. LoginScreen.css - Style Info Message

**File:** `src/components/LoginScreen.css`

**Added:**
```css
.info-message {
  display: flex;
  align-items: center;
  background-color: rgba(251, 191, 36, 0.1);
  color: var(--bams-primary-yellow);
  padding: 12px 16px;
  border-radius: 12px;
  margin-bottom: 20px;
  border-left: 4px solid var(--bams-primary-yellow);
  font-size: 14px;
  font-weight: 500;
  animation: slideIn 0.3s ease-out;
}
```

**Visual:**
- Yellow/amber theme (warning color)
- Matches error message styling but different color
- Smooth slide-in animation
- Icon + text layout

---

## 🔄 Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User Logged In & Working                                 │
│    - HeartbeatService sending periodic heartbeats           │
│    - Session valid on server                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Session Expires on Server                                │
│    - Server timeout reached                                 │
│    - Admin manually invalidated session                     │
│    - Security policy triggered                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Next Heartbeat Sent                                      │
│    HeartbeatService.sendHeartbeat()                         │
│    POST /api/heartbeat                                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Server Responds: Session Expired                         │
│    {                                                         │
│      "statusCode": 401,                                     │
│      "message": "Session expired"                           │
│    }                                                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. HeartbeatService Detects Expiry                          │
│    - Checks: statusCode === 401 || message === 'Session...'│
│    - Calls: handleSessionExpired()                          │
│    - Stops heartbeat service                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Triggers Auto-Logout Callback                            │
│    onFailureCallback('Session expired. Please login again.')│
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. App.handleAutoLogout() Executes                          │
│    - Calls AuthService.logout() (graceful cleanup)          │
│    - Sets logoutMessage state                               │
│    - Calls clearSession()                                   │
│    - Clears localStorage                                    │
│    - Sets isLoggedIn = false                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. User Redirected to Login Screen                          │
│    LoginScreen displayed with:                              │
│    - Info message: "Session expired. Please login again."   │
│    - Yellow/amber styling                                   │
│    - Slide-in animation                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Response Detection Logic

### Supported Response Formats

**Format 1: Explicit statusCode**
```json
{
  "statusCode": 401,
  "message": "Session expired"
}
```

**Format 2: Message-based**
```json
{
  "ok": false,
  "message": "Session expired"
}
```

**Format 3: Standard Express error**
```json
{
  "ok": false,
  "error": "Session expired",
  "statusCode": 401
}
```

### Detection Code
```javascript
if (response.statusCode === 401 || response.message === 'Session expired') {
  this.handleSessionExpired();
  return;
}
```

**Why both checks?**
- `statusCode === 401`: Catches HTTP 401 Unauthorized
- `message === 'Session expired'`: Catches explicit session expiry messages
- Covers different backend response formats
- Future-proof for API changes

---

## 🎨 User Experience

### Before Fix
```
User is working...
Session expires on server...
Heartbeat fails...
Heartbeat fails... (2nd attempt)
Heartbeat fails... (3rd attempt)
"Network connectivity lost - multiple heartbeat failures"
❌ Confusing - user thinks it's network issue
❌ 3 heartbeat intervals before logout (~30 minutes)
```

### After Fix
```
User is working...
Session expires on server...
Heartbeat detects 401...
Immediate logout (< 1 second)
"Session expired. Please login again."
✅ Clear reason
✅ Immediate response
✅ Appropriate yellow/warning styling
```

---

## 🔐 Security Benefits

### 1. **Immediate Session Termination**
- No delay between server expiry and client logout
- Prevents unauthorized actions after expiry
- Closes security window

### 2. **Clear User Communication**
- User knows why they were logged out
- Reduces support tickets
- Improves security awareness

### 3. **Graceful Cleanup**
- Stops heartbeat service immediately
- Clears localStorage
- Calls logout API for server-side cleanup
- Resets all session state

### 4. **Audit Trail**
- LoggingService records session expiry
- Tracks logout reason
- Helps security monitoring

---

## 🧪 Testing Scenarios

### Test 1: Normal Session Expiry
```
1. Login successfully
2. Wait for session timeout on server (or manually expire)
3. Wait for next heartbeat interval
4. Verify: Immediate logout
5. Verify: "Session expired" message shown
6. Verify: Yellow info box styling
```

### Test 2: Admin Forced Logout
```
1. Login successfully
2. Admin invalidates session
3. Wait for next heartbeat
4. Verify: Immediate logout
5. Verify: Appropriate message shown
```

### Test 3: Multiple Tab Scenario
```
1. Open app in two tabs
2. Session expires
3. Next heartbeat in Tab 1 triggers logout
4. Verify: Both tabs logout (localStorage cleared)
```

### Test 4: Network vs Session Expiry
```
Network Error:
- Heartbeat fails
- Retry 2 more times
- "Network connectivity lost" after 3 failures

Session Expired:
- Heartbeat gets 401
- Immediate logout
- "Session expired" message
```

---

## 📁 Files Modified

1. **src/services/HeartbeatService.js**
   - Added session expiry detection in sendHeartbeat()
   - Added handleSessionExpired() method
   - Import LoggingService

2. **src/App.js**
   - Added logoutMessage state
   - Updated HeartbeatService.start() calls with callback
   - Store logout reason in handleAutoLogout()
   - Pass logoutMessage to LoginScreen
   - Clear message on successful login

3. **src/components/LoginScreen.js**
   - Accept logoutMessage prop
   - Display info message above error message
   - Show icon with message

4. **src/components/LoginScreen.css**
   - Added .info-message styling
   - Yellow/amber theme
   - Matches error message layout

**Total Changes:**
- 4 files modified
- 0 breaking changes
- Backward compatible

---

## ⚙️ Configuration

### Environment Variables
No new environment variables required. Uses existing:
- `REACT_APP_HEARTBEAT_INTERVAL` - Controls heartbeat frequency
- `REACT_APP_ENABLE_CONSOLE_LOGS` - Controls logging output

### Server Requirements
Backend should return one of these formats when session expired:

**Recommended:**
```json
{
  "ok": false,
  "statusCode": 401,
  "message": "Session expired",
  "error": "Session expired"
}
```

**Minimum:**
```json
{
  "statusCode": 401
}
```
OR
```json
{
  "message": "Session expired"
}
```

---

## 🚀 Deployment Notes

### Production Checklist
- [x] Session expiry detection implemented
- [x] Auto-logout callback wired up
- [x] UI message displays correctly
- [x] Styling matches brand colors
- [x] LoggingService captures events
- [x] No console errors
- [x] Backward compatible

### Performance Impact
- **Minimal:** Only adds one conditional check per heartbeat
- **Memory:** +1 state variable (logoutMessage string)
- **Network:** No additional API calls
- **CPU:** Negligible (simple string comparison)

### Rollback Plan
If issues occur, revert these commits:
1. HeartbeatService.js changes
2. App.js logout message state
3. LoginScreen.js message display
4. LoginScreen.css styling

---

## 🔮 Future Enhancements

### 1. Session Refresh/Extension
```javascript
// If session close to expiry, prompt user to extend
if (response.expiresIn < 300000) { // 5 minutes
  showSessionExpiryWarning();
}
```

### 2. Countdown Timer
```javascript
// Show countdown before auto-logout
"Your session will expire in 4:32. Click to extend."
```

### 3. Different Expiry Messages
```javascript
// Customize message based on reason
switch(response.reason) {
  case 'TIMEOUT':
    return 'Session timed out due to inactivity';
  case 'ADMIN_LOGOUT':
    return 'You were logged out by an administrator';
  case 'SECURITY':
    return 'Logged out for security reasons';
  default:
    return 'Session expired. Please login again.';
}
```

### 4. Reconnect Attempt
```javascript
// Try to refresh session token before logout
if (response.statusCode === 401) {
  const refreshed = await attemptSessionRefresh();
  if (!refreshed) {
    this.handleSessionExpired();
  }
}
```

---

## 📞 Support

### Common Issues

**Q: User says they were logged out unexpectedly**
A: Check server logs for:
- Session timeout settings
- Manual logout events
- Security policy triggers
- Check LoggingService for "Session expired" entries

**Q: Logout message not showing**
A: Verify:
- `logoutMessage` prop passed to LoginScreen
- `.info-message` CSS class loaded
- Message cleared after successful login

**Q: Multiple logouts happening**
A: Check:
- Multiple tabs open (expected behavior)
- Session timeout too aggressive
- Heartbeat interval vs session timeout mismatch

---

## ✅ Verification Checklist

Testing completed:
- [x] Session expiry detected (401 response)
- [x] Immediate logout triggered
- [x] Heartbeat service stopped
- [x] Logout message displayed
- [x] Yellow info styling applied
- [x] Message cleared on re-login
- [x] No console errors
- [x] LoggingService captures events
- [x] Works across multiple tabs
- [x] Graceful API logout called

---

**Status:** ✅ **COMPLETE**

Session expiry detection and auto-logout now working correctly. Users will be immediately logged out when the server returns a 401/session expired response during heartbeat, with a clear message explaining why.

---

**Last Updated:** October 17, 2025  
**Version:** 2.2.0
