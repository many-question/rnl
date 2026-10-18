# rnl-pdk-sky130

The RNL 0.3 symbol package `rnl-pdk-sky130` 0.1, [`rnl-pdk-sky130.rnl`](rnl-pdk-sky130.rnl), for the **SkyWater Open Source PDK** (`sky130_fd_pr`, v0.2.0 / `open_pdks` `sky130A` & `sky130B`).

In foundry PDKs, transistors, precision resistors, capacitors, varactors, diodes, and inductors are instantiated as subcircuit calls (such as `XM1 d g s b sky130_fd_pr__nfet_01v8 w=4 l=0.15` in SPICE or `M1 (d g s b) sky130_fd_pr__nfet_01v8 w=4u l=0.15u` in Spectre). Without a PDK package, RNL's standard rule packages (`rnl-std-spice` and `rnl-std-spectre`) cannot tell the device polarity or terminal names of `X` subcircuit instances and draw them as generic rectangular boxes. `rnl-pdk-sky130` maps `sky130_fd_pr` devices to standard RNL 0.3 schematic symbols (and custom multi-terminal symbols where SKY130 devices carry extra substrate, bulk, or shield pins) and declares their terminal names with `@DEVICE` (standard 6.12, 9.2, 10.1, 16.2).

- **Target PDK**: [SkyWater SKY130 `sky130_fd_pr`](https://github.com/google/skywater-pdk-libs-sky130_fd_pr) (v0.2.0, upstream license `Apache-2.0`).
- **No foundry model data**: This package contains only RNL `@DEVICE` terminal declarations, `@DEFINE-SYMBOL` drawings, and `@SELECT-INSTANCE` rules. No SPICE/Spectre model parameters, equations, or PDK subcircuit netlists are copied into this repository.
- **Package license**: Like the rest of `libraries/`, this file is released under `CC0-1.0` ([`REUSE.toml`](../../../REUSE.toml)).

---

## 1. Quick Start

Reference `rnl-pdk-sky130` in the `@RNL(type="header")` record of a SPICE or Spectre netlist:

```spice
* @RNL(type="header") {
*   @VERSION("0.3");
*   @USE-PACKAGE(name="rnl-pdk-sky130", version="0.1")
* }
```

Check or render the netlist by passing `--package-dir libraries/pdk/sky130` to `rnl`:

```sh
rnl check --package-dir libraries/pdk/sky130 libraries/pdk/sky130/examples/ota5t.sp
rnl render --package-dir libraries/pdk/sky130 libraries/pdk/sky130/examples/ota5t.sp -o out
```

### Without PDK Models vs. With PDK Models

`rnl-pdk-sky130` works identically whether or not the netlist includes the SKY130 model library files on disk:

1. **Without PDK model files included**: When a netlist is checked or rendered standalone (or before a full PDK installation is present), the `@DEVICE(name="*", model="sky130_fd_pr__...", terminals=[...])` declarations in `rnl-pdk-sky130.rnl`'s header record supply the exact terminal names (`d`, `g`, `s`, `b`, `c`, `e`, `r0`, `r1`, `c0`, `c1`, etc.) for every SKY130 device (standard 6.12).
2. **With PDK `.subckt` / `subckt` definitions included**: When the netlist includes the SKY130 model files via `.include` / `.lib` (SPICE) or `include` (Spectre), RNL reads the port names from each `.subckt` / `subckt` header (standard 6.12). Because the `@DEVICE` declarations in `rnl-pdk-sky130.rnl` match the authoritative `sky130_fd_pr` `.subckt` port orders, all terminal references (`#XM1:d`, `#XR1:r0`, `#XQ1:e`, `#XC1:c0`) resolve to the exact same pins in both modes.

> **Note on `.include` / `.lib`**: RNL's SPICE and Spectre host adapters read every active `.include` / `.lib` / `include` directive and report an error if the referenced file does not exist on disk. For standalone schematic files when the full PDK is not installed locally, keep the `.include` / `.lib` directive commented out or point it to a lightweight stub file containing `.subckt ... .ends` headers.

### SPICE and Spectre Dialect Support

Every `@DEVICE` declaration in `rnl-pdk-sky130.rnl` uses `name="*"` and every symbol rule selects by `model="..."` (`# @SELECT-INSTANCE(model="sky130_fd_pr__...") => @SET-SYMBOL ...`). As a result, the package works across both dialects without modification:

- **SPICE**: Subcircuit calls (`XM1 d g s b sky130_fd_pr__nfet_01v8 w=4 l=0.15`, `XR1 r0 r1 b sky130_fd_pr__res_high_po_0p35 l=10`) as well as primitive elements (`D1`, `Q1`, `M1`, `R1`, `C1`).
- **Spectre**: Instances without an `X` prefix (`M1 (d g s b) sky130_fd_pr__nfet_01v8 w=4u l=0.15u`, `CL (c0 c1) sky130_fd_pr__cap_mim_m3_1 w=10u l=10u`).

### Displaying `W/L` and Device Parameters in Labels

In RNL 0.3 (standard 13.6), referencing a host parameter such as `${w}` or `${l}` in a label requires that parameter to be written on the instance line (otherwise the text fails with a diagnostic because RNL does not evaluate omitted parameters from `.subckt` defaults). Therefore:

- By default, `rnl-pdk-sky130` shows `${name}` (`key="name"`) and `${model}` (`key="model"` on transistors/BJTs, `key="value"` on resistors/capacitors/inductors) so that any instance—even one relying on default PDK parameters—checks cleanly with zero errors.
- To display `W/L` or passive dimensions in the schematic, override `key="model"` or `key="value"` in your netlist's `@RNL` block using a selection rule or per-instance `@TEXT`:

```rnl
# @SELECT-INSTANCE(model="sky130_fd_pr__*fet*") => @TEXT("W/L=${w}/${l}", key="model");
# @SELECT-INSTANCE(model="sky130_fd_pr__res_high_po_*") => @TEXT("L=${l}", key="value");
# @SELECT-INSTANCE(model="sky130_fd_pr__cap_mim_*") => @TEXT("${w}\times{}${l} \mu{}m^{2}", key="value");
# @SELECT-INSTANCE(model="sky130_fd_pr__pnp_*") => @TEXT("m=${mult}", key="model");
```

Because `key="model"` and `key="value"` match the keys defined in the symbols, overriding their text content preserves the symbol's local label position automatically (standard 13.3).

---

## 2. Supported SKY130 Devices (`sky130_fd_pr`)

| Category | Models / Patterns | Terminals (Order) | Symbol |
| --- | --- | --- | --- |
| **NMOS (4-terminal)** | `sky130_fd_pr__nfet_01v8`, `sky130_fd_pr__nfet_01v8_lvt`, `sky130_fd_pr__nfet_g5v0d10v5`, `sky130_fd_pr__esd_nfet_01v8`, `sky130_fd_pr__esd_nfet_g5v0d10v5`, `sky130_fd_pr__special_nfet_latch*`, `sky130_fd_pr__special_nfet_pass*`, `sky130_fd_pr__rf_nfet_01v8*`, `sky130_fd_pr__rf_nfet_g5v0d10v5*` | `d g s b` (`1 2 3 4`) | `$NMOS_4TERM` |
| **Native / Zero-Vt NMOS (4-terminal)** | `sky130_fd_pr__nfet_03v3_nvt`, `sky130_fd_pr__nfet_05v0_nvt`, `sky130_fd_pr__esd_nfet_05v0_nvt`, `sky130_fd_pr__esd_nfet_g5v0d10v5_nvt`, `sky130_fd_pr__nfet_20v0_nvt`, `sky130_fd_pr__nfet_20v0_zvt` | `d g s b` (`1 2 3 4`) | `$DEPLETION_NMOS_4TERM` |
| **Drain-Extended / 20 V NMOS (4-terminal)** | `sky130_fd_pr__nfet_g5v0d16v0`, `sky130_fd_pr__nfet_20v0`, `sky130_fd_pr__nfet_extenddrain`, `sky130_fd_pr__esd_rf_nfet_20v0*`, `sky130_fd_pr__rf_nfet_20v0_aup`, `sky130_fd_pr__rf_nfet_20v0_nvt_aup`, `sky130_fd_pr__rf_nfet_20v0_*withptap` | `d g s b` (`1 2 3 4`) | `$NDMOS_4TERM` |
| **Isolated 20 V NMOS (5-terminal)** | `sky130_fd_pr__nfet_20v0_iso`, `sky130_fd_pr__nfet_20v0_nvt_iso`, `sky130_fd_pr__nfet_20v0_reverse_iso`, `sky130_fd_pr__rf_nfet_20v0_*iso` | `d g s b sub` (`1 2 3 4 5`) | `$SKY130_NMOS_5TERM` |
| **PMOS (4-terminal)** | `sky130_fd_pr__pfet_01v8`, `sky130_fd_pr__pfet_01v8_lvt`, `sky130_fd_pr__pfet_01v8_mvt`, `sky130_fd_pr__pfet_01v8_hvt`, `sky130_fd_pr__pfet_g5v0d10v5`, `sky130_fd_pr__esd_pfet_g5v0d10v5`, `sky130_fd_pr__special_pfet_pass*`, `sky130_fd_pr__rf_pfet_01v8*` | `d g s b` (`1 2 3 4`) | `$PMOS_4TERM` |
| **Drain-Extended / 20 V PMOS (4-terminal)** | `sky130_fd_pr__pfet_g5v0d16v0`, `sky130_fd_pr__pfet_20v0`, `sky130_fd_pr__pfet_extenddrain`, `sky130_fd_pr__rf_pfet_20v0*` | `d g s b` (`1 2 3 4`) | `$PDMOS_4TERM` |
| **NPN BJT (4-terminal)** | `sky130_fd_pr__npn_05v5_W1p00L1p00`, `sky130_fd_pr__npn_05v5_W1p00L2p00`, `sky130_fd_pr__npn_11v0_W1p00L1p00`, `sky130_fd_pr__npn_*`, `sky130_fd_pr__rf_npn_*` | `c b e s` (`1 2 3 4`) | `$SKY130_NPN_4TERM` |
| **PNP BJT (4-terminal)** | `sky130_fd_pr__pnp_05v5_W0p68L0p68`, `sky130_fd_pr__pnp_05v5_W3p40L3p40`, `sky130_fd_pr__pnp_*`, `sky130_fd_pr__rf_pnp_*` | `c b e s` (`1 2 3 4`) | `$SKY130_PNP_4TERM` |
| **Precision Poly & Well Resistors (3-terminal)** | `sky130_fd_pr__res_high_po`, `sky130_fd_pr__res_high_po_0p35`..`5p73`, `sky130_fd_pr__res_xhigh_po_0p35`..`5p73`, `sky130_fd_pr__res_iso_pw`, `sky130_fd_pr__res_generic_pw` | `r0 r1 b` (`1 2 3`) | `$SKY130_RESISTOR_3TERM` |
| **Variable-Width Extra-High Poly Resistor (3-terminal)** | `sky130_fd_pr__res_xhigh_po` | `r0 r1 sub` (`1 2 3`) | `$SKY130_RESISTOR_3TERM` |
| **Base Extra-High Poly Resistor (3-terminal)** | `sky130_fd_pr__res_xhigh_po__base` | `r1 r2 b` (`1 2 3`) | `$SKY130_RESISTOR_3TERM` |
| **Diffusion Resistors (3-terminal)** | `sky130_fd_pr__res_generic_nd`, `sky130_fd_pr__res_generic_nd__hv`, `sky130_fd_pr__res_generic_pd`, `sky130_fd_pr__res_generic_pd__hv` | `t1 t2 b` (`1 2 3`) | `$SKY130_RESISTOR_3TERM` |
| **Poly & Metal Interconnect Resistors (2-terminal)** | `sky130_fd_pr__res_generic_po`, `sky130_fd_pr__res_generic_nw`, `sky130_fd_pr__res_generic_l1`, `sky130_fd_pr__res_generic_m1`..`m5`, `sky130_fd_pr__res_generic_r1`, `sky130_fd_pr__model__parasitic__res_po` | `r0 r1` (`1 2`) | `$RESISTOR` |
| **MIM Capacitors (2-terminal)** | `sky130_fd_pr__cap_mim_m3_1`, `sky130_fd_pr__cap_mim_m3_2`, `sky130_fd_pr__cap_mim_m3*`, `sky130_fd_pr__cap_mim_m4*` | `c0 c1` (`1 2`) | `$CAPACITOR` |
| **MOS Varactors (3-terminal)** | `sky130_fd_pr__cap_var_lvt`, `sky130_fd_pr__cap_var_hvt`, `sky130_fd_pr__cap_var*` | `c0 c1 b` (`1 2 3`) | `$SKY130_VARACTOR_3TERM` |
| **VPP Capacitors (3-terminal)** | `sky130_fd_pr__cap_vpp_*` (unshielded / 3-terminal variants) | `c0 c1 b` (`1 2 3`) | `$SKY130_CAPACITOR_3TERM` |
| **Shielded VPP Capacitors (4-terminal)** | `sky130_fd_pr__cap_vpp_*_shield*m5*`, `sky130_fd_pr__cap_vpp_*_shield*m4*`, `sky130_fd_pr__cap_vpp_*_shield*m3*` | `c0 c1 b m5` (`1 2 3 4`) | `$SKY130_CAPACITOR_4TERM` |
| **Diodes (2-terminal)** | `sky130_fd_pr__diode_pw2nd_05v5*`, `sky130_fd_pr__diode_pw2nd_11v0`, `sky130_fd_pr__diode_pd2nw_05v5*`, `sky130_fd_pr__diode_pd2nw_11v0`, `sky130_fd_pr__diode_*`, `sky130_fd_pr__esd_rf_diode_*`, `sky130_fd_pr__model__parasitic__*diode_*` | `a k` (`1 2`) | `$DIODE` |
| **RF Spiral Inductors (4-terminal)** | `sky130_fd_pr__ind_03_90`, `sky130_fd_pr__ind_05_125`, `sky130_fd_pr__ind_05_220`, `sky130_fd_pr__ind_*` | `a b ct sub` (`1 2 3 4`) | `$SKY130_INDUCTOR_4TERM` |

### Custom Symbols Defined by `rnl-pdk-sky130`

All pins are placed on integer grid points (standard 9.2.4):

| Symbol | Pins (`terminal: (x, y) direction`) | Used For |
| --- | --- | --- |
| `$SKY130_RESISTOR_3TERM` | `1: (0, 2) up`, `2: (0, -2) down`, `3: (-2, 0) left` | 3-terminal poly, well, and diffusion resistors (`r0 r1 b`, `r0 r1 sub`, `r1 r2 b`, `t1 t2 b`) |
| `$SKY130_CAPACITOR_3TERM` | `1: (0, 2) up`, `2: (0, -2) down`, `3: (-2, 0) left` | 3-terminal VPP capacitors (`c0 c1 b`) |
| `$SKY130_CAPACITOR_4TERM` | `1: (0, 2) up`, `2: (0, -2) down`, `3: (-2, 0) left`, `4: (2, 0) right` | 4-terminal shielded VPP capacitors (`c0 c1 b m5`) |
| `$SKY130_VARACTOR_3TERM` | `1: (0, 2) up`, `2: (0, -2) down`, `3: (-2, 0) left` | 3-terminal MOS varactors (`c0 c1 b`) |
| `$SKY130_NPN_4TERM` | `1: (0, 2) up`, `2: (-3, 0) left`, `3: (0, -2) down`, `4: (1, 0) right` | 4-terminal vertical NPN subcircuits (`c b e s`) |
| `$SKY130_PNP_4TERM` | `1: (0, -2) down`, `2: (-3, 0) left`, `3: (0, 2) up`, `4: (1, 0) right` | 4-terminal vertical PNP subcircuits (`c b e s`) |
| `$SKY130_NMOS_5TERM` | `1: (0, 2) up`, `2: (-3, 0) left`, `3: (0, -2) down`, `4: (1, 0) right`, `5: (1, -1) right` | 5-terminal isolated 20 V drain-extended NMOS (`d g s b sub`) |
| `$SKY130_INDUCTOR_4TERM` | `1: (0, 2) up`, `2: (0, -2) down`, `3: (-1, 0) left`, `4: (-1, -1) left` | 4-terminal center-tapped RF spiral inductors (`a b ct sub`) |

---

## 3. Examples and Verification Script

The [`examples/`](examples/) directory contains four complete SKY130 schematics:

| File | Dialect | Circuit & SKY130 Devices Demonstrated |
| --- | --- | --- |
| [`examples/ota5t.sp`](examples/ota5t.sp) | SPICE | Five-transistor OTA with `sky130_fd_pr__nfet_01v8`, `sky130_fd_pr__pfet_01v8`, and `sky130_fd_pr__cap_mim_m3_1` load capacitor |
| [`examples/ota5t.scs`](examples/ota5t.scs) | Spectre | Five-transistor OTA in Spectre syntax (`M1`–`M6`, `CL` without `X` prefixes) |
| [`examples/bandgap.sp`](examples/bandgap.sp) | SPICE | CMOS bandgap reference core with `sky130_fd_pr__pnp_05v5_W3p40L3p40` (`XQ1`, `XQ2`), 3-terminal `sky130_fd_pr__res_high_po_0p35` (`XR1`–`XR3`), and `sky130_fd_pr__pfet_01v8_lvt` mirror (`XM1`, `XM2`) |
| [`examples/mim_switch.sp`](examples/mim_switch.sp) | SPICE | Switched-capacitor sampling network with `sky130_fd_pr__cap_mim_m3_1`/`m3_2` (`XC1`, `XC2`), LVT CMOS transmission gate (`sky130_fd_pr__nfet_01v8_lvt`, `sky130_fd_pr__pfet_01v8_lvt`), 5 V native-Vt bottom-plate switch (`sky130_fd_pr__nfet_05v0_nvt`), and input clamp diode (`sky130_fd_pr__diode_pw2nd_05v5`) |

To regenerate `rnl-pdk-sky130.rnl` or verify the package and all examples (both without PDK model files and with stubbed `.subckt` / `subckt` definitions):

```sh
python scripts/pdk/sky130.py
python scripts/pdk/sky130.py --check
```

---

## 4. How to Create an RNL Symbol Package for Another PDK

Foundry PDKs—whether open-source (GF180MCU, IHP SG13G2) or commercial (TSMC, UMC, SMIC, GlobalFoundries)—all follow the same structural pattern in SPICE and Spectre netlists: devices are instantiated as subcircuits or models with foundry-specific names and fixed port orders. Creating an RNL 0.3 symbol package for any PDK takes five steps and requires **zero foundry model parameters or proprietary equations** in the package file.

### Step 1: Inventory Device Names and Port Orders from the PDK

Extract only the `.subckt` / `.model` (SPICE) or `subckt` / `model` (Spectre) header lines from the PDK model directory:

```sh
# SPICE / ngspice / HSPICE / Xyce model files
grep -rhE '^\s*\.(subckt|model)\b' /path/to/pdk/models/ | sort -u

# Spectre (.scs) model files
grep -rhE '^\s*(inline\s+)?subckt\b' /path/to/pdk/models/spectre/ | sort -u
```

Pay close attention to:
1. **Terminal count**: Many PDK passives and BJTs have an extra substrate, bulk, or shield terminal compared to textbook 2-terminal or 3-terminal SPICE primitives (for example, 3-terminal poly/diffusion resistors, 3-terminal MIM/VPP capacitors, 4-terminal vertical BJTs, 4-terminal HBT with substrate node, or 5-terminal isolated HV MOSFETs in deep N-well).
2. **Terminal names and order**: Even within the same PDK, different resistor or capacitor families may name their ports differently (such as `r0 r1 b` vs. `r0 r1 sub` vs. `t1 t2 b` in SKY130).

### Step 2: Declare `@DEVICE` in `@RNL(type="header")`

In the package's `@RNL(type="header")` block, declare `@VERSION("0.3")`, `@PACKAGE(name="...", version="...")`, reference `rnl-std-basic` and `rnl-std-semiconductors`, and write one `@DEVICE` statement per model name or wildcard pattern (standard 6.12):

```rnl
@RNL(type="header") {
  @VERSION("0.3");
  @PACKAGE(name="rnl-pdk-example", version="0.1");
  @USE-PACKAGE(name="rnl-std-basic", version="0.3");
  @USE-PACKAGE(name="rnl-std-semiconductors", version="0.3");

  @DEVICE(name="*", model="nmos_3v3*", terminals=["d", "g", "s", "b"]);
  @DEVICE(name="*", model="pmos_3v3*", terminals=["d", "g", "s", "b"]);
  @DEVICE(name="*", model="rpoly_h*", terminals=["p", "n", "sub"])
}
```

Always set `name="*"` (rather than `name="X*"`):
- In SPICE, subcircuit calls start with `X` (`XM1`), while `.model`-backed primitives start with `M`, `Q`, `D`, `R`, `C`.
- In Spectre, subcircuit and model instances have no element-letter prefix (`M1`, `R1`, `Q1`).
- `name="*"` matches both dialects with a single declaration.

### Step 3: Reuse Standard Symbols or Define Multi-Terminal Symbols

When a PDK device's port order matches a standard RNL 0.3 symbol, reuse the standard symbol directly:

| Standard Symbol | Package | Pin Order (`1, 2, ...`) |
| --- | --- | --- |
| `$NMOS_4TERM`, `$DEPLETION_NMOS_4TERM`, `$NDMOS_4TERM` | `rnl-std-semiconductors` | `1=d (0, 2) up`, `2=g (-3, 0) left`, `3=s (0, -2) down`, `4=b (1, 0) right` |
| `$PMOS_4TERM`, `$DEPLETION_PMOS_4TERM`, `$PDMOS_4TERM` | `rnl-std-semiconductors` | `1=d (0, -2) down`, `2=g (-3, 0) left`, `3=s (0, 2) up`, `4=b (1, 0) right` |
| `$NPN` / `$PNP` | `rnl-std-semiconductors` | `1=c`, `2=b`, `3=e` (3 pins only) |
| `$DIODE`, `$ZENER_DIODE` | `rnl-std-semiconductors` | `1=a (-2, 0) left`, `2=k (2, 0) right` |
| `$RESISTOR`, `$CAPACITOR`, `$INDUCTOR` | `rnl-std-basic` | `1=p (0, 2) up`, `2=n (0, -2) down` (2 pins only) |

When a PDK device has additional terminals (such as a 3-terminal resistor, 3-terminal capacitor, 4-terminal BJT, or 5-terminal isolated MOSFET) or a permuted port order:
- Define a package-scoped symbol (`$PDKNAME_... = @DEFINE-SYMBOL(box=[...]) { ... }`) whose `@PIN(terminal=k, ...)` numbers match the 1-based position of each port in the PDK `.subckt` header.
- Keep all `@PIN` coordinates on integer grid points so `rnl check` produces zero hints (standard 9.2.4).
- If two devices have the same electrical symbol but permuted port orders in their `.subckt` headers, copy the symbol body and renumber `terminal=` on the `@PIN` statements to match the `.subckt` port positions.

### Step 4: Map Models to Symbols with `@SELECT-INSTANCE`

In the `@RNL { ... }` body of the package, assign symbols by `model` (standard 10.1):

```rnl
@RNL {
  # @SELECT-INSTANCE(model="nmos_3v3*") => @SET-SYMBOL $NMOS_4TERM;
  # @SELECT-INSTANCE(model="pmos_3v3*") => @SET-SYMBOL $PMOS_4TERM;
  # @SELECT-INSTANCE(model="rpoly_h*") => @SET-SYMBOL $EXAMPLE_RESISTOR_3TERM
}
```

Order broad wildcard patterns before narrower overrides (later rules in the appearance queue win at equal priority, standard 8.3).

### Step 5: PDK-Specific Notes for Common Open and Commercial PDKs

1. **GlobalFoundries GF180MCU (`gf180mcu_fd_pr`)**:
   - **MOSFETs**: `nfet_03v3`, `nfet_03v3_dss`, `nfet_06v0`, `nfet_06v0_nvt`, `pfet_03v3`, `pfet_03v3_dss`, `pfet_06v0` all use 4 terminals `d g s b` (`1 2 3 4`) and map directly to `$NMOS_4TERM`, `$DEPLETION_NMOS_4TERM`, and `$PMOS_4TERM`.
   - **Resistors**: Precision poly and well resistors (`ppolyf_u`, `npolyf_u`, `rm1`..`rmtop`) include 3-terminal substrate-coupled subcircuits (`r0 r1 sub` or `p n b` -> `$SKY130_RESISTOR_3TERM`-style 3-pin symbol) alongside 2-terminal metal resistors (`$RESISTOR`).
   - **Capacitors & BJTs**: `cap_mim_2f0*` uses 2 terminals (`c0 c1` -> `$CAPACITOR`), MOS cap `cap_nmos_03v3` / `cap_pmos_03v3` uses 2 or 3 terminals, and vertical/lateral BJTs (`npn_10p00x10p00`, `pnp_10p00x00p42`) use 4 terminals (`c b e s`).
2. **IHP SG13G2 (`ihp-sg13g2`)**:
   - **MOSFETs**: `sg13_lv_nmos`, `sg13_hv_nmos` (`d g s b` -> `$NMOS_4TERM`) and `sg13_lv_pmos`, `sg13_hv_pmos` (`d g s b` -> `$PMOS_4TERM`).
   - **SiGe HBTs**: `npn13G2`, `npn13G2l`, `npn13G2v` are 4-terminal subcircuits with port order `c b e Bn` (`Bn` is the substrate/collector-well node) or 5-terminal with thermal node `dt`; define a 4-pin or 5-pin NPN symbol just like `$SKY130_NPN_4TERM`.
   - **Passives**: Poly resistors `rsil`, `rppd`, `rhigh` are 3-terminal (`p n b`), while MIM capacitor `cap_cmim` is 2-terminal (`t b` or `c0 c1`).
3. **Commercial PDKs (TSMC, UMC, SMIC, etc.)**:
   - **NDA & IP cleanliness**: Because an RNL PDK package contains only device names (`nch_lvt_mac`, `pch_lvt_mac`, `rppolywo_m`) and port names (`d g s b`, `p n b`), it never embeds proprietary BSIM/PSP model cards, corner tables, or DRC rules. Teams can keep a private `rnl-pdk-<foundry>-<node>.rnl` in their internal CAD library directory and load it via `--package-dir`.
   - **Spectre `inline subckt` and `_mac` wrappers**: Virtuoso/Spectre netlists in commercial PDKs often instantiate macro wrappers (`nch_mac`, `pch_ulvt_mac`) without an `X` prefix (`M0 (d g s b) nch_mac w=1u l=40n`). Using `@DEVICE(name="*", model="nch*", terminals=["d", "g", "s", "b"])` and `# @SELECT-INSTANCE(model="nch*") => @SET-SYMBOL $NMOS_4TERM` covers both SPICE `.subckt` calls and Spectre `inline subckt` instances seamlessly.
