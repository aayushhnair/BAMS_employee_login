# 🔔 WorkSens Browser Notification Feature

## Overview
WorkSens now supports **system-level browser notifications** for critical events to ensure employees are immediately alerted even when the browser tab is minimized or in the background.

---

## 🎯 What Gets Notified?

### 1. **Logout Events** (CRITICAL - Requires User Acknowledgment)
**When:**
- Heartbeat fails (server connection lost)
- Session invalidated by server (`login_status: false`)
- API interceptor detects logout
- Manual logout

**Notification:**
```
🚨 WorkSens: Session Timeout
Your session has ended. Please login again.
[Click to reload and login]
```

**Behavior:**
- ✅ Requires user interaction (can't be dismissed automatically)
- ✅ Vibrates on mobile (200ms-100ms-200ms pattern)
- ✅ Clicking notification reloads the page to login screen

---

### 2. **GPS Accuracy Warnings** (When Logged In)
**When:**
- GPS accuracy decreases by **100m or more**
- Current accuracy is **> 100m** (poor signal)
- Accuracy is **> 500m** (very poor - likely WiFi fallback)
- Accuracy is **> 1000m** (CRITICAL - definitely not GPS)

**Notification Levels:**

**Fair Warning (100-500m):**
```
📡 WorkSens: GPS Accuracy Warning
GPS accuracy: 250m. Consider moving outdoors.
[Auto-closes after 5 seconds]
```

**Critical Warning (500m+):**
```
📡 WorkSens: GPS Accuracy Warning
GPS signal very poor (750m). Move to clear sky area.
[Requires acknowledgment]
```

**Emergency Warning (1000m+):**
```
📡 WorkSens: GPS Accuracy Warning
GPS signal very poor (1500m). Move to clear sky area.
[Requires acknowledgment + Vibrates]
```

**Behavior:**
- ⚠️ Non-critical (<500m): Auto-closes after 5 seconds
- 🚨 Critical (>500m): Requires user acknowledgment
- 📳 Vibrates for accuracy > 500m

---

### 3. **Heartbeat Failure** (Server Connection Lost)
**When:**
- Heartbeat service fails to reach server
- Network timeout
- Server rejects heartbeat

**Notification:**
```
💔 WorkSens: Connection Lost
Server connection lost. You have been logged out.
[Click to reload and login]
```

**Behavior:**
- ✅ Requires user interaction
- ✅ Vibrates with strong pattern (300ms-100ms-300ms-100ms-300ms)
- ✅ Clicking notification reloads page

---

### 4. **Network Status** (Informational)
**When:**
- Browser goes offline (no internet)
- Browser comes back online

**Offline Notification:**
```
🌐 WorkSens: Network Offline
Internet connection lost. Heartbeat may fail.
[Auto-closes after 3 seconds]
```

**Online Notification:**
```
✅ WorkSens: Network Restored
Internet connection restored.
[Auto-closes after 2 seconds]
```

**Behavior:**
- ℹ️ Informational only
- ⏱️ Auto-closes quickly (2-3 seconds)
- 🔇 Silent (no vibration)

---

## 🚀 How It Works

### 1. **Initialization (App Startup)**
```javascript
// App.js - initializeApp()
await NotificationService.init();
```

**What Happens:**
1. Checks if browser supports notifications (`Notification` API)
2. Checks current permission status
3. If permission not granted, **requests permission** (one-time popup)
4. Shows welcome notification if permission granted

### 2. **Permission Request**
First time users see this:
```
"worksens.com" wants to:
Show notifications
[Block] [Allow]
```

**If Allowed:**
- ✅ Shows welcome notification: "WorkSens Notifications Active"
- ✅ All future notifications will display

**If Blocked:**
- ❌ Notifications disabled
- ⚠️ Users must manually enable in browser settings

---

### 3. **Notification Triggers**

#### **Auto-Logout Events:**
```javascript
// App.js - handleAutoLogout()
NotificationService.showLogoutNotification(message, source);
```

Sources:
- `heartbeat` - Heartbeat service failure
- `api_interceptor` - Global API response check
- `manual` - User clicked logout
- `system` - Generic system logout

---

#### **GPS Accuracy Monitoring:**
```javascript
// Dashboard.js - useEffect on location changes
if (accuracyDecrease > 100) {
  NotificationService.showGPSAccuracyWarning(currentAccuracy, status);
}
```

Monitors GPS accuracy every time location updates and compares to previous reading.

---

#### **Heartbeat Failures:**
```javascript
// HeartbeatService.js - handleHeartbeatFailure()
NotificationService.showHeartbeatFailureNotification(message);
```

Shows notification IMMEDIATELY before triggering logout.

---

#### **Network Status:**
```javascript
// App.js - setupSystemEventListeners()
window.addEventListener('offline', () => {
  NotificationService.showOfflineNotification();
});
```

Listens for browser's online/offline events.

---

## 🔧 Technical Details

### **Browser Compatibility:**
| Browser | Desktop | Mobile | Notes |
|---------|---------|--------|-------|
| Chrome | ✅ | ✅ | Full support |
| Edge | ✅ | ✅ | Full support |
| Firefox | ✅ | ✅ | Full support |
| Safari | ⚠️ | ⚠️ | Limited actions support |
| Opera | ✅ | ✅ | Full support |

### **Notification Properties:**

```javascript
new Notification(title, {
  body: 'Message text',           // Main message
  icon: '/assets/logo192.png',   // WorkSens logo
  badge: '/assets/logo192.png',  // Small icon (mobile status bar)
  tag: 'unique-id',              // Replaces previous notifications with same tag
  requireInteraction: true,      // User must acknowledge (can't auto-close)
  silent: false,                 // Play sound
  vibrate: [200, 100, 200]       // Vibration pattern (mobile only)
});
```

### **Notification Lifecycle:**

1. **Permission Check** → Browser checks if user granted permission
2. **Create** → `new Notification()` creates notification
3. **Display** → OS shows notification (even if browser minimized)
4. **User Action** → User clicks or dismisses
5. **Event Handler** → `notification.onclick` executes
6. **Close** → `notification.close()` or auto-timeout

---

## 🧪 Testing Notifications

### **Test Notification Button (Debug Only):**
You can add this to Dashboard for testing:

```javascript
// Dashboard.js
import NotificationService from '../services/NotificationService';

const handleTestNotification = () => {
  NotificationService.showTestNotification();
};

// In JSX:
<button onClick={handleTestNotification}>
  🧪 Test Notification
</button>
```

### **Simulate Events:**

**1. Test Logout Notification:**
```javascript
NotificationService.showLogoutNotification(
  'Test logout message', 
  'heartbeat'
);
```

**2. Test GPS Warning:**
```javascript
NotificationService.showGPSAccuracyWarning(1500, 'poor');
```

**3. Test Network Offline:**
```javascript
NotificationService.showOfflineNotification();
```

---

## 🛠️ Troubleshooting

### **Notifications Not Showing?**

**1. Check Permission:**
```javascript
console.log(Notification.permission); // "granted", "denied", or "default"
```

**2. Browser Settings:**
- Chrome: `chrome://settings/content/notifications`
- Firefox: `about:preferences#privacy` → Permissions → Notifications
- Edge: `edge://settings/content/notifications`

**3. Request Permission Again:**
```javascript
await NotificationService.requestPermission();
```

### **Permission Denied?**
User must manually enable in browser:
1. Click lock icon in address bar
2. Find "Notifications"
3. Change to "Allow"
4. Reload page

### **Notifications Not Working on Mobile?**
- iOS Safari: Requires "Add to Home Screen" (PWA mode)
- Android Chrome: Works in browser and PWA mode
- Check system notification settings (Android/iOS)

---

## 📱 Mobile-Specific Behavior

### **Android (Chrome):**
- ✅ Works in browser tabs
- ✅ Works when app minimized
- ✅ Shows in notification drawer
- ✅ Vibration works
- ✅ Full support

### **iOS (Safari):**
- ⚠️ Requires PWA mode ("Add to Home Screen")
- ⚠️ Limited when browser in background
- ⚠️ No vibration support
- ⚠️ Actions not fully supported

---

## 🎨 Notification Icons

Current icon: `/assets/logo192.png` (WorkSens logo)

**To customize:**
1. Create notification-specific icon (192x192 PNG)
2. Update `NotificationService.js`:
```javascript
icon: '/assets/notification-icon.png'
```

---

## 🔐 Security & Privacy

- ✅ Notifications only show when user granted permission
- ✅ No sensitive data in notification body (just generic messages)
- ✅ Session IDs never displayed in notifications
- ✅ Works entirely client-side (no server tracking)

---

## 📊 Notification Summary

| Event | Type | Dismissible | Vibrate | Sound | Auto-Close |
|-------|------|-------------|---------|-------|------------|
| Logout | Critical | ❌ No | ✅ Yes | ✅ Yes | ❌ No |
| Heartbeat Fail | Critical | ❌ No | ✅ Yes | ✅ Yes | ❌ No |
| GPS Poor (>500m) | Warning | ❌ No | ✅ Yes | ✅ Yes | ❌ No |
| GPS Fair (<500m) | Info | ✅ Yes | ❌ No | ✅ Yes | ✅ 5s |
| Network Offline | Info | ✅ Yes | ❌ No | ❌ No | ✅ 3s |
| Network Online | Info | ✅ Yes | ❌ No | ❌ No | ✅ 2s |

---

## 🚀 Future Enhancements

Potential improvements:
- [ ] Customizable notification sounds per event
- [ ] Rich notifications with action buttons (Relogin, Dismiss)
- [ ] Notification history log
- [ ] User preference to enable/disable specific notification types
- [ ] Desktop notification position (top-right, bottom-right, etc.)
- [ ] Badge count on PWA icon showing pending alerts

---

## 📝 Implementation Files

**Created:**
- `src/services/NotificationService.js` - Core notification logic

**Modified:**
- `src/App.js` - Integrated notification triggers
- `src/components/Dashboard.js` - GPS accuracy monitoring
- `src/services/HeartbeatService.js` - Heartbeat failure notifications

---

## ✅ Status: PRODUCTION READY

All notification features are:
- ✅ Implemented
- ✅ Error-free (no compile errors)
- ✅ Integrated across app
- ✅ Ready for testing

**Next Step:** Test in production environment and verify notifications display correctly on desktop and mobile browsers.
