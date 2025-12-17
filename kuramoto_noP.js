inlets = 1;
outlets = 6;

// --------- Params Kuramoto / viz ----------
var radius = 0.3;
var networkSize = 10;
var stepSize = 0.025; // 25ms
var coupling = 1.5;

// --------- Motor mapping ----------
var stepsPerRev = 3200;
var minSps = -5200;
var maxSps = 5200;
var speedScale = 1.0;

// --------- Base speed (NO P) ----------
var baseSps = 3200; // 1 rev/s
var baseOmega = 0;  // computed from baseSps

// --------- Pattern selection ----------
var currentPattern = 0;
var patterns = [
    {name: "UNISON"},
    {name: "FAN_SYMMETRIC"},
    {name: "GROUPS_2"},
    {name: "WAVE_PHASE"},
    {name: "CHASE"},
    {name: "RENDEZVOUS_LOCK"}
];

// --------- State ----------
var time = 0;
var phases = [];
var naturalFrequencies = [];
var omega = [];
var alpha = [];
var previousOmega = [];
var couplingMatrix = [];
var motorStepPos = [];

// --------- Auto step ----------
var metroMs = 25;
var _task = null;

// --------- Utils ----------
function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

function wrap2pi(x) {
    var twopi = 2 * Math.PI;
    x = x % twopi;
    if (x < 0) x += twopi;
    return x;
}

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

function wrapSteps(steps) {
    var x = steps % stepsPerRev;
    if (x < 0) x += stepsPerRev;
    return x;
}

function smoothstep(edge0, edge1, x) {
    var t = (x - edge0) / (edge1 - edge0);
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
}

function updateBaseOmega() {
    baseOmega = (baseSps * 2 * Math.PI) / stepsPerRev;
}

// --------- Init ----------
function initialize() {
    post("Initializing network (NO P version)...\n");

    time = 0;
    phases = [];
    naturalFrequencies = [];
    omega = [];
    alpha = [];
    previousOmega = [];
    couplingMatrix = [];
    motorStepPos = [];

    updateBaseOmega();

    for (var i = 0; i < networkSize; i++) {
        phases.push((i * Math.PI * 1) / networkSize);
        naturalFrequencies.push(baseOmega);

        omega.push(0.0);
        alpha.push(0.0);
        previousOmega.push(0.0);

        motorStepPos.push(0.0);

        var row = [];
        for (var j = 0; j < networkSize; j++) row.push(coupling);
        couplingMatrix.push(row);
    }

    post("Network initialized: N=" + networkSize + " stepSize=" + stepSize + "s\n");
    post("Base speed: " + baseSps + " steps/s (baseOmega=" + baseOmega.toFixed(4) + " rad/s)\n");
    post("Pattern: " + patterns[currentPattern].name + "\n");
}

function loadbang() {
    initialize();
}

// --------- Control (same spirit as original) ----------
function setCoupling(value) {
    coupling = value;
    for (var i = 0; i < networkSize; i++) {
        for (var j = 0; j < networkSize; j++) couplingMatrix[i][j] = coupling;
    }
    post("Coupling set to " + coupling + "\n");
}

function setPhases() {
    var args = arrayfromargs(arguments);
    if (args.length === networkSize) {
        phases = args.slice();
        for (var i = 0; i < phases.length; i++) phases[i] = wrap2pi(phases[i]);
        post("Phases updated.\n");
    } else if (args.length === 1) {
        var value = args[0];
        phases = [];
        for (var k = 0; k < networkSize; k++) phases.push(wrap2pi(value));
        post("Phases set to uniform value.\n");
    } else {
        post("Error: setPhases expects " + networkSize + " values or 1 value.\n");
    }
}

// Original-style manual frequency modulation still possible:
function modulateFrequencies() {
    var args = arrayfromargs(arguments);
    if (args.length === networkSize) {
        naturalFrequencies = args.slice();
        post("Manual naturalFrequencies set (rad/s).\n");
    } else if (args.length === 1) {
        var v = args[0];
        naturalFrequencies = [];
        for (var i = 0; i < networkSize; i++) naturalFrequencies.push(v);
        post("Manual naturalFrequencies uniform (rad/s).\n");
    } else {
        post("Error: modulateFrequencies expects " + networkSize + " values or 1 value.\n");
    }
}

// More user-friendly base speed setters:
function setBaseSps(v) {
    baseSps = v;
    updateBaseOmega();
    post("Base speed set to " + baseSps + " steps/s (baseOmega=" + baseOmega.toFixed(4) + ")\n");
}

function setBaseOmega(v) {
    baseOmega = v;
    baseSps = radPerSecToStepsPerSec(baseOmega);
    post("Base omega set to " + baseOmega + " rad/s (baseSps=" + baseSps.toFixed(1) + ")\n");
}

function pattern(idx) {
    currentPattern = clamp(idx, 0, patterns.length - 1);
    post("Pattern set to " + patterns[currentPattern].name + "\n");
}

// --------- Apply pattern (NO P) ----------
function applyPatternNoP() {
    var name = patterns[currentPattern].name;

    if (name === "UNISON") {
        for (var i = 0; i < networkSize; i++) naturalFrequencies[i] = baseOmega;
        return;
    }

    if (name === "FAN_SYMMETRIC") {
        // fixed spread around base
        var spreadSps = 1200; // tune
        var spreadOmega = (spreadSps * 2 * Math.PI) / stepsPerRev;
        var mid = (networkSize - 1) / 2;
        for (var i = 0; i < networkSize; i++) {
            var d = (i - mid) / mid; // -1..+1
            naturalFrequencies[i] = baseOmega + d * spreadOmega;
        }
        return;
    }

    if (name === "GROUPS_2") {
        var kSps = 1000; // tune
        var kOmega = (kSps * 2 * Math.PI) / stepsPerRev;
        for (var i = 0; i < networkSize; i++) {
            naturalFrequencies[i] = (i % 2 === 0) ? (baseOmega + kOmega) : (baseOmega - kOmega);
        }
        return;
    }

    if (name === "WAVE_PHASE") {
        var ampSps = 800; // tune
        var ampOmega = (ampSps * 2 * Math.PI) / stepsPerRev;
        var waveHz = 0.35;          // fixed speed
        var omegaT = 2 * Math.PI * waveHz;
        for (var i = 0; i < networkSize; i++) {
            var ph = (2 * Math.PI * i) / networkSize;
            naturalFrequencies[i] = baseOmega + ampOmega * Math.sin(omegaT * time + ph);
        }
        return;
    }

    if (name === "CHASE") {
        var amp2Sps = 1400; // tune
        var amp2Omega = (amp2Sps * 2 * Math.PI) / stepsPerRev;
        var idx = Math.floor((time / 0.25) % networkSize);
        for (var i = 0; i < networkSize; i++) {
            naturalFrequencies[i] = (i === idx) ? (baseOmega + amp2Omega) : (baseOmega - amp2Omega * 0.2);
        }
        return;
    }

    if (name === "RENDEZVOUS_LOCK") {
        var periodSec = 5.0;
        var phaseT = (time % periodSec) / periodSec;
        var recale = smoothstep(0.65, 1.0, phaseT);

        var strengthSps = recale * 900;
        var strengthOmega = (strengthSps * 2 * Math.PI) / stepsPerRev;

        for (var i = 0; i < networkSize; i++) {
            var wrapped = wrap2pi(phases[i]);
            var err = signedDeltaPhase(0, wrapped);
            var corr = clamp(err * 1.2, -strengthOmega, strengthOmega);
            naturalFrequencies[i] = baseOmega + corr;
        }
        return;
    }

    for (var i = 0; i < networkSize; i++) naturalFrequencies[i] = baseOmega;
}

// --------- Step ----------
function step() {
    if (!couplingMatrix || couplingMatrix.length !== networkSize) {
        post("Error: couplingMatrix not initialized.\n");
        return;
    }

    // pattern fills naturalFrequencies[]
    applyPatternNoP();

    var oldPhases = phases.slice();

    for (var i = 0; i < networkSize; i++) {
        var derivative = naturalFrequencies[i];

        for (var j = 0; j < networkSize; j++) {
            if (couplingMatrix[i][j] !== 0) {
                derivative += (couplingMatrix[i][j] * Math.sin(oldPhases[j] - oldPhases[i])) / networkSize;
            }
        }

        phases[i] = wrap2pi(phases[i] + stepSize * derivative);

        var dphi = signedDeltaPhase(phases[i], oldPhases[i]);
        omega[i] = dphi / stepSize;
        alpha[i] = (omega[i] - previousOmega[i]) / stepSize;
        previousOmega[i] = omega[i];

        var sps = radPerSecToStepsPerSec(omega[i]) * speedScale;
        sps = clamp(sps, minSps, maxSps);
        var dSteps = stepsPerSecToDeltaSteps(sps);
        motorStepPos[i] += dSteps;
    }

    time += stepSize;

    outlet(0, phases);
    sendPositions();
    outlet(2, omega);
    outlet(3, alpha);

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
    outlet(4, motorSps);
    outlet(5, motorStepPos.concat(motorPosWrapped).concat(motorDelta));
}

// --------- Viz ----------
function sendPositions() {
    for (var i = 0; i < networkSize; i++) {
        var x = Math.cos(phases[i]) * radius * 2;
        var y = Math.sin(phases[i]) * radius * 2;
        var z = 0;

        var a = Math.abs(alpha[i]);
        var normalized = clamp(a / 50.0, 0, 1);

        var r = Math.round(normalized * 255);
        var g = Math.round((1 - normalized) * 255);
        var b = 128;

        outlet(1, i, x, y, z, r, g, b);
    }
}

// --------- Auto step ----------
function start() {
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

function bang() {
    step();
}

function reset() {
    initialize();
}

function networks(n) {
    networkSize = Math.max(1, Math.floor(n));
    initialize();
}

function scale(v) {
    speedScale = v;
    post("speedScale=" + speedScale + "\n");
}

function stepsperrev(v) {
    stepsPerRev = v;
    updateBaseOmega();
    post("stepsPerRev=" + stepsPerRev + " baseOmega=" + baseOmega.toFixed(4) + "\n");
}
