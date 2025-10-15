# BAMS Employee Client - User Guide

## ✨ What's New

Your BAMS Employee Client has been completely redesigned with a professional, minimal interface!

### Key Improvements

#### 🎨 **Modern Professional Design**
- Clean, minimal interface
- Professional "Inter" font family (used by companies like GitHub, Stripe)
- Blue, Red, Green, and White color scheme
- No gradients - flat, modern design
- Subtle shadows and smooth animations

#### 🔧 **Simplified & Functional**
- **Removed:** Location tracking (doesn't work in browsers)
- **Removed:** Platform information (hidden from UI)
- **Added:** Auto-generated permanent Device ID
- **Added:** User instructions modal
- **Added:** Real-time heartbeat countdown timer

## 📱 How to Use

### First Login

1. **Open the application** in your browser
2. **Enter your credentials:**
   - Username or Email
   - Password
3. **Note your Device ID:**
   - Automatically generated and saved
   - Unique to your browser/machine
   - Click 📋 to copy it
4. **Click "Sign In"**

### After Login

1. **Read the instructions** (shows first time only)
   - Keep the tab open in a separate window
   - Don't close the browser tab
   - You'll auto-logout if you lock/shutdown your computer
   - Heartbeat runs every 30 minutes

2. **Monitor your session:**
   - Current time displays in IST
   - Session duration tracks your work time
   - Heartbeat timer counts down from 30:00

3. **Use the buttons:**
   - 📋 **Instructions** - Reopen the user guide
   - 🚪 **Logout** - End your session

## 🔐 Important Security Notes

### Device ID
- **Stored in:** Browser's localStorage (secure)
- **Persistence:** Permanent for this browser
- **Privacy:** Never shared, only used for tracking this device
- **Changing devices?** Contact your administrator

### Session Management
- Auto-logout triggers on:
  - System lock (Win+L)
  - System shutdown
  - Browser close
  - Manual logout

## ⏰ Heartbeat System

### What is it?
Every 30 minutes, the system sends a "heartbeat" to confirm you're still active and working.

### Visual Feedback
- **Green pulse dot** 💚 - Heartbeat active
- **Countdown timer** - Shows time until next heartbeat (e.g., 29:45)
- **Status indicator** - Shows connection status

### What to Watch
- Timer should always be counting down
- If it stops or shows errors, check your internet connection
- Green "Connected" status = everything working properly

## 🌐 Browser Requirements

### Recommended Browsers
- ✅ Google Chrome (latest)
- ✅ Microsoft Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)

### Required Permissions
- ✅ LocalStorage access (for Device ID)
- ✅ Internet connection (for heartbeats)
- ✅ JavaScript enabled

### NOT Recommended
- ❌ Incognito/Private browsing (Device ID won't persist)
- ❌ Browser extensions that block localStorage
- ❌ Very old browser versions

## 📊 Dashboard Information

### Current Time (IST)
- Shows full date and time
- Updates every second
- Always in Indian Standard Time

### Session Information
- **Logged in since:** Your login time
- **Session duration:** How long you've been logged in
- **Session ID:** Unique identifier for this session

### Device Information
- **Device ID:** Your permanent machine identifier

### Status Bar (Bottom)
- **Heartbeat:** Active/Issues
- **Auto-logout:** Enabled/Disabled
- **Version:** Application version number

## 🚨 Troubleshooting

### Logo Not Loading?
- **Shows "BAMS" text instead** - This is normal fallback
- Logo file should be in `/assets/logo.png`
- Contact IT if this persists

### Device ID Not Saving?
- Check if cookies/localStorage is enabled
- Don't use Incognito/Private mode
- Clear browser cache and try again

### Heartbeat Timer Stuck?
- Check your internet connection
- Refresh the page
- If persists, contact your administrator

### Can't Login?
- Verify username/password
- Check internet connection
- Ensure Device ID is showing
- Contact HR/IT support

## 📞 Support

### Need Help?
**Contact your system administrator with:**
- Your Device ID (copy from login/dashboard)
- Screenshot of the issue
- Time and date of the problem
- Browser and version you're using

### Important Contacts
- **IT Support:** [Contact your IT department]
- **HR Support:** [Contact your HR department]  
- **System Admin:** [Contact system administrator]

## 🎯 Best Practices

### Do's ✅
- Keep the tab open during work hours
- Use a dedicated browser window
- Monitor the heartbeat timer
- Report issues immediately
- Keep your browser updated

### Don'ts ❌
- Don't close the browser tab
- Don't use Incognito mode
- Don't clear browser data while logged in
- Don't share your Device ID
- Don't try to manipulate the heartbeat

## 🔄 Version Information

**Current Version:** 1.0.0  
**Release Date:** October 15, 2025  
**Type:** Web Application  
**Platform:** Cross-browser compatible

---

## 📝 Feedback

Your feedback helps us improve! Report any issues or suggestions to your system administrator.

**Thank you for using BAMS Employee Client!** 🙏
