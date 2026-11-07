// shared/not-found.js - Starts the rain behind the not-found page that neon1.tech serves for
// unknown paths.

import { rain } from "/shared/rain.js";

// The rain, with the lens magnifying it behind the glass pane and the button, as on the landing
rain({ canvas: document.getElementById("rain"), lens: document.getElementById("lens"), panes: () => document.querySelectorAll(".nf, .nf a") });
