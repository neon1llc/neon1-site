// shared/not-found.js - Starts the rain behind the not-found page that neon1.tech serves for
// unknown paths.

import { rain } from "/shared/rain.js";

// The rain alone; the pane is plain tinted glass, so it needs no lens
rain({ canvas: document.getElementById("rain") });
