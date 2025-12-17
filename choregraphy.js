/*
Max/MSP js — Kuramoto motor choreography sandbox
- 10 oscillators (motors)
- Tick: 25ms (stepSize = 0.025s)
- Patterns (library) mapped by P (0..100) -> natural frequencies
- Outputs:
  outlet 0: phases (0..2PI)
  outlet 1: positions for viz (i, x, y, z, r, g, b)
  outlet 2: omega (rad/s) signed
  outlet 3: accel (rad/s^2) signed
  outlet 4: speedStepsPerSec (steps/s) signed
  outlet 5: motorStepPos (cumulative steps positions) + deltaStepsPerTick
*/

inlets = 1;
outlets = 6;

// -------------------- PARAMETERS --------------------
var radius = 0.3;            // visualization radius
var networkSize = 10;        // number of motors/oscillators
var stepSize = 0.025;        // 25ms in seconds
var coupling = 1.5;          // global coupling strength

// Motor mapping
var stepsPerRev = 3200;      // 3200 steps per full revolution
var minSps = -5200;          // clamp motor speeds (steps/s) signed
var maxSps = 5200;
var speedScale = 1.0;        // global multiplier if needed

// Pattern / control
var currentPattern = 0;      // index in patterns[]
var Pvalue = 0;              // input 0..100 (you can feed any value, we clamp)
var autoStep = 0;            // 0=manual calling step(), 1=metro mode via Task
var metroMs = 25;            // if autoStep enabled

// Kuramoto state
var time = 0;                // seconds
var phases = [];
var naturalFrequencies = []; // omega_i (rad/s)
var omega = [];              // observed angular velocity (rad/s) signed
var alpha = [];              // angular accel (rad/s^2) signed
var previousOmega = [];
var couplingMatrix = [];

// Motor step position state (cumulative)
var motorStepPos = [];       // cumulative motor position in steps (float)

// Task for auto stepping (optional)
var _task = null;

// -------------------- UTILITIES --------------------
function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

function mapP(x, inMin, inMax, outMin, outMax) {
    var u = (x - inMin) / (inMax - inMin);
    if (u < 0) u = 0;
    if (u > 1) u = 1;
    return outMin + u * (outMax - outMin);
}

function wrap2pi(x) {
    var twopi = 2 * Math.PI;
    x = x % twopi;
    if (x < 0) x += twopi;
    return x;
}

// Signed phase delta with unwrap into [-PI, PI]
function signedDeltaPhase(newP, oldP) {
    var d = newP - oldP;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
}

function radPerSecToStepsPerSec(w) {
    return (w * stepsPerRev) / (2 * Math.PI);
}

function stepsPerSecToDeltaSteps(sps) {
    return sps * stepSize;
}

// For optional wrap in steps (0..stepsPerRev)
function wrapSteps(steps) {
    var x = steps % stepsPerRev;
    if (x < 0) x += stepsPerRev;
    return x;
}

// smoothstep for rendezvous intensity
function smoothstep(edge0, edge1, x) {
    var t = (x - edge0) / (edge1 - edge0);
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
}

// -------------------- PATTERNS --------------------
var patterns = [
    { name: "UNISON" },
    { name: "FAN_SYMMETRIC" },
    { name: "GROUPS_2" },
    { name: "WAVE_PHASE" },
    { name: "CHASE" },
    { name: "RENDEZVOUS_LOCK" }
];

function setPattern(idx) {
    currentPattern = clamp(idx, 0, patterns.length - 1);
    post("Pattern set to: " + patterns[currentPattern].name + "\n");
}

// Accept P (0..100)
function setP(v) {
    Pvalue = clamp(v, 0, 100);
}

// Convenience: set coupling globally
function setCoupling(value) {
    coupling = value;
    for (var i = 0; i < networkSize; i++) {
        for (var j = 0; j < networkSize; j++) {
            couplingMatrix[i][j] = coupling;
        }
    }
}

// Apply current pattern to naturalFrequencies (omega_i, rad/s)
function applyPattern() {
    // Map P to a base motor speed in steps/s then to base omega (rad/s)
    // You can tune these bounds.
    var baseSps = mapP(Pvalue, 0, 100, 2200, 4200);
    var baseOmega = (baseSps * 2 * Math.PI) / stepsPerRev;

    var name = patterns[currentPattern].name;

    if (name === "UNISON") {
        for (var i = 0; i < networkSize; i++) {
            naturalFrequencies[i] = baseOmega;
        }
        return;
    }

    if (name === "FAN_SYMMETRIC") {
        var spreadSps = mapP(Pvalue, 0, 100, 0, 1400);
        var spreadOmega = (spreadSps * 2 * Math.PI) / stepsPerRev;
        var mid = (networkSize - 1) / 2;
        for (var i = 0; i < networkSize; i++) {
            var d = (i - mid) / mid; // -1..+1
            naturalFrequencies[i] = baseOmega + d * spreadOmega;
        }
        return;
    }

    if (name === "GROUPS_2") {
        var kSps = mapP(Pvalue, 0, 100, 0, 1200);
        var kOmega = (kSps * 2 * Math.PI) / stepsPerRev;
        for (var i = 0; i < networkSize; i++) {
            naturalFrequencies[i] = (i % 2 === 0) ? (baseOmega + kOmega) : (baseOmega - kOmega);
        }
        return;
    }

    if (name === "WAVE_PHASE") {
        var ampSps = mapP(Pvalue, 0, 100, 0, 900);
        var ampOmega = (ampSps * 2 * Math.PI) / stepsPerRev;

        // Temporal wave frequency (controls how fast the wave moves)
        var waveHz = mapP(Pvalue, 0, 100, 0.15, 0.8); // cycles/s
        var omegaT = 2 * Math.PI * waveHz;

        for (var i = 0; i < networkSize; i++) {
            var phase = (2 * Math.PI * i) / networkSize;
            naturalFrequencies[i] = baseOmega + ampOmega * Math.sin(omegaT * time + phase);
        }
        return;
    }

    if (name === "CHASE") {
        var amp2Sps = mapP(Pvalue, 0, 100, 400, 1600);
        var amp2Omega = (amp2Sps * 2 * Math.PI) / stepsPerRev;

        // which motor gets the boost (moves around)
        var idx = Math.floor((time / 0.25) % networkSize); // moves every 250ms
        for (var i = 0; i < networkSize; i++) {
            naturalFrequencies[i] = (i === idx) ? (baseOmega + amp2Omega) : (baseOmega - amp2Omega * 0.2);
        }
        return;
    }

    if (name === "RENDEZVOUS_LOCK") {
        // Base + gentle correction towards same phase every period
        var periodSec = 5.0;
        var phaseT = (time % periodSec) / periodSec; // 0..1
        var recale = smoothstep(0.65, 1.0, phaseT);  // ramps near end
        var strengthSps = recale * 900;              // correction strength in steps/s
        var strengthOmega = (strengthSps * 2 * Math.PI) / stepsPerRev;

        // target phase = 0 rad (rendezvous point)
        for (var i = 0; i < networkSize; i++) {
            var wrapped = wrap2pi(phases[i]);
            // signed error to 0 in [-PI, PI]
            var err = signedDeltaPhase(0, wrapped);
            // proportional correction, clamped
            var corr = clamp(err * 1.2, -strengthOmega, strengthOmega);
            naturalFrequencies[i] = baseOmega + corr;
        }
        return;
    }

    // fallback
    for (var i = 0; i < networkSize; i++) {
        naturalFrequencies[i] = baseOmega;
    }
}

// -------------------- INITIALIZE --------------------
function initialize() {
    post("Initializing network...\n");

    time = 0;
    phases = [];
    naturalFrequencies = [];
    omega = [];
    alpha = [];
    previousOmega = [];
    couplingMatrix = [];
    motorStepPos = [];

    for (var i = 0; i < networkSize; i++) {
        // distributed initial phases
        phases.push((i * Math.PI * 1) / networkSize);
        naturalFrequencies.push(0.0);

        omega.push(0.0);
        alpha.push(0.0);
        previousOmega.push(0.0);

        motorStepPos.push(0.0);

        var row = [];
        for (var j = 0; j < networkSize; j++) {
            row.push(coupling);
        }
        couplingMatrix.push(row);
    }

    post("Network initialized with " + networkSize + " oscillators.\n");
    post("stepSize=" + stepSize + "s (tick ~" + Math.round(stepSize * 1000) + "ms)\n");
    post("Pattern=" + patterns[currentPattern].name + "\n");
}

function loadbang() {
    initialize();
}

// -------------------- CORE STEP --------------------
function step() {
    if (!couplingMatrix || couplingMatrix.length !== networkSize) {
        post("Error: couplingMatrix is not properly initialized.\n");
        return;
    }

    // update natural frequencies from current pattern and P
    applyPattern();

    var oldPhases = phases.slice();

    // Kuramoto integration
    for (var i = 0; i < networkSize; i++) {
        var derivative = naturalFrequencies[i]; // omega_i

        for (var j = 0; j < networkSize; j++) {
            if (couplingMatrix[i][j] !== 0) {
                derivative += (couplingMatrix[i][j] * Math.sin(oldPhases[j] - oldPhases[i])) / networkSize;
            }
        }

        phases[i] = wrap2pi(phases[i] + stepSize * derivative);

        // Signed angular velocity rad/s and accel rad/s^2
        var dphi = signedDeltaPhase(phases[i], oldPhases[i]);
        omega[i] = dphi / stepSize;
        alpha[i] = (omega[i] - previousOmega[i]) / stepSize;
        previousOmega[i] = omega[i];

        // Convert to steps/s and integrate motor step position
        var sps = radPerSecToStepsPerSec(omega[i]) * speedScale;
        sps = clamp(sps, minSps, maxSps);

        var deltaSteps = stepsPerSecToDeltaSteps(sps);
        motorStepPos[i] += deltaSteps;
    }

    time += stepSize;

    // Outputs
    outlet(0, phases);        // phases 0..2PI
    sendPositions();          // viz positions + colors
    outlet(2, omega);         // rad/s (signed)
    outlet(3, alpha);         // rad/s^2 (signed)

    // steps/s signed
    var motorSps = [];
    var motorDelta = [];
    var motorPosWrapped = [];
    for (var k = 0; k < networkSize; k++) {
        var sps2 = radPerSecToStepsPerSec(omega[k]) * speedScale;
        sps2 = clamp(sps2, minSps, maxSps);
        motorSps.push(sps2);
        motorDelta.push(stepsPerSecToDeltaSteps(sps2));
        motorPosWrapped.push(wrapSteps(motorStepPos[k]));
    }
    outlet(4, motorSps); // steps per second (signed)
    // outlet 5: triple payload: [posStepsCum...] + [posWrapped...] + [deltaSteps...]
    // (Max aime bien les listes, donc on met tout dans une grosse liste)
    outlet(5, motorStepPos.concat(motorPosWrapped).concat(motorDelta));
}

// -------------------- VISUAL POSITIONS + COLORS --------------------
function sendPositions() {
    for (var i = 0; i < networkSize; i++) {
        var x = Math.cos(phases[i]) * radius * 2;
        var y = Math.sin(phases[i]) * radius * 2;
        var z = 0;

        // Color based on accel magnitude (normalized)
        var a = Math.abs(alpha[i]);
        // normalize: you can tune the divisor to match your range
        var normalized = clamp(a / 50.0, 0, 1);

        var r = Math.round(normalized * 255);
        var g = Math.round((1 - normalized) * 255);
        var b = 128;

        outlet(1, i, x, y, z, r, g, b);
    }
}

// -------------------- SET PHASES / FREQUENCIES (compat) --------------------
function setPhases() {
    var args = arrayfromargs(arguments);
    if (args.length === networkSize) {
        phases = args.slice();
        // normalize
        for (var i = 0; i < phases.length; i++) phases[i] = wrap2pi(phases[i]);
        post("Phases updated.\n");
    } else if (args.length === 1) {
        var value = args[0];
        phases = [];
        for (var k = 0; k < networkSize; k++) phases.push(wrap2pi(value));
        post("Phases set to uniform value.\n");
    } else {
        post("Error: setPhases expects either " + networkSize + " values or 1 value.\n");
    }
}

function modulateFrequencies() {
    // manual override (rad/s) if you want, not pattern-driven
    var args = arrayfromargs(arguments);
    if (args.length === networkSize) {
        naturalFrequencies = args.slice();
        post("Frequencies updated manually (rad/s).\n");
    } else if (args.length === 1) {
        var v = args[0];
        naturalFrequencies = [];
        for (var i = 0; i < networkSize; i++) naturalFrequencies.push(v);
        post("Frequencies set to uniform value (rad/s).\n");
    } else {
        post("Error: modulateFrequencies expects either " + networkSize + " values or 1 value.\n");
    }
}

// -------------------- AUTO STEP MODE (optional) --------------------
function start() {
    autoStep = 1;
    if (_task) {
        _task.cancel();
        _task = null;
    }
    _task = new Task(_tickTask, this);
    _task.interval = metroMs;
    _task.repeat();
    post("Auto step started (" + metroMs + "ms)\n");
}

function stop() {
    autoStep = 0;
    if (_task) {
        _task.cancel();
        _task = null;
    }
    post("Auto step stopped\n");
}

function setMetro(ms) {
    metroMs = ms;
    if (_task) _task.interval = metroMs;
    post("Metro set to " + metroMs + "ms\n");
}

function _tickTask() {
    step();
}

// -------------------- QUICK COMMANDS --------------------
// bang -> step
function bang() {
    step();
}

// msg "pattern 2" -> setPattern(2)
function pattern(idx) {
    setPattern(idx);
}

// msg "p 64" -> setP(64)
function p(v) {
    setP(v);
}

// msg "scale 1.2" -> speedScale
function scale(v) {
    speedScale = v;
    post("speedScale=" + speedScale + "\n");
}

// msg "stepsperrev 3200"
function stepsperrev(v) {
    stepsPerRev = v;
    post("stepsPerRev=" + stepsPerRev + "\n");
}

// msg "networks 12" (reinit)
function networks(n) {
    networkSize = Math.max(1, Math.floor(n));
    initialize();
}

// msg "reset"
function reset() {
    initialize();
}
