{
  "patcher": {
    "fileversion": 1,
    "appversion": {
      "major": 8,
      "minor": 6,
      "revision": 0,
      "architecture": "x64"
    },
    "classnamespace": "box",
    "rect": [ 50.0, 50.0, 1150.0, 720.0 ],
    "bglocked": 0,
    "openinpresentation": 0,
    "default_fontsize": 12.0,
    "default_fontface": 0,
    "default_fontname": "Arial",
    "gridonopen": 0,
    "gridsize": [ 15.0, 15.0 ],
    "gridsnaponopen": 0,
    "toolbarvisible": 1,
    "boxes": [

      { "box": { "id": "c0", "maxclass": "comment", "text": "Kuramoto Motor Choreo - Architecture (25ms tick) — JS in Max", "patching_rect": [ 30.0, 20.0, 600.0, 20.0 ] } },

      { "box": { "id": "c1", "maxclass": "comment", "text": "1) Place kuramoto_noP.js next to this .maxpat (or edit the js object below).", "patching_rect": [ 30.0, 45.0, 700.0, 20.0 ] } },

      { "box": { "id": "js1", "maxclass": "newobj", "text": "js kuramoto_noP.js", "patching_rect": [ 30.0, 85.0, 220.0, 22.0 ] } },

      { "box": { "id": "c2", "maxclass": "comment", "text": "Clock (25ms)", "patching_rect": [ 30.0, 130.0, 120.0, 20.0 ] } },
      { "box": { "id": "tog1", "maxclass": "toggle", "patching_rect": [ 30.0, 155.0, 24.0, 24.0 ] } },
      { "box": { "id": "mtr1", "maxclass": "newobj", "text": "metro 25", "patching_rect": [ 70.0, 157.0, 70.0, 22.0 ] } },
      { "box": { "id": "btn1", "maxclass": "button", "patching_rect": [ 155.0, 155.0, 24.0, 24.0 ] } },
      { "box": { "id": "c3", "maxclass": "comment", "text": "metro -> bang -> step()", "patching_rect": [ 190.0, 158.0, 180.0, 20.0 ] } },

      { "box": { "id": "msg_bang", "maxclass": "message", "text": "bang", "patching_rect": [ 155.0, 190.0, 50.0, 22.0 ] } },

      { "box": { "id": "c4", "maxclass": "comment", "text": "Controls", "patching_rect": [ 30.0, 235.0, 120.0, 20.0 ] } },

      { "box": { "id": "c_pat", "maxclass": "comment", "text": "pattern (0..5)", "patching_rect": [ 30.0, 265.0, 120.0, 20.0 ] } },
      { "box": { "id": "num_pat", "maxclass": "number", "patching_rect": [ 30.0, 290.0, 60.0, 22.0 ] } },
      { "box": { "id": "msg_pat", "maxclass": "message", "text": "pattern $1", "patching_rect": [ 100.0, 290.0, 90.0, 22.0 ] } },

      { "box": { "id": "c_base", "maxclass": "comment", "text": "base speed (steps/s)", "patching_rect": [ 30.0, 325.0, 160.0, 20.0 ] } },
      { "box": { "id": "num_base", "maxclass": "number", "patching_rect": [ 30.0, 350.0, 80.0, 22.0 ] } },
      { "box": { "id": "msg_base", "maxclass": "message", "text": "setBaseSps $1", "patching_rect": [ 120.0, 350.0, 120.0, 22.0 ] } },
      { "box": { "id": "msg_base_3200", "maxclass": "message", "text": "setBaseSps 3200", "patching_rect": [ 250.0, 350.0, 120.0, 22.0 ] } },

      { "box": { "id": "c_cpl", "maxclass": "comment", "text": "coupling", "patching_rect": [ 30.0, 385.0, 120.0, 20.0 ] } },
      { "box": { "id": "fl_cpl", "maxclass": "flonum", "patching_rect": [ 30.0, 410.0, 80.0, 22.0 ] } },
      { "box": { "id": "msg_cpl", "maxclass": "message", "text": "setCoupling $1", "patching_rect": [ 120.0, 410.0, 120.0, 22.0 ] } },
      { "box": { "id": "msg_cpl_15", "maxclass": "message", "text": "setCoupling 1.5", "patching_rect": [ 250.0, 410.0, 120.0, 22.0 ] } },

      { "box": { "id": "c_scl", "maxclass": "comment", "text": "speed scale", "patching_rect": [ 30.0, 445.0, 120.0, 20.0 ] } },
      { "box": { "id": "fl_scl", "maxclass": "flonum", "patching_rect": [ 30.0, 470.0, 80.0, 22.0 ] } },
      { "box": { "id": "msg_scl", "maxclass": "message", "text": "scale $1", "patching_rect": [ 120.0, 470.0, 80.0, 22.0 ] } },
      { "box": { "id": "msg_scl_1", "maxclass": "message", "text": "scale 1.0", "patching_rect": [ 210.0, 470.0, 80.0, 22.0 ] } },

      { "box": { "id": "c_rst", "maxclass": "comment", "text": "init/reset", "patching_rect": [ 30.0, 505.0, 120.0, 20.0 ] } },
      { "box": { "id": "msg_reset", "maxclass": "message", "text": "reset", "patching_rect": [ 30.0, 530.0, 60.0, 22.0 ] } },

      { "box": { "id": "c_out", "maxclass": "comment", "text": "Ou_
