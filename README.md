# Lumen Calculator

A frosted-glass web calculator built with HTML, CSS and vanilla JavaScript.

This project was created for **UCS 745 Cloud and DevOps Lab, Question 1: GitHub Project with an Intentional Merge Conflict**. The application is deliberately small, because the focus of the assignment is the Git and GitHub workflow: `git init`, `add`, `commit`, `push`, `pull`, branching, merging, and resolving a real merge conflict by hand.

## Features

- Addition, subtraction, multiplication and division
- Decimal numbers, with results rounded to 15 significant digits (so `0.1 + 0.2` shows `0.3`)
- Percentages: `50 %` gives `0.5`, `200 + 10 %` gives `220`, `50 × 10 %` gives `5`
- All clear (AC) and backspace
- Full keyboard input
- Error handling: division by zero, results that are too large, and entries longer than 15 digits
- Pressing `=` again repeats the last operation
- Responsive layout for mobile, tablet and desktop

## Interaction design

- 3D tilt with spring physics that follows the cursor and settles back with a slight wobble when the cursor leaves
- A light glare and a lit rim that follow the cursor across the glass
- Magnetic operator and equals keys
- A cursor-following ambient light and parallax background lights
- A bounce on every key press, including keys pressed on the keyboard
- Long numbers first narrow (using the width axis of the Mona Sans variable font), then shrink, so they always fit
- Respects `prefers-reduced-motion`; cursor effects switch off on touch screens

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `0`–`9`, `.` | Enter a number |
| `+` `-` `*` `/` | Add, subtract, multiply, divide |
| `%` | Percent |
| `Enter` or `=` | Equals |
| `Backspace` (Mac: `delete`) | Delete the last digit |
| `Esc` | Clear all |

## Run locally

There is no build step and there are no dependencies. Open `index.html` in any modern browser:

```bash
open index.html   # macOS
```

## Project structure

```
Q1-Git-Merge-Conflict/
├── index.html   # page structure and calculator markup
├── style.css    # visual design, responsive layout, animations
├── script.js    # calculator logic, keyboard support, cursor-driven motion
└── README.md
```

## Technologies

- HTML5, CSS3 (custom properties, `backdrop-filter`, 3D transforms), JavaScript (ES2020)
- [Mona Sans](https://github.com/github/mona-sans), GitHub's open-source variable typeface, loaded from Google Fonts
- Git and GitHub for version control

## Links

- Repository: https://github.com/GaganbirSingh/lumen-calculator
- Live demo: to be added after deployment
## Lab progress

- Initial version pushed from the local repository.
- This section was added on GitHub to demonstrate git pull.
