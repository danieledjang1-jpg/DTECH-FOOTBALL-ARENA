# DTECH Football Arena

A playable browser-based 5-a-side football arcade game built with **HTML, CSS and JavaScript**. It uses the Canvas API and has no installation dependencies.

## Run the game

1. Extract the `DTECH_FOOTBALL_ARENA.zip` file.
2. Open the extracted `DTECH_FOOTBALL_ARENA` folder in Visual Studio Code.
3. In VS Code, open `index.html`.
4. Right-click inside `index.html` and choose **Open with Live Server** if you have the Live Server extension.
5. Alternatively, double-click `index.html` in File Explorer to open it in your browser.

## Controls

| Key | Action |
|---|---|
| W / A / S / D | Move your selected player |
| Arrow keys | Move your selected player |
| Space | Shoot when you have the ball |
| Shift | Sprint |
| Q | Switch to a teammate |
| Pause button | Pause / resume |
| Restart button | Start the match again |

Aim your shot by holding a direction key together with Space. If you press Space without a direction, your player shoots toward the opponent's goal.

## How to play

- Choose your team and match duration on the main menu.
- Click **Kick Off**.
- You control the player with the yellow ring.
- Move close to the ball to collect it. Passes are not included in this first version; use Q to switch players.
- Move toward the right-side goal and shoot.
- The computer team attacks the left-side goal.
- The scoreboard and match timer update automatically.
- At full time, the result screen shows whether you won, lost or drew.

## Project files

- `index.html` — game layout and screens.
- `style.css` — visual design and responsive layout.
- `game.js` — match logic, player movement, computer opponents, ball physics, goals, timer, sound and controls.

## Learning note

This is an original **2D arcade football prototype**, not a 3D simulation like eFootball or EA SPORTS FC. It is a complete playable first version that can be extended during the XML/JSON module with match history saved in JSON and exported to XML.
