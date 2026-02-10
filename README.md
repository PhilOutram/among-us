# SPY BOT - Task-Based Multiplayer Game

A real-time multiplayer web-based task completion game where **Agents** race to complete tasks while **Cyborgs** try to sabotage them. Inspired by the original Android app, built with HTML5, CSS3, JavaScript, and PeerJS for peer-to-peer multiplayer.

## 🎮 Game Overview

SPY BOT is a **task-based social deduction game** where:
- **Agents** (good guys) try to complete all 5 GREEN tasks before time runs out
- **Cyborgs** (spies/bad guys) try to sabotage by completing RED tasks or running down the clock
- Players race against a **10-minute countdown timer**
- The game features **5 different tasks**, each with GREEN and RED variants

## ✨ Key Features

- **🌐 Real-time Multiplayer** - Each player uses their own device
- **📱 Mobile-First Design** - Optimized for phones and tablets
- **🔐 Peer-to-Peer Connection** - No backend server required (uses PeerJS)
- **👥 3-20 Players Supported**
- **⏱️ Countdown Timer** - 10 minutes of tension
- **🎭 Secret Roles** - Cyborgs know each other, Agents don't
- **📊 5 Tasks** - Complete (green) or sabotage (red)
- **🤝 Team Meetings** - Pause and discuss
- **🔍 Expose Mechanic** - Reveal player roles
- **🏆 Multiple Win Conditions**
- **🎵 Atmospheric Sound Design** - Original game audio

## 🚀 How to Play

### 1. **Setup**
- **Host**: Opens the game and clicks "CREATE" → Gets a 4-letter code
- **Players**: Click "JOIN" → Enter the 4-letter code
- **Host**: When everyone is ready, click "START GAME"

### 2. **Role Reveal**
- Each player sees their secret role on their own device
- **Agents**: See they are an agent and must complete GREEN tasks
- **Cyborgs**: See they are a cyborg AND who the other cyborgs are

### 3. **Gameplay**

**The Task System:**
- 5 tasks displayed on the left side of the screen
- Each task has a **GREEN button** (Agent action) and **RED button** (Cyborg action)
- Task states:
  - **Incomplete** - Task not yet done (lights OFF)
  - **Complete** - GREEN task finished (green light ON)
  - **Broken** - RED task sabotaged (red light ON)

**For Agents:**
- Click GREEN buttons to complete tasks
- Goal: Complete all 5 tasks before timer runs out
- Can't click RED buttons

**For Cyborgs:**
- Click RED buttons to break/sabotage tasks
- Goal: Break all tasks OR let timer run out
- Can't click GREEN buttons

**The Timer:**
- Starts at 10:00 (10 minutes)
- Counts down in real-time
- Creates urgency for Agents
- Victory for Cyborgs if it hits 0:00

**Team Meetings:**
- Any player can call a meeting
- Timer pauses during meeting
- Players discuss who they suspect
- Use to coordinate or accuse

**Expose:**
- Reveals if a player is a Cyborg or Agent
- Eliminates exposed Cyborgs
- Use wisely - could backfire!

### 4. **Win Conditions**

**Agents Win:**
- ✅ All 5 GREEN tasks completed
- ✅ OR all Cyborgs are exposed

**Cyborgs Win:**
- ❌ Timer runs out (hits 0:00)
- ❌ OR all 5 RED tasks completed (all tasks broken)

## 🎯 Strategy Tips

### For Agents:
- Work quickly to complete tasks
- Watch for suspicious behavior
- Call meetings if you spot sabotage
- Coordinate with other Agents
- Time is your enemy!

### For Cyborgs:
- Sabotage when no one is watching
- Blend in and act like an Agent
- Coordinate with fellow Cyborgs
- Waste time during meetings
- Let the clock run down!

## 🛠️ Technical Details

### Technologies Used
- **HTML5, CSS3, JavaScript** (vanilla - no frameworks)
- **PeerJS** - Peer-to-peer WebRTC connections
- **Web Audio API** - Sound effects and music

### Architecture
- **Peer-to-Peer Networking**: Players connect directly to each other
- **Host-Authoritative**: Host manages game state and broadcasts updates
- **Real-time State Sync**: All players see task updates instantly

### Browser Compatibility
Works in all modern browsers with WebRTC support:
- Chrome/Edge (recommended)
- Firefox
- Safari (iOS 11+)
- Opera

## 📦 Installation

### Quick Start (No Installation):
1. Download/clone this repository
2. Open `index.html` in a web browser
3. Click "CREATE" or "JOIN"
4. Share the code with friends
5. Play!

### For GitHub Pages:
1. Fork this repository
2. Enable GitHub Pages in settings
3. Set source to main branch
4. Share your GitHub Pages URL

### For Local Server:
```bash
# Python 3
python -m http.server 8000

# Node.js (with http-server)
npx http-server
```

## 📁 File Structure

```
spybot_v2/
├── index.html          # Main HTML structure
├── styles.css          # All styling
├── script.js           # Game logic and networking
├── assets/            # All game assets (45 files)
│   ├── SpyBotLogo.png
│   ├── Agent.png
│   ├── Cyborg.png
│   ├── IntroScreen.png
│   ├── SpyBotBackground.png
│   ├── SplashcreenAgentHQ.png
│   ├── btnCreate.png
│   ├── btnJoin.png
│   ├── btnStart.png
│   ├── btnReset.png
│   ├── btnTeamMeeting.png
│   ├── btnExposed.png
│   ├── TeamAlert.png
│   ├── BtnPlay.png
│   ├── 1_GRN_OFF.png to 5_GRN_OFF.png
│   ├── 1_GRN_ON.png to 5_GRN_ON.png
│   ├── 1_RED_OFF.png to 5_RED_OFF.png
│   ├── 1_RED_ON.png to 5_RED_ON.png
│   ├── Darkambientmusic.mp3
│   ├── Click.wav
│   ├── Beep.mp3
│   ├── Explosion.mp3
│   ├── Siren.mp3
│   └── Iwilldestroyyou.mp3
└── README.md
```

## 🎨 Visual Design

- Futuristic cyberpunk theme
- LED-style task indicators (inspired by hardware switches)
- Dark backgrounds with bright accents
- Retro sci-fi aesthetic
- Responsive layout for all devices

## 🔊 Audio

All original sound effects from the Android app:
- Background ambient music
- Click sounds for interactions
- Beep for task completion
- Explosion for sabotage
- Siren for alerts and meetings
- Cyborg reveal sound

## 🆚 Comparison to Original App

This web version faithfully recreates the original Android app with:
- ✅ Same 5-task system
- ✅ Same role mechanics (Agent vs Cyborg)
- ✅ Same visual assets and sounds
- ✅ Same countdown timer
- ✅ Same win conditions
- ✅ Cross-platform (works on any device with a browser)
- ✅ No installation required

Differences:
- Uses PeerJS instead of CloudDB for multiplayer
- Web-based instead of Android app
- No app store needed

## ⚠️ Known Limitations

1. **Host Must Stay Connected**: If host disconnects, game ends
2. **Internet Required**: Needs active internet for P2P connections
3. **Browser Compatibility**: Works best on Chrome/Edge
4. **Network Restrictions**: Some corporate networks may block WebRTC

## 🛠 Troubleshooting

### "Failed to create/join game"
- Check internet connection
- Try refreshing the page
- Use Chrome or Edge browser
- Check the game code is exactly 4 letters

### Tasks not updating
- Ensure you're clicking the correct button for your role
- Check if task is already completed
- Refresh if connection is lost

### Timer not working
- Host controls timer
- Timer pauses during meetings
- Check connection status

### Sounds not playing
- Click on page first (browsers require user interaction)
- Check browser isn't muted
- Allow audio permissions

## 🔒 Privacy & Security

- **No Data Collection**: Everything runs in browsers
- **Peer-to-Peer Only**: No central server
- **Temporary Codes**: Game codes are random and temporary
- **No Account Required**: No signup needed
- **Local Only**: No data leaves your devices

## 📝 Credits

- Original Android app created with MIT App Inventor
- Web conversion by extracting from .aia file
- All original assets and sounds included
- Built with PeerJS for networking

## 🎉 Ready to Play!

1. **Host** opens game → Creates with 4-letter code
2. **Players** join with the code
3. **Host** starts game
4. **Everyone** sees their role
5. **Agents** complete GREEN tasks
6. **Cyborgs** sabotage with RED tasks
7. **First team** to win condition wins!

**Complete the mission or sabotage it - the choice is yours!** 🤖🔧

---

*This is a faithful web recreation of the original SPY BOT Android game. All assets and mechanics preserved from the original .aia file.*

**Version 1.0** - Web-based multiplayer task completion game
