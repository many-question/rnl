#!/usr/bin/env python3
"""Builds and checks the SkyWater SKY130 PDK symbol package, libraries/pdk/sky130/rnl-pdk-sky130.rnl.

Usage:
  python scripts/pdk/sky130.py           # write libraries/pdk/sky130/rnl-pdk-sky130.rnl
  python scripts/pdk/sky130.py --check   # verify package is up-to-date and run rnl check/render on examples
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PKG_DIR = ROOT / "libraries" / "pdk" / "sky130"
PKG_FILE = PKG_DIR / "rnl-pdk-sky130.rnl"
EXAMPLES_DIR = PKG_DIR / "examples"

COUNTS = re.compile(r"(\d+) errors?, (\d+) warnings?, (\d+) hints?")


@dataclass(frozen=True)
class DeviceGroup:
    category: str
    description: str
    models: tuple[str, ...]
    terminals: tuple[str, ...]
    symbol: str
    value_label_from_model: bool = False


# Authoritative SkyWater SKY130 (sky130_fd_pr) device groups and terminal orders.
# Verified against google/skywater-pdk-libs-sky130_fd_pr (v0.2.0, Apache-2.0)
# cells/*/*.model.spice and cells/*/*__subcircuit.pm3.spice.
DEVICE_GROUPS: tuple[DeviceGroup, ...] = (
    # --- 1. 4-terminal NMOS (d g s b) -> $NMOS_4TERM ---
    DeviceGroup(
        category="NMOS (4-terminal)",
        description="1.8 V / 5.0 V / 10.5 V standard, LVT, ESD, special, and RF NMOS (d g s b)",
        models=(
            "sky130_fd_pr__nfet_01v8",
            "sky130_fd_pr__nfet_01v8_lvt",
            "sky130_fd_pr__nfet_g5v0d10v5",
            "sky130_fd_pr__esd_nfet_01v8",
            "sky130_fd_pr__esd_nfet_g5v0d10v5",
            "sky130_fd_pr__special_nfet_latch",
            "sky130_fd_pr__special_nfet_latch_lowleakage",
            "sky130_fd_pr__special_nfet_pass",
            "sky130_fd_pr__special_nfet_pass_lowleakage",
            "sky130_fd_pr__special_nfet_pass_lvt",
            "sky130_fd_pr__special_nfet_pass_flash",
            "sky130_fd_pr__rf_nfet_01v8*",
            "sky130_fd_pr__rf_nfet_g5v0d10v5*",
        ),
        terminals=("d", "g", "s", "b"),
        symbol="$NMOS_4TERM",
    ),
    # --- 2. 4-terminal Native / Zero-Vt NMOS (d g s b) -> $DEPLETION_NMOS_4TERM ---
    DeviceGroup(
        category="Native / Zero-Vt NMOS (4-terminal)",
        description="3.3 V / 5.0 V / 10.5 V / 20 V native-Vt and zero-Vt NMOS (d g s b)",
        models=(
            "sky130_fd_pr__nfet_03v3_nvt",
            "sky130_fd_pr__nfet_05v0_nvt",
            "sky130_fd_pr__esd_nfet_05v0_nvt",
            "sky130_fd_pr__esd_nfet_g5v0d10v5_nvt",
            "sky130_fd_pr__nfet_20v0_nvt",
            "sky130_fd_pr__nfet_20v0_zvt",
        ),
        terminals=("d", "g", "s", "b"),
        symbol="$DEPLETION_NMOS_4TERM",
    ),
    # --- 3. 4-terminal Drain-Extended / 20 V NMOS (d g s b) -> $NDMOS_4TERM ---
    DeviceGroup(
        category="Drain-Extended / 20 V NMOS (4-terminal)",
        description="16 V / 20 V drain-extended and high-voltage NMOS (d g s b)",
        models=(
            "sky130_fd_pr__nfet_g5v0d16v0",
            "sky130_fd_pr__nfet_20v0",
            "sky130_fd_pr__nfet_extenddrain",
            "sky130_fd_pr__esd_rf_nfet_20v0*",
            "sky130_fd_pr__rf_nfet_20v0_aup",
            "sky130_fd_pr__rf_nfet_20v0_nvt_aup",
            "sky130_fd_pr__rf_nfet_20v0_withptap",
            "sky130_fd_pr__rf_nfet_20v0_nvt_withptap",
            "sky130_fd_pr__rf_nfet_20v0_zvt_withptap",
        ),
        terminals=("d", "g", "s", "b"),
        symbol="$NDMOS_4TERM",
    ),
    # --- 4. 5-terminal Isolated 20 V NMOS (d g s b sub) -> $SKY130_NMOS_5TERM ---
    DeviceGroup(
        category="Isolated 20 V NMOS (5-terminal)",
        description="Isolated 20 V NMOS with separate substrate terminal (d g s b sub)",
        models=(
            "sky130_fd_pr__nfet_20v0_iso",
            "sky130_fd_pr__nfet_20v0_nvt_iso",
            "sky130_fd_pr__nfet_20v0_reverse_iso",
            "sky130_fd_pr__rf_nfet_20v0_iso",
            "sky130_fd_pr__rf_nfet_20v0_nvt_iso",
            "sky130_fd_pr__rf_nfet_20v0_zvt_iso",
        ),
        terminals=("d", "g", "s", "b", "sub"),
        symbol="$SKY130_NMOS_5TERM",
    ),
    # --- 5. 4-terminal PMOS (d g s b) -> $PMOS_4TERM ---
    DeviceGroup(
        category="PMOS (4-terminal)",
        description="1.8 V / 5.0 V / 10.5 V standard, LVT, MVT, HVT, ESD, special, and RF PMOS (d g s b)",
        models=(
            "sky130_fd_pr__pfet_01v8",
            "sky130_fd_pr__pfet_01v8_lvt",
            "sky130_fd_pr__pfet_01v8_mvt",
            "sky130_fd_pr__pfet_01v8_hvt",
            "sky130_fd_pr__pfet_g5v0d10v5",
            "sky130_fd_pr__esd_pfet_g5v0d10v5",
            "sky130_fd_pr__special_pfet_pass",
            "sky130_fd_pr__special_pfet_pass_lowleakage",
            "sky130_fd_pr__rf_pfet_01v8*",
        ),
        terminals=("d", "g", "s", "b"),
        symbol="$PMOS_4TERM",
    ),
    # --- 6. 4-terminal Drain-Extended / 20 V PMOS (d g s b) -> $PDMOS_4TERM ---
    DeviceGroup(
        category="Drain-Extended / 20 V PMOS (4-terminal)",
        description="16 V / 20 V drain-extended and high-voltage PMOS (d g s b)",
        models=(
            "sky130_fd_pr__pfet_g5v0d16v0",
            "sky130_fd_pr__pfet_20v0",
            "sky130_fd_pr__pfet_extenddrain",
            "sky130_fd_pr__rf_pfet_20v0*",
        ),
        terminals=("d", "g", "s", "b"),
        symbol="$PDMOS_4TERM",
    ),
    # --- 7. 4-terminal NPN BJT (c b e s) -> $SKY130_NPN_4TERM ---
    DeviceGroup(
        category="NPN BJT (4-terminal)",
        description="5.5 V and 11.0 V vertical NPN bipolar transistors with substrate port (c b e s)",
        models=(
            "sky130_fd_pr__npn_05v5_W1p00L1p00",
            "sky130_fd_pr__npn_05v5_W1p00L2p00",
            "sky130_fd_pr__npn_11v0_W1p00L1p00",
            "sky130_fd_pr__npn_*",
            "sky130_fd_pr__rf_npn_*",
        ),
        terminals=("c", "b", "e", "s"),
        symbol="$SKY130_NPN_4TERM",
    ),
    # --- 8. 4-terminal PNP BJT (c b e s) -> $SKY130_PNP_4TERM ---
    DeviceGroup(
        category="PNP BJT (4-terminal)",
        description="5.5 V vertical substrate PNP bipolar transistors with substrate port (c b e s)",
        models=(
            "sky130_fd_pr__pnp_05v5_W0p68L0p68",
            "sky130_fd_pr__pnp_05v5_W3p40L3p40",
            "sky130_fd_pr__pnp_*",
            "sky130_fd_pr__rf_pnp_*",
        ),
        terminals=("c", "b", "e", "s"),
        symbol="$SKY130_PNP_4TERM",
    ),
    # --- 9. 3-terminal Poly & Well Resistors (r0 r1 b) -> $SKY130_RESISTOR_3TERM ---
    DeviceGroup(
        category="Poly & Well Resistors (3-terminal, r0 r1 b)",
        description="High-sheet-rho and extra-high-sheet-rho precision poly resistors and isolated P-well resistors (r0 r1 b)",
        models=(
            "sky130_fd_pr__res_high_po",
            "sky130_fd_pr__res_high_po_0p35",
            "sky130_fd_pr__res_high_po_0p69",
            "sky130_fd_pr__res_high_po_1p41",
            "sky130_fd_pr__res_high_po_2p85",
            "sky130_fd_pr__res_high_po_5p73",
            "sky130_fd_pr__res_xhigh_po_0p35",
            "sky130_fd_pr__res_xhigh_po_0p69",
            "sky130_fd_pr__res_xhigh_po_1p41",
            "sky130_fd_pr__res_xhigh_po_2p85",
            "sky130_fd_pr__res_xhigh_po_5p73",
            "sky130_fd_pr__res_iso_pw",
            "sky130_fd_pr__res_generic_pw",
        ),
        terminals=("r0", "r1", "b"),
        symbol="$SKY130_RESISTOR_3TERM",
    ),
    # --- 10. 3-terminal Variable-Width Extra-High Poly Resistor (r0 r1 sub) -> $SKY130_RESISTOR_3TERM ---
    DeviceGroup(
        category="Extra-High Poly Resistor (3-terminal, r0 r1 sub)",
        description="Variable-width extra-high-sheet-rho poly resistor (r0 r1 sub)",
        models=(
            "sky130_fd_pr__res_xhigh_po",
        ),
        terminals=("r0", "r1", "sub"),
        symbol="$SKY130_RESISTOR_3TERM",
    ),
    # --- 11. 3-terminal Base Poly Resistor (r1 r2 b) -> $SKY130_RESISTOR_3TERM ---
    DeviceGroup(
        category="Base Extra-High Poly Resistor (3-terminal, r1 r2 b)",
        description="Base subcircuit for extra-high-sheet-rho poly resistor (r1 r2 b)",
        models=(
            "sky130_fd_pr__res_xhigh_po__base",
        ),
        terminals=("r1", "r2", "b"),
        symbol="$SKY130_RESISTOR_3TERM",
    ),
    # --- 12. 3-terminal Diffusion Resistors (t1 t2 b) -> $SKY130_RESISTOR_3TERM ---
    DeviceGroup(
        category="Diffusion Resistors (3-terminal, t1 t2 b)",
        description="N+ and P+ diffusion resistors (1.8 V and 5.5 V HV) with bulk terminal (t1 t2 b)",
        models=(
            "sky130_fd_pr__res_generic_nd",
            "sky130_fd_pr__res_generic_nd__hv",
            "sky130_fd_pr__res_generic_pd",
            "sky130_fd_pr__res_generic_pd__hv",
        ),
        terminals=("t1", "t2", "b"),
        symbol="$SKY130_RESISTOR_3TERM",
    ),
    # --- 13. 2-terminal Generic Poly & Metal Interconnect Resistors (r0 r1) -> $RESISTOR ---
    DeviceGroup(
        category="Poly & Metal Interconnect Resistors (2-terminal, r0 r1)",
        description="2-terminal generic poly, N-well, local interconnect, and metal (M1-M5, RDL) resistors (r0 r1)",
        models=(
            "sky130_fd_pr__res_generic_po",
            "sky130_fd_pr__res_generic_nw",
            "sky130_fd_pr__res_generic_l1",
            "sky130_fd_pr__res_generic_m1",
            "sky130_fd_pr__res_generic_m2",
            "sky130_fd_pr__res_generic_m3",
            "sky130_fd_pr__res_generic_m4",
            "sky130_fd_pr__res_generic_m5",
            "sky130_fd_pr__res_generic_r1",
            "sky130_fd_pr__model__parasitic__res_po",
        ),
        terminals=("r0", "r1"),
        symbol="$RESISTOR",
        value_label_from_model=True,
    ),
    # --- 14. 2-terminal MIM Capacitors (c0 c1) -> $CAPACITOR ---
    DeviceGroup(
        category="MIM Capacitors (2-terminal, c0 c1)",
        description="Metal-insulator-metal capacitors on M3/M4 and M4/M5 (c0 c1)",
        models=(
            "sky130_fd_pr__cap_mim_m3_1",
            "sky130_fd_pr__cap_mim_m3_2",
            "sky130_fd_pr__cap_mim_m3*",
            "sky130_fd_pr__cap_mim_m4*",
        ),
        terminals=("c0", "c1"),
        symbol="$CAPACITOR",
        value_label_from_model=True,
    ),
    # --- 15. 3-terminal MOS Varactors (c0 c1 b) -> $SKY130_VARACTOR_3TERM ---
    DeviceGroup(
        category="MOS Varactors (3-terminal, c0 c1 b)",
        description="LVT and HVT accumulation-mode MOS varactors (c0 c1 b)",
        models=(
            "sky130_fd_pr__cap_var_lvt",
            "sky130_fd_pr__cap_var_hvt",
            "sky130_fd_pr__cap_var",
            "sky130_fd_pr__cap_var_*",
        ),
        terminals=("c0", "c1", "b"),
        symbol="$SKY130_VARACTOR_3TERM",
    ),
    # --- 16. 3-terminal VPP Capacitors (c0 c1 b) -> $SKY130_CAPACITOR_3TERM ---
    DeviceGroup(
        category="VPP Capacitors (3-terminal, c0 c1 b)",
        description="Vertical parallel-plate (VPP) capacitors with substrate terminal (c0 c1 b)",
        models=(
            "sky130_fd_pr__cap_vpp_*",
        ),
        terminals=("c0", "c1", "b"),
        symbol="$SKY130_CAPACITOR_3TERM",
    ),
    # --- 17. 4-terminal Shielded VPP Capacitors (c0 c1 b shield) -> $SKY130_CAPACITOR_4TERM ---
    DeviceGroup(
        category="Shielded VPP Capacitors (4-terminal, c0 c1 b m5/m4/m3)",
        description="Vertical parallel-plate (VPP) capacitors with top metal shield terminal (c0 c1 b m5/m4/m3)",
        models=(
            "sky130_fd_pr__cap_vpp_*_shield*m5*",
            "sky130_fd_pr__cap_vpp_*_shield*m4*",
            "sky130_fd_pr__cap_vpp_*_shield*m3*",
        ),
        terminals=("c0", "c1", "b", "m5"),
        symbol="$SKY130_CAPACITOR_4TERM",
    ),
    # --- 18. 2-terminal Diodes (a k) -> $DIODE ---
    DeviceGroup(
        category="Diodes (2-terminal, a k)",
        description="P-well to N+ and P+ to N-well junction, ESD, and parasitic diodes (a k)",
        models=(
            "sky130_fd_pr__diode_pw2nd_05v5",
            "sky130_fd_pr__diode_pw2nd_05v5_lvt",
            "sky130_fd_pr__diode_pw2nd_05v5_nvt",
            "sky130_fd_pr__diode_pw2nd_11v0",
            "sky130_fd_pr__diode_pd2nw_05v5",
            "sky130_fd_pr__diode_pd2nw_05v5_lvt",
            "sky130_fd_pr__diode_pd2nw_05v5_hvt",
            "sky130_fd_pr__diode_pd2nw_11v0",
            "sky130_fd_pr__diode_*",
            "sky130_fd_pr__esd_rf_diode_*",
            "sky130_fd_pr__model__parasitic__diode_*",
            "sky130_fd_pr__model__parasitic__rf_diode_*",
        ),
        terminals=("a", "k"),
        symbol="$DIODE",
    ),
    # --- 19. 4-terminal Spiral Inductors (a b ct sub) -> $SKY130_INDUCTOR_4TERM ---
    DeviceGroup(
        category="RF Spiral Inductors (4-terminal, a b ct sub)",
        description="Center-tapped RF spiral inductors with substrate terminal (a b ct sub)",
        models=(
            "sky130_fd_pr__ind_03_90",
            "sky130_fd_pr__ind_05_125",
            "sky130_fd_pr__ind_05_220",
            "sky130_fd_pr__ind_*",
        ),
        terminals=("a", "b", "ct", "sub"),
        symbol="$SKY130_INDUCTOR_4TERM",
    ),
)


def render_package() -> str:
    lines: list[str] = []
    lines.append("/* rnl-pdk-sky130 0.1, a PDK symbol package for the SkyWater SKY130 PDK (sky130_fd_pr).")
    lines.append("   Generated by scripts/pdk/sky130.py; run `python scripts/pdk/sky130.py --check` to verify.")
    lines.append("")
    lines.append("   Target PDK: SkyWater Open Source PDK (sky130_fd_pr, v0.2.0 / open_pdks sky130A/sky130B).")
    lines.append("   Upstream PDK repository: https://github.com/google/skywater-pdk-libs-sky130_fd_pr")
    lines.append("   Upstream PDK license: Apache-2.0 (Copyright 2020 The SkyWater PDK Authors).")
    lines.append("   No PDK model parameters, equations, or subcircuit netlists are copied into this file;")
    lines.append("   this package contains only RNL 0.3 terminal name declarations (@DEVICE), schematic")
    lines.append("   symbols (@DEFINE-SYMBOL), and model-to-symbol selection rules (@SELECT-INSTANCE).")
    lines.append("")
    lines.append("   Dialect coverage:")
    lines.append("   - SPICE (.sp, .cir, .spice): subcircuit calls (`XM1 d g s b sky130_fd_pr__nfet_01v8 ...`)")
    lines.append("     and native primitive elements (`D1`, `Q1`, `R1`, `C1`, `M1`) naming SKY130 models.")
    lines.append("   - Spectre (.scs): subcircuit/model instances (`M1 (d g s b) sky130_fd_pr__nfet_01v8 ...`)")
    lines.append("     whose instance names do not start with `X`.")
    lines.append("   - Works both WITHOUT PDK model files included (terminal names come from @DEVICE in the")
    lines.append("     header below) and WITH PDK `.subckt` / `subckt` definitions included (6.12). */")
    lines.append('@RNL(type="header") {')
    lines.append('  @VERSION("0.3");')
    lines.append('  @PACKAGE(name="rnl-pdk-sky130", version="0.1");')
    lines.append('  @USE-PACKAGE(name="rnl-std-basic", version="0.3");')
    lines.append('  @USE-PACKAGE(name="rnl-std-semiconductors", version="0.3");')
    lines.append("")
    lines.append("  /* -------------------------------------------------------------- terminal declarations (6.12) */")

    device_entries: list[str] = []
    for grp in DEVICE_GROUPS:
        terms_str = ", ".join(f'"{t}"' for t in grp.terminals)
        device_entries.append(f"  /* {grp.category}: {grp.description} */")
        for model in grp.models:
            device_entries.append(f'  @DEVICE(name="*", model="{model}", terminals=[{terms_str}]);')

    # Strip trailing semicolon on the very last @DEVICE statement inside @RNL(type="header")
    if device_entries and device_entries[-1].endswith(";"):
        device_entries[-1] = device_entries[-1][:-1]
    lines.extend(device_entries)
    lines.append("}")
    lines.append("")
    lines.append("/* ---------------------------------------------------------------- SKY130 multi-terminal symbols (9.2)")
    lines.append("   Standard 0.3 provides 2-terminal passives ($RESISTOR, $CAPACITOR, $INDUCTOR, $DIODE),")
    lines.append("   3-terminal BJTs ($NPN, $PNP), and 4-terminal MOSFETs ($NMOS_4TERM, $PMOS_4TERM,")
    lines.append("   $DEPLETION_NMOS_4TERM, $NDMOS_4TERM, $PDMOS_4TERM). In sky130_fd_pr, precision poly")
    lines.append("   and diffusion resistors have 3 terminals (with bulk/substrate), MOS varactors and VPP")
    lines.append("   capacitors have 3 or 4 terminals, vertical BJTs are 4-terminal subcircuits (c b e s),")
    lines.append("   isolated 20 V NMOS devices have 5 terminals (d g s b sub), and RF spiral inductors")
    lines.append("   have 4 terminals (a b ct sub). All pins sit on integer grid points (9.2.4). */")
    lines.append("@RNL {")
    lines.append("  /* r0 r1 b (or r0 r1 sub, r1 r2 b, t1 t2 b) = 1 2 3; 3-terminal resistor with substrate/bulk pin */")
    lines.append("  $SKY130_RESISTOR_3TERM = @DEFINE-SYMBOL(box=[-2, -2, 1, 2]) {")
    lines.append('    (0, 2) @PIN(terminal=1, direction="up");')
    lines.append('    (0, -2) @PIN(terminal=2, direction="down");')
    lines.append('    (-2, 0) @PIN(terminal=3, direction="left");')
    lines.append("    @LINE {(0, 2) (0, 0.8721) (0.5372, 0.6395) (-0.4605, 0.407) (0.5372, 0.1163) (-0.4988, -0.1744) (0.5372, -0.4651) (-0.4605, -0.7558) (0, -0.8721) (0, -2)};")
    lines.append("    @LINE {(-2, 0) (-0.85, 0)};")
    lines.append("    @LINE {(-0.85, -0.85) (-0.85, 0.85)};")
    lines.append('    ? @TEXT("${name}", key="name") => @PLACE(0.95, 0.25);')
    lines.append('    ? @TEXT("${model}", key="value") => @PLACE(0.95, -0.95)')
    lines.append("  };")
    lines.append("")
    lines.append("  /* c0 c1 b = 1 2 3; 3-terminal capacitor (VPP / MOS cap) with substrate/bulk pin */")
    lines.append("  $SKY130_CAPACITOR_3TERM = @DEFINE-SYMBOL(box=[-2, -2, 1.2, 2]) {")
    lines.append('    (0, 2) @PIN(terminal=1, direction="up");')
    lines.append('    (0, -2) @PIN(terminal=2, direction="down");')
    lines.append('    (-2, 0) @PIN(terminal=3, direction="left");')
    lines.append("    @LINE(linewidth=0.24) {(0.8051, 0.3234) (-0.8051, 0.3234)};")
    lines.append("    @LINE(linewidth=0.24) {(0.8051, -0.3234) (-0.8051, -0.3234)};")
    lines.append("    @LINE {(0, 0.3234) (0, 2)};")
    lines.append("    @LINE {(0, -0.3234) (0, -2)};")
    lines.append("    @LINE {(-2, 0) (-1.2, 0)};")
    lines.append("    @LINE {(-1.2, -0.8) (-1.2, 0.8)};")
    lines.append('    ? @TEXT("${name}", key="name") => @PLACE(1.2, 0.25);')
    lines.append('    ? @TEXT("${model}", key="value") => @PLACE(1.2, -0.95)')
    lines.append("  };")
    lines.append("")
    lines.append("  /* c0 c1 b shield = 1 2 3 4; 4-terminal shielded VPP capacitor */")
    lines.append("  $SKY130_CAPACITOR_4TERM = @DEFINE-SYMBOL(box=[-2, -2, 2, 2]) {")
    lines.append('    (0, 2) @PIN(terminal=1, direction="up");')
    lines.append('    (0, -2) @PIN(terminal=2, direction="down");')
    lines.append('    (-2, 0) @PIN(terminal=3, direction="left");')
    lines.append('    (2, 0) @PIN(terminal=4, direction="right");')
    lines.append("    @LINE(linewidth=0.24) {(0.8051, 0.3234) (-0.8051, 0.3234)};")
    lines.append("    @LINE(linewidth=0.24) {(0.8051, -0.3234) (-0.8051, -0.3234)};")
    lines.append("    @LINE {(0, 0.3234) (0, 2)};")
    lines.append("    @LINE {(0, -0.3234) (0, -2)};")
    lines.append("    @LINE {(-2, 0) (-1.2, 0)};")
    lines.append("    @LINE {(-1.2, -0.8) (-1.2, 0.8)};")
    lines.append("    @LINE {(1.2, 0) (2, 0)};")
    lines.append("    @LINE {(1.2, -0.8) (1.2, 0.8)};")
    lines.append('    ? @TEXT("${name}", key="name") => @PLACE(1.4, 0.85);')
    lines.append('    ? @TEXT("${model}", key="value") => @PLACE(1.4, -1.25)')
    lines.append("  };")
    lines.append("")
    lines.append("  /* c0 c1 b = 1 2 3; 3-terminal MOS varactor with bulk pin */")
    lines.append("  $SKY130_VARACTOR_3TERM = @DEFINE-SYMBOL(box=[-2, -2, 1.6, 2]) {")
    lines.append('    (0, 2) @PIN(terminal=1, direction="up");')
    lines.append('    (0, -2) @PIN(terminal=2, direction="down");')
    lines.append('    (-2, 0) @PIN(terminal=3, direction="left");')
    lines.append("    @LINE(linewidth=0.24) {(0.8051, 0.3234) (-0.8051, 0.3234)};")
    lines.append("    @LINE(linewidth=0.24) {(0.8051, -0.3234) (-0.8051, -0.3234)};")
    lines.append("    @LINE {(0, 0.3234) (0, 2)};")
    lines.append("    @LINE {(0, -0.3234) (0, -2)};")
    lines.append("    @LINE {(-1.2, -1.2) (0.9, 0.9)};")
    lines.append('    @LINE(fill="linecolor", linestyle="none") {(1.2, 1.2) (0.6, 1) (1, 0.6) (1.2, 1.2)};')
    lines.append("    @LINE {(-2, 0) (-1.35, 0)};")
    lines.append("    @LINE {(-1.35, -0.8) (-1.35, 0.8)};")
    lines.append('    ? @TEXT("${name}", key="name") => @PLACE(1.6, 0.25);')
    lines.append('    ? @TEXT("${model}", key="value") => @PLACE(1.6, -0.95)')
    lines.append("  };")
    lines.append("")
    lines.append("  /* c b e s = 1 2 3 4; 4-terminal NPN BJT with substrate pin at (1, 0) */")
    lines.append("  $SKY130_NPN_4TERM = @DEFINE-SYMBOL(box=[-3, -2, 1, 2]) {")
    lines.append('    (0, 2) @PIN(terminal=1, direction="up");')
    lines.append('    (-3, 0) @PIN(terminal=2, direction="left");')
    lines.append('    (0, -2) @PIN(terminal=3, direction="down");')
    lines.append('    (1, 0) @PIN(terminal=4, direction="right");')
    lines.append("    @LINE {(-3, 0) (-1.6869, 0)};")
    lines.append("    @LINE(linewidth=0.24) {(-1.6869, 1.3346) (-1.6869, -1.333)};")
    lines.append("    @LINE {(-1.6869, 0.6402) (0, 1.338) (0, 2)};")
    lines.append("    @LINE {(-1.6869, -0.6404) (-0.7301, -1.0359)};")
    lines.append("    @LINE {(-0.0936, -1.2991) (0, -1.3378) (0, -2)};")
    lines.append('    @LINE(fill="linecolor", linestyle="none") {(-0.6635, -0.6792) (-0.9953, -1.3378) (0, -1.3378) (-0.6635, -0.6792)};')
    lines.append("    @LINE {(0, -0.45) (0, 0.45)};")
    lines.append("    @LINE {(0, 0) (1, 0)};")
    lines.append('    ? @TEXT("${name}", key="name") => @PLACE(0.5, 1.05);')
    lines.append('    ? @TEXT("${model}", key="model") => @PLACE(0.5, -1.75)')
    lines.append("  };")
    lines.append("")
    lines.append("  /* c b e s = 1 2 3 4; 4-terminal PNP BJT with substrate pin at (1, 0) */")
    lines.append("  $SKY130_PNP_4TERM = @DEFINE-SYMBOL(box=[-3, -2, 1, 2]) {")
    lines.append('    (0, -2) @PIN(terminal=1, direction="down");')
    lines.append('    (-3, 0) @PIN(terminal=2, direction="left");')
    lines.append('    (0, 2) @PIN(terminal=3, direction="up");')
    lines.append('    (1, 0) @PIN(terminal=4, direction="right");')
    lines.append("    @LINE {(-3, 0) (-1.6869, 0)};")
    lines.append("    @LINE(linewidth=0.24) {(-1.6869, 1.3334) (-1.6869, -1.3342)};")
    lines.append("    @LINE {(-0.8575, 0.9694) (0, 1.338) (0, 2)};")
    lines.append("    @LINE {(-1.6869, -0.6402) (0, -1.3378) (0, -2)};")
    lines.append('    @LINE(fill="linecolor", linestyle="none") {(-1.0234, 1.2987) (-0.6916, 0.6402) (-1.6869, 0.6402) (-1.0234, 1.2987)};')
    lines.append("    @LINE {(0, -0.45) (0, 0.45)};")
    lines.append("    @LINE {(0, 0) (1, 0)};")
    lines.append('    ? @TEXT("${name}", key="name") => @PLACE(0.5, 1.05);')
    lines.append('    ? @TEXT("${model}", key="model") => @PLACE(0.5, -1.75)')
    lines.append("  };")
    lines.append("")
    lines.append("  /* d g s b sub = 1 2 3 4 5; 5-terminal isolated 20 V drain-extended NMOS */")
    lines.append("  $SKY130_NMOS_5TERM = @DEFINE-SYMBOL(box=[-3, -2, 1, 2]) {")
    lines.append('    (0, 2) @PIN(terminal=1, direction="up");')
    lines.append('    (-3, 0) @PIN(terminal=2, direction="left");')
    lines.append('    (0, -2) @PIN(terminal=3, direction="down");')
    lines.append('    (1, 0) @PIN(terminal=4, direction="right");')
    lines.append('    (1, -1) @PIN(terminal=5, direction="right");')
    lines.append("    @LINE {(-1.4244, 0.6977) (0, 0.6977) (0, 2)};")
    lines.append("    @LINE {(-1.4244, -0.6977) (0, -0.6977) (0, -2)};")
    lines.append('    @LINE(fill="linecolor", linestyle="none") {(-2.1802, 0.9593) (-2.1802, -0.9593) (-1.8895, -0.9593) (-1.8895, 0.9593) (-2.1802, 0.9593)};')
    lines.append('    @LINE(fill="linecolor", linestyle="none") {(-1.657, 1.25) (-1.657, -1.25) (-1.3663, -1.25) (-1.3663, 1.25) (-1.657, 1.25)};')
    lines.append("    @LINE {(-2.0349, 0) (-3, 0)};")
    lines.append("    @LINE {(-1.5116, 0) (0, 0)};")
    lines.append("    @LINE {(0.6395, 0) (1, 0)};")
    lines.append('    @LINE(fill="linecolor", linestyle="none") {(0, 0) (0.6395, 0.3488) (0.6395, -0.3488) (0, 0)};')
    lines.append("    @LINE {(-1.4244, 0.2977) (0, 0.2977) (0, 0.6977)};")
    lines.append("    @LINE {(0.35, -1.3) (0.35, -0.7)};")
    lines.append("    @LINE {(0.35, -1) (1, -1)};")
    lines.append('    ? @TEXT("${name}", key="name") => @PLACE(0.5, 1.05);')
    lines.append('    ? @TEXT("${model}", key="model") => @PLACE(0.5, -1.75)')
    lines.append("  };")
    lines.append("")
    lines.append("  /* a b ct sub = 1 2 3 4; 4-terminal center-tapped RF spiral inductor */")
    lines.append("  $SKY130_INDUCTOR_4TERM = @DEFINE-SYMBOL(box=[-1, -2, 1, 2]) {")
    lines.append('    (0, 2) @PIN(terminal=1, direction="up");')
    lines.append('    (0, -2) @PIN(terminal=2, direction="down");')
    lines.append('    (-1, 0) @PIN(terminal=3, direction="left");')
    lines.append('    (-1, -1) @PIN(terminal=4, direction="left");')
    lines.append("    @LINE {(0, 2) (0, 1.2)};")
    lines.append('    @ARC(cap="round") {(0, 1.2) (0.2121, 1.1121) (0.3, 0.9)};')
    lines.append("    @ARC {(0.3, 0.9) (0.2121, 0.6879) (0, 0.6)};")
    lines.append("    @ARC {(0, 0.6) (0.3, 0.3) (0, 0)};")
    lines.append("    @ARC {(0, 0) (0.3, -0.3) (0, -0.6)};")
    lines.append("    @ARC {(0.3, -0.6) (0.2121, -0.6879) (0.3, -0.9)};")
    lines.append('    @ARC(cap="round") {(0.3, -0.9) (0.2121, -1.1121) (0, -1.2)};')
    lines.append("    @LINE {(0, -1.2) (0, -2)};")
    lines.append("    @LINE {(-1, 0) (0, 0)};")
    lines.append("    @LINE {(-1, -1) (-0.4, -1)};")
    lines.append("    @LINE {(-0.4, -1.3) (-0.4, -0.7)};")
    lines.append('    ? @TEXT("${name}", key="name") => @PLACE(0.7, 0.25);')
    lines.append('    ? @TEXT("${model}", key="value") => @PLACE(0.7, -0.95)')
    lines.append("  }")
    lines.append("}")
    lines.append("")
    lines.append("/* ---------------------------------------------------------------- model-to-symbol rules (10.1)")
    lines.append("   Broad wildcard patterns come before narrow overrides (such as 4-terminal shielded VPP")
    lines.append("   capacitors overriding 3-terminal VPP capacitors). For 2-terminal passives that reuse")
    lines.append("   $RESISTOR or $CAPACITOR from rnl-std-basic, key=\"value\" defaults to `${model}` so")
    lines.append("   subcircuit calls show their SKY130 model when no explicit value label is set. */")
    lines.append("@RNL {")

    rule_lines: list[str] = []
    for grp in DEVICE_GROUPS:
        rule_lines.append(f"  /* {grp.category} */")
        for model in grp.models:
            rule_lines.append(f'  # @SELECT-INSTANCE(model="{model}") => @SET-SYMBOL {grp.symbol};')
            if grp.value_label_from_model:
                rule_lines.append(f'  # @SELECT-INSTANCE(model="{model}") => @TEXT("${{model}}", key="value");')

    if rule_lines and rule_lines[-1].endswith(";"):
        rule_lines[-1] = rule_lines[-1][:-1]
    lines.extend(rule_lines)
    lines.append("}")
    lines.append("")
    return "\n".join(lines)


def find_rnl(given: str | None = None) -> Path:
    exe = ".exe" if os.name == "nt" else ""
    for cand in (
        given,
        os.environ.get("RNL"),
        ROOT / "target" / "debug" / f"rnl{exe}",
        ROOT / "target" / "release" / f"rnl{exe}",
        shutil.which("rnl"),
    ):
        if cand and Path(cand).is_file():
            return Path(cand)
    raise RuntimeError("no rnl binary found; build with `CARGO_BUILD_JOBS=4 cargo build -p rnl-cli`")


def run_rnl(rnl: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run([str(rnl), *args], capture_output=True, text=True, encoding="utf-8")


def stub_pdk_spice() -> str:
    """Stub SPICE .subckt definitions for verifying With-PDK mode (port order agreement)."""
    lines = [
        "* Stub SKY130 subckt headers for With-PDK port verification (no foundry parameters)",
        '* @RNL { @USE-PACKAGE(name="rnl-std-fill") {} }',
    ]
    seen: set[str] = set()
    for grp in DEVICE_GROUPS:
        terms = " ".join(grp.terminals)
        for model in grp.models:
            if "*" in model or model in seen:
                continue
            seen.add(model)
            lines.append(f".subckt {model} {terms}")
            lines.append(f".ends {model}")
    return "\n".join(lines) + "\n"


def stub_pdk_spectre() -> str:
    """Stub Spectre subckt definitions for verifying With-PDK mode (port order agreement)."""
    lines = [
        "// Stub SKY130 subckt headers for With-PDK port verification (no foundry parameters)",
        '// @RNL { @USE-PACKAGE(name="rnl-std-fill") {} }',
    ]
    seen: set[str] = set()
    for grp in DEVICE_GROUPS:
        terms = " ".join(grp.terminals)
        for model in grp.models:
            if "*" in model or model in seen:
                continue
            seen.add(model)
            lines.append(f"subckt {model} ({terms})")
            lines.append(f"ends {model}")
    return "\n".join(lines) + "\n"


def check_all(rnl_path: str | None = None) -> None:
    expected = render_package()
    if not PKG_FILE.is_file():
        raise RuntimeError(f"missing {PKG_FILE}")
    actual = PKG_FILE.read_text(encoding="utf-8").replace("\r\n", "\n")
    if actual != expected:
        raise RuntimeError(f"{PKG_FILE.relative_to(ROOT)} is out of date; run `python scripts/pdk/sky130.py`")

    rnl = find_rnl(rnl_path)

    # 1. Check the package file itself (0 errors, 0 warnings, 0 hints)
    res = run_rnl(rnl, "check", str(PKG_FILE))
    if res.returncode != 0:
        raise RuntimeError(f"rnl check failed on {PKG_FILE}:\n{res.stdout}\n{res.stderr}")
    m = COUNTS.search(res.stdout + res.stderr)
    if not m or (int(m.group(1)), int(m.group(2)), int(m.group(3))) != (0, 0, 0):
        raise RuntimeError(f"expected 0 errors, 0 warnings, 0 hints on {PKG_FILE}, got:\n{res.stdout}\n{res.stderr}")
    print(f"[ok] rnl check {PKG_FILE.relative_to(ROOT)}: {res.stdout.strip()}")

    # 2. Check and render every example netlist in both Without-PDK and With-PDK modes
    example_files = sorted( list(EXAMPLES_DIR.glob("*.sp")) + list(EXAMPLES_DIR.glob("*.scs")) )
    if not example_files:
        raise RuntimeError(f"no example files found in {EXAMPLES_DIR}")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        (tmp_dir / "sky130_fd_pr_stub.spice").write_text(stub_pdk_spice(), encoding="utf-8")
        (tmp_dir / "sky130_fd_pr_stub.scs").write_text(stub_pdk_spectre(), encoding="utf-8")

        for ex in example_files:
            # (a) Without-PDK mode: run directly on the example file
            res_chk = run_rnl(rnl, "check", "--package-dir", str(PKG_DIR), str(ex))
            if res_chk.returncode != 0:
                raise RuntimeError(f"Without-PDK check failed on {ex.name}:\n{res_chk.stdout}\n{res_chk.stderr}")
            m = COUNTS.search(res_chk.stdout + res_chk.stderr)
            if not m or (int(m.group(1)), int(m.group(2)), int(m.group(3))) != (0, 0, 0):
                raise RuntimeError(f"Without-PDK check had diagnostics on {ex.name}:\n{res_chk.stdout}\n{res_chk.stderr}")

            svg_dir_without = tmp_dir / f"{ex.name}.without-pdk"
            res_rnd = run_rnl(rnl, "render", "--package-dir", str(PKG_DIR), str(ex), "-o", str(svg_dir_without))
            svg_out = svg_dir_without / f"{ex.stem}.svg"
            if res_rnd.returncode != 0 or not svg_out.is_file():
                raise RuntimeError(f"Without-PDK render failed on {ex.name}:\n{res_rnd.stdout}\n{res_rnd.stderr}")
            svg_without = svg_out.read_text(encoding="utf-8")
            if "<svg" not in svg_without:
                raise RuntimeError(f"Invalid SVG output for {ex.name}")
            print(f"[ok] Without-PDK check + render {ex.name}: {res_chk.stdout.strip()}")

            # (b) With-PDK mode: uncomment the .include / include line in a temp copy and verify
            src = ex.read_text(encoding="utf-8").replace("\r\n", "\n")
            if ex.suffix == ".sp":
                with_pdk_src = src.replace(
                    '* .include "sky130_fd_pr_stub.spice"',
                    '.include "sky130_fd_pr_stub.spice"',
                )
            else:
                with_pdk_src = src.replace(
                    '// include "sky130_fd_pr_stub.scs"',
                    'include "sky130_fd_pr_stub.scs"',
                )
            if with_pdk_src == src:
                raise RuntimeError(f"{ex.name} does not contain the stub include comment line for With-PDK testing")
            tmp_ex = tmp_dir / ex.name
            tmp_ex.write_text(with_pdk_src, encoding="utf-8")

            res_chk_pdk = run_rnl(rnl, "check", "--package-dir", str(PKG_DIR), str(tmp_ex))
            if res_chk_pdk.returncode != 0:
                raise RuntimeError(f"With-PDK check failed on {ex.name}:\n{res_chk_pdk.stdout}\n{res_chk_pdk.stderr}")
            m2 = COUNTS.search(res_chk_pdk.stdout + res_chk_pdk.stderr)
            if not m2 or (int(m2.group(1)), int(m2.group(2)), int(m2.group(3))) != (0, 0, 0):
                raise RuntimeError(
                    f"With-PDK check had diagnostics on {ex.name}:\n{res_chk_pdk.stdout}\n{res_chk_pdk.stderr}"
                )

            svg_dir_with = tmp_dir / f"{ex.name}.with-pdk"
            res_rnd_pdk = run_rnl(rnl, "render", "--package-dir", str(PKG_DIR), str(tmp_ex), "-o", str(svg_dir_with))
            svg_out_pdk = svg_dir_with / f"{ex.stem}.svg"
            if res_rnd_pdk.returncode != 0 or not svg_out_pdk.is_file():
                raise RuntimeError(f"With-PDK render failed on {ex.name}:\n{res_rnd_pdk.stdout}\n{res_rnd_pdk.stderr}")
            svg_with = svg_out_pdk.read_text(encoding="utf-8")
            if svg_with != svg_without:
                raise RuntimeError(f"Rendered SVG differs between Without-PDK and With-PDK modes for {ex.name}")
            print(f"[ok] With-PDK check + render {ex.name} (SVG identical): {res_chk_pdk.stdout.strip()}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true", help="verify package and examples with rnl check/render")
    ap.add_argument("--rnl", help="path to rnl binary")
    args = ap.parse_args()

    if args.check:
        check_all(args.rnl)
        return 0

    PKG_DIR.mkdir(parents=True, exist_ok=True)
    PKG_FILE.write_text(render_package(), encoding="utf-8", newline="\n")
    print(f"Wrote {PKG_FILE.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
